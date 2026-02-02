/**
 * SQLite Database Adapter
 *
 * Wraps better-sqlite3 with a callback-style API.
 * This is the existing implementation moved to adapter pattern.
 */

const Database = require('better-sqlite3');

class SQLiteAdapter {
  constructor(dbPath) {
    this.type = 'sqlite';
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    console.log(`[DB] SQLite connected: ${dbPath}`);
  }

  /**
   * Execute INSERT/UPDATE/DELETE query
   */
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

  /**
   * Execute SELECT query, return single row
   */
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

  /**
   * Execute SELECT query, return all rows
   */
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

  /**
   * Execute raw SQL (multiple statements)
   */
  exec(sql, callback) {
    try {
      this.db.exec(sql);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  }

  /**
   * Serialize operations (SQLite is synchronous, so just execute)
   */
  serialize(fn) {
    if (fn) fn();
  }

  /**
   * Prepare a statement
   */
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
      get: (...params) => {
        const callback = typeof params[params.length - 1] === 'function' ? params.pop() : null;
        const actualParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        try {
          const row = stmt.get(...actualParams);
          if (callback) callback(null, row);
          return row;
        } catch (err) {
          if (callback) callback(err);
          else throw err;
        }
      },
      all: (...params) => {
        const callback = typeof params[params.length - 1] === 'function' ? params.pop() : null;
        const actualParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        try {
          const rows = stmt.all(...actualParams);
          if (callback) callback(null, rows);
          return rows;
        } catch (err) {
          if (callback) callback(err);
          else throw err;
        }
      },
      finalize: () => {}
    };
  }

  /**
   * Begin a transaction
   */
  beginTransaction() {
    return this.db.transaction;
  }

  /**
   * Close the database connection
   */
  close() {
    this.db.close();
    console.log('[DB] SQLite connection closed');
  }
}

module.exports = SQLiteAdapter;
