-- Migration 012: Fix economy_log column name
-- Date: 2026-02-05
-- Issue: Column was named total_active_a2c but code uses total_active_mp

-- Add the correct column if it doesn't exist
ALTER TABLE economy_log ADD COLUMN IF NOT EXISTS total_active_mp DECIMAL(12,2);

-- Copy data from old column to new column (if old column has data)
UPDATE economy_log SET total_active_mp = total_active_a2c WHERE total_active_mp IS NULL AND total_active_a2c IS NOT NULL;

-- Migration Complete
