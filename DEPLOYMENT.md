# Deployment Guide

This guide covers deploying both the backend and frontend to Vercel.

## Overview

- **Backend**: Express.js server deployed as Vercel serverless functions
- **Frontend**: Next.js app deployed to Vercel
- **API Communication**: Frontend calls backend using `NEXT_PUBLIC_BACKEND_URL` environment variable

## Quick Start

### 1. Deploy Backend

```bash
cd backend
vercel
```

After deployment, note your backend URL (e.g., `https://surreal-world-backend.vercel.app`)

### 2. Configure Frontend

Set the environment variable in your frontend Vercel project:

```env
NEXT_PUBLIC_BACKEND_URL=https://your-backend-url.vercel.app
```

### 3. Deploy Frontend

```bash
cd frontend
vercel
```

## Detailed Steps

### Backend Deployment

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Set up and deploy? → **Yes**
   - Link to existing project? → **No** (first time)
   - Project name → `surreal-world-backend`
   - Directory → `./`

3. **Set Environment Variables:**
   
   Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   
   Add all required variables (see `backend/VERCEL_DEPLOY.md` for full list):
   - `DATABASE_URL`
   - `ETHEREUM_RPC_URL`
   - `USDC_TOKEN_ADDRESS`
   - `PRIVATE_KEY`
   - `WEB3_STORAGE_TOKEN`
   - `STORY_PROTOCOL_*` variables
   - And all others from your `.env` file

4. **Redeploy after setting environment variables:**
   ```bash
   vercel --prod
   ```

5. **Get your backend URL:**
   - Check Vercel dashboard or run: `vercel ls`
   - URL format: `https://your-project-name.vercel.app`

### Frontend Deployment

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Set environment variable:**
   
   In Vercel Dashboard → Frontend Project → Settings → Environment Variables:
   
   ```env
   NEXT_PUBLIC_BACKEND_URL=https://your-backend-url.vercel.app
   ```
   
   **Important**: Replace `your-backend-url` with your actual backend URL from step 1.

3. **Deploy to Vercel:**
   ```bash
   vercel
   ```

4. **Verify deployment:**
   - Open your frontend URL
   - Check browser console for API calls
   - Verify they're going to the correct backend URL

## How API Calls Work

### Development (Local)

- Frontend runs on: `http://localhost:3000`
- Backend runs on: `http://localhost:3001`
- Frontend `.env.local`:
  ```env
  NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
  ```

### Production (Vercel)

- Frontend: `https://your-frontend.vercel.app`
- Backend: `https://your-backend.vercel.app`
- Frontend environment variable:
  ```env
  NEXT_PUBLIC_BACKEND_URL=https://your-backend.vercel.app
  ```

### Code Reference

The frontend uses the environment variable in `frontend/lib/api-client.ts`:

```typescript
const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
```

All API calls use this variable, so you only need to update the environment variable when deploying.

## Environment Variables Summary

### Backend (Vercel Backend Project)

All variables from `backend/.env`:
- Database, Ethereum, IPFS, Story Protocol, etc.

### Frontend (Vercel Frontend Project)

Only this variable:
- `NEXT_PUBLIC_BACKEND_URL` - Your backend Vercel URL

## Testing After Deployment

1. **Test Backend Health:**
   ```bash
   curl https://your-backend-url.vercel.app/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Test Backend API:**
   ```bash
   curl https://your-backend-url.vercel.app/api/asset/list
   ```

3. **Test Frontend:**
   - Open your frontend URL
   - Check browser DevTools → Network tab
   - Verify API calls are going to your backend URL

## Troubleshooting

### Backend Issues

- **502 Bad Gateway**: Check Vercel function logs
- **Database connection errors**: Verify `DATABASE_URL` and network access
- **Environment variables not working**: Ensure they're set in Vercel dashboard

### Frontend Issues

- **API calls failing**: 
  - Verify `NEXT_PUBLIC_BACKEND_URL` is set correctly
  - Check browser console for CORS errors
  - Verify backend is accessible

- **CORS errors**: 
  - Backend has CORS enabled
  - If issues persist, check backend CORS configuration

### Common Mistakes

1. ❌ Forgetting to set `NEXT_PUBLIC_BACKEND_URL` in frontend
2. ❌ Using `http://localhost:3001` in production
3. ❌ Not redeploying after changing environment variables
4. ❌ Database not accessible from Vercel's servers

## Next Steps

- Set up custom domains if needed
- Configure preview deployments for PRs
- Set up monitoring and logging
- Configure database connection pooling for serverless
