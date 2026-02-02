/**
 * 信用分管理系统
 *
 * 追踪 Agent 表现，实现奖惩机制
 *
 * 信用分规则：
 * - 任务完成: +5
 * - 获得5星评价: +10
 * - 首次被拒: -5
 * - 二次被拒: -15
 * - 三次被拒: -30
 * - 超时未提交: -10
 *
 * 停权阈值：
 * - 信用分 < 30: 停权 7 天
 * - 信用分 < 10: 停权 30 天
 * - 信用分 <= 0: 永久封禁
 */

const { v4: uuidv4 } = require('uuid');

// 信用分变化常量
const CREDIT_CHANGES = {
  TASK_COMPLETED: 5,
  FIVE_STAR_RATING: 10,
  FIRST_REJECTION: -5,
  SECOND_REJECTION: -15,
  THIRD_REJECTION: -30,
  TIMEOUT: -10
};

// 停权阈值
const SUSPENSION_THRESHOLDS = {
  SEVEN_DAYS: 30,    // 信用分 < 30: 停权 7 天
  THIRTY_DAYS: 10,   // 信用分 < 10: 停权 30 天
  PERMANENT: 0       // 信用分 <= 0: 永久封禁
};

class CreditSystem {
  constructor(db) {
    this.db = db;
  }

  /**
   * 修改 Agent 信用分
   * @param {string} agentId - Agent ID
   * @param {number} amount - 变化量 (正数加分，负数扣分)
   * @param {string} reason - 变化原因
   * @param {string|null} taskId - 关联任务 ID (可选)
   * @returns {Promise<{success: boolean, newBalance: number, suspended?: boolean, suspensionDays?: number}>}
   */
  modifyCredit(agentId, amount, reason, taskId = null) {
    return new Promise((resolve, reject) => {
      // 获取当前信用分
      this.db.get('SELECT credit_score FROM agents WHERE id = ?', [agentId], (err, agent) => {
        if (err) return reject(err);
        if (!agent) return reject(new Error('Agent not found'));

        const currentScore = agent.credit_score || 100;
        const newBalance = Math.max(0, currentScore + amount); // 最低为 0

        // 更新信用分
        this.db.run(
          'UPDATE agents SET credit_score = ? WHERE id = ?',
          [newBalance, agentId],
          (err) => {
            if (err) return reject(err);

            // 记录信用分变化历史
            const historyId = uuidv4();
            this.db.run(
              `INSERT INTO agent_credit_history (id, agent_id, change_amount, reason, task_id, balance_after, created_at)
               VALUES (?, ?, ?, ?, ?, ?, NOW())`,
              [historyId, agentId, amount, reason, taskId, newBalance],
              (err) => {
                if (err) console.error('Failed to record credit history:', err);
              }
            );

            // 检查是否需要停权
            this.checkSuspension(agentId, newBalance)
              .then(suspensionResult => {
                resolve({
                  success: true,
                  previousBalance: currentScore,
                  change: amount,
                  newBalance: newBalance,
                  ...suspensionResult
                });
              })
              .catch(err => {
                // 即使停权检查失败，也返回信用分更新成功
                console.error('Failed to check suspension:', err);
                resolve({
                  success: true,
                  previousBalance: currentScore,
                  change: amount,
                  newBalance: newBalance
                });
              });
          }
        );
      });
    });
  }

  /**
   * 检查是否触发停权
   * @param {string} agentId - Agent ID
   * @param {number} balance - 当前信用分
   * @returns {Promise<{suspended: boolean, suspensionDays?: number, reason?: string}>}
   */
  checkSuspension(agentId, balance) {
    return new Promise((resolve, reject) => {
      let suspensionDays = 0;
      let reason = '';

      if (balance <= SUSPENSION_THRESHOLDS.PERMANENT) {
        suspensionDays = 36500; // ~100 years = permanent
        reason = '信用分归零，永久封禁';
      } else if (balance < SUSPENSION_THRESHOLDS.THIRTY_DAYS) {
        suspensionDays = 30;
        reason = '信用分过低 (<10)，停权 30 天';
      } else if (balance < SUSPENSION_THRESHOLDS.SEVEN_DAYS) {
        suspensionDays = 7;
        reason = '信用分过低 (<30)，停权 7 天';
      }

      if (suspensionDays > 0) {
        this.db.run(
          `UPDATE agents SET
           status = 'suspended',
           suspension_until = NOW() + INTERVAL '${suspensionDays} days',
           suspension_reason = ?
           WHERE id = ?`,
          [reason, agentId],
          (err) => {
            if (err) return reject(err);
            resolve({
              suspended: true,
              suspensionDays: suspensionDays,
              reason: reason
            });
          }
        );
      } else {
        resolve({ suspended: false });
      }
    });
  }

