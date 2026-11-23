import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { sanitizeSvgString } from '../../lib/objectCatalog.js';
import { buildRoughFocusEllipsePaths } from '../../lib/roughDiagramHelper.js';
import type { RenderParams, StageAnchorsMap } from '../../types/tutor.js';

interface Custom2DSvgStageProps {
  params: RenderParams;
  stepIndex: number;
  focusPart?: string;
  focusTarget?: string;
  dimInactiveParts?: boolean;
  continuousBeat: number;
  isPlaying: boolean;
  onAnchorsChange?: (anchors: StageAnchorsMap) => void;
}

interface SvgPartBoxVx {
  cx: number;
  cy: number;
  w: number;
  h: number;
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
  return { vx: 0, vy: 0, vw: 600, vh: 360 };
}

function extractSafeInnerSvg(rawSvg: string): { innerHtml: string; viewBox: string } {
  const sanitized = sanitizeSvgString(rawSvg);
  if (!sanitized) {
    return {
      innerHtml:
        '<rect x="60" y="50" width="480" height="260" rx="16" fill="#EFF6FF" stroke="#2563EB" stroke-width="2.5"/>',
      viewBox: '0 0 600 360',
    };
  }

  const purifiedSvg =
    typeof window !== 'undefined'
      ? DOMPurify.sanitize(sanitized.svg_data, {
          USE_PROFILES: { svg: true, svgFilters: true },
          FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed', 'image', 'link'],
          FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onanimationstart'],
        })
      : sanitized.svg_data;

  if (typeof DOMParser === 'undefined') {
    const innerMatch = purifiedSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    return {
      innerHtml: innerMatch ? innerMatch[1] : '',
      viewBox: sanitized.viewBox,
    };
  }
  try {
    const doc = new DOMParser().parseFromString(purifiedSvg, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) {
      return { innerHtml: '', viewBox: sanitized.viewBox };
    }
    svgEl
      .querySelectorAll('script, foreignObject, iframe, image, object, embed')
      .forEach((n) => n.remove());
    return {
      innerHtml: svgEl.innerHTML,
      viewBox: svgEl.getAttribute('viewBox') || sanitized.viewBox,
    };
  } catch {
    return { innerHtml: '', viewBox: sanitized.viewBox };
  }
}

