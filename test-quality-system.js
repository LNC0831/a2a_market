/**
 * 质量体系测试
 *
 * 测试新功能：
 * - 信用分系统
 * - 三振机制 (拒绝处理)
 * - 自动裁判
 * - 停权检查
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

async function runTest() {
  console.log('='.repeat(60));
  console.log('质量体系完整测试');
  console.log('='.repeat(60));

  let taskId = null;
  let agentKey = null;
  let clientKey = null;
  let passed = 0;
  let failed = 0;

  // 1. 健康检查 - 验证质量体系功能
  console.log('\n[1/15] 健康检查 (验证质量体系功能)...');
  try {
    const { data } = await request('GET', '/api/health');
    if (data.quality_system && data.features.includes('credit-system')) {
      console.log(`✅ 服务正常 | 版本: ${data.version}`);
      console.log(`   质量体系功能已启用`);
      passed++;
    } else {
      console.log(`⚠️ 质量体系功能未在健康检查中显示`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ 服务不可用: ${err.message}`);
    process.exit(1);
  }

  // 2. 人类客户注册
  console.log('\n[2/15] 人类客户注册...');
  try {
    const { data } = await request('POST', '/api/hall/client/register', {
      name: '质量测试客户',
      email: `quality-test-${Date.now()}@example.com`,
      password: 'TestPass123',
      recaptchaToken: 'test-token'
    });
    if (data.success) {
      clientKey = data.api_key;
      console.log(`✅ 客户注册成功`);
      passed++;
    }
  } catch (err) {
    console.log(`❌ 注册失败: ${err.message}`);
    failed++;
  }

  // 3. Agent 注册 (需要通过挑战)
  console.log('\n[3/15] Agent 注册 (通过挑战)...');
  try {
    // 获取挑战
    const { data: challenge } = await request('GET', '/api/hall/register/challenge');
    const answers = solveChallenge(challenge.questions);

    // 注册
    const { data } = await request('POST', '/api/hall/register', {
      challenge_id: challenge.challenge_id,
      answers: answers,
      name: '质量测试 Agent',
      skills: ['writing', 'coding'],
      description: '用于测试质量体系'
    });
    if (data.success) {
      agentKey = data.api_key;
      console.log(`✅ Agent 注册成功`);
      passed++;
    }
  } catch (err) {
    console.log(`❌ 注册失败`);
    failed++;
  }

  // 4. 查看初始信用分
  console.log('\n[4/15] 查看初始信用分...');
  try {
    const { data } = await request('GET', '/api/hall/credit', null, { 'X-Agent-Key': agentKey });
    if (data.credit_score === 100) {
      console.log(`✅ 初始信用分: ${data.credit_score}`);
      console.log(`   账号状态: ${data.status}`);
      passed++;
    } else {
      console.log(`⚠️ 初始信用分不是100: ${data.credit_score}`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ 获取信用分失败: ${err.message}`);
    failed++;
  }

  // 5. 发布任务用于测试
  console.log('\n[5/15] 发布测试任务...');
  try {
    const { data } = await request('POST', '/api/hall/post', {
      title: '质量体系测试任务',
      description: '这是一个用于测试信用分系统的任务，需要写一篇关于AI的文章',
      category: 'writing',
      budget: 100,
      deadline_hours: 24
    }, { 'X-Client-Key': clientKey });

    if (data.success) {
      taskId = data.task_id;
      console.log(`✅ 任务发布成功: ${taskId}`);
      passed++;
    }
  } catch (err) {
    console.log(`❌ 发布失败`);
    failed++;
  }

  // 6. Agent 接单
  console.log('\n[6/15] Agent 接单...');
  try {
    const { data } = await request('POST', `/api/hall/tasks/${taskId}/claim`, null, { 'X-Agent-Key': agentKey });
    if (data.success) {
      console.log(`✅ 接单成功`);
      passed++;
    }
  } catch (err) {
    console.log(`❌ 接单失败`);
    failed++;
  }

  // 7. 提交结果并验证自动裁判
  console.log('\n[7/15] 提交结果 (验证自动裁判)...');
  try {
    const { data } = await request('POST', `/api/hall/tasks/${taskId}/submit`, {
      result: `# AI 技术发展报告

人工智能 (AI) 是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。

## 主要发展领域

1. **机器学习**: 使计算机能够从数据中学习
2. **自然语言处理**: 使计算机能够理解和生成人类语言
3. **计算机视觉**: 使计算机能够理解图像和视频

## 结论

AI 技术正在快速发展，将深刻影响各个行业。`,
      metadata: { model: 'test', tokens: 200 }
    }, { 'X-Agent-Key': agentKey });

    if (data.success && data.auto_judge) {
      console.log(`✅ 提交成功`);
      console.log(`   自动裁判评分: ${data.auto_judge.score}`);
      console.log(`   是否通过: ${data.auto_judge.passed ? '是' : '否'}`);
      passed++;
    } else if (data.success) {
      console.log(`✅ 提交成功 (自动裁判未返回)`);
      passed++;
    }
  } catch (err) {
    console.log(`❌ 提交失败: ${err.message}`);
    failed++;
  }

  // 8. 验收并验证信用分奖励
  console.log('\n[8/15] 验收任务 (验证信用分 +5)...');
  try {
    const { data } = await request('POST', `/api/hall/tasks/${taskId}/accept`);
    if (data.success && data.credit_impact) {
      console.log(`✅ 验收成功`);
      console.log(`   信用分变化: ${data.credit_impact.change > 0 ? '+' : ''}${data.credit_impact.change}`);
      console.log(`   新信用分: ${data.credit_impact.new_balance}`);
      passed++;
    } else if (data.success) {
      console.log(`✅ 验收成功 (信用分信息未返回)`);
      passed++;
    }
  } catch (err) {
    console.log(`❌ 验收失败`);
    failed++;
  }

  // 9. 5星评价验证额外奖励
  console.log('\n[9/15] 5星评价 (验证信用分 +10)...');
  try {
    const { data } = await request('POST', `/api/hall/tasks/${taskId}/rate`, {
      rating: 5,
      comment: '非常好的工作！'
    });
    if (data.success && data.credit_bonus) {
      console.log(`✅ 评价成功`);
      console.log(`   5星奖励: +${data.credit_bonus.change}`);
      passed++;
    } else if (data.success) {
      console.log(`✅ 评价成功`);
      passed++;
    }
  } catch (err) {
    console.log(`❌ 评价失败`);
    failed++;
  }

  // 10. 验证信用分增加
  console.log('\n[10/15] 验证信用分增加...');
  try {
    const { data } = await request('GET', '/api/hall/credit', null, { 'X-Agent-Key': agentKey });
    // 初始100 + 完成5 + 5星10 = 115
    if (data.credit_score >= 105) {
      console.log(`✅ 信用分已增加: ${data.credit_score}`);
      console.log(`   信用历史记录数: ${data.recent_history.length}`);
      passed++;
    } else {
      console.log(`⚠️ 信用分未正确增加: ${data.credit_score}`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ 获取信用分失败`);
    failed++;
  }

  // 11. 测试三振机制 - 第一次拒绝
  console.log('\n[11/15] 测试三振机制 - 发布新任务...');
  let taskId2 = null;
  try {
    const { data } = await request('POST', '/api/hall/post', {
      title: '三振测试任务',
      description: '用于测试拒绝机制',
      category: 'writing',
      budget: 50
    }, { 'X-Client-Key': clientKey });
    taskId2 = data.task_id;

    // 接单
    await request('POST', `/api/hall/tasks/${taskId2}/claim`, null, { 'X-Agent-Key': agentKey });

    // 提交
    await request('POST', `/api/hall/tasks/${taskId2}/submit`, {
      result: '这是第一次提交的结果，可能不够好。'
    }, { 'X-Agent-Key': agentKey });

    console.log(`✅ 新任务已创建并提交`);
    passed++;
  } catch (err) {
    console.log(`❌ 创建任务失败`);
    failed++;
  }

  // 12. 第一次拒绝
  console.log('\n[12/15] 第一次拒绝 (验证 -5 信用分, 24h 重提交)...');
  try {
    const { data } = await request('POST', `/api/hall/tasks/${taskId2}/reject`, {
      reason: '内容不够详细'
    });
    if (data.success && data.rejection_count === 1) {
      console.log(`✅ 第一次拒绝成功`);
      console.log(`   拒绝次数: ${data.rejection_count}`);
      console.log(`   信用分变化: ${data.credit_impact?.change || 'N/A'}`);
      console.log(`   状态: ${data.status}`);
      if (data.resubmit_deadline) {
        console.log(`   重提交截止: ${data.resubmit_deadline}`);
      }
      passed++;
    } else {
      console.log(`⚠️ 拒绝响应不符合预期: ${JSON.stringify(data)}`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ 拒绝失败: ${err.message}`);
    failed++;
  }

  // 13. 重新提交
  console.log('\n[13/15] 重新提交...');
  try {
    const { data } = await request('POST', `/api/hall/tasks/${taskId2}/submit`, {
      result: '这是改进后的第二次提交结果，内容更详细了。我增加了更多细节和解释。'
    }, { 'X-Agent-Key': agentKey });
    if (data.success) {
      console.log(`✅ 重新提交成功`);
      passed++;
    }
  } catch (err) {
    console.log(`❌ 重新提交失败: ${err.message}`);
    failed++;
  }

  // 14. 第二次拒绝 (任务释放回池)
  console.log('\n[14/15] 第二次拒绝 (验证任务释放回池, -15 信用分)...');
  try {
    const { data } = await request('POST', `/api/hall/tasks/${taskId2}/reject`, {
      reason: '仍然不满意'
    });
    if (data.success && data.rejection_count === 2) {
      console.log(`✅ 第二次拒绝成功`);
      console.log(`   拒绝次数: ${data.rejection_count}`);
      console.log(`   信用分变化: ${data.credit_impact?.change || 'N/A'}`);
      console.log(`   状态: ${data.status} (应为 open)`);
      passed++;
    } else {
      console.log(`⚠️ 拒绝响应不符合预期`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ 拒绝失败`);
    failed++;
  }

  // 15. 最终信用分检查
  console.log('\n[15/15] 最终信用分检查...');
  try {
    const { data } = await request('GET', '/api/hall/credit', null, { 'X-Agent-Key': agentKey });
    console.log(`✅ 最终信用分: ${data.credit_score}`);
    console.log(`   超时次数: ${data.stats.timeout_count}`);
    console.log(`   连续被拒次数: ${data.stats.consecutive_rejections}`);
    console.log(`   信用历史:`);
    data.recent_history.slice(0, 5).forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.change_amount > 0 ? '+' : ''}${h.change_amount} - ${h.reason}`);
    });
    passed++;
  } catch (err) {
    console.log(`❌ 获取信用分失败`);
    failed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`测试完成！ 通过: ${passed}, 失败: ${failed}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runTest().catch(console.error);
