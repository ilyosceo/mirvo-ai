import React from 'react';
import type { FlowType } from '../../types/tutor';

export interface FlowPathSpec {
  id: string;
  d: string;
  color?: string;
  dotColor?: string;
  kind?: 'wire' | 'flux' | 'wave';
  opacity?: number;
  strokeWidth?: number;
  reverse?: boolean;
  dashPeriod?: number;
  dotRadius?: number;
}

interface SvgFlowOverlayProps {
  paths: FlowPathSpec[];
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
  isPlaying: boolean;
}

export function clampFlowSpeed(speed?: number): number {
  if (typeof speed !== 'number' || !Number.isFinite(speed)) return 1.0;
  return Math.max(0.5, Math.min(2.5, speed));
}

/**
 * Converts basic SVG geometry elements into clean path `d` strings
 * in their local coordinate system for CSS `offset-path` & dashed flow overlays.
 */
export function svgElementToPathD(el: SVGGeometryElement): string | null {
  const tag = el.tagName.toLowerCase();
  if (tag === 'path') {
    const d = el.getAttribute('d')?.trim();
    return d || null;
  }
  if (tag === 'line') {
    const x1 = Number(el.getAttribute('x1') ?? 0);
    const y1 = Number(el.getAttribute('y1') ?? 0);
    const x2 = Number(el.getAttribute('x2') ?? 0);
    const y2 = Number(el.getAttribute('y2') ?? 0);
    if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  if (tag === 'rect') {
    const x = Number(el.getAttribute('x') ?? 0);
    const y = Number(el.getAttribute('y') ?? 0);
    const w = Number(el.getAttribute('width') ?? 0);
    const h = Number(el.getAttribute('height') ?? 0);
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
    return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  }
  if (tag === 'circle') {
    const cx = Number(el.getAttribute('cx') ?? 0);
    const cy = Number(el.getAttribute('cy') ?? 0);
    const r = Number(el.getAttribute('r') ?? 0);
    if (![cx, cy, r].every(Number.isFinite) || r <= 0) return null;
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
  }
  if (tag === 'ellipse') {
    const cx = Number(el.getAttribute('cx') ?? 0);
    const cy = Number(el.getAttribute('cy') ?? 0);
    const rx = Number(el.getAttribute('rx') ?? 0);
    const ry = Number(el.getAttribute('ry') ?? 0);
    if (![cx, cy, rx, ry].every(Number.isFinite) || rx <= 0 || ry <= 0) return null;
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
  }
  if (tag === 'polyline' || tag === 'polygon') {
    const rawPts = (el.getAttribute('points') || '').trim();
    if (!rawPts) return null;
    const nums = rawPts
      .split(/[\s,]+/)
      .map(Number)
      .filter(Number.isFinite);
    if (nums.length < 4) return null;
    const cmds: string[] = [`M ${nums[0]} ${nums[1]}`];
    for (let i = 2; i + 1 < nums.length; i += 2) {
      cmds.push(`L ${nums[i]} ${nums[i + 1]}`);
    }
    if (tag === 'polygon') cmds.push('Z');
    return cmds.join(' ');
  }
  return null;
}

/**
 * Pure GPU/CSS 60 FPS Flow Animation Layer for 2D SVG stages.
 * Zero per-frame React state updates; pauses calmly when `isPlaying === false`.
 */
export const SvgFlowOverlay: React.FC<SvgFlowOverlayProps> = ({
  paths,
  flowType = 'none',
  flowSpeed = 1.0,
  flowReverse = false,
  isPlaying,
}) => {
  if (!flowType || flowType === 'none' || paths.length === 0) {
    return null;
  }

  const speed = clampFlowSpeed(flowSpeed);
  const playState: 'running' | 'paused' = isPlaying ? 'running' : 'paused';
  const dcDurationSec = Number((2.2 / speed).toFixed(3));
  const acDurationSec = Number((1.9 / speed).toFixed(3));
  const pulseDurationSec = Number((1.7 / speed).toFixed(3));

  return (
    <g className="pointer-events-none" data-flow-type={flowType} data-flow-playing={isPlaying ? '1' : '0'}>
      {paths.map((spec) => {
        const effectiveReverse = spec.reverse ?? flowReverse;
        const baseColor =
          spec.color ||
          (spec.kind === 'flux'
            ? '#8B5CF6'
            : flowType === 'ac'
            ? '#F59E0B'
            : flowType === 'pulse'
            ? '#0EA5E9'
            : '#06B6D4');
        const dotFill =
          spec.dotColor ||
          (spec.kind === 'flux' ? '#A78BFA' : flowType === 'ac' ? '#FBBF24' : '#38BDF8');
        const groupOpacity = spec.opacity ?? 1;
        const sw = spec.strokeWidth ?? (spec.kind === 'flux' ? 2.4 : 2.6);
        const dotR = spec.dotRadius ?? 3.1;

        if (flowType === 'ac') {
          if (spec.kind === 'flux') {
            return (
              <g
                key={spec.id}
                style={{
                  opacity: groupOpacity,
                  transition: 'opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {/* Glowing outer magnetic flux aura pulsing in AC rhythm */}
                <path
                  d={spec.d}
                  fill="none"
                  stroke={baseColor}
                  strokeWidth={sw * 2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="qalam-flux-glow"
                  style={
                    {
                      '--qalam-flow-dur': `${acDurationSec}s`,
                      animationPlayState: playState,
                    } as React.CSSProperties
                  }
                />
                {/* Crisp alternating magnetic flux dashes */}
                <path
                  d={spec.d}
                  fill="none"
                  stroke="#DDD6FE"
                  strokeWidth={sw * 1.05}
                  strokeDasharray="6 5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="qalam-flow-ac-dash"
                  style={
                    {
                      '--qalam-flow-dur': `${acDurationSec}s`,
                      animationDirection: effectiveReverse ? 'reverse' : 'normal',
                      animationPlayState: playState,
                    } as React.CSSProperties
                  }
                />
              </g>
            );
          }

          const phaseDelay = effectiveReverse ? `-${(acDurationSec * 0.5).toFixed(3)}s` : '0s';
          return (
            <g
              key={spec.id}
              style={{
                opacity: groupOpacity,
                transition: 'opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <path
                d={spec.d}
                fill="none"
                stroke={baseColor}
                strokeWidth={sw}
                strokeDasharray="5 4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.78}
                className="qalam-flow-ac-dash"
                style={
                  {
                    '--qalam-flow-dur': `${acDurationSec}s`,
                    animationDirection: effectiveReverse ? 'reverse' : 'normal',
                    animationPlayState: playState,
                  } as React.CSSProperties
                }
              />
              {(['qalam-flow-dot-ac-0', 'qalam-flow-dot-ac-1', 'qalam-flow-dot-ac-2'] as const).map(
                (cls, idx) => (
                  <circle
                    key={`${spec.id}-ac-dot-${idx}`}
                    cx="0"
                    cy="0"
                    r={dotR}
                    fill={dotFill}
                    stroke="#FFFFFF"
                    strokeWidth={Math.max(0.8, dotR * 0.36)}
                    className={cls}
                    style={
                      {
                        offsetPath: `path("${spec.d}")`,
                        offsetRotate: '0deg',
                        '--qalam-flow-dur': `${acDurationSec}s`,
                        animationDelay: phaseDelay,
                        animationPlayState: playState,
                      } as React.CSSProperties
                    }
                  />
                )
              )}
            </g>
          );
        }

        if (flowType === 'pulse') {
          const dashP = spec.dashPeriod ?? 32;
          return (
            <g
              key={spec.id}
              style={{
                opacity: groupOpacity,
                transition: 'opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <path
                d={spec.d}
                fill="none"
                stroke={baseColor}
                strokeWidth={sw}
                strokeDasharray="10 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="qalam-flow-dash qalam-flow-pulse-wave"
                style={
                  {
                    '--qalam-flow-dur': `${pulseDurationSec}s`,
                    '--qalam-dash-period': `${dashP}`,
                    animationDirection: effectiveReverse ? 'reverse' : 'normal',
                    animationPlayState: playState,
                  } as React.CSSProperties
                }
              />
              {[0, 1, 2].map((idx) => (
                <circle
                  key={`${spec.id}-pulse-dot-${idx}`}
                  cx="0"
                  cy="0"
                  r={dotR}
                  fill={dotFill}
                  stroke="#FFFFFF"
                  strokeWidth={Math.max(0.8, dotR * 0.35)}
                  className="qalam-flow-dot-dc"
                  style={
                    {
                      offsetPath: `path("${spec.d}")`,
                      offsetRotate: '0deg',
                      '--qalam-flow-dur': `${pulseDurationSec}s`,
                      animationDelay: `${(-idx * (pulseDurationSec / 3)).toFixed(3)}s`,
                      animationDirection: effectiveReverse ? 'reverse' : 'normal',
                      animationPlayState: playState,
                    } as React.CSSProperties
                  }
                />
              ))}
            </g>
          );
        }

        // flowType === 'dc': bright glowing dashed line + 3 smooth moving electron dots
        const dashP = spec.dashPeriod ?? 32;
        return (
          <g
            key={spec.id}
            style={{
              opacity: groupOpacity,
              transition: 'opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* Soft outer glow under dashes */}
            <path
              d={spec.d}
              fill="none"
              stroke={baseColor}
              strokeWidth={sw * 2.1}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.22}
            />
            <path
              d={spec.d}
              fill="none"
              stroke={baseColor}
              strokeWidth={sw}
              strokeDasharray="10 6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="qalam-flow-dash"
              style={
                {
                  '--qalam-flow-dur': `${(dcDurationSec * 0.65).toFixed(3)}s`,
                  '--qalam-dash-period': `${dashP}`,
                  animationDirection: effectiveReverse ? 'reverse' : 'normal',
                  animationPlayState: playState,
                } as React.CSSProperties
              }
            />
            {[0, 1, 2].map((idx) => (
              <circle
                key={`${spec.id}-dc-dot-${idx}`}
                cx="0"
                cy="0"
                r={dotR}
                fill={dotFill}
                stroke="#FFFFFF"
                strokeWidth={Math.max(0.8, dotR * 0.38)}
                className="qalam-flow-dot-dc"
                style={
                  {
                    offsetPath: `path("${spec.d}")`,
                    offsetRotate: '0deg',
                    '--qalam-flow-dur': `${dcDurationSec}s`,
                    animationDelay: `${(-idx * (dcDurationSec / 3)).toFixed(3)}s`,
                    animationDirection: effectiveReverse ? 'reverse' : 'normal',
                    animationPlayState: playState,
                  } as React.CSSProperties
                }
              />
            ))}
          </g>
        );
      })}
    </g>
  );
};
