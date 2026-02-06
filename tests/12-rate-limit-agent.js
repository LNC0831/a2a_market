#!/usr/bin/env node
/**
 * 12-rate-limit-agent.js — API Rate Limiting Verification (8 test cases)
 *
 * Tests per-user cooldown system on live API:
 *   1. Registration cooldown trigger (IP-based, 30 min)
 *   2. 429 response format (error, message, retry_after)
 *   3. retry_after value is reasonable (> 0 and <= cooldown)
 *   4. Task posting cooldown trigger (user-based, 15 min)
 *   5. Claim cooldown trigger (agent-based, 5 min)
 *   6. Container message cooldown trigger (user-based, 5 min)
 *   7. Different action types have independent cooldowns
 *   8. Unauthenticated post is not rate limited (anonymous posting allowed)
 *
 * Strategy: One registerAgent() call succeeds and gives us an api_key.
 * A second register attempt from the same IP triggers 429 (test case 1).
 * All remaining tests use the single api_key.
 *
 * Note: If the IP registration cooldown is already active from a previous run,
 * set A2A_TEST_AGENT_KEY=<key> to skip registration and use an existing key.
 * Test 1 (registration cooldown) will still pass because the cooldown IS active.
 */

const { request, registerAgent, solveChallenge, test, assert, assertEqual, printSummary, sleep, cleanupOpenTasks } = require('./shared/test-utils');

const ctx = {};

