/**
 * 任务大厅 (Task Hall) - 核心路由 v2
 *
 * 实现"冒险者工会/滴滴打车"模式：
 * - 三类用户：人类客户、Agent客户、Agent服务者
 * - 锁单机制：防止并发抢单
 * - 时间线追踪：完整的订单生命周期记录
 * - 评价系统：完成后互相评价
 * - 历史查询：所有订单可查
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const router = express.Router();

// ==================== 认证中间件 ====================

/**
 * Agent 服务者认证
 */
function authenticateAgent(req, res, next) {
  const apiKey = req.headers['x-agent-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-Agent-Key header' });
  }

  req.db.get('SELECT * FROM agents WHERE api_key = ?', [apiKey], (err, agent) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!agent) return res.status(403).json({ error: 'Invalid API key' });
    req.agent = agent;
    next();
  });
}

/**
 * 客户认证（人类或Agent都可以）
 * 人类用 X-Client-Key，Agent客户用 X-Agent-Key
 */
function authenticateClient(req, res, next) {
  const clientKey = req.headers['x-client-key'];
  const agentKey = req.headers['x-agent-key'];

  if (clientKey) {
    // 人类客户
    req.db.get('SELECT * FROM clients WHERE api_key = ?', [clientKey], (err, client) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!client) return res.status(403).json({ error: 'Invalid client key' });
      req.client = { ...client, type: 'human' };
      next();
    });
  } else if (agentKey) {
    // Agent 客户
    req.db.get('SELECT * FROM agents WHERE api_key = ?', [agentKey], (err, agent) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!agent) return res.status(403).json({ error: 'Invalid agent key' });
      req.client = { ...agent, type: 'agent' };
      next();
    });
  } else {
    return res.status(401).json({ error: 'Missing X-Client-Key or X-Agent-Key header' });
  }
}

/**
 * 可选认证（有key就认证，没有也能用）
 */
function optionalAuth(req, res, next) {
  const clientKey = req.headers['x-client-key'];
  const agentKey = req.headers['x-agent-key'];

  if (!clientKey && !agentKey) {
    req.client = null;
    return next();
  }

  authenticateClient(req, res, next);
}

// ==================== 辅助函数 ====================

/**
 * 记录任务事件到时间线
 */
function logTaskEvent(db, taskId, event, actor, actorType, details = {}) {
  const eventId = uuidv4();
  db.run(
    `INSERT INTO task_events (id, task_id, event, actor_id, actor_type, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [eventId, taskId, event, actor, actorType, JSON.stringify(details)]
  );
}

// ==================== 客户注册 ====================

/**
 * 人类客户注册
 *
 * POST /api/hall/client/register
 */
router.post('/hall/client/register', (req, res) => {
  const { name, email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const clientId = uuidv4();
  const apiKey = 'client_' + crypto.randomBytes(32).toString('hex');

  req.db.run(
    `INSERT INTO clients (id, name, email, api_key, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [clientId, name || '', email, apiKey],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Email already registered' });
        }
        return res.status(500).json({ error: err.message });
      }

      res.json({
        success: true,
        client_id: clientId,
        api_key: apiKey,
        message: 'Registration successful. Use X-Client-Key header for authentication.'
      });
    }
  );
});

// ==================== Agent 服务者注册 ====================

/**
 * Agent 注册 - 声明技能并获取 API Key
 *
 * POST /api/hall/register
 */
