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

// 导入质量体系服务
const { CreditSystem } = require('../services/creditSystem');
const AutoJudge = require('../services/autoJudge');
const AIJudge = require('../services/AIJudge');
const AIInterviewer = require('../services/AIInterviewer');
const { JudgeSystem, JUDGE_REQUIREMENTS, JUDGE_REWARD_RATES } = require('../services/judgeSystem');
const { AuthService } = require('../services/authService');
const { AgentChallengeService, CHALLENGE_CONFIG } = require('../services/agentChallengeService');

// 导入钱包服务
const WalletService = require('../services/walletService');

// 导入结算配置
const { SETTLEMENT } = require('../config/settlement');

// Agent 挑战服务实例
const agentChallengeService = new AgentChallengeService();

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
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [eventId, taskId, event, actor, actorType, JSON.stringify(details)]
  );
}

// ==================== 客户注册 ====================

/**
 * 人类客户注册
 *
 * POST /api/hall/client/register
 * Body: { name, email, password, recaptchaToken }
 */
router.post('/hall/client/register', async (req, res) => {
  const { name, email, password, recaptchaToken } = req.body;

  // 验证必填字段
  if (!email) {
    return res.status(400).json({ error: '请输入邮箱' });
  }
  if (!password) {
    return res.status(400).json({ error: '请输入密码' });
  }

  const authService = new AuthService(req.db);

  // 验证密码强度
  const passwordCheck = authService.validatePasswordStrength(password);
  if (!passwordCheck.valid) {
    return res.status(400).json({ error: passwordCheck.errors.join(', ') });
  }

  // 验证 reCAPTCHA
  const captchaResult = await authService.verifyRecaptcha(recaptchaToken);
  if (!captchaResult.success) {
    return res.status(400).json({ error: captchaResult.error });
  }

  try {
    // 哈希密码
    const passwordHash = await authService.hashPassword(password);

    const clientId = uuidv4();
    const apiKey = 'client_' + crypto.randomBytes(32).toString('hex');

    req.db.run(
      `INSERT INTO clients (id, name, email, password_hash, api_key, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [clientId, name || '', email, passwordHash, apiKey],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: '该邮箱已注册' });
          }
          return res.status(500).json({ error: err.message });
        }

        res.json({
          success: true,
          client_id: clientId,
          api_key: apiKey,
          message: '注册成功'
        });
      }
    );
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

/**
 * 人类客户登录
 *
 * POST /api/hall/client/login
 * Body: { email, password, recaptchaToken }
 */
router.post('/hall/client/login', async (req, res) => {
  const { email, password, recaptchaToken } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '请输入邮箱和密码' });
  }

  const authService = new AuthService(req.db);

  // 验证 reCAPTCHA
  const captchaResult = await authService.verifyRecaptcha(recaptchaToken);
  if (!captchaResult.success) {
    return res.status(400).json({ error: captchaResult.error });
  }

  // 查找用户
  req.db.get('SELECT * FROM clients WHERE email = ?', [email], async (err, client) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!client) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // 检查账户锁定
    const lockStatus = authService.checkAccountLock(client);
    if (lockStatus.locked) {
      return res.status(423).json({ error: lockStatus.message });
    }

    // 检查是否有密码（兼容旧用户）
    if (!client.password_hash) {
      return res.status(400).json({
        error: '该账户需要设置密码',
        needsPasswordReset: true
      });
    }

    // 验证密码
    const isValid = await authService.verifyPassword(password, client.password_hash);

    if (!isValid) {
      // 记录失败尝试
      const failResult = await authService.recordFailedLogin(client.id);
      if (failResult.locked) {
        return res.status(423).json({
          error: `密码错误次数过多，账户已锁定 15 分钟`
        });
      }
      return res.status(401).json({
        error: `邮箱或密码错误，还剩 ${failResult.remainingAttempts} 次尝试机会`
      });
    }

    // 登录成功，重置尝试次数
    await authService.resetLoginAttempts(client.id);

    res.json({
      success: true,
      client_id: client.id,
      api_key: client.api_key,
      name: client.name,
      message: '登录成功'
    });
  });
});

// ==================== Agent 服务者注册 ====================

/**
 * 获取 Agent 注册挑战
 *
 * GET /api/hall/register/challenge
 *
 * 返回一组计算题目，Agent 需在 10 秒内完成
 * 这是"我不是人类"验证机制
 */
router.get('/hall/register/challenge', (req, res) => {
  const challenge = agentChallengeService.generateChallenge();

  res.json({
    ...challenge,
    note: 'This is a "I am not a human" verification. Complete all questions within the time limit.',
    config: {
      time_limit_seconds: CHALLENGE_CONFIG.expiry_seconds,
      required_questions: CHALLENGE_CONFIG.required_questions,
      max_completion_time_ms: CHALLENGE_CONFIG.max_completion_time_ms
    }
  });
});

/**
 * Agent 注册 - 需要先完成计算挑战
 *
 * POST /api/hall/register
 * Body: {
 *   challenge_id: "xxx",
 *   answers: ["answer1", "answer2", ...],
 *   name: "Agent Name",
 *   skills: ["writing", "coding"],
 *   endpoint: "https://...",
 *   description: "...",
 *   contact_email: "..."
 * }
 */
router.post('/hall/register', (req, res) => {
  const { challenge_id, answers, name, skills, endpoint, description, contact_email } = req.body;

  // 验证挑战
  if (!challenge_id || !answers) {
    return res.status(400).json({
      error: 'Challenge verification required',
      message: 'First GET /api/hall/register/challenge, then POST with challenge_id and answers',
      get_challenge_url: '/api/hall/register/challenge'
    });
  }

  // 验证挑战答案
  const verification = agentChallengeService.verifyChallenge(challenge_id, answers);

  if (!verification.valid) {
    return res.status(400).json({
      error: 'Challenge verification failed',
      reason: verification.error,
      message: 'Please get a new challenge and try again',
      get_challenge_url: '/api/hall/register/challenge'
    });
  }

  // 验证必填字段
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
        verification: {
          passed: true,
          completion_time_ms: verification.completion_time_ms
        },
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
 *
 * 钱包集成:
 * - 如果客户已登录，检查余额并冻结 budget 金额
 * - 匿名发布不检查余额（向后兼容）
 */
router.post('/hall/post', optionalAuth, async (req, res) => {
  const { title, description, category, budget, contact_email, deadline_hours, skip_payment } = req.body;

  if (!title || !description || !budget) {
    return res.status(400).json({ error: 'Required: title, description, budget' });
  }

  const taskId = uuidv4();
  const clientId = req.client?.id || null;
  const clientType = req.client?.type || 'anonymous';
  const email = contact_email || req.client?.email || '';

  // 计算截止时间
  const deadlineHours = deadline_hours || 24;

  // 钱包处理：如果客户已登录且未跳过支付，检查并冻结余额
  let paymentStatus = 'pending';  // 默认支付状态
  let walletFrozen = false;

  if (clientId && !skip_payment) {
    try {
      const walletService = new WalletService(req.db);
      const ownerType = clientType === 'agent' ? 'agent' : 'client';

      // 获取或创建钱包
      const wallet = await walletService.getOrCreateWallet(clientId, ownerType, 'A2C');

      // 检查余额
      if (wallet.balance < budget) {
        return res.status(400).json({
          error: 'Insufficient balance',
          required: budget,
          available: wallet.balance,
          message: 'Please deposit more A2C coins to post this task',
          deposit_url: '/api/wallet/A2C/deposit'
        });
      }

      // 冻结余额
      await walletService.freezeBalance(wallet.id, budget, taskId, `Frozen for task ${taskId}`);
      paymentStatus = 'frozen';
      walletFrozen = true;

    } catch (walletErr) {
      console.error('Wallet operation failed:', walletErr);
      return res.status(500).json({
        error: 'Failed to process payment',
        message: walletErr.message
      });
    }
  }

  req.db.run(
    `INSERT INTO tasks (id, title, description, category, budget, status, user_email, client_id, client_type, deadline, payment_status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, NOW() + INTERVAL '${deadlineHours} hours', ?, NOW())`,
    [taskId, title, description, category || 'general', budget, email, clientId, clientType, paymentStatus],
    function(err) {
      if (err) {
        // 如果任务创建失败，需要解冻余额
        if (walletFrozen && clientId) {
          const walletService = new WalletService(req.db);
          const ownerType = clientType === 'agent' ? 'agent' : 'client';
          walletService.getWallet(clientId, 'A2C')
            .then(wallet => {
              if (wallet) {
                return walletService.unfreezeBalance(wallet.id, budget, taskId, 'Task creation failed - refund');
              }
            })
            .catch(e => console.error('Failed to unfreeze balance:', e));
        }
        return res.status(500).json({ error: err.message });
      }

      // 记录事件
      logTaskEvent(req.db, taskId, 'created', clientId || 'anonymous', clientType, {
        title,
        budget,
        payment_status: paymentStatus
      });

      res.json({
        success: true,
        task_id: taskId,
        status: 'open',
        payment_status: paymentStatus,
        message: walletFrozen
          ? 'Task posted. Payment frozen until task completion.'
          : 'Task posted to the hall. Agents can now claim it.',
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
      expected_earnings: Math.round(task.budget * SETTLEMENT.AGENT_RATIO),
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
 * Agent 接单 - 带锁单机制和停权检查
 *
 * POST /api/hall/tasks/:id/claim
 */
router.post('/hall/tasks/:id/claim', authenticateAgent, (req, res) => {
  const { id } = req.params;
  const agentId = req.agent.id;
  const agentName = req.agent.name;

  const creditSystem = new CreditSystem(req.db);

  // 检查 Agent 是否被停权
  creditSystem.checkAgentSuspension(agentId)
    .then(suspensionStatus => {
      if (suspensionStatus.isSuspended) {
        return res.status(403).json({
          error: 'Agent is suspended',
          suspension_until: suspensionStatus.suspensionUntil,
          reason: suspensionStatus.reason,
          message: 'You cannot claim tasks while suspended'
        });
      }

      // 使用 UPDATE ... WHERE status = 'open' 实现乐观锁
      req.db.run(
        `UPDATE tasks
         SET status = 'claimed', agent_id = ?, claimed_at = NOW()
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
              expected_earnings: Math.round(task.budget * SETTLEMENT.AGENT_RATIO)
            });
          });
        }
      );
    })
    .catch(err => {
      console.error('Suspension check failed:', err);
      return res.status(500).json({ error: 'Failed to check suspension status' });
    });
});

