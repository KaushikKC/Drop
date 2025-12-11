/**
 * Register derivative work function
 */

import { DerivedWorkRegistration } from './types';
import { SDKConfig } from './types';

/**
 * Register a derived work
 */
export async function registerDerivative(
  registration: DerivedWorkRegistration,
  config?: SDKConfig
): Promise<{
  derivedAssetId: string;
  storyDerivativeIPId: string;
  storyLicenseId: string;
  revenueSplitPercentage: number;
}> {
  const apiBaseUrl =
    config?.baseUrl ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  if (!apiBaseUrl) {
    throw new Error('baseUrl is required');
  }

  // Convert file to base64 if it's a File or Buffer
  let fileData: string;
  if (registration.derivedFile instanceof File) {
    const arrayBuffer = await registration.derivedFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fileData = `data:${registration.derivedFile.type};base64,${buffer.toString('base64')}`;
  } else if (Buffer.isBuffer(registration.derivedFile)) {
    fileData = `data:application/octet-stream;base64,${registration.derivedFile.toString('base64')}`;
  } else {
    fileData = registration.derivedFile; // Assume it's already base64
  }

  const response = await fetch(`${apiBaseUrl}/api/derivative/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...registration,
      derivedFile: fileData,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Derivative registration failed: ${error.error || response.status}`
    );
  }

  return await response.json();
}

