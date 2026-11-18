import React, { useEffect, useId, useState } from 'react';
import type { EmojiEmotion, TeacherDepth, TutorPose } from '../types/tutor';

interface EmojiUstozProps {
  emotion?: EmojiEmotion;
  isSpeaking: boolean;
  isDrawing?: boolean;
  isListening?: boolean;
  isNodding?: boolean;
  mouthOpen: number; // 0..1
  size?: number; // px, default 64
  className?: string;
  tiltDeg?: number;
  lookVector?: { x: number; y: number };
  showPointer?: boolean;
  pose?: TutorPose;
  calloutNote?: string;
  depth?: TeacherDepth;
  showOrangeCompanion?: boolean;
  speechRate?: number; // 0.7..1.5
  speechPitch?: number; // 0.7..1.5
}

type IdleBehaviorState = 'bouncing' | 'blinking' | 'tilting';

const IDLE_CYCLE: IdleBehaviorState[] = ['bouncing', 'blinking', 'tilting'];

export const EmojiUstoz: React.FC<EmojiUstozProps> = ({
  emotion = 'explaining',
  isSpeaking,
  isDrawing = false,
  isListening = false,
  isNodding = false,
  mouthOpen,
  size = 64,
  className = '',
  tiltDeg = 0,
  lookVector = { x: 0, y: 0 },
  pose = 'approach',
  calloutNote,
  depth = 'mid',
  showOrangeCompanion = true,
  speechRate = 1,
  speechPitch = 1.02,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [idleIndex, setIdleIndex] = useState(0);
  const [quickBlink, setQuickBlink] = useState(false);
  const [animTime, setAnimTime] = useState(0);

  // Subtle living idle states when not speaking
  useEffect(() => {
    if (isSpeaking) return;
    const cycleTimer = window.setInterval(() => {
      setIdleIndex((idx) => (idx + 1) % IDLE_CYCLE.length);
    }, 2900);
    return () => window.clearInterval(cycleTimer);
  }, [isSpeaking]);

  // Natural blink pulses
  useEffect(() => {
    if (isSpeaking) {
      const speakBlinkInterval = window.setInterval(() => {
        setQuickBlink(true);
        window.setTimeout(() => setQuickBlink(false), 120);
      }, 3400);
      return () => window.clearInterval(speakBlinkInterval);
    }

    const currentIdle = IDLE_CYCLE[idleIndex];
    let t1: number | null = null;
    let t2: number | null = null;
    let t3: number | null = null;

    if (currentIdle === 'blinking') {
      t1 = window.setTimeout(() => setQuickBlink(true), 200);
      t2 = window.setTimeout(() => setQuickBlink(false), 350);
      t3 = window.setTimeout(() => setQuickBlink(true), 590);
      const t4 = window.setTimeout(() => setQuickBlink(false), 740);
      return () => {
        if (t1 !== null) window.clearTimeout(t1);
        if (t2 !== null) window.clearTimeout(t2);
        if (t3 !== null) window.clearTimeout(t3);
        window.clearTimeout(t4);
      };
    }

    t1 = window.setTimeout(() => setQuickBlink(true), 1250);
    t2 = window.setTimeout(() => setQuickBlink(false), 1380);
    return () => {
      if (t1 !== null) window.clearTimeout(t1);
      if (t2 !== null) window.clearTimeout(t2);
    };
  }, [isSpeaking, idleIndex]);

  // Smooth RAF loop for gentle breathing, blinking, idea spark bobbing & lip-sync
  useEffect(() => {
    let rafId = 0;
    let lastUpdate = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const interval = isDrawing || isSpeaking || isNodding || isListening ? 16 : 28;
      if (now - lastUpdate >= interval) {
        lastUpdate = now;
        setAnimTime((now - start) / 1000);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isDrawing, isSpeaking, isNodding, isListening]);

  const activeIdleState: IdleBehaviorState = IDLE_CYCLE[idleIndex];
  const isBlinking = quickBlink;
  const effectiveOpen = isSpeaking ? Math.max(0.18, mouthOpen) : 0;

  const rateFactor = Math.max(0.7, Math.min(1.5, speechRate));
  const pitchDelta = Math.max(-0.35, Math.min(0.5, speechPitch - 1.0));

  const idleBounceY =
    !isSpeaking && activeIdleState === 'bouncing'
      ? -Math.abs(Math.sin(animTime * 3.5)) * 2.8
      : Math.sin(animTime * 1.9) * 1.3;
  const idleHeadTiltDeg =
    !isSpeaking && activeIdleState === 'tilting'
      ? Math.sin(animTime * 2.0) * 3.8
      : Math.sin(animTime * 1.2) * 0.8;

  const drawBobY = isDrawing ? Math.sin(animTime * 8.2) * 1.2 : 0;
  const nodOffsetY = isNodding ? Math.sin(animTime * 5.0) * 2.0 : 0;
  const listenPulse = isListening ? 1 + 0.04 * Math.sin(animTime * 6.2) : 1;
  const speakingPulseY = isSpeaking ? Math.sin(animTime * 7.0 * rateFactor) * (0.65 + rateFactor * 0.4) : 0;

  const scaleX = (isSpeaking ? 1.014 + effectiveOpen * 0.018 - pitchDelta * 0.025 : 1) * listenPulse;
  const scaleY = (isSpeaking ? 1.014 - effectiveOpen * 0.012 + pitchDelta * 0.03 : 1) * listenPulse;
  const liftY =
    idleBounceY +
    drawBobY +
    nodOffsetY +
    speakingPulseY +
    (isSpeaking ? -0.9 - effectiveOpen * 1.3 - pitchDelta * 4.0 : 0);
  const totalTilt = Math.max(
    -8,
    Math.min(
      8,
      tiltDeg * 0.35 +
        idleHeadTiltDeg +
        (pose === 'formula_check' ? 2 : 0) +
        (isSpeaking ? Math.sin(animTime * 3.0 * rateFactor) * (1.1 * rateFactor) - pitchDelta * 3.2 : 0)
    )
  );

  // Subtle expressive eye/face gaze toward active drawing focus
  const idleGlanceX =
    !isSpeaking && activeIdleState === 'tilting' ? Math.sin(animTime * 2.0) * 1.1 : 0;
  const faceShiftX = isListening
    ? 0
    : Math.max(-3.2, Math.min(3.2, lookVector.x * 1.15 + idleGlanceX));
  const faceShiftY = isListening
    ? -0.4
    : Math.max(-2.8, Math.min(2.8, lookVector.y * 0.95 - (isSpeaking ? pitchDelta * 2.0 : 0)));

  const sparkBobY =
    Math.sin(animTime * (isSpeaking ? 3.1 * rateFactor : 2.6) + 0.6) * 2.1 -
    (isSpeaking ? pitchDelta * 3.2 : 0);
  const sparkBobX = Math.cos(animTime * (isSpeaking ? 2.0 * rateFactor : 1.8)) * 0.9;
  const sparkSpin = (Math.sin(animTime * 1.4) * 12).toFixed(1);

  const shadowAlpha = depth === 'near' ? 0.16 : depth === 'far' ? 0.09 : 0.12;
  const shadowBlur = depth === 'near' ? 14 : depth === 'far' ? 8 : 11;

  const faceGradId = `mirvo-warm-face-${uid}`;
  const capGradId = `mirvo-cobalt-cap-${uid}`;
  const amberGradId = `mirvo-warm-amber-${uid}`;

  const happyEyes = !isSpeaking && (emotion === 'happy' || isNodding) && !isBlinking && !isDrawing;

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center select-none pointer-events-none shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(0 ${depth === 'near' ? 8 : 5}px ${shadowBlur}px rgba(30, 58, 138, ${shadowAlpha}))`,
        transform: `translateY(${liftY.toFixed(1)}px) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)}) rotate(${totalTilt.toFixed(1)}deg)`,
        opacity: depth === 'far' ? 0.95 : 1,
        transition: 'opacity 260ms ease, filter 260ms ease',
      }}
      aria-label="Mirvo AI Ustoz"
    >
      {calloutNote && (
        <div className="mb-1 px-2.5 py-0.5 rounded-full bg-white/95 border border-blue-200 shadow-xs text-[10px] font-semibold text-slate-800 whitespace-nowrap leading-tight">
          {calloutNote}
        </div>
      )}

      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        <defs>
          {/* Warm porcelain-ivory face (friendly, luminous, paper-clean) */}
          <radialGradient id={faceGradId} cx="38%" cy="30%" r="72%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="68%" stopColor="#F4F8FF" />
            <stop offset="100%" stopColor="#DCE8FE" />
          </radialGradient>

          {/* Royal cobalt scholar hood/cap trim */}
          <linearGradient id={capGradId} x1="20" y1="12" x2="78" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="55%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>

          {/* Warm honey-amber crest & companion star */}
          <radialGradient id={amberGradId} cx="36%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#FEF3C7" />
            <stop offset="45%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#D97706" />
          </radialGradient>
        </defs>

        {/* Soft Scholarly Crest Glow when Listening or Speaking */}
        {(isListening || isSpeaking) && (
          <circle
            cx="48"
            cy="12"
            r={isListening ? '9.5' : '7.5'}
            fill="rgba(245, 158, 11, 0.24)"
          />
        )}

        {/* Friendly Cobalt Earphones / Side Accents (balanced studio silhouette) */}
        <rect x="8.5" y="45" width="7.5" height="19" rx="3.75" fill="#1D4ED8" />
        <rect x="80" y="45" width="7.5" height="19" rx="3.75" fill="#1D4ED8" />
        <rect x="10.2" y="48.5" width="3" height="12" rx="1.5" fill="#93C5FD" />
        <rect x="82.8" y="48.5" width="3" height="12" rx="1.5" fill="#93C5FD" />

        {/* Main Rounded Porcelain Head Silhouette (friendly squircle-oval) */}
        <rect
          x="13"
          y="22"
          width="70"
          height="66"
          rx="32"
          fill={`url(#${faceGradId})`}
          stroke="#BFD3FA"
          strokeWidth="1.6"
        />

        {/* Scholarly Cobalt Crown Band + Warm Amber Idea Lamp */}
        <path
          d="M 19 37 C 25 20.5, 71 20.5, 77 37 C 66 30.5, 30 30.5, 19 37 Z"
          fill={`url(#${capGradId})`}
        />
        <line
          x1="48"
          y1="23"
          x2="48"
          y2="15"
          stroke="#1D4ED8"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle
          cx="48"
          cy="12"
          r={isListening ? '4.8' : '4.2'}
          fill={`url(#${amberGradId})`}
          stroke="#FFFFFF"
          strokeWidth="1.2"
        />

        {/* Expressive Warm Facial Features */}
        <g transform={`translate(${faceShiftX.toFixed(2)}, ${faceShiftY.toFixed(2)})`}>
          {/* Soft Rosy-Peach Cheeks */}
          <ellipse cx="26.5" cy="60.5" rx="5.2" ry="3.1" fill="#FDA4AF" opacity="0.52" />
          <ellipse cx="69.5" cy="60.5" rx="5.2" ry="3.1" fill="#FDA4AF" opacity="0.52" />

          {/* Signature Round Teacher Glasses */}
          <g>
            <circle
              cx="35.5"
              cy="51"
              r="11.2"
              fill="rgba(219, 234, 254, 0.28)"
              stroke="#1E3A8A"
              strokeWidth="2.1"
            />
            <circle
              cx="60.5"
              cy="51"
              r="11.2"
              fill="rgba(219, 234, 254, 0.28)"
              stroke="#1E3A8A"
              strokeWidth="2.1"
            />
            {/* Thin Bridge + Subtle Temple Hints */}
            <path
              d="M 46.6 50.6 Q 48 48.8 49.4 50.6"
              fill="none"
              stroke="#1E3A8A"
              strokeWidth="2.1"
              strokeLinecap="round"
            />
            <line x1="21" y1="50" x2="24.4" y2="50.5" stroke="#1E3A8A" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="71.6" y1="50.5" x2="75" y2="50" stroke="#1E3A8A" strokeWidth="1.8" strokeLinecap="round" />
          </g>

          {/* Subtle Expressive Eyebrows */}
          {emotion === 'thinking' && !isBlinking && !happyEyes && (
            <g fill="none" stroke="#1E293B" strokeWidth="2.0" strokeLinecap="round">
              <path d="M 30 37.5 Q 35.5 36.2 41 37.5" />
              <path d="M 55 36.2 Q 60.5 33.4 66 36.2" />
            </g>
          )}

          {/* Warm Soulful Eyes Inside Glasses */}
          {isBlinking ? (
            <g fill="none" stroke="#0F172A" strokeWidth="2.6" strokeLinecap="round">
              <path d="M 30.5 51.2 Q 35.5 54.4 40.5 51.2" />
              <path d="M 55.5 51.2 Q 60.5 54.4 65.5 51.2" />
            </g>
          ) : happyEyes ? (
            <g fill="none" stroke="#0F172A" strokeWidth="2.7" strokeLinecap="round">
              <path d="M 30.2 52.2 Q 35.5 46.4 40.8 52.2" />
              <path d="M 55.2 52.2 Q 60.5 46.4 65.8 52.2" />
            </g>
          ) : (
            <g>
              <ellipse
                cx="35.5"
                cy="51"
                rx={emotion === 'surprised' ? 4.8 : 4.4}
                ry={emotion === 'surprised' ? 5.6 : 5.0}
                fill="#0F172A"
              />
              <ellipse
                cx="60.5"
                cy="51"
                rx={emotion === 'surprised' ? 4.8 : 4.4}
                ry={emotion === 'surprised' ? 5.6 : 5.0}
                fill="#0F172A"
              />
              {/* Crisp Dual Catchlights for Warm Lifelike Expression */}
              <circle cx="37.0" cy="48.8" r="1.65" fill="#FFFFFF" />
              <circle cx="62.0" cy="48.8" r="1.65" fill="#FFFFFF" />
              <circle cx="33.8" cy="52.8" r="0.8" fill="rgba(255, 255, 255, 0.72)" />
              <circle cx="58.8" cy="52.8" r="0.8" fill="rgba(255, 255, 255, 0.72)" />
            </g>
          )}

          {/* Expressive Friendly Mouth */}
          {isSpeaking ? (
            <g>
              <rect
                x={48 - (4.8 + effectiveOpen * 1.3 - pitchDelta * 1.2)}
                y={65.8 - effectiveOpen * 0.5 - pitchDelta * 0.9}
                width={Math.max(6.8, (4.8 + effectiveOpen * 1.3 - pitchDelta * 1.2) * 2)}
                height={Math.max(3.6, 3.8 + effectiveOpen * (6.2 + pitchDelta * 2.0))}
                rx={3.4}
                fill="#1E293B"
              />
              {effectiveOpen > 0.25 && (
                <ellipse
                  cx="48"
                  cy={67.8 + effectiveOpen * 1.6}
                  rx="3.0"
                  ry="1.6"
                  fill="#FB7185"
                />
              )}
            </g>
          ) : emotion === 'surprised' ? (
            <ellipse cx="48" cy="68.5" rx="3.4" ry="4.0" fill="#1E293B" />
          ) : emotion === 'thinking' ? (
            <path
              d="M 43 68.5 Q 48 66.8 53 68.5"
              fill="none"
              stroke="#1E293B"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          ) : (
            <path
              d={`M 41 66.4 Q 48 ${
                !isSpeaking && activeIdleState === 'bouncing' ? 73.2 : 71.8
              } 55 66.4`}
              fill="none"
              stroke="#1E293B"
              strokeWidth="2.7"
              strokeLinecap="round"
            />
          )}
        </g>

        {/* Warm Floating Idea-Spark Companion */}
        {showOrangeCompanion && (
          <g transform={`translate(${sparkBobX.toFixed(2)}, ${sparkBobY.toFixed(2)})`}>
            <circle cx="87" cy="17" r="10.5" fill="rgba(245, 158, 11, 0.16)" />
            <g transform={`rotate(${sparkSpin} 87 17)`}>
              <path
                d="M 87 9.8 L 89.3 14.7 L 94.2 17 L 89.3 19.3 L 87 24.2 L 84.7 19.3 L 79.8 17 L 84.7 14.7 Z"
                fill={`url(#${amberGradId})`}
                stroke="#FFFFFF"
                strokeWidth="0.9"
              />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};
