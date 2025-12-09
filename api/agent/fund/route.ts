/**
 * Fund Agent Wallet API
 * Transfers USDC from user's wallet to agent wallet
 */

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getAgentWallet, saveAgentWallet } from "@/lib/agent-wallet-storage";

// ERC20 ABI (minimal - just what we need)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

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
    const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || "https://sepolia.base.org";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const receipt = await provider.getTransactionReceipt(signature);

    if (!receipt) {
      return NextResponse.json(
        { success: false, message: "Transaction not found" },
        { status: 404 }
      );
    }

    // Verify transaction is to the agent wallet
    const agentAddress = agent.agentAddress;
    const tokenAddress = process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || "";

    if (!tokenAddress) {
      return NextResponse.json(
        { success: false, message: "Token address not configured" },
        { status: 500 }
      );
    }

    // Create token contract instance
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    // Get agent's new balance
    let agentBalance = 0n;
    try {
      agentBalance = await tokenContract.balanceOf(agentAddress);
    } catch {
      // Account doesn't exist yet or has no balance
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
