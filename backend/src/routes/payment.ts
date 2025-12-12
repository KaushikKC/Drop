import express, { Request, Response } from 'express';
import { query, queryOne, transaction } from '../db';
import { verifyERC20Transfer } from '../services/ethereum';
import { signJwt } from '../utils/jwt';
import { config } from '../config';
import { storyProtocolService } from '../services/story-protocol';
import { createPaymentChallenge } from '../utils/payment-challenge';
import { ethers } from 'ethers';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const router = express.Router();

interface PaymentVerificationRequest {
  transactionHash: string;
  platformTransactionHash?: string; // Platform fee transaction hash
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

    // Calculate platform fee (5%)
    const platformFeePercentage = config.platform.feePercentage || 5;
    const platformFeeWei = (amountWei * BigInt(Math.floor(platformFeePercentage * 100))) / BigInt(10000); // 5% = 500/10000
    const creatorAmountWei = amountWei - platformFeeWei;
    const platformWallet = config.platform.walletAddress;

    if (!platformWallet) {
      logger.warn('Platform wallet address not configured - platform fees will not be collected');
    }

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

    // Return X402-compatible response with platform fee information
    res.json({
      paymentId: challengeData,
      token: challenge.tokenAddress,
      amount: challenge.amount,
      recipient: challenge.recipient,
      chain: challenge.network,
      expiresAt: challenge.expiresAt,
      paymentRequestToken: challenge.paymentRequestToken,
      assetId: challenge.assetId,
      // Platform fee information
      platformFee: {
        percentage: platformFeePercentage,
        amount: platformFeeWei.toString(),
        walletAddress: platformWallet,
      },
      creatorAmount: creatorAmountWei.toString(), // Amount creator will receive (95%)
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
      platformTransactionHash,
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

    // Check if payment already processed (prevent duplicate verification)
    const existingPayment = await queryOne(
      'SELECT * FROM payments WHERE transaction_hash = $1',
      [transactionHash]
    );

    if (existingPayment) {
      // Payment already verified, return long-lived access token
      const accessToken = signJwt({ assetId, unlockLayerId }, '10y');
      return res.json({ 
        accessToken,
        message: 'Payment already verified - license is permanent',
      });
    }

    // Get asset
    const asset = await queryOne<AssetRow>(
      'SELECT * FROM assets WHERE id = $1',
      [assetId]
    );

    if (!asset) {
      return res.status(404).json({ error: 'asset_not_found' });
    }

    // Note: We'll check for existing purchase after we verify the transaction
    // to get the buyer's address (verification.from)

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

    // Calculate platform fee (5%)
    const platformFeePercentage = config.platform.feePercentage || 5;
    const platformFeeWei = (expectedAmount * BigInt(Math.floor(platformFeePercentage * 100))) / BigInt(10000); // 5% = 500/10000
    const creatorAmountWei = expectedAmount - platformFeeWei;
    const platformWallet = config.platform.walletAddress;

    // Verify creator payment transaction on Ethereum
    let verification;
    try {
      verification = await verifyERC20Transfer(
      transactionHash,
      expectedRecipient,
        creatorAmountWei, // Verify creator receives 95%
        config.ethereum.usdcTokenAddress || '0x98dC0e28942A1475FA1923b6415E2783843F68CD'
    );
    } catch (verifyError: any) {
      logger.error('Transaction verification error:', verifyError);
      return res.status(500).json({
        error: 'server_error',
        message: `Failed to verify transaction: ${verifyError.message || 'Unknown error'}`,
      });
    }

    if (!verification.valid) {
      logger.warn('Transaction verification failed:', {
        transactionHash,
        error: verification.error,
        expectedRecipient,
        expectedAmount: expectedAmount.toString(),
      });
      return res.status(400).json({
        error: 'invalid_tx',
        message: verification.error || 'Transaction verification failed',
      });
    }

    // Validate verification result
    if (!verification.from) {
      logger.error('Transaction verification missing from address:', { transactionHash, verification });
      return res.status(400).json({
        error: 'invalid_tx',
        message: 'Transaction verification failed: missing sender address',
      });
    }

    // Get transaction receipt for block number
    let blockNumber: number | null = null;
    try {
    const { getProvider } = await import('../services/ethereum');
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(transactionHash);
      blockNumber = receipt?.blockNumber ? Number(receipt.blockNumber) : null;
    } catch (receiptError: any) {
      logger.warn('Failed to get block number, continuing without it:', receiptError.message);
      // Continue without block number - not critical
    }

    // Verify platform fee payment if platform wallet is configured
    let platformVerification = null;
    let platformBlockNumber: number | null = null;
    if (platformTransactionHash && platformWallet) {
      try {
        platformVerification = await verifyERC20Transfer(
          platformTransactionHash,
          platformWallet,
          platformFeeWei,
          config.ethereum.usdcTokenAddress || '0x98dC0e28942A1475FA1923b6415E2783843F68CD'
        );

        if (!platformVerification.valid) {
          logger.warn('Platform fee verification failed:', {
            transactionHash: platformTransactionHash,
            error: platformVerification.error,
          });
          // Continue - platform fee verification failure doesn't block payment
        } else {
          // Get platform fee transaction block number
          try {
            const { getProvider } = await import('../services/ethereum');
            const provider = getProvider();
            const platformReceipt = await provider.getTransactionReceipt(platformTransactionHash);
            platformBlockNumber = platformReceipt?.blockNumber ? Number(platformReceipt.blockNumber) : null;
          } catch (err) {
            logger.warn('Failed to get platform fee block number:', err);
          }
        }
      } catch (platformError: any) {
        logger.warn('Platform fee verification error:', platformError);
        // Continue - platform fee verification failure doesn't block payment
      }
    }

    // Save payment record
    let savedPaymentId: string | null = null;
    await transaction(async (client) => {
      // Insert payment with platform fee information
      const paymentResult = await client.query(
        `INSERT INTO payments (
          asset_id, payer_address, amount_wei, creator_amount_wei, platform_fee_wei,
          platform_fee_percentage, platform_wallet_address, platform_transaction_hash,
          transaction_hash, block_number, unlock_layer_id, payment_request_token, verified, verified_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id`,
        [
          assetId,
          verification.from,
          expectedAmount.toString(), // Total amount paid
          creatorAmountWei.toString(), // Creator receives 95%
          platformFeeWei.toString(), // Platform fee 5%
          platformFeePercentage,
          platformWallet || null,
          platformTransactionHash || null,
          transactionHash,
          blockNumber,
          unlockLayerId || null,
          paymentRequestToken,
          true,
          new Date(),
        ]
      );

      savedPaymentId = paymentResult.rows[0].id;

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
                savedPaymentId,
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
              savedPaymentId,
              new Date(),
            ]
          );
        } catch (licenseError) {
          console.error('License minting failed:', licenseError);
        }
      }
    });

    // Generate long-lived access token for permanent license (10 years)
    // Once purchased, the license is permanent - no need to buy again
    const accessToken = signJwt({ assetId, unlockLayerId }, '10y');

    // Get license info if minted
    let licenseInfo = null;
    try {
      licenseInfo = await queryOne(
        `SELECT license_token_id, story_license_id, license_type, minted_at
         FROM licenses
         WHERE asset_id = $1 AND buyer_address = $2
         ORDER BY minted_at DESC
         LIMIT 1`,
        [assetId, verification.from!]
      );
    } catch (licenseQueryError: any) {
      logger.warn('Failed to query license info, continuing without it:', licenseQueryError.message);
      // Continue without license info - not critical
    }

    // Save to user_purchases table (for buyer's purchased assets list)
    // This allows the buyer to see their purchased licenses in the dashboard
    try {
      // Note: payment_id in user_purchases references payment_challenges, not payments
      // So we'll leave it null and use transaction_hash to link to payments
      await query(
        `INSERT INTO user_purchases (
          user_address, asset_id, transaction_hash, payment_id, access_token, license_type
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_address, asset_id, transaction_hash) 
        DO UPDATE SET 
          access_token = EXCLUDED.access_token,
          license_type = EXCLUDED.license_type`,
        [
          verification.from!.toLowerCase(), 
          assetId,
          transactionHash,
          null, 
          accessToken,
          unlockLayerId ? 'commercial' : 'personal',
        ]
      );
      logger.info('Purchase record saved successfully', {
        userAddress: verification.from,
        assetId,
        transactionHash,
      });
    } catch (purchaseError: any) {
      logger.error('Failed to save user purchase record:', {
        error: purchaseError.message,
        code: purchaseError.code,
        detail: purchaseError.detail,
        userAddress: verification.from,
        assetId,
        transactionHash,
      });
      // Don't fail the whole request - payment is already verified and saved
      // The download endpoint will create the purchase record as a fallback
    }

    res.json({
      accessToken,
      license: licenseInfo ? {
        tokenId: licenseInfo.license_token_id,
        storyLicenseId: licenseInfo.story_license_id,
        type: licenseInfo.license_type,
        mintedAt: licenseInfo.minted_at,
      } : null,
      transactionHash,
      assetId,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      error: 'server_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

