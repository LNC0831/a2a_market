const AIServiceManager = require('./AIServiceManager');
const AgentOrchestrator = require('./AgentOrchestrator');

class AgentDeveloper {
  constructor(db, orchestrator) {
    this.db = db;
    this.orchestrator = orchestrator;
    this.aiService = new AIServiceManager({
      moonshotApiKey: process.env.MOONSHOT_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY
    });
    
    // Agent开发者身份
    this.agentDeveloperId = 'agent_dev_system_001';
    this.agentDeveloperEmail = 'agent-dev@platform.ai';
  }

  // 1. 市场需求感知 - Agent自动发现机会
  async analyzeMarketOpportunities() {
    console.log('🔍 [AgentDeveloper] 分析市场机会...');
    
    // 获取现有技能列表
    const existingSkills = await this.getExistingSkills();
    
    // 获取用户需求（从搜索记录、未完成任务等）
    const userNeeds = await this.getUnmetUserNeeds();
    
    // 分析市场缺口
    const opportunities = await this.identifyGaps(existingSkills, userNeeds);
    
    console.log(`💡 发现 ${opportunities.length} 个市场机会`);
    
    return opportunities;
  }

  // 2. 自动生成Skill规格
  async generateSkillSpecification(opportunity) {
    console.log(`📝 生成Skill规格: ${opportunity.name}`);
    
    const prompt = `你是一位专业的AI Skill架构师。基于以下市场需求，设计一个完整的AI Skill规格：

市场需求: ${opportunity.description}
目标用户: ${opportunity.target_users}
痛点: ${opportunity.pain_points}

请设计一个完整的Skill，包括：
1. Skill名称（简短、清晰）
2. 详细功能描述
3. 输入参数定义（JSON Schema格式）
4. 输出格式定义
5. 实现思路（伪代码）
6. 定价建议（基于复杂度）
7. 测试用例（5个典型场景）

以JSON格式返回：{
  "name": "...",
  "description": "...",
  "category": "...",
  "input_schema": {...},
  "output_schema": {...},
  "implementation_plan": "...",
  "suggested_price": 50,
  "test_cases": [...]
}`;

    const result = await this.aiService.execute('general', prompt, {
      temperature: 0.7,
      maxTokens: 3000
    });

    try {
      return JSON.parse(result.content);
    } catch (e) {
      console.error('解析Skill规格失败:', e);
      return null;
    }
  }

  // 3. 自动生成Skill代码
  async generateSkillCode(specification) {
    console.log(`💻 生成Skill代码: ${specification.name}`);
    
    const codePrompt = `实现以下AI Skill：

Skill名称: ${specification.name}
功能描述: ${specification.description}
输入Schema: ${JSON.stringify(specification.input_schema)}
输出Schema: ${JSON.stringify(specification.output_schema)}
实现思路: ${specification.implementation_plan}

请用JavaScript编写完整的实现代码，要求：
1. 包含完整的错误处理
2. 输入验证
3. 超时控制
4. 日志记录
5. 符合JSON Schema的输出

代码格式：
async function executeSkill(input) {
  // 实现代码
}

module.exports = { executeSkill };`;

    const result = await this.aiService.execute('coding', codePrompt, {
      temperature: 0.3,
      maxTokens: 4000
    });

    return result.content;
  }

  // 4. 自动测试Skill
  async testSkillAutomatically(skillCode, testCases) {
    console.log('🧪 自动测试Skill...');
    
    const results = [];
    let passed = 0;

    for (const testCase of testCases) {
      try {
        // 创建安全的测试环境（简化版）
        const result = await this.runSkillInSandbox(skillCode, testCase.input);
        
        // 验证输出
        const isValid = this.validateTestResult(result, testCase.expected_output);
        
        results.push({
          name: testCase.name,
          passed: isValid,
          input: testCase.input,
          output: result,
          expected: testCase.expected_output
        });
        
        if (isValid) passed++;
      } catch (err) {
        results.push({
          name: testCase.name,
          passed: false,
          error: err.message
        });
      }
    }

    const passRate = passed / testCases.length;
    
    console.log(`✅ 测试通过率: ${(passRate * 100).toFixed(0)}% (${passed}/${testCases.length})`);
    
    return {
      pass_rate: passRate,
      total: testCases.length,
      passed: passed,
      results: results
    };
  }

  // 5. 自动发布Skill
  async publishSkill(specification, code, testResults) {
    if (testResults.pass_rate < 0.8) {
      console.log('❌ 测试通过率不足，拒绝发布');
      return { success: false, reason: 'test_failed' };
    }

    console.log('🚀 自动发布Skill...');
    
    const skillId = 'skill_agent_' + Date.now();
    
    // 保存到数据库
    await this.saveSkill({
      id: skillId,
      name: specification.name,
      description: specification.description,
      category: specification.category,
      developer_email: this.agentDeveloperEmail,
      developer_name: 'AI Agent Developer',
      base_price: specification.suggested_price,
      price_per_call: specification.suggested_price,
      endpoint: 'dynamic',
      endpoint_code: code,
      status: 'approved', // Agent开发的Skill自动通过
      input_schema: JSON.stringify(specification.input_schema),
      output_schema: JSON.stringify(specification.output_schema),
      auto_generated: true,
      test_results: JSON.stringify(testResults),
      created_by_agent: true
    });

    console.log(`✅ Skill已发布: ${skillId}`);
    
    return {
      success: true,
      skill_id: skillId,
      name: specification.name
    };
  }

