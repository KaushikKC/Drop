import express, { Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { query, queryOne } from '../db';
import { uploadToIPFS } from '../services/ipfs';
import { storyProtocolService } from '../services/story-protocol';
import { config } from '../config';
import { parseEther } from '../services/ethereum';
import {
  generatePerceptualHash,
  generateImageHash,
  autoTagImage,
  areImagesSimilar,
} from '../services/image-processing';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

interface AssetRow {
  id: string;
  title: string;
  description?: string;
  price_wei: string;
  currency: string;
  recipient_address: string;
  creator_address: string;
  ipfs_cid?: string;
  ipfs_url?: string;
  thumbnail_ipfs_cid?: string;
  thumbnail_ipfs_url?: string;
  file_type?: string;
  file_size?: number;
  tags?: string[];
  story_ip_id?: string;
  story_registered: boolean;
}

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const title = (req.body.title as string) || 'Untitled';
    const price = parseFloat(req.body.price || '0.01');
    const recipient = req.body.recipient || '';
    const creator = req.body.creator || recipient;
    const tagsInput = req.body.tags || '';
    const description = req.body.description || '';
    const registerOnStory = req.body.registerOnStory === 'true';

    if (!recipient) {
      return res.status(400).json({ error: 'Recipient address required' });
    }

    // Validate Ethereum address
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      return res.status(400).json({ error: 'Invalid recipient address' });
    }

    const assetId = uuidv4();
    const buffer = Buffer.from(file.buffer);

    // Generate perceptual hash for duplicate detection
    let perceptualHash: string | undefined;
    let imageHash: string | undefined;
    try {
      if (file.mimetype.startsWith('image/')) {
        perceptualHash = await generatePerceptualHash(buffer);
        imageHash = generateImageHash(buffer);

        // Check for exact duplicates
        const exactDuplicate = await queryOne(
          'SELECT id, title FROM assets WHERE perceptual_hash = $1',
          [perceptualHash]
        );

        if (exactDuplicate) {
          return res.status(409).json({
            error: 'Duplicate image detected',
            existingAssetId: exactDuplicate.id,
            existingTitle: exactDuplicate.title,
            message: 'An identical or very similar image already exists',
          });
        }

        // Check for similar images (within threshold)
        const similarAssets = await query(
          `SELECT id, title, perceptual_hash FROM assets 
           WHERE perceptual_hash IS NOT NULL 
           AND file_type LIKE 'image/%'`,
          []
        );

        for (const asset of similarAssets) {
          if (areImagesSimilar(perceptualHash, asset.perceptual_hash, 5)) {
            return res.status(409).json({
              error: 'Similar image detected',
              existingAssetId: asset.id,
              existingTitle: asset.title,
              message: 'A very similar image already exists. Please verify this is not a duplicate.',
            });
          }
        }
      }
    } catch (hashError) {
      console.error('Hash generation failed:', hashError);
      // Continue without hash - don't block upload
    }

    // Auto-tag image
    let autoTags: string[] = [];
    try {
      if (file.mimetype.startsWith('image/')) {
        autoTags = await autoTagImage(buffer, file.mimetype);
      }
    } catch (tagError) {
      console.error('Auto-tagging failed:', tagError);
      // Continue without auto-tags
    }

    // Merge user tags with auto-tags
    const userTags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    const allTags = [...new Set([...userTags, ...autoTags])]; // Remove duplicates

    // Generate thumbnail
    let thumbnailBuffer: Buffer | null = null;
    let thumbnailCid: string | undefined;
    let thumbnailUrl: string | undefined;

    try {
      if (file.mimetype.startsWith('image/')) {
        thumbnailBuffer = await sharp(buffer)
          .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer();

        const thumbResult = await uploadToIPFS(
          thumbnailBuffer,
          `thumb_${assetId}_${file.originalname}`
        );
        thumbnailCid = thumbResult.cid;
        thumbnailUrl = thumbResult.url;
      }
    } catch (thumbError) {
      console.error('Thumbnail generation failed:', thumbError);
    }

    // Upload to IPFS
    const ipfsResult = await uploadToIPFS(buffer, `${assetId}_${file.originalname}`);
    const ipfsCid = ipfsResult.cid;
    const ipfsUrl = ipfsResult.url;

    // Tags already merged above

    // Calculate price in wei (USDC has 6 decimals)
    const decimals = 6;
    const priceWei = parseEther(price.toString(), decimals);

    // Register on Story Protocol if requested
    let storyIPId: string | undefined;
    if (registerOnStory) {
      try {
        const storyResult = await storyProtocolService.registerIP({
          name: title,
          description,
          mediaUrl: ipfsUrl,
        });
        storyIPId = storyResult.ipId;
      } catch (storyError) {
        console.error('Story Protocol registration failed:', storyError);
        // Continue without Story registration
      }
    }

    // Save to database
    const result = await queryOne<AssetRow>(
      `INSERT INTO assets (
        id, title, description, price_wei, currency, recipient_address, creator_address,
        ipfs_cid, ipfs_url, thumbnail_ipfs_cid, thumbnail_ipfs_url,
        file_type, file_size, tags, perceptual_hash, story_ip_id, story_registered
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        assetId,
        title,
        description || null,
        priceWei.toString(),
        'USDC',
        recipient,
        creator,
        ipfsCid,
        ipfsUrl,
        thumbnailCid || null,
        thumbnailUrl || null,
        file.mimetype,
        file.size,
        allTags.length > 0 ? allTags : null,
        perceptualHash || null,
        storyIPId || null,
        !!storyIPId,
      ]
    );

    // Create default unlock layers (Preview-by-Micropayment feature)
    const unlockLayers = [
      { index: 0, name: 'Blurred Preview', price: 0.002, type: 'preview' },
      { index: 1, name: 'HD Preview', price: 0.01, type: 'hd' },
      { index: 2, name: 'Full Resolution', price: 0.03, type: 'full' },
      { index: 3, name: 'Commercial License', price: 0.05, type: 'commercial' },
    ];

    for (const layer of unlockLayers) {
      const layerPriceWei = parseEther(layer.price.toString(), decimals);
      await query(
        `INSERT INTO unlock_layers (asset_id, layer_index, layer_name, price_wei, unlock_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [assetId, layer.index, layer.name, layerPriceWei.toString(), layer.type]
      );
    }

    res.json({
      assetId,
      url: `/api/asset/${assetId}`,
      title,
      price,
      ipfsCid,
      ipfsUrl,
      thumbnailUrl,
      storyIPId,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

