import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FlowType, RenderParams } from '../../types/tutor';
import { generateProceduralObjectSvg, sanitizeSvgString } from '../../lib/objectCatalog';
import { SvgFlowOverlay, svgElementToPathD, type FlowPathSpec } from './SvgFlowOverlay';

export interface SvgAnchorBox {
  vx: number;
  vy: number;
  width?: number;
  height?: number;
}

interface IllustrationSvgCanvasProps {
  params: RenderParams;
  stepIndex: number;
  focusPart?: string;
  focusTarget?: string;
  cameraZoom?: number;
  dimInactiveParts?: boolean;
  flowType?: FlowType;
  flowSpeed?: number;
  flowReverse?: boolean;
  continuousBeat: number;
  isPlaying: boolean;
  wrapperRef: React.MutableRefObject<HTMLDivElement | null>;
  svgRef: React.MutableRefObject<SVGSVGElement | null>;
  onAnchorsReady?: (anchors: Record<string, SvgAnchorBox>) => void;
}

interface MeasuredShape {
  el: SVGGeometryElement;
  startLen: number;
  len: number;
  origStroke: string;
  origStrokeWidth: string;
  origStrokeDasharray: string;
  origFill: string;
  origFillOpacity: string;
  origOpacity: string;
  partId?: string;
  partIdx?: string;
  domId?: string;
  boxVx?: SvgAnchorBox;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function parseViewBox(vb: string): { vx: number; vy: number; vw: number; vh: number } {
  const parts = vb
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
    return { vx: parts[0], vy: parts[1], vw: parts[2], vh: parts[3] };
  }
  return { vx: 0, vy: 0, vw: 200, vh: 200 };
}

function extractInnerSvgContent(rawSvg: string): { innerHtml: string; viewBox: string } | null {
  const sanitized = sanitizeSvgString(rawSvg);
  if (!sanitized) return null;

  if (typeof DOMParser === 'undefined') {
    const innerMatch = sanitized.svg_data.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    return {
      innerHtml: innerMatch ? innerMatch[1] : '',
      viewBox: sanitized.viewBox,
    };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitized.svg_data, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return null;

    // Strip any unsafe tags at DOM level as defense-in-depth
    svgEl.querySelectorAll('script, foreignObject, iframe, image').forEach((n) => n.remove());
    const vbAttr = svgEl.getAttribute('viewBox') || sanitized.viewBox;
    return {
      innerHtml: svgEl.innerHTML,
      viewBox: vbAttr,
    };
  } catch {
    return null;
  }
}

function mergeAnchorBoxes(boxes: SvgAnchorBox[]): SvgAnchorBox | null {
  if (boxes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    const hw = (b.width ?? 24) / 2;
    const hh = (b.height ?? 24) / 2;
    minX = Math.min(minX, b.vx - hw);
    minY = Math.min(minY, b.vy - hh);
    maxX = Math.max(maxX, b.vx + hw);
    maxY = Math.max(maxY, b.vy + hh);
  }
  return {
    vx: (minX + maxX) / 2,
    vy: (minY + maxY) / 2,
    width: Math.max(24, maxX - minX),
    height: Math.max(24, maxY - minY),
  };
}

function matchesFocusPart(shape: MeasuredShape, idx: number, total: number, focusKey: string): boolean {
  const key = focusKey.toLowerCase().trim();
  if (!key) return false;

  if (shape.partId && shape.partId.toLowerCase() === key) return true;
  if (shape.partIdx !== undefined && (`part_${shape.partIdx}` === key || shape.partIdx === key)) {
    return true;
  }
  if (shape.domId && shape.domId.toLowerCase() === key) return true;

  // Spatial fallback matching for SVGs without explicit data-part-id attributes
  const b = shape.boxVx;
  if (!b) return false;

  if (/left|coil_1|primary/.test(key)) return b.vx < 335;
  if (/right|coil_2|secondary/.test(key)) return b.vx > 345;
  if (/center|core|nucleus/.test(key)) return Math.abs(b.vx - 340) <= 75 && Math.abs(b.vy - 232) <= 85;
  if (/top|bulb|aorta|spark|head/.test(key)) return b.vy < 225;
  if (/bottom|base|crankshaft|ventricle|roots/.test(key)) return b.vy > 245;

  const partMatch = key.match(/^part_(\d+)$/);
  if (partMatch && total > 0) {
    const pNum = Number(partMatch[1]);
    const bucket = Math.min(2, Math.floor((idx / total) * 3));
    return bucket === Math.min(2, pNum);
  }

  return false;
}

