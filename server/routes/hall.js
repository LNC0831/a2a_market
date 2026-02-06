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
const ReviewOrchestrator = require('../services/ReviewOrchestrator');
const { JudgeSystem, JUDGE_REQUIREMENTS, JUDGE_REWARD_RATES } = require('../services/judgeSystem');
const { AuthService } = require('../services/authService');
const { AgentChallengeService, CHALLENGE_CONFIG } = require('../services/agentChallengeService');

// 导入钱包服务
const WalletService = require('../services/walletService');

// 导入结算配置
const { SETTLEMENT } = require('../config/settlement');

// 导入经济系统配置
const { ECONOMY } = require('../config/economy');
const EconomyEngine = require('../services/EconomyEngine');

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

  // Validate required fields
  if (!email) {
    return res.status(400).json({ error: 'Please enter email' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Please enter password' });
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
      `INSERT INTO clients (id, name, email, password_hash, api_key, registration_bonus_granted, created_at)
       VALUES (?, ?, ?, ?, ?, 0, NOW())`,
      [clientId, name || '', email, passwordHash, apiKey],
      async function(err) {
        if (err) {
          // Handle unique constraint violations from different databases
          if (err.message.includes('UNIQUE') ||
              err.message.includes('duplicate key') ||
              err.code === '23505') {  // PostgreSQL unique constraint error code
            return res.status(400).json({ error: 'Email already registered' });
          }
          return res.status(500).json({ error: err.message });
        }

        // Grant registration bonus
        let bonusGranted = false;
        try {
          const walletService = new WalletService(req.db);
          const wallet = await walletService.getOrCreateWallet(clientId, 'client', 'MP');
          await walletService.addBalance(
            wallet.id,
            ECONOMY.HUMAN_REGISTRATION_BONUS,
            'bonus',
            'Registration bonus - Welcome to A2A Market!',
            { source: 'registration_bonus' }
          );

          // Mark bonus as granted
          req.db.run(
            'UPDATE clients SET registration_bonus_granted = 1 WHERE id = ?',
            [clientId]
          );
          bonusGranted = true;
        } catch (bonusErr) {
          console.error('[Registration] Failed to grant bonus:', bonusErr);
          // Continue with registration success even if bonus fails
        }

        res.json({
          success: true,
          client_id: clientId,
          api_key: apiKey,
          message: 'Registration successful',
          bonus: bonusGranted ? {
            granted: true,
            amount: ECONOMY.HUMAN_REGISTRATION_BONUS,
            currency: 'MP'
          } : null
        });
      }
    );
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed, please try again later' });
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
    return res.status(400).json({ error: 'Please enter email and password' });
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
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 检查账户锁定
    const lockStatus = authService.checkAccountLock(client);
    if (lockStatus.locked) {
      return res.status(423).json({ error: lockStatus.message });
    }

    // Check if password exists (for legacy users)
    if (!client.password_hash) {
      return res.status(400).json({
        error: 'This account needs to set a password',
        needsPasswordReset: true
      });
    }

    // 验证密码
    const isValid = await authService.verifyPassword(password, client.password_hash);

    if (!isValid) {
      // Record failed attempt
      const failResult = await authService.recordFailedLogin(client.id);
      if (failResult.locked) {
        return res.status(423).json({
          error: 'Too many failed attempts, account locked for 15 minutes'
        });
      }
      return res.status(401).json({
        error: `Invalid email or password, ${failResult.remainingAttempts} attempts remaining`
      });
    }

    // 登录成功，重置尝试次数
    await authService.resetLoginAttempts(client.id);

    res.json({
      success: true,
      client_id: client.id,
      api_key: client.api_key,
      name: client.name,
      message: 'Login successful'
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

  // Determine owner from optional authentication headers
  const clientKey = req.headers['x-client-key'];
  const agentKey = req.headers['x-agent-key'];

  // Helper to complete registration with owner info
  const completeRegistration = (ownerId, ownerType) => {
    const agentId = uuidv4();
    const apiKey = 'agent_' + crypto.randomBytes(32).toString('hex');

    req.db.run(
      `INSERT INTO agents (id, name, skills, endpoint, description, email, api_key, type, status, rating, total_tasks, total_earnings, registration_bonus_granted, owner_id, owner_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [agentId, name, JSON.stringify(skills), endpoint || null, description || '',
       contact_email || '', apiKey, 'external', 'active', 5.0, 0, 0, ownerId, ownerType],
    async function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Grant registration bonus
      let bonusGranted = false;
      try {
        const walletService = new WalletService(req.db);
        const wallet = await walletService.getOrCreateWallet(agentId, 'agent', 'MP');
        await walletService.addBalance(
          wallet.id,
          ECONOMY.AGENT_REGISTRATION_BONUS,
          'bonus',
          'Agent registration bonus - Welcome to A2A Market!',
          { source: 'registration_bonus' }
        );

        // Mark bonus as granted
        req.db.run(
          'UPDATE agents SET registration_bonus_granted = 1 WHERE id = ?',
          [agentId]
        );
        bonusGranted = true;
      } catch (bonusErr) {
        console.error('[Agent Registration] Failed to grant bonus:', bonusErr);
        // Continue with registration success even if bonus fails
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
        bonus: bonusGranted ? {
          granted: true,
          amount: ECONOMY.AGENT_REGISTRATION_BONUS,
          currency: 'MP'
        } : null,
        owner: ownerId ? { id: ownerId, type: ownerType } : null,
        usage: {
          as_worker: 'Use X-Agent-Key to claim and complete tasks',
          as_client: 'Use same X-Agent-Key to post tasks (Agent can be both client and worker)'
        }
      });
    }
    );
  };

  // Resolve owner from authentication headers
  if (clientKey) {
    // Human client is creating this agent
    req.db.get('SELECT id FROM clients WHERE api_key = ?', [clientKey], (err, client) => {
      if (err) return res.status(500).json({ error: err.message });
      if (client) {
        completeRegistration(client.id, 'client');
      } else {
        // Invalid client key, register as anonymous
        completeRegistration(null, 'anonymous');
      }
    });
  } else if (agentKey) {
    // Another agent is creating this agent
    req.db.get('SELECT id FROM agents WHERE api_key = ?', [agentKey], (err, agent) => {
      if (err) return res.status(500).json({ error: err.message });
      if (agent) {
        completeRegistration(agent.id, 'agent');
      } else {
        // Invalid agent key, register as anonymous
        completeRegistration(null, 'anonymous');
      }
    });
  } else {
    // No authentication, anonymous registration
    completeRegistration(null, 'anonymous');
  }
});

// ==================== 发布任务（客户端） ====================

/**
 * 发布任务 - 人类或Agent都可以发布
 *
 * POST /api/hall/post
 * Headers: X-Client-Key 或 X-Agent-Key
 *
 * Body:
 * - title, description, budget (required)
 * - category, contact_email, deadline_hours (optional)
 * - source: 'user' | 'platform' (optional, default: 'user')
 *
 * 钱包集成:
 * - 如果客户已登录，检查余额并冻结 budget 金额
 * - 匿名发布不检查余额（向后兼容）
 */
router.post('/hall/post', optionalAuth, async (req, res) => {
  const { title, description, category, budget, contact_email, deadline_hours, skip_payment, source } = req.body;

  // Validate required fields
  if (!title || !description) {
    return res.status(400).json({ error: 'Required: title, description, budget' });
  }

  // Validate budget is a positive number
  const budgetNumber = parseFloat(budget);
  if (!budget || isNaN(budgetNumber) || budgetNumber <= 0) {
    return res.status(400).json({ error: 'Budget must be a positive number' });
  }

  const taskId = uuidv4();
  const clientId = req.client?.id || null;
  const clientType = req.client?.type || 'anonymous';
  const email = contact_email || req.client?.email || '';
  const taskSource = source || 'user';  // 'user' or 'platform'

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
      const wallet = await walletService.getOrCreateWallet(clientId, ownerType, 'MP');

      // 检查余额
      if (wallet.balance < budget) {
        return res.status(400).json({
          error: 'Insufficient balance',
          required: budget,
          available: wallet.balance,
          message: 'Please deposit more MP (Marketplace Points) to post this task',
          deposit_url: '/api/wallet/MP/deposit'
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
    `INSERT INTO tasks (id, title, description, category, budget, status, user_email, client_id, client_type, deadline, payment_status, source, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, NOW() + INTERVAL '${deadlineHours} hours', ?, ?, NOW())`,
    [taskId, title, description, category || 'general', budget, email, clientId, clientType, paymentStatus, taskSource],
    function(err) {
      if (err) {
        // 如果任务创建失败，需要解冻余额
        if (walletFrozen && clientId) {
          const walletService = new WalletService(req.db);
          const ownerType = clientType === 'agent' ? 'agent' : 'client';
          walletService.getWallet(clientId, 'MP')
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
        payment_status: paymentStatus,
        source: taskSource
      });

      res.json({
        success: true,
        task_id: taskId,
        status: 'open',
        payment_status: paymentStatus,
        source: taskSource,
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
function handleTaskDetails(req, res) {
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
            currency: 'MP',
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
}

router.get('/hall/track/:id', handleTaskDetails);

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
 *
 * Query params:
 * - category: Filter by task category
 * - min_budget, max_budget: Budget range filter
 * - source: Filter by source ('user' | 'platform')
 */
router.get('/hall/tasks', optionalAuth, (req, res) => {
  const { category, min_budget, max_budget, source } = req.query;
  const agentSkills = req.client?.type === 'agent' ? JSON.parse(req.client.skills || '[]') : [];

  let sql = `SELECT id, title, description, category, budget, status, created_at, deadline, source,
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
  if (source) {
    sql += ' AND source = ?';
    params.push(source);
  }

  sql += ' ORDER BY budget DESC, created_at ASC';

  req.db.all(sql, params, (err, tasks) => {
    if (err) return res.status(500).json({ error: err.message });

    const enrichedTasks = tasks.map(task => ({
      ...task,
      currency: 'MP',
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
 * 获取已完成任务列表（公开）
 *
 * GET /api/hall/tasks/completed
 *
 * Query params:
 * - limit: Number of tasks to return (default 50)
 */
router.get('/hall/tasks/completed', (req, res) => {
  const { limit = 50 } = req.query;

  const sql = `SELECT id, title, description, category, budget, status, created_at, completed_at,
                      agent_id, client_rating
               FROM tasks WHERE status = 'completed'
               ORDER BY completed_at DESC
               LIMIT ?`;

  req.db.all(sql, [parseInt(limit)], (err, tasks) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({
      tasks: tasks || [],
      total: tasks?.length || 0
    });
  });
});

/**
 * Get task details by ID (alias for track/:id)
 *
 * GET /api/hall/tasks/:id
 *
 * Note: Must be defined AFTER /hall/tasks and /hall/tasks/completed
 * to avoid :id parameter matching those routes.
 */
router.get('/hall/tasks/:id', handleTaskDetails);

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
  const reviewOrchestrator = new ReviewOrchestrator(req.db);

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

            // 运行安全检查 (2026-02-05 更新: 只做安全检查，不评判质量)
            // AI 只检测空提交、乱码、占位文本等
            // 质量决定权完全交给客户
            reviewOrchestrator.processSubmission(id, result)
              .then(reviewResult => {
                // 如果安全检查未通过，拒绝提交
                if (!reviewResult.allowed) {
                  // 回滚状态
                  req.db.run(
                    `UPDATE tasks SET status = 'claimed', result = NULL, submitted_at = NULL WHERE id = ?`,
                    [id]
                  );
                  return res.status(400).json({
                    success: false,
                    error: 'Submission blocked by safety check',
                    reason: reviewResult.reason,
                    message: reviewResult.message,
                    details: reviewResult.details
                  });
                }

                // 安全检查通过，等待客户审核
                const response = {
                  success: true,
                  task_id: id,
                  status: 'submitted',
                  message: 'Result submitted. Awaiting client review.',
                  expected_earnings: Math.round(task.budget * SETTLEMENT.AGENT_RATIO),
                  track_url: `/api/hall/track/${id}`,
                  container_url: `/api/hall/container/${id}`,
                  safety_check: {
                    passed: reviewResult.safe,
                    message: reviewResult.message
                  },
                  // 客户有完全决定权
                  client_decision_required: true
                };

                res.json(response);
              })
              .catch(reviewErr => {
                console.error('Review orchestrator failed:', reviewErr);
                // 即使评审失败，提交仍然成功
                res.json({
                  success: true,
                  task_id: id,
                  status: 'submitted',
                  message: 'Result submitted. Waiting for client acceptance.',
                  expected_earnings: Math.round(task.budget * SETTLEMENT.AGENT_RATIO),
                  track_url: `/api/hall/track/${id}`,
                  auto_judge: null,
                  review: {
                    error: reviewErr.message
                  }
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
 * Wrap a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} - Promise that rejects if timeout is reached
 */
function withTimeout(promise, timeoutMs = 3000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
    )
  ]);
}

/**
 * Agent 查看收益统计
 *
 * GET /api/hall/earnings
 */
router.get('/hall/earnings', authenticateAgent, async (req, res) => {
  const agentId = req.agent.id;

  try {
    // Query agent's task statistics
    const stats = await new Promise((resolve, reject) => {
      req.db.get(
        `SELECT
           COUNT(*) as total_tasks,
           SUM(CASE WHEN status = 'completed' THEN budget * ${SETTLEMENT.AGENT_RATIO} ELSE 0 END) as total_earnings,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
           AVG(CASE WHEN status = 'completed' AND client_rating IS NOT NULL THEN client_rating ELSE NULL END) as avg_rating
         FROM tasks WHERE agent_id = ?`,
        [agentId],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    // Get current dynamic rate from EconomyEngine with timeout
    let currentRate = '75%';
    let burnRate = '25%';
    try {
      const economyEngine = new EconomyEngine(req.db);
      const params = await withTimeout(economyEngine.getEconomyParams(), 3000);
      const agentRate = 1 - params.burnRate;
      currentRate = `${Math.round(agentRate * 100)}%`;
      burnRate = `${Math.round(params.burnRate * 100)}%`;
    } catch (e) {
      console.error('Failed to get dynamic rate (using defaults):', e.message);
      // Use default values on timeout or error
    }

    res.json({
      agent_id: agentId,
      total_tasks: stats.total_tasks || 0,
      completed_tasks: stats.completed_tasks || 0,
      total_earnings: Math.round(stats.total_earnings || 0),
      average_rating: stats.avg_rating ? parseFloat(stats.avg_rating.toFixed(2)) : null,
      current_rate: currentRate,
      burn_rate: burnRate,
      rate_range: '60-90%',
      note: 'Your rate varies with market conditions (σ)'
    });
  } catch (err) {
    console.error('[Earnings] Error:', err);
    res.status(500).json({ error: err.message });
  }
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
      id: t.id,
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
 * 验收通过 - 动态经济结算 + 奖励信用分
 *
 * POST /api/hall/tasks/:id/accept
 *
 * 动态经济系统:
 * - Agent 获得 (1 - B) 比例，B 为当前销毁率
 * - B 部分销毁（不归任何人）
 * - 裁判奖励为固定 10 MP（从平台账户发放，不从任务扣）
 */
router.post('/hall/tasks/:id/accept', authenticateClient, async (req, res) => {
  const { id } = req.params;

  req.db.get('SELECT * FROM tasks WHERE id = ?', [id], async (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status !== 'submitted') {
      return res.status(400).json({ error: `Cannot accept (current status: ${task.status})` });
    }

    // Verify caller is the task creator
    if (task.client_id && req.client.id !== task.client_id) {
      return res.status(403).json({ error: 'Only the task creator can perform this action' });
    }

    const creditSystem = new CreditSystem(req.db);
    const walletService = new WalletService(req.db);
    const economyEngine = new EconomyEngine(req.db);

    // Get current economy parameters for dynamic settlement
    let economyParams;
    try {
      economyParams = await economyEngine.getEconomyParams();
    } catch (econErr) {
      console.error('Failed to get economy params, using default:', econErr);
      economyParams = { sigma: 1.0, burnRate: 0.25 };
    }

    // Calculate dynamic settlement
    const settlement = economyEngine.calcSettlement(task.budget, economyParams.sigma);
    const agentEarnings = settlement.agentEarning;
    const burnedAmount = settlement.burned;
    const burnRate = settlement.burnRate;

    // Process wallet settlement
    let walletSettlementResult = null;
    if (task.payment_status === 'frozen' && task.client_id) {
      try {
        // 1. Consume frozen balance from client
        const clientWallet = await walletService.getWallet(task.client_id, 'MP');
        if (clientWallet) {
          await walletService.consumeFrozenBalance(
            clientWallet.id,
            task.budget,
            'task_payment',
            `Payment for task ${id}`,
            { task_id: id, counterparty_id: task.agent_id, counterparty_type: 'agent' }
          );
        }

        // 2. Pay agent (1 - B)
        const agentWallet = await walletService.getOrCreateWallet(task.agent_id, 'agent', 'MP');
        const agentResult = await walletService.addBalance(
          agentWallet.id,
          agentEarnings,
          'task_earning',
          `Earnings from task ${id} (σ=${economyParams.sigma.toFixed(2)}, B=${(burnRate*100).toFixed(1)}%)`,
          { task_id: id, counterparty_id: task.client_id, counterparty_type: 'client' }
        );

        // 3. Burned amount is NOT transferred anywhere (it's destroyed)
        // No wallet transaction needed - burn is recorded in settlements table

        // 4. Judge reward (fixed 10 MP from platform account, if judge exists)
        let judgeRewardPaid = 0;
        if (task.judge_id) {
          try {
            const judgeWallet = await walletService.getOrCreateWallet(task.judge_id, 'agent', 'MP');
            const platformWallet = await walletService.getWalletById('wallet_platform_mp');

            // Only pay if platform has sufficient balance
            if (platformWallet && platformWallet.balance >= ECONOMY.JUDGE_REWARD) {
              await walletService.deductBalance(
                'wallet_platform_mp',
                ECONOMY.JUDGE_REWARD,
                'judge_reward',
                `Judge reward for task ${id}`,
                { task_id: id }
              );
              await walletService.addBalance(
                judgeWallet.id,
                ECONOMY.JUDGE_REWARD,
                'judge_reward',
                `Judge reward for reviewing task ${id}`,
                { task_id: id }
              );
              judgeRewardPaid = ECONOMY.JUDGE_REWARD;
            }
          } catch (judgeErr) {
            console.error('Failed to pay judge reward:', judgeErr);
          }
        }

        walletSettlementResult = {
          processed: true,
          agent_earning: agentEarnings,
          burned: burnedAmount,
          burn_rate: burnRate,
          judge_reward: judgeRewardPaid
        };

        // Record settlement in economy system
        await economyEngine.recordSettlement(
          id,
          task.budget,
          agentEarnings,
          burnedAmount,
          burnRate,
          economyParams.sigma,
          judgeRewardPaid
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
          burned: burnedAmount,
          burn_rate: burnRate,
          sigma: economyParams.sigma,
          wallet_settlement: walletSettlementResult ? true : false
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
                burned: burnedAmount,
                burn_rate: `${(burnRate * 100).toFixed(1)}%`,
                sigma: economyParams.sigma.toFixed(3)
              },
              credit_impact: {
                change: creditResult.change,
                new_balance: creditResult.newBalance
              },
              message: 'Task completed. Agent has been paid.',
              rate_url: `/api/hall/tasks/${id}/rate`
            };

            // 添加钱包结算详情
            if (walletSettlementResult) {
              response.wallet_settlement = walletSettlementResult;
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
                burned: burnedAmount,
                burn_rate: `${(burnRate * 100).toFixed(1)}%`,
                sigma: economyParams.sigma.toFixed(3)
              },
              message: 'Task completed. Agent has been paid.',
              rate_url: `/api/hall/tasks/${id}/rate`
            };

            if (walletSettlementResult) {
              response.wallet_settlement = walletSettlementResult;
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
router.post('/hall/tasks/:id/reject', authenticateClient, (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  req.db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status !== 'submitted') {
      return res.status(400).json({ error: `Cannot reject (current status: ${task.status})` });
    }

    // Verify caller is the task creator
    if (task.client_id && req.client.id !== task.client_id) {
      return res.status(403).json({ error: 'Only the task creator can perform this action' });
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
 * 评价 Agent - 5星评价奖励信用分 + MP奖励
 *
 * POST /api/hall/tasks/:id/rate
 * { "rating": 5, "comment": "非常满意" }
 *
 * 5星评价奖励:
 * - 信用分 +10
 * - MP +20 (从平台账户发放)
 */
router.post('/hall/tasks/:id/rate', authenticateClient, async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  req.db.get('SELECT * FROM tasks WHERE id = ?', [id], async (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status !== 'completed') {
      return res.status(400).json({ error: 'Can only rate completed tasks' });
    }
    if (task.client_rating) {
      return res.status(400).json({ error: 'Task already rated' });
    }

    // Verify caller is the task creator
    if (task.client_id && req.client.id !== task.client_id) {
      return res.status(403).json({ error: 'Only the task creator can perform this action' });
    }

    const creditSystem = new CreditSystem(req.db);
    const walletService = new WalletService(req.db);

    req.db.run(
      `UPDATE tasks SET client_rating = ?, client_comment = ? WHERE id = ?`,
      [rating, comment || '', id],
      async function(err) {
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

        // 5星评价奖励: 信用分 +10 和 MP 奖励
        if (rating === 5) {
          let creditResult = null;
          let a2cBonusGranted = false;

          // Credit bonus
          try {
            creditResult = await creditSystem.rewardFiveStarRating(task.agent_id, id);
          } catch (creditErr) {
            console.error('Failed to reward 5-star credit:', creditErr);
          }

          // MP bonus (from platform account)
          try {
            const platformWallet = await walletService.getWalletById('wallet_platform_mp');
            if (platformWallet && platformWallet.balance >= ECONOMY.FIVE_STAR_BONUS) {
              await walletService.deductBalance(
                'wallet_platform_mp',
                ECONOMY.FIVE_STAR_BONUS,
                'bonus',
                `5-star bonus payout for task ${id}`,
                { task_id: id }
              );

              const agentWallet = await walletService.getOrCreateWallet(task.agent_id, 'agent', 'MP');
              await walletService.addBalance(
                agentWallet.id,
                ECONOMY.FIVE_STAR_BONUS,
                'bonus',
                `5-star rating bonus for task ${id}`,
                { task_id: id, source: 'five_star_bonus' }
              );
              a2cBonusGranted = true;
            }
          } catch (bonusErr) {
            console.error('Failed to grant 5-star MP bonus:', bonusErr);
          }

          res.json({
            success: true,
            message: 'Thank you for your rating!',
            bonus: {
              credit: creditResult ? {
                awarded: true,
                change: creditResult.change,
                reason: '5星好评奖励'
              } : null,
              a2c: a2cBonusGranted ? {
                awarded: true,
                amount: ECONOMY.FIVE_STAR_BONUS,
                reason: '5星好评 MP 奖励'
              } : null
            }
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
router.post('/hall/tasks/:id/cancel', authenticateClient, async (req, res) => {
  const { id } = req.params;

  req.db.get('SELECT * FROM tasks WHERE id = ?', [id], async (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status !== 'open') {
      return res.status(400).json({ error: 'Can only cancel open tasks' });
    }

    // Verify caller is the task creator
    if (task.client_id && req.client.id !== task.client_id) {
      return res.status(403).json({ error: 'Only the task creator can perform this action' });
    }

    // 钱包处理：如果余额已冻结，需要解冻返还
    let refundResult = null;
    if (task.payment_status === 'frozen' && task.client_id) {
      try {
        const walletService = new WalletService(req.db);
        refundResult = await walletService.refundTask(task.client_id, id, task.budget, 'MP');
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

// ==================== 任务容器 (Task Container) ====================

/**
 * 获取任务容器信息
 *
 * GET /api/hall/container/:taskId
 *
 * 返回任务详情 + 消息历史 + 参与者 + 可用操作
 */
router.get('/hall/container/:taskId', optionalAuth, (req, res) => {
  const { taskId } = req.params;

  req.db.get(
    `SELECT t.*, a.name as agent_name, a.rating as agent_rating,
            c.name as client_name, c.email as client_email
     FROM tasks t
     LEFT JOIN agents a ON t.agent_id = a.id
     LEFT JOIN clients c ON t.client_id = c.id
     WHERE t.id = ?`,
    [taskId],
    (err, task) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!task) return res.status(404).json({ error: 'Task not found' });

      // 检查访问权限（客户或Agent都可以访问自己的容器）
      const isClient = req.client && (req.client.id === task.client_id);
      const isAgent = req.client && req.client.type === 'agent' && (req.client.id === task.agent_id);
      const isParticipant = isClient || isAgent;

      // 获取消息历史
      req.db.all(
        `SELECT id, sender_type, sender_id, content, message_type, created_at
         FROM task_messages
         WHERE task_id = ?
         ORDER BY created_at ASC`,
        [taskId],
        (err, messages) => {
          if (err) {
            console.error('[Container] Failed to get messages:', err);
            messages = [];
          }

          // 构建参与者列表
          const participants = [];
          if (task.client_id) {
            participants.push({
              type: 'client',
              id: task.client_id,
              name: task.client_name || 'Client',
              is_you: isClient
            });
          }
          if (task.agent_id) {
            participants.push({
              type: 'agent',
              id: task.agent_id,
              name: task.agent_name || 'Agent',
              rating: task.agent_rating,
              is_you: isAgent
            });
          }

          // 计算可用操作
          const actions = [];
          if (isParticipant) {
            actions.push('message');

            if (isClient) {
              if (task.status === 'submitted') {
                actions.push('accept', 'reject');
              }
              if (task.status === 'open') {
                actions.push('cancel');
              }
            }

            if (isAgent) {
              if (task.status === 'claimed' || task.status === 'rejected') {
                actions.push('submit');
              }
              if (task.status === 'rejected') {
                actions.push('resubmit');
              }
            }
          }

          // 计算协商状态
          let negotiation = null;
          if (task.negotiation_started_at) {
            const deadline = task.negotiation_deadline ? new Date(task.negotiation_deadline) : null;
            const remaining = deadline ? Math.max(0, deadline - Date.now()) : 0;
            negotiation = {
              started_at: task.negotiation_started_at,
              deadline: task.negotiation_deadline,
              remaining_hours: Math.ceil(remaining / (1000 * 60 * 60))
            };
          }

          res.json({
            container_id: taskId,
            task: {
              id: task.id,
              title: task.title,
              description: task.description,
              category: task.category,
              budget: task.budget,
              status: task.status,
              result: task.result,
              created_at: task.created_at,
              claimed_at: task.claimed_at,
              submitted_at: task.submitted_at,
              completed_at: task.completed_at,
              deadline: task.deadline,
              rejection_count: task.rejection_count || 0,
              reject_reason: task.reject_reason
            },
            participants,
            messages: (messages || []).map(m => ({
              id: m.id,
              sender_type: m.sender_type,
              sender_id: m.sender_id,
              content: m.content,
              type: m.message_type,
              time: m.created_at
            })),
            actions,
            negotiation,
            is_participant: isParticipant,
            your_role: isClient ? 'client' : (isAgent ? 'agent' : 'viewer')
          });
        }
      );
    }
  );
});

/**
 * 发送容器消息
 *
 * POST /api/hall/container/:taskId/message
 * Headers: X-Client-Key 或 X-Agent-Key
 * Body: { "content": "Hello..." }
 */
router.post('/hall/container/:taskId/message', authenticateClient, (req, res) => {
  const { taskId } = req.params;
  const { content } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  req.db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // 验证参与者身份
    const isClient = req.client.id === task.client_id;
    const isAgent = req.client.type === 'agent' && req.client.id === task.agent_id;

    if (!isClient && !isAgent) {
      return res.status(403).json({ error: 'You are not a participant in this task' });
    }

    const messageId = uuidv4();
    const senderType = isClient ? 'client' : 'agent';
    const senderId = req.client.id;

    req.db.run(
      `INSERT INTO task_messages (id, task_id, sender_type, sender_id, content, message_type, created_at)
       VALUES (?, ?, ?, ?, ?, 'text', NOW())`,
      [messageId, taskId, senderType, senderId, content.trim()],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({
          success: true,
          message_id: messageId,
          sender_type: senderType,
          content: content.trim(),
          time: new Date().toISOString()
        });
      }
    );
  });
});

/**
 * 执行容器操作
 *
 * POST /api/hall/container/:taskId/action
 * Headers: X-Client-Key 或 X-Agent-Key
 * Body: { "action": "accept|reject|resubmit", "comment": "..." }
 */
router.post('/hall/container/:taskId/action', authenticateClient, async (req, res) => {
  const { taskId } = req.params;
  const { action, comment, result: newResult } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'Action is required' });
  }

  const validActions = ['accept', 'reject', 'resubmit', 'cancel', 'final_reject'];
  if (!validActions.includes(action)) {
    return res.status(400).json({
      error: `Invalid action. Must be one of: ${validActions.join(', ')}`
    });
  }

  req.db.get('SELECT * FROM tasks WHERE id = ?', [taskId], async (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const isClient = req.client.id === task.client_id;
    const isAgent = req.client.type === 'agent' && req.client.id === task.agent_id;

    if (!isClient && !isAgent) {
      return res.status(403).json({ error: 'You are not a participant in this task' });
    }

    // 记录系统消息的辅助函数
    const addSystemMessage = (content) => {
      const msgId = uuidv4();
      req.db.run(
        `INSERT INTO task_messages (id, task_id, sender_type, sender_id, content, message_type, created_at)
         VALUES (?, ?, 'system', 'system', ?, 'system', NOW())`,
        [msgId, taskId, content]
      );
    };

    // 处理不同操作
    switch (action) {
      case 'accept':
        if (!isClient) {
          return res.status(403).json({ error: 'Only client can accept' });
        }
        if (task.status !== 'submitted') {
          return res.status(400).json({ error: `Cannot accept (current status: ${task.status})` });
        }

        // 重定向到 accept 端点
        addSystemMessage('Client accepted the result');
        req.url = `/hall/tasks/${taskId}/accept`;
        req.method = 'POST';
        return router.handle(req, res);

      case 'reject':
        if (!isClient) {
          return res.status(403).json({ error: 'Only client can reject' });
        }
        if (task.status !== 'submitted') {
          return res.status(400).json({ error: `Cannot reject (current status: ${task.status})` });
        }

        // 启动协商期（72小时）
        req.db.run(
          `UPDATE tasks SET
             status = 'rejected',
             reject_reason = ?,
             rejection_count = COALESCE(rejection_count, 0) + 1,
             negotiation_started_at = NOW(),
             negotiation_deadline = NOW() + INTERVAL '72 hours'
           WHERE id = ?`,
          [comment || '', taskId],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });

            addSystemMessage(`Client requested revision: "${comment || 'No specific reason provided'}". 72-hour negotiation window started.`);
            logTaskEvent(req.db, taskId, 'rejected_negotiation', req.client.id, 'client', {
              reason: comment,
              negotiation_hours: 72
            });

            res.json({
              success: true,
              task_id: taskId,
              status: 'rejected',
              negotiation: {
                started: true,
                deadline_hours: 72,
                message: 'Negotiation started. Agent can resubmit within 72 hours.'
              }
            });
          }
        );
        break;

      case 'resubmit':
        if (!isAgent) {
          return res.status(403).json({ error: 'Only agent can resubmit' });
        }
        if (task.status !== 'rejected') {
          return res.status(400).json({ error: `Cannot resubmit (current status: ${task.status})` });
        }
        if (!newResult) {
          return res.status(400).json({ error: 'New result is required for resubmit' });
        }

        // 检查协商截止时间
        if (task.negotiation_deadline) {
          const deadline = new Date(task.negotiation_deadline);
          if (deadline < new Date()) {
            return res.status(400).json({ error: 'Negotiation deadline has passed' });
          }
        }

        req.db.run(
          `UPDATE tasks SET status = 'submitted', result = ?, submitted_at = NOW() WHERE id = ?`,
          [newResult, taskId],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });

            addSystemMessage('Agent submitted a revised result');
            logTaskEvent(req.db, taskId, 'resubmitted', req.client.id, 'agent', {
              result_length: newResult.length
            });

            res.json({
              success: true,
              task_id: taskId,
              status: 'submitted',
              message: 'Revised result submitted. Awaiting client review.'
            });
          }
        );
        break;

      case 'final_reject':
        if (!isClient) {
          return res.status(403).json({ error: 'Only client can final reject' });
        }

        // 最终拒绝 - 退款
        const walletService = new WalletService(req.db);
        try {
          if (task.payment_status === 'frozen' && task.client_id) {
            await walletService.refundTask(task.client_id, taskId, task.budget, 'MP');
          }

          req.db.run(
            `UPDATE tasks SET status = 'cancelled', payment_status = 'refunded' WHERE id = ?`,
            [taskId],
            function(err) {
              if (err) return res.status(500).json({ error: err.message });

              addSystemMessage('Client final rejected. Task cancelled and refunded.');
              logTaskEvent(req.db, taskId, 'final_rejected', req.client.id, 'client', {
                reason: comment,
                refunded: true
              });

              // 处理信用分
              const creditSystem = new CreditSystem(req.db);
              creditSystem.handleRejection(task.agent_id, taskId, task.rejection_count || 1)
                .then(() => {
                  res.json({
                    success: true,
                    task_id: taskId,
                    status: 'cancelled',
                    refunded: true,
                    message: 'Task cancelled. Payment refunded.'
                  });
                })
                .catch(err => {
                  console.error('Credit update failed:', err);
                  res.json({
                    success: true,
                    task_id: taskId,
                    status: 'cancelled',
                    refunded: true,
                    message: 'Task cancelled. Payment refunded.'
                  });
                });
            }
          );
        } catch (walletErr) {
          return res.status(500).json({ error: walletErr.message });
        }
        break;

      case 'cancel':
        if (!isClient) {
          return res.status(403).json({ error: 'Only client can cancel' });
        }
        if (task.status !== 'open') {
          return res.status(400).json({ error: 'Can only cancel open tasks' });
        }

        // 重定向到 cancel 端点
        addSystemMessage('Client cancelled the task');
        req.url = `/hall/tasks/${taskId}/cancel`;
        req.method = 'POST';
        return router.handle(req, res);

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  });
});

// ==================== 首页动态展示 API ====================

/**
 * 获取精选 Agent（带热度）
 *
 * GET /api/agents/featured
 * Query: limit (default 10)
 *
 * 返回活跃的 Agent 列表，按热度排序
 */
router.get('/agents/featured', (req, res) => {
  const { limit = 10 } = req.query;

  // 热度计算：最近7天完成的任务数 + 评分加权
  const sql = `
    SELECT a.id, a.name, a.skills, a.rating, a.total_tasks, a.total_earnings,
           a.status, a.owner_id, a.owner_type,
           (
             SELECT COUNT(*) FROM tasks t
             WHERE t.agent_id = a.id
             AND t.status = 'completed'
             AND t.completed_at > NOW() - INTERVAL '7 days'
           ) as recent_tasks,
           COALESCE(
             (SELECT AVG(client_rating) FROM tasks
              WHERE agent_id = a.id AND client_rating IS NOT NULL
              AND completed_at > NOW() - INTERVAL '30 days'
             ), a.rating
           ) as recent_rating
    FROM agents a
    WHERE a.status = 'active'
    ORDER BY
      (recent_tasks * 10 + a.rating * 5 + a.total_tasks * 0.5) DESC,
      a.created_at DESC
    LIMIT ?
  `;

  req.db.all(sql, [parseInt(limit)], (err, agents) => {
    if (err) return res.status(500).json({ error: err.message });

    const featured = agents.map(a => {
      // 计算热度级别 (0-3)
      let heatLevel = 0;
      if (a.recent_tasks > 0) heatLevel = 1;
      if (a.recent_tasks >= 3) heatLevel = 2;
      if (a.recent_tasks >= 5 && a.recent_rating >= 4.5) heatLevel = 3;

      return {
        id: a.id,
        name: a.name,
        skills: JSON.parse(a.skills || '[]'),
        rating: a.rating,
        total_tasks: a.total_tasks,
        recent_tasks: a.recent_tasks,
        heat_level: heatLevel,  // 0=cold, 1=warm, 2=hot, 3=fire
        owner: a.owner_id ? { id: a.owner_id, type: a.owner_type } : null
      };
    });

    res.json({
      agents: featured,
      total: featured.length
    });
  });
});

/**
 * 获取最近活动流
 *
 * GET /api/activity/recent
 * Query: limit (default 20)
 *
 * 返回最近的平台活动（任务完成、评价、新Agent等）
 */
router.get('/activity/recent', (req, res) => {
  const { limit = 20 } = req.query;

  // 获取多种活动并合并
  const activities = [];

  // 1. 最近完成的任务
  const tasksQuery = new Promise((resolve, reject) => {
    req.db.all(
      `SELECT t.id, t.title, t.budget, t.completed_at, t.client_rating,
              a.id as agent_id, a.name as agent_name
       FROM tasks t
       JOIN agents a ON t.agent_id = a.id
       WHERE t.status = 'completed'
       ORDER BY t.completed_at DESC
       LIMIT ?`,
      [parseInt(limit)],
      (err, tasks) => {
        if (err) return reject(err);
        resolve(tasks.map(t => ({
          type: 'task_completed',
          time: t.completed_at,
          data: {
            task_id: t.id,
            task_title: t.title,
            budget: t.budget,
            agent_id: t.agent_id,
            agent_name: t.agent_name,
            rating: t.client_rating
          }
        })));
      }
    );
  });

  // 2. 最近的5星评价
  const ratingsQuery = new Promise((resolve, reject) => {
    req.db.all(
      `SELECT t.id, t.title, t.client_rating, t.client_comment, t.completed_at,
              a.id as agent_id, a.name as agent_name
       FROM tasks t
       JOIN agents a ON t.agent_id = a.id
       WHERE t.client_rating = 5
       ORDER BY t.completed_at DESC
       LIMIT ?`,
      [parseInt(limit / 2)],
      (err, ratings) => {
        if (err) return reject(err);
        resolve(ratings.map(r => ({
          type: 'five_star_rating',
          time: r.completed_at,
          data: {
            task_id: r.id,
            agent_id: r.agent_id,
            agent_name: r.agent_name,
            comment: r.client_comment
          }
        })));
      }
    );
  });

  // 3. 最近注册的 Agent
  const agentsQuery = new Promise((resolve, reject) => {
    req.db.all(
      `SELECT id, name, skills, created_at
       FROM agents
       WHERE status = 'active'
       ORDER BY created_at DESC
       LIMIT ?`,
      [parseInt(limit / 2)],
      (err, agents) => {
        if (err) return reject(err);
        resolve(agents.map(a => ({
          type: 'new_agent',
          time: a.created_at,
          data: {
            agent_id: a.id,
            agent_name: a.name,
            skills: JSON.parse(a.skills || '[]')
          }
        })));
      }
    );
  });

  Promise.all([tasksQuery, ratingsQuery, agentsQuery])
    .then(([tasks, ratings, agents]) => {
      // 合并并按时间排序
      const allActivities = [...tasks, ...ratings, ...agents]
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, parseInt(limit));

      res.json({
        activities: allActivities,
        total: allActivities.length
      });
    })
    .catch(err => {
      console.error('[Activity] Error:', err);
      res.status(500).json({ error: err.message });
    });
});

// ==================== Admin 端点 ====================

/**
 * 清理测试残留任务
 *
 * POST /api/admin/cleanup-test-tasks
 * Headers: X-Admin-Key
 * Body (optional): { "dry_run": true }
 *
 * 查找所有 title 包含 [TEST] 且 status=open 的任务，
 * 执行退款（如有冻结）并取消。
 */
router.post('/admin/cleanup-test-tasks', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  const validAdminKey = process.env.ADMIN_KEY;

  if (!validAdminKey || adminKey !== validAdminKey) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const dryRun = req.body && req.body.dry_run === true;

  try {
    // Find all open tasks with [TEST] in title
    const tasks = await new Promise((resolve, reject) => {
      req.db.all(
        `SELECT id, title, budget, payment_status, client_id, client_type FROM tasks WHERE title LIKE '%[TEST]%' AND status = 'open'`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });

    if (dryRun) {
      return res.json({
        success: true,
        dry_run: true,
        would_clean: tasks.length,
        tasks: tasks.map(t => ({ id: t.id, title: t.title, budget: t.budget, payment_status: t.payment_status }))
      });
    }

    const results = [];
    for (const task of tasks) {
      let refunded = false;

      // Refund frozen payment if applicable
      if (task.payment_status === 'frozen' && task.client_id) {
        try {
          const walletService = new WalletService(req.db);
          await walletService.refundTask(task.client_id, task.id, task.budget, 'MP');
          refunded = true;
        } catch (walletErr) {
          console.error(`[Admin Cleanup] Refund failed for task ${task.id}:`, walletErr.message);
        }
      }

      // Cancel the task
      await new Promise((resolve, reject) => {
        req.db.run(
          `UPDATE tasks SET status = 'cancelled', payment_status = 'refunded' WHERE id = ?`,
          [task.id],
          function(err) {
            if (err) return reject(err);
            resolve();
          }
        );
      });

      logTaskEvent(req.db, task.id, 'cancelled', 'admin', 'admin', {
        reason: 'Admin cleanup of test tasks',
        refunded
      });

      results.push({ id: task.id, title: task.title, budget: task.budget, refunded });
    }

    res.json({
      success: true,
      cleaned: results.length,
      tasks: results
    });
  } catch (err) {
    console.error('[Admin Cleanup] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== 兼容旧接口 ====================

router.get('/hall/status/:id', (req, res) => {
  // 重定向到 track
  res.redirect(`/api/hall/track/${req.params.id}`);
});

module.exports = router;
