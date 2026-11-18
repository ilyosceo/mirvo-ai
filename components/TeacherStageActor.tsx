import React, { useEffect, useId, useRef, useState } from 'react';
import type { LessonBeat, LessonStep, StageAnchorsMap } from '../types/tutor';
import { computeBeatPlacement } from '../lib/teacherChoreography';
import { EmojiUstoz } from './EmojiUstoz';

interface TeacherStageActorProps {
  step: LessonStep;
  activeBeat: LessonBeat;
  anchors: StageAnchorsMap;
  isSpeaking: boolean;
  isPlaying?: boolean;
  isListening: boolean;
  mouthOpen: number;
}

export const TeacherStageActor: React.FC<TeacherStageActorProps> = ({
  step,
  activeBeat,
  anchors,
  isSpeaking,
  isPlaying = false,
  isListening,
  mouthOpen,
}) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const gradId = useId().replace(/:/g, '');
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: 720,
    height: 520,
  });
  const [isMobileStacked, setIsMobileStacked] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const onChange = () => setIsMobileStacked(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        setStageSize((prev) =>
          prev.width === w && prev.height === h ? prev : { width: w, height: h }
        );
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isCompact = stageSize.width < 520 || stageSize.height < 300;
  const sphereSize = isCompact ? 46 : 54;
  const mentorRadius = sphereSize / 2;

  const placement = computeBeatPlacement({
    beat: activeBeat,
    anchors,
    stageSize,
    isMobileStacked,
  });

  const isDrawingNow = isPlaying && activeBeat.tutor_pose !== 'step_back';
  const isDrawingTip = isDrawingNow && activeBeat.focus_target === 'drawing_tip';
  const showFocusedLaser =
    placement.pose === 'approach' &&
    placement.showPointer &&
    !isDrawingTip;

  // Start the laser ray cleanly from the mentor sphere's facing outer perimeter (with 4px gap)
  const dx = placement.targetX - placement.emojiX;
  const dy = placement.targetY - placement.emojiY;
  const dist = Math.hypot(dx, dy) || 1;
  const startOffset = Math.min(dist * 0.45, mentorRadius + 4);
  const laserX1 = placement.emojiX + (dx / dist) * startOffset;
  const laserY1 = placement.emojiY + (dy / dist) * startOffset;

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
    >
      {/* Synchronized Laser Pointer Ray + Target Pulse on Macro-to-Micro Focus / Tip Drawing */}
      {(isDrawingTip || showFocusedLaser) && (
        <svg className="absolute inset-0 w-full h-full overflow-visible">
          <defs>
            <linearGradient
              id={`laser-${gradId}`}
              x1={laserX1}
              y1={laserY1}
              x2={placement.targetX}
              y2={placement.targetY}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="rgba(37, 99, 235, 0.22)" />
              <stop offset="55%" stopColor="rgba(37, 99, 235, 0.78)" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>

          {showFocusedLaser && dist > mentorRadius + 18 && (
            <>
              <line
                x1={laserX1}
                y1={laserY1}
                x2={placement.targetX}
                y2={placement.targetY}
                stroke={`url(#laser-${gradId})`}
                strokeWidth="3.8"
                strokeLinecap="round"
                opacity="0.34"
              />
              <line
                x1={laserX1}
                y1={laserY1}
                x2={placement.targetX}
                y2={placement.targetY}
                stroke={`url(#laser-${gradId})`}
                strokeWidth="1.9"
                strokeDasharray="6 4"
                strokeLinecap="round"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  values="20;0"
                  dur="1.1s"
                  repeatCount="indefinite"
                />
              </line>
            </>
          )}

          <circle
            cx={placement.targetX}
            cy={placement.targetY}
            r={isDrawingTip ? '12' : '11'}
            fill={isDrawingTip ? 'rgba(37, 99, 235, 0.24)' : 'rgba(245, 158, 11, 0.22)'}
          >
            <animate
              attributeName="r"
              values={isDrawingTip ? '9;15;9' : '8;14;8'}
              dur={isDrawingTip ? '0.9s' : '1.4s'}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.88;0.28;0.88"
              dur={isDrawingTip ? '0.9s' : '1.4s'}
              repeatCount="indefinite"
            />
          </circle>

          <circle
            cx={placement.targetX}
            cy={placement.targetY}
            r={isDrawingTip ? '5.4' : '4.8'}
            fill="#F59E0B"
            stroke="#FFFFFF"
            strokeWidth="1.6"
          />
        </svg>
      )}

      {/* Glossy Sphere Mascot Gliding Alongside Zoomed Detail or Drawing Tip */}
      <div
        className="pointer-events-none absolute left-0 top-0"
        style={{
          transform: `translate3d(${placement.emojiX.toFixed(1)}px, ${placement.emojiY.toFixed(
            1
          )}px, 0) translate(-50%, -50%) scale(${(
            placement.scale *
            (activeBeat.camera_zoom
              ? Math.min(1.12, Math.max(0.86, 1 + (activeBeat.camera_zoom - 1) * 0.14))
              : 1)
          ).toFixed(3)})`,
          transition:
            activeBeat.focus_target === 'drawing_tip' && !activeBeat.focusPart
              ? 'transform 110ms linear'
              : activeBeat.tutor_pose === 'formula_check'
              ? 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)'
              : activeBeat.tutor_pose === 'step_back'
              ? 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)'
              : 'transform 0.68s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <EmojiUstoz
          emotion={step.emoji_emotion}
          isSpeaking={isSpeaking}
          isDrawing={isDrawingNow}
          isListening={isListening}
          isNodding={placement.isNodding}
          mouthOpen={mouthOpen}
          size={sphereSize}
          tiltDeg={placement.tiltDeg}
          lookVector={placement.lookVector}
          showPointer={placement.showPointer}
          pose={placement.pose}
          depth={placement.depth}
          showOrangeCompanion={!isDrawingTip}
        />
      </div>
    </div>
  );
};
