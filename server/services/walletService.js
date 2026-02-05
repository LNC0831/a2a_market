/**
 * Wallet Service
 *
 * Core wallet operations for the multi-currency system.
 * Handles wallet management, balance operations, transfers, and task payments.
 */

const { v4: uuidv4 } = require('uuid');
const { SETTLEMENT } = require('../config/settlement');

// Transaction types
const TX_TYPES = {
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdraw',
  TRANSFER_IN: 'transfer_in',
  TRANSFER_OUT: 'transfer_out',
  TASK_PAYMENT: 'task_payment',
  TASK_EARNING: 'task_earning',
  PLATFORM_FEE: 'platform_fee',
  JUDGE_REWARD: 'judge_reward',
  REFUND: 'refund',
  BONUS: 'bonus',
  EXCHANGE: 'exchange',
  FREEZE: 'freeze',
  UNFREEZE: 'unfreeze',
  MIGRATION: 'migration'
};

// Counterparty types
const COUNTERPARTY_TYPES = {
  AGENT: 'agent',
  CLIENT: 'client',
  PLATFORM: 'platform',
  EXTERNAL: 'external'
};

// Platform wallet ID for fee collection
const PLATFORM_WALLET_ID = 'wallet_platform_mp';

class WalletService {
  constructor(db) {
    this.db = db;
  }

  // ==================== Wallet Management ====================

