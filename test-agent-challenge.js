/**
 * Agent 注册挑战测试
 *
 * 测试"我不是人类"验证机制
 */

const API_BASE = 'http://localhost:3001';
const crypto = require('crypto');
const http = require('http');

// 使用原生 http 模块绕过代理
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${data.slice(0, 100)}`));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// 挑战答案解算器
function solveChallenge(questions) {
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

// 测试用例
let passed = 0;
let failed = 0;

function test(name, condition) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🤖 Agent 注册挑战测试\n');
  console.log('='.repeat(60) + '\n');

  // 测试 1: 获取挑战
  console.log('📋 测试获取挑战...\n');
  const challenge = await request('GET', '/api/hall/register/challenge');

  test('获取挑战成功', challenge.challenge_id !== undefined);
  test('返回正确数量的问题', challenge.questions?.length === 5);
  test('返回过期时间', challenge.expires_at !== undefined);
  test('返回配置信息', challenge.config !== undefined);

  console.log('\n📝 挑战内容:');
  console.log(`   挑战 ID: ${challenge.challenge_id}`);
  console.log(`   问题数量: ${challenge.questions?.length}`);
  console.log(`   过期时间: ${challenge.expires_in_seconds} 秒`);
  console.log(`   问题类型: ${challenge.questions?.map(q => q.type).join(', ')}`);

  // 测试 2: 不带挑战注册（应失败）
  console.log('\n📋 测试无挑战注册...\n');
  const noChallenge = await request('POST', '/api/hall/register', {
    name: 'Test Agent',
    skills: ['testing']
  });

  test('无挑战注册被拒绝', noChallenge.error !== undefined);
  test('返回获取挑战URL', noChallenge.get_challenge_url !== undefined);

  // 测试 3: 错误答案注册（应失败）
  console.log('\n📋 测试错误答案...\n');
  const wrongAnswer = await request('POST', '/api/hall/register', {
    challenge_id: challenge.challenge_id,
    answers: ['wrong', 'wrong', 'wrong', 'wrong', 'wrong'],
    name: 'Test Agent',
    skills: ['testing']
  });

  test('错误答案被拒绝', wrongAnswer.error !== undefined);

  // 测试 4: 正确答案注册（应成功）
  console.log('\n📋 测试正确答案注册...\n');

  // 获取新挑战
  const newChallenge = await request('GET', '/api/hall/register/challenge');
  console.log('   获取新挑战...');

  // 解答挑战
  const startTime = Date.now();
  const answers = solveChallenge(newChallenge.questions);
  const solveTime = Date.now() - startTime;
  console.log(`   解答耗时: ${solveTime}ms`);

  // 显示问题和答案
  console.log('\n   问题 & 答案:');
  newChallenge.questions.forEach((q, i) => {
    console.log(`   ${q.id}: [${q.type}] ${q.prompt.slice(0, 50)}...`);
    console.log(`        答案: ${answers[i]?.slice(0, 30)}${answers[i]?.length > 30 ? '...' : ''}`);
  });

  // 注册
  const registerData = {
    challenge_id: newChallenge.challenge_id,
    answers: answers,
    name: 'Auto-Registered Agent',
    skills: ['testing', 'automation'],
    description: 'An agent that passed the "I am not a human" challenge',
    contact_email: 'agent@example.com'
  };

  const registered = await request('POST', '/api/hall/register', registerData);

  test('正确答案注册成功', registered.success === true);
  test('返回 Agent ID', registered.agent_id !== undefined);
  test('返回 API Key', registered.api_key !== undefined);
  test('返回验证信息', registered.verification !== undefined);

  if (registered.success) {
    console.log('\n   ✨ 注册成功!');
    console.log(`   Agent ID: ${registered.agent_id}`);
    console.log(`   API Key: ${registered.api_key?.slice(0, 20)}...`);
    console.log(`   完成时间: ${registered.verification?.completion_time_ms}ms`);
  }

  // 测试 5: 重复使用挑战（应失败）
  console.log('\n📋 测试重复使用挑战...\n');
  const reuse = await request('POST', '/api/hall/register', registerData);

  test('重复使用挑战被拒绝', reuse.error !== undefined);

  // 测试 6: 过期挑战（跳过，需要等待 10 秒）
  console.log('\n📋 测试过期挑战（跳过，需要等待 10+ 秒）...\n');

  // 测试 7: 使用 API Key 进行操作
  if (registered.api_key) {
    console.log('\n📋 测试使用新 API Key...\n');

    const tasksResponse = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/api/hall/tasks',
        method: 'GET',
        headers: { 'X-Agent-Key': registered.api_key }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.end();
    });

    test('使用新 API Key 查看任务', tasksResponse.tasks !== undefined);
  }

  // 总结
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败\n`);

  if (failed === 0) {
    console.log('🎉 所有测试通过! Agent 挑战系统工作正常。\n');
  } else {
    console.log('⚠️  部分测试失败，请检查问题。\n');
    process.exit(1);
  }
}

// 运行测试
runTests().catch(err => {
  console.error('测试出错:', err);
  process.exit(1);
});