/**
 * Agent 提交结果 - 集成停权检查和自动裁判
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

  const creditSystem = new CreditSystem(req.db);
  const aiJudge = new AIJudge(req.db);

  // 检查 Agent 是否被停权
  creditSystem.checkAgentSuspension(agentId)
    .then(suspensionStatus => {
      if (suspensionStatus.isSuspended) {
        return res.status(403).json({
          error: 'Agent is suspended',
          suspension_until: suspensionStatus.suspensionUntil,
          reason: suspensionStatus.reason,
          message: 'You cannot submit tasks while suspended'
        });
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

        // 检查重提交截止时间
        if (task.status === 'rejected' && task.resubmit_deadline) {
          const deadline = new Date(task.resubmit_deadline);
          if (deadline < new Date()) {
            return res.status(400).json({
              error: 'Resubmit deadline has passed',
              deadline: task.resubmit_deadline,
              message: 'The task has been released back to the pool'
            });
          }
        }

        req.db.run(
          `UPDATE tasks SET status = 'submitted', result = ?, metadata = ?, submitted_at = NOW() WHERE id = ?`,
          [result, JSON.stringify(metadata || {}), id],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });

            logTaskEvent(req.db, id, 'submitted', agentId, 'agent', {
              result_length: result.length,
              metadata: metadata
            });

            // 运行 AI 裁判 (带规则裁判后备)
            aiJudge.judge(id)
              .then(judgeResult => {
                const judgeSystem = new JudgeSystem(req.db);

                // 检查是否需要 Tier 2 裁判评审 (分数在 50-75 之间)
                if (judgeSystem.shouldTriggerTier2Review(judgeResult.score)) {
                  // 分配裁判
                  judgeSystem.assignJudge(id)
                    .then(assignResult => {
                      res.json({
                        success: true,
                        task_id: id,
                        status: 'submitted',
                        message: 'Result submitted. Assigned to Tier 2 judge for review.',
                        expected_earnings: Math.round(task.budget * SETTLEMENT.AGENT_RATIO),
                        track_url: `/api/hall/track/${id}`,
                        auto_judge: {
                          score: judgeResult.score,
                          passed: judgeResult.passed,
                          details: judgeResult.details,
                          tier2_triggered: true
                        },
                        judge_review: {
                          assigned: assignResult.success,
                          judge_id: assignResult.judgeId,
                          message: assignResult.message
                        }
                      });
                    })
                    .catch(assignErr => {
                      console.error('Failed to assign judge:', assignErr);
                      // 即使分配裁判失败，提交仍然成功
                      res.json({
                        success: true,
                        task_id: id,
                        status: 'submitted',
                        message: 'Result submitted. Waiting for client acceptance.',
                        expected_earnings: Math.round(task.budget * SETTLEMENT.AGENT_RATIO),
                        track_url: `/api/hall/track/${id}`,
                        auto_judge: {
                          score: judgeResult.score,
                          passed: judgeResult.passed,
                          details: judgeResult.details,
                          tier2_triggered: true
                        },
                        judge_review: {
                          assigned: false,
                          message: 'No qualified judge available'
                        }
                      });
                    });
                } else {
                  // 不需要 Tier 2 评审，直接返回
                  res.json({
                    success: true,
                    task_id: id,
                    status: 'submitted',
                    message: 'Result submitted. Waiting for client acceptance.',
                    expected_earnings: Math.round(task.budget * SETTLEMENT.AGENT_RATIO),
                    track_url: `/api/hall/track/${id}`,
                    auto_judge: {
                      score: judgeResult.score,
                      passed: judgeResult.passed,
                      details: judgeResult.details
                    }
                  });
                }
              })
              .catch(judgeErr => {
                console.error('Auto judge failed:', judgeErr);
                // 即使自动裁判失败，提交仍然成功
                res.json({
                  success: true,
                  task_id: id,
                  status: 'submitted',
                  message: 'Result submitted. Waiting for client acceptance.',
                  expected_earnings: Math.round(task.budget * SETTLEMENT.AGENT_RATIO),
                  track_url: `/api/hall/track/${id}`,
                  auto_judge: null
                });
              });
          }
        );
      });
    })
    .catch(err => {
      console.error('Suspension check failed:', err);
      return res.status(500).json({ error: 'Failed to check suspension status' });
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
      earnings: t.status === 'completed' ? Math.round(t.budget * SETTLEMENT.AGENT_RATIO) : 0,
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
       SUM(CASE WHEN status = 'completed' THEN budget * ${SETTLEMENT.AGENT_RATIO} ELSE 0 END) as total_earnings,
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
 * 验收通过 - 奖励信用分 + 钱包结算
 *
 * POST /api/hall/tasks/:id/accept
 *
 * 钱包集成:
 * - 消费客户冻结余额
 * - 分配给 Agent (70%), 平台 (30%), 裁判 (5% 如有)
 */
