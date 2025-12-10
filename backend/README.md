# drop Backend

Ethereum-based X402 payment protocol backend with Story Protocol integration, featuring unique agent-to-agent micro-economy capabilities.

## Features

### Core Features
- ✅ **x402 Payment Protocol** - Official x402 protocol integration (Base network)
- ✅ **Story Protocol Integration** - Automatic IP registration and license minting
- ✅ **IPFS Storage** - Decentralized file storage via Web3.Storage
- ✅ **Multi-layer Unlocks** - Preview-by-micropayment system

### Unique Features
- ⭐ **Preview-by-Micropayment** - Progressive unlock layers (blurred → HD → full → commercial)
- ⭐ **Agent Negotiable Pricing** - Agents can negotiate bulk licenses via XMTP
- ⭐ **Auto-Derived Works Registration** - Automatic Story Protocol registration for remixes
- ⭐ **Agent-to-Agent Micro-Economy** - XMTP-powered agent communication and transactions
- ⭐ **Perceptual Hash Duplicate Detection** - Prevents duplicate uploads
- ⭐ **Auto-tagging** - Automatic image tagging (extensible for CLIP integration)

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or SQLite for development)
- Ethereum RPC endpoint (Infura, Alchemy, etc.)
- Web3.Storage account and token
- Story Protocol contract addresses

### Installation

1. Install dependencies:
```bash
cd backend
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Configure `.env`:
```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/drop

# Ethereum / Base Network (for x402)
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
ETHEREUM_NETWORK=sepolia  # or 'base' for mainnet
USDC_TOKEN_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238  # Base Sepolia USDC
PRIVATE_KEY=your_private_key_here

# x402 Facilitator (optional - uses testnet facilitator by default)
# For mainnet, install @coinbase/x402 and use facilitator from that package

# IPFS
WEB3_STORAGE_TOKEN=your_web3_storage_token

# Story Protocol
STORY_PROTOCOL_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
STORY_PROTOCOL_MODULE_ADDRESS=0x...
STORY_PROTOCOL_REGISTRY_ADDRESS=0x...
STORY_PROTOCOL_LICENSE_REGISTRY_ADDRESS=0x...

# XMTP
XMTP_ENV=dev

