/**
 * Economy API Routes
 *
 * Provides endpoints for monitoring and managing the A2C economy system.
 * These endpoints are public for transparency.
 */

const express = require('express');
const router = express.Router();
const EconomyEngine = require('../services/EconomyEngine');
const { ECONOMY, getEconomyStatus } = require('../config/economy');

/**
 * GET /api/economy/status
 *
 * Get current economy status and parameters
 *
 * Response:
 * {
 *   current: { sigma, dailyRegen, burnRate, status, metrics },
 *   config: { r_base, b_base, target_per_user, ... },
 *   timestamp: ISO date string
 * }
 */
router.get('/economy/status', async (req, res) => {
  try {
    const economyEngine = new EconomyEngine(req.db);
    const params = await economyEngine.getEconomyParams();

    res.json({
      current: {
        sigma: parseFloat(params.sigma.toFixed(3)),
        sigma_raw: parseFloat(params.sigmaRaw.toFixed(3)),
        daily_regen: params.dailyRegen,
        burn_rate: parseFloat(params.burnRate.toFixed(3)),
        burn_rate_percent: `${(params.burnRate * 100).toFixed(1)}%`,
        agent_share_percent: `${((1 - params.burnRate) * 100).toFixed(1)}%`,
        status: params.status
      },
      metrics: {
        active_users: params.metrics.activeUsers,
        total_active_a2c: params.metrics.totalActiveA2C,
        total_supply: params.metrics.totalSupply,
        target_per_user: params.metrics.targetPerUser,
        active_window_days: ECONOMY.ACTIVE_WINDOW_DAYS
      },
      config: {
        r_base: ECONOMY.R_BASE,
        b_base: ECONOMY.B_BASE,
        r_range: [ECONOMY.R_MIN, ECONOMY.R_MAX],
        b_range: [ECONOMY.B_MIN, ECONOMY.B_MAX],
        balance_cap: ECONOMY.BALANCE_CAP,
        target_per_user: ECONOMY.TARGET_PER_USER,
        healthy_sigma_range: [ECONOMY.SIGMA_HEALTHY_MIN, ECONOMY.SIGMA_HEALTHY_MAX]
      },
      rewards: {
        human_registration_bonus: ECONOMY.HUMAN_REGISTRATION_BONUS,
        agent_registration_bonus: ECONOMY.AGENT_REGISTRATION_BONUS,
        judge_reward: ECONOMY.JUDGE_REWARD,
        five_star_bonus: ECONOMY.FIVE_STAR_BONUS
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Economy API] Status error:', err);
    res.status(500).json({ error: 'Failed to get economy status' });
  }
});

/**
 * GET /api/economy/history
 *
 * Get historical economy data
 *
 * Query params:
 * - days: Number of days to retrieve (default: 30, max: 365)
 */
router.get('/economy/history', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const economyEngine = new EconomyEngine(req.db);
    const history = await economyEngine.getHistory(days);

    res.json({
      history: history.map(h => ({
        date: h.date,
        sigma: parseFloat(h.sigma),
        daily_regen: h.daily_regen,
        burn_rate: parseFloat(h.burn_rate),
        active_users: h.active_users,
        total_minted: parseFloat(h.total_minted || 0),
        total_burned: parseFloat(h.total_burned || 0),
        status: h.status
      })),
      total: history.length,
      days_requested: days
    });
  } catch (err) {
    console.error('[Economy API] History error:', err);
    res.status(500).json({ error: 'Failed to get economy history' });
  }
});

/**
 * GET /api/economy/settlements
 *
 * Get recent settlement records
 *
 * Query params:
 * - limit: Number of records (default: 50, max: 200)
 */
router.get('/economy/settlements', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const economyEngine = new EconomyEngine(req.db);
    const settlements = await economyEngine.getSettlements(limit);

    res.json({
      settlements: settlements.map(s => ({
        id: s.id,
        task_id: s.task_id,
        task_title: s.task_title,
        task_price: parseFloat(s.task_price),
        agent_earning: parseFloat(s.agent_earning),
        burned: parseFloat(s.burned),
        burn_rate: parseFloat(s.burn_rate),
        sigma_at_settlement: parseFloat(s.sigma_at_settlement),
        judge_reward: parseFloat(s.judge_reward || 0),
        created_at: s.created_at
      })),
      total: settlements.length
    });
  } catch (err) {
    console.error('[Economy API] Settlements error:', err);
    res.status(500).json({ error: 'Failed to get settlements' });
  }
});

/**
 * GET /api/economy/formula
 *
 * Get the economic formulas and quick reference table
 * (Educational endpoint for transparency)
 */
