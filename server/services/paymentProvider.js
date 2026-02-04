/**
 * Payment Provider Abstraction
 *
 * Abstract interface for payment gateways.
 * Supports multiple providers: manual, alipay, wechat, stripe, crypto
 */

const { v4: uuidv4 } = require('uuid');

// Payment order statuses
const ORDER_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// Payment providers
const PROVIDERS = {
  MANUAL: 'manual',
  ALIPAY: 'alipay',
  WECHAT: 'wechat',
  STRIPE: 'stripe',
  CRYPTO: 'crypto'
};

/**
 * Abstract Payment Provider
 * All payment providers must implement these methods
 */
class PaymentProvider {
  constructor(config = {}) {
    this.config = config;
    this.name = 'abstract';
  }

  /**
   * Create a deposit order
   * @param {number} amount - Amount to deposit
   * @param {string} currency - Currency code
   * @param {object} metadata - Additional data
   * @returns {Promise<object>} Order details
   */
  async createDeposit(amount, currency, metadata = {}) {
    throw new Error('createDeposit not implemented');
  }

  /**
   * Query deposit order status
   * @param {string} orderId - Order ID
   * @returns {Promise<object>} Order status
   */
  async queryDeposit(orderId) {
    throw new Error('queryDeposit not implemented');
  }

  /**
   * Create a withdraw request
   * @param {number} amount - Amount to withdraw
   * @param {string} currency - Currency code
   * @param {string} address - Withdraw destination
   * @param {object} metadata - Additional data
   * @returns {Promise<object>} Withdraw request details
   */
  async createWithdraw(amount, currency, address, metadata = {}) {
    throw new Error('createWithdraw not implemented');
  }

  /**
   * Query withdraw order status
   * @param {string} orderId - Order ID
   * @returns {Promise<object>} Order status
   */
  async queryWithdraw(orderId) {
    throw new Error('queryWithdraw not implemented');
  }

  /**
   * Cancel an order
   * @param {string} orderId - Order ID
   * @returns {Promise<object>} Cancellation result
   */
  async cancelOrder(orderId) {
    throw new Error('cancelOrder not implemented');
  }

  /**
   * Process webhook callback from payment provider
   * @param {object} data - Webhook data
   * @returns {Promise<object>} Processing result
   */
  async processWebhook(data) {
    throw new Error('processWebhook not implemented');
  }
}

/**
 * Manual Payment Provider
 *
 * For admin-approved deposits and withdrawals.
 * Default provider when no payment gateway is configured.
 */
class ManualPaymentProvider extends PaymentProvider {
  constructor(db, config = {}) {
    super(config);
    this.db = db;
    this.name = PROVIDERS.MANUAL;
  }

