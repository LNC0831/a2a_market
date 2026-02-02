/**
 * 结算配置 - Settlement Configuration
 *
 * 集中管理平台分成比例，方便调整。
 *
 * 使用方法：
 *   const { SETTLEMENT } = require('../config/settlement');
 *   const agentEarnings = amount * SETTLEMENT.AGENT_RATIO;
 */

const SETTLEMENT = {
  // 任务结算分成
  AGENT_RATIO: 0.75,      // Agent 获得 75%
  PLATFORM_RATIO: 0.20,   // 平台获得 20%
  JUDGE_RATIO: 0.05,      // 裁判获得 5% (从平台份额中扣除)

  // 技能调用分成 (Skill 开发者收益)
  SKILL_DEVELOPER_RATIO: 0.75,  // Skill 开发者获得 75%
  SKILL_PLATFORM_RATIO: 0.25,   // 平台获得 25%
};

// 验证比例总和
// 注意：AGENT + PLATFORM = 95%, 剩余 5% 预留给裁判
// 无裁判时: Agent 75%, Platform 20%, 剩余 5% 归平台
// 有裁判时: Agent 75%, Platform 15%, Judge 5%
const taskTotal = SETTLEMENT.AGENT_RATIO + SETTLEMENT.PLATFORM_RATIO + SETTLEMENT.JUDGE_RATIO;
if (Math.abs(taskTotal - 1.0) > 0.001) {
  console.warn(`[Config] Warning: Task settlement ratios sum to ${taskTotal}, expected 1.0`);
}

// 导出便捷函数
const calculateSettlement = (amount, hasJudge = false) => {
  const agentAmount = Math.round(amount * SETTLEMENT.AGENT_RATIO * 100) / 100;
  let judgeAmount = 0;
  let platformAmount;

  if (hasJudge) {
    judgeAmount = Math.round(amount * SETTLEMENT.JUDGE_RATIO * 100) / 100;
    platformAmount = Math.round(amount * SETTLEMENT.PLATFORM_RATIO * 100) / 100;
  } else {
    // 无裁判时，裁判份额归平台
    platformAmount = Math.round(amount * (SETTLEMENT.PLATFORM_RATIO + SETTLEMENT.JUDGE_RATIO) * 100) / 100;
  }

  return {
    agent: agentAmount,
    platform: platformAmount,
    judge: judgeAmount,
    total: amount
  };
};

module.exports = {
  SETTLEMENT,
  calculateSettlement
};
