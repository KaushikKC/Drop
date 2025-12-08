import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, TokenBalance } from "@solana/web3.js";
import { solanaConfig } from "@/lib/solana-config";
import { getAsset, savePayment, getPaymentBySignature } from "@/lib/storage";
import { signJwt } from "@/lib/jwt";
import { isChallengeExpired } from "@/lib/payment-challenge";

function toBase58FromAccountKey(key: unknown): string {
  if (typeof key === "object" && key !== null) {
    const rec = key as {
      toBase58?: () => string;
      pubkey?: { toBase58?: () => string };
    };
    if (typeof rec.toBase58 === "function") {
      return rec.toBase58();
    }
    if (rec.pubkey && typeof rec.pubkey.toBase58 === "function") {
      return rec.pubkey.toBase58();
    }
  }
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const { signature, paymentRequestToken, imageId, challenge } =
      (await req.json()) as {
        signature: string;
        paymentRequestToken: string;
        imageId: string;
        challenge?: {
          expiresAt?: number;
        };
      };

    if (!signature || !paymentRequestToken || !imageId) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    // Validate challenge expiration if provided
    if (challenge?.expiresAt) {
      const now = Math.floor(Date.now() / 1000);
      if (challenge.expiresAt < now) {
        return NextResponse.json(
          { error: "challenge_expired", expiresAt: challenge.expiresAt },
          { status: 400 }
        );
      }
    }

    // Check if payment already processed
    const existingPayment = await getPaymentBySignature(signature);
    if (existingPayment) {
      // Payment already verified, return access token
      const accessToken = signJwt({ assetId: imageId }, "5m");
      return NextResponse.json({ accessToken });
    }

    // Get asset to verify payment amount
    const asset = await getAsset(imageId);
    if (!asset) {
      return NextResponse.json({ error: "asset_not_found" }, { status: 404 });
    }

    // Load and validate transaction
    const conn = new Connection(solanaConfig.endpoint, "confirmed");

    // Wait for transaction to be confirmed (with retries)
    let tx = null;
    for (let i = 0; i < 5; i++) {
      tx = await conn.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
      if (tx && tx.meta) break;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }

    if (!tx) {
      console.error("Transaction not found after retries:", signature);
      return NextResponse.json(
        {
          error: "invalid_tx",
          message: "Transaction not found. Check on explorer:",
          explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        },
        { status: 400 }
      );
    }

    if (tx.meta?.err) {
      console.error("Transaction error:", tx.meta.err);
      return NextResponse.json(
        {
          error: "invalid_tx",
          txError: tx.meta.err,
          explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        },
        { status: 400 }
      );
    }

    // Verify token transfer
    const mint = new PublicKey(asset.mint).toBase58();
    const recipient = new PublicKey(asset.recipient).toBase58();

    // First, try to find the transfer instruction in the parsed transaction
    const instructions = tx.transaction.message.instructions;
    let transferFound = false;
    let transferAmount = BigInt(0);
    let transferDestination: string | null = null;

    // Check parsed instructions for token transfer
    for (const ix of instructions) {
      if (
        "parsed" in ix &&
        ix.parsed &&
        typeof ix.parsed === "object" &&
        "type" in ix.parsed &&
        ix.parsed.type === "transfer" &&
        "info" in ix.parsed
      ) {
        const info = ix.parsed.info as {
          amount?: string;
          destination?: string;
          source?: string;
        };
        if (info.amount && info.destination) {
          transferAmount = BigInt(info.amount);
          transferDestination = info.destination;
          transferFound = true;
          console.log("Found transfer instruction:", {
            amount: info.amount,
            destination: info.destination,
            source: info.source,
          });
          break;
        }
      }
    }

    // If we found a transfer instruction, verify it matches
    if (transferFound) {
      const expectedAmount = BigInt(asset.price);
      if (transferAmount !== expectedAmount) {
        return NextResponse.json(
          {
            error: "bad_amount",
            received: transferAmount.toString(),
            required: expectedAmount.toString(),
            destination: transferDestination,
          },
          { status: 400 }
        );
      }
    } else {
      // Fallback to token balance checking
      const post: TokenBalance[] = tx.meta?.postTokenBalances ?? [];
      const pre: TokenBalance[] = tx.meta?.preTokenBalances ?? [];

      // Debug: Log all token balances
      console.log("Payment verification debug:", {
        signature,
        mint,
        recipient,
        expectedAmount: asset.price.toString(),
        allPostBalances: post.map((b) => ({
          mint: b.mint,
          owner: b.owner,
          amount: b.uiTokenAmount.amount,
          decimals: b.uiTokenAmount.decimals,
          uiAmount: b.uiTokenAmount.uiAmountString,
          accountIndex: b.accountIndex,
        })),
        allPreBalances: pre.map((b) => ({
          mint: b.mint,
          owner: b.owner,
          amount: b.uiTokenAmount.amount,
          decimals: b.uiTokenAmount.decimals,
          uiAmount: b.uiTokenAmount.uiAmountString,
          accountIndex: b.accountIndex,
        })),
      });

      // Get account keys to find token account addresses
      const accountKeys = (tx.transaction.message as { accountKeys: unknown[] })
        .accountKeys;
      const accountKeyStrings = accountKeys.map((key) =>
        toBase58FromAccountKey(key)
      );

      console.log("Account keys in transaction:", accountKeyStrings);

      // Find token accounts by mint (not by owner)
      const preBal = pre.find((b) => b.mint === mint);
      const postBal = post.find((b) => b.mint === mint);

      console.log("Matched balances:", {
        preBal: preBal
          ? {
              mint: preBal.mint,
              owner: preBal.owner,
              amount: preBal.uiTokenAmount.amount,
              uiAmount: preBal.uiTokenAmount.uiAmountString,
              accountIndex: preBal.accountIndex,
              accountKey: accountKeyStrings[preBal.accountIndex],
            }
          : null,
        postBal: postBal
          ? {
              mint: postBal.mint,
              owner: postBal.owner,
              amount: postBal.uiTokenAmount.amount,
              uiAmount: postBal.uiTokenAmount.uiAmountString,
              accountIndex: postBal.accountIndex,
              accountKey: accountKeyStrings[postBal.accountIndex],
            }
          : null,
      });

      if (!postBal) {
        console.error("No post balance found for mint:", {
          recipient,
          mint,
          availableOwners: [...new Set(post.map((b) => b.owner))],
          availableMints: [...new Set(post.map((b) => b.mint))],
        });
        return NextResponse.json({ error: "no_credit" }, { status: 400 });
      }

      if (postBal.uiTokenAmount.decimals !== asset.decimals) {
        return NextResponse.json(
          {
            error: "bad_decimals",
            received: postBal.uiTokenAmount.decimals,
            expected: asset.decimals,
          },
          { status: 400 }
        );
      }

      const preAmount = BigInt(preBal?.uiTokenAmount.amount ?? "0");
      const postAmount = BigInt(postBal.uiTokenAmount.amount);
      const delta = postAmount - preAmount;

      const expectedAmount = BigInt(asset.price);

      console.log("Amount comparison:", {
        preAmount: preAmount.toString(),
        postAmount: postAmount.toString(),
        delta: delta.toString(),
        expectedAmount: expectedAmount.toString(),
        match: delta === expectedAmount,
      });

      // For new accounts, the entire post balance is the transfer
      if (!preBal && postAmount === expectedAmount) {
        // New account created with exact amount - valid
        transferFound = true;
      } else if (delta === expectedAmount) {
        // Existing account with correct delta - valid
        transferFound = true;
      } else {
        return NextResponse.json(
          {
            error: "bad_amount",
            received: delta.toString(),
            required: expectedAmount.toString(),
            preAmount: preAmount.toString(),
            postAmount: postAmount.toString(),
            isNewAccount: !preBal,
          },
          { status: 400 }
        );
      }
    }

    if (!transferFound) {
      return NextResponse.json(
        {
          error: "no_transfer_found",
          explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        },
        { status: 400 }
      );
    }

    // Extract payer from transaction
    const firstKey = (tx.transaction.message as { accountKeys: unknown[] })
      .accountKeys[0];
    const feePayer = toBase58FromAccountKey(firstKey);

    // Note: Self-payments are allowed for testing purposes
    // In production, you might want to prevent this

    // Save payment record
    await savePayment({
      assetId: imageId,
      signature,
      payer: feePayer,
      amount: asset.price,
      timestamp: Date.now(),
      paymentRequestToken,
    });

    // Mint reputation NFT for payer (async, don't block response)
    console.log(
      "🔄 Triggering reputation update and NFT minting for payer:",
      feePayer
    );
    try {
      const { updateReputationAndMintNFT } = await import(
        "@/lib/reputation-storage"
      );
      updateReputationAndMintNFT(feePayer, asset.price)
        .then(() => {
          console.log(
            "✅ Reputation update and NFT minting completed for:",
            feePayer
          );
        })
        .catch((err) => {
          console.error("❌ Error minting reputation NFT:", err);
          console.error(
            "Error details:",
            err instanceof Error ? err.message : String(err)
          );
          // Don't fail the payment if NFT minting fails
        });
    } catch (err) {
      console.error("❌ Error importing reputation module:", err);
    }

    // Generate access token
    const accessToken = signJwt({ assetId: imageId }, "5m");

    return NextResponse.json({ accessToken });
  } catch (e) {
    console.error("POST /api/receipt error:", e);
    const reason =
      process.env.NODE_ENV === "production"
        ? undefined
        : e instanceof Error
        ? e.message
        : String(e);
    return NextResponse.json(
      { error: "server_error", reason },
      { status: 500 }
    );
  }
}
