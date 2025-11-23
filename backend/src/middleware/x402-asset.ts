/**
 * x402 middleware wrapper for dynamic asset pricing
 * This integrates x402-express with our database-driven pricing
 * 
 * Note: x402-express middleware works best with static route configurations.
 * For dynamic pricing, we'll handle 402 responses manually and use x402
 * facilitator for payment verification.
 */

import { Request, Response, NextFunction } from 'express';
import { queryOne } from '../db';
import { config } from '../config';

interface AssetRow {
  id: string;
  price_wei: string;
  currency: string;
  recipient_address: string;
}

/**
 * Helper to convert wei to dollar string for x402
 */
export function weiToDollarString(wei: string, decimals: number = 6): string {
  const priceInDollars = BigInt(wei) / BigInt(10 ** decimals);
  const priceFloat = Number(priceInDollars) / (10 ** (6 - decimals));
  return `$${priceFloat.toFixed(6)}`;
}

/**
 * Get asset pricing info for x402
 */
export async function getAssetPricing(assetId: string): Promise<{
  price: string;
  recipient: string;
  network: string;
} | null> {
  const asset = await queryOne<AssetRow>(
    'SELECT * FROM assets WHERE id = $1',
    [assetId]
  );

  if (!asset) {
    return null;
  }

  const price = weiToDollarString(asset.price_wei, 6);
  const network = config.ethereum.network === 'sepolia' ? 'base-sepolia' : 'base';

  return {
    price,
    recipient: asset.recipient_address,
    network,
  };
}

