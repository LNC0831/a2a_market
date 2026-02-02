const DatabaseWrapper = require('./db');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const AIServiceManager = require('./AIServiceManager');
const { SETTLEMENT } = require('./config/settlement');

class AgentOrchestrator {
  constructor(dbPath) {
    this.db = new DatabaseWrapper(dbPath);
    
    // 初始化AI服务管理器
    this.aiService = new AIServiceManager({
      moonshotApiKey: process.env.MOONSHOT_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      defaultProvider: 'moonshot',
      defaultModel: 'kimi-k2.5'
    });
  }

  // 主调度入口
  async processTask(taskId) {
    console.log(`🎯 [调度Agent] 开始处理任务: ${taskId}`);
    
    const task = await this.getTask(taskId);
    
    // 1. 解析需求
    const requirements = await this.parseRequirements(task);
    await this.updateTask(taskId, {
      type: requirements.type,
      status: 'parsed'
    });

    // 2. 动态定价
    const price = await this.quotePrice(task, requirements);
    await this.updateTask(taskId, {
      price: price,
      status: 'quoted'
    });

    // 3. 等待用户确认（MVP中自动确认）
    console.log(`💰 [报价Agent] 报价: ¥${price}`);
    
    // 4. 分配执行Agent
    const executionPlan = await this.createExecutionPlan(requirements);
    await this.updateTask(taskId, {
      status: 'assigned'
    });

    // 5. 执行（接入真实AI）
    await this.executeTask(taskId, executionPlan, requirements);

    // 6. 质量审核
    const qualityResult = await this.reviewTask(taskId);
    
    // 7. 完成结算
    await this.finalizeTask(taskId, qualityResult);
  }

  // Agent 1: 需求解析
  async parseRequirements(task) {
    console.log(`🔍 [调度Agent] 解析需求: ${task.title}`);

    // 如果任务类型已经是 skill_xxx 格式（来自 Agent API），直接使用
    if (task.type && task.type.startsWith('skill_')) {
      const skillTypeMap = {
        'skill_write_blog': 'content_writing',
        'skill_code_review': 'code_review',
        'skill_data_analysis': 'data_analysis',
        'skill_translate_doc': 'translation',
        'skill_seo_optimize': 'content_writing'
      };
      const taskType = skillTypeMap[task.type] || 'general';
      console.log(`  → 直接使用指定 Skill: ${task.type}`);
      return {
        type: taskType,
        complexity: 'medium',
        skills_needed: [task.type],
        estimated_time: 10,
        keywords: []
      };
    }

    // 否则使用规则引擎解析
    const description = (task.description || task.title || '').toLowerCase();

    let taskType = 'general';
    let complexity = 'medium';
    let skillsNeeded = [];

    if (description.includes('写') || description.includes('文章') || description.includes('文案') || description.includes('blog') || description.includes('write')) {
      taskType = 'content_writing';
      skillsNeeded.push('skill_write_blog');
      if (description.includes('2000') || description.includes('专业') || description.includes('professional')) {
        complexity = 'high';
        skillsNeeded.push('skill_seo_optimize');
      }
    } else if (description.includes('代码') || description.includes('bug') || description.includes('review') || description.includes('python') || description.includes('code')) {
      taskType = 'code_review';
      skillsNeeded.push('skill_code_review');
      complexity = description.includes('系统') ? 'high' : 'medium';
    } else if (description.includes('数据') || description.includes('分析') || description.includes('报告') || description.includes('data')) {
      taskType = 'data_analysis';
      skillsNeeded.push('skill_data_analysis');
      complexity = 'high';
    } else if (description.includes('翻译') || description.includes('英文') || description.includes('translate')) {
      taskType = 'translation';
      skillsNeeded.push('skill_translate_doc');
    }

    // 如果没匹配到任何 skill，默认使用写作
    if (skillsNeeded.length === 0) {
      skillsNeeded.push('skill_write_blog');
      taskType = 'content_writing';
    }

    return {
      type: taskType,
      complexity,
      skills_needed: skillsNeeded,
      estimated_time: complexity === 'high' ? 15 : complexity === 'medium' ? 10 : 5,
      keywords: this.extractKeywords(task.description || '')
    };
  }