  /**
   * 检查 Agent 是否被停权
   * @param {string} agentId - Agent ID
   * @returns {Promise<{isSuspended: boolean, suspensionUntil?: string, reason?: string}>}
   */
  checkAgentSuspension(agentId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT status, suspension_until, suspension_reason FROM agents WHERE id = ?`,
        [agentId],
        (err, agent) => {
          if (err) return reject(err);
          if (!agent) return reject(new Error('Agent not found'));

          if (agent.status === 'suspended' && agent.suspension_until) {
            const suspensionEnd = new Date(agent.suspension_until);
            const now = new Date();

            if (suspensionEnd > now) {
              resolve({
                isSuspended: true,
                suspensionUntil: agent.suspension_until,
                reason: agent.suspension_reason
              });
            } else {
              // 停权已过期，自动解除
              this.liftSuspension(agentId)
                .then(() => resolve({ isSuspended: false }))
                .catch(err => reject(err));
            }
          } else {
            resolve({ isSuspended: false });
          }
        }
      );
    });
  }

  /**
   * 解除停权
   * @param {string} agentId - Agent ID
   * @returns {Promise<{success: boolean}>}
   */
  liftSuspension(agentId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE agents SET
         status = 'active',
         suspension_until = NULL,
         suspension_reason = NULL
         WHERE id = ?`,
        [agentId],
        (err) => {
          if (err) return reject(err);
          resolve({ success: true });
        }
      );
    });
  }

  /**
   * 应用三振机制停权
   * @param {string} agentId - Agent ID
   * @param {number} days - 停权天数
   * @param {string} reason - 停权原因
   * @returns {Promise<{success: boolean}>}
   */
  applySuspension(agentId, days, reason) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE agents SET
         status = 'suspended',
         suspension_until = NOW() + INTERVAL '${days} days',
         suspension_reason = ?
         WHERE id = ?`,
        [reason, agentId],
        (err) => {
          if (err) return reject(err);
          resolve({ success: true });
        }
      );
    });
  }

  /**
   * 获取 Agent 信用分历史
   * @param {string} agentId - Agent ID
   * @param {number} limit - 返回记录数量
   * @returns {Promise<Array>}
   */
  getCreditHistory(agentId, limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT h.*, t.title as task_title
         FROM agent_credit_history h
         LEFT JOIN tasks t ON h.task_id = t.id
         WHERE h.agent_id = ?
         ORDER BY h.created_at DESC
         LIMIT ?`,
        [agentId, limit],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * 获取 Agent 信用详情
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>}
   */
  getCreditDetails(agentId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT credit_score, status, suspension_until, suspension_reason,
                timeout_count, consecutive_rejections
         FROM agents WHERE id = ?`,
        [agentId],
        (err, agent) => {
          if (err) return reject(err);
          if (!agent) return reject(new Error('Agent not found'));

          this.getCreditHistory(agentId, 20)
            .then(history => {
              resolve({
                credit_score: agent.credit_score,
                status: agent.status,
                suspension: agent.status === 'suspended' ? {
                  until: agent.suspension_until,
                  reason: agent.suspension_reason
                } : null,
                stats: {
                  timeout_count: agent.timeout_count,
                  consecutive_rejections: agent.consecutive_rejections
                },
                recent_history: history
              });
            })
            .catch(err => reject(err));
        }
      );
    });
  }

  /**
   * 任务完成时奖励信用分
   * @param {string} agentId - Agent ID
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>}
   */
  rewardTaskCompletion(agentId, taskId) {
    // 重置连续被拒次数
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE agents SET consecutive_rejections = 0 WHERE id = ?',
        [agentId],
        (err) => {
          if (err) console.error('Failed to reset consecutive_rejections:', err);
        }
      );

      this.modifyCredit(agentId, CREDIT_CHANGES.TASK_COMPLETED, '任务完成', taskId)
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * 获得5星评价时奖励信用分
   * @param {string} agentId - Agent ID
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>}
   */
  rewardFiveStarRating(agentId, taskId) {
    return this.modifyCredit(agentId, CREDIT_CHANGES.FIVE_STAR_RATING, '获得5星好评', taskId);
  }

  /**
   * 处理任务被拒 (三振机制)
   * @param {string} agentId - Agent ID
   * @param {string} taskId - Task ID
   * @param {number} rejectionCount - 当前被拒次数
   * @returns {Promise<Object>}
   */
  handleRejection(agentId, taskId, rejectionCount) {
    return new Promise((resolve, reject) => {
      let creditChange;
      let reason;
      let shouldSuspend = false;

      switch (rejectionCount) {
        case 1:
          creditChange = CREDIT_CHANGES.FIRST_REJECTION;
          reason = '任务被拒 (第1次)';
          break;
        case 2:
          creditChange = CREDIT_CHANGES.SECOND_REJECTION;
          reason = '任务被拒 (第2次)';
          break;
        case 3:
        default:
          creditChange = CREDIT_CHANGES.THIRD_REJECTION;
          reason = '任务被拒 (第3次，三振出局)';
          shouldSuspend = true;
          break;
      }

      // 更新连续被拒次数
      this.db.run(
        'UPDATE agents SET consecutive_rejections = consecutive_rejections + 1 WHERE id = ?',
        [agentId],
        (err) => {
          if (err) console.error('Failed to update consecutive_rejections:', err);
        }
      );

      this.modifyCredit(agentId, creditChange, reason, taskId)
        .then(result => {
          if (shouldSuspend) {
            // 三振出局：停权7天
            this.applySuspension(agentId, 7, '三振出局 - 同一任务连续3次被拒')
              .then(() => {
                resolve({
                  ...result,
                  threeStrikes: true,
                  suspended: true,
                  suspensionDays: 7
                });
              })
              .catch(err => {
                console.error('Failed to apply suspension:', err);
                resolve({ ...result, threeStrikes: true });
              });
          } else {
            resolve(result);
          }
        })
        .catch(reject);
    });
  }

  /**
   * 处理超时
   * @param {string} agentId - Agent ID
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>}
   */
  handleTimeout(agentId, taskId) {
    return new Promise((resolve, reject) => {
      // 更新超时次数
      this.db.run(
        'UPDATE agents SET timeout_count = timeout_count + 1 WHERE id = ?',
        [agentId],
        (err) => {
          if (err) console.error('Failed to update timeout_count:', err);
        }
      );

      this.modifyCredit(agentId, CREDIT_CHANGES.TIMEOUT, '任务超时未提交', taskId)
        .then(resolve)
        .catch(reject);
    });
  }
}

// 导出常量和类
module.exports = {
  CreditSystem,
  CREDIT_CHANGES,
  SUSPENSION_THRESHOLDS
};
