import React from 'react';
import { Link } from 'react-router-dom';
import { AgentIcon, StarIcon } from './Icons';

function AgentQuickList({ agents = [], loading = false, onRefresh, onViewAll }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <AgentIcon className="w-5 h-5 text-accent-purple mr-2" />
          <h3 className="text-lg font-bold text-dark-text-primary">Discover Agents</h3>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center text-sm text-dark-text-muted hover:text-accent-purple transition-colors"
            title="Refresh"
          >
            <RefreshIcon className="w-4 h-4 mr-1" />
            <span>Shuffle</span>
          </button>
        )}
      </div>

      {/* Agent List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-dark-elevated rounded-lg" />
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-8 text-dark-text-muted">
          No agents available
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <AgentQuickItem key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {/* View All Button */}
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="w-full mt-4 py-2 text-sm text-accent-purple hover:text-dark-text-primary border border-dark-border hover:border-accent-purple/50 rounded-lg transition-colors"
        >
          View All Agents &rarr;
        </button>
      )}
    </div>
  );
}

function AgentQuickItem({ agent }) {
  const skills = agent.skills ?
    (typeof agent.skills === 'string' ? JSON.parse(agent.skills) : agent.skills) : [];
  const displaySkills = skills.slice(0, 3);

  return (
    <Link
      to={`/agents/${agent.id}`}
      className="block p-3 bg-dark-elevated/50 border border-dark-border rounded-lg hover:border-accent-purple/30 hover:bg-dark-elevated transition-all group"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center min-w-0">
          <div className="w-8 h-8 bg-accent-purple/10 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 group-hover:bg-accent-purple/20 transition-colors">
            <AgentIcon className="w-4 h-4 text-accent-purple" />
          </div>
          <span className="font-medium text-dark-text-primary truncate">{agent.name}</span>
        </div>
        <div className="flex items-center text-accent-gold flex-shrink-0 ml-2">
          <StarIcon className="w-4 h-4 mr-1" />
          <span className="text-sm font-medium">{(agent.rating || 0).toFixed(1)}</span>
        </div>
      </div>
      {displaySkills.length > 0 && (
        <div className="flex flex-wrap gap-1 ml-11">
          {displaySkills.map((skill, idx) => (
            <span
              key={idx}
              className="text-xs px-2 py-0.5 bg-dark-border/50 text-dark-text-muted rounded"
            >
              {skill}
            </span>
          ))}
          {skills.length > 3 && (
            <span className="text-xs text-dark-text-muted">+{skills.length - 3}</span>
          )}
        </div>
      )}
    </Link>
  );
}

function RefreshIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

export default AgentQuickList;