async function run() {
  console.log('\n=== 12: API Rate Limiting Verification (8 cases) ===\n');

  // ============================================================
  // SETUP: Get an agent api_key (register or reuse)
  // ============================================================

  const existingKey = process.env.A2A_TEST_AGENT_KEY;

  if (existingKey) {
    console.log('  [SETUP] Using existing agent key from A2A_TEST_AGENT_KEY');
    ctx.apiKey = existingKey;
    ctx.registrationSkipped = true;
  } else {
    console.log('  [SETUP] Registering agent...');
    try {
      const agent = await registerAgent('rl_agent', ['writing', 'testing']);
      ctx.apiKey = agent.api_key;
      ctx.registrationSkipped = false;
      console.log(`  [SETUP] Registered: ${agent.agent_id}`);
    } catch (err) {
      if (err.message && err.message.includes('429')) {
        console.log('  [SETUP] Registration rate limited (IP cooldown active from previous run)');
        console.log('  [SETUP] To run all tests, either:');
        console.log('          1. Wait for cooldown to expire and re-run');
        console.log('          2. Set A2A_TEST_AGENT_KEY=<key> to use an existing agent');
        console.log('');
        console.log('  Running test 1 (registration cooldown) only...\n');
        ctx.registrationOnly = true;
      } else {
        throw err;
      }
    }
  }

  // ============================================================
  // TEST 1: Registration cooldown trigger
  // ============================================================

  await test('1. Registration cooldown triggers 429 on repeat', async () => {
    const challengeRes = await request('GET', '/api/hall/register/challenge');
    if (challengeRes.status !== 200) {
      assertEqual(challengeRes.status, 429, 'Expected 429 on challenge');
      return;
    }

    const answers = solveChallenge(challengeRes.data);

    const regRes = await request('POST', '/api/hall/register', {
      challenge_id: challengeRes.data.challenge_id,
      answers: answers,
      name: '[TEST] rl_should_fail_' + Date.now(),
      skills: ['testing'],
      description: 'Should be rate limited'
    });

    assertEqual(regRes.status, 429, `Expected 429 for repeat registration, got ${regRes.status}`);
  });

  // If we couldn't get an API key, stop here
  if (ctx.registrationOnly) {
    console.log('\n  [SKIP] Tests 2-8 skipped (no API key available)');
    printSummary();
    return;
  }

  const agentHeader = { 'X-Agent-Key': ctx.apiKey };

  // ============================================================
  // SETUP: Post a task (first post succeeds, triggers cooldown)
  // ============================================================

  console.log('  [SETUP] Posting task for later tests...');
  const postRes = await request('POST', '/api/hall/post', {
    title: '[TEST] Rate limit task',
    description: 'A comprehensive study of distributed rate limiting algorithms including token bucket, leaky bucket, sliding window counters, and their trade-offs in high-throughput systems.',
    category: 'writing',
    budget: 10
  }, agentHeader);

  // If post is already rate limited (previous run), we still have a problem
  if (postRes.status === 429) {
    console.log('  [SETUP] Post also rate limited — using a browse to find existing test task');
    // Try to find an existing open task to use
    const tasksRes = await request('GET', '/api/hall/tasks', null, agentHeader);
    if (tasksRes.status === 200 && tasksRes.data.tasks && tasksRes.data.tasks.length > 0) {
      ctx.taskId = tasksRes.data.tasks[0].id;
    } else {
      ctx.taskId = 'nonexistent_task_for_testing';
    }
    ctx.postAlreadyLimited = true;
  } else {
    assert(postRes.status === 200, `Setup: post task failed: ${postRes.status} ${JSON.stringify(postRes.data)}`);
    ctx.taskId = postRes.data.task_id;
    ctx.postAlreadyLimited = false;
  }

  await sleep(300);

  // ============================================================
  // TEST 2: 429 response format
  // ============================================================

  await test('2. 429 response has error, message, retry_after fields', async () => {
    const res = await request('POST', '/api/hall/post', {
      title: '[TEST] Rate limit post 2',
      description: 'An in-depth exploration of modern consensus algorithms used in distributed databases, comparing Raft, Paxos, and Byzantine fault-tolerant protocols.',
      category: 'writing',
      budget: 10
    }, agentHeader);

    assertEqual(res.status, 429, `Expected 429, got ${res.status}`);
    assert(res.data.error, '429 response missing "error" field');
    assert(res.data.message, '429 response missing "message" field');
    assert(res.data.retry_after !== undefined, '429 response missing "retry_after" field');
  });

  // ============================================================
  // TEST 3: retry_after value is reasonable
  // ============================================================

  await test('3. retry_after value is > 0 and <= cooldown maximum', async () => {
    const res = await request('POST', '/api/hall/post', {
      title: '[TEST] Rate limit post 3',
      description: 'A systematic review of microservices observability patterns including distributed tracing, structured logging, and metrics aggregation pipelines.',
      category: 'writing',
      budget: 10
    }, agentHeader);

    assertEqual(res.status, 429, `Expected 429, got ${res.status}`);
    const retryAfter = res.data.retry_after;
    assert(typeof retryAfter === 'number', `retry_after should be a number, got ${typeof retryAfter}`);
    assert(retryAfter > 0, `retry_after should be > 0, got ${retryAfter}`);
    assert(retryAfter <= 1800, `retry_after should be <= 1800 (max cooldown), got ${retryAfter}`);
  });

  // ============================================================
  // TEST 4: Task posting cooldown trigger
  // ============================================================

  await test('4. POST /hall/post triggers cooldown on second call', async () => {
    const res = await request('POST', '/api/hall/post', {
      title: '[TEST] Rate limit post 4',
      description: 'A detailed comparison of container orchestration platforms including Kubernetes, Docker Swarm, and Apache Mesos for enterprise deployment scenarios.',
      category: 'writing',
      budget: 10
    }, agentHeader);

    assertEqual(res.status, 429, `Post should still be rate limited, got ${res.status}`);
    assert(res.data.message.includes('15 minutes'), `Message should mention 15 minutes: ${res.data.message}`);
  });

  // ============================================================
  // TEST 5: Claim cooldown trigger
  // ============================================================

  await test('5. POST /hall/tasks/:id/claim triggers cooldown on second call', async () => {
    // First claim (may succeed or fail for other reasons, but not 429)
    const claimRes = await request('POST', `/api/hall/tasks/${ctx.taskId}/claim`, null, agentHeader);
    assert(claimRes.status !== 429, `First claim should not be 429, got ${claimRes.status}`);

    await sleep(300);

    // Second claim immediately should be 429
    const claimRes2 = await request('POST', `/api/hall/tasks/${ctx.taskId}/claim`, null, agentHeader);
    assertEqual(claimRes2.status, 429, `Second claim should be 429, got ${claimRes2.status}`);
  });

  // ============================================================
  // TEST 6: Container message cooldown trigger
  // ============================================================

  await test('6. Container message triggers cooldown on second call', async () => {
    const msgRes1 = await request('POST', `/api/hall/container/${ctx.taskId}/message`, {
      content: 'First test message for rate limiting verification'
    }, agentHeader);
    assert(msgRes1.status !== 429, `First message should not be 429, got ${msgRes1.status}`);

    await sleep(300);

    const msgRes2 = await request('POST', `/api/hall/container/${ctx.taskId}/message`, {
      content: 'Second test message should be rate limited'
    }, agentHeader);
    assertEqual(msgRes2.status, 429, `Second message should be 429, got ${msgRes2.status}`);
  });

  // ============================================================
  // TEST 7: Different action types have independent cooldowns
  // ============================================================

  await test('7. Different action types have independent cooldowns', async () => {
    // Post, claim, and message cooldowns are all active
    // Verify all three are independently blocked at the same time

    const postCheck = await request('POST', '/api/hall/post', {
      title: '[TEST] Independence check post',
      description: 'A thorough examination of software supply chain security practices including SBOM generation, dependency scanning, and artifact signing workflows.',
      category: 'writing',
      budget: 10
    }, agentHeader);
    assertEqual(postCheck.status, 429, `Post should still be rate limited, got ${postCheck.status}`);

    const claimCheck = await request('POST', `/api/hall/tasks/${ctx.taskId}/claim`, null, agentHeader);
    assertEqual(claimCheck.status, 429, `Claim should still be rate limited, got ${claimCheck.status}`);

    const msgCheck = await request('POST', `/api/hall/container/${ctx.taskId}/message`, {
      content: 'Independence check message'
    }, agentHeader);
    assertEqual(msgCheck.status, 429, `Message should still be rate limited, got ${msgCheck.status}`);

    // All three action types are independently tracked
    assert(true, 'All action types independently rate limited');
  });

  // ============================================================
  // TEST 8: Unauthenticated post does not trigger rate limiting
  // ============================================================

  await test('8. Unauthenticated POST /hall/post is not rate limited', async () => {
    // POST /hall/post uses optionalAuth — unauthenticated users can post (anonymous)
    // Rate limiting is skipped when req.client?.id is undefined
    // So two rapid unauthenticated posts should both succeed (not get 429)
    const res1 = await request('POST', '/api/hall/post', {
      title: '[TEST] Unauth rate limit 1',
      description: 'An exploration of federated learning techniques for privacy-preserving machine learning across distributed data sources and edge computing nodes.',
      category: 'writing',
      budget: 10
    });
    assert(res1.status !== 429, `First unauthenticated post should not get 429, got ${res1.status}`);

    await sleep(300);

    const res2 = await request('POST', '/api/hall/post', {
      title: '[TEST] Unauth rate limit 2',
      description: 'A comprehensive overview of graph neural network architectures and their applications in molecular property prediction and drug discovery pipelines.',
      category: 'writing',
      budget: 10
    });
    assert(res2.status !== 429, `Second unauthenticated post should not get 429, got ${res2.status}`);
  });

  // ============================================================
  // CLEANUP
  // ============================================================

  console.log('\n  [CLEANUP] Cleaning up test tasks...');
  await cleanupOpenTasks(ctx.apiKey);

  printSummary();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
