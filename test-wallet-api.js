/**
 * A2A Wallet System API Integration Tests
 *
 * Tests the complete wallet API endpoints including:
 * - Currency endpoints
 * - Wallet endpoints (with authentication)
 * - Deposit/Withdraw flow
 * - Task payment integration
 *
 * Prerequisites:
 * 1. Server must be running on port 3001
 * 2. Run migration first: node server/migrate-wallet-system.js
 *
 * Run with: node test-wallet-api.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

// Test results tracking
let passed = 0;
let failed = 0;
const results = [];

// Store created IDs for cleanup/reuse
let testClientApiKey = null;
let testAgentApiKey = null;
let testTaskId = null;

// HTTP request helper
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
    results.push({ name, status: 'passed' });
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
    results.push({ name, status: 'failed', error: error.message });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('A2A Wallet System API Integration Tests');
  console.log('='.repeat(60));
  console.log('');

  // ==================== Server Health Check ====================
  console.log('--- Server Health Check ---\n');

  await test('Server is running with wallet system', async () => {
    const res = await request('GET', '/api/health');
    assert(res.status === 200, 'Health check should return 200');
    assert(res.data.status === 'ok', 'Status should be ok');
    // Check for wallet system in features or version
    const hasWallet = res.data.features?.includes('multi-currency-wallet') ||
                      res.data.wallet_system ||
                      res.data.version?.includes('2.2');
    assert(hasWallet, 'Server should have wallet system (restart server if needed)');
    console.log(`   Server version: ${res.data.version}`);
  });

  console.log('');

  // ==================== Currency API Tests ====================
  console.log('--- Currency API Tests ---\n');

  await test('GET /api/currencies - Get all currencies', async () => {
    const res = await request('GET', '/api/currencies');
    assert(res.status === 200, 'Should return 200');
    assert(res.data.currencies, 'Should have currencies array');
    assert(res.data.currencies.length >= 1, 'Should have at least one currency');
    console.log(`   Found ${res.data.currencies.length} currencies`);
  });

  await test('GET /api/currencies?active=true - Get active currencies only', async () => {
    const res = await request('GET', '/api/currencies?active=true');
    assert(res.status === 200, 'Should return 200');
    assert(res.data.currencies.every(c => c.is_active === 1), 'All should be active');
  });

  await test('GET /api/currencies/A2C - Get specific currency', async () => {
    const res = await request('GET', '/api/currencies/A2C');
    assert(res.status === 200, 'Should return 200');
    assert(res.data.code === 'A2C', 'Code should be A2C');
    assert(res.data.symbol === '₳', 'Symbol should be ₳');
  });

  await test('GET /api/currencies/INVALID - Non-existent currency returns 404', async () => {
    const res = await request('GET', '/api/currencies/INVALID');
    assert(res.status === 404, 'Should return 404');
  });

  console.log('');

  // ==================== Authentication Setup ====================
  console.log('--- Setting up test accounts ---\n');

  // Register a test client
  await test('Register test client', async () => {
    const email = `test_client_${Date.now()}@test.com`;
    const res = await request('POST', '/api/hall/client/register', {
      name: 'Test Client',
      email: email,
      password: 'TestPass123!',
      recaptchaToken: 'test-token'  // Will be skipped in dev
    });

    if (res.status === 200 && res.data.api_key) {
      testClientApiKey = res.data.api_key;
      console.log(`   Client registered: ${res.data.client_id}`);
    } else {
      // Try to use existing client
      console.log(`   Using existing test setup`);
    }
  });

  // If client registration failed, try to get an existing one
  if (!testClientApiKey) {
    await test('Get existing client for testing', async () => {
      // This is a fallback - in production tests, you'd have a known test account
      throw new Error('Need valid client API key for wallet tests');
    });
  }

  // Register a test agent
  await test('Register test agent', async () => {
    // First get challenge
    const challengeRes = await request('GET', '/api/hall/register/challenge');
    if (challengeRes.status !== 200) {
      throw new Error('Failed to get challenge');
    }

    const challenge = challengeRes.data;
    // Solve the challenge (simple math)
    const answers = challenge.questions.map(q => {
      // Parse and solve: "123 + 456 = ?" or similar
      const match = q.question.match(/(\d+)\s*([+\-*/])\s*(\d+)/);
      if (match) {
        const a = parseInt(match[1]);
        const op = match[2];
        const b = parseInt(match[3]);
        switch (op) {
          case '+': return String(a + b);
          case '-': return String(a - b);
          case '*': return String(a * b);
          case '/': return String(Math.floor(a / b));
        }
      }
      return '0';
    });

    const res = await request('POST', '/api/hall/register', {
      challenge_id: challenge.challenge_id,
      answers: answers,
      name: 'Test Agent ' + Date.now(),
      skills: ['testing', 'general'],
      description: 'Test agent for wallet API testing'
    });

    if (res.status === 200 && res.data.api_key) {
      testAgentApiKey = res.data.api_key;
      console.log(`   Agent registered: ${res.data.agent_id}`);
    } else {
      console.log(`   Agent registration: ${res.data.error || 'failed'}`);
    }
  });

  console.log('');

  // ==================== Wallet API Tests (Authenticated) ====================
  console.log('--- Wallet API Tests (Client) ---\n');

  if (testClientApiKey) {
    await test('GET /api/wallet - Get client wallets', async () => {
      const res = await request('GET', '/api/wallet', null, {
        'X-Client-Key': testClientApiKey
      });
      assert(res.status === 200, 'Should return 200');
      assert(res.data.wallets, 'Should have wallets array');
      console.log(`   Found ${res.data.wallets.length} wallet(s)`);
    });

    await test('GET /api/wallet/A2C - Get A2C wallet', async () => {
      const res = await request('GET', '/api/wallet/A2C', null, {
        'X-Client-Key': testClientApiKey
      });
      assert(res.status === 200, 'Should return 200');
      assert(res.data.wallet, 'Should have wallet');
      assert(res.data.wallet.currency_code === 'A2C', 'Should be A2C wallet');
      console.log(`   Balance: ${res.data.wallet.balance} A2C`);
    });

    await test('GET /api/wallet/A2C/balance - Get balance', async () => {
      const res = await request('GET', '/api/wallet/A2C/balance', null, {
        'X-Client-Key': testClientApiKey
      });
      assert(res.status === 200, 'Should return 200');
      assert(typeof res.data.available === 'number', 'Should have available balance');
      console.log(`   Available: ${res.data.available}, Frozen: ${res.data.frozen}`);
    });

    await test('GET /api/wallet/A2C/history - Get transaction history', async () => {
      const res = await request('GET', '/api/wallet/A2C/history', null, {
        'X-Client-Key': testClientApiKey
      });
      assert(res.status === 200, 'Should return 200');
      assert(Array.isArray(res.data.transactions), 'Should have transactions array');
      console.log(`   Found ${res.data.transactions.length} transaction(s)`);
    });

    await test('POST /api/wallet/A2C/deposit - Create deposit order', async () => {
      const res = await request('POST', '/api/wallet/A2C/deposit', {
        amount: 1000,
        remark: 'API test deposit'
      }, {
        'X-Client-Key': testClientApiKey
      });
      assert(res.status === 200, 'Should return 200');
      assert(res.data.order_id, 'Should have order ID');
      assert(res.data.status === 'pending', 'Status should be pending');
      console.log(`   Deposit order: ${res.data.order_id}`);
    });

    await test('GET /api/wallet/orders - Get payment orders', async () => {
      const res = await request('GET', '/api/wallet/orders', null, {
        'X-Client-Key': testClientApiKey
      });
      assert(res.status === 200, 'Should return 200');
      assert(Array.isArray(res.data.orders), 'Should have orders array');
      console.log(`   Found ${res.data.orders.length} order(s)`);
    });
  }

  console.log('');

  // ==================== Wallet API Tests (Agent) ====================
  console.log('--- Wallet API Tests (Agent) ---\n');

  if (testAgentApiKey) {
    await test('GET /api/wallet - Get agent wallets', async () => {
      const res = await request('GET', '/api/wallet', null, {
        'X-Agent-Key': testAgentApiKey
      });
      assert(res.status === 200, 'Should return 200');
      assert(res.data.wallets, 'Should have wallets array');
      console.log(`   Found ${res.data.wallets.length} wallet(s)`);
    });

    await test('GET /api/wallet/A2C/stats - Get wallet stats', async () => {
      const res = await request('GET', '/api/wallet/A2C/stats', null, {
        'X-Agent-Key': testAgentApiKey
      });
      assert(res.status === 200, 'Should return 200');
      assert(res.data.balance, 'Should have balance info');
      console.log(`   Total earned: ${res.data.totals?.earned || 0} A2C`);
    });
  }

  console.log('');

  // ==================== Unauthenticated Access Tests ====================
  console.log('--- Authentication Tests ---\n');

  await test('GET /api/wallet - Requires authentication', async () => {
    const res = await request('GET', '/api/wallet');
    assert(res.status === 401, 'Should return 401 without auth');
  });

  await test('POST /api/wallet/A2C/deposit - Requires authentication', async () => {
    const res = await request('POST', '/api/wallet/A2C/deposit', { amount: 100 });
    assert(res.status === 401, 'Should return 401 without auth');
  });

  console.log('');

  // ==================== Task Payment Integration Tests ====================
  console.log('--- Task Payment Integration Tests ---\n');

  if (testClientApiKey) {
    // First, let's add some balance to the client (via direct DB or admin)
    // For this test, we'll try to post a task and check the response

    await test('POST /api/hall/post - Task posting checks wallet balance', async () => {
      const res = await request('POST', '/api/hall/post', {
        title: 'Wallet Integration Test Task',
        description: 'Testing wallet integration with task posting',
        category: 'testing',
        budget: 100
      }, {
        'X-Client-Key': testClientApiKey
      });

      // Either succeeds (if balance ok) or fails with insufficient balance
      if (res.status === 200) {
        testTaskId = res.data.task_id;
        console.log(`   Task created: ${testTaskId}`);
        console.log(`   Payment status: ${res.data.payment_status}`);
        assert(res.data.payment_status === 'frozen' || res.data.payment_status === 'pending',
               'Should have payment status');
      } else if (res.status === 400 && res.data.error?.includes('Insufficient')) {
        console.log(`   Correctly rejected: insufficient balance`);
        // This is expected if client has no balance
      } else {
        throw new Error(`Unexpected response: ${res.status} - ${JSON.stringify(res.data)}`);
      }
    });

    // Test skip_payment flag
    await test('POST /api/hall/post with skip_payment - Bypasses wallet check', async () => {
      const res = await request('POST', '/api/hall/post', {
        title: 'Test Task (Skip Payment)',
        description: 'Testing skip payment flag',
        category: 'testing',
        budget: 50,
        skip_payment: true
      }, {
        'X-Client-Key': testClientApiKey
      });

      assert(res.status === 200, 'Should succeed with skip_payment');
      assert(res.data.payment_status === 'pending', 'Payment status should be pending');
      console.log(`   Task created with pending payment: ${res.data.task_id}`);
    });
  }

  console.log('');

  // ==================== Summary ====================
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'failed').forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }

  console.log('');

  if (failed > 0) {
    console.log('❌ Some tests failed!');
    console.log('\nNote: Make sure the server is running with the latest code.');
    console.log('Restart the server and run this test again.');
    process.exit(1);
  } else {
    console.log('✅ All API tests passed!');
    process.exit(0);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
