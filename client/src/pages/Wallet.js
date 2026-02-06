/**
 * MP Wallet Page
 * Display balance, regen progress, transaction history
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getAuth } from '../api';
import {
  WalletIcon,
  CoinsIcon,
  CoinsSolidIcon,
  ClockIcon,
  GiftIcon,
  IncomeIcon,
  ExpenseIcon,
  BurnIcon,
  AgentIcon,
  TaskIcon,
  RefreshIcon,
  FilterIcon,
  ChevronRightIcon,
  InfoIcon,
  LoginIcon,
} from '../components/Icons';

// Transaction type config (dark theme)
const txTypeConfig = {
  task_payment: {
    label: 'Task Payment',
    icon: ExpenseIcon,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
  },
  task_earning: {
    label: 'Task Earnings',
    icon: IncomeIcon,
    color: 'text-accent-green',
    bgColor: 'bg-accent-green/20',
  },
  task_freeze: {
    label: 'Task Freeze',
    icon: ClockIcon,
    color: 'text-accent-cyan',
    bgColor: 'bg-accent-cyan/20',
  },
  task_unfreeze: {
    label: 'Task Unfreeze',
    icon: CoinsIcon,
    color: 'text-accent-cyan',
    bgColor: 'bg-accent-cyan/20',
  },
  burn: {
    label: 'Burned',
    icon: BurnIcon,
    color: 'text-accent-orange',
    bgColor: 'bg-accent-orange/20',
  },
  daily_regen: {
    label: 'Daily Regen',
    icon: GiftIcon,
    color: 'text-accent-green',
    bgColor: 'bg-accent-green/20',
  },
  bonus: {
    label: 'Bonus',
    icon: GiftIcon,
    color: 'text-accent-purple',
    bgColor: 'bg-accent-purple/20',
  },
  refund: {
    label: 'Refund',
    icon: IncomeIcon,
    color: 'text-accent-cyan',
    bgColor: 'bg-accent-cyan/20',
  },
  register_bonus: {
    label: 'Registration Bonus',
    icon: GiftIcon,
    color: 'text-accent-green',
    bgColor: 'bg-accent-green/20',
  },
  rating_bonus: {
    label: 'Rating Bonus',
    icon: GiftIcon,
    color: 'text-accent-purple',
    bgColor: 'bg-accent-purple/20',
  },
};

function Wallet() {
  const auth = getAuth();
  const [balance, setBalance] = useState(null);
  const [economy, setEconomy] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0 });

  // Calculate next regen countdown
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCHours(0, 0, 0, 0);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      const diff = tomorrow - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setCountdown({ hours, minutes });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load balance and economy data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [balanceData, economyData] = await Promise.all([
          api.getMPBalance().catch(() => ({ available: 0, frozen: 0 })),
          api.getEconomyStatus().catch(() => ({ dailyRegen: 20, sigma: 1.0 })),
        ]);
        setBalance(balanceData);
        setEconomy(economyData);
      } catch (err) {
        console.error('Failed to load wallet data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Load transaction history
  useEffect(() => {
    loadTransactions(1);
  }, [filter]);

  const loadTransactions = async (pageNum) => {
    setTxLoading(true);
    try {
      const params = { page: pageNum, limit: 20 };
      if (filter !== 'all') params.type = filter;
      const data = await api.getMPHistory(params);

      if (pageNum === 1) {
        setTransactions(data.transactions || []);
      } else {
        setTransactions(prev => [...prev, ...(data.transactions || [])]);
      }
      setHasMore((data.transactions || []).length === 20);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setTxLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (!txLoading && hasMore) {
      loadTransactions(page + 1);
    }
  };

  if (!auth.key) {
    return (
      <div className="text-center py-12">
        <WalletIcon className="w-16 h-16 mx-auto text-dark-text-muted mb-4" />
        <h2 className="text-xl font-bold text-dark-text-primary mb-2">Please sign in first</h2>
        <p className="text-dark-text-muted mb-4">Sign in to view wallet balance and transaction history</p>
        <Link
          to="/login"
          className="inline-flex items-center px-6 py-3 bg-accent-cyan text-dark-bg font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors"
        >
          <LoginIcon className="w-5 h-5 mr-2" />
          Sign In / Sign Up
        </Link>
      </div>
    );
  }

  const available = balance?.available || 0;
  const frozen = balance?.frozen || 0;
  const cap = 200;
  const progress = Math.min((available / cap) * 100, 100);
  const dailyRegen = economy?.dailyRegen || 20;
  const canRegen = available < cap;
  const regenAmount = canRegen ? Math.min(dailyRegen, cap - available) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-2 mb-2">
        <WalletIcon className="w-6 h-6 text-accent-cyan" />
        <h1 className="text-2xl font-display font-bold text-dark-text-primary">MP Wallet</h1>
      </div>

      {/* Balance Card */}
      {loading ? (
        <div className="bg-gradient-to-br from-accent-cyan/10 via-accent-purple/5 to-accent-orange/10 rounded-xl border border-dark-border p-6 animate-pulse">
          <div className="h-8 bg-dark-elevated rounded w-32 mb-4"></div>
          <div className="h-12 bg-dark-elevated rounded w-48 mx-auto mb-4"></div>
          <div className="h-4 bg-dark-elevated rounded w-full"></div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-accent-cyan/10 via-accent-purple/5 to-accent-orange/10 rounded-xl border border-dark-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <CoinsSolidIcon className="w-6 h-6 text-accent-cyan" />
              <span className="font-semibold text-dark-text-primary">Available Balance</span>
            </div>
          </div>

          {/* Main Balance */}
          <div className="text-center mb-6">
            <div className="text-5xl font-display font-bold text-dark-text-primary">
              {available.toLocaleString()}
              <span className="text-xl text-dark-text-muted ml-2">MP</span>
            </div>
            {frozen > 0 && (
              <div className="flex items-center justify-center text-sm text-dark-text-muted mt-2">
                <ClockIcon className="w-4 h-4 mr-1" />
                Frozen: {frozen.toLocaleString()} MP
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-dark-text-muted mb-1">
              <span>Balance Cap Progress</span>
              <span>{available} / {cap}</span>
            </div>
            <div className="h-3 bg-dark-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-cyan to-accent-purple rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Regen Info */}
          <div className="bg-dark-card/60 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center text-sm text-dark-text-muted">
                <GiftIcon className="w-4 h-4 mr-2 text-accent-green" />
                Daily Regen Allowance
              </span>
              <span className="font-medium text-accent-green">
                +{dailyRegen} MP/day
              </span>
            </div>

            {canRegen ? (
              <div className="flex items-center justify-between">
                <span className="flex items-center text-sm text-dark-text-muted">
                  <ClockIcon className="w-4 h-4 mr-2 text-accent-cyan" />
                  Next Regen
                </span>
                <span className="text-dark-text-secondary">
                  <span className="font-medium">{countdown.hours}</span>h
                  <span className="font-medium ml-1">{countdown.minutes}</span>m later
                  <span className="text-accent-green ml-2">+{regenAmount} MP</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center text-sm text-dark-text-muted">
                <InfoIcon className="w-4 h-4 mr-2" />
                Balance at cap ({cap} MP), no daily regen
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
        <div className="p-4 border-b border-dark-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="font-bold text-dark-text-primary flex items-center">
            <TaskIcon className="w-5 h-5 mr-2 text-dark-text-muted" />
            Transaction History
          </h2>
          <div className="flex items-center space-x-2">
            <FilterIcon className="w-4 h-4 text-dark-text-muted" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border border-dark-border bg-dark-elevated rounded-lg px-3 py-1.5 text-sm text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan"
            >
              <option value="all">All</option>
              <option value="task_earning">Task Earnings</option>
              <option value="task_payment">Task Payment</option>
              <option value="daily_regen">Daily Regen</option>
              <option value="burn">Burned</option>
              <option value="bonus">Bonus</option>
            </select>
            <button
              onClick={() => loadTransactions(1)}
              className="p-1.5 text-dark-text-muted hover:text-dark-text-secondary rounded-lg hover:bg-dark-elevated"
            >
              <RefreshIcon className={`w-4 h-4 ${txLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Transaction List */}
        {txLoading && transactions.length === 0 ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="animate-pulse flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-dark-elevated rounded-lg"></div>
                  <div>
                    <div className="h-4 bg-dark-elevated rounded w-24 mb-1"></div>
                    <div className="h-3 bg-dark-elevated rounded w-32"></div>
                  </div>
                </div>
                <div className="h-5 bg-dark-elevated rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center">
            <CoinsIcon className="w-12 h-12 mx-auto text-dark-text-muted mb-3" />
            <p className="text-dark-text-muted">No transactions yet</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-border">
            {transactions.map((tx, i) => {
              const config = txTypeConfig[tx.type] || {
                label: tx.type,
                icon: CoinsIcon,
                color: 'text-dark-text-secondary',
                bgColor: 'bg-dark-elevated',
              };
              const TxIcon = config.icon;
              const isPositive = tx.amount > 0;

              return (
                <div key={tx.id || i} className="p-4 hover:bg-dark-elevated transition-colors">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 ${config.bgColor} rounded-lg flex items-center justify-center`}>
                        <TxIcon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div>
                        <div className="font-medium text-dark-text-primary">{config.label}</div>
                        <div className="text-sm text-dark-text-muted">
                          {tx.description || (tx.task_id ? `Task #${tx.task_id}` : '')}
                          {tx.created_at && (
                            <span className="ml-2">
                              {new Date(tx.created_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`font-bold ${isPositive ? 'text-accent-green' : 'text-red-400'}`}>
                      {isPositive ? '+' : ''}{tx.amount} MP
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More */}
        {hasMore && transactions.length > 0 && (
          <div className="p-4 border-t border-dark-border text-center">
            <button
              onClick={handleLoadMore}
              disabled={txLoading}
              className="text-sm text-accent-cyan hover:text-accent-cyan/80 disabled:text-dark-text-muted"
            >
              {txLoading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-accent-cyan/10 rounded-xl p-4 border border-accent-cyan/20">
        <div className="flex items-start space-x-3">
          <InfoIcon className="w-5 h-5 text-accent-cyan mt-0.5" />
          <div className="text-sm text-dark-text-secondary">
            <div className="font-medium text-dark-text-primary mb-1">About MP (Marketplace Points)</div>
            <ul className="space-y-1">
              <li>MP is the platform's internal currency for task payments and earnings</li>
              <li>Balance cap is 200 MP, auto-regen daily at UTC 0:00</li>
              <li>Regen amount R dynamically adjusts based on market supply ratio (sigma)</li>
              <li>No regen when balance is at cap</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Wallet;
