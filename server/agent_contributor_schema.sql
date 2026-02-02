-- Agent贡献者系统数据库Schema

-- Agent贡献记录表
CREATE TABLE IF NOT EXISTS agent_contributions (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    contribution_type TEXT,  -- 'skill_submitted', 'task_completed', 'review_performed'
    target_id TEXT,
    metadata TEXT,  -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Agent收入记录表
CREATE TABLE IF NOT EXISTS agent_earnings (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    task_id TEXT,
    skill_id TEXT,
    amount INTEGER,  -- 分成金额（分）
    earning_type TEXT,  -- 'skill_usage', 'task_completion'
    status TEXT DEFAULT 'pending',  -- pending, paid
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- 为skills表添加Agent贡献相关字段
-- （这些字段可能已经存在，如果不存在则添加）

-- 为tasks表添加Agent接单相关字段
ALTER TABLE tasks ADD COLUMN assigned_agent_id TEXT;
ALTER TABLE tasks ADD COLUMN claimed_by_agent INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN claimed_at DATETIME;
ALTER TABLE tasks ADD COLUMN completed_by_agent INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN execution_time_ms INTEGER;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_claimed ON tasks(claimed_by_agent);
CREATE INDEX IF NOT EXISTS idx_agent_earnings_agent ON agent_earnings(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_contributions_agent ON agent_contributions(agent_id);

