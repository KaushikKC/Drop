import express, { Request, Response } from 'express';
import { query, queryOne } from '../db';
import { verifyJwt } from '../utils/jwt';

const router = express.Router();

// GET /api/user/licenses?wallet=0x... - Get purchased assets (licenses) for a user
router.get('/licenses', async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string;

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return res.status(400).json({ error: 'Valid wallet address required' });
    }

    // Get all purchased assets with license information
    const purchases = await query(
      `SELECT 
        up.id as purchase_id,
        up.user_address,
        up.asset_id,
        up.transaction_hash,
        up.license_type,
        up.purchased_at,
        up.access_token,
        a.title,
        a.description,
        a.ipfs_url,
        a.ipfs_cid,
        a.thumbnail_ipfs_url,
        a.story_ip_id,
        a.price_wei,
        a.currency,
        a.file_type,
        a.file_size,
        p.amount_wei,
        p.block_number,
        p.verified,
        l.license_token_id,
        l.story_license_id,
        l.minted_at as license_minted_at
      FROM user_purchases up
      JOIN assets a ON up.asset_id = a.id
      LEFT JOIN payments p ON up.transaction_hash = p.transaction_hash
      LEFT JOIN licenses l ON up.asset_id = l.asset_id AND up.user_address = l.buyer_address
      WHERE up.user_address = $1
      ORDER BY up.purchased_at DESC`,
      [wallet.toLowerCase()]
    );

    // Format response
    const licenses = purchases.map((purchase: any) => ({
      purchaseId: purchase.purchase_id,
      asset: {
        id: purchase.asset_id,
        title: purchase.title,
        description: purchase.description,
        ipfsUrl: purchase.ipfs_url,
        ipfsCid: purchase.ipfs_cid,
        thumbnailUrl: purchase.thumbnail_ipfs_url,
        storyIPId: purchase.story_ip_id,
        priceWei: purchase.price_wei,
        currency: purchase.currency,
        fileType: purchase.file_type,
        fileSize: purchase.file_size,
      },
      license: {
        type: purchase.license_type || 'personal',
        tokenId: purchase.license_token_id,
        storyLicenseId: purchase.story_license_id,
        mintedAt: purchase.license_minted_at,
      },
      transaction: {
        hash: purchase.transaction_hash,
        blockNumber: purchase.block_number,
        amountWei: purchase.amount_wei,
        verified: purchase.verified,
      },
      purchasedAt: purchase.purchased_at,
      accessToken: purchase.access_token, // For download validation
    }));

    res.json({ licenses });
  } catch (error) {
    console.error('Get user licenses error:', error);
    res.status(500).json({
      error: 'Failed to get licenses',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/user/download/:assetId - Simplified download endpoint for hackathon
// Just validates JWT token and returns IPFS URL for direct download
router.get('/download/:assetId', async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Validate JWT token - if valid, user has purchased
    const decoded = verifyJwt(token);
    if (!decoded || decoded.assetId !== assetId) {
      return res.status(401).json({ error: 'Invalid or expired access token' });
    }

    // Get asset and return full-quality IPFS URL
    const asset = await queryOne(
      'SELECT * FROM assets WHERE id = $1',
      [assetId]
    );

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Return download info - frontend will download directly from IPFS
    res.json({
      downloadUrl: asset.ipfs_url, // Full quality, no watermark
      ipfsCid: asset.ipfs_cid,
      fileName: `${asset.title || 'asset'}.${asset.file_type?.split('/')[1] || 'jpg'}`,
      fileType: asset.file_type,
      fileSize: asset.file_size,
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      error: 'Download failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

