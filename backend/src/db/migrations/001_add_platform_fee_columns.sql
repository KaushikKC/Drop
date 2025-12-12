-- Migration: Add platform fee columns to payments table
-- This migration adds columns to track platform fees (5% of each payment)

-- Add platform fee columns to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS creator_amount_wei BIGINT,
ADD COLUMN IF NOT EXISTS platform_fee_wei BIGINT,
ADD COLUMN IF NOT EXISTS platform_fee_percentage DECIMAL(5,2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS platform_wallet_address VARCHAR(42),
ADD COLUMN IF NOT EXISTS platform_transaction_hash VARCHAR(66);

-- Update existing payments to have default values
-- For existing payments, assume they were 100% to creator (no platform fee)
UPDATE payments 
SET 
  creator_amount_wei = amount_wei,
  platform_fee_wei = 0,
  platform_fee_percentage = 0.00
WHERE creator_amount_wei IS NULL;

-- Add index for platform transaction hash lookups
CREATE INDEX IF NOT EXISTS idx_payments_platform_tx ON payments(platform_transaction_hash);

