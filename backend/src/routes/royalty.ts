import express, { Request, Response } from "express";
import { query, queryOne } from "../db";
import { storyProtocolService } from "../services/story-protocol";
import { parseEther } from "../services/ethereum";
import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const router = express.Router();

interface RoyaltyTokenRow {
  id: string;
  asset_id: string;
  ip_id: string;
  token_address: string;
  token_symbol: string;
  token_name: string;
  total_supply: string;
  creator_address: string;
  transaction_hash: string;
  created_at: Date;
}

interface RoyaltyHoldingRow {
  id: string;
  token_id: string;
  holder_address: string;
  balance: string;
  percentage: number;
  acquired_at?: Date | string;
}

// POST /api/royalty/create/:assetId - Create royalty token for an asset
router.post("/create/:assetId", async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;

    // Get asset
    const asset = await queryOne<{
      id: string;
      title: string;
      story_ip_id: string;
      creator_address: string;
    }>(
      "SELECT id, title, story_ip_id, creator_address FROM assets WHERE id = $1",
      [assetId]
    );

    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    if (!asset.story_ip_id) {
      return res.status(400).json({
        error: "Asset must be registered on Story Protocol first",
        message:
          "Register the asset on Story Protocol before creating royalty token",
      });
    }

    // Check if royalty token already exists
    const existing = await queryOne<RoyaltyTokenRow>(
      "SELECT * FROM royalty_tokens WHERE asset_id = $1",
      [assetId]
    );

    if (existing) {
      return res.json({
        tokenAddress: existing.token_address,
        tokenSymbol: existing.token_symbol,
        tokenName: existing.token_name,
        totalSupply: existing.total_supply,
        ipId: existing.ip_id,
        message: "Royalty token already exists",
        alreadyExists: true,
      });
    }

    // Create royalty token
    const royaltyToken = await storyProtocolService.createRoyaltyToken({
      ipId: asset.story_ip_id,
      assetName: asset.title,
      creatorAddress: asset.creator_address,
      totalSupply: parseEther("1000000"), // 1M tokens
    });

    // Store in database
    const result = await query(
      `INSERT INTO royalty_tokens (
        asset_id, ip_id, token_address, token_symbol, token_name,
        total_supply, creator_address, transaction_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        assetId,
        asset.story_ip_id,
        royaltyToken.tokenAddress,
        royaltyToken.tokenSymbol,
        royaltyToken.tokenName,
        royaltyToken.totalSupply.toString(),
        asset.creator_address,
        royaltyToken.txHash,
      ]
    );

    // Create initial holding for creator (100% ownership)
    await query(
      `INSERT INTO royalty_token_holdings (
        token_id, holder_address, balance, percentage
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (token_id, holder_address) DO UPDATE
      SET balance = EXCLUDED.balance, percentage = EXCLUDED.percentage`,
      [
        result[0].id,
        asset.creator_address.toLowerCase(),
        royaltyToken.totalSupply.toString(),
        100.0, // Creator owns 100% initially
      ]
    );

    logger.info("Royalty token created", {
      assetId,
      ipId: asset.story_ip_id,
      tokenAddress: royaltyToken.tokenAddress,
    });

    res.json({
      tokenAddress: royaltyToken.tokenAddress,
      tokenSymbol: royaltyToken.tokenSymbol,
      tokenName: royaltyToken.tokenName,
      totalSupply: royaltyToken.totalSupply.toString(),
      ipId: asset.story_ip_id,
      assetId,
      txHash: royaltyToken.txHash,
    });
  } catch (error: any) {
    logger.error("Royalty token creation error:", error);
    res.status(500).json({
      error: "Failed to create royalty token",
      message: error.message || "Unknown error",
    });
  }
});

// GET /api/royalty/:assetId - Get royalty token info for an asset
router.get("/:assetId", async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;

    const token = await queryOne<RoyaltyTokenRow>(
      `SELECT rt.*, a.title as asset_title
       FROM royalty_tokens rt
       JOIN assets a ON rt.asset_id = a.id
       WHERE rt.asset_id = $1`,
      [assetId]
    );

    if (!token) {
      return res
        .status(404)
        .json({ error: "Royalty token not found for this asset" });
    }

    // Get total holdings count
    const holdingsCount = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM royalty_token_holdings WHERE token_id = $1",
      [token.id]
    );

    // Get total revenue
    const revenueResult = await queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(amount_wei), 0) as total
       FROM royalty_distributions
       WHERE token_id = $1`,
      [token.id]
    );

    res.json({
      id: token.id,
      assetId: token.asset_id,
      assetTitle: (token as any).asset_title,
      ipId: token.ip_id,
      tokenAddress: token.token_address,
      tokenSymbol: token.token_symbol,
      tokenName: token.token_name,
      totalSupply: token.total_supply,
      creatorAddress: token.creator_address,
      transactionHash: token.transaction_hash,
      createdAt: token.created_at,
      holdersCount: parseInt(holdingsCount?.count || "0"),
      totalRevenue: revenueResult?.total || "0",
    });
  } catch (error: any) {
    logger.error("Get royalty token error:", error);
    res.status(500).json({
      error: "Failed to get royalty token",
      message: error.message || "Unknown error",
    });
  }
});

