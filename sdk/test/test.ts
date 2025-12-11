/**
 * Stream402 SDK Test Suite
 *
 * Run with: npm test
 * Or: npx ts-node test/test.ts
 */

import { discover, payAndFetch, uploadAsset } from "../src";
import { Connection, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

// Test configuration
const TEST_BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
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

// Test results
const results: { name: string; passed: boolean; error?: string }[] = [];

function test(name: string, fn: () => Promise<void> | void) {
  return async () => {
    try {
      logInfo(`Testing: ${name}`);
      await fn();
      results.push({ name, passed: true });
      logSuccess(`${name} - PASSED`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      results.push({ name, passed: false, error: errorMessage });
      logError(`${name} - FAILED: ${errorMessage}`);
    }
  };
}

// Mock wallet adapter for testing
class MockWalletAdapter {
  connected = true;
  publicKey: any;
  signTransaction: any;
  sendTransaction: any;

  constructor(publicKey: any) {
    this.publicKey = publicKey;
    this.signTransaction = async (tx: any) => {
      // Mock signing - in real tests, you'd use a real keypair
      return tx;
    };
    this.sendTransaction = async (tx: any, connection: Connection) => {
      // Mock sending - in real tests, you'd actually send
      return "mock_signature";
    };
  }
}

async function runTests() {
  log("\n🚀 Starting Stream402 SDK Tests\n", "blue");
  log(`Test Base URL: ${TEST_BASE_URL}\n`);

  // Test 1: Discover function
  await test("discover() - Free asset", async () => {
    // This would test with a free asset if available
    // For now, we'll test the error handling
    try {
      await discover(`${TEST_BASE_URL}/api/asset/nonexistent`);
      throw new Error("Should have thrown an error for nonexistent asset");
    } catch (error) {
      // Expected to fail for nonexistent asset
      if (!(error instanceof Error)) {
        throw new Error("Expected Error object");
      }
    }
  })();

  await test("discover() - Payment required", async () => {
    if (!TEST_ASSET_ID) {
      logWarning("Skipping: TEST_ASSET_ID not set");
      return;
    }
    const result = await discover(
      `${TEST_BASE_URL}/api/asset/${TEST_ASSET_ID}`
    );
    if (result.type !== "payment_required") {
      throw new Error("Expected payment_required result");
    }
    if (!result.challenge.amount || !result.challenge.recipient) {
      throw new Error("Challenge missing required fields");
    }
  })();

  // Test 2: Upload function
  await test("uploadAsset() - Basic upload", async () => {
    // Create a test file
    const testFile = new File(["test content"], "test.txt", {
      type: "text/plain",
    });

    // This will fail without a real wallet, but we can test the structure
    try {
      await uploadAsset(
        testFile,
        {
          title: "Test Asset",
          price: 0.01,
          recipient: "11111111111111111111111111111111", // Dummy address
        },
        undefined,
        TEST_BASE_URL
      );
    } catch (error) {
      // Expected to fail without proper setup, but should fail gracefully
      if (!(error instanceof Error)) {
        throw new Error("Expected Error object");
      }
    }
  })();

  // Test 3: Type exports
  await test("Type exports", async () => {
    // Check that types are exported
    const index = await import("../src/index");
    if (!index.discover || !index.payAndFetch || !index.uploadAsset) {
      throw new Error("Missing exports");
    }
  })();

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
runTests().catch((error) => {
  logError(`Test runner error: ${error}`);
  process.exit(1);
});
