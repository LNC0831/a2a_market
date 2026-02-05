-- Migration 013: Fix client authentication columns
-- Date: 2026-02-05
-- Issue: Column names mismatch between migration and code

-- Add login_attempts column (code uses this name, not failed_login_attempts)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;

-- Ensure locked_until exists
ALTER TABLE clients ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- Ensure last_login_at exists
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Copy data from failed_login_attempts if it exists and login_attempts is empty
UPDATE clients SET login_attempts = failed_login_attempts
WHERE login_attempts = 0 AND failed_login_attempts IS NOT NULL AND failed_login_attempts > 0;

-- Migration Complete
