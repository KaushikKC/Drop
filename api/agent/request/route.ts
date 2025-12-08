/**
 * Agent API endpoint for natural language asset requests
 * Handles automatic discovery, payment, and asset retrieval
 */

import { NextRequest, NextResponse } from "next/server";
import { findBestMatch, searchAssetsByQuery } from "@/lib/agent";
import { getAllAssets } from "@/lib/storage";
import { createPaymentChallenge } from "@/lib/payment-challenge";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, walletAddress } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { success: false, message: "Query is required" },
        { status: 400 }
      );
    }

    // Find matching assets
    const matches = await searchAssetsByQuery(query);

    if (!matches || matches.length === 0) {
      return NextResponse.json({
        success: false,
        message: `No assets found matching "${query}"`,
        suggestions: [
          "Try searching for: Solana, Bitcoin, Ethereum, logo, image",
        ],
      });
    }

    // Get the best match
    const bestMatch = matches[0];
    const assets = await getAllAssets();
    const asset = assets.find((a) => a.id === bestMatch.id);

    if (!asset) {
      return NextResponse.json(
        { success: false, message: "Asset not found" },
        { status: 404 }
      );
    }

    // If asset is free, return it directly
    if (asset.price === 0 || !asset.price) {
      return NextResponse.json({
        success: true,
        message: `Found free asset: ${asset.title}`,
        assetId: asset.id,
        assetUrl: `/api/asset/${asset.id}`,
        downloadUrl: `/api/asset/${asset.id}`,
        price: 0,
        requiresPayment: false,
      });
    }

    // Asset requires payment - return payment challenge
    const paymentRequestToken = uuidv4();
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "solana:devnet";
    const challenge = createPaymentChallenge(
      asset.id,
      asset.price,
      asset.decimals || 6,
      asset.currency || "USDC",
      asset.mint || process.env.NEXT_PUBLIC_USDC_MINT || "",
      asset.recipient,
      network,
      paymentRequestToken,
      300 // 5 minutes expiration
    );

    return NextResponse.json({
      success: true,
      message: `Found asset: ${asset.title}. Payment required: ${asset.price} USDC`,
      assetId: asset.id,
      assetUrl: `/api/asset/${asset.id}`,
      price: asset.price,
      requiresPayment: true,
      paymentChallenge: challenge,
      // Also return other matches for user to choose
      alternatives: matches.slice(1, 4).map((m) => ({
        id: m.id,
        title: m.title,
        price: m.price,
        matchScore: m.matchScore,
      })),
    });
  } catch (error) {
    console.error("Agent request error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to search assets without payment
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        { success: false, message: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    const matches = await searchAssetsByQuery(query);

    return NextResponse.json({
      success: true,
      query,
      results: matches.map((m) => ({
        id: m.id,
        title: m.title,
        tags: m.tags,
        price: m.price,
        matchScore: m.matchScore,
      })),
    });
  } catch (error) {
    console.error("Agent search error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
