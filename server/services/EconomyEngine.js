/**
 * MP Economy Engine
 *
 * Core service for calculating and managing the dynamic MP (Marketplace Points) economy.
 *
 * The economy self-regulates through supply ratio (σ):
 *   σ = Σ(active user balances) / (active users × TARGET_PER_USER)
 *
 * When σ deviates from 1.0:
 *   - Daily regeneration (R) and burn rate (B) adjust automatically
 *   - This creates a negative feedback loop that pulls σ back toward 1.0
 */

const { v4: uuidv4 } = require('uuid');
const {
  ECONOMY,
  getEconomyStatus,
  calculateDailyRegen,
  calculateBurnRate
} = require('../config/economy');

class EconomyEngine {
  constructor(db) {
    this.db = db;
    this.lastSigma = null; // Cache for EMA calculation
  }

  // ============================================
  // Core Calculation Methods
  // ============================================

  /**
   * Calculate raw supply ratio (σ_raw)
   *
   * σ_raw = Σ(active user balances) / (active users × TARGET_PER_USER)
   *
   * @param {number} totalActiveMP - Sum of all active users' MP balances
   * @param {number} activeUsers - Number of active users
   * @returns {number} - Raw sigma value
   */
  calcSupplyRatioRaw(totalActiveMP, activeUsers) {
    if (activeUsers <= 0) {
      // Cold start: return 1.0 (balanced state)
      return 1.0;
    }
    const targetTotal = activeUsers * ECONOMY.TARGET_PER_USER;
    return totalActiveMP / targetTotal;
  }

  /**
   * Apply EMA smoothing to sigma
   *
   * σ = α × σ_raw + (1-α) × σ_old
   *
   * @param {number} sigmaRaw - Current raw sigma
   * @returns {number} - Smoothed sigma
   */
  applySmoothingSigma(sigmaRaw) {
    if (this.lastSigma === null) {
      // First calculation, use raw value
      this.lastSigma = sigmaRaw;
      return sigmaRaw;
    }

    const smoothed = ECONOMY.ALPHA * sigmaRaw + (1 - ECONOMY.ALPHA) * this.lastSigma;
    this.lastSigma = smoothed;
    return smoothed;
  }

  /**
   * Calculate daily regeneration amount
   *
   * R(σ) = R_BASE × (2 - σ), clamped to [R_MIN, R_MAX]
   *
   * @param {number} sigma - Supply ratio
   * @returns {number} - Daily regen amount
   */
  calcDailyRegen(sigma) {
    return calculateDailyRegen(sigma);
  }

  /**
   * Calculate burn rate
   *
   * B(σ) = B_BASE × σ, clamped to [B_MIN, B_MAX]
   *
   * @param {number} sigma - Supply ratio
   * @returns {number} - Burn rate (0-1)
   */
  calcBurnRate(sigma) {
    return calculateBurnRate(sigma);
  }

  /**
   * Calculate settlement distribution
   *
   * @param {number} taskPrice - Task price in MP
   * @param {number} sigma - Current sigma
   * @returns {Object} - { agentEarning, burned, burnRate }
   */
  calcSettlement(taskPrice, sigma) {
    const burnRate = this.calcBurnRate(sigma);
    const burned = Math.round(taskPrice * burnRate * 100) / 100;
    const agentEarning = Math.round((taskPrice - burned) * 100) / 100;

    return {
      agentEarning,
      burned,
      burnRate
    };
  }

  /**
   * Calculate user's daily regeneration amount
   *
   * Accounts for:
   * - Balance cap (no regen if balance >= 200)
   * - Newbie period (half regen for first 3 days)
   *
   * @param {number} sigma - Current sigma
   * @param {Date} createdAt - User account creation date
   * @param {number} currentBalance - User's current balance
   * @returns {number} - Regeneration amount for this user
   */
  calcUserRegen(sigma, createdAt, currentBalance) {
    // No regen if at or above cap
    if (currentBalance >= ECONOMY.BALANCE_CAP) {
      return 0;
    }

    let baseRegen = this.calcDailyRegen(sigma);

    // Check newbie status
    const accountAge = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (accountAge < ECONOMY.NEWBIE_DAYS) {
      baseRegen = Math.round(baseRegen * ECONOMY.NEWBIE_REGEN_MULTIPLIER);
    }

    // Cap regen so user doesn't exceed BALANCE_CAP
    const maxRegen = ECONOMY.BALANCE_CAP - currentBalance;
    return Math.min(baseRegen, maxRegen);
  }

  // ============================================
  // Database Methods
  // ============================================

