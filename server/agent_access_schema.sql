-- Agent访问层数据库Schema（增量更新）

-- 检查agents表是否存在api_key字段，不存在则添加
ALTER TABLE agents ADD COLUMN api_key TEXT;
ALTER TABLE agents ADD COLUMN email TEXT;
ALTER TABLE agents ADD COLUMN total_spent INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN last_active_at DATETIME;

-- 创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);

-- Agent Webhooks
CREATE TABLE IF NOT EXISTS agent_webhooks (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    url TEXT NOT NULL,
    events TEXT,
    secret TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- 为任务表添加Agent相关字段
ALTER TABLE tasks ADD COLUMN created_by_agent INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN agent_id TEXT;
ALTER TABLE tasks ADD COLUMN callback_url TEXT;
ALTER TABLE tasks ADD COLUMN error_message TEXT;

-- Skill测试用例表
CREATE TABLE IF NOT EXISTS skill_test_cases (
    id TEXT PRIMARY KEY,
    skill_id TEXT,
    name TEXT,
    input TEXT,
    expected_output TEXT,
    passed INTEGER,
    actual_output TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (skill_id) REFERENCES skills(id)
);

-- Agent使用统计
CREATE TABLE IF NOT EXISTS agent_usage_logs (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    skill_id TEXT,
    task_id TEXT,
    input_size INTEGER,
    output_size INTEGER,
    execution_time_ms INTEGER,
    cost INTEGER,
    success BOOLEAN,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (skill_id) REFERENCES skills(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_callback ON tasks(callback_url);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_usage_logs(agent_id);

-- 更新现有系统Agent，添加api_key
UPDATE agents SET api_key = 'agent_system_key_dev_001' WHERE id = 'agent_dev_system_001';
UPDATE agents SET api_key = 'agent_system_key_scheduler_001' WHERE id = 'agent_scheduler_001';
UPDATE agents SET api_key = 'agent_system_key_executor_001' WHERE id = 'agent_executor_001';
UPDATE agents SET api_key = 'agent_system_key_reviewer_001' WHERE id = 'agent_reviewer_001';

-- 插入示例外部Agent（用于测试）
INSERT OR IGNORE INTO agents (id, name, description, email, api_key, type, capabilities) VALUES 
('agent_moltbook_demo', 'Moltbook Connector', 'Demo agent from Moltbook ecosystem', 'demo@moltbook.ai', 'agent_demo_moltbook_001', 'external', '["skill_discovery", "task_execution", "webhook_handling"]');

