import express, { Request, Response } from 'express';
import { query, queryOne, transaction } from '../db';
import { xmtpService } from '../services/xmtp';
import { storyProtocolService } from '../services/story-protocol';
import { parseEther } from '../services/ethereum';
import { config } from '../config';

const router = express.Router();

interface NegotiationRow {
  id: string;
  asset_id: string;
  agent_address: string;
  creator_address: string;
  status: string;
  requested_amount_wei: string;
  requested_license_type: string;
  counter_amount_wei?: string;
  counter_license_type?: string;
  message?: string;
  xmtp_message_id?: string;
  expires_at?: Date;
}

// POST /api/negotiation/create - Create a negotiation intent
router.post('/create', async (req: Request, res: Response) => {
  try {
    const {
      assetId,
      agentAddress,
      agentPrivateKey, // For XMTP signing
      requestedAmount,
      requestedLicenseType,
      message,
      expiresInHours = 24,
    } = req.body;

    if (!assetId || !agentAddress || !requestedAmount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get asset
    const asset = await queryOne(
      'SELECT * FROM assets WHERE id = $1',
      [assetId]
    );

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    const requestedAmountWei = parseEther(requestedAmount.toString(), 6); // USDC has 6 decimals

    // Send XMTP message to creator if agent private key provided
    let xmtpMessageId: string | undefined;
    if (agentPrivateKey && asset.creator_address) {
      try {
        xmtpMessageId = await xmtpService.sendNegotiationIntent(
          agentPrivateKey,
          asset.creator_address,
          {
            assetId,
            requestedAmount: requestedAmount.toString(),
            requestedLicenseType: requestedLicenseType || 'commercial',
            message: message || '',
          }
        );
      } catch (xmtpError) {
        console.error('XMTP message failed:', xmtpError);
        // Continue without XMTP - negotiation can still be created
      }
    }

    // Create negotiation
    const result = await queryOne<NegotiationRow>(
      `INSERT INTO negotiations (
        asset_id, agent_address, creator_address, status,
        requested_amount_wei, requested_license_type, message,
        xmtp_message_id, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        assetId,
        agentAddress,
        asset.creator_address,
        'pending',
        requestedAmountWei.toString(),
        requestedLicenseType || 'commercial',
        message || null,
        xmtpMessageId || null,
        expiresAt,
      ]
    );

    res.json({ negotiation: result });
  } catch (error) {
    console.error('Create negotiation error:', error);
    res.status(500).json({
      error: 'Failed to create negotiation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/negotiation/:id/respond - Respond to a negotiation (accept/counter/reject)
router.post('/:id/respond', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      creatorPrivateKey, // For XMTP signing
      status, // 'accepted', 'countered', 'rejected'
      counterAmount,
      counterLicenseType,
      message,
    } = req.body;

    if (!status || !['accepted', 'countered', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get negotiation
    const negotiation = await queryOne<NegotiationRow>(
      'SELECT * FROM negotiations WHERE id = $1',
      [id]
    );

    if (!negotiation) {
      return res.status(404).json({ error: 'Negotiation not found' });
    }

    if (negotiation.status !== 'pending') {
      return res.status(400).json({ error: 'Negotiation already processed' });
    }

    // Send XMTP response if creator private key provided
    if (creatorPrivateKey) {
      try {
        await xmtpService.sendNegotiationResponse(creatorPrivateKey, negotiation.agent_address, {
          negotiationId: id,
          status,
          counterAmount: counterAmount?.toString(),
          counterLicenseType,
          message,
        });
      } catch (xmtpError) {
        console.error('XMTP response failed:', xmtpError);
      }
    }

    // Update negotiation
    const updateData: any = {
      status,
      updated_at: new Date(),
    };

    if (status === 'accepted') {
      updateData.accepted_at = new Date();
    } else if (status === 'countered') {
      if (!counterAmount) {
        return res.status(400).json({ error: 'Counter amount required' });
      }
      updateData.counter_amount_wei = parseEther(counterAmount.toString(), 6).toString();
      updateData.counter_license_type = counterLicenseType || negotiation.requested_license_type;
    }

    if (message) {
      updateData.message = message;
    }

    const updateFields = Object.keys(updateData)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const result = await queryOne<NegotiationRow>(
      `UPDATE negotiations SET ${updateFields} WHERE id = $1 RETURNING *`,
      [id, ...Object.values(updateData)]
    );

    // If accepted, create payment challenge and optionally mint license
    if (status === 'accepted') {
      const finalAmount = counterAmount
        ? parseEther(counterAmount.toString(), 6)
        : BigInt(negotiation.requested_amount_wei);

      // The agent can now make payment using this amount
      // License will be minted after payment verification
    }

    res.json({ negotiation: result });
  } catch (error) {
    console.error('Respond to negotiation error:', error);
    res.status(500).json({
      error: 'Failed to respond to negotiation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/negotiation/:id - Get negotiation details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const negotiation = await queryOne<NegotiationRow>(
      'SELECT * FROM negotiations WHERE id = $1',
      [id]
    );

    if (!negotiation) {
      return res.status(404).json({ error: 'Negotiation not found' });
    }

    res.json({ negotiation });
  } catch (error) {
    console.error('Get negotiation error:', error);
    res.status(500).json({ error: 'Failed to get negotiation' });
  }
});

// GET /api/negotiation/asset/:assetId - Get all negotiations for an asset
router.get('/asset/:assetId', async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;

    const negotiations = await query<NegotiationRow>(
      'SELECT * FROM negotiations WHERE asset_id = $1 ORDER BY created_at DESC',
      [assetId]
    );

    res.json({ negotiations });
  } catch (error) {
    console.error('Get negotiations error:', error);
    res.status(500).json({ error: 'Failed to get negotiations' });
  }
});

export default router;