# JWT
JWT_SECRET=your_jwt_secret_here
```

4. Initialize database:
```bash
npm run migrate
```

5. Start development server:
```bash
npm run dev
```

## API Endpoints

### Asset Management

#### `POST /api/upload`
Upload an asset with automatic IPFS storage and Story Protocol registration.

**Request:**
- `file` (multipart/form-data): File to upload
- `title` (string): Asset title
- `price` (number): Price in USDC
- `recipient` (string): Ethereum address to receive payments
- `creator` (string, optional): Creator address (defaults to recipient)
- `tags` (string, comma-separated): Tags
- `description` (string, optional): Asset description
- `registerOnStory` (boolean, optional): Register on Story Protocol

**Response:**
```json
{
  "assetId": "uuid",
  "url": "/api/asset/uuid",
  "title": "Asset Title",
  "price": 0.01,
  "ipfsCid": "Qm...",
  "ipfsUrl": "https://...",
  "thumbnailUrl": "https://...",
  "storyIPId": "0x..."
}
```

#### `GET /api/asset/:id`
Get asset with X402 payment challenge or access if paid.

**Headers:**
- `Authorization: Bearer <token>` (optional, if already paid)

**Response (402 Payment Required):**
```json
{
  "error": "Payment Required",
  "code": "402",
  "challenge": {
    "version": "1.0",
    "network": "ethereum:sepolia",
    "currency": "USDC",
    "decimals": 6,
    "amount": "10000",
    "tokenAddress": "0x...",
    "recipient": "0x...",
    "expiresAt": 1234567890,
    "assetId": "uuid"
  },
  "paymentRequestToken": "uuid",
  "metadata": {
    "unlockLayers": [...]
  }
}
```

### Payment

#### `POST /api/payment/verify`
Verify payment transaction and issue access token.

**Request:**
```json
{
  "transactionHash": "0x...",
  "paymentRequestToken": "uuid",
  "assetId": "uuid",
  "unlockLayerId": "uuid" // optional
}
```

**Response:**
```json
{
  "accessToken": "jwt_token"
}
```

### Unlock Layers

#### `GET /api/unlock/:layerId`
Get payment challenge for a specific unlock layer.

**Response:** Same as asset endpoint (402 with challenge)

### Negotiations

#### `POST /api/negotiation/create`
Create a negotiation intent (agent-to-agent).

**Request:**
```json
{
  "assetId": "uuid",
  "agentAddress": "0x...",
  "agentPrivateKey": "0x...", // For XMTP
  "requestedAmount": "0.5",
  "requestedLicenseType": "commercial",
  "message": "Bulk license request for 20 images",
  "expiresInHours": 24
}
```

#### `POST /api/negotiation/:id/respond`
Respond to a negotiation (accept/counter/reject).

**Request:**
```json
{
  "creatorPrivateKey": "0x...",
  "status": "accepted", // or "countered", "rejected"
  "counterAmount": "0.4", // if countered
  "counterLicenseType": "commercial",
  "message": "Counter offer"
}
```

### Derived Works

#### `POST /api/derivative/register`
Register a derived work with automatic Story Protocol linking.

**Request:**
```json
{
  "parentAssetId": "uuid",
  "derivedFile": "base64_string_or_file",
  "derivedFileName": "remix.jpg",
  "derivationType": "remix",
  "title": "My Remix",
  "creatorAddress": "0x...",
  "revenueSplitPercentage": 10
}
```

### Agent

#### `POST /api/agent/create`
Create or update agent profile.

#### `GET /api/agent/:address`
Get agent profile and stats.

#### `POST /api/agent/discover`
Discover assets by tags (for agent bots).

### Provider

#### `GET /api/provider/:address/assets`
Get all assets by a provider.

#### `GET /api/provider/:address/earnings`
Get earnings summary.

#### `GET /api/provider/:address/stats`
Get provider statistics.

## SDK Usage

See the `sdk/` directory for the TypeScript SDK.

### Example: Upload and Pay

```typescript
import { ethers } from 'ethers';
import { uploadAsset, payAndFetch, discover } from 'drop-sdk';

// Upload
const signer = new ethers.Wallet(privateKey, provider);
const result = await uploadAsset(file, {
  title: 'My Asset',
  price: 0.01,
  recipient: await signer.getAddress(),
  registerOnStory: true,
}, signer);

// Pay and fetch
const paymentResult = await payAndFetch(
  `https://api.example.com/api/asset/${result.assetId}`,
  signer
);

console.log('Download URL:', paymentResult.downloadUrl);
```

### Example: Unlock Layers

```typescript
import { payForUnlockLayer } from 'drop-sdk';

// Pay for HD preview
const hdResult = await payForUnlockLayer(
  `https://api.example.com/api/unlock/${layerId}`,
  signer
);
```

### Example: Negotiate

```typescript
import { createNegotiation } from 'drop-sdk';

const negotiation = await createNegotiation({
  assetId: 'uuid',
  requestedAmount: '0.5',
  requestedLicenseType: 'commercial',
  message: 'Bulk license for 20 images',
}, agentPrivateKey);
```

## Development

### Database Migrations

```bash
npm run migrate
```

### Build

```bash
npm run build
```

### Production

```bash
npm start
```

## Architecture

- **Express.js** - Web framework
- **PostgreSQL** - Database
- **ethers.js** - Ethereum interactions
- **Web3.Storage** - IPFS storage
- **XMTP** - Agent-to-agent messaging
- **Story Protocol SDK** - IP registration and licensing
- **Sharp** - Image processing
- **JWT** - Access tokens

## License

MIT

