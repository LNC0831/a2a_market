/**
 * 结算配置 - Settlement Configuration
 *
 * 此文件保留向后兼容，实际任务结算现在使用动态经济系统。
 *
 * 新的结算逻辑 (Phase 8A):
 *   - Agent 获得: taskPrice × (1 - B)，B 为动态销毁率
 *   - 销毁 (Burn): taskPrice × B (不归任何人)
 *   - 裁判奖励: 固定 10 A2C (从平台账户发放，不从任务扣)
 *   - 平台收入: 通过法币充值入口盈利 (未来实现)
 *
 * 旧的固定比例保留用于:
 *   - Skill 开发者收益分成
 *   - 向后兼容的统计计算
 *   - 预估收益显示
 */

const SETTLEMENT = {
  // 旧的任务结算分成 (仅用于向后兼容和预估显示)
  // 实际结算使用 EconomyEngine.calcSettlement()
  AGENT_RATIO: 0.75,      // 预估: Agent 获得 75% (实际为 1-B, B 在 10%-40% 之间)
  PLATFORM_RATIO: 0.00,   // 平台不再从任务中抽成
  JUDGE_RATIO: 0.00,      // 裁判奖励改为固定 10 A2C

  // Skill 调用分成 (仍使用固定比例)
  SKILL_DEVELOPER_RATIO: 0.75,  // Skill 开发者获得 75%
  SKILL_PLATFORM_RATIO: 0.25,   // 平台获得 25%

  // 动态经济标记
  DYNAMIC_ECONOMY_ENABLED: true,

  // 默认销毁率 (σ=1.0 时)
  DEFAULT_BURN_RATE: 0.25,
};

/**
 * 旧的结算计算函数 (保留向后兼容)
 *
 * 注意: 实际任务结算应使用 EconomyEngine.calcSettlement()
 *
 * @param {number} amount - 任务金额
 * @param {boolean} hasJudge - 是否有裁判 (已弃用)
 * @returns {Object} - 结算分配
 */
const calculateSettlement = (amount, hasJudge = false) => {
  // 使用默认销毁率进行预估
  const burnRate = SETTLEMENT.DEFAULT_BURN_RATE;
  const burned = Math.round(amount * burnRate * 100) / 100;
  const agentAmount = Math.round((amount - burned) * 100) / 100;

  return {
    agent: agentAmount,
    platform: 0,  // 平台不再从任务中抽成
    judge: 0,     // 裁判奖励改为固定值
    burned: burned,
    burn_rate: burnRate,
    total: amount,
    note: 'This is an estimate. Actual settlement uses dynamic burn rate based on current σ.'
  };
};

/**
 * 计算预估收益 (用于任务列表显示)
 *
 * 使用默认销毁率进行预估
 *
 * @param {number} amount - 任务金额
 * @returns {number} - 预估 Agent 收益
 */
const estimateAgentEarnings = (amount) => {
  const burnRate = SETTLEMENT.DEFAULT_BURN_RATE;
  return Math.round(amount * (1 - burnRate) * 100) / 100;
};

module.exports = {
  SETTLEMENT,
  calculateSettlement,
  estimateAgentEarnings
};
