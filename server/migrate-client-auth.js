/**
 * 客户认证系统数据库迁移脚本
 *
 * 添加密码字段支持人类用户账号密码登录
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log('开始迁移客户认证系统...\n');

// 检查并添加 clients 表的密码字段
const clientColumns = [
  { name: 'password_hash', sql: "ALTER TABLE clients ADD COLUMN password_hash TEXT" },
  { name: 'last_login_at', sql: "ALTER TABLE clients ADD COLUMN last_login_at DATETIME" },
  { name: 'login_attempts', sql: "ALTER TABLE clients ADD COLUMN login_attempts INTEGER DEFAULT 0" },
  { name: 'locked_until', sql: "ALTER TABLE clients ADD COLUMN locked_until DATETIME" }
];

console.log('检查 clients 表认证字段...');
for (const col of clientColumns) {
  try {
    const info = db.prepare("PRAGMA table_info(clients)").all();
    const exists = info.some(c => c.name === col.name);

    if (!exists) {
      db.exec(col.sql);
      console.log(`  ✅ 添加列: clients.${col.name}`);
    } else {
      console.log(`  ⏩ 列已存在: clients.${col.name}`);
    }
  } catch (err) {
    console.log(`  ❌ 添加列 ${col.name} 失败: ${err.message}`);
  }
}

db.close();

console.log('\n✅ 客户认证系统数据库迁移完成！');
