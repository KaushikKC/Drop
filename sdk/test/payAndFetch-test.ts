/**
 * Stream402 SDK - payAndFetch() Function Test
 *
 * This test specifically tests the payAndFetch() function with a real payment.
 *
 * ⚠️ WARNING: This will make a REAL payment on Solana DevNet!
 * Make sure you:
 * 1. Have USDC in your test wallet
 * 2. Are using a test wallet (not your main wallet)
 * 3. Have the Stream402 server running
 *
 * Setup:
 * 1. Start your Stream402 server: npm run dev (in the main project)
 * 2. Set environment variables:
 *    - TEST_BASE_URL=http://localhost:3000
 *    - TEST_WALLET_PRIVATE_KEY=your_wallet_private_key (base58, JSON array, or comma-separated)
 *    - TEST_ASSET_ID=existing_asset_id (must be a paid asset)
 *
 * Run with: npx ts-node test/payAndFetch-test.ts
 */

import { payAndFetch, discover } from "../src";
import { Connection, Keypair } from "@solana/web3.js";
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
  cyan: "\x1b[36m",
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

function logStep(message: string) {
  log(`\n📋 ${message}`, "cyan");
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

async function testPayAndFetch() {
  log("\n🚀 Testing payAndFetch() Function\n", "cyan");
  log(`Test Base URL: ${TEST_BASE_URL}\n`);

  // Validate environment variables
  if (!TEST_WALLET_PRIVATE_KEY) {
    logError("TEST_WALLET_PRIVATE_KEY is required!");
    logInfo("Set it with: export TEST_WALLET_PRIVATE_KEY=your_private_key");
    process.exit(1);
  }

  if (!TEST_ASSET_ID) {
    logError("TEST_ASSET_ID is required!");
    logInfo("Set it with: export TEST_ASSET_ID=existing_asset_id");
    process.exit(1);
  }

  try {
    // Step 1: Create wallet and connection
    logStep("Step 1: Setting up wallet and connection");
    const keypair = createWalletFromPrivateKey(TEST_WALLET_PRIVATE_KEY);
    const connection = new Connection(
      "https://api.devnet.solana.com",
      "confirmed"
    );
    const wallet = createWalletAdapter(keypair, connection);

    logSuccess(`Wallet address: ${keypair.publicKey.toBase58()}`);
    logInfo(`Network: DevNet`);

    // Step 2: Discover the asset first
    logStep("Step 2: Discovering asset");
    const assetUrl = `${TEST_BASE_URL}/api/asset/${TEST_ASSET_ID}`;
    logInfo(`Asset URL: ${assetUrl}`);

    const discoverResult = await discover(assetUrl);

    if (discoverResult.type === "free") {
      logWarning("Asset is free - no payment required!");
      logInfo(`Free asset URL: ${discoverResult.url}`);
      return;
    }

    const challenge = discoverResult.challenge;
    logSuccess("Payment challenge received:");
    logInfo(
      `  Amount: ${challenge.amount / 10 ** challenge.decimals} ${
        challenge.currency
      }`
    );
    logInfo(`  Recipient: ${challenge.recipient}`);
    logInfo(`  Mint: ${challenge.mint}`);
    logInfo(
      `  Expires at: ${new Date(challenge.expiresAt * 1000).toISOString()}`
    );

    // Step 3: Check wallet balance
    logStep("Step 3: Checking wallet balance");
    const { getAssociatedTokenAddress, getAccount } = await import(
      "@solana/spl-token"
    );
    const mint = new (await import("@solana/web3.js")).PublicKey(
      challenge.mint
    );
    const ownerAta = await getAssociatedTokenAddress(
      mint,
      keypair.publicKey,
      false
    );

    let balance = 0n;
    try {
      const account = await getAccount(connection, ownerAta);
      balance = BigInt(account.amount.toString());
      logSuccess(
        `Balance: ${balance.toString()} (${
          Number(balance) / 10 ** challenge.decimals
        } ${challenge.currency})`
      );
    } catch {
      logWarning("No token account found - balance is 0");
    }

    const requiredAmount = BigInt(challenge.amount);
    if (balance < requiredAmount) {
      logError(`Insufficient balance!`);
      logError(
        `  Required: ${requiredAmount.toString()} (${
          Number(requiredAmount) / 10 ** challenge.decimals
        } ${challenge.currency})`
      );
      logError(
        `  Available: ${balance.toString()} (${
          Number(balance) / 10 ** challenge.decimals
        } ${challenge.currency})`
      );
      logInfo("\n💡 Fund your wallet at: https://faucet.circle.com/");
      process.exit(1);
    }

    // Step 4: Confirm before payment
    logStep("Step 4: Payment confirmation");
    logWarning("⚠️  This will make a REAL payment on Solana DevNet!");
    logInfo(
      `You will pay: ${Number(requiredAmount) / 10 ** challenge.decimals} ${
        challenge.currency
      }`
    );
    logInfo(`To: ${challenge.recipient}`);
    logInfo("\nPress Ctrl+C to cancel, or wait 5 seconds to proceed...");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 5: Execute payAndFetch
    logStep("Step 5: Executing payAndFetch()");
    logInfo("This may take 30-60 seconds...");

    const startTime = Date.now();
    const result = await payAndFetch(assetUrl, wallet, connection);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Step 6: Display results
    logStep("Step 6: Results");
    logSuccess("Payment successful! 🎉");
    logInfo(`Duration: ${duration} seconds`);
    logInfo(`Download URL: ${result.downloadUrl}`);
    logInfo(`Access Token: ${result.accessToken.substring(0, 20)}...`);
    logInfo(`Expires at: ${new Date(result.expiresAt).toISOString()}`);

    // Step 7: Verify download URL works
    logStep("Step 7: Verifying download URL");
    try {
      const response = await fetch(result.downloadUrl);
      if (response.ok) {
        logSuccess("Download URL is accessible!");
        logInfo(`Content-Type: ${response.headers.get("content-type")}`);
        logInfo(
          `Content-Length: ${response.headers.get("content-length")} bytes`
        );
      } else {
        logWarning(`Download URL returned status: ${response.status}`);
      }
    } catch (error) {
      logWarning(
        `Could not verify download URL: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    log("\n✅ All tests passed!\n", "green");
    return result;
  } catch (error) {
    logError("\n❌ Test failed!");
    logError(
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
    if (error instanceof Error && error.stack) {
      logError(`Stack: ${error.stack}`);
    }
    process.exit(1);
  }
}

// Run test
testPayAndFetch().catch((error) => {
  logError(`Test runner error: ${error}`);
  process.exit(1);
});
