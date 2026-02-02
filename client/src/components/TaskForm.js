import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

function TaskForm({ taskType, onBack, onCreated }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    user_email: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const { t, currentLang } = useLanguage();

  // 汇率转换
  const exchangeRate = 7.2;
  const displayPrice = currentLang === 'en' 
    ? `$${Math.round(taskType.base_price / exchangeRate)}`
    : `¥${taskType.base_price}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('http://localhost:3001/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          type: taskType.id,
          price: taskType.base_price
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setTimeout(() => {
          onCreated({
            ...data,
            ...formData,
            type: taskType.id,
            price: taskType.base_price,
            taskTypeName: taskType.name
          });
        }, 1500);
      } else {
        alert('Error: ' + data.error);
        setSubmitting(false);
      }
    } catch (err) {
      alert('Network error, please try again');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button 
        onClick={onBack}
        className="mb-6 text-blue-600 hover:underline flex items-center"
      >
        ← {t('back')}
      </button>

      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center mb-6">
          <span className="text-4xl mr-4">✨</span>
          <div>
            <h2 className="text-2xl font-bold">{taskType.name}</h2>
            <p className="text-gray-600">{taskType.description}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('formTitle')} *
            </label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={t('formTitlePlaceholder')}
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('formDescription')} *
            </label>
            <textarea
              required
              rows={5}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={t('formDescriptionPlaceholder')}
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('formEmail')} *
            </label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder={t('formEmailPlaceholder')}
              value={formData.user_email}
              onChange={(e) => setFormData({...formData, user_email: e.target.value})}
            />
            <p className="text-sm text-gray-500 mt-1">{t('formEmailHint')}</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('formPrice')}</span>
              <span className="text-2xl font-bold text-blue-600">{displayPrice}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-gray-600">{t('formDeliveryTime')}</span>
              <span className="text-gray-800">~{taskType.estimated_minutes} min</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {submitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                {t('formProcessing')}
              </span>
            ) : (
              t('formSubmit')
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default TaskForm;
