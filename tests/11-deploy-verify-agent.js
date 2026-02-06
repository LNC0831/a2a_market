#!/usr/bin/env node
/**
 * 11-deploy-verify-agent.js — Deploy Verification + Coverage Expansion (20 test cases)
 *
 * Part A: Verify 4 API field fixes deployed in commit 36b559a (6 cases)
 *   - Browse tasks: currency field
 *   - Track: currency field
 *   - Wallet overview: frozen + available fields
 *   - Wallet history: total field
 *
 * Part B: New coverage for public endpoints (14 cases)
 *   - Economy system (5 cases)
 *   - Homepage display endpoints (3 cases)
 *   - Currency system (3 cases)
 *   - Cross-validation (3 cases)
 */

const { request, registerAgent, test, assert, assertEqual, printSummary, sleep, cleanupOpenTasks } = require('./shared/test-utils');

const ctx = {};

async function run() {
  console.log('\n=== 11: Deploy Verification + Coverage Expansion (20 cases) ===\n');

  // ============================================================
  // SETUP: Register agents and create a task flow for Part A
  // ============================================================

  console.log('  [SETUP] Registering agents...');
  ctx.poster = await registerAgent('dv_poster', ['writing']);
  ctx.worker = await registerAgent('dv_worker', ['writing']);

  const posterH = { 'X-Agent-Key': ctx.poster.api_key };
  const workerH = { 'X-Agent-Key': ctx.worker.api_key };

  await sleep(300);

  // Post a task
  const postRes = await request('POST', '/api/hall/post', {
    title: '[TEST] Deploy verify task',
    description: 'Write a detailed analysis of cloud-native application design patterns including service mesh, sidecar proxy, and circuit breaker implementations.',
    category: 'writing',
    budget: 10
  }, posterH);
  assert(postRes.status === 200, `Setup: post task failed: ${postRes.status}`);
  ctx.taskId = postRes.data.task_id;

  await sleep(300);

  // Claim the task
  const claimRes = await request('POST', `/api/hall/tasks/${ctx.taskId}/claim`, null, workerH);
  assert(claimRes.status === 200, `Setup: claim failed: ${claimRes.status}`);

  await sleep(300);

  // Submit the task
  const submitRes = await request('POST', `/api/hall/tasks/${ctx.taskId}/submit`, {
    result: 'Cloud-native application design patterns have become essential for building resilient, scalable distributed systems. The service mesh pattern uses a dedicated infrastructure layer to handle service-to-service communication, abstracting network concerns from application code. Sidecar proxies like Envoy intercept all network traffic, enabling features such as mutual TLS, load balancing, and observability without modifying the application. Circuit breaker patterns prevent cascading failures by detecting downstream service degradation and short-circuiting requests, allowing the system to fail gracefully and recover automatically. Together these patterns form the foundation of modern microservices architectures deployed on container orchestration platforms.'
  }, workerH);
  assert(submitRes.status === 200 && submitRes.data.success, `Setup: submit failed: ${submitRes.status}`);

  await sleep(300);

  // Accept the task to complete the lifecycle
  const acceptRes = await request('POST', `/api/hall/tasks/${ctx.taskId}/accept`, null, posterH);
  assert(acceptRes.status === 200, `Setup: accept failed: ${acceptRes.status}`);

  await sleep(300);
  console.log('  [SETUP] Task lifecycle complete\n');

  // ============================================================
  // PART A: Deploy Verification (6 cases)
  // ============================================================

  console.log('  --- Part A: Deploy Verification ---\n');

  // 1. Browse tasks has currency field
  await test('1. Browse tasks has currency field', async () => {
    // Post a fresh open task so browse has something
    const freshRes = await request('POST', '/api/hall/post', {
      title: '[TEST] Browse currency check',
      description: 'Analyze the evolution of programming language type systems from static to gradual typing approaches.',
      category: 'writing',
      budget: 5
    }, posterH);
    assertEqual(freshRes.status, 200, 'Should create task');

    await sleep(300);

    const browseRes = await request('GET', '/api/hall/tasks', null, workerH);
    assertEqual(browseRes.status, 200, 'Browse should return 200');
    assert(browseRes.data.tasks, 'Should have tasks array');
    assert(browseRes.data.tasks.length > 0, 'Should have at least 1 task');

    const taskWithCurrency = browseRes.data.tasks.find(t => t.currency);
    assert(taskWithCurrency, 'At least one task should have currency field');
    assertEqual(taskWithCurrency.currency, 'MP', 'Currency should be MP');
  });

  // 2. Track response has currency field
  await test('2. Track response has currency field', async () => {
    const trackRes = await request('GET', `/api/hall/track/${ctx.taskId}`);
    assertEqual(trackRes.status, 200, 'Track should return 200');
    assertEqual(trackRes.data.currency, 'MP', 'Track currency should be MP');
  });

  // 3. Wallet overview has frozen and available
  await test('3. Wallet overview has frozen and available', async () => {
    const walletRes = await request('GET', '/api/wallet', null, posterH);
    assertEqual(walletRes.status, 200, 'Wallet should return 200');
    assert(walletRes.data.wallets, 'Should have wallets array');

    const mpWallet = walletRes.data.wallets.find(w => w.currency_code === 'MP');
    assert(mpWallet, 'Should have MP wallet');
    assert(mpWallet.frozen !== undefined, 'MP wallet should have frozen field');
    assert(mpWallet.available !== undefined, 'MP wallet should have available field');
  });

  // 4. Wallet overview has no raw frozen_balance
  await test('4. Wallet overview normalized (no frozen_balance)', async () => {
    const walletRes = await request('GET', '/api/wallet', null, posterH);
    assertEqual(walletRes.status, 200, 'Wallet should return 200');

    const mpWallet = walletRes.data.wallets.find(w => w.currency_code === 'MP');
    assert(mpWallet, 'Should have MP wallet');
    // frozen_balance should be removed in favor of frozen
    assertEqual(mpWallet.frozen_balance, undefined, 'Should not have frozen_balance (use frozen instead)');
  });

  // 5. Wallet history has total field
  await test('5. Wallet history has total field', async () => {
    const histRes = await request('GET', '/api/wallet/MP/history', null, posterH);
    assertEqual(histRes.status, 200, 'History should return 200');
    assert(histRes.data.total !== undefined, 'History should have total field');
    assert(typeof histRes.data.total === 'number', 'Total should be a number');
  });

  // 6. Comprehensive field check
  await test('6. All deployed field fixes present', async () => {
    // Browse: currency
    const browseRes = await request('GET', '/api/hall/tasks', null, workerH);
    const hasTaskCurrency = browseRes.data.tasks && browseRes.data.tasks.some(t => t.currency === 'MP');

    // Track: currency
    const trackRes = await request('GET', `/api/hall/track/${ctx.taskId}`);
    const hasCurrency = trackRes.data.currency === 'MP';

    // Wallet: frozen + available
    const walletRes = await request('GET', '/api/wallet', null, posterH);
    const mpW = walletRes.data.wallets && walletRes.data.wallets.find(w => w.currency_code === 'MP');
    const hasFrozen = mpW && mpW.frozen !== undefined;
    const hasAvailable = mpW && mpW.available !== undefined;

    // History: total
    const histRes = await request('GET', '/api/wallet/MP/history', null, posterH);
    const hasTotal = histRes.data.total !== undefined;

    assert(hasTaskCurrency, 'Browse tasks should have currency=MP');
    assert(hasCurrency, 'Track should have currency=MP');
    assert(hasFrozen, 'Wallet should have frozen');
    assert(hasAvailable, 'Wallet should have available');
    assert(hasTotal, 'History should have total');
  });

  // ============================================================
  // PART B: Public Endpoint Coverage (14 cases)
  // ============================================================

  console.log('\n  --- Part B: Public Endpoint Coverage ---\n');

  // ---- Economy System (5 cases) ----

  // 7. Economy status
  await test('7. GET /api/economy/status → structure', async () => {
    const res = await request('GET', '/api/economy/status');
    assertEqual(res.status, 200, 'Status should return 200');

    assert(res.data.current, 'Should have current object');
    assert(res.data.current.sigma !== undefined, 'current should have sigma');
    assert(res.data.current.burn_rate !== undefined, 'current should have burn_rate');
    assert(res.data.current.agent_share_percent, 'current should have agent_share_percent');

    assert(res.data.metrics, 'Should have metrics object');
    assert(res.data.metrics.active_users !== undefined, 'metrics should have active_users');
    assert(res.data.metrics.total_active_mp !== undefined, 'metrics should have total_active_mp');

    assert(res.data.rewards, 'Should have rewards object');
    assert(res.data.timestamp, 'Should have timestamp');
  });

  // 8. Economy formula
  await test('8. GET /api/economy/formula → formulas + reference_table', async () => {
    const res = await request('GET', '/api/economy/formula');
    assertEqual(res.status, 200, 'Formula should return 200');

    assert(res.data.formulas, 'Should have formulas object');
    assert(res.data.parameters, 'Should have parameters object');
    assert(res.data.parameters.R_BASE !== undefined, 'parameters should have R_BASE');
    assert(res.data.parameters.B_BASE !== undefined, 'parameters should have B_BASE');

    assert(Array.isArray(res.data.reference_table), 'reference_table should be array');
    assert(res.data.reference_table.length > 0, 'reference_table should not be empty');

    assert(res.data.explanation, 'Should have explanation object');
  });

  // 9. Economy simulate with price
  await test('9. GET /api/economy/simulate?price=100 → settlement', async () => {
    const res = await request('GET', '/api/economy/simulate?price=100');
    assertEqual(res.status, 200, 'Simulate should return 200');

    assertEqual(res.data.input_price, 100, 'input_price should be 100');
    assert(res.data.settlement, 'Should have settlement object');
    assert(res.data.settlement.agent_earning !== undefined, 'settlement should have agent_earning');
    assert(res.data.settlement.burned !== undefined, 'settlement should have burned');
    assert(res.data.settlement.burn_rate !== undefined, 'settlement should have burn_rate');
    assert(res.data.note, 'Should have note');
  });

  // 10. Economy simulate without price → 400
  await test('10. GET /api/economy/simulate (no price) → 400', async () => {
    const res = await request('GET', '/api/economy/simulate');
    assertEqual(res.status, 400, 'Simulate without price should return 400');
  });

  // 11. Economy history
  await test('11. GET /api/economy/history → 200', async () => {
    const res = await request('GET', '/api/economy/history');
    assertEqual(res.status, 200, 'History should return 200');
    // May have empty history array on fresh systems, but structure should exist
    assert(res.data.history !== undefined || res.data.days_requested !== undefined || Array.isArray(res.data),
      'Should have history structure');
  });

  // ---- Homepage Display Endpoints (3 cases) ----

  // 12. Featured agents
  await test('12. GET /api/agents/featured → agents with heat_level', async () => {
    const res = await request('GET', '/api/agents/featured');
    assertEqual(res.status, 200, 'Featured should return 200');
    assert(Array.isArray(res.data.agents), 'Should have agents array');
    assert(res.data.total !== undefined, 'Should have total');

    if (res.data.agents.length > 0) {
      const agent = res.data.agents[0];
      assert(agent.id, 'Agent should have id');
      assert(agent.name, 'Agent should have name');
      assert(agent.heat_level !== undefined, 'Agent should have heat_level');
    }
  });

  // 13. Activity feed
  await test('13. GET /api/activity/recent → activities', async () => {
    const res = await request('GET', '/api/activity/recent');
    assertEqual(res.status, 200, 'Activity should return 200');
    assert(Array.isArray(res.data.activities), 'Should have activities array');
    assert(res.data.total !== undefined, 'Should have total');

    if (res.data.activities.length > 0) {
      const act = res.data.activities[0];
      assert(act.type, 'Activity should have type');
      assert(act.time, 'Activity should have time');
      assert(act.data, 'Activity should have data object');

      const validTypes = ['task_completed', 'five_star_rating', 'new_agent'];
      assert(validTypes.includes(act.type), `Activity type should be one of ${validTypes.join(', ')}, got: ${act.type}`);
    }
  });

  // 14. Completed tasks
  await test('14. GET /api/hall/tasks/completed → completed tasks', async () => {
    const res = await request('GET', '/api/hall/tasks/completed');
    assertEqual(res.status, 200, 'Completed should return 200');
    assert(Array.isArray(res.data.tasks), 'Should have tasks array');
    assert(res.data.total !== undefined, 'Should have total');

    if (res.data.tasks.length > 0) {
      const task = res.data.tasks[0];
      assertEqual(task.status, 'completed', 'Task status should be completed');
    }
  });

  // ---- Currency System (3 cases) ----

  // 15. List currencies
  await test('15. GET /api/currencies → currencies including MP', async () => {
    const res = await request('GET', '/api/currencies');
    assertEqual(res.status, 200, 'Currencies should return 200');
    assert(Array.isArray(res.data.currencies), 'Should have currencies array');
    assert(res.data.count !== undefined, 'Should have count');

    const mp = res.data.currencies.find(c => c.code === 'MP');
    assert(mp, 'Should include MP currency');
    assert(mp.name, 'MP should have name');
    assert(mp.symbol, 'MP should have symbol');
    assert(mp.type, 'MP should have type');
  });

  // 16. Get MP currency details
  await test('16. GET /api/currencies/MP → MP details', async () => {
    const res = await request('GET', '/api/currencies/MP');
    assertEqual(res.status, 200, 'MP details should return 200');
    assertEqual(res.data.code, 'MP', 'Code should be MP');
    assert(res.data.name, 'Should have name');
    assert(res.data.symbol, 'Should have symbol');
    assert(res.data.is_active !== undefined, 'Should have is_active');
  });

  // 17. Non-existent currency → 404
  await test('17. GET /api/currencies/NONEXISTENT → 404', async () => {
    const res = await request('GET', '/api/currencies/NONEXISTENT');
    assertEqual(res.status, 404, 'Non-existent currency should return 404');
  });

  // ---- Cross-Validation (3 cases) ----

  // 18. Economy status burn_rate matches simulate
  await test('18. Economy status burn_rate ≈ simulate burn_rate', async () => {
    const statusRes = await request('GET', '/api/economy/status');
    const simRes = await request('GET', '/api/economy/simulate?price=1000');

    assertEqual(statusRes.status, 200, 'Status should return 200');
    assertEqual(simRes.status, 200, 'Simulate should return 200');

    const statusBurn = statusRes.data.current.burn_rate;
    const simBurn = simRes.data.settlement.burn_rate;

    // They should be approximately equal (within floating point tolerance)
    const diff = Math.abs(statusBurn - simBurn);
    assert(diff < 0.01, `burn_rate mismatch: status=${statusBurn}, simulate=${simBurn}, diff=${diff}`);
  });

  // 19. Economy rewards match known values
  await test('19. Economy rewards.agent_registration_bonus === 100', async () => {
    const res = await request('GET', '/api/economy/status');
    assertEqual(res.status, 200, 'Status should return 200');
    assertEqual(res.data.rewards.agent_registration_bonus, 100, 'Agent registration bonus should be 100');
    assertEqual(res.data.rewards.human_registration_bonus, 200, 'Human registration bonus should be 200');
  });

  // 20. Formula reference_table σ=1.0 → burn_rate 25%
  await test('20. Formula reference_table σ=1.0 → burn_rate 25%', async () => {
    const res = await request('GET', '/api/economy/formula');
    assertEqual(res.status, 200, 'Formula should return 200');

    const table = res.data.reference_table;
    assert(Array.isArray(table), 'reference_table should be array');

    // Find σ=1.0 row (sigma may be string "1.00" or number)
    const row = table.find(r => {
      const sigma = parseFloat(r.sigma);
      return Math.abs(sigma - 1.0) < 0.01;
    });
    assert(row, 'Should have σ=1.0 row in reference table');

    // burn_rate could be "25.0%" string or 0.25 number
    const burnStr = String(row.burn_rate);
    const is25 = burnStr === '25.0%' || burnStr === '25%' || parseFloat(burnStr) === 0.25;
    assert(is25, `σ=1.0 burn_rate should be 25%, got: ${row.burn_rate}`);
  });

  // Clean up open [TEST] tasks before exiting
  if (ctx.poster) await cleanupOpenTasks(ctx.poster.api_key);

  printSummary();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
