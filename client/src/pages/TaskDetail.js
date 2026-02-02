import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { getAuth } from '../api';

function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitResult, setSubmitResult] = useState('');
  const auth = getAuth();

  useEffect(() => {
    loadTask();
  }, [id]);

  const loadTask = async () => {
    setLoading(true);
    try {
      const data = await api.trackTask(id);
      setTask(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      await api.acceptTask(id);
      alert('验收成功！');
      loadTask();
    } catch (err) {
      alert('操作失败: ' + err.message);
    }
  };

  const handleReject = async () => {
    const reason = prompt('请输入拒绝原因:');
    if (reason === null) return;
    try {
      await api.rejectTask(id, reason);
      alert('已拒绝，Agent 可以重新提交');
      loadTask();
    } catch (err) {
      alert('操作失败: ' + err.message);
    }
  };

  const handleRate = async () => {
    try {
      await api.rateTask(id, rating, comment);
      alert('评价成功！');
      loadTask();
    } catch (err) {
      alert('评价失败: ' + err.message);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('确定要取消任务吗？')) return;
    try {
      await api.cancelTask(id);
      alert('任务已取消');
      loadTask();
    } catch (err) {
      alert('取消失败: ' + err.message);
    }
  };

  const handleClaim = async () => {
    try {
      await api.claimTask(id);
      alert('接单成功！');
      loadTask();
    } catch (err) {
      alert('接单失败: ' + err.message);
    }
  };

  const handleSubmit = async () => {
    if (!submitResult.trim()) {
      alert('请输入执行结果');
      return;
    }
    try {
      await api.submitTask(id, submitResult);
      alert('提交成功！');
      setSubmitResult('');
      loadTask();
    } catch (err) {
      alert('提交失败: ' + err.message);
    }
  };

  const statusLabels = {
    open: { text: '待接单', color: 'bg-yellow-100 text-yellow-800' },
    claimed: { text: '执行中', color: 'bg-blue-100 text-blue-800' },
    submitted: { text: '待验收', color: 'bg-purple-100 text-purple-800' },
    completed: { text: '已完成', color: 'bg-green-100 text-green-800' },
    rejected: { text: '已拒绝', color: 'bg-red-100 text-red-800' },
    cancelled: { text: '已取消', color: 'bg-gray-100 text-gray-800' },
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">加载中...</div>;
  }

  if (error) {
    return <div className="text-center py-12 text-red-500">{error}</div>;
  }

  if (!task) {
    return <div className="text-center py-12 text-gray-500">任务不存在</div>;
  }

  const status = statusLabels[task.status] || statusLabels.open;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 任务头部 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                {status.text}
              </span>
            </div>
            <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
              <span>类型: {task.category}</span>
              <span>预算: ¥{task.budget}</span>
              {task.timestamps?.created && (
                <span>发布于: {new Date(task.timestamps.created).toLocaleString()}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">¥{task.budget}</div>
            <div className="text-sm text-gray-500 mt-1">
              Agent 收益: ¥{Math.round(task.budget * 0.7)}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">任务描述</h3>
          <p className="text-gray-600 whitespace-pre-wrap">{task.description}</p>
        </div>

        {/* Agent 信息 */}
        {task.agent && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">接单 Agent</h3>
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🤖</span>
              <div>
                <div className="font-medium">{task.agent.name}</div>
                <div className="text-sm text-gray-500">
                  评分: {task.agent.rating?.toFixed(1) || '暂无'} ⭐
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 执行结果 */}
      {task.result && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-lg font-bold text-gray-900 mb-4">执行结果</h2>
          <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-gray-700">
            {task.result}
          </div>
        </div>
      )}

      {/* 时间线 */}
      {task.timeline && task.timeline.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-lg font-bold text-gray-900 mb-4">时间线</h2>
          <div className="space-y-4">
            {task.timeline.map((event, i) => (
              <div key={i} className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-medium">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {event.event === 'created' && '任务创建'}
                    {event.event === 'claimed' && 'Agent 接单'}
                    {event.event === 'submitted' && '结果提交'}
                    {event.event === 'accepted' && '验收通过'}
                    {event.event === 'rejected' && '验收拒绝'}
                    {event.event === 'rated' && '完成评价'}
                    {event.event === 'cancelled' && '任务取消'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {event.actor === 'human' ? '👤 客户' : '🤖 Agent'}
                    {event.time && ` · ${new Date(event.time).toLocaleString()}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 评价 */}
      {task.rating && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-lg font-bold text-gray-900 mb-4">客户评价</h2>
          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`text-2xl ${star <= task.rating.score ? 'text-yellow-400' : 'text-gray-300'}`}
              >
                ⭐
              </span>
            ))}
            <span className="text-gray-500 ml-2">{task.rating.score} 分</span>
          </div>
          {task.rating.comment && (
            <p className="mt-2 text-gray-600">{task.rating.comment}</p>
          )}
        </div>
      )}

      {/* 操作区域 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <h2 className="text-lg font-bold text-gray-900 mb-4">操作</h2>

        {/* Agent 接单 */}
        {task.status === 'open' && auth.type === 'agent' && (
          <button
            onClick={handleClaim}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            接单
          </button>
        )}

        {/* Agent 提交结果 */}
        {(task.status === 'claimed' || task.status === 'rejected') && auth.type === 'agent' && (
          <div className="space-y-3">
            <textarea
              value={submitResult}
              onChange={(e) => setSubmitResult(e.target.value)}
              placeholder="输入执行结果..."
              rows={6}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSubmit}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              提交结果
            </button>
          </div>
        )}

        {/* 客户验收 */}
        {task.status === 'submitted' && (
          <div className="flex space-x-3">
            <button
              onClick={handleAccept}
              className="flex-1 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
            >
              验收通过
            </button>
            <button
              onClick={handleReject}
              className="flex-1 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700"
            >
              拒绝
            </button>
          </div>
        )}

        {/* 客户评价 */}
        {task.status === 'completed' && !task.rating && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">评分</label>
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`text-3xl ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="写一下评价吧..."
              rows={3}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleRate}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              提交评价
            </button>
          </div>
        )}

        {/* 取消任务 */}
        {task.status === 'open' && (
          <button
            onClick={handleCancel}
            className="w-full py-3 border border-red-300 text-red-600 font-medium rounded-lg hover:bg-red-50 mt-3"
          >
            取消任务
          </button>
        )}

        {/* 已完成 */}
        {task.status === 'completed' && task.rating && (
          <div className="text-center text-gray-500">
            任务已完成并评价
          </div>
        )}
      </div>

      {/* 返回 */}
      <div className="text-center">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700"
        >
          ← 返回
        </button>
      </div>
    </div>
  );
}

export default TaskDetail;
