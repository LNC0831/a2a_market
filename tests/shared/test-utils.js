/**
 * Shared Test Utilities for A2A Marketplace External Agent Test Suite
 *
 * Provides: HTTP client, challenge solver, test framework, agent registration helper.
 * All test agents depend on this module.
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');

// ==================== Configuration ====================

const API_BASE = process.env.A2A_API_URL || 'https://api.agentmkt.net';
const isHttps = API_BASE.startsWith('https');
const parsedUrl = new URL(API_BASE);

const TEST_RUN_ID = `test_${Date.now()}`;

// ==================== HTTP Client ====================

/**
 * Make an HTTP(S) request to the API.
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g. '/api/hall/tasks')
 * @param {object|null} body - Request body (auto-serialized to JSON)
 * @param {object} headers - Additional headers
 * @returns {Promise<{status: number, data: any}>}
 */
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'close',
        ...headers
      },
      agent: false
    };

    const protocol = isHttps ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            parseError: e.message
          });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout (30s)'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ==================== Challenge Solver ====================

/**
 * Evaluate a math expression using integer arithmetic (shunting-yard algorithm).
 * Supports: +, -, *, / (floor division), parentheses, negative numbers.
 */
function evaluateMathExpression(expr) {
  expr = expr.trim();

  // Tokenize
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    if (/\s/.test(expr[i])) {
      i++;
      continue;
    }
    if (/\d/.test(expr[i]) || (expr[i] === '-' && (tokens.length === 0 || tokens[tokens.length - 1] === '('))) {
      let num = '';
      if (expr[i] === '-') {
        num = '-';
        i++;
      }
      while (i < expr.length && /\d/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push(parseInt(num));
    } else if ('+-*/()'.includes(expr[i])) {
      tokens.push(expr[i]);
      i++;
    } else {
      i++;
    }
  }

  // Shunting-yard → postfix
  const output = [];
  const ops = [];
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };

  for (const token of tokens) {
    if (typeof token === 'number') {
      output.push(token);
    } else if ('+-*/'.includes(token)) {
      while (ops.length > 0 && ops[ops.length - 1] !== '(' &&
             precedence[ops[ops.length - 1]] >= precedence[token]) {
        output.push(ops.pop());
      }
      ops.push(token);
    } else if (token === '(') {
      ops.push(token);
    } else if (token === ')') {
      while (ops.length > 0 && ops[ops.length - 1] !== '(') {
        output.push(ops.pop());
      }
      ops.pop();
    }
  }
  while (ops.length > 0) {
    output.push(ops.pop());
  }

  // Evaluate postfix
  const stack = [];
  for (const token of output) {
    if (typeof token === 'number') {
      stack.push(token);
    } else {
      const b = stack.pop();
      const a = stack.pop();
      switch (token) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/': stack.push(Math.floor(a / b)); break;
      }
    }
  }
  return stack[0];
}

/**
 * Solve registration challenge questions.
 * @param {object} challengeData - Response from GET /api/hall/register/challenge
 * @returns {string[]} Array of answer strings
 */
function solveChallenge(challengeData) {
  const questions = challengeData.questions || challengeData.challenges || [];
  const answers = [];

  for (const q of questions) {
    let answer;

    switch (q.type) {
      case 'sha256':
        answer = crypto.createHash('sha256').update(q.input).digest('hex');
        break;

      case 'base64_decode':
        answer = Buffer.from(q.input, 'base64').toString('utf-8');
        break;

      case 'math':
        if (q.expression) {
          answer = String(evaluateMathExpression(q.expression));
        } else if (q.input) {
          if (q.input.operation === 'add') {
            answer = String(q.input.a + q.input.b);
          } else if (q.input.operation === 'multiply') {
            answer = String(q.input.a * q.input.b);
          } else if (q.input.operation === 'power') {
            answer = String(Math.pow(q.input.base, q.input.exponent));
          } else if (q.input.operation === 'factorial') {
            let factorial = 1;
            for (let i = 2; i <= q.input.n; i++) factorial *= i;
            answer = String(factorial);
          }
        }
        break;

      case 'timestamp':
        answer = String(Math.floor(new Date(q.input).getTime() / 1000));
        break;

      case 'string':
        if (q.input.operation === 'reverse') {
          answer = q.input.string.split('').reverse().join('');
        } else if (q.input.operation === 'count_char') {
          answer = String((q.input.string.match(new RegExp(q.input.char, 'g')) || []).length);
        } else if (q.input.operation === 'length') {
          answer = String(q.input.string.length);
        } else if (q.input.operation === 'uppercase') {
          answer = q.input.string.toUpperCase();
        }
        break;
    }

    answers.push(answer);
  }

  return answers;
}

