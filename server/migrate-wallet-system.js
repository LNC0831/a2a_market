/**
 * A2A Wallet System Migration Script
 *
 * This script creates the new wallet system tables and migrates existing data.
 * Run with: node server/migrate-wallet-system.js
 */

const path = require('path');
const Database = require('better-sqlite3');

// Database path
const dbPath = path.join(__dirname, 'database.sqlite');

console.log('='.repeat(60));
console.log('A2A Wallet System Migration');
console.log('='.repeat(60));
console.log(`Database: ${dbPath}`);
console.log('');

// Open database
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Transaction wrapper
function runMigration() {
  const transaction = db.transaction(() => {
    console.log('[1/6] Creating currencies table...');
    createCurrenciesTable();

    console.log('[2/6] Creating wallets table...');
    createWalletsTable();

    console.log('[3/6] Creating wallet_transactions table...');
    createWalletTransactionsTable();

    console.log('[4/6] Creating payment_orders table...');
    createPaymentOrdersTable();

    console.log('[5/6] Creating exchange_rates table...');
    createExchangeRatesTable();

    console.log('[6/6] Migrating existing data...');
    migrateExistingData();

    console.log('');
    console.log('Migration completed successfully!');
  });

  try {
    transaction();
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  }
}

// 1. Create currencies table
function createCurrenciesTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS currencies (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      symbol TEXT,
      type TEXT NOT NULL,
      decimals INTEGER DEFAULT 2,
      is_active INTEGER DEFAULT 1,
      exchange_rate_to_base REAL,
      min_deposit REAL DEFAULT 0,
      min_withdraw REAL DEFAULT 0,
      withdraw_fee_rate REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert initial currencies
  const insertCurrency = db.prepare(`
    INSERT OR IGNORE INTO currencies
    (code, name, symbol, type, decimals, is_active, exchange_rate_to_base, min_deposit, min_withdraw, withdraw_fee_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Marketplace Points - Active virtual currency
  insertCurrency.run('MP', 'Marketplace Points', '₳', 'virtual', 2, 1, 1.0, 0, 10, 0);

  // CNY - Reserved for fiat (inactive)
  insertCurrency.run('CNY', '人民币', '¥', 'fiat', 2, 0, 1.0, 10, 100, 0.01);

  // USD - Reserved for fiat (inactive)
  insertCurrency.run('USD', 'US Dollar', '$', 'fiat', 2, 0, 7.2, 1, 10, 0.01);

  // BTC - Reserved for crypto (inactive)
  insertCurrency.run('BTC', 'Bitcoin', '₿', 'crypto', 8, 0, 500000, 0.0001, 0.001, 0.0005);

  // ETH - Reserved for crypto (inactive)
  insertCurrency.run('ETH', 'Ethereum', 'Ξ', 'crypto', 8, 0, 25000, 0.001, 0.01, 0.001);

  console.log('  - Currencies table created with initial data');
}

// 2. Create wallets table
function createWalletsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      owner_type TEXT NOT NULL,
      currency_code TEXT NOT NULL,
      balance REAL DEFAULT 0,
      frozen_balance REAL DEFAULT 0,
      total_deposited REAL DEFAULT 0,
      total_withdrawn REAL DEFAULT 0,
      total_earned REAL DEFAULT 0,
      total_spent REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(owner_id, currency_code),
      FOREIGN KEY (currency_code) REFERENCES currencies(code)
    );
  `);

  // Create indexes for faster lookup
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_wallets_owner ON wallets(owner_id, owner_type);
    CREATE INDEX IF NOT EXISTS idx_wallets_currency ON wallets(currency_code);
  `);

  console.log('  - Wallets table created with indexes');
}

// 3. Create wallet_transactions table
function createWalletTransactionsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_before REAL NOT NULL,
      balance_after REAL NOT NULL,
      currency_code TEXT NOT NULL,

      related_tx_id TEXT,
      related_task_id TEXT,
      related_order_id TEXT,

      counterparty_id TEXT,
      counterparty_type TEXT,

      status TEXT DEFAULT 'completed',

      description TEXT,
      metadata TEXT,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,

      FOREIGN KEY (wallet_id) REFERENCES wallets(id),
      FOREIGN KEY (currency_code) REFERENCES currencies(code)
    );
  `);

  // Create indexes for transaction queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet ON wallet_transactions(wallet_id);
    CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON wallet_transactions(type);
    CREATE INDEX IF NOT EXISTS idx_wallet_tx_status ON wallet_transactions(status);
    CREATE INDEX IF NOT EXISTS idx_wallet_tx_task ON wallet_transactions(related_task_id);
    CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON wallet_transactions(created_at);
  `);

  console.log('  - Wallet transactions table created with indexes');
}

// 4. Create payment_orders table
function createPaymentOrdersTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_orders (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency_code TEXT NOT NULL,

      payment_provider TEXT,
      provider_order_id TEXT,
      provider_response TEXT,

      withdraw_address TEXT,
      withdraw_method TEXT,

      status TEXT DEFAULT 'pending',

      fee_amount REAL DEFAULT 0,
      net_amount REAL,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      completed_at DATETIME,

      remark TEXT,
      admin_note TEXT,

      FOREIGN KEY (wallet_id) REFERENCES wallets(id)
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_payment_orders_wallet ON payment_orders(wallet_id);
    CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
    CREATE INDEX IF NOT EXISTS idx_payment_orders_type ON payment_orders(type);
  `);

  console.log('  - Payment orders table created with indexes');
}

