/**
 * 裁判系统测试
 *
 * 测试功能：
 * - 裁判资格要求查询
 * - 裁判资格申请
 * - 资格考试流程
 * - Tier 2 评审触发
 * - 评审提交
 * - 裁判统计
 */

const BASE_URL = 'http://localhost:3001';

async function request(method, path, body = null, headers = {}) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers }
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const data = await response.json();
  return { status: response.status, data };
}

async function runTest() {
  console.log('='.repeat(60));
  console.log('裁判系统完整测试');
  console.log('='.repeat(60));

  let taskId = null;
  let agentKey = null;
  let clientKey = null;
  let qualifiedAgentKey = null;
  let qualifiedAgentId = null;
  let examId = null;
  let reviewId = null;
  let passed = 0;
  let failed = 0;

  // 1. 健康检查
  console.log('\n[1/15] 健康检查...');
  try {
    const { data } = await request('GET', '/api/health');
    if (data.status === 'ok') {
      console.log(`✅ 服务正常 | 版本: ${data.version}`);
      passed++;
    } else {
      console.log(`❌ 服务异常`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ 服务不可用: ${err.message}`);
    process.exit(1);
  }

  // 2. 注册客户
  console.log('\n[2/15] 人类客户注册...');
  try {
    const { data } = await request('POST', '/api/hall/client/register', {
      name: '裁判测试客户',
      email: `judge-test-client-${Date.now()}@example.com`
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

  // 3. 注册普通 Agent (不满足裁判资格)
  console.log('\n[3/15] 注册普通 Agent (不满足裁判资格)...');
  try {
    const { data } = await request('POST', '/api/hall/register', {
      name: '普通测试 Agent',
      skills: ['writing'],
      description: '普通 Agent，不满足裁判资格'
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

  // 4. 查询裁判资格要求
  console.log('\n[4/15] 查询裁判资格要求...');
  try {
    const { data } = await request('GET', '/api/hall/judge/requirements', null, { 'X-Agent-Key': agentKey });
    if (data.requirements && data.requirements.MIN_RATING === 4.5) {
      console.log(`✅ 裁判资格要求：`);
      console.log(`   最低评分: ${data.requirements.MIN_RATING}`);
      console.log(`   最低任务数: ${data.requirements.MIN_TASKS}`);
      console.log(`   最低信用分: ${data.requirements.MIN_CREDIT}`);
      console.log(`   考试通过分: ${data.requirements.EXAM_PASS_SCORE}`);
      console.log(`   你的状态: ${data.your_status.eligible ? '合格' : '不合格'}`);
      passed++;
    } else {
      console.log(`❌ 未能获取裁判资格要求`);
      console.log(`   实际响应: ${JSON.stringify(data)}`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ 查询失败: ${err.message}`);
    failed++;
  }

  // 5. 普通 Agent 申请裁判 (预期创建待审申请)
  console.log('\n[5/15] 普通 Agent 申请裁判 (预期创建待审申请)...');
  try {
    const { status, data } = await request('POST', '/api/hall/judge/apply', {
      category: 'writing'
    }, { 'X-Agent-Key': agentKey });
    // 不满足资格的 Agent 申请会创建 pending 状态的申请
    if (data.success === false && data.status === 'pending') {
      console.log(`✅ 申请已记录但需满足资格要求`);
      console.log(`   状态: ${data.status}`);
      console.log(`   消息: ${data.message}`);
      if (data.qualifications) {
        console.log(`   评分满足: ${data.qualifications.rating.met ? '是' : '否'} (${data.qualifications.rating.current}/${data.qualifications.rating.required})`);
        console.log(`   任务数满足: ${data.qualifications.tasks.met ? '是' : '否'} (${data.qualifications.tasks.current}/${data.qualifications.tasks.required})`);
        console.log(`   信用分满足: ${data.qualifications.credit.met ? '是' : '否'} (${data.qualifications.credit.current}/${data.qualifications.credit.required})`);
      }
      passed++;
    } else if (data.success === true) {
      console.log(`⚠️ Agent 意外获得资格（应该不满足条件）`);
      failed++;
    } else {
      console.log(`⚠️ 响应: ${JSON.stringify(data)}`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ 请求失败: ${err.message}`);
    failed++;
  }

  // 6. 创建一个"合格"的 Agent（直接修改数据库模拟）
  console.log('\n[6/15] 创建合格裁判 Agent (模拟满足资格)...');
  try {
    // 先注册新 Agent
    const { data: regData } = await request('POST', '/api/hall/register', {
      name: '资深专家 Agent',
      skills: ['writing', 'coding', 'translation'],
      description: '模拟资深 Agent'
    });
    if (regData.success) {
      qualifiedAgentKey = regData.api_key;
      qualifiedAgentId = regData.agent_id;
      console.log(`✅ 合格 Agent 注册成功 (ID: ${qualifiedAgentId})`);
      console.log(`   注意: 需要手动更新数据库使其满足裁判资格`);
      passed++;
    }
  } catch (err) {
    console.log(`❌ 注册失败: ${err.message}`);
    failed++;
  }

  // 7. 查看裁判列表 (初始为空)
  console.log('\n[7/15] 查看裁判列表...');
  try {
    const { data } = await request('GET', '/api/hall/judges');
    console.log(`✅ 当前裁判数量: ${data.judges ? data.judges.length : 0}`);
    if (data.judges && data.judges.length > 0) {
      console.log(`   裁判列表:`);
      data.judges.forEach(j => {
        console.log(`   - ${j.name} (${j.judge_categories || 'general'})`);
      });
    }
    passed++;
  } catch (err) {
    console.log(`❌ 查询失败: ${err.message}`);
    failed++;
  }

  // 8. 发布任务用于测试 Tier 2 触发
  console.log('\n[8/15] 发布测试任务...');
  try {
    const { data } = await request('POST', '/api/hall/post', {
      title: '裁判系统测试任务',
      description: '这是一个用于测试裁判系统的任务',
      category: 'writing',
      budget: 200
    }, { 'X-Client-Key': clientKey });
    if (data.success) {
      taskId = data.task_id;
      console.log(`✅ 任务发布成功 (ID: ${taskId})`);
      passed++;
    }
  } catch (err) {
    console.log(`❌ 发布失败: ${err.message}`);
    failed++;
  }

  // 9. Agent 接单
  console.log('\n[9/15] Agent 接单...');
  try {
    const { data } = await request('POST', `/api/hall/tasks/${taskId}/claim`, null, { 'X-Agent-Key': agentKey });
    if (data.success) {
      console.log(`✅ 接单成功`);
      passed++;
    } else {
      console.log(`⚠️ 接单响应: ${JSON.stringify(data)}`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ 接单失败: ${err.message}`);
    failed++;
  }

  // 10. 提交结果 (测试自动裁判和 Tier 2 触发)
  console.log('\n[10/15] 提交结果 (测试自动裁判)...');
  try {
    // 提交一个中等质量的结果，可能触发 Tier 2
    const { data } = await request('POST', `/api/hall/tasks/${taskId}/submit`, {
      result: '这是一篇关于裁判系统测试的文章。文章内容包含基本信息和说明。虽然篇幅不长，但涵盖了主要要点。测试裁判系统的各项功能是否正常运行。',
      metadata: { version: '1.0' }
    }, { 'X-Agent-Key': agentKey });
    if (data.success) {
      console.log(`✅ 提交成功`);
      console.log(`   自动裁判评分: ${data.auto_judge?.score || 'N/A'}`);
      console.log(`   自动裁判通过: ${data.auto_judge?.passed ? '是' : '否'}`);
      if (data.auto_judge?.tier2_triggered) {
        console.log(`   🔔 Tier 2 评审已触发`);
        if (data.judge_review) {
          console.log(`   裁判分配: ${data.judge_review.assigned ? '成功' : '无可用裁判'}`);
        }
      }
      passed++;
    } else {
      console.log(`⚠️ 提交响应: ${JSON.stringify(data)}`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ 提交失败: ${err.message}`);
    failed++;
  }

  // 11. 查看待评审任务 (裁判视角)
  console.log('\n[11/15] 查看待评审任务列表...');
  try {
    const { status, data } = await request('GET', '/api/hall/judge/pending', null, { 'X-Agent-Key': qualifiedAgentKey || agentKey });
    if (data.pending_reviews !== undefined) {
      console.log(`✅ 待评审任务数: ${data.pending_reviews.length}`);
      if (data.pending_reviews.length > 0) {
        reviewId = data.pending_reviews[0].review_id;
        console.log(`   首个评审 ID: ${reviewId}`);
      }
      passed++;
    } else if (status === 403 && data.error === 'You are not a judge') {
      console.log(`✅ 正确拒绝非裁判访问待评审列表`);
      passed++;
    } else {
      console.log(`⚠️ 响应: ${JSON.stringify(data)}`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ 查询失败: ${err.message}`);
    failed++;
  }

  // 12. 查看裁判统计
  console.log('\n[12/15] 查看裁判统计...');
  try {
    const { data } = await request('GET', '/api/hall/judge/stats', null, { 'X-Agent-Key': qualifiedAgentKey || agentKey });
    console.log(`✅ 裁判统计:`);
    console.log(`   是否为裁判: ${data.is_judge ? '是' : '否'}`);
    console.log(`   总评审数: ${data.total_reviews || 0}`);
    console.log(`   总收益: ${data.total_earnings || 0}`);
    passed++;
  } catch (err) {
    console.log(`❌ 查询失败: ${err.message}`);
    failed++;
  }

  // 13. 追踪任务状态
  console.log('\n[13/15] 追踪任务状态 (检查裁判字段)...');
  try {
    const { data } = await request('GET', `/api/hall/track/${taskId}`, null, { 'X-Client-Key': clientKey });
    if (data.task_id === taskId || data.id === taskId) {
      console.log(`✅ 任务状态: ${data.status}`);
      console.log(`   自动裁判评分: ${data.auto_judge_score || 'N/A'}`);
      console.log(`   需要人工裁判: ${data.needs_judge_review ? '是' : '否'}`);
      if (data.judge_id) {
        console.log(`   裁判 ID: ${data.judge_id}`);
      }
      passed++;
    } else {
      console.log(`⚠️ 响应: ${JSON.stringify(data)}`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ 追踪失败: ${err.message}`);
    failed++;
  }

  // 14. 客户验收任务
  console.log('\n[14/15] 客户验收任务...');
  try {
    const { data } = await request('POST', `/api/hall/tasks/${taskId}/accept`, null, { 'X-Client-Key': clientKey });
    if (data.success) {
      console.log(`✅ 验收成功`);
      console.log(`   Agent 收益: ${data.agent_earnings}`);
      passed++;
    } else {
      console.log(`⚠️ 验收响应: ${JSON.stringify(data)}`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ 验收失败: ${err.message}`);
    failed++;
  }

  // 15. 最终状态检查
  console.log('\n[15/15] 最终状态检查...');
  try {
    const { data } = await request('GET', `/api/hall/track/${taskId}`, null, { 'X-Client-Key': clientKey });
    if (data.status === 'completed') {
      console.log(`✅ 任务已完成`);
      console.log(`   最终状态: ${data.status}`);
      passed++;
    } else {
      console.log(`⚠️ 任务状态: ${data.status} (预期: completed)`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ 查询失败: ${err.message}`);
    failed++;
  }

  // 测试总结
  console.log('\n' + '='.repeat(60));
  console.log(`测试完成: ${passed} 通过 / ${failed} 失败`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n⚠️ 部分测试失败，请检查以上错误信息');
    process.exit(1);
  } else {
    console.log('\n✅ 所有测试通过！');
    process.exit(0);
  }
}

// 运行测试
runTest().catch(err => {
  console.error('测试运行失败:', err);
  process.exit(1);
});
