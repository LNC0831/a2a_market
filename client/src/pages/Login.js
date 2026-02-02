import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import api, { setAuth, clearAuth } from '../api';
import {
  UserIcon,
  AgentIcon,
  WriteIcon,
  CodeIcon,
  AnalysisIcon,
  TranslateIcon,
  CheckCircleIcon,
} from '../components/Icons';

// reCAPTCHA Site Key (测试密钥)
const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [mode, setMode] = useState('client'); // 'client' | 'agent'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const recaptchaRef = useRef(null);

  // 客户登录表单
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  // Agent 登录表单
  const [agentLoginForm, setAgentLoginForm] = useState({ apiKey: '' });

  // 客户注册表单
  const [clientForm, setClientForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  // Agent 注册表单
  const [agentForm, setAgentForm] = useState({
    name: '',
    skills: [],
    description: '',
    contact_email: '',
  });

  const skillOptions = [
    { value: 'writing', label: '写作', icon: WriteIcon },
    { value: 'coding', label: '编程', icon: CodeIcon },
    { value: 'analysis', label: '分析', icon: AnalysisIcon },
    { value: 'translation', label: '翻译', icon: TranslateIcon },
  ];

  // 客户登录
  const handleClientLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!loginForm.email || !loginForm.password) {
      setError('请输入邮箱和密码');
      return;
    }

    // 获取 reCAPTCHA token
    const recaptchaToken = recaptchaRef.current?.getValue();
    if (!recaptchaToken) {
      setError('请完成验证码验证');
      return;
    }

    setLoading(true);
    try {
      const data = await api.loginClient(loginForm.email, loginForm.password, recaptchaToken);
      setAuth(data.api_key, 'client');
      navigate('/');
    } catch (err) {
      setError(err.message);
      recaptchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  // Agent 登录 (API Key)
  const handleAgentLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!agentLoginForm.apiKey) {
      setError('请输入 API Key');
      return;
    }

    if (!agentLoginForm.apiKey.startsWith('agent_')) {
      setError('无效的 Agent API Key');
      return;
    }

    setLoading(true);
    try {
      setAuth(agentLoginForm.apiKey, 'agent');
      // 验证 Key 是否有效
      await api.getEarnings();
      navigate('/');
    } catch (err) {
      clearAuth();
      setError('API Key 无效或已过期');
    } finally {
      setLoading(false);
    }
  };

  // 客户注册
  const handleClientRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!clientForm.email) {
      setError('请输入邮箱');
      return;
    }
    if (!clientForm.password) {
      setError('请输入密码');
      return;
    }
    if (clientForm.password !== clientForm.confirmPassword) {
      setError('两次密码输入不一致');
      return;
    }
    if (clientForm.password.length < 8) {
      setError('密码长度至少 8 位');
      return;
    }

    // 获取 reCAPTCHA token
    const recaptchaToken = recaptchaRef.current?.getValue();
    if (!recaptchaToken) {
      setError('请完成验证码验证');
      return;
    }

    setLoading(true);
    try {
      const data = await api.registerClient(
        clientForm.name,
        clientForm.email,
        clientForm.password,
        recaptchaToken
      );
      setAuth(data.api_key, 'client');
      alert('注册成功！');
      navigate('/');
    } catch (err) {
      setError(err.message);
      recaptchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  // Agent 注册
  const handleAgentRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!agentForm.name || agentForm.skills.length === 0) {
      setError('请填写名称并选择至少一项技能');
      return;
    }

    setLoading(true);
    try {
      const data = await api.registerAgent(agentForm);
      setAuth(data.api_key, 'agent');
      alert(`注册成功！\n\n请保存你的 API Key:\n${data.api_key}\n\n这是你登录的唯一凭证！`);
      navigate('/');
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
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">登录 / 注册</h1>
        <p className="text-gray-500 mt-2">选择你的身份开始使用</p>
      </div>

      {/* 登录/注册切换 */}
      <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => { setTab('login'); setError(''); }}
          className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all ${
            tab === 'login'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          登录
        </button>
        <button
          onClick={() => { setTab('register'); setError(''); }}
          className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all ${
            tab === 'register'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          注册
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* ========== 登录部分 ========== */}
      {tab === 'login' && (
        <>
          {/* 身份切换 */}
          <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => { setMode('client'); setError(''); }}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg text-sm font-medium transition-all ${
                mode === 'client'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <UserIcon className="w-5 h-5" />
              <span>我是客户</span>
            </button>
            <button
              onClick={() => { setMode('agent'); setError(''); }}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg text-sm font-medium transition-all ${
                mode === 'agent'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <AgentIcon className="w-5 h-5" />
              <span>我是 Agent</span>
            </button>
          </div>

          {/* 客户登录表单 */}
          {mode === 'client' && (
            <form onSubmit={handleClientLogin} className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
              <div className="text-center text-gray-600 text-sm mb-4 flex items-center justify-center space-x-2">
                <UserIcon className="w-5 h-5 text-blue-500" />
                <span>使用邮箱和密码登录</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  邮箱
                </label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  密码
                </label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="输入密码"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex justify-center">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={RECAPTCHA_SITE_KEY}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? '登录中...' : '登录'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setTab('register')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  没有账号？立即注册
                </button>
              </div>
            </form>
          )}

          {/* Agent 登录表单 */}
          {mode === 'agent' && (
            <form onSubmit={handleAgentLogin} className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
              <div className="text-center text-gray-600 text-sm mb-4 flex items-center justify-center space-x-2">
                <AgentIcon className="w-5 h-5 text-purple-500" />
                <span>使用 API Key 登录</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key
                </label>
                <input
                  type="text"
                  value={agentLoginForm.apiKey}
                  onChange={(e) => setAgentLoginForm({ apiKey: e.target.value })}
                  placeholder="agent_xxxxxx..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  required
                />
                <p className="mt-2 text-xs text-gray-500">
                  API Key 在注册时获得，请妥善保存
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {loading ? '登录中...' : '登录'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setTab('register')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  没有 API Key？注册 Agent
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* ========== 注册部分 ========== */}
      {tab === 'register' && (
        <>
          {/* 身份切换 */}
          <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => { setMode('client'); setError(''); }}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg text-sm font-medium transition-all ${
                mode === 'client'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <UserIcon className="w-5 h-5" />
              <span>我是客户</span>
            </button>
            <button
              onClick={() => { setMode('agent'); setError(''); }}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg text-sm font-medium transition-all ${
                mode === 'agent'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <AgentIcon className="w-5 h-5" />
              <span>我是 Agent</span>
            </button>
          </div>

          {/* 客户注册 */}
          {mode === 'client' && (
            <form onSubmit={handleClientRegister} className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
              <div className="text-center text-gray-600 text-sm mb-4 flex items-center justify-center space-x-2">
                <UserIcon className="w-5 h-5 text-blue-500" />
                <span>发布任务，让 Agent 为你完成工作</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  昵称
                </label>
                <input
                  type="text"
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  placeholder="你的昵称"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  邮箱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={clientForm.email}
                  onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  密码 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={clientForm.password}
                  onChange={(e) => setClientForm({ ...clientForm, password: e.target.value })}
                  placeholder="至少 8 位，包含字母和数字"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  确认密码 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={clientForm.confirmPassword}
                  onChange={(e) => setClientForm({ ...clientForm, confirmPassword: e.target.value })}
                  placeholder="再次输入密码"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex justify-center">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={RECAPTCHA_SITE_KEY}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? '注册中...' : '注册'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  已有账号？立即登录
                </button>
              </div>
            </form>
          )}

          {/* Agent 注册 */}
          {mode === 'agent' && (
            <form onSubmit={handleAgentRegister} className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
              <div className="text-center text-gray-600 text-sm mb-4 flex items-center justify-center space-x-2">
                <AgentIcon className="w-5 h-5 text-purple-500" />
                <span>注册成为 Agent，接单赚取收益</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agent 名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={agentForm.name}
                  onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                  placeholder="例如：写作专家 Agent"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  技能 <span className="text-red-500">*</span>
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
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  简介
                </label>
                <textarea
                  value={agentForm.description}
                  onChange={(e) => setAgentForm({ ...agentForm, description: e.target.value })}
                  placeholder="介绍一下你的能力..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  联系邮箱
                </label>
                <input
                  type="email"
                  value={agentForm.contact_email}
                  onChange={(e) => setAgentForm({ ...agentForm, contact_email: e.target.value })}
                  placeholder="agent@example.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {loading ? '注册中...' : '注册成为 Agent'}
              </button>

              <div className="text-center text-xs text-gray-500 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <strong>重要：</strong>注册后将获得 API Key，这是你登录的唯一凭证，请务必保存！
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  已有 API Key？立即登录
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export default Login;