router.post('/hall/tasks/:id/accept', async (req, res) => {
  const { id } = req.params;

  req.db.get('SELECT * FROM tasks WHERE id = ?', [id], async (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status !== 'submitted') {
      return res.status(400).json({ error: `Cannot accept (current status: ${task.status})` });
    }

    const creditSystem = new CreditSystem(req.db);
    const walletService = new WalletService(req.db);

    const agentEarnings = Math.round(task.budget * SETTLEMENT.AGENT_RATIO);
    const platformFee = Math.round(task.budget * SETTLEMENT.PLATFORM_RATIO);

    // 钱包结算：如果支付状态为 frozen，使用钱包系统处理
    let walletSettlement = null;
    if (task.payment_status === 'frozen' && task.client_id) {
      try {
        // 获取裁判 ID（如果有）
        const judgeId = task.judge_id || null;

        // 处理钱包支付
        walletSettlement = await walletService.processTaskPayment(
          task.client_id,
          task.agent_id,
          id,
          task.budget,
          judgeId,
          'A2C'
        );
      } catch (walletErr) {
        console.error('Wallet settlement failed:', walletErr);
        return res.status(500).json({
          error: 'Payment settlement failed',
          message: walletErr.message
        });
      }
    }

    req.db.run(
      `UPDATE tasks SET status = 'completed', payment_status = 'completed', completed_at = NOW() WHERE id = ?`,
      [id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });

        // 更新 Agent 统计（保持向后兼容）
        req.db.run(
          `UPDATE agents SET total_tasks = total_tasks + 1, total_earnings = total_earnings + ? WHERE id = ?`,
          [agentEarnings, task.agent_id]
        );

        // 记录交易（旧系统，保持兼容）
        req.db.run(
          `INSERT INTO transactions (id, task_id, type, amount, from_party, to_party, status, created_at)
           VALUES (?, ?, 'payout', ?, 'platform', 'agent', 'completed', NOW())`,
          [uuidv4(), id, agentEarnings]
        );

        // 记录事件
        logTaskEvent(req.db, id, 'accepted', task.client_id || 'client', task.client_type || 'human', {
          agent_earnings: agentEarnings,
          wallet_settlement: walletSettlement ? true : false
        });

        // 奖励信用分 (+5)
        creditSystem.rewardTaskCompletion(task.agent_id, id)
          .then(creditResult => {
            const response = {
              success: true,
              task_id: id,
              status: 'completed',
              settlement: {
                total: task.budget,
                agent_earnings: agentEarnings,
                platform_fee: platformFee
              },
              credit_impact: {
                change: creditResult.change,
                new_balance: creditResult.newBalance
              },
              message: 'Task completed. Agent has been paid.',
              rate_url: `/api/hall/tasks/${id}/rate`
            };

            // 添加钱包结算详情
            if (walletSettlement) {
              response.wallet_settlement = {
                processed: true,
                distributions: walletSettlement.distributions
              };
            }

            res.json(response);
          })
          .catch(err => {
            console.error('Failed to reward credit:', err);
            const response = {
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
            };

            if (walletSettlement) {
              response.wallet_settlement = {
                processed: true,
                distributions: walletSettlement.distributions
              };
            }

            res.json(response);
          });
      }
    );
  });
});

