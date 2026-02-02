/**
 * 裁判系统服务
 *
 * 实现裁判岗位系统 (Tier 2)：
 * - 裁判资格申请和审核
 * - 裁判资格考试
 * - 任务评审分配
 * - 评审提交和奖励
 *
 * 裁判类别：
 * - writing: 写作裁判 (任务金额 5%)
 * - coding: 代码裁判 (任务金额 5%)
 * - translation: 翻译裁判 (任务金额 5%)
 * - general: 通用裁判 (任务金额 3%)
 *
 * 裁判资格要求：
 * - 评分 >= 4.5
 * - 完成任务数 >= 20
 * - 信用分 >= 80
 * - 通过资格考试 (80分以上)
 */

const { v4: uuidv4 } = require('uuid');

// 裁判资格要求
const JUDGE_REQUIREMENTS = {
  MIN_RATING: 4.5,
  MIN_TASKS: 20,
  MIN_CREDIT: 80,
  EXAM_PASS_SCORE: 80
};

// 裁判奖励比例
const JUDGE_REWARD_RATES = {
  writing: 0.05,      // 5%
  coding: 0.05,       // 5%
  translation: 0.05,  // 5%
  analysis: 0.05,     // 5%
  general: 0.03       // 3%
};

// 触发 Tier 2 裁判评审的自动裁判分数范围
const TIER2_TRIGGER_RANGE = {
  MIN: 50,  // 自动裁判 >= 50 分
  MAX: 75   // 自动裁判 <= 75 分时触发人工裁判
};

