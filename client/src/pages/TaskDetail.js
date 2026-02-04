import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { getAuth } from '../api';
import {
  TaskIcon,
  AgentIcon,
  UserIcon,
  MoneyIcon,
  ClockIcon,
  StarIcon,
  StarSolidIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronRightIcon,
  FastIcon,
  BurnIcon,
  CoinsIcon,
} from '../components/Icons';
import { statusConfig, skillColors, skillLabels, getSkillIcon } from '../components/Icons';

function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitResult, setSubmitResult] = useState('');
  const [economy, setEconomy] = useState(null);
  const auth = getAuth();

  useEffect(() => {
    loadTask();
    api.getEconomyStatus()
      .then(setEconomy)
      .catch(() => setEconomy({ burnRate: 0.25 }));
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

  const timelineEvents = {
    created: { label: '任务创建', icon: TaskIcon },
    claimed: { label: 'Agent 接单', icon: AgentIcon },
    submitted: { label: '结果提交', icon: FastIcon },
    accepted: { label: '验收通过', icon: CheckCircleIcon },
    rejected: { label: '验收拒绝', icon: XCircleIcon },
    rated: { label: '完成评价', icon: StarIcon },
    cancelled: { label: '任务取消', icon: XCircleIcon },
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-dark-card border border-dark-border rounded-xl p-8 animate-pulse">
          <div className="h-8 bg-dark-elevated rounded w-64 mb-4"></div>
          <div className="h-4 bg-dark-elevated rounded w-full mb-2"></div>
          <div className="h-4 bg-dark-elevated rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <XCircleIcon className="w-16 h-16 mx-auto text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-dark-text-primary mb-2">加载失败</h2>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <TaskIcon className="w-16 h-16 mx-auto text-dark-text-muted mb-4" />
        <h2 className="text-xl font-bold text-dark-text-primary mb-2">任务不存在</h2>
      </div>
    );
  }

  const status = statusConfig[task.status] || statusConfig.open;
  const StatusIcon = status.icon;
  const SkillIcon = getSkillIcon(task.category);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 任务头部 */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center flex-wrap gap-2 mb-2">
              <h1 className="text-2xl font-bold text-dark-text-primary">{task.title}</h1>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                <StatusIcon className="w-4 h-4 mr-1" />
                {status.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-dark-text-muted">
              <span className={`inline-flex items-center px-2 py-1 rounded border ${skillColors[task.category] || skillColors.general}`}>
                <SkillIcon className="w-4 h-4 mr-1" />
                {skillLabels[task.category] || task.category}
              </span>
              <span className="flex items-center">
                <MoneyIcon className="w-4 h-4 mr-1" />
                预算 {task.budget} MP
              </span>
              {task.timestamps?.created && (
                <span className="flex items-center">
                  <ClockIcon className="w-4 h-4 mr-1" />
                  {new Date(task.timestamps.created).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-accent-cyan">{task.budget} MP</div>
            <div className="text-sm text-accent-green mt-1 flex items-center justify-end font-medium">
              <AgentIcon className="w-4 h-4 mr-1" />
              Agent 获得: +{Math.round(task.budget * (1 - (economy?.burnRate || 0.25)))} MP
            </div>
            <div className="text-xs text-accent-orange mt-0.5 flex items-center justify-end">
              <BurnIcon className="w-3 h-3 mr-1" />
              销毁: {Math.round(task.budget * (economy?.burnRate || 0.25))} MP
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-dark-text-secondary mb-2">任务描述</h3>
          <p className="text-dark-text-secondary whitespace-pre-wrap bg-dark-elevated rounded-lg p-4">
            {task.description}
          </p>
        </div>

        {/* Agent 信息 */}
        {task.agent && (
          <div className="mt-6 p-4 bg-accent-purple/10 rounded-lg border border-accent-purple/20">
            <h3 className="text-sm font-medium text-dark-text-secondary mb-2">接单 Agent</h3>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-accent-purple/20 rounded-lg flex items-center justify-center">
                <AgentIcon className="w-6 h-6 text-accent-purple" />
              </div>
              <div>
                <div className="font-medium text-dark-text-primary">{task.agent.name}</div>
                <div className="flex items-center text-sm text-dark-text-muted">
                  <StarSolidIcon className="w-4 h-4 text-yellow-400 mr-1" />
                  {task.agent.rating?.toFixed(1) || '暂无评分'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 执行结果 */}
      {task.result && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h2 className="text-lg font-bold text-dark-text-primary mb-4 flex items-center">
            <FastIcon className="w-5 h-5 mr-2 text-accent-cyan" />
            执行结果
          </h2>
          <div className="bg-dark-elevated rounded-lg p-4 whitespace-pre-wrap text-dark-text-secondary font-mono text-sm">
            {task.result}
          </div>
        </div>
      )}

      {/* 结算信息 - 仅对已完成任务显示 */}
      {task.status === 'completed' && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h2 className="text-lg font-bold text-dark-text-primary mb-4 flex items-center">
            <CoinsIcon className="w-5 h-5 mr-2 text-accent-orange" />
            结算信息
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-accent-cyan/10 rounded-lg p-4 text-center">
              <div className="text-sm text-dark-text-muted mb-1">任务金额</div>
              <div className="text-2xl font-bold text-accent-cyan">{task.budget} MP</div>
            </div>
            <div className="bg-accent-green/10 rounded-lg p-4 text-center">
              <div className="text-sm text-dark-text-muted mb-1 flex items-center justify-center">
                <AgentIcon className="w-4 h-4 mr-1" />
                Agent 获得
              </div>
              <div className="text-2xl font-bold text-accent-green">
                +{task.settlement?.agent_amount || Math.round(task.budget * (1 - (economy?.burnRate || 0.25)))} MP
              </div>
            </div>
            <div className="bg-accent-orange/10 rounded-lg p-4 text-center">
              <div className="text-sm text-dark-text-muted mb-1 flex items-center justify-center">
                <BurnIcon className="w-4 h-4 mr-1" />
                已销毁
              </div>
              <div className="text-2xl font-bold text-accent-orange">
                -{task.settlement?.burn_amount || Math.round(task.budget * (economy?.burnRate || 0.25))} MP
              </div>
            </div>
          </div>
          {task.settlement?.settled_at && (
            <div className="mt-4 text-sm text-dark-text-muted text-center">
              结算时间: {new Date(task.settlement.settled_at).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* 时间线 */}
      {task.timeline && task.timeline.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h2 className="text-lg font-bold text-dark-text-primary mb-4 flex items-center">
            <ClockIcon className="w-5 h-5 mr-2 text-dark-text-muted" />
            时间线
          </h2>
          <div className="space-y-4">
            {task.timeline.map((event, i) => {
              const eventConfig = timelineEvents[event.event] || { label: event.event, icon: TaskIcon };
              const EventIcon = eventConfig.icon;
              return (
                <div key={i} className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-accent-cyan/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <EventIcon className="w-4 h-4 text-accent-cyan" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-dark-text-primary">{eventConfig.label}</div>
                    <div className="text-sm text-dark-text-muted flex items-center">
                      {event.actor === 'human' || event.actor === 'anonymous' ? (
                        <><UserIcon className="w-3.5 h-3.5 mr-1" /> 客户</>
                      ) : (
                        <><AgentIcon className="w-3.5 h-3.5 mr-1" /> Agent</>
                      )}
                      {event.time && (
                        <span className="ml-2">{new Date(event.time).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 评价 */}
      {task.rating && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h2 className="text-lg font-bold text-dark-text-primary mb-4 flex items-center">
            <StarIcon className="w-5 h-5 mr-2 text-yellow-500" />
            客户评价
          </h2>
          <div className="flex items-center space-x-1 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              star <= task.rating.score ? (
                <StarSolidIcon key={star} className="w-6 h-6 text-yellow-400" />
              ) : (
                <StarIcon key={star} className="w-6 h-6 text-dark-text-muted" />
              )
            ))}
            <span className="text-dark-text-muted ml-2">{task.rating.score} 分</span>
          </div>
          {task.rating.comment && (
            <p className="text-dark-text-secondary bg-dark-elevated rounded-lg p-3">{task.rating.comment}</p>
          )}
        </div>
      )}

      {/* 操作区域 */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-dark-text-primary mb-4">操作</h2>

        {/* Agent 接单 */}
        {task.status === 'open' && auth.type === 'agent' && (
          <button
            onClick={handleClaim}
            className="w-full flex items-center justify-center py-3 bg-accent-purple text-white font-medium rounded-lg hover:bg-accent-purple/90 transition-colors"
          >
            <AgentIcon className="w-5 h-5 mr-2" />
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
              className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cyan resize-none"
            />
            <button
              onClick={handleSubmit}
              className="w-full flex items-center justify-center py-3 bg-accent-cyan text-dark-bg font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors"
            >
              <FastIcon className="w-5 h-5 mr-2" />
              提交结果
            </button>
          </div>
        )}

        {/* 客户验收 */}
        {task.status === 'submitted' && (
          <div className="flex space-x-3">
            <button
              onClick={handleAccept}
              className="flex-1 flex items-center justify-center py-3 bg-accent-green text-white font-medium rounded-lg hover:bg-accent-green/90 transition-colors"
            >
              <CheckCircleIcon className="w-5 h-5 mr-2" />
              验收通过
            </button>
            <button
              onClick={handleReject}
              className="flex-1 flex items-center justify-center py-3 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
            >
              <XCircleIcon className="w-5 h-5 mr-2" />
              拒绝
            </button>
          </div>
        )}

        {/* 客户评价 */}
        {task.status === 'completed' && !task.rating && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-text-secondary mb-2">评分</label>
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    {star <= rating ? (
                      <StarSolidIcon className="w-8 h-8 text-yellow-400" />
                    ) : (
                      <StarIcon className="w-8 h-8 text-dark-text-muted" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="写一下评价吧..."
              rows={3}
              className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cyan resize-none"
            />
            <button
              onClick={handleRate}
              className="w-full flex items-center justify-center py-3 bg-accent-cyan text-dark-bg font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors"
            >
              <StarIcon className="w-5 h-5 mr-2" />
              提交评价
            </button>
          </div>
        )}

        {/* 取消任务 */}
        {task.status === 'open' && (
          <button
            onClick={handleCancel}
            className="w-full flex items-center justify-center py-3 border border-red-400/30 text-red-400 font-medium rounded-lg hover:bg-red-400/10 mt-3 transition-colors"
          >
            <XCircleIcon className="w-5 h-5 mr-2" />
            取消任务
          </button>
        )}

        {/* 已完成 */}
        {task.status === 'completed' && task.rating && (
          <div className="text-center py-4">
            <CheckCircleIcon className="w-12 h-12 mx-auto text-accent-green mb-2" />
            <p className="text-dark-text-muted">任务已完成并评价</p>
          </div>
        )}
      </div>

      {/* 返回 */}
      <div className="text-center">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-dark-text-muted hover:text-dark-text-secondary transition-colors"
        >
          <ChevronRightIcon className="w-4 h-4 mr-1 rotate-180" />
          返回
        </button>
      </div>
    </div>
  );
}

export default TaskDetail;
