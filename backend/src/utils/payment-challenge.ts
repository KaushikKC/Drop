import { v4 as uuidv4 } from 'uuid';

export interface PaymentChallenge {
  version: string;
  network: string;
  currency: string;
  decimals: number;
  amount: string; // Amount in wei (as string to avoid precision issues)
  tokenAddress: string; // ERC20 token address
  recipient: string; // Ethereum address
  expiresAt: number; // Unix timestamp
  assetId: string;
  paymentRequestToken: string;
  description?: string;
  metadata?: Record<string, unknown>;
  unlockLayerId?: string; // For multi-layer unlocks
  unlockLayerIndex?: number;
}

export interface X402Response {
  error: string;
  code: string;
  challenge: Omit<PaymentChallenge, 'paymentRequestToken'>;
  paymentRequestToken: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export function createPaymentChallenge(
  assetId: string,
  amountWei: bigint,
  decimals: number,
  currency: string,
  tokenAddress: string,
  recipient: string,
  network: string,
  expiresInSeconds: number = 300,
  unlockLayerId?: string,
  unlockLayerIndex?: number
): PaymentChallenge {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const paymentRequestToken = uuidv4();

  return {
    version: '1.0',
    network,
    currency,
    decimals,
    amount: amountWei.toString(),
    tokenAddress,
    recipient,
    expiresAt,
    assetId,
    paymentRequestToken,
    unlockLayerId,
    unlockLayerIndex,
  };
}

export function format402Response(
  challenge: PaymentChallenge,
  description?: string,
  metadata?: Record<string, unknown>
): X402Response {
  const { paymentRequestToken, ...challengeWithoutToken } = challenge;

  return {
    error: 'Payment Required',
    code: '402',
    challenge: challengeWithoutToken,
    paymentRequestToken,
    description,
    metadata,
  };
}

