/**
 * Discover function - Fetches asset URL and returns 402 challenge if payment required
 */
import { DiscoverResult } from "./types";
/**
 * Discover an asset by URL
 * Returns either free access URL or payment challenge
 *
 * @param assetUrl - Full URL to the asset (e.g., "https://example.com/api/asset/123")
 * @returns Promise resolving to DiscoverResult
 */
export declare function discover(assetUrl: string): Promise<DiscoverResult>;
