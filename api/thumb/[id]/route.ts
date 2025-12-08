import { NextRequest, NextResponse } from "next/server";
import { getAsset } from "@/lib/storage";
import { readFile, access } from "fs/promises";
import { constants } from "fs";
import path from "path";
import { UPLOAD_DIR, THUMB_DIR } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const asset = await getAsset(id);
  if (!asset) {
    console.error("Asset not found for id:", id);
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // If IPFS URL is available, use it for the thumbnail
  // Note: For true low-res thumbnails, we'd need to upload thumbnails to IPFS separately
  // For now, we'll use the IPFS URL if available, otherwise fall back to local files
  if (asset.ipfsUrl) {
    console.log("Using IPFS URL for thumbnail:", asset.ipfsUrl);
    // Redirect to IPFS URL - this will serve the full image from IPFS
    // In production, you might want to create and upload thumbnails to IPFS separately
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

  // Fallback to local file - serve thumbnail (low-res) if available, otherwise original
  try {
    // Try to use thumbnail first (low-resolution)
    let filepath: string;
    let isThumbnail = false;

    if (asset.thumbFilename && asset.thumbFilename !== asset.filename) {
      // Try thumbnail first
      const thumbPath = path.resolve(THUMB_DIR, asset.thumbFilename);
      try {
        await access(thumbPath, constants.F_OK);
        filepath = thumbPath;
        isThumbnail = true;
        console.log("Using local thumbnail:", asset.thumbFilename);
      } catch {
        // Thumbnail doesn't exist, fall back to original
        filepath = path.resolve(UPLOAD_DIR, asset.filename);
        console.log("Thumbnail not found, using original:", asset.filename);
      }
    } else {
      // No separate thumbnail, use original
      filepath = path.resolve(UPLOAD_DIR, asset.filename);
    }

    console.log("Attempting to read thumbnail from local storage:", {
      id,
      filename: asset.filename,
      thumbFilename: asset.thumbFilename,
      filepath,
      isThumbnail,
      uploadDir: UPLOAD_DIR,
      thumbDir: THUMB_DIR,
      cwd: process.cwd(),
    });

    // Check if file exists
    try {
      await access(filepath, constants.F_OK);
    } catch (accessError) {
      console.error("File does not exist at:", filepath);
      console.error("Upload dir:", UPLOAD_DIR);
      console.error("Thumb dir:", THUMB_DIR);
      console.error("Process cwd:", process.cwd());
      console.error("Access error:", accessError);
      return NextResponse.json(
        { error: "File not found", filepath, uploadDir: UPLOAD_DIR },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(filepath);

    // Determine content type
    // If it's a thumbnail (converted to JPEG), use image/jpeg
    // Otherwise use the original file extension
    const ext = path.extname(asset.filename).toLowerCase();
    let contentType: string;

    if (isThumbnail) {
      // Thumbnails are converted to JPEG, so always use image/jpeg
      contentType = "image/jpeg";
    } else {
      // Use original file type
      contentType =
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
    }

    // Return image with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Thumbnail read error:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
