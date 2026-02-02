// MCP (Model Context Protocol) 支持
// 让AI模型能够通过标准协议调用我们的Skill
// https://modelcontextprotocol.io

const express = require('express');
const router = express.Router();

// MCP Server Capability Declaration
router.get('/mcp', (req, res) => {
  res.json({
    protocol_version: '2024-11-05',
    server_info: {
      name: 'ai-task-market-mcp',
      version: '2.0.0',
      vendor: 'AI Task Market'
    },
    capabilities: {
      tools: {
        listChanged: true
      },
      resources: {
        subscribe: true,
        listChanged: true
      }
    }
  });
});

// List available tools (Skills exposed as MCP tools)
router.post('/mcp/tools/list', (req, res) => {
  req.db.all(
    `SELECT s.id, s.name, s.description, s.parameters_schema
     FROM skills s
     WHERE s.status = 'approved'`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const tools = rows.map(skill => ({
        name: skill.id,
        description: skill.description,
        inputSchema: skill.parameters_schema ? JSON.parse(skill.parameters_schema) : {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Input for the skill'
            }
          },
          required: ['prompt']
        }
      }));
      
      res.json({ tools });
    }
  );
});

// Call a tool (Execute a skill)
router.post('/mcp/tools/call', async (req, res) => {
  const { name, arguments: args } = req.body;
  
  // Create task
  const taskId = require('uuid').v4();
  
  req.db.run(
    `INSERT INTO tasks (id, title, description, type, price, user_email, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [taskId, `MCP call: ${name}`, JSON.stringify(args), name, 0, 'mcp-client@agent.ai', 'pending'],
    function(err) {
      if (err) {
        return res.json({
          content: [{
            type: 'text',
            text: `Error: ${err.message}`
          }],
          isError: true
        });
      }
      
      // Execute and return result
      req.orchestrator.processTask(taskId).then(() => {
        req.db.get(
          'SELECT result, status FROM tasks WHERE id = ?',
          [taskId],
          (err, row) => {
            if (err || !row) {
              res.json({
                content: [{
                  type: 'text',
                  text: 'Error retrieving result'
                }],
                isError: true
              });
            } else if (row.status === 'completed') {
              res.json({
                content: [{
                  type: 'text',
                  text: row.result
                }],
                isError: false
              });
            } else {
              res.json({
                content: [{
                  type: 'text',
                  text: 'Task failed'
                }],
                isError: true
              });
            }
          }
        );
      });
    }
  );
});

// List resources (Skills catalog as resources)
router.post('/mcp/resources/list', (req, res) => {
  req.db.all(
    `SELECT s.id, s.name, s.description, s.category, s.price_per_call
     FROM skills s
     WHERE s.status = 'approved'`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const resources = rows.map(skill => ({
        uri: `skill://${skill.id}`,
        name: skill.name,
        mimeType: 'application/json',
        description: skill.description,
        metadata: {
          category: skill.category,
          price: skill.price_per_call
        }
      }));
      
      res.json({ resources });
    }
  );
});

// Read resource
router.post('/mcp/resources/read', (req, res) => {
  const { uri } = req.body;
  const skillId = uri.replace('skill://', '');
  
  req.db.get(
    `SELECT * FROM skills WHERE id = ?`,
    [skillId],
    (err, row) => {
      if (err || !row) {
        return res.json({
          contents: [{
            uri: uri,
            mimeType: 'text/plain',
            text: 'Resource not found'
          }]
        });
      }
      
      res.json({
        contents: [{
          uri: uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            id: row.id,
            name: row.name,
            description: row.description,
            category: row.category,
            pricing: {
              per_call: row.price_per_call,
              currency: 'USD'
            },
            rating: row.avg_rating,
            total_calls: row.total_calls
          }, null, 2)
        }]
      });
    }
  );
});

module.exports = router;
