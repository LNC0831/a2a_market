#!/usr/bin/env node
/**
 * SQLite to PostgreSQL Data Migration Script
 *
 * This script migrates all data from SQLite to PostgreSQL.
 *
 * Prerequisites:
 *   1. PostgreSQL database is running and accessible
 *   2. DATABASE_URL environment variable is set
 *   3. SQLite database exists at server/database.sqlite
 *
 * Usage:
 *   DATABASE_URL=postgresql://user:pass@host:5432/dbname node server/db/migrate-to-postgres.js
 *
 * Options:
 *   --dry-run    Show what would be migrated without actually migrating
 *   --skip-schema Skip schema creation (if already created)
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

// Configuration
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'database.sqlite');
const DATABASE_URL = process.env.DATABASE_URL;
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_SCHEMA = process.argv.includes('--skip-schema');

// Tables to migrate in order (respecting foreign key dependencies)
const TABLES_TO_MIGRATE = [
  'currencies',
  'agents',
  'clients',
  'skills',
  'wallets',
  'tasks',
  'task_events',
  'agent_credit_history',
  'judge_exams',
  'judge_applications',
  'judge_reviews',
  'skill_calls',
  'transactions',
  'wallet_transactions',
  'payment_orders',
  'exchange_rates'
];

console.log('='.repeat(60));
console.log('SQLite to PostgreSQL Migration');
console.log('='.repeat(60));

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Example: DATABASE_URL=postgresql://user:pass@localhost:5432/a2a');
  process.exit(1);
}

if (!fs.existsSync(SQLITE_PATH)) {
  console.error(`ERROR: SQLite database not found at ${SQLITE_PATH}`);
  process.exit(1);
}

console.log(`SQLite: ${SQLITE_PATH}`);
console.log(`PostgreSQL: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
console.log(`Dry run: ${DRY_RUN}`);
console.log(`Skip schema: ${SKIP_SCHEMA}`);
console.log('');

async function main() {
  // Connect to databases
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pgPool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Test PostgreSQL connection
    console.log('[1/4] Testing PostgreSQL connection...');
    await pgPool.query('SELECT NOW()');
    console.log('  ✓ PostgreSQL connected\n');

    // Create schema
    if (!SKIP_SCHEMA) {
      console.log('[2/4] Creating PostgreSQL schema...');
      if (!DRY_RUN) {
        const schemaPath = path.join(__dirname, 'schema-postgres.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Split by semicolon and execute each statement
        const statements = schemaSql
          .split(';')
          .map(s => s.trim())
          .filter(s => s && !s.startsWith('--'));

        for (const stmt of statements) {
          try {
            await pgPool.query(stmt);
          } catch (err) {
            // Ignore "already exists" errors
            if (!err.message.includes('already exists')) {
              console.warn(`  Warning: ${err.message}`);
            }
          }
        }
      }
      console.log('  ✓ Schema created\n');
    } else {
      console.log('[2/4] Skipping schema creation\n');
    }

    // Migrate data
    console.log('[3/4] Migrating data...');
    const stats = {};

    for (const table of TABLES_TO_MIGRATE) {
      // Check if table exists in SQLite
      const tableExists = sqlite.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name=?
      `).get(table);

      if (!tableExists) {
        console.log(`  - ${table}: skipped (table not found in SQLite)`);
        stats[table] = { status: 'skipped', reason: 'not found' };
        continue;
      }

      // Get all rows from SQLite
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();

      if (rows.length === 0) {
        console.log(`  - ${table}: skipped (no data)`);
        stats[table] = { status: 'skipped', reason: 'no data' };
        continue;
      }

      // Get column names
      const columns = Object.keys(rows[0]);

      if (!DRY_RUN) {
        // Clear existing data in PostgreSQL (optional - comment out to preserve)
        // await pgPool.query(`DELETE FROM ${table}`);

        // Insert data with ON CONFLICT DO NOTHING
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const insertSql = `
          INSERT INTO ${table} (${columns.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT DO NOTHING
        `;

        let inserted = 0;
        for (const row of rows) {
          const values = columns.map(col => {
            const val = row[col];
            // Convert SQLite booleans (0/1) - PostgreSQL handles this
            return val;
          });

          try {
            const result = await pgPool.query(insertSql, values);
            if (result.rowCount > 0) inserted++;
          } catch (err) {
            console.error(`  Error inserting into ${table}:`, err.message);
            console.error('  Row:', JSON.stringify(row).substring(0, 100));
          }
        }

        console.log(`  - ${table}: ${inserted}/${rows.length} rows migrated`);
        stats[table] = { status: 'migrated', total: rows.length, inserted };
      } else {
        console.log(`  - ${table}: ${rows.length} rows would be migrated`);
        stats[table] = { status: 'dry-run', count: rows.length };
      }
    }

    console.log('');

    // Verify migration
    console.log('[4/4] Verifying migration...');
    if (!DRY_RUN) {
      for (const table of TABLES_TO_MIGRATE) {
        if (stats[table]?.status !== 'migrated') continue;

        const sqliteCount = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
        const pgResult = await pgPool.query(`SELECT COUNT(*) as count FROM ${table}`);
        const pgCount = parseInt(pgResult.rows[0].count);

        const match = sqliteCount === pgCount ? '✓' : '⚠';
        console.log(`  ${match} ${table}: SQLite=${sqliteCount}, PostgreSQL=${pgCount}`);
      }
    } else {
      console.log('  Skipped (dry run)');
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));

    const migrated = Object.values(stats).filter(s => s.status === 'migrated').length;
    const skipped = Object.values(stats).filter(s => s.status === 'skipped').length;
    const totalRows = Object.values(stats)
      .filter(s => s.status === 'migrated')
      .reduce((sum, s) => sum + (s.inserted || 0), 0);

    console.log(`Tables migrated: ${migrated}`);
    console.log(`Tables skipped: ${skipped}`);
    console.log(`Total rows migrated: ${totalRows}`);

    if (DRY_RUN) {
      console.log('');
      console.log('This was a dry run. Run without --dry-run to perform actual migration.');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    sqlite.close();
    await pgPool.end();
  }

  console.log('');
  console.log('Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
