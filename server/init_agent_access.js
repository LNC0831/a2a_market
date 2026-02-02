const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// 辅助函数：安全地添加列
function addColumnIfNotExists(table, column, definition) {
  return new Promise((resolve, reject) => {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.log(`Note: Column ${column} may already exist`);
      }
      resolve();
    });
  });
}

// 辅助函数：安全地创建表
function createTableIfNotExists(name, definition) {
  return new Promise((resolve, reject) => {
    db.run(`CREATE TABLE IF NOT EXISTS ${name} (${definition})`, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function init() {
  try {
    console.log('🔄 Initializing Agent Access Layer...');
    
    // 添加列到agents表
    await addColumnIfNotExists('agents', 'api_key', 'TEXT');
    await addColumnIfNotExists('agents', 'email', 'TEXT');
    await addColumnIfNotExists('agents', 'total_spent', 'INTEGER DEFAULT 0');
    await addColumnIfNotExists('agents', 'last_active_at', 'DATETIME');
    console.log('✅ Updated agents table');
    
    // 添加列到tasks表
    await addColumnIfNotExists('tasks', 'created_by_agent', 'INTEGER DEFAULT 0');
    await addColumnIfNotExists('tasks', 'agent_id', 'TEXT');
    await addColumnIfNotExists('tasks', 'callback_url', 'TEXT');
    await addColumnIfNotExists('tasks', 'error_message', 'TEXT');
    console.log('✅ Updated tasks table');
    
    // 创建webhooks表
    await createTableIfNotExists('agent_webhooks', `
      id TEXT PRIMARY KEY,
      agent_id TEXT,
      url TEXT NOT NULL,
      events TEXT,
      secret TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    `);
    console.log('✅ Created agent_webhooks table');
    
    // 创建test_cases表
    await createTableIfNotExists('skill_test_cases', `
      id TEXT PRIMARY KEY,
      skill_id TEXT,
      name TEXT,
      input TEXT,
      expected_output TEXT,
      passed INTEGER,
      actual_output TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (skill_id) REFERENCES skills(id)
    `);
    console.log('✅ Created skill_test_cases table');
    
    // 创建usage_logs表
    await createTableIfNotExists('agent_usage_logs', `
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
    `);
    console.log('✅ Created agent_usage_logs table');
    
    // 创建索引
    db.run('CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_tasks_callback ON tasks(callback_url)');
    db.run('CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_usage_logs(agent_id)');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key)');
    console.log('✅ Created indexes');
    
    // 更新现有系统Agent
    db.run(`UPDATE agents SET api_key = 'agent_system_key_dev_001' WHERE id = 'agent_dev_system_001'`);
    db.run(`UPDATE agents SET api_key = 'agent_system_key_scheduler_001' WHERE id = 'agent_scheduler_001'`);
    db.run(`UPDATE agents SET api_key = 'agent_system_key_executor_001' WHERE id = 'agent_executor_001'`);
    db.run(`UPDATE agents SET api_key = 'agent_system_key_reviewer_001' WHERE id = 'agent_reviewer_001'`);
    console.log('✅ Updated system agents');
    
    // 插入示例外部Agent
    db.run(`INSERT OR IGNORE INTO agents (id, name, description, email, api_key, type, capabilities) 
            VALUES ('agent_moltbook_demo', 'Moltbook Connector', 'Demo agent from Moltbook ecosystem', 
            'demo@moltbook.ai', 'agent_demo_moltbook_001', 'external', 
            '["skill_discovery", "task_execution", "webhook_handling"]')`);
    console.log('✅ Inserted demo agent');
    
    console.log('\n🎉 Agent Access Layer initialized successfully!');
    console.log('📡 Agent-friendly APIs are ready');
    console.log('🤖 MCP protocol support enabled');
    
    db.close();
  } catch (err) {
    console.error('❌ Error:', err);
    db.close();
    process.exit(1);
  }
}

init();
