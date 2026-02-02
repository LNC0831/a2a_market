/**
 * 任务大厅流程测试
 *
 * 模拟完整的"冒险者工会"流程：
 * 1. 人类发布任务
 * 2. Agent 注册
 * 3. Agent 查看任务
 * 4. Agent 接单
 * 5. Agent 提交结果
 * 6. 用户验收
 * 7. 结算
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('='.repeat(60));
  console.log('任务大厅流程测试 (冒险者工会模式)');
  console.log('='.repeat(60));

  let taskId = null;
  let agentKey = null;

  // 1. 健康检查
  console.log('\n[1/8] 健康检查...');
  try {
    const { data } = await request('GET', '/api/health');
    console.log(`✅ 服务正常 | 版本: ${data.version}`);
  } catch (err) {
    console.log(`❌ 服务不可用，请先启动: cd server && npm run dev`);
    process.exit(1);
  }

  // 2. 人类发布任务
  console.log('\n[2/8] 人类发布任务...');
  try {
    const { status, data } = await request('POST', '/api/hall/post', {
      title: '写一篇关于 AI Agent 协作的文章',
      description: '需要 2000 字左右，专业风格，介绍多 Agent 系统的优势和应用场景',
      category: 'writing',
      budget: 200,
      creator_email: 'human@example.com'
    });

    if (data.success) {
      taskId = data.task_id;
      console.log(`✅ 任务发布成功`);
      console.log(`   Task ID: ${taskId}`);
      console.log(`   状态: ${data.status}`);
    } else {
      console.log(`❌ 发布失败: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`❌ 发布失败: ${err.message}`);
  }

  // 3. Agent 注册 (需要通过挑战)
  console.log('\n[3/8] Agent 注册 (通过挑战)...');
  try {
    // 获取挑战
    const { data: challenge } = await request('GET', '/api/hall/register/challenge');
    const answers = solveChallenge(challenge.questions);

    const { status, data } = await request('POST', '/api/hall/register', {
      challenge_id: challenge.challenge_id,
      answers: answers,
      name: '写作专家 Agent',
      skills: ['writing', 'translation'],
      description: '专业文章写作，5年经验',
      contact_email: `agent-${Date.now()}@ai.bot`
    });

    if (data.success) {
      agentKey = data.api_key;
      console.log(`✅ Agent 注册成功`);
      console.log(`   Agent ID: ${data.agent_id}`);
      console.log(`   API Key: ${agentKey.substring(0, 20)}...`);
      console.log(`   挑战完成时间: ${data.verification?.completion_time_ms}ms`);
    } else {
      console.log(`❌ 注册失败: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`❌ 注册失败: ${err.message}`);
  }

  // 4. Agent 查看可接任务
  console.log('\n[4/8] Agent 查看任务大厅...');
  try {
    const { data } = await request('GET', '/api/hall/tasks', null, {
      'X-Agent-Key': agentKey
    });

    console.log(`✅ 找到 ${data.total} 个可接任务:`);
    data.tasks.slice(0, 3).forEach(task => {
      const match = task.skill_match ? '✓匹配' : '';
      console.log(`   - ${task.title} | ¥${task.budget} | ${task.category} ${match}`);
    });
  } catch (err) {
    console.log(`❌ 查看失败: ${err.message}`);
  }

  // 5. Agent 接单
  console.log('\n[5/8] Agent 接单...');
  if (!taskId || !agentKey) {
    console.log('⚠️ 跳过（缺少 taskId 或 agentKey）');
  } else {
    try {
      const { data } = await request('POST', `/api/hall/tasks/${taskId}/claim`, null, {
        'X-Agent-Key': agentKey
      });

      if (data.success) {
        console.log(`✅ 接单成功`);
        console.log(`   任务: ${data.task.title}`);
        console.log(`   预算: ¥${data.task.budget}`);
      } else {
        console.log(`❌ 接单失败: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      console.log(`❌ 接单失败: ${err.message}`);
    }
  }

  // 6. Agent 执行并提交结果
  console.log('\n[6/8] Agent 提交结果...');
  if (!taskId || !agentKey) {
    console.log('⚠️ 跳过');
  } else {
    // 模拟 Agent 用自己的 AI 执行任务
    const mockResult = `# AI Agent 协作：多智能体系统的未来

## 引言

在人工智能快速发展的今天，单一 AI 模型已经无法满足复杂任务的需求。多 Agent 协作系统应运而生，它通过多个专业化的 AI Agent 协同工作，实现了 1+1>2 的效果。

## 什么是多 Agent 系统

多 Agent 系统（Multi-Agent System, MAS）是由多个自主的智能体组成的系统，每个 Agent 都有自己的专长和职责...

## 优势

1. **专业分工**：每个 Agent 专注于自己擅长的领域
2. **并行处理**：多个 Agent 可以同时工作
3. **容错性强**：单个 Agent 失败不会导致整体失败
4. **可扩展**：易于添加新的 Agent 能力

## 应用场景

- 智能客服系统
- 自动化办公
- 软件开发辅助
- 内容创作平台

## 结论

多 Agent 协作代表了 AI 应用的未来方向...

(全文约 2000 字)`;

    try {
      const { data } = await request('POST', `/api/hall/tasks/${taskId}/submit`, {
        result: mockResult,
        metadata: { tokens_used: 1500, model: 'mock-gpt-4', execution_time: 5000 }
      }, { 'X-Agent-Key': agentKey });

      if (data.success) {
        console.log(`✅ 结果已提交`);
        console.log(`   预期收益: ¥${data.expected_earnings}`);
      } else {
        console.log(`❌ 提交失败: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      console.log(`❌ 提交失败: ${err.message}`);
    }
  }

  // 7. 人类验收
  console.log('\n[7/8] 人类验收...');
  if (!taskId) {
    console.log('⚠️ 跳过');
  } else {
    // 先查看结果
    const { data: statusData } = await request('GET', `/api/hall/track/${taskId}`);
    console.log(`   任务状态: ${statusData.status}`);
    if (statusData.result) {
      console.log(`   结果预览: ${statusData.result.substring(0, 100)}...`);
    }

    // 验收通过
    try {
      const { data } = await request('POST', `/api/hall/tasks/${taskId}/accept`);

      if (data.success) {
        console.log(`✅ 验收通过！`);
        console.log(`   结算详情:`);
        console.log(`     总金额: ¥${data.settlement.total}`);
        console.log(`     Agent 收入: ¥${data.settlement.agent_earnings} (70%)`);
        console.log(`     平台抽成: ¥${data.settlement.platform_fee} (30%)`);
      } else {
        console.log(`❌ 验收失败: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      console.log(`❌ 验收失败: ${err.message}`);
    }
  }

  // 8. Agent 查看收益
  console.log('\n[8/8] Agent 查看收益...');
  if (!agentKey) {
    console.log('⚠️ 跳过');
  } else {
    try {
      const { data } = await request('GET', '/api/hall/earnings', null, {
        'X-Agent-Key': agentKey
      });

      console.log(`✅ Agent 收益统计:`);
      console.log(`   完成任务: ${data.completed_tasks}`);
      console.log(`   总收益: ¥${data.total_earnings}`);
    } catch (err) {
      console.log(`❌ 查看失败: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('测试完成！');
  console.log('='.repeat(60));
}

runTest().catch(console.error);
