import React, { useEffect, useRef, useState } from 'react';
import SmilesDrawer from 'smiles-drawer';
import DOMPurify from 'dompurify';
import type { EngineType, RenderParams, StageAnchorsMap } from '../../types/tutor';
import { safeParseJsonOrNull } from '../../lib/safeFetchJson';

interface MoleculeStageProps {
  engine: Extract<EngineType, 'pdb' | 'pubchem' | 'rdkit'>;
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

const DEFAULT_SMILES_BY_NAME: Record<string, string> = {
  caffeine: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
  aspirin: 'CC(=O)OC1=CC=CC=C1C(=O)O',
  glucose: 'C(C1C(C(C(C(O1)O)O)O)O)O',
  ethanol: 'CCO',
  benzene: 'C1=CC=CC=C1',
  water: 'O',
  methane: 'C',
};

let rdkitPromise: Promise<any> | null = null;
function loadRDKitOnce(): Promise<any> {
  if (!rdkitPromise) {
    rdkitPromise = import('@rdkit/rdkit').then((mod) =>
      mod.default({
        locateFile: () => 'https://unpkg.com/@rdkit/rdkit/dist/RDKit_minimal.wasm',
      })
    );
  }
  return rdkitPromise;
}

export const MoleculeStage: React.FC<MoleculeStageProps> = ({
  engine,
  params,
  stepIndex = 0,
  onAnchorsChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const smilesSvgRef = useRef<SVGSVGElement | null>(null);
  const [rendererMode, setRendererMode] = useState<'smiles' | 'rdkit'>(
    engine === 'rdkit' ? 'rdkit' : 'smiles'
  );
  const [smilesStr, setSmilesStr] = useState<string>(() => params.smiles || '');
  const [rdkitSvg, setRdkitSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identifier =
    engine === 'pdb'
      ? (params.pdb_id || '1ZNI').toUpperCase()
      : params.compound || 'Caffeine';

  useEffect(() => {
    if (params.smiles?.trim()) {
      setSmilesStr(params.smiles.trim());
      return;
    }
    const preset = DEFAULT_SMILES_BY_NAME[identifier.toLowerCase()];
    if (preset) {
      setSmilesStr(preset);
    }

    let cancelled = false;
    async function loadData() {
      if (engine === 'pdb') return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/chem/pubchem/${encodeURIComponent(identifier)}`);
        if (res.ok) {
          const data = await safeParseJsonOrNull<{ smiles?: string }>(res);
          if (!cancelled && data?.smiles) {
            setSmilesStr(data.smiles);
          }
        }
      } catch (err: any) {
        if (!cancelled && !preset) setError(err.message || 'Molekula yuklanmadi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [engine, identifier, params.smiles]);

  const effectiveSmiles = smilesStr || DEFAULT_SMILES_BY_NAME.caffeine;

  useEffect(() => {
    if (rendererMode !== 'smiles' || !effectiveSmiles || !smilesSvgRef.current) return;
    try {
      const drawer = new SmilesDrawer.SvgDrawer({
        width: 340,
        height: 250,
        bondThickness: 2,
        compactDrawing: false,
      });
      SmilesDrawer.parse(
        effectiveSmiles,
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
  }, [effectiveSmiles, rendererMode]);

  useEffect(() => {
    if (rendererMode !== 'rdkit' || !effectiveSmiles) return;
    let cancelled = false;
    setLoading(true);
    loadRDKitOnce()
      .then((RDKit) => {
        if (cancelled) return;
        const mol = RDKit.get_mol(effectiveSmiles);
        if (mol && mol.is_valid()) {
          const rawSvg = mol.get_svg(340, 250);
          mol.delete();
          setRdkitSvg(DOMPurify.sanitize(rawSvg, { USE_PROFILES: { svg: true } }));
        } else {
          if (mol) mol.delete();
          setRdkitSvg(null);
        }
      })
      .catch(() => {
        if (!cancelled) setRendererMode('smiles');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveSmiles, rendererMode]);

  useEffect(() => {
    if (!onAnchorsChange || !containerRef.current) return;
    const w = containerRef.current.clientWidth || 340;
    const h = containerRef.current.clientHeight || 250;
    onAnchorsChange({
      overview: { x: w * 0.5, y: h * 0.5 },
      formula: { x: w * 0.5, y: h * 0.4 },
      bonds: { x: w * 0.5, y: h * 0.6 },
    });
  }, [onAnchorsChange, stepIndex]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#FCFBF7] flex flex-col items-center justify-center p-6 overflow-hidden"
    >
      <div className="absolute top-3 inset-x-3 z-10 flex items-center justify-between gap-2">
        <div className="bg-white/95 border border-slate-200 text-slate-800 px-3 py-1 rounded-full text-xs shadow-sm font-semibold">
          <span className="text-[#0071E3] font-mono">
            {params.formula || params.compound || identifier}
          </span>
        </div>

        <div className="inline-flex items-center rounded-full bg-white/95 border border-black/[0.08] p-0.5 shadow-xs">
          <button
            type="button"
            onClick={() => setRendererMode('smiles')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer ${
              rendererMode === 'smiles'
                ? 'bg-[#0071E3] text-white'
                : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            SmilesDrawer
          </button>
          <button
            type="button"
            onClick={() => setRendererMode('rdkit')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer ${
              rendererMode === 'rdkit'
                ? 'bg-[#0071E3] text-white'
                : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            RDKit 2D
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center space-y-2 text-slate-500 text-xs font-medium">
          <div className="w-6 h-6 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
          <span>Molekulyar struktura chizilmoqda...</span>
        </div>
      ) : error ? (
        <div className="text-xs text-rose-500 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
          {error}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
            {rendererMode === 'rdkit' && rdkitSvg ? (
              <div
                className="w-[340px] h-[250px] flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: rdkitSvg }}
              />
            ) : (
              <svg
                ref={smilesSvgRef}
                width="340"
                height="250"
                viewBox="0 0 340 250"
                className="block mx-auto"
                aria-label={`${identifier} 2D strukturasi`}
              />
            )}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            {rendererMode === 'rdkit'
              ? 'RDKit.js (WebAssembly) 2D Xeminformatika strukturasi'
              : 'SmilesDrawer 2D Kimyoviy bog‘lanish sxemasi'}
          </div>
        </div>
      )}
    </div>
  );
};
