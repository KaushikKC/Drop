/**
 * API Client for connecting frontend to backend and Next.js API routes
 */

// Backend API (Express server on port 3001)
const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// Next.js API routes (same origin as frontend)
const getNextApiUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
};

// Upload asset to backend
export async function uploadAsset(
  file: File,
  metadata: {
    title: string;
    price: number;
    recipient: string;
    tags?: string[];
    description?: string;
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
export async function getAsset(assetId: string, accessToken?: string) {
  const headers: HeadersInit = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${BACKEND_API_URL}/api/asset/${assetId}`, {
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

// Verify payment (uses Next.js API route)
export async function verifyPayment(data: {
  signature: string;
  paymentRequestToken: string;
  imageId: string;
  challenge?: {
    expiresAt?: number;
  };
}) {
  const response = await fetch(`${getNextApiUrl()}/api/receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signature: data.signature,
      paymentRequestToken: data.paymentRequestToken,
      imageId: data.imageId,
      challenge: data.challenge,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Payment verification failed' }));
    throw new Error(error.error || 'Payment verification failed');
  }

  return response.json();
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

