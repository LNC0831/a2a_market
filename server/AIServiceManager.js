/**
 * AI Service Manager (DEPRECATED)
 *
 * This class is deprecated and will be removed in a future version.
 * Use the new AI module instead: require('./ai')
 *
 * Migration guide:
 *   Old: const aiService = new AIServiceManager(config);
 *        const result = await aiService.execute('content_writing', prompt);
 *
 *   New: const ai = require('./ai');
 *        const result = await ai.complete('content_writing', systemPrompt, userPrompt);
 *
 * The new AI module provides:
 *   - Better provider abstraction (Moonshot, OpenAI, Anthropic)
 *   - Unified routing configuration
 *   - Built-in cost tracking
 *   - Fallback support
 */

const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');

class AIServiceManager {
  constructor(config = {}) {
    // 多模型配置
    this.providers = {
      openai: config.openaiApiKey ? new OpenAI({ apiKey: config.openaiApiKey }) : null,
      moonshot: config.moonshotApiKey ? new OpenAI({
        apiKey: config.moonshotApiKey,
        baseURL: 'https://api.moonshot.cn/v1'
      }) : null,
      // 可以添加更多：Claude、Gemini等
    };
    
    // 默认使用哪个模型
    this.defaultProvider = config.defaultProvider || 'moonshot';
    this.defaultModel = config.defaultModel || 'kimi-k2.5';
    
    // Token使用统计
    this.tokenUsage = {
      total: 0,
      byProvider: {},
      byTask: {}
    };
    
    // 成本追踪 (每1K token的价格)
    this.pricing = {
      'moonshot/kimi-k2.5': { input: 0.012, output: 0.012 },
      'openai/gpt-4': { input: 0.03, output: 0.06 },
      'openai/gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
    };
  }

  // 主执行方法
  async execute(taskType, userPrompt, options = {}) {
    const startTime = Date.now();
    const executionId = uuidv4();
    
    try {
      // 1. 选择模型
      const provider = options.provider || this.selectBestProvider(taskType);
      const model = options.model || this.selectBestModel(taskType);
      
      // 2. 构建Prompt
      const systemPrompt = this.getSystemPrompt(taskType);
      const enhancedPrompt = this.enhanceUserPrompt(userPrompt, taskType);
      
      // 3. 调用AI
      console.log(`🤖 [AI执行] ${taskType} | 模型: ${provider}/${model}`);
      
      const response = await this.callAI(provider, model, {
        system: systemPrompt,
        user: enhancedPrompt,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
        stream: options.stream || false
      });
      
      // 4. 记录用量
      const tokens = response.usage;
      const cost = this.calculateCost(provider, model, tokens);
      this.recordUsage(executionId, provider, model, tokens, cost);
      
      const executionTime = Date.now() - startTime;
      
      console.log(`✅ [AI完成] 耗时: ${executionTime}ms | Tokens: ${tokens.total} | 成本: $${cost.toFixed(4)}`);
      
      return {
        success: true,
        content: response.content,
        executionId,
        provider,
        model,
        tokens,
        cost,
        executionTime,
        raw: response.raw
      };
      
    } catch (error) {
      console.error(`❌ [AI错误] ${error.message}`);
      return {
        success: false,
        error: error.message,
        executionId
      };
    }
  }

  // 调用具体AI API
  async callAI(provider, model, params) {
    const client = this.providers[provider];
    if (!client) {
      throw new Error(`Provider ${provider} not configured`);
    }
    
    const messages = [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user }
    ];
    
