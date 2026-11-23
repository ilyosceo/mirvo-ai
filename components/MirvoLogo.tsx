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
          <linearGradient id="mirvo-tile-bg" x1="3" y1="2" x2="33" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0A84FF" />
            <stop offset="100%" stopColor="#0071E3" />
          </linearGradient>
        </defs>

        <rect x="1.5" y="1.5" width="33" height="33" rx="9.5" fill="url(#mirvo-tile-bg)" />
        <rect
          x="1.5"
          y="1.5"
          width="33"
          height="33"
          rx="9.5"
          stroke="rgba(255, 255, 255, 0.28)"
          strokeWidth="1"
        />

        <path
          d="M 9.2 24.2 L 12.8 12.6 L 18 19.2 L 23.2 12.6 L 26.8 24.2"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="18" cy="9.6" r="2.1" fill="#FFFFFF" fillOpacity="0.92" />
      </svg>

      {showWordmark && (
        <span
          className={`${textClass} font-semibold tracking-[-0.025em] text-[#1D1D1F] leading-none`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Mirvo <span className="text-[#0071E3] font-medium">AI</span>
        </span>
      )}
    </span>
  );
};