// GET /api/royalty/:assetId/holdings - Get token holders and balances
router.get("/:assetId/holdings", async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;

    const token = await queryOne<RoyaltyTokenRow>(
      "SELECT id FROM royalty_tokens WHERE asset_id = $1",
      [assetId]
    );

    if (!token) {
      return res.status(404).json({ error: "Royalty token not found" });
    }

    const holdings = await query<RoyaltyHoldingRow>(
      `SELECT holder_address, balance, percentage, acquired_at
       FROM royalty_token_holdings
       WHERE token_id = $1
       ORDER BY balance DESC`,
      [token.id]
    );

    res.json({
      tokenId: token.id,
      assetId,
      holdings: holdings.map((h) => ({
        holderAddress: h.holder_address,
        balance: h.balance,
        percentage: parseFloat(h.percentage.toString()),
        acquiredAt: h.acquired_at,
      })),
      totalHolders: holdings.length,
    });
  } catch (error: any) {
    logger.error("Get holdings error:", error);
    res.status(500).json({
      error: "Failed to get holdings",
      message: error.message || "Unknown error",
    });
  }
});

// GET /api/royalty/:assetId/revenue - Get royalty revenue history
router.get("/:assetId/revenue", async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const token = await queryOne<RoyaltyTokenRow>(
      "SELECT id FROM royalty_tokens WHERE asset_id = $1",
      [assetId]
    );

    if (!token) {
      return res.status(404).json({ error: "Royalty token not found" });
    }

    const distributions = await query(
      `SELECT 
        rd.id,
        rd.amount_wei,
        rd.currency,
        rd.source_ip_id,
        rd.source_asset_id,
        rd.distribution_tx_hash,
        rd.distributed_at,
        a.title as source_asset_title
       FROM royalty_distributions rd
       LEFT JOIN assets a ON rd.source_asset_id = a.id
       WHERE rd.token_id = $1
       ORDER BY rd.distributed_at DESC
       LIMIT $2 OFFSET $3`,
      [token.id, limit, offset]
    );

    const totalResult = await queryOne<{ total: string; count: string }>(
      `SELECT 
        COALESCE(SUM(amount_wei), 0) as total,
        COUNT(*) as count
       FROM royalty_distributions
       WHERE token_id = $1`,
      [token.id]
    );

    res.json({
      tokenId: token.id,
      assetId,
      totalRevenue: totalResult?.total || "0",
      totalDistributions: parseInt(totalResult?.count || "0"),
      distributions: distributions.map((d) => ({
        id: d.id,
        amount: d.amount_wei,
        currency: d.currency,
        sourceIPId: d.source_ip_id,
        sourceAssetId: d.source_asset_id,
        sourceAssetTitle: d.source_asset_title,
        transactionHash: d.distribution_tx_hash,
        distributedAt: d.distributed_at,
      })),
      pagination: {
        limit,
        offset,
        total: parseInt(totalResult?.count || "0"),
      },
    });
  } catch (error: any) {
    logger.error("Get revenue error:", error);
    res.status(500).json({
      error: "Failed to get revenue",
      message: error.message || "Unknown error",
    });
  }
});

