const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// 开发者注册
router.post('/developers/register', (req, res) => {
  const { email, name, bio, website, github } = req.body;
  const id = uuidv4();
  
  req.db.run(
    `INSERT INTO developers (id, email, name, bio, website, github) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, email, name, bio, website, github],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Email already registered' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ 
        id, 
        message: 'Developer registered successfully',
        dashboard_url: `/developer/${id}`
      });
    }
  );
});

// 获取开发者信息
router.get('/developers/:id', (req, res) => {
  req.db.get(
    `SELECT d.*, 
     COUNT(DISTINCT s.id) as skill_count,
     SUM(sa.calls_count) as total_calls
     FROM developers d
     LEFT JOIN skills s ON s.developer_email = d.email
     LEFT JOIN skill_analytics sa ON sa.skill_id = s.id
     WHERE d.id = ?
     GROUP BY d.id`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Developer not found' });
      res.json(row);
    }
  );
});

// 提交新Skill
router.post('/skills/submit', (req, res) => {
  const {
    developer_email,
    name,
    description,
    category,
    base_price,
    price_per_call,
    endpoint_type,
    endpoint_code,
    parameters_schema,
    test_input
  } = req.body;
  
  const id = uuidv4();
  
  req.db.run(
    `INSERT INTO skill_submissions 
     (id, developer_id, name, description, category, base_price, price_per_call,
      endpoint_type, endpoint_code, parameters_schema, test_input, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, developer_email, name, description, category, base_price, price_per_call,
     endpoint_type, endpoint_code, parameters_schema, test_input, 'pending'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // 这里可以触发审核通知
      console.log(`📋 New skill submitted: ${name} by ${developer_email}`);
      
      res.json({
        id,
        status: 'pending',
        message: 'Skill submitted for review',
        review_time: '1-3 business days'
      });
    }
  );
});

// 获取所有分类
router.get('/skill-categories', (req, res) => {
  req.db.all(
    `SELECT * FROM skill_categories 
     WHERE is_active = 1 
     ORDER BY sort_order`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// 获取开发者的Skills
router.get('/developers/:id/skills', (req, res) => {
  req.db.all(
    `SELECT s.*, 
     SUM(sa.calls_count) as total_calls,
     AVG(sa.avg_rating) as avg_rating
     FROM skills s
     LEFT JOIN skill_analytics sa ON sa.skill_id = s.id
     WHERE s.developer_email = (SELECT email FROM developers WHERE id = ?)
     GROUP BY s.id`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// 管理员：审核Skill
router.post('/admin/skills/:id/review', (req, res) => {
  const { status, review_notes } = req.body; // status: approved, rejected
  
  req.db.run(
    `UPDATE skill_submissions 
     SET status = ?, review_notes = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, review_notes, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      if (status === 'approved') {
        // 自动创建正式Skill
        approveSkill(req.params.id, req.db);
      }
      
      res.json({ message: `Skill ${status}` });
    }
  );
});

// 自动批准Skill并创建
function approveSkill(submissionId, db) {
  db.get(
    'SELECT * FROM skill_submissions WHERE id = ?',
    [submissionId],
    (err, row) => {
      if (err || !row) return;
      
      const skillId = 'skill_' + Date.now();
      
      db.run(
        `INSERT INTO skills (id, name, description, category, developer_email, 
         developer_name, base_price, price_per_call, endpoint, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [skillId, row.name, row.description, row.category, row.developer_id,
         row.developer_id, row.base_price, row.price_per_call, 
         row.endpoint_url || 'dynamic', 'approved'],
        (err) => {
          if (err) console.error('Failed to create skill:', err);
          else console.log(`✅ Skill approved and created: ${skillId}`);
        }
      );
    }
  );
}

// 热门Skills排行
router.get('/skills/trending', (req, res) => {
  req.db.all(
    `SELECT s.*, 
     SUM(sa.calls_count) as total_calls,
     AVG(sa.avg_rating) as avg_rating,
     SUM(sa.revenue) as total_revenue
     FROM skills s
     LEFT JOIN skill_analytics sa ON sa.skill_id = s.id
     WHERE s.status = 'approved'
     GROUP BY s.id
     ORDER BY total_calls DESC
     LIMIT 10`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// 搜索Skills
router.get('/skills/search', (req, res) => {
  const { q, category, min_price, max_price } = req.query;
  
  let sql = `SELECT s.* FROM skills s WHERE s.status = 'approved'`;
  const params = [];
  
  if (q) {
    sql += ` AND (s.name LIKE ? OR s.description LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }
  
  if (category) {
    sql += ` AND s.category = ?`;
    params.push(category);
  }
  
  if (min_price) {
    sql += ` AND s.price_per_call >= ?`;
    params.push(min_price);
  }
  
  if (max_price) {
    sql += ` AND s.price_per_call <= ?`;
    params.push(max_price);
  }
  
  sql += ` ORDER BY s.avg_rating DESC`;
  
  req.db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
