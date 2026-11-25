import React, { useEffect, useId, useRef, useState } from 'react';
import type { TeacherDepth, TutorPose } from '../types/tutor';

export type UstozExpression = 'happy' | 'amazed' | 'thinking' | 'proud' | 'alert' | 'calm';

export interface MirvoMentorProps {
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
  interactive?: boolean;
  expression?: UstozExpression;
  pointingSide?: 'left' | 'right' | null;
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
  size = 76,
  className = '',
  tiltDeg = 0,
  pose = 'approach',
  calloutNote,
  depth = 'mid',
  speechPitch = 1,
  lookVector,
  focusActive = false,
  interactive = false,
  expression = 'happy',
  pointingSide = null,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const faceGradId = `ustoz-face-${uid}`;
  const rimGradId = `ustoz-rim-${uid}`;
  const irisGradId = `ustoz-iris-${uid}`;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [cursorGaze, setCursorGaze] = useState<{
    active: boolean;
    leftX: number;
    leftY: number;
    rightX: number;
    rightY: number;
    faceShiftX: number;
    faceShiftY: number;
    headTilt: number;
  }>({
    active: false,
    leftX: 0,
    leftY: 0,
    rightX: 0,
    rightY: 0,
    faceShiftX: 0,
    faceShiftY: 0,
    headTilt: 0,
  });

  const [isBlinking, setIsBlinking] = useState(false);

