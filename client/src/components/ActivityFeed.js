import React from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircleIcon,
  StarSolidIcon,
  AgentIcon,
} from './Icons';

// Format relative time
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Activity item component
function ActivityItem({ activity }) {
  const { type, time, data } = activity;

  const getIcon = () => {
    switch (type) {
      case 'task_completed':
        return <CheckCircleIcon className="w-4 h-4 text-accent-green" />;
      case 'five_star_rating':
        return <StarSolidIcon className="w-4 h-4 text-yellow-400" />;
      case 'new_agent':
        return <AgentIcon className="w-4 h-4 text-accent-purple" />;
      default:
        return <CheckCircleIcon className="w-4 h-4 text-dark-text-muted" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'task_completed':
        return 'bg-accent-green/10';
      case 'five_star_rating':
        return 'bg-yellow-400/10';
      case 'new_agent':
        return 'bg-accent-purple/10';
      default:
        return 'bg-dark-elevated';
    }
  };

  const renderContent = () => {
    switch (type) {
      case 'task_completed':
        return (
          <span className="text-dark-text-secondary">
            <Link
              to={`/agent/${data.agent_id}`}
              className="text-accent-purple hover:underline font-medium"
            >
              {data.agent_name}
            </Link>
            {' completed '}
            <Link
              to={`/task/${data.task_id}`}
              className="text-accent-cyan hover:underline"
            >
              "{data.task_title?.substring(0, 30)}{data.task_title?.length > 30 ? '...' : ''}"
            </Link>
            {data.rating && (
              <span className="ml-1 inline-flex items-center">
                <StarSolidIcon className="w-3 h-3 text-yellow-400 ml-1" />
                <span className="text-dark-text-muted text-xs ml-0.5">{data.rating}</span>
              </span>
            )}
          </span>
        );

      case 'five_star_rating':
        return (
          <span className="text-dark-text-secondary">
            <Link
              to={`/agent/${data.agent_id}`}
              className="text-accent-purple hover:underline font-medium"
            >
              {data.agent_name}
            </Link>
            {' received a '}
            <span className="text-yellow-400 font-medium">5-star</span>
            {' rating'}
            {data.comment && (
              <span className="text-dark-text-muted text-xs block mt-0.5 italic">
                "{data.comment?.substring(0, 50)}{data.comment?.length > 50 ? '...' : ''}"
              </span>
            )}
          </span>
        );

      case 'new_agent':
        return (
          <span className="text-dark-text-secondary">
            <Link
              to={`/agent/${data.agent_id}`}
              className="text-accent-purple hover:underline font-medium"
            >
              {data.agent_name}
            </Link>
            {' joined the marketplace'}
            {data.skills?.length > 0 && (
              <span className="text-dark-text-muted text-xs ml-1">
                ({data.skills.slice(0, 2).join(', ')}{data.skills.length > 2 ? ', ...' : ''})
              </span>
            )}
          </span>
        );

      default:
        return <span className="text-dark-text-muted">Activity</span>;
    }
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-dark-border last:border-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getIconBg()}`}>
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm">{renderContent()}</div>
        <div className="text-xs text-dark-text-muted mt-0.5">
          {formatRelativeTime(time)}
        </div>
      </div>
    </div>
  );
}

function ActivityFeed({ activities, loading = false, maxItems = 10 }) {
  if (loading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-dark-text-primary mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-dark-elevated" />
              <div className="flex-1">
                <div className="h-4 bg-dark-elevated rounded w-3/4 mb-2" />
                <div className="h-3 bg-dark-elevated rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-dark-text-primary mb-4">Recent Activity</h2>
        <div className="text-center py-8 text-dark-text-muted">
          <CheckCircleIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No recent activity</p>
        </div>
      </div>
    );
  }

  const displayActivities = activities.slice(0, maxItems);

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6">
      <h2 className="text-lg font-bold text-dark-text-primary mb-4 flex items-center">
        <span className="mr-2">Recent Activity</span>
        {activities.length > 0 && (
          <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
        )}
      </h2>
      <div className="max-h-[400px] overflow-y-auto">
        {displayActivities.map((activity, i) => (
          <ActivityItem key={`${activity.type}-${activity.time}-${i}`} activity={activity} />
        ))}
      </div>
      {activities.length > maxItems && (
        <div className="text-center mt-4 pt-4 border-t border-dark-border">
          <span className="text-sm text-dark-text-muted">
            +{activities.length - maxItems} more activities
          </span>
        </div>
      )}
    </div>
  );
}

export default ActivityFeed;
