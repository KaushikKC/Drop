/**
 * uploadAsset function - Provider helper for uploading assets
 */

import { AssetMetadata, UploadResponse } from './types';
import { SDKConfig } from './types';

/**
 * Upload an asset to Stream402
 *
 * @param file - File to upload
 * @param meta - Asset metadata (title, price, recipient, tags, description)
 * @param signer - Optional signer for recipient address (not needed for x402, but kept for compatibility)
 * @param config - SDK configuration
 * @returns Promise resolving to UploadResponse with asset ID and URLs
 */
export async function uploadAsset(
  file: File | Blob,
  meta: AssetMetadata,
  signer?: { getAddress(): Promise<string> },
  config?: SDKConfig
): Promise<UploadResponse> {
  // Determine base URL
  const apiBaseUrl =
    config?.baseUrl ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  if (!apiBaseUrl) {
    throw new Error('baseUrl is required in Node.js environment');
  }

  // Use signer address as recipient if not provided
  let recipient = meta.recipient;
  if (!recipient && signer) {
    recipient = await signer.getAddress();
  }

  if (!recipient) {
    throw new Error(
      'Recipient address is required. Provide it in meta.recipient or provide a signer.'
    );
  }

  // Prepare form data
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', meta.title);
  formData.append('price', meta.price.toString());
  formData.append('recipient', recipient);

  if (meta.creator) {
    formData.append('creator', meta.creator);
  }

  if (meta.tags && meta.tags.length > 0) {
    formData.append('tags', meta.tags.join(','));
  }

  if (meta.description) {
    formData.append('description', meta.description);
  }

  if (meta.registerOnStory) {
    formData.append('registerOnStory', 'true');
  }

  // Upload to API
  const uploadUrl = `${apiBaseUrl}/api/upload`;
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Upload failed: ${error.error || response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as UploadResponse;

  return {
    assetId: data.assetId,
    title: data.title,
    price: data.price,
    url: data.url,
    thumbnailUrl: data.thumbnailUrl,
    ipfsCid: data.ipfsCid,
    ipfsUrl: data.ipfsUrl,
    storyIPId: data.storyIPId,
  };
}