  /**
   * Create a new wallet
   */
  createWallet(ownerId, ownerType, currencyCode) {
    const walletId = `wallet_${uuidv4()}`;

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO wallets
         (id, owner_id, owner_type, currency_code, balance, frozen_balance,
          total_deposited, total_withdrawn, total_earned, total_spent,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [walletId, ownerId, ownerType, currencyCode],
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              reject(new Error(`Wallet already exists for ${ownerType} ${ownerId} in ${currencyCode}`));
            } else {
              reject(err);
            }
          } else {
            resolve({
              id: walletId,
              owner_id: ownerId,
              owner_type: ownerType,
              currency_code: currencyCode,
              balance: 0,
              frozen_balance: 0
            });
          }
        }
      );
    });
  }

  /**
   * Get wallet by owner and currency
   */
  getWallet(ownerId, currencyCode) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM wallets WHERE owner_id = ? AND currency_code = ?`,
        [ownerId, currencyCode],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  /**
   * Get wallet by ID
   */
  getWalletById(walletId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM wallets WHERE id = ?`,
        [walletId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  /**
   * Get or create wallet
   */
  async getOrCreateWallet(ownerId, ownerType, currencyCode) {
    let wallet = await this.getWallet(ownerId, currencyCode);

    if (!wallet) {
      wallet = await this.createWallet(ownerId, ownerType, currencyCode);
    }

    return wallet;
  }

  /**
   * Get all wallets for an owner
   */
  getAllWallets(ownerId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT w.*, c.name as currency_name, c.symbol as currency_symbol, c.type as currency_type
         FROM wallets w
         JOIN currencies c ON w.currency_code = c.code
         WHERE w.owner_id = ?
         ORDER BY c.type, c.code`,
        [ownerId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // ==================== Balance Operations ====================

  /**
   * Get current balance (available and frozen)
   */
  async getBalance(walletId) {
    const wallet = await this.getWalletById(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    return {
      available: wallet.balance,
      frozen: wallet.frozen_balance,
      total: wallet.balance + wallet.frozen_balance,
      currency: wallet.currency_code
    };
  }

  /**
   * Add balance to wallet (deposit, earning, transfer in, etc.)
   */
  async addBalance(walletId, amount, type, description, metadata = {}) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const wallet = await this.getWalletById(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;
    const txId = `tx_${uuidv4()}`;

    // Use PostgreSQL transaction if available
    if (this.db.type === 'postgres' && this.db.beginTransaction) {
      const trx = await this.db.beginTransaction();
      try {
        // Update wallet balance
        // Note: Use 0.0 instead of 0 to ensure PostgreSQL infers REAL type for CASE expression
        await trx.query(
          `UPDATE wallets
           SET balance = balance + $1,
               total_deposited = total_deposited + CASE WHEN $2 = 'deposit' THEN $3 ELSE 0.0 END,
               total_earned = total_earned + CASE WHEN $4 IN ('task_earning', 'judge_reward', 'bonus') THEN $5 ELSE 0.0 END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $6`,
          [amount, type, amount, type, amount, walletId]
        );

        // Record transaction
        await trx.query(
          `INSERT INTO wallet_transactions
           (id, wallet_id, type, amount, balance_before, balance_after, currency_code,
            counterparty_id, counterparty_type, status, description, metadata,
            created_at, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed', $10, $11,
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            txId, walletId, type, amount, balanceBefore, balanceAfter, wallet.currency_code,
            metadata.counterparty_id || null, metadata.counterparty_type || null,
            description, JSON.stringify(metadata)
          ]
        );

        await trx.commit();
        return {
          success: true,
          transaction_id: txId,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          amount
        };
      } catch (err) {
        await trx.rollback();
        throw err;
      }
    }

    // SQLite fallback (serialize works correctly in SQLite)
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Update wallet balance
        // Note: Use 0.0 instead of 0 for consistency with PostgreSQL path
        this.db.run(
          `UPDATE wallets
           SET balance = balance + ?,
               total_deposited = total_deposited + CASE WHEN ? = 'deposit' THEN ? ELSE 0.0 END,
               total_earned = total_earned + CASE WHEN ? IN ('task_earning', 'judge_reward', 'bonus') THEN ? ELSE 0.0 END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [amount, type, amount, type, amount, walletId],
          (err) => {
            if (err) {
              reject(err);
              return;
            }
          }
        );

        // Record transaction
        this.db.run(
          `INSERT INTO wallet_transactions
           (id, wallet_id, type, amount, balance_before, balance_after, currency_code,
            counterparty_id, counterparty_type, status, description, metadata,
            created_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?,
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            txId, walletId, type, amount, balanceBefore, balanceAfter, wallet.currency_code,
            metadata.counterparty_id || null, metadata.counterparty_type || null,
            description, JSON.stringify(metadata)
          ],
          function (err) {
            if (err) {
              reject(err);
            } else {
              resolve({
                success: true,
                transaction_id: txId,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                amount
              });
            }
          }
        );
      });
    });
  }

  /**
   * Deduct balance from wallet (withdraw, payment, transfer out, etc.)
   */
  async deductBalance(walletId, amount, type, description, metadata = {}) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const wallet = await this.getWalletById(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;
    const txId = `tx_${uuidv4()}`;

    // Use PostgreSQL transaction if available
    if (this.db.type === 'postgres' && this.db.beginTransaction) {
      const trx = await this.db.beginTransaction();
      try {
        const result = await trx.query(
          `UPDATE wallets
           SET balance = balance - $1,
               total_withdrawn = total_withdrawn + CASE WHEN $2 = 'withdraw' THEN $3 ELSE 0.0 END,
               total_spent = total_spent + CASE WHEN $4 IN ('task_payment', 'platform_fee') THEN $5 ELSE 0.0 END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $6 AND balance >= $7`,
          [amount, type, amount, type, amount, walletId, amount]
        );

        if (result.rowCount === 0) {
          await trx.rollback();
          throw new Error('Insufficient balance or wallet not found');
        }

        await trx.query(
          `INSERT INTO wallet_transactions
           (id, wallet_id, type, amount, balance_before, balance_after, currency_code,
            counterparty_id, counterparty_type, status, description, metadata,
            related_task_id, created_at, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed', $10, $11, $12,
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            txId, walletId, type, -amount, balanceBefore, balanceAfter, wallet.currency_code,
            metadata.counterparty_id || null, metadata.counterparty_type || null,
            description, JSON.stringify(metadata), metadata.task_id || null
          ]
        );

        await trx.commit();
        return {
          success: true,
          transaction_id: txId,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          amount: -amount
        };
      } catch (err) {
        await trx.rollback();
        throw err;
      }
    }

    // SQLite fallback
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Update wallet balance
        this.db.run(
          `UPDATE wallets
           SET balance = balance - ?,
               total_withdrawn = total_withdrawn + CASE WHEN ? = 'withdraw' THEN ? ELSE 0.0 END,
               total_spent = total_spent + CASE WHEN ? IN ('task_payment', 'platform_fee') THEN ? ELSE 0.0 END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND balance >= ?`,
          [amount, type, amount, type, amount, walletId, amount],
          function (err) {
            if (err) {
              reject(err);
              return;
            }
            if (this.changes === 0) {
              reject(new Error('Insufficient balance or wallet not found'));
              return;
            }
          }
        );

        // Record transaction (negative amount for deduction)
        this.db.run(
          `INSERT INTO wallet_transactions
           (id, wallet_id, type, amount, balance_before, balance_after, currency_code,
            counterparty_id, counterparty_type, status, description, metadata,
            related_task_id, created_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?,
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            txId, walletId, type, -amount, balanceBefore, balanceAfter, wallet.currency_code,
            metadata.counterparty_id || null, metadata.counterparty_type || null,
            description, JSON.stringify(metadata), metadata.task_id || null
          ],
          function (err) {
            if (err) {
              reject(err);
            } else {
              resolve({
                success: true,
                transaction_id: txId,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                amount: -amount
              });
            }
          }
        );
      });
    });
  }

  /**
   * Freeze balance for pending transaction
   */
  async freezeBalance(walletId, amount, taskId = null, description = 'Frozen for pending transaction') {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const wallet = await this.getWalletById(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.balance < amount) {
      throw new Error('Insufficient available balance');
    }

    const txId = `tx_${uuidv4()}`;

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Move from balance to frozen_balance
        this.db.run(
          `UPDATE wallets
           SET balance = balance - ?,
               frozen_balance = frozen_balance + ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND balance >= ?`,
          [amount, amount, walletId, amount],
          function (err) {
            if (err) {
              reject(err);
              return;
            }
            if (this.changes === 0) {
              reject(new Error('Insufficient balance or wallet not found'));
              return;
            }
          }
        );

        // Record freeze transaction
        this.db.run(
          `INSERT INTO wallet_transactions
           (id, wallet_id, type, amount, balance_before, balance_after, currency_code,
            status, description, related_task_id, metadata, created_at)
           VALUES (?, ?, 'freeze', ?, ?, ?, ?, 'pending', ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            txId, walletId, -amount, wallet.balance, wallet.balance - amount,
            wallet.currency_code, description, taskId, JSON.stringify({ frozen_amount: amount })
          ],
          function (err) {
            if (err) {
              reject(err);
            } else {
              resolve({
                success: true,
                transaction_id: txId,
                frozen_amount: amount,
                available_balance: wallet.balance - amount,
                total_frozen: wallet.frozen_balance + amount
              });
            }
          }
        );
      });
    });
  }

  /**
   * Unfreeze balance (release back to available)
   */
  async unfreezeBalance(walletId, amount, taskId = null, description = 'Released frozen balance') {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const wallet = await this.getWalletById(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.frozen_balance < amount) {
      throw new Error('Insufficient frozen balance');
    }

    const txId = `tx_${uuidv4()}`;

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Move from frozen_balance back to balance
        this.db.run(
          `UPDATE wallets
           SET balance = balance + ?,
               frozen_balance = frozen_balance - ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND frozen_balance >= ?`,
          [amount, amount, walletId, amount],
          function (err) {
            if (err) {
              reject(err);
              return;
            }
            if (this.changes === 0) {
              reject(new Error('Insufficient frozen balance or wallet not found'));
              return;
            }
          }
        );

        // Record unfreeze transaction
        this.db.run(
          `INSERT INTO wallet_transactions
           (id, wallet_id, type, amount, balance_before, balance_after, currency_code,
            status, description, related_task_id, metadata, created_at, completed_at)
           VALUES (?, ?, 'unfreeze', ?, ?, ?, ?, 'completed', ?, ?, ?,
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            txId, walletId, amount, wallet.balance, wallet.balance + amount,
            wallet.currency_code, description, taskId, JSON.stringify({ unfrozen_amount: amount })
          ],
          function (err) {
            if (err) {
              reject(err);
            } else {
              resolve({
                success: true,
                transaction_id: txId,
                unfrozen_amount: amount,
                available_balance: wallet.balance + amount,
                total_frozen: wallet.frozen_balance - amount
              });
            }
          }
        );
      });
    });
  }

  /**
   * Consume frozen balance (for completed transactions)
   */
  async consumeFrozenBalance(walletId, amount, type, description, metadata = {}) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const wallet = await this.getWalletById(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.frozen_balance < amount) {
      throw new Error('Insufficient frozen balance');
    }

    const txId = `tx_${uuidv4()}`;

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Deduct from frozen_balance
        this.db.run(
          `UPDATE wallets
           SET frozen_balance = frozen_balance - ?,
               total_spent = total_spent + ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND frozen_balance >= ?`,
          [amount, amount, walletId, amount],
          function (err) {
            if (err) {
              reject(err);
              return;
            }
            if (this.changes === 0) {
              reject(new Error('Insufficient frozen balance or wallet not found'));
              return;
            }
          }
        );

        // Record consumption transaction
        this.db.run(
          `INSERT INTO wallet_transactions
           (id, wallet_id, type, amount, balance_before, balance_after, currency_code,
            counterparty_id, counterparty_type, status, description, metadata,
            related_task_id, created_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?,
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            txId, walletId, type, -amount, wallet.balance, wallet.balance,
            wallet.currency_code, metadata.counterparty_id || null,
            metadata.counterparty_type || null, description, JSON.stringify(metadata),
            metadata.task_id || null
          ],
          function (err) {
            if (err) {
              reject(err);
            } else {
              resolve({
                success: true,
                transaction_id: txId,
                amount: -amount
              });
            }
          }
        );
      });
    });
  }

  // ==================== Transfer ====================

  /**
   * Transfer between wallets
   */
  async transfer(fromWalletId, toWalletId, amount, description = 'Transfer') {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const fromWallet = await this.getWalletById(fromWalletId);
    const toWallet = await this.getWalletById(toWalletId);

    if (!fromWallet) {
      throw new Error('Source wallet not found');
    }
    if (!toWallet) {
      throw new Error('Destination wallet not found');
    }
    if (fromWallet.currency_code !== toWallet.currency_code) {
      throw new Error('Cannot transfer between different currencies directly');
    }
    if (fromWallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    const outTxId = `tx_${uuidv4()}`;
    const inTxId = `tx_${uuidv4()}`;

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Deduct from source
        this.db.run(
          `UPDATE wallets SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND balance >= ?`,
          [amount, fromWalletId, amount]
        );

        // Add to destination
        this.db.run(
          `UPDATE wallets SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [amount, toWalletId]
        );

        // Record outgoing transaction
        this.db.run(
          `INSERT INTO wallet_transactions
           (id, wallet_id, type, amount, balance_before, balance_after, currency_code,
            related_tx_id, counterparty_id, counterparty_type, status, description,
            created_at, completed_at)
           VALUES (?, ?, 'transfer_out', ?, ?, ?, ?, ?, ?, ?, 'completed', ?,
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            outTxId, fromWalletId, -amount, fromWallet.balance, fromWallet.balance - amount,
            fromWallet.currency_code, inTxId, toWallet.owner_id, toWallet.owner_type, description
          ]
        );

        // Record incoming transaction
        this.db.run(
          `INSERT INTO wallet_transactions
           (id, wallet_id, type, amount, balance_before, balance_after, currency_code,
            related_tx_id, counterparty_id, counterparty_type, status, description,
            created_at, completed_at)
           VALUES (?, ?, 'transfer_in', ?, ?, ?, ?, ?, ?, ?, 'completed', ?,
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            inTxId, toWalletId, amount, toWallet.balance, toWallet.balance + amount,
            toWallet.currency_code, outTxId, fromWallet.owner_id, fromWallet.owner_type, description
          ],
          function (err) {
            if (err) {
              reject(err);
            } else {
              resolve({
                success: true,
                out_transaction_id: outTxId,
                in_transaction_id: inTxId,
                amount,
                from_wallet: fromWalletId,
                to_wallet: toWalletId
              });
            }
          }
        );
      });
    });
  }

  // ==================== Task Payment ====================

  /**
   * Freeze client balance for task payment
   * Called when task is posted
   */
  async freezeForTask(clientId, taskId, amount, currencyCode = 'MP') {
    const wallet = await this.getOrCreateWallet(clientId, 'client', currencyCode);

    if (wallet.balance < amount) {
      throw new Error(`Insufficient balance. Required: ${amount}, Available: ${wallet.balance}`);
    }

    return await this.freezeBalance(wallet.id, amount, taskId, `Frozen for task ${taskId}`);
  }

  /**
   * Process task completion payment
   * Distributes funds: Agent (70%), Platform (30%), Judge (5% if applicable)
   */
  async processTaskPayment(clientId, agentId, taskId, amount, judgeId = null, currencyCode = 'MP') {
    const clientWallet = await this.getWallet(clientId, currencyCode);
    if (!clientWallet) {
      throw new Error('Client wallet not found');
    }

    const agentWallet = await this.getOrCreateWallet(agentId, 'agent', currencyCode);
    const platformWallet = await this.getWalletById(PLATFORM_WALLET_ID);

    // Calculate distribution
    let agentAmount = Math.round(amount * SETTLEMENT.AGENT_RATIO * 100) / 100;
    let platformAmount = Math.round(amount * SETTLEMENT.PLATFORM_RATIO * 100) / 100;
    let judgeAmount = 0;

    // If judge is involved, take from platform's share
    if (judgeId) {
      judgeAmount = Math.round(amount * SETTLEMENT.JUDGE_RATIO * 100) / 100;
      platformAmount = platformAmount - judgeAmount;
    }

    const results = {
      task_id: taskId,
      total_amount: amount,
      distributions: []
    };

    // 1. Consume frozen balance from client
    const clientResult = await this.consumeFrozenBalance(
      clientWallet.id,
      amount,
      TX_TYPES.TASK_PAYMENT,
      `Payment for task ${taskId}`,
      { task_id: taskId, counterparty_id: agentId, counterparty_type: 'agent' }
    );
    results.distributions.push({
      party: 'client',
      type: 'payment',
      amount: -amount,
      transaction_id: clientResult.transaction_id
    });

    // 2. Pay agent
    const agentResult = await this.addBalance(
      agentWallet.id,
      agentAmount,
      TX_TYPES.TASK_EARNING,
      `Earnings from task ${taskId}`,
      { task_id: taskId, counterparty_id: clientId, counterparty_type: 'client' }
    );
    results.distributions.push({
      party: 'agent',
      type: 'earning',
      amount: agentAmount,
      transaction_id: agentResult.transaction_id
    });

    // 3. Platform fee
    if (platformWallet) {
      const platformResult = await this.addBalance(
        platformWallet.id,
        platformAmount,
        TX_TYPES.PLATFORM_FEE,
        `Platform fee from task ${taskId}`,
        { task_id: taskId }
      );
      results.distributions.push({
        party: 'platform',
        type: 'fee',
        amount: platformAmount,
        transaction_id: platformResult.transaction_id
      });
    }

    // 4. Judge reward (if applicable)
    if (judgeId && judgeAmount > 0) {
      const judgeWallet = await this.getOrCreateWallet(judgeId, 'agent', currencyCode);
      const judgeResult = await this.addBalance(
        judgeWallet.id,
        judgeAmount,
        TX_TYPES.JUDGE_REWARD,
        `Judge reward for task ${taskId}`,
        { task_id: taskId }
      );
      results.distributions.push({
        party: 'judge',
        type: 'reward',
        amount: judgeAmount,
        transaction_id: judgeResult.transaction_id
      });
    }

    return results;
  }

  /**
   * Refund task payment (unfreeze to client)
   * Called when task is cancelled
   */
  async refundTask(clientId, taskId, amount, currencyCode = 'MP') {
    const wallet = await this.getWallet(clientId, currencyCode);
    if (!wallet) {
      throw new Error('Client wallet not found');
    }

    return await this.unfreezeBalance(
      wallet.id,
      amount,
      taskId,
      `Refund for cancelled task ${taskId}`
    );
  }

  // ==================== Transaction History ====================

  /**
   * Get transaction history for a wallet
   */
  getTransactionHistory(walletId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      type = null,
      status = null,
      startDate = null,
      endDate = null
    } = options;

    let sql = `
      SELECT * FROM wallet_transactions
      WHERE wallet_id = ?
    `;
    const params = [walletId];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (startDate) {
      sql += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND created_at <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else {
          // Parse metadata JSON
          const transactions = (rows || []).map(row => ({
            ...row,
            metadata: row.metadata ? JSON.parse(row.metadata) : {}
          }));
          resolve(transactions);
        }
      });
    });
  }

  /**
   * Get transaction by ID
   */
  getTransaction(txId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM wallet_transactions WHERE id = ?',
        [txId],
        (err, row) => {
          if (err) reject(err);
          else {
            if (row && row.metadata) {
              row.metadata = JSON.parse(row.metadata);
            }
            resolve(row);
          }
        }
      );
    });
  }

  /**
   * Get transactions for a specific task
   */
  getTaskTransactions(taskId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT wt.*, w.owner_id, w.owner_type
         FROM wallet_transactions wt
         JOIN wallets w ON wt.wallet_id = w.id
         WHERE wt.related_task_id = ?
         ORDER BY wt.created_at ASC`,
        [taskId],
        (err, rows) => {
          if (err) reject(err);
          else {
            const transactions = (rows || []).map(row => ({
              ...row,
              metadata: row.metadata ? JSON.parse(row.metadata) : {}
            }));
            resolve(transactions);
          }
        }
      );
    });
  }

  // ==================== Statistics ====================

  /**
   * Get wallet statistics
   */
  async getWalletStats(ownerId, currencyCode = 'MP') {
    const wallet = await this.getWallet(ownerId, currencyCode);
    if (!wallet) {
      return null;
    }

    return {
      wallet_id: wallet.id,
      owner_id: wallet.owner_id,
      owner_type: wallet.owner_type,
      currency: wallet.currency_code,
      balance: {
        available: wallet.balance,
        frozen: wallet.frozen_balance,
        total: wallet.balance + wallet.frozen_balance
      },
      totals: {
        deposited: wallet.total_deposited,
        withdrawn: wallet.total_withdrawn,
        earned: wallet.total_earned,
        spent: wallet.total_spent
      },
      created_at: wallet.created_at,
      updated_at: wallet.updated_at
    };
  }

  /**
   * Get platform statistics
   */
  getPlatformStats(currencyCode = 'MP') {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT
          COUNT(DISTINCT w.id) as total_wallets,
          SUM(w.balance) as total_available_balance,
          SUM(w.frozen_balance) as total_frozen_balance,
          SUM(w.total_deposited) as total_deposited,
          SUM(w.total_withdrawn) as total_withdrawn,
          SUM(w.total_earned) as total_earned,
          SUM(w.total_spent) as total_spent
         FROM wallets w
         WHERE w.currency_code = ? AND w.owner_type != 'platform'`,
        [currencyCode],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }
}

// Export constants along with the class
WalletService.TX_TYPES = TX_TYPES;
WalletService.COUNTERPARTY_TYPES = COUNTERPARTY_TYPES;
WalletService.SETTLEMENT = SETTLEMENT;
WalletService.PLATFORM_WALLET_ID = PLATFORM_WALLET_ID;

module.exports = WalletService;