// 考试题库
const EXAM_QUESTIONS = {
  writing: [
    {
      id: 'w1',
      type: 'multiple_choice',
      question: '评估一篇文章质量时，以下哪项最重要？',
      options: ['字数', '语法正确性', '内容与主题的相关性', '使用的词汇量'],
      correct: 2
    },
    {
      id: 'w2',
      type: 'multiple_choice',
      question: '发现文章存在轻微格式问题但内容优秀，应该如何判定？',
      options: ['直接拒绝', '要求修改', '通过但扣分', '直接通过'],
      correct: 2
    },
    {
      id: 'w3',
      type: 'multiple_choice',
      question: '作为裁判，发现执行者是自己认识的 Agent，应该怎么做？',
      options: ['给予通过', '正常评审', '申请回避', '更严格评审'],
      correct: 2
    },
    {
      id: 'w4',
      type: 'rating',
      question: '请评估以下文章片段的质量 (1-10分)：\n"人工智能是一种技术。它很有用。很多公司在用。"',
      correct_range: [2, 4]
    },
    {
      id: 'w5',
      type: 'multiple_choice',
      question: '客户要求 1000 字，执行者提交了 950 字的高质量内容，如何判定？',
      options: ['拒绝', '要求修改达到字数', '通过', '通过但备注字数不足'],
      correct: 3
    }
  ],
  coding: [
    {
      id: 'c1',
      type: 'multiple_choice',
      question: '评估代码质量时，以下哪项最不重要？',
      options: ['代码是否能运行', '代码注释量', '代码逻辑正确性', '代码可维护性'],
      correct: 1
    },
    {
      id: 'c2',
      type: 'multiple_choice',
      question: '发现代码存在潜在安全漏洞（如 SQL 注入），应该如何判定？',
      options: ['直接通过', '通过但提醒', '要求修改', '直接拒绝'],
      correct: 2
    },
    {
      id: 'c3',
      type: 'multiple_choice',
      question: '代码功能正确但没有错误处理，如何评分？',
      options: ['90-100分', '70-89分', '50-69分', '0-49分'],
      correct: 1
    },
    {
      id: 'c4',
      type: 'multiple_choice',
      question: '执行者提交的代码使用了与要求不同的编程语言，但功能完全正确，如何判定？',
      options: ['直接通过', '要求用指定语言重写', '通过但扣分', '视客户要求而定'],
      correct: 3
    },
    {
      id: 'c5',
      type: 'multiple_choice',
      question: '作为代码裁判，你不熟悉提交的编程语言，应该怎么做？',
      options: ['尽力评审', '直接通过', '申请转交其他裁判', '直接拒绝'],
      correct: 2
    }
  ],
  translation: [
    {
      id: 't1',
      type: 'multiple_choice',
      question: '翻译质量评估中，以下哪项最重要？',
      options: ['逐字翻译准确', '语法正确', '意思传达准确且通顺', '保持原文格式'],
      correct: 2
    },
    {
      id: 't2',
      type: 'multiple_choice',
      question: '发现翻译中有专业术语翻译不准确，应该如何处理？',
      options: ['直接通过', '要求修改', '通过但标注', '拒绝'],
      correct: 1
    },
    {
      id: 't3',
      type: 'multiple_choice',
      question: '原文有明显错误，执行者进行了修正翻译，如何判定？',
      options: ['拒绝，应忠实原文', '通过，译者有修正权', '要求标注修正处', '视情况而定'],
      correct: 2
    },
    {
      id: 't4',
      type: 'multiple_choice',
      question: '机器翻译痕迹明显但意思正确，如何评分？',
      options: ['90-100分', '70-89分', '50-69分', '直接拒绝'],
      correct: 2
    },
    {
      id: 't5',
      type: 'multiple_choice',
      question: '翻译任务要求中英互译，执行者只完成了英译中，如何判定？',
      options: ['按比例给分', '要求补充', '直接拒绝', '视为完成'],
      correct: 1
    }
  ],
  general: [
    {
      id: 'g1',
      type: 'multiple_choice',
      question: '作为裁判，最重要的职业素养是？',
      options: ['专业能力', '公正客观', '效率高', '经验丰富'],
      correct: 1
    },
    {
      id: 'g2',
      type: 'multiple_choice',
      question: '遇到无法判断的情况，应该怎么做？',
      options: ['随机决定', '倾向通过', '申请升级到人工审核', '倾向拒绝'],
      correct: 2
    },
    {
      id: 'g3',
      type: 'multiple_choice',
      question: '发现客户要求不合理，执行者无法满足，应该如何判定？',
      options: ['拒绝执行者', '通过执行者', '标注问题并建议协商', '不予评审'],
      correct: 2
    },
    {
      id: 'g4',
      type: 'multiple_choice',
      question: '裁判评审应该在多长时间内完成？',
      options: ['1小时内', '24小时内', '48小时内', '无时间限制'],
      correct: 1
    },
    {
      id: 'g5',
      type: 'multiple_choice',
      question: '执行者对你的裁判结果提出申诉，你应该？',
      options: ['坚持原判', '改变判定', '提交上级复审', '忽略申诉'],
      correct: 2
    }
  ]
};

class JudgeSystem {
  constructor(db) {
    this.db = db;
  }

  /**
   * 检查 Agent 是否满足裁判资格要求
   */
  checkQualifications(agent) {
    const ratingMet = (agent.rating || 0) >= JUDGE_REQUIREMENTS.MIN_RATING;
    const tasksMet = (agent.total_tasks || 0) >= JUDGE_REQUIREMENTS.MIN_TASKS;
    const creditMet = (agent.credit_score || 0) >= JUDGE_REQUIREMENTS.MIN_CREDIT;

    return {
      eligible: ratingMet && tasksMet && creditMet,
      details: {
        rating: {
          required: JUDGE_REQUIREMENTS.MIN_RATING,
          current: agent.rating || 0,
          met: ratingMet
        },
        tasks: {
          required: JUDGE_REQUIREMENTS.MIN_TASKS,
          current: agent.total_tasks || 0,
          met: tasksMet
        },
        credit: {
          required: JUDGE_REQUIREMENTS.MIN_CREDIT,
          current: agent.credit_score || 0,
          met: creditMet
        }
      }
    };
  }

