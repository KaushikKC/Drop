import { NextResponse } from "next/server";
import { getAllAssets } from "@/lib/storage";

export async function GET() {
  try {
    const assets = await getAllAssets();
    console.log("Found assets:", assets.length);
    const images = assets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      // Use IPFS URL directly if available, otherwise use thumbnail API route
      // For thumbnails, we prefer IPFS URL if available (full image from IPFS)
      // Otherwise fall back to local thumbnail endpoint
      thumb: asset.ipfsUrl || `/api/thumb/${asset.id}`,
      ipfsUrl: asset.ipfsUrl, // Full resolution IPFS URL (for after payment)
      tags: asset.tags || [],
    }));

    console.log("Returning images:", images);
    return NextResponse.json({ images });
  } catch (error) {
    console.error("Error listing images:", error);
    return NextResponse.json({ images: [] });
  }
}
