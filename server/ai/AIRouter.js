/**
 * AI Router
 *
 * Manages provider selection and routing based on function names.
 * Provides a simple interface for calling AI with automatic provider selection.
 */

const config = require('../config/ai');
const MoonshotProvider = require('./providers/MoonshotProvider');
const OpenAIProvider = require('./providers/OpenAIProvider');
const AnthropicProvider = require('./providers/AnthropicProvider');

class AIRouter {
  constructor() {
    // Initialize providers lazily (only when needed and configured)
    this.providers = {};
    this.providerClasses = {
      moonshot: MoonshotProvider,
      openai: OpenAIProvider,
      anthropic: AnthropicProvider
    };

    // Usage tracking
    this.usageStats = {
      totalCalls: 0,
      totalTokens: 0,
      totalCost: 0,
      byFunction: {},
      byProvider: {}
    };
  }

  /**
   * Get or create a provider instance
   * @param {string} providerName - Name of the provider
   * @returns {BaseProvider} Provider instance
   */
  getProvider(providerName) {
    if (!this.providers[providerName]) {
      const ProviderClass = this.providerClasses[providerName];
      if (!ProviderClass) {
        throw new Error(`Unknown provider: ${providerName}`);
      }

      const providerConfig = config.providers[providerName];
      if (!providerConfig) {
        throw new Error(`No configuration for provider: ${providerName}`);
      }

      this.providers[providerName] = new ProviderClass(providerConfig);
    }

    return this.providers[providerName];
  }

  /**
   * Get the route (provider/model) for a function
   * @param {string} functionName - The function being called
   * @returns {Object} { provider, model }
   */
  getRoute(functionName) {
    const route = config.routing[functionName] || config.routing.default;
    return {
      provider: route.provider,
      model: route.model
    };
  }

  /**
   * Call AI with automatic provider selection based on function name
   * @param {string} functionName - Name of the function (e.g., 'ai_judge', 'content_writing')
   * @param {Array} messages - Messages array
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} AI response
   */
  async call(functionName, messages, options = {}) {
    const route = this.getRoute(functionName);
    const provider = this.getProvider(route.provider);

    // Check if provider is configured
    if (!provider.isConfigured()) {
      throw new Error(`Provider ${route.provider} is not configured. Check API key.`);
    }

    // Apply function-specific limits
    const maxTokens = config.tokenLimits[functionName] || config.tokenLimits.default;
    const costLimit = config.costLimits[functionName] || config.costLimits.default;

    const callOptions = {
      model: options.model || route.model,
      max_tokens: Math.min(options.max_tokens || maxTokens, maxTokens),
      temperature: options.temperature,
      json_mode: options.json_mode,
      ...options
    };

    const startTime = Date.now();

    try {
      const result = await provider.chat(messages, callOptions);

      // Check cost limit
      if (result.cost > costLimit) {
        console.warn(`[AI Router] Cost ${result.cost.toFixed(4)} exceeded limit ${costLimit} for ${functionName}`);
      }

      // Record usage
      this.recordUsage(functionName, route.provider, result);

      const executionTime = Date.now() - startTime;
      console.log(`[AI Router] ${functionName} | ${route.provider}/${result.model} | ${result.usage.total_tokens} tokens | $${result.cost.toFixed(4)} | ${executionTime}ms`);

      return {
        ...result,
        functionName,
        executionTime
      };
    } catch (error) {
      console.error(`[AI Router] Error in ${functionName}:`, error.message);

      // Try fallback if primary provider fails
      if (options.allowFallback !== false) {
        const fallback = this.getFallbackProvider(route.provider);
        if (fallback) {
          console.log(`[AI Router] Trying fallback provider: ${fallback}`);
          const fallbackProvider = this.getProvider(fallback);
          if (fallbackProvider.isConfigured()) {
            const fallbackRoute = config.routing.default;
            callOptions.model = fallbackRoute.model;
            return fallbackProvider.chat(messages, callOptions);
          }
        }
      }

      throw error;
    }
  }

  /**
   * Simple completion call (convenience method)
   * @param {string} functionName - Function name for routing
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} AI response
   */
  async complete(functionName, systemPrompt, userPrompt, options = {}) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    return this.call(functionName, messages, options);
  }

  /**
   * Get a fallback provider when primary fails
   */
  getFallbackProvider(failedProvider) {
    const fallbacks = {
      openai: 'moonshot',
      moonshot: 'openai',
      anthropic: 'openai'
    };
    return fallbacks[failedProvider];
  }

  /**
   * Record usage statistics
   */
  recordUsage(functionName, providerName, result) {
    this.usageStats.totalCalls++;
    this.usageStats.totalTokens += result.usage.total_tokens;
    this.usageStats.totalCost += result.cost;

    // By function
    if (!this.usageStats.byFunction[functionName]) {
      this.usageStats.byFunction[functionName] = { calls: 0, tokens: 0, cost: 0 };
    }
    this.usageStats.byFunction[functionName].calls++;
    this.usageStats.byFunction[functionName].tokens += result.usage.total_tokens;
    this.usageStats.byFunction[functionName].cost += result.cost;

    // By provider
    if (!this.usageStats.byProvider[providerName]) {
      this.usageStats.byProvider[providerName] = { calls: 0, tokens: 0, cost: 0 };
    }
    this.usageStats.byProvider[providerName].calls++;
    this.usageStats.byProvider[providerName].tokens += result.usage.total_tokens;
    this.usageStats.byProvider[providerName].cost += result.cost;
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    return {
      ...this.usageStats,
      totalCost: `$${this.usageStats.totalCost.toFixed(4)}`
    };
  }

  /**
   * Get available providers and their configuration status
   */
  getProviderStatus() {
    const status = {};
    for (const [name, providerConfig] of Object.entries(config.providers)) {
      const provider = this.getProvider(name);
      status[name] = {
        configured: provider.isConfigured(),
        defaultModel: providerConfig.defaultModel,
        availableModels: Object.keys(providerConfig.models || {})
      };
    }
    return status;
  }
}

// Singleton instance
const aiRouter = new AIRouter();

module.exports = aiRouter;
