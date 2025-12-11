/**
 * Node.js Example - Using Stream402 SDK in Node.js
 */

import { discover, payAndFetch } from "stream402-sdk";
import { Connection, Keypair } from "@solana/web3.js";
import type { WalletAdapter } from "@solana/wallet-adapter-base";

// Example: Discover an asset
async function discoverAsset(assetUrl: string) {
  try {
    const result = await discover(assetUrl);

    if (result.type === "free") {
      console.log("Asset is free:", result.url);
      return result.url;
    } else {
      console.log("Payment required:");
      console.log("  Amount:", result.challenge.amount);
      console.log("  Currency:", result.challenge.currency);
      console.log("  Recipient:", result.challenge.recipient);
      return null;
    }
  } catch (error) {
    console.error("Failed to discover asset:", error);
    throw error;
  }
}

// Example: Pay and fetch using a keypair
async function payAndFetchAsset(assetUrl: string, secretKey: Uint8Array) {
  try {
    // Create wallet adapter from keypair
    const keypair = Keypair.fromSecretKey(secretKey);
    const connection = new Connection("https://api.devnet.solana.com");

    // Create a simple wallet adapter for testing
    const wallet: WalletAdapter = {
      name: "Test Wallet",
      url: "test",
      icon: "",
      readyState: "Installed" as any,
      publicKey: keypair.publicKey,
      connecting: false,
      connected: true,
      connect: async () => {},
      disconnect: async () => {},
      sendTransaction: async (tx: any, conn: Connection) => {
        tx.sign([keypair]);
        return await conn.sendRawTransaction(tx.serialize(), {
          maxRetries: 5,
          skipPreflight: true,
        });
      },
    } as any;

    // Pay and fetch
    const result = await payAndFetch(assetUrl, wallet, connection);

    console.log("Payment successful!");
    console.log("Download URL:", result.downloadUrl);
    console.log("Expires at:", new Date(result.expiresAt));

    return result.downloadUrl;
  } catch (error) {
    console.error("Payment failed:", error);
    throw error;
  }
}

// Example usage
async function main() {
  const assetUrl = "https://example.com/api/asset/123";

  // First, discover the asset
  const freeUrl = await discoverAsset(assetUrl);

  if (freeUrl) {
    console.log("Asset is free, no payment needed");
    return;
  }

  // If payment is required, pay and fetch
  // Note: In production, load secret key from environment variable
  // const secretKey = new Uint8Array(JSON.parse(process.env.SECRET_KEY!));
  // const downloadUrl = await payAndFetchAsset(assetUrl, secretKey);
}

// Uncomment to run
// main().catch(console.error);
