/**
 * Discover function - Fetches asset URL and returns 402 challenge if payment required
 */
/**
 * Discover an asset by URL
 * Returns either free access URL or payment challenge
 *
 * @param assetUrl - Full URL to the asset (e.g., "https://example.com/api/asset/123")
 * @returns Promise resolving to DiscoverResult
 */
export async function discover(assetUrl) {
    try {
        const response = await fetch(assetUrl, {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        });
        // If 200 OK, asset is free
        if (response.status === 200) {
            const data = await response.json();
            return {
                type: "free",
                url: data.url || assetUrl,
            };
        }
        // If 402 Payment Required, return challenge
        if (response.status === 402) {
            const data = (await response.json());
            return {
                type: "payment_required",
                challenge: {
                    version: data.challenge.version,
                    network: data.challenge.network,
                    currency: data.challenge.currency,
                    decimals: data.challenge.decimals,
                    amount: data.challenge.amount,
                    mint: data.challenge.mint,
                    recipient: data.challenge.recipient,
                    expiresAt: data.challenge.expiresAt,
                    assetId: data.challenge.assetId,
                    paymentRequestToken: data.paymentRequestToken,
                    description: data.description,
                    metadata: data.metadata,
                },
            };
        }
        // Other errors
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Failed to discover asset: ${response.status} ${errorText}`);
    }
    catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`Network error: ${String(error)}`);
    }
}
