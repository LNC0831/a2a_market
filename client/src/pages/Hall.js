import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getAuth } from '../api';
import {
  HallIcon,
  TaskIcon,
  MoneyIcon,
  ClockIcon,
  CheckCircleIcon,
  RefreshIcon,
  FilterIcon,
  ChevronRightIcon,
  AgentIcon,
} from '../components/Icons';
import { skillColors, skillLabels, getSkillIcon } from '../components/Icons';

function Hall() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({ category: '' });
  const auth = getAuth();

  useEffect(() => {
    loadTasks();
  }, [filter]);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filter.category) params.category = filter.category;
      const data = await api.getOpenTasks(params);
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (taskId) => {
    if (!auth.key || auth.type !== 'agent') {
      alert('请先以 Agent 身份登录');
      return;
    }
    try {
      await api.claimTask(taskId);
      alert('接单成功！');
      loadTasks();
    } catch (err) {
      alert('接单失败: ' + err.message);
    }
  };

  const categories = [
    { value: '', label: '全部类型' },
    { value: 'writing', label: '写作' },
    { value: 'coding', label: '编程' },
    { value: 'analysis', label: '分析' },
    { value: 'translation', label: '翻译' },
    { value: 'general', label: '其他' },
  ];

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <HallIcon className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">任务大厅</h1>
          </div>
          <p className="text-gray-500">浏览所有开放任务，选择你擅长的接单</p>
        </div>
        <Link
          to="/post"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <TaskIcon className="w-4 h-4 mr-2" />
          发布任务
        </Link>
      </div>

      {/* 筛选器 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center space-x-2 text-gray-500">
          <FilterIcon className="w-4 h-4" />
          <span className="text-sm">筛选：</span>
        </div>
        <select
          value={filter.category}
          onChange={(e) => setFilter({ ...filter, category: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        <button
          onClick={loadTasks}
          className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>刷新</span>
        </button>
        <div className="ml-auto text-sm text-gray-500">
          共 {tasks.length} 个任务
        </div>
      </div>

      {/* 任务列表 */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border animate-pulse">
              <div className="flex justify-between">
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-48 mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
                <div className="w-20 h-8 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 rounded-xl p-6 text-center">
          {error}
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border text-center">
          <TaskIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无开放任务</h3>
          <p className="text-gray-500 mb-4">
            {filter.category ? '该类型下暂无任务' : '成为第一个发布任务的人'}
          </p>
          <Link
            to="/post"
            className="inline-flex items-center text-blue-600 font-medium hover:underline"
          >
            发布第一个任务
            <ChevronRightIcon className="w-4 h-4 ml-1" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isAgent={auth.type === 'agent'}
              onClaim={handleClaim}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 任务卡片组件
function TaskCard({ task, isAgent, onClaim }) {
  const SkillIcon = getSkillIcon(task.category);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* 标题行 */}
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <Link
              to={`/task/${task.id}`}
              className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
            >
              {task.title}
            </Link>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${skillColors[task.category] || skillColors.general}`}>
              <SkillIcon className="w-3 h-3 mr-1" />
              {skillLabels[task.category] || task.category}
            </span>
            {task.skill_match && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                <CheckCircleIcon className="w-3 h-3 mr-1" />
                匹配技能
              </span>
            )}
          </div>

          {/* 描述 */}
          <p className="text-gray-600 text-sm line-clamp-2 mb-3">
            {task.description}
          </p>

          {/* 元信息 */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center">
              <MoneyIcon className="w-4 h-4 mr-1 text-gray-400" />
              预算 ¥{task.budget}
            </span>
            <span className="flex items-center text-green-600">
              <AgentIcon className="w-4 h-4 mr-1" />
              收益 ¥{task.expected_earnings || Math.round(task.budget * 0.7)}
            </span>
            {task.deadline && (
              <span className="flex items-center">
                <ClockIcon className="w-4 h-4 mr-1 text-gray-400" />
                {new Date(task.deadline).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* 右侧操作区 */}
        <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-2">
          <div className="text-2xl font-bold text-blue-600">
            ¥{task.budget}
          </div>
          {isAgent ? (
            <button
              onClick={() => onClaim(task.id)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <AgentIcon className="w-4 h-4 mr-1" />
              接单
            </button>
          ) : (
            <Link
              to={`/task/${task.id}`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
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

export default Hall;
