/**
 * Anthropic Provider
 *
 * Implementation for Anthropic API (Claude models).
 * Note: Anthropic uses a different API format than OpenAI.
 */

const BaseProvider = require('../BaseProvider');

class AnthropicProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'anthropic';
    this.baseURL = config.baseURL || 'https://api.anthropic.com/v1';
  }

  /**
   * Chat completion using Anthropic's Messages API
   * @param {Array} messages - Message array
   * @param {Object} options - Options
   * @returns {Promise<Object>}
   */
  async chat(messages, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Anthropic provider not configured (missing API key)');
    }

    const model = options.model || this.getDefaultModel();
    const sanitizedOptions = this.sanitizeOptions(options);

    // Convert OpenAI-style messages to Anthropic format
    const { systemPrompt, anthropicMessages } = this.convertMessages(messages);

    try {
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: sanitizedOptions.max_tokens,
          system: systemPrompt,
          messages: anthropicMessages
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error('Anthropic rate limit exceeded');
        }
        if (response.status === 401) {
          throw new Error('Anthropic authentication failed');
        }
        throw new Error(errorData.error?.message || `Anthropic API error: ${response.status}`);
      }

      const data = await response.json();

      const usage = {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      };

      // Extract text content from response
      const content = data.content
        ?.filter(block => block.type === 'text')
        ?.map(block => block.text)
        ?.join('') || '';

      return {
        content,
        usage,
        cost: this.calculateCost(model, usage),
        model,
        provider: this.name,
        raw: data
      };
    } catch (error) {
      if (error.message.includes('rate limit') || error.message.includes('authentication')) {
        throw error;
      }
      throw new Error(`Anthropic API error: ${error.message}`);
    }
  }

  /**
   * Convert OpenAI-style messages to Anthropic format
   * Anthropic separates system prompt from messages
   */
  convertMessages(messages) {
    let systemPrompt = '';
    const anthropicMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n\n' : '') + msg.content;
      } else {
        anthropicMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      }
    }

    // Anthropic requires alternating user/assistant messages
    // Merge consecutive messages of the same role
    const mergedMessages = [];
    for (const msg of anthropicMessages) {
      if (mergedMessages.length > 0 && mergedMessages[mergedMessages.length - 1].role === msg.role) {
        mergedMessages[mergedMessages.length - 1].content += '\n\n' + msg.content;
      } else {
        mergedMessages.push({ ...msg });
      }
    }

    return { systemPrompt, anthropicMessages: mergedMessages };
  }

  /**
   * Anthropic-specific option sanitization
   */
  sanitizeOptions(options) {
    const sanitized = { ...options };

    // Anthropic doesn't use temperature in the same way
    // It has a different behavior for max_tokens
    if (!sanitized.max_tokens) {
      sanitized.max_tokens = 2000;
    }

    return sanitized;
  }
}

module.exports = AnthropicProvider;