    // Kimi模型只支持temperature=1
    const adjustedTemp = provider === 'moonshot' ? 1 : params.temperature;
    
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: adjustedTemp,
      max_tokens: params.max_tokens,
      stream: params.stream
    });
    
    return {
      content: completion.choices[0].message.content,
      usage: {
        prompt: completion.usage.prompt_tokens,
        completion: completion.usage.completion_tokens,
        total: completion.usage.total_tokens
      },
      raw: completion
    };
  }

  // 根据任务类型选择最佳模型
  selectBestProvider(taskType) {
    const mapping = {
      'content_writing': 'moonshot',  // 中文写作Moonshot更好
      'code_review': 'openai',        // 代码GPT-4更强
      'data_analysis': 'openai',
      'translation': 'moonshot',
      'general': this.defaultProvider
    };
    return mapping[taskType] || this.defaultProvider;
  }

  selectBestModel(taskType) {
    const mapping = {
      'content_writing': 'kimi-k2.5',
      'code_review': 'gpt-4',
      'data_analysis': 'gpt-4',
      'translation': 'kimi-k2.5',
      'general': this.defaultModel
    };
    return mapping[taskType] || this.defaultModel;
  }

  // 获取System Prompt
  getSystemPrompt(taskType) {
    const prompts = {
      'content_writing': `你是一位专业的内容创作专家。你的任务是：
1. 根据用户需求生成高质量的文章
2. 确保内容结构清晰、逻辑严密
3. 使用专业的写作风格
4. 适当使用标题、列表等格式
5. 在结尾提供SEO优化建议

输出格式：
【文章标题】
【正文内容】
【SEO建议】`,

      'code_review': `你是一位资深软件工程师，擅长代码审查。你的任务是：
1. 分析代码中的潜在bug和逻辑错误
2. 提供性能优化建议
3. 检查安全漏洞
4. 评估代码可读性和可维护性
5. 给出重构建议

输出格式：
【总体评分】X/10
【发现的问题】
- 问题1：...
- 问题2：...
【优化建议】
【安全评估】
【重构建议】`,

      'data_analysis': `你是一位数据分析专家。你的任务是：
1. 分析用户提供的数据
2. 识别关键趋势和模式
3. 发现异常值
4. 提供商业洞察
5. 给出可执行的建议

输出格式：
【数据概览】
【关键发现】
【异常检测】
【商业洞察】
【行动建议】`,

      'translation': `你是一位专业翻译，精通多语言。你的任务是：
1. 准确翻译文档内容
2. 保持原文的语气和风格
3. 专业术语翻译准确
4. 确保格式保持一致

输出格式：
【翻译结果】
【术语对照表】
【质量评分】`,

      'default': `你是一位专业的AI助手，帮助用户完成各种任务。请提供详细、准确、有用的回答。`
    };
    
    return prompts[taskType] || prompts['default'];
  }

  // 增强用户Prompt
  enhanceUserPrompt(userPrompt, taskType) {
    // 添加任务特定的上下文
    const enhancers = {
      'content_writing': (prompt) => `请根据以下要求创作文章：\n\n${prompt}\n\n要求：\n- 确保内容原创，不要抄袭\n- 使用专业但易懂的语言\n- 适当使用例子和数据支撑观点`,
      
      'code_review': (prompt) => `请审查以下代码：\n\n${prompt}\n\n请特别关注：\n- 潜在的运行时错误\n- 性能瓶颈\n- 安全风险\n- 代码异味`,
      
      'default': (prompt) => prompt
    };
    
    const enhancer = enhancers[taskType] || enhancers['default'];
    return enhancer(userPrompt);
  }

  // 计算成本
  calculateCost(provider, model, tokens) {
    const key = `${provider}/${model}`;
    const pricing = this.pricing[key] || { input: 0.01, output: 0.01 };
    
    const inputCost = (tokens.prompt / 1000) * pricing.input;
    const outputCost = (tokens.completion / 1000) * pricing.output;
    
    return inputCost + outputCost;
  }

  // 记录用量
  recordUsage(executionId, provider, model, tokens, cost) {
    this.tokenUsage.total += tokens.total;
    
    if (!this.tokenUsage.byProvider[provider]) {
      this.tokenUsage.byProvider[provider] = { tokens: 0, cost: 0 };
    }
    this.tokenUsage.byProvider[provider].tokens += tokens.total;
    this.tokenUsage.byProvider[provider].cost += cost;
    
    this.tokenUsage.byTask[executionId] = {
      provider,
      model,
      tokens,
      cost,
      timestamp: new Date().toISOString()
    };
  }

  // 获取统计报告
  getUsageReport() {
    return {
      totalTokens: this.tokenUsage.total,
      totalCost: Object.values(this.tokenUsage.byProvider).reduce((sum, p) => sum + p.cost, 0),
      byProvider: this.tokenUsage.byProvider,
      recentTasks: Object.entries(this.tokenUsage.byTask)
        .slice(-10)
        .map(([id, data]) => ({ id, ...data }))
    };
  }
}

module.exports = AIServiceManager;
