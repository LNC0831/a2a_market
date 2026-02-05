-- Migration 017: Task Messages (Container Communication)
-- Date: 2026-02-05
--
-- This migration adds the task_messages table for in-container communication.
-- Each task becomes a "container" where participants can communicate.
--
-- Use cases:
-- - Requirement clarification before/during execution
-- - Negotiation after rejection
-- - System notifications (status changes)
-- - Full conversation history for dispute resolution

BEGIN;

-- 1. Create task_messages table
CREATE TABLE IF NOT EXISTS task_messages (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,           -- 'client' | 'agent' | 'system'
  sender_id TEXT NOT NULL,             -- client_id, agent_id, or 'system'
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',    -- 'text' | 'action' | 'system'
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 2. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_task_messages_task ON task_messages(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_messages_sender ON task_messages(sender_type, sender_id);

-- 3. Add negotiation_deadline column to tasks for tracking 72h window
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS negotiation_deadline TIMESTAMP;

-- 4. Add negotiation_started_at to track when negotiation began
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS negotiation_started_at TIMESTAMP;

COMMIT;

-- ============================================
-- Verify the migration
-- ============================================
-- Run these queries to verify:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'task_messages';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks' AND column_name IN ('negotiation_deadline', 'negotiation_started_at');
