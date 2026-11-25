import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { MirvoMentor, type UstozExpression } from './MirvoMentor';

export interface FloatingEmojiUstozProps {
  expression: UstozExpression;
  onChangeExpression: (expr: UstozExpression) => void;
  speechBubble: string;
  isSpeaking: boolean;
  voiceActivity: number;
  isListening?: boolean;
  /** Viewport coordinates where Ustoz should fly & point (e.g. active 2.5D part or clicked spot) */
  flightTarget: { x: number; y: number; side?: 'left' | 'right' } | null;
  /** When enabled, clicking anywhere on open canvas summons Ustoz to that exact point */
  clickToFlyEnabled: boolean;
  onToggleClickToFly: () => void;
}

const EXPRESSION_CHIPS: readonly { id: UstozExpression; label: string }[] = [
  { id: 'happy', label: 'Quvnoq' },
  { id: 'amazed', label: 'Hayrat' },
  { id: 'thinking', label: 'O‘ylanish' },
  { id: 'proud', label: 'Maqtov' },
  { id: 'alert', label: 'Xato' },
  { id: 'calm', label: 'Sokin' },
];

function clampPos(x: number, y: number, pad = 48): { x: number; y: number } {
  if (typeof window === 'undefined') return { x, y };
  const maxX = Math.max(pad, window.innerWidth - pad - 44);
  const maxY = Math.max(pad + 36, window.innerHeight - pad - 88);
  return {
    x: Math.max(pad, Math.min(maxX, x)),
    y: Math.max(pad + 36, Math.min(maxY, y)),
  };
}