export const Custom2DSvgStage: React.FC<Custom2DSvgStageProps> = ({
  params,
  stepIndex,
  focusPart,
  focusTarget,
  dimInactiveParts = false,
  continuousBeat,
  isPlaying,
  onAnchorsChange,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const contentGroupRef = useRef<SVGGElement | null>(null);
  const partBoxesVxRef = useRef<Record<string, SvgPartBoxVx>>({});
  const onAnchorsChangeRef = useRef(onAnchorsChange);
  onAnchorsChangeRef.current = onAnchorsChange;

  const [revealProgress, setRevealProgress] = useState(0);
  const [partVersion, setPartVersion] = useState(0);
  const [cam, setCam] = useState<{ zoom: number; tx: number; ty: number }>({
    zoom: 1,
    tx: 0,
    ty: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
  } | null>(null);

  const rawSvg = params.custom_svg?.svg || params.svg_data || '';
  const parsed = useMemo(() => extractSafeInnerSvg(rawSvg), [rawSvg]);
  const vb = useMemo(
    () => parseViewBox(params.custom_svg?.viewBox || params.svg_viewbox || parsed.viewBox),
    [params.custom_svg?.viewBox, params.svg_viewbox, parsed.viewBox]
  );

  const labels = params.custom_svg?.labels || [];
  const highlights = params.custom_svg?.highlights || [];

  const activeFocus = useMemo(() => {
    const candidate =
      focusPart ||
      (focusTarget && focusTarget !== 'overview' && focusTarget !== 'drawing_tip'
        ? focusTarget
        : undefined);
    return candidate?.trim() || undefined;
  }, [focusPart, focusTarget]);

  useEffect(() => {
    setCam({ zoom: 1, tx: 0, ty: 0 });
  }, [stepIndex, rawSvg]);

  // Smooth step-entry SVG draw animation
  useEffect(() => {
    if (stepIndex > 0 && continuousBeat > 0.8) {
      setRevealProgress(1);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const p = clamp((now - t0) / duration, 0, 1);
      setRevealProgress(1 - Math.pow(1 - p, 2.2));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setRevealProgress(0.05);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rawSvg, stepIndex]);

  const effectiveProgress = useMemo(() => {
    if (isPlaying) {
      return clamp(Math.max(revealProgress, continuousBeat * 1.25), 0.12, 1);
    }
    return clamp(Math.max(revealProgress, 1), 0, 1);
  }, [isPlaying, revealProgress, continuousBeat]);

  // Extract SVG part bounding boxes & apply progressive drawing + inactive part dimming
  useEffect(() => {
    const g = contentGroupRef.current;
    if (!g) return;

    const partEls = Array.from(
      g.querySelectorAll('[data-part-id], [data-part], [id]')
    ) as SVGGraphicsElement[];
    const nextBoxes: Record<string, SvgPartBoxVx> = {};
    const focusKeyLower = activeFocus?.toLowerCase() || '';
    let hasMatchedPartEl = false;

    partEls.forEach((pEl) => {
      if (pEl.closest('defs, clipPath, mask')) return;
      const pid = pEl.getAttribute('data-part-id') || pEl.getAttribute('id') || '';
      const pIdx = pEl.getAttribute('data-part');
      const keys = [pid, pIdx !== null ? `part_${pIdx}` : ''].filter(Boolean);
      try {
        const bb = pEl.getBBox();
        if (Number.isFinite(bb.x) && Number.isFinite(bb.y) && (bb.width > 0 || bb.height > 0)) {
          const box: SvgPartBoxVx = {
            cx: bb.x + bb.width / 2,
            cy: bb.y + bb.height / 2,
            w: Math.max(24, bb.width),
            h: Math.max(24, bb.height),
          };
          keys.forEach((k) => {
            nextBoxes[k] = box;
            if (
              focusKeyLower &&
              (k.toLowerCase() === focusKeyLower ||
                k.toLowerCase().includes(focusKeyLower) ||
                focusKeyLower.includes(k.toLowerCase()))
            ) {
              hasMatchedPartEl = true;
            }
          });
        }
      } catch {
        // ignore non-rendered elements
      }
    });

    partBoxesVxRef.current = nextBoxes;

    const shouldDimGroups = Boolean(dimInactiveParts && focusKeyLower && hasMatchedPartEl);
    partEls.forEach((pEl) => {
      if (pEl.closest('defs, clipPath, mask')) return;
      const pid = (pEl.getAttribute('data-part-id') || pEl.getAttribute('id') || '').toLowerCase();
      const pIdx = pEl.getAttribute('data-part');
      const pIdxKey = pIdx !== null ? `part_${pIdx}`.toLowerCase() : '';
      const isMatch =
        !shouldDimGroups ||
        (pid && (pid === focusKeyLower || pid.includes(focusKeyLower) || focusKeyLower.includes(pid))) ||
        (pIdxKey && pIdxKey === focusKeyLower);
      pEl.style.transition = 'opacity 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
      pEl.style.opacity = isMatch ? '1' : '0.22';
    });

    const shapes = Array.from(
      g.querySelectorAll('path, line, circle, rect, ellipse, polygon, polyline')
    ) as SVGGeometryElement[];
    shapes.forEach((el, idx) => {
      if (el.closest('defs, clipPath, mask')) return;
      let len = 0;
      try {
        len = typeof el.getTotalLength === 'function' ? el.getTotalLength() : 0;
      } catch {
        len = 0;
      }
      if (!Number.isFinite(len) || len <= 0) return;

      const startAt = (idx / Math.max(1, shapes.length)) * 0.55;
      const localP = clamp((effectiveProgress - startAt) / (1 - startAt), 0, 1);
      if (localP < 0.99) {
        el.style.strokeDasharray = `${len}`;
        el.style.strokeDashoffset = `${len * (1 - localP)}`;
        el.style.opacity = `${clamp(localP * 1.4, 0.15, 1)}`;
      } else {
        el.style.strokeDasharray = el.getAttribute('stroke-dasharray') || '';
        el.style.strokeDashoffset = '';
        el.style.opacity = el.getAttribute('opacity') || '1';
      }
    });

    setPartVersion((v) => v + 1);
  }, [parsed.innerHtml, effectiveProgress, activeFocus, dimInactiveParts]);

  // Emit stage anchors so TeacherStageActor positions smoothly onto both labels & SVG part groups
  const emitAnchors = useCallback(() => {
    const wrapper = wrapperRef.current;
    const svg = svgRef.current;
    const cb = onAnchorsChangeRef.current;
    if (!wrapper || !svg || !cb) return;
    const wrapRect = wrapper.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    if (svgRect.width <= 0 || svgRect.height <= 0) return;

    const scale = Math.min(svgRect.width / vb.vw, svgRect.height / vb.vh);
    const renderedW = vb.vw * scale;
    const renderedH = vb.vh * scale;
    const originX = svgRect.left - wrapRect.left + (svgRect.width - renderedW) / 2;
    const originY = svgRect.top - wrapRect.top + (svgRect.height - renderedH) / 2;
    const cx = vb.vx + vb.vw / 2;
    const cy = vb.vy + vb.vh / 2;

    const toPxX = (sx: number) =>
      originX + ((sx - cx) * cam.zoom + cx + cam.tx - vb.vx) * scale;
    const toPxY = (sy: number) =>
      originY + ((sy - cy) * cam.zoom + cy + cam.ty - vb.vy) * scale;

    const anchors: StageAnchorsMap = {
      overview: {
        x: originX + renderedW / 2,
        y: originY + renderedH / 2,
        width: renderedW * 0.85,
        height: renderedH * 0.85,
      },
      drawing_tip: {
        x: originX + renderedW * 0.52,
        y: originY + renderedH * 0.48,
        width: 28,
        height: 28,
      },
    };

    for (const [k, box] of Object.entries(partBoxesVxRef.current)) {
      anchors[k] = {
        x: toPxX(box.cx),
        y: toPxY(box.cy),
        width: Math.max(28, box.w * scale * cam.zoom),
        height: Math.max(24, box.h * scale * cam.zoom),
      };
    }

    labels.forEach((lbl, idx) => {
      const key = lbl.partId || `part_${idx}`;
      anchors[key] = {
        x: toPxX(lbl.x),
        y: toPxY(lbl.y),
        width: Math.max(68, (anchors[key]?.width ?? 72)),
        height: Math.max(32, (anchors[key]?.height ?? 36)),
        label: lbl.text,
      };
    });

    cb(anchors);
  }, [vb, labels, cam.zoom, cam.tx, cam.ty, partVersion]);

  useEffect(() => {
    const raf = requestAnimationFrame(emitAnchors);
    const ro = new ResizeObserver(emitAnchors);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [emitAnchors]);

  const roughFocusPaths = useMemo(() => {
    const _pv = partVersion;
    void _pv;
    if (!activeFocus) return [];
    const keyLower = activeFocus.toLowerCase();
    const boxEntry = Object.entries(partBoxesVxRef.current).find(([k]) => {
      const kl = k.toLowerCase();
      return kl === keyLower || kl.includes(keyLower) || keyLower.includes(kl);
    });
    if (boxEntry) {
      const b = boxEntry[1];
      return buildRoughFocusEllipsePaths(
        b.cx,
        b.cy,
        clamp(b.w * 0.62, 22, vb.vw * 0.42),
        clamp(b.h * 0.62, 22, vb.vh * 0.42),
        '#F59E0B',
        stepIndex + 19
      );
    }
    const lblMatch = labels.find((l) => l.partId?.toLowerCase() === keyLower);
    if (lblMatch) {
      return buildRoughFocusEllipsePaths(
        lblMatch.x,
        lblMatch.y,
        42,
        24,
        lblMatch.color || '#F59E0B',
        stepIndex + 29
      );
    }
    return [];
  }, [activeFocus, labels, partVersion, stepIndex, vb.vw, vb.vh]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if ((e.target as HTMLElement)?.closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTx: cam.tx,
      startTy: cam.ty,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragRef.current;
    if (!ds || !ds.active || ds.pointerId !== e.pointerId) return;
    const svg = svgRef.current;
    const rect = svg?.getBoundingClientRect();
    const scale = rect ? Math.min(rect.width / vb.vw, rect.height / vb.vh) : 1;
    const dx = (e.clientX - ds.startX) / Math.max(0.2, scale);
    const dy = (e.clientY - ds.startY) / Math.max(0.2, scale);
    setCam((prev) => ({
      ...prev,
      tx: clamp(ds.startTx + dx, -vb.vw * 0.6, vb.vw * 0.6),
      ty: clamp(ds.startTy + dy, -vb.vh * 0.6, vb.vh * 0.6),
    }));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragRef.current;
    if (!ds || ds.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    setCam((prev) => ({
      ...prev,
      zoom: clamp(prev.zoom * factor, 0.75, 2.4),
    }));
  };

  const cx = vb.vx + vb.vw / 2;
  const cy = vb.vy + vb.vh / 2;
  const transformStr = `translate(${cam.tx.toFixed(1)} ${cam.ty.toFixed(
    1
  )}) translate(${cx} ${cy}) scale(${cam.zoom.toFixed(3)}) translate(${-cx} ${-cy})`;

  return (
    <div
      ref={wrapperRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={handleWheel}
      className={`relative w-full h-full bg-transparent flex items-center justify-center p-2 sm:p-4 overflow-hidden touch-none select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      aria-label="Videodan tiklangan 2D chizma doskasi"
    >
      {(cam.zoom !== 1 || Math.abs(cam.tx) > 2 || Math.abs(cam.ty) > 2) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCam({ zoom: 1, tx: 0, ty: 0 });
          }}
          className="absolute bottom-14 right-3 z-30 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
        >
          1.0x tiklash
        </button>
      )}

      <svg
        ref={svgRef}
        viewBox={`${vb.vx} ${vb.vy} ${vb.vw} ${vb.vh}`}
        className="w-full h-full max-h-[540px]"
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={transformStr}>
          <g
            ref={contentGroupRef}
            dangerouslySetInnerHTML={{ __html: parsed.innerHtml }}
          />

          {/* Hand-drawn roughjs focus halo around active SVG group */}
          {roughFocusPaths.length > 0 && (
            <g className="pointer-events-none" opacity={0.9}>
              {roughFocusPaths.map((p, idx) => (
                <path
                  key={`rough-focus-${idx}`}
                  d={p.d}
                  fill="none"
                  stroke={p.stroke}
                  strokeWidth={(p.strokeWidth / Math.max(0.8, cam.zoom)).toFixed(2)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </g>
          )}

          {/* Highlight rings/boxes from visual_data.highlights */}
          {highlights.map((hl, idx) => {
            const hlColor = hl.color || '#F59E0B';
            const isActive =
              !dimInactiveParts || !activeFocus || !hl.partId || hl.partId === activeFocus;
            const opacity = isActive ? 0.92 : 0.25;
            if (hl.width && hl.height) {
              return (
                <g key={`hl-box-${idx}`} opacity={opacity}>
                  <rect
                    x={hl.x - hl.width / 2}
                    y={hl.y - hl.height / 2}
                    width={hl.width}
                    height={hl.height}
                    rx={8}
                    fill={`${hlColor}18`}
                    stroke={hlColor}
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                  />
                </g>
              );
            }
            const radius = hl.r ?? 24;
            return (
              <g key={`hl-ring-${idx}`} opacity={opacity}>
                <circle
                  cx={hl.x}
                  cy={hl.y}
                  r={radius}
                  fill={`${hlColor}14`}
                  stroke={hlColor}
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                >
                  <animate
                    attributeName="r"
                    values={`${radius};${radius + 5};${radius}`}
                    dur="2.2s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            );
          })}

          {/* Structured labels from visual_data.labels */}
          {labels.map((lbl, idx) => {
            const color = lbl.color || '#1E293B';
            const isDim =
              Boolean(dimInactiveParts && activeFocus && lbl.partId && lbl.partId !== activeFocus);
            const approxW = Math.min(180, Math.max(48, lbl.text.length * 7 + 16));
            return (
              <g
                key={`lbl-${idx}`}
                opacity={isDim ? 0.28 : 0.96}
                style={{ transition: 'opacity 0.35s ease' }}
              >
                <rect
                  x={lbl.x - approxW / 2}
                  y={lbl.y - 12}
                  width={approxW}
                  height={22}
                  rx={6}
                  fill="rgba(255,255,255,0.92)"
                  stroke={color}
                  strokeWidth={1.4}
                />
                <text
                  x={lbl.x}
                  y={lbl.y + 3}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#0F172A"
                  fontFamily="DM Sans, sans-serif"
                >
                  {lbl.text}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
