import React, { useEffect, useRef, useState } from 'react';
import type { RenderParams } from '../../types/tutor';

interface Canvas3DFallbackProps {
  params: RenderParams;
  sliderValues: Record<string, number>;
  cameraPos?: [number, number, number];
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function projectPoint(
  p: Vec3,
  yaw: number,
  pitch: number,
  zoom: number,
  cx: number,
  cy: number
): { x: number; y: number; depth: number } {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const x1 = p.x * cosY - p.z * sinY;
  const z1 = p.x * sinY + p.z * cosY;

  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const y2 = p.y * cosP - z1 * sinP;
  const z2 = p.y * sinP + z1 * cosP;

  const dist = 22;
  const perspective = dist / Math.max(4, dist - z2);
  const scale = zoom * perspective;

  return {
    x: cx + x1 * scale,
    y: cy - y2 * scale,
    depth: z2,
  };
}

export const Canvas3DFallback: React.FC<Canvas3DFallbackProps> = ({
  params,
  sliderValues,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rot, setRot] = useState({ yaw: 0.65, pitch: 0.42, zoom: 28 });
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(200, Math.floor(rect.width * dpr));
    canvas.height = Math.max(140, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    const cx = w / 2;
    const cy = h * 0.56;
    const adaptiveZoom = rot.zoom * Math.min(1, Math.min(w, h) / 280);

    // Transparent over warm cream graph paper (#FAF8F3)
    ctx.clearRect(0, 0, w, h);

    const shape = params.shape || 'pyramid';
    const base = sliderValues.base ?? params.base ?? 6;
    const height = sliderValues.height ?? params.height ?? 8;
    const radius = sliderValues.radius ?? params.radius ?? 3.5;
    const cutRatio = sliderValues.cut_ratio ?? params.cut_ratio ?? 0.5;
    const showCut = Boolean(params.show_cross_section);

    const drawLine = (a: Vec3, b: Vec3, color: string, width = 2, dashed = false) => {
      const pa = projectPoint(a, rot.yaw, rot.pitch, adaptiveZoom, cx, cy);
      const pb = projectPoint(b, rot.yaw, rot.pitch, adaptiveZoom, cx, cy);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (dashed) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.restore();
    };

    const drawLabel = (p: Vec3, text: string, color = '#0F172A', border = '#2563EB') => {
      const pt = projectPoint(p, rot.yaw, rot.pitch, adaptiveZoom, cx, cy);
      ctx.save();
      ctx.font = '600 12px "IBM Plex Mono", monospace';
      const tw = ctx.measureText(text).width + 12;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.fillRect(pt.x - tw / 2, pt.y - 11, tw, 20);
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.strokeRect(pt.x - tw / 2, pt.y - 11, tw, 20);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, pt.x, pt.y - 1);
      ctx.restore();
    };

    const drawPolygon = (pts: Vec3[], fill: string, stroke: string) => {
      if (pts.length < 3) return;
      const proj = pts.map((p) => projectPoint(p, rot.yaw, rot.pitch, adaptiveZoom, cx, cy));
      ctx.save();
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(proj[0].x, proj[0].y);
      for (let i = 1; i < proj.length; i++) ctx.lineTo(proj[i].x, proj[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    const yOffset = -height * 0.35;

    if (shape === 'pyramid') {
      const half = base / 2;
      const A: Vec3 = { x: -half, y: yOffset, z: half };
      const B: Vec3 = { x: half, y: yOffset, z: half };
      const C: Vec3 = { x: half, y: yOffset, z: -half };
      const D: Vec3 = { x: -half, y: yOffset, z: -half };
      const S: Vec3 = { x: 0, y: yOffset + height, z: 0 };
      const O: Vec3 = { x: 0, y: yOffset, z: 0 };

      drawPolygon([A, B, C, D], 'rgba(37, 99, 235, 0.14)', '#2563EB');
      drawPolygon([A, B, S], 'rgba(37, 99, 235, 0.1)', '#2563EB');
      drawPolygon([B, C, S], 'rgba(37, 99, 235, 0.08)', '#2563EB');
      drawPolygon([C, D, S], 'rgba(37, 99, 235, 0.06)', '#2563EB');
      drawPolygon([D, A, S], 'rgba(37, 99, 235, 0.08)', '#2563EB');

      if (params.show_height) {
        drawLine(S, O, '#F59E0B', 2.4, true);
        drawLabel({ x: 0.4, y: yOffset + height / 2, z: 0 }, `h=${height}`, '#9A3412', '#F59E0B');
      }

      if (showCut) {
        const cutH = height * (1 - cutRatio);
        const cutHalf = half * cutRatio;
        const cPts: Vec3[] = [
          { x: -cutHalf, y: yOffset + cutH, z: cutHalf },
          { x: cutHalf, y: yOffset + cutH, z: cutHalf },
          { x: cutHalf, y: yOffset + cutH, z: -cutHalf },
          { x: -cutHalf, y: yOffset + cutH, z: -cutHalf },
        ];
        drawPolygon(cPts, 'rgba(244, 63, 94, 0.25)', '#F43F5E');
      }

      drawLabel(A, 'A');
      drawLabel(B, 'B');
      drawLabel(C, 'C');
      drawLabel(D, 'D');
      drawLabel({ x: S.x, y: S.y + 0.5, z: S.z }, 'S', '#1D4ED8', '#2563EB');
      drawLabel(O, 'O', '#9A3412', '#F59E0B');
    } else if (shape === 'cone' || shape === 'cylinder') {
      const segs = 28;
      const baseRing: Vec3[] = [];
      const topRing: Vec3[] = [];
      for (let i = 0; i < segs; i++) {
        const ang = (i / segs) * Math.PI * 2;
        baseRing.push({ x: Math.cos(ang) * radius, y: yOffset, z: Math.sin(ang) * radius });
        if (shape === 'cylinder') {
          topRing.push({ x: Math.cos(ang) * radius, y: yOffset + height, z: Math.sin(ang) * radius });
        }
      }
      drawPolygon(baseRing, 'rgba(37, 99, 235, 0.14)', '#2563EB');
      if (shape === 'cone') {
        const S: Vec3 = { x: 0, y: yOffset + height, z: 0 };
        for (let i = 0; i < segs; i += 4) {
          drawLine(baseRing[i], S, 'rgba(37, 99, 235, 0.55)', 1.5);
        }
        drawLine(S, { x: 0, y: yOffset, z: 0 }, '#F59E0B', 2.2, true);
        if (showCut) {
          const cutH = height * (1 - cutRatio);
          const rCut = radius * cutRatio;
          const cutRing: Vec3[] = [];
          for (let i = 0; i < segs; i++) {
            const ang = (i / segs) * Math.PI * 2;
            cutRing.push({ x: Math.cos(ang) * rCut, y: yOffset + cutH, z: Math.sin(ang) * rCut });
          }
          drawPolygon(cutRing, 'rgba(244, 63, 94, 0.28)', '#F43F5E');
        }
        drawLabel({ x: 0, y: yOffset + height + 0.4, z: 0 }, 'S', '#1D4ED8', '#2563EB');
      } else {
        drawPolygon(topRing, 'rgba(37, 99, 235, 0.16)', '#2563EB');
        for (let i = 0; i < segs; i += 4) {
          drawLine(baseRing[i], topRing[i], 'rgba(37, 99, 235, 0.55)', 1.5);
        }
        drawLine({ x: 0, y: yOffset, z: 0 }, { x: 0, y: yOffset + height, z: 0 }, '#F59E0B', 2, true);
      }
      drawLabel({ x: radius * 0.5, y: yOffset, z: 0 }, `r=${radius}`, '#1D4ED8', '#2563EB');
    } else if (shape === 'vectors') {
      const ax = sliderValues.ax ?? 4;
      const ay = sliderValues.ay ?? 2;
      const bx = sliderValues.bx ?? 1.5;
      const bz = sliderValues.bz ?? 3.5;
      const O: Vec3 = { x: 0, y: 0, z: 0 };
      const A: Vec3 = { x: ax, y: ay, z: 0 };
      const B: Vec3 = { x: bx, y: 2, z: bz };
      const R: Vec3 = { x: ax + bx, y: ay + 2, z: bz };
      drawLine(O, { x: 6, y: 0, z: 0 }, 'rgba(244,63,94,0.45)', 1.2);
      drawLine(O, { x: 0, y: 6, z: 0 }, 'rgba(16,185,129,0.45)', 1.2);
      drawLine(O, { x: 0, y: 0, z: 6 }, 'rgba(37,99,235,0.45)', 1.2);
      drawLine(O, A, '#2563EB', 3);
      drawLine(O, B, '#10B981', 3);
      drawLine(O, R, '#F43F5E', 3.4);
      drawLine(A, R, 'rgba(245,158,11,0.55)', 1.5, true);
      drawLine(B, R, 'rgba(245,158,11,0.55)', 1.5, true);
      drawLabel(A, 'A', '#1D4ED8', '#2563EB');
      drawLabel(B, 'B', '#047857', '#10B981');
      drawLabel(R, 'R=A+B', '#BE123C', '#F43F5E');
    } else if (shape === 'quadric' || shape === 'parametric') {
      const a = sliderValues.a ?? params.a ?? 1.8;
      const b = sliderValues.b ?? params.b ?? 1.5;
      const c = sliderValues.c ?? params.c ?? 2.0;
      const r = sliderValues.radius ?? sliderValues.r ?? params.radius ?? 2.2;
      const axis = params.axis || 'z';
      const tpl = params.template || 'ellipsoid';
      const toVec = (mx: number, my: number, mz: number): Vec3 => ({ x: my, y: mz, z: mx });
      const perm = (u1: number, u2: number, w: number): Vec3 => {
        if (axis === 'x') return toVec(w, u1, u2);
        if (axis === 'y') return toVec(u2, w, u1);
        return toVec(u1, u2, w);
      };

      // Clean x, y, z axes
      drawLine(toVec(-3, 0, 0), toVec(3.2, 0, 0), '#334155', 1.4);
      drawLine(toVec(0, -3, 0), toVec(0, 3.2, 0), '#334155', 1.4);
      drawLine(toVec(0, 0, -3), toVec(0, 0, 3.2), '#334155', 1.4);
      drawLabel(toVec(3.4, 0, 0), 'x', '#1E293B', '#94A3B8');
      drawLabel(toVec(0, 3.4, 0), 'y', '#1E293B', '#94A3B8');
      drawLabel(toVec(0, 0, 3.4), 'z', '#1E293B', '#94A3B8');

      const segs = 32;
      const drawRing = (pts: Vec3[], col: string) => {
        for (let i = 0; i < pts.length - 1; i++) drawLine(pts[i], pts[i + 1], col, 1.8);
      };

      if (tpl === 'sphere' || tpl === 'ellipsoid') {
        const ra = tpl === 'sphere' ? r : a;
        const rb = tpl === 'sphere' ? r : b;
        const rc = tpl === 'sphere' ? r : c;
        const eq: Vec3[] = [];
        const mx: Vec3[] = [];
        const my: Vec3[] = [];
        for (let i = 0; i <= segs; i++) {
          const t = (i / segs) * Math.PI * 2;
          eq.push(toVec(ra * Math.cos(t), rb * Math.sin(t), 0));
          mx.push(toVec(ra * Math.cos(t), 0, rc * Math.sin(t)));
          my.push(toVec(0, rb * Math.cos(t), rc * Math.sin(t)));
        }
        drawRing(eq, '#C26D4F');
        drawRing(mx, '#4F7B64');
        drawRing(my, '#4E7696');
      } else {
        const ring1: Vec3[] = [];
        const ring2: Vec3[] = [];
        for (let i = 0; i <= segs; i++) {
          const t = (i / segs) * Math.PI * 2;
          ring1.push(perm(a * Math.cos(t), b * Math.sin(t), c * 0.65));
          ring2.push(perm(a * Math.cos(t), b * Math.sin(t), -c * 0.65));
        }
        drawRing(ring1, '#C26D4F');
        drawRing(ring2, '#4E7696');
      }
    } else if (
      shape === 'composite3d' ||
      shape === 'svg_extrude' ||
      shape === 'custom_3d_scene'
    ) {
      const prims = params.primitives_3d || [];
      const customObjs = params.custom_3d_objects || [];
      const uScale = sliderValues.scale ?? 1;
      if (shape === 'custom_3d_scene' && customObjs.length > 0) {
        if (params.show_axes !== false) {
          drawLine({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, 'rgba(239,68,68,0.55)', 1.4);
          drawLine({ x: 0, y: 0, z: 0 }, { x: 0, y: 4, z: 0 }, 'rgba(16,185,129,0.55)', 1.4);
          drawLine({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 4 }, 'rgba(37,99,235,0.55)', 1.4);
        }
        for (const obj of customObjs) {
          if (obj.type === 'vector' || obj.type === 'arrow') {
            const f = obj.from || [0, 0, 0];
            const t = obj.to || obj.position || [1.8, 1.8, 0];
            const vf: Vec3 = { x: f[0] * uScale, y: f[1] * uScale, z: f[2] * uScale };
            const vt: Vec3 = { x: t[0] * uScale, y: t[1] * uScale, z: t[2] * uScale };
            drawLine(vf, vt, obj.color || '#F59E0B', 3);
            if (obj.label) {
              drawLabel(vt, obj.label, '#0F172A', obj.color || '#F59E0B');
            }
            continue;
          }
          const pos = obj.position || [0, 0, 0];
          const p = projectPoint(
            { x: pos[0] * uScale, y: pos[1] * uScale, z: pos[2] * uScale },
            rot.yaw,
            rot.pitch,
            adaptiveZoom,
            cx,
            cy
          );
          const rad = Math.max(9, ((obj.args && obj.args[0]) ?? 0.65) * adaptiveZoom * uScale * 0.7);
          ctx.save();
          ctx.fillStyle = obj.color || '#2563EB';
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (obj.type === 'box' || obj.type === 'plane') {
            ctx.rect(p.x - rad, p.y - rad, rad * 2, rad * 2);
          } else {
            ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          if (obj.label) {
            drawLabel(
              { x: pos[0] * uScale, y: pos[1] * uScale, z: pos[2] * uScale },
              obj.label,
              '#0F172A',
              obj.color || '#2563EB'
            );
          }
        }
      } else if (prims.length > 0) {
        for (const pr of prims) {
          const p = projectPoint(
            { x: pr.position[0] * uScale, y: (pr.position[1] - 2) * uScale, z: pr.position[2] * uScale },
            rot.yaw,
            rot.pitch,
            adaptiveZoom,
            cx,
            cy
          );
          const rad = Math.max(8, (pr.args[0] ?? 0.6) * adaptiveZoom * uScale * 0.75);
          ctx.save();
          ctx.fillStyle = pr.color;
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (pr.type === 'box') {
            ctx.rect(p.x - rad, p.y - rad, rad * 2, rad * 2);
          } else {
            ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          if (pr.label) {
            drawLabel(
              { x: pr.position[0] * uScale, y: (pr.position[1] - 2) * uScale, z: pr.position[2] * uScale },
              pr.label,
              '#0F172A',
              '#10B981'
            );
          }
        }
      } else {
        drawLabel({ x: 0, y: 0, z: 0 }, params.object_name_uz || '3D Obyekt', '#0F172A', '#10B981');
      }
    } else {
      const s = (base || 4) / 2;
      const pts: Vec3[] = [
        { x: -s, y: -s, z: s },
        { x: s, y: -s, z: s },
        { x: s, y: -s, z: -s },
        { x: -s, y: -s, z: -s },
        { x: -s, y: s, z: s },
        { x: s, y: s, z: s },
        { x: s, y: s, z: -s },
        { x: -s, y: s, z: -s },
      ];
      drawPolygon([pts[0], pts[1], pts[2], pts[3]], 'rgba(37,99,235,0.14)', '#2563EB');
      drawPolygon([pts[4], pts[5], pts[6], pts[7]], 'rgba(37,99,235,0.18)', '#2563EB');
      for (let i = 0; i < 4; i++) drawLine(pts[i], pts[i + 4], '#2563EB', 2);
    }
  }, [params, sliderValues, rot]);

  return (
    <div className="relative w-full h-full bg-transparent select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none cursor-grab active:cursor-grabbing block"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = { active: true, x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!dragRef.current.active) return;
          const dx = e.clientX - dragRef.current.x;
          const dy = e.clientY - dragRef.current.y;
          dragRef.current = { active: true, x: e.clientX, y: e.clientY };
          setRot((prev) => ({
            ...prev,
            yaw: prev.yaw + dx * 0.01,
            pitch: Math.max(-1.2, Math.min(1.3, prev.pitch + dy * 0.01)),
          }));
        }}
        onPointerUp={() => {
          dragRef.current.active = false;
        }}
        onPointerLeave={() => {
          dragRef.current.active = false;
        }}
        onWheel={(e) => {
          setRot((prev) => ({
            ...prev,
            zoom: Math.max(12, Math.min(56, prev.zoom - e.deltaY * 0.03)),
          }));
        }}
      />
    </div>
  );
};
