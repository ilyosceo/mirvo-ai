import * as THREE from 'three';
import { compile } from 'mathjs';
import type { QuadricDrawLayer, QuadricTemplate, RenderParams } from '../../types/tutor';

export type AxisName = 'x' | 'y' | 'z';

/**
 * Textbook mathematical coordinate mapping into Three.js Y-up world space:
 * Math +x -> Three +Z (front-left)
 * Math +y -> Three +X (front-right)
 * Math +z -> Three +Y (vertical up)
 * Strictly right-handed: e_x × e_y = (0,0,1) × (1,0,0) = (0,1,0) = e_z.
 */
export function mathToThree(mx: number, my: number, mz: number): THREE.Vector3 {
  const sx = Number.isFinite(mx) ? mx : 0;
  const sy = Number.isFinite(my) ? my : 0;
  const sz = Number.isFinite(mz) ? mz : 0;
  return new THREE.Vector3(sy, sz, sx);
}

/** Cyclic axis permutation from canonical z-aligned coordinates (u1, u2, w) */
function permuteAxis(u1: number, u2: number, w: number, axis: AxisName): [number, number, number] {
  if (axis === 'x') return [w, u1, u2];
  if (axis === 'y') return [u2, w, u1];
  return [u1, u2, w];
}

type SheetEvaluator = (u: number, v: number) => THREE.Vector3;

interface CurveSpec {
  points: THREE.Vector3[];
}

interface AnnotationSpec {
  pos: THREE.Vector3;
  text: string;
  color?: string;
  guide?: [THREE.Vector3, THREE.Vector3];
}

interface BuiltSpec {
  sheets: SheetEvaluator[];
  equators: CurveSpec[];
  meridiansA: CurveSpec[];
  meridiansB: CurveSpec[];
  annotations: AnnotationSpec[];
  anchors: Record<string, THREE.Vector3>;
  defaultColor: number;
  maxHalfExtent: number;
}

function sampleCurve(fn: (t: number) => THREE.Vector3, steps = 72): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    pts.push(fn(i / steps));
  }
  return pts;
}