/**
 * Register a new agent with [TEST] prefix.
 * Gets challenge, solves it, registers.
 * @param {string} suffix - Name suffix (e.g. 'worker', 'poster')
 * @param {string[]} skills - Array of skill names
 * @returns {Promise<{agent_id: string, api_key: string}>}
 */
async function registerAgent(suffix, skills = ['writing', 'testing']) {
  const challengeRes = await request('GET', '/api/hall/register/challenge');
  if (challengeRes.status !== 200) {
    throw new Error(`Failed to get challenge: ${challengeRes.status} ${JSON.stringify(challengeRes.data)}`);
  }

  const answers = solveChallenge(challengeRes.data);

  const regRes = await request('POST', '/api/hall/register', {
    challenge_id: challengeRes.data.challenge_id,
    answers: answers,
    name: `[TEST] ${suffix}_${TEST_RUN_ID}`,
    skills: skills,
    description: `Test agent (${suffix}) - automated test run ${TEST_RUN_ID}`
  });

  if (regRes.status !== 200 || !regRes.data.success) {
    throw new Error(`Registration failed: ${regRes.status} ${JSON.stringify(regRes.data)}`);
  }

  return {
    agent_id: regRes.data.agent_id,
    api_key: regRes.data.api_key
  };
}

// ==================== Test Framework ====================

const _results = {
  passed: 0,
  failed: 0,
  tests: [],
  startTime: Date.now()
};

/**
 * Run a named test case.
 * @param {string} name - Test name
 * @param {Function} fn - Async test function
 */
async function test(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    _results.passed++;
    _results.tests.push({ name, status: 'passed', duration });
    console.log(`  [PASS] ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    _results.failed++;
    _results.tests.push({ name, status: 'failed', error: error.message, duration });
    console.log(`  [FAIL] ${name}`);
    console.log(`         Error: ${error.message}`);
  }
}

/**
 * Assert a condition is truthy.
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

/**
 * Assert strict equality.
 */
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/**
 * Print test summary and exit with appropriate code.
 */
function printSummary() {
  const duration = ((Date.now() - _results.startTime) / 1000).toFixed(2);
  const total = _results.passed + _results.failed;

  console.log('\n' + '-'.repeat(50));
  console.log(`  Total: ${total}  |  Passed: ${_results.passed}  |  Failed: ${_results.failed}  |  ${duration}s`);
  console.log('-'.repeat(50));

  if (_results.failed > 0) {
    console.log('\n  Failed tests:');
    _results.tests
      .filter(t => t.status === 'failed')
      .forEach(t => console.log(`    - ${t.name}: ${t.error}`));
  }

  console.log('');
  process.exit(_results.failed > 0 ? 1 : 0);
}

/**
 * Sleep for ms milliseconds.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== Cleanup ====================

/**
 * Clean up open [TEST] tasks created by a specific API key.
 * Fetches my-orders, filters open tasks with [TEST] in title, cancels each.
 * @param {string} apiKey - The X-Agent-Key used to post tasks
 * @returns {Promise<number>} Number of tasks cleaned up
 */
async function cleanupOpenTasks(apiKey) {
  try {
    const ordersRes = await request('GET', '/api/hall/my-orders', null, { 'X-Agent-Key': apiKey });
    if (ordersRes.status !== 200 || !ordersRes.data.orders) return 0;

    const openTestTasks = ordersRes.data.orders.filter(
      o => o.status === 'open' && o.title && o.title.includes('[TEST]')
    );

    let cleaned = 0;
    for (const task of openTestTasks) {
      const taskId = task.task_id || task.id;
      const cancelRes = await request('POST', `/api/hall/tasks/${taskId}/cancel`, null, { 'X-Agent-Key': apiKey });
      if (cancelRes.status === 200) cleaned++;
    }

    if (cleaned > 0) {
      console.log(`  [CLEANUP] Cancelled ${cleaned} open [TEST] task(s)`);
    }
    return cleaned;
  } catch (err) {
    console.log(`  [CLEANUP] Warning: ${err.message}`);
    return 0;
  }
}

// ==================== Exports ====================

module.exports = {
  API_BASE,
  TEST_RUN_ID,
  request,
  solveChallenge,
  registerAgent,
  test,
  assert,
  assertEqual,
  printSummary,
  sleep,
  cleanupOpenTasks
};
