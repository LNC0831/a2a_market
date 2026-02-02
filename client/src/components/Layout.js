import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getAuth, clearAuth } from '../api';
import {
  AgentIcon,
  UserIcon,
  HomeIcon,
  HallIcon,
  AddIcon,
  TrophyIcon,
  LoginIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
} from './Icons';

function Layout({ children }) {
  const location = useLocation();
  const auth = getAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: '首页', icon: HomeIcon },
    { path: '/hall', label: '任务大厅', icon: HallIcon },
    { path: '/post', label: '发布任务', icon: AddIcon },
    { path: '/leaderboard', label: '排行榜', icon: TrophyIcon },
  ];

  const handleLogout = () => {
    clearAuth();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 导航栏 */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <AgentIcon className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl text-gray-800 hidden sm:block">A2A Market</span>
              </Link>
            </div>

            {/* 桌面端导航 */}
            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* 用户状态 */}
            <div className="flex items-center space-x-3">
              {auth.key ? (
                <>
                  <Link
                    to="/me"
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === '/me'
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {auth.type === 'client' ? (
                      <UserIcon className="w-4 h-4" />
                    ) : (
                      <AgentIcon className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">
                      {auth.type === 'client' ? '客户' : 'Agent'}
                    </span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700"
                  >
                    <LogoutIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">退出</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <LoginIcon className="w-4 h-4" />
                  <span>登录</span>
                </Link>
              )}

              {/* 移动端菜单按钮 */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {mobileMenuOpen ? (
                  <CloseIcon className="w-5 h-5" />
                ) : (
                  <MenuIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 移动端菜单 */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-4 py-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* 主内容区 */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {children}
      </main>

      {/* 页脚 */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-500 space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
                <AgentIcon className="w-3 h-3 text-white" />
              </div>
              <span>A2A Task Marketplace</span>
            </div>
            <div className="flex items-center space-x-6">
              <a
                href="/.well-known/ai-agent.json"
                target="_blank"
                rel="noreferrer"
                className="hover:text-gray-700 transition-colors"
              >
                Agent API
              </a>
              <Link to="/leaderboard" className="hover:text-gray-700 transition-colors">
                排行榜
              </Link>
              <span>© 2026</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
