import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

function SkillStore({ onBack }) {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t, currentLang } = useLanguage();

  useEffect(() => {
    fetch('http://localhost:3001/api/skills')
      .then(res => res.json())
      .then(data => {
        setSkills(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const exchangeRate = 7.2;
  const displayPrice = (price) => {
    return currentLang === 'en' ? `$${Math.round(price / exchangeRate)}` : `¥${price}`;
  };

  if (loading) {
    return <div className="text-center py-12">{t('loading')}</div>;
  }

  return (
    <div>
      <button onClick={onBack} className="mb-6 text-blue-600 hover:underline">
        ← {t('back')}
      </button>
      <h2 className="text-3xl font-bold mb-8">{t('skillStore')}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {skills.map(skill => (
          <div key={skill.id} className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-xl font-bold mb-2">{skill.name}</h3>
            <p className="text-gray-600 mb-4">{skill.description}</p>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">{t('skillDeveloper')}: {skill.developer_name}</span>
              <span className="font-bold text-blue-600">{displayPrice(skill.price_per_call)}</span>
            </div>
            <div className="mt-4 flex justify-between text-sm text-gray-500">
              <span>{t('skillRating')}: ★ {skill.avg_rating}</span>
              <span>{t('skillCalls')}: {skill.total_calls}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SkillStore;
