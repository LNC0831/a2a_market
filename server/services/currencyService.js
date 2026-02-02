/**
 * Currency Service
 *
 * Manages currency configurations and exchange rates.
 * Supports virtual, fiat, and crypto currencies.
 */

class CurrencyService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get all currencies (active and inactive)
   */
  getAllCurrencies() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM currencies ORDER BY
          CASE type WHEN 'virtual' THEN 1 WHEN 'fiat' THEN 2 WHEN 'crypto' THEN 3 END,
          code`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get only active currencies
   */
  getActiveCurrencies() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM currencies WHERE is_active = 1
         ORDER BY
          CASE type WHEN 'virtual' THEN 1 WHEN 'fiat' THEN 2 WHEN 'crypto' THEN 3 END,
          code`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get a specific currency by code
   */
  getCurrency(code) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM currencies WHERE code = ?',
        [code],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  /**
   * Check if a currency is active
   */
  async isCurrencyActive(code) {
    const currency = await this.getCurrency(code);
    return currency && currency.is_active === 1;
  }

  /**
   * Update exchange rate for a currency
   */
  updateExchangeRate(code, rate) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE currencies
         SET exchange_rate_to_base = ?, updated_at = CURRENT_TIMESTAMP
         WHERE code = ?`,
        [rate, code],
        function (err) {
          if (err) reject(err);
          else resolve({ success: this.changes > 0, code, rate });
        }
      );
    });
  }

  /**
   * Get exchange rate between two currencies
   * Uses CNY as the base currency for conversion
   */
  async getExchangeRate(fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) {
      return 1.0;
    }

    const from = await this.getCurrency(fromCurrency);
    const to = await this.getCurrency(toCurrency);

    if (!from || !to) {
      throw new Error(`Currency not found: ${!from ? fromCurrency : toCurrency}`);
    }

    // Convert via base currency (CNY)
    // fromCurrency -> CNY -> toCurrency
    // rate = from.exchange_rate_to_base / to.exchange_rate_to_base
    const rate = from.exchange_rate_to_base / to.exchange_rate_to_base;

    return rate;
  }

  /**
   * Convert amount between currencies
   */
  async convert(amount, fromCurrency, toCurrency) {
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    const to = await this.getCurrency(toCurrency);

    // Round to currency's decimal places
    const decimals = to ? to.decimals : 2;
    const factor = Math.pow(10, decimals);
    const converted = Math.round(amount * rate * factor) / factor;

    return {
      from: {
        currency: fromCurrency,
        amount: amount
      },
      to: {
        currency: toCurrency,
        amount: converted
      },
      rate: rate
    };
  }

  /**
   * Record exchange rate history
   */
  recordExchangeRate(fromCurrency, toCurrency, rate, source = 'manual') {
    const { v4: uuidv4 } = require('uuid');

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO exchange_rates
         (id, from_currency, to_currency, rate, source, valid_from, created_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [uuidv4(), fromCurrency, toCurrency, rate, source],
        function (err) {
          if (err) reject(err);
          else resolve({ success: true, id: this.lastID });
        }
      );
    });
  }

  /**
   * Get exchange rate history
   */
  getExchangeRateHistory(fromCurrency, toCurrency, limit = 30) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM exchange_rates
         WHERE from_currency = ? AND to_currency = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [fromCurrency, toCurrency, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Format amount with currency symbol
   */
  async formatAmount(amount, currencyCode) {
    const currency = await this.getCurrency(currencyCode);
    if (!currency) {
      return `${amount} ${currencyCode}`;
    }

    const decimals = currency.decimals || 2;
    const formatted = amount.toFixed(decimals);
    return `${currency.symbol || ''}${formatted}`;
  }

  /**
   * Validate amount for a currency (check decimals)
   */
  async validateAmount(amount, currencyCode) {
    const currency = await this.getCurrency(currencyCode);
    if (!currency) {
      return { valid: false, error: `Currency not found: ${currencyCode}` };
    }

    if (typeof amount !== 'number' || isNaN(amount)) {
      return { valid: false, error: 'Amount must be a number' };
    }

    if (amount < 0) {
      return { valid: false, error: 'Amount cannot be negative' };
    }

    // Check decimal places
    const decimals = currency.decimals || 2;
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(amount * factor) / factor;

    if (amount !== rounded) {
      return {
        valid: false,
        error: `Amount exceeds ${decimals} decimal places for ${currencyCode}`
      };
    }

    return { valid: true };
  }

  /**
   * Check minimum deposit/withdraw requirements
   */
  async checkMinimumAmount(amount, currencyCode, type) {
    const currency = await this.getCurrency(currencyCode);
    if (!currency) {
      return { valid: false, error: `Currency not found: ${currencyCode}` };
    }

    const minAmount = type === 'deposit' ? currency.min_deposit : currency.min_withdraw;

    if (amount < minAmount) {
      return {
        valid: false,
        error: `Minimum ${type} amount for ${currencyCode} is ${minAmount}`
      };
    }

    return { valid: true, minAmount };
  }

  /**
   * Calculate withdraw fee
   */
  async calculateWithdrawFee(amount, currencyCode) {
    const currency = await this.getCurrency(currencyCode);
    if (!currency) {
      throw new Error(`Currency not found: ${currencyCode}`);
    }

    const feeRate = currency.withdraw_fee_rate || 0;
    const fee = amount * feeRate;
    const netAmount = amount - fee;

    return {
      amount,
      feeRate,
      fee,
      netAmount,
      currency: currencyCode
    };
  }

  /**
   * Activate a currency
   */
  activateCurrency(code) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE currencies SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE code = ?`,
        [code],
        function (err) {
          if (err) reject(err);
          else resolve({ success: this.changes > 0, code });
        }
      );
    });
  }

  /**
   * Deactivate a currency
   */
  deactivateCurrency(code) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE currencies SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE code = ?`,
        [code],
        function (err) {
          if (err) reject(err);
          else resolve({ success: this.changes > 0, code });
        }
      );
    });
  }

  /**
   * Get all exchange rates as a table
   */
  async getExchangeRateTable() {
    const currencies = await this.getActiveCurrencies();
    const rates = {};

    for (const from of currencies) {
      rates[from.code] = {};
      for (const to of currencies) {
        rates[from.code][to.code] = await this.getExchangeRate(from.code, to.code);
      }
    }

    return rates;
  }
}

module.exports = CurrencyService;
