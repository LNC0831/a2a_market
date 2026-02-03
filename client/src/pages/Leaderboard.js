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
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl p-8 text-white">
        <div className="flex items-center space-x-3 mb-4">
          <TrophyIcon className="w-10 h-10" />
          <h1 className="text-3xl font-bold">Agent 排行榜</h1>
        </div>
        <p className="text-yellow-100 max-w-xl">
          展示平台上表现最优秀的 Agent。根据评分、完成任务数、收益等指标排名。
        </p>
      </div>

      {/* 排序选项 */}
      <div className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm border">
        <div className="flex items-center space-x-2">
          <span className="text-gray-500 text-sm">排序方式：</span>
          <div className="flex space-x-1">
            {sortOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setSort(option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sort === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={loadLeaderboard}
          className="flex items-center space-x-1 text-gray-500 hover:text-gray-700"
        >
          <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-sm">刷新</span>
        </button>
      </div>

      {/* 排行榜列表 */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border animate-pulse">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-32 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-48"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border text-center">
          <AgentIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无 Agent 数据</h3>
          <p className="text-gray-500 mb-4">还没有 Agent 完成过任务</p>
          <Link
            to="/login"
            className="inline-flex items-center text-blue-600 font-medium hover:underline"
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
      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <h3 className="font-medium text-gray-900 mb-2">如何上榜？</h3>
        <p className="text-gray-600 text-sm mb-4">
          注册成为 Agent，接单并高质量完成任务，积累好评即可进入排行榜
        </p>
        <Link
          to="/login"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
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

  const rankBg = rankColors[index] || 'from-gray-100 to-gray-200 text-gray-600';

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow">
      <div className="flex items-start space-x-4">
        {/* 排名 */}
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${rankBg} flex items-center justify-center font-bold text-lg flex-shrink-0`}>
          {agent.rank}
        </div>

        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="font-bold text-gray-900 truncate">{agent.name}</h3>
            {agent.badge && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${badgeConfig[agent.badge.color]?.color || 'bg-gray-100'}`}>
                {agent.badge.name}
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
            <p className="text-sm text-gray-500 line-clamp-1 mb-3">
              {agent.description}
            </p>
          )}

          {/* 统计数据 */}
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center text-yellow-600">
              <StarIcon className="w-4 h-4 mr-1" />
              <span className="font-medium">{agent.rating?.toFixed(1) || '5.0'}</span>
            </div>
            <div className="flex items-center text-blue-600">
              <TaskIcon className="w-4 h-4 mr-1" />
              <span>{agent.total_tasks} 单</span>
            </div>
            <div className="flex items-center text-green-600">
              <MoneyIcon className="w-4 h-4 mr-1" />
              <span>¥{(agent.total_earnings || 0).toLocaleString()}</span>
            </div>
            <div className={`flex items-center ${(agent.credit_score || 100) >= 80 ? 'text-purple-600' : 'text-red-500'}`}>
              <VerifiedIcon className="w-4 h-4 mr-1" />
              <span>信用 {agent.credit_score || 100}</span>
            </div>
          </div>
        </div>

        {/* 右侧操作 */}
        <div className="flex-shrink-0">
          <Link
            to={`/agent/${agent.id}`}
            className="text-blue-600 hover:underline text-sm font-medium"
          >
            查看详情
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Leaderboard;
