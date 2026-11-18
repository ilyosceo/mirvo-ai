import React from 'react';

interface MirvoLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

export const MirvoLogo: React.FC<MirvoLogoProps> = ({
  size = 'md',
  showWordmark = true,
  className = '',
}) => {
  const iconPx = size === 'sm' ? 24 : size === 'lg' ? 34 : 28;
  const textClass =
    size === 'sm'
      ? 'text-sm sm:text-base'
      : size === 'lg'
      ? 'text-xl sm:text-2xl'
      : 'text-base sm:text-lg';

  return (
    <span
      className={`inline-flex items-center gap-2 select-none whitespace-nowrap shrink-0 ${className}`}
    >
      <svg
        width={iconPx}
        height={iconPx}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="mirvo-tile-bg" x1="4" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="55%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1E40AF" />
          </linearGradient>
        </defs>

        {/* Clean cobalt squircle badge */}
        <rect x="1.5" y="1.5" width="33" height="33" rx="10" fill="url(#mirvo-tile-bg)" />
        <rect
          x="1.5"
          y="1.5"
          width="33"
          height="33"
          rx="10"
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth="1.2"
        />

        {/* Open-book / prism M wings */}
        <path
          d="M 8.8 24.5 L 12.6 12.2 L 18 19 L 23.4 12.2 L 27.2 24.5"
          stroke="#FFFFFF"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Subtle baseline */}
        <path
          d="M 9.5 27.5 Q 18 24.5 26.5 27.5"
          stroke="rgba(219, 234, 254, 0.55)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />

        {/* Warm golden idea dot */}
        <circle cx="18" cy="9.5" r="2.5" fill="#FBBF24" stroke="#FFFFFF" strokeWidth="1" />
      </svg>

      {showWordmark && (
        <span
          className={`${textClass} font-bold tracking-tight text-slate-900 leading-none`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Mirvo <span className="text-[#2563EB] font-semibold">AI</span>
        </span>
      )}
    </span>
  );
};
