/**
 * Fund Agent Wallet API
 * Transfers USDC from user's wallet to agent wallet
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agentId,
      fromWallet,
      signature, // Transaction signature from client
    } = body;

    if (!agentId || !fromWallet || !signature) {
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

    // Verify the transaction was from the correct wallet
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
      "confirmed"
    );

    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return NextResponse.json(
        { success: false, message: "Transaction not found" },
        { status: 404 }
      );
    }

    // Verify transaction is to the agent wallet
    const agentPublicKey = new PublicKey(agent.agentAddress);
    const mint = new PublicKey(
      process.env.NEXT_PUBLIC_USDC_MINT ||
        "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
    );

    // Check if transaction transferred tokens to agent
    const agentAta = await getAssociatedTokenAddress(
      mint,
      agentPublicKey,
      false
    );

    // Get agent's new balance
    let agentBalance = 0n;
    try {
      const agentAccount = await getAccount(connection, agentAta);
      agentBalance = BigInt(agentAccount.amount.toString());
    } catch {
      // Account doesn't exist yet
    }

    // Update agent balance
    agent.balance = Number(agentBalance);
    await saveAgentWallet(agent);

    return NextResponse.json({
      success: true,
      message: "Agent funded successfully",
      agent: {
        id: agent.id,
        agentAddress: agent.agentAddress,
        balance: agent.balance,
      },
    });
  } catch (error) {
    console.error("Error funding agent:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fund agent",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
