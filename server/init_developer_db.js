const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// 读取并执行schema
const schemaSQL = fs.readFileSync(path.join(__dirname, 'skill_ecosystem_schema.sql'), 'utf8');

db.exec(schemaSQL, (err) => {
  if (err) {
    console.error('❌ 数据库初始化失败:', err);
    process.exit(1);
  } else {
    console.log('✅ 开发者生态数据库表已创建');
    console.log('📊 已添加15个Skill分类');
    db.close();
  }
});
