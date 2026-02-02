/**
 * 前端 API 完整测试脚本
 *
 * 测试完整的用户流程：
 * 1. 客户注册
 * 2. Agent 注册
 * 3. 发布任务
 * 4. 浏览任务大厅（无需登录）
 * 5. Agent 接单
 * 6. Agent 提交结果
 * 7. 客户验收
 * 8. 客户评价
 * 9. 查看订单历史
 * 10. 查看收益统计
 */

const http = require('http');
const crypto = require('crypto');

const API_URL = 'http://localhost:3001';

// 存储测试中获取的数据
let clientKey = null;
let agentKey = null;
let taskId = null;

// 使用原生 http 模块绕过代理
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, ok: res.statusCode >= 200 && res.statusCode < 300 });
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

// 测试结果统计
let passed = 0;
let failed = 0;
const results = [];

function test(name, success, details = '') {
  if (success) {
    passed++;
    results.push({ name, status: '✅ PASS', details });
    console.log(`✅ ${name}`);
  } else {
    failed++;
    results.push({ name, status: '❌ FAIL', details });
    console.log(`❌ ${name}: ${details}`);
  }
}

// ==================== 测试用例 ====================

async function testHealth() {
  console.log('\n📋 测试健康检查...');
  const res = await request('GET', '/api/health');
  test('健康检查', res.ok && res.data.status === 'ok', JSON.stringify(res.data));
}

async function testStats() {
  console.log('\n📋 测试统计接口...');
  const res = await request('GET', '/api/stats');
  test('获取统计数据', res.ok && 'total' in res.data, JSON.stringify(res.data));
}

async function testClientRegister() {
  console.log('\n📋 测试客户注册...');

  // 正常注册 (需要密码和 reCAPTCHA token，测试环境使用测试密钥)
  const email = `test_client_${Date.now()}@test.com`;
  const res = await request('POST', '/api/hall/client/register', {
    name: '测试客户',
    email: email,
    password: 'TestPass123',
    recaptchaToken: 'test-token'  // 测试环境使用 Google 测试密钥，任何 token 都能通过
  });

  test('客户注册成功', res.ok && res.data.api_key, JSON.stringify(res.data));

  if (res.ok) {
    clientKey = res.data.api_key;
    console.log(`   客户 Key: ${clientKey.substring(0, 20)}...`);
  }

  // 重复注册应该失败
  const res2 = await request('POST', '/api/hall/client/register', {
    name: '测试客户2',
    email: email,
    password: 'TestPass123',
    recaptchaToken: 'test-token'
  });
  test('重复邮箱注册被拒绝', !res2.ok && res2.status === 400, res2.data.error);
}

async function testAgentRegister() {
  console.log('\n📋 测试 Agent 注册 (需要通过"我不是人类"挑战)...');

  // 第一步：获取挑战
  const challengeRes = await request('GET', '/api/hall/register/challenge');
  test('获取注册挑战', challengeRes.ok && challengeRes.data.challenge_id, `问题数: ${challengeRes.data.questions?.length}`);

  // 第二步：解答挑战
  const answers = solveChallenge(challengeRes.data.questions);
  console.log(`   挑战解答完成，耗时 < 1ms`);

  // 第三步：提交注册（带挑战答案）
  const res = await request('POST', '/api/hall/register', {
    challenge_id: challengeRes.data.challenge_id,
    answers: answers,
    name: '测试写作Agent',
    skills: ['writing', 'translation'],
    description: '专业写作和翻译服务',
    contact_email: `test_agent_${Date.now()}@test.com`
  });

  test('Agent 注册成功', res.ok && res.data.api_key, JSON.stringify(res.data));

  if (res.ok) {
    agentKey = res.data.api_key;
    console.log(`   Agent Key: ${agentKey.substring(0, 20)}...`);
    console.log(`   验证完成时间: ${res.data.verification?.completion_time_ms}ms`);
  }

  // 不带挑战注册应该失败
  const res2 = await request('POST', '/api/hall/register', {
    name: '无挑战Agent',
    skills: ['test']
  });
  test('无挑战注册被拒绝', !res2.ok, res2.data.error);
}

async function testPostTask() {
  console.log('\n📋 测试发布任务...');

  // 客户发布任务
  const res = await request('POST', '/api/hall/post', {
    title: '测试任务 - 写一篇AI文章',
    description: '请写一篇关于人工智能在医疗领域应用的文章，要求：\n1. 字数 1000 字左右\n2. 包含具体案例\n3. 语言通俗易懂',
    category: 'writing',
    budget: 100,
    deadline_hours: 24
  }, { 'X-Client-Key': clientKey });

  test('客户发布任务成功', res.ok && res.data.task_id, JSON.stringify(res.data));

  if (res.ok) {
    taskId = res.data.task_id;
    console.log(`   任务 ID: ${taskId}`);
  }

  // 匿名发布任务也应该成功
  const res2 = await request('POST', '/api/hall/post', {
    title: '匿名任务',
    description: '测试匿名发布',
    category: 'general',
    budget: 50
  });
  test('匿名发布任务成功', res2.ok, JSON.stringify(res2.data));
}

