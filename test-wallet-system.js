/**
 * A2A Wallet System Test Suite
 *
 * Tests the complete wallet system including:
 * - Currency management
 * - Wallet creation and balance operations
 * - Task payment flow with wallet integration
 * - Transaction history
 *
 * Run with: node test-wallet-system.js
 */

const path = require('path');

const DatabaseWrapper = require('./server/db');
const CurrencyService = require('./server/services/currencyService');
const WalletService = require('./server/services/walletService');
const { ManualPaymentProvider } = require('./server/services/paymentProvider');

// Test database path
const dbPath = path.join(__dirname, 'server', 'database.sqlite');

console.log('='.repeat(60));
console.log('A2A Wallet System Test Suite');
console.log('='.repeat(60));
console.log('');

// Initialize database
const db = new DatabaseWrapper(dbPath);

// Test results tracking
let passed = 0;
let failed = 0;

function test(name, fn) {
  return new Promise(async (resolve) => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
      resolve(true);
    } catch (error) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
      resolve(false);
    }
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function runTests() {
  console.log('Running tests...\n');

  const currencyService = new CurrencyService(db);
  const walletService = new WalletService(db);

  // ==================== Currency Tests ====================
  console.log('--- Currency Service Tests ---\n');

  await test('Get all currencies', async () => {
    const currencies = await currencyService.getAllCurrencies();
    assert(Array.isArray(currencies), 'Should return an array');
    assert(currencies.length >= 1, 'Should have at least one currency');
  });

  await test('Get active currencies', async () => {
    const currencies = await currencyService.getActiveCurrencies();
    assert(currencies.length >= 1, 'Should have at least one active currency');
    assert(currencies.every(c => c.is_active === 1), 'All should be active');
  });

  await test('Get specific currency (A2C)', async () => {
    const a2c = await currencyService.getCurrency('A2C');
    assert(a2c, 'A2C currency should exist');
    assert(a2c.code === 'A2C', 'Code should be A2C');
    assert(a2c.symbol === '₳', 'Symbol should be ₳');
    assert(a2c.type === 'virtual', 'Type should be virtual');
  });

  await test('Check currency active status', async () => {
    const isActive = await currencyService.isCurrencyActive('A2C');
    assert(isActive === true, 'A2C should be active');

    const cnyActive = await currencyService.isCurrencyActive('CNY');
    assert(cnyActive === false, 'CNY should be inactive by default');
  });

  await test('Get exchange rate (same currency)', async () => {
    const rate = await currencyService.getExchangeRate('A2C', 'A2C');
    assert(rate === 1.0, 'Same currency rate should be 1.0');
  });

  await test('Format amount', async () => {
    const formatted = await currencyService.formatAmount(100.50, 'A2C');
    assert(formatted === '₳100.50', 'Should format with symbol');
  });

  await test('Validate amount', async () => {
    const valid = await currencyService.validateAmount(100.50, 'A2C');
    assert(valid.valid === true, 'Valid amount should pass');

    const invalid = await currencyService.validateAmount(100.555, 'A2C');
    assert(invalid.valid === false, 'Too many decimals should fail');
  });

  console.log('');

  // ==================== Wallet Tests ====================
  console.log('--- Wallet Service Tests ---\n');

  // Create test IDs
  const testClientId = 'test_client_' + Date.now();
  const testAgentId = 'test_agent_' + Date.now();

  await test('Create client wallet', async () => {
    const wallet = await walletService.createWallet(testClientId, 'client', 'A2C');
    assert(wallet, 'Wallet should be created');
    assert(wallet.owner_id === testClientId, 'Owner ID should match');
    assert(wallet.balance === 0, 'Initial balance should be 0');
  });

  await test('Get wallet by owner', async () => {
    const wallet = await walletService.getWallet(testClientId, 'A2C');
    assert(wallet, 'Should find wallet');
    assert(wallet.owner_id === testClientId, 'Owner should match');
  });

  await test('Get or create wallet (existing)', async () => {
    const wallet = await walletService.getOrCreateWallet(testClientId, 'client', 'A2C');
    assert(wallet, 'Should return existing wallet');
  });

  await test('Get or create wallet (new)', async () => {
    const wallet = await walletService.getOrCreateWallet(testAgentId, 'agent', 'A2C');
    assert(wallet, 'Should create new wallet');
    assert(wallet.owner_id === testAgentId, 'Owner should match');
  });

  await test('Get all wallets for owner', async () => {
    const wallets = await walletService.getAllWallets(testClientId);
    assert(Array.isArray(wallets), 'Should return array');
    assert(wallets.length >= 1, 'Should have at least one wallet');
  });

  console.log('');

  // ==================== Balance Operation Tests ====================
  console.log('--- Balance Operation Tests ---\n');

  let clientWallet = await walletService.getWallet(testClientId, 'A2C');

  await test('Add balance (deposit)', async () => {
    const result = await walletService.addBalance(
      clientWallet.id,
      1000,
      'deposit',
      'Test deposit',
      {}
    );
    assert(result.success, 'Should succeed');
    assert(result.balance_after === 1000, 'Balance should be 1000');
  });

  await test('Get balance', async () => {
    const balance = await walletService.getBalance(clientWallet.id);
    assert(balance.available === 1000, 'Available should be 1000');
    assert(balance.frozen === 0, 'Frozen should be 0');
  });

  await test('Freeze balance', async () => {
    const result = await walletService.freezeBalance(clientWallet.id, 300, null, 'Test freeze');
    assert(result.success, 'Should succeed');
    assert(result.frozen_amount === 300, 'Should freeze 300');

    const balance = await walletService.getBalance(clientWallet.id);
    assert(balance.available === 700, 'Available should be 700');
    assert(balance.frozen === 300, 'Frozen should be 300');
  });

  await test('Unfreeze balance', async () => {
    const result = await walletService.unfreezeBalance(clientWallet.id, 100, null, 'Partial unfreeze');
    assert(result.success, 'Should succeed');

    const balance = await walletService.getBalance(clientWallet.id);
    assert(balance.available === 800, 'Available should be 800');
    assert(balance.frozen === 200, 'Frozen should be 200');
  });

  await test('Consume frozen balance', async () => {
    const result = await walletService.consumeFrozenBalance(
      clientWallet.id,
      100,
      'task_payment',
      'Test payment',
      {}
    );
    assert(result.success, 'Should succeed');

    const balance = await walletService.getBalance(clientWallet.id);
    assert(balance.frozen === 100, 'Frozen should be 100');
  });

  await test('Deduct balance (insufficient)', async () => {
    try {
      await walletService.deductBalance(clientWallet.id, 10000, 'test', 'Should fail', {});
      assert(false, 'Should have thrown');
    } catch (e) {
      assert(e.message.includes('Insufficient'), 'Should be insufficient balance error');
    }
  });

  await test('Deduct balance (success)', async () => {
    const result = await walletService.deductBalance(
      clientWallet.id,
      200,
      'withdraw',
      'Test withdraw',
      {}
    );
    assert(result.success, 'Should succeed');

    const balance = await walletService.getBalance(clientWallet.id);
    assert(balance.available === 600, 'Available should be 600');
  });

  console.log('');

  // ==================== Transfer Tests ====================
  console.log('--- Transfer Tests ---\n');

  let agentWallet = await walletService.getWallet(testAgentId, 'A2C');

  await test('Transfer between wallets', async () => {
    const result = await walletService.transfer(
      clientWallet.id,
      agentWallet.id,
      100,
      'Test transfer'
    );
    assert(result.success, 'Should succeed');

    const clientBalance = await walletService.getBalance(clientWallet.id);
    const agentBalance = await walletService.getBalance(agentWallet.id);

    assert(clientBalance.available === 500, 'Client should have 500');
    assert(agentBalance.available === 100, 'Agent should have 100');
  });

  console.log('');

  // ==================== Transaction History Tests ====================
  console.log('--- Transaction History Tests ---\n');

  await test('Get transaction history', async () => {
    const history = await walletService.getTransactionHistory(clientWallet.id, { limit: 10 });
    assert(Array.isArray(history), 'Should return array');
    assert(history.length > 0, 'Should have transactions');
  });

  await test('Get wallet stats', async () => {
    const stats = await walletService.getWalletStats(testClientId, 'A2C');
    assert(stats, 'Should return stats');
    assert(stats.balance.available === 500, 'Available balance should match');
  });

  console.log('');

  // ==================== Task Payment Flow Tests ====================
  console.log('--- Task Payment Flow Tests ---\n');

  // Refresh wallets
  clientWallet = await walletService.getWallet(testClientId, 'A2C');
  agentWallet = await walletService.getWallet(testAgentId, 'A2C');

  const testTaskId = 'test_task_' + Date.now();
  const taskBudget = 100;

  await test('Freeze for task', async () => {
    const result = await walletService.freezeForTask(testClientId, testTaskId, taskBudget, 'A2C');
    assert(result.success, 'Should succeed');

    const balance = await walletService.getBalance(clientWallet.id);
    // Original 500 - 100 (for task) + 100 remaining frozen = should be 400 + 200 frozen
    assert(balance.frozen >= taskBudget, 'Should have frozen amount for task');
  });

  await test('Process task payment', async () => {
    const result = await walletService.processTaskPayment(
      testClientId,
      testAgentId,
      testTaskId,
      taskBudget,
      null,  // no judge
      'A2C'
    );

    assert(result.task_id === testTaskId, 'Task ID should match');
    assert(result.distributions.length >= 2, 'Should have at least 2 distributions (client, agent)');

    // Verify agent got 70%
    const agentDist = result.distributions.find(d => d.party === 'agent');
    assert(agentDist.amount === 70, 'Agent should receive 70');
  });

  await test('Get task transactions', async () => {
    const txs = await walletService.getTaskTransactions(testTaskId);
    assert(txs.length >= 2, 'Should have at least 2 transactions for task');
  });

  console.log('');

  // ==================== Payment Provider Tests ====================
  console.log('--- Payment Provider Tests ---\n');

  const paymentProvider = new ManualPaymentProvider(db);

  await test('Create deposit order', async () => {
    const result = await paymentProvider.createDeposit(500, 'A2C', {
      wallet_id: clientWallet.id,
      user_id: testClientId,
      remark: 'Test deposit order'
    });
    assert(result.success, 'Should succeed');
    assert(result.order_id, 'Should have order ID');
    assert(result.status === 'pending', 'Status should be pending');
  });

  await test('Create withdraw order', async () => {
    const result = await paymentProvider.createWithdraw(100, 'A2C', 'test_bank_123', {
      wallet_id: clientWallet.id,
      user_id: testClientId,
      method: 'bank',
      remark: 'Test withdrawal'
    });
    assert(result.success, 'Should succeed');
    assert(result.order_id, 'Should have order ID');
    assert(result.status === 'pending', 'Status should be pending');
  });

  await test('Get pending orders', async () => {
    const orders = await paymentProvider.getPendingOrders();
    assert(Array.isArray(orders), 'Should return array');
    assert(orders.length >= 2, 'Should have at least 2 pending orders');
  });

  console.log('');

  // ==================== Summary ====================
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('');

  if (failed > 0) {
    console.log('❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
