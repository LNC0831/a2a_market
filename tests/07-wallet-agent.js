#!/usr/bin/env node
/**
 * 07-wallet-agent.js — Wallet & Economy (9 test cases)
 *
 * Tests wallet overview, MP balance, transaction history,
 * earnings endpoint, credit score, and authentication.
 */

const { request, registerAgent, test, assert, assertEqual, printSummary, sleep } = require('./shared/test-utils');

const ctx = {};

async function run() {
  console.log('\n=== 07: Wallet & Economy Agent (9 cases) ===\n');

  // Setup: register agent
  console.log('  [SETUP] Registering wallet test agent...');
  ctx.agent = await registerAgent('wallet', ['writing']);
  const headers = { 'X-Agent-Key': ctx.agent.api_key };
  console.log(`  [SETUP] Registered: ${ctx.agent.agent_id}\n`);

  await sleep(300);

  // 1. Wallet overview → MP wallet exists
  await test('1. Wallet overview → MP wallet exists', async () => {
    const res = await request('GET', '/api/wallet', null, headers);
    assertEqual(res.status, 200, 'Should return wallet overview');
    assert(res.data.wallets, 'Should have wallets array');
    assert(res.data.wallets.length > 0, 'Should have at least 1 wallet');

    const mpWallet = res.data.wallets.find(w =>
      w.currency === 'MP' || w.currency_code === 'MP'
    );
    assert(mpWallet, 'Should have MP wallet');
  });

  // 2. MP balance = 100 (registration bonus)
  await test('2. MP balance available = 100', async () => {
    const res = await request('GET', '/api/wallet/MP/balance', null, headers);
    assertEqual(res.status, 200, 'Should return balance');
    assertEqual(res.data.available, 100, 'Available should be 100 (registration bonus)');
  });

  // 3. Transaction history has entries
  await test('3. Transaction history has >= 1 entry', async () => {
    const res = await request('GET', '/api/wallet/MP/history', null, headers);
    assertEqual(res.status, 200, 'Should return history');
    assert(res.data.transactions, 'Should have transactions array');
    assert(res.data.transactions.length >= 1, 'Should have at least 1 transaction');
  });

  // 4. First transaction is registration bonus
  await test('4. First transaction is registration bonus (100 MP)', async () => {
    const res = await request('GET', '/api/wallet/MP/history', null, headers);
    assertEqual(res.status, 200, 'Should return history');

    const txns = res.data.transactions;
    assert(txns.length >= 1, 'Should have transactions');

    // The registration bonus should be in the list
    const bonusTxn = txns.find(t =>
      t.amount === 100 || (t.description && t.description.toLowerCase().includes('bonus'))
    );
    assert(bonusTxn, 'Should find registration bonus transaction');
  });

  // 5. History limit parameter works
  await test('5. History limit=1 returns <= 1 entry', async () => {
    const res = await request('GET', '/api/wallet/MP/history?limit=1', null, headers);
    assertEqual(res.status, 200, 'Should return history');
    assert(res.data.transactions.length <= 1, `Should return <= 1 txn, got ${res.data.transactions.length}`);
  });

  // 6. Earnings endpoint has current_rate and rate_range
  await test('6. Earnings → current_rate + rate_range', async () => {
    const res = await request('GET', '/api/hall/earnings', null, headers);
    assertEqual(res.status, 200, 'Should return earnings');
    assert(res.data.current_rate, 'Should have current_rate');
    assert(res.data.rate_range, 'Should have rate_range');
  });

  await sleep(300);

  // 7. Credit endpoint → credit_score + thresholds
  await test('7. Credit → credit_score + thresholds', async () => {
    const res = await request('GET', '/api/hall/credit', null, headers);
    assertEqual(res.status, 200, 'Should return credit');
    assert(res.data.credit_score !== undefined, 'Should have credit_score');
    assert(res.data.thresholds || res.data.level || res.data.rules, 'Should have thresholds, level, or rules');
  });

  // 8. No auth → 401
  await test('8. Wallet without auth → 401', async () => {
    const res = await request('GET', '/api/wallet');
    assertEqual(res.status, 401, 'Should return 401 without auth');
  });

  // 9. Frozen field initial = 0
  await test('9. Frozen balance initially 0', async () => {
    const res = await request('GET', '/api/wallet/MP/balance', null, headers);
    assertEqual(res.status, 200, 'Should return balance');
    assertEqual(res.data.frozen, 0, 'Frozen should be 0');
  });

  printSummary();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
