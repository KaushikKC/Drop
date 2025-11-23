import sharp from 'sharp';
import crypto from 'crypto';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Generate perceptual hash for duplicate detection
 * Uses average hash (aHash) algorithm
 */
export async function generatePerceptualHash(buffer: Buffer): Promise<string> {
  try {
    // Resize to 8x8 for hash calculation
    const resized = await sharp(buffer)
      .resize(8, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer();

    // Calculate average pixel value
    let sum = 0;
    for (let i = 0; i < resized.length; i++) {
      sum += resized[i];
    }
    const average = sum / resized.length;

    // Generate hash: 1 if pixel > average, 0 otherwise
    let hash = '';
    for (let i = 0; i < resized.length; i++) {
      hash += resized[i] > average ? '1' : '0';
    }

    // Convert binary to hex
    return Buffer.from(hash, 'binary').toString('hex');
  } catch (error) {
    logger.error('Error generating perceptual hash:', error);
    throw error;
  }
}

/**
 * Calculate Hamming distance between two perceptual hashes
 * Returns a value between 0 (identical) and 64 (completely different)
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return 64; // Max distance
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }

  return distance;
}

/**
 * Check if two images are similar based on perceptual hash
 * @param threshold - Maximum Hamming distance to consider similar (default: 5)
 */
export function areImagesSimilar(
  hash1: string,
  hash2: string,
  threshold: number = 5
): boolean {
  return hammingDistance(hash1, hash2) <= threshold;
}

/**
 * Simple auto-tagging based on image properties
 * In production, this would use CLIP or other ML models
 */
export async function autoTagImage(buffer: Buffer, mimeType: string): Promise<string[]> {
  const tags: string[] = [];

  try {
    const metadata = await sharp(buffer).metadata();

    // Add format tag
    if (metadata.format) {
      tags.push(metadata.format);
    }

    // Add size-based tags
    if (metadata.width && metadata.height) {
      if (metadata.width > metadata.height) {
        tags.push('landscape');
      } else if (metadata.height > metadata.width) {
        tags.push('portrait');
      } else {
        tags.push('square');
      }

      if (metadata.width >= 3840 || metadata.height >= 2160) {
        tags.push('4k');
      } else if (metadata.width >= 1920 || metadata.height >= 1080) {
        tags.push('hd');
      }
    }

    // Add color space tags
    if (metadata.space) {
      tags.push(metadata.space);
    }

    // Add mime type tag
    if (mimeType) {
      const type = mimeType.split('/')[0];
      tags.push(type);
    }

    // TODO: Integrate CLIP model for semantic tagging
    // Example:
    // const clipTags = await clipModel.tagImage(buffer);
    // tags.push(...clipTags);

  } catch (error) {
    logger.error('Error auto-tagging image:', error);
  }

  return tags;
}

/**
 * Generate image hash for exact duplicate detection
 */
export function generateImageHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

