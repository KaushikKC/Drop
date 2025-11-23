import express, { Request, Response } from 'express';
import { queryOne } from '../db';
import { verifyJwt } from '../utils/jwt';
import { createPaymentChallenge, format402Response } from '../utils/payment-challenge';
import { config } from '../config';
import { getERC20Decimals } from '../services/ethereum';

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
  tags?: string[];
  story_ip_id?: string;
}

interface UnlockLayerRow {
  id: string;
  layer_index: number;
  layer_name: string;
  price_wei: string;
  unlock_type: string;
}

// GET /api/asset/:id - Get asset with X402 challenge or access if paid
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check for authorization token
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    if (token) {
      const decoded = verifyJwt(token);
      if (decoded && decoded.assetId === id) {
        // Authorized - return download URL
        const asset = await queryOne<AssetRow>(
          'SELECT * FROM assets WHERE id = $1',
          [id]
        );

        if (!asset) {
          return res.status(404).json({ error: 'Asset not found' });
        }

        return res.json({
          url: asset.ipfs_url,
          ipfsCid: asset.ipfs_cid,
          title: asset.title,
          description: asset.description,
        });
      }
    }

    // Not authorized - return 402 payment challenge
    const asset = await queryOne<AssetRow>(
      'SELECT * FROM assets WHERE id = $1',
      [id]
    );

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Get unlock layers
    const layers = await query<UnlockLayerRow>(
      'SELECT * FROM unlock_layers WHERE asset_id = $1 ORDER BY layer_index',
      [id]
    );

    // Get token decimals
    const decimals = await getERC20Decimals(config.ethereum.usdcTokenAddress);

    // Create payment challenge for the base asset (full resolution)
    const challenge = createPaymentChallenge(
      id,
      BigInt(asset.price_wei),
      decimals,
      asset.currency,
      config.ethereum.usdcTokenAddress,
      asset.recipient_address,
      `ethereum:${config.ethereum.network}`,
      300 // 5 minutes
    );

    // Format response with unlock layers info
    const response = format402Response(
      challenge,
      `Payment required to access ${asset.title}`,
      {
        title: asset.title,
        description: asset.description,
        thumbnailUrl: asset.thumbnail_ipfs_url,
        storyIPId: asset.story_ip_id,
        unlockLayers: layers.map((layer) => ({
          layerId: layer.id,
          layerIndex: layer.layer_index,
          layerName: layer.layer_name,
          price: layer.price_wei,
          unlockType: layer.unlock_type,
        })),
      }
    );

    return res.status(402).json(response);
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

