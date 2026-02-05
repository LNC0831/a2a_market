-- Migration 015: Fix wallets table column types from INTEGER to REAL
-- Issue: Dynamic economy produces fractional amounts (e.g., 10.84 MP)
--        but some wallet columns may be INTEGER in production
-- Date: 2026-02-05

-- Fix wallets table columns
ALTER TABLE wallets
ALTER COLUMN balance TYPE REAL USING balance::REAL,
ALTER COLUMN frozen_balance TYPE REAL USING frozen_balance::REAL,
ALTER COLUMN total_deposited TYPE REAL USING total_deposited::REAL,
ALTER COLUMN total_withdrawn TYPE REAL USING total_withdrawn::REAL,
ALTER COLUMN total_earned TYPE REAL USING total_earned::REAL,
ALTER COLUMN total_spent TYPE REAL USING total_spent::REAL;

-- Fix wallet_transactions table columns
ALTER TABLE wallet_transactions
ALTER COLUMN amount TYPE REAL USING amount::REAL,
ALTER COLUMN balance_before TYPE REAL USING balance_before::REAL,
ALTER COLUMN balance_after TYPE REAL USING balance_after::REAL;

-- Verify
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'wallets';
