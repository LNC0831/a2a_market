import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { getAuth } from '../api';
import {
  TaskIcon,
  AgentIcon,
  UserIcon,
  MoneyIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronRightIcon,
  FastIcon,
} from '../components/Icons';
import { statusConfig, skillColors, skillLabels, getSkillIcon } from '../components/Icons';

// Message bubble component
function MessageBubble({ message, isOwnMessage }) {
  const getIcon = () => {
    switch (message.sender_type) {
      case 'client':
        return <UserIcon className="w-4 h-4" />;
      case 'agent':
        return <AgentIcon className="w-4 h-4" />;
      case 'system':
        return <TaskIcon className="w-4 h-4" />;
      default:
        return <UserIcon className="w-4 h-4" />;
    }
  };

  const getBgColor = () => {
    if (message.type === 'system') return 'bg-dark-elevated border border-dark-border';
    if (isOwnMessage) return 'bg-accent-cyan/20 border border-accent-cyan/30';
    if (message.sender_type === 'agent') return 'bg-accent-purple/20 border border-accent-purple/30';
    return 'bg-dark-elevated border border-dark-border';
  };

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-4">
        <div className="inline-flex items-center px-4 py-2 bg-dark-elevated/50 rounded-full text-sm text-dark-text-muted">
          <TaskIcon className="w-4 h-4 mr-2 text-accent-cyan" />
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${getBgColor()} rounded-lg px-4 py-3`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`p-1 rounded ${message.sender_type === 'agent' ? 'bg-accent-purple/20 text-accent-purple' : 'bg-accent-cyan/20 text-accent-cyan'}`}>
            {getIcon()}
          </span>
          <span className="text-xs text-dark-text-muted">
            {message.sender_type === 'client' ? 'Client' : 'Agent'}
          </span>
          <span className="text-xs text-dark-text-muted">
            {new Date(message.time).toLocaleTimeString()}
          </span>
        </div>
        <p className="text-dark-text-primary whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

// Container header component
function ContainerHeader({ task, yourRole }) {
  const status = statusConfig[task.status] || statusConfig.open;
  const StatusIcon = status.icon;
  const SkillIcon = getSkillIcon(task.category);

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6 mb-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <h1 className="text-xl font-bold text-dark-text-primary">{task.title}</h1>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
              <StatusIcon className="w-4 h-4 mr-1" />
              {status.label}
            </span>
            {yourRole && (
              <span className="inline-flex items-center px-2 py-1 rounded bg-accent-primary/20 text-accent-primary text-xs">
                You are the {yourRole}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-dark-text-muted">
            <span className={`inline-flex items-center px-2 py-1 rounded border ${skillColors[task.category] || skillColors.general}`}>
              <SkillIcon className="w-4 h-4 mr-1" />
              {skillLabels[task.category] || task.category}
            </span>
            <span className="flex items-center">
              <MoneyIcon className="w-4 h-4 mr-1" />
              {task.budget} MP
            </span>
          </div>
        </div>
      </div>

      {/* Task Description - Collapsible */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-dark-text-secondary hover:text-dark-text-primary">
          View Task Description
        </summary>
        <div className="mt-2 p-4 bg-dark-elevated rounded-lg">
          <p className="text-dark-text-secondary whitespace-pre-wrap text-sm">{task.description}</p>
        </div>
      </details>

      {/* Result - Collapsible */}
      {task.result && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-accent-cyan hover:text-accent-cyan/80 flex items-center">
            <FastIcon className="w-4 h-4 mr-1" />
            View Submitted Result
          </summary>
          <div className="mt-2 p-4 bg-accent-cyan/10 border border-accent-cyan/20 rounded-lg">
            <p className="text-dark-text-secondary whitespace-pre-wrap text-sm font-mono">{task.result}</p>
          </div>
        </details>
      )}
    </div>
  );
}

// Action buttons component
function ContainerActions({ task, actions, onAction, loading, yourRole }) {
  if (!actions || actions.length === 0) return null;

  const canMessage = actions.includes('message');
  const canAccept = actions.includes('accept');
  const canReject = actions.includes('reject');
  const canSubmit = actions.includes('submit') || actions.includes('resubmit');
  const canCancel = actions.includes('cancel');

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-4">
      <div className="flex flex-wrap gap-3">
        {canAccept && (
          <button
            onClick={() => onAction('accept')}
            disabled={loading}
            className="flex-1 min-w-[120px] flex items-center justify-center py-2 px-4 bg-accent-green text-white font-medium rounded-lg hover:bg-accent-green/90 transition-colors disabled:opacity-50"
          >
            <CheckCircleIcon className="w-5 h-5 mr-2" />
            Accept
          </button>
        )}
        {canReject && (
          <button
            onClick={() => onAction('reject')}
            disabled={loading}
            className="flex-1 min-w-[120px] flex items-center justify-center py-2 px-4 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            <XCircleIcon className="w-5 h-5 mr-2" />
            Request Revision
          </button>
        )}
        {task.status === 'rejected' && yourRole === 'client' && (
          <button
            onClick={() => onAction('final_reject')}
            disabled={loading}
            className="flex-1 min-w-[120px] flex items-center justify-center py-2 px-4 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            <XCircleIcon className="w-5 h-5 mr-2" />
            Final Reject
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => onAction('cancel')}
            disabled={loading}
            className="flex-1 min-w-[120px] flex items-center justify-center py-2 px-4 border border-red-400/30 text-red-400 font-medium rounded-lg hover:bg-red-400/10 transition-colors disabled:opacity-50"
          >
            <XCircleIcon className="w-5 h-5 mr-2" />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function TaskContainer() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const auth = getAuth();

  const [container, setContainer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState('');

  useEffect(() => {
    loadContainer();
    // Poll for updates every 10 seconds
    const interval = setInterval(loadContainer, 10000);
    return () => clearInterval(interval);
  }, [taskId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [container?.messages]);

  const loadContainer = async () => {
    try {
      const data = await api.getContainer(taskId);
      setContainer(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await api.sendContainerMessage(taskId, message.trim());
      setMessage('');
      loadContainer();
    } catch (err) {
      alert('Failed to send message: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleAction = async (action) => {
    if (action === 'reject') {
      const reason = prompt('Please describe what needs to be revised:');
      if (reason === null) return;

      setActionLoading(true);
      try {
        await api.containerAction(taskId, 'reject', { comment: reason });
        loadContainer();
      } catch (err) {
        alert('Failed: ' + err.message);
      } finally {
        setActionLoading(false);
      }
      return;
    }

    if (action === 'final_reject') {
      if (!window.confirm('Are you sure you want to final reject? This will cancel the task and refund your payment.')) {
        return;
      }
    }

    if (action === 'cancel') {
      if (!window.confirm('Are you sure you want to cancel this task?')) {
        return;
      }
    }

    setActionLoading(true);
    try {
      await api.containerAction(taskId, action);
      loadContainer();
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmit = async () => {
    if (!submitResult.trim()) {
      alert('Please enter the revised result');
      return;
    }

    setActionLoading(true);
    try {
      await api.containerAction(taskId, 'resubmit', { result: submitResult.trim() });
      setSubmitResult('');
      loadContainer();
    } catch (err) {
      alert('Failed to resubmit: ' + err.message);
    } finally {
      setActionLoading(false);
    }
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
        <h2 className="text-xl font-bold text-dark-text-primary mb-2">Failed to Load Container</h2>
        <p className="text-red-400 mb-4">{error}</p>
        <Link to={`/task/${taskId}`} className="text-accent-cyan hover:underline">
          View Task Details
        </Link>
      </div>
    );
  }

  if (!container) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <TaskIcon className="w-16 h-16 mx-auto text-dark-text-muted mb-4" />
        <h2 className="text-xl font-bold text-dark-text-primary mb-2">Container Not Found</h2>
      </div>
    );
  }

  const { task, messages, actions, participants, your_role, negotiation } = container;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <ContainerHeader task={task} yourRole={your_role} />

      {/* Negotiation Banner */}
      {negotiation && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center">
            <ClockIcon className="w-5 h-5 text-amber-500 mr-3" />
            <div>
              <span className="text-amber-400 font-medium">Negotiation in progress</span>
              <span className="text-dark-text-muted ml-2">
                {negotiation.remaining_hours > 0
                  ? `${negotiation.remaining_hours} hours remaining`
                  : 'Time expired'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <ContainerActions
        task={task}
        actions={actions}
        onAction={handleAction}
        loading={actionLoading}
        yourRole={your_role}
      />

      {/* Agent Resubmit Area */}
      {your_role === 'agent' && (task.status === 'rejected' || task.status === 'claimed') && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-dark-text-secondary mb-3">
            {task.status === 'rejected' ? 'Submit Revised Result' : 'Submit Result'}
          </h3>
          <textarea
            value={submitResult}
            onChange={(e) => setSubmitResult(e.target.value)}
            placeholder="Enter your result..."
            rows={6}
            className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cyan resize-none mb-3"
          />
          <button
            onClick={handleResubmit}
            disabled={actionLoading || !submitResult.trim()}
            className="w-full flex items-center justify-center py-3 bg-accent-cyan text-dark-bg font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors disabled:opacity-50"
          >
            <FastIcon className="w-5 h-5 mr-2" />
            {task.status === 'rejected' ? 'Resubmit' : 'Submit Result'}
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="bg-dark-card border border-dark-border rounded-xl">
        <div className="p-4 border-b border-dark-border">
          <h2 className="text-lg font-bold text-dark-text-primary flex items-center">
            <span className="mr-2">Conversation</span>
            <span className="text-sm font-normal text-dark-text-muted">
              ({messages?.length || 0} messages)
            </span>
          </h2>
        </div>

        {/* Messages List */}
        <div className="p-4 min-h-[300px] max-h-[500px] overflow-y-auto">
          {messages && messages.length > 0 ? (
            <>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwnMessage={
                    (your_role === 'client' && msg.sender_type === 'client') ||
                    (your_role === 'agent' && msg.sender_type === 'agent')
                  }
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="text-center py-12 text-dark-text-muted">
              <TaskIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
        </div>

        {/* Message Input */}
        {container.is_participant && (
          <form onSubmit={handleSendMessage} className="p-4 border-t border-dark-border">
            <div className="flex gap-3">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cyan"
              />
              <button
                type="submit"
                disabled={sending || !message.trim()}
                className="px-6 py-2 bg-accent-cyan text-dark-bg font-medium rounded-lg hover:bg-accent-cyan/90 transition-colors disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Participants */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <h3 className="text-sm font-medium text-dark-text-secondary mb-3">Participants</h3>
        <div className="flex gap-4">
          {participants.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.type === 'agent' ? 'bg-accent-purple/20' : 'bg-accent-cyan/20'}`}>
                {p.type === 'agent' ? (
                  <AgentIcon className="w-4 h-4 text-accent-purple" />
                ) : (
                  <UserIcon className="w-4 h-4 text-accent-cyan" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium text-dark-text-primary">
                  {p.name}
                  {p.is_you && <span className="text-xs text-accent-primary ml-1">(You)</span>}
                </div>
                <div className="text-xs text-dark-text-muted capitalize">{p.type}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Back Link */}
      <div className="text-center pt-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-dark-text-muted hover:text-dark-text-secondary transition-colors"
        >
          <ChevronRightIcon className="w-4 h-4 mr-1 rotate-180" />
          Go Back
        </button>
      </div>
    </div>
  );
}

export default TaskContainer;
