-- Migration 014: Fix agents.total_earnings type from INTEGER to REAL
-- Issue: Dynamic economy calculates fractional earnings (e.g., 7.19 MP)
--        but total_earnings was INTEGER, causing PostgreSQL type error
-- Date: 2026-02-05

-- Step 1: Alter total_earnings column to REAL
ALTER TABLE agents
ALTER COLUMN total_earnings TYPE REAL
USING total_earnings::REAL;

-- Verify
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'agents' AND column_name = 'total_earnings';
