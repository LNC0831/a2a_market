/**
 * Test Script for AI Provider Abstraction Layer
 *
 * Tests the new AI module with Moonshot and OpenAI providers.
 *
 * Usage:
 *   node test-ai-providers.js
 *
 * Requires:
 *   - MOONSHOT_API_KEY in environment or .env file
 *   - Optionally OPENAI_API_KEY for OpenAI tests
 */

require('dotenv').config({ path: './server/.env' });

const ai = require('./server/ai');

async function testProviderStatus() {
  console.log('\n=== Provider Status ===');
  const status = ai.getProviderStatus();

  for (const [name, info] of Object.entries(status)) {
    console.log(`${name}: ${info.configured ? '✅ Configured' : '❌ Not configured'}`);
    if (info.configured) {
      console.log(`  Default model: ${info.defaultModel}`);
      console.log(`  Available models: ${info.availableModels.join(', ')}`);
    }
  }
}

async function testBasicCompletion() {
  console.log('\n=== Basic Completion Test ===');

  const systemPrompt = 'You are a helpful assistant. Respond concisely.';
  const userPrompt = 'What is 2 + 2? Answer with just the number.';

  try {
    const result = await ai.complete('default', systemPrompt, userPrompt);

    console.log('✅ Completion successful');
    console.log(`  Provider: ${result.provider}`);
    console.log(`  Model: ${result.model}`);
    console.log(`  Response: ${result.content.trim()}`);
    console.log(`  Tokens: ${result.usage.total_tokens}`);
    console.log(`  Cost: $${result.cost.toFixed(4)}`);
    console.log(`  Time: ${result.executionTime}ms`);

    return true;
  } catch (error) {
    console.log('❌ Completion failed:', error.message);
    return false;
  }
}

async function testAIJudgePrompt() {
  console.log('\n=== AI Judge Test ===');

  const systemPrompt = `You are an AI quality evaluator. Evaluate this task submission.
Output JSON format: {"score": 0-100, "passed": true/false, "comment": "brief comment"}`;

  const userPrompt = `
Task: Write a haiku about programming
Result: Code flows like water
       Bugs emerge then disappear
       Debug, test, repeat

Please evaluate this submission.`;

  try {
    const result = await ai.complete('ai_judge', systemPrompt, userPrompt, {
      temperature: 0.3
    });

    console.log('✅ AI Judge test successful');
    console.log(`  Provider: ${result.provider}`);
    console.log(`  Response preview: ${result.content.substring(0, 200)}...`);
    console.log(`  Tokens: ${result.usage.total_tokens}`);
    console.log(`  Cost: $${result.cost.toFixed(4)}`);

    return true;
  } catch (error) {
    console.log('❌ AI Judge test failed:', error.message);
    return false;
  }
}

async function testAIInterviewerPrompt() {
  console.log('\n=== AI Interviewer Test ===');

  const systemPrompt = `You are an interviewer for judge qualification.
Ask ONE question to test the candidate's ability to evaluate writing tasks.
Output JSON: {"question": "your question", "feedback": null}`;

  const userPrompt = `This is the START of the interview. The candidate is applying to be a writing judge.`;

  try {
    const result = await ai.complete('ai_interviewer', systemPrompt, userPrompt, {
      temperature: 0.7
    });

    console.log('✅ AI Interviewer test successful');
    console.log(`  Provider: ${result.provider}`);
    console.log(`  Response preview: ${result.content.substring(0, 200)}...`);
    console.log(`  Tokens: ${result.usage.total_tokens}`);
    console.log(`  Cost: $${result.cost.toFixed(4)}`);

    return true;
  } catch (error) {
    console.log('❌ AI Interviewer test failed:', error.message);
    return false;
  }
}

async function testUsageStats() {
  console.log('\n=== Usage Statistics ===');
  const stats = ai.getUsageStats();

  console.log(`Total calls: ${stats.totalCalls}`);
  console.log(`Total tokens: ${stats.totalTokens}`);
  console.log(`Total cost: ${stats.totalCost}`);

  if (Object.keys(stats.byFunction).length > 0) {
    console.log('\nBy function:');
    for (const [fn, data] of Object.entries(stats.byFunction)) {
      console.log(`  ${fn}: ${data.calls} calls, ${data.tokens} tokens, $${data.cost.toFixed(4)}`);
    }
  }

  if (Object.keys(stats.byProvider).length > 0) {
    console.log('\nBy provider:');
    for (const [provider, data] of Object.entries(stats.byProvider)) {
      console.log(`  ${provider}: ${data.calls} calls, ${data.tokens} tokens, $${data.cost.toFixed(4)}`);
    }
  }
}

async function main() {
  console.log('🧪 AI Provider Abstraction Layer Tests\n');
  console.log('=' .repeat(50));

  await testProviderStatus();

  const status = ai.getProviderStatus();
  const hasConfiguredProvider = Object.values(status).some(s => s.configured);

  if (!hasConfiguredProvider) {
    console.log('\n⚠️  No AI providers configured. Set MOONSHOT_API_KEY or OPENAI_API_KEY in .env');
    console.log('   Skipping API tests.\n');
    return;
  }

  // Run tests
  const tests = [
    testBasicCompletion,
    testAIJudgePrompt,
    testAIInterviewerPrompt
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await test();
    if (result) passed++;
    else failed++;
  }

  await testUsageStats();

  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('✅ All tests passed!\n');
  } else {
    console.log('⚠️  Some tests failed. Check your API keys and configuration.\n');
    process.exit(1);
  }
}

main().catch(console.error);
