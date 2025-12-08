import { NextRequest, NextResponse } from "next/server";
import { getAllAssets, readPayments, PaymentRecord } from "@/lib/storage";

export async function GET(req: NextRequest) {
  try {
    const recipient = req.nextUrl.searchParams.get("recipient");

    if (!recipient) {
      return NextResponse.json(
        { error: "recipient parameter is required" },
        { status: 400 }
      );
    }

    const assets = await getAllAssets();
    const payments = await readPayments();

    // Filter assets by recipient
    const providerAssets = assets.filter(
      (asset) => asset.recipient.toLowerCase() === recipient.toLowerCase()
    );

    // Get payment counts and earnings for each asset
    const assetsWithStats = providerAssets.map((asset) => {
      const assetPayments = payments.filter(
        (p: PaymentRecord) => p.assetId === asset.id
      );
      const earnings = assetPayments.reduce(
        (sum: number, p: PaymentRecord) => sum + p.amount,
        0
      );

      return {
        ...asset,
        paymentCount: assetPayments.length,
        earnings,
        earningsFormatted: (earnings / 10 ** asset.decimals).toFixed(
          asset.decimals
        ),
        priceFormatted: (asset.price / 10 ** asset.decimals).toFixed(
          asset.decimals
        ),
      };
    });

    // Sort by creation date (newest first)
    assetsWithStats.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({ assets: assetsWithStats });
  } catch (error) {
    console.error("Error fetching provider assets:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch provider assets",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
