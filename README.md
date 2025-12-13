# Drop - Decentralized IP Asset Monetization Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Base Network](https://img.shields.io/badge/Base-Sepolia-blue)](https://base.org/)

**Drop** is a decentralized platform that enables creators to monetize their digital assets through blockchain-based licensing, automatic IP registration, and royalty distribution. Built on Base network with Story Protocol integration and X402 payment protocol.

---

## Table of Contents

- [1. Detailed Description](#1-detailed-description)
- [2. Project Implementation](#2-project-implementation)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## 1. Detailed Description

### Problem Statement

Digital creators face significant challenges in monetizing their work:

1. **Lack of IP Protection**: No automated way to register and protect intellectual property on-chain
2. **Complex Licensing**: Difficult to manage different license types (personal, commercial, derivative)
3. **No Royalty System**: Creators don't benefit when their work is remixed or used in derivative works
4. **High Transaction Costs**: Traditional blockchain networks are too expensive for micropayments
5. **Centralized Platforms**: Existing solutions take large cuts and don't give creators control
6. **No Duplicate Detection**: Can't prevent copyright infringement or duplicate uploads

### Solution

**Drop** solves these problems by providing:

- ✅ **Automatic IP Registration**: Every uploaded asset is automatically registered on Story Protocol
- ✅ **Pay-Per-Access Licensing**: X402 protocol enables micropayments for content access
- ✅ **Automatic Royalty Distribution**: Derivative works automatically pay royalties to original creators
- ✅ **Low-Cost Transactions**: Built on Base network (Layer 2) for fast, cheap transactions
- ✅ **Creator Control**: 95% of revenue goes to creators, only 5% platform fee
- ✅ **Duplicate Detection**: Perceptual hashing prevents duplicate uploads
- ✅ **Progressive Unlocks**: Blurred preview → HD → Full → Commercial license tiers
- ✅ **Developer SDK**: CLI tool for developers to integrate Drop into their workflows

### Target Users

1. **Digital Creators**: Artists, photographers, designers who want to monetize their work
2. **Content Buyers**: Individuals and businesses needing licensed digital assets
3. **Developers**: Building applications that need IP asset management
4. **Remix Artists**: Creators who want to build on existing work with proper attribution

---

## 2. Project Implementation

### Architecture Overview

Drop consists of three main components:

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  Next.js 16 + React + TypeScript + Privy.io                 │
│  - Asset Discovery & Browsing                               │
│  - Upload Flow with IP Registration                         │
│  - Dashboard with Revenue Tracking                          │
│  - Payment Integration                                       │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST API
┌─────────────────────────────────────────────────────────────┐
│                         Backend                             │
│  Node.js + Express + TypeScript + PostgreSQL                 │
│  - X402 Payment Protocol                                     │
│  - Story Protocol Integration                                │
│  - IPFS Storage (Pinata/Web3.Storage)                       │
│  - Image Processing & Duplicate Detection                   │
│  - Royalty & Derivative Management                          │
└─────────────────────────────────────────────────────────────┘
                            ↕ Blockchain
┌─────────────────────────────────────────────────────────────┐
│                    Blockchain Layer                          │
│  Base Sepolia (Testnet)                                     │
│  - USDC Token (ERC20)                                        │
│  - Story Protocol (Aeneid Testnet)                           │
│  - X402 Payment Protocol                                    │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. Backend (`/backend`)

**Technology Stack:**
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 14+
- **Blockchain**: Ethers.js 6.x, Viem 2.x
- **IP Storage**: Pinata, Web3.Storage
- **Image Processing**: Sharp
- **Protocols**: Story Protocol SDK, X402

**Key Services:**

1. **Payment Service** (`src/routes/payment.ts`)
   - Implements X402 payment protocol
   - Generates payment challenges
   - Verifies on-chain transactions
   - Issues JWT access tokens (10-year validity)
   - Handles platform fee distribution (5% platform, 95% creator)

2. **Story Protocol Service** (`src/services/story-protocol.ts`)
   - Automatic IP asset registration
   - License minting (personal/commercial)
   - Derivative work registration
   - Royalty token management
   - Revenue claiming

3. **IPFS Service** (`src/services/ipfs.ts`)
   - File upload to IPFS (Pinata/Web3.Storage)
   - Thumbnail generation
   - Metadata storage
   - Watermarked preview generation

4. **Image Processing** (`src/services/image-processing.ts`)
   - Perceptual hashing (pHash) for duplicate detection
   - Image similarity comparison
   - Watermark generation
   - Automatic thumbnail creation

5. **Derivative Works** (`src/routes/derivative.ts`)
   - Register remixes/derivatives
   - Link to parent IP assets
   - Set revenue split percentages
   - Automatic royalty distribution

6. **Royalty Management** (`src/routes/royalty.ts`)
   - Create royalty tokens
   - Track fractional ownership
   - Record revenue distributions
   - Manage token holdings

**Database Schema:**

- `assets`: Digital assets with IPFS CIDs, Story Protocol IP IDs, pricing
- `payments`: Payment records with platform fee tracking
- `licenses`: Story Protocol license records
- `unlock_layers`: Progressive unlock system
- `derived_works`: Derivative work registrations
- `royalty_tokens`: Royalty token tracking
- `royalty_token_holdings`: Fractional ownership records
- `royalty_distributions`: Revenue distribution history
- `negotiations`: Agent-to-agent pricing negotiations

#### 2. Frontend (`/frontend`)

**Technology Stack:**
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Wallet**: Privy.io
- **Icons**: Lucide React

**Key Pages:**

1. **Home Page** (`app/page.tsx`)
   - Masonry grid of all assets
   - Search functionality
   - Asset modal with purchase flow
   - Real-time price display

2. **Upload Flow** (`app/upload-flow/page.tsx`)
   - File selection and preview
   - Perceptual hash generation
   - Uniqueness checking
   - Metadata input (title, description, price)
   - Story Protocol registration
   - IPFS upload
   - Success confirmation with IP ID

3. **Dashboard** (`app/dashboard/page.tsx`)
   - Total assets created
   - License revenue (sum of received payments)
   - Royalty revenue (from derivatives)
   - Transaction history (received/sent)
   - Created assets management
   - Royalty token creation
   - Auto-refresh every 30 seconds

**Payment Flow:**

```
1. User clicks "Purchase License"
   ↓
2. Frontend requests payment challenge from backend
   ↓
3. Backend returns 402 Payment Required with:
   - Amount (in wei)
   - Creator address (95%)
   - Platform address (5%)
   - Expiration timestamp
   ↓
4. Frontend initiates two ERC20 transfers:
   - Transfer 1: 95% to creator
   - Transfer 2: 5% to platform
   ↓
5. Frontend submits both transaction hashes to backend
   ↓
6. Backend verifies both transactions on-chain
   ↓
7. Backend issues JWT access token (10-year validity)
   ↓
8. User can download full-quality asset
```

#### 3. CLI SDK (`/sdk/cli`)

**Published Package**: `drop-cli-tool` on npm [drop-cli-tool on npm](https://www.npmjs.com/package/drop-cli-tool)


**Commands:**
- `drop config`: Manage configuration (backend URL, wallet address)
- `drop upload`: Upload assets with automatic IP registration
- `drop register`: Register existing assets on Story Protocol
- `drop receipt`: Generate payment receipts
- `drop verify`: Verify payment transactions
- `drop licenses`: List purchased licenses

**Configuration:**
- Stored in `~/.drop/config.json`
- Supports environment variables
- Backend URL and wallet address management

### Key Features Implementation

#### 1. Perceptual Hashing & Duplicate Detection

**Implementation:**
- Uses pHash algorithm to generate perceptual hashes
- Compares against existing assets in database
- Detects both exact duplicates and similar images (configurable threshold)
- Prevents copyright infringement
- Stores hash in database for future comparisons

**Code Location:** `backend/src/services/image-processing.ts`

#### 2. Progressive Unlock System

**Tiers:**
1. **Blurred Preview** (Free): Watermarked, low-resolution preview
2. **HD Preview** (Micropayment): Higher quality preview
3. **Full Quality** (Standard Payment): Complete asset download
4. **Commercial License** (Premium): Commercial usage rights

**Implementation:**
- Stored in `unlock_layers` table
- Each layer has separate pricing
- X402 payment challenge generated per layer
- Story Protocol license minted for commercial tier

#### 3. Automatic Royalty Distribution

**Flow:**
1. User creates derivative work from existing asset
2. Derivative registered on Story Protocol with PIL Commercial Remix license
3. Revenue split configured (default 10% to parent)
4. When derivative is sold, royalties automatically distributed
5. Parent creator receives royalties via Story Protocol

**Code Location:** `backend/src/routes/derivative.ts`

#### 4. Platform Fee System

**Implementation:**
- 5% automatic platform fee on all purchases
- Two-transaction payment flow:
  - Transaction 1: 95% to creator
  - Transaction 2: 5% to platform wallet
- Both transactions verified on-chain
- All fees tracked in `payments` table
- Configurable via `PLATFORM_FEE_PERCENTAGE` environment variable

**Code Location:** `backend/src/routes/payment.ts`

#### 5. Long-Lived Access Tokens

**Implementation:**
- JWT tokens issued after payment verification
- 10-year validity period
- One-time payment = permanent access
- Stored in `user_purchases` table
- Validated on download requests

**Code Location:** `backend/src/utils/jwt.ts`

### Security Features

1. **JWT-Based Access Control**: Secure token-based authentication
2. **On-Chain Verification**: All payments verified on blockchain
3. **Perceptual Hash Duplicate Detection**: Prevents copyright infringement
4. **Watermarked Previews**: Unpaid content is watermarked
5. **Case-Insensitive Address Matching**: Prevents address-related bugs
6. **Transaction Hash Uniqueness**: Prevents double-spending

### API Endpoints

#### Asset Management
- `POST /api/upload` - Upload asset with automatic IP registration
- `GET /api/asset/:id` - Get asset (returns 402 if unpaid)
- `GET /api/asset/list` - List all assets
- `POST /api/asset/:id/register-story` - Register existing asset on Story Protocol

#### Payment
- `POST /api/payment/challenge` - Generate payment challenge
- `POST /api/payment/verify` - Verify payment and issue access token

#### Derivatives
- `POST /api/derivative/register` - Register derivative work
- `GET /api/derivative/:assetId` - Get derivatives for an asset
- `GET /api/derivative/parent/:parentAssetId` - Get derivatives of a parent

#### Royalties
- `POST /api/royalty/create/:assetId` - Create royalty token
- `GET /api/royalty/:assetId` - Get royalty token info
- `GET /api/royalty/:assetId/holdings` - Get token holdings
- `GET /api/royalty/:assetId/revenue` - Get revenue history
- `POST /api/royalty/:assetId/transfer` - Transfer royalty tokens

#### User
- `GET /api/user/licenses` - Get purchased licenses
- `GET /api/user/download/:assetId` - Download asset (requires JWT)

#### Provider (Creator Dashboard)
- `GET /api/provider/:address/assets` - Get creator's assets
- `GET /api/provider/:address/transactions` - Get transaction history
- `GET /api/provider/:address/earnings` - Get earnings statistics
- `GET /api/provider/:address/stats` - Get creator stats

---

## Features

### Core Features
- ✅ **X402 Payment Protocol** - Official x402 protocol integration (Base network)
- ✅ **Story Protocol Integration** - Automatic IP registration and license minting
- ✅ **IPFS Storage** - Decentralized file storage via Pinata/Web3.Storage
- ✅ **Multi-layer Unlocks** - Preview-by-micropayment system
- ✅ **Perceptual Hash Duplicate Detection** - Prevents duplicate uploads
- ✅ **Automatic Thumbnail Generation** - Optimized preview images
- ✅ **Watermarked Previews** - Unpaid content protection

### Advanced Features
- ⭐ **Preview-by-Micropayment** - Progressive unlock layers (blurred → HD → full → commercial)
- ⭐ **Derivative Works Registration** - Automatic Story Protocol registration for remixes
- ⭐ **Automatic Royalty Distribution** - Creators earn from derivative works
- ⭐ **Royalty Tokens** - Fractional ownership and revenue tracking
- ⭐ **Platform Fee System** - 5% platform fee, 95% to creators
- ⭐ **Transaction History** - Complete payment and revenue tracking
- ⭐ **Developer CLI** - Command-line tool for automation

---

## Architecture

### System Architecture

```
┌──────────────┐
│   Frontend   │  Next.js + React + Privy.io
│  (Port 3000) │
└──────┬───────┘
       │ HTTP/REST
       │
┌──────▼───────┐
│   Backend    │  Express + TypeScript
│  (Port 3001) │
└──────┬───────┘
       │
       ├──► PostgreSQL Database
       │
       ├──► Base Sepolia (Ethereum L2)
       │    ├── USDC Token (ERC20)
       │    └── X402 Payment Protocol
       │
       ├──► Story Protocol (Aeneid Testnet)
       │    ├── IP Asset Registry
       │    ├── License Registry
       │    └── Royalty Distribution
       │
       └──► IPFS (Pinata/Web3.Storage)
            ├── Original Files
            ├── Thumbnails
            └── Metadata
```

### Data Flow

**Upload Flow:**
```
User Upload → Image Processing → Perceptual Hash Check → 
IPFS Upload → Story Protocol Registration → Database Storage → 
Return Asset ID + IP ID
```

**Purchase Flow:**
```
User Clicks Buy → Payment Challenge → Two ERC20 Transfers → 
Transaction Verification → JWT Token Issuance → 
Download Access Granted
```

**Derivative Flow:**
```
User Uploads Derivative → Link to Parent → Story Protocol Registration → 
PIL License Terms → Revenue Split Configuration → 
Automatic Royalty Distribution
```

---

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Language**: TypeScript 5.3
- **Database**: PostgreSQL 14+
- **Blockchain**: 
  - Ethers.js 6.x
  - Viem 2.x
  - Story Protocol SDK 1.x
- **Storage**: 
  - Pinata (IPFS)
  - Web3.Storage
- **Image Processing**: Sharp 0.33
- **Payment Protocol**: X402 (@coinbase/x402)
- **Logging**: Pino

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 18
- **Language**: TypeScript 5.3
- **Styling**: Tailwind CSS 3.4
- **Wallet**: Privy.io 3.x
- **Icons**: Lucide React

### Blockchain
- **Network**: Base Sepolia (Testnet)
- **Token**: USDC (ERC20)
- **IP Protocol**: Story Protocol (Aeneid Testnet)
- **Payment**: X402 Protocol

### CLI SDK
- **Language**: TypeScript 5.3
- **CLI Framework**: Commander.js
- **HTTP Client**: Axios
- **UI**: Chalk, Ora

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (or use hosted service)
- npm or yarn
- Base Sepolia testnet USDC tokens
- Story Protocol testnet tokens (for IP registration)
- Pinata account (or Web3.Storage account)

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd Drop
```

2. **Install backend dependencies:**
```bash
cd backend
npm install
```

3. **Install frontend dependencies:**
```bash
cd ../frontend
npm install
```

4. **Install CLI SDK (optional):**
```bash
cd ../sdk/cli
npm install
npm run build
npm link  # For global access
```

### Configuration

#### Backend Configuration

Create `backend/.env`:
```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/drop

# Ethereum / Base Network
ETHEREUM_RPC_URL=https://sepolia.base.org
ETHEREUM_NETWORK=sepolia
USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
PRIVATE_KEY=your_private_key_here

# Platform Fee
PLATFORM_FEE_PERCENTAGE=5
PLATFORM_WALLET_ADDRESS=0xYourPlatformWallet

# Story Protocol
STORY_PROTOCOL_RPC_URL=https://aeneid.rpc.story.foundation
STORY_PROTOCOL_CHAIN_ID=aeneid

# IPFS
PINATA_API_KEY=your_pinata_api_key
PINATA_API_SECRET=your_pinata_api_secret
IPFS_PROVIDER=pinata

# JWT
JWT_SECRET=your_jwt_secret_here
```

#### Frontend Configuration

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_USDC_TOKEN_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
```

### Database Setup

1. **Create database:**
```bash
createdb drop
```

2. **Run migrations:**
```bash
cd backend
npm run migrate
npm run migrate:platform-fee
npm run migrate:royalty-tokens
```

### Running the Application

1. **Start backend:**
```bash
cd backend
npm run dev
```

2. **Start frontend (in new terminal):**
```bash
cd frontend
npm run dev
```

3. **Access application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/health

### Using the CLI

1. **Configure CLI:**
```bash
drop config --set backendUrl=http://localhost:3001
drop config --set walletAddress=0xYourWalletAddress
```

2. **Upload an asset:**
```bash
drop upload path/to/image.jpg --price 2 --wallet 0xYourWallet
```

3. **List licenses:**
```bash
drop licenses --wallet 0xYourWallet
```

---

## Project Structure

```
Drop/
├── backend/                 # Backend API server
│   ├── src/
│   │   ├── config/         # Configuration
│   │   ├── db/              # Database schema & migrations
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic services
│   │   └── utils/           # Utility functions
│   ├── package.json
│   └── README.md
│
├── frontend/                # Next.js frontend
│   ├── app/
│   │   ├── components/      # React components
│   │   ├── dashboard/        # Dashboard page
│   │   ├── upload-flow/     # Upload page
│   │   └── page.tsx         # Home page
│   ├── lib/                 # Client libraries
│   ├── package.json
│   └── README.md
│
├── sdk/                     # SDK packages
│   ├── cli/                 # CLI tool
│   │   ├── src/
│   │   │   ├── commands/     # CLI commands
│   │   │   └── config.ts    # Configuration
│   │   ├── package.json
│   │   └── README.md
│   └── ...                  # Other SDK packages
│
└── README.md                # This file
```

---

## API Documentation

### Upload Asset

**Endpoint:** `POST /api/upload`

**Request:**
- `file` (multipart/form-data): File to upload
- `title` (string): Asset title
- `price` (number): Price in USDC
- `recipient` (string): Ethereum address to receive payments
- `description` (string, optional): Asset description
- `tags` (string, comma-separated): Tags

**Response:**
```json
{
  "assetId": "uuid",
  "title": "Asset Title",
  "price": 0.01,
  "ipfsCid": "Qm...",
  "ipfsUrl": "https://...",
  "thumbnailUrl": "https://...",
  "storyIPId": "0x...",
  "fingerprint": "hash..."
}
```

### Get Asset

**Endpoint:** `GET /api/asset/:id?wallet=0x...`

**Response (402 Payment Required):**
```json
{
  "error": "Payment Required",
  "code": "402",
  "challenge": {
    "version": "1.0",
    "network": "base-sepolia",
    "currency": "USDC",
    "decimals": 6,
    "amount": "10000",
    "tokenAddress": "0x...",
    "recipient": "0x...",
    "expiresAt": 1234567890,
    "assetId": "uuid",
    "platformFee": {
      "percentage": 5,
      "amount": "500",
      "walletAddress": "0x..."
    },
    "creatorAmount": "9500"
  }
}
```

### Verify Payment

**Endpoint:** `POST /api/payment/verify`

**Request:**
```json
{
  "transactionHash": "0x...",
  "platformTransactionHash": "0x...",
  "paymentRequestToken": "uuid",
  "assetId": "uuid"
}
```

**Response:**
```json
{
  "accessToken": "jwt_token...",
  "message": "Payment verified - license is permanent"
}
```

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## Acknowledgments

- [Story Protocol](https://www.story.foundation/) - IP asset registration and licensing
- [X402 Protocol](https://x402.org/) - Payment protocol
- [Base Network](https://base.org/) - Layer 2 blockchain
- [Privy](https://privy.io/) - Wallet connection
- [Pinata](https://pinata.cloud/) - IPFS storage

---




