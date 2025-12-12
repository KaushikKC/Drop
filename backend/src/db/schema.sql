-- drop Database Schema
-- Supports Ethereum payments, Story Protocol integration, and agent features

-- Enable UUID extension (required for gen_random_uuid())
-- Note: This requires superuser privileges. If you get permission denied, run as postgres user:
-- psql -U postgres -d drop -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";'
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price_wei BIGINT NOT NULL, -- Price in wei (smallest unit)
    currency VARCHAR(10) DEFAULT 'USDC',
    recipient_address VARCHAR(42) NOT NULL, -- Ethereum address
    creator_address VARCHAR(42) NOT NULL,
    ipfs_cid VARCHAR(255),
    ipfs_url TEXT,
    thumbnail_ipfs_cid VARCHAR(255),
    thumbnail_ipfs_url TEXT,
    file_type VARCHAR(100),
    file_size BIGINT,
    tags TEXT[], -- Array of tags
    perceptual_hash VARCHAR(64), -- For duplicate detection
    story_ip_id VARCHAR(255), -- Story Protocol IP ID
    story_registered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment unlock layers (for Preview-by-Micropayment)
CREATE TABLE IF NOT EXISTS unlock_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    layer_index INTEGER NOT NULL, -- 0 = blurred, 1 = HD preview, 2 = full, 3 = commercial
    layer_name VARCHAR(100) NOT NULL,
    price_wei BIGINT NOT NULL,
    unlock_type VARCHAR(50) NOT NULL, -- 'preview', 'hd', 'full', 'commercial'
    ipfs_cid VARCHAR(255), -- Layer-specific content
    ipfs_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_id, layer_index)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id),
    payer_address VARCHAR(42) NOT NULL,
    amount_wei BIGINT NOT NULL, -- Total amount paid by buyer
    creator_amount_wei BIGINT NOT NULL, -- Amount received by creator (95%)
    platform_fee_wei BIGINT NOT NULL, -- Platform fee (5%)
    platform_fee_percentage DECIMAL(5,2) DEFAULT 5.00, -- Platform fee percentage
    platform_wallet_address VARCHAR(42), -- Platform wallet that received the fee
    platform_transaction_hash VARCHAR(66), -- Transaction hash for platform fee payment
    transaction_hash VARCHAR(66) NOT NULL UNIQUE, -- Main transaction hash (creator payment)
    block_number BIGINT,
    unlock_layer_id UUID REFERENCES unlock_layers(id), -- Which layer was unlocked
    payment_request_token VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Licenses table (Story Protocol licenses)
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id),
    buyer_address VARCHAR(42) NOT NULL,
    license_token_id VARCHAR(255), -- Story Protocol license token ID
    license_type VARCHAR(50) NOT NULL, -- 'personal', 'commercial', 'derivative'
    story_license_id VARCHAR(255), -- Story Protocol license ID
    payment_id UUID REFERENCES payments(id),
    minted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Negotiations table (Agent Negotiable Pricing)
CREATE TABLE IF NOT EXISTS negotiations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id),
    agent_address VARCHAR(42) NOT NULL,
    creator_address VARCHAR(42) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'countered', 'rejected', 'expired'
    requested_amount_wei BIGINT NOT NULL,
    requested_license_type VARCHAR(50),
    counter_amount_wei BIGINT, -- Creator's counter offer
    counter_license_type VARCHAR(50),
    message TEXT, -- Agent's negotiation message
    xmtp_message_id VARCHAR(255), -- XMTP message ID for agent communication
    expires_at TIMESTAMP,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Derived works table (Auto-Derived Works Registration)
CREATE TABLE IF NOT EXISTS derived_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_asset_id UUID NOT NULL REFERENCES assets(id),
    derived_asset_id UUID NOT NULL REFERENCES assets(id),
    derivation_type VARCHAR(50) NOT NULL, -- 'remix', 'edit', 'enhancement', 'composite'
    story_derivative_ip_id VARCHAR(255), -- Story Protocol derivative IP ID
    story_derivative_license_id VARCHAR(255),
    revenue_split_percentage INTEGER, -- Percentage to parent creator
    registered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parent_asset_id, derived_asset_id)
);

-- Agent profiles table
CREATE TABLE IF NOT EXISTS agent_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_address VARCHAR(42) NOT NULL UNIQUE,
    xmtp_address VARCHAR(255), -- XMTP address for agent communication
    agent_name VARCHAR(255),
    agent_type VARCHAR(50), -- 'buyer', 'seller', 'both'
    reputation_score INTEGER DEFAULT 0,
    total_purchases INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    total_volume_wei BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent transactions table (for agent-to-agent economy)
CREATE TABLE IF NOT EXISTS agent_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_agent_address VARCHAR(42) NOT NULL,
    seller_agent_address VARCHAR(42) NOT NULL,
    asset_id UUID NOT NULL REFERENCES assets(id),
    payment_id UUID REFERENCES payments(id),
    xmtp_conversation_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reputation scores table
CREATE TABLE IF NOT EXISTS reputation_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address VARCHAR(42) NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    total_payments INTEGER DEFAULT 0,
    total_volume_wei BIGINT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(address)
);

-- Payment challenges table (for X402 flow)
CREATE TABLE IF NOT EXISTS payment_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id VARCHAR(66) NOT NULL UNIQUE, -- keccak256 hash
    asset_id UUID NOT NULL REFERENCES assets(id),
    unlock_layer_id UUID REFERENCES unlock_layers(id),
    amount_wei BIGINT NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    recipient VARCHAR(42) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    payment_request_token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User purchases table (for tracking unlocked assets)
CREATE TABLE IF NOT EXISTS user_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_address VARCHAR(42) NOT NULL,
    asset_id UUID NOT NULL REFERENCES assets(id),
    transaction_hash VARCHAR(66) NOT NULL,
    payment_id VARCHAR(66) REFERENCES payment_challenges(payment_id),
    access_token TEXT,
    license_type VARCHAR(50),
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_address, asset_id, transaction_hash)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assets_creator ON assets(creator_address);
CREATE INDEX IF NOT EXISTS idx_assets_recipient ON assets(recipient_address);
CREATE INDEX IF NOT EXISTS idx_assets_story_ip_id ON assets(story_ip_id);
CREATE INDEX IF NOT EXISTS idx_assets_perceptual_hash ON assets(perceptual_hash);
CREATE INDEX IF NOT EXISTS idx_payments_asset ON payments(asset_id);
CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer_address);
CREATE INDEX IF NOT EXISTS idx_payments_tx_hash ON payments(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_licenses_asset ON licenses(asset_id);
CREATE INDEX IF NOT EXISTS idx_licenses_buyer ON licenses(buyer_address);
CREATE INDEX IF NOT EXISTS idx_negotiations_asset ON negotiations(asset_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_agent ON negotiations(agent_address);
CREATE INDEX IF NOT EXISTS idx_negotiations_status ON negotiations(status);
CREATE INDEX IF NOT EXISTS idx_derived_works_parent ON derived_works(parent_asset_id);
CREATE INDEX IF NOT EXISTS idx_derived_works_derived ON derived_works(derived_asset_id);
CREATE INDEX IF NOT EXISTS idx_payment_challenges_asset ON payment_challenges(asset_id);
CREATE INDEX IF NOT EXISTS idx_payment_challenges_payment_id ON payment_challenges(payment_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_user ON user_purchases(user_address);
CREATE INDEX IF NOT EXISTS idx_user_purchases_asset ON user_purchases(asset_id);