router.post('/hall/register', (req, res) => {
  const { name, skills, endpoint, description, contact_email } = req.body;

  if (!name || !skills || !Array.isArray(skills) || skills.length === 0) {
    return res.status(400).json({
      error: 'Required: name (string), skills (non-empty array)'
    });
  }

  const agentId = uuidv4();
  const apiKey = 'agent_' + crypto.randomBytes(32).toString('hex');

  req.db.run(
    `INSERT INTO agents (id, name, skills, endpoint, description, email, api_key, type, status, rating, total_tasks, total_earnings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [agentId, name, JSON.stringify(skills), endpoint || null, description || '',
     contact_email || '', apiKey, 'external', 'active', 5.0, 0, 0],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({
        success: true,
        agent_id: agentId,
        api_key: apiKey,
        message: 'Registration successful. Save your API key.',
        usage: {
          as_worker: 'Use X-Agent-Key to claim and complete tasks',
          as_client: 'Use same X-Agent-Key to post tasks (Agent can be both client and worker)'
        }
      });
    }
  );
});

// ==================== 发布任务（客户端） ====================

/**
 * 发布任务 - 人类或Agent都可以发布
 *
 * POST /api/hall/post
 * Headers: X-Client-Key 或 X-Agent-Key
 */
router.post('/hall/post', optionalAuth, (req, res) => {
  const { title, description, category, budget, contact_email, deadline_hours } = req.body;

  if (!title || !description || !budget) {
    return res.status(400).json({ error: 'Required: title, description, budget' });
  }

  const taskId = uuidv4();
  const clientId = req.client?.id || null;
  const clientType = req.client?.type || 'anonymous';
  const email = contact_email || req.client?.email || '';

  // 计算截止时间
  const deadlineHours = deadline_hours || 24;

  req.db.run(
    `INSERT INTO tasks (id, title, description, category, budget, status, user_email, client_id, client_type, deadline, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, datetime('now', '+${deadlineHours} hours'), datetime('now'))`,
    [taskId, title, description, category || 'general', budget, email, clientId, clientType],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });

      // 记录事件
      logTaskEvent(req.db, taskId, 'created', clientId || 'anonymous', clientType, { title, budget });

      res.json({
        success: true,
        task_id: taskId,
        status: 'open',
        message: 'Task posted to the hall. Agents can now claim it.',
        track_url: `/api/hall/track/${taskId}`,
        deadline_hours: deadlineHours
      });
    }
  );
});

// ==================== 任务追踪（核心功能） ====================

/**
 * 任务完整追踪 - 包含时间线
 *
 * GET /api/hall/track/:id
 */
router.get('/hall/track/:id', (req, res) => {
  const { id } = req.params;

  req.db.get(
    `SELECT t.*, a.name as agent_name, a.rating as agent_rating
     FROM tasks t
     LEFT JOIN agents a ON t.agent_id = a.id
     WHERE t.id = ?`,
    [id],
    (err, task) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!task) return res.status(404).json({ error: 'Task not found' });

      // 获取时间线事件
      req.db.all(
        `SELECT event, actor_type, details, created_at
         FROM task_events WHERE task_id = ? ORDER BY created_at ASC`,
        [id],
        (err, events) => {
          const timeline = (events || []).map(e => ({
            event: e.event,
            actor: e.actor_type,
            details: JSON.parse(e.details || '{}'),
            time: e.created_at
          }));

          const response = {
            task_id: task.id,
            title: task.title,
            description: task.description,
            category: task.category,
            budget: task.budget,
            status: task.status,
            client_type: task.client_type,

            // 时间节点
            timestamps: {
              created: task.created_at,
              claimed: task.claimed_at,
              submitted: task.submitted_at,
              completed: task.completed_at,
              deadline: task.deadline
            },

            // 时间线
            timeline: timeline,

            // Agent 信息（如果已接单）
            agent: task.agent_id ? {
              id: task.agent_id,
              name: task.agent_name,
              rating: task.agent_rating
            } : null,

            // 结果（如果已提交）
            result: (task.status === 'submitted' || task.status === 'completed') ? task.result : null,

            // 评价（如果已完成）
            rating: task.client_rating ? {
              score: task.client_rating,
              comment: task.client_comment
            } : null,

            // 可用操作
            actions: getAvailableActions(task)
          };

          res.json(response);
        }
      );
    }
  );
});

function getAvailableActions(task) {
  const actions = {};
  switch (task.status) {
    case 'open':
      actions.cancel = `/api/hall/tasks/${task.id}/cancel`;
      break;
    case 'claimed':
      // 客户可以催促
      actions.remind = `/api/hall/tasks/${task.id}/remind`;
      break;
    case 'submitted':
      actions.accept = `/api/hall/tasks/${task.id}/accept`;
      actions.reject = `/api/hall/tasks/${task.id}/reject`;
      break;
    case 'completed':
      if (!task.client_rating) {
        actions.rate = `/api/hall/tasks/${task.id}/rate`;
      }
      break;
  }
  return actions;
}

// ==================== Agent 服务端 ====================

/**
 * 获取可接任务列表（公开，无需登录）
 *
 * GET /api/hall/tasks
 */
router.get('/hall/tasks', optionalAuth, (req, res) => {
  const { category, min_budget, max_budget } = req.query;
  const agentSkills = req.client?.type === 'agent' ? JSON.parse(req.client.skills || '[]') : [];

  let sql = `SELECT id, title, description, category, budget, status, created_at, deadline,
                    (SELECT COUNT(*) FROM task_events WHERE task_id = tasks.id AND event = 'viewed') as view_count
             FROM tasks WHERE status = 'open'`;
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (min_budget) {
    sql += ' AND budget >= ?';
    params.push(parseFloat(min_budget));
  }
  if (max_budget) {
    sql += ' AND budget <= ?';
    params.push(parseFloat(max_budget));
  }

  sql += ' ORDER BY budget DESC, created_at ASC';

  req.db.all(sql, params, (err, tasks) => {
    if (err) return res.status(500).json({ error: err.message });

    const enrichedTasks = tasks.map(task => ({
      ...task,
      skill_match: agentSkills.includes(task.category),
      expected_earnings: Math.round(task.budget * 0.7),
      claim_url: `/api/hall/tasks/${task.id}/claim`
    }));

    res.json({
      tasks: enrichedTasks,
      total: enrichedTasks.length,
      your_skills: agentSkills
    });
  });
});

/**
 * Agent 接单 - 带锁单机制
 *
 * POST /api/hall/tasks/:id/claim
 */
router.post('/hall/tasks/:id/claim', authenticateAgent, (req, res) => {
  const { id } = req.params;
  const agentId = req.agent.id;
  const agentName = req.agent.name;

  // 使用 UPDATE ... WHERE status = 'open' 实现乐观锁
  req.db.run(
    `UPDATE tasks
     SET status = 'claimed', agent_id = ?, claimed_at = datetime('now')
     WHERE id = ? AND status = 'open'`,
    [agentId, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });

      // 检查是否真的更新了（乐观锁检查）
      if (this.changes === 0) {
        // 没有更新，说明任务已被其他Agent抢走或状态已变
        req.db.get('SELECT status, agent_id FROM tasks WHERE id = ?', [id], (err, task) => {
          if (!task) return res.status(404).json({ error: 'Task not found' });
          return res.status(409).json({
            error: 'Task is no longer available',
            current_status: task.status,
            message: task.status === 'claimed' ? 'Already claimed by another agent' : `Task status is ${task.status}`
          });
        });
        return;
      }

      // 成功接单，记录事件
      logTaskEvent(req.db, id, 'claimed', agentId, 'agent', { agent_name: agentName });

      // 获取任务详情返回
      req.db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
        res.json({
          success: true,
          task_id: id,
          status: 'claimed',
          message: 'Task claimed successfully. Execute and submit your result.',
          submit_url: `/api/hall/tasks/${id}/submit`,
          task: {
            title: task.title,
            description: task.description,
            category: task.category,
            budget: task.budget,
            deadline: task.deadline
          },
          expected_earnings: Math.round(task.budget * 0.7)
        });
      });
    }
  );
});

/**
 * Agent 提交结果
 *
 * POST /api/hall/tasks/:id/submit
 */
router.post('/hall/tasks/:id/submit', authenticateAgent, (req, res) => {
  const { id } = req.params;
  const { result, metadata } = req.body;
  const agentId = req.agent.id;

  if (!result) {
    return res.status(400).json({ error: 'Result is required' });
  }

  req.db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.agent_id !== agentId) {
      return res.status(403).json({ error: 'This task is not assigned to you' });
    }
    if (task.status !== 'claimed' && task.status !== 'rejected') {
      return res.status(400).json({ error: `Cannot submit (current status: ${task.status})` });
    }

    req.db.run(
      `UPDATE tasks SET status = 'submitted', result = ?, metadata = ?, submitted_at = datetime('now') WHERE id = ?`,
      [result, JSON.stringify(metadata || {}), id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });

        logTaskEvent(req.db, id, 'submitted', agentId, 'agent', {
          result_length: result.length,
          metadata: metadata
        });

        res.json({
          success: true,
          task_id: id,
          status: 'submitted',
          message: 'Result submitted. Waiting for client acceptance.',
          expected_earnings: Math.round(task.budget * 0.7),
          track_url: `/api/hall/track/${id}`
        });
      }
    );
  });
});

/**
 * Agent 查看自己的任务历史
 *
 * GET /api/hall/my-tasks
 */
router.get('/hall/my-tasks', authenticateAgent, (req, res) => {
  const agentId = req.agent.id;
  const { status, limit = 50 } = req.query;

  let sql = `SELECT id, title, category, budget, status, claimed_at, submitted_at, completed_at,
                    client_rating, client_comment
             FROM tasks WHERE agent_id = ?`;
  const params = [agentId];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(parseInt(limit));

  req.db.all(sql, params, (err, tasks) => {
    if (err) return res.status(500).json({ error: err.message });

    const enriched = tasks.map(t => ({
      ...t,
      earnings: t.status === 'completed' ? Math.round(t.budget * 0.7) : 0,
      track_url: `/api/hall/track/${t.id}`
    }));

    res.json({ tasks: enriched, total: enriched.length });
  });
});

/**
 * Agent 查看收益统计
 *
 * GET /api/hall/earnings
 */
router.get('/hall/earnings', authenticateAgent, (req, res) => {
  const agentId = req.agent.id;

  req.db.get(
    `SELECT
       COUNT(*) as total_tasks,
       SUM(CASE WHEN status = 'completed' THEN budget * 0.7 ELSE 0 END) as total_earnings,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
       AVG(CASE WHEN status = 'completed' AND client_rating IS NOT NULL THEN client_rating ELSE NULL END) as avg_rating
     FROM tasks WHERE agent_id = ?`,
    [agentId],
    (err, stats) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        agent_id: agentId,
        total_tasks: stats.total_tasks || 0,
        completed_tasks: stats.completed_tasks || 0,
        total_earnings: Math.round(stats.total_earnings || 0),
        average_rating: stats.avg_rating ? parseFloat(stats.avg_rating.toFixed(2)) : null,
        platform_fee_rate: '30%',
        your_rate: '70%'
      });
    }
  );
});

// ==================== 客户操作 ====================

/**
 * 客户查看自己发布的任务
 *
 * GET /api/hall/my-orders
 */
router.get('/hall/my-orders', authenticateClient, (req, res) => {
  const clientId = req.client.id;
  const { status, limit = 50 } = req.query;

  let sql = `SELECT t.*, a.name as agent_name
             FROM tasks t
             LEFT JOIN agents a ON t.agent_id = a.id
             WHERE t.client_id = ?`;
  const params = [clientId];

  if (status) {
    sql += ' AND t.status = ?';
    params.push(status);
  }

  sql += ` ORDER BY t.created_at DESC LIMIT ?`;
  params.push(parseInt(limit));

  req.db.all(sql, params, (err, tasks) => {
    if (err) return res.status(500).json({ error: err.message });

    const enriched = tasks.map(t => ({
      task_id: t.id,
      title: t.title,
      status: t.status,
      budget: t.budget,
      agent: t.agent_id ? { id: t.agent_id, name: t.agent_name } : null,
      created_at: t.created_at,
      track_url: `/api/hall/track/${t.id}`
    }));

    res.json({ orders: enriched, total: enriched.length });
  });
});

/**
 * 验收通过
 *
 * POST /api/hall/tasks/:id/accept
 */
router.post('/hall/tasks/:id/accept', (req, res) => {
  const { id } = req.params;

  req.db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status !== 'submitted') {
      return res.status(400).json({ error: `Cannot accept (current status: ${task.status})` });
    }

    const agentEarnings = Math.round(task.budget * 0.7);
    const platformFee = Math.round(task.budget * 0.3);

    req.db.run(
      `UPDATE tasks SET status = 'completed', completed_at = datetime('now') WHERE id = ?`,
      [id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });

        // 更新 Agent 统计
        req.db.run(
          `UPDATE agents SET total_tasks = total_tasks + 1, total_earnings = total_earnings + ? WHERE id = ?`,
          [agentEarnings, task.agent_id]
        );

        // 记录交易
        req.db.run(
          `INSERT INTO transactions (id, task_id, type, amount, from_party, to_party, status, created_at)
           VALUES (?, ?, 'payout', ?, 'platform', 'agent', 'completed', datetime('now'))`,
          [uuidv4(), id, agentEarnings]
        );

        // 记录事件
        logTaskEvent(req.db, id, 'accepted', task.client_id || 'client', task.client_type || 'human', {
          agent_earnings: agentEarnings
        });

        res.json({
          success: true,
          task_id: id,
          status: 'completed',
          settlement: {
            total: task.budget,
            agent_earnings: agentEarnings,
            platform_fee: platformFee
          },
          message: 'Task completed. Agent has been paid.',
          rate_url: `/api/hall/tasks/${id}/rate`
        });
      }
    );
  });
});

/**
 * 验收拒绝
 *
 * POST /api/hall/tasks/:id/reject
 */
router.post('/hall/tasks/:id/reject', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  req.db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status !== 'submitted') {
      return res.status(400).json({ error: `Cannot reject (current status: ${task.status})` });
    }

    req.db.run(
      `UPDATE tasks SET status = 'rejected', reject_reason = ? WHERE id = ?`,
      [reason || '', id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });

        logTaskEvent(req.db, id, 'rejected', task.client_id || 'client', task.client_type || 'human', {
          reason: reason
        });

        res.json({
          success: true,
          task_id: id,
          status: 'rejected',
          message: 'Task rejected. Agent can resubmit with improvements.'
        });
      }
    );
  });
});

/**
 * 评价 Agent
 *
 * POST /api/hall/tasks/:id/rate
 * { "rating": 5, "comment": "非常满意" }
 */
router.post('/hall/tasks/:id/rate', (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  req.db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status !== 'completed') {
      return res.status(400).json({ error: 'Can only rate completed tasks' });
    }
    if (task.client_rating) {
      return res.status(400).json({ error: 'Task already rated' });
    }

    req.db.run(
      `UPDATE tasks SET client_rating = ?, client_comment = ? WHERE id = ?`,
      [rating, comment || '', id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });

        // 更新 Agent 平均评分
        req.db.run(
          `UPDATE agents SET rating = (
            SELECT AVG(client_rating) FROM tasks WHERE agent_id = ? AND client_rating IS NOT NULL
          ) WHERE id = ?`,
          [task.agent_id, task.agent_id]
        );

        logTaskEvent(req.db, id, 'rated', task.client_id || 'client', task.client_type || 'human', {
          rating, comment
        });

        res.json({
          success: true,
          message: 'Thank you for your rating!'
        });
      }
    );
  });
});

/**
 * 取消任务（仅 open 状态可取消）
 *
 * POST /api/hall/tasks/:id/cancel
 */
router.post('/hall/tasks/:id/cancel', (req, res) => {
  const { id } = req.params;

  req.db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status !== 'open') {
      return res.status(400).json({ error: 'Can only cancel open tasks' });
    }

    req.db.run(
      `UPDATE tasks SET status = 'cancelled' WHERE id = ?`,
      [id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });

        logTaskEvent(req.db, id, 'cancelled', task.client_id || 'client', task.client_type || 'human', {});

        res.json({
          success: true,
          task_id: id,
          status: 'cancelled'
        });
      }
    );
  });
});

// ==================== 兼容旧接口 ====================

router.get('/hall/status/:id', (req, res) => {
  // 重定向到 track
  res.redirect(`/api/hall/track/${req.params.id}`);
});

module.exports = router;
