/**
 * 自动裁判 Tier 1 - 基础质量检查
 *
 * 自动检查提交结果的基本质量:
 * 1. 长度检查 - 结果不能太短
 * 2. 格式检查 - 根据任务类别检查格式
 * 3. 完整性检查 - 检查是否包含必要内容
 *
 * 评分: 0-100 分
 * - >= 60 分: 通过
 * - < 60 分: 不通过（但不阻止提交，仅作为参考）
 */

// 最小结果长度 (按类别)
const MIN_LENGTH = {
  writing: 200,     // 写作至少 200 字符
  coding: 50,       // 代码至少 50 字符
  analysis: 100,    // 分析至少 100 字符
  translation: 50,  // 翻译至少 50 字符
  general: 50,      // 通用至少 50 字符
  default: 50
};

// 格式检查规则
const FORMAT_RULES = {
  coding: {
    // 代码应该包含某些关键字
    patterns: [
      /function|def|class|const|let|var|import|export|if|for|while|return/,
    ],
    description: 'Should contain code keywords'
  },
  writing: {
    // 写作应该包含段落（换行或句号）
    patterns: [
      /\n|\r|。|\.|\?|！|!|；|;/,
    ],
    description: 'Should contain paragraphs or sentences'
  },
  analysis: {
    // 分析应该有结论或数据
    patterns: [
      /结论|conclusion|分析|analysis|结果|result|数据|data|建议|recommendation|因为|because|所以|therefore/i,
    ],
    description: 'Should contain analysis keywords'
  },
  translation: {
    // 翻译不需要特殊格式检查
    patterns: [],
    description: 'Translation format check'
  }
};

// 禁止内容检查 (安全检查)
const FORBIDDEN_PATTERNS = [
  // 空内容或占位符
  /^[\s\n\r]*$/,                    // 纯空白
  /^todo|^fixme|^placeholder/i,     // 占位符文字
  /lorem ipsum/i,                    // 测试文本
  /^test|^testing/i,                // 测试文本
];

class AutoJudge {
  constructor(db) {
    this.db = db;
  }

