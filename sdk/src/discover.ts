/**
 * Discover function - Fetches asset URL and returns 402 challenge if payment required
 * Uses x402 protocol standard
 */

import { DiscoverResult, PaymentRequiredResponse } from './types';

/**
 * Discover an asset by URL
 * Returns either free access URL or payment challenge
 *
 * @param assetUrl - Full URL to the asset (e.g., "https://example.com/api/asset/123")
 * @returns Promise resolving to DiscoverResult
 */
export async function discover(assetUrl: string): Promise<DiscoverResult> {
  try {
    const response = await fetch(assetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    // If 200 OK, asset is free or payment was already made
    if (response.status === 200) {
      const data = await response.json();
      return {
        type: 'free',
        url: data.url || data.ipfsUrl || assetUrl,
      };
    }

    // If 402 Payment Required, x402 middleware returns challenge in body
    if (response.status === 402) {
      const data = (await response.json()) as PaymentRequiredResponse;
      
      // x402 protocol returns challenge in standard format
      // Convert to our internal format
      return {
        type: 'payment_required',
        challenge: {
          version: data.challenge?.version || '1.0',
          network: data.challenge?.network || 'base-sepolia',
          currency: data.challenge?.currency || 'USDC',
          decimals: data.challenge?.decimals || 6,
          amount: data.challenge?.amount || '0',
          tokenAddress: data.challenge?.tokenAddress || '',
          recipient: data.challenge?.recipient || '',
          expiresAt: data.challenge?.expiresAt || Math.floor(Date.now() / 1000) + 300,
          assetId: data.challenge?.assetId || '',
          paymentRequestToken: data.paymentRequestToken || '',
          description: data.description,
          metadata: data.metadata,
          unlockLayerId: data.challenge?.unlockLayerId,
          unlockLayerIndex: data.challenge?.unlockLayerIndex,
        },
      };
    }

    // Other errors
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(
      `Failed to discover asset: ${response.status} ${errorText}`
    );
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Network error: ${String(error)}`);
  }
}
