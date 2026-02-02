// Agent贡献者系统 - 让Agent能够自主上传Skill和接单
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// 导入结算配置
const { SETTLEMENT } = require('../config/settlement');

// ==================== 1. Agent提交新Skill ====================

// Agent自主开发并提交Skill
router.post('/agent-contributor/skills/submit', async (req, res) => {
  const agentKey = req.headers['x-agent-key'];
  const { 
    skill_specification,  // AI生成的规格
    implementation_code,   // 实现代码
    test_results,         // 自动测试结果
    human_owner_email,     // 背后人类的邮箱（用于收款）
    human_owner_name      // 背后人类的名称
  } = req.body;

  if (!agentKey) {
    return res.status(401).json({ error: 'Agent authentication required' });
  }

  // 验证Agent
  const agent = await getAgentByKey(req.db, agentKey);
  if (!agent) {
    return res.status(403).json({ error: 'Invalid agent key' });
  }

  // 验证测试通过率
  if (!test_results || test_results.pass_rate < 0.8) {
    return res.status(400).json({ 
      error: 'Test pass rate too low',
      required: '80%',
      actual: test_results?.pass_rate 
    });
  }

  const skillId = 'skill_agent_' + Date.now();
  
  // 创建Skill记录
  req.db.run(
    `INSERT INTO skills 
     (id, name, description, category, developer_email, developer_name, 
      base_price, price_per_call, endpoint, endpoint_code, status,
      input_schema, output_schema, auto_generated, test_results, 
      created_by_agent, agent_id, human_owner_email, is_agent_contributed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      skillId,
      skill_specification.name,
      skill_specification.description,
      skill_specification.category,
      human_owner_email || agent.email,
      human_owner_name || agent.name,
      skill_specification.suggested_price,
      skill_specification.suggested_price,
      'function',
      implementation_code,
      'pending_review', // 需要人工审核或自动审核
      JSON.stringify(skill_specification.input_schema),
      JSON.stringify(skill_specification.output_schema),
      true,
      JSON.stringify(test_results),
      true,
      agent.id,
      human_owner_email,
      true
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // 记录Agent贡献
      logAgentContribution(req.db, agent.id, 'skill_submitted', skillId);

      res.json({
        skill_id: skillId,
        status: 'pending_review',
        message: 'Skill submitted by Agent. Pending review.',
        estimated_review_time: '1-24 hours',
        revenue_share: {
          human_owner: '70%',
          platform: '20%',
          agent_compute: '10%'
        }
      });

      // 触发审核流程（可以是另一个Agent）
      triggerAutoReview(req.db, skillId);
    }
  );
});

// ==================== 2. Agent自动接单系统 ====================

// 获取可接的任务列表（适合Agent自动处理）
router.get('/agent-contributor/available-tasks', (req, res) => {
  const agentKey = req.headers['x-agent-key'];
  const { agent_capabilities } = req.query; // Agent能处理的任务类型

  if (!agentKey) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // 查找Agent能处理的任务
  let sql = `
    SELECT t.*, s.name as skill_name, s.price_per_call
    FROM tasks t
    JOIN skills s ON t.type = s.id
    WHERE t.status = 'pending'
    AND t.assigned_agent_id IS NULL
    AND s.status = 'approved'
  `;

  const params = [];

  // 如果指定了能力，筛选匹配的任务
  if (agent_capabilities) {
    const caps = JSON.parse(agent_capabilities);
    sql += ` AND t.type IN (${caps.map(() => '?').join(',')})`;
    params.push(...caps);
  }

  sql += ` ORDER BY t.price DESC LIMIT 20`;

  req.db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({
      tasks: rows.map(row => ({
        task_id: row.id,
        skill_id: row.type,
        skill_name: row.skill_name,
        title: row.title,
        description: row.description,
        price: row.price,
        estimated_profit: Math.round(row.price * SETTLEMENT.AGENT_RATIO), // Agent分成
        claim_url: `/api/agent-contributor/tasks/${row.id}/claim`
      })),
      total_available: rows.length
    });
  });
});

// Agent抢单/接单
router.post('/agent-contributor/tasks/:taskId/claim', async (req, res) => {
  const agentKey = req.headers['x-agent-key'];
  const { taskId } = req.params;

  const agent = await getAgentByKey(req.db, agentKey);
  if (!agent) {
    return res.status(403).json({ error: 'Invalid agent' });
  }

  // 检查任务是否可接
  req.db.get(
    `SELECT * FROM tasks WHERE id = ? AND status = 'pending' AND assigned_agent_id IS NULL`,
    [taskId],
    (err, task) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!task) return res.status(404).json({ error: 'Task not available' });

      // 分配任务给Agent
      req.db.run(
        `UPDATE tasks SET assigned_agent_id = ?, status = 'assigned', 
         claimed_by_agent = 1, claimed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [agent.id, taskId],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });

          res.json({
            success: true,
            task_id: taskId,
            assigned_to: agent.id,
            status: 'assigned',
            execute_url: `/api/agent-contributor/tasks/${taskId}/execute`,
            deadline: '30 minutes' // Agent需要在30分钟内完成
          });

          // 启动执行倒计时
          setTimeout(() => {
            checkAgentTaskTimeout(req.db, taskId);
          }, 30 * 60 * 1000);
        }
      );
    }
  );
});

