import { NextRequest, NextResponse } from "next/server";
import { getAsset } from "@/lib/storage";
import { verifyJwt } from "@/lib/jwt";
import { solanaConfig } from "@/lib/solana-config";
import { v4 as uuidv4 } from "uuid";
import {
  createPaymentChallenge,
  format402Response,
} from "@/lib/payment-challenge";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Check for authorization token
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (token) {
    const decoded = verifyJwt<{ assetId: string; exp: number }>(token);
    if (decoded && decoded.assetId === id) {
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp >= now) {
        // Authorized - return download URL
        const url = `/api/full/${id}`;
        return NextResponse.json({ url });
      }
    }
  }

  // Not authorized - return 402 payment challenge
  const asset = await getAsset(id);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const paymentRequestToken = uuidv4(); // In production, this should be a signed token

  // Create standardized payment challenge
  const challenge = createPaymentChallenge(
    id,
    asset.price,
    asset.decimals,
    asset.currency,
    asset.mint,
    asset.recipient,
    `solana:${solanaConfig.network}`,
    paymentRequestToken,
    300 // 5 minutes expiration
  );

  // Format response according to X402 standard
  const response = format402Response({
    ...challenge,
    description: `Payment required to access ${asset.title}`,
    metadata: {
      title: asset.title,
      createdAt: asset.createdAt,
    },
  });

  return new NextResponse(JSON.stringify(response), {
    status: 402,
    headers: { "Content-Type": "application/json" },
  });
}
