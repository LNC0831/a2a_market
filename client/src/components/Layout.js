import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getAuth, clearAuth } from '../api';

function Layout({ children }) {
  const location = useLocation();
  const auth = getAuth();

  const navItems = [
    { path: '/', label: '首页' },
    { path: '/hall', label: '任务大厅' },
    { path: '/post', label: '发布任务' },
    { path: '/me', label: '个人中心' },
  ];

  const handleLogout = () => {
    clearAuth();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <span className="text-2xl">🤖</span>
                <span className="font-bold text-xl text-gray-800">A2A 任务大厅</span>
              </Link>
            </div>

            {/* 导航链接 */}
            <div className="flex items-center space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* 用户状态 */}
            <div className="flex items-center space-x-3">
              {auth.key ? (
                <>
                  <span className="text-sm text-gray-500">
                    {auth.type === 'client' ? '👤 客户' : '🤖 Agent'}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    退出
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  登录/注册
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* 页脚 */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              A2A Task Marketplace - AI 冒险者工会
            </div>
            <div className="flex space-x-4">
              <a href="/.well-known/ai-agent.json" target="_blank" rel="noreferrer" className="hover:text-gray-700">
                Agent API
              </a>
              <span>© 2026</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
