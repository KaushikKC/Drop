import { NextRequest, NextResponse } from "next/server";
import { getAllAssets, readPayments, PaymentRecord } from "@/lib/storage";

export interface ProviderStats {
  totalEarnings: number; // Total earnings in smallest unit
  totalEarningsFormatted: string; // Formatted earnings (e.g., "0.05 USDC")
  totalAssets: number;
  totalPayments: number;
  totalDownloads: number;
  assets: Array<{
    id: string;
    title: string;
    price: number;
    priceFormatted: string;
    payments: number;
    earnings: number;
    earningsFormatted: string;
    downloads: number;
    createdAt: number;
  }>;
  payments: Array<{
    assetId: string;
    assetTitle: string;
    signature: string;
    payer: string;
    amount: number;
    amountFormatted: string;
    timestamp: number;
  }>;
}

/**
 * Format amount from smallest unit to human-readable format
 */
function formatAmount(amount: number, decimals: number): string {
  const divisor = 10 ** decimals;
  const formatted = (amount / divisor).toFixed(decimals);
  return formatted.replace(/\.?0+$/, ""); // Remove trailing zeros
}

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
    const providerPayments = payments.filter((payment: PaymentRecord) =>
      providerAssets.some((asset) => asset.id === payment.assetId)
    );

    // Calculate stats
    let totalEarnings = 0;
    const assetStats = providerAssets.map((asset) => {
      const assetPayments = providerPayments.filter(
        (p: PaymentRecord) => p.assetId === asset.id
      );
      const assetEarnings = assetPayments.reduce(
        (sum: number, p: PaymentRecord) => sum + p.amount,
        0
      );
      totalEarnings += assetEarnings;

      return {
        id: asset.id,
        title: asset.title,
        price: asset.price,
        priceFormatted: formatAmount(asset.price, asset.decimals),
        payments: assetPayments.length,
        earnings: assetEarnings,
        earningsFormatted: formatAmount(assetEarnings, asset.decimals),
        downloads: assetPayments.length, // Each payment = 1 download
        createdAt: asset.createdAt,
      };
    });

    // Format payment details
    const paymentDetails = providerPayments.map((payment) => {
      const asset = providerAssets.find((a) => a.id === payment.assetId);
      return {
        assetId: payment.assetId,
        assetTitle: asset?.title || "Unknown",
        signature: payment.signature,
        payer: payment.payer,
        amount: payment.amount,
        amountFormatted: formatAmount(
          payment.amount,
          asset?.decimals || 6
        ),
        timestamp: payment.timestamp,
      };
    });

    // Sort payments by timestamp (newest first)
    paymentDetails.sort((a, b) => b.timestamp - a.timestamp);

    const stats: ProviderStats = {
      totalEarnings,
      totalEarningsFormatted: formatAmount(totalEarnings, 6), // Assuming USDC with 6 decimals
      totalAssets: providerAssets.length,
      totalPayments: providerPayments.length,
      totalDownloads: providerPayments.length,
      assets: assetStats.sort((a, b) => b.createdAt - a.createdAt), // Newest first
      payments: paymentDetails,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching provider stats:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch provider stats",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

