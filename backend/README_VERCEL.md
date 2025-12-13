# Vercel Deployment - Quick Reference

## Files Created for Vercel Deployment

1. **`vercel.json`** - Vercel configuration file
2. **`api/index.ts`** - Serverless function entry point that wraps Express app
3. **`.vercelignore`** - Files to exclude from deployment

## Deployment Command

```bash
cd backend
vercel
```

## Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

- All variables from your `.env` file
- See `VERCEL_DEPLOY.md` for complete list

## After Deployment

1. Get your backend URL from Vercel dashboard
2. Set `NEXT_PUBLIC_BACKEND_URL` in frontend Vercel project
3. Redeploy frontend

## How It Works

- Vercel converts the Express app into serverless functions
- All routes are handled by `api/index.ts`
- Database is initialized on first request (cold start)
- Subsequent requests reuse the connection (warm start)

## Important Notes

- The `api/index.ts` file must use ES modules (export default)
- Vercel automatically compiles TypeScript
- Function timeout is set to 60 seconds
- All routes are proxied through the single handler
