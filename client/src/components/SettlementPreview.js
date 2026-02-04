/**
 * 结算预览组件
 * 显示任务结算时 Agent 获得金额和销毁金额
 */

import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  AgentIcon,
  BurnIcon,
  InfoIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from './Icons';

/**
 * 结算预览组件
 * @param {number} taskPrice - 任务价格
 * @param {boolean} showBreakdown - 是否显示详细分解
 * @param {boolean} compact - 紧凑模式
 * @param {object} economy - 可选，外部传入经济数据
 */
function SettlementPreview({
  taskPrice,
  showBreakdown = false,
  compact = false,
  economy: externalEconomy = null
}) {
  const [economy, setEconomy] = useState(externalEconomy);
  const [expanded, setExpanded] = useState(showBreakdown);
  const [loading, setLoading] = useState(!externalEconomy);

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
        console.error('Failed to fetch economy status:', err);
        // 使用默认值
        setEconomy({ burnRate: 0.25, sigma: 1.0 });
      } finally {
        setLoading(false);
      }
    };

    fetchEconomy();
  }, [externalEconomy]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-5 bg-dark-elevated rounded w-32"></div>
      </div>
    );
  }

  const price = parseFloat(taskPrice) || 0;
  const burnRate = economy?.burnRate || 0.25;
  const agentRate = 1 - burnRate;
  const agentEarnings = Math.round(price * agentRate);
  const burnAmount = Math.round(price * burnRate);

  if (compact) {
    return (
      <div className="inline-flex items-center space-x-3 text-sm">
        <span className="flex items-center text-accent-green font-medium">
          <AgentIcon className="w-4 h-4 mr-1" />
          Agent +{agentEarnings} MP
        </span>
        <span className="flex items-center text-accent-orange">
          <BurnIcon className="w-4 h-4 mr-1" />
          -{burnAmount} MP
        </span>
      </div>
    );
  }

  return (
    <div className="bg-dark-card rounded-lg border border-dark-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-dark-text-secondary">结算预览</span>
        {!showBreakdown && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-dark-text-muted hover:text-dark-text-secondary"
          >
            {expanded ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {/* 主要数据 */}
        <div className="flex items-center justify-between">
          <span className="flex items-center text-sm text-dark-text-muted">
            <AgentIcon className="w-4 h-4 mr-2 text-accent-green" />
            Agent 获得
          </span>
          <span className="font-bold text-accent-green text-lg">
            +{agentEarnings} MP
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center text-sm text-dark-text-muted">
            <BurnIcon className="w-4 h-4 mr-2 text-accent-orange" />
            销毁
          </span>
          <span className="font-medium text-accent-orange">
            -{burnAmount} MP
          </span>
        </div>

        {/* 详细分解 */}
        {(expanded || showBreakdown) && (
          <div className="mt-3 pt-3 border-t border-dark-border space-y-2">
            <div className="flex items-center justify-between text-xs text-dark-text-muted">
              <span>任务价格</span>
              <span>{price} MP</span>
            </div>
            <div className="flex items-center justify-between text-xs text-dark-text-muted">
              <span>Agent 比例</span>
              <span>{(agentRate * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs text-dark-text-muted">
              <span>销毁比例 (B)</span>
              <span>{(burnRate * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs text-dark-text-muted">
              <span>当前 σ</span>
              <span>{economy?.sigma?.toFixed(2) || '1.00'}</span>
            </div>

            <div className="flex items-start space-x-2 text-xs text-dark-text-muted mt-2 pt-2 border-t border-dark-border/50">
              <InfoIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <p>
                销毁率 B 根据市场供给比率 σ 动态调整。
                σ 越高表示市场供给越充足，销毁率越高。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 简单的 Agent 预期收益显示
 * 用于任务列表卡片等场景
 */
function AgentEarningsPreview({ taskPrice, className = '' }) {
  const [economy, setEconomy] = useState(null);

  useEffect(() => {
    api.getEconomyStatus()
      .then(setEconomy)
      .catch(() => setEconomy({ burnRate: 0.25 }));
  }, []);

  const price = parseFloat(taskPrice) || 0;
  const burnRate = economy?.burnRate || 0.25;
  const agentEarnings = Math.round(price * (1 - burnRate));

  return (
    <span className={`flex items-center text-accent-green ${className}`}>
      <AgentIcon className="w-4 h-4 mr-1" />
      预期 +{agentEarnings} MP
    </span>
  );
}

export default SettlementPreview;
export { AgentEarningsPreview };