async function testTaskHall() {
  console.log('\n📋 测试任务大厅...');

  // 无需登录即可浏览
  const res = await request('GET', '/api/hall/tasks');
  test('无登录浏览任务大厅', res.ok && Array.isArray(res.data.tasks), `找到 ${res.data.tasks?.length || 0} 个任务`);

  // Agent 登录后浏览（显示技能匹配）
  const res2 = await request('GET', '/api/hall/tasks', null, { 'X-Agent-Key': agentKey });
  test('Agent 浏览任务大厅', res2.ok, `你的技能: ${JSON.stringify(res2.data.your_skills)}`);

  // 检查技能匹配标记
  const writingTask = res2.data.tasks?.find(t => t.category === 'writing');
  test('技能匹配标记正确', writingTask?.skill_match === true, `writing 任务匹配: ${writingTask?.skill_match}`);

  // 筛选测试
  const res3 = await request('GET', '/api/hall/tasks?category=writing');
  test('按类型筛选任务', res3.ok, `writing 类任务: ${res3.data.tasks?.length || 0} 个`);
}

async function testTaskTrack() {
  console.log('\n📋 测试任务追踪...');

  const res = await request('GET', `/api/hall/track/${taskId}`);
  test('获取任务详情', res.ok && res.data.title, `状态: ${res.data.status}`);
  test('任务有时间线', res.ok && Array.isArray(res.data.timeline), `事件数: ${res.data.timeline?.length}`);
  test('任务状态为 open', res.data.status === 'open', res.data.status);
}

async function testClaimTask() {
  console.log('\n📋 测试 Agent 接单...');

  // Agent 接单
  const res = await request('POST', `/api/hall/tasks/${taskId}/claim`, null, { 'X-Agent-Key': agentKey });
  test('Agent 接单成功', res.ok, JSON.stringify(res.data));

  // 再次接单应该失败（已被接）
  const res2 = await request('POST', `/api/hall/tasks/${taskId}/claim`, null, { 'X-Agent-Key': agentKey });
  test('重复接单被拒绝', !res2.ok && res2.status === 409, res2.data.error);

  // 验证状态变更
  const track = await request('GET', `/api/hall/track/${taskId}`);
  test('任务状态变为 claimed', track.data.status === 'claimed', track.data.status);
  test('时间线记录接单事件', track.data.timeline?.some(e => e.event === 'claimed'), '');
}

async function testSubmitResult() {
  console.log('\n📋 测试提交结果...');

  const result = `# AI在医疗领域的应用

人工智能正在深刻改变医疗行业...

## 1. 医学影像诊断
AI可以快速分析X光、CT等影像...

## 2. 药物研发
机器学习加速新药发现过程...

## 3. 个性化治疗
基于大数据的精准医疗方案...

（测试文章内容）`;

  const res = await request('POST', `/api/hall/tasks/${taskId}/submit`, {
    result: result,
    metadata: { word_count: 1000, format: 'markdown' }
  }, { 'X-Agent-Key': agentKey });

  test('Agent 提交结果成功', res.ok, JSON.stringify(res.data));

  // 验证状态
  const track = await request('GET', `/api/hall/track/${taskId}`);
  test('任务状态变为 submitted', track.data.status === 'submitted', track.data.status);
  test('结果已保存', track.data.result?.includes('AI在医疗领域'), '');
}

async function testAcceptTask() {
  console.log('\n📋 测试客户验收...');

  const res = await request('POST', `/api/hall/tasks/${taskId}/accept`, null, { 'X-Client-Key': clientKey });
  test('客户验收通过', res.ok, JSON.stringify(res.data));

  // 验证状态
  const track = await request('GET', `/api/hall/track/${taskId}`);
  test('任务状态变为 completed', track.data.status === 'completed', track.data.status);
}

async function testRateTask() {
  console.log('\n📋 测试评价...');

  const res = await request('POST', `/api/hall/tasks/${taskId}/rate`, {
    rating: 5,
    comment: '非常满意，文章质量很高，按时交付！'
  }, { 'X-Client-Key': clientKey });

  test('客户评价成功', res.ok, JSON.stringify(res.data));

  // 验证评价
  const track = await request('GET', `/api/hall/track/${taskId}`);
  test('评价已记录', track.data.rating?.score === 5, `评分: ${track.data.rating?.score}`);
}

async function testMyOrders() {
  console.log('\n📋 测试我的订单...');

  const res = await request('GET', '/api/hall/my-orders', null, { 'X-Client-Key': clientKey });
  test('获取客户订单列表', res.ok && Array.isArray(res.data.orders), `订单数: ${res.data.orders?.length}`);

  const hasCompletedOrder = res.data.orders?.some(o => o.status === 'completed');
  test('包含已完成订单', hasCompletedOrder, '');
}

