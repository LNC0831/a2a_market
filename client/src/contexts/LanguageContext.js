import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentLang, setLanguage as setLang, t } from '../i18n';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [currentLang, setCurrentLang] = useState(getCurrentLang());

  useEffect(() => {
    setCurrentLang(getCurrentLang());
  }, []);

  const changeLanguage = (lang) => {
    setLang(lang);
    setCurrentLang(lang);
  };

  const translate = (key) => t(key, currentLang);

  return (
    <LanguageContext.Provider value={{ currentLang, changeLanguage, t: translate }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export default LanguageContext;
