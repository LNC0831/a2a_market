const AIServiceManager = require('../AIServiceManager');

class SkillAutoGenerator {
  constructor() {
    this.aiService = new AIServiceManager({
      moonshotApiKey: process.env.MOONSHOT_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY
    });
  }

  // 自动生成Skill的核心方法
  async generateSkill(userDescription) {
    console.log(`🤖 [SkillAutoGen] 分析需求: ${userDescription.substring(0, 50)}...`);
    
    // 1. 分析需求，提取关键信息
    const analysis = await this.analyzeRequirement(userDescription);
    
    // 2. 检查是否已有相似Skill
    const similarSkill = await this.findSimilarSkill(analysis);
    if (similarSkill) {
      return {
        success: false,
        reason: 'similar_skill_exists',
        existing_skill: similarSkill,
        message: 'Found similar skill, use existing one'
      };
    }
    
    // 3. 生成Skill代码
    const skillCode = await this.generateSkillCode(analysis);
    
    // 4. 生成测试用例
    const testCases = await this.generateTestCases(analysis);
    
    // 5. 自动测试
    const testResults = await this.runAutoTests(skillCode, testCases);
    
    if (testResults.pass_rate < 0.8) {
      return {
        success: false,
        reason: 'test_failed',
        test_results: testResults,
        message: 'Auto-generated skill failed quality tests'
      };
    }
    
    // 6. 创建Skill
    const skill = await this.createSkillRecord(analysis, skillCode);
    
    return {
      success: true,
      skill: skill,
      test_results: testResults,
      message: 'New skill auto-generated successfully'
    };
  }

  // 分析用户需求
  async analyzeRequirement(description) {
    const prompt = `Analyze this user requirement and extract structured information:
    
Requirement: ${description}

Please extract and return JSON:
{
  "skill_name": "Short, clear name",
  "category": "One of: writing, coding, design, data, marketing, translation, audio, video, research, legal, finance, education, health, gaming, automation",
  "description": "What this skill does",
  "input_format": "Expected input format",
  "output_format": "Expected output format",
  "complexity": "low/medium/high",
  "estimated_price": suggested price in USD,
  "required_capabilities": ["list", "of", "capabilities"],
  "similar_to": "Any existing tools this resembles"
}`;

    const result = await this.aiService.execute('general', prompt, {
      temperature: 0.3,
      maxTokens: 1000
    });

    try {
      return JSON.parse(result.content);
    } catch (e) {
      // 如果解析失败，返回结构化数据
      return {
        skill_name: 'Auto Skill',
        category: 'general',
        description: description,
        complexity: 'medium',
        estimated_price: 10
      };
    }
  }

  // 查找相似Skill
  async findSimilarSkill(analysis) {
    // 这里可以查询数据库找相似Skill
    // 简化为返回null，实际实现需要向量搜索
    return null;
  }

  // 生成Skill代码
  async generateSkillCode(analysis) {
    const codePrompt = `Generate a JavaScript function for this AI skill:

Skill: ${analysis.skill_name}
Description: ${analysis.description}
Input: ${analysis.input_format}
Output: ${analysis.output_format}

Generate a complete, production-ready function:

function executeSkill(input) {
  // Your implementation here
  // Should handle the input and return appropriate output
  // Include error handling
  // Include input validation
  
  return {
    success: true,
    result: "processed result",
    metadata: {
      processing_time: 0,
      tokens_used: 0
    }
  };
}

module.exports = { executeSkill };`;

    const result = await this.aiService.execute('coding', codePrompt, {
      temperature: 0.2,
      maxTokens: 2000
    });

    return result.content;
  }

  // 生成测试用例
  async generateTestCases(analysis) {
    const testPrompt = `Generate 5 test cases for this skill:

Skill: ${analysis.skill_name}
Description: ${analysis.description}

Generate test cases in JSON format:
[
  {
    "name": "Test case name",
    "input": "test input",
    "expected_output_contains": ["expected", "keywords"],
    "validation_rules": ["rule1", "rule2"]
  }
]`;

    const result = await this.aiService.execute('general', testPrompt, {
      temperature: 0.3,
      maxTokens: 1500
    });

    try {
      return JSON.parse(result.content);
    } catch (e) {
      return [];
    }
  }

  // 运行自动测试
  async runAutoTests(skillCode, testCases) {
    const results = [];
    let passed = 0;

    for (const testCase of testCases) {
      try {
        // 安全地执行代码（实际应该用沙箱）
        // 这里简化处理
        const result = { success: true, output: 'mock output' };
        
        // 验证输出
        const isValid = this.validateOutput(result.output, testCase.expected_output_contains);
        
        results.push({
          name: testCase.name,
          passed: isValid,
          output: result.output
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

    return {
      total: testCases.length,
      passed: passed,
      pass_rate: passed / testCases.length,
      details: results
    };
  }

  // 验证输出
  validateOutput(output, expectedKeywords) {
    if (!output || !expectedKeywords) return false;
    return expectedKeywords.every(keyword => 
      output.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // 创建Skill记录
  async createSkillRecord(analysis, code) {
    const skillId = 'skill_auto_' + Date.now();
    
    // 这里应该保存到数据库
    // 返回Skill信息
    return {
      id: skillId,
      name: analysis.skill_name,
      category: analysis.category,
      description: analysis.description,
      base_price: analysis.estimated_price,
      price_per_call: analysis.estimated_price,
      status: 'auto_generated',
      code: code,
      generated_at: new Date().toISOString()
    };
  }

  // 用户反馈学习
  async learnFromFeedback(skillId, userFeedback, originalOutput) {
    // 分析用户反馈，改进Skill
    const improvePrompt = `Improve this skill based on user feedback:

Original Output: ${originalOutput}
User Feedback: ${userFeedback}

How should this skill be improved? Provide specific code changes.`;

    const result = await this.aiService.execute('general', improvePrompt, {
      temperature: 0.4,
      maxTokens: 1500
    });

    // 创建Skill的新版本
    console.log(`📝 Skill ${skillId} improvement suggestion generated`);
    
    return result.content;
  }
}

module.exports = SkillAutoGenerator;
