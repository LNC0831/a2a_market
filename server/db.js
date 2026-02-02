/**
 * Database Adapter - Multi-database Support
 *
 * Supports both SQLite (development) and PostgreSQL (production).
 * Uses environment variables for configuration:
 *
 *   DB_TYPE: 'sqlite' (default) or 'postgres'
 *   DB_PATH: SQLite database file path (for sqlite)
 *   DATABASE_URL: PostgreSQL connection string (for postgres)
 *
 * Usage (backward compatible):
 *   const DatabaseWrapper = require('./db');
 *   const db = new DatabaseWrapper(dbPath);  // Uses SQLite
 *
 * Or with environment config:
 *   DB_TYPE=postgres DATABASE_URL=... node server.js
 */

const createDatabase = require('./db/index');

// Export factory function wrapped as a class constructor for backward compatibility
class DatabaseWrapper {
  constructor(dbPath) {
    const dbType = process.env.DB_TYPE || 'sqlite';

    if (dbType === 'postgres' || dbType === 'postgresql') {
      // Use PostgreSQL - ignore dbPath, use DATABASE_URL
      const adapter = createDatabase({ type: 'postgres' });

      // Copy all methods from adapter to this instance
      Object.assign(this, adapter);

      // Also copy methods from prototype
      const proto = Object.getPrototypeOf(adapter);
      Object.getOwnPropertyNames(proto).forEach(name => {
        if (name !== 'constructor' && typeof adapter[name] === 'function') {
          this[name] = adapter[name].bind(adapter);
        }
      });

      this.type = 'postgres';
      this._adapter = adapter;
    } else {
      // Use SQLite (default) - use dbPath
      const adapter = createDatabase({ type: 'sqlite', path: dbPath });

      // Copy all methods from adapter to this instance
      Object.assign(this, adapter);

      // Also copy methods from prototype
      const proto = Object.getPrototypeOf(adapter);
      Object.getOwnPropertyNames(proto).forEach(name => {
        if (name !== 'constructor' && typeof adapter[name] === 'function') {
          this[name] = adapter[name].bind(adapter);
        }
      });

      this.type = 'sqlite';
      this._adapter = adapter;
    }
  }
}

module.exports = DatabaseWrapper;
