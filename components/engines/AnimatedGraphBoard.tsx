import React, { useEffect, useMemo, useRef, useState } from 'react';
import { compile, derivative } from 'mathjs';
import type { RenderParams, StageAnchorsMap } from '../../types/tutor';

interface AnimatedGraphBoardProps {
  params: RenderParams;
  sliderValues: Record<string, number>;
  stepIndex?: number;
  beatIndex?: number;
  beatProgress?: number; // 0..1 within current beat
  totalBeats?: number;
  isPlaying?: boolean;
  onAnchorsChange?: (anchors: StageAnchorsMap) => void;
}

interface Pt {
  x: number;
  y: number;
  label?: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function niceStep(span: number, targetTicks = 6): number {
  const rough = span / Math.max(2, targetTicks);
  const pow10 = Math.pow(10, Math.floor(Math.log10(Math.max(1e-6, rough))));
  const frac = rough / pow10;
  let nice = 1;
  if (frac <= 1.2) nice = 1;
  else if (frac <= 2.4) nice = 2;
  else if (frac <= 5.5) nice = 5;
  else nice = 10;
  return nice * pow10;
}

function buildTicks(min: number, max: number, targetTicks = 6): number[] {
  const step = niceStep(max - min, targetTicks);
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) {
    const rounded = Math.round(v * 1000) / 1000;
    if (Math.abs(rounded) > 1e-6) ticks.push(rounded);
  }
  return ticks;
}

function formatTick(v: number): string {
  if (Math.abs(v - Math.round(v)) < 1e-5) return String(Math.round(v));
  return v.toFixed(1);
}

