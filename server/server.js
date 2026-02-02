const express = require('express');
const cors = require('cors');
const DatabaseWrapper = require('./db');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
require('dotenv').config();

const AgentOrchestrator = require('./AgentOrchestrator');
const hallRoutes = require('./routes/hall');  // 新架构：任务大厅
const developerRoutes = require('./routes/developers');
const agentDeveloperRoutes = require('./routes/agentDeveloper');
const agentAccessRoutes = require('./routes/agentAccess');
const agentContributorRoutes = require('./routes/agentContributor');
const mcpRoutes = require('./routes/mcp');

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
db.serialize(() => {
  const schemaSQL = fs.readFileSync(path.join(__dirname, 'database_schema.sql'), 'utf8');
  db.exec(schemaSQL, (err) => {
    if (err) {
      console.error('数据库初始化失败:', err);
    } else {
      console.log('✅ 数据库已初始化（Agent淘宝版）');
    }
  });
});

// ============ API路由 ============

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '2.0.0-agent-taobao',
    features: ['multi-agent', 'skill-store', 'dynamic-pricing'],
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

// 获取统计数据
app.get('/api/stats', (req, res) => {
  db.get(`SELECT 
    COUNT(*) as total_tasks,
    SUM(price) as total_revenue,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks
    FROM tasks`, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    res.json({
      total: row.total_tasks || 0,
      revenue: row.total_revenue || 0,
      completed: row.completed_tasks || 0
    });
  });
});

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
    version: '2.0.0',
    capabilities: ['skill_discovery', 'task_execution', 'skill_development', 'skill_contribution', 'task_claiming', 'payment_processing', 'analytics'],
    endpoints: {
      skills: '/api/agent/skills',
      execute: '/api/agent/execute',
      create_task: '/api/agent/tasks',
      contribute_skill: '/api/agent-contributor/skills/submit',
      claim_task: '/api/agent-contributor/available-tasks',
      earnings: '/api/agent-contributor/earnings',
      webhooks: '/api/agent/webhooks',
      mcp: '/api/mcp'
    },
    protocols: ['http', 'mcp', 'webhook'],
    authentication: { type: 'api_key', header: 'X-Agent-Key', docs: '/docs/agent-auth' },
    earning_model: {
      skill_contribution: '70% revenue share to human owner',
      task_completion: '70% of task fee'
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

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 Agent淘宝平台已启动！`);
  console.log(`   版本: 2.0.0 (Multi-Agent)`);
  console.log(`   API地址: http://localhost:${PORT}/api`);
  console.log(`\n📊 核心功能:`);
  console.log(`   ✓ Multi-Agent协作 (调度/执行/审核)`);
  console.log(`   ✓ 技能商店 (开发者生态)`);
  console.log(`   ✓ 动态定价 (AI报价)`);
  console.log(`   ✓ 自动结算 (三方分成)`);
  console.log(`\n🔗 访问地址:`);
  console.log(`   前端: http://localhost:3000`);
  console.log(`   API文档: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
