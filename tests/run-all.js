#!/usr/bin/env node
/**
 * run-all.js — Test Suite Orchestrator
 *
 * Runs all test agents (01-08) sequentially, captures output,
 * and prints a final summary table.
 *
 * Usage:
 *   node tests/run-all.js          # Run all tests
 *   node tests/run-all.js 03       # Run only 03-lifecycle-agent
 *   node tests/run-all.js 01 03    # Run 01 and 03
 *
 * Environment:
 *   A2A_API_URL=http://localhost:3001 node tests/run-all.js
 */

const { execFile } = require('child_process');
const path = require('path');

const TESTS = [
  { id: '01', file: '01-registration-agent.js', name: 'Registration & Challenge', cases: 9 },
  { id: '02', file: '02-task-browse-agent.js', name: 'Task Browsing', cases: 7 },
  { id: '03', file: '03-lifecycle-agent.js', name: 'Full Lifecycle', cases: 16 },
  { id: '04', file: '04-safety-check-agent.js', name: 'Safety Check', cases: 8 },
  { id: '05', file: '05-container-agent.js', name: 'Container & Negotiation', cases: 14 },
  { id: '06', file: '06-judge-agent.js', name: 'Judge & AI Interview', cases: 10 },
  { id: '07', file: '07-wallet-agent.js', name: 'Wallet & Economy', cases: 9 },
  { id: '08', file: '08-error-agent.js', name: 'Error Handling', cases: 14 },
  { id: '09', file: '09-fixes-validation-agent.js', name: 'Fixes Validation', cases: 15 },
  { id: '10', file: '10-skillmd-roleplay-agent.js', name: 'SKILL.md Role-Play', cases: 20 },
];

const testsDir = __dirname;

function runScript(scriptPath) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = execFile('node', [scriptPath], {
      timeout: 120000, // 2 min per test suite
      env: { ...process.env },
      maxBuffer: 1024 * 1024
    }, (error, stdout, stderr) => {
      const duration = ((Date.now() - start) / 1000).toFixed(1);
      const exitCode = error ? (error.code || 1) : 0;

      // Parse pass/fail from output
      let passed = 0;
      let failed = 0;
      const passMatch = stdout.match(/Passed:\s*(\d+)/);
      const failMatch = stdout.match(/Failed:\s*(\d+)/);
      if (passMatch) passed = parseInt(passMatch[1]);
      if (failMatch) failed = parseInt(failMatch[1]);

      resolve({
        exitCode,
        stdout,
        stderr,
        duration,
        passed,
        failed
      });
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);

  // Filter tests if specific IDs given
  let testsToRun = TESTS;
  if (args.length > 0) {
    testsToRun = TESTS.filter(t => args.some(a => t.id === a.padStart(2, '0') || t.file.includes(a)));
    if (testsToRun.length === 0) {
      console.error(`No matching tests for: ${args.join(', ')}`);
      console.error(`Available: ${TESTS.map(t => t.id).join(', ')}`);
      process.exit(1);
    }
  }

  const apiUrl = process.env.A2A_API_URL || 'https://api.agentmkt.net';

  console.log('\n' + '='.repeat(60));
  console.log('  A2A Marketplace — External Agent Test Suite');
  console.log('='.repeat(60));
  console.log(`  API:    ${apiUrl}`);
  console.log(`  Tests:  ${testsToRun.length} suites (${testsToRun.reduce((s, t) => s + t.cases, 0)} cases)`);
  console.log(`  Time:   ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const testDef of testsToRun) {
    const scriptPath = path.join(testsDir, testDef.file);
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  Running: [${testDef.id}] ${testDef.name}`);
    console.log(`${'─'.repeat(60)}`);

    const result = await runScript(scriptPath);

    // Print the test output
    if (result.stdout) {
      console.log(result.stdout);
    }
    if (result.stderr && result.exitCode !== 0) {
      console.error(result.stderr);
    }

    const status = result.exitCode === 0 ? 'PASS' : 'FAIL';
    results.push({
      ...testDef,
      status,
      passed: result.passed,
      failed: result.failed,
      duration: result.duration
    });

    totalPassed += result.passed;
    totalFailed += result.failed;

    // Brief pause between suites
    await sleep(500);
  }

  // Final summary table
  console.log('\n' + '='.repeat(60));
  console.log('  FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  console.log('  ID  | Status | Pass | Fail | Time  | Suite');
  console.log('  ' + '-'.repeat(54));

  for (const r of results) {
    const statusIcon = r.status === 'PASS' ? ' OK ' : 'FAIL';
    console.log(
      `  ${r.id}  | ${statusIcon}   | ${String(r.passed).padStart(4)} | ${String(r.failed).padStart(4)} | ${r.duration.padStart(5)}s | ${r.name}`
    );
  }

  console.log('  ' + '-'.repeat(54));
  console.log(
    `  ALL | ${totalFailed === 0 ? ' OK ' : 'FAIL'}   | ${String(totalPassed).padStart(4)} | ${String(totalFailed).padStart(4)} |       | Total`
  );
  console.log('');
  console.log('='.repeat(60));

  if (totalFailed > 0) {
    console.log(`\n  RESULT: ${totalFailed} test(s) FAILED\n`);
    process.exit(1);
  } else {
    console.log(`\n  RESULT: All ${totalPassed} tests PASSED\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Orchestrator error:', err);
  process.exit(1);
});
