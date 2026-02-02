/**
 * 质量体系数据库迁移脚本
 *
 * 添加新的列和表以支持质量体系功能
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log('开始迁移数据库...\n');

// 检查并添加 tasks 表的新列
const taskColumns = [
  { name: 'rejection_count', sql: "ALTER TABLE tasks ADD COLUMN rejection_count INTEGER DEFAULT 0" },
  { name: 'resubmit_deadline', sql: "ALTER TABLE tasks ADD COLUMN resubmit_deadline DATETIME" },
  { name: 'auto_judge_score', sql: "ALTER TABLE tasks ADD COLUMN auto_judge_score INTEGER" },
  { name: 'auto_judge_passed', sql: "ALTER TABLE tasks ADD COLUMN auto_judge_passed INTEGER DEFAULT 1" }
];

console.log('检查 tasks 表...');
for (const col of taskColumns) {
  try {
    // 检查列是否存在
    const info = db.prepare("PRAGMA table_info(tasks)").all();
    const exists = info.some(c => c.name === col.name);

    if (!exists) {
      db.exec(col.sql);
      console.log(`  ✅ 添加列: tasks.${col.name}`);
    } else {
      console.log(`  ⏩ 列已存在: tasks.${col.name}`);
    }
  } catch (err) {
    console.log(`  ❌ 添加列 ${col.name} 失败: ${err.message}`);
  }
}

// 检查并添加 agents 表的新列
const agentColumns = [
  { name: 'credit_score', sql: "ALTER TABLE agents ADD COLUMN credit_score INTEGER DEFAULT 100" },
  { name: 'suspension_until', sql: "ALTER TABLE agents ADD COLUMN suspension_until DATETIME" },
  { name: 'suspension_reason', sql: "ALTER TABLE agents ADD COLUMN suspension_reason TEXT" },
  { name: 'timeout_count', sql: "ALTER TABLE agents ADD COLUMN timeout_count INTEGER DEFAULT 0" },
  { name: 'consecutive_rejections', sql: "ALTER TABLE agents ADD COLUMN consecutive_rejections INTEGER DEFAULT 0" }
];

console.log('\n检查 agents 表...');
for (const col of agentColumns) {
  try {
    const info = db.prepare("PRAGMA table_info(agents)").all();
    const exists = info.some(c => c.name === col.name);

    if (!exists) {
      db.exec(col.sql);
      console.log(`  ✅ 添加列: agents.${col.name}`);
    } else {
      console.log(`  ⏩ 列已存在: agents.${col.name}`);
    }
  } catch (err) {
    console.log(`  ❌ 添加列 ${col.name} 失败: ${err.message}`);
  }
}

// 检查并创建 agent_credit_history 表
console.log('\n检查 agent_credit_history 表...');
try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_credit_history'").get();

  if (!tables) {
    db.exec(`
      CREATE TABLE agent_credit_history (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        change_amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        task_id TEXT,
        balance_after INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      )
    `);
    console.log('  ✅ 创建表: agent_credit_history');
  } else {
    console.log('  ⏩ 表已存在: agent_credit_history');
  }
} catch (err) {
  console.log(`  ❌ 创建表失败: ${err.message}`);
}

// 为现有 agents 设置默认信用分
console.log('\n更新现有 agents 的信用分...');
try {
  const result = db.prepare("UPDATE agents SET credit_score = 100 WHERE credit_score IS NULL").run();
  console.log(`  ✅ 更新了 ${result.changes} 个 agents`);
} catch (err) {
  console.log(`  ❌ 更新失败: ${err.message}`);
}

db.close();

console.log('\n✅ 数据库迁移完成！');
