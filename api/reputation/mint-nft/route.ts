import { NextRequest, NextResponse } from "next/server";
import { mintReputationNFT, getServiceKeypair } from "@/lib/nft-mint";
import { ReputationMetadata } from "@/lib/reputation";
import { saveReputationNFT as saveReputationNFTRecord } from "@/lib/reputation-storage";

export async function POST(req: NextRequest) {
  try {
    const { wallet, metadata } = (await req.json()) as {
      wallet: string;
      metadata: ReputationMetadata;
    };

    if (!wallet || !metadata) {
      return NextResponse.json(
        { error: "Wallet and metadata are required" },
        { status: 400 }
      );
    }

    // Get service keypair for minting
    const serviceKeypair = getServiceKeypair();

    if (!serviceKeypair) {
      return NextResponse.json(
        {
          error: "Service wallet not configured",
          message:
            "SERVICE_WALLET_PRIVATE_KEY environment variable is required for NFT minting",
        },
        { status: 500 }
      );
    }

    // Mint the NFT
    const nftResult = await mintReputationNFT(wallet, metadata, serviceKeypair);

    if (!nftResult) {
      return NextResponse.json(
        { error: "Failed to mint NFT" },
        { status: 500 }
      );
    }

    // Save NFT record
    saveReputationNFTRecord({
      wallet,
      mint: nftResult.mint,
      score: metadata.attributes[1].value as number,
      level: metadata.attributes[0].value as string,
      metadata,
      timestamp: Date.now(),
      transactionSignature: nftResult.signature,
    });

    return NextResponse.json({
      success: true,
      mint: nftResult.mint,
      signature: nftResult.signature,
      explorerUrl: `https://explorer.solana.com/tx/${nftResult.signature}?cluster=devnet`,
      nftUrl: `https://explorer.solana.com/address/${nftResult.mint}?cluster=devnet`,
    });
  } catch (error) {
    console.error("Error minting reputation NFT:", error);
    return NextResponse.json(
      {
        error: "Failed to mint NFT",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
