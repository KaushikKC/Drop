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

    // Filter payments for provider assets
    const providerPayments = payments.filter((payment) =>
      providerAssets.some((asset) => asset.id === payment.assetId)
    );

    // Calculate total earnings
    const totalEarnings = providerPayments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    // Calculate earnings by asset
    const earningsByAsset = providerAssets.map((asset) => {
      const assetPayments = providerPayments.filter(
        (p: PaymentRecord) => p.assetId === asset.id
      );
      const assetEarnings = assetPayments.reduce(
        (sum: number, p: PaymentRecord) => sum + p.amount,
        0
      );

      return {
        assetId: asset.id,
        title: asset.title,
        earnings: assetEarnings,
        earningsFormatted: (assetEarnings / 10 ** asset.decimals).toFixed(
          asset.decimals
        ),
        paymentCount: assetPayments.length,
      };
    });

    return NextResponse.json({
      recipient,
      totalEarnings,
      totalEarningsFormatted: (totalEarnings / 10 ** 6).toFixed(6), // Assuming USDC with 6 decimals
      totalPayments: providerPayments.length,
      earningsByAsset: earningsByAsset.sort(
        (a, b) => b.earnings - a.earnings
      ), // Sort by earnings (highest first)
    });
  } catch (error) {
    console.error("Error fetching provider earnings:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch provider earnings",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

