import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mafs,
  Coordinates,
  Plot,
  Vector,
  Point,
  Circle,
  Text as MafsText,
} from 'mafs';
import 'mafs/core.css';
import JXG from 'jsxgraph';
import { compile } from 'mathjs';
import type { RenderParams, StageAnchorsMap } from '../../types/tutor';

export interface MafsGeometryStageProps {
  mode?: 'mafs' | 'jsxgraph';
  params: RenderParams;
  sliderValues: Record<string, number>;
  stepIndex?: number;
  onAnchorsChange?: (anchors: StageAnchorsMap) => void;
}

export const MafsGeometryStage: React.FC<MafsGeometryStageProps> = ({
  mode: initialMode = 'mafs',
  params,
  sliderValues,
  stepIndex = 0,
  onAnchorsChange,
}) => {
  const [activeLib, setActiveLib] = useState<'mafs' | 'jsxgraph'>(initialMode);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const jxgBoxRef = useRef<HTMLDivElement | null>(null);
  const jxgId = useMemo(
    () => `mirvo-jxg-${Math.random().toString(36).slice(2, 9)}`,
    []
  );

  const expr = params.expression || 'sin(x)';
  const compiledFn = useMemo(() => {
    try {
      const node = compile(expr);
      return (x: number) => {
        try {
          const val = Number(node.evaluate({ x, ...sliderValues }));
          return Number.isFinite(val) ? val : 0;
        } catch {
          return 0;
        }
      };
    } catch {
      return (x: number) => Math.sin(x);
    }
  }, [expr, sliderValues]);

  useEffect(() => {
    if (!onAnchorsChange || !containerRef.current) return;
    const w = containerRef.current.clientWidth || 600;
    const h = containerRef.current.clientHeight || 400;
    onAnchorsChange({
      overview: { x: w * 0.5, y: h * 0.5 },
      origin: { x: w * 0.5, y: h * 0.5 },
      peak: { x: w * 0.62, y: h * 0.34 },
    });
  }, [onAnchorsChange, stepIndex, activeLib]);

  useEffect(() => {
    if (activeLib !== 'jsxgraph' || !jxgBoxRef.current) return;
    let board: JXG.Board | null = null;
    try {
      board = JXG.JSXGraph.initBoard(jxgId, {
        boundingbox: [-6, 5, 6, -5],
        axis: true,
        showCopyright: false,
        showNavigation: false,
        pan: { enabled: true },
        zoom: { wheel: true },
      });

      board.create('functiongraph', [(x: number) => compiledFn(x), -6, 6], {
        strokeColor: '#0071E3',
        strokeWidth: 3,
      });

      const r = sliderValues.r ?? params.radius ?? 2;
      if (params.kind === 'circle' || params.kind === 'unit_circle') {
        const center = board.create('point', [0, 0], {
          name: 'O',
          size: 3,
          color: '#1D1D1F',
          fixed: true,
        });
        board.create('circle', [center, r], {
          strokeColor: '#10B981',
          strokeWidth: 2.5,
        });
      } else {
        const pA = board.create('point', [1.5, compiledFn(1.5)], {
          name: 'P',
          size: 4,
          color: '#F59E0B',
        });
        void pA;
      }
    } catch {
      // ignore JSXGraph init error on unmount race
    }

    return () => {
      if (board) {
        try {
          JXG.JSXGraph.freeBoard(board);
        } catch {
          // ignore cleanup race
        }
      }
    };
  }, [activeLib, jxgId, compiledFn, params.kind, params.radius, sliderValues]);

  const radiusVal = sliderValues.r ?? params.radius ?? 2;
  const angleRad = ((sliderValues.angle ?? params.angle_deg ?? 45) * Math.PI) / 180;

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col overflow-hidden bg-white">
      <div className="absolute top-3 right-3 z-20 inline-flex items-center rounded-full bg-white/95 border border-black/[0.08] p-0.5 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveLib('mafs')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer ${
            activeLib === 'mafs' ? 'bg-[#0071E3] text-white' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
          }`}
        >
          Mafs 2D
        </button>
        <button
          type="button"
          onClick={() => setActiveLib('jsxgraph')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer ${
            activeLib === 'jsxgraph'
              ? 'bg-[#0071E3] text-white'
              : 'text-[#6E6E73] hover:text-[#1D1D1F]'
          }`}
        >
          JSXGraph
        </button>
      </div>

      {activeLib === 'mafs' ? (
        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          <Mafs
            viewBox={{ x: [-5, 5], y: [-3.5, 3.5] }}
            preserveAspectRatio="contain"
            pan
            zoom={{ min: 0.5, max: 3 }}
          >
            <Coordinates.Cartesian />
            <Plot.OfX y={compiledFn} color="#0071E3" weight={3} />
            {(params.kind === 'circle' || params.kind === 'unit_circle') && (
              <>
                <Circle center={[0, 0]} radius={radiusVal} color="#10B981" fillOpacity={0.08} />
                <Vector
                  tail={[0, 0]}
                  tip={[radiusVal * Math.cos(angleRad), radiusVal * Math.sin(angleRad)]}
                  color="#F59E0B"
                />
              </>
            )}
            {(params.highlight_points || params.highlights || []).slice(0, 6).map((pt, i) => (
              <React.Fragment key={i}>
                <Point x={pt.x} y={pt.y} color="#EF4444" />
                {pt.label && (
                  <MafsText x={pt.x} y={pt.y + 0.45} size={13}>
                    {pt.label}
                  </MafsText>
                )}
              </React.Fragment>
            ))}
          </Mafs>
        </div>
      ) : (
        <div id={jxgId} ref={jxgBoxRef} className="flex-1 min-h-0 w-full h-full" />
      )}
    </div>
  );
};

export default MafsGeometryStage;
