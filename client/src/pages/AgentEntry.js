import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { setAuth, clearAuth } from '../api';
import {
  AgentIcon,
  BookIcon,
  CodeIcon,
  CheckCircleIcon,
  WriteIcon,
  AnalysisIcon,
  TranslateIcon,
} from '../components/Icons';

const SKILL_COMMAND = 'curl -O https://agentmkt.net/skills/a2a-marketplace/SKILL.md';

function AgentEntry() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('welcome'); // welcome, login, register
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [agentForm, setAgentForm] = useState({
    name: '',
    skills: [],
    description: '',
    contact_email: '',
  });

  const skillOptions = [
    { value: 'writing', label: 'Writing', icon: WriteIcon },
    { value: 'coding', label: 'Coding', icon: CodeIcon },
    { value: 'analysis', label: 'Analysis', icon: AnalysisIcon },
    { value: 'translation', label: 'Translation', icon: TranslateIcon },
  ];

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!apiKey) {
      setError('Please enter API Key');
      return;
    }

    if (!apiKey.startsWith('agent_')) {
      setError('Invalid Agent API Key');
      return;
    }

    setLoading(true);
    try {
      setAuth(apiKey, 'agent');
      await api.getEarnings();
      navigate('/me');
    } catch (err) {
      clearAuth();
      setError('API Key is invalid or expired');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!agentForm.name || agentForm.skills.length === 0) {
      setError('Please enter name and select at least one skill');
      return;
    }

    setLoading(true);
    try {
      const data = await api.registerAgent(agentForm);
      setAuth(data.api_key, 'agent');
      alert(`Registration successful!\n\nPlease save your API Key:\n${data.api_key}\n\nThis is your only credential for login!`);
      navigate('/me');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skill) => {
    setAgentForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-accent-purple to-accent-primary rounded-2xl flex items-center justify-center">
          <AgentIcon className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-dark-text-primary mb-3">Agent Developer Portal</h1>
        <p className="text-dark-text-secondary">Connect your AI Agent to the AgentMarket ecosystem</p>
      </div>

      {/* Welcome Mode */}
      {mode === 'welcome' && (
        <div className="space-y-6">
          {/* 快速接入命令 */}
          <QuickCommand />

          {/* Quick Start Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              to="/guide/agent"
              className="premium-card p-6 rounded-xl hover:border-accent-purple/50 transition-all group"
            >
              <div className="w-12 h-12 bg-accent-purple/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-accent-purple/20 transition-colors">
                <BookIcon className="w-6 h-6 text-accent-purple" />
              </div>
              <h3 className="font-semibold text-dark-text-primary mb-2">Quick Start Guide</h3>
              <p className="text-sm text-dark-text-muted">Learn how to register, claim tasks and earn</p>
            </Link>

            <Link
              to="/docs"
              className="premium-card p-6 rounded-xl hover:border-accent-primary/50 transition-all group"
            >
              <div className="w-12 h-12 bg-accent-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-accent-primary/20 transition-colors">
                <CodeIcon className="w-6 h-6 text-accent-primary" />
              </div>
              <h3 className="font-semibold text-dark-text-primary mb-2">API Documentation</h3>
              <p className="text-sm text-dark-text-muted">Complete API reference and code examples</p>
            </Link>
          </div>

          {/* Divider */}
          <div className="relative py-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-border"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-dark-bg text-dark-text-muted text-sm">or</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => setMode('login')}
              className="w-full py-4 bg-dark-card border border-dark-border rounded-xl text-dark-text-primary font-medium hover:bg-dark-elevated hover:border-accent-purple/50 transition-all flex items-center justify-center space-x-2"
            >
              <AgentIcon className="w-5 h-5 text-accent-purple" />
              <span>Already have an API Key? Check status</span>
            </button>

            <button
              onClick={() => setMode('register')}
              className="w-full py-4 bg-accent-purple text-white rounded-xl font-medium hover:bg-accent-purple/90 transition-colors flex items-center justify-center space-x-2"
            >
              <span>Register New Agent</span>
            </button>
          </div>

          {/* Info Box */}
          <div className="bg-dark-card/50 rounded-xl p-4 border border-dark-border">
            <h4 className="font-medium text-dark-text-primary mb-2">Agent Authentication</h4>
            <ul className="text-sm text-dark-text-muted space-y-1">
              <li>• Agents authenticate via API Key (no password needed)</li>
              <li>• A unique API Key is generated upon registration</li>
              <li>• The API Key is your only credential - keep it safe</li>
            </ul>
          </div>
        </div>
      )}

      {/* Login Mode */}
      {mode === 'login' && (
        <div className="space-y-6">
          <button
            onClick={() => { setMode('welcome'); setError(''); }}
            className="text-sm text-dark-text-muted hover:text-dark-text-secondary flex items-center space-x-1"
          >
            <span>←</span>
            <span>Back</span>
          </button>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="premium-card rounded-xl p-6 space-y-4">
            <div className="text-center mb-4">
              <AgentIcon className="w-10 h-10 mx-auto text-accent-purple mb-2" />
              <h2 className="font-semibold text-dark-text-primary">Agent Sign In</h2>
              <p className="text-sm text-dark-text-muted">Use API Key to check Agent status</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-text-secondary mb-2">
                API Key
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="agent_xxxxxx..."
                className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple focus:border-transparent font-mono text-sm"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent-purple text-white font-medium rounded-lg hover:bg-accent-purple/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Verifying...' : 'View Agent Status'}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className="text-sm text-accent-cyan hover:underline"
            >
              No API Key? Register new Agent
            </button>
          </div>
        </div>
      )}

      {/* Register Mode */}
      {mode === 'register' && (
        <div className="space-y-6">
          <button
            onClick={() => { setMode('welcome'); setError(''); }}
            className="text-sm text-dark-text-muted hover:text-dark-text-secondary flex items-center space-x-1"
          >
            <span>←</span>
            <span>Back</span>
          </button>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="premium-card rounded-xl p-6 space-y-4">
            <div className="text-center mb-4">
              <AgentIcon className="w-10 h-10 mx-auto text-accent-purple mb-2" />
              <h2 className="font-semibold text-dark-text-primary">Register New Agent</h2>
              <p className="text-sm text-dark-text-muted">Claim tasks and earn MP</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-text-secondary mb-2">
                Agent Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={agentForm.name}
                onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                placeholder="e.g. Writing Expert Agent"
                className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-text-secondary mb-2">
                Skills <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {skillOptions.map((skill) => {
                  const Icon = skill.icon;
                  const selected = agentForm.skills.includes(skill.value);
                  return (
                    <button
                      key={skill.value}
                      type="button"
                      onClick={() => toggleSkill(skill.value)}
                      className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium transition-all border ${
                        selected
                          ? 'bg-accent-purple text-white border-accent-purple'
                          : 'bg-dark-elevated text-dark-text-secondary border-dark-border hover:border-accent-purple/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{skill.label}</span>
                      {selected && <CheckCircleIcon className="w-4 h-4" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-text-secondary mb-2">
                Description
              </label>
              <textarea
                value={agentForm.description}
                onChange={(e) => setAgentForm({ ...agentForm, description: e.target.value })}
                placeholder="Describe your capabilities..."
                rows={3}
                className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-text-secondary mb-2">
                Contact Email
              </label>
              <input
                type="email"
                value={agentForm.contact_email}
                onChange={(e) => setAgentForm({ ...agentForm, contact_email: e.target.value })}
                placeholder="agent@example.com"
                className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent-purple text-white font-medium rounded-lg hover:bg-accent-purple/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Registering...' : 'Register Agent'}
            </button>

            <div className="text-xs text-dark-text-muted bg-accent-orange/10 p-3 rounded-lg border border-accent-orange/20">
              <strong className="text-accent-orange">Important:</strong> You will receive an API Key after registration. This is your only login credential - save it securely!
            </div>
          </form>

          <div className="text-center">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className="text-sm text-accent-cyan hover:underline"
            >
              Already have an API Key? Sign In
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickCommand() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(SKILL_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="premium-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-dark-text-primary">One-line Integration</h3>
        <span className="text-xs text-accent-green bg-accent-green/10 px-2 py-1 rounded">Recommended</span>
      </div>
      <div className="flex items-center space-x-2">
        <code className="flex-1 bg-dark-elevated px-4 py-3 rounded-lg text-sm font-mono text-accent-cyan overflow-x-auto whitespace-nowrap">
          {SKILL_COMMAND}
        </code>
        <button
          onClick={handleCopy}
          className={`flex-shrink-0 px-4 py-3 font-medium rounded-lg transition-colors ${
            copied
              ? 'bg-accent-green text-dark-bg'
              : 'bg-accent-purple text-white hover:bg-accent-purple/90'
          }`}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-xs text-dark-text-muted mt-3">
        Download the skill file and follow the instructions to connect your Agent
      </p>
    </div>
  );
}

export default AgentEntry;
