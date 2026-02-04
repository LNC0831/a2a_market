-- Migration 008: A2C Dynamic Economy System
-- Date: 2026-02-04

-- ============================================
-- Economy Log Table (Daily Economic Snapshots)
-- ============================================
CREATE TABLE IF NOT EXISTS economy_log (
    id TEXT PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    sigma DECIMAL(6,3) NOT NULL,            -- Smoothed supply ratio (EMA)
    sigma_raw DECIMAL(6,3),                  -- Raw supply ratio before smoothing
    daily_regen INTEGER NOT NULL,           -- Calculated daily regeneration R
    burn_rate DECIMAL(4,3) NOT NULL,        -- Calculated burn rate B
    active_users INTEGER NOT NULL,          -- Number of active users
    total_active_a2c DECIMAL(12,2),         -- Total A2C held by active users
    total_supply DECIMAL(12,2),             -- Total A2C in circulation
    total_minted DECIMAL(12,2) DEFAULT 0,   -- A2C minted today
    total_burned DECIMAL(12,2) DEFAULT 0,   -- A2C burned today
    status VARCHAR(20) NOT NULL,            -- healthy, inflated, deflated
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Settlements Table (Task Settlement Records with Dynamic Burn)
-- ============================================
CREATE TABLE IF NOT EXISTS settlements (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    task_price DECIMAL(12,2) NOT NULL,      -- Original task price
    agent_earning DECIMAL(12,2) NOT NULL,   -- Amount agent received (price * (1-B))
    burned DECIMAL(12,2) NOT NULL,          -- Amount burned (price * B)
    burn_rate DECIMAL(4,3) NOT NULL,        -- Burn rate at settlement time
    sigma_at_settlement DECIMAL(6,3) NOT NULL, -- Sigma value at settlement time
    judge_reward DECIMAL(12,2) DEFAULT 0,   -- Fixed judge reward (if applicable)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- ============================================
-- Alter Existing Tables
-- ============================================

-- Add registration bonus tracking to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS registration_bonus_granted INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- Add registration bonus tracking to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS registration_bonus_granted INTEGER DEFAULT 0;

-- Add source column to tasks (user vs platform)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'user';

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_economy_log_date ON economy_log(date);
CREATE INDEX IF NOT EXISTS idx_settlements_task ON settlements(task_id);
CREATE INDEX IF NOT EXISTS idx_settlements_created ON settlements(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source);

-- ============================================
-- Add burn transaction type support in wallet
-- ============================================
-- Note: The wallet_transactions table already supports various types
-- We'll use 'burn' as a new transaction type for destroyed A2C

-- ============================================
-- Migration Complete
-- ============================================
