import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy endpoint for IPFS images to bypass CORS issues
 * Usage: /api/ipfs/QmYGxJWkaiqJwAnZz2JCWuhhjUBn8UXh3yu8AB3DeS4YrV
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const params = await context.params;
    const ipfsPath = Array.isArray(params.path) ? params.path.join('/') : params.path;
    
    // Support multiple IPFS gateways
    const gateways = [
      `https://ipfs.io/ipfs/${ipfsPath}`,
      `https://cloudflare-ipfs.com/ipfs/${ipfsPath}`,
      `https://gateway.pinata.cloud/ipfs/${ipfsPath}`,
    ];

    // Try each gateway until one works
    for (const gatewayUrl of gateways) {
      try {
        const response = await fetch(gatewayUrl, {
          headers: {
            'Accept': 'image/*',
          },
          // Add timeout
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (response.ok) {
          const imageBuffer = await response.arrayBuffer();
          const contentType = response.headers.get('content-type') || 'image/jpeg';

          return new NextResponse(imageBuffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET',
            },
          });
        }
      } catch (error) {
        // Try next gateway
        console.warn(`Gateway ${gatewayUrl} failed, trying next...`, error);
        continue;
      }
    }

    // All gateways failed
    return NextResponse.json(
      { error: 'Failed to fetch from IPFS gateways' },
      { status: 502 }
    );
  } catch (error) {
    console.error('IPFS proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

