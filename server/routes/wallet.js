/**
 * Wallet API Routes
 *
 * Handles wallet operations, deposits, withdrawals, and currency info.
 */

const express = require('express');
const router = express.Router();
const WalletService = require('../services/walletService');
const CurrencyService = require('../services/currencyService');
const { ManualPaymentProvider, PaymentProviderFactory } = require('../services/paymentProvider');

// ==================== Authentication Middleware ====================

/**
 * Authenticate agent or client
 * Checks X-Agent-Key or X-Client-Key headers
 */
function authenticate(req, res, next) {
  const agentKey = req.headers['x-agent-key'];
  const clientKey = req.headers['x-client-key'];

  if (agentKey) {
    req.db.get(
      'SELECT id, name FROM agents WHERE api_key = ?',
      [agentKey],
      (err, agent) => {
        if (err || !agent) {
          return res.status(401).json({ error: 'Invalid agent key' });
        }
        req.user = { id: agent.id, name: agent.name, type: 'agent' };
        next();
      }
    );
  } else if (clientKey) {
    req.db.get(
      'SELECT id, name, email FROM clients WHERE api_key = ?',
      [clientKey],
      (err, client) => {
        if (err || !client) {
          return res.status(401).json({ error: 'Invalid client key' });
        }
        req.user = { id: client.id, name: client.name || client.email, type: 'client' };
        next();
      }
    );
  } else {
    return res.status(401).json({ error: 'Authentication required. Provide X-Agent-Key or X-Client-Key header.' });
  }
}

/**
 * Admin authentication (simple key check for now)
 * TODO: Implement proper admin authentication
 */
function authenticateAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key'];

  // Simple admin key check (should be from env in production)
  const validAdminKey = process.env.ADMIN_KEY || 'admin-secret-key';

  if (adminKey !== validAdminKey) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  req.user = { type: 'admin' };
  next();
}

// ==================== Currency Endpoints ====================

/**
 * GET /api/currencies
 * Get all currencies (or active only)
 */
router.get('/currencies', async (req, res) => {
  try {
    const currencyService = new CurrencyService(req.db);
    const activeOnly = req.query.active === 'true';

    const currencies = activeOnly
      ? await currencyService.getActiveCurrencies()
      : await currencyService.getAllCurrencies();

    res.json({
      currencies,
      count: currencies.length
    });
  } catch (error) {
    console.error('Error fetching currencies:', error);
    res.status(500).json({ error: 'Failed to fetch currencies' });
  }
});

/**
 * GET /api/currencies/:code
 * Get specific currency details
 */
router.get('/currencies/:code', async (req, res) => {
  try {
    const currencyService = new CurrencyService(req.db);
    const currency = await currencyService.getCurrency(req.params.code.toUpperCase());

    if (!currency) {
      return res.status(404).json({ error: 'Currency not found' });
    }

    res.json(currency);
  } catch (error) {
    console.error('Error fetching currency:', error);
    res.status(500).json({ error: 'Failed to fetch currency' });
  }
});

/**
 * GET /api/currencies/rates
 * Get exchange rate table
 */
router.get('/currencies/rates', async (req, res) => {
  try {
    const currencyService = new CurrencyService(req.db);
    const rates = await currencyService.getExchangeRateTable();

    res.json({ rates });
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    res.status(500).json({ error: 'Failed to fetch exchange rates' });
  }
});

// ==================== Wallet Endpoints ====================

/**
 * GET /api/wallet
 * Get all wallets for current user
 */
