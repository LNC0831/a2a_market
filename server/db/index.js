/**
 * Database Adapter Factory
 *
 * Supports both SQLite and PostgreSQL based on environment configuration.
 *
 * Environment Variables:
 *   DB_TYPE: 'sqlite' (default) or 'postgres'
 *   DB_PATH: SQLite database file path (for sqlite)
 *   DATABASE_URL: PostgreSQL connection string (for postgres)
 *
 * Usage:
 *   const createDatabase = require('./db');
 *   const db = createDatabase();
 */

const path = require('path');

function createDatabase(options = {}) {
  const dbType = options.type || process.env.DB_TYPE || 'sqlite';

  if (dbType === 'postgres' || dbType === 'postgresql') {
    const PostgresAdapter = require('./postgres-adapter');
    const connectionString = options.connectionString || process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
    }

    return new PostgresAdapter(connectionString);
  } else {
    // Default to SQLite
    const SQLiteAdapter = require('./sqlite-adapter');
    const dbPath = options.path || process.env.DB_PATH ||
                   path.join(__dirname, '..', 'database.sqlite');

    return new SQLiteAdapter(dbPath);
  }
}

module.exports = createDatabase;
