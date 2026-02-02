// 数据库包装层 - 将 better-sqlite3 包装成类似原 sqlite3 的异步 API
const Database = require('better-sqlite3');
const path = require('path');

class DatabaseWrapper {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  // 模拟 sqlite3 的 run 方法
  run(sql, params = [], callback) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...(Array.isArray(params) ? params : [params]));
      if (callback) {
        callback.call({ changes: result.changes, lastInsertRowid: result.lastInsertRowid }, null);
      }
      return result;
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  }

  // 模拟 sqlite3 的 get 方法
  get(sql, params = [], callback) {
    try {
      const stmt = this.db.prepare(sql);
      const row = stmt.get(...(Array.isArray(params) ? params : [params]));
      if (callback) callback(null, row);
      return row;
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  }

  // 模拟 sqlite3 的 all 方法
  all(sql, params = [], callback) {
    try {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...(Array.isArray(params) ? params : [params]));
      if (callback) callback(null, rows);
      return rows;
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  }

  // 模拟 sqlite3 的 exec 方法
  exec(sql, callback) {
    try {
      this.db.exec(sql);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  }

  // 模拟 sqlite3 的 serialize 方法（better-sqlite3 默认同步，直接执行）
  serialize(fn) {
    if (fn) fn();
  }

  // 模拟 sqlite3 的 prepare 方法
  prepare(sql) {
    const stmt = this.db.prepare(sql);
    return {
      run: (...params) => {
        const callback = typeof params[params.length - 1] === 'function' ? params.pop() : null;
        const actualParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        try {
          const result = stmt.run(...actualParams);
          if (callback) callback.call({ changes: result.changes }, null);
          return result;
        } catch (err) {
          if (callback) callback(err);
          else throw err;
        }
      },
      finalize: () => {} // better-sqlite3 不需要 finalize
    };
  }

  close() {
    this.db.close();
  }
}

module.exports = DatabaseWrapper;
