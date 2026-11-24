import React, { useEffect, useRef, useState } from 'react';
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

export const MoleculeStage: React.FC<MoleculeStageProps> = ({
  engine,
  params,
  cameraZoom = 1,
  focusTarget,
  stepIndex = 0,
  isPlaying = false,
  onAnchorsChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const smilesSvgRef = useRef<SVGSVGElement | null>(null);
  const [smilesStr, setSmilesStr] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);

  const identifier =
    engine === 'pdb'
      ? (params.pdb_id || '1ZNI').toUpperCase()
      : params.compound || 'Caffeine';

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        if (engine === 'pubchem') {
          const res = await fetch(`/api/chem/pubchem/${encodeURIComponent(identifier)}`);
          if (res.ok) {
            const data = await safeParseJsonOrNull<{ smiles?: string }>(res);
            if (!cancelled && data?.smiles) {
              setSmilesStr(data.smiles);
            }
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Yuklashda xatolik');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [engine, identifier]);

  useEffect(() => {
    if (!smilesStr || !smilesSvgRef.current) return;
    try {
      const drawer = new SmilesDrawer.SvgDrawer({
        width: 320,
        height: 240,
        bondThickness: 2,
        compactDrawing: false,
      });
      SmilesDrawer.parse(
        smilesStr,
        (tree: any) => {
          if (smilesSvgRef.current) {
            drawer.draw(tree, smilesSvgRef.current, 'light', false);
          }
        },
        () => {}
      );
    } catch {
      // ignore parse error
    }
  }, [smilesStr]);

  useEffect(() => {
    if (!onAnchorsChange || !containerRef.current) return;
    const w = containerRef.current.clientWidth || 320;
    const h = containerRef.current.clientHeight || 240;
    onAnchorsChange({
      overview: { x: w * 0.5, y: h * 0.5 },
      formula: { x: w * 0.5, y: h * 0.4 },
      bonds: { x: w * 0.5, y: h * 0.6 },
    });
  }, [onAnchorsChange, stepIndex]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#FCFBF7] flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Top Header */}
      <div className="absolute top-3 inset-x-3 z-10 flex items-center justify-between gap-2">
        <div className="bg-white/95 border border-slate-200 text-slate-800 px-3 py-1 rounded-full text-xs shadow-sm font-semibold">
          <span className="text-blue-600 font-mono">
            {engine === 'pdb' ? `PDB: ${identifier}` : (params.formula || params.compound || identifier)}
          </span>
          {hoverInfo && <span className="ml-2 text-emerald-600 font-normal">{hoverInfo}</span>}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center space-y-2 text-slate-500 text-xs font-medium">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Molekulyar struktura yuklanmoqda...</span>
        </div>
      ) : error ? (
        <div className="text-xs text-rose-500 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
          {error}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
            <svg
              ref={smilesSvgRef}
              width="320"
              height="240"
              viewBox="0 0 320 240"
              className="block mx-auto"
              aria-label={`${identifier} 2D strukturasi`}
            />
          </div>
          <div className="text-xs text-slate-500 font-medium">
            2D Kimyoviy bog'lanish va strukturaviy sxema
          </div>
        </div>
      )}
    </div>
  );
};
