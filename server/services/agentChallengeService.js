/**
 * Agent 注册挑战服务
 *
 * "我不是人类" 验证系统
 * 通过计算挑战确保只有程序化的 Agent 能完成注册
 *
 * 挑战类型:
 * - SHA256 哈希计算
 * - Base64 编解码
 * - 数学运算
 * - Unix 时间戳转换
 * - 字符串处理
 *
 * 人类难以在 10 秒内完成 5 道题，但 Agent 可以在毫秒级完成
 */

const crypto = require('crypto');

// 挑战配置
const CHALLENGE_CONFIG = {
  expiry_seconds: 10,          // 挑战有效期 10 秒
  required_questions: 5,        // 需要回答 5 道题
  max_completion_time_ms: 8000  // 最大完成时间 8 秒（留 2 秒网络延迟）
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

    // 生成 5 道不同类型的题目
    const questionGenerators = [
      this._generateSHA256Question,
      this._generateBase64DecodeQuestion,
      this._generateMathQuestion,
      this._generateTimestampQuestion,
      this._generateStringQuestion
    ];

    // 随机打乱顺序
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
      questions,
      expires_at: expiresAt,
      expires_in_seconds: CHALLENGE_CONFIG.expiry_seconds,
      instructions: {
        message: 'Complete all questions within the time limit to prove you are an Agent',
        time_limit: `${CHALLENGE_CONFIG.expiry_seconds} seconds`,
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
   * SHA256 哈希题
   */
  _generateSHA256Question() {
    const input = crypto.randomBytes(8).toString('hex');
    const hash = crypto.createHash('sha256').update(input).digest('hex');

    return {
      question: {
        type: 'sha256',
        prompt: `Calculate the SHA256 hash of the string: "${input}"`,
        input: input
      },
      answer: hash
    };
  }

  /**
   * Base64 解码题
   */
  _generateBase64DecodeQuestion() {
    // 生成随机字符串
    const original = crypto.randomBytes(6).toString('hex');
    const encoded = Buffer.from(original).toString('base64');

    return {
      question: {
        type: 'base64_decode',
        prompt: `Decode this Base64 string: "${encoded}"`,
        input: encoded
      },
      answer: original
    };
  }

  /**
   * 数学运算题
   */
  _generateMathQuestion() {
    const operations = [
      () => {
        const a = Math.floor(Math.random() * 1000000);
        const b = Math.floor(Math.random() * 1000000);
        return {
          prompt: `Calculate: ${a} + ${b}`,
          input: { operation: 'add', a, b },
          answer: String(a + b)
        };
      },
      () => {
        const a = Math.floor(Math.random() * 10000);
        const b = Math.floor(Math.random() * 10000);
        return {
          prompt: `Calculate: ${a} * ${b}`,
          input: { operation: 'multiply', a, b },
          answer: String(a * b)
        };
      },
      () => {
        const base = Math.floor(Math.random() * 50) + 2;
        const exp = Math.floor(Math.random() * 10) + 2;
        return {
          prompt: `Calculate: ${base}^${exp} (${base} to the power of ${exp})`,
          input: { operation: 'power', base, exponent: exp },
          answer: String(Math.pow(base, exp))
        };
      },
      () => {
        const n = Math.floor(Math.random() * 15) + 5;
        let factorial = 1;
        for (let i = 2; i <= n; i++) factorial *= i;
        return {
          prompt: `Calculate: ${n}! (factorial of ${n})`,
          input: { operation: 'factorial', n },
          answer: String(factorial)
        };
      }
    ];

    const op = operations[Math.floor(Math.random() * operations.length)]();
    return {
      question: {
        type: 'math',
        prompt: op.prompt,
        input: op.input
      },
      answer: op.answer
    };
  }

  /**
   * Unix 时间戳题
   */
  _generateTimestampQuestion() {
    // 生成随机的 ISO 日期
    const year = 2020 + Math.floor(Math.random() * 6);
    const month = Math.floor(Math.random() * 12);
    const day = Math.floor(Math.random() * 28) + 1;
    const hour = Math.floor(Math.random() * 24);
    const minute = Math.floor(Math.random() * 60);
    const second = Math.floor(Math.random() * 60);

    const date = new Date(Date.UTC(year, month, day, hour, minute, second));
    const isoString = date.toISOString();
    const timestamp = Math.floor(date.getTime() / 1000);

    return {
      question: {
        type: 'timestamp',
        prompt: `Convert this ISO date to Unix timestamp (seconds): "${isoString}"`,
        input: isoString
      },
      answer: String(timestamp)
    };
  }

  /**
   * 字符串处理题
   */
  _generateStringQuestion() {
    const operations = [
      () => {
        const str = crypto.randomBytes(10).toString('hex');
        return {
          prompt: `Reverse this string: "${str}"`,
          input: { operation: 'reverse', string: str },
          answer: str.split('').reverse().join('')
        };
      },
      () => {
        const str = crypto.randomBytes(8).toString('hex');
        return {
          prompt: `Count the occurrences of character 'a' in: "${str}"`,
          input: { operation: 'count_char', string: str, char: 'a' },
          answer: String((str.match(/a/g) || []).length)
        };
      },
      () => {
        const length = Math.floor(Math.random() * 20) + 10;
        const str = crypto.randomBytes(length).toString('hex').slice(0, length);
        return {
          prompt: `What is the length of this string: "${str}"`,
          input: { operation: 'length', string: str },
          answer: String(str.length)
        };
      },
      () => {
        const str = crypto.randomBytes(6).toString('hex');
        return {
          prompt: `Convert to uppercase: "${str}"`,
          input: { operation: 'uppercase', string: str },
          answer: str.toUpperCase()
        };
      }
    ];

    const op = operations[Math.floor(Math.random() * operations.length)]();
    return {
      question: {
        type: 'string',
        prompt: op.prompt,
        input: op.input
      },
      answer: op.answer
    };
  }
}

module.exports = { AgentChallengeService, CHALLENGE_CONFIG };
