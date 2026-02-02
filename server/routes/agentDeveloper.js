const express = require('express');
const AgentDeveloper = require('../AgentDeveloper');
const router = express.Router();

// 启动Agent自主开发
router.post('/admin/agent-developer/run', async (req, res) => {
  try {
    const agentDev = new AgentDeveloper(req.db, req.orchestrator);
    
    // 异步运行，不阻塞响应
    agentDev.runAutonomousDevelopment().catch(console.error);
    
    res.json({
      message: 'Agent developer started autonomously',
      status: 'running',
      note: 'Check logs for progress'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取Agent开发的Skill列表
router.get('/agent-developed-skills', (req, res) => {
  req.db.all(
    `SELECT s.*, 
     SUM(sa.calls_count) as total_calls,
     AVG(sa.avg_rating) as avg_rating
     FROM skills s
     LEFT JOIN skill_analytics sa ON sa.skill_id = s.id
     WHERE s.created_by_agent = 1
     GROUP BY s.id
     ORDER BY s.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// 获取市场机会分析（Agent视角）
router.get('/market-opportunities', async (req, res) => {
  try {
    const agentDev = new AgentDeveloper(req.db, req.orchestrator);
    const opportunities = await agentDev.analyzeMarketOpportunities();
    
    res.json({
      opportunities: opportunities,
      generated_at: new Date().toISOString(),
      by_agent: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 生成单个Skill（手动触发）
router.post('/agent-developer/generate-skill', async (req, res) => {
  const { opportunity } = req.body;
  
  try {
    const agentDev = new AgentDeveloper(req.db, req.orchestrator);
    
    // 生成规格
    const spec = await agentDev.generateSkillSpecification(opportunity);
    if (!spec) {
      return res.status(400).json({ error: 'Failed to generate specification' });
    }
    
    // 生成代码
    const code = await agentDev.generateSkillCode(spec);
    
    // 测试
    const testResults = await agentDev.testSkillAutomatically(code, spec.test_cases);
    
    res.json({
      specification: spec,
      code: code,
      test_results: testResults,
      can_publish: testResults.pass_rate >= 0.8
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 批准并发布Agent生成的Skill
router.post('/admin/agent-skills/:id/publish', (req, res) => {
  const { id } = req.params;
  
  req.db.run(
    `UPDATE skills SET status = 'approved' WHERE id = ? AND created_by_agent = 1`,
    [id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Skill not found or not agent-created' });
      }
      
      res.json({
        message: 'Agent-developed skill published successfully',
        skill_id: id
      });
    }
  );
});

// 获取Agent开发者统计
router.get('/agent-developer/stats', (req, res) => {
  req.db.get(
    `SELECT
      COUNT(*) as total_skills,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as published_skills,
      COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as recent_skills,
      AVG(CASE WHEN test_results IS NOT NULL THEN
        json_extract(test_results, '$.pass_rate') END) as avg_pass_rate
     FROM skills
     WHERE created_by_agent = 1`,
    [],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    }
  );
});

module.exports = router;