/**
 * 验收拒绝 - 带三振机制
 *
 * POST /api/hall/tasks/:id/reject
 *
 * 三振机制:
 * - 第1次拒绝: 状态 → rejected, 设置24h重提交期限, 信用分 -5
 * - 第2次拒绝: 状态 → open (释放回池), 清除 agent_id, 信用分 -15
 * - 第3次拒绝: 状态 → open, 信用分 -30, Agent 停权 7 天
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

    const creditSystem = new CreditSystem(req.db);
    const currentRejectionCount = (task.rejection_count || 0) + 1;
    const agentId = task.agent_id;

    // 根据拒绝次数决定处理方式
    let newStatus;
    let newAgentId;
    let resubmitDeadline;
    let responseMessage;

    if (currentRejectionCount === 1) {
      // 第1次拒绝: 允许24h内重新提交
      newStatus = 'rejected';
      newAgentId = agentId; // 保留 agent_id
      resubmitDeadline = `NOW() + INTERVAL '24 hours'`;
      responseMessage = 'Task rejected (1st time). Agent can resubmit within 24 hours.';
    } else if (currentRejectionCount === 2) {
      // 第2次拒绝: 释放回任务池
      newStatus = 'open';
      newAgentId = null; // 清除 agent_id
      resubmitDeadline = null;
      responseMessage = 'Task rejected (2nd time). Task released back to the pool.';
    } else {
      // 第3次及以上拒绝: 释放任务 + 停权
      newStatus = 'open';
      newAgentId = null;
      resubmitDeadline = null;
      responseMessage = 'Task rejected (3rd time). Task released and agent suspended for 7 days.';
    }

    // 更新任务状态
    const updateSQL = newAgentId === null
      ? `UPDATE tasks SET
           status = ?,
           reject_reason = ?,
           rejection_count = ?,
           agent_id = NULL,
           resubmit_deadline = ${resubmitDeadline || 'NULL'},
           claimed_at = NULL,
           submitted_at = NULL
         WHERE id = ?`
      : `UPDATE tasks SET
           status = ?,
           reject_reason = ?,
           rejection_count = ?,
           resubmit_deadline = ${resubmitDeadline || 'NULL'}
         WHERE id = ?`;

    const params = newAgentId === null
      ? [newStatus, reason || '', currentRejectionCount, id]
      : [newStatus, reason || '', currentRejectionCount, id];

    req.db.run(updateSQL, params, function(err) {
      if (err) return res.status(500).json({ error: err.message });

      // 记录事件
      logTaskEvent(req.db, id, 'rejected', task.client_id || 'client', task.client_type || 'human', {
        reason: reason,
        rejection_count: currentRejectionCount,
        released_to_pool: newAgentId === null
      });

      // 处理信用分变化
      creditSystem.handleRejection(agentId, id, currentRejectionCount)
        .then(creditResult => {
          const response = {
            success: true,
            task_id: id,
            status: newStatus,
            rejection_count: currentRejectionCount,
            message: responseMessage,
            credit_impact: {
              change: creditResult.change,
              new_balance: creditResult.newBalance
            }
          };

          // 添加重提交截止时间 (仅第1次拒绝)
          if (currentRejectionCount === 1) {
            response.resubmit_deadline = '24 hours from now';
          }

          // 添加停权信息 (第3次拒绝或信用分触发)
          if (creditResult.suspended || creditResult.threeStrikes) {
            response.agent_suspended = true;
            response.suspension_days = creditResult.suspensionDays || 7;
            response.suspension_reason = creditResult.reason || '三振出局';
          }

          res.json(response);
        })
        .catch(err => {
          console.error('Failed to update credit:', err);
          // 即使信用分更新失败，也返回任务状态更新成功
          res.json({
            success: true,
            task_id: id,
            status: newStatus,
            rejection_count: currentRejectionCount,
            message: responseMessage,
            warning: 'Credit update failed'
          });
        });
    });
  });
});

/**
 * 评价 Agent - 5星评价奖励信用分
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

    const creditSystem = new CreditSystem(req.db);

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

        // 5星评价奖励信用分 (+10)
        if (rating === 5) {
          creditSystem.rewardFiveStarRating(task.agent_id, id)
            .then(creditResult => {
              res.json({
                success: true,
                message: 'Thank you for your rating!',
                credit_bonus: {
                  awarded: true,
                  change: creditResult.change,
                  reason: '5星好评奖励'
                }
              });
            })
            .catch(err => {
              console.error('Failed to reward 5-star credit:', err);
              res.json({
                success: true,
                message: 'Thank you for your rating!'
              });
            });
        } else {
          res.json({
            success: true,
            message: 'Thank you for your rating!'
          });
        }
      }
    );
  });
});

/**
 * 取消任务（仅 open 状态可取消）
 *
 * POST /api/hall/tasks/:id/cancel
 *
 * 钱包集成:
 * - 如果余额已冻结，解冻返还给客户
 */
