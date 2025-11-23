import express, { Request, Response } from 'express';
import { queryOne } from '../db';
import { weiToDollarString } from '../middleware/x402-asset';
import { verifyJwt } from '../utils/jwt';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

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

// GET /api/unlock/:layerId - Get unlock layer with x402 payment
router.get('/:layerId', async (req: Request, res: Response) => {
  try {
    const { layerId } = req.params;

    // Check for x402 payment header
    const xPaymentHeader = req.headers['x-payment'] as string;
    
    // Also check for legacy JWT token
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    let jwtVerified = false;

    if (token) {
      const decoded = verifyJwt(token);
      jwtVerified = decoded && decoded.unlockLayerId === layerId;
    }

    const hasPayment = !!xPaymentHeader || jwtVerified;

    if (hasPayment) {
      // Payment verified - return unlock layer data
      const layer = await queryOne<UnlockLayerRow>(
        'SELECT * FROM unlock_layers WHERE id = $1',
        [layerId]
      );

      if (!layer) {
        return res.status(404).json({ error: 'Unlock layer not found' });
      }

      return res.json({
        layerId: layer.id,
        layerName: layer.layer_name,
        layerIndex: layer.layer_index,
        unlockType: layer.unlock_type,
        assetId: layer.asset_id,
        ipfsUrl: layer.ipfs_url,
        ipfsCid: layer.ipfs_cid,
      });
    }

    // No payment - return 402
    const layer = await queryOne<UnlockLayerRow & { recipient_address: string }>(
      `SELECT ul.*, a.recipient_address 
       FROM unlock_layers ul
       JOIN assets a ON ul.asset_id = a.id
       WHERE ul.id = $1`,
      [layerId]
    );

    if (!layer) {
      return res.status(404).json({ error: 'Unlock layer not found' });
    }

    const network = config.ethereum.network === 'sepolia' ? 'base-sepolia' : 'base';

    return res.status(402).json({
      error: 'Payment Required',
      code: '402',
      challenge: {
        version: '1.0',
        network,
        currency: 'USDC',
        decimals: 6,
        amount: layer.price_wei,
        tokenAddress: config.ethereum.usdcTokenAddress,
        recipient: layer.recipient_address,
        expiresAt: Math.floor(Date.now() / 1000) + 300,
        assetId: layer.asset_id,
        unlockLayerId: layer.id,
        unlockLayerIndex: layer.layer_index,
      },
      paymentRequestToken: uuidv4(),
      description: `Payment required to unlock ${layer.layer_name}`,
      metadata: {
        layerName: layer.layer_name,
        layerIndex: layer.layer_index,
        unlockType: layer.unlock_type,
        assetId: layer.asset_id,
      },
    });
  } catch (error) {
    console.error('Get unlock layer error:', error);
    res.status(500).json({
      error: 'Failed to get unlock layer',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

