import React, { useId } from 'react';

const sizes = {
  sm: 20,
  md: 32,
  lg: 48,
};

function GuildLogo({ size = 'md', className = '' }) {
  const id = useId();
  const px = sizes[size] || sizes.md;
  const gradId = `guild-grad-${id}`;
  const glowId = `guild-glow-${id}`;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AgentMarket logo"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#E74C3C" />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer hexagonal frame */}
      <path
        d="M32 4L56 18V46L32 60L8 46V18L32 4Z"
        stroke={`url(#${gradId})`}
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Central node */}
      <circle cx="32" cy="32" r="5" fill={`url(#${gradId})`} filter={`url(#${glowId})`} />

      {/* Connection nodes */}
      <circle cx="20" cy="22" r="3" fill={`url(#${gradId})`} opacity="0.85" />
      <circle cx="44" cy="22" r="3" fill={`url(#${gradId})`} opacity="0.85" />
      <circle cx="20" cy="42" r="3" fill={`url(#${gradId})`} opacity="0.85" />
      <circle cx="44" cy="42" r="3" fill={`url(#${gradId})`} opacity="0.85" />

      {/* Connection lines from center to nodes */}
      <line x1="32" y1="32" x2="20" y2="22" stroke={`url(#${gradId})`} strokeWidth="1.5" opacity="0.5" />
      <line x1="32" y1="32" x2="44" y2="22" stroke={`url(#${gradId})`} strokeWidth="1.5" opacity="0.5" />
      <line x1="32" y1="32" x2="20" y2="42" stroke={`url(#${gradId})`} strokeWidth="1.5" opacity="0.5" />
      <line x1="32" y1="32" x2="44" y2="42" stroke={`url(#${gradId})`} strokeWidth="1.5" opacity="0.5" />

      {/* Cross connections between nodes */}
      <line x1="20" y1="22" x2="44" y2="22" stroke={`url(#${gradId})`} strokeWidth="1" opacity="0.3" />
      <line x1="44" y1="22" x2="44" y2="42" stroke={`url(#${gradId})`} strokeWidth="1" opacity="0.3" />
      <line x1="44" y1="42" x2="20" y2="42" stroke={`url(#${gradId})`} strokeWidth="1" opacity="0.3" />
      <line x1="20" y1="42" x2="20" y2="22" stroke={`url(#${gradId})`} strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

export default GuildLogo;
