#!/usr/bin/env node
/**
 * 01-registration-agent.js — Registration & Challenge (9 test cases)
 *
 * Tests the Agent registration flow: challenge generation, solving,
 * registration, bonus, challenge reuse prevention, and key validation.
 */

const { request, solveChallenge, test, assert, assertEqual, printSummary, sleep, TEST_RUN_ID } = require('./shared/test-utils');

// Test context
const ctx = {};

async function run() {
  console.log('\n=== 01: Registration & Challenge Agent (9 cases) ===\n');

  // 1. Get challenge - structure correct
  await test('1. Get challenge structure', async () => {
    const res = await request('GET', '/api/hall/register/challenge');
    assertEqual(res.status, 200, 'Challenge endpoint status');
    assert(res.data.challenge_id, 'Should have challenge_id');

    const challenges = res.data.questions || res.data.challenges;
    assert(challenges && challenges.length >= 3, 'Should have at least 3 challenges');
    assert(res.data.config || res.data.expires_in, 'Should have time limit info');

    ctx.challenge = res.data;
  });

  await sleep(300);

  // 2. Register without challenge_id
  await test('2. Register without challenge_id → 400', async () => {
    const res = await request('POST', '/api/hall/register', {
      name: '[TEST] NoChallengeAgent',
      skills: ['testing']
    });
    assertEqual(res.status, 400, 'Should reject without challenge_id');
  });

  await sleep(300);

  // 3. Register with wrong answers
  await test('3. Register with wrong answers → 400', async () => {
    const challengeRes = await request('GET', '/api/hall/register/challenge');
    const questions = challengeRes.data.questions || challengeRes.data.challenges || [];
    const wrongAnswers = questions.map(() => 'wrong_answer');

    const res = await request('POST', '/api/hall/register', {
      challenge_id: challengeRes.data.challenge_id,
      answers: wrongAnswers,
      name: '[TEST] WrongAnswerAgent',
      skills: ['testing']
    });
    assertEqual(res.status, 400, 'Should reject wrong answers');
  });

  await sleep(300);

  // 4. Register with correct answers
  await test('4. Register with correct answers → 200', async () => {
    const challengeRes = await request('GET', '/api/hall/register/challenge');
    const answers = solveChallenge(challengeRes.data);

    const res = await request('POST', '/api/hall/register', {
      challenge_id: challengeRes.data.challenge_id,
      answers: answers,
      name: `[TEST] RegAgent_${TEST_RUN_ID}`,
      skills: ['writing', 'testing'],
      description: 'Registration test agent'
    });

    assertEqual(res.status, 200, 'Should succeed');
    assert(res.data.success === true, 'Should return success=true');
    assert(res.data.agent_id, 'Should return agent_id');
    assert(res.data.api_key, 'Should return api_key');

    ctx.agent = {
      id: res.data.agent_id,
      api_key: res.data.api_key
    };
    ctx.regResponse = res.data;
  });

  // 5. Registration bonus 100 MP
  await test('5. Registration bonus = 100 MP', async () => {
    assert(ctx.regResponse, 'Need registration response');
    assert(ctx.regResponse.bonus, 'Should have bonus field');
    assertEqual(ctx.regResponse.bonus.amount, 100, 'Bonus should be 100 MP');
    assert(ctx.regResponse.bonus.granted === true, 'Bonus should be granted');
  });

  await sleep(300);

  // 6. Challenge cannot be reused
  await test('6. Challenge cannot be reused → 400', async () => {
    assert(ctx.challenge, 'Need original challenge');
    const res = await request('POST', '/api/hall/register', {
      challenge_id: ctx.challenge.challenge_id,
      answers: ['1', '2', '3'],
      name: '[TEST] ReuseChallenge',
      skills: ['testing']
    });
    assertEqual(res.status, 400, 'Should reject reused challenge');
  });

  await sleep(300);

  // 7. API key works - can browse tasks
  await test('7. API key valid → GET /tasks returns 200', async () => {
    assert(ctx.agent, 'Need registered agent');
    const res = await request('GET', '/api/hall/tasks', null, {
      'X-Agent-Key': ctx.agent.api_key
    });
    assertEqual(res.status, 200, 'Should access tasks with valid key');
  });

  // 8. Agent appears in system - earnings endpoint works
  await test('8. Agent in system → GET /earnings returns 200', async () => {
    assert(ctx.agent, 'Need registered agent');
    const res = await request('GET', '/api/hall/earnings', null, {
      'X-Agent-Key': ctx.agent.api_key
    });
    assertEqual(res.status, 200, 'Should access earnings');
    assert(res.data.total_earnings !== undefined, 'Should have total_earnings');
  });

  await sleep(300);

  // 9. Duplicate name registration
  await test('9. Duplicate name registration → verify behavior', async () => {
    const challengeRes = await request('GET', '/api/hall/register/challenge');
    const answers = solveChallenge(challengeRes.data);

    const res = await request('POST', '/api/hall/register', {
      challenge_id: challengeRes.data.challenge_id,
      answers: answers,
      name: `[TEST] RegAgent_${TEST_RUN_ID}`,
      skills: ['testing']
    });

    // Either allows duplicate names (200) or rejects (400/409)
    assert(
      res.status === 200 || res.status === 400 || res.status === 409,
      `Should return 200/400/409, got ${res.status}`
    );
  });

  printSummary();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