  /**
   * 执行质量检查
   * @param {string} taskId - 任务 ID
   * @returns {Promise<{score: number, passed: boolean, details: Object}>}
   */
  judge(taskId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM tasks WHERE id = ?',
        [taskId],
        (err, task) => {
          if (err) return reject(err);
          if (!task) return reject(new Error('Task not found'));

          const result = task.result || '';
          const category = task.category || 'general';

          // 执行各项检查
          const lengthCheck = this.checkLength(result, category);
          const formatCheck = this.checkFormat(result, category);
          const completenessCheck = this.checkCompleteness(task);
          const safetyCheck = this.checkSafety(result);

          // 计算总分 (加权平均)
          const weights = {
            length: 30,
            format: 25,
            completeness: 25,
            safety: 20
          };

          const totalScore = Math.round(
            (lengthCheck.score * weights.length +
             formatCheck.score * weights.format +
             completenessCheck.score * weights.completeness +
             safetyCheck.score * weights.safety) / 100
          );

          const passed = totalScore >= 60;

          const judgeResult = {
            score: totalScore,
            passed: passed,
            details: {
              length: {
                score: lengthCheck.score,
                weight: weights.length,
                message: lengthCheck.message,
                actual: lengthCheck.actual,
                required: lengthCheck.required
              },
              format: {
                score: formatCheck.score,
                weight: weights.format,
                message: formatCheck.message
              },
              completeness: {
                score: completenessCheck.score,
                weight: weights.completeness,
                message: completenessCheck.message
              },
              safety: {
                score: safetyCheck.score,
                weight: weights.safety,
                message: safetyCheck.message
              }
            },
            judged_at: new Date().toISOString()
          };

          // 更新任务的自动评分
          this.db.run(
            `UPDATE tasks SET auto_judge_score = ?, auto_judge_passed = ? WHERE id = ?`,
            [totalScore, passed ? 1 : 0, taskId],
            (err) => {
              if (err) console.error('Failed to update auto_judge_score:', err);
            }
          );

          resolve(judgeResult);
        }
      );
    });
  }

  /**
   * 长度检查
   * @param {string} result - 提交结果
   * @param {string} category - 任务类别
   * @returns {{score: number, message: string, actual: number, required: number}}
   */
  checkLength(result, category) {
    const minLength = MIN_LENGTH[category] || MIN_LENGTH.default;
    const actualLength = result.length;

    if (actualLength >= minLength) {
      // 长度足够，满分
      return {
        score: 100,
        message: 'Length requirement met',
        actual: actualLength,
        required: minLength
      };
    } else if (actualLength >= minLength * 0.5) {
      // 长度在 50%-100% 之间，部分得分
      const ratio = actualLength / minLength;
      return {
        score: Math.round(ratio * 100),
        message: 'Length is below minimum but acceptable',
        actual: actualLength,
        required: minLength
      };
    } else {
      // 长度不足 50%，不及格
      const ratio = actualLength / minLength;
      return {
        score: Math.round(ratio * 50),
        message: 'Length is significantly below minimum',
        actual: actualLength,
        required: minLength
      };
    }
  }

  /**
   * 格式检查
   * @param {string} result - 提交结果
   * @param {string} category - 任务类别
   * @returns {{score: number, message: string}}
   */
  checkFormat(result, category) {
    const rules = FORMAT_RULES[category];

    if (!rules || rules.patterns.length === 0) {
      // 没有格式规则，默认通过
      return {
        score: 100,
        message: 'No specific format requirements'
      };
    }

    const matches = rules.patterns.filter(pattern => pattern.test(result));
    const matchRatio = matches.length / rules.patterns.length;

    if (matchRatio >= 0.5) {
      return {
        score: 100,
        message: 'Format check passed'
      };
    } else if (matchRatio > 0) {
      return {
        score: 60,
        message: 'Partial format match'
      };
    } else {
      return {
        score: 30,
        message: `Format check warning: ${rules.description}`
      };
    }
  }

  /**
   * 完整性检查
   * @param {Object} task - 任务对象
   * @returns {{score: number, message: string}}
   */
  checkCompleteness(task) {
    const result = task.result || '';
    const description = task.description || '';

    // 检查是否提及了任务描述中的关键词
    const descWords = description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const resultLower = result.toLowerCase();

    let matchCount = 0;
    const sampled = descWords.slice(0, 10); // 取前10个关键词
    for (const word of sampled) {
      if (resultLower.includes(word)) {
        matchCount++;
      }
    }

    const matchRatio = sampled.length > 0 ? matchCount / sampled.length : 1;

    if (matchRatio >= 0.3) {
      return {
        score: 100,
        message: 'Result appears to address the task requirements'
      };
    } else if (matchRatio >= 0.1) {
      return {
        score: 70,
        message: 'Result partially addresses task requirements'
      };
    } else {
      return {
        score: 40,
        message: 'Result may not fully address task requirements'
      };
    }
  }

  /**
   * 安全性检查 (禁止内容)
   * @param {string} result - 提交结果
   * @returns {{score: number, message: string}}
   */
  checkSafety(result) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(result)) {
        return {
          score: 0,
          message: 'Result contains forbidden or placeholder content'
        };
      }
    }

    return {
      score: 100,
      message: 'Safety check passed'
    };
  }

  /**
   * 快速评分 (不保存到数据库)
   * @param {string} result - 提交结果
   * @param {string} category - 任务类别
   * @returns {{score: number, passed: boolean}}
   */
  quickScore(result, category = 'general') {
    const lengthCheck = this.checkLength(result, category);
    const formatCheck = this.checkFormat(result, category);
    const safetyCheck = this.checkSafety(result);

    // 简化的完整性检查
    const completenessScore = result.length > 100 ? 100 : 60;

    const score = Math.round(
      (lengthCheck.score * 30 +
       formatCheck.score * 25 +
       completenessScore * 25 +
       safetyCheck.score * 20) / 100
    );

    return {
      score: score,
      passed: score >= 60
    };
  }
}

module.exports = AutoJudge;
