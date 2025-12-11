"use strict";
/**
 * payAndFetch function - Complete payment flow and returns resource
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.payAndFetch = payAndFetch;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
/**
 * Complete payment flow and fetch the resource
 *
 * @param assetUrl - Full URL to the asset
 * @param walletAdapter - Solana wallet adapter (from @solana/wallet-adapter-react)
 * @param connection - Solana connection (optional, will use default if not provided)
 * @returns Promise resolving to PaymentResult with access token and download URL
 */
async function payAndFetch(assetUrl, walletAdapter, connection) {
    // Step 1: Discover the asset
    const { discover } = await Promise.resolve().then(() => __importStar(require("./discover")));
    const result = await discover(assetUrl);
    if (result.type === "free") {
        // Asset is free, return directly
        return {
            accessToken: "",
            downloadUrl: result.url,
            expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year for free assets
        };
    }
    // Step 2: Payment required - proceed with payment flow
    const challenge = result.challenge;
    // Validate wallet connection
    if (!walletAdapter.connected || !walletAdapter.publicKey) {
        throw new Error("Wallet not connected. Please connect your wallet first.");
    }
    // Validate challenge expiration
    const now = Math.floor(Date.now() / 1000);
    if (challenge.expiresAt < now) {
        throw new Error("Payment challenge has expired. Please try again.");
    }
    // Use provided connection or create default
    const conn = connection ||
        new web3_js_1.Connection(challenge.network.includes("devnet")
            ? "https://api.devnet.solana.com"
            : "https://api.mainnet-beta.solana.com", "confirmed");
    const owner = walletAdapter.publicKey;
    const mint = new web3_js_1.PublicKey(challenge.mint);
    const recipient = new web3_js_1.PublicKey(challenge.recipient);
    const amountRequired = BigInt(challenge.amount);
    // Get token accounts
    const ownerAta = await (0, spl_token_1.getAssociatedTokenAddress)(mint, owner, false);
    const recipientAta = await (0, spl_token_1.getAssociatedTokenAddress)(mint, recipient, false);
    // Check balance
    let ownerAccount;
    try {
        ownerAccount = await (0, spl_token_1.getAccount)(conn, ownerAta);
    }
    catch {
        ownerAccount = undefined;
    }
    const ownerAmount = ownerAccount
        ? BigInt(ownerAccount.amount.toString())
        : 0n;
    if (ownerAmount < amountRequired) {
        throw new Error(`Insufficient balance. Required: ${challenge.amount} ${challenge.currency}, Available: ${ownerAmount.toString()}`);
    }
    // Build transaction
    const instructions = [];
    // Create owner ATA if needed
    if (!ownerAccount) {
        instructions.push((0, spl_token_1.createAssociatedTokenAccountInstruction)(owner, ownerAta, owner, mint));
    }
    // Create recipient ATA if needed
    try {
        await (0, spl_token_1.getAccount)(conn, recipientAta);
    }
    catch {
        instructions.push((0, spl_token_1.createAssociatedTokenAccountInstruction)(owner, recipientAta, recipient, mint));
    }
    // Add transfer instruction
    instructions.push((0, spl_token_1.createTransferInstruction)(ownerAta, recipientAta, owner, amountRequired));
    // Create and send transaction
    const { blockhash } = await conn.getLatestBlockhash();
    const messageV0 = new web3_js_1.TransactionMessage({
        payerKey: owner,
        recentBlockhash: blockhash,
        instructions,
    }).compileToV0Message();
    const tx = new web3_js_1.VersionedTransaction(messageV0);
    // Sign and send transaction
    // The wallet adapter interface varies, so we need to handle both cases
    let signature;
    // Try sendTransaction first (from @solana/wallet-adapter-react)
    if ("sendTransaction" in walletAdapter &&
        typeof walletAdapter.sendTransaction === "function") {
        signature = await walletAdapter.sendTransaction(tx, conn, {
            maxRetries: 5,
            skipPreflight: true,
        });
    }
    else if ("signTransaction" in walletAdapter &&
        typeof walletAdapter.signTransaction === "function") {
        // Fallback: sign and send manually
        const signedTx = await walletAdapter.signTransaction(tx);
        signature = await conn.sendRawTransaction(signedTx.serialize(), {
            maxRetries: 5,
            skipPreflight: true,
        });
    }
    else {
        throw new Error("Wallet does not support transaction signing. Please use a wallet adapter with sendTransaction or signTransaction method.");
    }
    // Confirm transaction
    try {
        const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
        await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
    }
    catch (error) {
        console.warn("Transaction confirmation warning:", error);
        // Continue anyway - server will validate
    }
    // Step 3: Verify payment and get access token
    const baseUrl = new URL(assetUrl).origin;
    const receiptUrl = `${baseUrl}/api/receipt`;
    const receiptResponse = await fetch(receiptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            signature,
            paymentRequestToken: challenge.paymentRequestToken,
            imageId: challenge.assetId,
            challenge: {
                expiresAt: challenge.expiresAt,
            },
        }),
    });
    if (!receiptResponse.ok) {
        const error = await receiptResponse.json().catch(() => ({}));
        throw new Error(`Payment verification failed: ${error.error || receiptResponse.status}`);
    }
    const { accessToken } = (await receiptResponse.json());
    // Step 4: Get download URL
    const assetResponse = await fetch(assetUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!assetResponse.ok) {
        const error = await assetResponse.json().catch(() => ({}));
        throw new Error(`Failed to get download URL: ${error.error || assetResponse.status}`);
    }
    const { url } = (await assetResponse.json());
    // Parse JWT to get expiration
    let expiresAt = Date.now() + 5 * 60 * 1000; // Default 5 minutes
    try {
        const [, payload] = accessToken.split(".");
        if (payload) {
            const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
            const decoded = JSON.parse(json);
            if (decoded.exp) {
                expiresAt = decoded.exp * 1000;
            }
        }
    }
    catch {
        // Use default expiration
    }
    // Construct full download URL
    const downloadUrl = new URL(url, baseUrl);
    downloadUrl.searchParams.set("access", accessToken);
    return {
        accessToken,
        downloadUrl: downloadUrl.toString(),
        expiresAt,
    };
}
