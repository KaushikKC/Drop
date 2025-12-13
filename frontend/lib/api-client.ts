/**
 * API Client for connecting frontend to backend and Next.js API routes
 */

// Backend API (Express server on port 3001)
const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// Royalty Token Interfaces
export interface RoyaltyToken {
  id: string;
  assetId: string;
  assetTitle?: string;
  ipId: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  totalSupply: string;
  creatorAddress: string;
  transactionHash?: string;
  createdAt: string;
  holdersCount: number;
  totalRevenue: string;
}

export interface RoyaltyHolding {
  holderAddress: string;
  balance: string;
  percentage: number;
  acquiredAt: string;
}

export interface RoyaltyDistribution {
  id: string;
  amount: string;
  currency: string;
  sourceIPId: string;
  sourceAssetId?: string;
  sourceAssetTitle?: string;
  transactionHash: string;
  distributedAt: string;
}

// Next.js API routes (same origin as frontend)
const getNextApiUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
};

// Check image hash and uniqueness before upload
export async function checkImageHash(file: File): Promise<{
  hash: string;
  hashDisplay: string;
  imageHash: string;
  isUnique: boolean;
  duplicateInfo?: {
    type: 'exact' | 'similar';
    assetId: string;
    title: string;
    creator: string;
  };
}> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BACKEND_API_URL}/api/upload/check`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = 'Failed to check image';
    try {
      const error = await response.json();
      errorMessage = error.message || error.error || errorMessage;
    } catch {
      errorMessage = `Failed to check image: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return await response.json();
}

// Upload asset to backend
export async function uploadAsset(
  file: File,
  metadata: {
    title: string;
    price: number;
    recipient: string;
    tags?: string[];
    description?: string;
    registerOnStory?: boolean; // Enable Story Protocol registration
  }
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', metadata.title);
  formData.append('price', metadata.price.toString());
  formData.append('recipient', metadata.recipient);
  if (metadata.tags && metadata.tags.length > 0) {
    formData.append('tags', metadata.tags.join(','));
  }
  if (metadata.description) {
    formData.append('description', metadata.description);
  }
  if (metadata.registerOnStory !== undefined) {
    formData.append('registerOnStory', metadata.registerOnStory.toString());
  }

  const response = await fetch(`${BACKEND_API_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = 'Upload failed';
    try {
      const error = await response.json();
      errorMessage = error.message || error.error || errorMessage;
      console.error('Upload error details:', error);
    } catch (parseError) {
      console.error('Failed to parse error response:', parseError);
      errorMessage = `Upload failed with status ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// Get asset from backend (returns 402 if unpaid)
// Also checks for existing purchases if walletAddress is provided
export async function getAsset(assetId: string, accessToken?: string, walletAddress?: string) {
  const headers: HeadersInit = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Add wallet address to query params to check for existing purchases
  const url = new URL(`${BACKEND_API_URL}/api/asset/${assetId}`);
  if (walletAddress) {
    url.searchParams.set('wallet', walletAddress);
  }

  const response = await fetch(url.toString(), {
    headers,
  });

  if (response.status === 402) {
    const responseData = await response.json();
    // The challenge is nested in responseData.challenge
    const challenge = responseData.challenge || responseData;
    return { 
      requiresPayment: true, 
      challenge: {
        ...challenge,
        paymentRequestToken: responseData.paymentRequestToken || challenge.paymentRequestToken,
      },
      previewUrl: responseData.previewUrl || challenge.previewUrl || responseData.metadata?.previewUrl, // Watermarked preview
    };
  }

  if (!response.ok) {
    throw new Error('Failed to get asset');
  }

  const data = await response.json();
  return { 
    requiresPayment: false, 
    data: {
      ...data,
      fullQualityUrl: data.url, // Full quality URL (no watermark)
      previewUrl: data.previewUrl || data.thumbnailUrl, // Preview URL for reference
    }
  };
}

// Verify payment (uses backend API)
export async function verifyPayment(data: {
  signature: string;
  platformTxHash?: string; // Platform fee transaction hash
  paymentRequestToken: string;
  imageId: string;
  challenge?: {
    expiresAt?: number;
  };
}) {
  const response = await fetch(`${BACKEND_API_URL}/api/payment/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionHash: data.signature, 
      paymentRequestToken: data.paymentRequestToken,
      assetId: data.imageId, 
      challenge: data.challenge,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Payment verification failed' }));
    throw new Error(error.error || error.message || 'Payment verification failed');
  }

  const result = await response.json();
  return result as {
    accessToken: string;
    license?: {
      tokenId?: string;
      storyLicenseId?: string;
      type?: string;
      mintedAt?: string;
    };
    transactionHash?: string;
    assetId?: string;
  };
}

// Get all assets (for gallery) - Use backend API
export async function getAllAssets() {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/asset/list`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add cache control for development
      cache: 'no-store',
    });

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `Failed to fetch assets (${response.status})`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // If response is not JSON, use status text
        errorMessage = `Failed to fetch assets: ${response.statusText} (${response.status})`;
      }
      
      console.error('API Error:', {
        status: response.status,
        statusText: response.statusText,
        url: `${BACKEND_API_URL}/api/asset/list`,
      });
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Return empty array if no assets, don't throw error
    if (!data || !data.assets) {
      console.warn('No assets found in response');
      return [];
    }
    
    return Array.isArray(data.assets) ? data.assets : [];
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network error - is the backend server running?', {
        backendUrl: BACKEND_API_URL,
        error: error.message,
      });
      throw new Error(`Cannot connect to backend server at ${BACKEND_API_URL}. Please ensure the backend is running.`);
    }
    
    // Re-throw other errors
    throw error;
  }
}