  /**
   * Get active user metrics from database
   *
   * Active users = users with activity in last ACTIVE_WINDOW_DAYS
   *
   * @returns {Promise<Object>} - { activeUsers, totalActiveMP, totalSupply }
   */
  async getEconomyMetrics() {
    const windowDays = ECONOMY.ACTIVE_WINDOW_DAYS;

    // Run both queries in parallel for better performance
    const activeUsersPromise = new Promise((resolve, reject) => {
      // Query to get active users and their total MP
      // Active = has wallet transaction in last N days
      const sql = `
        WITH active_wallets AS (
          SELECT DISTINCT w.id, w.owner_id, w.balance
          FROM wallets w
          WHERE w.currency_code = 'MP'
            AND w.owner_type IN ('client', 'agent')
            AND EXISTS (
              SELECT 1 FROM wallet_transactions wt
              WHERE wt.wallet_id = w.id
                AND wt.created_at > NOW() - INTERVAL '${windowDays} days'
            )
        )
        SELECT
          COUNT(DISTINCT owner_id) as active_users,
          COALESCE(SUM(balance), 0) as total_active_mp
        FROM active_wallets
      `;

      this.db.get(sql, [], (err, result) => {
        if (err) {
          console.error('[EconomyEngine] Failed to get active metrics:', err);
          return reject(err);
        }
        resolve(result);
      });
    });

    const totalSupplyPromise = new Promise((resolve, reject) => {
      // Get total supply (all MP in circulation)
      this.db.get(`
        SELECT COALESCE(SUM(balance + frozen_balance), 0) as total_supply
        FROM wallets
        WHERE currency_code = 'MP' AND owner_type IN ('client', 'agent')
      `, [], (err, result) => {
        if (err) {
          console.error('[EconomyEngine] Failed to get total supply:', err);
          return reject(err);
        }
        resolve(result);
      });
    });

    // Execute both queries in parallel
    const [activeResult, supplyResult] = await Promise.all([
      activeUsersPromise,
      totalSupplyPromise
    ]);

    return {
      activeUsers: activeResult?.active_users || 0,
      totalActiveMP: activeResult?.total_active_mp || 0,
      totalSupply: supplyResult?.total_supply || 0
    };
  }