function buildQuadricSpec(
  template: QuadricTemplate,
  axis: AxisName,
  a: number,
  b: number,
  c: number,
  r: number,
  p: number
): BuiltSpec {
  const toWorld = (u1: number, u2: number, w: number): THREE.Vector3 => {
    const [mx, my, mz] = permuteAxis(u1, u2, w, axis);
    return mathToThree(mx, my, mz);
  };

  if (template === 'sphere') {
    const R = Math.max(0.5, r);
    const sheet: SheetEvaluator = (u, v) => {
      const theta = u * Math.PI * 2;
      const phi = v * Math.PI;
      return mathToThree(
        R * Math.sin(phi) * Math.cos(theta),
        R * Math.sin(phi) * Math.sin(theta),
        R * Math.cos(phi)
      );
    };
    const eq = sampleCurve((t) => {
      const th = t * Math.PI * 2;
      return mathToThree(R * Math.cos(th), R * Math.sin(th), 0);
    });
    const mA = sampleCurve((t) => {
      const ph = t * Math.PI * 2;
      return mathToThree(R * Math.sin(ph), 0, R * Math.cos(ph));
    });
    const mB = sampleCurve((t) => {
      const ph = t * Math.PI * 2;
      return mathToThree(0, R * Math.sin(ph), R * Math.cos(ph));
    });
    const radiusDir = mathToThree(R * 0.72, R * 0.14, -R * 0.06);
    const rTip = mathToThree(R, 0, 0);
    return {
      sheets: [sheet],
      equators: [{ points: eq }],
      meridiansA: [{ points: mA }],
      meridiansB: [{ points: mB }],
      annotations: [
        {
          pos: radiusDir.clone().multiplyScalar(0.55).add(new THREE.Vector3(0, 0.18, 0)),
          text: 'r',
          color: '#335E7A',
          guide: [new THREE.Vector3(0, 0, 0), rTip],
        },
      ],
      anchors: {
        overview: new THREE.Vector3(0, 0, 0),
        axes_origin: new THREE.Vector3(0, 0, 0),
        equator_ring: mathToThree(R * 0.7, R * 0.7, 0),
        meridian_xz: mathToThree(R * 0.65, 0, R * 0.75),
        radius_r: rTip.clone().multiplyScalar(0.55),
        vertex_S: mathToThree(0, 0, R),
      },
      defaultColor: 0x7ab4cb,
      maxHalfExtent: R,
    };
  }

  if (template === 'ellipsoid') {
    const sheet: SheetEvaluator = (u, v) => {
      const theta = u * Math.PI * 2;
      const phi = v * Math.PI;
      return mathToThree(
        a * Math.sin(phi) * Math.cos(theta),
        b * Math.sin(phi) * Math.sin(theta),
        c * Math.cos(phi)
      );
    };
    const eq = sampleCurve((t) => {
      const th = t * Math.PI * 2;
      return mathToThree(a * Math.cos(th), b * Math.sin(th), 0);
    });
    const mA = sampleCurve((t) => {
      const ph = t * Math.PI * 2;
      return mathToThree(a * Math.sin(ph), 0, c * Math.cos(ph));
    });
    const mB = sampleCurve((t) => {
      const ph = t * Math.PI * 2;
      return mathToThree(0, b * Math.sin(ph), c * Math.cos(ph));
    });
    return {
      sheets: [sheet],
      equators: [{ points: eq }],
      meridiansA: [{ points: mA }],
      meridiansB: [{ points: mB }],
      annotations: [
        { pos: mathToThree(a * 0.52, -0.18, 0.16), text: 'a', color: '#4B785F' },
        { pos: mathToThree(-0.18, b * 0.52, 0.16), text: 'b', color: '#4B7596' },
        { pos: mathToThree(0.16, 0.16, c * 0.54), text: 'c', color: '#9E583F' },
      ],
      anchors: {
        overview: new THREE.Vector3(0, 0, 0),
        axes_origin: new THREE.Vector3(0, 0, 0),
        equator_ring: mathToThree(a * 0.7, b * 0.7, 0),
        meridian_xz: mathToThree(a * 0.65, 0, c * 0.75),
        vertex_S: mathToThree(0, 0, c),
      },
      defaultColor: 0x8bb493,
      maxHalfExtent: Math.max(a, b, c),
    };
  }

  if (template === 'hyperboloid_one_sheet') {
    const sMax = 1.08;
    const sheet: SheetEvaluator = (u, v) => {
      const th = u * Math.PI * 2;
      const s = (v * 2 - 1) * sMax;
      return toWorld(a * Math.cosh(s) * Math.cos(th), b * Math.cosh(s) * Math.sin(th), c * Math.sinh(s));
    };
    const eq = sampleCurve((t) => {
      const th = t * Math.PI * 2;
      return toWorld(a * Math.cos(th), b * Math.sin(th), 0);
    });
    const mA1 = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(a * Math.cosh(s), 0, c * Math.sinh(s));
    });
    const mA2 = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(-a * Math.cosh(s), 0, c * Math.sinh(s));
    });
    const mB1 = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(0, b * Math.cosh(s), c * Math.sinh(s));
    });
    const mB2 = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(0, -b * Math.cosh(s), c * Math.sinh(s));
    });
    const maxR = Math.max(a, b) * Math.cosh(sMax);
    const maxW = c * Math.sinh(sMax);
    return {
      sheets: [sheet],
      equators: [{ points: eq }],
      meridiansA: [{ points: mA1 }, { points: mA2 }],
      meridiansB: [{ points: mB1 }, { points: mB2 }],
      annotations: [
        { pos: toWorld(a * 0.55, 0.16, -0.15), text: 'a', color: '#C26D4F' },
        { pos: toWorld(0.16, b * 0.55, -0.15), text: 'b', color: '#4E7899' },
      ],
      anchors: {
        overview: new THREE.Vector3(0, 0, 0),
        axes_origin: new THREE.Vector3(0, 0, 0),
        equator_ring: toWorld(a * 0.72, b * 0.72, 0),
        meridian_xz: toWorld(a * 1.15, 0, c * 0.6),
        vertex_S: toWorld(0, 0, maxW),
      },
      defaultColor: 0x7cb3ae,
      maxHalfExtent: Math.max(maxR, maxW),
    };
  }

  if (template === 'hyperboloid_two_sheets') {
    const sMax = 1.02;
    const sheetPos: SheetEvaluator = (u, v) => {
      const th = u * Math.PI * 2;
      const s = v * sMax;
      return toWorld(a * Math.sinh(s) * Math.cos(th), b * Math.sinh(s) * Math.sin(th), c * Math.cosh(s));
    };
    const sheetNeg: SheetEvaluator = (u, v) => {
      const th = u * Math.PI * 2;
      const s = v * sMax;
      return toWorld(a * Math.sinh(s) * Math.cos(th), b * Math.sinh(s) * Math.sin(th), -c * Math.cosh(s));
    };
    const sRing = 0.76;
    const eqPos = sampleCurve((t) => {
      const th = t * Math.PI * 2;
      return toWorld(
        a * Math.sinh(sRing) * Math.cos(th),
        b * Math.sinh(sRing) * Math.sin(th),
        c * Math.cosh(sRing)
      );
    });
    const eqNeg = sampleCurve((t) => {
      const th = t * Math.PI * 2;
      return toWorld(
        a * Math.sinh(sRing) * Math.cos(th),
        b * Math.sinh(sRing) * Math.sin(th),
        -c * Math.cosh(sRing)
      );
    });
    const mAPos = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(a * Math.sinh(s), 0, c * Math.cosh(s));
    });
    const mANeg = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(a * Math.sinh(s), 0, -c * Math.cosh(s));
    });
    const mBPos = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(0, b * Math.sinh(s), c * Math.cosh(s));
    });
    const mBNeg = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(0, b * Math.sinh(s), -c * Math.cosh(s));
    });
    const maxW = c * Math.cosh(sMax);
    const maxR = Math.max(a, b) * Math.sinh(sMax);
    return {
      sheets: [sheetPos, sheetNeg],
      equators: [{ points: eqPos }, { points: eqNeg }],
      meridiansA: [{ points: mAPos }, { points: mANeg }],
      meridiansB: [{ points: mBPos }, { points: mBNeg }],
      annotations: [
        { pos: toWorld(0.2, 0.2, c * 0.55), text: 'c', color: '#7D5B94' },
      ],
      anchors: {
        overview: new THREE.Vector3(0, 0, 0),
        axes_origin: new THREE.Vector3(0, 0, 0),
        equator_ring: toWorld(a * Math.sinh(sRing), 0, c * Math.cosh(sRing)),
        meridian_xz: toWorld(0, b * Math.sinh(0.6), c * Math.cosh(0.6)),
        vertex_S: toWorld(0, 0, c),
      },
      defaultColor: 0xb89dc7,
      maxHalfExtent: Math.max(maxW, maxR),
    };
  }

  if (template === 'elliptic_cone') {
    const sMax = 1.25;
    const sheetPos: SheetEvaluator = (u, v) => {
      const th = u * Math.PI * 2;
      const s = v * sMax;
      return toWorld(a * s * Math.cos(th), b * s * Math.sin(th), c * s);
    };
    const sheetNeg: SheetEvaluator = (u, v) => {
      const th = u * Math.PI * 2;
      const s = -v * sMax;
      return toWorld(a * s * Math.cos(th), b * s * Math.sin(th), c * s);
    };
    const sRing = 0.88;
    const eqPos = sampleCurve((t) => {
      const th = t * Math.PI * 2;
      return toWorld(a * sRing * Math.cos(th), b * sRing * Math.sin(th), c * sRing);
    });
    const eqNeg = sampleCurve((t) => {
      const th = t * Math.PI * 2;
      return toWorld(a * sRing * Math.cos(th), b * sRing * Math.sin(th), -c * sRing);
    });
    const genA1 = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(a * s, 0, c * s);
    });
    const genA2 = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(-a * s, 0, c * s);
    });
    const genB1 = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(0, b * s, c * s);
    });
    const genB2 = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(0, -b * s, c * s);
    });
    return {
      sheets: [sheetPos, sheetNeg],
      equators: [{ points: eqPos }, { points: eqNeg }],
      meridiansA: [{ points: genA1 }, { points: genA2 }],
      meridiansB: [{ points: genB1 }, { points: genB2 }],
      annotations: [
        { pos: toWorld(a * sRing * 0.6, -0.18, c * sRing + 0.14), text: 'a', color: '#4E7F66' },
        { pos: toWorld(-0.18, b * sRing * 0.6, c * sRing + 0.14), text: 'b', color: '#4E7899' },
      ],
      anchors: {
        overview: new THREE.Vector3(0, 0, 0),
        axes_origin: new THREE.Vector3(0, 0, 0),
        equator_ring: toWorld(a * sRing * 0.7, b * sRing * 0.7, c * sRing),
        meridian_xz: toWorld(a * 0.85, 0, c * 0.85),
        vertex_S: new THREE.Vector3(0, 0, 0),
      },
      defaultColor: 0xd49c87,
      maxHalfExtent: Math.max(a, b, c) * sMax,
    };
  }

  if (template === 'elliptic_paraboloid') {
    const rMax = 1.25;
    const sheet: SheetEvaluator = (u, v) => {
      const th = u * Math.PI * 2;
      const rad = v * rMax;
      return toWorld(a * rad * Math.cos(th), b * rad * Math.sin(th), c * rad * rad);
    };
    const rRing = 0.92;
    const eq = sampleCurve((t) => {
      const th = t * Math.PI * 2;
      return toWorld(a * rRing * Math.cos(th), b * rRing * Math.sin(th), c * rRing * rRing);
    });
    const mA = sampleCurve((t) => {
      const s = (t * 2 - 1) * rMax;
      return toWorld(a * s, 0, c * s * s);
    });
    const mB = sampleCurve((t) => {
      const s = (t * 2 - 1) * rMax;
      return toWorld(0, b * s, c * s * s);
    });
    return {
      sheets: [sheet],
      equators: [{ points: eq }],
      meridiansA: [{ points: mA }],
      meridiansB: [{ points: mB }],
      annotations: [
        { pos: toWorld(a * rRing * 0.6, -0.18, c * rRing * rRing + 0.15), text: 'a', color: '#4E7F66' },
        { pos: toWorld(-0.18, b * rRing * 0.6, c * rRing * rRing + 0.15), text: 'b', color: '#4E7899' },
      ],
      anchors: {
        overview: toWorld(0, 0, c * 0.65),
        axes_origin: new THREE.Vector3(0, 0, 0),
        equator_ring: toWorld(a * rRing * 0.72, b * rRing * 0.72, c * rRing * rRing),
        meridian_xz: toWorld(a * 0.85, 0, c * 0.72),
        vertex_S: new THREE.Vector3(0, 0, 0),
      },
      defaultColor: 0x91b493,
      maxHalfExtent: Math.max(a * rMax, b * rMax, c * rMax * rMax),
    };
  }

  if (template === 'hyperbolic_paraboloid') {
    const span = 1.15;
    const sheet: SheetEvaluator = (u, v) => {
      const uu = (u * 2 - 1) * span;
      const vv = (v * 2 - 1) * span;
      return toWorld(a * uu, b * vv, c * (uu * uu - vv * vv));
    };
    // Level asymptotes at w = 0: uu = ±vv
    const asym1 = sampleCurve((t) => {
      const s = (t * 2 - 1) * span;
      return toWorld(a * s, b * s, 0);
    });
    const asym2 = sampleCurve((t) => {
      const s = (t * 2 - 1) * span;
      return toWorld(a * s, -b * s, 0);
    });
    // Upward parabola v=0
    const mA = sampleCurve((t) => {
      const s = (t * 2 - 1) * span;
      return toWorld(a * s, 0, c * s * s);
    });
    // Downward parabola u=0
    const mB = sampleCurve((t) => {
      const s = (t * 2 - 1) * span;
      return toWorld(0, b * s, -c * s * s);
    });
    return {
      sheets: [sheet],
      equators: [{ points: asym1 }, { points: asym2 }],
      meridiansA: [{ points: mA }],
      meridiansB: [{ points: mB }],
      annotations: [
        { pos: toWorld(a * 0.85, 0.22, c * 0.72), text: 'a', color: '#4E7F66' },
        { pos: toWorld(0.22, b * 0.85, -c * 0.72), text: 'b', color: '#4E7899' },
      ],
      anchors: {
        overview: new THREE.Vector3(0, 0, 0),
        axes_origin: new THREE.Vector3(0, 0, 0),
        saddle_point: new THREE.Vector3(0, 0, 0),
        equator_ring: toWorld(a * 0.65, b * 0.65, 0),
        meridian_xz: toWorld(a * 0.7, 0, c * 0.49),
        vertex_S: new THREE.Vector3(0, 0, 0),
      },
      defaultColor: 0xd49f89,
      maxHalfExtent: Math.max(a * span, b * span, c * span * span),
    };
  }

  if (template === 'elliptic_cylinder') {
    const halfW = Math.max(1.8, c * 1.15);
    const sheet: SheetEvaluator = (u, v) => {
      const th = u * Math.PI * 2;
      const w = (v * 2 - 1) * halfW;
      return toWorld(a * Math.cos(th), b * Math.sin(th), w);
    };
    const eq = sampleCurve((t) => {
      const th = t * Math.PI * 2;
      return toWorld(a * Math.cos(th), b * Math.sin(th), 0);
    });
    const rA1 = sampleCurve((t) => toWorld(a, 0, (t * 2 - 1) * halfW));
    const rA2 = sampleCurve((t) => toWorld(-a, 0, (t * 2 - 1) * halfW));
    const rB1 = sampleCurve((t) => toWorld(0, b, (t * 2 - 1) * halfW));
    const rB2 = sampleCurve((t) => toWorld(0, -b, (t * 2 - 1) * halfW));
    const topRim = sampleCurve((t) => {
      const th = t * Math.PI * 2;
      return toWorld(a * Math.cos(th), b * Math.sin(th), halfW);
    });
    const botRim = sampleCurve((t) => {
      const th = t * Math.PI * 2;
      return toWorld(a * Math.cos(th), b * Math.sin(th), -halfW);
    });
    return {
      sheets: [sheet],
      equators: [{ points: eq }],
      meridiansA: [{ points: rA1 }, { points: rA2 }],
      meridiansB: [{ points: rB1 }, { points: rB2 }, { points: topRim }, { points: botRim }],
      annotations: [
        { pos: toWorld(a * 0.54, -0.18, 0.14), text: 'a', color: '#4E7F66' },
        { pos: toWorld(-0.18, b * 0.54, 0.14), text: 'b', color: '#4E7899' },
      ],
      anchors: {
        overview: new THREE.Vector3(0, 0, 0),
        axes_origin: new THREE.Vector3(0, 0, 0),
        equator_ring: toWorld(a * 0.72, b * 0.72, 0),
        meridian_xz: toWorld(a, 0, halfW * 0.5),
      },
      defaultColor: 0x91b1c8,
      maxHalfExtent: Math.max(a, b, halfW),
    };
  }

  if (template === 'hyperbolic_cylinder') {
    const sMax = 1.05;
    const halfW = Math.max(1.8, c * 1.1);
    const sheetPos: SheetEvaluator = (u, v) => {
      const s = (u * 2 - 1) * sMax;
      const w = (v * 2 - 1) * halfW;
      return toWorld(a * Math.cosh(s), b * Math.sinh(s), w);
    };
    const sheetNeg: SheetEvaluator = (u, v) => {
      const s = (u * 2 - 1) * sMax;
      const w = (v * 2 - 1) * halfW;
      return toWorld(-a * Math.cosh(s), b * Math.sinh(s), w);
    };
    const eqPos = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(a * Math.cosh(s), b * Math.sinh(s), 0);
    });
    const eqNeg = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(-a * Math.cosh(s), b * Math.sinh(s), 0);
    });
    const vertPos = sampleCurve((t) => toWorld(a, 0, (t * 2 - 1) * halfW));
    const vertNeg = sampleCurve((t) => toWorld(-a, 0, (t * 2 - 1) * halfW));
    const topPos = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(a * Math.cosh(s), b * Math.sinh(s), halfW);
    });
    const topNeg = sampleCurve((t) => {
      const s = (t * 2 - 1) * sMax;
      return toWorld(-a * Math.cosh(s), b * Math.sinh(s), halfW);
    });
    return {
      sheets: [sheetPos, sheetNeg],
      equators: [{ points: eqPos }, { points: eqNeg }],
      meridiansA: [{ points: vertPos }, { points: vertNeg }],
      meridiansB: [{ points: topPos }, { points: topNeg }],
      annotations: [{ pos: toWorld(a * 0.55, 0.2, 0.2), text: 'a', color: '#C26D4F' }],
      anchors: {
        overview: new THREE.Vector3(0, 0, 0),
        axes_origin: new THREE.Vector3(0, 0, 0),
        equator_ring: toWorld(a, 0, 0),
        meridian_xz: toWorld(a * 1.15, b * 0.55, halfW * 0.4),
      },
      defaultColor: 0xb49ec4,
      maxHalfExtent: Math.max(a * Math.cosh(sMax), b * Math.sinh(sMax), halfW),
    };
  }

  // parabolic_cylinder: u1^2 = 4 p u2 along w
  const safeP = Math.max(0.25, p);
  const u1Max = Math.min(2.6, Math.max(1.6, 2 * Math.sqrt(safeP * 1.5)));
  const halfW = Math.max(1.8, c * 1.1);
  const sheet: SheetEvaluator = (u, v) => {
    const s = (u * 2 - 1) * u1Max;
    const w = (v * 2 - 1) * halfW;
    return toWorld(s, (s * s) / (4 * safeP), w);
  };
  const eq = sampleCurve((t) => {
    const s = (t * 2 - 1) * u1Max;
    return toWorld(s, (s * s) / (4 * safeP), 0);
  });
  const spine = sampleCurve((t) => toWorld(0, 0, (t * 2 - 1) * halfW));
  const rimTop = sampleCurve((t) => {
    const s = (t * 2 - 1) * u1Max;
    return toWorld(s, (s * s) / (4 * safeP), halfW);
  });
  const rimBot = sampleCurve((t) => {
    const s = (t * 2 - 1) * u1Max;
    return toWorld(s, (s * s) / (4 * safeP), -halfW);
  });
  const u2Max = (u1Max * u1Max) / (4 * safeP);
  return {
    sheets: [sheet],
    equators: [{ points: eq }],
    meridiansA: [{ points: spine }],
    meridiansB: [{ points: rimTop }, { points: rimBot }],
    annotations: [{ pos: toWorld(0.22, safeP, 0.2), text: 'p', color: '#4E7F66' }],
    anchors: {
      overview: toWorld(0, u2Max * 0.45, 0),
      axes_origin: new THREE.Vector3(0, 0, 0),
      equator_ring: toWorld(u1Max * 0.6, (u1Max * 0.6) ** 2 / (4 * safeP), 0),
      meridian_xz: toWorld(0, 0, halfW * 0.5),
    },
    defaultColor: 0x84b3ae,
    maxHalfExtent: Math.max(u1Max, u2Max, halfW),
  };
}