// Search assets
export async function searchAssets(query: string) {
  const response = await fetch(`${getNextApiUrl()}/api/images/search?q=${encodeURIComponent(query)}`);

  if (!response.ok) {
    throw new Error('Search failed');
  }

  return response.json();
}

// Get provider assets
export async function getProviderAssets(address: string) {
  const response = await fetch(`${BACKEND_API_URL}/api/provider/${address}/assets`);

  if (!response.ok) {
    throw new Error('Failed to fetch provider assets');
  }

  return response.json();
}

// Get provider earnings
export async function getProviderEarnings(address: string) {
  const response = await fetch(`${BACKEND_API_URL}/api/provider/${address}/earnings`);

  if (!response.ok) {
    throw new Error('Failed to fetch earnings');
  }

  return response.json();
}

// Get creator's assets (for dashboard)
export async function getCreatorAssets(creatorAddress: string) {
  const response = await fetch(`${BACKEND_API_URL}/api/provider/${creatorAddress}/assets`);

  if (!response.ok) {
    throw new Error('Failed to fetch creator assets');
  }

  const data = await response.json();
  return data.assets || [];
}

// Get creator dashboard data
export async function getCreatorDashboard(creatorAddress: string) {
  const [assets, earnings, stats] = await Promise.all([
    getCreatorAssets(creatorAddress),
    getProviderEarnings(creatorAddress),
    fetch(`${BACKEND_API_URL}/api/provider/${creatorAddress}/stats`).then(res => res.json()),
  ]);

  return {
    assets,
    earnings,
    stats: stats.stats || {},
  };
}

// Get user's purchased licenses
export async function getUserLicenses(walletAddress: string) {
  const response = await fetch(`${BACKEND_API_URL}/api/user/licenses?wallet=${encodeURIComponent(walletAddress)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch licenses: ${response.statusText}`);
  }

  return response.json();
}

