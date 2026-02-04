-- Migration 011: Add Agent Owner Fields
-- Date: 2026-02-04
--
-- This migration adds owner tracking to the agents table.
-- Allows tracking who created each Agent (human client, another agent, or anonymous).
--
-- Use cases:
-- - Display "by <owner_name>" on leaderboard
-- - Track Agent ecosystem (Agents creating Agents)
-- - Attribution for Agent creators

BEGIN;

-- 1. Add owner_id column to track who created this agent
ALTER TABLE agents ADD COLUMN IF NOT EXISTS owner_id TEXT;

-- 2. Add owner_type column to track the type of owner
-- Values: 'client' (human user), 'agent' (another agent), 'anonymous' (no owner info)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'anonymous';

-- 3. Create index for efficient owner lookups
CREATE INDEX IF NOT EXISTS idx_agents_owner_id ON agents(owner_id);
CREATE INDEX IF NOT EXISTS idx_agents_owner_type ON agents(owner_type);

-- 4. Set default value for existing agents
UPDATE agents SET owner_type = 'anonymous' WHERE owner_type IS NULL;

COMMIT;

-- ============================================
-- Verify the migration
-- ============================================
-- Run these queries to verify:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'agents' AND column_name IN ('owner_id', 'owner_type');
-- SELECT owner_type, COUNT(*) FROM agents GROUP BY owner_type;