  /**
   * Get the most recent sigma from economy_log for EMA continuity
   *
   * @returns {Promise<number|null>} - Last sigma or null
   */
  async getLastSigma() {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT sigma FROM economy_log
        ORDER BY date DESC LIMIT 1
      `, [], (err, row) => {
        if (err) {
          console.error('[EconomyEngine] Failed to get last sigma:', err);
          return reject(err);
        }
        resolve(row ? parseFloat(row.sigma) : null);
      });
    });
  }

  /**
   * Get current economy parameters
   *
   * This is the main method to get all current economic values
   *
   * @returns {Promise<Object>} - Full economy state
   */
  async getEconomyParams() {
    // Get metrics from database
    const metrics = await this.getEconomyMetrics();

    // Load last sigma for EMA continuity
    if (this.lastSigma === null) {
      this.lastSigma = await this.getLastSigma();
    }

    // Calculate sigma
    const sigmaRaw = this.calcSupplyRatioRaw(metrics.totalActiveMP, metrics.activeUsers);
    const sigma = this.applySmoothingSigma(sigmaRaw);

    // Calculate derived values
    const dailyRegen = this.calcDailyRegen(sigma);
    const burnRate = this.calcBurnRate(sigma);
    const status = getEconomyStatus(sigma);

    return {
      // Core values
      sigma,
      sigmaRaw,
      dailyRegen,
      burnRate,
      status,

      // Metrics
      metrics: {
        activeUsers: metrics.activeUsers,
        totalActiveMP: metrics.totalActiveMP,
        totalSupply: metrics.totalSupply,
        targetPerUser: ECONOMY.TARGET_PER_USER
      },

      // Config (for reference)
      config: {
        rBase: ECONOMY.R_BASE,
        bBase: ECONOMY.B_BASE,
        rRange: [ECONOMY.R_MIN, ECONOMY.R_MAX],
        bRange: [ECONOMY.B_MIN, ECONOMY.B_MAX],
        balanceCap: ECONOMY.BALANCE_CAP
      }
    };
  }

  /**
   * Record daily economy snapshot to economy_log
   *
   * @param {Object} params - Economy parameters
   * @param {number} minted - Amount minted today
   * @param {number} burned - Amount burned today
   * @returns {Promise<Object>} - Inserted record
   */
  async recordDailySnapshot(params, minted = 0, burned = 0) {
    const id = `eco_${uuidv4()}`;
    const today = new Date().toISOString().split('T')[0];

    return new Promise((resolve, reject) => {
      // Use upsert to handle re-runs on the same day
      this.db.run(`
        INSERT INTO economy_log
          (id, date, sigma, sigma_raw, daily_regen, burn_rate,
           active_users, total_active_mp, total_supply,
           total_minted, total_burned, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (date) DO UPDATE SET
          sigma = EXCLUDED.sigma,
          sigma_raw = EXCLUDED.sigma_raw,
          daily_regen = EXCLUDED.daily_regen,
          burn_rate = EXCLUDED.burn_rate,
          active_users = EXCLUDED.active_users,
          total_active_mp = EXCLUDED.total_active_mp,
          total_supply = EXCLUDED.total_supply,
          total_minted = economy_log.total_minted + EXCLUDED.total_minted,
          total_burned = economy_log.total_burned + EXCLUDED.total_burned,
          status = EXCLUDED.status
      `, [
        id,
        today,
        params.sigma.toFixed(3),
        params.sigmaRaw.toFixed(3),
        params.dailyRegen,
        params.burnRate.toFixed(3),
        params.metrics.activeUsers,
        params.metrics.totalActiveMP,
        params.metrics.totalSupply,
        minted,
        burned,
        params.status
      ], function(err) {
        if (err) {
          console.error('[EconomyEngine] Failed to record snapshot:', err);
          return reject(err);
        }
        resolve({ id, date: today, ...params, minted, burned });
      });
    });
  }

  /**
   * Record a settlement
   *
   * @param {string} taskId - Task ID
   * @param {number} taskPrice - Original price
   * @param {number} agentEarning - Agent's earning
   * @param {number} burned - Amount burned
   * @param {number} burnRate - Burn rate used
   * @param {number} sigma - Sigma at settlement time
   * @param {number} judgeReward - Judge reward (if any)
   * @returns {Promise<Object>} - Settlement record
   */
  async recordSettlement(taskId, taskPrice, agentEarning, burned, burnRate, sigma, judgeReward = 0) {
    const id = `stl_${uuidv4()}`;

    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO settlements
          (id, task_id, task_price, agent_earning, burned, burn_rate, sigma_at_settlement, judge_reward)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, taskId, taskPrice, agentEarning, burned, burnRate.toFixed(3), sigma.toFixed(3), judgeReward],
      function(err) {
        if (err) {
          console.error('[EconomyEngine] Failed to record settlement:', err);
          return reject(err);
        }
        resolve({
          id,
          taskId,
          taskPrice,
          agentEarning,
          burned,
          burnRate,
          sigma,
          judgeReward
        });
      });
    });
  }

  /**
   * Get economy history
   *
   * @param {number} days - Number of days to retrieve
   * @returns {Promise<Array>} - Array of daily records
   */
  async getHistory(days = 30) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM economy_log
        ORDER BY date DESC
        LIMIT ?
      `, [days], (err, rows) => {
        if (err) {
          console.error('[EconomyEngine] Failed to get history:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get settlement history
   *
   * @param {number} limit - Number of records
   * @returns {Promise<Array>} - Array of settlement records
   */
  async getSettlements(limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT s.*, t.title as task_title
        FROM settlements s
        LEFT JOIN tasks t ON s.task_id = t.id
        ORDER BY s.created_at DESC
        LIMIT ?
      `, [limit], (err, rows) => {
        if (err) {
          console.error('[EconomyEngine] Failed to get settlements:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get users eligible for daily regeneration
   *
   * Criteria:
   * - Has MP wallet
   * - Balance < BALANCE_CAP
   * - Has been active in ACTIVE_WINDOW_DAYS
   *
   * @returns {Promise<Array>} - Array of eligible users
   */
  async getRegenEligibleUsers() {
    const windowDays = ECONOMY.ACTIVE_WINDOW_DAYS;
    const balanceCap = ECONOMY.BALANCE_CAP;

    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT
          w.id as wallet_id,
          w.owner_id,
          w.owner_type,
          w.balance,
          COALESCE(c.created_at, a.created_at) as account_created_at
        FROM wallets w
        LEFT JOIN clients c ON w.owner_type = 'client' AND w.owner_id = c.id
        LEFT JOIN agents a ON w.owner_type = 'agent' AND w.owner_id = a.id
        WHERE w.currency_code = 'MP'
          AND w.owner_type IN ('client', 'agent')
          AND w.balance < ?
          AND EXISTS (
            SELECT 1 FROM wallet_transactions wt
            WHERE wt.wallet_id = w.id
              AND wt.created_at > NOW() - INTERVAL '${windowDays} days'
          )
      `, [balanceCap], (err, rows) => {
        if (err) {
          console.error('[EconomyEngine] Failed to get eligible users:', err);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = EconomyEngine;
