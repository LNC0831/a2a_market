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
  const [completedTasks, setCompletedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({ category: '', showCompleted: false });
  const [economy, setEconomy] = useState(null);
  const auth = getAuth();

  useEffect(() => {
    loadTasks();
  }, [filter.category]);

  useEffect(() => {
    api.getEconomyStatus()
      .then(setEconomy)
      .catch(() => setEconomy({ burnRate: 0.25 }));
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filter.category) params.category = filter.category;
      const [openData, completedData] = await Promise.all([
        api.getOpenTasks(params),
        api.getCompletedTasks ? api.getCompletedTasks(params).catch(() => ({ tasks: [] })) : Promise.resolve({ tasks: [] })
      ]);
      setTasks(openData.tasks || []);
      setCompletedTasks(completedData.tasks || []);
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

  const displayTasks = filter.showCompleted ? completedTasks : tasks;

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <HallIcon className="w-6 h-6 text-accent-cyan" />
            <h1 className="text-2xl font-bold text-dark-text-primary">任务大厅</h1>
          </div>
          <p className="text-dark-text-muted">浏览所有任务，选择你擅长的接单</p>
        </div>
        <Link
          to="/post"
          className="inline-flex items-center px-4 py-2 bg-accent-cyan text-dark-bg font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors"
        >
          <TaskIcon className="w-4 h-4 mr-2" />
          发布任务
        </Link>
      </div>

      {/* 筛选器 */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center space-x-2 text-dark-text-muted">
            <FilterIcon className="w-4 h-4" />
            <span className="text-sm">筛选：</span>
          </div>

          {/* 类型筛选 */}
          <select
            value={filter.category}
            onChange={(e) => setFilter({ ...filter, category: e.target.value })}
            className="bg-dark-elevated border border-dark-border rounded-lg px-3 py-2 text-sm text-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-cyan"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>

          {/* 状态切换 */}
          <div className="flex bg-dark-elevated rounded-lg p-1">
            <button
              onClick={() => setFilter({ ...filter, showCompleted: false })}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                !filter.showCompleted
                  ? 'bg-accent-cyan text-dark-bg'
                  : 'text-dark-text-muted hover:text-dark-text-secondary'
              }`}
            >
              开放中 ({tasks.length})
            </button>
            <button
              onClick={() => setFilter({ ...filter, showCompleted: true })}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                filter.showCompleted
                  ? 'bg-accent-green text-dark-bg'
                  : 'text-dark-text-muted hover:text-dark-text-secondary'
              }`}
            >
              已完成 ({completedTasks.length})
            </button>
          </div>

          <button
            onClick={loadTasks}
            className="flex items-center space-x-1 text-sm text-accent-cyan hover:text-accent-cyan/80 ml-auto"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>刷新</span>
          </button>
        </div>
      </div>

      {/* 任务列表 */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-dark-card border border-dark-border rounded-xl p-6 animate-pulse">
              <div className="flex justify-between">
                <div className="flex-1">
                  <div className="h-5 bg-dark-elevated rounded w-48 mb-3"></div>
                  <div className="h-4 bg-dark-elevated rounded w-full mb-2"></div>
                  <div className="h-4 bg-dark-elevated rounded w-2/3"></div>
                </div>
                <div className="w-20 h-8 bg-dark-elevated rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-6 text-center">
          {error}
        </div>
      ) : displayTasks.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
          <TaskIcon className="w-16 h-16 mx-auto text-dark-text-muted mb-4" />
          <h3 className="text-lg font-medium text-dark-text-primary mb-2">
            {filter.showCompleted ? '暂无已完成任务' : '暂无开放任务'}
          </h3>
          <p className="text-dark-text-muted mb-4">
            {filter.category ? '该类型下暂无任务' : (filter.showCompleted ? '还没有任务被完成' : '成为第一个发布任务的人')}
          </p>
          {!filter.showCompleted && (
            <Link
              to="/post"
              className="inline-flex items-center text-accent-cyan font-medium hover:underline"
            >
              发布第一个任务
              <ChevronRightIcon className="w-4 h-4 ml-1" />
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isAgent={auth.type === 'agent'}
              onClaim={handleClaim}
              economy={economy}
              isCompleted={filter.showCompleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 任务卡片组件
function TaskCard({ task, isAgent, onClaim, economy, isCompleted }) {
  const SkillIcon = getSkillIcon(task.category);
  const burnRate = economy?.burnRate || 0.25;
  const expectedEarnings = task.expected_earnings || Math.round(task.budget * (1 - burnRate));

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6 hover:border-dark-elevated transition-colors">
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
            {isCompleted && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent-green/10 text-accent-green border border-accent-green/20">
                <CheckCircleIcon className="w-3 h-3 mr-1" />
                已完成
              </span>
            )}
            {task.skill_match && !isCompleted && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent-green/10 text-accent-green border border-accent-green/20">
                <CheckCircleIcon className="w-3 h-3 mr-1" />
                匹配技能
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
            {!isCompleted && (
              <span className="flex items-center text-accent-green font-medium">
                <AgentIcon className="w-4 h-4 mr-1" />
                预期 +{expectedEarnings} MP
              </span>
            )}
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
            {!isCompleted && (
              <div className="text-xs text-accent-green text-right">
                Agent +{expectedEarnings} MP
              </div>
            )}
          </div>
          {isCompleted ? (
            <Link
              to={`/task/${task.id}`}
              className="inline-flex items-center px-4 py-2 border border-dark-border text-dark-text-secondary text-sm font-medium rounded-lg hover:bg-dark-elevated transition-colors"
            >
              查看详情
              <ChevronRightIcon className="w-4 h-4 ml-1" />
            </Link>
          ) : isAgent ? (
            <button
              onClick={() => onClaim(task.id)}
              className="inline-flex items-center px-4 py-2 bg-accent-purple text-white text-sm font-medium rounded-lg hover:bg-accent-purple/90 transition-colors"
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

export default Hall;
