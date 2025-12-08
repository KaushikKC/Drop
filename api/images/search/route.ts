import { NextRequest, NextResponse } from "next/server";
import { getAllAssets } from "@/lib/storage";

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("q") || "";
    const searchTerm = query.toLowerCase().trim();

    if (!searchTerm) {
      return NextResponse.json({ images: [] });
    }

    const assets = await getAllAssets();

    // Search by title or tags
    const matchingAssets = assets.filter((asset) => {
      // Search in title
      const titleMatch = asset.title.toLowerCase().includes(searchTerm);

      // Search in tags
      const tagsMatch =
        asset.tags &&
        asset.tags.some((tag) => tag.toLowerCase().includes(searchTerm));

      return titleMatch || tagsMatch;
    });

    const images = matchingAssets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      // Use IPFS URL directly if available, otherwise use thumbnail API route
      // For thumbnails, we prefer IPFS URL if available (full image from IPFS)
      // Otherwise fall back to local thumbnail endpoint
      thumb: asset.ipfsUrl || `/api/thumb/${asset.id}`,
      ipfsUrl: asset.ipfsUrl, // Full resolution IPFS URL (for after payment)
      tags: asset.tags || [],
    }));

    return NextResponse.json({ images, query: searchTerm });
  } catch (error) {
    console.error("Error searching images:", error);
    return NextResponse.json(
      {
        error: "Failed to search images",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

