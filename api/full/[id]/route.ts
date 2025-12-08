import { NextRequest, NextResponse } from "next/server";
import { getAsset } from "@/lib/storage";
import { verifyJwt } from "@/lib/jwt";
import { readFile } from "fs/promises";
import path from "path";
import { UPLOAD_DIR } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Check authorization
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  // Also check query param for access token
  const accessToken = req.nextUrl.searchParams.get("access") || token;

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const decoded = verifyJwt<{ assetId: string; exp: number }>(accessToken);
  if (!decoded || decoded.assetId !== id) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp < now) {
    return NextResponse.json({ error: "Token expired" }, { status: 401 });
  }

  // Get asset
  const asset = await getAsset(id);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // If IPFS URL is available, redirect to it
  if (asset.ipfsUrl) {
    console.log("Redirecting to IPFS URL:", asset.ipfsUrl);
    return NextResponse.redirect(asset.ipfsUrl, 302);
  }

  // In serverless mode, IPFS URL is required
  if (!asset.filename) {
    return NextResponse.json(
      {
        error: "Asset not available (IPFS upload required in serverless mode)",
      },
      { status: 404 }
    );
  }

  // Fallback to local file
  try {
    const filepath = path.join(UPLOAD_DIR, asset.filename);
    const fileBuffer = await readFile(filepath);

    // Determine content type
    const ext = path.extname(asset.filename).toLowerCase();
    const contentType =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".gif"
        ? "image/gif"
        : ext === ".webp"
        ? "image/webp"
        : ext === ".svg"
        ? "image/svg+xml"
        : "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${asset.filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("File read error:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
