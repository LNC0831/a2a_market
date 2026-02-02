/**
 * A2A 接口测试脚本
 *
 * 模拟外部 Agent 调用平台的完整流程：
 * 1. 发现平台能力
 * 2. 注册 Agent
 * 3. 发现可用 Skills
 * 4. 执行任务
 * 5. 查询结果
 *
 * 使用方法：
 *   先启动服务器: cd server && npm run dev
 *   然后运行测试: node test-a2a.js
 */

const BASE_URL = 'http://localhost:3001';

// 简单的 fetch 包装
async function request(method, path, body = null, headers = {}) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();
  return { status: response.status, data };
}

// 等待函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 测试步骤
async function runTests() {
  console.log('='.repeat(60));
  console.log('A2A 接口测试');
  console.log('='.repeat(60));

  let agentKey = null;
  let taskId = null;

  // 1. 健康检查
  console.log('\n[1/6] 健康检查...');
  try {
    const { status, data } = await request('GET', '/api/health');
    if (status === 200) {
      console.log(`✅ 服务正常 | 版本: ${data.version}`);
      console.log(`   功能: ${data.features.join(', ')}`);
    } else {
      throw new Error('健康检查失败');
    }
  } catch (err) {
    console.log(`❌ 服务不可用: ${err.message}`);
    console.log('   请先启动服务器: cd server && npm run dev');
    process.exit(1);
  }

  // 2. Agent 发现
  console.log('\n[2/6] Agent 发现协议...');
  try {
    const { status, data } = await request('GET', '/.well-known/ai-agent.json');
    if (status === 200) {
      console.log(`✅ 平台: ${data.name}`);
      console.log(`   能力: ${data.capabilities.join(', ')}`);
      console.log(`   协议: ${data.protocols.join(', ')}`);
      console.log(`   收益模式: Skill 贡献 ${data.earning_model.skill_contribution}`);
    }
  } catch (err) {
    console.log(`❌ 发现失败: ${err.message}`);
  }

  // 3. 注册 Agent
  console.log('\n[3/6] 注册 Agent...');
  try {
    const { status, data } = await request('POST', '/api/agent/register', {
      name: 'Test Agent',
      description: '用于测试的外部 Agent',
      contact_email: `test-${Date.now()}@agent.ai`,
      capabilities: ['content_writing', 'code_review']
    });

    if (status === 200 && data.api_key) {
      agentKey = data.api_key;
      console.log(`✅ 注册成功`);
      console.log(`   Agent ID: ${data.agent_id}`);
      console.log(`   API Key: ${agentKey.substring(0, 20)}...`);
    } else {
      console.log(`⚠️ 注册返回: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`❌ 注册失败: ${err.message}`);
  }

  // 4. 发现 Skills
  console.log('\n[4/6] 发现可用 Skills...');
  try {
    const { status, data } = await request('GET', '/api/agent/skills');
    if (status === 200) {
      console.log(`✅ 找到 ${data.total} 个 Skills:`);
      data.skills.slice(0, 5).forEach(skill => {
        console.log(`   - ${skill.name} (${skill.category}) | $${skill.pricing.per_call}/次`);
      });
      if (data.total > 5) {
        console.log(`   ... 还有 ${data.total - 5} 个`);
      }
    }
  } catch (err) {
    console.log(`❌ 发现失败: ${err.message}`);
  }

  // 5. 执行任务
  console.log('\n[5/6] 执行任务...');
  if (!agentKey) {
    console.log('⚠️ 跳过（无 Agent Key）');
  } else {
    try {
      const { status, data } = await request(
        'POST',
        '/api/agent/execute/skill_write_blog',
        {
          input: {
            topic: 'AI Agent 协作的未来',
            length: 500,
            style: 'professional'
          }
        },
        { 'X-Agent-Key': agentKey }
      );

      if (status === 200 && data.task_id) {
        taskId = data.task_id;
        console.log(`✅ 任务已提交`);
        console.log(`   Task ID: ${taskId}`);
        console.log(`   状态: ${data.status}`);
        console.log(`   查询地址: ${data.check_status_at}`);
      } else {
        console.log(`⚠️ 执行返回: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      console.log(`❌ 执行失败: ${err.message}`);
    }
  }

  // 6. 查询结果（轮询）
  console.log('\n[6/6] 等待任务完成...');
  if (!taskId) {
    console.log('⚠️ 跳过（无 Task ID）');
  } else {
    const maxAttempts = 90;  // 最多等待 90 秒（AI 响应可能需要 1 分钟）
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const { status, data } = await request('GET', `/api/agent/tasks/${taskId}`);

        if (data.status === 'completed') {
          console.log(`✅ 任务完成！`);
          console.log(`   Skill: ${data.skill.name || data.skill.id}`);
          if (data.result && data.result.output) {
            const preview = data.result.output.substring(0, 200);
            console.log(`   结果预览:\n   ${preview}...`);
          }
          break;
        } else if (data.status === 'failed') {
          console.log(`❌ 任务失败`);
          break;
        } else {
          process.stdout.write(`   状态: ${data.status} (${i + 1}s)\r`);
          await sleep(1000);
        }
      } catch (err) {
        console.log(`❌ 查询失败: ${err.message}`);
        break;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
}

// 运行测试
runTests().catch(console.error);