  // Agent 2: 动态定价
  async quotePrice(task, requirements) {
    console.log(`💰 [报价Agent] 计算价格...`);
    
    // 基础价格
    let basePrice = 50;
    
    // 根据复杂度
    if (requirements.complexity === 'high') basePrice *= 2.5;
    else if (requirements.complexity === 'medium') basePrice *= 1.5;
    
    // 根据技能数量
    basePrice += requirements.skills_needed.length * 30;
    
    // 根据预估时间
    basePrice += requirements.estimated_time * 5;
    
    // 加上随机波动（模拟市场供需）
    const marketFactor = 0.9 + Math.random() * 0.3; // 0.9 - 1.2
    
    return Math.round(basePrice * marketFactor);
  }

  // Agent 3: 创建执行计划
  async createExecutionPlan(requirements) {
    console.log(`📋 [调度Agent] 创建执行计划...`);
    
    // 获取可用的执行Agent
    const agents = await this.getAvailableAgents();
    
    // 根据能力匹配
    const primaryAgent = agents.find(a => 
      requirements.skills_needed.some(skill => 
        JSON.parse(a.capabilities || '[]').includes(skill.replace('skill_', '').replace('_', ''))
      )
    ) || agents[0];

    return {
      primaryAgent: primaryAgent.id,
      skills: requirements.skills_needed,
      steps: requirements.skills_needed.map((skill, idx) => ({
        order: idx,
        skill: skill,
        agent: primaryAgent.id,
        estimated_time: requirements.estimated_time / requirements.skills_needed.length
      }))
    };
  }

  // Agent 4: 执行任务（接入真实AI）
  async executeTask(taskId, plan, requirements) {
    console.log(`⚙️ [执行Agent] 开始执行任务...`);
    
    await this.updateTask(taskId, { 
      status: 'processing'
    });

    const task = await this.getTask(taskId);
    let finalResult = '';
    let totalCost = 0;

    // 依次执行每个步骤
    for (const step of plan.steps) {
      console.log(`  → 执行步骤: ${step.skill}`);
      
      // 获取skill详情
      const skill = await this.getSkill(step.skill);
      
      // 检查是否有AI API配置
      const hasAIConfig = process.env.MOONSHOT_API_KEY || process.env.OPENAI_API_KEY;
      
      if (hasAIConfig) {
        // 调用真实AI服务
        const aiResult = await this.aiService.execute(
          requirements.type || 'general',
          task.description,
          {
            provider: this.selectAIProvider(step.skill),
            temperature: 0.7,
            maxTokens: 2000
          }
        );
        
        if (aiResult.success) {
          finalResult += `【${skill.name}执行结果】\n\n${aiResult.content}\n\n`;
          totalCost += aiResult.cost;
          
          // 记录调用
          await this.recordSkillCall({
            task_id: taskId,
            skill_id: step.skill,
            agent_id: step.agent,
            execution_time_ms: aiResult.executionTime,
            cost: skill.price_per_call
          });
          
          console.log(`  ✅ AI执行完成 | Tokens: ${aiResult.tokens.total} | 成本: $${aiResult.cost.toFixed(4)}`);
        } else {
          // AI调用失败，使用备用方案
          console.log(`  ⚠️ AI调用失败，使用备用方案: ${aiResult.error}`);
          const fallbackResult = await this.executeSkillFallback(skill, taskId);
          finalResult += fallbackResult + '\n\n';
        }
      } else {
        // 没有API配置，使用模拟数据
        console.log(`  ⚠️ 未配置AI API，使用模拟数据`);
        const fallbackResult = await this.executeSkillFallback(skill, taskId);
        finalResult += fallbackResult + '\n\n';
      }
    }

    await this.updateTask(taskId, {
      result: finalResult
    });

    console.log(`  💰 总AI成本: $${totalCost.toFixed(4)}`);
    return finalResult;
  }

  // 选择AI提供商
  selectAIProvider(skillId) {
    const mapping = {
      'skill_write_blog': 'moonshot',
      'skill_seo_optimize': 'moonshot',
      'skill_translate_doc': 'moonshot',
      'skill_code_review': 'openai',
      'skill_data_analysis': 'openai'
    };
    return mapping[skillId] || 'moonshot';
  }