function buildCustomParametricSpec(
  params: RenderParams,
  sliderValues: Record<string, number>,
  a: number,
  b: number,
  c: number,
  r: number,
  p: number
): BuiltSpec {
  const exprX = params.parametric_x || 'a * cos(u) * sin(v)';
  const exprY = params.parametric_y || 'b * sin(u) * sin(v)';
  const exprZ = params.parametric_z || 'c * cos(v)';
  const [uMin, uMax] = params.u_range || [0, Math.PI * 2];
  const [vMin, vMax] = params.v_range || [0, Math.PI];

  let fnX = compile('a * cos(u) * sin(v)');
  let fnY = compile('b * sin(u) * sin(v)');
  let fnZ = compile('c * cos(v)');
  try {
    fnX = compile(exprX);
    fnY = compile(exprY);
    fnZ = compile(exprZ);
  } catch {
    // keep ellipsoid fallback if malformed
  }

  const baseScope: Record<string, number> = {
    a,
    b,
    c,
    r,
    p,
    pi: Math.PI,
    e: Math.E,
    ...sliderValues,
  };

  let maxExt = 2.0;
  const evalPt = (uNorm: number, vNorm: number): THREE.Vector3 => {
    const u = uMin + uNorm * (uMax - uMin);
    const v = vMin + vNorm * (vMax - vMin);
    const scope = { ...baseScope, u, v };
    let mx = 0;
    let my = 0;
    let mz = 0;
    try {
      const rx = Number(fnX.evaluate(scope));
      const ry = Number(fnY.evaluate(scope));
      const rz = Number(fnZ.evaluate(scope));
      mx = Number.isFinite(rx) ? Math.max(-12, Math.min(12, rx)) : 0;
      my = Number.isFinite(ry) ? Math.max(-12, Math.min(12, ry)) : 0;
      mz = Number.isFinite(rz) ? Math.max(-12, Math.min(12, rz)) : 0;
      maxExt = Math.max(maxExt, Math.abs(mx), Math.abs(my), Math.abs(mz));
    } catch {
      // ignore transient math evaluation failure
    }
    return mathToThree(mx, my, mz);
  };

  // Pre-probe bounding extent
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j <= 8; j++) {
      evalPt(i / 8, j / 8);
    }
  }

  const eq = sampleCurve((t) => evalPt(t, 0.5));
  const mA = sampleCurve((t) => evalPt(0.0, t));
  const mB = sampleCurve((t) => evalPt(0.25, t));

  return {
    sheets: [evalPt],
    equators: [{ points: eq }],
    meridiansA: [{ points: mA }],
    meridiansB: [{ points: mB }],
    annotations: [],
    anchors: {
      overview: new THREE.Vector3(0, 0, 0),
      axes_origin: new THREE.Vector3(0, 0, 0),
      equator_ring: evalPt(0.125, 0.5),
      meridian_xz: evalPt(0.0, 0.35),
    },
    defaultColor: 0x87b1c9,
    maxHalfExtent: maxExt,
  };
}

