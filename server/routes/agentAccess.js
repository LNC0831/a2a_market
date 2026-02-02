// Agent访问层 - 让其他Agent能够自动发现和调用我们的服务
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// 注意：/.well-known/ai-agent.json 在server.js中单独处理

// ==================== 1. Skill发现接口 ====================

// 获取所有可用技能（Agent友好格式）
router.get('/agent/skills', (req, res) => {
  const { category, min_rating, max_price, search } = req.query;
  
  let sql = `SELECT 
    s.id, s.name, s.description, s.category, 
    s.price_per_call as price, s.avg_rating as rating,
    s.total_calls, s.developer_name, s.parameters_schema
  FROM skills s 
  WHERE s.status = 'approved'`;
  
  const params = [];
  
  if (category) {
    sql += ' AND s.category = ?';
    params.push(category);
  }
  if (min_rating) {
    sql += ' AND s.avg_rating >= ?';
    params.push(min_rating);
  }
  if (max_price) {
    sql += ' AND s.price_per_call <= ?';
    params.push(max_price);
  }
  if (search) {
    sql += ' AND (s.name LIKE ? OR s.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  sql += ' ORDER BY s.avg_rating DESC, s.total_calls DESC';
  
  req.db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const formatted = rows.map(skill => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      pricing: { per_call: skill.price, currency: 'USD' },
      quality: { rating: skill.rating, total_uses: skill.total_calls },
      input_schema: skill.parameters_schema ? JSON.parse(skill.parameters_schema) : null,
      endpoint: { method: 'POST', url: `/api/agent/execute/${skill.id}` },
      developer: skill.developer_name
    }));
    
    res.json({ skills: formatted, total: formatted.length });
  });
});

// ==================== 2. Agent执行接口 ====================

// Agent注册
router.post('/agent/register', (req, res) => {
  const { name, description, contact_email, capabilities } = req.body;
  const agentId = uuidv4();
  const apiKey = 'agent_' + require('crypto').randomBytes(32).toString('hex');
  
  req.db.run(
    `INSERT INTO agents (id, name, description, email, api_key, capabilities, type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [agentId, name, description, contact_email, apiKey, JSON.stringify(capabilities), 'external', 'active'],
    function(err) {
      if (err) {
        return res.status(400).json({ error: err.message.includes('UNIQUE') ? 'Email already exists' : err.message });
      }
      
      res.json({
        agent_id: agentId,
        api_key: apiKey,
        warning: 'Store this API key safely. It will not be shown again.'
      });
    }
  );
});

// Agent执行任务
router.post('/agent/execute/:skillId', async (req, res) => {
  const { skillId } = req.params;
  const { input, callback_url } = req.body;
  const agentKey = req.headers['x-agent-key'];

  if (!agentKey) {
    return res.status(401).json({ error: 'Authentication required. Provide X-Agent-Key header.' });
  }

  // 验证Agent
  const agent = await new Promise((resolve) => {
    req.db.get('SELECT * FROM agents WHERE api_key = ?', [agentKey], (err, row) => resolve(row));
  });

  if (!agent) {
    return res.status(403).json({ error: 'Invalid agent key' });
  }

  // 构建任务描述
  const description = input ? JSON.stringify(input) : `Execute skill: ${skillId}`;
  const taskId = uuidv4();

  req.db.run(
    `INSERT INTO tasks (id, title, description, type, price, user_email, status, created_by_agent, agent_id, callback_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [taskId, `Agent: ${skillId}`, description, skillId, 0, agent.email, 'pending', 1, agent.id, callback_url],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      res.json({
        task_id: taskId,
        status: 'accepted',
        check_status_at: `/api/agent/tasks/${taskId}`
      });
      
      req.orchestrator.processTask(taskId).catch(console.error);
    }
  );
});

// 查询任务状态
router.get('/agent/tasks/:id', (req, res) => {
  req.db.get(
    `SELECT t.*, s.name as skill_name
     FROM tasks t
     LEFT JOIN skills s ON t.type = s.id
     WHERE t.id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Task not found' });
      
      res.json({
        task_id: row.id,
        skill: { id: row.type, name: row.skill_name },
        status: row.status,
        result: row.status === 'completed' ? { output: row.result, success: true } : null,
        created_at: row.created_at,
        completed_at: row.completed_at
      });
    }
  );
});

// ==================== 3. Agent统计 ====================

router.get('/agent/stats', (req, res) => {
  const agentKey = req.headers['x-agent-key'];
  
  req.db.get(
    `SELECT COUNT(*) as total, 
     SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success
     FROM tasks 
     WHERE agent_id = (SELECT id FROM agents WHERE api_key = ?)`,
    [agentKey],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ tasks: { total: row.total, successful: row.success } });
    }
  );
});

module.exports = router;
