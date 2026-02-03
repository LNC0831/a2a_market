/**
 * AI Module Entry Point
 *
 * Exports the AI router and provider utilities.
 *
 * Usage:
 *   const ai = require('./ai');
 *
 *   // Simple completion
 *   const result = await ai.complete('ai_judge', systemPrompt, userPrompt);
 *
 *   // Full control with messages
 *   const result = await ai.call('ai_judge', messages, { temperature: 0.5 });
 *
 *   // Check provider status
 *   const status = ai.getProviderStatus();
 */

const aiRouter = require('./AIRouter');

module.exports = {
  // Main interface
  call: (functionName, messages, options) => aiRouter.call(functionName, messages, options),
  complete: (functionName, systemPrompt, userPrompt, options) =>
    aiRouter.complete(functionName, systemPrompt, userPrompt, options),

  // Utilities
  getProviderStatus: () => aiRouter.getProviderStatus(),
  getUsageStats: () => aiRouter.getUsageStats(),
  getRoute: (functionName) => aiRouter.getRoute(functionName),

  // Direct router access (for advanced use)
  router: aiRouter
};
