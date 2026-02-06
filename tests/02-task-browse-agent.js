#!/usr/bin/env node
/**
 * 02-task-browse-agent.js — Task Browsing (7 test cases)
 *
 * Tests browsing the task hall, filtering, task details,
 * expected_earnings, skill_match, and error handling.
 */

const { request, registerAgent, test, assert, assertEqual, printSummary, sleep } = require('./shared/test-utils');

const ctx = {};

async function run() {
  console.log('\n=== 02: Task Browse Agent (7 cases) ===\n');

  // Setup: register an agent
  console.log('  [SETUP] Registering browse agent...');
  ctx.agent = await registerAgent('browse', ['writing', 'coding']);
  console.log(`  [SETUP] Registered: ${ctx.agent.agent_id}\n`);

  const headers = { 'X-Agent-Key': ctx.agent.api_key };

  // Ensure there's at least one open task by posting one
  const postRes = await request('POST', '/api/hall/post', {
    title: '[TEST] Browse test task',
    description: 'A test task created for browsing tests. This task tests the browse functionality of the marketplace.',
    category: 'writing',
    budget: 5
  }, headers);

  if (postRes.status === 200) {
    ctx.ownTaskId = postRes.data.task_id;
  }

  await sleep(300);

  // 1. Browse all tasks
  await test('1. Browse all tasks → tasks array + total', async () => {
    const res = await request('GET', '/api/hall/tasks', null, headers);
    assertEqual(res.status, 200, 'Should return 200');
    assert(Array.isArray(res.data.tasks), 'Should have tasks array');
    assert(typeof res.data.total === 'number', 'Should have total count');

    if (res.data.tasks.length > 0) {
      ctx.firstTask = res.data.tasks[0];
    }
  });

  // 2. Filter by category
  await test('2. Filter by category=writing', async () => {
    const res = await request('GET', '/api/hall/tasks?category=writing', null, headers);
    assertEqual(res.status, 200, 'Should return 200');
    assert(Array.isArray(res.data.tasks), 'Should have tasks array');

    // All returned tasks should be writing category
    for (const task of res.data.tasks) {
      assertEqual(task.category, 'writing', `Task ${task.id} should be writing category`);
    }
  });

  // 3. skill_match field exists
  await test('3. skill_match field present', async () => {
    const res = await request('GET', '/api/hall/tasks', null, headers);
    assertEqual(res.status, 200, 'Should return 200');

    if (res.data.tasks.length > 0) {
      const task = res.data.tasks[0];
      assert(typeof task.skill_match === 'boolean', 'skill_match should be boolean');
    }
  });

  // 4. expected_earnings field exists
  await test('4. expected_earnings field present and > 0', async () => {
    const res = await request('GET', '/api/hall/tasks', null, headers);
    assertEqual(res.status, 200, 'Should return 200');

    if (res.data.tasks.length > 0) {
      const task = res.data.tasks[0];
      assert(task.expected_earnings !== undefined, 'Should have expected_earnings');
      assert(task.expected_earnings > 0, 'expected_earnings should be > 0');
    }
  });

  // 5. View task details via /track (the detail endpoint)
  await test('5. View task details via track → complete fields', async () => {
    const taskId = ctx.ownTaskId || (ctx.firstTask && ctx.firstTask.id);
    assert(taskId, 'Need a task ID to view');

    const res = await request('GET', `/api/hall/track/${taskId}`, null, headers);
    assertEqual(res.status, 200, `Should return 200 for task ${taskId}`);
    assert(res.data.task_id || res.data.id, 'Should have task ID');
    assert(res.data.title, 'Should have title');
    assert(res.data.status, 'Should have status');
    assert(res.data.timeline, 'Should have timeline');
  });

  // 6. Non-existent task → 404
  await test('6. Non-existent task → 404', async () => {
    const res = await request('GET', '/api/hall/track/nonexistent_task_xyz', null, headers);
    assertEqual(res.status, 404, 'Should return 404');
  });

  // 7. your_skills field in task list
  await test('7. your_skills field matches registration', async () => {
    const res = await request('GET', '/api/hall/tasks', null, headers);
    assertEqual(res.status, 200, 'Should return 200');
    assert(res.data.your_skills, 'Should have your_skills');
    assert(Array.isArray(res.data.your_skills), 'your_skills should be array');
    assert(res.data.your_skills.includes('writing'), 'Should include writing skill');
    assert(res.data.your_skills.includes('coding'), 'Should include coding skill');
  });

  // Cleanup: cancel own task if created
  if (ctx.ownTaskId) {
    await request('POST', `/api/hall/tasks/${ctx.ownTaskId}/cancel`, null, headers);
  }

  printSummary();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
