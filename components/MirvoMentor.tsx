import React, { useId } from 'react';
import type { TeacherDepth, TutorPose } from '../types/tutor';

interface MirvoMentorProps {
  isSpeaking: boolean;
  isDrawing?: boolean;
  isListening?: boolean;
  isNodding?: boolean;
  voiceActivity?: number;
  size?: number;
  className?: string;
  tiltDeg?: number;
  pose?: TutorPose;
  calloutNote?: string;
  depth?: TeacherDepth;
  speechRate?: number;
  speechPitch?: number;
}

export const MirvoMentor: React.FC<MirvoMentorProps> = ({
  isSpeaking,
  isDrawing = false,
  isListening = false,
  isNodding = false,
  voiceActivity = 0,
  size = 64,
  className = '',
  tiltDeg = 0,
  pose = 'approach',
  calloutNote,
  depth = 'mid',
  speechRate = 1,
  speechPitch = 1,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const blueGradientId = `mirvo-mentor-blue-${uid}`;
  const amberGradientId = `mirvo-mentor-amber-${uid}`;
  const activity = Math.max(0, Math.min(1, voiceActivity));
  const rate = Math.max(0.7, Math.min(1.5, speechRate));
  const pitchScale = Math.max(0.8, Math.min(1.25, speechPitch));
  const bars = [0.46, 0.78, 1, 0.68, 0.4];
  const shadowAlpha = depth === 'near' ? 0.2 : depth === 'far' ? 0.1 : 0.15;
  const haloVisible = isSpeaking || isListening;

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center select-none pointer-events-none shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(0 6px 12px rgba(30, 58, 138, ${shadowAlpha}))`,
        transform: `translateY(${isNodding ? -2 : 0}px) rotate(${tiltDeg.toFixed(1)}deg)`,
        opacity: depth === 'far' ? 0.92 : 1,
        transition: 'opacity 260ms ease, filter 260ms ease, transform 260ms ease',
      }}
      role="img"
      aria-label="Mirvo AI interaktiv ustoz"
      data-pose={pose}
    >
      {calloutNote && (
        <div className="mb-1 px-2.5 py-0.5 rounded-full bg-white/95 border border-blue-200 shadow-xs text-[10px] font-semibold text-slate-800 whitespace-nowrap leading-tight">
          {calloutNote}
        </div>
      )}

      <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={blueGradientId} x1="30" y1="18" x2="90" y2="94" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="48%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </linearGradient>
          <linearGradient id={amberGradientId} x1="42" y1="10" x2="72" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        {haloVisible && (
          <circle
            cx="60"
            cy="60"
            r={isListening ? 48 : 44}
            fill="none"
            stroke={isListening ? '#60A5FA' : '#FBBF24'}
            strokeWidth="1.5"
            strokeDasharray="3 5"
            opacity="0.62"
            className="mirvo-mentor-halo"
          />
        )}

        <g
          className="mirvo-mentor-body"
          style={{ animationDuration: `${Math.max(0.52, 1.15 / rate)}s` }}
        >
          <ellipse cx="60" cy="102" rx="26" ry="5" fill="#1E3A8A" opacity="0.12" />

          <path
            d="M27 37 60 18 93 37 93 75 60 95 27 75Z"
            fill={`url(#${blueGradientId})`}
            stroke="#1D4ED8"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M27 39 15 46 20 68 31 65Z" fill="#BFDBFE" stroke="#2563EB" strokeWidth="2" />
          <path d="M93 39 105 46 100 68 89 65Z" fill="#BFDBFE" stroke="#2563EB" strokeWidth="2" />
          <path d="M34 38 60 23 86 38" fill="none" stroke="#DBEAFE" strokeWidth="2" opacity="0.85" />

          <rect x="39" y="39" width="42" height="20" rx="7" fill="#102A64" stroke="#93C5FD" strokeWidth="1.5" />
          <g aria-hidden="true">
            {bars.map((bar, index) => {
              const centerY = 49;
              const height = isSpeaking ? (3 + bar * (3 + activity * 8)) * pitchScale : 3 + bar * 2;
              return (
                <rect
                  key={index}
                  x={48 + index * 6}
                  y={centerY - height / 2}
                  width="3"
                  height={height}
                  rx="1.5"
                  fill={isListening ? '#93C5FD' : '#F8FAFC'}
                  opacity={0.72 + bar * 0.28}
                  className={isSpeaking ? 'mirvo-mentor-wave' : undefined}
                  style={isSpeaking ? { animationDelay: `${index * -0.12}s` } : undefined}
                />
              );
            })}
          </g>

          <path
            d="M44 69 51 77 60 68 69 77 76 69"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M47 83 Q60 88 73 83" fill="none" stroke="#BFDBFE" strokeWidth="2" strokeLinecap="round" />

          <path d="M60 18V10" stroke="#1D4ED8" strokeWidth="3" strokeLinecap="round" />
          <path
            d="M60 3.5 62.7 8.3 68 9.5 64.3 13.3 64.8 18.5 60 16 55.2 18.5 55.7 13.3 52 9.5 57.3 8.3Z"
            fill={`url(#${amberGradientId})`}
            stroke="#FFFFFF"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          <circle cx="30" cy="72" r="3" fill={isDrawing ? '#FBBF24' : '#93C5FD'} />
          <circle cx="90" cy="72" r="3" fill={isDrawing ? '#FBBF24' : '#93C5FD'} />
        </g>
      </svg>
    </div>
  );
};