// POST /api/royalty/:assetId/transfer - Transfer royalty tokens (fractional ownership)
router.post("/:assetId/transfer", async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const { from, to, amount } = req.body;

    if (!from || !to || !amount) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["from", "to", "amount"],
      });
    }

    const token = await queryOne<RoyaltyTokenRow>(
      "SELECT * FROM royalty_tokens WHERE asset_id = $1",
      [assetId]
    );

    if (!token) {
      return res.status(404).json({ error: "Royalty token not found" });
    }

    // Get sender's current balance
    const senderHolding = await queryOne<RoyaltyHoldingRow>(
      "SELECT * FROM royalty_token_holdings WHERE token_id = $1 AND holder_address = $2",
      [token.id, from.toLowerCase()]
    );

    if (!senderHolding) {
      return res.status(404).json({ error: "Sender has no tokens" });
    }

    const transferAmount = BigInt(amount);
    const senderBalance = BigInt(senderHolding.balance);

    if (transferAmount > senderBalance) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Calculate new percentages
    const totalSupply = BigInt(token.total_supply);
    const senderNewBalance = senderBalance - transferAmount;
    const recipientNewBalance = transferAmount;

    const senderNewPercentage =
      (Number(senderNewBalance) / Number(totalSupply)) * 100;
    const recipientNewPercentage =
      (Number(recipientNewBalance) / Number(totalSupply)) * 100;

    // Transfer tokens on-chain (if using actual token contracts)
    const transferResult = await storyProtocolService.transferRoyaltyTokens({
      tokenAddress: token.token_address,
      to: to.toLowerCase(),
      amount: transferAmount,
    });

    // Update database
    await query("BEGIN");

    try {
      // Update sender
      await query(
        `UPDATE royalty_token_holdings
         SET balance = $1, percentage = $2, updated_at = CURRENT_TIMESTAMP
         WHERE token_id = $3 AND holder_address = $4`,
        [
          senderNewBalance.toString(),
          senderNewPercentage,
          token.id,
          from.toLowerCase(),
        ]
      );

      // Update or create recipient
      await query(
        `INSERT INTO royalty_token_holdings (token_id, holder_address, balance, percentage)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (token_id, holder_address) DO UPDATE
         SET balance = royalty_token_holdings.balance + $3,
             percentage = (royalty_token_holdings.balance + $3)::DECIMAL / (SELECT total_supply FROM royalty_tokens WHERE id = $1)::DECIMAL * 100,
             updated_at = CURRENT_TIMESTAMP`,
        [
          token.id,
          to.toLowerCase(),
          recipientNewBalance.toString(),
          recipientNewPercentage,
        ]
      );

      await query("COMMIT");
    } catch (dbError) {
      await query("ROLLBACK");
      throw dbError;
    }

    logger.info("Royalty tokens transferred", {
      assetId,
      from,
      to,
      amount: amount.toString(),
      txHash: transferResult.txHash,
    });

    res.json({
      success: true,
      from,
      to,
      amount: amount.toString(),
      transactionHash: transferResult.txHash,
      senderNewBalance: senderNewBalance.toString(),
      recipientNewBalance: recipientNewBalance.toString(),
    });
  } catch (error: any) {
    logger.error("Transfer error:", error);
    res.status(500).json({
      error: "Failed to transfer tokens",
      message: error.message || "Unknown error",
    });
  }
});

// GET /api/royalty/:assetId/distributions - Get distribution history with recipients
router.get("/:assetId/distributions", async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const token = await queryOne<RoyaltyTokenRow>(
      "SELECT id FROM royalty_tokens WHERE asset_id = $1",
      [assetId]
    );

    if (!token) {
      return res.status(404).json({ error: "Royalty token not found" });
    }

    const distributions = await query(
      `SELECT 
        rd.id,
        rd.amount_wei,
        rd.currency,
        rd.source_ip_id,
        rd.distribution_tx_hash,
        rd.distributed_at,
        COALESCE(
          json_agg(
            json_build_object(
              'recipient', rdr.recipient_address,
              'amount', rdr.amount_wei,
              'percentage', rdr.percentage
            )
          ) FILTER (WHERE rdr.id IS NOT NULL),
          '[]'::json
        ) as recipients
       FROM royalty_distributions rd
       LEFT JOIN royalty_distribution_recipients rdr ON rd.id = rdr.distribution_id
       WHERE rd.token_id = $1
       GROUP BY rd.id
       ORDER BY rd.distributed_at DESC
       LIMIT $2`,
      [token.id, limit]
    );

    res.json({
      distributions: distributions.map((d) => ({
        id: d.id,
        amount: d.amount_wei,
        currency: d.currency,
        sourceIPId: d.source_ip_id,
        transactionHash: d.distribution_tx_hash,
        distributedAt: d.distributed_at,
        recipients: d.recipients || [],
      })),
    });
  } catch (error: any) {
    logger.error("Get distributions error:", error);
    res.status(500).json({
      error: "Failed to get distributions",
      message: error.message || "Unknown error",
    });
  }
});

export default router;
