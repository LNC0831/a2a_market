-- Migration: AI Features (AI Judge & AI Interviewer)
-- Date: 2026-02-03
-- Description: Add tables and columns for AI Judge and AI Interviewer features

-- =====================================================
-- AI Interview Sessions Table
-- Stores interview sessions for judge applications
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_interviews (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    category TEXT NOT NULL,               -- writing, coding, translation, general
    status TEXT DEFAULT 'in_progress',    -- in_progress, passed, failed, expired
    current_round INTEGER DEFAULT 1,
    max_rounds INTEGER DEFAULT 5,
    conversation TEXT,                    -- JSON array of conversation turns
    final_score INTEGER,                  -- 0-100
    assessment TEXT,                      -- AI's final assessment
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Index for querying pending interviews
CREATE INDEX IF NOT EXISTS idx_ai_interviews_agent_status
ON ai_interviews(agent_id, status);

-- =====================================================
-- Add AI Judge columns to tasks table
-- =====================================================

-- AI Judge evaluation fields (if not exists)
-- Note: Some databases don't support IF NOT EXISTS for ALTER COLUMN
-- So we'll handle this in code

-- For PostgreSQL, run these manually if needed:
-- ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_judge_score INTEGER;
-- ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_judge_passed INTEGER DEFAULT 1;
-- ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_judge_details TEXT;
-- ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_judge_metadata TEXT;
-- ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_judged_at TIMESTAMP;

-- =====================================================
-- AI Usage Statistics Table (optional)
-- Tracks AI API usage for cost monitoring
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id TEXT PRIMARY KEY,
    function_name TEXT NOT NULL,          -- ai_judge, ai_interviewer, etc.
    provider TEXT NOT NULL,               -- moonshot, openai, anthropic
    model TEXT NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,              -- Cost in USD
    execution_time_ms INTEGER,
    task_id TEXT,                         -- Related task (if any)
    agent_id TEXT,                        -- Related agent (if any)
    success INTEGER DEFAULT 1,            -- 1=success, 0=failed
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for usage analytics
CREATE INDEX IF NOT EXISTS idx_ai_usage_function
ON ai_usage_logs(function_name, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_usage_provider
ON ai_usage_logs(provider, created_at);

-- =====================================================
-- Password field for clients (if not exists)
-- This was added in auth phase but ensuring it exists
-- =====================================================

-- ALTER TABLE clients ADD COLUMN IF NOT EXISTS password_hash TEXT;
-- ALTER TABLE clients ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;
-- ALTER TABLE clients ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
