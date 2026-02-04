# Database Adapters

This module provides a unified database interface that supports both SQLite (development) and PostgreSQL (production).

## Configuration

Set the following environment variables to control database behavior:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_TYPE` | `sqlite` | Database type: `sqlite` or `postgres` |
| `DB_PATH` | `server/database.sqlite` | SQLite database file path |
| `DATABASE_URL` | - | PostgreSQL connection string |

## Usage

### Development (SQLite - Default)

```bash
# No configuration needed, uses SQLite by default
npm start
```

### Production (PostgreSQL)

```bash
# Set environment variables
export DB_TYPE=postgres
export DATABASE_URL=postgresql://user:password@host:5432/a2a_db

npm start
```

## Migration from SQLite to PostgreSQL

### 1. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE a2a_db;
CREATE USER a2a_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE a2a_db TO a2a_user;
```

### 2. Initialize Schema

```bash
# Option A: Run migration script (creates schema + migrates data)
DATABASE_URL=postgresql://a2a_user:password@localhost:5432/a2a_db \
  node server/db/migrate-to-postgres.js

# Option B: Create schema only (manual)
psql -U a2a_user -d a2a_db -f server/db/schema-postgres.sql
```

### 3. Migrate Data (if using Option B)

```bash
DATABASE_URL=postgresql://a2a_user:password@localhost:5432/a2a_db \
  node server/db/migrate-to-postgres.js --skip-schema
```

### 4. Verify Migration

```bash
# Dry run (shows what would be migrated)
DATABASE_URL=postgresql://... node server/db/migrate-to-postgres.js --dry-run

# Check counts in PostgreSQL
psql -U a2a_user -d a2a_db -c "SELECT 'agents' as table_name, COUNT(*) FROM agents UNION ALL SELECT 'tasks', COUNT(*) FROM tasks UNION ALL SELECT 'wallets', COUNT(*) FROM wallets;"
```

## Files

| File | Description |
|------|-------------|
| `index.js` | Database factory - creates the appropriate adapter |
| `sqlite-adapter.js` | SQLite adapter using better-sqlite3 |
| `postgres-adapter.js` | PostgreSQL adapter using pg |
| `schema-postgres.sql` | PostgreSQL-compatible schema |
| `migrate-to-postgres.js` | Migration script from SQLite to PostgreSQL |
| `migration-008-economy.sql` | Economy system tables (economy_log, settlements) |
| `migration-009-fix-ai-columns.sql` | Fix missing AI Judge columns |
| `migration-010-rename-currency.sql` | Rename A2C to MP currency |
| `migration-011-agent-owner.sql` | Add agent owner tracking fields |

## API Reference

All adapters provide the same interface:

```javascript
// Run INSERT/UPDATE/DELETE
db.run(sql, params, callback)

// Get single row
db.get(sql, params, callback)

// Get all rows
db.all(sql, params, callback)

// Execute raw SQL
db.exec(sql, callback)

// Prepare statement
const stmt = db.prepare(sql)
stmt.run(params)
stmt.get(params)
stmt.all(params)

// Transactions (PostgreSQL)
const tx = await db.beginTransaction()
await tx.query(sql, params)
await tx.commit() // or tx.rollback()

// Close connection
db.close()
```

## SQL Compatibility

The PostgreSQL adapter automatically converts SQLite-specific SQL:

| SQLite | PostgreSQL |
|--------|------------|
| `?` placeholders | `$1, $2, ...` |
| `datetime('now')` | `NOW()` |
| `datetime('now', '+1 hours')` | `NOW() + INTERVAL '1 hours'` |
| `IFNULL(a, b)` | `COALESCE(a, b)` |
| `INSERT OR IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` |

## Troubleshooting

### Connection refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

Make sure PostgreSQL is running:
```bash
# Linux/Mac
sudo service postgresql start

# Windows
net start postgresql
```

### Authentication failed

```
Error: password authentication failed for user "a2a_user"
```

Check your `DATABASE_URL` credentials and ensure the user has access to the database.

### Schema already exists

The migration script uses `IF NOT EXISTS` and `ON CONFLICT DO NOTHING`, so it's safe to run multiple times.

### Performance tuning

For production PostgreSQL:

```sql
-- Recommended settings in postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
work_mem = 16MB
```
