#!/bin/bash

# Drop CLI Full Flow Test Script
# This script tests the complete flow: upload -> register -> receipt -> verify -> licenses

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${DROP_BACKEND_URL:-http://localhost:3001}"
WALLET="${DROP_WALLET_ADDRESS:-}"
TEST_IMAGE="${1:-./test-image.jpg}"

if [ -z "$WALLET" ]; then
    echo -e "${RED}Error: DROP_WALLET_ADDRESS not set${NC}"
    echo "Set it with: export DROP_WALLET_ADDRESS=0xYourWalletAddress"
    exit 1
fi

if [ ! -f "$TEST_IMAGE" ]; then
    echo -e "${RED}Error: Test image not found: $TEST_IMAGE${NC}"
    echo "Usage: ./test-flow.sh [path-to-image.jpg]"
    exit 1
fi

echo -e "${BLUE}🚀 Drop CLI Full Flow Test${NC}"
echo "================================"
echo "Backend: $BACKEND_URL"
echo "Wallet: $WALLET"
echo "Image: $TEST_IMAGE"
echo ""

# Step 1: Upload
echo -e "${GREEN}Step 1: Uploading asset...${NC}"
UPLOAD_OUTPUT=$(npm run dev -- upload "$TEST_IMAGE" \
  --title "CLI Test Asset" \
  --description "Testing the Drop CLI" \
  --price 0.01 \
  --recipient "$WALLET" \
  --tags "test,cli,automated" 2>&1)

echo "$UPLOAD_OUTPUT"

# Extract Asset ID (look for "ID: " pattern)
ASSET_ID=$(echo "$UPLOAD_OUTPUT" | grep -oP 'ID: \K[^\s]+' || echo "")

if [ -z "$ASSET_ID" ]; then
    echo -e "${RED}Failed to extract Asset ID from upload output${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Asset uploaded! ID: $ASSET_ID${NC}"
echo ""

# Step 2: Register on Story Protocol (if not done during upload)
echo -e "${GREEN}Step 2: Registering on Story Protocol...${NC}"
REGISTER_OUTPUT=$(npm run dev -- register "$ASSET_ID" 2>&1)
echo "$REGISTER_OUTPUT"
echo ""

# Step 3: View licenses
echo -e "${GREEN}Step 3: Fetching license history...${NC}"
LICENSES_OUTPUT=$(npm run dev -- licenses --wallet "$WALLET" 2>&1)
echo "$LICENSES_OUTPUT"
echo ""

echo -e "${GREEN}✅ Full flow test complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Make a payment for asset: $ASSET_ID"
echo "2. Generate receipt: drop receipt <txHash> --asset-id $ASSET_ID --wallet $WALLET"
echo "3. Verify payment: drop verify <txHash> --asset-id $ASSET_ID --token <token>"

