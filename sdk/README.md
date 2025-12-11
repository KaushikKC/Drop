# Stream402 SDK

TypeScript SDK for integrating Stream402 payment protocol into your applications.

## Installation

```bash
npm install stream402-sdk x402-fetch viem
```

Note: This SDK uses the official x402 protocol for payments. You'll need `x402-fetch` and `viem` for wallet integration.

## Quick Start

### Upload an Asset

```typescript
import { uploadAsset } from 'stream402-sdk';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0xYourPrivateKey');

const file = new File([buffer], 'image.jpg', { type: 'image/jpeg' });

const result = await uploadAsset(file, {
  title: 'My Digital Art',
  price: 0.01,
  recipient: account.address,
  tags: ['art', 'digital'],
  description: 'A beautiful piece of digital art',
  registerOnStory: true, // Register on Story Protocol
}, undefined, { // No signer needed for upload
  baseUrl: 'https://api.example.com',
});

console.log('Asset ID:', result.assetId);
console.log('Story IP ID:', result.storyIPId);
```

### Pay and Fetch

```typescript
import { payAndFetch } from 'stream402-sdk';
import { privateKeyToAccount } from 'viem/accounts';

// Create account from private key
const account = privateKeyToAccount('0xYourPrivateKey');

// Pay and fetch using x402 protocol
const result = await payAndFetch(
  'https://api.example.com/api/asset/asset-id',
  account,
  { baseUrl: 'https://api.example.com' }
);

console.log('Download URL:', result.downloadUrl);
```

### Unlock Layers (Preview-by-Micropayment)

```typescript
import { payForUnlockLayer } from 'stream402-sdk';

// Pay for HD preview (0.01 USDC)
const hdResult = await payForUnlockLayer(
  'https://api.example.com/api/unlock/layer-id',
  signer
);

console.log('HD Preview URL:', hdResult.downloadUrl);
```

### Negotiate Price

```typescript
import { createNegotiation } from 'stream402-sdk';

const negotiation = await createNegotiation({
  assetId: 'asset-id',
  requestedAmount: '0.5',
  requestedLicenseType: 'commercial',
  message: 'Bulk license for 20 images',
  expiresInHours: 24,
}, agentPrivateKey, {
  baseUrl: 'https://api.example.com',
});

console.log('Negotiation ID:', negotiation.negotiationId);
```

### Register Derivative Work

```typescript
import { registerDerivative } from 'stream402-sdk';

const result = await registerDerivative({
  parentAssetId: 'parent-id',
  derivedFile: fileBuffer, // File, Buffer, or base64 string
  derivedFileName: 'remix.jpg',
  derivationType: 'remix',
  title: 'My Remix',
  creatorAddress: await signer.getAddress(),
  revenueSplitPercentage: 10, // 10% to parent creator
}, {
  baseUrl: 'https://api.example.com',
});

console.log('Derivative Asset ID:', result.derivedAssetId);
console.log('Story Derivative IP ID:', result.storyDerivativeIPId);
```

## API Reference

### `discover(assetUrl: string): Promise<DiscoverResult>`

Discover an asset and get payment challenge if required.

### `payAndFetch(assetUrl: string, signer: Signer, config?: SDKConfig): Promise<PaymentResult>`

Complete payment flow and fetch the resource.

### `payForUnlockLayer(layerUrl: string, signer: Signer, config?: SDKConfig): Promise<PaymentResult>`

Pay for a specific unlock layer.

### `uploadAsset(file: File | Blob, meta: AssetMetadata, signer?: Signer, config?: SDKConfig): Promise<UploadResponse>`

Upload an asset to Stream402.

### `createNegotiation(intent: NegotiationIntent, agentPrivateKey: string, config?: SDKConfig): Promise<{ negotiationId: string }>`

Create a negotiation intent.

### `respondToNegotiation(negotiationId: string, response: NegotiationResponse, creatorPrivateKey: string, config?: SDKConfig): Promise<void>`

Respond to a negotiation.

### `registerDerivative(registration: DerivedWorkRegistration, config?: SDKConfig): Promise<DerivativeResult>`

Register a derived work with automatic Story Protocol linking.

## Types

See `src/types/index.ts` for full type definitions.

## Examples

See `examples/` directory for more examples.

## License

MIT
