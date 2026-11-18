import React, { useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';
import type { RenderParams, StageAnchorsMap } from '../../types/tutor';

interface MermaidStageProps {
  params: RenderParams;
  cameraZoom?: number;
  focusTarget?: string;
  stepIndex?: number;
  beatIndex?: number;
  beatProgress?: number;
  totalBeats?: number;
  isPlaying?: boolean;
  onAnchorsChange?: (anchors: StageAnchorsMap) => void;
}

let mermaidInitialized = false;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function isHighlightedNode(el: Element, highlightIds: string[]): boolean {
  if (highlightIds.length === 0) return false;
  const rawId = el.id || '';
  const dataId = el.getAttribute('data-id') || '';
  const tokens = rawId.split('-');
  return highlightIds.some(
    (hid) =>
      dataId === hid ||
      rawId === hid ||
      tokens.includes(hid) ||
      rawId.includes(`-${hid}-`)
  );
}

export const MermaidStage: React.FC<MermaidStageProps> = ({
  params,
  cameraZoom = 1,
  focusTarget,
  stepIndex = 0,
  beatIndex = 0,
  beatProgress = 1,
  totalBeats = 2,
  isPlaying = false,
  onAnchorsChange,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onAnchorsChangeRef = useRef(onAnchorsChange);
  onAnchorsChangeRef.current = onAnchorsChange;
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);

  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'loose',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: false,
          curve: 'basis',
          nodeSpacing: 34,
          rankSpacing: 44,
          padding: 14,
        },
        themeVariables: {
          primaryColor: '#FFFFFF',
          primaryTextColor: '#0F172A',
          primaryBorderColor: '#2563EB',
          lineColor: '#64748B',
          secondaryColor: '#F8FAFC',
          tertiaryColor: '#EFF6FF',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '14px',
        },
      });
      mermaidInitialized = true;
    }

    const container = containerRef.current;
    if (!container) return;

    let code = (params.diagram || 'flowchart TD\n  A["Boshlanish"] --> B["Natija"]').trim();
    const highlights = params.highlight_nodes || [];
    if (highlights.length > 0) {
      const styleLines = highlights
        .map(
          (nodeId) =>
            `style ${nodeId} fill:#EFF6FF,stroke:#2563EB,stroke-width:2.5px,color:#1E3A8A`
        )
        .join('\n');
      code = `${code}\n${styleLines}`;
    }

    let cancelled = false;
    setError(null);

    mermaid
      .render(`ziyo-mermaid-${rawId}-${Date.now()}`, code)
      .then(({ svg }) => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        const svgEl = containerRef.current.querySelector('svg');
        if (svgEl) {
          svgEl.removeAttribute('width');
          svgEl.removeAttribute('height');
          svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          svgEl.style.width = '100%';
          svgEl.style.maxWidth = '560px';
          svgEl.style.height = 'auto';
          svgEl.style.maxHeight = '100%';
          svgEl.style.display = 'block';
          svgEl.style.margin = '0 auto';
          svgEl.style.overflow = 'visible';
        }
        setRenderVersion((v) => v + 1);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Diagrammani chizishda xatolik');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params.diagram, params.highlight_nodes, rawId]);

  useEffect(() => {
    const inner = containerRef.current;
    const wrap = wrapperRef.current;
    if (!inner || !wrap || renderVersion === 0) return;

    const nodes = Array.from(inner.querySelectorAll<SVGGElement>('.node'));
    const edges = Array.from(
      inner.querySelectorAll<SVGPathElement>('.edgePaths path, path.flowchart-link')
    );
    const edgeLabels = Array.from(inner.querySelectorAll<SVGGElement>('.edgeLabel'));

    const highlightIds = params.highlight_nodes || [];
    const highlightedNodes = nodes.filter((n) => isHighlightedNode(n, highlightIds));

    const safeTotal = Math.max(1, totalBeats);
    const stepProgress = clamp((beatIndex + beatProgress) / safeTotal, 0, 1);
    const showProg = isPlaying || beatIndex > 0 || beatProgress > 0;

    // Spotlight highlighted branches on subsequent steps; build full graph sequentially on step 0
    const isSpotlightMode = showProg && stepIndex > 0 && highlightedNodes.length > 0;
    let activeAnchorNode: SVGGElement | undefined = nodes[0];

    if (isSpotlightMode) {
      const visibleHlCount = Math.max(
        1,
        Math.min(highlightedNodes.length, Math.ceil(stepProgress * highlightedNodes.length))
      );
      const activeHlNode = highlightedNodes[visibleHlCount - 1];
      activeAnchorNode = activeHlNode || nodes[0];

      nodes.forEach((node) => {
        const hlIdx = highlightedNodes.indexOf(node);
        // Never set CSS `transform` on `.node` because it overrides SVG transform="translate(x,y)"!
        node.style.transition = 'opacity 260ms ease, filter 260ms ease';

        if (hlIdx === -1) {
          node.style.opacity = '0.45';
          node.style.filter = 'none';
        } else if (hlIdx < visibleHlCount - 1) {
          node.style.opacity = '1';
          node.style.filter = 'none';
        } else if (hlIdx === visibleHlCount - 1) {
          node.style.opacity = '1';
          node.style.filter = 'drop-shadow(0 0 9px rgba(37, 99, 235, 0.45))';
        } else {
          node.style.opacity = '0.35';
          node.style.filter = 'none';
        }
      });

      edges.forEach((edge) => {
        edge.style.transition = 'opacity 240ms ease';
        edge.style.opacity = '0.68';
        edge.style.strokeDasharray = 'none';
        edge.style.strokeDashoffset = '0';
      });
      edgeLabels.forEach((lbl) => {
        lbl.style.transition = 'opacity 240ms ease';
        lbl.style.opacity = '0.82';
      });
    } else {
      const revealRatio = showProg ? stepProgress : stepIndex > 0 ? 1 : 0;
      const visibleCount = showProg
        ? Math.max(1, Math.min(nodes.length, Math.ceil(revealRatio * nodes.length)))
        : stepIndex > 0
        ? nodes.length
        : 0;
      activeAnchorNode =
        nodes[Math.min(nodes.length - 1, Math.max(0, visibleCount - 1))] || nodes[0];

      nodes.forEach((node, idx) => {
        const visible = idx < visibleCount;
        const isCurrent = showProg && idx === visibleCount - 1 && stepProgress < 0.98;
        // Never set CSS `transform` on `.node` because it overrides SVG transform="translate(x,y)"!
        node.style.transition = 'opacity 260ms ease, filter 260ms ease';
        node.style.opacity = visible ? '1' : '0';
        node.style.filter = isCurrent
          ? 'drop-shadow(0 0 9px rgba(37, 99, 235, 0.45))'
          : 'none';
      });

      const totalEdges = Math.max(1, edges.length);
      edges.forEach((edge, idx) => {
        let len = Number(edge.dataset.pathLen || 0);
        if (!len) {
          try {
            len = edge.getTotalLength();
            if (Number.isFinite(len) && len > 0) {
              edge.dataset.pathLen = String(len);
            }
          } catch {
            len = 0;
          }
        }
        const edgeFill = showProg
          ? clamp((revealRatio - idx / totalEdges) * totalEdges, 0, 1)
          : stepIndex > 0
          ? 1
          : 0;
        edge.style.transition = 'opacity 220ms ease';
        edge.style.opacity = edgeFill > 0.04 ? '1' : '0';
        if (len > 0) {
          edge.style.strokeDasharray = `${len}`;
          edge.style.strokeDashoffset = `${len * (1 - edgeFill)}`;
        }
      });

      const totalLabels = Math.max(1, edgeLabels.length);
      edgeLabels.forEach((lbl, idx) => {
        const lblVisible = showProg ? revealRatio >= (idx + 0.55) / totalLabels : stepIndex > 0;
        lbl.style.transition = 'opacity 220ms ease';
        lbl.style.opacity = lblVisible ? '1' : '0';
      });
    }

    const rafId = requestAnimationFrame(() => {
      const cb = onAnchorsChangeRef.current;
      if (!cb || !wrap || !inner) return;
      const wrapRect = wrap.getBoundingClientRect();
      const map: StageAnchorsMap = {
        overview: { x: wrapRect.width * 0.5, y: wrapRect.height * 0.45 },
      };

      const edgeAnchorOf = (el: Element | undefined) => {
        if (!el) return { x: wrapRect.width * 0.5, y: wrapRect.height * 0.45 };
        const r = el.getBoundingClientRect();
        // Position EmojiUstoz just to the right edge of the box so it points cleanly without hiding node text
        return {
          x: Math.min(wrapRect.width - 36, r.right - wrapRect.left + 14),
          y: Math.max(44, Math.min(wrapRect.height - 86, r.top - wrapRect.top + r.height * 0.45)),
        };
      };

      if (nodes.length > 0) {
        map.node_0 = edgeAnchorOf(nodes[0]);
        map.node_1 = edgeAnchorOf(nodes[1] || nodes[0]);
        map.node_last = edgeAnchorOf(nodes[nodes.length - 1]);
        map.drawing_tip = edgeAnchorOf(activeAnchorNode);
      }

      cb(map);
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [
    renderVersion,
    stepIndex,
    beatIndex,
    beatProgress,
    totalBeats,
    isPlaying,
    focusTarget,
    params.highlight_nodes,
    zoom,
    cameraZoom,
  ]);

  const effectiveZoom = clamp(zoom * (0.95 + (cameraZoom || 1) * 0.05), 0.65, 1.8);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full bg-transparent overflow-auto px-4 pt-14 pb-16 flex items-center justify-center"
    >
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white/92 border border-[#E5DEC9] rounded-full p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.15).toFixed(2))))}
          className="px-2.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-amber-50 rounded-full cursor-pointer"
        >
          -
        </button>
        <span className="px-2 text-xs font-mono-tabular text-slate-700">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.15).toFixed(2))))}
          className="px-2.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-amber-50 rounded-full cursor-pointer"
        >
          +
        </button>
      </div>

      {error ? (
        <div className="text-rose-700 text-sm text-center max-w-md">{error}</div>
      ) : (
        <div
          ref={containerRef}
          style={{ transform: `scale(${effectiveZoom})`, transformOrigin: 'center center' }}
          className="transition-transform duration-300 w-full max-w-[560px] flex items-center justify-center"
        />
      )}
    </div>
  );
};
