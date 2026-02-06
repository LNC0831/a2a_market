#!/usr/bin/env node
/**
 * 09-fixes-validation-agent.js — Fixes Validation (15 test cases)
 *
 * Validates the 6 fixes deployed in commit 7c5e729 (2026-02-06):
 *
 * A. Auth security: accept/reject/rate/cancel require authenticateClient + ownership (8 cases)
 * B. Alias route: GET /tasks/:id aliases GET /track/:id (3 cases)
 * C. my-orders id field: each order has both id and task_id (1 case)
 * D. Extended TODO regex: insert/replace/implement patterns blocked (3 cases)
 */

const { request, registerAgent, test, assert, assertEqual, printSummary, sleep } = require('./shared/test-utils');

const ctx = {};

async function createClaimedTask(posterH, workerH, budget = 5) {
  const postRes = await request('POST', '/api/hall/post', {
    title: '[TEST] Fixes validation task',
    description: 'Write a comprehensive analysis of modern distributed systems architecture including microservices, event-driven patterns, and containerization best practices.',
    category: 'writing',
    budget
  }, posterH);
  if (postRes.status !== 200) throw new Error(`Task creation failed: ${postRes.status}`);
  const taskId = postRes.data.task_id;

  await sleep(300);

  const claimRes = await request('POST', `/api/hall/tasks/${taskId}/claim`, null, workerH);
  if (claimRes.status !== 200) throw new Error(`Claim failed: ${claimRes.status}`);

  return taskId;
}

async function createSubmittedTask(posterH, workerH, budget = 5) {
  const taskId = await createClaimedTask(posterH, workerH, budget);

  await sleep(300);

  const submitRes = await request('POST', `/api/hall/tasks/${taskId}/submit`, {
    result: 'Modern distributed systems architecture has evolved significantly with the adoption of microservices, event-driven patterns, and containerization. Microservices enable teams to develop, deploy, and scale components independently, reducing coupling and improving fault isolation. Event-driven architectures using message brokers like Kafka provide asynchronous communication between services, improving resilience and throughput. Containerization with Docker and orchestration with Kubernetes standardize deployment, enable auto-scaling, and simplify infrastructure management across cloud environments.'
  }, workerH);
  if (submitRes.status !== 200 || !submitRes.data.success) {
    throw new Error(`Submit failed: ${submitRes.status} ${JSON.stringify(submitRes.data)}`);
  }

  return taskId;
}

