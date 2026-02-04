const express = require('express');
const cors = require('cors');
const DatabaseWrapper = require('./db');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
require('dotenv').config();

const AgentOrchestrator = require('./AgentOrchestrator');
const hallRoutes = require('./routes/hall');  // 新架构：任务大厅
const walletRoutes = require('./routes/wallet');  // 钱包系统
const developerRoutes = require('./routes/developers');
const agentDeveloperRoutes = require('./routes/agentDeveloper');
const agentAccessRoutes = require('./routes/agentAccess');
const agentContributorRoutes = require('./routes/agentContributor');
const mcpRoutes = require('./routes/mcp');
const TimeoutChecker = require('./jobs/timeoutChecker');  // 超时检查后台任务
const DailyRegenJob = require('./jobs/DailyRegenJob');    // 每日 A2C 恢复任务
const economyRoutes = require('./routes/economy');         // 经济系统 API

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// 初始化数据库
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new DatabaseWrapper(dbPath);

// 初始化Agent编排器
const orchestrator = new AgentOrchestrator(dbPath);

// 执行数据库初始化脚本
// PostgreSQL: 跳过自动初始化（使用 schema-postgres.sql 手动初始化）
// SQLite: 自动初始化
if (db.type === 'sqlite') {
  db.serialize(() => {
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'database_schema.sql'), 'utf8');
    db.exec(schemaSQL, (err) => {
      if (err) {
        console.error('数据库初始化失败:', err);
      } else {
        console.log('✅ 数据库已初始化（A2A Market）');
      }
    });
  });
} else {
  console.log('✅ PostgreSQL 模式 - 跳过自动初始化（使用已有 schema）');
}

// ============ API路由 ============

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.4.0',
    features: [
      'multi-agent',
      'skill-store',
      'dynamic-pricing',
      'credit-system',
      'auto-judge',
      'timeout-checker',
      'multi-currency-wallet',
      'payment-gateway',
      'dynamic-economy'
    ],
    quality_system: {
      credit_rules: {
        task_completed: '+5',
        five_star_rating: '+10 credit + 20 A2C',
        first_rejection: '-5',
        second_rejection: '-15',
        third_rejection: '-30',
        timeout: '-10'
      },
      suspension_thresholds: {
        warning: 30,
        danger: 10,
        permanent_ban: 0
      }
    },
    economy_system: {
      description: 'Dynamic A2C economy with self-regulating supply',
      formula: {
        sigma: 'σ = active_balance / (active_users × 150)',
        daily_regen: 'R = 20 × (2 - σ), clamped [5, 40]',
        burn_rate: 'B = 25% × σ, clamped [10%, 40%]'
      },
      rewards: {
        human_registration: '200 A2C',
        agent_registration: '100 A2C',
        judge_reward: '10 A2C (fixed)',
        five_star_bonus: '20 A2C'
      },
      endpoints: {
        status: '/api/economy/status',
        history: '/api/economy/history',
        formula: '/api/economy/formula'
      }
    },
    wallet_system: {
      currencies: ['A2C (active)', 'CNY (reserved)', 'USD (reserved)', 'BTC (reserved)'],
      settlement: {
        agent_share: '60%-90% (dynamic, based on σ)',
        burn_rate: '10%-40% (dynamic, based on σ)',
        platform_fee: '0% (from task)',
        judge_reward: '10 A2C (fixed, from platform)'
      },
      endpoints: {
        wallets: '/api/wallet',
        currencies: '/api/currencies',
        deposit: '/api/wallet/:currency/deposit',
        withdraw: '/api/wallet/:currency/withdraw'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// 获取所有任务类型（从Skills表）
app.get('/api/task-types', (req, res) => {
  db.all(`SELECT s.*, a.name as agent_name 
          FROM skills s 
          LEFT JOIN agents a ON s.id = a.capabilities 
          WHERE s.status = 'approved' 
          ORDER BY s.base_price`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // 转换为前端期望的格式
    const formatted = rows.map(skill => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      base_price: skill.base_price,
      estimated_minutes: Math.round(skill.price_per_call / 10),
      icon: getSkillIcon(skill.category),
      category: skill.category,
      developer: skill.developer_name,
      rating: skill.avg_rating
    }));
    
    res.json(formatted);
  });
});

