import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

function AdminPanel({ onBack }) {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ total: 0, revenue: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const { t, currentLang } = useLanguage();

  const exchangeRate = 7.2;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, statsRes] = await Promise.all([
        fetch('http://localhost:3001/api/tasks'),
        fetch('http://localhost:3001/api/stats')
      ]);
      
      const tasksData = await tasksRes.json();
      const statsData = await statsRes.json();
      
      setTasks(tasksData);
      setStats(statsData);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const displayPrice = (price) => {
    return currentLang === 'en' ? `$${Math.round((price || 0) / exchangeRate)}` : `¥${price || 0}`;
  };

  const getStatusBadge = (status) => {
    const styles = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'processing': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'failed': 'bg-red-100 text-red-800'
    };
    return styles[status] || 'bg-gray-100';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-2xl">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} className="mb-6 text-blue-600 hover:underline">
        ← {t('back')}
      </button>

      <h2 className="text-3xl font-bold mb-8">{t('adminTitle')}</h2>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="text-gray-500 mb-2">{t('adminTotalTasks')}</div>
          <div className="text-4xl font-bold text-blue-600">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="text-gray-500 mb-2">{t('adminTotalRevenue')}</div>
          <div className="text-4xl font-bold text-green-600">{displayPrice(stats.revenue)}</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="text-gray-500 mb-2">{t('adminCompletedTasks')}</div>
          <div className="text-4xl font-bold text-purple-600">{stats.completed}</div>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="font-bold text-lg">{t('adminTaskList')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('type')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('price')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tasks.map(task => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono">{task.id.substring(0, 8)}...</td>
                  <td className="px-6 py-4">{task.title}</td>
                  <td className="px-6 py-4">{task.type}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(task.status)}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{displayPrice(task.price)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(task.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tasks.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {t('adminNoTasks')}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
