/**
 * Base AI Provider
 *
 * Abstract base class for all AI provider implementations.
 * Defines the common interface that all providers must implement.
 */

class BaseProvider {
  constructor(config) {
    this.config = config;
    this.name = 'base';
  }

  /**
   * Chat completion API
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} options - Additional options (model, temperature, max_tokens, etc.)
   * @returns {Promise<Object>} Response with content and usage
   */
  async chat(messages, options = {}) {
    throw new Error('chat() method not implemented');
  }

  /**
   * Simple completion API (wraps chat for convenience)
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response with content and usage
   */
  async complete(systemPrompt, userPrompt, options = {}) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    return this.chat(messages, options);
  }

  /**
   * Calculate the cost of a request based on token usage
   * @param {string} model - The model used
   * @param {Object} usage - Token usage object { prompt_tokens, completion_tokens }
   * @returns {number} Cost in USD
   */
  calculateCost(model, usage) {
    const modelConfig = this.config.models?.[model];
    if (!modelConfig) {
      // Default pricing if model not found
      return (usage.prompt_tokens + usage.completion_tokens) * 0.00001;
    }

    const inputCost = (usage.prompt_tokens / 1000) * modelConfig.inputPrice;
    const outputCost = (usage.completion_tokens / 1000) * modelConfig.outputPrice;
    return inputCost + outputCost;
  }

  /**
   * Check if the provider is properly configured
   * @returns {boolean} True if provider can be used
   */
  isConfigured() {
    return !!this.config.apiKey;
  }

  /**
   * Get the default model for this provider
   * @returns {string} Model name
   */
  getDefaultModel() {
    return this.config.defaultModel;
  }

  /**
   * Validate that a model is supported by this provider
   * @param {string} model - Model name to check
   * @returns {boolean} True if model is supported
   */
  isModelSupported(model) {
    return model in (this.config.models || {});
  }

  /**
   * Sanitize options for the specific provider
   * Override in subclasses to handle provider-specific quirks
   * @param {Object} options - Raw options
   * @returns {Object} Sanitized options
   */
  sanitizeOptions(options) {
    return { ...options };
  }
}

module.exports = BaseProvider;