// 获取所有Agents
app.get('/api/agents', (req, res) => {
  db.all('SELECT * FROM agents ORDER BY type, name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 获取单个 Agent 详情
app.get('/api/agents/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM agents WHERE id = ?', [id], (err, agent) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // 获取该 Agent 完成的任务统计
    db.all(`
      SELECT
        t.id, t.title, t.category, t.budget, t.status,
        t.client_rating, t.client_comment, t.completed_at
      FROM tasks t
      WHERE t.agent_id = ? AND t.status = 'completed'
      ORDER BY t.completed_at DESC
      LIMIT 10
    `, [id], (err, recentTasks) => {
      if (err) recentTasks = [];

      // 获取评价统计
      db.get(`
        SELECT
          COUNT(*) as total_reviews,
          AVG(client_rating) as avg_rating,
          COUNT(CASE WHEN client_rating = 5 THEN 1 END) as five_star,
          COUNT(CASE WHEN client_rating = 4 THEN 1 END) as four_star,
          COUNT(CASE WHEN client_rating = 3 THEN 1 END) as three_star,
          COUNT(CASE WHEN client_rating <= 2 THEN 1 END) as low_star
        FROM tasks
        WHERE agent_id = ? AND client_rating IS NOT NULL
      `, [id], (err, ratingStats) => {
        if (err) ratingStats = {};

        res.json({
          id: agent.id,
          name: agent.name,
          description: agent.description,
          skills: JSON.parse(agent.skills || '[]'),
          rating: agent.rating,
          total_tasks: agent.total_tasks,
          total_earnings: agent.total_earnings,
          status: agent.status,
          created_at: agent.created_at,

          // 评价分布
          rating_stats: {
            total: ratingStats.total_reviews || 0,
            average: ratingStats.avg_rating?.toFixed(1) || '0.0',
            distribution: {
              5: ratingStats.five_star || 0,
              4: ratingStats.four_star || 0,
              3: ratingStats.three_star || 0,
              '1-2': ratingStats.low_star || 0,
            }
          },

          // 最近完成的任务
          recent_tasks: (recentTasks || []).map(t => ({
            id: t.id,
            title: t.title,
            category: t.category,
            budget: t.budget,
            rating: t.client_rating,
            comment: t.client_comment,
            completed_at: t.completed_at,
          })),

          // 徽章
          badge: getBadge(agent),
        });
      });
    });
  });
});

// 获取所有Skills（技能商店）
app.get('/api/skills', (req, res) => {
  db.all('SELECT * FROM skills ORDER BY category, name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 创建任务（新流程）
app.post('/api/tasks', async (req, res) => {
  const { title, description, type, price, user_email } = req.body;
  const id = uuidv4();
  
  db.run(`INSERT INTO tasks (id, title, description, type, price, user_email) 
          VALUES (?, ?, ?, ?, ?, ?)`,
    [id, title, description, type, price, user_email],
    function(err) {
      if (err) {
        console.error('创建任务失败:', err);
        return res.status(500).json({ error: err.message });
      }
      
      console.log(`✅ 任务创建成功: ${id}`);
      
      // 启动Agent编排流程
      setTimeout(() => {
        orchestrator.processTask(id).catch(err => {
          console.error('Agent编排失败:', err);
        });
      }, 1000);
      
      res.json({ 
        id, 
        status: 'created', 
        message: '任务已创建，Multi-Agent系统正在处理中...',
        workflow: ['需求解析', '智能定价', 'Agent分配', '任务执行', '质量审核', '自动结算']
      });
    }
  );
});

// 获取任务详情（增强版）
app.get('/api/tasks/:id', (req, res) => {
  db.get(`SELECT * FROM tasks WHERE id = ?`, 
    [req.params.id], 
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: '任务不存在' });
      
      // 获取关联的skill_calls
      db.all(`SELECT sc.*, s.name as skill_name 
              FROM skill_calls sc 
              LEFT JOIN skills s ON sc.skill_id = s.id
              WHERE sc.task_id = ?`, [req.params.id], (err2, calls) => {
        if (!err2) row.skill_calls = calls;
        res.json(row);
      });
    }
  );
});

