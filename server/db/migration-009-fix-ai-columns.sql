-- Migration 009: Fix missing AI Judge columns
-- Date: 2026-02-04
-- Description: Add AI Judge columns that were defined in Phase 7 design but
--              accidentally commented out in migration 006.
--
-- Background:
--   - Phase 7 (ReviewOrchestrator) designed these columns for progressive activation
--   - Migration 006_ai_features.sql had ALTER TABLE statements commented out
--   - This caused "[AIJudge] Failed to save result" errors in production
--
-- These columns are essential for:
--   - V1: Storing AI Judge evaluation results
--   - V2+: Comparing AI scores with external judge reviews
--   - Progressive activation: ai_judge_confidence determines Tier 2 escalation

-- AI Judge evaluation columns
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_judge_score INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_judge_passed INTEGER DEFAULT 1;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_judge_confidence REAL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_judge_details TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_judge_metadata TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_judged_at TIMESTAMP;

-- Create index for querying tasks by AI judge status
CREATE INDEX IF NOT EXISTS idx_tasks_ai_judge_score ON tasks(ai_judge_score);
CREATE INDEX IF NOT EXISTS idx_tasks_ai_judge_passed ON tasks(ai_judge_passed);

-- Verification query (run after migration to confirm):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'tasks' AND column_name LIKE 'ai_judge%';
