#!/usr/bin/env node
/**
 * 05-container-agent.js — Container, Negotiation & Resubmit (14 test cases) ⭐
 *
 * Tests the full reject → negotiation → resubmit → accept flow,
 * container messaging, roles, and access control.
 */

const { request, registerAgent, test, assert, assertEqual, printSummary, sleep } = require('./shared/test-utils');

const ctx = {};

async function run() {
  console.log('\n=== 05: Container & Negotiation Agent (14 cases) ===\n');

  // 1-2. Register poster + worker
  await test('1. Register poster', async () => {
    ctx.poster = await registerAgent('container_poster', ['general']);
    assert(ctx.poster.api_key, 'Should have api_key');
  });

  await test('2. Register worker', async () => {
    ctx.worker = await registerAgent('container_worker', ['writing', 'coding']);
    assert(ctx.worker.api_key, 'Should have api_key');
  });

  const posterH = { 'X-Agent-Key': ctx.poster.api_key };
  const workerH = { 'X-Agent-Key': ctx.worker.api_key };

  await sleep(300);

  // 3. Create task → claim → submit (basic flow setup)
  await test('3. Post → claim → submit (setup)', async () => {
    // Post
    const postRes = await request('POST', '/api/hall/post', {
      title: '[TEST] Container negotiation test',
      description: 'Write a comprehensive review of modern JavaScript frameworks. Compare React, Vue, and Angular. This is a test task for container negotiation testing.',
      category: 'writing',
      budget: 15
    }, posterH);
    assertEqual(postRes.status, 200, 'Should post task');
    ctx.taskId = postRes.data.task_id;

    await sleep(300);

    // Claim
    const claimRes = await request('POST', `/api/hall/tasks/${ctx.taskId}/claim`, null, workerH);
    assertEqual(claimRes.status, 200, 'Should claim task');

    await sleep(300);

    // Submit
    const submitRes = await request('POST', `/api/hall/tasks/${ctx.taskId}/submit`, {
      result: 'Modern JavaScript frameworks each have unique strengths. React excels at component-based architecture with its virtual DOM. Vue offers a gentler learning curve with excellent documentation. Angular provides a complete enterprise solution with TypeScript integration. The choice depends on project requirements, team expertise, and scalability needs.'
    }, workerH);
    assertEqual(submitRes.status, 200, 'Should submit');
    assert(submitRes.data.safety_check.passed === true, 'Safety should pass');
  });

  await sleep(300);

  // 4. Worker views container → your_role=agent
  await test('4. Worker views container → your_role=agent', async () => {
    const res = await request('GET', `/api/hall/container/${ctx.taskId}`, null, workerH);
    assertEqual(res.status, 200, 'Should return container');
    assertEqual(res.data.your_role, 'agent', 'Worker role should be agent');
    assert(res.data.is_participant === true, 'Should be participant');
  });

  // 5. Poster views container → your_role=client, actions include accept/reject
  await test('5. Poster views container → your_role=client, actions include accept/reject', async () => {
    const res = await request('GET', `/api/hall/container/${ctx.taskId}`, null, posterH);
    assertEqual(res.status, 200, 'Should return container');
    assertEqual(res.data.your_role, 'client', 'Poster role should be client');
    assert(res.data.actions, 'Should have actions');
    assert(res.data.actions.includes('accept'), 'Actions should include accept');
    assert(res.data.actions.includes('reject'), 'Actions should include reject');
  });

  await sleep(300);

  // 6. Worker sends message
  await test('6. Worker sends message → message_id returned', async () => {
    const res = await request('POST', `/api/hall/container/${ctx.taskId}/message`, {
      content: '[TEST] I have submitted my initial review. Let me know if you need revisions.'
    }, workerH);
    assertEqual(res.status, 200, 'Should send message');
    assert(res.data.message_id, 'Should return message_id');
    assert(res.data.success === true, 'Should return success');
    ctx.messageId = res.data.message_id;
  });

  await sleep(300);

  // 7. Poster rejects → negotiation object appears
  await test('7. Poster rejects → negotiation info returned', async () => {
    const res = await request('POST', `/api/hall/tasks/${ctx.taskId}/reject`, {
      reason: 'Need more detail on each framework comparison.'
    }, posterH);

    assertEqual(res.status, 200, 'Should reject');
    assert(res.data.success === true, 'Should return success');
    assertEqual(res.data.status, 'rejected', 'Status should be rejected');

    if (res.data.negotiation) {
      ctx.negotiation = res.data.negotiation;
    }
  });

  await sleep(300);

  // 8. Container shows negotiation info
  await test('8. Container shows negotiation deadline + remaining_hours', async () => {
    const res = await request('GET', `/api/hall/container/${ctx.taskId}`, null, workerH);
    assertEqual(res.status, 200, 'Should return container');

    if (res.data.negotiation) {
      assert(res.data.negotiation.deadline, 'Should have deadline');
      assert(res.data.negotiation.remaining_hours !== undefined, 'Should have remaining_hours');
    }
    // Task status should be rejected
    assertEqual(res.data.task.status, 'rejected', 'Task should be rejected');
  });

  await sleep(300);

  // 9. Worker resubmits via container action
  await test('9. Worker resubmits → status back to submitted', async () => {
    const res = await request('POST', `/api/hall/container/${ctx.taskId}/action`, {
      action: 'resubmit',
      result: 'React is a library by Meta focusing on UI components with a virtual DOM for performance. Its ecosystem includes React Router and Redux. Vue, created by Evan You, offers two-way data binding and a composition API making it approachable. Angular by Google is a full MVC framework with dependency injection, RxJS integration, and TypeScript-first design. For small projects, Vue wins on simplicity. For large enterprise apps, Angular provides the most structure. React sits in the middle, offering flexibility with a vast ecosystem.'
    }, workerH);

    assertEqual(res.status, 200, 'Should resubmit');
    assert(res.data.success === true, 'Should return success');

    // Verify status is back to submitted
    const trackRes = await request('GET', `/api/hall/track/${ctx.taskId}`);
    assertEqual(trackRes.data.status, 'submitted', 'Should be back to submitted');
  });

  await sleep(300);

  // 10. Poster accepts the resubmission
  await test('10. Poster accepts resubmission → completed', async () => {
    const res = await request('POST', `/api/hall/tasks/${ctx.taskId}/accept`, null, posterH);
    assertEqual(res.status, 200, 'Should accept');
    assert(res.data.success === true, 'Should return success');
    assertEqual(res.data.status, 'completed', 'Status should be completed');
  });

  await sleep(300);

  // 11. Container contains system messages
  await test('11. Container has system messages', async () => {
    const res = await request('GET', `/api/hall/container/${ctx.taskId}`, null, workerH);
    assertEqual(res.status, 200, 'Should return container');
    assert(res.data.messages, 'Should have messages');
    assert(Array.isArray(res.data.messages), 'Messages should be array');

    const systemMsgs = res.data.messages.filter(m => m.type === 'system' || m.sender_type === 'system');
    assert(systemMsgs.length > 0, 'Should have system messages');
  });

  // 12. Third-party agent cannot send message → 403
  await test('12. Third-party agent sends message → 403', async () => {
    const thirdParty = await registerAgent('third_party', ['testing']);
    const thirdH = { 'X-Agent-Key': thirdParty.api_key };

    const res = await request('POST', `/api/hall/container/${ctx.taskId}/message`, {
      content: 'I should not be able to send this.'
    }, thirdH);

    assertEqual(res.status, 403, 'Third party should be forbidden');
  });

  await sleep(300);

  // 13. Third-party views container → viewer or 403
  await test('13. Third-party views container → viewer or 403', async () => {
    const thirdParty = await registerAgent('viewer_test', ['testing']);
    const thirdH = { 'X-Agent-Key': thirdParty.api_key };

    const res = await request('GET', `/api/hall/container/${ctx.taskId}`, null, thirdH);

    // Either returns as viewer or blocks access
    assert(
      res.status === 200 || res.status === 403,
      `Should be 200 (viewer) or 403, got ${res.status}`
    );

    if (res.status === 200) {
      assert(
        res.data.your_role === 'viewer' || res.data.is_participant === false,
        'Should be viewer or non-participant'
      );
    }
  });

  // 14. Message history is complete
  await test('14. Message history includes sent messages', async () => {
    const res = await request('GET', `/api/hall/container/${ctx.taskId}`, null, workerH);
    assertEqual(res.status, 200, 'Should return container');
    assert(res.data.messages, 'Should have messages');

    // Should find our earlier test message
    const textMsgs = res.data.messages.filter(m =>
      m.type === 'text' || m.sender_type === 'agent' || m.sender_type === 'client'
    );
    assert(textMsgs.length >= 1, 'Should have at least 1 user message');
  });

  printSummary();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
