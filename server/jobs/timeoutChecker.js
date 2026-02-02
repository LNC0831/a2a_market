/**
 * 超时检查后台任务
 *
 * 定期检查以下情况:
 * 1. 超时未提交的任务 - 自动释放回任务池，扣除信用分
 * 2. 重提交截止时间过期的任务 - 自动释放回任务池
 * 3. 停权到期的 Agent - 自动解除停权
 *
 * 默认每分钟运行一次
 */

const { CreditSystem } = require('../services/creditSystem');
const { v4: uuidv4 } = require('uuid');

class TimeoutChecker {
  constructor(db) {
    this.db = db;
    this.creditSystem = new CreditSystem(db);
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * 启动定时任务
   * @param {number} intervalMs - 检查间隔 (毫秒)，默认 60000 (1分钟)
   */
  start(intervalMs = 60000) {
    if (this.intervalId) {
      console.log('TimeoutChecker already running');
      return;
    }

    console.log(`🕐 TimeoutChecker 已启动，检查间隔: ${intervalMs / 1000}秒`);

    // 立即执行一次
    this.runChecks();

    // 设置定时任务
    this.intervalId = setInterval(() => {
      this.runChecks();
    }, intervalMs);
  }

  /**
   * 停止定时任务
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 TimeoutChecker 已停止');
    }
  }

  /**
   * 运行所有检查
   */
  async runChecks() {
    if (this.isRunning) {
      console.log('TimeoutChecker: 上一次检查尚未完成，跳过');
      return;
    }

    this.isRunning = true;

    try {
      await Promise.all([
        this.checkTimeouts(),
        this.checkResubmitDeadlines(),
        this.checkSuspensionExpiry()
      ]);
    } catch (err) {
      console.error('TimeoutChecker error:', err);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 检查超时任务
   * 状态为 'claimed' 且超过 deadline 的任务
   */
  checkTimeouts() {
    return new Promise((resolve) => {
      this.db.all(
        `SELECT id, agent_id, title FROM tasks
         WHERE status = 'claimed'
         AND deadline IS NOT NULL
         AND datetime(deadline) < datetime('now')`,
        [],
        async (err, tasks) => {
          if (err) {
            console.error('checkTimeouts error:', err);
            return resolve();
          }

          if (tasks.length === 0) {
            return resolve();
          }

          console.log(`⏰ 发现 ${tasks.length} 个超时任务`);

          for (const task of tasks) {
            try {
              await this.handleTimeout(task);
            } catch (err) {
              console.error(`Failed to handle timeout for task ${task.id}:`, err);
            }
          }

          resolve();
        }
      );
    });
  }

  /**
   * 处理单个超时任务
   */
  handleTimeout(task) {
    return new Promise((resolve, reject) => {
      const agentId = task.agent_id;

      // 释放任务回池
      this.db.run(
        `UPDATE tasks SET
           status = 'open',
           agent_id = NULL,
           claimed_at = NULL,
           submitted_at = NULL
         WHERE id = ?`,
        [task.id],
        (err) => {
          if (err) return reject(err);

          // 记录事件
          const eventId = uuidv4();
          this.db.run(
            `INSERT INTO task_events (id, task_id, event, actor_id, actor_type, details, created_at)
             VALUES (?, ?, 'timeout', 'system', 'system', ?, datetime('now'))`,
            [eventId, task.id, JSON.stringify({ reason: 'Task deadline exceeded' })]
          );

          console.log(`  📤 任务 "${task.title}" 已释放回池 (超时)`);

          // 扣除 Agent 信用分
          if (agentId) {
            this.creditSystem.handleTimeout(agentId, task.id)
              .then(() => {
                console.log(`  💔 Agent ${agentId} 信用分 -10 (超时)`);
                resolve();
              })
              .catch(err => {
                console.error(`Failed to deduct credit for agent ${agentId}:`, err);
                resolve();
              });
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * 检查重提交截止时间过期的任务
   * 状态为 'rejected' 且超过 resubmit_deadline 的任务
   */
  checkResubmitDeadlines() {
    return new Promise((resolve) => {
      this.db.all(
        `SELECT id, agent_id, title FROM tasks
         WHERE status = 'rejected'
         AND resubmit_deadline IS NOT NULL
         AND datetime(resubmit_deadline) < datetime('now')`,
        [],
        async (err, tasks) => {
          if (err) {
            console.error('checkResubmitDeadlines error:', err);
            return resolve();
          }

          if (tasks.length === 0) {
            return resolve();
          }

          console.log(`⏰ 发现 ${tasks.length} 个重提交截止的任务`);

          for (const task of tasks) {
            try {
              await this.handleResubmitExpiry(task);
            } catch (err) {
              console.error(`Failed to handle resubmit expiry for task ${task.id}:`, err);
            }
          }

          resolve();
        }
      );
    });
  }

  /**
   * 处理重提交截止过期的任务
   */
  handleResubmitExpiry(task) {
    return new Promise((resolve, reject) => {
      // 释放任务回池
      this.db.run(
        `UPDATE tasks SET
           status = 'open',
           agent_id = NULL,
           claimed_at = NULL,
           submitted_at = NULL,
           resubmit_deadline = NULL
         WHERE id = ?`,
        [task.id],
        (err) => {
          if (err) return reject(err);

          // 记录事件
          const eventId = uuidv4();
          this.db.run(
            `INSERT INTO task_events (id, task_id, event, actor_id, actor_type, details, created_at)
             VALUES (?, ?, 'resubmit_expired', 'system', 'system', ?, datetime('now'))`,
            [eventId, task.id, JSON.stringify({ reason: 'Resubmit deadline exceeded' })]
          );

          console.log(`  📤 任务 "${task.title}" 已释放回池 (重提交截止)`);
          resolve();
        }
      );
    });
  }

  /**
   * 检查停权到期的 Agent
   */
  checkSuspensionExpiry() {
    return new Promise((resolve) => {
      this.db.all(
        `SELECT id, name FROM agents
         WHERE status = 'suspended'
         AND suspension_until IS NOT NULL
         AND datetime(suspension_until) < datetime('now')`,
        [],
        async (err, agents) => {
          if (err) {
            console.error('checkSuspensionExpiry error:', err);
            return resolve();
          }

          if (agents.length === 0) {
            return resolve();
          }

          console.log(`🔓 发现 ${agents.length} 个停权到期的 Agent`);

          for (const agent of agents) {
            try {
              await this.liftAgentSuspension(agent);
            } catch (err) {
              console.error(`Failed to lift suspension for agent ${agent.id}:`, err);
            }
          }

          resolve();
        }
      );
    });
  }

  /**
   * 解除 Agent 停权
   */
  liftAgentSuspension(agent) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE agents SET
           status = 'active',
           suspension_until = NULL,
           suspension_reason = NULL
         WHERE id = ?`,
        [agent.id],
        (err) => {
          if (err) return reject(err);
          console.log(`  ✅ Agent "${agent.name}" 停权已解除`);
          resolve();
        }
      );
    });
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      running: !!this.intervalId,
      checking: this.isRunning
    };
  }
}

module.exports = TimeoutChecker;
