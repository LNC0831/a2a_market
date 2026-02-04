/**
 * Daily Regeneration Job
 *
 * Handles daily A2C regeneration for active users.
 * Runs every hour, but only executes regeneration once per day.
 *
 * Regeneration rules:
 * - Only active users (activity within 7 days) receive regen
 * - Users at or above balance cap (200) don't receive regen
 * - New users (< 3 days) receive half regeneration
 * - Amount is based on current sigma: R = 20 × (2 - σ)
 */

const { v4: uuidv4 } = require('uuid');
const EconomyEngine = require('../services/EconomyEngine');
const WalletService = require('../services/walletService');
const { ECONOMY } = require('../config/economy');

class DailyRegenJob {
  constructor(db) {
    this.db = db;
    this.economyEngine = new EconomyEngine(db);
    this.walletService = new WalletService(db);
    this.intervalId = null;
    this.isRunning = false;
    this.lastRunDate = null;
  }

  /**
   * Start the job with specified interval
   *
   * @param {number} intervalMs - Check interval in milliseconds (default: 1 hour)
   */
  start(intervalMs = 3600000) {
    if (this.intervalId) {
      console.log('[DailyRegenJob] Already running');
      return;
    }

    console.log(`🔄 DailyRegenJob started, checking every ${intervalMs / 1000 / 60} minutes`);

    // Check immediately on start
    this.checkAndRun();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.checkAndRun();
    }, intervalMs);
  }

  /**
   * Stop the job
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 DailyRegenJob stopped');
    }
  }

  /**
   * Check if we should run today and execute if needed
   */
  async checkAndRun() {
    const today = new Date().toISOString().split('T')[0];

    // Only run once per day
    if (this.lastRunDate === today) {
      return;
    }

    // Check if we've already run today (from database)
    const alreadyRan = await this.hasRunToday(today);
    if (alreadyRan) {
      this.lastRunDate = today;
      return;
    }

    // Run the regeneration
    try {
      await this.runRegeneration();
      this.lastRunDate = today;
    } catch (err) {
      console.error('[DailyRegenJob] Regeneration failed:', err);
    }
  }

  /**
   * Check if regeneration has already run today
   *
   * @param {string} date - Date string YYYY-MM-DD
   * @returns {Promise<boolean>}
   */
  async hasRunToday(date) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT 1 FROM economy_log WHERE date = ? AND total_minted > 0',
        [date],
        (err, row) => {
          if (err) {
            console.error('[DailyRegenJob] Failed to check run status:', err);
            return resolve(false); // Err on side of running
          }
          resolve(!!row);
        }
      );
    });
  }

  /**
   * Main regeneration logic
   */
  async runRegeneration() {
    if (this.isRunning) {
      console.log('[DailyRegenJob] Previous run still in progress, skipping');
      return;
    }

    this.isRunning = true;
    console.log('💰 Starting daily A2C regeneration...');

    try {
      // 1. Get current economy parameters
      const params = await this.economyEngine.getEconomyParams();
      console.log(`  σ = ${params.sigma.toFixed(3)}, R = ${params.dailyRegen}, B = ${(params.burnRate * 100).toFixed(1)}%`);
      console.log(`  Active users: ${params.metrics.activeUsers}, Status: ${params.status}`);

      // 2. Get eligible users
      const eligibleUsers = await this.economyEngine.getRegenEligibleUsers();
      console.log(`  Eligible for regen: ${eligibleUsers.length} users`);

      if (eligibleUsers.length === 0) {
        console.log('  No eligible users, recording snapshot only');
        await this.economyEngine.recordDailySnapshot(params, 0, 0);
        return;
      }

      // 3. Process regeneration for each user
      let totalMinted = 0;
      let processedCount = 0;
      let skippedCount = 0;

      for (const user of eligibleUsers) {
        try {
          const regenAmount = this.economyEngine.calcUserRegen(
            params.sigma,
            user.account_created_at,
            user.balance
          );

          if (regenAmount <= 0) {
            skippedCount++;
            continue;
          }

          // Add balance to user's wallet
          await this.walletService.addBalance(
            user.wallet_id,
            regenAmount,
            'bonus',
            `Daily regeneration (σ=${params.sigma.toFixed(2)}, R=${params.dailyRegen})`,
            { source: 'daily_regen', sigma: params.sigma }
          );

          totalMinted += regenAmount;
          processedCount++;
        } catch (userErr) {
          console.error(`  Failed to process user ${user.owner_id}:`, userErr.message);
        }
      }

      console.log(`  ✅ Regeneration complete: ${processedCount} users, ${totalMinted} A2C minted`);
      if (skippedCount > 0) {
        console.log(`  ⏭️ Skipped ${skippedCount} users (at cap or zero regen)`);
      }

      // 4. Get today's burn total (from settlements)
      const burnedToday = await this.getTodaysBurnTotal();

      // 5. Record daily snapshot
      await this.economyEngine.recordDailySnapshot(params, totalMinted, burnedToday);
      console.log(`  📊 Daily snapshot recorded (minted: ${totalMinted}, burned: ${burnedToday})`);

    } catch (err) {
      console.error('[DailyRegenJob] Error during regeneration:', err);
      throw err;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get total A2C burned today from settlements
   *
   * @returns {Promise<number>}
   */
  async getTodaysBurnTotal() {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT COALESCE(SUM(burned), 0) as total_burned
        FROM settlements
        WHERE DATE(created_at) = DATE(NOW())
      `, [], (err, row) => {
        if (err) {
          console.error('[DailyRegenJob] Failed to get burn total:', err);
          return resolve(0);
        }
        resolve(row?.total_burned || 0);
      });
    });
  }

  /**
   * Force run regeneration (for testing/admin)
   */
  async forceRun() {
    console.log('[DailyRegenJob] Force running regeneration...');
    this.lastRunDate = null; // Clear cached date
    await this.runRegeneration();
  }

  /**
   * Get job status
   *
   * @returns {Object}
   */
  getStatus() {
    return {
      running: !!this.intervalId,
      processing: this.isRunning,
      lastRunDate: this.lastRunDate
    };
  }
}

module.exports = DailyRegenJob;
