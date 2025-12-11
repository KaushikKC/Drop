/**
 * Stream402 SDK Types
 * Type definitions for the Stream402 SDK
 */
import { Connection } from "@solana/web3.js";
/**
 * Payment challenge returned from discover()
 */
export interface PaymentChallenge {
    version: string;
    network: string;
    currency: string;
    decimals: number;
    amount: number;
    mint: string;
    recipient: string;
    expiresAt: number;
    assetId: string;
    paymentRequestToken: string;
    description?: string;
    metadata?: Record<string, unknown>;
}
/**
 * 402 Payment Required response
 */
export interface PaymentRequiredResponse {
    error: string;
    code: string;
    challenge: Omit<PaymentChallenge, "paymentRequestToken">;
    paymentRequestToken: string;
    description?: string;
    metadata?: Record<string, unknown>;
}
/**
 * Asset metadata for upload
 */
export interface AssetMetadata {
    title: string;
    price: number | string;
    recipient?: string;
    tags?: string[];
    description?: string;
}
/**
 * Upload response
 */
export interface UploadResponse {
    assetId: string;
    title: string;
    price: number;
    url: string;
    thumbnailUrl?: string;
}
/**
 * Payment result
 */
export interface PaymentResult {
    accessToken: string;
    downloadUrl: string;
    expiresAt: number;
}
/**
 * SDK configuration
 */
export interface SDKConfig {
    baseUrl?: string;
    connection?: Connection;
    network?: "devnet" | "mainnet-beta";
}
/**
 * Discover result - either free access or payment required
 */
export type DiscoverResult = {
    type: "free";
    url: string;
} | {
    type: "payment_required";
    challenge: PaymentChallenge;
};
