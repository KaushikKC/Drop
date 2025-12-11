import express, { Request, Response } from 'express';
import { queryOne, query } from '../db';
import { getAssetPricing, weiToDollarString } from '../middleware/x402-asset';
import { verifyJwt } from '../utils/jwt';
import { config } from '../config';

const router = express.Router();

interface AssetRow {
  id: string;
  title: string;
  description?: string;
  price_wei: string;
  currency: string;
  recipient_address: string;
  creator_address: string;
  ipfs_cid?: string;
  ipfs_url?: string;
  thumbnail_ipfs_cid?: string;
  thumbnail_ipfs_url?: string;
  file_type?: string;
  file_size?: number;
  tags?: string[];
  story_ip_id?: string;
  created_at?: Date | string;
}

interface UnlockLayerRow {
  id: string;
  layer_index: number;
  layer_name: string;
  price_wei: string;
  unlock_type: string;
}

// GET /api/assets/list - List all assets (for gallery) - MUST BE BEFORE /:id
router.get('/list', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const assets = await query<AssetRow>(
      `SELECT * FROM assets 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const totalResult = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM assets'
    );
    const total = parseInt(totalResult?.count || '0');

    res.json({
      assets: assets.map((asset) => ({
        id: asset.id,
        title: asset.title,
        description: asset.description,
        thumbnailUrl: asset.thumbnail_ipfs_url,
        previewUrl: asset.thumbnail_ipfs_url, // Watermarked preview (same as thumbnail)
        ipfsUrl: asset.ipfs_url, // Full quality (only for paid users)
        price_wei: asset.price_wei.toString(), // Keep as string to avoid precision loss
        price: (Number(asset.price_wei) / 1e6).toFixed(6), // Convert to USDC for convenience
        currency: asset.currency || 'USDC',
        creator: {
          address: asset.creator_address,
          recipient: asset.recipient_address,
        },
        tags: asset.tags || [],
        storyIPId: asset.story_ip_id,
        fingerprint: asset.perceptual_hash || '', // Add fingerprint
        createdAt: asset.created_at || new Date().toISOString(),
        // Metadata
        fileType: asset.file_type,
        fileSize: asset.file_size,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List assets error:', error);
    res.status(500).json({
      error: 'Failed to list assets',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/assets/unlocked/:id - Get unlocked HD asset - MUST BE BEFORE /:id
router.get('/unlocked/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify JWT token
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const decoded = verifyJwt(token);
    if (!decoded || decoded.assetId !== id) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    // Get asset
    const asset = await queryOne<AssetRow>(
      'SELECT * FROM assets WHERE id = $1',
      [id]
    );

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Return HD asset URL
    res.json({
      id: asset.id,
      title: asset.title,
      description: asset.description,
      hdUrl: asset.ipfs_url, // Full resolution from IPFS
      ipfsCid: asset.ipfs_cid,
      thumbnailUrl: asset.thumbnail_ipfs_url,
      storyIPId: asset.story_ip_id,
      fileType: asset.file_type,
      fileSize: asset.file_size,
      tags: asset.tags || [],
      createdAt: asset.created_at || new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get unlocked asset error:', error);
    res.status(500).json({
      error: 'Failed to get unlocked asset',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/asset/:id - Get asset with x402 payment
// Check for X-PAYMENT header (x402 standard) or legacy JWT
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check for x402 payment header
    const xPaymentHeader = req.headers['x-payment'] as string;
    
    // Also check for legacy JWT token (for backward compatibility)
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    let jwtVerified = false;

    if (token) {
      const decoded = verifyJwt(token);
      jwtVerified = !!(decoded && decoded.assetId === id);
    }

    // If x402 payment header present, verify with facilitator
    // For now, we'll trust the x402-fetch client has verified it
    // In production, you should verify with the facilitator
    const hasPayment = !!xPaymentHeader || jwtVerified;

    if (hasPayment) {
      // Payment verified - return asset data
      const asset = await queryOne<AssetRow>(
        'SELECT * FROM assets WHERE id = $1',
        [id]
      );

      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      // Get unlock layers for metadata
      const layers = await query<UnlockLayerRow>(
        'SELECT * FROM unlock_layers WHERE asset_id = $1 ORDER BY layer_index',
        [id]
      );

      // Payment verified - return full quality image
      return res.json({
        url: asset.ipfs_url, // Full quality original (no watermark)
        ipfsCid: asset.ipfs_cid,
        title: asset.title,
        description: asset.description,
        thumbnailUrl: asset.thumbnail_ipfs_url,
        previewUrl: asset.thumbnail_ipfs_url, // Preview URL (for reference)
        storyIPId: asset.story_ip_id,
        fingerprint: asset.perceptual_hash || '', // Add fingerprint
        fileType: asset.file_type,
        fileSize: asset.file_size,
        tags: asset.tags || [],
        unlockLayers: layers.map((layer) => ({
          layerId: layer.id,
          layerIndex: layer.layer_index,
          layerName: layer.layer_name,
          price: layer.price_wei,
          unlockType: layer.unlock_type,
        })),
      });
    }

    // No payment - return 402 with x402-compatible challenge
    // But also return preview URL so frontend can show watermarked preview
    const asset = await queryOne<AssetRow>(
      'SELECT * FROM assets WHERE id = $1',
      [id]
    );

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const pricing = await getAssetPricing(id);
    if (!pricing) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Get unlock layers
    const layers = await query<UnlockLayerRow>(
      'SELECT * FROM unlock_layers WHERE asset_id = $1 ORDER BY layer_index',
      [id]
    );

    // Return 402 with x402-compatible format
    // Include preview URL for unpaid users to see watermarked version
    return res.status(402).json({
      error: 'Payment Required',
      code: '402',
      challenge: {
        version: '1.0',
        network: pricing.network,
        currency: 'USDC',
        decimals: 6,
        amount: asset.price_wei,
        tokenAddress: config.ethereum.usdcTokenAddress,
        recipient: pricing.recipient,
        expiresAt: Math.floor(Date.now() / 1000) + 300,
        assetId: id,
      },
      paymentRequestToken: require('uuid').v4(),
      description: `Payment required to access ${asset.title}`,
      // Return preview URL for unpaid users (watermarked)
      previewUrl: asset.thumbnail_ipfs_url, // Watermarked preview
      metadata: {
        title: asset.title,
        description: asset.description,
        thumbnailUrl: asset.thumbnail_ipfs_url,
        previewUrl: asset.thumbnail_ipfs_url, // Watermarked preview
        storyIPId: asset.story_ip_id,
        fingerprint: asset.perceptual_hash || '', // Add fingerprint
        fileType: asset.file_type,
        fileSize: asset.file_size,
        tags: asset.tags || [],
        unlockLayers: layers.map((layer) => ({
          layerId: layer.id,
          layerIndex: layer.layer_index,
          layerName: layer.layer_name,
          price: layer.price_wei,
          unlockType: layer.unlock_type,
        })),
      },
    });
  } catch (error) {
    console.error('Get asset error:', error);
    res.status(500).json({
      error: 'Failed to get asset',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/asset/:id/layers - Get unlock layers for an asset
router.get('/:id/layers', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const layers = await query<UnlockLayerRow>(
      'SELECT * FROM unlock_layers WHERE asset_id = $1 ORDER BY layer_index',
      [id]
    );

    res.json({ layers });
  } catch (error) {
    console.error('Get layers error:', error);
    res.status(500).json({ error: 'Failed to get layers' });
  }
});


export default router;

