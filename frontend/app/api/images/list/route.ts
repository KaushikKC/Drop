import { NextResponse } from "next/server";

// Proxy to backend API  
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function GET() {
  try {
    // Proxy to backend API
    const response = await fetch(`${BACKEND_URL}/api/asset/list`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Backend API error:', response.status);
      return NextResponse.json({ images: [] }, { status: response.status });
    }

    const data = await response.json();
    const assets = data.assets || [];

    // Transform to match expected format
    const images = assets.map((asset: any) => ({
      id: asset.id,
      title: asset.title,
      description: asset.description,
      thumb: asset.thumbnailUrl || asset.thumbnail_ipfs_url || '',
      ipfsUrl: asset.ipfsUrl || asset.ipfs_url || '',
      thumbnailUrl: asset.thumbnailUrl || asset.thumbnail_ipfs_url || '',
      price: asset.price,
      currency: asset.currency,
      creator: asset.creator,
      tags: asset.tags || [],
      createdAt: asset.createdAt || asset.created_at,
    }));

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Error listing images:", error);
    return NextResponse.json({ images: [] }, { status: 500 });
  }
}