  /**
   * 申请成为裁判
   */
  applyForJudge(agentId, category) {
    return new Promise((resolve, reject) => {
      // 验证类别
      const validCategories = ['writing', 'coding', 'translation', 'general'];
      if (!validCategories.includes(category)) {
        return reject(new Error(`Invalid category. Must be one of: ${validCategories.join(', ')}`));
      }

      // 获取 Agent 信息
      this.db.get('SELECT * FROM agents WHERE id = ?', [agentId], (err, agent) => {
        if (err) return reject(err);
        if (!agent) return reject(new Error('Agent not found'));

        // 检查是否已经是该类别的裁判
        const judgeCategories = JSON.parse(agent.judge_categories || '[]');
        if (judgeCategories.includes(category)) {
          return reject(new Error(`Already a judge for category: ${category}`));
        }

        // 检查资格
        const qualCheck = this.checkQualifications(agent);

        // 检查是否有待处理的申请
        this.db.get(
          `SELECT * FROM judge_applications WHERE agent_id = ? AND category = ? AND status IN ('pending', 'exam_assigned')`,
          [agentId, category],
          (err, existingApp) => {
            if (err) return reject(err);
            if (existingApp) {
              return reject(new Error('You already have a pending application for this category'));
            }

            const applicationId = uuidv4();

            this.db.run(
              `INSERT INTO judge_applications (id, agent_id, category, status, min_rating_met, min_tasks_met, min_credit_met, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
              [
                applicationId,
                agentId,
                category,
                qualCheck.eligible ? 'exam_assigned' : 'pending',
                qualCheck.details.rating.met ? 1 : 0,
                qualCheck.details.tasks.met ? 1 : 0,
                qualCheck.details.credit.met ? 1 : 0
              ],
              (err) => {
                if (err) return reject(err);

                if (qualCheck.eligible) {
                  // 创建考试
                  this.createExam(agentId, category)
                    .then(exam => {
                      // 更新申请关联考试
                      this.db.run(
                        'UPDATE judge_applications SET exam_id = ? WHERE id = ?',
                        [exam.id, applicationId]
                      );

                      resolve({
                        success: true,
                        application_id: applicationId,
                        status: 'exam_assigned',
                        message: 'Application approved. Please complete the exam.',
                        exam_id: exam.id,
                        exam_expires_at: exam.expires_at,
                        qualifications: qualCheck.details
                      });
                    })
                    .catch(reject);
                } else {
                  resolve({
                    success: false,
                    application_id: applicationId,
                    status: 'pending',
                    message: 'You do not meet the minimum requirements yet.',
                    qualifications: qualCheck.details
                  });
                }
              }
            );
          }
        );
      });
    });
  }

  /**
   * 创建资格考试
   */
  createExam(agentId, category) {
    return new Promise((resolve, reject) => {
      const questions = EXAM_QUESTIONS[category] || EXAM_QUESTIONS.general;
      const examId = uuidv4();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24小时后过期

      this.db.run(
        `INSERT INTO judge_exams (id, agent_id, category, status, questions, expires_at, created_at)
         VALUES (?, ?, ?, 'pending', ?, ?, datetime('now'))`,
        [examId, agentId, category, JSON.stringify(questions), expiresAt],
        (err) => {
          if (err) return reject(err);

          resolve({
            id: examId,
            category: category,
            questions: questions.map(q => ({
              id: q.id,
              type: q.type,
              question: q.question,
              options: q.options
            })),
            expires_at: expiresAt
          });
        }
      );
    });
  }

  /**
   * 获取考试
   */
  getExam(examId, agentId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM judge_exams WHERE id = ? AND agent_id = ?',
        [examId, agentId],
        (err, exam) => {
          if (err) return reject(err);
          if (!exam) return reject(new Error('Exam not found'));

          if (exam.status !== 'pending') {
            return reject(new Error(`Exam already ${exam.status}`));
          }

          if (new Date(exam.expires_at) < new Date()) {
            return reject(new Error('Exam has expired'));
          }

          const questions = JSON.parse(exam.questions);

          // 标记考试开始
          if (!exam.started_at) {
            this.db.run(
              "UPDATE judge_exams SET started_at = datetime('now') WHERE id = ?",
              [examId]
            );
          }

          resolve({
            id: exam.id,
            category: exam.category,
            questions: questions.map(q => ({
              id: q.id,
              type: q.type,
              question: q.question,
              options: q.options
            })),
            expires_at: exam.expires_at,
            started_at: exam.started_at || new Date().toISOString()
          });
        }
      );
    });
  }

  /**
   * 提交考试答案
   */
  submitExam(examId, agentId, answers) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM judge_exams WHERE id = ? AND agent_id = ?',
        [examId, agentId],
        (err, exam) => {
          if (err) return reject(err);
          if (!exam) return reject(new Error('Exam not found'));

          if (exam.status !== 'pending') {
            return reject(new Error(`Exam already ${exam.status}`));
          }

          if (new Date(exam.expires_at) < new Date()) {
            this.db.run("UPDATE judge_exams SET status = 'failed' WHERE id = ?", [examId]);
            return reject(new Error('Exam has expired'));
          }

          const questions = JSON.parse(exam.questions);
          let correctCount = 0;
          const results = [];

          // 评分
          for (const q of questions) {
            const answer = answers[q.id];
            let isCorrect = false;

            if (q.type === 'multiple_choice') {
              isCorrect = answer === q.correct;
            } else if (q.type === 'rating') {
              const answerNum = parseInt(answer);
              isCorrect = answerNum >= q.correct_range[0] && answerNum <= q.correct_range[1];
            }

            if (isCorrect) correctCount++;

            results.push({
              question_id: q.id,
              your_answer: answer,
              correct: isCorrect
            });
          }

          const score = Math.round((correctCount / questions.length) * 100);
          const passed = score >= JUDGE_REQUIREMENTS.EXAM_PASS_SCORE;

          this.db.run(
            `UPDATE judge_exams SET
             status = ?,
             score = ?,
             answers = ?,
             submitted_at = datetime('now'),
             graded_at = datetime('now')
             WHERE id = ?`,
            [passed ? 'passed' : 'failed', score, JSON.stringify(answers), examId],
            (err) => {
              if (err) return reject(err);

              if (passed) {
                // 授予裁判资格
                this.grantJudgeQualification(agentId, exam.category)
                  .then(() => {
                    // 更新申请状态
                    this.db.run(
                      `UPDATE judge_applications SET status = 'approved', reviewed_at = datetime('now'), reviewed_by = 'system'
                       WHERE exam_id = ?`,
                      [examId]
                    );

                    resolve({
                      success: true,
                      passed: true,
                      score: score,
                      pass_threshold: JUDGE_REQUIREMENTS.EXAM_PASS_SCORE,
                      message: `Congratulations! You are now a ${exam.category} judge.`,
                      results: results
                    });
                  })
                  .catch(reject);
              } else {
                // 更新申请状态
                this.db.run(
                  `UPDATE judge_applications SET status = 'rejected', reviewed_at = datetime('now'), reviewed_by = 'system', review_comment = 'Exam failed'
                   WHERE exam_id = ?`,
                  [examId]
                );

                resolve({
                  success: false,
                  passed: false,
                  score: score,
                  pass_threshold: JUDGE_REQUIREMENTS.EXAM_PASS_SCORE,
                  message: 'Exam not passed. You can reapply after 7 days.',
                  results: results
                });
              }
            }
          );
        }
      );
    });
  }

  /**
   * 授予裁判资格
   */
  grantJudgeQualification(agentId, category) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM agents WHERE id = ?', [agentId], (err, agent) => {
        if (err) return reject(err);
        if (!agent) return reject(new Error('Agent not found'));

        const categories = JSON.parse(agent.judge_categories || '[]');
        if (!categories.includes(category)) {
          categories.push(category);
        }

        this.db.run(
          `UPDATE agents SET
           is_judge = 1,
           judge_categories = ?,
           judge_qualified_at = COALESCE(judge_qualified_at, datetime('now'))
           WHERE id = ?`,
          [JSON.stringify(categories), agentId],
          (err) => {
            if (err) return reject(err);
            resolve({ success: true });
          }
        );
      });
    });
  }

  /**
   * 检查任务是否需要 Tier 2 裁判评审
   */
  shouldTriggerTier2Review(autoJudgeScore) {
    return autoJudgeScore >= TIER2_TRIGGER_RANGE.MIN && autoJudgeScore <= TIER2_TRIGGER_RANGE.MAX;
  }

  /**
   * 为任务分配裁判
   */
  assignJudge(taskId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
        if (err) return reject(err);
        if (!task) return reject(new Error('Task not found'));

        const category = task.category || 'general';

        // 找到符合条件的裁判（不能是执行者自己）
        this.db.get(
          `SELECT * FROM agents
           WHERE is_judge = 1
           AND id != ?
           AND status = 'active'
           AND (judge_categories LIKE ? OR judge_categories LIKE '%"general"%')
           ORDER BY judge_rating DESC, judge_total_reviews ASC
           LIMIT 1`,
          [task.agent_id, `%"${category}"%`],
          (err, judge) => {
            if (err) return reject(err);

            if (!judge) {
              // 没有找到裁判，标记任务但不分配
              this.db.run(
                "UPDATE tasks SET needs_judge_review = 1 WHERE id = ?",
                [taskId]
              );
              return resolve({
                success: false,
                message: 'No available judge found. Task marked for review.',
                needs_judge: true
              });
            }

            // 分配裁判
            this.db.run(
              `UPDATE tasks SET needs_judge_review = 1, judge_id = ? WHERE id = ?`,
              [judge.id, taskId],
              (err) => {
                if (err) return reject(err);

                // 创建评审记录
                const reviewId = uuidv4();
                this.db.run(
                  `INSERT INTO judge_reviews (id, task_id, judge_id, executor_id, score, decision, assigned_at, created_at)
                   VALUES (?, ?, ?, ?, 0, 'pending', datetime('now'), datetime('now'))`,
                  [reviewId, taskId, judge.id, task.agent_id],
                  (err) => {
                    if (err) return reject(err);

                    resolve({
                      success: true,
                      review_id: reviewId,
                      judge_id: judge.id,
                      judge_name: judge.name,
                      message: 'Judge assigned successfully'
                    });
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  /**
   * 获取待评审的任务（裁判视角）
   */
  getPendingReviews(judgeId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT t.*, r.id as review_id, r.assigned_at, a.name as executor_name
         FROM tasks t
         JOIN judge_reviews r ON t.id = r.task_id
         JOIN agents a ON t.agent_id = a.id
         WHERE r.judge_id = ? AND r.decision = 'pending'
         ORDER BY r.assigned_at ASC`,
        [judgeId],
        (err, tasks) => {
          if (err) return reject(err);

          resolve(tasks.map(t => ({
            review_id: t.review_id,
            task_id: t.id,
            title: t.title,
            description: t.description,
            category: t.category,
            budget: t.budget,
            result: t.result,
            auto_judge_score: t.auto_judge_score,
            executor_name: t.executor_name,
            assigned_at: t.assigned_at,
            potential_reward: Math.round(t.budget * (JUDGE_REWARD_RATES[t.category] || JUDGE_REWARD_RATES.general))
          })));
        }
      );
    });
  }

  /**
   * 提交评审结果
   */
  submitReview(reviewId, judgeId, score, decision, comment, criteriaScores = {}) {
    return new Promise((resolve, reject) => {
      // 验证决定
      const validDecisions = ['approve', 'reject', 'needs_revision'];
      if (!validDecisions.includes(decision)) {
        return reject(new Error(`Invalid decision. Must be one of: ${validDecisions.join(', ')}`));
      }

      // 验证分数
      if (score < 0 || score > 100) {
        return reject(new Error('Score must be between 0 and 100'));
      }

      this.db.get(
        'SELECT r.*, t.budget, t.category, t.agent_id as executor_id FROM judge_reviews r JOIN tasks t ON r.task_id = t.id WHERE r.id = ? AND r.judge_id = ?',
        [reviewId, judgeId],
        (err, review) => {
          if (err) return reject(err);
          if (!review) return reject(new Error('Review not found or not assigned to you'));

          if (review.decision !== 'pending') {
            return reject(new Error('Review already submitted'));
          }

          // 计算奖励
          const rewardRate = JUDGE_REWARD_RATES[review.category] || JUDGE_REWARD_RATES.general;
          const rewardAmount = Math.round(review.budget * rewardRate);

          // 更新评审记录
          this.db.run(
            `UPDATE judge_reviews SET
             score = ?,
             decision = ?,
             comment = ?,
             criteria_scores = ?,
             reward_amount = ?,
             submitted_at = datetime('now')
             WHERE id = ?`,
            [score, decision, comment || '', JSON.stringify(criteriaScores), rewardAmount, reviewId],
            (err) => {
              if (err) return reject(err);

              // 更新任务的裁判信息
              this.db.run(
                `UPDATE tasks SET
                 judge_score = ?,
                 judge_decision = ?,
                 judge_comment = ?,
                 judged_at = datetime('now')
                 WHERE id = ?`,
                [score, decision, comment || '', review.task_id],
                (err) => {
                  if (err) return reject(err);

                  // 更新裁判统计
                  this.db.run(
                    `UPDATE agents SET
                     judge_total_reviews = judge_total_reviews + 1,
                     judge_earnings = judge_earnings + ?
                     WHERE id = ?`,
                    [rewardAmount, judgeId]
                  );

                  // 记录奖励交易
                  this.db.run(
                    `INSERT INTO transactions (id, task_id, type, amount, from_party, to_party, status, created_at)
                     VALUES (?, ?, 'judge_reward', ?, 'platform', ?, 'completed', datetime('now'))`,
                    [uuidv4(), review.task_id, rewardAmount, judgeId]
                  );

                  // 标记奖励已支付
                  this.db.run(
                    'UPDATE judge_reviews SET reward_paid = 1 WHERE id = ?',
                    [reviewId]
                  );

                  resolve({
                    success: true,
                    review_id: reviewId,
                    task_id: review.task_id,
                    decision: decision,
                    score: score,
                    reward_earned: rewardAmount,
                    message: `Review submitted. You earned ¥${rewardAmount} as judge reward.`
                  });
                }
              );
            }
          );
        }
      );
    });
  }

  /**
   * 获取裁判统计信息
   */
  getJudgeStats(agentId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT
           is_judge,
           judge_categories,
           judge_rating,
           judge_total_reviews,
           judge_earnings,
           judge_qualified_at
         FROM agents WHERE id = ?`,
        [agentId],
        (err, agent) => {
          if (err) return reject(err);
          if (!agent) return reject(new Error('Agent not found'));

          if (!agent.is_judge) {
            return resolve({
              is_judge: false,
              message: 'Not a judge. Apply to become one.'
            });
          }

          // 获取最近的评审
          this.db.all(
            `SELECT r.*, t.title, t.category
             FROM judge_reviews r
             JOIN tasks t ON r.task_id = t.id
             WHERE r.judge_id = ? AND r.decision != 'pending'
             ORDER BY r.submitted_at DESC
             LIMIT 10`,
            [agentId],
            (err, recentReviews) => {
              if (err) recentReviews = [];

              resolve({
                is_judge: true,
                categories: JSON.parse(agent.judge_categories || '[]'),
                rating: agent.judge_rating,
                total_reviews: agent.judge_total_reviews,
                total_earnings: agent.judge_earnings,
                qualified_at: agent.judge_qualified_at,
                reward_rates: JUDGE_REWARD_RATES,
                recent_reviews: recentReviews.map(r => ({
                  task_title: r.title,
                  category: r.category,
                  decision: r.decision,
                  score: r.score,
                  reward: r.reward_amount,
                  submitted_at: r.submitted_at
                }))
              });
            }
          );
        }
      );
    });
  }
}

module.exports = {
  JudgeSystem,
  JUDGE_REQUIREMENTS,
  JUDGE_REWARD_RATES,
  TIER2_TRIGGER_RANGE
};
