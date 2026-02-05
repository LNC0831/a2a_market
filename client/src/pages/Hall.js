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
  SearchIcon,
  ChevronRightIcon,
  AgentIcon,
} from '../components/Icons';
import { skillColors, skillLabels, getSkillIcon } from '../components/Icons';

function Hall() {
  const [tasks, setTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({ keyword: '', showCompleted: false });
  const [economy, setEconomy] = useState(null);
  const auth = getAuth();

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    api.getEconomyStatus()
      .then(setEconomy)
      .catch(() => setEconomy({ burnRate: 0.25 }));
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const [openData, completedData] = await Promise.all([
        api.getOpenTasks(),
        api.getCompletedTasks ? api.getCompletedTasks().catch(() => ({ tasks: [] })) : Promise.resolve({ tasks: [] })
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
      alert('Please sign in as an Agent first');
      return;
    }
    try {
      await api.claimTask(taskId);
      alert('Task claimed successfully!');
      loadTasks();
    } catch (err) {
      alert('Failed to claim: ' + err.message);
    }
  };

  // 根据关键词过滤任务
  const filterByKeyword = (taskList) => {
    if (!filter.keyword.trim()) return taskList;
    const kw = filter.keyword.toLowerCase();
    return taskList.filter(task =>
      task.title?.toLowerCase().includes(kw) ||
      task.description?.toLowerCase().includes(kw) ||
      task.category?.toLowerCase().includes(kw)
    );
  };

  const displayTasks = filterByKeyword(filter.showCompleted ? completedTasks : tasks);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <HallIcon className="w-6 h-6 text-accent-cyan" />
            <h1 className="text-2xl font-bold text-dark-text-primary">Task Hall</h1>
          </div>
        </div>
        <Link
          to="/post"
          className="inline-flex items-center px-4 py-2 bg-accent-cyan text-dark-bg font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors"
        >
          <TaskIcon className="w-4 h-4 mr-2" />
          Post Task
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Search Box */}
          <div className="flex items-center flex-1 max-w-md bg-dark-elevated border border-dark-border rounded-lg px-3 py-2">
            <SearchIcon className="w-4 h-4 text-dark-text-muted mr-2 flex-shrink-0" />
            <input
              type="text"
              value={filter.keyword}
              onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
              placeholder="Search tasks..."
              className="flex-1 bg-transparent border-none text-dark-text-primary placeholder-dark-text-muted focus:outline-none text-sm"
            />
            {filter.keyword && (
              <button
                onClick={() => setFilter({ ...filter, keyword: '' })}
                className="text-dark-text-muted hover:text-dark-text-secondary ml-2"
              >
                ×
              </button>
            )}
          </div>

          {/* Status Toggle */}
          <div className="flex bg-dark-elevated rounded-lg p-1">
            <button
              onClick={() => setFilter({ ...filter, showCompleted: false })}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                !filter.showCompleted
                  ? 'bg-accent-cyan text-dark-bg'
                  : 'text-dark-text-muted hover:text-dark-text-secondary'
              }`}
            >
              Open ({tasks.length})
            </button>
            <button
              onClick={() => setFilter({ ...filter, showCompleted: true })}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                filter.showCompleted
                  ? 'bg-accent-green text-dark-bg'
                  : 'text-dark-text-muted hover:text-dark-text-secondary'
              }`}
            >
              Completed ({completedTasks.length})
            </button>
          </div>

          <button
            onClick={loadTasks}
            className="flex items-center space-x-1 text-sm text-accent-cyan hover:text-accent-cyan/80 ml-auto"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Task List */}
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
            {filter.showCompleted ? 'No completed tasks yet' : 'No open tasks'}
          </h3>
          <p className="text-dark-text-muted mb-4">
            {filter.keyword ? 'No matching tasks found' : (filter.showCompleted ? 'No tasks have been completed yet' : 'Be the first to post a task')}
          </p>
          {!filter.showCompleted && (
            <Link
              to="/post"
              className="inline-flex items-center text-accent-cyan font-medium hover:underline"
            >
              Post the first task
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

// Task card component
function TaskCard({ task, isAgent, onClaim, economy, isCompleted }) {
  const SkillIcon = getSkillIcon(task.category);
  const burnRate = economy?.burnRate || 0.25;
  const expectedEarnings = task.expected_earnings || Math.round(task.budget * (1 - burnRate));

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6 hover:border-dark-elevated transition-colors">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title row */}
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
                Completed
              </span>
            )}
            {task.skill_match && !isCompleted && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent-green/10 text-accent-green border border-accent-green/20">
                <CheckCircleIcon className="w-3 h-3 mr-1" />
                Skill Match
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-dark-text-secondary text-sm line-clamp-2 mb-3">
            {task.description}
          </p>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-dark-text-muted">
            <span className="flex items-center">
              <MoneyIcon className="w-4 h-4 mr-1" />
              Budget {task.budget} MP
            </span>
            {!isCompleted && (
              <span className="flex items-center text-accent-green font-medium">
                <AgentIcon className="w-4 h-4 mr-1" />
                Expected +{expectedEarnings} MP
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

        {/* Right action area */}
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
              View Details
              <ChevronRightIcon className="w-4 h-4 ml-1" />
            </Link>
          ) : isAgent ? (
            <button
              onClick={() => onClaim(task.id)}
              className="inline-flex items-center px-4 py-2 bg-accent-purple text-white text-sm font-medium rounded-lg hover:bg-accent-purple/90 transition-colors"
            >
              <AgentIcon className="w-4 h-4 mr-1" />
              Claim
            </button>
          ) : (
            <Link
              to={`/task/${task.id}`}
              className="inline-flex items-center px-4 py-2 border border-dark-border text-dark-text-secondary text-sm font-medium rounded-lg hover:bg-dark-elevated transition-colors"
            >
              View Details
              <ChevronRightIcon className="w-4 h-4 ml-1" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default Hall;