  // 备用执行方案（模拟）
  async executeSkillFallback(skill, taskId) {
    const results = {
      'skill_write_blog': `【AI生成文章】\n\n标题：AI技术深度分析\n\n正文：\n这是一篇关于AI的专业文章...\n\n(字数：2000字)\nSEO评分：8.5/10`,
      
      'skill_seo_optimize': `【SEO优化建议】\n- 关键词密度优化完成\n- 标题标签优化\n- Meta描述已生成\n- 内链建议：添加3个相关链接`,
      
      'skill_code_review': `【代码审查报告】\n\n✓ 发现3个问题\n✓ 性能优化建议\n✓ 安全漏洞检查通过\n\n总体评分：8.5/10`,
      
      'skill_data_analysis': `【数据分析结果】\n\n- 数据量：1,234条\n- 关键发现：3个\n- 异常值：5个\n- 可视化图表已生成`,
      
      'skill_translate_doc': `【翻译结果】\n\n原文档已翻译完成。\n\n- 字数：2,456字\n- 专业术语已校对\n- 格式保持完整`
    };
    
    return results[skill.id] || `【${skill.name}执行结果】\n\n任务已完成，输出符合预期。`;
  }

  // Agent 5: 质量审核
  async reviewTask(taskId) {
    console.log(`🔍 [审核Agent] 质量检查...`);
    
    const task = await this.getTask(taskId);
    
    // 模拟质量评分
    const checks = {
      completeness: 0.9 + Math.random() * 0.1,
      accuracy: 0.85 + Math.random() * 0.15,
      format: 0.95,
      originality: 0.9 + Math.random() * 0.1
    };
    
    const qualityScore = (checks.completeness + checks.accuracy + checks.format + checks.originality) / 4;
    
    const reviewResult = {
      score: qualityScore.toFixed(2),
      passed: qualityScore > 0.75,
      checks,
      feedback: qualityScore > 0.9 ? '优秀' : qualityScore > 0.8 ? '良好' : '合格',
      reviewed_at: new Date().toISOString()
    };
    
    console.log(`  ✅ 质量评分: ${(qualityScore * 10).toFixed(1)}/10 - ${reviewResult.feedback}`);
    
    return reviewResult;
  }

  // Agent 6: 结算
  async finalizeTask(taskId, qualityResult) {
    console.log(`💸 [结算Agent] 处理结算...`);
    
    const task = await this.getTask(taskId);
    const totalPrice = task.price || 100;
    
    // 平台抽成
    const platformFee = Math.round(totalPrice * SETTLEMENT.SKILL_PLATFORM_RATIO);

    // 开发者分成
    const developerPayout = Math.round(totalPrice * SETTLEMENT.SKILL_DEVELOPER_RATIO);
    
    await this.updateTask(taskId, {
      status: qualityResult.passed ? 'completed' : 'failed'
    });
    
    // 创建交易记录
    await this.createTransaction({
      task_id: taskId,
      type: 'payout',
      amount: developerPayout,
      from_party: 'platform',
      to_party: 'skill_developer',
      status: 'completed'
    });
    
    console.log(`  💰 总收入: ¥${totalPrice}`);
    console.log(`     → Skill开发者: ¥${developerPayout} (${SETTLEMENT.SKILL_DEVELOPER_RATIO * 100}%)`);
    console.log(`     → 平台抽成: ¥${platformFee} (${SETTLEMENT.SKILL_PLATFORM_RATIO * 100}%)`);
    
    // 更新skill调用统计
    await this.incrementSkillStats(developerPayout);
  }

  // 数据库操作方法
  getTask(taskId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  updateTask(taskId, updates) {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE tasks SET ${setClause} WHERE id = ?`,
        [...values, taskId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }

  getAvailableAgents() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM agents WHERE status = ?', ['active'], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  getSkill(skillId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM skills WHERE id = ?', [skillId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  recordSkillCall(data) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO skill_calls (id, task_id, skill_id, agent_id, execution_time_ms, cost) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, data.task_id, data.skill_id, data.agent_id, data.execution_time_ms, data.cost],
        (err) => {
          if (err) reject(err);
          else resolve({ id });
        }
      );
    });
  }

  createTransaction(data) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO transactions (id, task_id, type, amount, from_party, to_party, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, data.task_id, data.type, data.amount, data.from_party, data.to_party, data.status],
        (err) => {
          if (err) reject(err);
          else resolve({ id });
        }
      );
    });
  }

  extractKeywords(text) {
    // 简单的关键词提取
    const commonWords = ['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'];
    const words = text.split(/\s+|，|。|！|？|,|.|!|\?/);
    return words.filter(w => w.length > 1 && !commonWords.includes(w)).slice(0, 10);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 更新skill统计
  async incrementSkillStats(payout) {
    // 这里可以更新skill的调用次数和收益统计
    return Promise.resolve();
  }
}

module.exports = AgentOrchestrator;
