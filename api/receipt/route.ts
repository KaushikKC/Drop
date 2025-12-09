import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getAsset, savePayment, getPaymentBySignature } from "@/lib/storage";
import { signJwt } from "@/lib/jwt";
import { isChallengeExpired } from "@/lib/payment-challenge";

// ERC20 ABI (minimal - just what we need)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

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

    // Setup Ethereum provider
    const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || "https://sepolia.base.org";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const tokenAddress = asset.mint || process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || "";

    if (!tokenAddress) {
      return NextResponse.json(
        { error: "token_address_not_configured" },
        { status: 500 }
      );
    }

    // Wait for transaction to be confirmed (with retries)
    let receipt = null;
    for (let i = 0; i < 5; i++) {
      receipt = await provider.getTransactionReceipt(signature);
      if (receipt) break;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }

    if (!receipt) {
      console.error("Transaction not found after retries:", signature);
      return NextResponse.json(
        {
          error: "invalid_tx",
          message: "Transaction not found. Check on explorer:",
          explorerUrl: `https://sepolia.basescan.org/tx/${signature}`,
        },
        { status: 400 }
      );
    }

    if (receipt.status !== 1) {
      console.error("Transaction failed:", receipt.status);
      return NextResponse.json(
        {
          error: "invalid_tx",
          txError: "Transaction failed",
          explorerUrl: `https://sepolia.basescan.org/tx/${signature}`,
        },
        { status: 400 }
      );
    }

    // Verify token transfer using ERC20 Transfer events
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const recipient = asset.recipient.toLowerCase();

    // Parse Transfer events from logs
    const transferEvents = receipt.logs
      .map((log) => {
        try {
          return tokenContract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter((parsed) => parsed && parsed.name === 'Transfer') as Array<{
      name: string;
      args: { from: string; to: string; value: bigint };
    }>;

    // Find transfer to expected recipient
    const relevantTransfer = transferEvents.find(
      (event) => event.args.to.toLowerCase() === recipient
    );

    if (!relevantTransfer) {
      return NextResponse.json(
        {
          error: "no_transfer_found",
          explorerUrl: `https://sepolia.basescan.org/tx/${signature}`,
        },
        { status: 400 }
      );
    }

    const { from, to, value } = relevantTransfer.args;
    const expectedAmount = BigInt(asset.price);

    // Verify amount matches (allow small tolerance for rounding)
    const amountDiff = value > expectedAmount 
      ? value - expectedAmount 
      : expectedAmount - value;
    const tolerance = expectedAmount / BigInt(10000); // 0.01% tolerance

    if (amountDiff > tolerance) {
      return NextResponse.json(
        {
          error: "bad_amount",
          received: value.toString(),
          required: expectedAmount.toString(),
          destination: to,
        },
        { status: 400 }
      );
    }

    // Extract payer from transaction
    const tx = await provider.getTransaction(signature);
    const feePayer = tx?.from || from;

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
