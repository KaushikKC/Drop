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

export default router;

