import express, { Request, Response } from 'express';
import { query, queryOne, transaction } from '../db';
import { verifyERC20Transfer } from '../services/ethereum';
import { signJwt } from '../utils/jwt';
import { config } from '../config';
import { storyProtocolService } from '../services/story-protocol';
import { createPaymentChallenge } from '../utils/payment-challenge';
import { ethers } from 'ethers';

const router = express.Router();

interface PaymentVerificationRequest {
  transactionHash: string;
  paymentRequestToken: string;
  assetId: string;
  unlockLayerId?: string;
  challenge?: {
    expiresAt?: number;
  };
}

interface AssetRow {
  id: string;
  price_wei: string;
  currency: string;
  recipient_address: string;
  story_ip_id?: string;
}

interface UnlockLayerRow {
  id: string;
  price_wei: string;
  asset_id: string;
  unlock_type: string;
}

interface PaymentChallengeRequest {
  assetId: string;
  unlockLayerId?: string;
}

// POST /api/payment/challenge - Create payment challenge
router.post('/challenge', async (req: Request, res: Response) => {
  try {
    const { assetId, unlockLayerId } = req.body as PaymentChallengeRequest;

    if (!assetId) {
      return res.status(400).json({ error: 'assetId is required' });
    }

    // Get asset
    const asset = await queryOne<AssetRow>(
      'SELECT * FROM assets WHERE id = $1',
      [assetId]
    );

    if (!asset) {
      return res.status(404).json({ error: 'asset_not_found' });
    }

    // Determine amount and recipient
    let amountWei: bigint;
    let recipient: string;

    if (unlockLayerId) {
      const layer = await queryOne<UnlockLayerRow>(
        'SELECT * FROM unlock_layers WHERE id = $1 AND asset_id = $2',
        [unlockLayerId, assetId]
      );

      if (!layer) {
        return res.status(404).json({ error: 'unlock_layer_not_found' });
      }

      amountWei = BigInt(layer.price_wei);
    } else {
      amountWei = BigInt(asset.price_wei);
    }

    recipient = asset.recipient_address;

    // Create payment challenge
    const challenge = createPaymentChallenge(
      assetId,
      amountWei,
      6, // USDC decimals
      'USDC',
      config.ethereum.usdcTokenAddress,
      recipient,
      config.ethereum.network === 'sepolia' ? 'base-sepolia' : 'base',
      300, // 5 minutes expiration
      unlockLayerId
    );

    // Generate paymentId (keccak256 hash of challenge data)
    const challengeData = ethers.solidityPackedKeccak256(
      ['string', 'string', 'uint256', 'address', 'address', 'uint256'],
      [
        challenge.assetId,
        challenge.paymentRequestToken,
        challenge.amount,
        challenge.tokenAddress,
        challenge.recipient,
        challenge.expiresAt.toString(),
      ]
    );

    // Store challenge in database
    await query(
      `INSERT INTO payment_challenges (
        payment_id, asset_id, unlock_layer_id, amount_wei, token_address,
        recipient, expires_at, payment_request_token
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (payment_id) DO NOTHING`,
      [
        challengeData,
        assetId,
        unlockLayerId || null,
        amountWei.toString(),
        challenge.tokenAddress,
        challenge.recipient,
        new Date(challenge.expiresAt * 1000),
        challenge.paymentRequestToken,
      ]
    );

    // Return X402-compatible response
    res.json({
      paymentId: challengeData,
      token: challenge.tokenAddress,
      amount: challenge.amount,
      recipient: challenge.recipient,
      chain: challenge.network,
      expiresAt: challenge.expiresAt,
      paymentRequestToken: challenge.paymentRequestToken,
      assetId: challenge.assetId,
    });
  } catch (error) {
    console.error('Payment challenge creation error:', error);
    res.status(500).json({
      error: 'server_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/payment/verify - Verify payment and issue access token
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const {
      transactionHash,
      paymentRequestToken,
      assetId,
      unlockLayerId,
      challenge,
    } = req.body as PaymentVerificationRequest;

    if (!transactionHash || !paymentRequestToken || !assetId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate challenge expiration if provided
    if (challenge?.expiresAt) {
      const now = Math.floor(Date.now() / 1000);
      if (challenge.expiresAt < now) {
        return res.status(400).json({
          error: 'challenge_expired',
          expiresAt: challenge.expiresAt,
        });
      }
    }

    // Check if payment already processed
    const existingPayment = await queryOne(
      'SELECT * FROM payments WHERE transaction_hash = $1',
      [transactionHash]
    );

    if (existingPayment) {
      // Payment already verified, return access token
      const accessToken = signJwt({ assetId, unlockLayerId });
      return res.json({ accessToken });
    }

    // Get asset
    const asset = await queryOne<AssetRow>(
      'SELECT * FROM assets WHERE id = $1',
      [assetId]
    );

    if (!asset) {
      return res.status(404).json({ error: 'asset_not_found' });
    }

    // Determine expected amount and recipient
    let expectedAmount: bigint;
    let expectedRecipient: string;

    if (unlockLayerId) {
      // Verify unlock layer payment
      const layer = await queryOne<UnlockLayerRow>(
        'SELECT * FROM unlock_layers WHERE id = $1 AND asset_id = $2',
        [unlockLayerId, assetId]
      );

      if (!layer) {
        return res.status(404).json({ error: 'unlock_layer_not_found' });
      }

      expectedAmount = BigInt(layer.price_wei);
      expectedRecipient = asset.recipient_address;
    } else {
      // Verify base asset payment
      expectedAmount = BigInt(asset.price_wei);
      expectedRecipient = asset.recipient_address;
    }

    // Verify transaction on Ethereum
    const verification = await verifyERC20Transfer(
      transactionHash,
      expectedRecipient,
      expectedAmount,
      config.ethereum.usdcTokenAddress
    );

    if (!verification.valid) {
      return res.status(400).json({
        error: 'invalid_tx',
        message: verification.error,
      });
    }

    // Get transaction receipt for block number
    const { getProvider } = await import('../services/ethereum');
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(transactionHash);
    const blockNumber = receipt?.blockNumber || null;

    // Save payment record
    await transaction(async (client) => {
      // Insert payment
      const paymentResult = await client.query(
        `INSERT INTO payments (
          asset_id, payer_address, amount_wei, transaction_hash, block_number,
          unlock_layer_id, payment_request_token, verified, verified_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          assetId,
          verification.from,
          expectedAmount.toString(),
          transactionHash,
          blockNumber,
          unlockLayerId || null,
          paymentRequestToken,
          true,
          new Date(),
        ]
      );

      const paymentId = paymentResult.rows[0].id;

      // If this is a commercial license unlock, mint Story Protocol license
      if (unlockLayerId) {
        const layer = await queryOne<UnlockLayerRow>(
          'SELECT * FROM unlock_layers WHERE id = $1',
          [unlockLayerId]
        );

        if (layer?.unlock_type === 'commercial' && asset.story_ip_id) {
          try {
            const license = await storyProtocolService.mintLicense({
              ipId: asset.story_ip_id,
              licensee: verification.from!,
              licenseType: 'commercial',
            });

            // Save license record
            await client.query(
              `INSERT INTO licenses (
                asset_id, buyer_address, license_token_id, license_type,
                story_license_id, payment_id, minted_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                assetId,
                verification.from,
                license.tokenId,
                'commercial',
                license.licenseId,
                paymentId,
                new Date(),
              ]
            );
          } catch (licenseError) {
            console.error('License minting failed:', licenseError);
            // Continue without license - payment is still valid
          }
        }
      } else if (asset.story_ip_id) {
        // Base payment - mint personal license
        try {
          const license = await storyProtocolService.mintLicense({
            ipId: asset.story_ip_id,
            licensee: verification.from!,
            licenseType: 'personal',
          });

          await client.query(
            `INSERT INTO licenses (
              asset_id, buyer_address, license_token_id, license_type,
              story_license_id, payment_id, minted_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              assetId,
              verification.from,
              license.tokenId,
              'personal',
              license.licenseId,
              paymentId,
              new Date(),
            ]
          );
        } catch (licenseError) {
          console.error('License minting failed:', licenseError);
        }
      }
    });

    // Generate access token
    const accessToken = signJwt({ assetId, unlockLayerId }, '1h');

    // Save to user_purchases table
    await query(
      `INSERT INTO user_purchases (
        user_address, asset_id, transaction_hash, payment_id, access_token, license_type
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_address, asset_id, transaction_hash) DO NOTHING`,
      [
        verification.from,
        assetId,
        transactionHash,
        null, // payment_id from challenge (can be linked if needed)
        accessToken,
        unlockLayerId ? 'commercial' : 'personal',
      ]
    );

    res.json({ accessToken });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      error: 'server_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

