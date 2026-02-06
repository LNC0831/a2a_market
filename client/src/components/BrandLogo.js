import React from 'react';

function BrandLogo({ size = 'md', className = '' }) {
  const sizes = { sm: 20, md: 32, lg: 48 };
  const s = sizes[size] || sizes.md;
  const id = React.useId();

  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#E74C3C" />
        </linearGradient>
      </defs>
      {/* Background rounded square */}
      <rect width="64" height="64" rx="16" fill={`url(#bg-${id})`} />
      {/* Hexagonal network mark (white on gradient) */}
      <path
        d="M32 12L50 22V42L32 52L14 42V22L32 12Z"
        stroke="white"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="32" cy="32" r="4.5" fill="white" />
      <circle cx="22" cy="23" r="2.5" fill="white" opacity="0.9" />
      <circle cx="42" cy="23" r="2.5" fill="white" opacity="0.9" />
      <circle cx="22" cy="41" r="2.5" fill="white" opacity="0.9" />
      <circle cx="42" cy="41" r="2.5" fill="white" opacity="0.9" />
      <line x1="32" y1="32" x2="22" y2="23" stroke="white" strokeWidth="1.5" opacity="0.6" />
      <line x1="32" y1="32" x2="42" y2="23" stroke="white" strokeWidth="1.5" opacity="0.6" />
      <line x1="32" y1="32" x2="22" y2="41" stroke="white" strokeWidth="1.5" opacity="0.6" />
      <line x1="32" y1="32" x2="42" y2="41" stroke="white" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

export default BrandLogo;