router.get('/wallet', authenticate, async (req, res) => {
  try {
    const walletService = new WalletService(req.db);
    const wallets = await walletService.getAllWallets(req.user.id);

    // If no wallets exist, create default A2C wallet
    if (wallets.length === 0) {
      const defaultWallet = await walletService.createWallet(req.user.id, req.user.type, 'A2C');
      const currencyService = new CurrencyService(req.db);
      const currency = await currencyService.getCurrency('A2C');

      wallets.push({
        ...defaultWallet,
        currency_name: currency.name,
        currency_symbol: currency.symbol,
        currency_type: currency.type
      });
    }

    res.json({
      user: {
        id: req.user.id,
        type: req.user.type
      },
      wallets
    });
  } catch (error) {
    console.error('Error fetching wallets:', error);
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
});

// ==================== Orders Endpoints (MUST be before :currency routes) ====================

/**
 * GET /api/wallet/orders
 * Get deposit/withdraw orders
 */
router.get('/wallet/orders', authenticate, async (req, res) => {
  try {
    const { type, status, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT po.*, w.currency_code
      FROM payment_orders po
      JOIN wallets w ON po.wallet_id = w.id
      WHERE w.owner_id = ?
    `;
    const params = [req.user.id];

    if (type) {
      sql += ' AND po.type = ?';
      params.push(type);
    }

    if (status) {
      sql += ' AND po.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY po.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    req.db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Error fetching orders:', err);
        return res.status(500).json({ error: 'Failed to fetch orders' });
      }

      res.json({
        orders: rows || [],
        count: rows ? rows.length : 0
      });
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * GET /api/wallet/orders/:id
 * Get order details
 */
router.get('/wallet/orders/:id', authenticate, async (req, res) => {
  try {
    const orderId = req.params.id;

    req.db.get(
      `SELECT po.*, w.owner_id, w.currency_code
       FROM payment_orders po
       JOIN wallets w ON po.wallet_id = w.id
       WHERE po.id = ?`,
      [orderId],
      (err, order) => {
        if (err) {
          console.error('Error fetching order:', err);
          return res.status(500).json({ error: 'Failed to fetch order' });
        }

        if (!order) {
          return res.status(404).json({ error: 'Order not found' });
        }

        // Check ownership
        if (order.owner_id !== req.user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }

        res.json(order);
      }
    );
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

/**
 * POST /api/wallet/orders/:id/cancel
 * Cancel pending order
 */
router.post('/wallet/orders/:id/cancel', authenticate, async (req, res) => {
  try {
    const orderId = req.params.id;

    // Get order and verify ownership
    const order = await new Promise((resolve, reject) => {
      req.db.get(
        `SELECT po.*, w.owner_id
         FROM payment_orders po
         JOIN wallets w ON po.wallet_id = w.id
         WHERE po.id = ?`,
        [orderId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending orders can be cancelled' });
    }

    // Cancel order
    const provider = new ManualPaymentProvider(req.db);
    const result = await provider.cancelOrder(orderId);

    // If withdrawal, unfreeze balance
    if (order.type === 'withdraw') {
      const walletService = new WalletService(req.db);
      await walletService.unfreezeBalance(order.wallet_id, order.amount, null, 'Withdrawal cancelled');
    }

    res.json(result);
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel order' });
  }
});

// ==================== Currency-specific Wallet Endpoints ====================

/**
 * GET /api/wallet/:currency
 * Get specific currency wallet
 */
router.get('/wallet/:currency', authenticate, async (req, res) => {
  try {
    const currencyCode = req.params.currency.toUpperCase();
    const walletService = new WalletService(req.db);
    const currencyService = new CurrencyService(req.db);

    // Check currency exists and is active
    const currency = await currencyService.getCurrency(currencyCode);
    if (!currency) {
      return res.status(404).json({ error: 'Currency not found' });
    }

    // Get or create wallet
    const wallet = await walletService.getOrCreateWallet(req.user.id, req.user.type, currencyCode);

    res.json({
      wallet: {
        ...wallet,
        currency_name: currency.name,
        currency_symbol: currency.symbol,
        currency_type: currency.type
      }
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

/**
 * GET /api/wallet/:currency/balance
 * Get wallet balance
 */
router.get('/wallet/:currency/balance', authenticate, async (req, res) => {
  try {
    const currencyCode = req.params.currency.toUpperCase();
    const walletService = new WalletService(req.db);

    const wallet = await walletService.getWallet(req.user.id, currencyCode);
    if (!wallet) {
      // Return zero balance if wallet doesn't exist
      return res.json({
        currency: currencyCode,
        available: 0,
        frozen: 0,
        total: 0
      });
    }

    const balance = await walletService.getBalance(wallet.id);
    res.json(balance);
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

/**
 * GET /api/wallet/:currency/history
 * Get transaction history
 */
router.get('/wallet/:currency/history', authenticate, async (req, res) => {
  try {
    const currencyCode = req.params.currency.toUpperCase();
    const walletService = new WalletService(req.db);

    const wallet = await walletService.getWallet(req.user.id, currencyCode);
    if (!wallet) {
      return res.json({
        transactions: [],
        total: 0
      });
    }

    const options = {
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      type: req.query.type || null,
      status: req.query.status || null,
      startDate: req.query.start_date || null,
      endDate: req.query.end_date || null
    };

    const transactions = await walletService.getTransactionHistory(wallet.id, options);

    res.json({
      transactions,
      count: transactions.length,
      limit: options.limit,
      offset: options.offset
    });
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

/**
 * GET /api/wallet/:currency/stats
 * Get wallet statistics
 */
router.get('/wallet/:currency/stats', authenticate, async (req, res) => {
  try {
    const currencyCode = req.params.currency.toUpperCase();
    const walletService = new WalletService(req.db);

    const stats = await walletService.getWalletStats(req.user.id, currencyCode);
    if (!stats) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching wallet stats:', error);
    res.status(500).json({ error: 'Failed to fetch wallet stats' });
  }
});

// ==================== Deposit/Withdraw Endpoints ====================

/**
 * POST /api/wallet/:currency/deposit
 * Create deposit order
 */
router.post('/wallet/:currency/deposit', authenticate, async (req, res) => {
  try {
    const currencyCode = req.params.currency.toUpperCase();
    const { amount, remark } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const currencyService = new CurrencyService(req.db);
    const walletService = new WalletService(req.db);

    // Check currency is active
    const currency = await currencyService.getCurrency(currencyCode);
    if (!currency || !currency.is_active) {
      return res.status(400).json({ error: 'Currency not available for deposit' });
    }

    // Check minimum deposit
    const minCheck = await currencyService.checkMinimumAmount(amount, currencyCode, 'deposit');
    if (!minCheck.valid) {
      return res.status(400).json({ error: minCheck.error });
    }

    // Get or create wallet
    const wallet = await walletService.getOrCreateWallet(req.user.id, req.user.type, currencyCode);

    // Create deposit order using provider
    const provider = PaymentProviderFactory.create('manual', req.db);
    const result = await provider.createDeposit(amount, currencyCode, {
      wallet_id: wallet.id,
      user_id: req.user.id,
      user_type: req.user.type,
      remark
    });

    res.json(result);
  } catch (error) {
    console.error('Error creating deposit:', error);
    res.status(500).json({ error: 'Failed to create deposit order' });
  }
});

/**
 * POST /api/wallet/:currency/withdraw
 * Create withdraw request
 */
router.post('/wallet/:currency/withdraw', authenticate, async (req, res) => {
  try {
    const currencyCode = req.params.currency.toUpperCase();
    const { amount, address, method, remark } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!address) {
      return res.status(400).json({ error: 'Withdraw address required' });
    }

    const currencyService = new CurrencyService(req.db);
    const walletService = new WalletService(req.db);

    // Check currency is active
    const currency = await currencyService.getCurrency(currencyCode);
    if (!currency || !currency.is_active) {
      return res.status(400).json({ error: 'Currency not available for withdrawal' });
    }

    // Check minimum withdraw
    const minCheck = await currencyService.checkMinimumAmount(amount, currencyCode, 'withdraw');
    if (!minCheck.valid) {
      return res.status(400).json({ error: minCheck.error });
    }

    // Get wallet and check balance
    const wallet = await walletService.getWallet(req.user.id, currencyCode);
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet not found' });
    }

    // Calculate fee
    const feeInfo = await currencyService.calculateWithdrawFee(amount, currencyCode);

    if (wallet.balance < amount) {
      return res.status(400).json({
        error: 'Insufficient balance',
        required: amount,
        available: wallet.balance
      });
    }

    // Freeze balance for withdrawal
    await walletService.freezeBalance(wallet.id, amount, null, 'Frozen for withdrawal');

    // Create withdraw order
    const provider = PaymentProviderFactory.create('manual', req.db);
    const result = await provider.createWithdraw(amount, currencyCode, address, {
      wallet_id: wallet.id,
      user_id: req.user.id,
      user_type: req.user.type,
      method: method || 'bank',
      fee_amount: feeInfo.fee,
      remark
    });

    res.json({
      ...result,
      fee_info: feeInfo
    });
  } catch (error) {
    console.error('Error creating withdraw:', error);
    res.status(500).json({ error: error.message || 'Failed to create withdraw request' });
  }
});

// ==================== Admin Endpoints ====================

/**
 * GET /api/admin/wallet/pending
 * Get pending orders for admin
 */
router.get('/admin/wallet/pending', authenticateAdmin, async (req, res) => {
  try {
    const provider = new ManualPaymentProvider(req.db);
    const orders = await provider.getPendingOrders(req.query.type);

    res.json({
      orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Error fetching pending orders:', error);
    res.status(500).json({ error: 'Failed to fetch pending orders' });
  }
});

/**
 * POST /api/admin/wallet/deposit/:orderId/approve
 * Approve deposit
 */
router.post('/admin/wallet/deposit/:orderId/approve', authenticateAdmin, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { note } = req.body;

    // Get order details
    const order = await new Promise((resolve, reject) => {
      req.db.get('SELECT * FROM payment_orders WHERE id = ?', [orderId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!order || order.type !== 'deposit') {
      return res.status(404).json({ error: 'Deposit order not found' });
    }

    // Approve order
    const provider = new ManualPaymentProvider(req.db);
    await provider.approveDeposit(orderId, note);

    // Add balance to wallet
    const walletService = new WalletService(req.db);
    await walletService.addBalance(
      order.wallet_id,
      order.amount,
      'deposit',
      `Deposit approved (Order: ${orderId})`,
      { order_id: orderId }
    );

    res.json({ success: true, order_id: orderId, message: 'Deposit approved and credited' });
  } catch (error) {
    console.error('Error approving deposit:', error);
    res.status(500).json({ error: error.message || 'Failed to approve deposit' });
  }
});

/**
 * POST /api/admin/wallet/deposit/:orderId/reject
 * Reject deposit
 */
router.post('/admin/wallet/deposit/:orderId/reject', authenticateAdmin, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { note } = req.body;

    const provider = new ManualPaymentProvider(req.db);
    const result = await provider.rejectDeposit(orderId, note);

    res.json(result);
  } catch (error) {
    console.error('Error rejecting deposit:', error);
    res.status(500).json({ error: error.message || 'Failed to reject deposit' });
  }
});

/**
 * POST /api/admin/wallet/withdraw/:orderId/approve
 * Approve withdraw (set to processing)
 */
router.post('/admin/wallet/withdraw/:orderId/approve', authenticateAdmin, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { note } = req.body;

    const provider = new ManualPaymentProvider(req.db);
    const result = await provider.approveWithdraw(orderId, note);

    res.json(result);
  } catch (error) {
    console.error('Error approving withdraw:', error);
    res.status(500).json({ error: error.message || 'Failed to approve withdraw' });
  }
});

/**
 * POST /api/admin/wallet/withdraw/:orderId/complete
 * Complete withdraw (after funds transferred)
 */
router.post('/admin/wallet/withdraw/:orderId/complete', authenticateAdmin, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { note } = req.body;

    // Get order details
    const order = await new Promise((resolve, reject) => {
      req.db.get('SELECT * FROM payment_orders WHERE id = ?', [orderId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!order || order.type !== 'withdraw') {
      return res.status(404).json({ error: 'Withdraw order not found' });
    }

    // Complete order
    const provider = new ManualPaymentProvider(req.db);
    await provider.completeWithdraw(orderId, note);

    // Consume frozen balance
    const walletService = new WalletService(req.db);
    await walletService.consumeFrozenBalance(
      order.wallet_id,
      order.amount,
      'withdraw',
      `Withdrawal completed (Order: ${orderId})`,
      { order_id: orderId }
    );

    res.json({ success: true, order_id: orderId, message: 'Withdrawal completed' });
  } catch (error) {
    console.error('Error completing withdraw:', error);
    res.status(500).json({ error: error.message || 'Failed to complete withdraw' });
  }
});

/**
 * POST /api/admin/wallet/withdraw/:orderId/reject
 * Reject withdraw (unfreeze balance)
 */
router.post('/admin/wallet/withdraw/:orderId/reject', authenticateAdmin, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { note } = req.body;

    // Get order details
    const order = await new Promise((resolve, reject) => {
      req.db.get('SELECT * FROM payment_orders WHERE id = ?', [orderId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!order || order.type !== 'withdraw') {
      return res.status(404).json({ error: 'Withdraw order not found' });
    }

    // Reject order
    const provider = new ManualPaymentProvider(req.db);
    await provider.rejectWithdraw(orderId, note);

    // Unfreeze balance
    const walletService = new WalletService(req.db);
    await walletService.unfreezeBalance(
      order.wallet_id,
      order.amount,
      null,
      `Withdrawal rejected (Order: ${orderId})`
    );

    res.json({ success: true, order_id: orderId, message: 'Withdrawal rejected and balance unfrozen' });
  } catch (error) {
    console.error('Error rejecting withdraw:', error);
    res.status(500).json({ error: error.message || 'Failed to reject withdraw' });
  }
});

/**
 * POST /api/admin/currencies/:code/rate
 * Update exchange rate
 */
router.post('/admin/currencies/:code/rate', authenticateAdmin, async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { rate } = req.body;

    if (!rate || rate <= 0) {
      return res.status(400).json({ error: 'Invalid rate' });
    }

    const currencyService = new CurrencyService(req.db);
    const result = await currencyService.updateExchangeRate(code, rate);

    if (!result.success) {
      return res.status(404).json({ error: 'Currency not found' });
    }

    // Record rate history
    await currencyService.recordExchangeRate(code, 'CNY', rate, 'admin');

    res.json(result);
  } catch (error) {
    console.error('Error updating rate:', error);
    res.status(500).json({ error: 'Failed to update exchange rate' });
  }
});

/**
 * GET /api/admin/wallet/stats
 * Get platform wallet statistics
 */
router.get('/admin/wallet/stats', authenticateAdmin, async (req, res) => {
  try {
    const walletService = new WalletService(req.db);
    const currencyCode = req.query.currency || 'A2C';

    const stats = await walletService.getPlatformStats(currencyCode);

    res.json({
      currency: currencyCode,
      ...stats
    });
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({ error: 'Failed to fetch platform stats' });
  }
});

module.exports = router;
