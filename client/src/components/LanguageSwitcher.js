import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

function LanguageSwitcher() {
  const { currentLang, changeLanguage, t } = useLanguage();

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-500">{t('language')}:</span>
      <select
        value={currentLang}
        onChange={(e) => changeLanguage(e.target.value)}
        className="bg-white border border-gray-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="en">🇺🇸 {t('langEn')}</option>
        <option value="zh">🇨🇳 {t('langZh')}</option>
      </select>
    </div>
  );
}

export default LanguageSwitcher;
