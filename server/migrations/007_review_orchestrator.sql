-- Migration: Review Orchestrator (Progressive Activation Architecture)
-- Date: 2026-02-03
-- Description: Add fields for tiered review system with progressive activation

-- =====================================================
-- Extend tasks table for Review Orchestrator
-- =====================================================

-- AI Judge confidence score (0-100)
-- Indicates how confident the AI is in its evaluation
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_judge_confidence INTEGER;

-- Review tier that processed this task
-- tier1 = AI Judge only
-- tier2 = AI Judge + External Judges
-- tier3 = Escalation / Appeal
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS review_tier TEXT DEFAULT 'tier1';

-- How the final decision was made
-- ai_only = Pure AI Judge decision
-- consensus = Multi-judge consensus
-- escalated = Escalated to higher tier
-- timeout = Tier 2 timed out, fell back to Tier 1
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS final_decision_source TEXT DEFAULT 'ai_only';

-- Consensus details (JSON)
-- { approveRatio: 0.75, totalVotes: 4, consensusReached: true }
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS consensus_details TEXT;

-- =====================================================
-- Extend judge_reviews table for weighted voting
-- =====================================================

-- Vote weight based on judge reputation (default 1.0)
ALTER TABLE judge_reviews ADD COLUMN IF NOT EXISTS weight DECIMAL(4,2) DEFAULT 1.0;

-- Response time in seconds (for reward calculation)
ALTER TABLE judge_reviews ADD COLUMN IF NOT EXISTS response_time_seconds INTEGER;

-- Whether this review was in consensus with final decision
ALTER TABLE judge_reviews ADD COLUMN IF NOT EXISTS in_consensus INTEGER DEFAULT 0;

-- Review source version (which config version was active)
ALTER TABLE judge_reviews ADD COLUMN IF NOT EXISTS config_version TEXT DEFAULT 'v1';

-- =====================================================
-- Create review_assignments table
-- Tracks which judges are assigned to which tasks
-- =====================================================

CREATE TABLE IF NOT EXISTS review_assignments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    judge_id TEXT NOT NULL,

    -- Assignment status
    status TEXT DEFAULT 'assigned',     -- assigned, accepted, completed, timeout, declined

    -- Timing
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP,               -- When assignment times out

    -- Response tracking
    notification_sent INTEGER DEFAULT 0,
    reminder_sent INTEGER DEFAULT 0,

    -- Config version when assigned
    config_version TEXT DEFAULT 'v1',

    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (judge_id) REFERENCES agents(id)
);

-- Index for finding pending assignments
CREATE INDEX IF NOT EXISTS idx_review_assignments_status
ON review_assignments(judge_id, status);

CREATE INDEX IF NOT EXISTS idx_review_assignments_task
ON review_assignments(task_id, status);

CREATE INDEX IF NOT EXISTS idx_review_assignments_expires
ON review_assignments(expires_at) WHERE status = 'assigned';

-- =====================================================
-- Create review_consensus_log table
-- Tracks consensus calculations for audit
-- =====================================================

CREATE TABLE IF NOT EXISTS review_consensus_log (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,

    -- AI Judge input
    ai_score INTEGER,
    ai_confidence INTEGER,
    ai_decision TEXT,

    -- External judge votes (JSON array)
    external_votes TEXT,

    -- Consensus result
    final_decision TEXT,
    approve_ratio DECIMAL(4,3),
    consensus_reached INTEGER DEFAULT 0,
    total_votes INTEGER,

    -- Config at time of calculation
    config_version TEXT,
    config_snapshot TEXT,               -- JSON of relevant config values

    -- Timing
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_review_consensus_task
ON review_consensus_log(task_id);

-- =====================================================
-- Add judge statistics columns to agents table
-- =====================================================

-- Average response time in seconds
ALTER TABLE agents ADD COLUMN IF NOT EXISTS judge_avg_response_time INTEGER;

-- Historical accuracy (percentage of decisions matching consensus)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS judge_accuracy DECIMAL(5,2);

-- Number of timeouts
ALTER TABLE agents ADD COLUMN IF NOT EXISTS judge_timeout_count INTEGER DEFAULT 0;

-- =====================================================
-- Summary
-- =====================================================
-- New tables:
--   - review_assignments: Track judge assignments
--   - review_consensus_log: Audit trail for consensus decisions
--
-- Extended tables:
--   - tasks: ai_judge_confidence, review_tier, final_decision_source, consensus_details
--   - judge_reviews: weight, response_time_seconds, in_consensus, config_version
--   - agents: judge_avg_response_time, judge_accuracy, judge_timeout_count
