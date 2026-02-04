/**
 * MP (Marketplace Points) Dynamic Economy Configuration
 *
 * This configuration controls the self-regulating economy system.
 *
 * Core Formula:
 *   σ (sigma) = Σ(active user balances) / (active users × TARGET_PER_USER)
 *
 *   R(σ) = R_BASE × (2 - σ)  clamped to [R_MIN, R_MAX]
 *   B(σ) = B_BASE × σ        clamped to [B_MIN, B_MAX]
 *
 * When σ < 1 (users have less than target):
 *   - R increases (more daily regen)
 *   - B decreases (less burned per transaction)
 *   → Economy inflates to reach equilibrium
 *
 * When σ > 1 (users have more than target):
 *   - R decreases (less daily regen)
 *   - B increases (more burned per transaction)
 *   → Economy deflates to reach equilibrium
 */

const ECONOMY = {
  // ============================================
  // Base Parameters
  // ============================================

  // Daily regeneration base (at σ = 1.0)
  R_BASE: 20,

  // Burn rate base (at σ = 1.0, 25%)
  B_BASE: 0.25,

  // Target MP per active user
  TARGET_PER_USER: 150,

  // ============================================
  // Safety Boundaries
  // ============================================

  // Daily regeneration limits
  R_MIN: 5,   // Minimum daily regen (at σ = 2.0+)
  R_MAX: 40,  // Maximum daily regen (at σ = 0.0)

  // Burn rate limits
  B_MIN: 0.10,  // Minimum burn (10%)
  B_MAX: 0.40,  // Maximum burn (40%)

  // ============================================
  // Balance Cap
  // ============================================

  // Users with balance >= BALANCE_CAP don't receive daily regen
  BALANCE_CAP: 200,

  // ============================================
  // EMA Smoothing
  // ============================================

  // Alpha coefficient for Exponential Moving Average
  // Higher = more responsive, Lower = more stable
  // σ_new = α × σ_raw + (1-α) × σ_old
  ALPHA: 0.3,

  // ============================================
  // Registration Bonuses
  // ============================================

  HUMAN_REGISTRATION_BONUS: 200,  // MP for new human clients
  AGENT_REGISTRATION_BONUS: 100,  // MP for new agent registrations

  // ============================================
  // Newbie Protection
  // ============================================

  // New accounts get half regeneration for first N days
  NEWBIE_DAYS: 3,
  NEWBIE_REGEN_MULTIPLIER: 0.5,

  // ============================================
  // Active User Definition
  // ============================================

  // Users with activity within N days are considered "active"
  ACTIVE_WINDOW_DAYS: 7,

  // ============================================
  // Health Thresholds
  // ============================================

  // Sigma values for economy health status
  SIGMA_HEALTHY_MIN: 0.7,
  SIGMA_HEALTHY_MAX: 1.3,

  // ============================================
  // Fixed Rewards (From Platform Account)
  // ============================================

  // Fixed judge reward per review (paid from platform account)
  JUDGE_REWARD: 10,

  // Bonus for receiving 5-star rating
  FIVE_STAR_BONUS: 20,
};

/**
 * Get economy status based on sigma value
 *
 * @param {number} sigma - Current sigma value
 * @returns {string} - 'healthy', 'inflated', or 'deflated'
 */
function getEconomyStatus(sigma) {
  if (sigma < ECONOMY.SIGMA_HEALTHY_MIN) {
    return 'deflated';
  } else if (sigma > ECONOMY.SIGMA_HEALTHY_MAX) {
    return 'inflated';
  }
  return 'healthy';
}

/**
 * Calculate daily regeneration from sigma
 *
 * R(σ) = R_BASE × (2 - σ), clamped to [R_MIN, R_MAX]
 *
 * @param {number} sigma - Supply ratio
 * @returns {number} - Daily regeneration amount
 */
function calculateDailyRegen(sigma) {
  const r = ECONOMY.R_BASE * (2 - sigma);
  return Math.max(ECONOMY.R_MIN, Math.min(ECONOMY.R_MAX, Math.round(r)));
}

/**
 * Calculate burn rate from sigma
 *
 * B(σ) = B_BASE × σ, clamped to [B_MIN, B_MAX]
 *
 * @param {number} sigma - Supply ratio
 * @returns {number} - Burn rate (0-1)
 */
function calculateBurnRate(sigma) {
  const b = ECONOMY.B_BASE * sigma;
  return Math.max(ECONOMY.B_MIN, Math.min(ECONOMY.B_MAX, b));
}

/**
 * Quick reference table for different sigma values
 *
 * | σ    | R   | B     | Agent Gets |
 * |------|-----|-------|------------|
 * | 0.5  | 30  | 12.5% | 87.5%      |
 * | 1.0  | 20  | 25%   | 75%        |
 * | 1.5  | 10  | 37.5% | 62.5%      |
 * | 2.0  | 5   | 40%   | 60%        |
 */

module.exports = {
  ECONOMY,
  getEconomyStatus,
  calculateDailyRegen,
  calculateBurnRate
};
