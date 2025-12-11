import express, { Request, Response } from 'express';
import { query, queryOne } from '../db';

const router = express.Router();

// GET /api/provider/:address/assets - Get all assets by provider
router.get('/:address/assets', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const assets = await query(
      'SELECT * FROM assets WHERE creator_address = $1 OR recipient_address = $1 ORDER BY created_at DESC',
      [address]
    );

    res.json({ assets });
  } catch (error) {
    console.error('Get provider assets error:', error);
    res.status(500).json({ error: 'Failed to get assets' });
  }
});

// GET /api/provider/:address/earnings - Get earnings summary
router.get('/:address/earnings', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const earnings = await query(
      `SELECT 
        COUNT(*) as total_payments,
        SUM(amount_wei) as total_earnings_wei,
        COUNT(DISTINCT asset_id) as unique_assets_sold
       FROM payments p
       JOIN assets a ON p.asset_id = a.id
       WHERE a.recipient_address = $1 AND p.verified = true`,
      [address]
    );

    const earningsByAsset = await query(
      `SELECT 
        a.id,
        a.title,
        COUNT(p.id) as payment_count,
        SUM(p.amount_wei) as total_earnings_wei
       FROM assets a
       LEFT JOIN payments p ON a.id = p.asset_id AND p.verified = true
       WHERE a.recipient_address = $1
       GROUP BY a.id, a.title
       ORDER BY total_earnings_wei DESC NULLS LAST`,
      [address]
    );

    res.json({
      summary: earnings[0] || {
        total_payments: 0,
        total_earnings_wei: '0',
        unique_assets_sold: 0,
      },
      byAsset: earningsByAsset,
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ error: 'Failed to get earnings' });
  }
});

// GET /api/provider/:address/stats - Get provider statistics
router.get('/:address/stats', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const stats = await queryOne(
      `SELECT 
        (SELECT COUNT(*) FROM assets WHERE creator_address = $1) as total_assets,
        (SELECT COUNT(*) FROM payments p JOIN assets a ON p.asset_id = a.id WHERE a.recipient_address = $1 AND p.verified = true) as total_sales,
        (SELECT SUM(amount_wei) FROM payments p JOIN assets a ON p.asset_id = a.id WHERE a.recipient_address = $1 AND p.verified = true) as total_revenue_wei,
        (SELECT COUNT(*) FROM licenses l JOIN assets a ON l.asset_id = a.id WHERE a.creator_address = $1) as licenses_minted,
        (SELECT COUNT(*) FROM derived_works dw JOIN assets a ON dw.parent_asset_id = a.id WHERE a.creator_address = $1) as derivatives_created`,
      [address]
    );

    res.json({ stats });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/provider/:address/transactions - Get transaction history (payments received)
router.get('/:address/transactions', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const transactions = await query(
      `SELECT 
        p.id,
        p.transaction_hash,
        p.amount_wei,
        p.block_number,
        p.verified,
        p.verified_at,
        p.created_at,
        a.id as asset_id,
        a.title as asset_title,
        a.thumbnail_ipfs_url,
        a.story_ip_id,
        p.payer_address,
        l.license_type,
        l.story_license_id
      FROM payments p
      JOIN assets a ON p.asset_id = a.id
      LEFT JOIN licenses l ON p.id = l.payment_id
      WHERE a.recipient_address = $1 AND p.verified = true
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3`,
      [address, limit, offset]
    );

    const totalResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM payments p
       JOIN assets a ON p.asset_id = a.id
       WHERE a.recipient_address = $1 AND p.verified = true`,
      [address]
    );

    res.json({
      transactions: transactions.map((tx: any) => ({
        id: tx.id,
        transactionHash: tx.transaction_hash,
        amountWei: tx.amount_wei.toString(),
        amount: (Number(tx.amount_wei) / 1e6).toFixed(6), // USDC has 6 decimals
        blockNumber: tx.block_number,
        verified: tx.verified,
        verifiedAt: tx.verified_at,
        createdAt: tx.created_at,
        asset: {
          id: tx.asset_id,
          title: tx.asset_title,
          thumbnailUrl: tx.thumbnail_ipfs_url,
          storyIPId: tx.story_ip_id,
        },
        buyer: {
          address: tx.payer_address,
        },
        license: {
          type: tx.license_type,
          storyLicenseId: tx.story_license_id,
        },
      })),
      total: parseInt(totalResult?.count || '0', 10),
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

export default router;