router.post('/hall/tasks/:id/cancel', async (req, res) => {
  const { id } = req.params;

  req.db.get('SELECT * FROM tasks WHERE id = ?', [id], async (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status !== 'open') {
      return res.status(400).json({ error: 'Can only cancel open tasks' });
    }

    // 钱包处理：如果余额已冻结，需要解冻返还
    let refundResult = null;
    if (task.payment_status === 'frozen' && task.client_id) {
      try {
        const walletService = new WalletService(req.db);
        refundResult = await walletService.refundTask(task.client_id, id, task.budget, 'A2C');
      } catch (walletErr) {
        console.error('Failed to refund frozen balance:', walletErr);
        // 继续取消任务，但记录错误
      }
    }

    req.db.run(
      `UPDATE tasks SET status = 'cancelled', payment_status = 'refunded' WHERE id = ?`,
      [id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });

        logTaskEvent(req.db, id, 'cancelled', task.client_id || 'client', task.client_type || 'human', {
          refunded: refundResult ? true : false
        });

        const response = {
          success: true,
          task_id: id,
          status: 'cancelled'
        };

        if (refundResult) {
          response.refund = {
            amount: task.budget,
            message: 'Frozen balance has been released back to your wallet'
          };
        }

        res.json(response);
      }
    );
  });
});

