import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlowType, RenderParams, StageAnchorsMap } from '../../types/tutor';
import { IllustrationSvgCanvas, type SvgAnchorBox } from './IllustrationSvgCanvas';
import { SvgFlowOverlay, type FlowPathSpec } from './SvgFlowOverlay';

interface SvgGeometryStageProps {
  params: RenderParams;
  sliderValues: Record<string, number>;
  cameraZoom?: number;
  focusPart?: string;
  focusTarget?: string;
  dimInactiveParts?: boolean;
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
  stepIndex?: number;
  beatIndex?: number;
  beatProgress?: number;
  totalBeats?: number;
  isPlaying?: boolean;
  onAnchorsChange?: (anchors: StageAnchorsMap) => void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function subPhase(t: number, start: number, end: number): number {
  if (end <= start) return t >= start ? 1 : 0;
  return clamp((t - start) / (end - start), 0, 1);
}

function quadBezier(
  p0: { vx: number; vy: number },
  p1: { vx: number; vy: number },
  p2: { vx: number; vy: number },
  t: number
): { vx: number; vy: number } {
  const u = 1 - clamp(t, 0, 1);
  const tt = clamp(t, 0, 1);
  return {
    vx: u * u * p0.vx + 2 * u * tt * p1.vx + tt * tt * p2.vx,
    vy: u * u * p0.vy + 2 * u * tt * p1.vy + tt * tt * p2.vy,
  };
}

function tracePolyPerimeter(
  corners: Array<{ vx: number; vy: number }>,
  progress: number
): { tip: { vx: number; vy: number } } {
  const p = clamp(progress, 0, 1);
  const segCount = corners.length;
  const scaled = p * segCount;
  const idx = Math.min(segCount - 1, Math.floor(scaled));
  const localT = scaled - idx;
  const a = corners[idx];
  const b = corners[(idx + 1) % segCount];
  return {
    tip: {
      vx: lerp(a.vx, b.vx, localT),
      vy: lerp(a.vy, b.vy, localT),
    },
  };
}

export const SvgGeometryStage: React.FC<SvgGeometryStageProps> = ({
  params,
  sliderValues,
  cameraZoom = 1,
  focusPart,
  focusTarget,
  dimInactiveParts = false,
  flowType = 'none',
  flowSpeed = 1.0,
  flowReverse = false,
  stepIndex = 0,
  beatIndex = 0,
  beatProgress = 1,
  totalBeats = 2,
  isPlaying = false,
  onAnchorsChange,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const onAnchorsChangeRef = useRef(onAnchorsChange);
  onAnchorsChangeRef.current = onAnchorsChange;

  const kind =
    params.kind ||
    (params.svg_data || params.object_name_en || params.object_name_uz
      ? 'illustration'
      : 'pythagoras');
  const highlights = params.highlight || [];
  const effectiveFlowType: FlowType = flowType || params.flowType || 'none';
  const effectiveFlowSpeed = flowSpeed ?? params.flowSpeed ?? 1.0;
  const effectiveFlowReverse = flowReverse ?? params.flowReverse ?? false;

  // Manual user pan/zoom state (never overwritten mid-step by auto-zoom)
  const [manualCam, setManualCam] = useState<{ zoom: number; tx: number; ty: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startTx: number;
    startTy: number;
    zoom: number;
  } | null>(null);

  useEffect(() => {
    setManualCam(null);
  }, [kind, stepIndex, params.object_name_en, params.object_name_uz]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    try {
      if (isPlaying) svg.unpauseAnimations?.();
      else svg.pauseAnimations?.();
    } catch {
      // ignore if unsupported
    }
  }, [isPlaying, kind, stepIndex]);

  // Continuous 0..1 progress within the current step; starts at 0 so future elements NEVER flash beforehand
  const continuousBeat = useMemo(() => {
    return clamp((beatIndex + beatProgress) / Math.max(1, totalBeats), 0, 1);
  }, [beatIndex, beatProgress, totalBeats]);

  // Active focus key for Steps 2 & 3 (Macro -> Micro). Step 1 (0) and Step 4+ (>=3) always stay at 1.0x overview.
  const activeFocusKey = useMemo(() => {
    if (stepIndex !== 1 && stepIndex !== 2) return undefined;
    const candidate =
      focusPart ||
      (focusTarget && focusTarget !== 'overview' && focusTarget !== 'drawing_tip'
        ? focusTarget
        : undefined);
    return candidate?.trim() || undefined;
  }, [stepIndex, focusPart, focusTarget]);

  const shouldDimOthers = Boolean(
    activeFocusKey && dimInactiveParts && (stepIndex === 1 || stepIndex === 2)
  );

  // Compute SVG viewBox anchors (680 x 480 space) synced with stroke-by-stroke drawing
  const viewBoxAnchors = useMemo((): Record<string, SvgAnchorBox> => {
    if (kind === 'illustration') {
      return {
        drawing_tip: { vx: 340, vy: 232, width: 24, height: 24 },
        overview: { vx: 340, vy: 232, width: 280, height: 260 },
      };
    }

    if (kind === 'photosynthesis') {
      const t = continuousBeat;
      let tip = { vx: 340, vy: 235 };

      if (stepIndex === 0) {
        if (t < 0.25) {
          const ang = -Math.PI / 2 + subPhase(t, 0, 0.25) * Math.PI * 2;
          tip = { vx: 105 + Math.cos(ang) * 36, vy: 95 + Math.sin(ang) * 36 };
        } else if (t < 0.46) {
          const rP = subPhase(t, 0.25, 0.46);
          tip = { vx: lerp(150, 266, rP), vy: lerp(131, 198, rP) };
        } else if (t < 0.8) {
          const lP = subPhase(t, 0.46, 0.8);
          if (lP < 0.52) {
            tip = quadBezier(
              { vx: 235, vy: 268 },
              { vx: 330, vy: 148 },
              { vx: 455, vy: 192 },
              lP / 0.52
            );
          } else {
            tip = quadBezier(
              { vx: 455, vy: 192 },
              { vx: 418, vy: 312 },
              { vx: 235, vy: 268 },
              (lP - 0.52) / 0.48
            );
          }
        } else if (t < 0.9) {
          const vP = subPhase(t, 0.8, 0.9);
          tip = { vx: lerp(238, 446, vP), vy: lerp(267, 196, vP) };
        } else {
          tip = { vx: 348, vy: 230 };
        }
      } else if (stepIndex === 1) {
        if (t < 0.26) {
          const sP = subPhase(t, 0, 0.26);
          tip = { vx: 335, vy: lerp(395, 280, sP) };
        } else if (t < 0.42) {
          const rtP = subPhase(t, 0.26, 0.42);
          tip =
            rtP < 0.5
              ? { vx: lerp(335, 250, rtP * 2), vy: lerp(395, 422, rtP * 2) }
              : { vx: lerp(335, 415, (rtP - 0.5) * 2), vy: lerp(395, 422, (rtP - 0.5) * 2) };
        } else if (t < 0.62) {
          const wP = subPhase(t, 0.42, 0.62);
          tip = { vx: lerp(285, 308, wP), vy: lerp(345, 308, wP) };
        } else {
          const cP = subPhase(t, 0.62, 0.92);
          tip = { vx: lerp(118, 224, cP), vy: 255 };
        }
      } else {
        if (t < 0.48) {
          const oP = subPhase(t, 0, 0.48);
          if (oP < 0.6) {
            const aP = oP / 0.6;
            tip = { vx: lerp(442, 538, aP), vy: lerp(208, 156, aP) };
          } else {
            const ang = -Math.PI + ((oP - 0.6) / 0.4) * Math.PI * 2;
            tip = { vx: 556 + Math.cos(ang) * 22, vy: 145 + Math.sin(ang) * 22 };
          }
        } else {
          const gP = subPhase(t, 0.48, 0.94);
          if (gP < 0.55) {
            const aP = gP / 0.55;
            tip = { vx: lerp(432, 535, aP), vy: lerp(252, 292, aP) };
          } else {
            tip = { vx: lerp(498, 626, (gP - 0.55) / 0.45), vy: 321 };
          }
        }
      }

      return {
        sun_rays: { vx: 135, vy: 118, width: 140, height: 110 },
        leaf_chloroplast: { vx: 345, vy: 230, width: 220, height: 120 },
        water_roots: { vx: 295, vy: 350, width: 220, height: 150 },
        oxygen_out: { vx: 535, vy: 210, width: 170, height: 190 },
        drawing_tip: { ...tip, width: 24, height: 24 },
        overview: { vx: 340, vy: 240, width: 460, height: 340 },
      };
    }

    if (kind === 'sky_scattering') {
      const t = continuousBeat;
      let tip = { vx: 340, vy: 235 };

      if (stepIndex === 0) {
        if (t < 0.24) {
          const ang = -Math.PI / 2 + subPhase(t, 0, 0.24) * Math.PI * 2;
          tip = { vx: 95 + Math.cos(ang) * 34, vy: 120 + Math.sin(ang) * 34 };
        } else if (t < 0.54) {
          const bP = subPhase(t, 0.24, 0.54);
          tip = { vx: lerp(128, 310, bP), vy: lerp(138, 226, bP) };
        } else if (t < 0.84) {
          const aP = subPhase(t, 0.54, 0.84);
          tip = quadBezier(
            { vx: 180, vy: 390 },
            { vx: 380, vy: 85 },
            { vx: 590, vy: 390 },
            aP
          );
        } else {
          tip = { vx: 320, vy: 230 };
        }
      } else if (stepIndex === 1) {
        const bP = subPhase(t, 0, 0.78);
        tip = { vx: lerp(330, 462, bP), vy: lerp(220, 134, bP) };
      } else {
        if (t < 0.6) {
          const rP = subPhase(t, 0, 0.6);
          tip = { vx: lerp(338, 585, rP), vy: lerp(242, 282, rP) };
        } else {
          tip = { vx: 445, vy: 365 };
        }
      }

      return {
        sun_beam: { vx: 165, vy: 155, width: 170, height: 120 },
        atmosphere_molecules: { vx: 325, vy: 225, width: 90, height: 80 },
        blue_scatter: { vx: 420, vy: 155, width: 170, height: 100 },
        red_pass: { vx: 485, vy: 280, width: 220, height: 120 },
        drawing_tip: { ...tip, width: 24, height: 24 },
        overview: { vx: 340, vy: 240, width: 460, height: 320 },
      };
    }

    if (kind === 'pythagoras') {
      const a = sliderValues.a ?? params.a ?? 3;
      const b = sliderValues.b ?? params.b ?? 4;
      const maxSpan = a + b + 2;
      const scale = Math.min(27, 250 / maxSpan);
      const ox = 250;
      const oy = 275;
      const ax = ox;
      const ay = oy - a * scale;
      const bx = ox + b * scale;
      const by = oy;
      const dx = bx - ax;
      const dy = by - ay;
      const nx = dy;
      const ny = -dx;

      const sqACorners = [
        { vx: ox, vy: oy },
        { vx: ax, vy: ay },
        { vx: ax - a * scale, vy: ay },
        { vx: ox - a * scale, vy: oy },
      ];
      const sqBCorners = [
        { vx: ox, vy: oy },
        { vx: bx, vy: by },
        { vx: bx, vy: by + b * scale },
        { vx: ox, vy: oy + b * scale },
      ];
      const sqCCorners = [
        { vx: ax, vy: ay },
        { vx: bx, vy: by },
        { vx: bx + nx, vy: by + ny },
        { vx: ax + nx, vy: ay + ny },
      ];

      let drawingTip = { vx: (ax + bx) / 2, vy: (ay + by) / 2 };
      const t = continuousBeat;

      if (stepIndex === 0) {
        if (t < 0.06) {
          drawingTip = { vx: ox, vy: oy };
        } else if (t < 0.12) {
          drawingTip = { vx: ax, vy: ay };
        } else if (t < 0.18) {
          drawingTip = { vx: bx, vy: by };
        } else if (t < 0.34) {
          drawingTip = { vx: ox, vy: lerp(oy, ay, subPhase(t, 0.18, 0.34)) };
        } else if (t < 0.5) {
          drawingTip = { vx: lerp(ox, bx, subPhase(t, 0.34, 0.5)), vy: oy };
        } else if (t < 0.68) {
          const p3 = subPhase(t, 0.5, 0.68);
          drawingTip = { vx: lerp(ax, bx, p3), vy: lerp(ay, by, p3) };
        } else {
          drawingTip = { vx: (ox + ax + bx) / 3, vy: (oy + ay + by) / 3 };
        }
      } else if (stepIndex === 1) {
        if (t < 0.46) {
          drawingTip = tracePolyPerimeter(sqACorners, subPhase(t, 0.02, 0.44)).tip;
        } else {
          drawingTip = tracePolyPerimeter(sqBCorners, subPhase(t, 0.48, 0.92)).tip;
        }
      } else {
        drawingTip = tracePolyPerimeter(sqCCorners, subPhase(t, 0.02, 0.78)).tip;
      }

      const sqACenter = { vx: ox - (a * scale) / 2, vy: oy - (a * scale) / 2 };
      const sqBCenter = { vx: ox + (b * scale) / 2, vy: oy + (b * scale) / 2 };
      const sqCCenter = {
        vx: (ax + bx + bx + nx + ax + nx) / 4,
        vy: (ay + by + by + ny + ay + ny) / 4,
      };
      const cSpan = Math.hypot(dx, dy);

      return {
        triangle_center: {
          vx: (ox + ax + bx) / 3,
          vy: (oy + ay + by) / 3,
          width: Math.max(40, b * scale),
          height: Math.max(40, a * scale),
        },
        square_a: { ...sqACenter, width: a * scale, height: a * scale },
        square_b: { ...sqBCenter, width: b * scale, height: b * scale },
        squares_ab: {
          vx: (sqACenter.vx + sqBCenter.vx) / 2,
          vy: (sqACenter.vy + sqBCenter.vy) / 2,
          width: (a + b) * scale,
          height: (a + b) * scale,
        },
        square_c: { ...sqCCenter, width: cSpan, height: cSpan },
        leg_a: { vx: ox, vy: (ay + oy) / 2, width: 32, height: a * scale },
        leg_b: { vx: (ox + bx) / 2, vy: oy, width: b * scale, height: 32 },
        hypotenuse_c: { vx: (ax + bx) / 2, vy: (ay + by) / 2, width: b * scale, height: a * scale },
        drawing_tip: { ...drawingTip, width: 24, height: 24 },
        overview: { vx: 340, vy: 240, width: 340, height: 320 },
      };
    }

    if (kind === 'circle' || kind === 'unit_circle') {
      const r = sliderValues.radius ?? params.radius ?? 5;
      const angleDeg = sliderValues.angle_deg ?? params.angle_deg ?? 90;
      const R = Math.min(155, Math.max(70, r * 18));
      const cx = 340;
      const cy = 240;
      const rad = (angleDeg * Math.PI) / 180;
      const px = cx + R * Math.cos(-rad);
      const py = cy + R * Math.sin(-rad);

      const t = continuousBeat;
      let tip = { vx: px, vy: py };
      if (stepIndex === 0) {
        if (t < 0.22) {
          const axP = subPhase(t, 0, 0.22);
          tip = { vx: cx + 260 * axP, vy: cy };
        } else if (t < 0.72) {
          const cP = subPhase(t, 0.22, 0.72);
          const ang = cP * Math.PI * 2;
          tip = { vx: cx + R * Math.cos(ang), vy: cy + R * Math.sin(ang) };
        } else {
          const rP = subPhase(t, 0.72, 0.94);
          tip = { vx: lerp(cx, px, rP), vy: lerp(cy, py, rP) };
        }
      }

      return {
        center_O: { vx: cx, vy: cy, width: 48, height: 48 },
        radius_r: { vx: cx + R * 0.52, vy: cy, width: R, height: 48 },
        sector_arc: { vx: (cx + px) / 2, vy: (cy + py) / 2, width: R, height: R },
        angle_alpha: { vx: cx + 52, vy: cy - 22, width: 76, height: 56 },
        drawing_tip: { ...tip, width: 24, height: 24 },
        overview: { vx: cx, vy: cy, width: R * 2, height: R * 2 },
      };
    }

    if (kind === 'polygon') {
      const n = Math.round(clamp(sliderValues.sides ?? params.sides ?? 6, 3, 16));
      const sideLen = sliderValues.a ?? params.a ?? 4;
      const rParam = sliderValues.radius ?? params.radius;
      const R = rParam
        ? clamp(72 + rParam * 14, 100, 162)
        : clamp(92 + sideLen * 7.5, 108, 160);
      const cx = 340;
      const cy = 242;
      const startAngle = -Math.PI / 2 + (n % 2 === 0 ? Math.PI / n : 0);
      const vertices = Array.from({ length: n }, (_, i) => {
        const ang = startAngle + (i * 2 * Math.PI) / n;
        return {
          vx: cx + R * Math.cos(ang),
          vy: cy + R * Math.sin(ang),
        };
      });

      const t = continuousBeat;
      let tip = vertices[0];

      if (stepIndex === 0) {
        if (t < 0.28) {
          const vIdx = Math.min(n - 1, Math.floor(subPhase(t, 0, 0.28) * n));
          tip = vertices[vIdx];
        } else if (t < 0.84) {
          tip = tracePolyPerimeter(vertices, subPhase(t, 0.28, 0.84)).tip;
        } else {
          tip = { vx: cx, vy: cy };
        }
      } else if (stepIndex === 1) {
        if (t < 0.35) {
          const r1 = subPhase(t, 0, 0.35);
          tip = { vx: lerp(cx, vertices[0].vx, r1), vy: lerp(cy, vertices[0].vy, r1) };
        } else if (t < 0.7) {
          const r2 = subPhase(t, 0.35, 0.7);
          tip = { vx: lerp(cx, vertices[1].vx, r2), vy: lerp(cy, vertices[1].vy, r2) };
        } else {
          tip = {
            vx: lerp(vertices[0].vx, cx, 0.22),
            vy: lerp(vertices[0].vy, cy, 0.22),
          };
        }
      } else {
        const diagCount = Math.max(1, n - 3);
        const dP = subPhase(t, 0.05, 0.85);
        const dIdx = Math.min(diagCount - 1, Math.floor(dP * diagCount));
        const targetV = vertices[Math.min(n - 1, dIdx + 2)];
        const localT = clamp(dP * diagCount - dIdx, 0, 1);
        tip = {
          vx: lerp(vertices[0].vx, targetV.vx, localT),
          vy: lerp(vertices[0].vy, targetV.vy, localT),
        };
      }

      return {
        center_O: { vx: cx, vy: cy, width: 70, height: 70 },
        vertex_0: { ...vertices[0], width: 64, height: 64 },
        interior_angle: { ...vertices[0], width: 84, height: 72 },
        diagonals: { vx: cx, vy: cy, width: R * 1.4, height: R * 1.4 },
        apothem: { vx: cx, vy: cy + R * 0.45, width: 80, height: R * 0.85 },
        drawing_tip: { ...tip, width: 24, height: 24 },
        overview: { vx: cx, vy: cy, width: R * 2, height: R * 2 },
      };
    }

    const a = sliderValues.a ?? params.a ?? 5;
    const b = sliderValues.b ?? params.b ?? 6;
    const c = sliderValues.c ?? params.c ?? 7;
    const cosA = (b * b + c * c - a * a) / (2 * b * c);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const cxRaw = b * cosA;
    const cyRaw = b * sinA;
    const maxDim = Math.max(c, cxRaw, cyRaw, 1);
    const scale = 270 / maxDim;
    const offsetX = 340 - (c * scale) / 2;
    const offsetY = 355;
    const Ax = offsetX;
    const Ay = offsetY;
    const Bx = offsetX + c * scale;
    const By = offsetY;
    const Cx = offsetX + cxRaw * scale;
    const Cy = offsetY - cyRaw * scale;

    const t = continuousBeat;
    let tip = { vx: Cx, vy: Cy };
    if (stepIndex === 0) {
      if (t < 0.06) tip = { vx: Ax, vy: Ay };
      else if (t < 0.12) tip = { vx: Bx, vy: By };
      else if (t < 0.18) tip = { vx: Cx, vy: Cy };
      else if (t < 0.36) {
        const e1 = subPhase(t, 0.18, 0.36);
        tip = { vx: lerp(Ax, Bx, e1), vy: lerp(Ay, By, e1) };
      } else if (t < 0.54) {
        const e2 = subPhase(t, 0.36, 0.54);
        tip = { vx: lerp(Bx, Cx, e2), vy: lerp(By, Cy, e2) };
      } else if (t < 0.72) {
        const e3 = subPhase(t, 0.54, 0.72);
        tip = { vx: lerp(Cx, Ax, e3), vy: lerp(Cy, Ay, e3) };
      } else {
        tip = { vx: (Ax + Bx + Cx) / 3, vy: (Ay + By + Cy) / 3 };
      }
    }

    return {
      vertex_A: { vx: Ax, vy: Ay, width: 52, height: 52 },
      vertex_B: { vx: Bx, vy: By, width: 52, height: 52 },
      vertex_C: { vx: Cx, vy: Cy, width: 52, height: 52 },
      triangle_center: { vx: (Ax + Bx + Cx) / 3, vy: (Ay + By + Cy) / 3, width: 180, height: 150 },
      drawing_tip: { ...tip, width: 24, height: 24 },
      overview: { vx: 340, vy: 240, width: 300, height: 240 },
    };
  }, [kind, params, sliderValues, stepIndex, continuousBeat]);

  // Compute Macro-to-Micro pan/zoom for non-illustration geometry scenes
  const autoCamera = useMemo(() => {
    if (kind === 'illustration') return { zoom: 1, tx: 0, ty: 0 };
    if ((stepIndex === 1 || stepIndex === 2) && activeFocusKey) {
      const targetAnchor = viewBoxAnchors[activeFocusKey];
      if (targetAnchor) {
        const zoom = clamp(cameraZoom >= 1.55 ? cameraZoom : 1.72, 1.6, 1.9);
        const pivotX = clamp(targetAnchor.vx, 145, 535);
        const pivotY = clamp(targetAnchor.vy, 105, 375);
        return {
          zoom,
          tx: 340 - pivotX * zoom,
          ty: 240 - pivotY * zoom,
        };
      }
    }
    return { zoom: 1, tx: 0, ty: 0 };
  }, [kind, stepIndex, activeFocusKey, cameraZoom, viewBoxAnchors]);

  const activeCamera = manualCam || autoCamera;

  const emitAnchors = useCallback(
    (anchorsToEmit: Record<string, SvgAnchorBox>, applyCamera = false) => {
      const wrapper = wrapperRef.current;
      const svg = svgRef.current;
      const cb = onAnchorsChangeRef.current;
      if (!wrapper || !svg || !cb) return;

      const wrapRect = wrapper.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();
      if (svgRect.width <= 0 || svgRect.height <= 0) return;

      const scale = Math.min(svgRect.width / 680, svgRect.height / 480);
      const renderedW = 680 * scale;
      const renderedH = 480 * scale;
      const originX = svgRect.left - wrapRect.left + (svgRect.width - renderedW) / 2;
      const originY = svgRect.top - wrapRect.top + (svgRect.height - renderedH) / 2;

      const out: StageAnchorsMap = {};
      for (const [key, pt] of Object.entries(anchorsToEmit)) {
        const vx = applyCamera ? activeCamera.tx + pt.vx * activeCamera.zoom : pt.vx;
        const vy = applyCamera ? activeCamera.ty + pt.vy * activeCamera.zoom : pt.vy;
        const w = (pt.width ?? 36) * (applyCamera ? activeCamera.zoom : 1);
        const h = (pt.height ?? 36) * (applyCamera ? activeCamera.zoom : 1);
        out[key] = {
          x: originX + vx * scale,
          y: originY + vy * scale,
          width: w * scale,
          height: h * scale,
        };
      }
      cb(out);
    },
    [activeCamera.tx, activeCamera.ty, activeCamera.zoom]
  );

  // Convert SVG viewBox coordinates into exact stage pixel coordinates for geometry scenes
  useEffect(() => {
    if (kind === 'illustration') return;
    const emit = () => emitAnchors(viewBoxAnchors, true);

    const raf = requestAnimationFrame(emit);
    const ro = new ResizeObserver(emit);
    if (wrapperRef.current) ro.observe(wrapperRef.current);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [kind, viewBoxAnchors, emitAnchors]);

  const handleIllustrationAnchors = useCallback(
    (anchors: Record<string, SvgAnchorBox>) => {
      // IllustrationSvgCanvas already projects its boxes through its own activeCamera
      emitAnchors(anchors, false);
    },
    [emitAnchors]
  );

  // Check whether any sub-part matches activeFocusKey in the current scene
  const hasKnownFocusMatch = useMemo(() => {
    if (!shouldDimOthers || !activeFocusKey) return false;
    return Boolean(viewBoxAnchors[activeFocusKey]);
  }, [shouldDimOthers, activeFocusKey, viewBoxAnchors]);

  const partOpacity = useCallback(
    (partKeys: string[]): number => {
      if (!shouldDimOthers || !hasKnownFocusMatch || !activeFocusKey) return 1;
      return partKeys.includes(activeFocusKey) ? 1 : 0.22;
    },
    [shouldDimOthers, hasKnownFocusMatch, activeFocusKey]
  );

  // Manual pan & wheel handlers for geometric scenes (never fights user interaction)
  const getViewBoxScaleFactor = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return 1;
    const rect = svg.getBoundingClientRect();
    const s = Math.min(rect.width / 680, rect.height / 480);
    return s > 0 ? s : 1;
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if ((e.target as HTMLElement)?.closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const cur = manualCam || autoCamera;
    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startTx: cur.tx,
      startTy: cur.ty,
      zoom: cur.zoom,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragStateRef.current;
    if (!ds || !ds.active || ds.pointerId !== e.pointerId) return;
    const dist = Math.hypot(e.clientX - ds.startClientX, e.clientY - ds.startClientY);
    if (dist < 3 && !manualCam) return;
    const pxPerVb = getViewBoxScaleFactor();
    const dx = (e.clientX - ds.startClientX) / pxPerVb;
    const dy = (e.clientY - ds.startClientY) / pxPerVb;
    setManualCam({
      zoom: ds.zoom,
      tx: clamp(ds.startTx + dx, -560, 420),
      ty: clamp(ds.startTy + dy, -420, 340),
    });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragStateRef.current;
    if (!ds || ds.pointerId !== e.pointerId) return;
    dragStateRef.current = null;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const scale = Math.min(rect.width / 680, rect.height / 480);
    const originX = rect.left + (rect.width - 680 * scale) / 2;
    const originY = rect.top + (rect.height - 480 * scale) / 2;
    const cursorVx = clamp((e.clientX - originX) / scale, 0, 680);
    const cursorVy = clamp((e.clientY - originY) / scale, 0, 480);

    const cur = manualCam || autoCamera;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const nextZoom = clamp(cur.zoom * factor, 0.75, 2.5);
    const ratio = nextZoom / cur.zoom;

    setManualCam({
      zoom: nextZoom,
      tx: cursorVx - (cursorVx - cur.tx) * ratio,
      ty: cursorVy - (cursorVy - cur.ty) * ratio,
    });
  };

  const cameraGroupStyle: React.CSSProperties = {
    transform: `translate(${activeCamera.tx.toFixed(2)}px, ${activeCamera.ty.toFixed(
      2
    )}px) scale(${activeCamera.zoom.toFixed(4)})`,
    transformOrigin: '0px 0px',
    transition: isDragging ? 'none' : 'transform 0.68s cubic-bezier(0.22, 1, 0.36, 1)',
  };

  // ==================== SCENE 0: SMART OBJECT ILLUSTRATION (STROKE-BY-STROKE) ====================
  if (kind === 'illustration') {
    return (
      <IllustrationSvgCanvas
        params={params}
        stepIndex={stepIndex}
        focusPart={focusPart}
        focusTarget={focusTarget}
        cameraZoom={cameraZoom}
        dimInactiveParts={dimInactiveParts}
        flowType={effectiveFlowType}
        flowSpeed={effectiveFlowSpeed}
        flowReverse={effectiveFlowReverse}
        continuousBeat={continuousBeat}
        isPlaying={isPlaying}
        wrapperRef={wrapperRef}
        svgRef={svgRef}
        onAnchorsReady={handleIllustrationAnchors}
      />
    );
  }

  // ==================== SCENE 1: PHOTOSYNTHESIS (BLANK PAPER -> TRUE STROKE DRAW) ====================
  if (kind === 'photosynthesis') {
    const t0 = stepIndex > 0 ? 1 : continuousBeat;
    const sunOutlineP = subPhase(t0, 0.0, 0.22);
    const sunFillAlpha = subPhase(t0, 0.14, 0.25);
    const rayPs = [0, 1, 2].map((i) => subPhase(t0, 0.24 + i * 0.05, 0.38 + i * 0.04));
    const leafStrokeP = subPhase(t0, 0.46, 0.8);
    const leafFillAlpha = subPhase(t0, 0.72, 0.85);
    const veinP = subPhase(t0, 0.8, 0.9);
    const chloroP = subPhase(t0, 0.88, 0.98);

    const showStep1 = stepIndex >= 1;
    const t1 = stepIndex > 1 ? 1 : stepIndex === 1 ? continuousBeat : 0;
    const soilAlpha = showStep1 ? subPhase(t1, 0.0, 0.12) : 0;
    const stemP = showStep1 ? subPhase(t1, 0.06, 0.28) : 0;
    const rootP = showStep1 ? subPhase(t1, 0.24, 0.42) : 0;
    const waterP = showStep1 ? subPhase(t1, 0.42, 0.62) : 0;
    const co2LineP = showStep1 ? subPhase(t1, 0.62, 0.84) : 0;
    const co2TextAlpha = showStep1 ? subPhase(t1, 0.78, 0.95) : 0;

    const showStep2 = stepIndex >= 2;
    const t2 = stepIndex > 2 ? 1 : stepIndex === 2 ? continuousBeat : 0;
    const o2LineP = showStep2 ? subPhase(t2, 0.0, 0.3) : 0;
    const o2CircleP = showStep2 ? subPhase(t2, 0.26, 0.46) : 0;
    const o2TextAlpha = showStep2 ? subPhase(t2, 0.38, 0.5) : 0;
    const glucLineP = showStep2 ? subPhase(t2, 0.48, 0.72) : 0;
    const glucBoxP = showStep2 ? subPhase(t2, 0.68, 0.9) : 0;
    const glucTextAlpha = showStep2 ? subPhase(t2, 0.82, 0.96) : 0;

    return (
      <div
        ref={wrapperRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={handleWheel}
        className={`relative w-full h-full bg-transparent flex items-center justify-center p-2 sm:p-3 overflow-hidden touch-none select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {manualCam && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setManualCam(null);
            }}
            className="absolute bottom-14 right-3 z-30 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
          >
            1.0x tiklash
          </button>
        )}

        <svg ref={svgRef} viewBox="0 0 680 480" className="w-full h-full max-h-[540px]">
          <g style={cameraGroupStyle}>
            {/* STEP 0: Sun + Rays */}
            {sunOutlineP > 0 && (
              <g
                style={{
                  opacity: partOpacity(['sun_rays']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <circle
                  cx="105"
                  cy="95"
                  r="36"
                  pathLength={100}
                  fill={`rgba(253, 224, 71, ${sunFillAlpha.toFixed(2)})`}
                  stroke="#F59E0B"
                  strokeWidth="3"
                  strokeDasharray="100"
                  strokeDashoffset={100 * (1 - sunOutlineP)}
                  transform="rotate(-90 105 95)"
                />
                {sunFillAlpha > 0.05 && (
                  <text
                    x="105"
                    y="100"
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="700"
                    fill="#92400E"
                    fontFamily="DM Sans, sans-serif"
                    opacity={sunFillAlpha}
                  >
                    Quyosh
                  </text>
                )}
                {[0, 1, 2].map((i) => {
                  const rp = rayPs[i];
                  if (rp <= 0.01) return null;
                  const x1 = 142 + i * 8;
                  const y1 = 115 + i * 16;
                  const x2 = 252 + i * 14;
                  const y2 = 182 + i * 16;
                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={lerp(x1, x2, rp)}
                      y2={lerp(y1, y2, rp)}
                      stroke="#F59E0B"
                      strokeWidth="3"
                      strokeDasharray="8 6"
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>
            )}

            {/* STEP 1 ONLY (0% rendered on Step 0): Soil, Stem, Roots, H₂O & CO₂ */}
            {showStep1 && (
              <g
                style={{
                  opacity: partOpacity(['water_roots']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {soilAlpha > 0.01 && (
                  <path
                    d="M 110 405 Q 340 385 570 405 L 570 435 L 110 435 Z"
                    fill="rgba(180, 130, 80, 0.16)"
                    opacity={soilAlpha}
                  />
                )}
                {stemP > 0.01 && (
                  <path
                    d="M 335 395 Q 332 330 335 280"
                    pathLength={100}
                    fill="none"
                    stroke="#15803D"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray="100"
                    strokeDashoffset={100 * (1 - stemP)}
                  />
                )}
                {rootP > 0.01 && (
                  <>
                    <path
                      d="M 335 395 Q 290 412 250 422"
                      pathLength={100}
                      fill="none"
                      stroke="#92400E"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeDasharray="100"
                      strokeDashoffset={100 * (1 - rootP)}
                    />
                    <path
                      d="M 335 395 Q 375 415 415 422"
                      pathLength={100}
                      fill="none"
                      stroke="#92400E"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeDasharray="100"
                      strokeDashoffset={100 * (1 - rootP)}
                    />
                  </>
                )}
                {waterP > 0.01 && (
                  <g opacity={waterP}>
                    <circle cx="290" cy="340" r="8" fill="#38BDF8" stroke="#0284C7" strokeWidth="2" />
                    <circle cx="305" cy="312" r="6" fill="#38BDF8" stroke="#0284C7" strokeWidth="2" />
                    <text
                      x="185"
                      y="345"
                      fontSize="14"
                      fontWeight="700"
                      fill="#0369A1"
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      H₂O (Suv) ↑
                    </text>
                  </g>
                )}
                {co2LineP > 0.01 && (
                  <g>
                    <line
                      x1="118"
                      y1="255"
                      x2={lerp(118, 222, co2LineP)}
                      y2="255"
                      stroke="#475569"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    {co2LineP > 0.86 && (
                      <polyline
                        points="212,248 224,255 212,262"
                        fill="none"
                        stroke="#475569"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {co2TextAlpha > 0.02 && (
                      <text
                        x="115"
                        y="242"
                        fontSize="14"
                        fontWeight="700"
                        fill="#334155"
                        fontFamily="IBM Plex Mono, monospace"
                        opacity={co2TextAlpha}
                      >
                        CO₂ (Karbonat angidrid)
                      </text>
                    )}
                  </g>
                )}
              </g>
            )}

            {/* STEP 0: Central Leaf & Chloroplast (Drawn via strokeDashoffset) */}
            {leafStrokeP > 0 && (
              <g
                style={{
                  opacity: partOpacity(['leaf_chloroplast']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <path
                  d="M 235 268 Q 330 148 455 192 Q 418 312 235 268 Z"
                  pathLength={100}
                  fill={`rgba(34, 197, 94, ${(0.22 * leafFillAlpha).toFixed(3)})`}
                  stroke="#16A34A"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                  strokeDasharray="100"
                  strokeDashoffset={100 * (1 - leafStrokeP)}
                />
                {veinP > 0.01 && (
                  <path
                    d="M 238 267 Q 345 228 446 196"
                    pathLength={100}
                    fill="none"
                    stroke="#15803D"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="100"
                    strokeDashoffset={100 * (1 - veinP)}
                  />
                )}
                {chloroP > 0.01 && (
                  <g opacity={chloroP}>
                    <ellipse
                      cx="348"
                      cy="230"
                      rx="34"
                      ry="18"
                      fill="rgba(22, 163, 74, 0.25)"
                      stroke="#15803D"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />
                    <text
                      x="348"
                      y="234"
                      textAnchor="middle"
                      fontSize="12.5"
                      fontWeight="700"
                      fill="#14532D"
                      fontFamily="DM Sans, sans-serif"
                    >
                      Xloroplast
                    </text>
                  </g>
                )}
              </g>
            )}

            {/* STEP 2+ ONLY (0% rendered on Steps 0 & 1): O₂ + Glucose */}
            {showStep2 && (
              <g
                style={{
                  opacity: partOpacity(['oxygen_out']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {o2LineP > 0.01 && (
                  <>
                    <line
                      x1="442"
                      y1="208"
                      x2={lerp(442, 538, o2LineP)}
                      y2={lerp(208, 156, o2LineP)}
                      stroke="#0EA5E9"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    {o2LineP > 0.85 && (
                      <polyline
                        points="525,154 540,155 533,168"
                        fill="none"
                        stroke="#0EA5E9"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </>
                )}
                {o2CircleP > 0.01 && (
                  <circle
                    cx="556"
                    cy="145"
                    r="22"
                    pathLength={100}
                    fill={`rgba(14, 165, 233, ${(0.16 * o2TextAlpha).toFixed(3)})`}
                    stroke="#0284C7"
                    strokeWidth="2.4"
                    strokeDasharray="100"
                    strokeDashoffset={100 * (1 - o2CircleP)}
                  />
                )}
                {o2TextAlpha > 0.02 && (
                  <text
                    x="556"
                    y="150"
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="700"
                    fill="#0369A1"
                    fontFamily="IBM Plex Mono, monospace"
                    opacity={o2TextAlpha}
                  >
                    O₂
                  </text>
                )}

                {glucLineP > 0.01 && (
                  <>
                    <line
                      x1="432"
                      y1="252"
                      x2={lerp(432, 535, glucLineP)}
                      y2={lerp(252, 292, glucLineP)}
                      stroke="#F97316"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    {glucLineP > 0.85 && (
                      <polyline
                        points="528,280 537,293 522,295"
                        fill="none"
                        stroke="#F97316"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </>
                )}
                {glucBoxP > 0.01 && (
                  <rect
                    x="498"
                    y="302"
                    width="128"
                    height="38"
                    rx="12"
                    pathLength={100}
                    fill={`rgba(249, 115, 22, ${(0.14 * glucTextAlpha).toFixed(3)})`}
                    stroke="#EA580C"
                    strokeWidth="2.2"
                    strokeDasharray="100"
                    strokeDashoffset={100 * (1 - glucBoxP)}
                  />
                )}
                {glucTextAlpha > 0.02 && (
                  <text
                    x="562"
                    y="326"
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="700"
                    fill="#9A3412"
                    fontFamily="DM Sans, sans-serif"
                    opacity={glucTextAlpha}
                  >
                    Glyukoza (Ozuqa)
                  </text>
                )}
              </g>
            )}

            {effectiveFlowType !== 'none' && (
              <SvgFlowOverlay
                paths={[
                  ...(rayPs[2] > 0.7 || stepIndex > 0
                    ? [
                        {
                          id: 'photo-sun-0',
                          d: 'M 142 115 L 252 182',
                          kind: 'wave' as const,
                          color: '#F59E0B',
                          dotColor: '#FDE047',
                          opacity: partOpacity(['sun_rays']),
                        },
                        {
                          id: 'photo-sun-1',
                          d: 'M 150 131 L 266 198',
                          kind: 'wave' as const,
                          color: '#F59E0B',
                          dotColor: '#FDE047',
                          opacity: partOpacity(['sun_rays']),
                        },
                      ]
                    : []),
                  ...(showStep1 && (waterP > 0.7 || stepIndex > 1)
                    ? [
                        {
                          id: 'photo-water',
                          d: 'M 335 395 Q 332 330 335 280',
                          kind: 'wire' as const,
                          color: '#0EA5E9',
                          dotColor: '#38BDF8',
                          opacity: partOpacity(['water_roots']),
                        },
                      ]
                    : []),
                  ...(showStep1 && (co2LineP > 0.85 || stepIndex > 1)
                    ? [
                        {
                          id: 'photo-co2',
                          d: 'M 118 255 L 222 255',
                          kind: 'wire' as const,
                          color: '#475569',
                          dotColor: '#94A3B8',
                          opacity: partOpacity(['water_roots']),
                        },
                      ]
                    : []),
                  ...(showStep2 && (o2LineP > 0.85 || stepIndex > 2)
                    ? [
                        {
                          id: 'photo-o2',
                          d: 'M 442 208 L 538 156',
                          kind: 'wire' as const,
                          color: '#0EA5E9',
                          dotColor: '#7DD3FC',
                          opacity: partOpacity(['oxygen_out']),
                        },
                      ]
                    : []),
                  ...(showStep2 && (glucLineP > 0.85 || stepIndex > 2)
                    ? [
                        {
                          id: 'photo-gluc',
                          d: 'M 432 252 L 535 292',
                          kind: 'wire' as const,
                          color: '#F97316',
                          dotColor: '#FDBA74',
                          opacity: partOpacity(['oxygen_out']),
                        },
                      ]
                    : []),
                ]}
                flowType={effectiveFlowType}
                flowSpeed={effectiveFlowSpeed}
                flowReverse={effectiveFlowReverse}
                isPlaying={isPlaying}
              />
            )}
          </g>
        </svg>
      </div>
    );
  }

  // ==================== SCENE 2: SKY SCATTERING (ZERO GHOST LINES BEFORE DRAW) ====================
  if (kind === 'sky_scattering') {
    const t0 = stepIndex > 0 ? 1 : continuousBeat;
    const sunP = subPhase(t0, 0.0, 0.24);
    const sunFill = subPhase(t0, 0.14, 0.25);
    const beamP = subPhase(t0, 0.24, 0.54);
    const arcP = subPhase(t0, 0.54, 0.84);
    const molAlpha = subPhase(t0, 0.84, 0.96);

    const showStep1 = stepIndex >= 1;
    const t1 = stepIndex > 1 ? 1 : stepIndex === 1 ? continuousBeat : 0;
    const bw1 = showStep1 ? subPhase(t1, 0.0, 0.34) : 0;
    const bw2 = showStep1 ? subPhase(t1, 0.25, 0.56) : 0;
    const bw3 = showStep1 ? subPhase(t1, 0.45, 0.74) : 0;
    const blueBoxP = showStep1 ? subPhase(t1, 0.72, 0.94) : 0;

    const showStep2 = stepIndex >= 2;
    const t2 = stepIndex > 2 ? 1 : stepIndex === 2 ? continuousBeat : 0;
    const redWaveP = showStep2 ? subPhase(t2, 0.0, 0.58) : 0;
    const redTextAlpha = showStep2 ? subPhase(t2, 0.42, 0.6) : 0;
    const obsAlpha = showStep2 ? subPhase(t2, 0.6, 0.94) : 0;

    return (
      <div
        ref={wrapperRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={handleWheel}
        className={`relative w-full h-full bg-transparent flex items-center justify-center p-2 sm:p-3 overflow-hidden touch-none select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {manualCam && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setManualCam(null);
            }}
            className="absolute bottom-14 right-3 z-30 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
          >
            1.0x tiklash
          </button>
        )}

        <svg ref={svgRef} viewBox="0 0 680 480" className="w-full h-full max-h-[540px]">
          <g style={cameraGroupStyle}>
            {/* Atmosphere Arc */}
            {arcP > 0.01 && (
              <g
                style={{
                  opacity: partOpacity(['atmosphere_molecules']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <path
                  d="M 180 390 Q 380 85 590 390"
                  fill={`rgba(59, 130, 246, ${(0.1 * arcP).toFixed(3)})`}
                  stroke="rgba(37, 99, 235, 0.38)"
                  strokeWidth="2.5"
                  strokeDasharray="7 5"
                  opacity={arcP}
                />
                {arcP > 0.55 && (
                  <text
                    x="385"
                    y="108"
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="700"
                    fill="#1D4ED8"
                    fontFamily="DM Sans, sans-serif"
                    opacity={subPhase(arcP, 0.55, 1)}
                  >
                    Atmosfera (N₂ va O₂ molekulalari)
                  </text>
                )}
              </g>
            )}

            {/* Sun & White Beam */}
            <g
              style={{
                opacity: partOpacity(['sun_beam']),
                transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {sunP > 0.01 && (
                <g>
                  <circle
                    cx="95"
                    cy="120"
                    r="34"
                    pathLength={100}
                    fill={`rgba(253, 224, 71, ${sunFill.toFixed(2)})`}
                    stroke="#F59E0B"
                    strokeWidth="3"
                    strokeDasharray="100"
                    strokeDashoffset={100 * (1 - sunP)}
                  />
                  {sunFill > 0.05 && (
                    <text
                      x="95"
                      y="125"
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="700"
                      fill="#92400E"
                      fontFamily="DM Sans, sans-serif"
                      opacity={sunFill}
                    >
                      Quyosh
                    </text>
                  )}
                </g>
              )}

              {beamP > 0.01 && (
                <g>
                  <line
                    x1="128"
                    y1="138"
                    x2={lerp(128, 310, beamP)}
                    y2={lerp(138, 226, beamP)}
                    stroke="#0F172A"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                  {beamP > 0.55 && (
                    <text
                      x="195"
                      y="152"
                      fontSize="12.5"
                      fontWeight="700"
                      fill="#334155"
                      transform="rotate(24 195 152)"
                      opacity={subPhase(beamP, 0.55, 0.95)}
                    >
                      Oq yorug‘lik
                    </text>
                  )}
                </g>
              )}
            </g>

            {molAlpha > 0.01 && (
              <g
                opacity={molAlpha * partOpacity(['atmosphere_molecules', 'blue_scatter'])}
                style={{ transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}
              >
                <circle
                  cx="320"
                  cy="230"
                  r="22"
                  fill="rgba(59, 130, 246, 0.18)"
                  stroke="#2563EB"
                  strokeWidth="2.5"
                />
                <circle cx="314" cy="226" r="6" fill="#2563EB" />
                <circle cx="326" cy="234" r="6" fill="#60A5FA" />
              </g>
            )}

            {/* STEP 1 ONLY: Short Blue Waves Scattering Everywhere */}
            {showStep1 && (
              <g
                style={{
                  opacity: partOpacity(['blue_scatter']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {bw1 > 0.01 && (
                  <path
                    d="M 332 214 Q 355 185 375 198 T 418 158 T 465 135"
                    pathLength={100}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeDasharray="100"
                    strokeDashoffset={100 * (1 - bw1)}
                  />
                )}
                {bw2 > 0.01 && (
                  <path
                    d="M 326 208 Q 332 170 350 156 T 378 122"
                    pathLength={100}
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeDasharray="100"
                    strokeDashoffset={100 * (1 - bw2)}
                  />
                )}
                {bw3 > 0.01 && (
                  <path
                    d="M 335 232 Q 368 232 392 212 T 450 202"
                    pathLength={100}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeDasharray="100"
                    strokeDashoffset={100 * (1 - bw3)}
                  />
                )}
                {blueBoxP > 0.01 && (
                  <g opacity={blueBoxP}>
                    <rect
                      x="385"
                      y="116"
                      width="165"
                      height="32"
                      rx="10"
                      fill="rgba(37, 99, 235, 0.12)"
                      stroke="#2563EB"
                      strokeWidth="1.8"
                    />
                    <text
                      x="467"
                      y="136"
                      textAnchor="middle"
                      fontSize="12.5"
                      fontWeight="700"
                      fill="#1E40AF"
                      fontFamily="DM Sans, sans-serif"
                    >
                      Qisqa ko‘k to‘lqin sochiladi!
                    </text>
                  </g>
                )}
              </g>
            )}

            {/* STEP 2+ ONLY: Long Red Waves + Observer */}
            {showStep2 && (
              <g
                style={{
                  opacity: partOpacity(['red_pass']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {redWaveP > 0.01 && (
                  <path
                    d="M 338 242 Q 385 270 432 246 T 528 264 T 585 282"
                    pathLength={100}
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="100"
                    strokeDashoffset={100 * (1 - redWaveP)}
                  />
                )}
                {redTextAlpha > 0.02 && (
                  <text
                    x="515"
                    y="314"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill="#B91C1C"
                    fontFamily="DM Sans, sans-serif"
                    opacity={redTextAlpha}
                  >
                    Uzun qizil to‘lqin to‘g‘ri o‘tadi
                  </text>
                )}
                {obsAlpha > 0.01 && (
                  <g opacity={obsAlpha}>
                    <ellipse cx="445" cy="390" rx="165" ry="16" fill="rgba(16, 185, 129, 0.18)" />
                    <circle cx="445" cy="350" r="14" fill="#1E293B" />
                    <path d="M 428 386 Q 445 362 462 386" fill="#2563EB" />
                    <text
                      x="445"
                      y="422"
                      textAnchor="middle"
                      fontSize="12.5"
                      fontWeight="600"
                      fill="#0F172A"
                    >
                      Kuzatuvchi osmonni moviy ko‘radi
                    </text>
                  </g>
                )}
              </g>
            )}

            {effectiveFlowType !== 'none' && (
              <SvgFlowOverlay
                paths={[
                  ...(beamP > 0.8 || stepIndex > 0
                    ? [
                        {
                          id: 'sky-beam',
                          d: 'M 128 138 L 310 226',
                          kind: 'wave' as const,
                          color: '#F59E0B',
                          dotColor: '#FEF08A',
                          opacity: partOpacity(['sun_beam']),
                        },
                      ]
                    : []),
                  ...(showStep1 && (bw1 > 0.7 || stepIndex > 1)
                    ? [
                        {
                          id: 'sky-blue-1',
                          d: 'M 332 214 Q 355 185 375 198 T 418 158 T 465 135',
                          kind: 'wave' as const,
                          color: '#2563EB',
                          dotColor: '#60A5FA',
                          opacity: partOpacity(['blue_scatter']),
                        },
                        {
                          id: 'sky-blue-2',
                          d: 'M 326 208 Q 332 170 350 156 T 378 122',
                          kind: 'wave' as const,
                          color: '#3B82F6',
                          dotColor: '#93C5FD',
                          opacity: partOpacity(['blue_scatter']),
                        },
                      ]
                    : []),
                  ...(showStep2 && (redWaveP > 0.7 || stepIndex > 2)
                    ? [
                        {
                          id: 'sky-red',
                          d: 'M 338 242 Q 385 270 432 246 T 528 264 T 585 282',
                          kind: 'wave' as const,
                          color: '#EF4444',
                          dotColor: '#FCA5A5',
                          opacity: partOpacity(['red_pass']),
                        },
                      ]
                    : []),
                ]}
                flowType={effectiveFlowType}
                flowSpeed={effectiveFlowSpeed}
                flowReverse={effectiveFlowReverse}
                isPlaying={isPlaying}
              />
            )}
          </g>
        </svg>
      </div>
    );
  }

  // ==================== SCENE 3: PYTHAGORAS (ZERO GHOST SQUARES BEFORE DRAW) ====================
  if (kind === 'pythagoras') {
    const a = sliderValues.a ?? params.a ?? 3;
    const b = sliderValues.b ?? params.b ?? 4;
    const c = Math.sqrt(a * a + b * b);

    const maxSpan = a + b + 2;
    const scale = Math.min(27, 250 / maxSpan);
    const ox = 250;
    const oy = 275;

    const cx = ox;
    const cy = oy;
    const ax = ox;
    const ay = oy - a * scale;
    const bx = ox + b * scale;
    const by = oy;

    const sqA = `${cx},${cy} ${ax},${ay} ${ax - a * scale},${ay} ${cx - a * scale},${cy}`;
    const sqB = `${cx},${cy} ${bx},${by} ${bx},${by + b * scale} ${cx},${cy + b * scale}`;

    const dx = bx - ax;
    const dy = by - ay;
    const nx = dy;
    const ny = -dx;
    const sqC = `${ax},${ay} ${bx},${by} ${bx + nx},${by + ny} ${ax + nx},${ay + ny}`;

    const showAB =
      stepIndex >= 1 || highlights.includes('squares_ab') || highlights.includes('square_c');
    const showC = stepIndex >= 2 || highlights.includes('square_c');

    const t0 = stepIndex > 0 ? 1 : continuousBeat;
    const vC = t0 >= 0.01 || stepIndex > 0;
    const vA = t0 >= 0.07 || stepIndex > 0;
    const vB = t0 >= 0.13 || stepIndex > 0;
    const side1P = subPhase(t0, 0.18, 0.34);
    const side2P = subPhase(t0, 0.34, 0.5);
    const side3P = subPhase(t0, 0.5, 0.68);
    const triFillAlpha = subPhase(t0, 0.68, 0.86);

    const t1 = stepIndex > 1 ? 1 : stepIndex === 1 ? continuousBeat : 0;
    const sqAStrokeP = showAB ? (stepIndex >= 2 ? 1 : subPhase(t1, 0.02, 0.44)) : 0;
    const sqAFillAlpha = showAB ? (stepIndex >= 2 ? 1 : subPhase(t1, 0.35, 0.48)) : 0;
    const sqBStrokeP = showAB ? (stepIndex >= 2 ? 1 : subPhase(t1, 0.48, 0.92)) : 0;
    const sqBFillAlpha = showAB ? (stepIndex >= 2 ? 1 : subPhase(t1, 0.82, 0.96)) : 0;

    const t2 = stepIndex > 2 ? 1 : stepIndex === 2 ? continuousBeat : 0;
    const sqCStrokeP = showC ? (stepIndex >= 3 ? 1 : subPhase(t2, 0.02, 0.78)) : 0;
    const sqCFillAlpha = showC ? (stepIndex >= 3 ? 1 : subPhase(t2, 0.66, 0.86)) : 0;

    return (
      <div
        ref={wrapperRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={handleWheel}
        className={`relative w-full h-full bg-transparent flex items-center justify-center p-2 sm:p-3 overflow-hidden touch-none select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {manualCam && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setManualCam(null);
            }}
            className="absolute bottom-14 right-3 z-30 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
          >
            1.0x tiklash
          </button>
        )}

        <svg ref={svgRef} viewBox="0 0 680 480" className="w-full h-full max-h-[540px]">
          <g style={cameraGroupStyle}>
            {/* Square a² — ONLY rendered when step >= 1 */}
            {sqAStrokeP > 0.01 && (
              <g
                style={{
                  opacity: partOpacity(['square_a', 'squares_ab', 'leg_a']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <polygon
                  points={sqA}
                  pathLength={100}
                  fill={`rgba(37, 99, 235, ${(0.16 * sqAFillAlpha).toFixed(3)})`}
                  stroke="#2563EB"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                  strokeDasharray="100"
                  strokeDashoffset={100 * (1 - sqAStrokeP)}
                />
                {sqAFillAlpha > 0.05 && (
                  <text
                    x={cx - (a * scale) / 2}
                    y={cy - (a * scale) / 2}
                    fill="#1D4ED8"
                    fontSize="15"
                    fontWeight="600"
                    fontFamily="IBM Plex Mono, monospace"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    opacity={sqAFillAlpha}
                  >
                    a² = {(a * a).toFixed(1)}
                  </text>
                )}
              </g>
            )}

            {/* Square b² */}
            {sqBStrokeP > 0.01 && (
              <g
                style={{
                  opacity: partOpacity(['square_b', 'squares_ab', 'leg_b']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <polygon
                  points={sqB}
                  pathLength={100}
                  fill={`rgba(244, 63, 94, ${(0.16 * sqBFillAlpha).toFixed(3)})`}
                  stroke="#F43F5E"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                  strokeDasharray="100"
                  strokeDashoffset={100 * (1 - sqBStrokeP)}
                />
                {sqBFillAlpha > 0.05 && (
                  <text
                    x={cx + (b * scale) / 2}
                    y={cy + (b * scale) / 2}
                    fill="#BE123C"
                    fontSize="15"
                    fontWeight="600"
                    fontFamily="IBM Plex Mono, monospace"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    opacity={sqBFillAlpha}
                  >
                    b² = {(b * b).toFixed(1)}
                  </text>
                )}
              </g>
            )}

            {/* Square c² */}
            {sqCStrokeP > 0.01 && (
              <g
                style={{
                  opacity: partOpacity(['square_c', 'hypotenuse_c']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <polygon
                  points={sqC}
                  pathLength={100}
                  fill={`rgba(245, 158, 11, ${(0.2 * sqCFillAlpha).toFixed(3)})`}
                  stroke="#F59E0B"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeDasharray="100"
                  strokeDashoffset={100 * (1 - sqCStrokeP)}
                />
                {sqCFillAlpha > 0.05 && (
                  <text
                    x={(ax + bx + bx + nx + ax + nx) / 4}
                    y={(ay + by + by + ny + ay + ny) / 4}
                    fill="#B45309"
                    fontSize="16"
                    fontWeight="700"
                    fontFamily="IBM Plex Mono, monospace"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    opacity={sqCFillAlpha}
                  >
                    c² = {(c * c).toFixed(1)}
                  </text>
                )}
              </g>
            )}

            {/* Central Right Triangle */}
            <g
              style={{
                opacity: partOpacity(['triangle_center', 'leg_a', 'leg_b', 'hypotenuse_c']),
                transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {triFillAlpha > 0.02 && (
                <polygon
                  points={`${ax},${ay} ${bx},${by} ${cx},${cy}`}
                  fill="rgba(16, 185, 129, 0.14)"
                  opacity={triFillAlpha}
                />
              )}

              {side1P > 0.01 && (
                <line
                  x1={cx}
                  y1={cy}
                  x2={ax}
                  y2={lerp(cy, ay, side1P)}
                  stroke="#0F172A"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              )}
              {side2P > 0.01 && (
                <line
                  x1={cx}
                  y1={cy}
                  x2={lerp(cx, bx, side2P)}
                  y2={by}
                  stroke="#0F172A"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              )}
              {side3P > 0.01 && (
                <line
                  x1={ax}
                  y1={ay}
                  x2={lerp(ax, bx, side3P)}
                  y2={lerp(ay, by, side3P)}
                  stroke="#0F172A"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              )}

              {side2P > 0.2 && (
                <polyline
                  points={`${cx},${cy - 14} ${cx + 14},${cy - 14} ${cx + 14},${cy}`}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.4"
                  opacity={subPhase(side2P, 0.2, 0.8)}
                />
              )}

              {vC && <circle cx={cx} cy={cy} r="4.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />}
              {vA && <circle cx={ax} cy={ay} r="4.5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1.5" />}
              {vB && <circle cx={bx} cy={by} r="4.5" fill="#F43F5E" stroke="#FFFFFF" strokeWidth="1.5" />}

              {side1P > 0.75 && (
                <text
                  x={cx - 12}
                  y={(ay + cy) / 2}
                  fill="#1D4ED8"
                  fontSize="14"
                  fontWeight="600"
                  fontFamily="IBM Plex Mono, monospace"
                  textAnchor="end"
                >
                  a={a}
                </text>
              )}
              {side2P > 0.75 && (
                <text
                  x={(cx + bx) / 2}
                  y={cy + 20}
                  fill="#BE123C"
                  fontSize="14"
                  fontWeight="600"
                  fontFamily="IBM Plex Mono, monospace"
                  textAnchor="middle"
                >
                  b={b}
                </text>
              )}
              {side3P > 0.75 && (
                <text
                  x={(ax + bx) / 2 + 12}
                  y={(ay + by) / 2 - 8}
                  fill="#B45309"
                  fontSize="14"
                  fontWeight="700"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  c={c.toFixed(1)}
                </text>
              )}
            </g>

            {effectiveFlowType !== 'none' && side3P > 0.9 && (
              <SvgFlowOverlay
                paths={
                  [
                    {
                      id: 'pyth-tri',
                      d: `M ${cx} ${cy} L ${ax} ${ay} L ${bx} ${by} Z`,
                      color: '#10B981',
                      dotColor: '#34D399',
                      opacity: partOpacity(['triangle_center', 'leg_a', 'leg_b', 'hypotenuse_c']),
                    },
                    ...(sqAStrokeP > 0.9
                      ? [
                          {
                            id: 'pyth-sq-a',
                            d: `M ${cx} ${cy} L ${ax} ${ay} L ${ax - a * scale} ${ay} L ${cx - a * scale} ${cy} Z`,
                            color: '#2563EB',
                            dotColor: '#60A5FA',
                            opacity: partOpacity(['square_a', 'squares_ab', 'leg_a']),
                          },
                        ]
                      : []),
                    ...(sqCStrokeP > 0.9
                      ? [
                          {
                            id: 'pyth-sq-c',
                            d: `M ${ax} ${ay} L ${bx} ${by} L ${bx + nx} ${by + ny} L ${ax + nx} ${ay + ny} Z`,
                            color: '#F59E0B',
                            dotColor: '#FDE047',
                            opacity: partOpacity(['square_c', 'hypotenuse_c']),
                          },
                        ]
                      : []),
                  ] as FlowPathSpec[]
                }
                flowType={effectiveFlowType}
                flowSpeed={effectiveFlowSpeed}
                flowReverse={effectiveFlowReverse}
                isPlaying={isPlaying}
              />
            )}
          </g>
        </svg>
      </div>
    );
  }

  // ==================== SCENE 4: CIRCLE & UNIT CIRCLE (ZERO GHOST SECTOR) ====================
  if (kind === 'circle' || kind === 'unit_circle') {
    const r = sliderValues.radius ?? params.radius ?? 5;
    const angleDeg = sliderValues.angle_deg ?? params.angle_deg ?? 90;
    const R = Math.min(155, Math.max(70, r * 18));
    const cx = 340;
    const cy = 240;
    const rad = (angleDeg * Math.PI) / 180;
    const px = cx + R * Math.cos(-rad);
    const py = cy + R * Math.sin(-rad);
    const largeArc = angleDeg > 180 ? 1 : 0;

    const t0 = stepIndex > 0 ? 1 : continuousBeat;
    const axisP = subPhase(t0, 0.0, 0.22);
    const circleP = subPhase(t0, 0.22, 0.72);
    const radiusP = subPhase(t0, 0.72, 0.9);
    const sectorAlpha = subPhase(t0, 0.84, 0.98);

    return (
      <div
        ref={wrapperRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={handleWheel}
        className={`relative w-full h-full bg-transparent flex items-center justify-center p-3 overflow-hidden touch-none select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {manualCam && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setManualCam(null);
            }}
            className="absolute bottom-14 right-3 z-30 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
          >
            1.0x tiklash
          </button>
        )}

        <svg ref={svgRef} viewBox="0 0 680 480" className="w-full h-full max-h-[540px]">
          <g style={cameraGroupStyle}>
            {axisP > 0.01 && (
              <g
                style={{
                  opacity: partOpacity(['center_O']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <line
                  x1={lerp(cx, 60, axisP)}
                  y1={cy}
                  x2={lerp(cx, 620, axisP)}
                  y2={cy}
                  stroke="rgba(100,116,139,0.35)"
                  strokeWidth="1.3"
                />
                <line
                  x1={cx}
                  y1={lerp(cy, 30, axisP)}
                  x2={cx}
                  y2={lerp(cy, 450, axisP)}
                  stroke="rgba(100,116,139,0.35)"
                  strokeWidth="1.3"
                />
              </g>
            )}

            {sectorAlpha > 0.01 && (
              <path
                d={`M ${cx} ${cy} L ${cx + R} ${cy} A ${R} ${R} 0 ${largeArc} 0 ${px} ${py} Z`}
                fill="rgba(244, 63, 94, 0.18)"
                stroke="#F43F5E"
                strokeWidth="2.4"
                opacity={sectorAlpha * partOpacity(['sector_arc', 'angle_alpha'])}
                style={{ transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}
              />
            )}

            {circleP > 0.01 && (
              <circle
                cx={cx}
                cy={cy}
                r={R}
                pathLength={100}
                fill={`rgba(37, 99, 235, ${(0.08 * subPhase(circleP, 0.85, 1)).toFixed(3)})`}
                stroke="#2563EB"
                strokeWidth="3"
                strokeDasharray="100"
                strokeDashoffset={100 * (1 - circleP)}
                style={{
                  opacity: partOpacity(['sector_arc', 'center_O']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            )}

            {axisP > 0.5 && (
              <circle
                cx={cx}
                cy={cy}
                r="5.5"
                fill="#0F172A"
                style={{
                  opacity: partOpacity(['center_O', 'radius_r']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            )}

            {radiusP > 0.01 && (
              <g
                style={{
                  opacity: partOpacity(['radius_r', 'angle_alpha']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <line
                  x1={cx}
                  y1={cy}
                  x2={lerp(cx, px, radiusP)}
                  y2={lerp(cy, py, radiusP)}
                  stroke="#F59E0B"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                {radiusP > 0.8 && (
                  <circle cx={px} cy={py} r="6.5" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.5" />
                )}
                <text
                  x={cx + R / 2}
                  y={cy + 20}
                  fill="#1D4ED8"
                  fontSize="14"
                  fontWeight="600"
                  fontFamily="IBM Plex Mono, monospace"
                  textAnchor="middle"
                  opacity={radiusP}
                >
                  r = {r}
                </text>
              </g>
            )}

            {sectorAlpha > 0.1 && (
              <text
                x={cx + 38}
                y={cy - 18}
                fill="#BE123C"
                fontSize="14"
                fontWeight="600"
                fontFamily="IBM Plex Mono, monospace"
                opacity={sectorAlpha * partOpacity(['angle_alpha', 'sector_arc'])}
                style={{ transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}
              >
                α = {angleDeg}°
              </text>
            )}

            {effectiveFlowType !== 'none' && circleP > 0.9 && (
              <SvgFlowOverlay
                paths={[
                  {
                    id: 'circle-flow-orbit',
                    d: `M ${cx - R} ${cy} A ${R} ${R} 0 1 0 ${cx + R} ${cy} A ${R} ${R} 0 1 0 ${cx - R} ${cy} Z`,
                    color: '#2563EB',
                    dotColor: '#60A5FA',
                    opacity: partOpacity(['sector_arc', 'center_O']),
                  },
                  {
                    id: 'circle-flow-radius',
                    d: `M ${cx} ${cy} L ${px} ${py}`,
                    color: '#F59E0B',
                    dotColor: '#FDE047',
                    opacity: partOpacity(['radius_r', 'angle_alpha']),
                  },
                ]}
                flowType={effectiveFlowType}
                flowSpeed={effectiveFlowSpeed}
                flowReverse={effectiveFlowReverse}
                isPlaying={isPlaying}
              />
            )}
          </g>
        </svg>
      </div>
    );
  }

  // ==================== SCENE 4B: REGULAR N-GON POLYGON ====================
  if (kind === 'polygon') {
    const n = Math.round(clamp(sliderValues.sides ?? params.sides ?? 6, 3, 16));
    const sideLen = sliderValues.a ?? params.a ?? 4;
    const rParam = sliderValues.radius ?? params.radius;
    const R = rParam
      ? clamp(72 + rParam * 14, 100, 162)
      : clamp(92 + sideLen * 7.5, 108, 160);
    const cx = 340;
    const cy = 242;
    const startAngle = -Math.PI / 2 + (n % 2 === 0 ? Math.PI / n : 0);

    const vertices = Array.from({ length: n }, (_, i) => {
      const ang = startAngle + (i * 2 * Math.PI) / n;
      return {
        x: cx + R * Math.cos(ang),
        y: cy + R * Math.sin(ang),
        lx: cx + (R + 20) * Math.cos(ang),
        ly: cy + (R + 20) * Math.sin(ang),
        ang,
      };
    });

    const interiorAngleDeg = ((n - 2) * 180) / n;
    const centralAngleDeg = 360 / n;
    const diagCount = (n * (n - 3)) / 2;
    const perimeter = n * sideLen;
    const area = (n * sideLen * sideLen) / (4 * Math.tan(Math.PI / n));

    const t0 = stepIndex > 0 ? 1 : continuousBeat;
    const plottedCount =
      stepIndex > 0 ? n : Math.min(n, Math.floor(subPhase(t0, 0.0, 0.28) * n + 0.99));
    const edgeTotalP = stepIndex > 0 ? 1 : subPhase(t0, 0.28, 0.84);
    const fillAlpha = stepIndex > 0 ? 1 : subPhase(t0, 0.84, 0.98);

    const showAngles =
      stepIndex >= 1 || highlights.includes('angles') || highlights.includes('center');
    const t1 = stepIndex > 1 ? 1 : stepIndex === 1 ? continuousBeat : 0;
    const rad1P = showAngles ? (stepIndex >= 2 ? 1 : subPhase(t1, 0.02, 0.35)) : 0;
    const rad2P = showAngles ? (stepIndex >= 2 ? 1 : subPhase(t1, 0.35, 0.68)) : 0;
    const angleArcP = showAngles ? (stepIndex >= 2 ? 1 : subPhase(t1, 0.68, 0.96)) : 0;

    const showDiagonals =
      stepIndex >= 2 || highlights.includes('diagonals') || highlights.includes('apothem');
    const t2 = stepIndex > 2 ? 1 : stepIndex === 2 ? continuousBeat : 0;
    const diagP = showDiagonals ? (stepIndex >= 3 ? 1 : subPhase(t2, 0.04, 0.82)) : 0;
    const circumP = showAngles ? (stepIndex >= 2 ? 1 : subPhase(t1, 0.15, 0.85)) : 0;

    const polyPoints = vertices.map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ');

    const baseIdx = Math.floor(n / 2);
    const baseA = vertices[baseIdx % n];
    const baseB = vertices[(baseIdx + 1) % n];

    const vPrev = vertices[n - 1];
    const v0 = vertices[0];
    const vNext = vertices[1];
    const arcR = 26;
    const aPrev = Math.atan2(vPrev.y - v0.y, vPrev.x - v0.x);
    const aNext = Math.atan2(vNext.y - v0.y, vNext.x - v0.x);
    const arcP1 = { x: v0.x + arcR * Math.cos(aPrev), y: v0.y + arcR * Math.sin(aPrev) };
    const arcP2 = { x: v0.x + arcR * Math.cos(aNext), y: v0.y + arcR * Math.sin(aNext) };

    const apothemMid = {
      x: (baseA.x + baseB.x) / 2,
      y: (baseA.y + baseB.y) / 2,
    };

    return (
      <div
        ref={wrapperRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={handleWheel}
        className={`relative w-full h-full bg-transparent flex items-center justify-center p-3 overflow-hidden touch-none select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {manualCam && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setManualCam(null);
            }}
            className="absolute bottom-14 right-3 z-30 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
          >
            1.0x tiklash
          </button>
        )}

        <svg ref={svgRef} viewBox="0 0 680 480" className="w-full h-full max-h-[540px]">
          <g style={cameraGroupStyle}>
            {circumP > 0.02 && (
              <circle
                cx={cx}
                cy={cy}
                r={R}
                pathLength={100}
                fill="none"
                stroke="rgba(148, 163, 184, 0.45)"
                strokeWidth="1.5"
                strokeDasharray="6 5"
                opacity={circumP * partOpacity(['center_O', 'diagonals'])}
                style={{ transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}
              />
            )}

            {fillAlpha > 0.02 && (
              <polygon
                points={polyPoints}
                fill="rgba(37, 99, 235, 0.11)"
                opacity={fillAlpha * partOpacity(['center_O', 'diagonals'])}
                style={{ transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}
              />
            )}

            {diagP > 0.01 &&
              vertices.slice(2, n - 1).map((targetV, idx) => {
                const count = Math.max(1, n - 3);
                const segP = subPhase(diagP, idx / count, (idx + 1) / count);
                if (segP <= 0.01) return null;
                return (
                  <line
                    key={`diag-${idx}`}
                    x1={v0.x}
                    y1={v0.y}
                    x2={lerp(v0.x, targetV.x, segP)}
                    y2={lerp(v0.y, targetV.y, segP)}
                    stroke="rgba(124, 58, 237, 0.65)"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    style={{
                      opacity: partOpacity(['diagonals']),
                      transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  />
                );
              })}

            {diagP > 0.5 && (
              <g
                opacity={subPhase(diagP, 0.5, 0.95) * partOpacity(['apothem', 'diagonals'])}
                style={{ transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}
              >
                <line
                  x1={cx}
                  y1={cy}
                  x2={apothemMid.x}
                  y2={apothemMid.y}
                  stroke="#10B981"
                  strokeWidth="2.2"
                  strokeDasharray="4 4"
                />
                <text
                  x={apothemMid.x + 10}
                  y={(cy + apothemMid.y) / 2}
                  fill="#047857"
                  fontSize="12.5"
                  fontWeight="700"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  r₀
                </text>
              </g>
            )}

            <g
              style={{
                opacity: partOpacity(['interior_angle', 'vertex_0', 'diagonals', 'center_O']),
                transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {vertices.map((va, idx) => {
                const vb = vertices[(idx + 1) % n];
                const segP = subPhase(edgeTotalP, idx / n, (idx + 1) / n);
                if (segP <= 0.01) return null;
                return (
                  <line
                    key={`edge-${idx}`}
                    x1={va.x}
                    y1={va.y}
                    x2={lerp(va.x, vb.x, segP)}
                    y2={lerp(va.y, vb.y, segP)}
                    stroke="#2563EB"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                );
              })}
            </g>

            {rad1P > 0.01 && (
              <g
                style={{
                  opacity: partOpacity(['center_O', 'interior_angle', 'vertex_0']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <circle cx={cx} cy={cy} r="4.8" fill="#0F172A" />
                <text
                  x={cx - 12}
                  y={cy + 16}
                  fill="#0F172A"
                  fontSize="12.5"
                  fontWeight="700"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  O
                </text>
                <line
                  x1={cx}
                  y1={cy}
                  x2={lerp(cx, v0.x, rad1P)}
                  y2={lerp(cy, v0.y, rad1P)}
                  stroke="#F59E0B"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </g>
            )}
            {rad2P > 0.01 && (
              <line
                x1={cx}
                y1={cy}
                x2={lerp(cx, vNext.x, rad2P)}
                y2={lerp(cy, vNext.y, rad2P)}
                stroke="#F59E0B"
                strokeWidth="2.4"
                strokeLinecap="round"
                style={{
                  opacity: partOpacity(['center_O', 'interior_angle']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            )}
            {angleArcP > 0.02 && (
              <g
                opacity={angleArcP * partOpacity(['interior_angle', 'vertex_0', 'center_O'])}
                style={{ transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}
              >
                <path
                  d={`M ${arcP1.x.toFixed(1)} ${arcP1.y.toFixed(1)} A ${arcR} ${arcR} 0 0 0 ${arcP2.x.toFixed(1)} ${arcP2.y.toFixed(1)}`}
                  fill="none"
                  stroke="#F43F5E"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <text
                  x={lerp(v0.x, cx, 0.34)}
                  y={lerp(v0.y, cy, 0.34) + 4}
                  textAnchor="middle"
                  fill="#BE123C"
                  fontSize="12.5"
                  fontWeight="700"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  α={Number.isInteger(interiorAngleDeg) ? interiorAngleDeg : interiorAngleDeg.toFixed(1)}°
                </text>
                <text
                  x={cx + 46 * Math.cos((v0.ang + vNext.ang) / 2)}
                  y={cy + 46 * Math.sin((v0.ang + vNext.ang) / 2) + 4}
                  textAnchor="middle"
                  fill="#B45309"
                  fontSize="11.5"
                  fontWeight="700"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {Number.isInteger(centralAngleDeg) ? centralAngleDeg : centralAngleDeg.toFixed(1)}°
                </text>
              </g>
            )}

            {vertices.slice(0, plottedCount).map((v, idx) => (
              <g
                key={`vtx-${idx}`}
                style={{
                  opacity:
                    idx === 0
                      ? partOpacity(['vertex_0', 'interior_angle', 'diagonals'])
                      : partOpacity(['diagonals', 'center_O']),
                  transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <circle
                  cx={v.x}
                  cy={v.y}
                  r="5.2"
                  fill={idx === 0 ? '#F97316' : '#2563EB'}
                  stroke="#FFFFFF"
                  strokeWidth="1.6"
                />
                {n <= 10 && (
                  <text
                    x={v.lx}
                    y={v.ly + 4}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill="#0F172A"
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    A{idx + 1}
                  </text>
                )}
              </g>
            ))}

            {fillAlpha > 0.2 && (
              <g
                opacity={fillAlpha * (shouldDimOthers ? 0.25 : 1)}
                style={{ transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}
              >
                <text
                  x={(baseA.x + baseB.x) / 2}
                  y={Math.max(baseA.y, baseB.y) + 26}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="700"
                  fill="#1D4ED8"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  a = {sideLen} ({n}-burchak)
                </text>
                <text
                  x={cx}
                  y={442}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="600"
                  fill="#475569"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  P = {perimeter.toFixed(1)} · S ≈ {area.toFixed(1)} · Diagonallar: {diagCount}
                </text>
              </g>
            )}

            {effectiveFlowType !== 'none' && edgeTotalP > 0.9 && vertices.length >= 3 && (
              <SvgFlowOverlay
                paths={[
                  {
                    id: 'poly-flow-perimeter',
                    d:
                      vertices
                        .map((v, i) => `${i === 0 ? 'M' : 'L'} ${v.x.toFixed(1)} ${v.y.toFixed(1)}`)
                        .join(' ') + ' Z',
                    color: '#2563EB',
                    dotColor: '#38BDF8',
                    opacity: partOpacity(['interior_angle', 'vertex_0', 'diagonals', 'center_O']),
                  },
                ]}
                flowType={effectiveFlowType}
                flowSpeed={effectiveFlowSpeed}
                flowReverse={effectiveFlowReverse}
                isPlaying={isPlaying}
              />
            )}
          </g>
        </svg>
      </div>
    );
  }

  // ==================== SCENE 5: GENERAL TRIANGLE (ZERO GHOST FILL BEFORE DRAW) ====================
  const a = sliderValues.a ?? params.a ?? 5;
  const b = sliderValues.b ?? params.b ?? 6;
  const c = sliderValues.c ?? params.c ?? 7;
  const valid = a + b > c && a + c > b && b + c > a;

  if (!valid) {
    return (
      <div
        ref={wrapperRef}
        className="w-full h-full bg-transparent flex items-center justify-center p-6 text-rose-700 text-sm font-medium text-center"
      >
        Uchburchak tengsizligi buzildi: har ikki tomon yig‘indisi uchinchi tomondan katta bo‘lishi kerak (a={a}, b={b}, c={c}).
      </div>
    );
  }

  const cosA = (b * b + c * c - a * a) / (2 * b * c);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const cxRaw = b * cosA;
  const cyRaw = b * sinA;

  const maxDim = Math.max(c, cxRaw, cyRaw, 1);
  const scale = 270 / maxDim;
  const offsetX = 340 - (c * scale) / 2;
  const offsetY = 355;

  const Ax = offsetX;
  const Ay = offsetY;
  const Bx = offsetX + c * scale;
  const By = offsetY;
  const Cx = offsetX + cxRaw * scale;
  const Cy = offsetY - cyRaw * scale;

  const t0 = stepIndex > 0 ? 1 : continuousBeat;
  const showVA = t0 >= 0.01 || stepIndex > 0;
  const showVB = t0 >= 0.07 || stepIndex > 0;
  const showVC = t0 >= 0.13 || stepIndex > 0;
  const e1 = subPhase(t0, 0.18, 0.36);
  const e2 = subPhase(t0, 0.36, 0.54);
  const e3 = subPhase(t0, 0.54, 0.72);
  const fillAlpha = subPhase(t0, 0.72, 0.9);

  return (
    <div
      ref={wrapperRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={handleWheel}
      className={`relative w-full h-full bg-transparent flex items-center justify-center p-3 overflow-hidden touch-none select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {manualCam && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setManualCam(null);
          }}
          className="absolute bottom-14 right-3 z-30 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
        >
          1.0x tiklash
        </button>
      )}

      <svg ref={svgRef} viewBox="0 0 680 480" className="w-full h-full max-h-[540px]">
        <g style={cameraGroupStyle}>
          {fillAlpha > 0.02 && (
            <polygon
              points={`${Ax},${Ay} ${Bx},${By} ${Cx},${Cy}`}
              fill="rgba(37, 99, 235, 0.14)"
              opacity={fillAlpha * partOpacity(['triangle_center'])}
              style={{ transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}
            />
          )}
          {e1 > 0.01 && (
            <line
              x1={Ax}
              y1={Ay}
              x2={lerp(Ax, Bx, e1)}
              y2={lerp(Ay, By, e1)}
              stroke="#2563EB"
              strokeWidth="3"
              strokeLinecap="round"
              style={{
                opacity: partOpacity(['vertex_A', 'vertex_B', 'triangle_center']),
                transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          )}
          {e2 > 0.01 && (
            <line
              x1={Bx}
              y1={By}
              x2={lerp(Bx, Cx, e2)}
              y2={lerp(By, Cy, e2)}
              stroke="#2563EB"
              strokeWidth="3"
              strokeLinecap="round"
              style={{
                opacity: partOpacity(['vertex_B', 'vertex_C', 'triangle_center']),
                transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          )}
          {e3 > 0.01 && (
            <line
              x1={Cx}
              y1={Cy}
              x2={lerp(Cx, Ax, e3)}
              y2={lerp(Cy, Ay, e3)}
              stroke="#2563EB"
              strokeWidth="3"
              strokeLinecap="round"
              style={{
                opacity: partOpacity(['vertex_C', 'vertex_A', 'triangle_center']),
                transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          )}

          {showVA && (
            <circle
              cx={Ax}
              cy={Ay}
              r="5.5"
              fill="#2563EB"
              stroke="#FFFFFF"
              strokeWidth="1.5"
              style={{ opacity: partOpacity(['vertex_A', 'triangle_center']) }}
            />
          )}
          {showVB && (
            <circle
              cx={Bx}
              cy={By}
              r="5.5"
              fill="#10B981"
              stroke="#FFFFFF"
              strokeWidth="1.5"
              style={{ opacity: partOpacity(['vertex_B', 'triangle_center']) }}
            />
          )}
          {showVC && (
            <circle
              cx={Cx}
              cy={Cy}
              r="5.5"
              fill="#F43F5E"
              stroke="#FFFFFF"
              strokeWidth="1.5"
              style={{ opacity: partOpacity(['vertex_C', 'triangle_center']) }}
            />
          )}

          {showVA && (
            <text
              x={Ax - 14}
              y={Ay + 18}
              fill="#0F172A"
              fontSize="14"
              fontWeight="700"
              fontFamily="IBM Plex Mono, monospace"
              style={{ opacity: partOpacity(['vertex_A', 'triangle_center']) }}
            >
              A
            </text>
          )}
          {showVB && (
            <text
              x={Bx + 10}
              y={By + 18}
              fill="#0F172A"
              fontSize="14"
              fontWeight="700"
              fontFamily="IBM Plex Mono, monospace"
              style={{ opacity: partOpacity(['vertex_B', 'triangle_center']) }}
            >
              B
            </text>
          )}
          {showVC && (
            <text
              x={Cx}
              y={Cy - 14}
              fill="#BE123C"
              fontSize="14"
              fontWeight="700"
              fontFamily="IBM Plex Mono, monospace"
              textAnchor="middle"
              style={{ opacity: partOpacity(['vertex_C', 'triangle_center']) }}
            >
              C
            </text>
          )}

          {e1 > 0.75 && (
            <text
              x={(Ax + Bx) / 2}
              y={Ay + 24}
              fill="#1D4ED8"
              fontSize="13"
              fontWeight="600"
              fontFamily="IBM Plex Mono, monospace"
              textAnchor="middle"
              style={{ opacity: partOpacity(['vertex_A', 'vertex_B', 'triangle_center']) }}
            >
              c = {c}
            </text>
          )}
          {e2 > 0.75 && (
            <text
              x={(Bx + Cx) / 2 + 14}
              y={(By + Cy) / 2}
              fill="#047857"
              fontSize="13"
              fontWeight="600"
              fontFamily="IBM Plex Mono, monospace"
              style={{ opacity: partOpacity(['vertex_B', 'vertex_C', 'triangle_center']) }}
            >
              a = {a}
            </text>
          )}
          {e3 > 0.75 && (
            <text
              x={(Ax + Cx) / 2 - 14}
              y={(Ay + Cy) / 2}
              fill="#BE123C"
              fontSize="13"
              fontWeight="600"
              fontFamily="IBM Plex Mono, monospace"
              textAnchor="end"
              style={{ opacity: partOpacity(['vertex_C', 'vertex_A', 'triangle_center']) }}
            >
              b = {b}
            </text>
          )}

          {effectiveFlowType !== 'none' && e3 > 0.9 && (
            <SvgFlowOverlay
              paths={[
                {
                  id: 'tri-flow-perimeter',
                  d: `M ${Ax.toFixed(1)} ${Ay.toFixed(1)} L ${Bx.toFixed(1)} ${By.toFixed(1)} L ${Cx.toFixed(1)} ${Cy.toFixed(1)} Z`,
                  color: '#2563EB',
                  dotColor: '#38BDF8',
                  opacity: partOpacity(['triangle_center', 'vertex_A', 'vertex_B', 'vertex_C']),
                },
              ]}
              flowType={effectiveFlowType}
              flowSpeed={effectiveFlowSpeed}
              flowReverse={effectiveFlowReverse}
              isPlaying={isPlaying}
            />
          )}
        </g>
      </svg>
    </div>
  );
};
