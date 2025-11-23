import express, { Request, Response } from 'express';
import { query, queryOne } from '../db';
import { xmtpService } from '../services/xmtp';

const router = express.Router();

// POST /api/agent/create - Create or update agent profile
router.post('/create', async (req: Request, res: Response) => {
  try {
    const {
      agentAddress,
      xmtpAddress,
      agentName,
      agentType, // 'buyer', 'seller', 'both'
    } = req.body;

    if (!agentAddress) {
      return res.status(400).json({ error: 'Agent address required' });
    }

    // Upsert agent profile
    const result = await queryOne(
      `INSERT INTO agent_profiles (
        agent_address, xmtp_address, agent_name, agent_type
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (agent_address)
      DO UPDATE SET
        xmtp_address = COALESCE(EXCLUDED.xmtp_address, agent_profiles.xmtp_address),
        agent_name = COALESCE(EXCLUDED.agent_name, agent_profiles.agent_name),
        agent_type = COALESCE(EXCLUDED.agent_type, agent_profiles.agent_type),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [agentAddress, xmtpAddress || null, agentName || null, agentType || 'both']
    );

    res.json({ agent: result });
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({
      error: 'Failed to create agent',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/agent/:address - Get agent profile
router.get('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const agent = await queryOne(
      'SELECT * FROM agent_profiles WHERE agent_address = $1',
      [address]
    );

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({ agent });
  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

// GET /api/agent/:address/transactions - Get agent transactions
router.get('/:address/transactions', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const transactions = await query(
      `SELECT at.*, a.title, a.ipfs_url
       FROM agent_transactions at
       JOIN assets a ON at.asset_id = a.id
       WHERE at.buyer_agent_address = $1 OR at.seller_agent_address = $1
       ORDER BY at.created_at DESC
       LIMIT 100`,
      [address]
    );

    res.json({ transactions });
  } catch (error) {
    console.error('Get agent transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// POST /api/agent/discover - Agent discovers assets by tags
router.post('/discover', async (req: Request, res: Response) => {
  try {
    const { tags, minPrice, maxPrice, limit = 50 } = req.body;

    let queryText = 'SELECT * FROM assets WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (tags && Array.isArray(tags) && tags.length > 0) {
      queryText += ` AND tags && $${paramIndex}`;
      params.push(tags);
      paramIndex++;
    }

    if (minPrice !== undefined) {
      queryText += ` AND price_wei >= $${paramIndex}`;
      params.push(minPrice.toString());
      paramIndex++;
    }

    if (maxPrice !== undefined) {
      queryText += ` AND price_wei <= $${paramIndex}`;
      params.push(maxPrice.toString());
      paramIndex++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const assets = await query(queryText, params);

    res.json({ assets });
  } catch (error) {
    console.error('Discover assets error:', error);
    res.status(500).json({ error: 'Failed to discover assets' });
  }
});

export default router;

