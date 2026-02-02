import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

function TaskStatus({ task, onBack }) {
  const [taskData, setTaskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t, currentLang } = useLanguage();

  const exchangeRate = 7.2;

  useEffect(() => {
    if (!task) return;
    
    setTaskData({
      id: task.id,
      title: task.title,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/tasks/${task.id}`);
        const data = await response.json();
        setTaskData(data);
        setLoading(false);
        
        if (data.status === 'completed') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error(err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [task]);

  const getStatusDisplay = (status) => {
    const statusMap = {
      'pending': { text: t('statusPending'), color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
      'parsed': { text: t('statusParsing'), color: 'bg-blue-100 text-blue-800', icon: '🔍' },
      'quoted': { text: t('statusQuoted'), color: 'bg-purple-100 text-purple-800', icon: '💰' },
      'assigned': { text: t('statusAssigned'), color: 'bg-indigo-100 text-indigo-800', icon: '📋' },
      'processing': { text: t('statusProcessing'), color: 'bg-blue-100 text-blue-800', icon: '⚙️' },
      'reviewing': { text: t('statusReviewing'), color: 'bg-orange-100 text-orange-800', icon: '👀' },
      'completed': { text: t('statusCompleted'), color: 'bg-green-100 text-green-800', icon: '✅' },
      'failed': { text: t('statusFailed'), color: 'bg-red-100 text-red-800', icon: '❌' }
    };
    return statusMap[status] || { text: status, color: 'bg-gray-100', icon: '❓' };
  };

  const statusDisplay = taskData ? getStatusDisplay(taskData.status) : { text: t('loading'), color: 'bg-gray-100', icon: '⏳' };

  return (
    <div className="max-w-2xl mx-auto">
      <button 
        onClick={onBack}
        className="mb-6 text-blue-600 hover:underline flex items-center"
      >
        ← {t('back')}
      </button>

      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">{statusDisplay.icon}</div>
          <h2 className="text-2xl font-bold mb-2">{taskData?.title || t('loading')}</h2>
          <div className={`inline-flex items-center px-4 py-2 rounded-full ${statusDisplay.color}`}>
            {statusDisplay.text}
          </div>
        </div>

        {taskData?.status === 'processing' && (
          <div className="mb-8">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>{t('taskProcessing')}</span>
              <span>AI Agent</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '70%'}}></div>
            </div>
          </div>
        )}

        <div className="space-y-4 mb-8">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Task ID</span>
            <span className="font-mono text-sm">{taskData?.id?.substring(0, 8)}...</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">{t('type')}</span>
            <span>{task?.taskTypeName}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">{t('price')}</span>
            <span className="font-bold">
              {currentLang === 'en' 
                ? `$${Math.round((task?.price || 0) / 7.2)}`
                : `¥${task?.price}`
              }
            </span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">{t('date')}</span>
            <span>{taskData?.created_at && new Date(taskData.created_at).toLocaleString(currentLang === 'zh' ? 'zh-CN' : 'en-US')}</span>
          </div>
        </div>

        {taskData?.status === 'completed' && taskData?.result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="font-bold text-green-800 mb-4">🎉 {t('taskCompleted')}</h3>
            <div className="bg-white p-4 rounded-lg">
              <pre className="whitespace-pre-wrap text-gray-800 text-sm">{taskData.result}</pre>
            </div>
            <button 
              className="mt-4 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
              onClick={() => {
                const blob = new Blob([taskData.result], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `result-${taskData.id}.txt`;
                a.click();
              }}
            >
              {t('downloadResult')}
            </button>
          </div>
        )}

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-bold text-blue-800 mb-2">💡 {t('taskTips')}</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• {t('taskTip1')}</li>
            <li>• {t('taskTip2')}</li>
            <li>• {t('taskTip3')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default TaskStatus;
