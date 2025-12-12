-- Migration: Add Royalty Tokens support
-- This migration adds tables to track Story Protocol Royalty Tokens

-- Royalty Tokens table
-- Stores information about royalty tokens created for IP assets
CREATE TABLE IF NOT EXISTS royalty_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    ip_id VARCHAR(255) NOT NULL, -- Story Protocol IP ID
    token_address VARCHAR(42) NOT NULL, -- ERC-20 token contract address
    token_symbol VARCHAR(10) DEFAULT 'RRT', -- Royalty Revenue Token symbol
    token_name VARCHAR(255), -- Token name
    total_supply BIGINT NOT NULL, -- Total token supply (in wei/smallest unit)
    creator_address VARCHAR(42) NOT NULL, -- Original creator
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transaction_hash VARCHAR(66), -- Creation transaction hash
    block_number BIGINT,
    UNIQUE(asset_id, ip_id),
    UNIQUE(token_address)
);

-- Royalty Token Holdings
-- Tracks who owns how many tokens (for fractional ownership)
CREATE TABLE IF NOT EXISTS royalty_token_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id UUID NOT NULL REFERENCES royalty_tokens(id) ON DELETE CASCADE,
    holder_address VARCHAR(42) NOT NULL, -- Token holder wallet address
    balance BIGINT NOT NULL DEFAULT 0, -- Token balance (in wei/smallest unit)
    percentage DECIMAL(10,6) NOT NULL, -- Ownership percentage (0-100)
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token_id, holder_address)
);

-- Royalty Distributions
-- Tracks when royalties are distributed from derivative works
CREATE TABLE IF NOT EXISTS royalty_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id UUID NOT NULL REFERENCES royalty_tokens(id) ON DELETE CASCADE,
    source_ip_id VARCHAR(255), -- IP that generated the royalty (derivative work)
    source_asset_id UUID REFERENCES assets(id), -- Asset that generated royalty
    amount_wei BIGINT NOT NULL, -- Total royalty amount distributed
    currency VARCHAR(10) DEFAULT 'USDC',
    distribution_tx_hash VARCHAR(66), -- Story Protocol distribution transaction
    block_number BIGINT,
    distributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Royalty Distribution Recipients
-- Individual payouts to each token holder
CREATE TABLE IF NOT EXISTS royalty_distribution_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distribution_id UUID NOT NULL REFERENCES royalty_distributions(id) ON DELETE CASCADE,
    recipient_address VARCHAR(42) NOT NULL,
    amount_wei BIGINT NOT NULL, -- Amount received by this recipient
    percentage DECIMAL(10,6) NOT NULL, -- Share percentage
    transaction_hash VARCHAR(66), -- On-chain transfer transaction (if separate)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_royalty_tokens_asset_id ON royalty_tokens(asset_id);
CREATE INDEX IF NOT EXISTS idx_royalty_tokens_ip_id ON royalty_tokens(ip_id);
CREATE INDEX IF NOT EXISTS idx_royalty_tokens_token_address ON royalty_tokens(token_address);
CREATE INDEX IF NOT EXISTS idx_royalty_holdings_token_id ON royalty_token_holdings(token_id);
CREATE INDEX IF NOT EXISTS idx_royalty_holdings_holder ON royalty_token_holdings(holder_address);
CREATE INDEX IF NOT EXISTS idx_royalty_distributions_token_id ON royalty_distributions(token_id);
CREATE INDEX IF NOT EXISTS idx_royalty_distributions_source ON royalty_distributions(source_ip_id);
CREATE INDEX IF NOT EXISTS idx_royalty_recipients_distribution ON royalty_distribution_recipients(distribution_id);
CREATE INDEX IF NOT EXISTS idx_royalty_recipients_recipient ON royalty_distribution_recipients(recipient_address);

