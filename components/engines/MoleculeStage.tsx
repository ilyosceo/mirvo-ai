import React, { useEffect, useRef, useState } from 'react';
import * as $3Dmol from '3dmol';
import SmilesDrawer from 'smiles-drawer';
import type { EngineType, RenderParams, StageAnchorsMap } from '../../types/tutor';
import { safeParseJsonOrNull } from '../../lib/safeFetchJson';

interface MoleculeStageProps {
  engine: Extract<EngineType, 'pdb' | 'pubchem'>;
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

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

interface MoleculeAtomHandle {
  index?: number;
}

interface MoleculeModelHandle {
  selectedAtoms: (sel: Record<string, unknown>) => MoleculeAtomHandle[];
}

function applySelectionStyle(
  viewer: $3Dmol.GLViewer,
  sel: Record<string, unknown>,
  styleName: string,
  isPdb: boolean
) {
  if (isPdb) {
    if (styleName === 'stick') {
      viewer.setStyle(sel, { stick: { radius: 0.16, colorscheme: 'Jmol' } });
    } else if (styleName === 'sphere') {
      viewer.setStyle(sel, { sphere: { scale: 0.35, colorscheme: 'chain' } });
    } else if (styleName === 'surface') {
      viewer.setStyle(sel, {
        cartoon: { color: 'spectrum' },
        sphere: { scale: 0.25, opacity: 0.35 },
      });
    } else {
      viewer.setStyle(sel, { cartoon: { color: 'spectrum' } });
    }
  } else {
    if (styleName === 'stick') {
      viewer.setStyle(sel, { stick: { radius: 0.16, colorscheme: 'Jmol' } });
    } else if (styleName === 'sphere') {
      viewer.setStyle(sel, { sphere: { scale: 0.85, colorscheme: 'Jmol' } });
    } else {
      viewer.setStyle(sel, {
        stick: { radius: 0.14, colorscheme: 'Jmol' },
        sphere: { scale: 0.28, colorscheme: 'Jmol' },
      });
    }
  }
}

export const MoleculeStage: React.FC<MoleculeStageProps> = ({
  engine,
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
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const glViewerRef = useRef<$3Dmol.GLViewer | null>(null);
  const modelRef = useRef<MoleculeModelHandle | null>(null);
  const onAnchorsChangeRef = useRef(onAnchorsChange);
  onAnchorsChangeRef.current = onAnchorsChange;
  const loadedKeyRef = useRef<string>('');
  const lastZoomRef = useRef<number>(1);
  const userInteractingRef = useRef<boolean>(false);
  const interactionTimerRef = useRef<number | null>(null);

  const [modelVersion, setModelVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  const [smilesStr, setSmilesStr] = useState<string>(params.smiles || '');
  const [show2DStructure, setShow2DStructure] = useState<boolean>(true);
  const smilesSvgRef = useRef<SVGSVGElement | null>(null);
  const [localStyle, setLocalStyle] = useState<string>(
    params.style || (engine === 'pdb' ? 'cartoon' : 'ballstick')
  );

  useEffect(() => {
    setLocalStyle(params.style || (engine === 'pdb' ? 'cartoon' : 'ballstick'));
  }, [params.style, engine]);

  // Fetch SMILES for 2D IUPAC skeletal formula depiction via MIT smiles-drawer
  useEffect(() => {
    if (engine !== 'pubchem') {
      setSmilesStr('');
      return;
    }
    if (params.smiles) {
      setSmilesStr(params.smiles);
      return;
    }
    const compound = params.compound || 'Caffeine';
    let cancelled = false;
    fetch(`/api/chem/pubchem-smiles/${encodeURIComponent(compound)}`)
      .then((r) => (r.ok ? safeParseJsonOrNull<{ smiles?: string }>(r) : null))
      .then((data: { smiles?: string } | null) => {
        if (!cancelled && data?.smiles) {
          setSmilesStr(data.smiles);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [engine, params.compound, params.smiles]);

  useEffect(() => {
    const svgEl = smilesSvgRef.current;
    if (!svgEl || !smilesStr || !show2DStructure) return;
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
    try {
      SmilesDrawer.parse(
        smilesStr,
        (tree) => {
          try {
            const drawer = new SmilesDrawer.SvgDrawer({
              width: 196,
              height: 124,
              bondThickness: 1.5,
              bondLength: 14,
              shortBondLength: 0.85,
              fontSizeLarge: 10,
              fontSizeSmall: 7,
              padding: 12,
            });
            drawer.draw(tree, svgEl, 'light');
          } catch {
            // ignore SVG render edge cases
          }
        },
        () => {}
      );
    } catch {
      // ignore invalid SMILES parse
    }
  }, [smilesStr, show2DStructure]);

  const emitAnchors = (progressRatio = 0.5) => {
    const cb = onAnchorsChangeRef.current;
    const container = viewerRef.current;
    if (!cb || !container) return;
    const w = Math.max(280, container.clientWidth);
    const h = Math.max(220, container.clientHeight);
    const tipAngle = progressRatio * Math.PI * 1.3 - Math.PI * 0.65;
    cb({
      overview: { x: w * 0.5, y: h * 0.5 },
      chain_A: { x: w * 0.42, y: h * 0.44 },
      chain_B: { x: w * 0.58, y: h * 0.56 },
      disulfide_bridge: { x: w * 0.5, y: h * 0.46 },
      active_ring: { x: w * 0.48, y: h * 0.5 },
      drawing_tip: {
        x: w * (0.5 + 0.14 * Math.sin(tipAngle)),
        y: h * (0.48 - 0.1 * Math.cos(tipAngle)),
      },
    });
  };

  // Load / fetch molecule model only when identifier changes
  useEffect(() => {
    const container = viewerRef.current;
    if (!container) return;

    const identifier =
      engine === 'pdb'
        ? (params.pdb_id || '1ZNI').toUpperCase()
        : params.compound || 'Caffeine';
    const cacheKey = `${engine}:${identifier}`;

    let cancelled = false;

    async function initAndLoad() {
      if (!container) return;

      if (!glViewerRef.current) {
        glViewerRef.current = $3Dmol.createViewer(container, {
          backgroundColor: '0xfcfbf7',
          backgroundAlpha: 0,
          antialias: true,
        });
        glViewerRef.current.setBackgroundColor(0xfcfbf7, 0);
      }

      const viewer = glViewerRef.current;

      const formatAtomLabel = (atom: Record<string, unknown>) => {
        const elem = String(atom.elem || '');
        const atomName = String(atom.atom || '');
        const resn = String(atom.resn || '');
        const resi = atom.resi ? ` #${atom.resi}` : '';
        if (resn) return `Atom: ${elem}${atomName ? ` (${atomName})` : ''} · ${resn}${resi}`;
        return `Atom: ${elem}`;
      };

      if (loadedKeyRef.current !== cacheKey) {
        setLoading(true);
        setError(null);
        setHoverInfo(null);
        modelRef.current = null;
        viewer.clear();

        try {
          const url =
            engine === 'pdb'
              ? `/api/chem/pdb/${encodeURIComponent(identifier)}`
              : `/api/chem/pubchem/${encodeURIComponent(identifier)}`;

          const res = await fetch(url);
          if (!res.ok) {
            const errJson = await safeParseJsonOrNull<{ error?: string }>(res);
            throw new Error(errJson?.error || `Molekula yuklanmadi (${res.status})`);
          }
          const data = await res.text();
          if (cancelled) return;

          modelRef.current = viewer.addModel(
            data,
            engine === 'pdb' ? 'pdb' : 'sdf'
          ) as unknown as MoleculeModelHandle;
          viewer.setHoverable(
            {},
            true,
            (atom) => setHoverInfo(formatAtomLabel(atom)),
            () => {}
          );
          viewer.setClickable({}, true, (atom) => {
            setHoverInfo(formatAtomLabel(atom));
          });
          loadedKeyRef.current = cacheKey;
          lastZoomRef.current = 1;
          viewer.resize();
          viewer.zoomTo();
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Molekula yuklashda xatolik');
            setLoading(false);
          }
          return;
        }
      }

      if (!cancelled) {
        setLoading(false);
        setModelVersion((v) => v + 1);
        emitAnchors(0.5);
      }
    }

    initAndLoad();

    const ro = new ResizeObserver(() => {
      if (glViewerRef.current && container) {
        glViewerRef.current.resize();
        glViewerRef.current.zoomTo();
        lastZoomRef.current = 1;
        emitAnchors(0.5);
      }
    });
    ro.observe(container);

    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [engine, params.pdb_id, params.compound]);

  const safeTotal = Math.max(1, totalBeats);
  const stepProgress = clamp((beatIndex + beatProgress) / safeTotal, 0, 1);
  const showProg = isPlaying || beatIndex > 0 || beatProgress > 0;
  // Quantize to ~20 steps so WebGL styles animate smoothly without 60Hz rebuild overhead
  const quantizedProgress = showProg ? Math.round(stepProgress * 20) / 20 : 1;

  // Progressive molecular build-up & structural spotlighting
  useEffect(() => {
    const viewer = glViewerRef.current;
    if (!viewer || loading || modelVersion === 0) return;

    const isPdb = engine === 'pdb';
    const model = modelRef.current;
    const allAtoms = model ? model.selectedAtoms({}) : [];
    viewer.setStyle({}, {});

    if (stepIndex === 0 && showProg && quantizedProgress < 0.96 && allAtoms.length > 4) {
      const revealedCount = Math.max(4, Math.ceil(quantizedProgress * allAtoms.length));
      const revealedIndices = allAtoms
        .slice(0, revealedCount)
        .map((a) => a.index)
        .filter((idx): idx is number => typeof idx === 'number');

      if (revealedIndices.length > 0) {
        applySelectionStyle(viewer, { index: revealedIndices }, localStyle, isPdb);
      }
    } else if (isPdb && showProg && stepIndex > 0) {
      if (focusTarget === 'disulfide_bridge' || (stepIndex >= 1 && quantizedProgress >= 0.45)) {
        viewer.setStyle({}, { line: { color: '#CBD5E1', opacity: 0.28 } });
        applySelectionStyle(viewer, { chain: 'A' }, 'cartoon', true);
        viewer.setStyle(
          { resn: 'CYS' },
          { stick: { radius: 0.2, colorscheme: 'Jmol' } }
        );
        viewer.setStyle(
          { elem: 'S' },
          { sphere: { radius: 0.52, color: '#F59E0B' } }
        );
      } else if (focusTarget === 'chain_A') {
        viewer.setStyle({}, { cartoon: { color: '#E2E8F0' } });
        applySelectionStyle(viewer, { chain: 'A' }, localStyle, true);
      } else if (focusTarget === 'chain_B') {
        viewer.setStyle({}, { cartoon: { color: '#E2E8F0' } });
        applySelectionStyle(viewer, { chain: 'B' }, localStyle, true);
      } else {
        applySelectionStyle(viewer, {}, localStyle, true);
      }
    } else if (!isPdb && showProg && stepIndex > 0 && quantizedProgress < 0.92) {
      viewer.setStyle({}, { line: { color: '#CBD5E1', opacity: 0.25 } });
      if (quantizedProgress < 0.42) {
        applySelectionStyle(viewer, { elem: 'C' }, localStyle, false);
      } else if (quantizedProgress < 0.78) {
        applySelectionStyle(viewer, { elem: ['C', 'N'] }, localStyle, false);
      } else {
        applySelectionStyle(viewer, {}, localStyle, false);
      }
    } else {
      applySelectionStyle(viewer, {}, localStyle, isPdb);
    }

    viewer.render();
    emitAnchors(quantizedProgress);
  }, [modelVersion, loading, localStyle, engine, stepIndex, quantizedProgress, showProg, focusTarget]);

  // Smooth relative camera zoom without resetting user rotation
  useEffect(() => {
    const viewer = glViewerRef.current;
    if (!viewer || loading) return;
    const safeZoom = clamp(cameraZoom || 1, 0.8, 1.45);
    const ratio = safeZoom / lastZoomRef.current;
    if (Math.abs(ratio - 1) > 0.03) {
      viewer.zoom(ratio, 380);
      lastZoomRef.current = safeZoom;
      viewer.render();
    }
  }, [cameraZoom, loading]);

  // Gentle guided turntable rotation while playing (pauses immediately if user drags/scrolls)
  useEffect(() => {
    if (!isPlaying || loading) return;
    let rafId = 0;
    const spin = () => {
      const viewer = glViewerRef.current;
      if (viewer && !userInteractingRef.current) {
        viewer.rotate(0.24, 'y');
        viewer.render();
      }
      rafId = requestAnimationFrame(spin);
    };
    rafId = requestAnimationFrame(spin);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isPlaying, loading]);

  useEffect(() => {
    return () => {
      if (interactionTimerRef.current !== null) {
        window.clearTimeout(interactionTimerRef.current);
      }
    };
  }, []);

  const markUserInteracting = (active: boolean) => {
    if (interactionTimerRef.current !== null) {
      window.clearTimeout(interactionTimerRef.current);
      interactionTimerRef.current = null;
    }
    if (active) {
      userInteractingRef.current = true;
    } else {
      interactionTimerRef.current = window.setTimeout(() => {
        userInteractingRef.current = false;
      }, 1800);
    }
  };

  const styleOptions =
    engine === 'pdb'
      ? [
          { id: 'cartoon', label: 'Lenta' },
          { id: 'stick', label: 'Bog‘lar' },
          { id: 'sphere', label: 'Sferik' },
          { id: 'surface', label: 'Sirt' },
        ]
      : [
          { id: 'ballstick', label: 'Shar-tayoqcha' },
          { id: 'stick', label: 'Bog‘lar' },
          { id: 'sphere', label: 'Sferik' },
        ];

  return (
    <div
      className="relative w-full h-full bg-transparent overflow-hidden"
      onPointerDown={() => markUserInteracting(true)}
      onPointerUp={() => markUserInteracting(false)}
      onPointerCancel={() => markUserInteracting(false)}
      onWheel={() => {
        markUserInteracting(true);
        markUserInteracting(false);
      }}
    >
      <div ref={viewerRef} className="w-full h-full relative touch-none cursor-grab active:cursor-grabbing" />

      {/* Top bar: responsive wrap so PDB label & style switcher never collide on narrow phones */}
      <div className="pointer-events-none absolute top-2.5 inset-x-2.5 sm:top-3 sm:inset-x-3 z-10 flex flex-wrap items-center justify-between gap-1.5">
        <div className="pointer-events-auto flex items-center gap-1.5 bg-white/95 border border-slate-200 text-slate-800 px-2.5 py-1 rounded-full text-[11px] sm:text-xs shadow-sm max-w-full">
          <span className="font-mono-tabular font-semibold text-blue-600 shrink-0">
            {engine === 'pdb'
              ? `PDB: ${(params.pdb_id || '1ZNI').toUpperCase()}`
              : params.formula || params.compound}
          </span>
          {hoverInfo ? (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-emerald-700 font-semibold truncate max-w-[160px] sm:max-w-none">
                {hoverInfo}
              </span>
            </>
          ) : (
            <>
              <span className="text-slate-300 hidden sm:inline">·</span>
              <span className="text-slate-400 hidden sm:inline">Atomga bosing</span>
            </>
          )}
        </div>

        {/* Style switcher + 2D formula toggle */}
        <div className="pointer-events-auto flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-white/95 border border-slate-200 rounded-full shadow-sm overflow-x-auto no-scrollbar max-w-full">
          {styleOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setLocalStyle(opt.id)}
              className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                localStyle === opt.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {engine === 'pubchem' && smilesStr && (
            <button
              type="button"
              onClick={() => setShow2DStructure((s) => !s)}
              className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                show2DStructure
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              2D Formula
            </button>
          )}
        </div>
      </div>

      {engine === 'pubchem' && smilesStr && show2DStructure && !loading && !error && (
        <div className="pointer-events-auto absolute bottom-14 left-3 z-10 rounded-2xl bg-white/92 backdrop-blur-xl border border-black/[0.08] shadow-[0_8px_24px_rgba(0,0,0,0.06)] p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6E6E73] mb-1">
            2D Strukturaviy formula
          </div>
          <svg
            ref={smilesSvgRef}
            width="196"
            height="124"
            viewBox="0 0 196 124"
            className="block"
            aria-label={`${params.compound || 'Molekula'} 2D strukturaviy formulasi`}
          />
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#FCFBF7]/85 text-slate-700 text-sm font-medium">
          3D molekulyar koordinatalar yuklanmoqda...
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#FCFBF7]/95 text-rose-700 p-6 text-center text-sm gap-2">
          <div>{error}</div>
          <div className="text-xs text-slate-600">
            Namuna sifatida 1ZNI (Insulin), 1BNA (DNK) yoki Caffeine / H2SO4 ni sinab ko‘ring.
          </div>
        </div>
      )}
    </div>
  );
};
