/**
 * payAndFetch function - Complete payment flow using x402-fetch
 */

import { wrapFetchWithPayment, decodeXPaymentResponse } from 'x402-fetch';
import { Account } from 'viem';
import { PaymentResult } from './types';
import { SDKConfig } from './types';

/**
 * Complete payment flow and fetch the resource using x402-fetch
 *
 * @param assetUrl - Full URL to the asset
 * @param account - viem Account (from wallet)
 * @param config - SDK configuration
 * @returns Promise resolving to PaymentResult with access token and download URL
 */
export async function payAndFetch(
  assetUrl: string,
  account: Account,
  config?: SDKConfig
): Promise<PaymentResult> {
  // Create wrapped fetch with x402 payment handling
  const fetchWithPayment = wrapFetchWithPayment(fetch, account);

  try {
    const response = await fetchWithPayment(assetUrl, {
      method: 'GET',
    });

    if (!response.ok && response.status !== 200) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Extract payment response from headers if present
    const paymentResponseHeader = response.headers.get('x-payment-response');
    let paymentResponse = null;
    if (paymentResponseHeader) {
      paymentResponse = decodeXPaymentResponse(paymentResponseHeader);
    }

    // Parse JWT to get expiration if available
    let expiresAt = Date.now() + 60 * 60 * 1000; // Default 1 hour
    const authHeader = response.headers.get('authorization');
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const [, payload] = token.split('.');
        if (payload) {
          const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
          const decoded = JSON.parse(json) as { exp?: number };
          if (decoded.exp) {
            expiresAt = decoded.exp * 1000;
          }
        }
      } catch {
        // Use default expiration
      }
    }

    // Construct download URL
    const downloadUrl = data.url || data.ipfsUrl || assetUrl;

    return {
      accessToken: paymentResponse?.token || '',
      downloadUrl,
      expiresAt,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Payment and fetch failed: ${String(error)}`);
  }
}

/**
 * Pay for a specific unlock layer using x402-fetch
 */
export async function payForUnlockLayer(
  layerUrl: string,
  account: Account,
  config?: SDKConfig
): Promise<PaymentResult> {
  return payAndFetch(layerUrl, account, config);
}
