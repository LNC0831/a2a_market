/**
 * PostgreSQL Database Adapter
 *
 * Provides the same interface as SQLiteAdapter but uses PostgreSQL.
 * Uses the 'pg' library for PostgreSQL connections.
 */

const { Pool } = require('pg');

class PostgresAdapter {
  constructor(connectionString) {
    this.type = 'postgres';
    this.pool = new Pool({
      connectionString: connectionString,
      max: 20,                    // Maximum number of clients
      idleTimeoutMillis: 30000,   // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000  // Return error after 2 seconds if no connection
    });

    // Test connection
    this.pool.query('SELECT NOW()')
      .then(() => console.log('[DB] PostgreSQL connected'))
      .catch(err => console.error('[DB] PostgreSQL connection error:', err.message));
  }

  /**
   * Convert SQLite-style placeholders (?) to PostgreSQL ($1, $2, etc.)
   */
  _convertPlaceholders(sql) {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  }

  /**
   * Convert SQLite datetime functions to PostgreSQL
   */
  _convertSql(sql) {
    let converted = sql
      // datetime('now') → NOW()
      .replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()')
      // datetime('now', '+X hours') → NOW() + INTERVAL 'X hours'
      .replace(/datetime\s*\(\s*'now'\s*,\s*'([^']+)'\s*\)/gi, (match, interval) => {
        return `NOW() + INTERVAL '${interval}'`;
      })
      // INSERT OR IGNORE → INSERT INTO (PostgreSQL will error on conflict, but we handle it)
      .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO')
      // json_extract(column, '$.key') → (column::json->>'key')
      .replace(/json_extract\s*\(\s*(\w+)\s*,\s*'\$\.(\w+)'\s*\)/gi, "($1::json->>'$2')")
      // CURRENT_TIMESTAMP (already compatible)
      // INTEGER PRIMARY KEY → SERIAL PRIMARY KEY (for auto-increment)
      // Note: This is mainly for schema, not queries
      .replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
      // SQLite's IFNULL → COALESCE (COALESCE is standard SQL, works in both)
      .replace(/\bIFNULL\s*\(/gi, 'COALESCE(');

    // Convert placeholders
    converted = this._convertPlaceholders(converted);

    return converted;
  }

  /**
   * Execute INSERT/UPDATE/DELETE query
   */
  async run(sql, params = [], callback) {
    const convertedSql = this._convertSql(sql);
    const actualParams = Array.isArray(params) ? params : [params];

    try {
      const result = await this.pool.query(convertedSql, actualParams);
      const context = {
        changes: result.rowCount,
        lastInsertRowid: result.rows[0]?.id || null
      };

      if (callback) {
        callback.call(context, null);
      }
      return context;
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  }

  /**
   * Execute SELECT query, return single row
   */
  async get(sql, params = [], callback) {
    const convertedSql = this._convertSql(sql);
    const actualParams = Array.isArray(params) ? params : [params];

    try {
      const result = await this.pool.query(convertedSql, actualParams);
      const row = result.rows[0] || null;

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
  async all(sql, params = [], callback) {
    const convertedSql = this._convertSql(sql);
    const actualParams = Array.isArray(params) ? params : [params];

    try {
      const result = await this.pool.query(convertedSql, actualParams);

      if (callback) callback(null, result.rows);
      return result.rows;
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  }

  /**
   * Execute raw SQL (multiple statements)
   */
  async exec(sql, callback) {
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(s => s.trim());

    try {
      for (const stmt of statements) {
        if (stmt.trim()) {
          const convertedSql = this._convertSql(stmt);
          await this.pool.query(convertedSql);
        }
      }

      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
  }

  /**
   * Serialize operations (for compatibility, just execute the function)
   */
  serialize(fn) {
    if (fn) fn();
  }

  /**
   * Prepare a statement (returns a statement-like object)
   */
  prepare(sql) {
    const self = this;
    const convertedSql = this._convertSql(sql);

    return {
      run: async (...params) => {
        const callback = typeof params[params.length - 1] === 'function' ? params.pop() : null;
        const actualParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;

        try {
          const result = await self.pool.query(convertedSql, actualParams);
          const context = { changes: result.rowCount };
          if (callback) callback.call(context, null);
          return context;
        } catch (err) {
          if (callback) callback(err);
          else throw err;
        }
      },
      get: async (...params) => {
        const callback = typeof params[params.length - 1] === 'function' ? params.pop() : null;
        const actualParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;

        try {
          const result = await self.pool.query(convertedSql, actualParams);
          const row = result.rows[0] || null;
          if (callback) callback(null, row);
          return row;
        } catch (err) {
          if (callback) callback(err);
          else throw err;
        }
      },
      all: async (...params) => {
        const callback = typeof params[params.length - 1] === 'function' ? params.pop() : null;
        const actualParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;

        try {
          const result = await self.pool.query(convertedSql, actualParams);
          if (callback) callback(null, result.rows);
          return result.rows;
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
  async beginTransaction() {
    const client = await this.pool.connect();
    await client.query('BEGIN');

    return {
      commit: async () => {
        await client.query('COMMIT');
        client.release();
      },
      rollback: async () => {
        await client.query('ROLLBACK');
        client.release();
      },
      query: async (sql, params) => {
        const convertedSql = this._convertSql(sql);
        return client.query(convertedSql, params);
      }
    };
  }

  /**
   * Close all connections
   */
  async close() {
    await this.pool.end();
    console.log('[DB] PostgreSQL connection pool closed');
  }
}

module.exports = PostgresAdapter;
