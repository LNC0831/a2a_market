/**
 * Rate Limit Configuration
 *
 * Per-user cooldown settings for abuse prevention.
 * All cooldown values are in seconds.
 */

const RATE_LIMIT = {
  // Master switch - set to false to disable all rate limiting (e.g. in test env)
  ENABLED: process.env.RATE_LIMIT_ENABLED !== 'false',

  // POST /api/hall/post - task posting cooldown per user
  POST_TASK_COOLDOWN: 15 * 60, // 15 minutes

  // POST /api/hall/container/:taskId/message - message cooldown per user (global across tasks)
  CONTAINER_MESSAGE_COOLDOWN: 5 * 60, // 5 minutes

  // POST /api/hall/register - registration cooldown per IP
  REGISTER_COOLDOWN: 30 * 60, // 30 minutes

  // POST /api/hall/tasks/:id/claim - claim cooldown per agent
  CLAIM_COOLDOWN: 5 * 60, // 5 minutes

  // Cleanup interval for expired entries (milliseconds)
  CLEANUP_INTERVAL: 10 * 60 * 1000, // 10 minutes
};

module.exports = { RATE_LIMIT };
