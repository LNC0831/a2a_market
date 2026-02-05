import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  AgentIcon,
  StarSolidIcon,
  ChevronRightIcon,
} from './Icons';
import { skillLabels, getSkillIcon } from './Icons';

// Heat indicator with breathing light effect
function HeatIndicator({ level }) {
  // level: 0=cold, 1=warm, 2=hot, 3=fire
  const colors = {
    0: 'bg-gray-500',
    1: 'bg-green-500',
    2: 'bg-amber-500',
    3: 'bg-red-500',
  };

  const labels = {
    0: 'Idle',
    1: 'Active',
    2: 'Hot',
    3: 'On Fire',
  };

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`w-2 h-2 rounded-full ${colors[level]} ${level > 0 ? 'animate-pulse' : ''}`}
        style={{
          animation: level >= 2 ? 'breathe 1.5s ease-in-out infinite' : undefined,
        }}
      />
      <span className="text-xs text-dark-text-muted">{labels[level]}</span>
    </div>
  );
}

// Single agent card
function AgentCard({ agent }) {
  const skills = agent.skills?.slice(0, 3) || [];

  return (
    <Link
      to={`/agent/${agent.id}`}
      className="flex-shrink-0 w-64 premium-card rounded-xl p-4 hover:border-accent-purple/50 transition-all group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-purple/20 rounded-lg flex items-center justify-center group-hover:bg-accent-purple/30 transition-colors">
            <AgentIcon className="w-5 h-5 text-accent-purple" />
          </div>
          <div>
            <h3 className="font-medium text-dark-text-primary text-sm truncate max-w-[120px]">
              {agent.name}
            </h3>
            <div className="flex items-center gap-1 text-xs">
              <StarSolidIcon className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-dark-text-muted">{agent.rating?.toFixed(1) || '-'}</span>
            </div>
          </div>
        </div>
        <HeatIndicator level={agent.heat_level || 0} />
      </div>

      {/* Skills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {skills.map((skill, i) => {
          const SkillIcon = getSkillIcon(skill);
          return (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded bg-dark-elevated text-xs text-dark-text-muted"
            >
              <SkillIcon className="w-3 h-3 mr-1" />
              {skillLabels[skill] || skill}
            </span>
          );
        })}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-dark-text-muted">
        <span>{agent.total_tasks || 0} tasks</span>
        {agent.recent_tasks > 0 && (
          <span className="text-accent-green">+{agent.recent_tasks} this week</span>
        )}
      </div>
    </Link>
  );
}

function AgentCarousel({ agents, loading = false, onViewAll }) {
  const scrollRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);

  // Auto scroll
  useEffect(() => {
    if (!scrollRef.current || isPaused || loading || !agents?.length) return;

    const container = scrollRef.current;
    const scrollWidth = container.scrollWidth - container.clientWidth;

    let scrollPosition = 0;
    const scrollSpeed = 0.5; // pixels per frame

    const animate = () => {
      if (!isPaused) {
        scrollPosition += scrollSpeed;
        if (scrollPosition >= scrollWidth) {
          scrollPosition = 0;
        }
        container.scrollLeft = scrollPosition;
      }
    };

    const intervalId = setInterval(animate, 30);
    return () => clearInterval(intervalId);
  }, [isPaused, loading, agents]);

  if (loading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-dark-text-primary flex items-center">
            <span className="mr-2">Active Agents</span>
          </h2>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-64 h-32 bg-dark-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!agents || agents.length === 0) {
    return null;
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-dark-text-primary flex items-center">
          <span className="text-xl mr-2">Active Agents</span>
          <span className="text-sm font-normal text-dark-text-muted">({agents.length})</span>
        </h2>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-accent-cyan hover:text-accent-cyan/80 transition-colors flex items-center"
          >
            View All
            <ChevronRightIcon className="w-4 h-4 ml-1" />
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        style={{ scrollBehavior: 'auto' }}
      >
        {/* Duplicate agents for seamless loop */}
        {[...agents, ...agents].map((agent, i) => (
          <AgentCard key={`${agent.id}-${i}`} agent={agent} />
        ))}
      </div>

      {/* Scroll indicator */}
      <div className="flex justify-center mt-4">
        <div className="flex gap-1.5">
          {agents.slice(0, Math.min(5, agents.length)).map((_, i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-dark-elevated"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// CSS for breathing animation (add to your global styles or tailwind config)
const styles = `
@keyframes breathe {
  0%, 100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default AgentCarousel;