// 5. Create exchange_rates table
function createExchangeRatesTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id TEXT PRIMARY KEY,
      from_currency TEXT NOT NULL,
      to_currency TEXT NOT NULL,
      rate REAL NOT NULL,
      source TEXT,
      valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
      valid_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_currency) REFERENCES currencies(code),
      FOREIGN KEY (to_currency) REFERENCES currencies(code)
    );
  `);

  // Create index for rate lookup
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(from_currency, to_currency);
  `);

  console.log('  - Exchange rates table created with indexes');
}

// 6. Migrate existing data
function migrateExistingData() {
  const { v4: uuidv4 } = require('uuid');

  // Get all existing agents with earnings
  const agents = db.prepare(`
    SELECT id, total_earnings FROM agents WHERE total_earnings > 0
  `).all();

  console.log(`  - Found ${agents.length} agents with earnings to migrate`);

  // Create wallets for agents with earnings
  const insertWallet = db.prepare(`
    INSERT OR IGNORE INTO wallets
    (id, owner_id, owner_type, currency_code, balance, total_earned, created_at, updated_at)
    VALUES (?, ?, 'agent', 'MP', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  const insertTx = db.prepare(`
    INSERT INTO wallet_transactions
    (id, wallet_id, type, amount, balance_before, balance_after, currency_code,
     counterparty_type, status, description, created_at, completed_at)
    VALUES (?, ?, 'migration', ?, 0, ?, 'MP', 'platform', 'completed',
            'Migration from legacy earnings', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  let migratedCount = 0;
  for (const agent of agents) {
    const walletId = `wallet_${uuidv4()}`;
    const earnings = agent.total_earnings || 0;

    insertWallet.run(walletId, agent.id, earnings, earnings);
    insertTx.run(`tx_${uuidv4()}`, walletId, earnings, earnings);
    migratedCount++;
  }

  console.log(`  - Created ${migratedCount} agent wallets with migrated earnings`);

  // Get all existing clients
  const clients = db.prepare(`
    SELECT id FROM clients
  `).all();

  console.log(`  - Found ${clients.length} clients`);

  // Create wallets for clients (with 0 balance - they can deposit)
  const insertClientWallet = db.prepare(`
    INSERT OR IGNORE INTO wallets
    (id, owner_id, owner_type, currency_code, balance, created_at, updated_at)
    VALUES (?, ?, 'client', 'MP', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  let clientWalletCount = 0;
  for (const client of clients) {
    const walletId = `wallet_${uuidv4()}`;
    insertClientWallet.run(walletId, client.id);
    clientWalletCount++;
  }

  console.log(`  - Created ${clientWalletCount} client wallets`);

  // Create wallets for agents without earnings (if they don't have one yet)
  const agentsWithoutWallet = db.prepare(`
    SELECT a.id FROM agents a
    LEFT JOIN wallets w ON a.id = w.owner_id AND w.currency_code = 'MP'
    WHERE w.id IS NULL
  `).all();

  let newAgentWallets = 0;
  for (const agent of agentsWithoutWallet) {
    const walletId = `wallet_${uuidv4()}`;
    insertWallet.run(walletId, agent.id, 0, 0);
    newAgentWallets++;
  }

  console.log(`  - Created ${newAgentWallets} additional agent wallets`);

  // Create platform wallet for collecting fees
  const platformWalletId = 'wallet_platform_mp';
  db.prepare(`
    INSERT OR IGNORE INTO wallets
    (id, owner_id, owner_type, currency_code, balance, created_at, updated_at)
    VALUES (?, 'platform', 'platform', 'MP', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(platformWalletId);

  console.log('  - Created platform wallet');
}

// Run migration
try {
  runMigration();

  // Print summary
  console.log('');
  console.log('='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));

  const currencyCount = db.prepare('SELECT COUNT(*) as count FROM currencies').get().count;
  const walletCount = db.prepare('SELECT COUNT(*) as count FROM wallets').get().count;
  const txCount = db.prepare('SELECT COUNT(*) as count FROM wallet_transactions').get().count;

  console.log(`Currencies: ${currencyCount}`);
  console.log(`Wallets: ${walletCount}`);
  console.log(`Transactions: ${txCount}`);
  console.log('');
  console.log('Active currencies:');

  const activeCurrencies = db.prepare('SELECT code, name, symbol FROM currencies WHERE is_active = 1').all();
  for (const c of activeCurrencies) {
    console.log(`  ${c.symbol} ${c.code} - ${c.name}`);
  }

  console.log('');
  console.log('Reserved (inactive) currencies:');
  const inactiveCurrencies = db.prepare('SELECT code, name, symbol FROM currencies WHERE is_active = 0').all();
  for (const c of inactiveCurrencies) {
    console.log(`  ${c.symbol} ${c.code} - ${c.name}`);
  }

} catch (error) {
  console.error('');
  console.error('Migration failed!');
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}

console.log('');
console.log('Done!');
