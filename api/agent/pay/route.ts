/**
 * Autonomous Agent Payment API
 * Makes payment using agent's private key (server-side, no popups)
 */

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getAgentWallet, saveAgentWallet } from "@/lib/agent-wallet-storage";
import { getAgentKeypair } from "@/lib/agent-wallet";

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
    const agentPublicKey = agentKeypair.address || agentKeypair.publicKey;

    // Setup provider
    const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || "https://sepolia.base.org";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(agentKeypair.privateKey, provider);

    // Parse payment challenge
    const tokenAddress = paymentChallenge.mint || process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || "";
    const recipient = paymentChallenge.recipient;
    const amountRequired = BigInt(paymentChallenge.amount);

    if (!tokenAddress) {
      return NextResponse.json(
        {
          success: false,
          message: "Token address not configured",
        },
        { status: 500 }
      );
    }

    // Create token contract instance
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

    // Check agent balance
    let agentBalance: bigint;
    try {
      agentBalance = await tokenContract.balanceOf(agentPublicKey);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Failed to check agent balance. Please fund the agent first.",
          error: error instanceof Error ? error.message : String(error),
        },
        { status: 400 }
      );
    }

    if (agentBalance < amountRequired) {
      const decimals = await tokenContract.decimals();
      return NextResponse.json(
        {
          success: false,
          message: `Insufficient balance. Agent has ${
            Number(agentBalance) / (10 ** decimals)
          } USDC, needs ${Number(amountRequired) / (10 ** decimals)} USDC`,
        },
        { status: 400 }
      );
    }

    // Build and send transaction
    const tx = await tokenContract.transfer(recipient, amountRequired);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    const signature = receipt.hash;

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
