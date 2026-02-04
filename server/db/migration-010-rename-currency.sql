-- Migration 010: Rename A2C to MP (Marketplace Points)
-- Date: 2026-02-04
--
-- This migration renames the platform virtual currency from A2C (A2A Coin) to MP (Marketplace Points)
-- to avoid conflicts with existing cryptocurrency names and clarify that this is a points system.
--
-- IMPORTANT: Run this migration BEFORE deploying code changes.
-- This migration is idempotent and can be run multiple times safely.

-- ============================================
-- Strategy: INSERT new -> UPDATE references -> DELETE old
-- (Cannot directly UPDATE primary key with foreign key references)
-- ============================================

BEGIN;

-- 1. First, INSERT the new 'MP' currency by copying from 'A2C' (if A2C exists and MP doesn't)
INSERT INTO currencies (code, name, symbol, type, decimals, is_active, exchange_rate_to_base, min_deposit, min_withdraw, withdraw_fee_rate, created_at, updated_at)
SELECT 'MP', 'Marketplace Points', 'MP', type, decimals, is_active, exchange_rate_to_base, min_deposit, min_withdraw, withdraw_fee_rate, created_at, NOW()
FROM currencies
WHERE code = 'A2C'
  AND NOT EXISTS (SELECT 1 FROM currencies WHERE code = 'MP');

-- 2. Update all wallets' currency_code from A2C to MP
UPDATE wallets SET currency_code = 'MP' WHERE currency_code = 'A2C';

-- 3. Update wallet_transactions currency_code
UPDATE wallet_transactions SET currency_code = 'MP' WHERE currency_code = 'A2C';

-- 4. Update payment_orders currency_code
UPDATE payment_orders SET currency_code = 'MP' WHERE currency_code = 'A2C';

-- 5. Update exchange_rates (if any)
UPDATE exchange_rates SET from_currency = 'MP' WHERE from_currency = 'A2C';
UPDATE exchange_rates SET to_currency = 'MP' WHERE to_currency = 'A2C';

-- 6. Now delete the old 'A2C' currency (no more references)
DELETE FROM currencies WHERE code = 'A2C';

-- 7. Update platform wallet ID
UPDATE wallets SET id = 'wallet_platform_mp' WHERE id = 'wallet_platform_a2c';

COMMIT;

-- ============================================
-- Verify the migration
-- ============================================
-- Run these queries to verify:
-- SELECT * FROM currencies WHERE code IN ('A2C', 'MP');
-- SELECT COUNT(*) FROM wallets WHERE currency_code = 'A2C';  -- Should be 0
-- SELECT COUNT(*) FROM wallets WHERE currency_code = 'MP';   -- Should be > 0
-- SELECT id FROM wallets WHERE id LIKE 'wallet_platform%';
