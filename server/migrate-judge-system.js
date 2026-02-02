/**
 * 裁判系统数据库迁移脚本
 *
 * 添加裁判系统相关的列和表
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log('开始迁移裁判系统数据库...\n');

// 检查并添加 tasks 表的裁判字段
const taskJudgeColumns = [
  { name: 'needs_judge_review', sql: "ALTER TABLE tasks ADD COLUMN needs_judge_review INTEGER DEFAULT 0" },
  { name: 'judge_id', sql: "ALTER TABLE tasks ADD COLUMN judge_id TEXT" },
  { name: 'judge_score', sql: "ALTER TABLE tasks ADD COLUMN judge_score INTEGER" },
  { name: 'judge_comment', sql: "ALTER TABLE tasks ADD COLUMN judge_comment TEXT" },
  { name: 'judge_decision', sql: "ALTER TABLE tasks ADD COLUMN judge_decision TEXT" },
  { name: 'judged_at', sql: "ALTER TABLE tasks ADD COLUMN judged_at DATETIME" }
];

console.log('检查 tasks 表裁判字段...');
for (const col of taskJudgeColumns) {
  try {
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

// 检查并添加 agents 表的裁判资格字段
const agentJudgeColumns = [
  { name: 'is_judge', sql: "ALTER TABLE agents ADD COLUMN is_judge INTEGER DEFAULT 0" },
  { name: 'judge_categories', sql: "ALTER TABLE agents ADD COLUMN judge_categories TEXT" },
  { name: 'judge_rating', sql: "ALTER TABLE agents ADD COLUMN judge_rating REAL DEFAULT 5.0" },
  { name: 'judge_total_reviews', sql: "ALTER TABLE agents ADD COLUMN judge_total_reviews INTEGER DEFAULT 0" },
  { name: 'judge_earnings', sql: "ALTER TABLE agents ADD COLUMN judge_earnings INTEGER DEFAULT 0" },
  { name: 'judge_qualified_at', sql: "ALTER TABLE agents ADD COLUMN judge_qualified_at DATETIME" }
];

console.log('\n检查 agents 表裁判资格字段...');
for (const col of agentJudgeColumns) {
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

// 创建 judge_exams 表
console.log('\n检查 judge_exams 表...');
try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='judge_exams'").get();

  if (!tables) {
    db.exec(`
      CREATE TABLE judge_exams (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        score INTEGER,
        pass_threshold INTEGER DEFAULT 80,
        questions TEXT,
        answers TEXT,
        correct_answers TEXT,
        started_at DATETIME,
        submitted_at DATETIME,
        graded_at DATETIME,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      )
    `);
    console.log('  ✅ 创建表: judge_exams');
  } else {
    console.log('  ⏩ 表已存在: judge_exams');
  }
} catch (err) {
  console.log(`  ❌ 创建表失败: ${err.message}`);
}

// 创建 judge_reviews 表
console.log('\n检查 judge_reviews 表...');
try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='judge_reviews'").get();

  if (!tables) {
    db.exec(`
      CREATE TABLE judge_reviews (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        judge_id TEXT NOT NULL,
        executor_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        decision TEXT NOT NULL,
        comment TEXT,
        criteria_scores TEXT,
        reward_amount INTEGER DEFAULT 0,
        reward_paid INTEGER DEFAULT 0,
        assigned_at DATETIME,
        submitted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (judge_id) REFERENCES agents(id),
        FOREIGN KEY (executor_id) REFERENCES agents(id)
      )
    `);
    console.log('  ✅ 创建表: judge_reviews');
  } else {
    console.log('  ⏩ 表已存在: judge_reviews');
  }
} catch (err) {
  console.log(`  ❌ 创建表失败: ${err.message}`);
}

// 创建 judge_applications 表
console.log('\n检查 judge_applications 表...');
try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='judge_applications'").get();

  if (!tables) {
    db.exec(`
      CREATE TABLE judge_applications (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        min_rating_met INTEGER DEFAULT 0,
        min_tasks_met INTEGER DEFAULT 0,
        min_credit_met INTEGER DEFAULT 0,
        exam_id TEXT,
        reviewed_by TEXT,
        review_comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME,
        FOREIGN KEY (agent_id) REFERENCES agents(id),
        FOREIGN KEY (exam_id) REFERENCES judge_exams(id)
      )
    `);
    console.log('  ✅ 创建表: judge_applications');
  } else {
    console.log('  ⏩ 表已存在: judge_applications');
  }
} catch (err) {
  console.log(`  ❌ 创建表失败: ${err.message}`);
}

db.close();

console.log('\n✅ 裁判系统数据库迁移完成！');
