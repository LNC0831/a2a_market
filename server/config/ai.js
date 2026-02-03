/**
 * AI Provider Configuration
 *
 * Centralized configuration for all AI providers and routing rules.
 */

module.exports = {
  // Provider configurations (API keys from environment)
  providers: {
    moonshot: {
      apiKey: process.env.MOONSHOT_API_KEY,
      baseURL: 'https://api.moonshot.cn/v1',
      defaultModel: 'moonshot-v1-8k',
      models: {
        'moonshot-v1-8k': { inputPrice: 0.012, outputPrice: 0.012 },
        'moonshot-v1-32k': { inputPrice: 0.024, outputPrice: 0.024 },
        'moonshot-v1-128k': { inputPrice: 0.06, outputPrice: 0.06 }
      }
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      models: {
        'gpt-4o': { inputPrice: 0.005, outputPrice: 0.015 },
        'gpt-4o-mini': { inputPrice: 0.00015, outputPrice: 0.0006 },
        'gpt-4-turbo': { inputPrice: 0.01, outputPrice: 0.03 },
        'gpt-3.5-turbo': { inputPrice: 0.0005, outputPrice: 0.0015 }
      }
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: 'https://api.anthropic.com/v1',
      defaultModel: 'claude-3-5-sonnet-20241022',
      models: {
        'claude-3-5-sonnet-20241022': { inputPrice: 0.003, outputPrice: 0.015 },
        'claude-3-opus-20240229': { inputPrice: 0.015, outputPrice: 0.075 },
        'claude-3-haiku-20240307': { inputPrice: 0.00025, outputPrice: 0.00125 }
      }
    }
  },

  // Function-based routing configuration
  // Maps function names to specific provider/model combinations
  routing: {
    // Platform built-in AI functions
    ai_judge: { provider: 'moonshot', model: 'moonshot-v1-8k' },
    ai_interviewer: { provider: 'moonshot', model: 'moonshot-v1-8k' },

    // Legacy task type routing (for backward compatibility with AIServiceManager)
    content_writing: { provider: 'moonshot', model: 'moonshot-v1-8k' },
    code_review: { provider: 'openai', model: 'gpt-4o-mini' },
    data_analysis: { provider: 'openai', model: 'gpt-4o-mini' },
    translation: { provider: 'moonshot', model: 'moonshot-v1-8k' },

    // Default fallback
    default: { provider: 'moonshot', model: 'moonshot-v1-8k' }
  },

  // Cost limits per call (in USD)
  // These prevent runaway costs for single API calls
  costLimits: {
    ai_judge: 0.05,          // Max $0.05 per judge call
    ai_interviewer: 0.20,    // Max $0.20 per interview round
    content_writing: 0.10,
    code_review: 0.15,
    default: 0.10
  },

  // Token limits per call
  tokenLimits: {
    ai_judge: 2000,
    ai_interviewer: 3000,
    content_writing: 4000,
    code_review: 4000,
    default: 2000
  },

  // Retry configuration
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2
  }
};
