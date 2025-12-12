# Drop CLI

> Command-line tool for developers to interact with the Drop platform - upload assets, register IP on Story Protocol, generate X402 receipts, verify payments, and retrieve license history.

[![npm version](https://img.shields.io/npm/v/drop-cli-tool.svg)](https://www.npmjs.com/package/drop-cli-tool)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## About Drop

**Drop** is a decentralized platform for creators to monetize their digital assets using blockchain technology. It combines:

- **IPFS Storage** - Decentralized file storage
- **Story Protocol** - IP asset registration and licensing
- **X402 Payment Protocol** - Pay-per-access monetization
- **Base Network** - Fast and low-cost transactions

With Drop, creators can:
- Upload and store digital assets on IPFS
- Register intellectual property on Story Protocol
- Set prices and sell licenses for their content
- Track purchases and manage licenses
- Generate receipts for payments

## Installation

### Prerequisites

- Node.js 18+ and npm
- Backend server running (see [Backend Setup](#backend-setup))
- Wallet address for receiving payments

### Install from npm

```bash
npm install -g drop-cli-tool
```

### Install from source

```bash
# Clone the repository
git clone <repository-url>
cd Drop/sdk/cli

# Install dependencies
npm install

# Build the CLI
npm run build

# Link globally (for development)
npm link
```

## Setup

### 1. Configure Backend URL

```bash
drop config --set backendUrl=http://localhost:3001
```

Or use environment variable:
```bash
export DROP_BACKEND_URL=http://localhost:3001
```

### 2. Set Wallet Address

```bash
drop config --set walletAddress=0xYourWalletAddress
```

Or use environment variable:
```bash
export DROP_WALLET_ADDRESS=0xYourWalletAddress
```

### 3. Verify Configuration

```bash
drop config --list
```

**Expected output:**
```json
{
  "backendUrl": "http://localhost:3001",
  "walletAddress": "0xYourWalletAddress"
}
```

## Backend Setup

Before using the CLI, ensure your Drop backend is running:

```bash
cd backend
npm install
npm run dev
```

The backend should be accessible at `http://localhost:3001` (or your configured URL).

### Required Backend Environment Variables

The backend needs these environment variables configured:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/drop

# Ethereum/Base Network
ETHEREUM_RPC_URL=https://sepolia.base.org
USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# IPFS
WEB3_STORAGE_TOKEN=your_web3_storage_token
# OR
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key

# Story Protocol
STORY_PROTOCOL_RPC_URL=https://aeneid-rpc.story.foundation
STORY_PROTOCOL_MODULE_ADDRESS=0x...
STORY_PROTOCOL_REGISTRY_ADDRESS=0x...

# JWT
JWT_SECRET=your_jwt_secret_here

# Platform Fee (optional)
PLATFORM_FEE_PERCENTAGE=5
PLATFORM_WALLET_ADDRESS=0xPlatformWalletAddress
```

## Commands

### `drop config`

Configure Drop CLI settings.

```bash
# Set a configuration value
drop config --set backendUrl=http://localhost:3001

# Get a configuration value
drop config --get backendUrl

# List all configuration
drop config --list
```

**Available config keys:**
- `backendUrl` - Backend API URL
- `walletAddress` - Default wallet address
- `privateKey` - Private key (optional, for signing)
- `storyProtocolRpcUrl` - Story Protocol RPC URL (optional)

---

### `drop upload <file>`

Upload an image asset to Drop.

**Options:**
- `--title <title>` - Asset title (default: filename)
- `--description <description>` - Asset description
- `--price <price>` - Price in USDC (default: 0.01)
- `--recipient <address>` - Recipient wallet address (or use config)
- `--no-register` - Skip Story Protocol registration
- `--tags <tags>` - Comma-separated tags

**Example:**
```bash
drop upload ./my-artwork.jpg \
  --title "Digital Art" \
  --description "A beautiful piece" \
  --price 2 \
  --recipient 0x1234... \
  --tags "art,digital,nft"
```

**Output:**
```
✓ Asset uploaded successfully!

Asset Details:
  ID: abc-123-def-456
  Title: Digital Art
  IPFS CID: QmXxxx...
  IPFS URL: https://ipfs.io/ipfs/QmXxxx...
  Story Protocol IP ID: 0x1234...
  Price: 2 USDC
  Fingerprint: a1b2c3d4...

✓ Registered on Story Protocol
```

---

### `drop register <assetId>`

Register an existing asset on Story Protocol.

**Example:**
```bash
drop register abc-123-def-456
```

**Output:**
```
✓ IP registered on Story Protocol!

Story Protocol Details:
  IP ID: 0x1234...
  Asset ID: abc-123-def-456
```

---

### `drop receipt <transactionHash>`

Generate an X402 receipt for a payment transaction.

**Options:**
- `--asset-id <assetId>` - Asset ID
- `--wallet <address>` - Wallet address

**Example:**
```bash
drop receipt 0xTransactionHash \
  --asset-id abc-123-def \
  --wallet 0x1234...
```

**Output:**
```
✓ Receipt generated!

X402 Receipt:
  Transaction: 0xTransactionHash
  Asset ID: abc-123-def
  Amount: 2 USDC
  Payer: 0xBuyerAddress
  Recipient: 0xCreatorAddress
  Explorer: https://basescan.org/tx/0x...
  Access Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### `drop verify <transactionHash>`

Verify a payment transaction.

**Required Options:**
- `--asset-id <assetId>` - Asset ID
- `--token <token>` - Payment request token

**Example:**
```bash
drop verify 0xTransactionHash \
  --asset-id abc-123-def \
  --token paymentRequestToken
```

**Output:**
```
✓ Payment verified!

Payment Verification:
  Transaction: 0xTransactionHash
  Asset ID: abc-123-def
  Status: VERIFIED

License Details:
  Type: personal
  Story License ID: 0xLicenseId...
  Token ID: 12345
```

---

### `drop licenses`

Retrieve license history for a wallet.

**Required Options:**
- `--wallet <address>` - Wallet address

**Options:**
- `--format <format>` - Output format (json, table) - default: table

**Example:**
```bash
# Table format
drop licenses --wallet 0x1234...

# JSON format
drop licenses --wallet 0x1234... --format json
```

**Output:**
```
✓ License history retrieved!

License History (3 licenses):

1. Digital Art
   Asset ID: abc-123-def
   License Type: personal
   Purchased: 12/12/2025, 10:30:00 AM
   Transaction: 0xTransactionHash
   Story License ID: 0xLicenseId...

2. Another Asset
   ...
```

---

## Complete Workflow

### 1. Upload an Asset

```bash
drop upload ./image.jpg \
  --title "My Artwork" \
  --price 2 \
  --recipient 0xYourWalletAddress
```

**Save the Asset ID** from the output.

### 2. Register on Story Protocol (if not done during upload)

```bash
drop register <assetId>
```

### 3. After Payment, Generate Receipt

```bash
drop receipt <transactionHash> \
  --asset-id <assetId> \
  --wallet <walletAddress>
```

### 4. Verify Payment

```bash
drop verify <transactionHash> \
  --asset-id <assetId> \
  --token <paymentRequestToken>
```

### 5. View License History

```bash
drop licenses --wallet 0xYourWalletAddress
```

## Examples

### Example 1: Quick Upload

```bash
# Set config once
drop config --set backendUrl=http://localhost:3001
drop config --set walletAddress=0xYourWalletAddress

# Upload with defaults
drop upload ./artwork.jpg --title "My Art"
```

### Example 2: Full Flow Script

```bash
#!/bin/bash

# Upload
ASSET_ID=$(drop upload test.jpg --title "Test" --price 0.01 --recipient 0x123... | grep "ID:" | awk '{print $2}')

# Register (if needed)
drop register $ASSET_ID

# View licenses
drop licenses --wallet 0x123...
```

### Example 3: Batch Upload

```bash
for file in ./images/*.jpg; do
  drop upload "$file" \
    --title "$(basename "$file" .jpg)" \
    --price 0.01 \
    --recipient 0xYourWalletAddress
done
```

## Troubleshooting

### Command Not Found

```bash
# If 'drop' command not found after installation
npm link  # (if installed from source)
# OR
npm install -g drop-cli-tool  # (if installing from npm)
```

### Backend Connection Errors

- Ensure backend is running: `cd backend && npm run dev`
- Check backend URL: `drop config --get backendUrl`
- Test backend: `curl http://localhost:3001/api/health`

### Upload Fails

- Check file exists and is readable
- Verify backend is running
- Check IPFS configuration in backend
- Review backend logs for detailed errors

### Story Protocol Registration Fails

- Ensure wallet has Aeneid testnet tokens
- Verify Story Protocol config in backend `.env`
- Check backend logs for detailed errors

### Configuration Not Found

```bash
# Set missing config
drop config --set backendUrl=http://localhost:3001
drop config --set walletAddress=0xYourWalletAddress

# Or use environment variables
export DROP_BACKEND_URL=http://localhost:3001
export DROP_WALLET_ADDRESS=0xYourWalletAddress
```

## Security Notes

- **Never commit** your private keys or secrets
- Use environment variables for sensitive data
- Keep your JWT tokens secure
- Verify transaction hashes before trusting receipts

## License

MIT License - see LICENSE file for details


---
