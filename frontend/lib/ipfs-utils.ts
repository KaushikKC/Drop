/**
 * Utility functions for handling IPFS URLs
 * Converts IPFS gateway URLs to use Next.js proxy to bypass CORS
 */

/**
 * Extract CID from IPFS URL
 * Supports formats:
 * - https://ipfs.io/ipfs/QmXXX
 * - https://gateway.pinata.cloud/ipfs/QmXXX
 * - https://QmXXX.ipfs.w3s.link
 * - QmXXX (just the CID)
 */
export function extractCidFromUrl(url: string): string | null {
  if (!url) return null;

  // If it's already just a CID (starts with Qm or bafy)
  if (/^[Qmb][A-Za-z0-9]{40,}$/.test(url)) {
    return url;
  }

  // Extract from various IPFS URL formats
  const patterns = [
    /\/ipfs\/([Qmb][A-Za-z0-9]{40,})/i, // /ipfs/QmXXX
    /^([Qmb][A-Za-z0-9]{40,})\.ipfs\./i, // QmXXX.ipfs.w3s.link
    /^([Qmb][A-Za-z0-9]{40,})$/i, // Just the CID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Convert IPFS URL to use Next.js proxy endpoint
 * This bypasses CORS issues with IPFS gateways
 */
export function getProxyIpfsUrl(ipfsUrl: string): string {
  if (!ipfsUrl) return ipfsUrl;

  const cid = extractCidFromUrl(ipfsUrl);
  if (!cid) {
    // If we can't extract CID, return original URL
    return ipfsUrl;
  }

  // Use Next.js proxy endpoint
  return `/api/ipfs/${cid}`;
}

/**
 * Convert multiple IPFS URLs in an object
 */
export function convertIpfsUrls<T extends Record<string, any>>(obj: T): T {
  const converted = { ...obj } as Record<string, any>;

  // Common IPFS URL fields
  const ipfsFields = [
    "imageUrl",
    "previewUrl",
    "fullQualityUrl",
    "thumbnailUrl",
    "thumbnail_ipfs_url",
    "ipfsUrl",
    "ipfs_url",
    "url",
  ];

  for (const field of ipfsFields) {
    if (converted[field] && typeof converted[field] === "string") {
      const url = converted[field] as string;
      // Check if it's an IPFS URL
      if (
        url.includes("ipfs") ||
        url.includes("gateway.pinata") ||
        /^[Qmb][A-Za-z0-9]{40,}$/.test(url)
      ) {
        converted[field] = getProxyIpfsUrl(url);
      }
    }
  }

  return converted as T;
}
