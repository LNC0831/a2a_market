#!/usr/bin/env node
/**
 * 04-safety-check-agent.js — Safety Check Edge Cases (8 test cases)
 *
 * Creates a task, claims it, then tests various invalid submissions
 * (empty, too short, placeholder text, etc.) and verifies the safety
 * check blocks them while allowing valid content through.
 *
 * Each blocked test uses a fresh task if a previous submission
 * accidentally passes, ensuring no cascading failures.
 */

const { request, registerAgent, test, assert, assertEqual, printSummary, sleep } = require('./shared/test-utils');

const ctx = {};

async function createAndClaimTask(posterH, workerH) {
  const postRes = await request('POST', '/api/hall/post', {
    title: '[TEST] Safety check test task',
    description: 'Write a detailed article about cloud computing benefits for small businesses. Must be at least 200 words.',
    category: 'writing',
    budget: 5
  }, posterH);
  if (postRes.status !== 200) throw new Error(`Task creation failed: ${postRes.status}`);
  const taskId = postRes.data.task_id;

  await sleep(300);

  const claimRes = await request('POST', `/api/hall/tasks/${taskId}/claim`, null, workerH);
  if (claimRes.status !== 200) throw new Error(`Claim failed: ${claimRes.status}`);

  return taskId;
}

async function run() {
  console.log('\n=== 04: Safety Check Agent (8 cases) ===\n');

  // Setup: register poster + worker
  console.log('  [SETUP] Registering agents...');
  ctx.poster = await registerAgent('safety_poster', ['general']);
  ctx.worker = await registerAgent('safety_worker', ['writing']);

  const posterH = { 'X-Agent-Key': ctx.poster.api_key };
  const workerH = { 'X-Agent-Key': ctx.worker.api_key };

  // Create the primary task
  ctx.taskId = await createAndClaimTask(posterH, workerH);
  console.log(`  [SETUP] Task ${ctx.taskId} claimed\n`);

  await sleep(300);

  // Helper: submit and expect safety block; if passes, get a fresh task
  async function submitExpectBlock(name, result) {
    await test(name, async () => {
      const res = await request('POST', `/api/hall/tasks/${ctx.taskId}/submit`, {
        result: result
      }, workerH);

      // Safety check should block: 400, or 200 with safety_check.passed=false
      const blocked =
        res.status === 400 ||
        (res.status === 200 && res.data.safety_check && res.data.safety_check.passed === false);

      if (!blocked && res.status === 200) {
        // Submission unexpectedly passed - accept it and create a fresh task
        await request('POST', `/api/hall/tasks/${ctx.taskId}/accept`, null, posterH);
        await sleep(300);
        ctx.taskId = await createAndClaimTask(posterH, workerH);
      }

      assert(blocked, `Expected submission to be blocked, got status=${res.status}`);
    });
    await sleep(300);
  }

  // 1. Empty string
  await submitExpectBlock('1. Empty string submission → blocked', '');

  // 2. Too short (< 10 chars)
  await submitExpectBlock('2. Too short "Hi" → blocked', 'Hi');

  // 3. Too few words (< 3 words)
  await submitExpectBlock('3. Too few words "ab" → blocked', 'ab');

  // 4. Lorem ipsum placeholder (matches /lorem ipsum/i)
  await submitExpectBlock('4. Lorem ipsum → blocked',
    'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore');

  // 5. TODO placeholder (matches /todo:?\s*(fill|add|write|complete)/i)
  await submitExpectBlock('5. TODO placeholder → blocked',
    'TODO: fill in the actual content here. TODO add the remaining sections. TODO complete this.');

  // 6. Verify task still claimed (not submitted)
  await test('6. Task still in claimed status', async () => {
    const res = await request('GET', `/api/hall/track/${ctx.taskId}`);
    assertEqual(res.status, 200, 'Should return tracking');
    assertEqual(res.data.status, 'claimed', 'Task should still be claimed');
  });

  await sleep(300);

  // 7. Submit valid content → passes
  await test('7. Valid content (20+ words) → safety check passes', async () => {
    const res = await request('POST', `/api/hall/tasks/${ctx.taskId}/submit`, {
      result: 'Cloud computing offers transformative benefits for small businesses by reducing upfront infrastructure costs and enabling scalable operations. With cloud services, companies can access enterprise-grade tools without maintaining expensive hardware. Key advantages include flexible pricing models, improved collaboration through shared platforms, automatic software updates, enhanced data security through professional management, and the ability to work remotely from any location. This technology democratizes access to computing resources that were previously only available to large corporations with significant IT budgets.'
    }, workerH);

    assertEqual(res.status, 200, 'Should submit successfully');
    assert(res.data.safety_check, 'Should have safety_check');
    assert(res.data.safety_check.passed === true, 'Safety check should pass');
  });

  // 8. Status changed to submitted
  await test('8. Task status now submitted', async () => {
    const res = await request('GET', `/api/hall/track/${ctx.taskId}`);
    assertEqual(res.status, 200, 'Should return tracking');
    assertEqual(res.data.status, 'submitted', 'Task should be submitted');
  });

  // Cleanup
  await request('POST', `/api/hall/tasks/${ctx.taskId}/accept`, null, posterH);

  printSummary();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
