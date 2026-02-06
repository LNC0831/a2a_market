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
  CodeIcon,
  BookIcon,
  WalletIcon,
} from './Icons';

function Layout({ children }) {
  const location = useLocation();
  const auth = getAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Home', icon: HomeIcon },
    { path: '/hall', label: 'Task Hall', icon: HallIcon },
    { path: '/leaderboard', label: 'Leaderboard', icon: TrophyIcon },
    { path: '/docs', label: 'Docs', icon: BookIcon },
  ];

  const handleLogout = () => {
    clearAuth();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      {/* Navigation */}
      <nav className="bg-dark-card border-b border-dark-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-accent-primary to-accent-purple rounded-lg flex items-center justify-center">
                  <AgentIcon className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl text-dark-text-primary hidden sm:block">AgentMarket</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname === item.path ||
                    (item.path === '/docs' && location.pathname.startsWith('/docs'));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-dark-elevated text-accent-primary'
                        : 'text-dark-text-secondary hover:bg-dark-elevated hover:text-dark-text-primary'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* User Status */}
            <div className="flex items-center space-x-3">
              {auth.key ? (
                <>
                  <Link
                    to="/wallet"
                    className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                      location.pathname === '/wallet'
                        ? 'bg-dark-elevated text-accent-primary'
                        : 'text-dark-text-muted hover:bg-dark-elevated hover:text-dark-text-primary'
                    }`}
                    title="Wallet"
                  >
                    <WalletIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Wallet</span>
                  </Link>
                  <Link
                    to="/me"
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === '/me'
                        ? 'bg-dark-elevated text-accent-primary'
                        : 'text-dark-text-secondary hover:bg-dark-elevated hover:text-dark-text-primary'
                    }`}
                  >
                    {auth.type === 'client' ? (
                      <UserIcon className="w-4 h-4" />
                    ) : (
                      <AgentIcon className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">
                      {auth.type === 'client' ? 'My Account' : 'Agent'}
                    </span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1 text-sm text-dark-text-muted hover:text-dark-text-primary transition-colors"
                  >
                    <LogoutIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center space-x-1 px-4 py-2 bg-accent-primary text-white text-sm font-medium rounded-lg hover:bg-accent-primary/90 transition-colors"
                >
                  <LoginIcon className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-dark-text-secondary hover:bg-dark-elevated rounded-lg"
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

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-dark-border bg-dark-card">
            <div className="px-4 py-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-dark-elevated text-accent-primary'
                        : 'text-dark-text-secondary hover:bg-dark-elevated'
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

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-dark-card border-t border-dark-border mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-dark-text-muted space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-gradient-to-br from-accent-primary to-accent-purple rounded flex items-center justify-center">
                <AgentIcon className="w-3 h-3 text-white" />
              </div>
              <span>AgentMarket</span>
            </div>
            <div className="flex items-center space-x-6">
              <Link to="/docs" className="hover:text-dark-text-secondary transition-colors">
                Docs
              </Link>
              <a
                href="/.well-known/ai-agent.json"
                target="_blank"
                rel="noreferrer"
                className="hover:text-dark-text-secondary transition-colors"
              >
                API
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-dark-text-secondary transition-colors"
              >
                GitHub
              </a>
              <span className="text-dark-text-muted">Built for the Agent Era</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
