import express, { Request, Response } from 'express';
import { query, queryOne, transaction } from '../db';
import { storyProtocolService } from '../services/story-protocol';
import { uploadToIPFS } from '../services/ipfs';
import { v4 as uuidv4 } from 'uuid';
import { parseEther } from '../services/ethereum';

const router = express.Router();

// POST /api/derivative/register - Register a derived work
router.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      parentAssetId,
      derivedFile, // Base64 or file buffer
      derivedFileName,
      derivationType, // 'remix', 'edit', 'enhancement', 'composite'
      title,
      description,
      creatorAddress,
      revenueSplitPercentage = 10, // Default 10% to parent
    } = req.body;

    if (!parentAssetId || !derivedFile || !creatorAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get parent asset
    const parentAsset = await queryOne(
      'SELECT * FROM assets WHERE id = $1',
      [parentAssetId]
    );

    if (!parentAsset) {
      return res.status(404).json({ error: 'Parent asset not found' });
    }

    if (!parentAsset.story_ip_id) {
      return res.status(400).json({
        error: 'Parent asset must be registered on Story Protocol',
      });
    }

    // Convert file to buffer if base64
    let fileBuffer: Buffer;
    if (typeof derivedFile === 'string' && derivedFile.startsWith('data:')) {
      // Base64 data URL
      const base64Data = derivedFile.split(',')[1];
      fileBuffer = Buffer.from(base64Data, 'base64');
    } else if (Buffer.isBuffer(derivedFile)) {
      fileBuffer = derivedFile;
    } else {
      return res.status(400).json({ error: 'Invalid file format' });
    }

    // Upload derived work to IPFS
    const derivedAssetId = uuidv4();
    const ipfsResult = await uploadToIPFS(
      fileBuffer,
      `${derivedAssetId}_${derivedFileName || 'derived'}`
    );

    // Register derived work on Story Protocol
    const derivativeResult = await storyProtocolService.registerDerivative({
      parentIPId: parentAsset.story_ip_id,
      derivedIPId: `derived_${derivedAssetId}`, // Placeholder - would be actual IP ID from Story
      derivationType,
      revenueSplit: revenueSplitPercentage,
    });

    // Create derived asset record
    const derivedAsset = await transaction(async (client) => {
      // Insert derived asset
      const assetResult = await client.query(
        `INSERT INTO assets (
          id, title, description, price_wei, currency, recipient_address, creator_address,
          ipfs_cid, ipfs_url, story_ip_id, story_registered
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          derivedAssetId,
          title || `Derived: ${parentAsset.title}`,
          description || `Derived from ${parentAsset.title}`,
          parentAsset.price_wei, // Inherit parent price by default
          parentAsset.currency,
          creatorAddress,
          creatorAddress,
          ipfsResult.cid,
          ipfsResult.url,
          derivativeResult.derivativeIPId,
          true,
        ]
      );

      // Create derived work link
      await client.query(
        `INSERT INTO derived_works (
          parent_asset_id, derived_asset_id, derivation_type,
          story_derivative_ip_id, story_derivative_license_id,
          revenue_split_percentage, registered_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          parentAssetId,
          derivedAssetId,
          derivationType,
          derivativeResult.derivativeIPId,
          derivativeResult.licenseId,
          revenueSplitPercentage,
          new Date(),
        ]
      );

      return assetResult.rows[0];
    });

    // Create unlock layers for derived work
    const unlockLayers = [
      { index: 0, name: 'Blurred Preview', price: 0.002, type: 'preview' },
      { index: 1, name: 'HD Preview', price: 0.01, type: 'hd' },
      { index: 2, name: 'Full Resolution', price: 0.03, type: 'full' },
      { index: 3, name: 'Commercial License', price: 0.05, type: 'commercial' },
    ];

    for (const layer of unlockLayers) {
      const layerPriceWei = parseEther(layer.price.toString(), 6);
      await query(
        `INSERT INTO unlock_layers (asset_id, layer_index, layer_name, price_wei, unlock_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [derivedAssetId, layer.index, layer.name, layerPriceWei.toString(), layer.type]
      );
    }

    res.json({
      derivedAssetId,
      derivedAsset,
      storyDerivativeIPId: derivativeResult.derivativeIPId,
      storyLicenseId: derivativeResult.licenseId,
      revenueSplitPercentage,
    });
  } catch (error) {
    console.error('Register derivative error:', error);
    res.status(500).json({
      error: 'Failed to register derivative',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/derivative/:assetId - Get all derivatives of an asset
router.get('/:assetId', async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;

    const derivatives = await query(
      `SELECT dw.*, a.title, a.ipfs_url, a.thumbnail_ipfs_url
       FROM derived_works dw
       JOIN assets a ON dw.derived_asset_id = a.id
       WHERE dw.parent_asset_id = $1
       ORDER BY dw.created_at DESC`,
      [assetId]
    );

    res.json({ derivatives });
  } catch (error) {
    console.error('Get derivatives error:', error);
    res.status(500).json({ error: 'Failed to get derivatives' });
  }
});

export default router;