// Agent提交任务结果
router.post('/agent-contributor/tasks/:taskId/execute', async (req, res) => {
  const agentKey = req.headers['x-agent-key'];
  const { taskId } = req.params;
  const { result, execution_time_ms } = req.body;

  const agent = await getAgentByKey(req.db, agentKey);
  if (!agent) {
    return res.status(403).json({ error: 'Invalid agent' });
  }

  // 验证任务分配给该Agent
  req.db.get(
    `SELECT * FROM tasks WHERE id = ? AND assigned_agent_id = ?`,
    [taskId, agent.id],
    (err, task) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!task) return res.status(403).json({ error: 'Task not assigned to this agent' });

      // 更新任务结果
      req.db.run(
        `UPDATE tasks SET 
         status = 'completed',
         result = ?,
         completed_at = CURRENT_TIMESTAMP,
         execution_time_ms = ?,
         completed_by_agent = 1
         WHERE id = ?`,
        [result, execution_time_ms, taskId],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });

          // 计算收益并记录
          const earnings = Math.round(task.price * SETTLEMENT.AGENT_RATIO); // Agent分成
          recordAgentEarnings(req.db, agent.id, taskId, earnings);

          res.json({
            success: true,
            task_id: taskId,
            status: 'completed',
            earnings: earnings,
            currency: 'USD'
          });
        }
      );
    }
  );
});

// ==================== 3. Agent收益统计 ====================

// 获取Agent的贡献统计（背后人类看这里）
router.get('/agent-contributor/earnings', async (req, res) => {
  const agentKey = req.headers['x-agent-key'];
  
  const agent = await getAgentByKey(req.db, agentKey);
  if (!agent) {
    return res.status(403).json({ error: 'Invalid agent' });
  }

  // 统计Skill收入（被动收入）
  const skillEarnings = await new Promise((resolve) => {
    req.db.get(
      `SELECT
        COUNT(DISTINCT s.id) as total_skills,
        SUM(sc.calls_count * s.price_per_call * ${SETTLEMENT.SKILL_DEVELOPER_RATIO}) as total_skill_revenue
       FROM skills s
       LEFT JOIN skill_calls sc ON sc.skill_id = s.id
       WHERE s.agent_id = ? AND s.status = 'approved'`,
      [agent.id],
      (err, row) => resolve(row || { total_skills: 0, total_skill_revenue: 0 })
    );
  });

  // 统计接单收入（主动收入）
  const taskEarnings = await new Promise((resolve) => {
    req.db.get(
      `SELECT
        COUNT(*) as completed_tasks,
        SUM(price * ${SETTLEMENT.AGENT_RATIO}) as total_task_revenue
       FROM tasks
       WHERE assigned_agent_id = ? AND status = 'completed'`,
      [agent.id],
      (err, row) => resolve(row || { completed_tasks: 0, total_task_revenue: 0 })
    );
  });

  res.json({
    agent_id: agent.id,
    human_owner: agent.human_owner_email || agent.email,
    passive_income: {
      source: 'Skill Usage',
      skills_published: skillEarnings.total_skills,
      total_earnings: Math.round(skillEarnings.total_skill_revenue || 0)
    },
    active_income: {
      source: 'Task Completion',
      tasks_completed: taskEarnings.completed_tasks,
      total_earnings: Math.round(taskEarnings.total_task_revenue || 0)
    },
    total_earnings: Math.round((skillEarnings.total_skill_revenue || 0) + (taskEarnings.total_task_revenue || 0)),
    withdrawable: Math.round((skillEarnings.total_skill_revenue || 0) + (taskEarnings.total_task_revenue || 0)),
    currency: 'USD'
  });
});

// ==================== 4. 自动化流程管理 ====================

// 触发自动审核（可以是另一个审核Agent）
async function triggerAutoReview(db, skillId) {
  console.log(`🔍 [AutoReview] 开始审核Skill: ${skillId}`);
  
  // 这里可以调用审核Agent
  // 简化版：模拟自动审核
  setTimeout(() => {
    db.run(
      `UPDATE skills SET status = 'approved', reviewed_by = 'auto_review_agent', reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending_review'`,
      [skillId],
      function(err) {
        if (!err && this.changes > 0) {
          console.log(`✅ Skill ${skillId} 自动审核通过`);
        }
      }
    );
  }, 5000); // 5秒后自动通过（实际应该真的有审核逻辑）
}

// 检查Agent任务超时
function checkAgentTaskTimeout(db, taskId) {
  db.get(
    `SELECT * FROM tasks WHERE id = ? AND status = 'assigned'`,
    [taskId],
    (err, task) => {
      if (task) {
        // 超时，释放任务
        db.run(
          `UPDATE tasks SET assigned_agent_id = NULL, status = 'pending' WHERE id = ?`,
          [taskId]
        );
        console.log(`⏰ Task ${taskId} 超时，已释放`);
      }
    }
  );
}

// ==================== 辅助函数 ====================

function getAgentByKey(db, key) {
  return new Promise((resolve) => {
    db.get(
      'SELECT * FROM agents WHERE api_key = ? AND status = "active"',
      [key],
      (err, row) => resolve(row)
    );
  });
}

function logAgentContribution(db, agentId, type, targetId) {
  db.run(
    `INSERT INTO agent_contributions (id, agent_id, contribution_type, target_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), agentId, type, targetId, new Date().toISOString()]
  );
}

function recordAgentEarnings(db, agentId, taskId, amount) {
  db.run(
    `INSERT INTO agent_earnings (id, agent_id, task_id, amount, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), agentId, taskId, amount, new Date().toISOString()]
  );
}

module.exports = router;
