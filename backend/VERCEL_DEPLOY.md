# Vercel Deployment Guide

This guide explains how to deploy the backend to Vercel and configure the frontend to use it.

## Prerequisites

1. A Vercel account
2. Vercel CLI installed: `npm i -g vercel`
3. All environment variables ready

## Deployment Steps

### 1. Deploy Backend to Vercel

```bash
cd backend
vercel
```

Follow the prompts:
- Set up and deploy? **Yes**
- Which scope? (Select your account)
- Link to existing project? **No** (first time) or **Yes** (if updating)
- Project name: `surreal-world-backend` (or your preferred name)
- Directory: `./` (current directory)
- Override settings? **No**

### 2. Set Environment Variables in Vercel

Go to your Vercel project dashboard → Settings → Environment Variables and add:

**Required Environment Variables:**

```env
# Server
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=your_postgresql_connection_string

# Ethereum / Base Network
ETHEREUM_RPC_URL=your_rpc_url
ETHEREUM_NETWORK=base  # or sepolia for testnet
USDC_TOKEN_ADDRESS=your_usdc_token_address
PRIVATE_KEY=your_private_key

# IPFS
WEB3_STORAGE_TOKEN=your_web3_storage_token
PINATA_API_KEY=your_pinata_api_key
PINATA_API_SECRET=your_pinata_api_secret
IPFS_PROVIDER=pinata  # or web3storage

# Story Protocol
STORY_PROTOCOL_RPC_URL=your_story_protocol_rpc_url
STORY_PROTOCOL_CHAIN_ID=aeneid  # or sonic for mainnet
STORY_PROTOCOL_MODULE_ADDRESS=your_module_address
STORY_PROTOCOL_REGISTRY_ADDRESS=your_registry_address
STORY_PROTOCOL_LICENSE_REGISTRY_ADDRESS=your_license_registry_address

# Platform
PLATFORM_FEE_PERCENTAGE=5
PLATFORM_WALLET_ADDRESS=your_platform_wallet_address

# XMTP
XMTP_ENV=production  # or dev for testnet

# JWT
JWT_SECRET=your_jwt_secret
```

### 3. Get Your Backend URL

After deployment, Vercel will provide a URL like:
- `https://surreal-world-backend.vercel.app`

Copy this URL - you'll need it for the frontend.

### 4. Update Frontend Environment Variables

In your frontend project (or Vercel frontend deployment), set:

```env
NEXT_PUBLIC_BACKEND_URL=https://surreal-world-backend.vercel.app
```

### 5. Deploy Frontend

The frontend should already be configured to use `NEXT_PUBLIC_BACKEND_URL`. Deploy it to Vercel:

```bash
cd frontend
vercel
```

## Important Notes

1. **Database**: Make sure your PostgreSQL database is accessible from Vercel's servers. You may need to:
   - Use a cloud database (like Supabase, Neon, or Railway)
   - Whitelist Vercel's IP addresses if using a managed database

2. **Cold Starts**: Vercel serverless functions have cold starts. The first request after inactivity may take longer.

3. **Function Timeout**: The `maxDuration` is set to 60 seconds in `vercel.json`. For longer operations, consider upgrading your Vercel plan.

4. **File Uploads**: Large file uploads may need special handling. Consider using direct uploads to IPFS from the frontend.

5. **Environment Variables**: 
   - Backend variables are set in the backend Vercel project
   - Frontend variables (starting with `NEXT_PUBLIC_`) are set in the frontend Vercel project

## Testing After Deployment

1. Check backend health:
   ```bash
   curl https://your-backend-url.vercel.app/health
   ```

2. Test an API endpoint:
   ```bash
   curl https://your-backend-url.vercel.app/api/asset/list
   ```

3. Verify frontend can connect by checking browser console for API calls.

## Troubleshooting

- **502 Bad Gateway**: Check Vercel function logs for errors
- **Database connection errors**: Verify DATABASE_URL and network access
- **CORS errors**: The backend has CORS enabled, but check if frontend URL is whitelisted
- **Environment variables not working**: Make sure they're set in the correct Vercel project