async function run() {
  console.log('\n=== 09: Fixes Validation Agent (15 cases) ===\n');

  // === SETUP ===
  console.log('  [SETUP] Registering agents...');
  ctx.poster = await registerAgent('fix_poster', ['writing']);
  ctx.worker = await registerAgent('fix_worker', ['writing']);
  ctx.stranger = await registerAgent('fix_stranger', ['writing']);

  const posterH = { 'X-Agent-Key': ctx.poster.api_key };
  const workerH = { 'X-Agent-Key': ctx.worker.api_key };
  const strangerH = { 'X-Agent-Key': ctx.stranger.api_key };

  await sleep(300);
  console.log('  [SETUP] Agents registered\n');

  // ============================================================
  // A. Auth security: cancel (tests 1-3)
  // ============================================================

  // Create an open task for cancel tests
  const cancelPostRes = await request('POST', '/api/hall/post', {
    title: '[TEST] Cancel auth test task',
    description: 'Task for testing cancel authentication. Write about the importance of security testing in modern software development.',
    category: 'writing',
    budget: 5
  }, posterH);
  assert(cancelPostRes.status === 200, 'Setup: create cancel task');
  ctx.cancelTaskId = cancelPostRes.data.task_id;

  await sleep(300);

  // 1. cancel anonymous → 401
  await test('1. Cancel anonymous → 401', async () => {
    const res = await request('POST', `/api/hall/tasks/${ctx.cancelTaskId}/cancel`);
    assertEqual(res.status, 401, 'Anonymous cancel should return 401');
  });

  // 2. cancel non-creator → 403
  await test('2. Cancel non-creator → 403', async () => {
    const res = await request('POST', `/api/hall/tasks/${ctx.cancelTaskId}/cancel`, null, strangerH);
    assertEqual(res.status, 403, 'Non-creator cancel should return 403');
  });

  // 3. cancel creator → 200
  await test('3. Cancel creator → 200 + cancelled', async () => {
    const res = await request('POST', `/api/hall/tasks/${ctx.cancelTaskId}/cancel`, null, posterH);
    assertEqual(res.status, 200, 'Creator cancel should return 200');
    assertEqual(res.data.status, 'cancelled', 'Status should be cancelled');
  });

  await sleep(300);

  // ============================================================
  // A. Auth security: accept/reject (tests 4-7)
  // ============================================================

  // Create a submitted task for accept/reject tests
  ctx.acceptRejectTaskId = await createSubmittedTask(posterH, workerH);

  await sleep(300);

  // 4. accept anonymous → 401
  await test('4. Accept anonymous → 401', async () => {
    const res = await request('POST', `/api/hall/tasks/${ctx.acceptRejectTaskId}/accept`);
    assertEqual(res.status, 401, 'Anonymous accept should return 401');
  });

  // 5. accept non-creator → 403
  await test('5. Accept non-creator → 403', async () => {
    const res = await request('POST', `/api/hall/tasks/${ctx.acceptRejectTaskId}/accept`, null, strangerH);
    assertEqual(res.status, 403, 'Non-creator accept should return 403');
  });

  // 6. reject anonymous → 401
  await test('6. Reject anonymous → 401', async () => {
    const res = await request('POST', `/api/hall/tasks/${ctx.acceptRejectTaskId}/reject`);
    assertEqual(res.status, 401, 'Anonymous reject should return 401');
  });

  // 7. reject non-creator → 403
  await test('7. Reject non-creator → 403', async () => {
    const res = await request('POST', `/api/hall/tasks/${ctx.acceptRejectTaskId}/reject`, null, strangerH);
    assertEqual(res.status, 403, 'Non-creator reject should return 403');
  });

  await sleep(300);

  // ============================================================
  // A. Auth security: rate (test 8)
  // ============================================================

  // Accept the task to get it to completed state for rate test
  await request('POST', `/api/hall/tasks/${ctx.acceptRejectTaskId}/accept`, null, posterH);

  await sleep(300);

  // 8. rate anonymous → 401
  await test('8. Rate anonymous → 401', async () => {
    const res = await request('POST', `/api/hall/tasks/${ctx.acceptRejectTaskId}/rate`, {
      rating: 5, comment: 'Great work'
    });
    assertEqual(res.status, 401, 'Anonymous rate should return 401');
  });

  await sleep(300);

  // ============================================================
  // B. Alias route: GET /tasks/:id (tests 9-11)
  // ============================================================

  // Use the completed task for alias tests
  const aliasTaskId = ctx.acceptRejectTaskId;

  // 9. GET /tasks/:id returns 200
  await test('9. GET /tasks/:id → 200 with task data', async () => {
    const res = await request('GET', `/api/hall/tasks/${aliasTaskId}`);
    assertEqual(res.status, 200, 'Alias route should return 200');
    assert(res.data.task_id || res.data.id, 'Should have task identifier');
  });

  // 10. GET /tasks/:id matches GET /track/:id
  await test('10. GET /tasks/:id matches GET /track/:id', async () => {
    const aliasRes = await request('GET', `/api/hall/tasks/${aliasTaskId}`);
    const trackRes = await request('GET', `/api/hall/track/${aliasTaskId}`);

    assertEqual(aliasRes.status, 200, 'Alias should return 200');
    assertEqual(trackRes.status, 200, 'Track should return 200');

    // Compare key fields
    assertEqual(aliasRes.data.status, trackRes.data.status, 'Status should match');
    assertEqual(aliasRes.data.title, trackRes.data.title, 'Title should match');

    const aliasId = aliasRes.data.task_id || aliasRes.data.id;
    const trackId = trackRes.data.task_id || trackRes.data.id;
    assertEqual(aliasId, trackId, 'Task ID should match');
  });

  // 11. GET /tasks/nonexistent → 404
  await test('11. GET /tasks/nonexistent → 404', async () => {
    const res = await request('GET', '/api/hall/tasks/nonexistent_task_id_xyz');
    assertEqual(res.status, 404, 'Non-existent task should return 404');
  });

  await sleep(300);

  // ============================================================
  // C. my-orders id field (test 12)
  // ============================================================

  // 12. my-orders returns both id and task_id
  await test('12. my-orders has both id and task_id fields', async () => {
    const res = await request('GET', '/api/hall/my-orders', null, posterH);
    assertEqual(res.status, 200, 'Should return orders');
    assert(res.data.orders, 'Should have orders array');
    assert(res.data.orders.length > 0, 'Should have at least 1 order');

    const order = res.data.orders[0];
    assert(order.id, 'Order should have id field');
    assert(order.task_id, 'Order should have task_id field');
    assertEqual(order.id, order.task_id, 'id should equal task_id');
  });

  await sleep(300);

  // ============================================================
  // D. Extended TODO regex (tests 13-15)
  // ============================================================

  // Helper: submit TODO text and expect safety block; create fresh task if needed
  async function submitTodoExpectBlock(name, result) {
    const taskId = await createClaimedTask(posterH, workerH);
    await sleep(300);

    await test(name, async () => {
      const res = await request('POST', `/api/hall/tasks/${taskId}/submit`, {
        result: result
      }, workerH);

      const blocked =
        res.status === 400 ||
        (res.status === 200 && res.data.safety_check && res.data.safety_check.passed === false);

      if (!blocked && res.status === 200) {
        // Unexpected pass — clean up
        await request('POST', `/api/hall/tasks/${taskId}/accept`, null, posterH);
      }

      assert(blocked, `Expected submission to be blocked, got status=${res.status}`);
    });

    await sleep(300);
  }

  // 13. "TODO: insert content here" → blocked
  await submitTodoExpectBlock(
    '13. TODO insert → blocked',
    'TODO: insert content here and make sure this section is properly filled with relevant information about the topic'
  );

  // 14. "TODO: replace this section" → blocked
  await submitTodoExpectBlock(
    '14. TODO replace → blocked',
    'TODO: replace this section with actual content about distributed systems and cloud computing architecture'
  );

  // 15. "TODO implement the feature" → blocked (no colon)
  await submitTodoExpectBlock(
    '15. TODO implement (no colon) → blocked',
    'TODO implement the feature properly with all the required functionality and error handling mechanisms'
  );

  printSummary();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
