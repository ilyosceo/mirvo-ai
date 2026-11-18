import React, { useEffect, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { compile, derivative } from 'mathjs';
import type { EngineType, RenderParams, StageAnchorsMap } from '../../types/tutor';

interface PlotlyStageProps {
  engine: Extract<EngineType, 'plotly2d' | 'plotly3d'>;
  params: RenderParams;
  sliderValues: Record<string, number>;
  onAnchorsChange?: (anchors: StageAnchorsMap) => void;
}

// Educational pastel-bright gradient (NO Viridis)
const EDUCATIONAL_COLORSCALE: Array<[number, string]> = [
  [0, '#2563EB'],
  [0.35, '#10B981'],
  [0.7, '#F59E0B'],
  [1, '#F43F5E'],
];

export const PlotlyStage: React.FC<PlotlyStageProps> = ({
  engine,
  params,
  sliderValues,
  onAnchorsChange,
}) => {
  const plotRef = useRef<HTMLDivElement | null>(null);
  const onAnchorsChangeRef = useRef(onAnchorsChange);
  onAnchorsChangeRef.current = onAnchorsChange;
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    setRenderError(null);

    try {
      const scopeBase = { ...sliderValues, pi: Math.PI, e: Math.E };
      const isCompact = el.clientWidth > 0 && el.clientWidth < 500;

      if (engine === 'plotly2d') {
        const expr = params.expression || 'x^2 - 4';
        const [xMin, xMax] = params.x_range || [-7, 7];
        const n = 240;
        const xs: number[] = [];
        const ys: Array<number | null> = [];
        const compiled = compile(expr);

        for (let i = 0; i <= n; i++) {
          const x = xMin + (i / n) * (xMax - xMin);
          xs.push(x);
          try {
            const val = Number(compiled.evaluate({ ...scopeBase, x }));
            ys.push(Number.isFinite(val) && Math.abs(val) < 1e4 ? val : null);
          } catch {
            ys.push(null);
          }
        }

        const traces: Array<Record<string, unknown>> = [
          {
            x: xs,
            y: ys,
            type: 'scatter',
            mode: 'lines',
            name: `f(x) = ${expr}`,
            line: { color: '#2563EB', width: 3.2 },
          },
        ];

        if (params.secondary_expression) {
          const comp2 = compile(params.secondary_expression);
          const ys2 = xs.map((x) => {
            try {
              const val = Number(comp2.evaluate({ ...scopeBase, x }));
              return Number.isFinite(val) && Math.abs(val) < 1e4 ? val : null;
            } catch {
              return null;
            }
          });
          traces.push({
            x: xs,
            y: ys2,
            type: 'scatter',
            mode: 'lines',
            name: `g(x) = ${params.secondary_expression}`,
            line: { color: '#F59E0B', width: 2.6, dash: 'dash' },
          });
        }

        if (params.derivative) {
          try {
            const derivNode = derivative(expr, 'x');
            const derivComp = derivNode.compile();
            const dy = xs.map((x) => {
              const val = Number(derivComp.evaluate({ ...scopeBase, x }));
              return Number.isFinite(val) && Math.abs(val) < 1e4 ? val : null;
            });
            traces.push({
              x: xs,
              y: dy,
              type: 'scatter',
              mode: 'lines',
              name: "Hosila f'(x)",
              line: { color: '#F43F5E', width: 2.2, dash: 'dot' },
            });
          } catch {
            // Skip if non-differentiable
          }
        }

        const markers = params.highlight_points || params.highlights;
        if (markers && markers.length > 0) {
          traces.push({
            x: markers.map((p) => p.x),
            y: markers.map((p) => p.y),
            text: markers.map((p) => p.label),
            textposition: 'top center',
            type: 'scatter',
            mode: 'markers+text',
            name: 'Muhim nuqtalar',
            marker: { color: '#10B981', size: 10, line: { color: '#FFFFFF', width: 1.5 } },
            textfont: { color: '#0F172A', size: 12 },
          });
        }

        Plotly.react(
          el,
          traces,
          {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#334155', family: 'DM Sans, sans-serif', size: isCompact ? 11 : 12 },
            margin: isCompact
              ? { l: 34, r: 12, t: 36, b: 32 }
              : { l: 48, r: 24, t: 32, b: 44 },
            xaxis: {
              title: 'x',
              range: params.x_range,
              constrain: 'domain',
              gridcolor: 'rgba(203, 213, 225, 0.45)',
              zerolinecolor: '#64748B',
              zerolinewidth: 1.8,
            },
            yaxis: {
              title: 'y',
              range: params.y_range,
              autorange: !params.y_range,
              scaleanchor: 'x',
              scaleratio: 1,
              constrain: 'domain',
              gridcolor: 'rgba(203, 213, 225, 0.45)',
              zerolinecolor: '#64748B',
              zerolinewidth: 1.8,
            },
            legend: {
              orientation: 'h',
              y: isCompact ? 1.12 : 1.08,
              font: { size: isCompact ? 10 : 12, color: '#334155' },
            },
            hovermode: 'closest',
          },
          { responsive: true, displaylogo: false, displayModeBar: !isCompact }
        );
      } else {
        const exprZ = params.expression_z || 'x^2 - y^2';
        const [xMin, xMax] = params.x_range || [-3.2, 3.2];
        const [yMin, yMax] = params.y_range || [-3.2, 3.2];
        const gridN = 36;
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i < gridN; i++) {
          xs.push(xMin + (i / (gridN - 1)) * (xMax - xMin));
          ys.push(yMin + (i / (gridN - 1)) * (yMax - yMin));
        }

        const compiledZ = compile(exprZ);
        const zMatrix: number[][] = ys.map((y) =>
          xs.map((x) => {
            try {
              const v = Number(compiledZ.evaluate({ ...scopeBase, x, y }));
              return Number.isFinite(v) ? v : 0;
            } catch {
              return 0;
            }
          })
        );

        Plotly.react(
          el,
          [
            {
              type: 'surface',
              x: xs,
              y: ys,
              z: zMatrix,
              colorscale: EDUCATIONAL_COLORSCALE,
              showscale: false,
              opacity: 0.92,
              contours: params.show_contours
                ? {
                    z: {
                      show: true,
                      usecolormap: true,
                      highlightcolor: '#F43F5E',
                      project: { z: true },
                    },
                  }
                : undefined,
            },
          ],
          {
            paper_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#334155', family: 'DM Sans, sans-serif' },
            margin: { l: 8, r: 8, t: 12, b: 8 },
            scene: {
              bgcolor: 'rgba(0,0,0,0)',
              xaxis: { title: 'x', gridcolor: 'rgba(148,163,184,0.35)', color: '#334155', backgroundcolor: 'rgba(0,0,0,0)' },
              yaxis: { title: 'y', gridcolor: 'rgba(148,163,184,0.35)', color: '#334155', backgroundcolor: 'rgba(0,0,0,0)' },
              zaxis: { title: 'z', gridcolor: 'rgba(148,163,184,0.35)', color: '#334155', backgroundcolor: 'rgba(0,0,0,0)' },
            },
          },
          { responsive: true, displaylogo: false, displayModeBar: !isCompact }
        );
      }
      const emitPlotAnchors = () => {
        const cb = onAnchorsChangeRef.current;
        if (!cb || !plotRef.current) return;
        const w = Math.max(280, plotRef.current.clientWidth);
        const h = Math.max(220, plotRef.current.clientHeight);

        if (engine === 'plotly3d') {
          cb({
            saddle_point: { x: w * 0.5, y: h * 0.48 },
            contour_plane: { x: w * 0.5, y: h * 0.72 },
            overview: { x: w * 0.5, y: h * 0.5 },
          });
          return;
        }

        const gd = plotRef.current as unknown as {
          _fullLayout?: {
            xaxis?: { l2p?: (v: number) => number; _offset?: number };
            yaxis?: { l2p?: (v: number) => number; _offset?: number };
          };
        };
        const xa = gd._fullLayout?.xaxis;
        const ya = gd._fullLayout?.yaxis;
        const toPx = (vx: number, vy: number) => {
          if (xa?.l2p && ya?.l2p) {
            return {
              x: (xa._offset || 0) + xa.l2p(vx),
              y: (ya._offset || 0) + ya.l2p(vy),
            };
          }
          return { x: w * 0.5, y: h * 0.5 };
        };

        const markers = params.highlight_points || params.highlights || [];
        const firstMarker = markers[0];
        const secondMarker = markers[1];

        const anchors: StageAnchorsMap = {
          overview: { x: w * 0.5, y: h * 0.5 },
          vertex_min: firstMarker ? toPx(firstMarker.x, firstMarker.y) : toPx(0, 0),
          x_intercept: secondMarker ? toPx(secondMarker.x, secondMarker.y) : toPx(2, 0),
          derivative_tangent: toPx(1.2, 1.5),
        };
        cb(anchors);
      };

      requestAnimationFrame(emitPlotAnchors);
      const gdEvents = el as unknown as { on?: (evt: string, fn: () => void) => void };
      gdEvents.on?.('plotly_relayout', emitPlotAnchors);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'Grafikni chizishda xatolik');
    }

    const ro = new ResizeObserver(() => {
      if (plotRef.current) {
        try {
          Plotly.Plots.resize(plotRef.current);
        } catch {
          // ignore
        }
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
    };
  }, [engine, params, sliderValues]);

  useEffect(() => {
    const el = plotRef.current;
    return () => {
      if (el) {
        try {
          Plotly.purge(el);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  if (renderError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-transparent text-rose-700 p-6 text-sm font-medium">
        Grafikni hisoblashda xatolik: {renderError}
      </div>
    );
  }

  return <div ref={plotRef} className="w-full h-full bg-transparent" />;
};
