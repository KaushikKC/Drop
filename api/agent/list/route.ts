/**
 * List Agent Wallets API
 * Returns all agent wallets for a user
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserAgentWallets } from "@/lib/agent-wallet-storage";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User ID is required" },
        { status: 400 }
      );
    }

    const agents = await getUserAgentWallets(userId);

    // Return agent info without encrypted private keys
    const safeAgents = agents.map((agent) => ({
      id: agent.id,
      agentAddress: agent.agentAddress,
      userId: agent.userId,
      createdAt: agent.createdAt,
      balance: agent.balance || 0,
      totalSpent: agent.totalSpent || 0,
      totalPurchases: agent.totalPurchases || 0,
    }));

    return NextResponse.json({
      success: true,
      agents: safeAgents,
    });
  } catch (error) {
    console.error("Error listing agent wallets:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to list agent wallets",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