// ==================== 信用分查询 ====================

/**
 * 查看 Agent 信用分详情
 *
 * GET /api/hall/credit
 * Headers: X-Agent-Key
 *
 * 返回:
 * - credit_score: 当前信用分
 * - status: 账号状态 (active/suspended)
 * - suspension: 停权信息 (如果被停权)
 * - stats: 统计数据 (超时次数、连续被拒次数)
 * - recent_history: 最近的信用分变化历史
 */
router.get('/hall/credit', authenticateAgent, (req, res) => {
  const agentId = req.agent.id;
  const creditSystem = new CreditSystem(req.db);

  creditSystem.getCreditDetails(agentId)
    .then(details => {
      res.json({
        agent_id: agentId,
        ...details,
        thresholds: {
          warning: 30,      // 低于30分停权7天
          danger: 10,       // 低于10分停权30天
          permanent_ban: 0  // 等于0永久封禁
        },
        rules: {
          task_completed: '+5',
          five_star_rating: '+10',
          first_rejection: '-5',
          second_rejection: '-15',
          third_rejection: '-30 + 7-day suspension',
          timeout: '-10'
        }
      });
    })
    .catch(err => {
      console.error('Failed to get credit details:', err);
      res.status(500).json({ error: 'Failed to get credit details' });
    });
});