  async createDeposit(amount, currency, metadata = {}) {
    const orderId = `dep_${uuidv4()}`;

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO payment_orders
         (id, wallet_id, type, amount, currency_code, payment_provider,
          status, remark, created_at)
         VALUES (?, ?, 'deposit', ?, ?, 'manual', 'pending', ?, CURRENT_TIMESTAMP)`,
        [orderId, metadata.wallet_id, amount, currency, metadata.remark || null],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              success: true,
              order_id: orderId,
              status: ORDER_STATUS.PENDING,
              amount,
              currency,
              provider: PROVIDERS.MANUAL,
              message: 'Please contact admin to complete the deposit',
              instructions: {
                step1: 'Transfer the amount to platform account',
                step2: 'Provide order ID to admin for verification',
                step3: 'Admin will approve the deposit after confirmation'
              }
            });
          }
        }
      );
    });
  }

  async queryDeposit(orderId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM payment_orders WHERE id = ? AND type = ?',
        [orderId, 'deposit'],
        (err, row) => {
          if (err) reject(err);
          else if (!row) reject(new Error('Order not found'));
          else resolve({
            order_id: row.id,
            status: row.status,
            amount: row.amount,
            currency: row.currency_code,
            provider: row.payment_provider,
            created_at: row.created_at,
            completed_at: row.completed_at
          });
        }
      );
    });
  }

  async createWithdraw(amount, currency, address, metadata = {}) {
    const orderId = `wth_${uuidv4()}`;
    const feeAmount = metadata.fee_amount || 0;
    const netAmount = amount - feeAmount;

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO payment_orders
         (id, wallet_id, type, amount, currency_code, payment_provider,
          withdraw_address, withdraw_method, status, fee_amount, net_amount,
          remark, created_at)
         VALUES (?, ?, 'withdraw', ?, ?, 'manual', ?, ?, 'pending', ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          orderId, metadata.wallet_id, amount, currency, address,
          metadata.method || 'bank', feeAmount, netAmount, metadata.remark || null
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              success: true,
              order_id: orderId,
              status: ORDER_STATUS.PENDING,
              amount,
              fee: feeAmount,
              net_amount: netAmount,
              currency,
              address,
              provider: PROVIDERS.MANUAL,
              message: 'Withdraw request submitted. Admin will process it soon.',
              estimated_time: '1-3 business days'
            });
          }
        }
      );
    });
  }

  async queryWithdraw(orderId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM payment_orders WHERE id = ? AND type = ?',
        [orderId, 'withdraw'],
        (err, row) => {
          if (err) reject(err);
          else if (!row) reject(new Error('Order not found'));
          else resolve({
            order_id: row.id,
            status: row.status,
            amount: row.amount,
            fee: row.fee_amount,
            net_amount: row.net_amount,
            currency: row.currency_code,
            address: row.withdraw_address,
            method: row.withdraw_method,
            provider: row.payment_provider,
            created_at: row.created_at,
            processed_at: row.processed_at,
            completed_at: row.completed_at,
            admin_note: row.admin_note
          });
        }
      );
    });
  }

  async cancelOrder(orderId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE payment_orders
         SET status = 'cancelled', processed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'pending'`,
        [orderId],
        function (err) {
          if (err) reject(err);
          else if (this.changes === 0) {
            reject(new Error('Order not found or already processed'));
          } else {
            resolve({ success: true, order_id: orderId, status: ORDER_STATUS.CANCELLED });
          }
        }
      );
    });
  }

  /**
   * Admin: Approve deposit
   */
  async approveDeposit(orderId, adminNote = null) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE payment_orders
         SET status = 'completed', admin_note = ?,
             processed_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND type = 'deposit' AND status = 'pending'`,
        [adminNote, orderId],
        function (err) {
          if (err) reject(err);
          else if (this.changes === 0) {
            reject(new Error('Order not found or already processed'));
          } else {
            resolve({ success: true, order_id: orderId, status: ORDER_STATUS.COMPLETED });
          }
        }
      );
    });
  }

  /**
   * Admin: Reject deposit
   */
  async rejectDeposit(orderId, adminNote = null) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE payment_orders
         SET status = 'failed', admin_note = ?,
             processed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND type = 'deposit' AND status = 'pending'`,
        [adminNote, orderId],
        function (err) {
          if (err) reject(err);
          else if (this.changes === 0) {
            reject(new Error('Order not found or already processed'));
          } else {
            resolve({ success: true, order_id: orderId, status: ORDER_STATUS.FAILED });
          }
        }
      );
    });
  }

  /**
   * Admin: Approve withdraw
   */
  async approveWithdraw(orderId, adminNote = null) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE payment_orders
         SET status = 'processing', admin_note = ?,
             processed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND type = 'withdraw' AND status = 'pending'`,
        [adminNote, orderId],
        function (err) {
          if (err) reject(err);
          else if (this.changes === 0) {
            reject(new Error('Order not found or already processed'));
          } else {
            resolve({ success: true, order_id: orderId, status: ORDER_STATUS.PROCESSING });
          }
        }
      );
    });
  }

  /**
   * Admin: Complete withdraw (after funds transferred)
   */
  async completeWithdraw(orderId, adminNote = null) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE payment_orders
         SET status = 'completed', admin_note = COALESCE(?, admin_note),
             completed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND type = 'withdraw' AND status = 'processing'`,
        [adminNote, orderId],
        function (err) {
          if (err) reject(err);
          else if (this.changes === 0) {
            reject(new Error('Order not found or not in processing status'));
          } else {
            resolve({ success: true, order_id: orderId, status: ORDER_STATUS.COMPLETED });
          }
        }
      );
    });
  }

  /**
   * Admin: Reject withdraw
   */
  async rejectWithdraw(orderId, adminNote = null) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE payment_orders
         SET status = 'failed', admin_note = ?,
             processed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND type = 'withdraw' AND status IN ('pending', 'processing')`,
        [adminNote, orderId],
        function (err) {
          if (err) reject(err);
          else if (this.changes === 0) {
            reject(new Error('Order not found or already completed'));
          } else {
            resolve({ success: true, order_id: orderId, status: ORDER_STATUS.FAILED });
          }
        }
      );
    });
  }

  /**
   * Get pending orders for admin
   */
  getPendingOrders(type = null, limit = 50) {
    let sql = `SELECT * FROM payment_orders WHERE status IN ('pending', 'processing')`;
    const params = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY created_at ASC LIMIT ?';
    params.push(limit);

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }
}

/**
 * Alipay Payment Provider (Stub)
 *
 * TODO: Implement when ready to integrate Alipay
 */
class AlipayProvider extends PaymentProvider {
  constructor(config = {}) {
    super(config);
    this.name = PROVIDERS.ALIPAY;
    // TODO: Initialize Alipay SDK
    // this.alipayClient = new AlipaySdk(config);
  }

  async createDeposit(amount, currency, metadata = {}) {
    // TODO: Create Alipay payment
    throw new Error('Alipay integration not yet implemented');
  }

  async queryDeposit(orderId) {
    // TODO: Query Alipay order
    throw new Error('Alipay integration not yet implemented');
  }

  async createWithdraw(amount, currency, address, metadata = {}) {
    // TODO: Create Alipay transfer
    throw new Error('Alipay integration not yet implemented');
  }

  async queryWithdraw(orderId) {
    // TODO: Query Alipay transfer
    throw new Error('Alipay integration not yet implemented');
  }

  async processWebhook(data) {
    // TODO: Verify and process Alipay callback
    throw new Error('Alipay integration not yet implemented');
  }
}

/**
 * WeChat Pay Provider (Stub)
 *
 * TODO: Implement when ready to integrate WeChat Pay
 */
class WechatPayProvider extends PaymentProvider {
  constructor(config = {}) {
    super(config);
    this.name = PROVIDERS.WECHAT;
    // TODO: Initialize WeChat Pay SDK
  }

  async createDeposit(amount, currency, metadata = {}) {
    throw new Error('WeChat Pay integration not yet implemented');
  }

  async queryDeposit(orderId) {
    throw new Error('WeChat Pay integration not yet implemented');
  }

  async createWithdraw(amount, currency, address, metadata = {}) {
    throw new Error('WeChat Pay integration not yet implemented');
  }

  async queryWithdraw(orderId) {
    throw new Error('WeChat Pay integration not yet implemented');
  }

  async processWebhook(data) {
    throw new Error('WeChat Pay integration not yet implemented');
  }
}

/**
 * Stripe Payment Provider (Stub)
 *
 * TODO: Implement when ready to integrate Stripe
 */
class StripeProvider extends PaymentProvider {
  constructor(config = {}) {
    super(config);
    this.name = PROVIDERS.STRIPE;
    // TODO: Initialize Stripe SDK
    // this.stripe = require('stripe')(config.secretKey);
  }

  async createDeposit(amount, currency, metadata = {}) {
    throw new Error('Stripe integration not yet implemented');
  }

  async queryDeposit(orderId) {
    throw new Error('Stripe integration not yet implemented');
  }

  async createWithdraw(amount, currency, address, metadata = {}) {
    throw new Error('Stripe integration not yet implemented');
  }

  async queryWithdraw(orderId) {
    throw new Error('Stripe integration not yet implemented');
  }

  async processWebhook(data) {
    throw new Error('Stripe integration not yet implemented');
  }
}

/**
 * Crypto Payment Provider (Stub)
 *
 * TODO: Implement when ready to integrate cryptocurrency payments
 */
class CryptoProvider extends PaymentProvider {
  constructor(config = {}) {
    super(config);
    this.name = PROVIDERS.CRYPTO;
    // TODO: Initialize crypto payment gateway
  }

  async createDeposit(amount, currency, metadata = {}) {
    // TODO: Generate deposit address, monitor blockchain
    throw new Error('Crypto payment integration not yet implemented');
  }

  async queryDeposit(orderId) {
    throw new Error('Crypto payment integration not yet implemented');
  }

  async createWithdraw(amount, currency, address, metadata = {}) {
    // TODO: Create blockchain transaction
    throw new Error('Crypto payment integration not yet implemented');
  }

  async queryWithdraw(orderId) {
    throw new Error('Crypto payment integration not yet implemented');
  }

  async processWebhook(data) {
    // TODO: Process blockchain confirmations
    throw new Error('Crypto payment integration not yet implemented');
  }
}

/**
 * Payment Provider Factory
 *
 * Creates the appropriate payment provider based on configuration
 */
class PaymentProviderFactory {
  static create(providerName, db, config = {}) {
    switch (providerName) {
      case PROVIDERS.MANUAL:
        return new ManualPaymentProvider(db, config);
      case PROVIDERS.ALIPAY:
        return new AlipayProvider(config);
      case PROVIDERS.WECHAT:
        return new WechatPayProvider(config);
      case PROVIDERS.STRIPE:
        return new StripeProvider(config);
      case PROVIDERS.CRYPTO:
        return new CryptoProvider(config);
      default:
        // Default to manual provider
        return new ManualPaymentProvider(db, config);
    }
  }

  /**
   * Get provider for a specific currency
   */
  static getProviderForCurrency(currency, db, config = {}) {
    // Map currencies to default providers
    const currencyProviders = {
      'MP': PROVIDERS.MANUAL,  // Virtual currency - manual admin
      'CNY': PROVIDERS.ALIPAY,  // China - Alipay/WeChat
      'USD': PROVIDERS.STRIPE,  // International - Stripe
      'BTC': PROVIDERS.CRYPTO,  // Bitcoin
      'ETH': PROVIDERS.CRYPTO   // Ethereum
    };

    const providerName = currencyProviders[currency] || PROVIDERS.MANUAL;
    return this.create(providerName, db, config);
  }
}

module.exports = {
  PaymentProvider,
  ManualPaymentProvider,
  AlipayProvider,
  WechatPayProvider,
  StripeProvider,
  CryptoProvider,
  PaymentProviderFactory,
  ORDER_STATUS,
  PROVIDERS
};
