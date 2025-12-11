/**
 * payAndFetch function - Complete payment flow and returns resource
 */
import { Connection } from "@solana/web3.js";
import { WalletAdapter } from "@solana/wallet-adapter-base";
import { PaymentResult } from "./types";
/**
 * Complete payment flow and fetch the resource
 *
 * @param assetUrl - Full URL to the asset
 * @param walletAdapter - Solana wallet adapter (from @solana/wallet-adapter-react)
 * @param connection - Solana connection (optional, will use default if not provided)
 * @returns Promise resolving to PaymentResult with access token and download URL
 */
export declare function payAndFetch(assetUrl: string, walletAdapter: WalletAdapter, connection?: Connection): Promise<PaymentResult>;
