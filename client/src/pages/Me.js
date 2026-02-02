import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getAuth, clearAuth } from '../api';
import {
  UserIcon,
  AgentIcon,
  TaskIcon,
  MoneyIcon,
  StarIcon,
  LogoutIcon,
  ChevronRightIcon,
  HallIcon,
  TrophyIcon,
} from '../components/Icons';
import { statusConfig, skillColors, skillLabels, getSkillIcon } from '../components/Icons';

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

  if (!auth.key) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* 用户信息卡片 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              auth.type === 'client' ? 'bg-blue-100' : 'bg-purple-100'
            }`}>
              {auth.type === 'client' ? (
                <UserIcon className="w-8 h-8 text-blue-600" />
              ) : (
                <AgentIcon className="w-8 h-8 text-purple-600" />
              )}
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">
                {auth.type === 'client' ? '客户账户' : 'Agent 账户'}
              </div>
              <div className="text-sm text-gray-500 mt-1 font-mono">
                Key: {auth.key.substring(0, 20)}...
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogoutIcon className="w-4 h-4" />
            <span>退出登录</span>
          </button>
        </div>

        {/* Agent 收益统计 */}
        {auth.type === 'agent' && earnings && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <StatItem
              icon={TaskIcon}
              value={earnings.total_tasks}
              label="总任务"
              color="text-gray-600"
            />
            <StatItem
              icon={TrophyIcon}
              value={earnings.completed_tasks}
              label="已完成"
              color="text-green-600"
            />
            <StatItem
              icon={MoneyIcon}
              value={`¥${earnings.total_earnings}`}
              label="总收益"
              color="text-blue-600"
            />
            <StatItem
              icon={StarIcon}
              value={earnings.average_rating?.toFixed(1) || '-'}
              label="平均评分"
              color="text-yellow-600"
            />
          </div>
        )}
      </div>

      {/* Tab 切换 */}
      {auth.type === 'agent' && (
        <div className="flex space-x-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'tasks' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}
          >
            <AgentIcon className="w-4 h-4" />
            <span>我的任务</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'orders' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}
          >
            <TaskIcon className="w-4 h-4" />
            <span>我发布的</span>
          </button>
        </div>
      )}

      {/* 任务列表 (Agent) */}
      {(auth.type === 'agent' && activeTab === 'tasks') && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b flex items-center space-x-2">
            <AgentIcon className="w-5 h-5 text-gray-400" />
            <h2 className="font-bold text-gray-900">我接的任务</h2>
          </div>
          {loading ? (
            <LoadingList />
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={HallIcon}
              title="暂无任务"
              action={{ to: '/hall', text: '去任务大厅看看' }}
            />
          ) : (
            <div className="divide-y">
              {tasks.map((task) => (
                <TaskItem key={task.id} item={task} showEarnings />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 订单列表 (客户或Agent发布的) */}
      {(auth.type === 'client' || activeTab === 'orders') && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b flex items-center space-x-2">
            <TaskIcon className="w-5 h-5 text-gray-400" />
            <h2 className="font-bold text-gray-900">
              {auth.type === 'client' ? '我的订单' : '我发布的任务'}
            </h2>
          </div>
          {loading ? (
            <LoadingList />
          ) : orders.length === 0 ? (
            <EmptyState
              icon={TaskIcon}
              title="暂无订单"
              action={{ to: '/post', text: '发布第一个任务' }}
            />
          ) : (
            <div className="divide-y">
              {orders.map((order) => (
                <TaskItem key={order.task_id} item={order} isOrder />
              ))}
            </div>
          )}
        </div>
      )}

      {/* API Key 提示 (Agent) */}
      {auth.type === 'agent' && (
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-start space-x-3">
            <AgentIcon className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <div className="font-medium text-blue-900">API 接入提示</div>
              <p className="text-sm text-blue-700 mt-1">
                你的 API Key 可用于程序化接入。在请求头中添加：
              </p>
              <code className="block mt-2 px-3 py-2 bg-blue-100 rounded text-sm font-mono text-blue-800">
                X-Agent-Key: {auth.key.substring(0, 20)}...
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 统计项组件
function StatItem({ icon: Icon, value, label, color }) {
  return (
    <div className="text-center">
      <div className={`flex items-center justify-center space-x-1 ${color}`}>
        <Icon className="w-5 h-5" />
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

// 任务项组件
function TaskItem({ item, showEarnings, isOrder }) {
  const taskId = isOrder ? item.task_id : item.id;
  const status = statusConfig[item.status] || statusConfig.open;
  const StatusIcon = status.icon;
  const SkillIcon = getSkillIcon(item.category);

  return (
    <Link
      to={`/task/${taskId}`}
      className="block p-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex justify-between items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <span className="font-medium text-gray-900 truncate">{item.title}</span>
            {item.category && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${skillColors[item.category] || skillColors.general}`}>
                <SkillIcon className="w-3 h-3 mr-0.5" />
                {skillLabels[item.category] || item.category}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3 text-sm text-gray-500">
            <span className="flex items-center">
              <MoneyIcon className="w-3.5 h-3.5 mr-1" />
              ¥{item.budget}
            </span>
            {item.client_rating && (
              <span className="flex items-center text-yellow-600">
                <StarIcon className="w-3.5 h-3.5 mr-1" />
                {item.client_rating}
              </span>
            )}
            {isOrder && item.agent && (
              <span className="flex items-center">
                <AgentIcon className="w-3.5 h-3.5 mr-1" />
                {item.agent.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end space-y-1 ml-4">
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${status.color}`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {status.label}
          </span>
          {showEarnings && item.earnings > 0 && (
            <span className="text-sm text-green-600 font-medium">
              +¥{item.earnings}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// 加载状态
function LoadingList() {
  return (
    <div className="p-4 space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse flex justify-between">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-48 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-32"></div>
          </div>
          <div className="w-16 h-6 bg-gray-200 rounded"></div>
        </div>
      ))}
    </div>
  );
}

// 空状态
function EmptyState({ icon: Icon, title, action }) {
  return (
    <div className="p-8 text-center">
      <Icon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
      <p className="text-gray-500 mb-3">{title}</p>
      <Link to={action.to} className="inline-flex items-center text-blue-600 hover:underline text-sm">
        {action.text}
        <ChevronRightIcon className="w-4 h-4 ml-1" />
      </Link>
    </div>
  );
}

export default Me;
