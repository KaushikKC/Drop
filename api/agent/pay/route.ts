/**
 * Autonomous Agent Payment API
 * Makes payment using agent's private key (server-side, no popups)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { getAgentWallet, saveAgentWallet } from "@/lib/agent-wallet-storage";
import { getAgentKeypair } from "@/lib/agent-wallet";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agentId,
      password,
      assetId,
      paymentChallenge,
      paymentRequestToken,
    } = body;

    if (!agentId || !password || !assetId || !paymentChallenge) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Get agent wallet
    const agent = await getAgentWallet(agentId);
    if (!agent) {
      return NextResponse.json(
        { success: false, message: "Agent not found" },
        { status: 404 }
      );
    }

    // Get agent keypair (unlock with password)
    let agentKeypair;
    try {
      agentKeypair = getAgentKeypair(agent, password);
    } catch (error) {
      console.error("Password decryption failed:", error);
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid password. Please check your password and try again.",
          error: error instanceof Error ? error.message : String(error),
        },
        { status: 401 }
      );
    }
    const agentPublicKey = agentKeypair.publicKey;

    // Setup connection
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
      "confirmed"
    );

    // Parse payment challenge
    const mint = new PublicKey(paymentChallenge.mint);
    const recipient = new PublicKey(paymentChallenge.recipient);
    const amountRequired = BigInt(paymentChallenge.amount);

    // Get token accounts
    const agentAta = await getAssociatedTokenAddress(
      mint,
      agentPublicKey,
      false
    );
    const recipientAta = await getAssociatedTokenAddress(
      mint,
      recipient,
      false
    );

    // Check agent balance
    let agentAccount;
    try {
      agentAccount = await getAccount(connection, agentAta);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Agent does not have a token account. Please fund the agent first.",
        },
        { status: 400 }
      );
    }

    const agentBalance = BigInt(agentAccount.amount.toString());
    if (agentBalance < amountRequired) {
      return NextResponse.json(
        {
          success: false,
          message: `Insufficient balance. Agent has ${
            Number(agentBalance) / 1e6
          } USDC, needs ${Number(amountRequired) / 1e6} USDC`,
        },
        { status: 400 }
      );
    }

    // Build transaction
    const instructions = [];

    // Check if recipient account exists
    try {
      await getAccount(connection, recipientAta);
    } catch {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          agentPublicKey,
          recipientAta,
          recipient,
          mint
        )
      );
    }

    // Add transfer instruction
    instructions.push(
      createTransferInstruction(
        agentAta,
        recipientAta,
        agentPublicKey,
        amountRequired
      )
    );

    // Build and sign transaction
    const { blockhash } = await connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: agentPublicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(messageV0);
    tx.sign([agentKeypair]);

    // Send transaction
    const signature = await connection.sendTransaction(tx, {
      maxRetries: 5,
      skipPreflight: true,
    });

    // Wait for confirmation
    await connection.confirmTransaction(signature, "confirmed");

    // Verify payment and get access token
    const receiptRes = await fetch(`${request.nextUrl.origin}/api/receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature,
        paymentRequestToken,
        imageId: assetId,
        challenge: {
          expiresAt: paymentChallenge.expiresAt,
        },
      }),
    });

    if (!receiptRes.ok) {
      const errorData = await receiptRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          message: `Payment verification failed: ${
            errorData.error || receiptRes.status
          }`,
          signature,
        },
        { status: 400 }
      );
    }

    const { accessToken } = await receiptRes.json();

    // Update agent stats
    agent.totalSpent = (agent.totalSpent || 0) + Number(amountRequired);
    agent.totalPurchases = (agent.totalPurchases || 0) + 1;
    agent.balance = Number(agentBalance) - Number(amountRequired);
    await saveAgentWallet(agent);

    return NextResponse.json({
      success: true,
      signature,
      accessToken,
      assetId,
      message: "Payment successful",
    });
  } catch (error) {
    console.error("Error processing agent payment:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Payment failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
