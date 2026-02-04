/**
 * 经济状态指示器组件
 * 显示平台经济参数 σ (供给比率), R (每日恢复), B (销毁率)
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import {
  TrendingIcon,
  TrendingDownIcon,
  BurnIcon,
  GiftIcon,
  ChevronRightIcon,
  InfoIcon,
} from './Icons';

/**
 * 根据 σ 值获取状态配置 (dark theme)
 */
function getStatusConfig(sigma) {
  if (sigma < 0.8) {
    return {
      status: 'shortage',
      label: '供给不足',
      color: 'text-accent-orange',
      bgColor: 'bg-accent-orange/10',
      borderColor: 'border-accent-orange/30',
      dotColor: 'bg-accent-orange',
      description: '市场需求大于供给，Agent 收益率高',
    };
  } else if (sigma <= 1.2) {
    return {
      status: 'balanced',
      label: '平衡',
      color: 'text-accent-green',
      bgColor: 'bg-accent-green/10',
      borderColor: 'border-accent-green/30',
      dotColor: 'bg-accent-green',
      description: '市场供需平衡',
    };
  } else if (sigma <= 1.5) {
    return {
      status: 'surplus',
      label: '轻微过剩',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      dotColor: 'bg-yellow-500',
      description: '市场供给略大于需求',
    };
  } else {
    return {
      status: 'oversupply',
      label: '供给过剩',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      dotColor: 'bg-red-500',
      description: '市场供给过剩，销毁率升高',
    };
  }
}

/**
 * Mini 变体 - 仅显示 σ 状态点
 */
function EconomyIndicatorMini({ economy }) {
  if (!economy) return null;
  const config = getStatusConfig(economy.sigma);

  return (
    <div
      className="inline-flex items-center space-x-1.5 px-2 py-1 rounded-full bg-dark-elevated border border-dark-border"
      title={`σ=${economy.sigma?.toFixed(2)} - ${config.label}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dotColor} animate-pulse`}></span>
      <span className="text-xs font-medium text-dark-text-secondary">
        σ {economy.sigma?.toFixed(2)}
      </span>
    </div>
  );
}

/**
 * Compact 变体 - 显示 σ 和关键参数
 */
function EconomyIndicatorCompact({ economy, showLink = true }) {
  if (!economy) return null;
  const config = getStatusConfig(economy.sigma);
  const burnRate = (economy.burnRate * 100).toFixed(1);
  const agentRate = ((1 - economy.burnRate) * 100).toFixed(1);

  return (
    <div className={`inline-flex items-center space-x-3 px-3 py-2 rounded-lg border ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-center space-x-1.5">
        <span className={`w-2 h-2 rounded-full ${config.dotColor}`}></span>
        <span className={`text-sm font-medium ${config.color}`}>
          {config.label}
        </span>
      </div>
      <div className="flex items-center space-x-3 text-xs text-dark-text-muted">
        <span className="flex items-center">
          <TrendingIcon className="w-3.5 h-3.5 mr-1" />
          σ {economy.sigma?.toFixed(2)}
        </span>
        <span className="flex items-center text-accent-green">
          Agent {agentRate}%
        </span>
        <span className="flex items-center text-accent-orange">
          <BurnIcon className="w-3.5 h-3.5 mr-1" />
          {burnRate}%
        </span>
      </div>
    </div>
  );
}

/**
 * Full 变体 - 完整经济状态面板
 */
function EconomyIndicatorFull({ economy, showDetails = true }) {
  if (!economy) return null;
  const config = getStatusConfig(economy.sigma);
  const burnRate = (economy.burnRate * 100).toFixed(1);
  const agentRate = ((1 - economy.burnRate) * 100).toFixed(1);

  return (
    <div className={`rounded-xl border ${config.bgColor} ${config.borderColor} p-4`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className={`w-3 h-3 rounded-full ${config.dotColor} animate-pulse`}></span>
          <span className={`font-semibold ${config.color}`}>{config.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 text-dark-text-muted mb-1">
            <TrendingIcon className="w-4 h-4" />
            <span className="text-xs">供给比率</span>
          </div>
          <div className="text-2xl font-bold text-dark-text-primary">
            {economy.sigma?.toFixed(2)}
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 text-dark-text-muted mb-1">
            <GiftIcon className="w-4 h-4" />
            <span className="text-xs">每日恢复</span>
          </div>
          <div className="text-2xl font-bold text-accent-green">
            +{economy.dailyRegen} MP
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 text-dark-text-muted mb-1">
            <BurnIcon className="w-4 h-4" />
            <span className="text-xs">销毁率</span>
          </div>
          <div className="text-2xl font-bold text-accent-orange">
            {burnRate}%
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 pt-4 border-t border-dark-border">
          <div className="flex items-start space-x-2 text-sm text-dark-text-secondary">
            <InfoIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p>{config.description}</p>
              <p className="mt-1">
                任务完成时，Agent 获得 <span className="font-medium text-accent-green">{agentRate}%</span>，
                <span className="font-medium text-accent-orange">{burnRate}%</span> 被销毁。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 经济指示器主组件
 * @param {string} variant - 'mini' | 'compact' | 'full'
 * @param {boolean} showDetails - 是否显示详细说明 (仅 full 变体)
 * @param {boolean} showLink - 是否显示详情链接
 * @param {object} economy - 可选，外部传入经济数据
 */
function EconomyIndicator({ variant = 'compact', showDetails = true, showLink = true, economy: externalEconomy = null }) {
  const [economy, setEconomy] = useState(externalEconomy);
  const [loading, setLoading] = useState(!externalEconomy);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (externalEconomy) {
      setEconomy(externalEconomy);
      return;
    }

    const fetchEconomy = async () => {
      try {
        const data = await api.getEconomyStatus();
        setEconomy(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEconomy();
  }, [externalEconomy]);

  if (loading) {
    return (
      <div className="animate-pulse">
        {variant === 'mini' && <div className="w-20 h-6 bg-dark-elevated rounded-full"></div>}
        {variant === 'compact' && <div className="w-64 h-10 bg-dark-elevated rounded-lg"></div>}
        {variant === 'full' && <div className="w-full h-40 bg-dark-elevated rounded-xl"></div>}
      </div>
    );
  }

  if (error || !economy) {
    return null; // 静默失败，不阻塞页面
  }

  switch (variant) {
    case 'mini':
      return <EconomyIndicatorMini economy={economy} />;
    case 'full':
      return <EconomyIndicatorFull economy={economy} showDetails={showDetails} />;
    case 'compact':
    default:
      return <EconomyIndicatorCompact economy={economy} showLink={showLink} />;
  }
}

export default EconomyIndicator;
export { getStatusConfig };
