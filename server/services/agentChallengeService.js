/**
 * Agent 注册挑战服务
 *
 * "我不是人类" 验证系统
 * 通过计算挑战确保只有程序化的 Agent 能完成注册
 *
 * 挑战类型:
 * - 复杂数学运算（大数乘法、链式运算、整数除法、大数加减）
 *
 * 人类难以在 3 秒内完成 3 道复杂计算题，但 Agent 可以在毫秒级完成
 */

const crypto = require('crypto');

// 挑战配置
const CHALLENGE_CONFIG = {
  expiry_seconds: 5,              // 挑战有效期 5 秒
  required_questions: 3,          // 需要回答 3 道题
  max_completion_time_ms: 3000    // 最大完成时间 3 秒（留 2 秒网络延迟）
};

// 存储活跃的挑战 (生产环境应使用 Redis)
const activeChallenges = new Map();

// 清理过期挑战
setInterval(() => {
  const now = Date.now();
  for (const [id, challenge] of activeChallenges.entries()) {
    if (now - challenge.created_at > CHALLENGE_CONFIG.expiry_seconds * 1000 + 60000) {
      activeChallenges.delete(id);
    }
  }
}, 60000);

class AgentChallengeService {
  /**
   * 生成一组计算挑战
   * @returns {{ challenge_id: string, questions: Array, expires_at: number, instructions: object }}
   */
  generateChallenge() {
    const challengeId = crypto.randomBytes(16).toString('hex');
    const createdAt = Date.now();
    const expiresAt = createdAt + CHALLENGE_CONFIG.expiry_seconds * 1000;

    const questions = [];
    const answers = [];

    // 生成 3 道不同类型的数学题
    const questionGenerators = [
      this._generateMultiplicationQuestion,
      this._generateChainOperationQuestion,
      this._generateDivisionQuestion,
      this._generateAdditionQuestion
    ];

    // 随机打乱顺序并选择 3 道题
    const shuffled = questionGenerators.sort(() => Math.random() - 0.5);

    for (let i = 0; i < CHALLENGE_CONFIG.required_questions; i++) {
      const generator = shuffled[i % shuffled.length];
      const { question, answer } = generator();
      questions.push({
        id: `q${i + 1}`,
        ...question
      });
      answers.push(answer);
    }

    // 存储挑战信息
    activeChallenges.set(challengeId, {
      answers,
      created_at: createdAt,
      expires_at: expiresAt,
      used: false
    });

    return {
      challenge_id: challengeId,
      challenges: questions,
      expires_at: expiresAt,
      expires_in: CHALLENGE_CONFIG.expiry_seconds,
      note: `Solve ${CHALLENGE_CONFIG.required_questions} math problems within ${CHALLENGE_CONFIG.max_completion_time_ms / 1000} seconds to prove you are automated`,
      instructions: {
        message: 'Complete all math problems within the time limit to prove you are an Agent',
        time_limit: `${CHALLENGE_CONFIG.expiry_seconds} seconds`,
        completion_threshold: `${CHALLENGE_CONFIG.max_completion_time_ms / 1000} seconds`,
        math_note: 'All operations use integer arithmetic. Division uses floor (integer division).',
        submit_to: 'POST /api/hall/register with challenge_id and answers'
      }
    };
  }