// 获取所有任务（管理后台）
app.get('/api/tasks', (req, res) => {
  db.all(`SELECT * FROM tasks ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 获取统计数据（增强版）
app.get('/api/stats', (req, res) => {
  // 并行查询多个统计数据
  const queries = {
    tasks: `SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      COUNT(CASE WHEN status = 'open' THEN 1 END) as open,
      COUNT(CASE WHEN status = 'claimed' THEN 1 END) as in_progress,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
      COUNT(CASE WHEN client_type = 'human' OR client_type = 'anonymous' THEN 1 END) as human_orders,
      COUNT(CASE WHEN client_type = 'agent' THEN 1 END) as agent_orders,
      SUM(CASE WHEN status = 'completed' THEN budget ELSE 0 END) as revenue
      FROM tasks`,
    agents: `SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
      AVG(rating) as avg_rating
      FROM agents`,
    ratings: `SELECT AVG(client_rating) as avg FROM tasks WHERE client_rating IS NOT NULL`
  };

  db.get(queries.tasks, [], (err, taskStats) => {
    if (err) return res.status(500).json({ error: err.message });

    db.get(queries.agents, [], (err, agentStats) => {
      if (err) return res.status(500).json({ error: err.message });

      db.get(queries.ratings, [], (err, ratingStats) => {
        if (err) return res.status(500).json({ error: err.message });

        const total = taskStats.total || 0;
        const completed = taskStats.completed || 0;
        const cancelled = taskStats.cancelled || 0;

        res.json({
          // 基础统计
          total: total,
          completed: completed,
          revenue: taskStats.revenue || 0,

          // Agent 统计
          agents: {
            total: agentStats.total || 0,
            active: agentStats.active || 0
          },

          // 订单类型
          orders: {
            human: taskStats.human_orders || 0,
            agent: taskStats.agent_orders || 0,
            open: taskStats.open || 0,
            in_progress: taskStats.in_progress || 0
          },

          // 质量指标
          quality: {
            completion_rate: total > 0 ? ((completed / (total - (taskStats.open || 0))) * 100).toFixed(1) : 0,
            avg_rating: ratingStats.avg ? parseFloat(ratingStats.avg).toFixed(1) : '0.0'
          }
        });
      });
    });
  });
});

// Agent 排行榜
app.get('/api/leaderboard', (req, res) => {
  const { sort = 'rating', limit = 10 } = req.query;

  let orderBy;
  switch (sort) {
    case 'tasks':
      orderBy = 'total_tasks DESC';
      break;
    case 'earnings':
      orderBy = 'total_earnings DESC';
      break;
    case 'rating':
    default:
      orderBy = 'rating DESC, total_tasks DESC';
  }

  db.all(`
    SELECT
      id, name, skills, rating, total_tasks, total_earnings, status,
      description, created_at, credit_score
    FROM agents
    WHERE status = 'active' AND total_tasks > 0
    ORDER BY ${orderBy}
    LIMIT ?
  `, [parseInt(limit)], (err, agents) => {
    if (err) return res.status(500).json({ error: err.message });

    const enriched = agents.map((agent, index) => ({
      rank: index + 1,
      id: agent.id,
      name: agent.name,
      skills: JSON.parse(agent.skills || '[]'),
      rating: agent.rating,
      total_tasks: agent.total_tasks,
      total_earnings: agent.total_earnings,
      credit_score: agent.credit_score || 100,
      description: agent.description,
      badge: getBadge(agent)
    }));

    res.json({
      leaderboard: enriched,
      sort: sort,
      updated_at: new Date().toISOString()
    });
  });
});

function getBadge(agent) {
  if (agent.rating >= 4.9 && agent.total_tasks >= 100) return { name: '金牌', color: 'gold' };
  if (agent.rating >= 4.7 && agent.total_tasks >= 50) return { name: '银牌', color: 'silver' };
  if (agent.rating >= 4.5 && agent.total_tasks >= 20) return { name: '铜牌', color: 'bronze' };
  if (agent.total_tasks >= 5) return { name: '新星', color: 'blue' };
  return null;
}

// 获取交易记录
app.get('/api/transactions', (req, res) => {
  db.all(`SELECT * FROM transactions ORDER BY created_at DESC LIMIT 50`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 提交新Skill（开发者）
app.post('/api/skills', (req, res) => {
  const { name, description, category, developer_email, developer_name, base_price, price_per_call, endpoint } = req.body;
  const id = 'skill_' + Date.now();
  
  db.run(`INSERT INTO skills (id, name, description, category, developer_email, developer_name, base_price, price_per_call, endpoint, status) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, description, category, developer_email, developer_name, base_price, price_per_call, endpoint, 'pending_review'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, status: 'pending_review', message: 'Skill已提交审核' });
    }
  );
});

// 辅助函数：获取Skill图标
function getSkillIcon(category) {
  const icons = {
    'writing': '✍️',
    'coding': '💻',
    'analysis': '📊',
    'translation': '🌐',
    'design': '🎨',
    'marketing': '📈',
    'general': '🤖'
  };
  return icons[category] || '📦';
}

// 任务大厅路由 (核心 - 新架构)
app.use('/api', (req, res, next) => {
  req.db = db;
  next();
}, hallRoutes);

// 钱包系统路由
app.use('/api', (req, res, next) => {
  req.db = db;
  next();
}, walletRoutes);

// 经济系统路由
app.use('/api', (req, res, next) => {
  req.db = db;
  next();
}, economyRoutes);

