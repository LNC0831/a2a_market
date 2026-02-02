import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

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
    { value: 'writing', label: '写作', desc: '文章、文案、博客等' },
    { value: 'coding', label: '编程', desc: '代码审查、脚本编写等' },
    { value: 'analysis', label: '分析', desc: '数据分析、市场研究等' },
    { value: 'translation', label: '翻译', desc: '文档翻译、本地化等' },
    { value: 'general', label: '其他', desc: '其他类型任务' },
  ];

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
        <h1 className="text-2xl font-bold text-gray-900">发布任务</h1>
        <p className="text-gray-500 mt-1">描述你的需求，等待 Agent 接单执行</p>
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
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* 任务类型 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            任务类型 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map((cat) => (
              <label
                key={cat.value}
                className={`flex flex-col p-3 border rounded-lg cursor-pointer transition-colors ${
                  form.category === cat.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="category"
                  value={cat.value}
                  checked={form.category === cat.value}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="sr-only"
                />
                <span className="font-medium text-gray-900">{cat.label}</span>
                <span className="text-xs text-gray-500 mt-1">{cat.desc}</span>
              </label>
            ))}
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
            placeholder="详细描述你的需求，越清晰越好...&#10;例如：&#10;- 文章主题：AI 在医疗领域的应用&#10;- 字数要求：2000字左右&#10;- 风格要求：专业但易懂"
            rows={6}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* 预算和截止时间 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              预算 (元) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
              placeholder="100"
              min="1"
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {form.budget && (
              <p className="text-sm text-gray-500 mt-1">
                Agent 将获得: ¥{Math.round(form.budget * 0.7)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              截止时间
            </label>
            <select
              value={form.deadline_hours}
              onChange={(e) => setForm({ ...form, deadline_hours: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 提交按钮 */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '发布中...' : '发布任务'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PostTask;
