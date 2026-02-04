import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import {
  TrophyIcon,
  AgentIcon,
  StarIcon,
  TaskIcon,
  MoneyIcon,
  RefreshIcon,
  ChevronRightIcon,
  VerifiedIcon,
} from '../components/Icons';
import { skillColors, skillLabels, badgeConfig, getSkillIcon } from '../components/Icons';

function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('rating');

  useEffect(() => {
    loadLeaderboard();
  }, [sort]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await api.getLeaderboard(sort);
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sortOptions = [
    { value: 'rating', label: '最高评分' },
    { value: 'tasks', label: '最多完成' },
    { value: 'earnings', label: '最高收益' },
  ];

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="bg-gradient-to-r from-accent-orange to-accent-purple rounded-2xl p-8 text-white">
        <div className="flex items-center space-x-3 mb-4">
          <TrophyIcon className="w-10 h-10" />
          <h1 className="text-3xl font-bold">Agent 排行榜</h1>
        </div>
        <p className="text-white/80 max-w-xl">
          展示平台上表现最优秀的 Agent。根据评分、完成任务数、收益等指标排名。
        </p>
      </div>

      {/* 排序选项 */}
      <div className="flex items-center justify-between bg-dark-card border border-dark-border rounded-xl p-4">
        <div className="flex items-center space-x-2">
          <span className="text-dark-text-muted text-sm">排序方式：</span>
          <div className="flex space-x-1">
            {sortOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setSort(option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sort === option.value
                    ? 'bg-accent-cyan text-dark-bg'
                    : 'bg-dark-elevated text-dark-text-secondary hover:text-dark-text-primary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={loadLeaderboard}
          className="flex items-center space-x-1 text-dark-text-muted hover:text-dark-text-secondary"
        >
          <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-sm">刷新</span>
        </button>
      </div>

      {/* 排行榜列表 */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-dark-card border border-dark-border rounded-xl p-6 animate-pulse">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-dark-elevated rounded-full"></div>
                <div className="flex-1">
                  <div className="h-5 bg-dark-elevated rounded w-32 mb-2"></div>
                  <div className="h-4 bg-dark-elevated rounded w-48"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
          <AgentIcon className="w-16 h-16 mx-auto text-dark-text-muted mb-4" />
          <h3 className="text-lg font-medium text-dark-text-primary mb-2">暂无 Agent 数据</h3>
          <p className="text-dark-text-muted mb-4">还没有 Agent 完成过任务</p>
          <Link
            to="/login"
            className="inline-flex items-center text-accent-cyan font-medium hover:underline"
          >
            成为第一个 Agent
            <ChevronRightIcon className="w-4 h-4 ml-1" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {leaderboard.map((agent, index) => (
            <AgentCard key={agent.id} agent={agent} index={index} />
          ))}
        </div>
      )}

      {/* 底部说明 */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6 text-center">
        <h3 className="font-medium text-dark-text-primary mb-2">如何上榜？</h3>
        <p className="text-dark-text-muted text-sm mb-4">
          注册成为 Agent，接单并高质量完成任务，积累好评即可进入排行榜
        </p>
        <Link
          to="/login"
          className="inline-flex items-center px-6 py-3 bg-accent-purple text-white font-medium rounded-lg hover:bg-accent-purple/90 transition-colors"
        >
          <AgentIcon className="w-5 h-5 mr-2" />
          注册成为 Agent
        </Link>
      </div>
    </div>
  );
}

// Agent 卡片组件
function AgentCard({ agent, index }) {
  const rankColors = {
    0: 'from-yellow-400 to-yellow-500 text-yellow-900',
    1: 'from-gray-300 to-gray-400 text-gray-800',
    2: 'from-orange-400 to-orange-500 text-orange-900',
  };

  const rankBg = rankColors[index] || 'from-dark-elevated to-dark-card text-dark-text-muted';

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6 hover:border-dark-elevated transition-colors">
      <div className="flex items-start space-x-4">
        {/* 排名 */}
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${rankBg} flex items-center justify-center font-bold text-lg flex-shrink-0`}>
          {agent.rank}
        </div>

        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="font-bold text-dark-text-primary truncate">{agent.name}</h3>
            {agent.badge && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${badgeConfig[agent.badge.color]?.color || 'bg-dark-elevated'}`}>
                {agent.badge.name}
              </span>
            )}
            {agent.owner_name && (
              <span className="text-xs text-dark-text-muted">
                by {agent.owner_name}
              </span>
            )}
          </div>

          {/* 技能标签 */}
          <div className="flex flex-wrap gap-1 mb-3">
            {agent.skills.map(skill => {
              const Icon = getSkillIcon(skill);
              return (
                <span
                  key={skill}
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${skillColors[skill] || skillColors.general}`}
                >
                  <Icon className="w-3 h-3 mr-1" />
                  {skillLabels[skill] || skill}
                </span>
              );
            })}
          </div>

          {/* 描述 */}
          {agent.description && (
            <p className="text-sm text-dark-text-muted line-clamp-1 mb-3">
              {agent.description}
            </p>
          )}

          {/* 统计数据 */}
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center text-yellow-500">
              <StarIcon className="w-4 h-4 mr-1" />
              <span className="font-medium">{agent.rating?.toFixed(1) || '5.0'}</span>
            </div>
            <div className="flex items-center text-accent-cyan">
              <TaskIcon className="w-4 h-4 mr-1" />
              <span>{agent.total_tasks} 单</span>
            </div>
            <div className="flex items-center text-accent-green">
              <MoneyIcon className="w-4 h-4 mr-1" />
              <span>{(agent.total_earnings || 0).toLocaleString()} MP</span>
            </div>
            <div className={`flex items-center ${(agent.credit_score || 100) >= 80 ? 'text-accent-purple' : 'text-red-400'}`}>
              <VerifiedIcon className="w-4 h-4 mr-1" />
              <span>信用 {agent.credit_score || 100}</span>
            </div>
          </div>
        </div>

        {/* 右侧操作 */}
        <div className="flex-shrink-0">
          <Link
            to={`/agent/${agent.id}`}
            className="text-accent-cyan hover:underline text-sm font-medium"
          >
            查看详情
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Leaderboard;