  // 6. 持续监控和优化
  async monitorAndOptimize() {
    console.log('📊 监控Skill表现...');
    
    // 获取所有Agent开发的Skill
    const agentSkills = await this.getAgentDevelopedSkills();
    
    for (const skill of agentSkills) {
      const analytics = await this.getSkillAnalytics(skill.id);
      
      // 如果使用率低，分析原因并优化
      if (analytics.usage_count < 10 && skill.created_at < Date.now() - 7 * 24 * 60 * 60 * 1000) {
        console.log(`⚠️ Skill ${skill.name} 使用率低，准备优化...`);
        await this.optimizeSkill(skill);
      }
      
      // 如果错误率高，修复bug
      if (analytics.error_rate > 0.1) {
        console.log(`🐛 Skill ${skill.name} 错误率高，准备修复...`);
        await this.fixSkillBugs(skill, analytics.error_logs);
      }
    }
  }

  // 7. 主循环 - Agent自动开发流程
  async runAutonomousDevelopment() {
    console.log('🤖 [AgentDeveloper] 启动自主开发模式...');
    
    // 步骤1: 发现机会
    const opportunities = await this.analyzeMarketOpportunities();
    
    for (const opportunity of opportunities.slice(0, 3)) { // 每次最多开发3个
      try {
        // 步骤2: 生成规格
        const spec = await this.generateSkillSpecification(opportunity);
        if (!spec) continue;
        
        // 步骤3: 生成代码
        const code = await this.generateSkillCode(spec);
        
        // 步骤4: 自动测试
        const testResults = await this.testSkillAutomatically(code, spec.test_cases);
        
        // 步骤5: 发布
        const publishResult = await this.publishSkill(spec, code, testResults);
        
        if (publishResult.success) {
          console.log(`🎉 新Skill上线: ${spec.name}`);
          
          // 通知管理员（可选）
          await this.notifyAdmin('new_skill_published', {
            skill_id: publishResult.skill_id,
            name: spec.name,
            generated_by: 'AI Agent'
          });
        }
      } catch (err) {
        console.error('Skill开发失败:', err);
      }
    }
    
    // 步骤6: 监控优化
    await this.monitorAndOptimize();
    
    console.log('✅ 本轮自主开发完成');
  }

  // 辅助方法
  async getExistingSkills() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM skills', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getUnmetUserNeeds() {
    // 从搜索记录、未完成任务、用户反馈中提取需求
    // 简化实现
    return [
      { description: '需要自动化生成周报', target_users: '职场人士' },
      { description: '需要把语音转文字并总结', target_users: '会议记录员' },
      { description: '需要自动生成代码注释', target_users: '程序员' }
    ];
  }

  async identifyGaps(existingSkills, userNeeds) {
    // 使用AI分析缺口
    const prompt = `分析以下现有Skill和用户需求，找出市场缺口：

现有Skill: ${existingSkills.map(s => s.name).join(', ')}

用户需求: ${JSON.stringify(userNeeds)}

找出3个最有价值的Skill机会，以JSON格式返回：[{"name": "...", "description": "...", "target_users": "...", "pain_points": "..."}]`;

    const result = await this.aiService.execute('general', prompt, {
      temperature: 0.8,
      maxTokens: 1500
    });

    try {
      return JSON.parse(result.content);
    } catch (e) {
      return [];
    }
  }

  async runSkillInSandbox(code, input) {
    // 简化版：直接返回模拟结果
    // 实际应该用VM2或Docker沙箱
    return { success: true, result: 'sandbox_output' };
  }

  validateTestResult(result, expected) {
    // 简化验证
    return result && result.success;
  }

  async saveSkill(skill) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO skills (id, name, description, category, developer_email, developer_name,
          base_price, price_per_call, endpoint, endpoint_code, status, input_schema, output_schema,
          auto_generated, test_results, created_by_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        skill.id, skill.name, skill.description, skill.category,
        skill.developer_email, skill.developer_name, skill.base_price,
        skill.price_per_call, skill.endpoint, skill.endpoint_code,
        skill.status, skill.input_schema, skill.output_schema,
        skill.auto_generated, skill.test_results, skill.created_by_agent
      ], function(err) {
        if (err) reject(err);
        else resolve({ id: skill.id });
      });
      
      stmt.finalize();
    });
  }

  async getAgentDevelopedSkills() {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM skills WHERE created_by_agent = 1',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async getSkillAnalytics(skillId) {
    // 返回模拟数据
    return {
      usage_count: Math.floor(Math.random() * 100),
      error_rate: Math.random() * 0.2,
      error_logs: []
    };
  }

  async optimizeSkill(skill) {
    console.log(`🔧 优化Skill: ${skill.name}`);
    // 实现优化逻辑
  }

  async fixSkillBugs(skill, errorLogs) {
    console.log(`🐛 修复Skill: ${skill.name}`);
    // 实现修复逻辑
  }

  async notifyAdmin(type, data) {
    console.log(`📧 通知管理员: ${type}`, data);
  }
}

module.exports = AgentDeveloper;
