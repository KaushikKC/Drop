/**
 * Stream402 SDK Types
 * Type definitions for the Stream402 SDK (Ethereum version)
 */

/**
 * Payment challenge returned from discover()
 */
export interface PaymentChallenge {
  version: string;
  network: string;
  currency: string;
  decimals: number;
  amount: string; // Amount in wei (as string)
  tokenAddress: string; // ERC20 token address
  recipient: string; // Ethereum address
  expiresAt: number;
  assetId: string;
  paymentRequestToken: string;
  description?: string;
  metadata?: Record<string, unknown>;
  unlockLayerId?: string;
  unlockLayerIndex?: number;
}

/**
 * 402 Payment Required response
 */
export interface PaymentRequiredResponse {
  error: string;
  code: string;
  challenge: Omit<PaymentChallenge, 'paymentRequestToken'>;
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
  creator?: string;
  tags?: string[];
  description?: string;
  registerOnStory?: boolean;
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
  ipfsCid?: string;
  ipfsUrl?: string;
  storyIPId?: string;
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
  network?: 'sepolia' | 'mainnet' | 'goerli';
}

/**
 * Discover result - either free access or payment required
 */
export type DiscoverResult =
  | { type: 'free'; url: string }
  | { type: 'payment_required'; challenge: PaymentChallenge };

/**
 * Unlock layer information
 */
export interface UnlockLayer {
  layerId: string;
  layerIndex: number;
  layerName: string;
  price: string; // Price in wei
  unlockType: 'preview' | 'hd' | 'full' | 'commercial';
}

/**
 * Negotiation intent
 */
export interface NegotiationIntent {
  assetId: string;
  requestedAmount: string;
  requestedLicenseType: 'personal' | 'commercial' | 'derivative';
  message?: string;
  expiresInHours?: number;
}

/**
 * Negotiation response
 */
export interface NegotiationResponse {
  negotiationId: string;
  status: 'accepted' | 'countered' | 'rejected';
  counterAmount?: string;
  counterLicenseType?: string;
  message?: string;
}

/**
 * Derived work registration
 */
export interface DerivedWorkRegistration {
  parentAssetId: string;
  derivedFile: File | Buffer | string; // File, Buffer, or base64 string
  derivedFileName: string;
  derivationType: 'remix' | 'edit' | 'enhancement' | 'composite';
  title?: string;
  description?: string;
  creatorAddress: string;
  revenueSplitPercentage?: number;
}
