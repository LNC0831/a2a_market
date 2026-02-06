#!/usr/bin/env node
/**
 * 03-lifecycle-agent.js — Complete Task Lifecycle (16 test cases) ⭐
 *
 * Uses two agents (poster as client + worker as executor) to walk through
 * the full task lifecycle: post → browse → claim → submit → track →
 * container → accept → complete → earnings verification.
 */

const { request, registerAgent, test, assert, assertEqual, printSummary, sleep } = require('./shared/test-utils');

const ctx = {};

async function run() {
  console.log('\n=== 03: Lifecycle Agent (16 cases) ===\n');

  // 1-2. Register poster + worker
  await test('1. Register poster agent', async () => {
    ctx.poster = await registerAgent('poster', ['general']);
    assert(ctx.poster.api_key, 'Poster should have api_key');
  });

  await test('2. Register worker agent', async () => {
    ctx.worker = await registerAgent('worker', ['writing', 'coding']);
    assert(ctx.worker.api_key, 'Worker should have api_key');
  });

  const posterH = { 'X-Agent-Key': ctx.poster.api_key };
  const workerH = { 'X-Agent-Key': ctx.worker.api_key };

  await sleep(300);

  // 3. Poster checks balance
  await test('3. Poster balance >= 100 MP', async () => {
    const res = await request('GET', '/api/wallet/MP/balance', null, posterH);
    assertEqual(res.status, 200, 'Should get balance');
    assert(res.data.available >= 100, `Balance should be >= 100, got ${res.data.available}`);
    ctx.posterInitBalance = res.data.available;
  });

  // 4. Poster posts a task
  await test('4. Poster posts task (10 MP) → status=open', async () => {
    const res = await request('POST', '/api/hall/post', {
      title: '[TEST] Lifecycle test task',
      description: 'This is a comprehensive lifecycle test task. Please provide a detailed analysis of the current state of artificial intelligence in software development. Include at least three key points.',
      category: 'writing',
      budget: 10
    }, posterH);

    assertEqual(res.status, 200, 'Should create task');
    assert(res.data.success === true, 'Should return success');
    assert(res.data.task_id, 'Should return task_id');

    ctx.taskId = res.data.task_id;
  });

  await sleep(300);

  // 5. Poster balance decreased (frozen)
  await test('5. Poster balance decreased (frozen)', async () => {
    const res = await request('GET', '/api/wallet/MP/balance', null, posterH);
    assertEqual(res.status, 200, 'Should get balance');
    assert(res.data.available < ctx.posterInitBalance, 'Available should decrease');
    assert(res.data.frozen > 0, 'Frozen should increase');
  });

  // 6. Worker sees the task in browse
  await test('6. Worker browses and sees the task', async () => {
    const res = await request('GET', '/api/hall/tasks', null, workerH);
    assertEqual(res.status, 200, 'Should return tasks');

    const ourTask = res.data.tasks.find(t => t.id === ctx.taskId);
    assert(ourTask, 'Our task should appear in task list');
    assertEqual(ourTask.status, 'open', 'Task should be open');
  });

  // 7. Worker claims the task
  await test('7. Worker claims task → status=claimed', async () => {
    const res = await request('POST', `/api/hall/tasks/${ctx.taskId}/claim`, null, workerH);
    assertEqual(res.status, 200, 'Should claim successfully');
    assert(res.data.success === true, 'Should return success');
    assertEqual(res.data.status, 'claimed', 'Status should be claimed');
  });

  await sleep(300);

  // 8. Poster cannot claim their own task (already claimed)
  await test('8. Poster double-claim → 409 conflict', async () => {
    const res = await request('POST', `/api/hall/tasks/${ctx.taskId}/claim`, null, posterH);
    assertEqual(res.status, 409, 'Should return 409 conflict');
  });

  // 9. Worker submits result
  await test('9. Worker submits result → safety_check.passed + container_url', async () => {
    const res = await request('POST', `/api/hall/tasks/${ctx.taskId}/submit`, {
      result: 'Artificial intelligence is transforming software development in several key ways. First, AI-powered code completion tools like GitHub Copilot and Claude are dramatically increasing developer productivity by suggesting contextually relevant code snippets. Second, automated testing and bug detection through machine learning models can identify potential issues before they reach production. Third, natural language processing enables better documentation generation and code review processes. These advancements are reshaping how teams build and maintain software systems.',
      metadata: { word_count: 73, test: true }
    }, workerH);

    assertEqual(res.status, 200, 'Should submit successfully');
    assert(res.data.success === true, 'Should return success');
    assertEqual(res.data.status, 'submitted', 'Status should be submitted');
    assert(res.data.safety_check, 'Should have safety_check');
    assert(res.data.safety_check.passed === true, 'Safety check should pass');
    assert(res.data.container_url, 'Should have container_url');
  });

  await sleep(300);

  // 10. Track shows timeline
  await test('10. Track timeline → created, claimed, submitted', async () => {
    const res = await request('GET', `/api/hall/track/${ctx.taskId}`);
    assertEqual(res.status, 200, 'Should return tracking');
    assert(res.data.timeline, 'Should have timeline');
    assert(res.data.timeline.length >= 3, 'Timeline should have >= 3 events');

    const events = res.data.timeline.map(e => e.event);
    assert(events.includes('created'), 'Should have created event');
    assert(events.includes('claimed'), 'Should have claimed event');
    assert(events.includes('submitted'), 'Should have submitted event');
  });

  // 11. Container visible
  await test('11. Container accessible with participants', async () => {
    const res = await request('GET', `/api/hall/container/${ctx.taskId}`, null, workerH);
    assertEqual(res.status, 200, 'Should return container');
    assert(res.data.participants, 'Should have participants');
    assert(res.data.participants.length >= 1, 'Should have at least 1 participant');
    assertEqual(res.data.task.status, 'submitted', 'Task status should be submitted');
  });

  // 12. Poster accepts via /accept endpoint
  await test('12. Poster accepts → status=completed', async () => {
    const res = await request('POST', `/api/hall/tasks/${ctx.taskId}/accept`, null, posterH);
    assertEqual(res.status, 200, 'Should accept');
    assert(res.data.success === true, 'Should return success');
    assertEqual(res.data.status, 'completed', 'Status should be completed');

    if (res.data.settlement) {
      ctx.settlement = res.data.settlement;
    }
  });

  await sleep(500);

  // 13. Track final status
  await test('13. Track final status = completed', async () => {
    const res = await request('GET', `/api/hall/track/${ctx.taskId}`);
    assertEqual(res.status, 200, 'Should return tracking');
    assertEqual(res.data.status, 'completed', 'Status should be completed');
  });

  // 14. Worker earnings increased
  await test('14. Worker earnings > 0', async () => {
    const res = await request('GET', '/api/hall/earnings', null, workerH);
    assertEqual(res.status, 200, 'Should return earnings');
    assert(res.data.total_earnings > 0, `Earnings should be > 0, got ${res.data.total_earnings}`);
  });

  // 15. Worker wallet balance increased
  await test('15. Worker wallet balance > 100 (initial bonus)', async () => {
    const res = await request('GET', '/api/wallet/MP/balance', null, workerH);
    assertEqual(res.status, 200, 'Should return balance');
    assert(res.data.available > 100, `Balance should be > 100, got ${res.data.available}`);
  });

  // 16. Poster my-orders contains the task
  await test('16. Poster my-orders contains completed task', async () => {
    const res = await request('GET', '/api/hall/my-orders', null, posterH);
    assertEqual(res.status, 200, 'Should return orders');
    assert(res.data.orders, 'Should have orders array');

    const ourOrder = res.data.orders.find(o => o.task_id === ctx.taskId || o.id === ctx.taskId);
    assert(ourOrder, 'Our task should appear in my-orders');
    assertEqual(ourOrder.status, 'completed', 'Order should be completed');
  });

  printSummary();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
