import { NextRequest, NextResponse } from "next/server";
import {
  getReputation,
  calculateWalletReputation,
  getReputationNFTs,
} from "@/lib/reputation-storage";
import { formatReputationScore } from "@/lib/reputation";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    // Get or calculate reputation
    let reputation = await getReputation(wallet);
    if (!reputation) {
      // Calculate if doesn't exist
      reputation = await calculateWalletReputation(wallet);
    }

    // Get reputation NFTs
    const nfts = await getReputationNFTs(wallet);

    return NextResponse.json({
      wallet: reputation.wallet,
      score: reputation.score,
      level: reputation.level,
      formattedScore: formatReputationScore(reputation.score),
      totalPayments: reputation.totalPayments,
      totalDownloads: reputation.totalDownloads,
      totalEarnings: reputation.totalEarnings,
      lastUpdated: reputation.lastUpdated,
      nfts: nfts.map((nft) => ({
        mint: nft.mint,
        score: nft.score,
        level: nft.level,
        timestamp: nft.timestamp,
        transactionSignature: nft.transactionSignature,
        explorerUrl: nft.transactionSignature
          ? `https://explorer.solana.com/tx/${nft.transactionSignature}?cluster=devnet`
          : null,
        nftUrl: `https://explorer.solana.com/address/${nft.mint}?cluster=devnet`,
      })),
    });
  } catch (error) {
    console.error("Error fetching reputation:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch reputation",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
