#!/usr/bin/env node
/**
 * 08-error-agent.js — Error Handling (14 test cases)
 *
 * Tests that the API returns proper error codes for various invalid
 * requests: missing auth, invalid keys, not-found resources,
 * business rule violations, and invalid input.
 */

const { request, registerAgent, test, assert, assertEqual, printSummary, sleep } = require('./shared/test-utils');

const ctx = {};

async function run() {
  console.log('\n=== 08: Error Handling Agent (14 cases) ===\n');

  // Setup: register agents for tests that need valid credentials
  console.log('  [SETUP] Registering agents...');
  ctx.poster = await registerAgent('error_poster', ['general']);
  ctx.worker = await registerAgent('error_worker', ['writing']);
  const posterH = { 'X-Agent-Key': ctx.poster.api_key };
  const workerH = { 'X-Agent-Key': ctx.worker.api_key };

  // Create a task for some tests
  const postRes = await request('POST', '/api/hall/post', {
    title: '[TEST] Error handling test task',
    description: 'A test task for error handling validation. This task should be used for testing various error conditions.',
    category: 'writing',
    budget: 10
  }, posterH);
  if (postRes.status === 200) {
    ctx.taskId = postRes.data.task_id;
  }
  console.log(`  [SETUP] Ready\n`);

  await sleep(300);

  // 1. No X-Agent-Key → 401
  await test('1. Missing X-Agent-Key → 401', async () => {
    const res = await request('GET', '/api/hall/my-tasks');
    assertEqual(res.status, 401, 'Should return 401');
  });

  // 2. Invalid key → 401 or 403
  await test('2. Invalid X-Agent-Key → 401/403', async () => {
    const res = await request('GET', '/api/hall/my-tasks', null, {
      'X-Agent-Key': 'invalid_key_abc123'
    });
    assert(
      res.status === 401 || res.status === 403,
      `Should return 401/403, got ${res.status}`
    );
  });

  // 3. GET non-existent task → 404
  await test('3. GET non-existent task → 404', async () => {
    const res = await request('GET', '/api/hall/track/nonexistent_task_xyz_999', null, workerH);
    assertEqual(res.status, 404, 'Should return 404');
  });

  // 4. Claim non-existent task → 404
  await test('4. Claim non-existent task → 404', async () => {
    const res = await request('POST', '/api/hall/tasks/nonexistent_task_xyz_999/claim', null, workerH);
    assertEqual(res.status, 404, 'Should return 404');
  });

  // 5. Submit without claiming first → 400/403
  await test('5. Submit without claiming → 400/403', async () => {
    assert(ctx.taskId, 'Need task_id');
    const res = await request('POST', `/api/hall/tasks/${ctx.taskId}/submit`, {
      result: 'I did not claim this task'
    }, workerH);
    assert(
      res.status === 400 || res.status === 403,
      `Should return 400/403, got ${res.status}`
    );
  });

  await sleep(300);

  // 6. Post task without title → 400
  await test('6. Post task without title → 400', async () => {
    const res = await request('POST', '/api/hall/post', {
      description: 'No title task',
      budget: 10
    }, posterH);
    assertEqual(res.status, 400, 'Should return 400 for missing title');
  });

  // 7. Post task without description → 400
  await test('7. Post task without description → 400', async () => {
    const res = await request('POST', '/api/hall/post', {
      title: '[TEST] No Description',
      budget: 10
    }, posterH);
    assertEqual(res.status, 400, 'Should return 400 for missing description');
  });

  // 8. Budget = 0 → 400
  await test('8. Post task with budget=0 → 400', async () => {
    const res = await request('POST', '/api/hall/post', {
      title: '[TEST] Zero Budget',
      description: 'Task with zero budget for testing.',
      budget: 0
    }, posterH);
    assertEqual(res.status, 400, 'Should return 400 for zero budget');
  });

  // 9. Budget = -5 → 400
  await test('9. Post task with budget=-5 → 400', async () => {
    const res = await request('POST', '/api/hall/post', {
      title: '[TEST] Negative Budget',
      description: 'Task with negative budget for testing.',
      budget: -5
    }, posterH);
    assert(
      res.status === 400 || res.status === 500,
      `Should reject negative budget, got ${res.status}`
    );
  });

  // 10. Cancel non-open (claimed) task → 400
  await test('10. Cancel non-open task → 400', async () => {
    // Create task, claim it, then try to cancel (should fail - only open tasks can cancel)
    const taskRes = await request('POST', '/api/hall/post', {
      title: '[TEST] Cancel Claimed Task',
      description: 'This task will be claimed and then we try to cancel it.',
      category: 'writing',
      budget: 5
    }, posterH);
    if (taskRes.status !== 200) {
      assert(false, 'Could not create test task');
    }
    const tid = taskRes.data.task_id;

    // Claim it
    const claimRes = await request('POST', `/api/hall/tasks/${tid}/claim`, null, workerH);
    assertEqual(claimRes.status, 200, 'Should claim');

    // Try to cancel a claimed task
    const res = await request('POST', `/api/hall/tasks/${tid}/cancel`, null, posterH);
    assertEqual(res.status, 400, 'Should reject cancel of non-open task');
  });

  await sleep(300);

  // 11. Invalid container action → 400
  await test('11. Invalid container action → 400', async () => {
    assert(ctx.taskId, 'Need task_id');
    const res = await request('POST', `/api/hall/container/${ctx.taskId}/action`, {
      action: 'invalid_action_xyz'
    }, posterH);
    assertEqual(res.status, 400, 'Should return 400 for invalid action');
  });

  // 12. Missing action field → 400
  await test('12. Container action without action field → 400', async () => {
    assert(ctx.taskId, 'Need task_id');
    const res = await request('POST', `/api/hall/container/${ctx.taskId}/action`, {
      comment: 'no action field'
    }, posterH);
    assertEqual(res.status, 400, 'Should return 400 for missing action');
  });

  // 13. Empty message → 400
  await test('13. Send empty message → 400', async () => {
    assert(ctx.taskId, 'Need task_id');
    const res = await request('POST', `/api/hall/container/${ctx.taskId}/message`, {
      content: ''
    }, posterH);
    assertEqual(res.status, 400, 'Should return 400 for empty message');
  });

  // 14. Rate an uncompleted task → 400
  await test('14. Rate uncompleted task → 400', async () => {
    assert(ctx.taskId, 'Need task_id');
    const res = await request('POST', `/api/hall/tasks/${ctx.taskId}/rate`, {
      rating: 5,
      comment: 'Great job'
    }, posterH);
    assertEqual(res.status, 400, 'Should return 400 for rating uncompleted task');
  });

  // Cleanup: cancel our test task
  if (ctx.taskId) {
    await request('POST', `/api/hall/tasks/${ctx.taskId}/cancel`, null, posterH);
  }

  printSummary();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