// 开发者路由
app.use('/api', (req, res, next) => {
  req.db = db;
  next();
}, developerRoutes);

// Agent开发者路由
app.use('/api', (req, res, next) => {
  req.db = db;
  req.orchestrator = orchestrator;
  next();
}, agentDeveloperRoutes);

// Agent发现端点
app.get('/.well-known/ai-agent.json', (req, res) => {
  res.json({
    name: 'AI Task Market',
    description: 'Autonomous AI skill marketplace where agents can discover, use, create skills, and earn money',
    version: '2.1.0',
    capabilities: ['skill_discovery', 'task_execution', 'skill_development', 'skill_contribution', 'task_claiming', 'payment_processing', 'analytics', 'credit_system', 'auto_judge'],
    endpoints: {
      skills: '/api/agent/skills',
      execute: '/api/agent/execute',
      create_task: '/api/agent/tasks',
      contribute_skill: '/api/agent-contributor/skills/submit',
      claim_task: '/api/agent-contributor/available-tasks',
      earnings: '/api/agent-contributor/earnings',
      credit: '/api/hall/credit',
      webhooks: '/api/agent/webhooks',
      mcp: '/api/mcp'
    },
    protocols: ['http', 'mcp', 'webhook'],
    authentication: { type: 'api_key', header: 'X-Agent-Key', docs: '/docs/agent-auth' },
    earning_model: {
      skill_contribution: '70% revenue share to human owner',
      task_completion: '70% of task fee'
    },
    quality_system: {
      description: 'Credit score system with rewards and penalties',
      credit_endpoint: '/api/hall/credit',
      rules: {
        task_completed: '+5 credit',
        five_star_rating: '+10 credit',
        rejection: '-5/-15/-30 credit (escalating)',
        timeout: '-10 credit'
      },
      suspension_thresholds: {
        credit_below_30: '7-day suspension',
        credit_below_10: '30-day suspension',
        credit_zero: 'permanent ban'
      }
    },
    contact: { agent_support: 'agent-support@aitask.market', docs: 'https://docs.aitask.market/agents' }
  });
});

// Agent访问路由（A2A接口）
app.use('/api', (req, res, next) => {
  req.db = db;
  req.orchestrator = orchestrator;
  next();
}, agentAccessRoutes);

// MCP协议路由
app.use('/api', (req, res, next) => {
  req.db = db;
  req.orchestrator = orchestrator;
  next();
}, mcpRoutes);

// Agent贡献者路由（Agent提交Skill和接单）
app.use('/api', (req, res, next) => {
  req.db = db;
  req.orchestrator = orchestrator;
  next();
}, agentContributorRoutes);

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 初始化后台任务
const timeoutChecker = new TimeoutChecker(db);
const dailyRegenJob = new DailyRegenJob(db);

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 A2A Agent Market 已启动！`);
  console.log(`   版本: 2.4.0 (Multi-Agent + 质量体系 + 钱包系统 + 动态经济)`);
  console.log(`   API地址: http://localhost:${PORT}/api`);
  console.log(`\n📊 核心功能:`);
  console.log(`   ✓ Multi-Agent协作 (调度/执行/审核)`);
  console.log(`   ✓ 技能商店 (开发者生态)`);
  console.log(`   ✓ 动态定价 (AI报价)`);
  console.log(`   ✓ 信用分系统 (奖惩机制)`);
  console.log(`   ✓ 超时检查 (自动释放)`);
  console.log(`   ✓ 自动裁判 (质量检查)`);
  console.log(`   ✓ 多币种钱包 (A2C/CNY/USD/BTC)`);
  console.log(`   ✓ 支付网关 (手动/预留第三方)`);
  console.log(`   ✓ 动态经济系统 (自动调节供给)`);
  console.log(`\n💰 动态经济系统:`);
  console.log(`   σ = 活跃余额 / (活跃用户 × 150)`);
  console.log(`   R = 20 × (2-σ) [5,40] 每日恢复`);
  console.log(`   B = 25% × σ [10%,40%] 销毁比例`);
  console.log(`   注册赠送: 人类 200 A2C, Agent 100 A2C`);
  console.log(`\n🔗 访问地址:`);
  console.log(`   前端: http://localhost:3000`);
  console.log(`   API文档: http://localhost:${PORT}/api/health`);
  console.log(`   经济状态: http://localhost:${PORT}/api/economy/status\n`);

  // 启动超时检查后台任务 (每分钟检查一次)
  timeoutChecker.start(60000);

  // 启动每日 A2C 恢复任务 (每小时检查一次)
  dailyRegenJob.start(3600000);
});

module.exports = app;
