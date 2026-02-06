/**
 * RateLimiter - In-memory per-user cooldown service
 *
 * Uses a nested Map: Map<action, Map<identifier, timestamp>>
 * Periodically cleans up expired entries.
 *
 * Exported as a singleton.
 */

const { RATE_LIMIT } = require('../config/rateLimit');

class RateLimiter {
  constructor() {
    // Map<action, Map<identifier, lastTimestamp>>
    this.store = new Map();

    // Start periodic cleanup
    this._cleanupTimer = setInterval(() => this._cleanup(), RATE_LIMIT.CLEANUP_INTERVAL);
    this._cleanupTimer.unref(); // Don't block process exit
  }

  /**
   * Check if an action is allowed and record it if so.
   *
   * @param {string} action - Action name (e.g. 'post_task')
   * @param {string} identifier - User/IP identifier
   * @param {number} cooldownSeconds - Cooldown period in seconds
   * @returns {{ allowed: boolean, retry_after?: number }}
   */
  check(action, identifier, cooldownSeconds) {
    if (!RATE_LIMIT.ENABLED) {
      return { allowed: true };
    }

    if (!this.store.has(action)) {
      this.store.set(action, new Map());
    }

    const actionMap = this.store.get(action);
    const lastTime = actionMap.get(identifier);
    const now = Date.now();

    if (lastTime) {
      const elapsed = (now - lastTime) / 1000;
      if (elapsed < cooldownSeconds) {
        return {
          allowed: false,
          retry_after: Math.ceil(cooldownSeconds - elapsed)
        };
      }
    }

    // Record this action
    actionMap.set(identifier, now);
    return { allowed: true };
  }

  /**
   * Record an action without checking (for cases where you want to
   * record even on failure, e.g. failed registration attempts).
   *
   * @param {string} action - Action name
   * @param {string} identifier - User/IP identifier
   */
  record(action, identifier) {
    if (!RATE_LIMIT.ENABLED) return;

    if (!this.store.has(action)) {
      this.store.set(action, new Map());
    }
    this.store.get(action).set(identifier, Date.now());
  }

  /**
   * Remove expired entries from all action maps.
   * An entry is expired if it's older than the longest cooldown (30 min).
   */
  _cleanup() {
    const maxAge = 30 * 60 * 1000; // 30 minutes in ms
    const now = Date.now();

    for (const [action, actionMap] of this.store) {
      for (const [identifier, timestamp] of actionMap) {
        if (now - timestamp > maxAge) {
          actionMap.delete(identifier);
        }
      }
      if (actionMap.size === 0) {
        this.store.delete(action);
      }
    }
  }
}

// Export singleton
module.exports = new RateLimiter();
