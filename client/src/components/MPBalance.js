/**
 * MP 余额显示组件
 * 显示 MP 余额、冻结金额、每日恢复进度
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import {
  CoinsIcon,
  CoinsSolidIcon,
  ClockIcon,
  GiftIcon,
  ChevronRightIcon,
  InfoIcon,
} from './Icons';

/**
 * 计算下次恢复倒计时
 */
function getNextRegenCountdown() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const diff = tomorrow - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { hours, minutes };
}

/**
 * Mini 变体 - 仅显示余额数字
 */
function MPBalanceMini({ balance }) {
  return (
    <Link
      to="/wallet"
      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-accent-cyan/10 hover:bg-accent-cyan/20 border border-accent-cyan/30 transition-colors"
    >
      <CoinsSolidIcon className="w-4 h-4 text-accent-cyan" />
      <span className="text-sm font-medium text-accent-cyan">
        {balance?.available?.toLocaleString() || 0} MP
      </span>
    </Link>
  );
}

/**
 * Compact 变体 - 显示余额和冻结
 */
function MPBalanceCompact({ balance, showLink = true }) {
  const available = balance?.available || 0;
  const frozen = balance?.frozen || 0;

  return (
    <div className="inline-flex items-center space-x-3 px-3 py-2 rounded-lg bg-dark-elevated border border-dark-border">
      <div className="flex items-center space-x-1.5">
        <CoinsSolidIcon className="w-5 h-5 text-accent-cyan" />
        <span className="font-bold text-accent-cyan">
          {available.toLocaleString()} MP
        </span>
      </div>
      {frozen > 0 && (
        <span className="text-xs text-dark-text-muted">
          (冻结 {frozen.toLocaleString()})
        </span>
      )}
      {showLink && (
        <Link to="/wallet" className="text-accent-cyan hover:text-accent-cyan/80">
          <ChevronRightIcon className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}

/**
 * Full 变体 - 完整钱包卡片
 */
function MPBalanceFull({ balance, economy, showRegen = true }) {
  const [countdown, setCountdown] = useState(getNextRegenCountdown());
  const available = balance?.available || 0;
  const frozen = balance?.frozen || 0;
  const cap = 200;
  const progress = Math.min((available / cap) * 100, 100);
  const dailyRegen = economy?.dailyRegen || 20;

  // 更新倒计时
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getNextRegenCountdown());
    }, 60000); // 每分钟更新
    return () => clearInterval(interval);
  }, []);

  // 判断是否可以获得恢复
  const canRegen = available < cap;
  const regenAmount = canRegen ? Math.min(dailyRegen, cap - available) : 0;

  return (
    <div className="bg-gradient-to-br from-accent-cyan/10 via-accent-purple/5 to-accent-orange/10 rounded-xl border border-dark-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <CoinsSolidIcon className="w-6 h-6 text-accent-cyan" />
          <span className="font-semibold text-dark-text-primary">MP 余额</span>
        </div>
        <Link
          to="/wallet"
          className="text-sm text-accent-cyan hover:text-accent-cyan/80 flex items-center"
        >
          钱包详情
          <ChevronRightIcon className="w-4 h-4 ml-0.5" />
        </Link>
      </div>

      {/* 主余额 */}
      <div className="text-center mb-4">
        <div className="text-4xl font-bold text-dark-text-primary">
          {available.toLocaleString()}
          <span className="text-lg text-dark-text-muted ml-1">MP</span>
        </div>
        {frozen > 0 && (
          <div className="text-sm text-dark-text-muted mt-1">
            冻结中: {frozen.toLocaleString()} MP
          </div>
        )}
      </div>

      {/* 进度条 */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-dark-text-muted mb-1">
          <span>余额进度</span>
          <span>{available} / {cap} (上限)</span>
        </div>
        <div className="h-2 bg-dark-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-cyan to-accent-purple rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* 恢复信息 */}
      {showRegen && (
        <div className="bg-dark-card/60 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center text-dark-text-muted">
              <GiftIcon className="w-4 h-4 mr-1.5 text-accent-green" />
              每日恢复
            </span>
            <span className="font-medium text-accent-green">
              +{dailyRegen} MP/天
            </span>
          </div>

          {canRegen ? (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center text-dark-text-muted">
                <ClockIcon className="w-4 h-4 mr-1.5 text-accent-cyan" />
                下次恢复
              </span>
              <span className="text-dark-text-secondary">
                {countdown.hours}小时{countdown.minutes}分后 +{regenAmount} MP
              </span>
            </div>
          ) : (
            <div className="flex items-center text-sm text-dark-text-muted">
              <InfoIcon className="w-4 h-4 mr-1.5" />
              余额已达上限，不会获得恢复
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * MP 余额主组件
 * @param {string} variant - 'mini' | 'compact' | 'full'
 * @param {boolean} showRegen - 是否显示恢复信息 (仅 full 变体)
 * @param {boolean} showLink - 是否显示详情链接
 */
function MPBalance({ variant = 'compact', showRegen = true, showLink = true }) {
  const [balance, setBalance] = useState(null);
  const [economy, setEconomy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [balanceData, economyData] = await Promise.all([
          api.getMPBalance().catch(() => ({ available: 0, frozen: 0 })),
          api.getEconomyStatus().catch(() => ({ dailyRegen: 20 })),
        ]);
        setBalance(balanceData);
        setEconomy(economyData);
      } catch (err) {
        console.error('Failed to fetch balance:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse">
        {variant === 'mini' && <div className="w-24 h-7 bg-dark-elevated rounded-full"></div>}
        {variant === 'compact' && <div className="w-40 h-10 bg-dark-elevated rounded-lg"></div>}
        {variant === 'full' && <div className="w-full h-48 bg-dark-elevated rounded-xl"></div>}
      </div>
    );
  }

  switch (variant) {
    case 'mini':
      return <MPBalanceMini balance={balance} />;
    case 'full':
      return <MPBalanceFull balance={balance} economy={economy} showRegen={showRegen} />;
    case 'compact':
    default:
      return <MPBalanceCompact balance={balance} showLink={showLink} />;
  }
}

export default MPBalance;
