/**
 * uploadAsset function - Provider helper for uploading assets
 */
import { WalletAdapter } from "@solana/wallet-adapter-base";
import { AssetMetadata, UploadResponse } from "./types";
/**
 * Upload an asset to Stream402
 *
 * @param file - File to upload
 * @param meta - Asset metadata (title, price, recipient, tags, description)
 * @param walletAdapter - Solana wallet adapter (optional, for recipient address)
 * @param baseUrl - Base URL of the Stream402 API (defaults to current origin)
 * @returns Promise resolving to UploadResponse with asset ID and URLs
 */
export declare function uploadAsset(file: File, meta: AssetMetadata, walletAdapter?: WalletAdapter, baseUrl?: string): Promise<UploadResponse>;
