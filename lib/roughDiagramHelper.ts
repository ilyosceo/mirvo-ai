import rough from 'roughjs';
import {
  arc as d3Arc,
  curveCatmullRom,
  curveCatmullRomClosed,
  line as d3Line,
} from 'd3-shape';

const roughGen = rough.generator();

export interface RoughFocusPathSpec {
  d: string;
  stroke: string;
  strokeWidth: number;
  fill?: string;
}

/**
 * Generates crisp educational hand-drawn marker rings/halos via MIT-licensed roughjs
 * without needing an HTMLCanvasElement (pure SVG path output).
 */
export function buildRoughFocusEllipsePaths(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  stroke = '#F59E0B',
  seed = 42
): RoughFocusPathSpec[] {
  const safeRx = Math.max(18, rx);
  const safeRy = Math.max(18, ry);
  const drawable = roughGen.ellipse(cx, cy, safeRx * 2, safeRy * 2, {
    stroke,
    strokeWidth: 2.2,
    roughness: 1.35,
    bowing: 1.1,
    seed,
    disableMultiStroke: false,
  });
  const ops = roughGen.toPaths(drawable);
  return ops.map((p) => ({
    d: p.d,
    stroke: p.stroke && p.stroke !== 'none' ? p.stroke : stroke,
    strokeWidth: p.strokeWidth || 2.2,
    fill: p.fill && p.fill !== 'none' ? p.fill : undefined,
  }));
}

/**
 * Smooth open curve path using d3-shape CatmullRom spline (great for DNA strands, springs, hoses, waves).
 */
export function buildSmoothCurveD(
  pts: Array<[number, number]>,
  closed = false,
  alpha = 0.5
): string {
  const gen = d3Line<[number, number]>()
    .x((d) => Number(d[0].toFixed(2)))
    .y((d) => Number(d[1].toFixed(2)))
    .curve(closed ? curveCatmullRomClosed.alpha(alpha) : curveCatmullRom.alpha(alpha));
  return gen(pts) || '';
}

/**
 * Generates an annular sector or gauge arc path via d3-shape arc().
 */
export function buildSectorArcD(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const gen = d3Arc<unknown>()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .startAngle(startAngle)
    .endAngle(endAngle)
    .cornerRadius(4);
  return gen({}) || '';
}

/**
 * Generates a sinusoidal wave or helix strand path using d3-shape.
 */
export function buildSineWaveD(options: {
  x0: number;
  x1: number;
  centerY: number;
  amplitude: number;
  cycles: number;
  phaseRad?: number;
  samples?: number;
}): string {
  const { x0, x1, centerY, amplitude, cycles, phaseRad = 0, samples = 36 } = options;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = x0 + (x1 - x0) * t;
    const y = centerY + Math.sin(t * Math.PI * 2 * cycles + phaseRad) * amplitude;
    pts.push([x, y]);
  }
  return buildSmoothCurveD(pts, false);
}