export const IllustrationSvgCanvas: React.FC<IllustrationSvgCanvasProps> = ({
  params,
  stepIndex,
  focusPart,
  focusTarget,
  cameraZoom = 1,
  dimInactiveParts = false,
  flowType = 'none',
  flowSpeed = 1.0,
  flowReverse = false,
  continuousBeat,
  isPlaying,
  wrapperRef,
  svgRef,
  onAnchorsReady,
}) => {
  const groupRef = useRef<SVGGElement | null>(null);
  const measuredRef = useRef<MeasuredShape[]>([]);
  const totalLenRef = useRef<number>(0);
  const tipVxRef = useRef<SvgAnchorBox>({ vx: 340, vy: 232, width: 24, height: 24 });
  const partAnchorsRef = useRef<Record<string, SvgAnchorBox>>({});
  const onAnchorsReadyRef = useRef(onAnchorsReady);
  onAnchorsReadyRef.current = onAnchorsReady;

  const [fetchedSvg, setFetchedSvg] = useState<{ svg_data: string; viewBox: string } | null>(null);
  const [standaloneProgress, setStandaloneProgress] = useState<number>(stepIndex > 0 ? 1 : 0);
  const [measuredVersion, setMeasuredVersion] = useState(0);

  // Manual user pan & zoom state — completely prevents auto-zoom from fighting user drag/scroll
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

  const objectKey = `${params.object_name_en || ''}:${params.object_name_uz || ''}:${stepIndex}`;
  useEffect(() => {
    // Reset manual pan/zoom only when moving to another step or new object
    setManualCam(null);
  }, [objectKey]);

  // Synchronize any native SVG SMIL animations with playback pause/play state
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    try {
      if (isPlaying) {
        svg.unpauseAnimations?.();
      } else {
        svg.pauseAnimations?.();
      }
    } catch {
      // ignore if browser SVG DOM lacks pauseAnimations in test env
    }
  }, [isPlaying, svgRef, measuredVersion]);

  // Resolve SVG dynamically if params only carried object_name_uz / object_name_en
  useEffect(() => {
    if (params.svg_data) {
      setFetchedSvg(null);
      return;
    }
    const query = params.object_name_uz || params.object_name_en || '';
    if (!query) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/objects/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, mode: '2d' }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            object?: { svg_data?: string; viewBox?: string };
          };
          if (!cancelled && data.object?.svg_data) {
            setFetchedSvg({
              svg_data: data.object.svg_data,
              viewBox: data.object.viewBox || '0 0 200 200',
            });
            return;
          }
        }
      } catch {
        // fall back to procedural botanical SVG below
      }
      if (!cancelled) {
        const proc = generateProceduralObjectSvg(
          params.object_name_en || query,
          params.object_name_uz || query
        );
        if (proc) {
          setFetchedSvg({ svg_data: proc.svg_data, viewBox: proc.viewBox });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.svg_data, params.object_name_uz, params.object_name_en]);

  const effectiveSvg = params.svg_data || fetchedSvg?.svg_data || '';

  const parsedSvg = useMemo(() => {
    if (!effectiveSvg) {
      const proc = generateProceduralObjectSvg(
        params.object_name_en || 'tree',
        params.object_name_uz || 'daraxt'
      );
      if (!proc) return null;
      return extractInnerSvgContent(proc.svg_data);
    }
    return extractInnerSvgContent(effectiveSvg);
  }, [effectiveSvg, params.object_name_en, params.object_name_uz]);

  const layout = useMemo(() => {
    const vb = parseViewBox(params.svg_viewbox || parsedSvg?.viewBox || '0 0 200 200');
    const targetBox = 300;
    const fitScale = Math.min(targetBox / vb.vw, targetBox / vb.vh);
    const offsetX = 340 - (vb.vx + vb.vw / 2) * fitScale;
    const offsetY = 232 - (vb.vy + vb.vh / 2) * fitScale;
    return { ...vb, fitScale, offsetX, offsetY };
  }, [params.svg_viewbox, parsedSvg?.viewBox]);

  // Run smooth 1.75s pen-drawing animation when entering step 0 without active playback scrubbing
  useEffect(() => {
    if (stepIndex > 0) {
      setStandaloneProgress(1);
      return;
    }
    if (isPlaying || continuousBeat > 0.03) {
      return;
    }
    let rafId = 0;
    const durationMs = 1750;
    const t0 = performance.now();
    setStandaloneProgress(0.02);

    const tick = (now: number) => {
      const rawT = clamp((now - t0) / durationMs, 0, 1);
      const eased = 1 - Math.pow(1 - rawT, 2.2);
      setStandaloneProgress(eased);
      if (rawT < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [stepIndex, isPlaying, parsedSvg?.innerHtml, continuousBeat > 0.03]);

  const drawProgress = useMemo(() => {
    if (stepIndex > 0) return 1;
    if (isPlaying || continuousBeat > 0.03) {
      return clamp(continuousBeat * 1.18, 0, 1);
    }
    return standaloneProgress;
  }, [stepIndex, isPlaying, continuousBeat, standaloneProgress]);

  // Active focus key for Steps 2 & 3 (disabled on Step 1 and Step 4+)
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
    activeFocusKey && dimInactiveParts && (stepIndex === 1 || stepIndex === 2) && drawProgress >= 0.96
  );

  // Measure all SVG geometry elements via getTotalLength() and getBBox() once inner SVG renders
  useLayoutEffect(() => {
    const g = groupRef.current;
    if (!g || !parsedSvg?.innerHtml) {
      measuredRef.current = [];
      totalLenRef.current = 0;
      partAnchorsRef.current = { overview: { vx: 340, vy: 232, width: 280, height: 260 } };
      setMeasuredVersion((v) => v + 1);
      return;
    }

    const shapeEls = Array.from(
      g.querySelectorAll('path, line, circle, rect, ellipse, polygon, polyline')
    ) as SVGGeometryElement[];

    let acc = 0;
    const items: MeasuredShape[] = [];
    const byPartId: Record<string, SvgAnchorBox[]> = {};
    const byPartIdx: Record<string, SvgAnchorBox[]> = {};
    const leftBoxes: SvgAnchorBox[] = [];
    const rightBoxes: SvgAnchorBox[] = [];
    const centerBoxes: SvgAnchorBox[] = [];
    const topBoxes: SvgAnchorBox[] = [];
    const bottomBoxes: SvgAnchorBox[] = [];
    const allBoxes: SvgAnchorBox[] = [];

    for (const el of shapeEls) {
      if (el.closest('defs, clipPath, mask')) continue;

      let len = 0;
      try {
        len = typeof el.getTotalLength === 'function' ? el.getTotalLength() : 0;
      } catch {
        len = 0;
      }
      if (!Number.isFinite(len) || len <= 0) {
        len = 48;
      }

      let boxVx: SvgAnchorBox | undefined;
      try {
        const bb = el.getBBox();
        if (Number.isFinite(bb.x) && Number.isFinite(bb.y)) {
          boxVx = {
            vx: layout.offsetX + (bb.x + bb.width / 2) * layout.fitScale,
            vy: layout.offsetY + (bb.y + bb.height / 2) * layout.fitScale,
            width: Math.max(14, bb.width * layout.fitScale),
            height: Math.max(14, bb.height * layout.fitScale),
          };
        }
      } catch {
        boxVx = undefined;
      }

      const partId = el.closest('[data-part-id]')?.getAttribute('data-part-id') || undefined;
      const partIdx = el.closest('[data-part]')?.getAttribute('data-part') || undefined;
      const domId = el.getAttribute('id') || el.closest('[id]')?.getAttribute('id') || undefined;

      if (boxVx) {
        allBoxes.push(boxVx);
        if (partId) {
          (byPartId[partId] ||= []).push(boxVx);
        }
        if (partIdx !== undefined) {
          (byPartIdx[`part_${partIdx}`] ||= []).push(boxVx);
        }
        if (domId) {
          (byPartId[domId] ||= []).push(boxVx);
        }
        if (boxVx.vx < 335) leftBoxes.push(boxVx);
        if (boxVx.vx > 345) rightBoxes.push(boxVx);
        if (Math.abs(boxVx.vx - 340) <= 75 && Math.abs(boxVx.vy - 232) <= 85) {
          centerBoxes.push(boxVx);
        }
        if (boxVx.vy < 225) topBoxes.push(boxVx);
        if (boxVx.vy > 245) bottomBoxes.push(boxVx);
      }

      const computed = typeof window !== 'undefined' ? window.getComputedStyle(el) : null;
      const origStroke = el.getAttribute('stroke') || computed?.stroke || 'none';
      const origStrokeWidth = el.getAttribute('stroke-width') || computed?.strokeWidth || '2';
      const origStrokeDasharray = el.getAttribute('stroke-dasharray') || 'none';
      const origFill = el.getAttribute('fill') || computed?.fill || 'none';
      const origFillOpacity = el.getAttribute('fill-opacity') || '1';
      const origOpacity = el.getAttribute('opacity') || '1';

      items.push({
        el,
        startLen: acc,
        len,
        origStroke,
        origStrokeWidth,
        origStrokeDasharray,
        origFill,
        origFillOpacity,
        origOpacity,
        partId,
        partIdx,
        domId,
        boxVx,
      });
      acc += len;
    }

    const partAnchors: Record<string, SvgAnchorBox> = {
      overview: mergeAnchorBoxes(allBoxes) || { vx: 340, vy: 232, width: 280, height: 260 },
    };

    for (const [k, list] of Object.entries(byPartId)) {
      const merged = mergeAnchorBoxes(list);
      if (merged) partAnchors[k] = merged;
    }
    for (const [k, list] of Object.entries(byPartIdx)) {
      const merged = mergeAnchorBoxes(list);
      if (merged) partAnchors[k] = merged;
    }

    const fallbackCenter = mergeAnchorBoxes(centerBoxes) || partAnchors.overview;
    const fallbackLeft = mergeAnchorBoxes(leftBoxes) || partAnchors.overview;
    const fallbackRight = mergeAnchorBoxes(rightBoxes) || partAnchors.overview;
    const fallbackTop = mergeAnchorBoxes(topBoxes) || partAnchors.overview;
    const fallbackBottom = mergeAnchorBoxes(bottomBoxes) || partAnchors.overview;

    partAnchors.detail_center = fallbackCenter;
    partAnchors.detail_left = fallbackLeft;
    partAnchors.detail_right = fallbackRight;
    partAnchors.detail_top = fallbackTop;
    partAnchors.detail_bottom = fallbackBottom;
    if (!partAnchors.core) partAnchors.core = fallbackCenter;
    if (!partAnchors.coil_1) partAnchors.coil_1 = fallbackLeft;
    if (!partAnchors.coil_2) partAnchors.coil_2 = fallbackRight;

    // Synthesize part_0..part_2 tertile anchors if explicit data-part attributes were absent
    if (allBoxes.length > 0) {
      for (let pIdx = 0; pIdx < 3; pIdx++) {
        const key = `part_${pIdx}`;
        if (!partAnchors[key]) {
          const from = Math.floor((pIdx * allBoxes.length) / 3);
          const to = Math.max(from + 1, Math.floor(((pIdx + 1) * allBoxes.length) / 3));
          const merged = mergeAnchorBoxes(allBoxes.slice(from, to));
          if (merged) partAnchors[key] = merged;
        }
        const customId = params.object_parts?.[pIdx]?.partId;
        if (customId && !partAnchors[customId] && partAnchors[key]) {
          partAnchors[customId] = partAnchors[key];
        }
      }
    }

    measuredRef.current = items;
    totalLenRef.current = acc;
    partAnchorsRef.current = partAnchors;
    setMeasuredVersion((v) => v + 1);
  }, [parsedSvg?.innerHtml, layout.fitScale, layout.offsetX, layout.offsetY, params.object_parts]);

  // Compute active Macro-to-Micro camera transform (auto vs manual)
  const autoCamera = useMemo(() => {
    const _v = measuredVersion;
    void _v;
    if ((stepIndex === 1 || stepIndex === 2) && activeFocusKey) {
      const targetAnchor = partAnchorsRef.current[activeFocusKey];
      if (targetAnchor) {
        const zoom = clamp(cameraZoom >= 1.55 ? cameraZoom : 1.74, 1.6, 1.9);
        const pivotX = clamp(targetAnchor.vx, 145, 535);
        const pivotY = clamp(targetAnchor.vy, 105, 360);
        return {
          zoom,
          tx: 340 - pivotX * zoom,
          ty: 232 - pivotY * zoom,
        };
      }
    }
    return { zoom: 1, tx: 0, ty: 0 };
  }, [stepIndex, activeFocusKey, cameraZoom, measuredVersion]);

  const activeCamera = manualCam || autoCamera;

  const projectBoxWithCamera = useCallback(
    (box: SvgAnchorBox): SvgAnchorBox => ({
      vx: activeCamera.tx + box.vx * activeCamera.zoom,
      vy: activeCamera.ty + box.vy * activeCamera.zoom,
      width: (box.width ?? 36) * activeCamera.zoom,
      height: (box.height ?? 36) * activeCamera.zoom,
    }),
    [activeCamera.tx, activeCamera.ty, activeCamera.zoom]
  );

  const buildProjectedAnchors = useCallback((): Record<string, SvgAnchorBox> => {
    const out: Record<string, SvgAnchorBox> = {
      drawing_tip: projectBoxWithCamera(tipVxRef.current),
    };
    for (const [k, box] of Object.entries(partAnchorsRef.current)) {
      out[k] = projectBoxWithCamera(box);
    }
    return out;
  }, [projectBoxWithCamera]);

  // Emit updated projected anchors whenever camera or parts change
  useLayoutEffect(() => {
    if (onAnchorsReadyRef.current) {
      onAnchorsReadyRef.current(buildProjectedAnchors());
    }
  }, [buildProjectedAnchors, measuredVersion]);

  // Apply stroke-dasharray & stroke-dashoffset sequentially + dim inactive parts cleanly
  useLayoutEffect(() => {
    const items = measuredRef.current;
    const totalLen = totalLenRef.current;
    if (items.length === 0 || totalLen <= 0) return;

    const drawnTarget = clamp(drawProgress, 0, 1) * totalLen;
    let activeTip: SvgAnchorBox | null = null;
    const penWidth = Math.max(0.05, 2.2 / Math.max(0.15, layout.fitScale));

    let hasAnyMatchedPart = false;
    const matchedFlags = items.map((item, idx) => {
      if (!shouldDimOthers || !activeFocusKey) return true;
      const m = matchesFocusPart(item, idx, items.length, activeFocusKey);
      if (m) hasAnyMatchedPart = true;
      return m;
    });

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const { el, startLen, len } = item;
      const localP = clamp((drawnTarget - startLen) / len, 0, 1);

      const hasVisibleFill =
        Boolean(item.origFill) &&
        item.origFill !== 'none' &&
        item.origFill !== 'transparent';

      const baseOpacity = Number(item.origOpacity) || 1;
      const isPartActive = !shouldDimOthers || !hasAnyMatchedPart || matchedFlags[i];
      const targetOpacity = isPartActive ? baseOpacity : Math.min(baseOpacity, 0.22);

      el.style.transition = 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)';

      if (localP <= 0.002) {
        el.style.opacity = '0';
        el.style.strokeDasharray = `${len}`;
        el.style.strokeDashoffset = `${len}`;
        el.style.fillOpacity = '0';
      } else if (localP < 0.998) {
        el.style.opacity = `${targetOpacity}`;
        el.style.strokeDasharray = `${len}`;
        el.style.strokeDashoffset = `${len * (1 - localP)}`;

        const hasVisibleStroke =
          item.origStroke &&
          item.origStroke !== 'none' &&
          item.origStroke !== 'transparent';
        if (!hasVisibleStroke) {
          const fallbackInk =
            hasVisibleFill &&
            item.origFill !== '#ffffff' &&
            item.origFill !== '#fff' &&
            item.origFill !== 'rgb(255, 255, 255)'
              ? item.origFill
              : '#1E293B';
          el.style.stroke = fallbackInk;
          el.style.strokeWidth = `${penWidth.toFixed(3)}`;
          el.style.strokeLinecap = 'round';
          el.style.strokeLinejoin = 'round';
        }

        if (hasVisibleFill) {
          const fillReveal = clamp((localP - 0.65) / 0.35, 0, 1);
          const targetFillOp = Number(item.origFillOpacity) || 1;
          el.style.fillOpacity = `${(fillReveal * targetFillOp).toFixed(3)}`;
        } else {
          el.style.fillOpacity = '0';
        }

        if (!activeTip && typeof el.getPointAtLength === 'function') {
          try {
            const pt = el.getPointAtLength(localP * len);
            if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
              activeTip = {
                vx: layout.offsetX + pt.x * layout.fitScale,
                vy: layout.offsetY + pt.y * layout.fitScale,
                width: 24,
                height: 24,
              };
            }
          } catch {
            // ignore shapes that don't support getPointAtLength
          }
        }
      } else {
        el.style.opacity = `${targetOpacity}`;
        el.style.strokeDasharray =
          item.origStrokeDasharray === 'none' ? '' : item.origStrokeDasharray;
        el.style.strokeDashoffset = '0';
        el.style.stroke = '';
        el.style.strokeWidth = '';
        el.style.fillOpacity = item.origFillOpacity === '1' ? '' : item.origFillOpacity;
      }
    }

    tipVxRef.current = activeTip || { vx: 340, vy: 232, width: 24, height: 24 };
    if (onAnchorsReadyRef.current) {
      onAnchorsReadyRef.current(buildProjectedAnchors());
    }
  }, [
    drawProgress,
    layout.fitScale,
    layout.offsetX,
    layout.offsetY,
    shouldDimOthers,
    activeFocusKey,
    buildProjectedAnchors,
  ]);

  // Manual pan (pointer drag) & wheel zoom handlers (never interrupted by auto-zoom)
  const getViewBoxScaleFactor = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return 1;
    const rect = svg.getBoundingClientRect();
    const s = Math.min(rect.width / 680, rect.height / 480);
    return s > 0 ? s : 1;
  }, [svgRef]);

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

  const titleUz = params.object_name_uz
    ? params.object_name_uz.charAt(0).toUpperCase() + params.object_name_uz.slice(1)
    : 'Tasvir';
  const parts = params.object_parts || [];
  const activePartAnchor = activeFocusKey ? partAnchorsRef.current[activeFocusKey] : undefined;

  // Build crisp 2D SVG flow paths in the inner SVG coordinate system (e.g. 0..200)
  const flowPaths = useMemo((): FlowPathSpec[] => {
    const _v = measuredVersion;
    void _v;
    if (!flowType || flowType === 'none') return [];
    if (stepIndex === 0 && drawProgress < 0.88) return [];

    const nameKey = `${params.object_name_en || ''} ${params.object_name_uz || ''}`.toLowerCase();
    const dotR = clamp(2.8 / Math.max(0.55, layout.fitScale), 1.8, 3.6);
    const lineW = clamp(2.4 / Math.max(0.55, layout.fitScale), 1.5, 3.2);
    const dimOp = (partKey: string, keepSubtle = false): number => {
      if (!shouldDimOthers || !activeFocusKey) return 1;
      if (activeFocusKey === partKey) return 1;
      return keepSubtle ? 0.36 : 0.22;
    };

    if (nameKey.includes('transformer') || nameKey.includes('transformator')) {
      return [
        {
          id: 'tx-core-flux',
          d: 'M 62 52 H 138 V 148 H 62 Z',
          kind: 'flux',
          color: '#8B5CF6',
          dotColor: '#C4B5FD',
          strokeWidth: lineW * 0.95,
          opacity: dimOp('core', true),
        },
        {
          id: 'tx-coil-1',
          d: 'M 16 66 H 76 L 42 78 L 76 86 L 42 96 L 76 104 L 42 114 L 76 122 L 42 134 H 16',
          kind: 'wire',
          color: '#F59E0B',
          dotColor: '#FDE047',
          strokeWidth: lineW,
          dotRadius: dotR,
          reverse: flowReverse,
          opacity: dimOp('coil_1'),
        },
        {
          id: 'tx-coil-2',
          d: 'M 184 74 H 124 L 158 86 L 124 98 L 158 110 L 124 126 H 184',
          kind: 'wire',
          color: '#2563EB',
          dotColor: '#60A5FA',
          strokeWidth: lineW,
          dotRadius: dotR,
          reverse: !flowReverse,
          opacity: dimOp('coil_2'),
        },
      ];
    }

    if (nameKey.includes('light bulb') || nameKey.includes('lamp')) {
      return [
        {
          id: 'bulb-filament',
          d: 'M 86 164 V 134 L 84 86 L 91 74 L 97 86 L 103 74 L 109 86 L 116 74 L 114 134 V 164',
          kind: 'wire',
          color: '#F97316',
          dotColor: '#FDE047',
          strokeWidth: lineW,
          dotRadius: dotR,
          reverse: flowReverse,
          opacity: dimOp('filament'),
        },
      ];
    }

    if (nameKey.includes('heart') || nameKey.includes('yurak')) {
      return [
        {
          id: 'heart-aorta',
          d: 'M 92 96 V 34 Q 92 18 112 22 Q 128 26 128 52',
          kind: 'wire',
          color: '#EF4444',
          dotColor: '#FCA5A5',
          strokeWidth: lineW * 1.1,
          dotRadius: dotR,
          reverse: flowReverse,
          opacity: dimOp('aorta'),
        },
        {
          id: 'heart-vein',
          d: 'M 72 38 V 86 Q 72 130 100 154',
          kind: 'wire',
          color: '#3B82F6',
          dotColor: '#93C5FD',
          strokeWidth: lineW,
          dotRadius: dotR,
          reverse: flowReverse,
          opacity: dimOp('atria', true),
        },
      ];
    }

    // Generic SVG geometry fallback: extract longest or focused paths directly from measured elements
    const items = measuredRef.current;
    const candidates = items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.len >= 24);
    const chosen = (
      shouldDimOthers && activeFocusKey
        ? candidates.filter(({ item, idx }) =>
            matchesFocusPart(item, idx, items.length, activeFocusKey)
          )
        : candidates
    )
      .sort((a, b) => b.item.len - a.item.len)
      .slice(0, 3);

    const out: FlowPathSpec[] = [];
    for (const { item, idx } of chosen) {
      const d = svgElementToPathD(item.el);
      if (!d) continue;
      out.push({
        id: `gen-flow-${idx}`,
        d,
        kind: item.origStrokeDasharray !== 'none' ? 'flux' : 'wire',
        color: flowType === 'ac' ? '#F59E0B' : '#0EA5E9',
        dotColor: flowType === 'ac' ? '#FDE047' : '#38BDF8',
        strokeWidth: lineW * 0.9,
        dotRadius: dotR * 0.95,
        opacity: 1,
      });
    }
    return out;
  }, [
    measuredVersion,
    flowType,
    flowReverse,
    stepIndex,
    drawProgress,
    params.object_name_en,
    params.object_name_uz,
    layout.fitScale,
    shouldDimOthers,
    activeFocusKey,
  ]);

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
        <g
          style={{
            transform: `translate(${activeCamera.tx.toFixed(2)}px, ${activeCamera.ty.toFixed(
              2
            )}px) scale(${activeCamera.zoom.toFixed(4)})`,
            transformOrigin: '0px 0px',
            transition: isDragging
              ? 'none'
              : 'transform 0.68s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {/* Subtle ground shadow ellipse when object finishes drawing */}
          <ellipse
            cx="340"
            cy="402"
            rx="124"
            ry="14"
            fill="rgba(15, 23, 42, 0.08)"
            opacity={
              shouldDimOthers
                ? 0.22
                : clamp(drawProgress * 1.4, 0, 1)
            }
            style={{ transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />

          {parsedSvg && (
            <g
              transform={`translate(${layout.offsetX.toFixed(2)}, ${layout.offsetY.toFixed(
                2
              )}) scale(${layout.fitScale.toFixed(4)})`}
            >
              <g
                ref={groupRef}
                dangerouslySetInnerHTML={{ __html: parsedSvg.innerHtml }}
              />
              {flowPaths.length > 0 && (
                <SvgFlowOverlay
                  paths={flowPaths}
                  flowType={flowType}
                  flowSpeed={flowSpeed}
                  flowReverse={flowReverse}
                  isPlaying={isPlaying}
                />
              )}
            </g>
          )}

          {/* Subtle optical highlight ring around focused internal component */}
          {shouldDimOthers && activePartAnchor && (
            <ellipse
              cx={activePartAnchor.vx}
              cy={activePartAnchor.vy}
              rx={clamp((activePartAnchor.width ?? 60) * 0.62, 26, 95)}
              ry={clamp((activePartAnchor.height ?? 60) * 0.62, 26, 95)}
              fill="none"
              stroke="rgba(249, 115, 22, 0.36)"
              strokeWidth={(1.8 / activeCamera.zoom).toFixed(2)}
              strokeDasharray="5 4"
            />
          )}

          {/* Part callout badges fade cleanly when inactive during Macro-to-Micro focus */}
          {stepIndex >= 1 &&
            parts.slice(0, 3).map((part, idx) => {
              const labelPositions = [
                { x: 118, y: 318, tx: 245, ty: 318 },
                { x: 118, y: 175, tx: 255, ty: 205 },
                { x: 562, y: 155, tx: 425, ty: 185 },
              ];
              const pos = labelPositions[idx];
              if (!pos) return null;
              const pKey = part.partId || `part_${idx}`;
              const isFocusedBadge =
                !shouldDimOthers || !activeFocusKey || activeFocusKey === pKey;
              if (activeCamera.zoom > 1.35 && !isFocusedBadge) {
                return null;
              }
              const targetAnchor = partAnchorsRef.current[pKey];
              const targetPtX = targetAnchor ? targetAnchor.vx : pos.tx;
              const targetPtY = targetAnchor ? targetAnchor.vy : pos.ty;
              return (
                <g
                  key={`part-${idx}`}
                  style={{
                    opacity: isFocusedBadge ? 1 : 0.22,
                    transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <line
                    x1={pos.x}
                    y1={pos.y}
                    x2={targetPtX}
                    y2={targetPtY}
                    stroke={isFocusedBadge && shouldDimOthers ? '#EA580C' : '#0F766E'}
                    strokeWidth="1.6"
                    strokeDasharray="4 4"
                  />
                  <circle
                    cx={targetPtX}
                    cy={targetPtY}
                    r="3.8"
                    fill={isFocusedBadge && shouldDimOthers ? '#F97316' : '#10B981'}
                  />
                  <rect
                    x={pos.x - 62}
                    y={pos.y - 14}
                    width="124"
                    height="26"
                    rx="8"
                    fill="rgba(255,255,255,0.92)"
                    stroke={isFocusedBadge && shouldDimOthers ? '#EA580C' : '#0F766E'}
                    strokeWidth="1.4"
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 3}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="#0F172A"
                    fontFamily="DM Sans, sans-serif"
                  >
                    {part.label}
                  </text>
                </g>
              );
            })}
        </g>

        {/* Clean Title Caption */}
        <text
          x="340"
          y="444"
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fill="#0F172A"
          fontFamily="DM Sans, sans-serif"
          opacity={shouldDimOthers ? 0.28 : clamp((drawProgress - 0.35) / 0.4, 0, 1)}
          style={{ transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          {titleUz}
          {params.object_name_en ? ` (${params.object_name_en})` : ''}
        </text>
      </svg>
    </div>
  );
};
