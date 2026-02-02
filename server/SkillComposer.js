// Skill组合编排系统
// 允许用户组合多个Skill完成复杂工作流

class SkillComposer {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.db = orchestrator.db;
  }

  // 预定义的工作流模板
  getWorkflowTemplates() {
    return [
      {
        id: 'content_marketing_pipeline',
        name: '内容营销全流程',
        description: '从选题到发布的完整内容营销工作流',
        steps: [
          { skill: 'skill_topic_research', name: '热点研究' },
          { skill: 'skill_write_blog', name: '文章写作' },
          { skill: 'skill_seo_optimize', name: 'SEO优化' },
          { skill: 'skill_social_media', name: '社媒文案' },
          { skill: 'skill_image_gen', name: '配图生成' }
        ],
        total_price: 280,
        estimated_time: 25
      },
      {
        id: 'product_launch_kit',
        name: '产品发布套件',
        description: '新产品上线所需的全套材料',
        steps: [
          { skill: 'skill_product_description', name: '产品文案' },
          { skill: 'skill_landing_page', name: '落地页' },
          { skill: 'skill_email_campaign', name: '邮件营销' },
          { skill: 'skill_press_release', name: '新闻稿' },
          { skill: 'skill_demo_video_script', name: '演示脚本' }
        ],
        total_price: 450,
        estimated_time: 40
      },
      {
        id: 'code_quality_assurance',
        name: '代码质量保证',
        description: '完整的代码审查和优化流程',
        steps: [
          { skill: 'skill_code_review', name: '代码审查' },
          { skill: 'skill_security_audit', name: '安全审计' },
          { skill: 'skill_performance_test', name: '性能测试' },
          { skill: 'skill_documentation', name: '文档生成' },
          { skill: 'skill_unit_tests', name: '单元测试' }
        ],
        total_price: 500,
        estimated_time: 35
      },
      {
        id: 'market_research_report',
        name: '市场调研报告',
        description: '全面的市场分析报告',
        steps: [
          { skill: 'skill_data_collection', name: '数据采集' },
          { skill: 'skill_data_analysis', name: '数据分析' },
          { skill: 'skill_competitor_analysis', name: '竞品分析' },
          { skill: 'skill_trend_forecast', name: '趋势预测' },
          { skill: 'skill_report_writing', name: '报告撰写' }
        ],
        total_price: 600,
        estimated_time: 50
      },
      {
        id: 'multilingual_content',
        name: '多语言内容包',
        description: '一键生成多语言版本内容',
        steps: [
          { skill: 'skill_write_blog', name: '原文创作' },
          { skill: 'skill_translate_doc', name: '翻译英文' },
          { skill: 'skill_translate_doc', name: '翻译日文' },
          { skill: 'skill_translate_doc', name: '翻译韩文' },
          { skill: 'skill_localization', name: '本地化处理' }
        ],
        total_price: 350,
        estimated_time: 30
      }
    ];
  }

  // 创建组合任务
  async createCompositeTask(userId, workflowId, input) {
    const workflow = this.getWorkflowTemplates().find(w => w.id === workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    console.log(`🔄 [SkillComposer] 创建组合任务: ${workflow.name}`);

    // 创建父任务
    const parentTaskId = await this.createParentTask(userId, workflow, input);

    // 串行执行每个步骤
    let previousOutput = input;
    const stepResults = [];

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      console.log(`  → 步骤 ${i + 1}/${workflow.steps.length}: ${step.name}`);

      // 创建子任务
      const subTask = await this.createSubTask(
        parentTaskId,
        step.skill,
        previousOutput,
        i
      );

      // 执行子任务
      const result = await this.orchestrator.processTask(subTask.id);
      
      stepResults.push({
        step: i + 1,
        skill: step.skill,
        name: step.name,
        result: result
      });

      // 将输出作为下一步的输入
      previousOutput = result.output;
    }

    // 合并最终结果
    const finalResult = await this.mergeResults(stepResults);

    // 更新父任务
    await this.updateParentTask(parentTaskId, finalResult, stepResults);

    return {
      task_id: parentTaskId,
      workflow: workflow.name,
      steps_completed: stepResults.length,
      final_result: finalResult,
      total_price: workflow.total_price
    };
  }

  // 创建父任务
  async createParentTask(userId, workflow, input) {
    const id = require('uuid').v4();
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO tasks (id, title, description, type, price, user_email, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, workflow.name, input, 'composite', workflow.total_price, userId, 'processing'],
        function(err) {
          if (err) reject(err);
          else resolve(id);
        }
      );
    });
  }

  // 创建子任务
  async createSubTask(parentId, skillId, input, stepOrder) {
    const id = require('uuid').v4();
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO tasks (id, title, description, type, price, user_email, status, parent_task_id, step_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, `Step ${stepOrder + 1}`, input, skillId, 0, 'system', 'pending', parentId, stepOrder],
        function(err) {
          if (err) reject(err);
          else resolve({ id });
        }
      );
    });
  }

  // 合并多个步骤的结果
  async mergeResults(stepResults) {
    // 根据不同的工作流类型，使用不同的合并策略
    const merged = {
      workflow_summary: stepResults.map(s => ({
        step: s.step,
        name: s.name,
        status: 'completed'
      })),
      outputs: {}
    };

    // 为每个步骤的输出创建索引
    stepResults.forEach((step, index) => {
      merged.outputs[`step_${index + 1}`] = {
        name: step.name,
        output: step.result
      };
    });

    // 生成最终交付物
    merged.final_deliverables = this.generateDeliverables(stepResults);

    return merged;
  }

  // 生成最终交付物列表
  generateDeliverables(stepResults) {
    const deliverables = [];

    stepResults.forEach(step => {
      if (step.result && step.result.output) {
        deliverables.push({
          name: step.name,
          type: this.detectOutputType(step.result.output),
          content: step.result.output
        });
      }
    });

    return deliverables;
  }

  // 检测输出类型
  detectOutputType(output) {
    if (typeof output !== 'string') return 'data';
    
    if (output.includes('```')) return 'code';
    if (output.includes('# ') || output.includes('## ')) return 'markdown';
    if (output.includes('<') && output.includes('>')) return 'html';
    return 'text';
  }

  // 用户自定义工作流
  async createCustomWorkflow(userId, name, description, skillSequence) {
    const workflowId = 'custom_' + Date.now();
    
    // 计算总价和预估时间
    let totalPrice = 0;
    let totalTime = 0;

    for (const skillId of skillSequence) {
      const skill = await this.getSkillInfo(skillId);
      totalPrice += skill.price_per_call;
      totalTime += 5; // 假设每个skill平均5分钟
    }

    const customWorkflow = {
      id: workflowId,
      name: name,
      description: description,
      created_by: userId,
      steps: skillSequence.map((skillId, index) => ({
        skill: skillId,
        name: `Step ${index + 1}`,
        order: index
      })),
      total_price: totalPrice,
      estimated_time: totalTime,
      is_template: false
    };

    // 保存到数据库
    await this.saveCustomWorkflow(customWorkflow);

    return customWorkflow;
  }

  // 获取Skill信息
  async getSkillInfo(skillId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM skills WHERE id = ?',
        [skillId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || { price_per_call: 50 });
        }
      );
    });
  }

  // 保存自定义工作流
  async saveCustomWorkflow(workflow) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO workflow_templates (id, name, description, created_by, steps, total_price, estimated_time, is_template)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [workflow.id, workflow.name, workflow.description, workflow.created_by,
         JSON.stringify(workflow.steps), workflow.total_price, workflow.estimated_time, workflow.is_template],
        function(err) {
          if (err) reject(err);
          else resolve(workflow);
        }
      );
    });
  }

  // 获取用户可使用的所有工作流
  async getAvailableWorkflows(userId) {
    const templates = this.getWorkflowTemplates();
    
    // 获取用户自定义的工作流
    const customWorkflows = await new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM workflow_templates WHERE created_by = ? OR is_template = 1',
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    return [...templates, ...customWorkflows];
  }
}

module.exports = SkillComposer;