export interface QuadricAxisArrow {
  name: 'x' | 'y' | 'z';
  line: [THREE.Vector3, THREE.Vector3];
  tipPosition: THREE.Vector3;
  quaternion: THREE.Quaternion;
  labelPosition: THREE.Vector3;
}

export interface QuadricRenderData {
  sheets: SheetEvaluator[];
  slices: number;
  stacks: number;
  wireframePairs: THREE.Vector3[];
  equators: THREE.Vector3[][];
  meridiansA: THREE.Vector3[][];
  meridiansB: THREE.Vector3[][];
  axes: QuadricAxisArrow[];
  originLabelPos: THREE.Vector3;
  annotations: AnnotationSpec[];
  anchors: Record<string, THREE.Vector3>;
  overview: THREE.Vector3;
  surfaceHex: number;
  layers: {
    showAxes: boolean;
    showWireframe: boolean;
    showSurface: boolean;
    showEquator: boolean;
    showMeridians: boolean;
    showLabels: boolean;
  };
}

export function computeQuadricOrParametricData(options: {
  params: RenderParams;
  sliderValues: Record<string, number>;
  isSoftwareGl: boolean;
}): QuadricRenderData {
  const { params, sliderValues, isSoftwareGl } = options;

  const a = sliderValues.a ?? params.a ?? 1.8;
  const b = sliderValues.b ?? params.b ?? 1.5;
  const c = sliderValues.c ?? params.c ?? 2.0;
  const r = sliderValues.radius ?? sliderValues.r ?? params.radius ?? 2.2;
  const p = sliderValues.p ?? params.p ?? 0.6;
  const axis: AxisName = params.axis || 'z';

  const spec =
    params.shape === 'parametric'
      ? buildCustomParametricSpec(params, sliderValues, a, b, c, r, p)
      : buildQuadricSpec(params.template || 'ellipsoid', axis, a, b, c, r, p);

  const rawDraw = params.draw;
  const layerSet = new Set<QuadricDrawLayer>(
    rawDraw && rawDraw.length > 0
      ? rawDraw
      : ['axes', 'wireframe', 'surface', 'equator_ring', 'meridians', 'labels']
  );

  const showAxes = layerSet.has('axes');
  const showWireframe = layerSet.has('wireframe');
  const showSurface = layerSet.has('surface');
  const showEquator = layerSet.has('equator_ring') || layerSet.has('traces');
  const showMeridians = layerSet.has('meridians') || layerSet.has('traces');
  const showLabels = layerSet.has('labels');

  let surfaceHex = spec.defaultColor;
  if (params.surface_color) {
    try {
      surfaceHex = new THREE.Color(params.surface_color).getHex();
    } catch {
      surfaceHex = spec.defaultColor;
    }
  }

  const slices = isSoftwareGl ? 32 : 48;
  const stacks = isSoftwareGl ? 24 : 34;

  const wireframePairs: THREE.Vector3[] = [];
  if (showWireframe) {
    const uIsoCount = 8;
    const vIsoCount = 8;
    const curveSteps = isSoftwareGl ? 22 : 30;

    for (const sheetFn of spec.sheets) {
      for (let i = 0; i <= uIsoCount; i++) {
        const u = i / uIsoCount;
        for (let j = 0; j < curveSteps; j++) {
          wireframePairs.push(sheetFn(u, j / curveSteps), sheetFn(u, (j + 1) / curveSteps));
        }
      }
      for (let j = 0; j <= vIsoCount; j++) {
        const v = j / vIsoCount;
        for (let i = 0; i < curveSteps; i++) {
          wireframePairs.push(sheetFn(i / curveSteps, v), sheetFn((i + 1) / curveSteps, v));
        }
      }
    }
  }

  const axisPosLen = Math.max(2.6, spec.maxHalfExtent + 0.95);
  const axisNegLen = Math.max(2.1, spec.maxHalfExtent + 0.55);

  const makeAxis = (
    name: 'x' | 'y' | 'z',
    neg: THREE.Vector3,
    pos: THREE.Vector3,
    dir: THREE.Vector3,
    labelOffset: THREE.Vector3
  ): QuadricAxisArrow => {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return {
      name,
      line: [neg, pos],
      tipPosition: pos.clone().addScaledVector(dir, -0.05),
      quaternion: q,
      labelPosition: pos.clone().add(labelOffset),
    };
  };

  const axes: QuadricAxisArrow[] = [
    makeAxis(
      'x',
      mathToThree(-axisNegLen, 0, 0),
      mathToThree(axisPosLen, 0, 0),
      mathToThree(1, 0, 0),
      mathToThree(0.24, 0, -0.05)
    ),
    makeAxis(
      'y',
      mathToThree(0, -axisNegLen, 0),
      mathToThree(0, axisPosLen, 0),
      mathToThree(0, 1, 0),
      mathToThree(0, 0.24, -0.05)
    ),
    makeAxis(
      'z',
      mathToThree(0, 0, -axisNegLen),
      mathToThree(0, 0, axisPosLen),
      mathToThree(0, 0, 1),
      mathToThree(0, 0, 0.24)
    ),
  ];

  return {
    sheets: spec.sheets,
    slices,
    stacks,
    wireframePairs,
    equators: spec.equators.map((e) => e.points),
    meridiansA: spec.meridiansA.map((m) => m.points),
    meridiansB: spec.meridiansB.map((m) => m.points),
    axes,
    originLabelPos: mathToThree(0.18, 0.14, -0.18),
    annotations: spec.annotations,
    anchors: spec.anchors,
    overview: new THREE.Vector3(0, 0, 0),
    surfaceHex,
    layers: {
      showAxes,
      showWireframe,
      showSurface,
      showEquator,
      showMeridians,
      showLabels,
    },
  };
}

