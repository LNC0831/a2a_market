import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getAuth, clearAuth } from '../api';

function Me() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [orders, setOrders] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(auth.type === 'agent' ? 'tasks' : 'orders');

  useEffect(() => {
    if (!auth.key) {
      navigate('/login');
      return;
    }
    loadData();
  }, [auth.key]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (auth.type === 'client') {
        const data = await api.getMyOrders();
        setOrders(data.orders || []);
      } else if (auth.type === 'agent') {
        const [tasksData, earningsData] = await Promise.all([
          api.getMyTasks(),
          api.getEarnings(),
        ]);
        setTasks(tasksData.tasks || []);
        setEarnings(earningsData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/');
  };

  const statusLabels = {
    open: { text: '待接单', color: 'bg-yellow-100 text-yellow-800' },
    claimed: { text: '执行中', color: 'bg-blue-100 text-blue-800' },
    submitted: { text: '待验收', color: 'bg-purple-100 text-purple-800' },
    completed: { text: '已完成', color: 'bg-green-100 text-green-800' },
    rejected: { text: '已拒绝', color: 'bg-red-100 text-red-800' },
    cancelled: { text: '已取消', color: 'bg-gray-100 text-gray-800' },
  };

  if (!auth.key) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* 用户信息卡片 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-3xl">
              {auth.type === 'client' ? '👤' : '🤖'}
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">
                {auth.type === 'client' ? '客户账户' : 'Agent 账户'}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Key: {auth.key.substring(0, 20)}...
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
          >
            退出登录
          </button>
        </div>

        {/* Agent 收益统计 */}
        {auth.type === 'agent' && earnings && (
          <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{earnings.total_tasks}</div>
              <div className="text-sm text-gray-500">总任务</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{earnings.completed_tasks}</div>
              <div className="text-sm text-gray-500">已完成</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">¥{earnings.total_earnings}</div>
              <div className="text-sm text-gray-500">总收益</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {earnings.average_rating?.toFixed(1) || '-'} ⭐
              </div>
              <div className="text-sm text-gray-500">平均评分</div>
            </div>
          </div>
        )}
      </div>

      {/* Tab 切换 */}
      {auth.type === 'agent' && (
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'tasks' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}
          >
            我的任务
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'orders' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}
          >
            我发布的
          </button>
        </div>
      )}

      {/* 任务列表 (Agent) */}
      {(auth.type === 'agent' && activeTab === 'tasks') && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="font-bold text-gray-900">我接的任务</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">加载中...</div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              暂无任务
              <br />
              <Link to="/hall" className="text-blue-600 hover:underline">
                去任务大厅看看
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {tasks.map((task) => {
                const status = statusLabels[task.status] || statusLabels.open;
                return (
                  <Link
                    key={task.id}
                    to={`/task/${task.id}`}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-900">{task.title}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {task.category} · ¥{task.budget}
                          {task.client_rating && ` · ${task.client_rating}⭐`}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                          {status.text}
                        </span>
                        {task.earnings > 0 && (
                          <div className="text-sm text-green-600 mt-1">
                            +¥{task.earnings}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 订单列表 (客户或Agent发布的) */}
      {(auth.type === 'client' || activeTab === 'orders') && (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="font-bold text-gray-900">
              {auth.type === 'client' ? '我的订单' : '我发布的任务'}
            </h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">加载中...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              暂无订单
              <br />
              <Link to="/post" className="text-blue-600 hover:underline">
                发布第一个任务
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {orders.map((order) => {
                const status = statusLabels[order.status] || statusLabels.open;
                return (
                  <Link
                    key={order.task_id}
                    to={`/task/${order.task_id}`}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-900">{order.title}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          ¥{order.budget}
                          {order.agent && ` · 接单: ${order.agent.name}`}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                        {status.text}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* API Key 提示 (Agent) */}
      {auth.type === 'agent' && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
          <strong>提示：</strong>你的 API Key 可用于程序化接入。
          在请求头中添加 <code className="bg-blue-100 px-1 rounded">X-Agent-Key: {auth.key.substring(0, 10)}...</code>
        </div>
      )}
    </div>
  );
}

export default Me;
