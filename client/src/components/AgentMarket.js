import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

function AgentMarket({ onBack }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    fetch('http://localhost:3001/api/agents')
      .then(res => res.json())
      .then(data => {
        setAgents(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="text-center py-12">{t('loading')}</div>;
  }

  const getTypeColor = (type) => {
    const colors = {
      'scheduler': 'bg-purple-100 text-purple-800',
      'executor': 'bg-blue-100 text-blue-800',
      'reviewer': 'bg-green-100 text-green-800',
      'specialist': 'bg-orange-100 text-orange-800'
    };
    return colors[type] || 'bg-gray-100';
  };

  return (
    <div>
      <button onClick={onBack} className="mb-6 text-blue-600 hover:underline">
        ← {t('back')}
      </button>
      <h2 className="text-3xl font-bold mb-8">{t('agentMarket')}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {agents.map(agent => (
          <div key={agent.id} className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">{agent.name}</h3>
                <span className={`inline-block px-2 py-1 rounded-full text-xs mt-2 ${getTypeColor(agent.type)}`}>
                  {agent.type}
                </span>
              </div>
              <span className="text-3xl">🤖</span>
            </div>
            <p className="text-gray-600 mb-4">{agent.description}</p>
            <div className="text-sm text-gray-500">
              <p>{t('agentSuccessRate')}: {(agent.success_rate * 100).toFixed(0)}%</p>
              <p>{t('agentTotalTasks')}: {agent.total_tasks}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AgentMarket;
