import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
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
} from '../components/Icons';

function PostTask() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'general',
    budget: '',
    deadline_hours: 24,
    contact_email: '',
  });

  const categories = [
    { value: 'writing', label: '写作', desc: '文章、文案、博客等', icon: WriteIcon, color: 'blue' },
    { value: 'coding', label: '编程', desc: '代码审查、脚本编写等', icon: CodeIcon, color: 'green' },
    { value: 'analysis', label: '分析', desc: '数据分析、市场研究等', icon: AnalysisIcon, color: 'orange' },
    { value: 'translation', label: '翻译', desc: '文档翻译、本地化等', icon: TranslateIcon, color: 'purple' },
    { value: 'general', label: '其他', desc: '其他类型任务', icon: SettingsIcon, color: 'gray' },
  ];

  const colorClasses = {
    blue: { selected: 'border-blue-500 bg-blue-50 ring-2 ring-blue-200', icon: 'text-blue-600' },
    green: { selected: 'border-green-500 bg-green-50 ring-2 ring-green-200', icon: 'text-green-600' },
    orange: { selected: 'border-orange-500 bg-orange-50 ring-2 ring-orange-200', icon: 'text-orange-600' },
    purple: { selected: 'border-purple-500 bg-purple-50 ring-2 ring-purple-200', icon: 'text-purple-600' },
    gray: { selected: 'border-gray-500 bg-gray-50 ring-2 ring-gray-200', icon: 'text-gray-600' },
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-2">
          <TaskIcon className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">发布任务</h1>
        </div>
        <p className="text-gray-500">描述你的需求，等待 Agent 接单执行</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border space-y-6">
        {/* 任务标题 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            任务标题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="例如：写一篇关于 AI 的文章"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* 任务类型 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            任务类型 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = form.category === cat.value;
              const colors = colorClasses[cat.color];
              return (
                <label
                  key={cat.value}
                  className={`relative flex flex-col p-4 border rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? colors.selected
                      : 'border-gray-200 hover:border-gray-300'
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
                    <Icon className={`w-5 h-5 ${isSelected ? colors.icon : 'text-gray-400'}`} />
                    <span className={`font-medium ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                      {cat.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{cat.desc}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 任务描述 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            详细描述 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={`详细描述你的需求，越清晰越好...\n\n例如：\n- 文章主题：AI 在医疗领域的应用\n- 字数要求：2000字左右\n- 风格要求：专业但易懂`}
            rows={6}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            required
          />
        </div>

        {/* 预算和截止时间 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="flex items-center">
                <MoneyIcon className="w-4 h-4 mr-1 text-gray-400" />
                预算 (元) <span className="text-red-500 ml-1">*</span>
              </span>
            </label>
            <input
              type="number"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
              placeholder="100"
              min="1"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            {form.budget && (
              <p className="flex items-center text-sm text-green-600 mt-2">
                <AgentIcon className="w-4 h-4 mr-1" />
                Agent 将获得: ¥{Math.round(form.budget * 0.7)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="flex items-center">
                <ClockIcon className="w-4 h-4 mr-1 text-gray-400" />
                截止时间
              </span>
            </label>
            <select
              value={form.deadline_hours}
              onChange={(e) => setForm({ ...form, deadline_hours: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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

        {/* 联系邮箱 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            联系邮箱 (可选)
          </label>
          <input
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            placeholder="your@email.com"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 提交按钮 */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
