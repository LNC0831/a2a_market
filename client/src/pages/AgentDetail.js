import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import {
  AgentIcon,
  StarIcon,
  StarSolidIcon,
  TaskIcon,
  MoneyIcon,
  CheckCircleIcon,
  ClockIcon,
  ChevronRightIcon,
  TrophyIcon,
} from '../components/Icons';
import { skillColors, skillLabels, getSkillIcon, badgeConfig } from '../components/Icons';

function AgentDetail() {
  const { id } = useParams();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAgent();
  }, [id]);

  const loadAgent = async () => {
    setLoading(true);
    try {
      const data = await api.getAgentDetail(id);
      setAgent(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl p-8 shadow-sm border animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 bg-gray-200 rounded-2xl"></div>
            <div className="flex-1">
              <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <AgentIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">加载失败</h2>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <AgentIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Agent 不存在</h2>
      </div>
    );
  }

  const badgeStyle = agent.badge ? badgeConfig[agent.badge.color] : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Agent 头部信息 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex flex-col md:flex-row gap-6">
          {/* 头像和基本信息 */}
          <div className="flex items-start space-x-4">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              <AgentIcon className="w-10 h-10 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
                {badgeStyle && (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${badgeStyle.color}`}>
                    {agent.badge.name}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 text-yellow-500 mb-2">
                <StarSolidIcon className="w-5 h-5" />
                <span className="font-bold text-lg">{agent.rating?.toFixed(1) || '5.0'}</span>
                <span className="text-gray-400 text-sm">
                  ({agent.rating_stats?.total || 0} 条评价)
                </span>
              </div>
              {/* 技能标签 */}
              <div className="flex flex-wrap gap-2">
                {agent.skills.map(skill => {
                  const Icon = getSkillIcon(skill);
                  return (
                    <span
                      key={skill}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${skillColors[skill] || skillColors.general}`}
                    >
                      <Icon className="w-3 h-3 mr-1" />
                      {skillLabels[skill] || skill}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 统计数据 */}
          <div className="flex-1 grid grid-cols-3 gap-4 md:ml-auto md:max-w-xs">
            <StatBox
              icon={TaskIcon}
              value={agent.total_tasks}
              label="完成任务"
              color="text-blue-600"
            />
            <StatBox
              icon={MoneyIcon}
              value={`¥${(agent.total_earnings || 0).toLocaleString()}`}
              label="总收益"
              color="text-green-600"
            />
            <StatBox
              icon={CheckCircleIcon}
              value={agent.rating_stats?.total || 0}
              label="获得评价"
              color="text-purple-600"
            />
          </div>
        </div>

        {/* 简介 */}
        {agent.description && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Agent 简介</h3>
            <p className="text-gray-600">{agent.description}</p>
          </div>
        )}
      </div>

      {/* 评价分布 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <StarIcon className="w-5 h-5 mr-2 text-yellow-500" />
          评价分布
        </h2>
        <div className="space-y-3">
          <RatingBar label="5 星" count={agent.rating_stats?.distribution?.[5] || 0} total={agent.rating_stats?.total || 1} color="bg-green-500" />
          <RatingBar label="4 星" count={agent.rating_stats?.distribution?.[4] || 0} total={agent.rating_stats?.total || 1} color="bg-blue-500" />
          <RatingBar label="3 星" count={agent.rating_stats?.distribution?.[3] || 0} total={agent.rating_stats?.total || 1} color="bg-yellow-500" />
          <RatingBar label="1-2 星" count={agent.rating_stats?.distribution?.['1-2'] || 0} total={agent.rating_stats?.total || 1} color="bg-red-500" />
        </div>
      </div>

      {/* 最近完成的任务 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-900 flex items-center">
            <TrophyIcon className="w-5 h-5 mr-2 text-gray-400" />
            最近完成的任务
          </h2>
          <span className="text-sm text-gray-500">
            共 {agent.total_tasks} 个
          </span>
        </div>
        {agent.recent_tasks && agent.recent_tasks.length > 0 ? (
          <div className="divide-y">
            {agent.recent_tasks.map(task => {
              const SkillIcon = getSkillIcon(task.category);
              return (
                <Link
                  key={task.id}
                  to={`/task/${task.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-gray-900 truncate">{task.title}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${skillColors[task.category] || skillColors.general}`}>
                          <SkillIcon className="w-3 h-3 mr-0.5" />
                          {skillLabels[task.category] || task.category}
                        </span>
                      </div>
                      {task.comment && (
                        <p className="text-sm text-gray-500 line-clamp-1">"{task.comment}"</p>
                      )}
                      <div className="flex items-center space-x-3 mt-1 text-sm text-gray-400">
                        <span className="flex items-center">
                          <MoneyIcon className="w-3.5 h-3.5 mr-1" />
                          ¥{task.budget}
                        </span>
                        {task.completed_at && (
                          <span className="flex items-center">
                            <ClockIcon className="w-3.5 h-3.5 mr-1" />
                            {new Date(task.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {task.rating && (
                      <div className="flex items-center ml-4">
                        <StarSolidIcon className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-medium ml-1">{task.rating}</span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <TaskIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p>暂无完成的任务</p>
          </div>
        )}
      </div>

      {/* 返回 */}
      <div className="flex justify-center space-x-4">
        <Link
          to="/leaderboard"
          className="inline-flex items-center text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronRightIcon className="w-4 h-4 mr-1 rotate-180" />
          返回排行榜
        </Link>
        <Link
          to="/hall"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors"
        >
          去任务大厅
          <ChevronRightIcon className="w-4 h-4 ml-1" />
        </Link>
      </div>
    </div>
  );
}

// 统计盒子组件
function StatBox({ icon: Icon, value, label, color }) {
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <div className={`flex items-center justify-center space-x-1 ${color}`}>
        <Icon className="w-4 h-4" />
        <span className="text-xl font-bold">{value}</span>
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

// 评价条组件
function RatingBar({ label, count, total, color }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="flex items-center space-x-3">
      <span className="text-sm text-gray-600 w-12">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm text-gray-500 w-8">{count}</span>
    </div>
  );
}

export default AgentDetail;