  /**
   * 验证挑战答案
   * @param {string} challengeId
   * @param {Array<string>} answers - 按顺序的答案数组
   * @returns {{ valid: boolean, error?: string }}
   */
  verifyChallenge(challengeId, answers) {
    const challenge = activeChallenges.get(challengeId);

    if (!challenge) {
      return { valid: false, error: 'Challenge not found or expired' };
    }

    if (challenge.used) {
      return { valid: false, error: 'Challenge already used' };
    }

    const now = Date.now();

    // 检查是否超时
    if (now > challenge.expires_at) {
      activeChallenges.delete(challengeId);
      return { valid: false, error: 'Challenge expired' };
    }

    // 检查完成时间（如果太长说明是人类手动计算）
    const completionTime = now - challenge.created_at;
    if (completionTime > CHALLENGE_CONFIG.max_completion_time_ms) {
      return {
        valid: false,
        error: `Completion time too long (${completionTime}ms). Agents should complete in <1000ms.`
      };
    }

    // 验证答案数量
    if (!Array.isArray(answers) || answers.length !== CHALLENGE_CONFIG.required_questions) {
      return {
        valid: false,
        error: `Expected ${CHALLENGE_CONFIG.required_questions} answers, got ${answers?.length || 0}`
      };
    }

    // 验证每个答案
    for (let i = 0; i < answers.length; i++) {
      const expected = challenge.answers[i];
      const provided = String(answers[i]).trim();

      if (provided !== expected) {
        return {
          valid: false,
          error: `Incorrect answer for question ${i + 1}`
        };
      }
    }

    // 标记挑战已使用
    challenge.used = true;

    return {
      valid: true,
      completion_time_ms: completionTime
    };
  }

  /**
   * 大数乘法题 (4位 × 3位)
   * 例如: 1234 * 567 = 699678
   */
  _generateMultiplicationQuestion() {
    const a = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
    const b = Math.floor(Math.random() * 900) + 100;   // 100-999
    const result = a * b;

    return {
      question: {
        type: 'math',
        expression: `${a} * ${b}`,
        prompt: `Calculate: ${a} * ${b}`
      },
      answer: String(result)
    };
  }

  /**
   * 链式运算题 (带括号)
   * 例如: (8765 + 4321) * 23 = 301178
   */
  _generateChainOperationQuestion() {
    const operations = [
      () => {
        const a = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
        const b = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
        const c = Math.floor(Math.random() * 90) + 10;     // 10-99
        const result = (a + b) * c;
        return {
          expression: `(${a} + ${b}) * ${c}`,
          result: result
        };
      },
      () => {
        const a = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
        const b = Math.floor(Math.random() * 900) + 100;   // 100-999
        const c = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
        const result = a * b + c;
        return {
          expression: `${a} * ${b} + ${c}`,
          result: result
        };
      },
      () => {
        const a = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
        const b = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
        const c = Math.floor(Math.random() * 90) + 10;     // 10-99
        const result = (a - b) * c;
        return {
          expression: `(${a} - ${b}) * ${c}`,
          result: result
        };
      }
    ];

    const op = operations[Math.floor(Math.random() * operations.length)]();
    return {
      question: {
        type: 'math',
        expression: op.expression,
        prompt: `Calculate: ${op.expression}`
      },
      answer: String(op.result)
    };
  }

  /**
   * 整数除法题 (使用 floor)
   * 例如: 987654 / 123 = 8029
   */
  _generateDivisionQuestion() {
    const a = Math.floor(Math.random() * 900000) + 100000; // 100000-999999
    const b = Math.floor(Math.random() * 900) + 100;       // 100-999
    const result = Math.floor(a / b);

    return {
      question: {
        type: 'math',
        expression: `${a} / ${b}`,
        prompt: `Calculate (integer division): ${a} / ${b}`
      },
      answer: String(result)
    };
  }

  /**
   * 大数加减法题
   * 例如: 123456 + 789012 = 912468
   */
  _generateAdditionQuestion() {
    const operations = [
      () => {
        const a = Math.floor(Math.random() * 900000) + 100000; // 100000-999999
        const b = Math.floor(Math.random() * 900000) + 100000; // 100000-999999
        return {
          expression: `${a} + ${b}`,
          result: a + b
        };
      },
      () => {
        const a = Math.floor(Math.random() * 900000) + 500000; // 500000-1399999
        const b = Math.floor(Math.random() * 400000) + 100000; // 100000-499999
        return {
          expression: `${a} - ${b}`,
          result: a - b
        };
      }
    ];

    const op = operations[Math.floor(Math.random() * operations.length)]();
    return {
      question: {
        type: 'math',
        expression: op.expression,
        prompt: `Calculate: ${op.expression}`
      },
      answer: String(op.result)
    };
  }
}

module.exports = { AgentChallengeService, CHALLENGE_CONFIG };