async function testMyTasks() {
  console.log('\n📋 测试 Agent 任务历史...');

  const res = await request('GET', '/api/hall/my-tasks', null, { 'X-Agent-Key': agentKey });
  test('获取 Agent 任务列表', res.ok && Array.isArray(res.data.tasks), `任务数: ${res.data.tasks?.length}`);
}

async function testEarnings() {
  console.log('\n📋 测试 Agent 收益...');

  const res = await request('GET', '/api/hall/earnings', null, { 'X-Agent-Key': agentKey });
  test('获取收益统计', res.ok, JSON.stringify(res.data));
  test('总收益正确', res.data.total_earnings === 70, `收益: ¥${res.data.total_earnings}`); // 100 * 0.7 = 70
}

async function testRejectFlow() {
  console.log('\n📋 测试拒绝流程...');

  // 创建新任务用于测试拒绝
  const postRes = await request('POST', '/api/hall/post', {
    title: '测试拒绝流程的任务',
    description: '这个任务将被拒绝',
    category: 'coding',
    budget: 200
  }, { 'X-Client-Key': clientKey });

  const rejectTaskId = postRes.data.task_id;

  // Agent 接单
  await request('POST', `/api/hall/tasks/${rejectTaskId}/claim`, null, { 'X-Agent-Key': agentKey });

  // Agent 提交
  await request('POST', `/api/hall/tasks/${rejectTaskId}/submit`, {
    result: '这是一个不合格的结果'
  }, { 'X-Agent-Key': agentKey });

  // 客户拒绝
  const rejectRes = await request('POST', `/api/hall/tasks/${rejectTaskId}/reject`, {
    reason: '不符合要求，请重新提交'
  }, { 'X-Client-Key': clientKey });

  test('客户拒绝成功', rejectRes.ok, JSON.stringify(rejectRes.data));

  // 验证状态
  const track = await request('GET', `/api/hall/track/${rejectTaskId}`);
  test('任务状态变为 rejected', track.data.status === 'rejected', track.data.status);

  // Agent 可以重新提交
  const resubmitRes = await request('POST', `/api/hall/tasks/${rejectTaskId}/submit`, {
    result: '修改后的合格结果'
  }, { 'X-Agent-Key': agentKey });
  test('Agent 可重新提交', resubmitRes.ok, '');
}

async function testCancelTask() {
  console.log('\n📋 测试取消任务...');

  // 创建新任务
  const postRes = await request('POST', '/api/hall/post', {
    title: '将被取消的任务',
    description: '测试取消功能',
    category: 'analysis',
    budget: 50
  }, { 'X-Client-Key': clientKey });

  const cancelTaskId = postRes.data.task_id;

  // 取消任务
  const cancelRes = await request('POST', `/api/hall/tasks/${cancelTaskId}/cancel`, null, { 'X-Client-Key': clientKey });
  test('取消任务成功', cancelRes.ok, JSON.stringify(cancelRes.data));

  // 验证状态
  const track = await request('GET', `/api/hall/track/${cancelTaskId}`);
  test('任务状态变为 cancelled', track.data.status === 'cancelled', track.data.status);
}

async function testErrorCases() {
  console.log('\n📋 测试错误处理...');

  // 无效任务 ID
  const res1 = await request('GET', '/api/hall/track/invalid-id');
  test('无效任务ID返回404', res1.status === 404, res1.data.error);

  // 未认证接单
  const res2 = await request('POST', `/api/hall/tasks/${taskId}/claim`);
  test('未认证接单被拒绝', res2.status === 401, res2.data.error);

  // 无效 API Key
  const res3 = await request('GET', '/api/hall/my-tasks', null, { 'X-Agent-Key': 'invalid_key' });
  test('无效Key被拒绝', res3.status === 403, res3.data.error);
}

// ==================== 运行测试 ====================

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         A2A 任务大厅 - 前端 API 完整测试                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n⏰ 开始时间: ${new Date().toLocaleString()}`);
  console.log(`🔗 API 地址: ${API_URL}\n`);

  try {
    // 基础测试
    await testHealth();
    await testStats();

    // 注册流程
    await testClientRegister();
    await testAgentRegister();

    // 任务发布和浏览
    await testPostTask();
    await testTaskHall();
    await testTaskTrack();

    // 核心业务流程
    await testClaimTask();
    await testSubmitResult();
    await testAcceptTask();
    await testRateTask();

    // 历史和统计
    await testMyOrders();
    await testMyTasks();
    await testEarnings();

    // 其他流程
    await testRejectFlow();
    await testCancelTask();

    // 错误处理
    await testErrorCases();

  } catch (err) {
    console.error('\n❌ 测试执行出错:', err.message);
  }

  // 输出总结
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      测试结果总结                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📊 总计: ${passed + failed}`);
  console.log(`📈 通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n❌ 失败的测试:');
    results.filter(r => r.status.includes('FAIL')).forEach(r => {
      console.log(`   - ${r.name}: ${r.details}`);
    });
  }

  console.log(`\n⏰ 结束时间: ${new Date().toLocaleString()}`);

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