  // Real-time mouse / pointer eye-tracking across the entire viewport
  useEffect(() => {
    let rafId = 0;
    let lastClientX = 0;
    let lastClientY = 0;

    const updateEyesFromPoint = (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const centerX = rect.left + rect.width * 0.5;
      const centerY = rect.top + rect.height * 0.52;

      // Left eye center & Right eye center in viewport coords
      const leftEyeX = rect.left + rect.width * (40 / 112);
      const rightEyeX = rect.left + rect.width * (72 / 112);
      const eyeY = rect.top + rect.height * (56 / 112);

      const computeEyeOffset = (ex: number, ey: number, maxRadius: number) => {
        const dx = clientX - ex;
        const dy = clientY - ey;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) return { x: 0, y: 0 };
        const factor = Math.min(1, dist / 180) * maxRadius;
        return {
          x: (dx / dist) * factor,
          y: (dy / dist) * factor,
        };
      };

      const left = computeEyeOffset(leftEyeX, eyeY, 5.2);
      const right = computeEyeOffset(rightEyeX, eyeY, 5.2);
      const face = computeEyeOffset(centerX, centerY, 2.8);
      const headTilt = clampVal(((clientX - centerX) / 420) * 6, -6, 6);

      setCursorGaze({
        active: true,
        leftX: left.x,
        leftY: left.y,
        rightX: right.x,
        rightY: right.y,
        faceShiftX: face.x,
        faceShiftY: face.y,
        headTilt,
      });
    };

    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateEyesFromPoint(lastClientX, lastClientY);
      });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('mousemove', handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('mousemove', handlePointerMove);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  // Natural periodic blink
  useEffect(() => {
    const interval = window.setInterval(() => {
      setIsBlinking(true);
      window.setTimeout(() => setIsBlinking(false), 130);
    }, 3900);
    return () => window.clearInterval(interval);
  }, []);

  const fallbackLx = clampVal(lookVector?.x ?? 0, -2.5, 2.5);
  const fallbackLy = clampVal(lookVector?.y ?? 0, -2.5, 2.5);

  const leftOffsetX = cursorGaze.active ? cursorGaze.leftX : clampVal(fallbackLx * 2.1, -5, 5);
  const leftOffsetY = cursorGaze.active ? cursorGaze.leftY : clampVal(fallbackLy * 2.0, -4.6, 4.6);
  const rightOffsetX = cursorGaze.active ? cursorGaze.rightX : clampVal(fallbackLx * 2.1, -5, 5);
  const rightOffsetY = cursorGaze.active ? cursorGaze.rightY : clampVal(fallbackLy * 2.0, -4.6, 4.6);
  const faceX = cursorGaze.active ? cursorGaze.faceShiftX : clampVal(fallbackLx * 1.1, -2.5, 2.5);
  const faceY = cursorGaze.active ? cursorGaze.faceShiftY : clampVal(fallbackLy * 1.0, -2.2, 2.2);

  const activity = Math.max(0, Math.min(1, voiceActivity));
  const pitchScale = Math.max(0.8, Math.min(1.25, speechPitch));
  const combinedTilt = tiltDeg + (cursorGaze.active ? cursorGaze.headTilt : 0);
  const shadowAlpha = depth === 'near' ? 0.22 : depth === 'far' ? 0.12 : 0.17;
  const mouthHeight = isSpeaking ? clampVal((4 + activity * 11) * pitchScale, 4, 14) : 4;

  return (
    <div
      ref={rootRef}
      className={`relative inline-flex flex-col items-center justify-center select-none ${
        interactive ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
      } shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(0 8px 18px rgba(17, 24, 39, ${shadowAlpha}))`,
        transform: `translateY(${isNodding ? -3 : 0}px) rotate(${combinedTilt.toFixed(1)}deg)`,
        transition: 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      role="img"
      aria-label="Mirvo Emoji Ustoz — ko‘zi bilan sichqonchani kuzatuvchi ustoz"
      data-pose={pose}
    >
      {calloutNote && (
        <div
          className={`mb-1.5 px-2.5 py-0.5 rounded-full backdrop-blur-md shadow-xs text-[10px] font-mono-tabular font-semibold whitespace-nowrap leading-tight transition-colors ${
            focusActive || isSpeaking
              ? 'bg-[#111827] border border-amber-400/90 text-amber-300'
              : 'bg-white/95 border border-black/15 text-[#111827]'
          }`}
        >
          {calloutNote}
        </div>
      )}

      <svg viewBox="0 0 112 112" className="w-full h-full overflow-visible" aria-hidden="true">
        <defs>
          <radialGradient id={faceGradId} cx="42%" cy="34%" r="64%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="52%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#D97706" />
          </radialGradient>
          <linearGradient id={rimGradId} x1="16" y1="16" x2="96" y2="96" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFBEB" />
            <stop offset="100%" stopColor="#FDE68A" />
          </linearGradient>
          <radialGradient id={irisGradId} cx="38%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="65%" stopColor="#1D4ED8" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </radialGradient>
        </defs>

        {/* Active speaking / listening pulse ring */}
        {(isSpeaking || isListening || focusActive || isDrawing) && (
          <circle
            cx="56"
            cy="58"
            r="50"
            fill="none"
            stroke={isListening ? '#3B82F6' : '#F59E0B'}
            strokeWidth="2"
            strokeDasharray="5 4"
            opacity="0.85"
            className="mirvo-mentor-halo"
          />
        )}

        {/* Warm Emoji Body Outer Rim + 2.5D Golden Sphere */}
        <circle
          cx="56"
          cy="58"
          r="44"
          fill={`url(#${rimGradId})`}
          stroke="#B45309"
          strokeWidth="2.2"
        />
        <circle
          cx="56"
          cy="58"
          r="40"
          fill={`url(#${faceGradId})`}
        />

        {/* Top Specular Gloss Highlight */}
        <ellipse
          cx="45"
          cy="36"
          rx="18"
          ry="8.5"
          fill="#FFFBEB"
          opacity="0.45"
          transform="rotate(-12 45 36)"
        />

        {/* Academic Mortarboard Cap (Ustoz Toji) */}
        <g
          style={{
            transform: `translate(${(faceX * 0.45).toFixed(2)}px, ${(faceY * 0.35).toFixed(2)}px)`,
          }}
        >
          <path
            d="M20 22 L56 8 L92 22 L56 34 Z"
            fill="#111827"
            stroke="#374151"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M38 29 C38 29 46 34 56 34 C66 34 74 29 74 29 L74 35 C74 35 66 39 56 39 C46 39 38 35 38 35 Z"
            fill="#1F2937"
          />
          {/* Golden Tassel */}
          <path
            d="M56 20 L83 25 L83 41"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="83" cy="42.5" r="3.4" fill="#F59E0B" stroke="#111827" strokeWidth="1" />
        </g>

        {/* Face features group with subtle 2.5D parallax shift toward cursor */}
        <g
          style={{
            transform: `translate(${faceX.toFixed(2)}px, ${faceY.toFixed(2)}px)`,
          }}
        >
          {/* Warm Rosy Cheeks */}
          <ellipse cx="27" cy="69" rx="6.5" ry="3.8" fill="#EA580C" opacity="0.34" />
          <ellipse cx="85" cy="69" rx="6.5" ry="3.8" fill="#EA580C" opacity="0.34" />

          {/* Expressive Eyebrows adapting to all 6 emotions */}
          {expression === 'alert' ? (
            <>
              <path d="M 28 38 L 49 44" fill="none" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
              <path d="M 84 38 L 63 44" fill="none" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
            </>
          ) : expression === 'thinking' ? (
            <>
              <path d="M 29 42 Q 40 40 49 42" fill="none" stroke="#78350F" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M 63 39 Q 73 32 84 37" fill="none" stroke="#78350F" strokeWidth="2.8" strokeLinecap="round" />
            </>
          ) : expression === 'amazed' ? (
            <>
              <path d="M 28 37 Q 39 29 50 37" fill="none" stroke="#78350F" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M 62 37 Q 73 29 84 37" fill="none" stroke="#78350F" strokeWidth="2.8" strokeLinecap="round" />
            </>
          ) : (
            <>
              <path
                d={`M 29 ${41 + leftOffsetY * 0.35 - (isSpeaking ? 1.8 : 0)} Q 40 ${
                  36 + leftOffsetY * 0.35 - (isSpeaking ? 2.5 : 0)
                } 49 ${41 + leftOffsetY * 0.35}`}
                fill="none"
                stroke="#78350F"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
              <path
                d={`M 63 ${41 + rightOffsetY * 0.35} Q 72 ${
                  36 + rightOffsetY * 0.35 - (isSpeaking ? 2.5 : 0)
                } 83 ${41 + rightOffsetY * 0.35 - (isSpeaking ? 1.8 : 0)}`}
                fill="none"
                stroke="#78350F"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </>
          )}

          {/* LEFT EYE SOCKET + GLASSES FRAME */}
          <circle
            cx="40"
            cy="56"
            r="13.2"
            fill="#FFFFFF"
            stroke="#111827"
            strokeWidth="2.8"
          />

          {/* RIGHT EYE SOCKET + GLASSES FRAME */}
          <circle
            cx="72"
            cy="56"
            r="13.2"
            fill="#FFFFFF"
            stroke="#111827"
            strokeWidth="2.8"
          />

          {/* Glasses Bridge & Side Temples */}
          <path
            d="M 53.2 55.5 Q 56 53 58.8 55.5"
            fill="none"
            stroke="#111827"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path d="M 19 53 L 26.8 55" stroke="#111827" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M 85.2 55 L 93 53" stroke="#111827" strokeWidth="2.4" strokeLinecap="round" />

          {expression === 'proud' ? (
            <>
              {/* Joyful proud smiling arc eyes ^ ^ */}
              <path d="M 31 58 Q 40 48 49 58" fill="none" stroke="#111827" strokeWidth="3.2" strokeLinecap="round" />
              <path d="M 63 58 Q 72 48 81 58" fill="none" stroke="#111827" strokeWidth="3.2" strokeLinecap="round" />
            </>
          ) : isBlinking ? (
            <>
              <path
                d="M 30 56 Q 40 60 50 56"
                fill="none"
                stroke="#111827"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              <path
                d="M 62 56 Q 72 60 82 56"
                fill="none"
                stroke="#111827"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              {/* LEFT IRIS + PUPIL + CATCHLIGHT (Follows Mouse Cursor!) */}
              <g
                style={{
                  transform: `translate(${leftOffsetX.toFixed(2)}px, ${leftOffsetY.toFixed(2)}px)`,
                }}
              >
                <circle
                  cx="40"
                  cy="56"
                  r={expression === 'amazed' ? 7.8 : 6.6}
                  fill={`url(#${irisGradId})`}
                />
                <circle cx="40" cy="56" r={expression === 'amazed' ? 4.3 : 3.6} fill="#090D16" />
                <circle cx="37.8" cy="53.6" r="2.2" fill="#FFFFFF" />
                <circle cx="42.1" cy="58.2" r="1.0" fill="#FFFFFF" opacity="0.82" />
              </g>

              {/* RIGHT IRIS + PUPIL + CATCHLIGHT (Follows Mouse Cursor!) */}
              <g
                style={{
                  transform: `translate(${rightOffsetX.toFixed(2)}px, ${rightOffsetY.toFixed(2)}px)`,
                }}
              >
                <circle
                  cx="72"
                  cy="56"
                  r={expression === 'amazed' ? 7.8 : 6.6}
                  fill={`url(#${irisGradId})`}
                />
                <circle cx="72" cy="56" r={expression === 'amazed' ? 4.3 : 3.6} fill="#090D16" />
                <circle cx="69.8" cy="53.6" r="2.2" fill="#FFFFFF" />
                <circle cx="74.1" cy="58.2" r="1.0" fill="#FFFFFF" opacity="0.82" />
              </g>

              {/* Calm relaxed half-eyelids */}
              {expression === 'calm' && (
                <>
                  <path d="M 27.5 52 Q 40 55 52.5 52" fill="#FBBF24" stroke="#111827" strokeWidth="1.6" />
                  <path d="M 59.5 52 Q 72 55 84.5 52" fill="#FBBF24" stroke="#111827" strokeWidth="1.6" />
                </>
              )}
            </>
          )}

          {/* EXPRESSIVE MOUTH: Lip-Sync when speaking + 6 distinct emotional poses */}
          {isSpeaking ? (
            <g>
              <rect
                x="44"
                y={77 - mouthHeight * 0.45}
                width="24"
                height={mouthHeight}
                rx={Math.min(7, mouthHeight * 0.5)}
                fill="#7C2D12"
                stroke="#111827"
                strokeWidth="2"
              />
              {mouthHeight > 6.5 && (
                <path
                  d={`M 49 ${77 + mouthHeight * 0.28} Q 56 ${75 + mouthHeight * 0.05} 63 ${
                    77 + mouthHeight * 0.28
                  }`}
                  fill="#F97316"
                />
              )}
            </g>
          ) : isListening || expression === 'amazed' ? (
            <ellipse
              cx="56"
              cy="78"
              rx="6.2"
              ry="7.2"
              fill="#7C2D12"
              stroke="#111827"
              strokeWidth="2.2"
            />
          ) : expression === 'proud' ? (
            <path
              d="M 40 73 Q 56 89 72 73 Z"
              fill="#7C2D12"
              stroke="#111827"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
          ) : expression === 'thinking' ? (
            <path
              d="M 46 78 Q 55 75 64 79"
              fill="none"
              stroke="#111827"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ) : expression === 'alert' ? (
            <path
              d="M 44 81 Q 50 75 56 80 T 68 79"
              fill="none"
              stroke="#991B1B"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ) : expression === 'calm' ? (
            <path
              d="M 45 76 Q 56 81 67 76"
              fill="none"
              stroke="#111827"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M 43 75 Q 56 84 69 75"
              fill="none"
              stroke="#111827"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          )}
        </g>

        {/* Emotion Micro-Props (Sparkles / Thought ? / Alert !) */}
        {(expression === 'proud' || expression === 'amazed') && (
          <g>
            <path
              d="M 96 20 L 99 26 L 105 29 L 99 32 L 96 38 L 93 32 L 87 29 L 93 26 Z"
              fill="#FACC15"
            />
            <circle cx="16" cy="34" r="3.2" fill="#38BDF8" />
          </g>
        )}
        {expression === 'thinking' && (
          <g>
            <circle cx="96" cy="24" r="10" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.6" />
            <text x="96" y="28.5" textAnchor="middle" fill="#38BDF8" fontSize="13" fontWeight="900">
              ?
            </text>
          </g>
        )}
        {expression === 'alert' && (
          <g>
            <circle cx="96" cy="24" r="10" fill="#DC2626" stroke="#FEF08A" strokeWidth="1.6" />
            <text x="96" y="28.5" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="900">
              !
            </text>
          </g>
        )}

        {/* Animated Pointing Hand when pointing directly at a 2.5D part */}
        {pointingSide && (
          <g
            transform={
              pointingSide === 'left' ? 'translate(-14, 62)' : 'translate(92, 62) scale(-1, 1)'
            }
          >
            <rect
              x="0"
              y="6"
              width="20"
              height="9"
              rx="4.5"
              fill="#FEF08A"
              stroke="#B45309"
              strokeWidth="1.8"
            />
            <circle cx="2" cy="10.5" r="3" fill="#38BDF8" />
          </g>
        )}
      </svg>
    </div>
  );
};
