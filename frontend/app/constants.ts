import { Asset, PriceTier } from './types';

export const MOCK_CREATOR = {
  id: 'c1',
  name: 'Asha Creative',
  avatar: 'https://picsum.photos/id/64/100/100',
  wallet: '0x71C...9A21',
  bio: 'Digital artist exploring the boundaries of generative landscapes.',
  totalEarnings: 4250.50
};

export const PRICE_TIERS: PriceTier[] = [
  {
    tier: 'preview',
    label: 'Web Preview',
    price: 0.002,
    currency: 'SOL',
    features: ['720p Resolution', 'Watermarked', 'Personal Use']
  },
  {
    tier: 'personal',
    label: 'High-Res Personal',
    price: 0.05,
    currency: 'SOL',
    features: ['4K Resolution', 'No Watermark', 'Personal Use']
  },
  {
    tier: 'commercial',
    label: 'Commercial License',
    price: 0.5,
    currency: 'SOL',
    features: ['Original File', 'Commercial Rights', 'Derivative Rights']
  }
];

// Helper to generate random assets
const generateAssets = (count: number): Asset[] => {
  return Array.from({ length: count }).map((_, i) => {
    // Generate random aspect ratio height between 500 and 1400 (width fixed at 800 for seed)
    const randomHeight = Math.floor(Math.random() * (1400 - 500 + 1)) + 500;
    
    return {
      id: `drop_${i}`,
      title: [
        'Dawn Over Ocean', 'Urban Geometry', 'Abstract Flow', 'Mountain Mist',
        'Neon Nights', 'Desert Solitude', 'Forest Whispers', 'Cyber Punk City',
        'Liquid Metal', 'Retro Future', 'Glass House', 'Serene Valley'
      ][i % 12] + ` ${i + 1}`,
      creator: MOCK_CREATOR,
      imageUrl: `https://picsum.photos/seed/${i + 500}/800/${randomHeight}`,
      width: 800,
      height: randomHeight,
      mimeType: 'image/jpeg',
      cid: `bafy...${Math.random().toString(36).substring(7)}`,
      ipId: `story-ipa-0x${Math.random().toString(16).substring(2, 8)}`,
      fingerprint: `XFPR-0x${Math.random().toString(16).substring(2, 6)}`,
      hash: `sha256:0x${Math.random().toString(16).substring(2)}`,
      authScore: 0.95 + (Math.random() * 0.05),
      tags: ['photography', 'art', 'digital', 'landscape'],
      likes: Math.floor(Math.random() * 5000),
      views: Math.floor(Math.random() * 20000),
      priceTiers: PRICE_TIERS,
      createdAt: new Date().toISOString()
    };
  });
};

export const MOCK_ASSETS = generateAssets(30);