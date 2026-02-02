/**
 * 认证服务
 *
 * 提供:
 * - 密码哈希和验证
 * - reCAPTCHA 验证
 * - 登录尝试限制
 */

const bcrypt = require('bcrypt');

// reCAPTCHA 配置
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe'; // 测试密钥

// 密码配置
const SALT_ROUNDS = 10;

// 登录限制配置
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MINUTES = 15;

class AuthService {
  constructor(db) {
    this.db = db;
  }

  /**
   * 哈希密码
   */
  async hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * 验证密码
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * 验证 reCAPTCHA
   *
   * 在测试环境中（使用测试密钥），直接跳过网络验证
   */
  async verifyRecaptcha(token) {
    if (!token) {
      return { success: false, error: '请完成验证码验证' };
    }

    // 如果使用的是 Google 测试密钥，直接通过（避免网络问题影响测试）
    const isTestKey = RECAPTCHA_SECRET === '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';
    if (isTestKey) {
      console.log('[AuthService] Using test reCAPTCHA key, skipping network verification');
      return { success: true };
    }

    try {
      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `secret=${RECAPTCHA_SECRET}&response=${token}`,
      });

      const data = await response.json();

      if (data.success) {
        return { success: true };
      } else {
        return { success: false, error: '验证码验证失败，请重试' };
      }
    } catch (err) {
      console.error('reCAPTCHA verification error:', err);
      return { success: false, error: '验证码服务异常' };
    }
  }

  /**
   * 检查账户是否被锁定
   */
  checkAccountLock(client) {
    if (client.locked_until) {
      const lockUntil = new Date(client.locked_until);
      if (lockUntil > new Date()) {
        const remainingMinutes = Math.ceil((lockUntil - new Date()) / 60000);
        return {
          locked: true,
          message: `账户已锁定，请 ${remainingMinutes} 分钟后重试`
        };
      }
    }
    return { locked: false };
  }

  /**
   * 记录登录失败
   */
  recordFailedLogin(clientId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT login_attempts FROM clients WHERE id = ?', [clientId], (err, client) => {
        if (err) return reject(err);

        const attempts = (client?.login_attempts || 0) + 1;
        let lockUntil = null;

        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          lockUntil = new Date(Date.now() + LOCK_TIME_MINUTES * 60000).toISOString();
        }

        this.db.run(
          'UPDATE clients SET login_attempts = ?, locked_until = ? WHERE id = ?',
          [attempts, lockUntil, clientId],
          (err) => {
            if (err) return reject(err);
            resolve({
              attempts,
              locked: attempts >= MAX_LOGIN_ATTEMPTS,
              remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts
            });
          }
        );
      });
    });
  }

  /**
   * 重置登录尝试
   */
  resetLoginAttempts(clientId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE clients SET login_attempts = 0, locked_until = NULL, last_login_at = datetime("now") WHERE id = ?',
        [clientId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * 验证密码强度
   */
  validatePasswordStrength(password) {
    const errors = [];

    if (!password || password.length < 8) {
      errors.push('密码长度至少 8 位');
    }
    if (!/[a-zA-Z]/.test(password)) {
      errors.push('密码需包含字母');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('密码需包含数字');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = { AuthService, RECAPTCHA_SECRET };
