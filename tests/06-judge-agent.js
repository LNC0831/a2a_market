#!/usr/bin/env node
/**
 * 06-judge-agent.js — Judge System & AI Interview (10 test cases)
 *
 * Tests the judge application flow: requirements, AI interview initiation,
 * multi-round answers, final result, and judge stats/listing endpoints.
 *
 * Note: AI responses are non-deterministic. We verify structure, not content.
 * The interview may not pass — that's OK, we test the flow works correctly.
 */

const { request, registerAgent, test, assert, assertEqual, printSummary, sleep } = require('./shared/test-utils');

const ctx = {};

async function run() {
  console.log('\n=== 06: Judge & AI Interview Agent (10 cases) ===\n');

  // 1. Register agent
  await test('1. Register judge candidate agent', async () => {
    ctx.agent = await registerAgent('judge_candidate', ['writing', 'coding']);
    assert(ctx.agent.api_key, 'Should have api_key');
  });

  const headers = { 'X-Agent-Key': ctx.agent.api_key };

  await sleep(300);

  // 2. Check judge requirements
  await test('2. Judge requirements → categories list', async () => {
    const res = await request('GET', '/api/hall/judge/requirements', null, headers);
    assertEqual(res.status, 200, 'Should return requirements');
    assert(res.data.categories, 'Should have categories');
    assert(Array.isArray(res.data.categories), 'Categories should be array');
    assert(res.data.categories.length > 0, 'Should have at least 1 category');

    // Verify expected categories exist
    const cats = res.data.categories;
    assert(
      cats.includes('writing') || cats.includes('coding') || cats.includes('general'),
      'Should include standard categories'
    );
  });

  await sleep(300);

  // 3. Apply for judge → starts AI interview
  await test('3. Apply for judge (writing) → interview starts', async () => {
    const res = await request('POST', '/api/hall/judge/apply', {
      category: 'writing'
    }, headers);

    assertEqual(res.status, 200, 'Should start interview');
    assert(res.data.interview_id, 'Should return interview_id');
    assert(res.data.question, 'Should return first question');
    assertEqual(res.data.current_round, 1, 'Should be round 1');
    assert(res.data.max_rounds, 'Should have max_rounds');

    ctx.interviewId = res.data.interview_id;
    ctx.maxRounds = res.data.max_rounds || 5;
  });

  await sleep(500);

  // 4. Check interview status
  await test('4. Interview status → in_progress', async () => {
    assert(ctx.interviewId, 'Need interview_id');
    const res = await request('GET', `/api/hall/judge/interview/${ctx.interviewId}`, null, headers);
    assertEqual(res.status, 200, 'Should return interview status');
    assert(res.data.current_round, 'Should have current_round');
  });

  await sleep(500);

  // 5-6. Answer interview questions (up to max rounds)
  let finished = false;
  let currentRound = 1;

  const interviewAnswers = [
    'When evaluating writing quality, I focus on clarity, coherence, factual accuracy, and how well the content addresses the given prompt. I also consider grammar, structure, and whether the writing engages its intended audience.',
    'For borderline cases, I would assess whether the submission meets the minimum requirements specified in the task description. If the core deliverable is present but could be improved, I would lean toward approval with constructive feedback.',
    'To detect AI-generated low-quality content, I check for generic phrases, lack of specific examples, repetitive sentence structures, and whether the content actually addresses the unique aspects of the task rather than providing generic responses.',
    'I believe fair evaluation requires consistency. I would maintain a rubric covering relevance (30%), completeness (25%), quality (25%), and originality (20%). Each dimension gets scored independently before calculating the final score.',
    'For disputes, I would first re-read both the task requirements and the submission carefully. Then I would document specific evidence for my assessment, referencing exact passages. Transparency in reasoning helps build trust in the review process.'
  ];

  await test('5. Answer round 1', async () => {
    assert(ctx.interviewId, 'Need interview_id');
    const res = await request('POST', `/api/hall/judge/interview/${ctx.interviewId}/answer`, {
      answer: interviewAnswers[0]
    }, headers);

    assertEqual(res.status, 200, 'Should accept answer');
    if (res.data.finished) {
      finished = true;
      ctx.finalResult = res.data;
    } else {
      assert(res.data.question, 'Should return next question');
      currentRound = res.data.current_round || 2;
    }
  });

  await sleep(1000);

  await test('6. Answer remaining rounds', async () => {
    if (finished) return; // Already done

    for (let round = currentRound; round <= ctx.maxRounds; round++) {
      const answerIdx = Math.min(round - 1, interviewAnswers.length - 1);
      const res = await request('POST', `/api/hall/judge/interview/${ctx.interviewId}/answer`, {
        answer: interviewAnswers[answerIdx]
      }, headers);

      assertEqual(res.status, 200, `Round ${round} should accept answer`);

      if (res.data.finished) {
        finished = true;
        ctx.finalResult = res.data;
        break;
      }

      await sleep(1000);
    }
  });

  // 7. Final result has score + assessment + passed
  await test('7. Interview result has score, assessment, passed', async () => {
    assert(ctx.finalResult, 'Should have final result');
    assert(ctx.finalResult.finished === true, 'Should be finished');
    assert(ctx.finalResult.score !== undefined, 'Should have score');
    assert(typeof ctx.finalResult.score === 'number', 'Score should be number');
    assert(ctx.finalResult.assessment, 'Should have assessment text');
    assert(typeof ctx.finalResult.passed === 'boolean', 'passed should be boolean');
  });

  await sleep(300);

  // 8. Judge stats endpoint
  await test('8. GET /judge/stats → returns stats', async () => {
    const res = await request('GET', '/api/hall/judge/stats', null, headers);
    assertEqual(res.status, 200, 'Should return stats');
  });

  // 9. Pending reviews (may be empty)
  await test('9. GET /judge/pending → valid response', async () => {
    const res = await request('GET', '/api/hall/judge/pending', null, headers);
    assertEqual(res.status, 200, 'Should return pending reviews');
    assert(
      res.data.pending_reviews !== undefined || res.data.message,
      'Should have pending_reviews or message'
    );
  });

  // 10. Public judges list
  await test('10. GET /judges → public list', async () => {
    const res = await request('GET', '/api/hall/judges');
    assertEqual(res.status, 200, 'Should return judges list');
    assert(Array.isArray(res.data.judges), 'Should have judges array');
  });

  printSummary();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
