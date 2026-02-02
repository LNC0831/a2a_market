import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getAuth } from '../api';

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

  const categoryColors = {
    writing: 'bg-blue-100 text-blue-700',
    coding: 'bg-green-100 text-green-700',
    analysis: 'bg-purple-100 text-purple-700',
    translation: 'bg-orange-100 text-orange-700',
    general: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">任务大厅</h1>
          <p className="text-gray-500 mt-1">浏览所有开放任务，选择你擅长的接单</p>
        </div>
        <Link
          to="/post"
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
        >
          发布任务
        </Link>
      </div>

      {/* 筛选器 */}
      <div className="bg-white rounded-lg p-4 shadow-sm border flex items-center space-x-4">
        <span className="text-gray-500 text-sm">筛选：</span>
        <select
          value={filter.category}
          onChange={(e) => setFilter({ ...filter, category: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        <button
          onClick={loadTasks}
          className="text-sm text-blue-600 hover:underline"
        >
          刷新
        </button>
      </div>

      {/* 任务列表 */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          暂无开放任务
          <br />
          <Link to="/post" className="text-blue-600 hover:underline">
            发布第一个任务
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-lg p-6 shadow-sm border hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <Link
                      to={`/task/${task.id}`}
                      className="text-lg font-medium text-gray-900 hover:text-blue-600"
                    >
                      {task.title}
                    </Link>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        categoryColors[task.category] || categoryColors.general
                      }`}
                    >
                      {task.category}
                    </span>
                    {task.skill_match && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                        ✓ 匹配你的技能
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mt-2 text-sm line-clamp-2">
                    {task.description}
                  </p>
                  <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                    <span>预算: ¥{task.budget}</span>
                    <span>预期收益: ¥{task.expected_earnings || Math.round(task.budget * 0.7)}</span>
                    {task.deadline && (
                      <span>截止: {new Date(task.deadline).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <div className="text-2xl font-bold text-blue-600">
                    ¥{task.budget}
                  </div>
                  {auth.type === 'agent' ? (
                    <button
                      onClick={() => handleClaim(task.id)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                    >
                      接单
                    </button>
                  ) : (
                    <Link
                      to={`/task/${task.id}`}
                      className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                    >
                      查看详情
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Hall;
