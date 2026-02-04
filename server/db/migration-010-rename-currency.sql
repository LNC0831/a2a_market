-- Migration 010: Rename A2C to MP (Marketplace Points)
-- Date: 2026-02-04
--
-- This migration renames the platform virtual currency from A2C (A2A Coin) to MP (Marketplace Points)
-- to avoid conflicts with existing cryptocurrency names and clarify that this is a points system.
--
-- IMPORTANT: Run this migration BEFORE deploying code changes.
-- This migration is idempotent and can be run multiple times safely.

-- 1. Update currencies table
-- Check if A2C exists and MP doesn't, then update
UPDATE currencies SET
  code = 'MP',
  name = 'Marketplace Points',
  symbol = 'MP'
WHERE code = 'A2C'
  AND NOT EXISTS (SELECT 1 FROM currencies WHERE code = 'MP');

-- If somehow both exist (shouldn't happen), keep MP and delete A2C
DELETE FROM currencies WHERE code = 'A2C' AND EXISTS (SELECT 1 FROM currencies WHERE code = 'MP');

-- 2. Update all wallets' currency_code
UPDATE wallets SET currency_code = 'MP' WHERE currency_code = 'A2C';

-- 3. Update platform wallet ID
-- First check if the old wallet exists
UPDATE wallets SET id = 'wallet_platform_mp' WHERE id = 'wallet_platform_a2c';

-- 4. Update wallet_transactions currency_code
UPDATE wallet_transactions SET currency_code = 'MP' WHERE currency_code = 'A2C';

-- 5. Update payment_orders currency_code
UPDATE payment_orders SET currency_code = 'MP' WHERE currency_code = 'A2C';

-- 6. Update exchange_rates (if any)
UPDATE exchange_rates SET from_currency = 'MP' WHERE from_currency = 'A2C';
UPDATE exchange_rates SET to_currency = 'MP' WHERE to_currency = 'A2C';

-- Verify the migration
-- SELECT * FROM currencies WHERE code IN ('A2C', 'MP');
-- SELECT id FROM wallets WHERE id LIKE 'wallet_platform%';