export const AnimatedGraphBoard: React.FC<AnimatedGraphBoardProps> = ({
  params,
  sliderValues,
  stepIndex = 0,
  beatIndex = 0,
  beatProgress = 1,
  totalBeats = 2,
  isPlaying = false,
  onAnchorsChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mainPathRef = useRef<SVGPathElement | null>(null);
  const secPathRef = useRef<SVGPathElement | null>(null);
  const onAnchorsChangeRef = useRef(onAnchorsChange);
  onAnchorsChangeRef.current = onAnchorsChange;

  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 680,
    height: 480,
  });
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [mainPathLen, setMainPathLen] = useState(0);
  const [secPathLen, setSecPathLen] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scopeBase = useMemo(
    () => ({ ...sliderValues, pi: Math.PI, e: Math.E }),
    [sliderValues]
  );

  const expr = params.expression || 'x^2';
  const [xMin, xMax] = params.x_range || [-3.6, 3.6];

  const evaluated = useMemo(() => {
    try {
      const compiled = compile(expr);
      const samples: Array<{ x: number; y: number | null }> = [];
      const n = 220;
      let minY = Infinity;
      let maxY = -Infinity;

      for (let i = 0; i <= n; i++) {
        const x = xMin + (i / n) * (xMax - xMin);
        try {
          const val = Number(compiled.evaluate({ ...scopeBase, x }));
          if (Number.isFinite(val) && Math.abs(val) < 1e3) {
            samples.push({ x, y: val });
            if (val < minY) minY = val;
            if (val > maxY) maxY = val;
          } else {
            samples.push({ x, y: null });
          }
        } catch {
          samples.push({ x, y: null });
        }
      }

      // Secondary curve or derivative
      let secSamples: Array<{ x: number; y: number | null }> | null = null;
      if (params.secondary_expression) {
        const comp2 = compile(params.secondary_expression);
        secSamples = samples.map(({ x }) => {
          try {
            const v = Number(comp2.evaluate({ ...scopeBase, x }));
            return { x, y: Number.isFinite(v) && Math.abs(v) < 1e3 ? v : null };
          } catch {
            return { x, y: null };
          }
        });
      } else if (params.derivative) {
        try {
          const dComp = derivative(expr, 'x').compile();
          secSamples = samples.map(({ x }) => {
            try {
              const v = Number(dComp.evaluate({ ...scopeBase, x }));
              return { x, y: Number.isFinite(v) && Math.abs(v) < 1e3 ? v : null };
            } catch {
              return { x, y: null };
            }
          });
        } catch {
          secSamples = null;
        }
      }

      let yMin = params.y_range?.[0] ?? Math.min(-1.5, Number.isFinite(minY) ? minY - 1 : -4);
      let yMax = params.y_range?.[1] ?? Math.max(4, Number.isFinite(maxY) ? maxY + 1 : 8);
      if (yMax - yMin < 2) {
        yMin -= 1;
        yMax += 1;
      }

      // Determine key highlight points (explicit or auto-sampled clean integer points)
      const rawMarkers = params.highlight_points || params.highlights || [];
      let keyPoints: Pt[] = rawMarkers.map((m) => ({ x: m.x, y: m.y, label: m.label }));

      if (keyPoints.length < 3) {
        const autoPts: Pt[] = [];
        const candX = [-2, -1, 0, 1, 2];
        for (const cx of candX) {
          if (cx >= xMin && cx <= xMax) {
            try {
              const cy = Number(compiled.evaluate({ ...scopeBase, x: cx }));
              if (Number.isFinite(cy) && cy >= yMin && cy <= yMax) {
                const yr = Math.round(cy * 10) / 10;
                autoPts.push({ x: cx, y: yr, label: `(${cx},${yr})` });
              }
            } catch {
              // ignore
            }
          }
        }
        if (autoPts.length > 0) {
          keyPoints = [
            ...keyPoints,
            ...autoPts.filter(
              (ap) => !keyPoints.some((kp) => Math.hypot(kp.x - ap.x, kp.y - ap.y) < 0.25)
            ),
          ].slice(0, 6);
        }
      }

      return { samples, secSamples, yMin, yMax, keyPoints, compiled, error: null as string | null };
    } catch (err) {
      return {
        samples: [] as Array<{ x: number; y: number | null }>,
        secSamples: null,
        yMin: -2,
        yMax: 10,
        keyPoints: [] as Pt[],
        compiled: null,
        error: err instanceof Error ? err.message : 'Grafik xatosi',
      };
    }
  }, [expr, xMin, xMax, params.y_range, params.secondary_expression, params.derivative, params.highlight_points, params.highlights, scopeBase]);

  // Coordinate transform preserving clean visual framing inside current container
  const layout = useMemo(() => {
    const W = Math.max(260, size.width);
    const H = Math.max(200, size.height);
    const padL = W < 440 ? 28 : 42;
    const padR = W < 440 ? 24 : 36;
    const padT = W < 440 ? 44 : 52;
    const padB = W < 440 ? 58 : 66;
    const plotW = Math.max(120, W - padL - padR);
    const plotH = Math.max(100, H - padT - padB);

    const xSpan = Math.max(0.5, xMax - xMin);
    const ySpan = Math.max(0.5, evaluated.yMax - evaluated.yMin);

    const toPx = (vx: number, vy: number) => ({
      x: padL + ((vx - xMin) / xSpan) * plotW,
      y: padT + (1 - (vy - evaluated.yMin) / ySpan) * plotH,
    });

    const fromPxX = (px: number) => xMin + ((px - padL) / plotW) * xSpan;

    const originX = clamp(0, xMin, xMax);
    const originY = clamp(0, evaluated.yMin, evaluated.yMax);
    const axisPx = toPx(originX, originY);

    return { W, H, padL, padR, padT, padB, plotW, plotH, toPx, fromPxX, axisPx };
  }, [size, xMin, xMax, evaluated.yMin, evaluated.yMax]);

  // Build SVG path strings
  const mainPathD = useMemo(() => {
    let d = '';
    let penDown = false;
    for (const pt of evaluated.samples) {
      if (pt.y === null || pt.y < evaluated.yMin - 0.5 || pt.y > evaluated.yMax + 0.5) {
        penDown = false;
        continue;
      }
      const p = layout.toPx(pt.x, pt.y);
      d += `${penDown ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      penDown = true;
    }
    return d.trim();
  }, [evaluated.samples, evaluated.yMin, evaluated.yMax, layout]);

  const secPathD = useMemo(() => {
    if (!evaluated.secSamples) return '';
    let d = '';
    let penDown = false;
    for (const pt of evaluated.secSamples) {
      if (pt.y === null || pt.y < evaluated.yMin - 0.5 || pt.y > evaluated.yMax + 0.5) {
        penDown = false;
        continue;
      }
      const p = layout.toPx(pt.x, pt.y);
      d += `${penDown ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      penDown = true;
    }
    return d.trim();
  }, [evaluated.secSamples, evaluated.yMin, evaluated.yMax, layout]);

  useEffect(() => {
    if (mainPathRef.current) {
      try {
        setMainPathLen(mainPathRef.current.getTotalLength());
      } catch {
        setMainPathLen(0);
      }
    }
    if (secPathRef.current) {
      try {
        setSecPathLen(secPathRef.current.getTotalLength());
      } catch {
        setSecPathLen(0);
      }
    }
  }, [mainPathD, secPathD]);

  // Compute progressive drawing phase: mark key points first, then draw curves briskly
  const phase = useMemo(() => {
    const safeBeats = Math.max(1, totalBeats);
    const continuousBeat = clamp((beatIndex + beatProgress) / safeBeats, 0, 1);

    // Step 0: Axes draw quickly (0..0.24), then key coordinate points mark one-by-one (0.22..0.72)
    if (stepIndex === 0) {
      const xAxisProgress = clamp(continuousBeat / 0.12, 0.04, 1);
      const yAxisProgress = clamp((continuousBeat - 0.1) / 0.14, 0, 1);

      const ptsCount = evaluated.keyPoints.length;
      let visiblePoints = 0;
      if (continuousBeat >= 0.22) {
        const ptsRatio = clamp((continuousBeat - 0.22) / 0.5, 0, 1);
        visiblePoints = Math.min(ptsCount, Math.max(1, Math.ceil(ptsRatio * ptsCount)));
      }

      return {
        xAxisProgress,
        yAxisProgress,
        visiblePoints,
        curveProgress: 0, // Curve draws cleanly on Step 1 through the plotted points!
        secCurveProgress: 0,
        activePointIndex: visiblePoints > 0 ? visiblePoints - 1 : -1,
      };
    }

    // Step 1: Key points already plotted -> brisk, smooth curve drawing (0.04..0.54)
    if (stepIndex === 1) {
      const curveProgress = clamp((continuousBeat - 0.04) / 0.48, 0, 1);
      return {
        xAxisProgress: 1,
        yAxisProgress: 1,
        visiblePoints: evaluated.keyPoints.length,
        curveProgress,
        secCurveProgress: 0,
        activePointIndex: -1,
      };
    }

    // Step 2+: Main curve visible; secondary/derivative curve draws briskly (0.04..0.54)
    const secCurveProgress = evaluated.secSamples
      ? clamp((continuousBeat - 0.04) / 0.48, 0, 1)
      : 0;
    return {
      xAxisProgress: 1,
      yAxisProgress: 1,
      visiblePoints: evaluated.keyPoints.length,
      curveProgress: 1,
      secCurveProgress,
      activePointIndex: -1,
    };
  }, [stepIndex, beatIndex, beatProgress, totalBeats, isPlaying, evaluated.keyPoints.length, evaluated.secSamples]);

  // Compute live drawing tip position for Mascot choreography
  const tipPosition = useMemo(() => {
    const { axisPx, padL, padR, padT, padB, W, H, toPx } = layout;

    if (stepIndex === 0) {
      if (phase.xAxisProgress < 1) {
        const halfSpan = ((W - padL - padR) / 2) * phase.xAxisProgress;
        return { x: axisPx.x + halfSpan, y: axisPx.y };
      }
      if (phase.yAxisProgress < 1) {
        const topReach = (axisPx.y - padT) * phase.yAxisProgress;
        return { x: axisPx.x, y: axisPx.y - topReach };
      }
      if (phase.activePointIndex >= 0 && evaluated.keyPoints[phase.activePointIndex]) {
        const pt = evaluated.keyPoints[phase.activePointIndex];
        return toPx(pt.x, pt.y);
      }
    }

    if (stepIndex === 1 && mainPathRef.current && mainPathLen > 0 && phase.curveProgress < 0.995) {
      try {
        const pt = mainPathRef.current.getPointAtLength(phase.curveProgress * mainPathLen);
        return { x: pt.x, y: pt.y };
      } catch {
        // fallback below
      }
    }

    if (stepIndex >= 2 && secPathRef.current && secPathLen > 0 && phase.secCurveProgress > 0 && phase.secCurveProgress < 0.995) {
      try {
        const pt = secPathRef.current.getPointAtLength(phase.secCurveProgress * secPathLen);
        return { x: pt.x, y: pt.y };
      } catch {
        // fallback below
      }
    }

    // Fallback to key point / vertex
    const vPt = evaluated.keyPoints[0];
    return vPt ? toPx(vPt.x, vPt.y) : { x: axisPx.x, y: clamp(axisPx.y, padT, H - padB) };
  }, [layout, stepIndex, beatIndex, beatProgress, isPlaying, phase, mainPathLen, secPathLen, evaluated.keyPoints]);

  // Emit stage anchors whenever layout, points, or active drawing tip updates
  useEffect(() => {
    const cb = onAnchorsChangeRef.current;
    if (!cb) return;
    const { W, H, toPx, axisPx } = layout;
    const kp0 = evaluated.keyPoints[0];
    const kp1 = evaluated.keyPoints[1];

    const anchors: StageAnchorsMap = {
      overview: { x: W * 0.5, y: H * 0.48 },
      origin: axisPx,
      x_axis: { x: Math.min(W - 44, axisPx.x + 100), y: axisPx.y },
      y_axis: { x: axisPx.x, y: Math.max(56, axisPx.y - 95) },
      vertex_min: kp0 ? toPx(kp0.x, kp0.y) : axisPx,
      x_intercept: kp1 ? toPx(kp1.x, kp1.y) : toPx(1, 1),
      derivative_tangent: evaluated.keyPoints[2]
        ? toPx(evaluated.keyPoints[2].x, evaluated.keyPoints[2].y)
        : toPx(1.5, 2.25),
      drawing_tip: tipPosition,
    };
    cb(anchors);
  }, [layout, evaluated.keyPoints, tipPosition]);

  const xTicks = useMemo(() => buildTicks(xMin, xMax, layout.W < 420 ? 5 : 7), [xMin, xMax, layout.W]);
  const yTicks = useMemo(
    () => buildTicks(evaluated.yMin, evaluated.yMax, layout.H < 320 ? 4 : 6),
    [evaluated.yMin, evaluated.yMax, layout.H]
  );

  // Interactive hover readout
  const hoverReadout = useMemo(() => {
    if (hoverX === null || !evaluated.compiled) return null;
    try {
      const val = Number(evaluated.compiled.evaluate({ ...scopeBase, x: hoverX }));
      if (!Number.isFinite(val)) return null;
      const clampedY = clamp(val, evaluated.yMin, evaluated.yMax);
      return {
        x: hoverX,
        y: val,
        px: layout.toPx(hoverX, clampedY),
      };
    } catch {
      return null;
    }
  }, [hoverX, evaluated.compiled, evaluated.yMin, evaluated.yMax, scopeBase, layout]);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const vx = clamp(layout.fromPxX(px), xMin, xMax);
    setHoverX(vx);
  };

  if (evaluated.error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6 text-sm text-rose-700">
        Grafikni hisoblashda xatolik: {evaluated.error}
      </div>
    );
  }

  const xLeft = layout.padL;
  const xRight = layout.W - layout.padR;
  const yTop = layout.padT;
  const yBottom = layout.H - layout.padB;

  const curXStart = layout.axisPx.x - (layout.axisPx.x - xLeft) * phase.xAxisProgress;
  const curXEnd = layout.axisPx.x + (xRight - layout.axisPx.x) * phase.xAxisProgress;
  const curYBottom = layout.axisPx.y + (yBottom - layout.axisPx.y) * phase.yAxisProgress;
  const curYTop = layout.axisPx.y - (layout.axisPx.y - yTop) * phase.yAxisProgress;

  return (
    <div ref={containerRef} className="relative w-full h-full select-none overflow-hidden">
      <svg
        width={layout.W}
        height={layout.H}
        viewBox={`0 0 ${layout.W} ${layout.H}`}
        className="w-full h-full touch-none"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverX(null)}
      >
        {/* Subtle Major Grid Lines */}
        {xTicks.map((tx) => {
          const p = layout.toPx(tx, 0);
          return (
            <line
              key={`gx-${tx}`}
              x1={p.x}
              y1={yTop}
              x2={p.x}
              y2={yBottom}
              stroke="rgba(148, 163, 184, 0.22)"
              strokeWidth="1"
            />
          );
        })}
        {yTicks.map((ty) => {
          const p = layout.toPx(0, ty);
          return (
            <line
              key={`gy-${ty}`}
              x1={xLeft}
              y1={p.y}
              x2={xRight}
              y2={p.y}
              stroke="rgba(148, 163, 184, 0.22)"
              strokeWidth="1"
            />
          );
        })}

        {/* Animated X Axis */}
        {phase.xAxisProgress > 0.02 && (
          <g>
            <line
              x1={curXStart}
              y1={layout.axisPx.y}
              x2={curXEnd}
              y2={layout.axisPx.y}
              stroke="#1E293B"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {phase.xAxisProgress > 0.9 && (
              <>
                <polyline
                  points={`${curXStart + 7},${layout.axisPx.y - 4.5} ${curXStart},${layout.axisPx.y} ${curXStart + 7},${layout.axisPx.y + 4.5}`}
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={`${curXEnd - 7},${layout.axisPx.y - 4.5} ${curXEnd},${layout.axisPx.y} ${curXEnd - 7},${layout.axisPx.y + 4.5}`}
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text
                  x={curXEnd + 8}
                  y={layout.axisPx.y + 4}
                  fontSize="12"
                  fontWeight="700"
                  fill="#475569"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  x
                </text>
              </>
            )}

            {/* X Ticks appear as axis grows past them */}
            {xTicks.map((tx) => {
              const p = layout.toPx(tx, 0);
              if (p.x < curXStart + 10 || p.x > curXEnd - 10) return null;
              return (
                <g key={`tx-${tx}`}>
                  <line
                    x1={p.x}
                    y1={layout.axisPx.y - 3.5}
                    x2={p.x}
                    y2={layout.axisPx.y + 3.5}
                    stroke="#334155"
                    strokeWidth="1.5"
                  />
                  <text
                    x={p.x}
                    y={layout.axisPx.y + 16}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="500"
                    fill="#475569"
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    {formatTick(tx)}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Animated Y Axis */}
        {phase.yAxisProgress > 0.02 && (
          <g>
            <line
              x1={layout.axisPx.x}
              y1={curYBottom}
              x2={layout.axisPx.x}
              y2={curYTop}
              stroke="#1E293B"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {phase.yAxisProgress > 0.9 && (
              <>
                <polyline
                  points={`${layout.axisPx.x - 4.5},${curYTop + 7} ${layout.axisPx.x},${curYTop} ${layout.axisPx.x + 4.5},${curYTop + 7}`}
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text
                  x={layout.axisPx.x + 8}
                  y={curYTop + 4}
                  fontSize="12"
                  fontWeight="700"
                  fill="#475569"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  y
                </text>
              </>
            )}

            {yTicks.map((ty) => {
              const p = layout.toPx(0, ty);
              if (p.y < curYTop + 10 || p.y > curYBottom - 10) return null;
              return (
                <g key={`ty-${ty}`}>
                  <line
                    x1={layout.axisPx.x - 3.5}
                    y1={p.y}
                    x2={layout.axisPx.x + 3.5}
                    y2={p.y}
                    stroke="#334155"
                    strokeWidth="1.5"
                  />
                  <text
                    x={layout.axisPx.x - 8}
                    y={p.y + 3.5}
                    textAnchor="end"
                    fontSize="11"
                    fontWeight="500"
                    fill="#475569"
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    {formatTick(ty)}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Smooth Main Function Curve (Progressively Stroked) */}
        {mainPathD && (
          <path
            ref={mainPathRef}
            d={mainPathD}
            fill="none"
            stroke="#2563EB"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={
              mainPathLen > 0
                ? {
                    strokeDasharray: mainPathLen,
                    strokeDashoffset: mainPathLen * (1 - phase.curveProgress),
                    opacity: phase.curveProgress > 0.01 ? 1 : 0,
                  }
                : { opacity: phase.curveProgress > 0.01 ? 1 : 0 }
            }
          />
        )}

        {/* Optional Secondary / Derivative Curve */}
        {secPathD && (
          <path
            ref={secPathRef}
            d={secPathD}
            fill="none"
            stroke={params.derivative ? '#F43F5E' : '#F59E0B'}
            strokeWidth="2.4"
            strokeDasharray={secPathLen > 0 ? undefined : '6 5'}
            strokeLinecap="round"
            style={
              secPathLen > 0
                ? {
                    strokeDasharray: secPathLen,
                    strokeDashoffset: secPathLen * (1 - phase.secCurveProgress),
                    opacity: phase.secCurveProgress > 0.01 ? 0.92 : 0,
                  }
                : { opacity: phase.secCurveProgress > 0.01 ? 0.92 : 0 }
            }
          />
        )}

        {/* Highlighted Coordinate Points Placed One-by-One */}
        {evaluated.keyPoints.slice(0, phase.visiblePoints).map((pt, idx) => {
          const p = layout.toPx(pt.x, pt.y);
          const isCurrent = isPlaying && stepIndex === 0 && idx === phase.activePointIndex;
          return (
            <g key={`pt-${idx}`}>
              {isCurrent && (
                <circle cx={p.x} cy={p.y} r="13" fill="rgba(249, 115, 22, 0.2)" />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={isCurrent ? '6.5' : '5.2'}
                fill="#F97316"
                stroke="#FFFFFF"
                strokeWidth="1.8"
              />
              <text
                x={p.x + (pt.x < 0 ? -8 : 8)}
                y={p.y + (pt.y === 0 ? 18 : -8)}
                textAnchor={pt.x < 0 ? 'end' : 'start'}
                fontSize="11.5"
                fontWeight="600"
                fill="#B45309"
                fontFamily="IBM Plex Mono, monospace"
              >
                {pt.label || `(${pt.x},${pt.y})`}
              </text>
            </g>
          );
        })}

        {/* Active Pen Drawing Glow Tip while Animating */}
        {isPlaying &&
          ((stepIndex === 1 && phase.curveProgress > 0.02 && phase.curveProgress < 0.99) ||
            (stepIndex === 0 && beatIndex === 0 && phase.yAxisProgress < 0.99) ||
            (stepIndex >= 2 && phase.secCurveProgress > 0.02 && phase.secCurveProgress < 0.99)) && (
            <g>
              <circle
                cx={tipPosition.x}
                cy={tipPosition.y}
                r="11"
                fill="rgba(249, 115, 22, 0.24)"
              />
              <circle
                cx={tipPosition.x}
                cy={tipPosition.y}
                r="5.5"
                fill="#F97316"
                stroke="#FFFFFF"
                strokeWidth="1.8"
              />
            </g>
          )}

        {/* Interactive Hover / Touch Crosshair */}
        {hoverReadout && (
          <g>
            <line
              x1={hoverReadout.px.x}
              y1={yTop}
              x2={hoverReadout.px.x}
              y2={yBottom}
              stroke="rgba(37, 99, 235, 0.35)"
              strokeDasharray="4 4"
              strokeWidth="1.2"
            />
            <circle
              cx={hoverReadout.px.x}
              cy={hoverReadout.px.y}
              r="5.5"
              fill="#2563EB"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            <g
              transform={`translate(${clamp(hoverReadout.px.x, 70, layout.W - 70)}, ${Math.max(24, hoverReadout.px.y - 18)})`}
            >
              <rect x="-54" y="-14" width="108" height="22" rx="7" fill="#0F172A" opacity="0.9" />
              <text
                x="0"
                y="1"
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="#FFFFFF"
                fontFamily="IBM Plex Mono, monospace"
              >
                ({hoverReadout.x.toFixed(1)}, {hoverReadout.y.toFixed(1)})
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};
