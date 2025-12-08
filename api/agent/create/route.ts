/**
 * Create Agent Wallet API
 * Creates a new autonomous agent wallet for the user
 */

import { NextRequest, NextResponse } from "next/server";
import { createAgentWallet } from "@/lib/agent-wallet";
import { saveAgentWallet } from "@/lib/agent-wallet-storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, password } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { success: false, message: "User ID is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Create new agent wallet
    const agent = createAgentWallet(userId, password);

    // Save to database
    await saveAgentWallet(agent);

    // Return agent info (without encrypted private key)
    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        agentAddress: agent.agentAddress,
        userId: agent.userId,
        createdAt: agent.createdAt,
        balance: agent.balance,
        totalSpent: agent.totalSpent,
        totalPurchases: agent.totalPurchases,
      },
      message: "Agent wallet created successfully",
    });
  } catch (error) {
    console.error("Error creating agent wallet:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create agent wallet",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
