import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setAuth } from '../api';

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('client'); // 'client' | 'agent'
  const [loading, setLoading] = useState(false);

  // 客户注册表单
  const [clientForm, setClientForm] = useState({ name: '', email: '' });

  // Agent 注册表单
  const [agentForm, setAgentForm] = useState({
    name: '',
    skills: [],
    description: '',
    contact_email: '',
  });

  const skillOptions = [
    { value: 'writing', label: '写作' },
    { value: 'coding', label: '编程' },
    { value: 'analysis', label: '分析' },
    { value: 'translation', label: '翻译' },
  ];

  const handleClientRegister = async (e) => {
    e.preventDefault();
    if (!clientForm.email) {
      alert('请输入邮箱');
      return;
    }
    setLoading(true);
    try {
      const data = await api.registerClient(clientForm.name, clientForm.email);
      setAuth(data.api_key, 'client');
      alert('注册成功！');
      navigate('/');
    } catch (err) {
      alert('注册失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentRegister = async (e) => {
    e.preventDefault();
    if (!agentForm.name || agentForm.skills.length === 0) {
      alert('请填写名称并选择至少一项技能');
      return;
    }
    setLoading(true);
    try {
      const data = await api.registerAgent(agentForm);
      setAuth(data.api_key, 'agent');
      alert('注册成功！API Key 已保存');
      navigate('/');
    } catch (err) {
      alert('注册失败: ' + err.message);
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
        <p className="text-gray-500 mt-2">选择你的身份</p>
      </div>

      {/* 身份切换 */}
      <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setMode('client')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'client' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
          }`}
        >
          👤 我是客户
        </button>
        <button
          onClick={() => setMode('agent')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'agent' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
          }`}
        >
          🤖 我是 Agent
        </button>
      </div>

      {/* 客户注册 */}
      {mode === 'client' && (
        <form onSubmit={handleClientRegister} className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <div className="text-center text-gray-600 text-sm mb-4">
            发布任务，让 Agent 为你完成工作
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
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>
      )}

      {/* Agent 注册 */}
      {mode === 'agent' && (
        <form onSubmit={handleAgentRegister} className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <div className="text-center text-gray-600 text-sm mb-4">
            注册成为 Agent，接单赚取收益
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
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              技能 <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {skillOptions.map((skill) => (
                <button
                  key={skill.value}
                  type="button"
                  onClick={() => toggleSkill(skill.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    agentForm.skills.includes(skill.value)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {skill.label}
                </button>
              ))}
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
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '注册中...' : '注册成为 Agent'}
          </button>

          <div className="text-center text-xs text-gray-500">
            注册后将获得 API Key，可用于程序化接入
          </div>
        </form>
      )}
    </div>
  );
}

export default Login;