// Download asset with validation
export async function downloadAsset(assetId: string, walletAddress: string, accessToken: string) {
  const response = await fetch(
    `${BACKEND_API_URL}/api/user/download/${assetId}?wallet=${encodeURIComponent(walletAddress)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  return response.json();
}

// Get transaction history for a creator
export async function getCreatorTransactions(walletAddress: string, limit: number = 50, offset: number = 0) {
  const response = await fetch(
    `${BACKEND_API_URL}/api/provider/${encodeURIComponent(walletAddress)}/transactions?limit=${limit}&offset=${offset}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch transactions: ${response.statusText}`);
  }

  return response.json();
}

// ========== ROYALTY TOKEN API FUNCTIONS ==========

// Create royalty token for an asset
export async function createRoyaltyToken(assetId: string): Promise<RoyaltyToken> {
  const response = await fetch(`${BACKEND_API_URL}/api/royalty/create/${assetId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create royalty token' }));
    throw new Error(error.error || error.message || 'Failed to create royalty token');
  }

  return response.json();
}

// Get royalty token info for an asset
export async function getRoyaltyToken(assetId: string): Promise<RoyaltyToken> {
  const response = await fetch(`${BACKEND_API_URL}/api/royalty/${assetId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null as any; // Token doesn't exist yet
    }
    throw new Error(`Failed to fetch royalty token: ${response.statusText}`);
  }

  return response.json();
}

// Get royalty token holdings
export async function getRoyaltyHoldings(assetId: string): Promise<{
  tokenId: string;
  assetId: string;
  holdings: RoyaltyHolding[];
  totalHolders: number;
}> {
  const response = await fetch(`${BACKEND_API_URL}/api/royalty/${assetId}/holdings`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch holdings: ${response.statusText}`);
  }

  return response.json();
}

// Get royalty revenue history
export async function getRoyaltyRevenue(assetId: string, limit: number = 50, offset: number = 0): Promise<{
  tokenId: string;
  assetId: string;
  totalRevenue: string;
  totalDistributions: number;
  distributions: RoyaltyDistribution[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}> {
  const response = await fetch(
    `${BACKEND_API_URL}/api/royalty/${assetId}/revenue?limit=${limit}&offset=${offset}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch revenue: ${response.statusText}`);
  }

  return response.json();
}

// Transfer royalty tokens
export async function transferRoyaltyTokens(
  assetId: string,
  from: string,
  to: string,
  amount: string
): Promise<{
  success: boolean;
  from: string;
  to: string;
  amount: string;
  transactionHash: string;
  senderNewBalance: string;
  recipientNewBalance: string;
}> {
  const response = await fetch(`${BACKEND_API_URL}/api/royalty/${assetId}/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, amount }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Transfer failed' }));
    throw new Error(error.error || error.message || 'Transfer failed');
  }

  return response.json();
}

// ========== DERIVATIVE WORKS API FUNCTIONS ==========

export interface DerivativeRegistration {
  parentAssetId: string;
  derivedFile: File | string; // File object or base64 string
  derivedFileName: string;
  derivationType: 'remix' | 'edit' | 'enhancement' | 'composite';
  title: string;
  description?: string;
  creatorAddress: string;
  revenueSplitPercentage?: number; // Default 10%
}

export interface DerivativeResult {
  derivedAssetId: string;
  derivedAsset: any;
  storyDerivativeIPId: string;
  storyLicenseId: string;
  revenueSplitPercentage: number;
}

// Register a derivative work
export async function registerDerivative(
  registration: DerivativeRegistration
): Promise<DerivativeResult> {
  // Convert file to base64 if it's a File object
  let fileData: string;
  if (registration.derivedFile instanceof File) {
    const arrayBuffer = await registration.derivedFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fileData = `data:${registration.derivedFile.type};base64,${buffer.toString('base64')}`;
  } else {
    fileData = registration.derivedFile; // Assume it's already base64
  }

  const response = await fetch(`${BACKEND_API_URL}/api/derivative/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...registration,
      derivedFile: fileData,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Derivative registration failed' }));
    throw new Error(error.error || error.message || 'Derivative registration failed');
  }

  return response.json();
}

// Get all derivatives of an asset
export async function getDerivatives(assetId: string): Promise<{
  derivatives: Array<{
    id: string;
    parent_asset_id: string;
    derived_asset_id: string;
    derivation_type: string;
    story_derivative_ip_id: string;
    story_derivative_license_id: string;
    revenue_split_percentage: number;
    created_at: string;
    title: string;
    ipfs_url: string;
    thumbnail_ipfs_url?: string;
  }>;
}> {
  const response = await fetch(`${BACKEND_API_URL}/api/derivative/${assetId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch derivatives: ${response.statusText}`);
  }

  return response.json();
}

