/**
 * 任务大厅 v2 完整流程测试
 *
 * 测试新功能：
 * - 锁单机制
 * - 时间线追踪
 * - 评价系统
 * - 三类用户
 */

const http = require('http');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:3001';

// 使用原生 http 模块绕过代理
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          reject(new Error(`Invalid JSON: ${data.slice(0, 100)}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Agent 挑战解答器
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
        if (q.input.operation === 'add') answer = String(q.input.a + q.input.b);
        else if (q.input.operation === 'multiply') answer = String(q.input.a * q.input.b);
        else if (q.input.operation === 'power') answer = String(Math.pow(q.input.base, q.input.exponent));
        else if (q.input.operation === 'factorial') {
          let f = 1; for (let i = 2; i <= q.input.n; i++) f *= i;
          answer = String(f);
        }
        break;
      case 'timestamp':
        answer = String(Math.floor(new Date(q.input).getTime() / 1000));
        break;
      case 'string':
        if (q.input.operation === 'reverse') answer = q.input.string.split('').reverse().join('');
        else if (q.input.operation === 'count_char') answer = String((q.input.string.match(new RegExp(q.input.char, 'g')) || []).length);
        else if (q.input.operation === 'length') answer = String(q.input.string.length);
        else if (q.input.operation === 'uppercase') answer = q.input.string.toUpperCase();
        break;
    }
    answers.push(answer);
  }
  return answers;
}

// 辅助函数：注册 Agent
async function registerAgent(name, skills, description) {
  const { data: challenge } = await request('GET', '/api/hall/register/challenge');
  const answers = solveChallenge(challenge.questions);
  const { data } = await request('POST', '/api/hall/register', {
    challenge_id: challenge.challenge_id,
    answers: answers,
    name: name,
    skills: skills,
    description: description
  });
  return data;
}

async function runTest() {
  console.log('='.repeat(60));
  console.log('任务大厅 v2 完整流程测试');
  console.log('='.repeat(60));

  let taskId = null;
  let agentKey1 = null;
  let agentKey2 = null;
  let clientKey = null;

  // 1. 健康检查
  console.log('\n[1/12] 健康检查...');
  try {
    const { data } = await request('GET', '/api/health');
    console.log(`✅ 服务正常 | 版本: ${data.version}`);
  } catch (err) {
    console.log(`❌ 服务不可用`);
    process.exit(1);
  }

  // 2. 人类客户注册
  console.log('\n[2/12] 人类客户注册...');
  try {
    const { data } = await request('POST', '/api/hall/client/register', {
      name: '张三',
      email: `human-${Date.now()}@example.com`,
      password: 'TestPass123',
      recaptchaToken: 'test-token'
    });
    if (data.success) {
      clientKey = data.api_key;
      console.log(`✅ 人类客户注册成功`);
      console.log(`   Client Key: ${clientKey.substring(0, 20)}...`);
    }
  } catch (err) {
    console.log(`❌ 注册失败: ${err.message}`);
  }

  // 3. Agent 1 注册（写作专家）
  console.log('\n[3/12] Agent 1 注册（写作专家）...');
  try {
    const data = await registerAgent(
      '写作专家 Alpha',
      ['writing', 'translation'],
      '专业文章写作'
    );
    if (data.success) {
      agentKey1 = data.api_key;
      console.log(`✅ Agent 1 注册成功`);
    }
  } catch (err) {
    console.log(`❌ 注册失败: ${err.message}`);
  }

  // 4. Agent 2 注册（也是写作）
  console.log('\n[4/12] Agent 2 注册（竞争者）...');
  try {
    const data = await registerAgent(
      '写作专家 Beta',
      ['writing'],
      '另一个写作 Agent'
    );
    if (data.success) {
      agentKey2 = data.api_key;
      console.log(`✅ Agent 2 注册成功`);
    }
  } catch (err) {
    console.log(`❌ 注册失败: ${err.message}`);
  }

  // 5. 人类客户发布任务
  console.log('\n[5/12] 人类客户发布任务...');
  try {
    const { data } = await request('POST', '/api/hall/post', {
      title: '写一篇产品介绍',
      description: '需要 1000 字，介绍我们的新产品',
      category: 'writing',
      budget: 150,
      deadline_hours: 48
    }, { 'X-Client-Key': clientKey });

    if (data.success) {
      taskId = data.task_id;
      console.log(`✅ 任务发布成功`);
      console.log(`   Task ID: ${taskId}`);
      console.log(`   追踪地址: ${data.track_url}`);
    }
  } catch (err) {
    console.log(`❌ 发布失败`);
  }

  // 6. 查看任务追踪（初始状态）
  console.log('\n[6/12] 查看任务追踪（初始状态）...');
  try {
    const { data } = await request('GET', `/api/hall/track/${taskId}`);
    console.log(`✅ 任务状态: ${data.status}`);
    console.log(`   时间线事件数: ${data.timeline.length}`);
    console.log(`   截止时间: ${data.timestamps.deadline}`);
  } catch (err) {
    console.log(`❌ 追踪失败`);
  }

  // 7. 测试锁单机制 - Agent 1 和 Agent 2 同时抢单
  console.log('\n[7/12] 测试锁单机制...');
  try {
    // 模拟并发：同时发起两个接单请求
    const [result1, result2] = await Promise.all([
      request('POST', `/api/hall/tasks/${taskId}/claim`, null, { 'X-Agent-Key': agentKey1 }),
      request('POST', `/api/hall/tasks/${taskId}/claim`, null, { 'X-Agent-Key': agentKey2 })
    ]);

    const success1 = result1.data.success;
    const success2 = result2.data.success;

    if (success1 && !success2) {
      console.log(`✅ 锁单机制正常: Agent 1 抢到了`);
      console.log(`   Agent 2 收到: ${result2.data.error || result2.data.message}`);
    } else if (!success1 && success2) {
      console.log(`✅ 锁单机制正常: Agent 2 抢到了`);
      // 更新 agentKey1 为成功的那个
      agentKey1 = agentKey2;
    } else if (success1 && success2) {
      console.log(`⚠️ 锁单机制可能有问题: 两个都成功了`);
    } else {
      console.log(`⚠️ 都失败了: ${result1.data.error}, ${result2.data.error}`);
    }
  } catch (err) {
    console.log(`❌ 测试失败: ${err.message}`);
  }

  // 8. Agent 提交结果
  console.log('\n[8/12] Agent 提交结果...');
  try {
    const { data } = await request('POST', `/api/hall/tasks/${taskId}/submit`, {
      result: `# 新产品介绍\n\n我们很高兴地向您介绍我们的最新产品...\n\n（约 1000 字）`,
      metadata: { model: 'gpt-4', tokens: 800 }
    }, { 'X-Agent-Key': agentKey1 });

    if (data.success) {
      console.log(`✅ 结果已提交`);
      console.log(`   预期收益: ¥${data.expected_earnings}`);
    }
  } catch (err) {
    console.log(`❌ 提交失败`);
  }

  // 9. 查看时间线
  console.log('\n[9/12] 查看完整时间线...');
  try {
    const { data } = await request('GET', `/api/hall/track/${taskId}`);
    console.log(`✅ 任务状态: ${data.status}`);
    console.log(`   时间线:`);
    data.timeline.forEach((e, i) => {
      console.log(`     ${i + 1}. [${e.event}] by ${e.actor} @ ${e.time}`);
    });
  } catch (err) {
    console.log(`❌ 追踪失败`);
  }

  // 10. 人类验收
  console.log('\n[10/12] 人类验收...');
  try {
    const { data } = await request('POST', `/api/hall/tasks/${taskId}/accept`);
    if (data.success) {
      console.log(`✅ 验收通过`);
      console.log(`   Agent 收入: ¥${data.settlement.agent_earnings}`);
      console.log(`   平台抽成: ¥${data.settlement.platform_fee}`);
    }
  } catch (err) {
    console.log(`❌ 验收失败`);
  }

  // 11. 人类评价
  console.log('\n[11/12] 人类评价 Agent...');
  try {
    const { data } = await request('POST', `/api/hall/tasks/${taskId}/rate`, {
      rating: 5,
      comment: '写得很好，专业！'
    });
    if (data.success) {
      console.log(`✅ 评价成功: 5 星`);
    }
  } catch (err) {
    console.log(`❌ 评价失败`);
  }

  // 12. 最终时间线
  console.log('\n[12/12] 查看最终时间线...');
  try {
    const { data } = await request('GET', `/api/hall/track/${taskId}`);
    console.log(`✅ 最终状态: ${data.status}`);
    console.log(`   评价: ${data.rating?.score} 星 - "${data.rating?.comment}"`);
    console.log(`   完整时间线:`);
    data.timeline.forEach((e, i) => {
      console.log(`     ${i + 1}. [${e.event}] by ${e.actor}`);
    });
  } catch (err) {
    console.log(`❌ 追踪失败`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('测试完成！');
  console.log('='.repeat(60));
}

runTest().catch(console.error);
