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
  lookVector?: { x: number; y: number };
  focusActive?: boolean;
}

function clampVal(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
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
  lookVector,
  focusActive = false,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const coreGradientId = `mirvo-lens-core-${uid}`;
  const ringGradientId = `mirvo-lens-ring-${uid}`;
  const activity = Math.max(0, Math.min(1, voiceActivity));
  const rate = Math.max(0.7, Math.min(1.5, speechRate));
  const pitchScale = Math.max(0.8, Math.min(1.25, speechPitch));
  const bars = [0.42, 0.76, 1, 0.72, 0.38];
  const shadowAlpha = depth === 'near' ? 0.18 : depth === 'far' ? 0.08 : 0.13;
  const haloVisible = isSpeaking || isListening || focusActive;

  const lx = clampVal(lookVector?.x ?? 0, -2.5, 2.5);
  const ly = clampVal(lookVector?.y ?? 0, -2.5, 2.5);
  const hasLookDir = Math.hypot(lx, ly) > 0.08;
  const focusAngleDeg = hasLookDir ? (Math.atan2(ly, lx) * 180) / Math.PI : -45;
  const eyeScale = focusActive ? 2.5 : 2.1;
  const pupilScale = focusActive ? 1.45 : 1.15;
  const eyeOffsetX = hasLookDir ? clampVal(lx * eyeScale, -5.6, 5.6) : 0;
  const eyeOffsetY = hasLookDir ? clampVal(ly * eyeScale * 0.9, -4.8, 4.8) : 0;
  const pupilOffsetX = hasLookDir ? clampVal(lx * pupilScale, -2.8, 2.8) : 0;
  const pupilOffsetY = hasLookDir ? clampVal(ly * pupilScale * 0.9, -2.4, 2.4) : 0;

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center select-none pointer-events-none shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(0 5px 12px rgba(15, 23, 42, ${shadowAlpha}))`,
        transform: `translateY(${isNodding ? -2 : 0}px) rotate(${tiltDeg.toFixed(1)}deg)`,
        opacity: depth === 'far' ? 0.92 : 1,
        transition: 'opacity 220ms ease, filter 220ms ease, transform 220ms ease',
      }}
      role="img"
      aria-label="Mirvo AI fokus ko‘rsatkichi"
      data-pose={pose}
    >
      {calloutNote && (
        <div
          className={`mb-1 px-2.5 py-0.5 rounded-full backdrop-blur-md shadow-xs text-[10px] font-semibold whitespace-nowrap leading-tight transition-colors ${
            focusActive && isSpeaking
              ? 'bg-amber-50/95 border border-amber-400/80 text-amber-950'
              : 'bg-white/95 border border-black/[0.08] text-[#1D1D1F]'
          }`}
        >
          {calloutNote}
        </div>
      )}

      <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={coreGradientId} x1="34" y1="30" x2="86" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="55%" stopColor="#0071E3" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id={ringGradientId} x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F0F7FF" />
          </linearGradient>
        </defs>

        {haloVisible && (
          <circle
            cx="60"
            cy="60"
            r={isListening ? 49 : focusActive && isSpeaking ? 48 : focusActive ? 46 : 45}
            fill="none"
            stroke={isListening ? '#3B82F6' : focusActive ? '#F59E0B' : '#0071E3'}
            strokeWidth={focusActive && isSpeaking ? '2.2' : '1.6'}
            strokeDasharray="4 4"
            opacity={focusActive && isSpeaking ? '0.92' : focusActive ? '0.72' : '0.58'}
            className="mirvo-mentor-halo"
          />
        )}

        <g
          className="mirvo-mentor-body"
          style={{ animationDuration: `${Math.max(0.6, 1.3 / rate)}s` }}
        >
          {/* Outer optical bezel */}
          <circle
            cx="60"
            cy="60"
            r="36"
            fill={`url(#${ringGradientId})`}
            stroke={isListening ? '#60A5FA' : focusActive || isDrawing ? '#F59E0B' : '#CBD5E1'}
            strokeWidth={focusActive ? '2.1' : '1.8'}
          />

          {/* Subtle cardinal reticle ticks */}
          <path
            d="M60 21V26 M60 94V99 M21 60H26 M94 60H99"
            stroke={focusActive || isDrawing ? '#F59E0B' : '#94A3B8'}
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Directional optical bezel pointer & bead aimed directly toward target part */}
          {(focusActive || isDrawing || hasLookDir) && (
            <g
              style={{
                transformOrigin: '60px 60px',
                transform: `rotate(${focusAngleDeg.toFixed(1)}deg)`,
                transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {(focusActive || isDrawing) && (
                <polygon
                  points="99,60 92,55.5 92,64.5"
                  fill="#F59E0B"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              )}
              <circle
                cx="95.5"
                cy="60"
                r={focusActive ? '4.4' : '3.6'}
                fill="#F59E0B"
                stroke="#FFFFFF"
                strokeWidth="1.4"
              />
            </g>
          )}

          {/* Cobalt precision core */}
          <circle
            cx="60"
            cy="60"
            r="26"
            fill={`url(#${coreGradientId})`}
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="1.2"
          />

          {/* Responsive directional gaze eyes looking toward the explained part */}
          <g
            aria-hidden="true"
            style={{
              transform: `translate(${eyeOffsetX.toFixed(2)}px, ${eyeOffsetY.toFixed(2)}px)`,
              transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <ellipse cx="51" cy={isSpeaking ? '52' : '54'} rx="4.2" ry={isListening ? '4.8' : '4.3'} fill="#FFFFFF" />
            <ellipse cx="69" cy={isSpeaking ? '52' : '54'} rx="4.2" ry={isListening ? '4.8' : '4.3'} fill="#FFFFFF" />
            <circle
              cx={51 + pupilOffsetX}
              cy={(isSpeaking ? 52 : 54) + pupilOffsetY}
              r="2.1"
              fill="#0F172A"
            />
            <circle
              cx={69 + pupilOffsetX}
              cy={(isSpeaking ? 52 : 54) + pupilOffsetY}
              r="2.1"
              fill="#0F172A"
            />
            <circle cx={50.2 + pupilOffsetX * 0.6} cy={(isSpeaking ? 50.8 : 52.8) + pupilOffsetY * 0.6} r="0.8" fill="#FFFFFF" />
            <circle cx={68.2 + pupilOffsetX * 0.6} cy={(isSpeaking ? 50.8 : 52.8) + pupilOffsetY * 0.6} r="0.8" fill="#FFFFFF" />
          </g>

          {/* Active audio equalizer mouth OR crisp attentive smile curve */}
          {isSpeaking || isListening ? (
            <g aria-hidden="true">
              {bars.map((bar, index) => {
                const centerY = 70;
                const height = isSpeaking
                  ? (3.5 + bar * (4.5 + activity * 9.5)) * pitchScale
                  : 3.5 + bar * 4.5;
                return (
                  <rect
                    key={index}
                    x={47.5 + index * 6 - 1.3}
                    y={centerY - height / 2}
                    width="2.6"
                    height={Math.min(16, height)}
                    rx="1.3"
                    fill={isListening ? '#BFDBFE' : '#FFFFFF'}
                    opacity={0.82 + bar * 0.18}
                    className={isSpeaking ? 'mirvo-mentor-wave' : undefined}
                    style={isSpeaking ? { animationDelay: `${index * -0.11}s` } : undefined}
                  />
                );
              })}
            </g>
          ) : (
            <path
              d="M 52 67 Q 60 73 68 67"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          )}
        </g>
      </svg>
    </div>
  );
};
