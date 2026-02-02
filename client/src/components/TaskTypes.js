import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

function TaskTypes({ onSelect }) {
  const [taskTypes, setTaskTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t, currentLang } = useLanguage();

  // 汇率：1 USD = 7.2 CNY (示例)
  const exchangeRate = 7.2;

  const convertPrice = (cnyPrice) => {
    if (currentLang === 'en') {
      return `$${Math.round(cnyPrice / exchangeRate)}`;
    }
    return `¥${cnyPrice}`;
  };

  useEffect(() => {
    fetch('http://localhost:3001/api/task-types')
      .then(res => res.json())
      .then(data => {
        setTaskTypes(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const getIcon = (category) => {
    const icons = {
      'writing': '✍️',
      'coding': '💻',
      'analysis': '📊',
      'translation': '🌐',
      'marketing': '📈',
      'general': '🤖'
    };
    return icons[category] || '📦';
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
      {/* Hero Section */}
      <div className="text-center mb-12 py-12">
        <h2 className="text-4xl font-bold text-gray-800 mb-4">
          {t('heroTitle')}
        </h2>
        <p className="text-xl text-gray-600 mb-8">
          {t('heroSubtitle')}
        </p>
        <div className="flex justify-center space-x-8 text-gray-500">
          <div className="flex items-center">
            <span className="text-2xl mr-2">⚡</span>
            <span>{t('featureFast')}</span>
          </div>
          <div className="flex items-center">
            <span className="text-2xl mr-2">🎯</span>
            <span>{t('featureQuality')}</span>
          </div>
          <div className="flex items-center">
            <span className="text-2xl mr-2">🔒</span>
            <span>{t('featureSecure')}</span>
          </div>
        </div>
      </div>

      {/* Task Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {taskTypes.map(type => (
          <div 
            key={type.id}
            className="bg-white rounded-xl shadow-md hover:shadow-xl transition p-6 cursor-pointer border-2 border-transparent hover:border-blue-500"
            onClick={() => onSelect(type)}
          >
            <div className="text-5xl mb-4">{getIcon(type.category)}</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">{type.name}</h3>
            <p className="text-gray-600 mb-4">{type.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold text-blue-600">
                {convertPrice(type.base_price)}
              </span>
              <span className="text-sm text-gray-500">
                ~{type.estimated_minutes} min
              </span>
            </div>
            {type.rating && (
              <div className="mt-3 flex items-center text-sm text-gray-500">
                <span className="text-yellow-500">★</span>
                <span className="ml-1">{type.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="mt-16 bg-white rounded-xl shadow-md p-8">
        <h3 className="text-2xl font-bold text-center mb-8">{t('howItWorks')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { step: '1', title: t('step1Title'), desc: t('step1Desc') },
            { step: '2', title: t('step2Title'), desc: t('step2Desc') },
            { step: '3', title: t('step3Title'), desc: t('step3Desc') },
            { step: '4', title: t('step4Title'), desc: t('step4Desc') }
          ].map(item => (
            <div key={item.step} className="text-center p-4">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                {item.step}
              </div>
              <h4 className="font-bold mb-2">{item.title}</h4>
              <p className="text-gray-600 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TaskTypes;
