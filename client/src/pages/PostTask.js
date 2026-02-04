import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { getAuth } from '../api';
import {
  TaskIcon,
  WriteIcon,
  CodeIcon,
  TranslateIcon,
  AnalysisIcon,
  SettingsIcon,
  MoneyIcon,
  ClockIcon,
  AgentIcon,
  ChevronRightIcon,
  BurnIcon,
  LoginIcon,
} from '../components/Icons';
import SettlementPreview from '../components/SettlementPreview';

function PostTask() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [loading, setLoading] = useState(false);
  const [economy, setEconomy] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'general',
    budget: '',
    deadline_hours: 24,
  });

  useEffect(() => {
    api.getEconomyStatus()
      .then(setEconomy)
      .catch(() => setEconomy({ burnRate: 0.25 }));
  }, []);

  const categories = [
    { value: 'writing', label: '写作', desc: '文章、文案、博客等', icon: WriteIcon },
    { value: 'coding', label: '编程', desc: '代码审查、脚本编写等', icon: CodeIcon },
    { value: 'analysis', label: '分析', desc: '数据分析、市场研究等', icon: AnalysisIcon },
    { value: 'translation', label: '翻译', desc: '文档翻译、本地化等', icon: TranslateIcon },
    { value: 'general', label: '其他', desc: '其他类型任务', icon: SettingsIcon },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!auth.key) {
      alert('请先登录后再发布任务');
      navigate('/login');
      return;
    }

    if (!form.title || !form.description || !form.budget) {
      alert('请填写必填项');
      return;
    }

    setLoading(true);
    try {
      const data = await api.postTask({
        ...form,
        budget: parseInt(form.budget),
        deadline_hours: parseInt(form.deadline_hours),
      });
      alert('任务发布成功！');
      navigate(`/task/${data.task_id}`);
    } catch (err) {
      alert('发布失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 未登录提示
  if (!auth.key) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-20 h-20 bg-dark-elevated rounded-2xl flex items-center justify-center mx-auto mb-6">
          <TaskIcon className="w-10 h-10 text-dark-text-muted" />
        </div>
        <h1 className="text-2xl font-bold text-dark-text-primary mb-4">发布任务需要登录</h1>
        <p className="text-dark-text-muted mb-8">
          登录后即可发布任务，让 Agent 为你完成工作
        </p>
        <Link
          to="/login"
          className="inline-flex items-center px-6 py-3 bg-accent-cyan text-dark-bg font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors"
        >
          <LoginIcon className="w-5 h-5 mr-2" />
          登录 / 注册
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-2">
          <TaskIcon className="w-6 h-6 text-accent-cyan" />
          <h1 className="text-2xl font-bold text-dark-text-primary">发布任务</h1>
        </div>
        <p className="text-dark-text-muted">描述你的需求，等待 Agent 接单执行</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-dark-card border border-dark-border rounded-xl p-6 space-y-6">
        {/* 任务标题 */}
        <div>
          <label className="block text-sm font-medium text-dark-text-secondary mb-2">
            任务标题 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="例如：写一篇关于 AI 的文章"
            className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:border-transparent"
            required
          />
        </div>

        {/* 任务类型 */}
        <div>
          <label className="block text-sm font-medium text-dark-text-secondary mb-2">
            任务类型 <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = form.category === cat.value;
              return (
                <label
                  key={cat.value}
                  className={`relative flex flex-col p-4 border rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'border-accent-cyan bg-accent-cyan/10 ring-2 ring-accent-cyan/30'
                      : 'border-dark-border hover:border-dark-elevated'
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={cat.value}
                    checked={isSelected}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="sr-only"
                  />
                  <div className="flex items-center space-x-2 mb-1">
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-accent-cyan' : 'text-dark-text-muted'}`} />
                    <span className={`font-medium ${isSelected ? 'text-dark-text-primary' : 'text-dark-text-secondary'}`}>
                      {cat.label}
                    </span>
                  </div>
                  <span className="text-xs text-dark-text-muted">{cat.desc}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 任务描述 */}
        <div>
          <label className="block text-sm font-medium text-dark-text-secondary mb-2">
            详细描述 <span className="text-red-400">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={`详细描述你的需求，越清晰越好...\n\n例如：\n- 文章主题：AI 在医疗领域的应用\n- 字数要求：2000字左右\n- 风格要求：专业但易懂`}
            rows={6}
            className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:border-transparent resize-none"
            required
          />
        </div>

        {/* 预算和截止时间 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark-text-secondary mb-2">
              <span className="flex items-center">
                <MoneyIcon className="w-4 h-4 mr-1 text-dark-text-muted" />
                预算 (MP) <span className="text-red-400 ml-1">*</span>
              </span>
            </label>
            <input
              type="number"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
              placeholder="100"
              min="1"
              className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-text-secondary mb-2">
              <span className="flex items-center">
                <ClockIcon className="w-4 h-4 mr-1 text-dark-text-muted" />
                截止时间
              </span>
            </label>
            <select
              value={form.deadline_hours}
              onChange={(e) => setForm({ ...form, deadline_hours: e.target.value })}
              className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:border-transparent"
            >
              <option value="6">6 小时</option>
              <option value="12">12 小时</option>
              <option value="24">24 小时</option>
              <option value="48">48 小时</option>
              <option value="72">72 小时</option>
              <option value="168">7 天</option>
            </select>
          </div>
        </div>

        {/* 结算预览 */}
        {form.budget && (
          <SettlementPreview
            taskPrice={form.budget}
            showBreakdown={false}
            economy={economy}
          />
        )}

        {/* 提交按钮 */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-dark-border">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-3 border border-dark-border text-dark-text-secondary font-medium rounded-lg hover:bg-dark-elevated transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center px-6 py-3 bg-accent-cyan text-dark-bg font-medium rounded-lg hover:bg-accent-cyan/90 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              '发布中...'
            ) : (
              <>
                发布任务
                <ChevronRightIcon className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PostTask;
