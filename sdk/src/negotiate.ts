/**
 * Negotiate function - Agent negotiable pricing
 */

import { NegotiationIntent, NegotiationResponse } from './types';
import { SDKConfig } from './types';

/**
 * Create a negotiation intent
 */
export async function createNegotiation(
  intent: NegotiationIntent,
  agentPrivateKey: string, // For XMTP signing
  config?: SDKConfig
): Promise<{ negotiationId: string }> {
  const apiBaseUrl =
    config?.baseUrl ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  if (!apiBaseUrl) {
    throw new Error('baseUrl is required');
  }

  // Extract agent address from private key (simplified - in production use ethers)
  const response = await fetch(`${apiBaseUrl}/api/negotiation/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...intent,
      agentPrivateKey, // In production, handle this more securely
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Negotiation failed: ${error.error || response.status}`
    );
  }

  const data = await response.json();
  return { negotiationId: data.negotiation.id };
}

/**
 * Respond to a negotiation
 */
export async function respondToNegotiation(
  negotiationId: string,
  response: NegotiationResponse,
  creatorPrivateKey: string,
  config?: SDKConfig
): Promise<void> {
  const apiBaseUrl =
    config?.baseUrl ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  if (!apiBaseUrl) {
    throw new Error('baseUrl is required');
  }

  const apiResponse = await fetch(
    `${apiBaseUrl}/api/negotiation/${negotiationId}/respond`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...response,
        creatorPrivateKey, // In production, handle this more securely
      }),
    }
  );

  if (!apiResponse.ok) {
    const error = await apiResponse.json().catch(() => ({}));
    throw new Error(
      `Negotiation response failed: ${error.error || apiResponse.status}`
    );
  }
}

