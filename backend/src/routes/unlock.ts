import express, { Request, Response } from 'express';
import { queryOne } from '../db';
import { createPaymentChallenge, format402Response } from '../utils/payment-challenge';
import { config } from '../config';
import { getERC20Decimals } from '../services/ethereum';

const router = express.Router();

interface UnlockLayerRow {
  id: string;
  asset_id: string;
  layer_index: number;
  layer_name: string;
  price_wei: string;
  unlock_type: string;
  ipfs_cid?: string;
  ipfs_url?: string;
}

interface AssetRow {
  id: string;
  recipient_address: string;
  currency: string;
}

// GET /api/unlock/:layerId - Get unlock layer challenge
router.get('/:layerId', async (req: Request, res: Response) => {
  try {
    const { layerId } = req.params;

    // Get unlock layer
    const layer = await queryOne<UnlockLayerRow>(
      'SELECT * FROM unlock_layers WHERE id = $1',
      [layerId]
    );

    if (!layer) {
      return res.status(404).json({ error: 'Unlock layer not found' });
    }

    // Get asset
    const asset = await queryOne<AssetRow>(
      'SELECT * FROM assets WHERE id = $1',
      [layer.asset_id]
    );

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Get token decimals
    const decimals = await getERC20Decimals(config.ethereum.usdcTokenAddress);

    // Create payment challenge for this unlock layer
    const challenge = createPaymentChallenge(
      layer.asset_id,
      BigInt(layer.price_wei),
      decimals,
      asset.currency,
      config.ethereum.usdcTokenAddress,
      asset.recipient_address,
      `ethereum:${config.ethereum.network}`,
      300, // 5 minutes
      layer.id,
      layer.layer_index
    );

    // Format response
    const response = format402Response(
      challenge,
      `Payment required to unlock ${layer.layer_name}`,
      {
        layerName: layer.layer_name,
        layerIndex: layer.layer_index,
        unlockType: layer.unlock_type,
        assetId: layer.asset_id,
      }
    );

    return res.status(402).json(response);
  } catch (error) {
    console.error('Get unlock layer error:', error);
    res.status(500).json({
      error: 'Failed to get unlock layer',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

