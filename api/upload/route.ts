import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { saveAsset, UPLOAD_DIR, THUMB_DIR, AssetMetadata } from "@/lib/storage";
// Base network configuration
const baseConfig = {
  recipient: process.env.NEXT_PUBLIC_BASE_RECIPIENT || process.env.NEXT_PUBLIC_ETHEREUM_RECIPIENT || "",
  mint: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || "",
  network: process.env.NEXT_PUBLIC_BASE_NETWORK || "base-sepolia",
};
import { uploadToIPFS } from "@/lib/ipfs";
import { generateThumbnail } from "@/lib/thumbnail";

// Check if we're in a serverless environment (Vercel, AWS Lambda, etc.)
const isServerless =
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NEXT_RUNTIME === "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const title = (formData.get("title") as string) || "Untitled";
    const price = (formData.get("price") as string) || "0.01";
    const recipient =
      (formData.get("recipient") as string) || baseConfig.recipient;
    const tagsInput = (formData.get("tags") as string) || "";
    // Parse tags from comma-separated string
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient wallet address required" },
        { status: 400 }
      );
    }

    const assetId = uuidv4();
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `${assetId}_${file.name}`;

    // In serverless environments, skip local file writes and use IPFS only
    if (!isServerless) {
      // Save original file locally (for fallback in non-serverless)
      try {
        const filepath = path.join(UPLOAD_DIR, filename);
        await writeFile(filepath, buffer);
      } catch (localError) {
        console.warn(
          "Local file write failed (serverless?), continuing with IPFS:",
          localError
        );
      }
    }

    // Generate low-resolution thumbnail (in memory)
    let thumbBuffer: Buffer | null = null;
    let thumbFilename: string | undefined;
    let thumbIpfsCid: string | undefined;
    let thumbIpfsUrl: string | undefined;

    try {
      if (!isServerless) {
        // In non-serverless, generate thumbnail to disk
        thumbFilename = await generateThumbnail(buffer, filename, 400, 400, 70);
        console.log("Generated thumbnail:", thumbFilename);
      } else {
        // In serverless, generate thumbnail in memory
        const { generateThumbnailBuffer } = await import("@/lib/thumbnail");
        thumbBuffer = await generateThumbnailBuffer(
          buffer,
          file.type,
          400,
          400,
          70
        );
        console.log("Generated thumbnail buffer (serverless mode)");
      }
    } catch (thumbError) {
      console.error("Thumbnail generation failed:", thumbError);
      // Continue without thumbnail
    }

    // Upload original to IPFS
    let ipfsCid: string | undefined;
    let ipfsUrl: string | undefined;

    try {
      const fileForIPFS = new File([buffer], file.name, { type: file.type });
      const ipfsResult = await uploadToIPFS(fileForIPFS, filename);
      ipfsCid = ipfsResult.cid;
      ipfsUrl = ipfsResult.url;
      console.log("Uploaded to IPFS:", { cid: ipfsCid, url: ipfsUrl });
    } catch (ipfsError) {
      console.error("IPFS upload failed:", ipfsError);
      if (isServerless) {
        // In serverless, IPFS is required
        throw new Error(
          "IPFS upload failed. This is required in serverless environments."
        );
      }
      // In non-serverless, continue with local storage if IPFS fails
    }

    // Upload thumbnail to IPFS if generated
    if (thumbBuffer) {
      try {
        // Convert Buffer to Uint8Array for File constructor
        const thumbArray = new Uint8Array(thumbBuffer);
        const thumbFile = new File([thumbArray], `thumb_${filename}`, {
          type: "image/jpeg",
        });
        const thumbIpfsResult = await uploadToIPFS(
          thumbFile,
          `thumb_${filename}`
        );
        thumbIpfsCid = thumbIpfsResult.cid;
        thumbIpfsUrl = thumbIpfsResult.url;
        console.log("Uploaded thumbnail to IPFS:", {
          cid: thumbIpfsCid,
          url: thumbIpfsUrl,
        });
      } catch (thumbIpfsError) {
        console.error("Thumbnail IPFS upload failed:", thumbIpfsError);
        // Continue without thumbnail IPFS URL
      }
    }

    const priceNumber = parseFloat(price);
    const priceInSmallestUnit = BigInt(Math.floor(priceNumber * 1_000_000)); // 6 decimals for USDC

    const metadata: AssetMetadata = {
      id: assetId,
      title,
      price: Number(priceInSmallestUnit),
      decimals: 6,
      currency: "USDC",
      mint: baseConfig.mint,
      recipient,
      filename: isServerless ? undefined : filename, // Don't store filename in serverless
      thumbFilename: isServerless ? undefined : thumbFilename, // Don't store thumbFilename in serverless
      ipfsCid,
      ipfsUrl,
      tags: tags.length > 0 ? tags : undefined,
      createdAt: Date.now(),
    };

    await saveAsset(metadata);

    return NextResponse.json({
      assetId,
      url: `/api/asset/${assetId}`,
      title,
      price: priceNumber,
      ipfsCid,
      ipfsUrl,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