export const FloatingEmojiUstoz: React.FC<FloatingEmojiUstozProps> = ({
  expression,
  onChangeExpression,
  speechBubble,
  isSpeaking,
  voiceActivity,
  isListening = false,
  flightTarget,
  clickToFlyEnabled,
  onToggleClickToFly,
}) => {
  const actorRef = useRef<HTMLDivElement | null>(null);
  const bobRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef<{ x: number; y: number }>({
    x: typeof window !== 'undefined' ? Math.max(80, window.innerWidth - 118) : 280,
    y: typeof window !== 'undefined' ? Math.max(140, window.innerHeight - 172) : 480,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pointingSide, setPointingSide] = useState<'left' | 'right' | null>(null);
  const dragMeta = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  // Initialize starting position & gentle GSAP zero-gravity levitation bob
  useEffect(() => {
    const el = actorRef.current;
    const bob = bobRef.current;
    if (!el || !bob) return;

    const initial = clampPos(window.innerWidth - 110, window.innerHeight - 170);
    posRef.current = initial;
    gsap.set(el, { x: initial.x, y: initial.y });

    const bobTween = gsap.to(bob, {
      y: -7,
      duration: 1.85,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    });

    const onResize = () => {
      const safe = clampPos(posRef.current.x, posRef.current.y);
      posRef.current = safe;
      gsap.to(el, { x: safe.x, y: safe.y, duration: 0.35, ease: 'power2.out' });
    };
    window.addEventListener('resize', onResize);

    return () => {
      bobTween.kill();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Fly smoothly with GSAP whenever a 2.5D part or user-selected target changes
  useEffect(() => {
    if (!flightTarget || !actorRef.current || dragging) return;
    const safe = clampPos(flightTarget.x, flightTarget.y);
    posRef.current = safe;
    setPointingSide(flightTarget.side ?? null);
    gsap.to(actorRef.current, {
      x: safe.x,
      y: safe.y,
      duration: 0.72,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  }, [flightTarget, dragging]);

  // Global click/tap-to-fly listener when free-flight mode is active
  useEffect(() => {
    if (!clickToFlyEnabled) return;
    const onGlobalPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Ignore clicks on interactive controls or Ustoz himself
      if (
        target.closest(
          'button, input, a, select, textarea, [data-ustoz-root="true"], [role="dialog"]'
        )
      ) {
        return;
      }
      if (!actorRef.current) return;
      const safe = clampPos(e.clientX - 38, e.clientY - 46);
      const side: 'left' | 'right' = e.clientX < posRef.current.x ? 'left' : 'right';
      posRef.current = safe;
      setPointingSide(side);
      gsap.to(actorRef.current, {
        x: safe.x,
        y: safe.y,
        duration: 0.68,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    };
    window.addEventListener('pointerdown', onGlobalPointerDown);
    return () => window.removeEventListener('pointerdown', onGlobalPointerDown);
  }, [clickToFlyEnabled]);

  // Subtle bounce pop when expression switches to proud or amazed
  useEffect(() => {
    if (!bobRef.current) return;
    if (expression === 'proud' || expression === 'amazed') {
      gsap.fromTo(
        bobRef.current,
        { scale: 0.88 },
        { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.45)' }
      );
    }
  }, [expression]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragMeta.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: posRef.current.x,
      origY: posRef.current.y,
      moved: false,
    };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const meta = dragMeta.current;
    if (!meta || meta.pointerId !== e.pointerId || !actorRef.current) return;
    const dx = e.clientX - meta.startX;
    const dy = e.clientY - meta.startY;
    if (Math.hypot(dx, dy) > 5) {
      meta.moved = true;
    }
    const next = clampPos(meta.origX + dx, meta.origY + dy);
    posRef.current = next;
    gsap.set(actorRef.current, { x: next.x, y: next.y });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const meta = dragMeta.current;
    if (!meta || meta.pointerId !== e.pointerId) return;
    dragMeta.current = null;
    setDragging(false);
    if (!meta.moved) {
      setMenuOpen((prev) => !prev);
    }
  };

  return (
    <div
      ref={actorRef}
      data-ustoz-root="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 48,
        touchAction: 'none',
        willChange: 'transform',
      }}
    >
      <div
        ref={bobRef}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Crisp Floating Speech Callout Bubble */}
        {speechBubble && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              right: -8,
              width: 'max-content',
              maxWidth: 230,
              padding: '7px 11px',
              borderRadius: 14,
              background: 'rgba(11, 18, 32, 0.92)',
              color: '#F8FAFC',
              border: '1px solid rgba(56, 189, 248, 0.42)',
              boxShadow: '0 10px 26px rgba(11, 18, 32, 0.28)',
              fontSize: 11.5,
              fontWeight: 600,
              lineHeight: 1.35,
              pointerEvents: 'none',
              backdropFilter: 'blur(10px)',
            }}
          >
            {speechBubble}
          </div>
        )}

        {/* Draggable & Clickable Free-Flying Emoji Ustoz */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          title="Emoji Ustoz — sudrang yoki bosing (6 mimika va erkin uchish)"
          style={{
            cursor: dragging ? 'grabbing' : 'grab',
            borderRadius: '50%',
            padding: 3,
            background: isSpeaking
              ? 'radial-gradient(circle, rgba(56,189,248,0.28) 0%, rgba(56,189,248,0) 70%)'
              : undefined,
          }}
        >
          <MirvoMentor
            size={84}
            prefer3D={true}
            isSpeaking={isSpeaking}
            isListening={isListening}
            voiceActivity={voiceActivity}
            expression={expression}
            pointingSide={pointingSide}
            focusActive={isSpeaking || expression === 'proud'}
            interactive
          />
        </div>

        {/* Compact Interactive Expression & Flight Menu (opens on click) */}
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: -6,
              width: 224,
              background: 'var(--surface)',
              color: 'var(--ink)',
              border: '1px solid var(--line-strong)',
              borderRadius: 18,
              padding: 10,
              boxShadow: '0 16px 36px rgba(11, 18, 32, 0.24)',
              zIndex: 50,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
                fontSize: 11.5,
                fontWeight: 800,
              }}
            >
              <span>Ustoz mimikasi (6 xil)</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                style={{
                  border: 'none',
                  background: 'var(--surface-2)',
                  color: 'var(--muted)',
                  borderRadius: 999,
                  padding: '2px 7px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 5,
                marginBottom: 8,
              }}
            >
              {EXPRESSION_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => onChangeExpression(chip.id)}
                  style={{
                    border: 'none',
                    borderRadius: 10,
                    padding: '6px 4px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background:
                      expression === chip.id ? 'var(--accent)' : 'var(--surface-2)',
                    color: expression === chip.id ? '#FFFFFF' : 'var(--ink)',
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onToggleClickToFly}
              style={{
                width: '100%',
                border: '1px solid var(--line-strong)',
                borderRadius: 11,
                padding: '7px 10px',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                background: clickToFlyEnabled ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: clickToFlyEnabled ? 'var(--accent)' : 'var(--ink)',
              }}
            >
              {clickToFlyEnabled
                ? '✓ Bosilgan joyga uchish: YOQIQ'
                : 'Bosilgan joyga uchish: O‘CHIQ'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
