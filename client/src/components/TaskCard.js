/**
 * 独立任务卡片组件
 * 可复用的任务展示组件
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  MoneyIcon,
  ClockIcon,
  CheckCircleIcon,
  AgentIcon,
  ChevronRightIcon,
} from './Icons';
import { skillColors, skillLabels, getSkillIcon, statusConfig } from './Icons';

/**
 * 任务卡片组件
 * @param {object} task - 任务数据
 * @param {boolean} isAgent - 是否为 Agent 视角
 * @param {function} onClaim - 接单回调
 * @param {object} economy - 经济数据 (用于计算预期收益)
 * @param {boolean} showStatus - 是否显示状态
 * @param {boolean} compact - 紧凑模式
 */
function TaskCard({
  task,
  isAgent = false,
  onClaim,
  economy,
  showStatus = false,
  compact = false,
}) {
  const SkillIcon = getSkillIcon(task.category);
  const burnRate = economy?.burnRate || 0.25;
  const expectedEarnings = task.expected_earnings || Math.round(task.budget * (1 - burnRate));
  const status = statusConfig[task.status] || statusConfig.open;
  const StatusIcon = status?.icon;

  if (compact) {
    return (
      <Link
        to={`/task/${task.id}`}
        className="block p-4 bg-dark-card rounded-lg border border-dark-border hover:bg-dark-elevated transition-colors"
      >
        <div className="flex justify-between items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium text-dark-text-primary truncate">{task.title}</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${skillColors[task.category] || skillColors.general}`}>
                {skillLabels[task.category] || task.category}
              </span>
            </div>
            <div className="flex items-center space-x-3 text-sm text-dark-text-muted">
              <span className="flex items-center">
                <MoneyIcon className="w-3.5 h-3.5 mr-1" />
                {task.budget} MP
              </span>
              {showStatus && (
                <span className={`flex items-center ${status.color}`}>
                  <StatusIcon className="w-3.5 h-3.5 mr-1" />
                  {status.label}
                </span>
              )}
            </div>
          </div>
          <ChevronRightIcon className="w-5 h-5 text-dark-text-muted flex-shrink-0" />
        </div>
      </Link>
    );
  }

  return (
    <div className="bg-dark-card rounded-xl p-6 border border-dark-border hover:border-dark-elevated transition-colors">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* 标题行 */}
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <Link
              to={`/task/${task.id}`}
              className="text-lg font-semibold text-dark-text-primary hover:text-accent-cyan transition-colors"
            >
              {task.title}
            </Link>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${skillColors[task.category] || skillColors.general}`}>
              <SkillIcon className="w-3 h-3 mr-1" />
              {skillLabels[task.category] || task.category}
            </span>
            {task.skill_match && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent-green/20 text-accent-green border border-accent-green/30">
                <CheckCircleIcon className="w-3 h-3 mr-1" />
                匹配技能
              </span>
            )}
            {showStatus && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </span>
            )}
          </div>

          {/* 描述 */}
          <p className="text-dark-text-secondary text-sm line-clamp-2 mb-3">
            {task.description}
          </p>

          {/* 元信息 */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-dark-text-muted">
            <span className="flex items-center">
              <MoneyIcon className="w-4 h-4 mr-1" />
              任务价 {task.budget} MP
            </span>
            <span className="flex items-center text-accent-green font-medium">
              <AgentIcon className="w-4 h-4 mr-1" />
              预期 +{expectedEarnings} MP
            </span>
            {task.deadline && (
              <span className="flex items-center">
                <ClockIcon className="w-4 h-4 mr-1" />
                {new Date(task.deadline).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* 右侧操作区 */}
        <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-2">
          <div>
            <div className="text-2xl font-bold text-accent-cyan">
              {task.budget} MP
            </div>
            <div className="text-xs text-accent-green text-right">
              Agent +{expectedEarnings} MP
            </div>
          </div>
          {isAgent && onClaim && task.status === 'open' ? (
            <button
              onClick={() => onClaim(task.id)}
              className="inline-flex items-center px-4 py-2 bg-accent-cyan text-dark-bg text-sm font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors"
            >
              <AgentIcon className="w-4 h-4 mr-1" />
              接单
            </button>
          ) : (
            <Link
              to={`/task/${task.id}`}
              className="inline-flex items-center px-4 py-2 border border-dark-border text-dark-text-secondary text-sm font-medium rounded-lg hover:bg-dark-elevated transition-colors"
            >
              查看详情
              <ChevronRightIcon className="w-4 h-4 ml-1" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaskCard;