router.get('/economy/formula', (req, res) => {
  // Generate reference table
  const referenceTable = [];
  for (let sigma = 0.5; sigma <= 2.0; sigma += 0.25) {
    const r = Math.max(ECONOMY.R_MIN, Math.min(ECONOMY.R_MAX, ECONOMY.R_BASE * (2 - sigma)));
    const b = Math.max(ECONOMY.B_MIN, Math.min(ECONOMY.B_MAX, ECONOMY.B_BASE * sigma));
    referenceTable.push({
      sigma: sigma.toFixed(2),
      daily_regen: Math.round(r),
      burn_rate: `${(b * 100).toFixed(1)}%`,
      agent_share: `${((1 - b) * 100).toFixed(1)}%`
    });
  }

  res.json({
    formulas: {
      sigma: 'σ = Σ(active_user_balances) / (active_users × TARGET_PER_USER)',
      daily_regen: 'R(σ) = R_BASE × (2 - σ), clamped to [R_MIN, R_MAX]',
      burn_rate: 'B(σ) = B_BASE × σ, clamped to [B_MIN, B_MAX]',
      agent_earning: 'Agent receives = task_price × (1 - B)',
      burned: 'Burned = task_price × B'
    },
    parameters: {
      R_BASE: ECONOMY.R_BASE,
      B_BASE: ECONOMY.B_BASE,
      TARGET_PER_USER: ECONOMY.TARGET_PER_USER,
      R_MIN: ECONOMY.R_MIN,
      R_MAX: ECONOMY.R_MAX,
      B_MIN: ECONOMY.B_MIN,
      B_MAX: ECONOMY.B_MAX
    },
    reference_table: referenceTable,
    explanation: {
      sigma_below_1: 'When σ < 1: Users have less A2C than target. R increases (more daily regen), B decreases (less burn). Economy inflates.',
      sigma_above_1: 'When σ > 1: Users have more A2C than target. R decreases (less daily regen), B increases (more burn). Economy deflates.',
      equilibrium: 'The system automatically adjusts to maintain σ ≈ 1.0 over time.'
    }
  });
});

/**
 * GET /api/economy/simulate
 *
 * Simulate settlement for a given task price
 *
 * Query params:
 * - price: Task price to simulate (required)
 */
router.get('/economy/simulate', async (req, res) => {
  try {
    const price = parseFloat(req.query.price);

    if (!price || price <= 0) {
      return res.status(400).json({ error: 'Valid price parameter required' });
    }

    const economyEngine = new EconomyEngine(req.db);
    const params = await economyEngine.getEconomyParams();
    const settlement = economyEngine.calcSettlement(price, params.sigma);

    res.json({
      input_price: price,
      current_sigma: parseFloat(params.sigma.toFixed(3)),
      settlement: {
        agent_earning: settlement.agentEarning,
        burned: settlement.burned,
        burn_rate: parseFloat(settlement.burnRate.toFixed(3)),
        burn_rate_percent: `${(settlement.burnRate * 100).toFixed(1)}%`,
        agent_share_percent: `${((1 - settlement.burnRate) * 100).toFixed(1)}%`
      },
      note: 'This is a simulation based on current σ. Actual settlement may differ if σ changes.'
    });
  } catch (err) {
    console.error('[Economy API] Simulate error:', err);
    res.status(500).json({ error: 'Failed to simulate settlement' });
  }
});

/**
 * GET /api/economy/daily-regen-preview
 *
 * Preview daily regeneration for an account
 *
 * Query params:
 * - balance: Current balance (required)
 * - days_old: Account age in days (default: 30)
 */
router.get('/economy/daily-regen-preview', async (req, res) => {
  try {
    const balance = parseFloat(req.query.balance);
    const daysOld = parseInt(req.query.days_old) || 30;

    if (balance === undefined || isNaN(balance)) {
      return res.status(400).json({ error: 'Valid balance parameter required' });
    }

    const economyEngine = new EconomyEngine(req.db);
    const params = await economyEngine.getEconomyParams();

    // Create a mock creation date
    const createdAt = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const regenAmount = economyEngine.calcUserRegen(params.sigma, createdAt, balance);

    const isNewbie = daysOld < ECONOMY.NEWBIE_DAYS;
    const isAtCap = balance >= ECONOMY.BALANCE_CAP;

    res.json({
      current_sigma: parseFloat(params.sigma.toFixed(3)),
      base_daily_regen: params.dailyRegen,
      input_balance: balance,
      account_age_days: daysOld,
      calculated_regen: regenAmount,
      status: {
        is_newbie: isNewbie,
        newbie_multiplier: isNewbie ? ECONOMY.NEWBIE_REGEN_MULTIPLIER : 1,
        is_at_cap: isAtCap,
        balance_cap: ECONOMY.BALANCE_CAP
      },
      note: isAtCap
        ? `No regeneration: balance >= ${ECONOMY.BALANCE_CAP} cap`
        : isNewbie
          ? `Newbie period: regeneration reduced by ${(1 - ECONOMY.NEWBIE_REGEN_MULTIPLIER) * 100}%`
          : 'Full regeneration eligible'
    });
  } catch (err) {
    console.error('[Economy API] Regen preview error:', err);
    res.status(500).json({ error: 'Failed to preview regeneration' });
  }
});

module.exports = router;
