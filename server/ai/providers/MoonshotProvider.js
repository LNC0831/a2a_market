/**
 * Moonshot AI Provider
 *
 * Implementation for Moonshot (Kimi) API.
 * Uses OpenAI-compatible API format.
 */

const OpenAI = require('openai');
const BaseProvider = require('../BaseProvider');

class MoonshotProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'moonshot';

    if (this.isConfigured()) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL || 'https://api.moonshot.cn/v1'
      });
    }
  }

  /**
   * Chat completion
   * @param {Array} messages - Message array
   * @param {Object} options - Options
   * @returns {Promise<Object>}
   */
  async chat(messages, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Moonshot provider not configured (missing API key)');
    }

    const model = options.model || this.getDefaultModel();
    const sanitizedOptions = this.sanitizeOptions(options);

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages,
        temperature: sanitizedOptions.temperature,
        max_tokens: sanitizedOptions.max_tokens,
        ...sanitizedOptions.extra
      });

      const usage = {
        prompt_tokens: completion.usage?.prompt_tokens || 0,
        completion_tokens: completion.usage?.completion_tokens || 0,
        total_tokens: completion.usage?.total_tokens || 0
      };

      return {
        content: completion.choices[0]?.message?.content || '',
        usage,
        cost: this.calculateCost(model, usage),
        model,
        provider: this.name,
        raw: completion
      };
    } catch (error) {
      // Handle Moonshot-specific errors
      if (error.status === 429) {
        throw new Error('Moonshot rate limit exceeded');
      }
      if (error.status === 401) {
        throw new Error('Moonshot authentication failed');
      }
      throw error;
    }
  }

  /**
   * Moonshot-specific option sanitization
   * Moonshot only supports temperature=1 for some models
   */
  sanitizeOptions(options) {
    const sanitized = { ...options };

    // Moonshot quirk: temperature must be between 0 and 1
    // Some Moonshot models only work well with temperature=1
    if (sanitized.temperature !== undefined) {
      sanitized.temperature = Math.min(Math.max(sanitized.temperature, 0), 1);
    } else {
      sanitized.temperature = 0.7;
    }

    // Default max tokens if not specified
    if (!sanitized.max_tokens) {
      sanitized.max_tokens = 2000;
    }

    return sanitized;
  }
}

module.exports = MoonshotProvider;
