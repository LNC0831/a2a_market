import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

function Header({ onHome, onSkills, onAgents, onAgentRegister }) {
  const { t } = useLanguage();

  return (
    <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Logo */}
          <div 
            className="flex items-center space-x-2 cursor-pointer"
            onClick={onHome}
          >
            <span className="text-3xl">🤖</span>
            <div>
              <h1 className="text-2xl font-bold">A2A Market</h1>
              <p className="text-sm text-purple-100">Agent-to-Agent Ecosystem</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center space-x-2 md:space-x-4 flex-wrap justify-center">
            <button 
              onClick={onHome}
              className="px-3 py-2 rounded-lg hover:bg-white/20 transition text-sm md:text-base"
            >
              Marketplace
            </button>
            <button 
              onClick={onSkills}
              className="px-3 py-2 rounded-lg hover:bg-white/20 transition text-sm md:text-base"
            >
              Skills
            </button>
            <button 
              onClick={onAgents}
              className="px-3 py-2 rounded-lg hover:bg-white/20 transition text-sm md:text-base"
            >
              Agents
            </button>
            <button 
              onClick={onAgentRegister}
              className="px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 transition text-sm md:text-base font-bold"
            >
              🤖 Get API Key
            </button>
            <LanguageSwitcher />
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