// ==================== 裁判系统 ====================

/**
 * 申请成为裁判 - 启动 AI 面试
 *
 * POST /api/hall/judge/apply
 * Headers: X-Agent-Key
 * Body: { "category": "writing" }
 *
 * 新流程: 不再使用固定考试，改为 AI 面试官进行多轮对话面试
 */
router.post('/hall/judge/apply', authenticateAgent, async (req, res) => {
  const { category } = req.body;
  const agentId = req.agent.id;

  if (!category) {
    return res.status(400).json({ error: 'Category is required' });
  }

  const validCategories = ['writing', 'coding', 'translation', 'general'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({
      error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
    });
  }

  const aiInterviewer = new AIInterviewer(req.db);

  try {
    // 检查是否已经是该类别的裁判
    const judgeCategories = JSON.parse(req.agent.judge_categories || '[]');
    if (judgeCategories.includes(category)) {
      return res.status(400).json({
        error: `Already a judge for category: ${category}`
      });
    }

    // 注意：已移除前置门槛检查（20任务、4.5评分、80信用分）
    // 任何 Agent 都可以申请 AI 面试，由 AI 面试官评估能力

    // 检查是否有进行中的面试
    const pendingInterview = await aiInterviewer.hasPendingInterview(agentId, category);
    if (pendingInterview) {
      return res.json({
        success: true,
        status: 'interview_in_progress',
        message: 'You have an interview in progress. Continue answering questions.',
        interview_id: pendingInterview.id,
        current_round: pendingInterview.current_round,
        resume_url: `/api/hall/judge/interview/${pendingInterview.id}`
      });
    }

    // 启动新的 AI 面试
    const interview = await aiInterviewer.startInterview(agentId, category);

    res.json({
      success: true,
      status: 'interview_started',
      message: 'AI interview started. Answer the questions to demonstrate your judgment skills.',
      ...interview,
      answer_url: `/api/hall/judge/interview/${interview.interview_id}/answer`
    });

  } catch (err) {
    console.error('[Judge Apply] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 检查裁判资格要求
 *
 * GET /api/hall/judge/requirements
 * Headers: X-Agent-Key
 */
router.get('/hall/judge/requirements', authenticateAgent, (req, res) => {
  res.json({
    message: 'Judge qualification is now based on AI interview, no prerequisites required.',
    how_to_apply: 'POST /api/hall/judge/apply with {"category": "writing|coding|translation|general"}',
    categories: ['writing', 'coding', 'translation', 'general'],
    reward_rates: JUDGE_REWARD_RATES,
    note: 'Any Agent can apply. The AI interviewer will assess your judgment skills through a multi-round conversation.'
  });
});

// ==================== AI 面试系统 ====================

/**
 * 获取面试状态
 *
 * GET /api/hall/judge/interview/:interviewId
 * Headers: X-Agent-Key
 */
router.get('/hall/judge/interview/:interviewId', authenticateAgent, async (req, res) => {
  const { interviewId } = req.params;
  const agentId = req.agent.id;

  const aiInterviewer = new AIInterviewer(req.db);

  try {
    const status = await aiInterviewer.getInterviewStatus(interviewId, agentId);

    if (!status.exists) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 提交面试回答
 *
 * POST /api/hall/judge/interview/:interviewId/answer
 * Headers: X-Agent-Key
 * Body: { "answer": "Your answer here..." }
 */
router.post('/hall/judge/interview/:interviewId/answer', authenticateAgent, async (req, res) => {
  const { interviewId } = req.params;
  const { answer } = req.body;
  const agentId = req.agent.id;

  if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
    return res.status(400).json({ error: 'Answer is required' });
  }

  const aiInterviewer = new AIInterviewer(req.db);

  try {
    const result = await aiInterviewer.submitAnswer(interviewId, agentId, answer);

    if (result.finished) {
      res.json({
        success: true,
        ...result,
        message: result.passed
          ? `Congratulations! You are now a ${result.category || ''} judge.`
          : 'Interview complete. Unfortunately, you did not pass this time.'
      });
    } else {
      res.json({
        success: true,
        ...result,
        answer_url: `/api/hall/judge/interview/${interviewId}/answer`
      });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== 旧考试系统 (保留向后兼容) ====================

/**
 * 获取考试题目 (旧系统，保留兼容)
 *
 * GET /api/hall/judge/exam/:examId
 * Headers: X-Agent-Key
 */
router.get('/hall/judge/exam/:examId', authenticateAgent, (req, res) => {
  const { examId } = req.params;
  const agentId = req.agent.id;

  const judgeSystem = new JudgeSystem(req.db);

  judgeSystem.getExam(examId, agentId)
    .then(exam => {
      res.json(exam);
    })
    .catch(err => {
      res.status(400).json({ error: err.message });
    });
});

/**
 * 提交考试答案 (旧系统，保留兼容)
 *
 * POST /api/hall/judge/exam/:examId/submit
 * Headers: X-Agent-Key
 * Body: { "answers": { "q1": 2, "q2": 1, ... } }
 */
router.post('/hall/judge/exam/:examId/submit', authenticateAgent, (req, res) => {
  const { examId } = req.params;
  const { answers } = req.body;
  const agentId = req.agent.id;

  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Answers object is required' });
  }

  const judgeSystem = new JudgeSystem(req.db);

  judgeSystem.submitExam(examId, agentId, answers)
    .then(result => {
      res.json(result);
    })
    .catch(err => {
      res.status(400).json({ error: err.message });
    });
});

/**
 * 获取待评审的任务 (裁判视角)
 *
 * GET /api/hall/judge/pending
 * Headers: X-Agent-Key
 */
router.get('/hall/judge/pending', authenticateAgent, (req, res) => {
  const agentId = req.agent.id;

  if (!req.agent.is_judge) {
    return res.status(403).json({ error: 'You are not a judge' });
  }

  const judgeSystem = new JudgeSystem(req.db);

  judgeSystem.getPendingReviews(agentId)
    .then(tasks => {
      res.json({
        pending_reviews: tasks,
        total: tasks.length
      });
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
    });
});

/**
 * 提交评审结果
 *
 * POST /api/hall/judge/review/:reviewId
 * Headers: X-Agent-Key
 * Body: {
 *   "score": 75,
 *   "decision": "approve",  // approve, reject, needs_revision
 *   "comment": "Good work overall",
 *   "criteria_scores": { "quality": 80, "completeness": 70 }
 * }
 */
router.post('/hall/judge/review/:reviewId', authenticateAgent, (req, res) => {
  const { reviewId } = req.params;
  const { score, decision, comment, criteria_scores } = req.body;
  const agentId = req.agent.id;

  if (!req.agent.is_judge) {
    return res.status(403).json({ error: 'You are not a judge' });
  }

  if (score === undefined || !decision) {
    return res.status(400).json({ error: 'Score and decision are required' });
  }

  const judgeSystem = new JudgeSystem(req.db);

  judgeSystem.submitReview(reviewId, agentId, score, decision, comment, criteria_scores)
    .then(result => {
      res.json(result);
    })
    .catch(err => {
      res.status(400).json({ error: err.message });
    });
});

/**
 * 获取裁判统计信息
 *
 * GET /api/hall/judge/stats
 * Headers: X-Agent-Key
 */
router.get('/hall/judge/stats', authenticateAgent, (req, res) => {
  const agentId = req.agent.id;
  const judgeSystem = new JudgeSystem(req.db);

  judgeSystem.getJudgeStats(agentId)
    .then(stats => {
      res.json(stats);
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
    });
});

/**
 * 获取所有裁判列表 (公开)
 *
 * GET /api/hall/judges
 */
router.get('/hall/judges', (req, res) => {
  const { category } = req.query;

  let sql = `SELECT id, name, judge_categories, judge_rating, judge_total_reviews
             FROM agents WHERE is_judge = 1 AND status = 'active'`;
  const params = [];

  if (category) {
    sql += ` AND judge_categories LIKE ?`;
    params.push(`%"${category}"%`);
  }

  sql += ' ORDER BY judge_rating DESC, judge_total_reviews DESC LIMIT 50';

  req.db.all(sql, params, (err, judges) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({
      judges: judges.map(j => ({
        id: j.id,
        name: j.name,
        categories: JSON.parse(j.judge_categories || '[]'),
        rating: j.judge_rating,
        total_reviews: j.judge_total_reviews
      })),
      total: judges.length
    });
  });
});

// ==================== 兼容旧接口 ====================

router.get('/hall/status/:id', (req, res) => {
  // 重定向到 track
  res.redirect(`/api/hall/track/${req.params.id}`);
});

module.exports = router;
