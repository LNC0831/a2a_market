-- Migration 016: Performance Indexes for Earnings Endpoint
-- Fixes: Intermittent timeout on /api/hall/earnings due to slow queries
-- Date: 2026-02-05

-- Index for wallet currency and type filtering
-- Used by: EconomyEngine.getEconomyMetrics() for finding MP wallets
CREATE INDEX IF NOT EXISTS idx_wallet_currency_type
  ON wallets(currency_code, owner_type);

-- Index for wallet transaction date lookups
-- Used by: Active user detection (transactions in last N days)
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_date
  ON wallet_transactions(wallet_id, created_at DESC);

-- Index for tasks by agent and status
-- Used by: Agent earnings calculation
CREATE INDEX IF NOT EXISTS idx_tasks_agent_status
  ON tasks(agent_id, status);

-- Index for tasks by status (for open tasks listing)
CREATE INDEX IF NOT EXISTS idx_tasks_status
  ON tasks(status);
