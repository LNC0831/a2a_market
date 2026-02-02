const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function init() {
  console.log('🔄 Initializing Agent Contributor tables...');
  
  // 创建表
  db.run(`CREATE TABLE IF NOT EXISTS agent_contributions (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    contribution_type TEXT,
    target_id TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS agent_earnings (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    task_id TEXT,
    skill_id TEXT,
    amount INTEGER,
    earning_type TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME
  )`);
  
  // 添加列到tasks表
  db.run(`ALTER TABLE tasks ADD COLUMN assigned_agent_id TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.log('Column may exist');
  });
  db.run(`ALTER TABLE tasks ADD COLUMN claimed_by_agent INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.log('Column may exist');
  });
  db.run(`ALTER TABLE tasks ADD COLUMN claimed_at DATETIME`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.log('Column may exist');
  });
  db.run(`ALTER TABLE tasks ADD COLUMN completed_by_agent INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.log('Column may exist');
  });
  db.run(`ALTER TABLE tasks ADD COLUMN execution_time_ms INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.log('Column may exist');
  });
  
  // 创建索引
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent ON tasks(assigned_agent_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_claimed ON tasks(claimed_by_agent)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_agent_earnings_agent ON agent_earnings(agent_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_agent_contributions_agent ON agent_contributions(agent_id)`);
  
  console.log('✅ Agent Contributor tables initialized!');
  db.close();
}

init();
