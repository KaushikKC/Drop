/**
 * Stream402 SDK Integration Tests
 *
 * These tests require a running Stream402 server and a funded wallet.
 *
 * Setup:
 * 1. Start your Stream402 server: npm run dev (in the main project)
 * 2. Set environment variables:
 *    - TEST_BASE_URL=http://localhost:3000
 *    - TEST_WALLET_PRIVATE_KEY=your_wallet_private_key (base58 or array)
 *    - TEST_ASSET_ID=existing_asset_id (optional, for testing discover)
 *
 * Run with: npx ts-node test/integration-test.ts
 */

import { discover, payAndFetch, uploadAsset } from "../src";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { WalletAdapter } from "@solana/wallet-adapter-base";

const TEST_BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const TEST_WALLET_PRIVATE_KEY = process.env.TEST_WALLET_PRIVATE_KEY || "";
const TEST_ASSET_ID = process.env.TEST_ASSET_ID || "";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, "green");
}

function logError(message: string) {
  log(`❌ ${message}`, "red");
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, "blue");
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, "yellow");
}

// Create wallet from private key
function createWalletFromPrivateKey(privateKey: string): Keypair {
  try {
    let secretKey: Uint8Array;

    // Try parsing as base58
    try {
      secretKey = bs58.decode(privateKey);
    } catch {
      // Try parsing as JSON array
      try {
        secretKey = new Uint8Array(JSON.parse(privateKey));
      } catch {
        // Try parsing as comma-separated numbers
        const numbers = privateKey
          .split(",")
          .map((n) => parseInt(n.trim(), 10));
        if (numbers.length === 64) {
          secretKey = new Uint8Array(numbers);
        } else {
          throw new Error("Invalid private key format");
        }
      }
    }

    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    throw new Error(
      `Failed to create wallet: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Create a mock wallet adapter from a keypair
function createWalletAdapter(
  keypair: Keypair,
  connection: Connection
): WalletAdapter {
  return {
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
}

async function testDiscover() {
  logInfo("\n📡 Testing discover() function...");

  if (!TEST_ASSET_ID) {
    logWarning("Skipping discover test: TEST_ASSET_ID not set");
    return;
  }

  try {
    const assetUrl = `${TEST_BASE_URL}/api/asset/${TEST_ASSET_ID}`;
    logInfo(`Discovering asset: ${assetUrl}`);

    const result = await discover(assetUrl);

    if (result.type === "free") {
      logSuccess(`Asset is free: ${result.url}`);
    } else {
      logSuccess(
        `Payment required: ${
          result.challenge.amount / 10 ** result.challenge.decimals
        } ${result.challenge.currency}`
      );
      logInfo(`Recipient: ${result.challenge.recipient}`);
      logInfo(
        `Expires at: ${new Date(
          result.challenge.expiresAt * 1000
        ).toISOString()}`
      );
    }

    return result;
  } catch (error) {
    logError(
      `Discover test failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
}

async function testUpload() {
  logInfo("\n📤 Testing uploadAsset() function...");

  if (!TEST_WALLET_PRIVATE_KEY) {
    logWarning("Skipping upload test: TEST_WALLET_PRIVATE_KEY not set");
    return;
  }

  try {
    const keypair = createWalletFromPrivateKey(TEST_WALLET_PRIVATE_KEY);
    const connection = new Connection(
      "https://api.devnet.solana.com",
      "confirmed"
    );
    const wallet = createWalletAdapter(keypair, connection);

    logInfo(`Using wallet: ${keypair.publicKey.toBase58()}`);

    // Create a test image file
    const testImageContent = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    const testFile = new File([testImageContent], "test.png", {
      type: "image/png",
    });

    logInfo("Uploading test image...");
    const result = await uploadAsset(
      testFile,
      {
        title: "SDK Test Image",
        price: 0.01,
        tags: ["test", "sdk"],
        description: "Test image uploaded via SDK",
      },
      wallet,
      TEST_BASE_URL
    );

    logSuccess(`Upload successful!`);
    logInfo(`Asset ID: ${result.assetId}`);
    logInfo(`Asset URL: ${result.url}`);
    logInfo(`Thumbnail URL: ${result.thumbnailUrl}`);

    return result;
  } catch (error) {
    logError(
      `Upload test failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
}

async function testPayAndFetch() {
  logInfo("\n💳 Testing payAndFetch() function...");

  if (!TEST_WALLET_PRIVATE_KEY || !TEST_ASSET_ID) {
    logWarning(
      "Skipping payAndFetch test: TEST_WALLET_PRIVATE_KEY or TEST_ASSET_ID not set"
    );
    return;
  }

  try {
    const keypair = createWalletFromPrivateKey(TEST_WALLET_PRIVATE_KEY);
    const connection = new Connection(
      "https://api.devnet.solana.com",
      "confirmed"
    );
    const wallet = createWalletAdapter(keypair, connection);

    logInfo(`Using wallet: ${keypair.publicKey.toBase58()}`);

    const assetUrl = `${TEST_BASE_URL}/api/asset/${TEST_ASSET_ID}`;
    logInfo(`Paying for asset: ${assetUrl}`);

    logWarning(
      "This will attempt to make a real payment. Make sure you have USDC in your wallet!"
    );

    const result = await payAndFetch(assetUrl, wallet, connection);

    logSuccess(`Payment successful!`);
    logInfo(`Download URL: ${result.downloadUrl}`);
    logInfo(`Expires at: ${new Date(result.expiresAt).toISOString()}`);

    return result;
  } catch (error) {
    logError(
      `PayAndFetch test failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
}

async function runIntegrationTests() {
  log("\n🚀 Starting Stream402 SDK Integration Tests\n", "blue");
  log(`Test Base URL: ${TEST_BASE_URL}\n`);

  if (!TEST_WALLET_PRIVATE_KEY) {
    logWarning("TEST_WALLET_PRIVATE_KEY not set. Some tests will be skipped.");
  }

  const results: { name: string; passed: boolean; error?: string }[] = [];

  // Test discover
  try {
    await testDiscover();
    results.push({ name: "discover()", passed: true });
  } catch (error) {
    results.push({
      name: "discover()",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test upload
  try {
    await testUpload();
    results.push({ name: "uploadAsset()", passed: true });
  } catch (error) {
    results.push({
      name: "uploadAsset()",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Test payAndFetch (commented out by default to avoid accidental payments)
  // Uncomment to test payment flow
  /*
  try {
    await testPayAndFetch();
    results.push({ name: "payAndFetch()", passed: true });
  } catch (error) {
    results.push({
      name: "payAndFetch()",
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  */

  // Print summary
  log("\n📊 Test Summary\n", "blue");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((result) => {
    if (result.passed) {
      logSuccess(`  ✓ ${result.name}`);
    } else {
      logError(`  ✗ ${result.name}: ${result.error}`);
    }
  });

  log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}\n`);

  if (failed > 0) {
    logError("Some tests failed. Please review the errors above.");
    process.exit(1);
  } else {
    logSuccess("All tests passed! 🎉");
    process.exit(0);
  }
}

// Run tests
runIntegrationTests().catch((error) => {
  logError(`Test runner error: ${error}`);
  process.exit(1);
});
