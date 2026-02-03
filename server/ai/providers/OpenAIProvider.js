/**
 * OpenAI Provider
 *
 * Implementation for OpenAI API (GPT models).
 */

const OpenAI = require('openai');
const BaseProvider = require('../BaseProvider');

class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'openai';

    if (this.isConfigured()) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL || 'https://api.openai.com/v1'
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
      throw new Error('OpenAI provider not configured (missing API key)');
    }

    const model = options.model || this.getDefaultModel();
    const sanitizedOptions = this.sanitizeOptions(options);

    try {
      const requestParams = {
        model,
        messages,
        temperature: sanitizedOptions.temperature,
        max_tokens: sanitizedOptions.max_tokens
      };

      // Add response_format if JSON mode requested
      if (sanitizedOptions.json_mode) {
        requestParams.response_format = { type: 'json_object' };
      }

      const completion = await this.client.chat.completions.create(requestParams);

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
      // Handle OpenAI-specific errors
      if (error.status === 429) {
        throw new Error('OpenAI rate limit exceeded');
      }
      if (error.status === 401) {
        throw new Error('OpenAI authentication failed');
      }
      if (error.code === 'context_length_exceeded') {
        throw new Error('OpenAI context length exceeded');
      }
      throw error;
    }
  }

  /**
   * OpenAI-specific option sanitization
   */
  sanitizeOptions(options) {
    const sanitized = { ...options };

    // OpenAI temperature: 0-2
    if (sanitized.temperature !== undefined) {
      sanitized.temperature = Math.min(Math.max(sanitized.temperature, 0), 2);
    } else {
      sanitized.temperature = 0.7;
    }

    // Default max tokens
    if (!sanitized.max_tokens) {
      sanitized.max_tokens = 2000;
    }

    return sanitized;
  }
}

module.exports = OpenAIProvider;
