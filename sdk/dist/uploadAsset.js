"use strict";
/**
 * uploadAsset function - Provider helper for uploading assets
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadAsset = uploadAsset;
/**
 * Upload an asset to Stream402
 *
 * @param file - File to upload
 * @param meta - Asset metadata (title, price, recipient, tags, description)
 * @param walletAdapter - Solana wallet adapter (optional, for recipient address)
 * @param baseUrl - Base URL of the Stream402 API (defaults to current origin)
 * @returns Promise resolving to UploadResponse with asset ID and URLs
 */
async function uploadAsset(file, meta, walletAdapter, baseUrl) {
    // Determine base URL
    const apiBaseUrl = baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
    if (!apiBaseUrl) {
        throw new Error("baseUrl is required in Node.js environment");
    }
    // Use wallet address as recipient if not provided
    const recipient = meta.recipient || walletAdapter?.publicKey?.toBase58() || "";
    if (!recipient) {
        throw new Error("Recipient address is required. Provide it in meta.recipient or connect a wallet.");
    }
    // Prepare form data
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", meta.title);
    formData.append("price", meta.price.toString());
    formData.append("recipient", recipient);
    if (meta.tags && meta.tags.length > 0) {
        formData.append("tags", meta.tags.join(","));
    }
    if (meta.description) {
        formData.append("description", meta.description);
    }
    // Upload to API
    const uploadUrl = `${apiBaseUrl}/api/upload`;
    const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Upload failed: ${error.error || response.status} ${response.statusText}`);
    }
    const data = (await response.json());
    // Construct asset URL
    const assetUrl = `${apiBaseUrl}/api/asset/${data.id}`;
    const thumbnailUrl = data.thumbnailUrl
        ? `${apiBaseUrl}${data.thumbnailUrl}`
        : `${apiBaseUrl}/api/thumb/${data.id}`;
    return {
        assetId: data.id,
        title: data.title,
        price: data.price,
        url: assetUrl,
        thumbnailUrl,
    };
}
