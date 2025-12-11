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
  generateWatermarkedPreview,
} from '../services/image-processing';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/upload/check - Check image hash and uniqueness before upload
router.post('/check', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'File must be an image' });
    }

    const buffer = Buffer.from(file.buffer);

    // Generate perceptual hash
    let perceptualHash: string | undefined;
    let imageHash: string | undefined;
    let isUnique = true;
    let duplicateInfo: any = null;

    try {
      perceptualHash = await generatePerceptualHash(buffer);
      imageHash = generateImageHash(buffer);

      // Check for exact duplicates
      const exactDuplicate = await queryOne(
        'SELECT id, title, creator_address FROM assets WHERE perceptual_hash = $1',
        [perceptualHash]
      );

      if (exactDuplicate) {
        isUnique = false;
        duplicateInfo = {
          type: 'exact',
          assetId: exactDuplicate.id,
          title: exactDuplicate.title,
          creator: exactDuplicate.creator_address,
        };
      } else {
        // Check for similar images (within threshold)
        const similarAssets = await query(
          `SELECT id, title, perceptual_hash, creator_address FROM assets 
           WHERE perceptual_hash IS NOT NULL 
           AND file_type LIKE 'image/%'`,
          []
        );

        for (const asset of similarAssets) {
          if (areImagesSimilar(perceptualHash, asset.perceptual_hash, 5)) {
            isUnique = false;
            duplicateInfo = {
              type: 'similar',
              assetId: asset.id,
              title: asset.title,
              creator: asset.creator_address,
            };
            break;
          }
        }
      }
    } catch (hashError) {
      console.error('Hash generation failed:', hashError);
      return res.status(500).json({
        error: 'Failed to generate hash',
        message: hashError instanceof Error ? hashError.message : 'Unknown error',
      });
    }

    // Format hash for display (first 4 and last 4 characters)
    const hashDisplay = perceptualHash 
      ? `${perceptualHash.substring(0, 4)}...${perceptualHash.substring(perceptualHash.length - 4)}`
      : 'N/A';

    res.json({
      hash: perceptualHash,
      hashDisplay: hashDisplay,
      imageHash: imageHash,
      isUnique: isUnique,
      duplicateInfo: duplicateInfo,
    });
  } catch (error) {
    console.error('Check hash error:', error);
    res.status(500).json({
      error: 'Failed to check image',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

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
      .map((tag: string) => tag.trim())
      .filter((tag: string) => tag.length > 0);
    const allTags = [...new Set([...userTags, ...autoTags])]; // Remove duplicates

    // Generate thumbnail (small preview)
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

    // Generate watermarked preview (for unpaid users)
    let watermarkedPreviewCid: string | undefined;
    let watermarkedPreviewUrl: string | undefined;

    try {
      if (file.mimetype.startsWith('image/')) {
        const watermarkedBuffer = await generateWatermarkedPreview(
          buffer,
          'PREVIEW - DROP'
        );
        const watermarkedResult = await uploadToIPFS(
          watermarkedBuffer,
          `preview_${assetId}_${file.originalname}`
        );
        watermarkedPreviewCid = watermarkedResult.cid;
        watermarkedPreviewUrl = watermarkedResult.url;
      }
    } catch (watermarkError) {
      console.error('Watermarked preview generation failed:', watermarkError);
      // Fallback to thumbnail if watermarking fails
      watermarkedPreviewUrl = thumbnailUrl;
      watermarkedPreviewCid = thumbnailCid;
    }

    // Upload original full-quality image to IPFS (for paid users)
    const ipfsResult = await uploadToIPFS(buffer, `${assetId}_${file.originalname}`);
    const ipfsCid = ipfsResult.cid;
    const ipfsUrl = ipfsResult.url;

    // Tags already merged above

    // Calculate price in wei (USDC has 6 decimals)
    const decimals = 6;
    const priceWei = parseEther(price.toString(), decimals);

    // Truncate perceptual hash to 64 characters if it's longer (database constraint)
    const truncatedPerceptualHash = perceptualHash 
      ? (perceptualHash.length > 64 ? perceptualHash.substring(0, 64) : perceptualHash)
      : null;

    // Register on Story Protocol if requested
    let storyIPId: string | undefined;
    if (registerOnStory) {
      try {
        console.log('🔄 Starting Story Protocol registration...');
        
        const storyResult = await storyProtocolService.registerIP({
          name: title,
          description: description || '',
          mediaUrl: ipfsUrl,
          thumbnailUrl: thumbnailUrl || undefined,
          mediaType: file.mimetype,
          creatorAddress: creator,
          fingerprint: truncatedPerceptualHash || undefined,
        });
        
        storyIPId = storyResult.ipId;
        console.log('✅ Story Protocol registration successful!');
        console.log('📝 IP ID:', storyIPId);
        console.log('🔗 Transaction Hash:', storyResult.txHash);
        console.log('🌐 View on Story Protocol:', `https://aeneid.explorer.story.foundation/ipa/${storyIPId}`);
        
        logger.info('Story Protocol IP registered', { 
          ipId: storyIPId, 
          txHash: storyResult.txHash,
          assetId: assetId,
          title: title,
          explorerUrl: `https://aeneid.explorer.story.foundation/ipa/${storyIPId}`
        });
      } catch (storyError: any) {
        console.error('❌ Story Protocol registration failed:');
        console.error('Error message:', storyError?.message || 'Unknown error');
        
        // Check if it's an insufficient funds error
        if (storyError?.message?.includes('insufficient funds') || 
            storyError?.message?.includes('exceeds the balance')) {
          console.error('');
          console.error('💡 SOLUTION: Get testnet tokens for your wallet');
          console.error('   Wallet address: Check your PRIVATE_KEY wallet address');
          console.error('   Network: Aeneid testnet (not Base Sepolia)');
          console.error('   Faucets:');
          console.error('   1. Story Foundation Faucet (Gitcoin Passport score 5+)');
          console.error('   2. QuickNode Faucet (requires 0.001 ETH on mainnet)');
          console.error('   3. FaucetMe Pro (Discord connection)');
          console.error('');
        }
        
        logger.error('Story Protocol registration failed', {
          error: storyError?.message || String(storyError),
          stack: config.server.nodeEnv === 'development' ? storyError?.stack : undefined,
          assetId: assetId,
          title: title
        });
        
        // Continue without Story registration - don't fail the upload
        // But log a warning that IP was not registered
        console.warn('⚠️  Upload will continue without Story Protocol registration');
      }
    }

    // Save to database
    // Note: We'll store watermarked preview in thumbnail_url for now (can add separate column later)
    // Full quality image is in ipfs_url
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
        ipfsUrl, // Full quality original
        thumbnailCid || null,
        watermarkedPreviewUrl || thumbnailUrl || null, // Watermarked preview (or thumbnail as fallback)
        file.mimetype,
        file.size,
        allTags.length > 0 ? allTags : null,
        truncatedPerceptualHash,
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
    
    // Provide more detailed error information
    let errorMessage = 'Upload failed';
    let errorDetails: any = {};
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        message: error.message,
        stack: config.server.nodeEnv === 'development' ? error.stack : undefined,
      };
      
      // Check for specific error types
      if (error.message.includes('IPFS') || error.message.includes('storage')) {
        errorMessage = 'IPFS upload failed. Please check your IPFS configuration (WEB3_STORAGE_TOKEN or PINATA_API_KEY).';
      } else if (error.message.includes('database') || error.message.includes('query')) {
        errorMessage = 'Database error. Please check your database connection.';
      } else if (error.message.includes('sharp') || error.message.includes('image')) {
        errorMessage = 'Image processing failed. Please ensure the file is a valid image.';
      }
    }
    
    res.status(500).json({
      error: 'Upload failed',
      message: errorMessage,
      details: config.server.nodeEnv === 'development' ? errorDetails : undefined,
    });
  }
});

export default router;

