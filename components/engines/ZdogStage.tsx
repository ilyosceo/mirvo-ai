import React, { useEffect, useRef } from 'react';
import Zdog from 'zdog';
import gsap from 'gsap';
import type { RenderParams, StageAnchorsMap } from '../../types/tutor';

export interface ZdogStageProps {
  params: RenderParams;
  sliderValues: Record<string, number>;
  autoRotate?: boolean;
  cameraZoom?: number;
  stepIndex?: number;
  isPlaying?: boolean;
  onAnchorsChange?: (anchors: StageAnchorsMap) => void;
}

export const ZdogStage: React.FC<ZdogStageProps> = ({
  params,
  sliderValues,
  autoRotate = false,
  cameraZoom = 1,
  stepIndex = 0,
  isPlaying = false,
  onAnchorsChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);
  const zoomTweenRef = useRef({ zoom: 1 });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = Math.max(320, container.clientWidth || 640);
    const height = Math.max(240, container.clientHeight || 420);
    canvas.width = width;
    canvas.height = height;

    const illo = new Zdog.Illustration({
      element: canvas,
      zoom: 1,
      dragRotate: true,
      onDragStart: () => {
        isDraggingRef.current = true;
      },
      onDragEnd: () => {
        isDraggingRef.current = false;
      },
    });

    illo.rotate.x = -0.34;
    illo.rotate.y = 0.58;

    const scaleBase = Math.min(width, height) / 340;
    const root = new Zdog.Group({
      addTo: illo,
      scale: { x: scaleBase, y: scaleBase, z: scaleBase },
    });

    // Subtle 2.5D reference base ring & axes
    new Zdog.Ellipse({
      addTo: root,
      diameter: 190,
      rotate: { x: Zdog.TAU / 4 },
      translate: { y: 68 },
      stroke: 2,
      color: 'rgba(148, 163, 184, 0.35)',
    });

    const rScale = (sliderValues.r ?? sliderValues.radius ?? params.radius ?? 3) / 3;
    const hScale = (sliderValues.h ?? sliderValues.height ?? params.height ?? 4) / 4;
    const bScale = (sliderValues.a ?? sliderValues.base ?? params.base ?? 3.5) / 3.5;

    const shape = params.shape || 'cylinder';
    const customObjects = params.custom_3d_objects || params.primitives_3d || [];

    if (customObjects.length > 0) {
      customObjects.slice(0, 24).forEach((obj) => {
        const pos = obj.position || [0, 0, 0];
        const tx = (pos[0] || 0) * 26;
        const ty = -(pos[1] || 0) * 26;
        const tz = (pos[2] || 0) * 26;
        const color = obj.color || '#0071E3';
        const args = obj.args || [];

        if (obj.type === 'sphere') {
          const rad = Math.max(12, (args[0] || 0.8) * 26);
          new Zdog.Shape({
            addTo: root,
            translate: { x: tx, y: ty, z: tz },
            stroke: rad * 2,
            color,
          });
        } else if (obj.type === 'cylinder' || obj.type === 'capsule') {
          const rad = Math.max(10, (args[0] || 0.7) * 24);
          const len = Math.max(16, (args[2] || args[1] || 1.6) * 28);
          new Zdog.Cylinder({
            addTo: root,
            translate: { x: tx, y: ty, z: tz },
            rotate: { x: Zdog.TAU / 4 },
            diameter: rad * 2,
            length: len,
            stroke: false,
            color,
            backface: '#1E40AF',
          });
        } else if (obj.type === 'cone') {
          const rad = Math.max(12, (args[0] || 0.8) * 26);
          const len = Math.max(20, (args[1] || 1.8) * 28);
          new Zdog.Cone({
            addTo: root,
            translate: { x: tx, y: ty + len * 0.3, z: tz },
            rotate: { x: Zdog.TAU / 4 },
            diameter: rad * 2,
            length: len,
            stroke: false,
            color,
            backface: '#1D4ED8',
          });
        } else if (obj.type === 'torus' || obj.type === 'ring') {
          const rad = Math.max(18, (args[0] || 1.1) * 28);
          new Zdog.Ellipse({
            addTo: root,
            translate: { x: tx, y: ty, z: tz },
            diameter: rad * 2,
            stroke: Math.max(6, (args[1] || 0.25) * 24),
            color,
          });
        } else {
          const w = Math.max(16, (args[0] || 1.2) * 26);
          const h = Math.max(16, (args[1] || 1.2) * 26);
          const d = Math.max(16, (args[2] || 1.2) * 26);
          new Zdog.Box({
            addTo: root,
            translate: { x: tx, y: ty, z: tz },
            width: w,
            height: h,
            depth: d,
            stroke: false,
            color,
            leftFace: '#2563EB',
            rightFace: '#1D4ED8',
            topFace: '#60A5FA',
            bottomFace: '#1E3A8A',
          });
        }
      });
    } else if (shape === 'cone') {
      new Zdog.Cone({
        addTo: root,
        diameter: Math.max(40, 110 * rScale),
        length: Math.max(45, 130 * hScale),
        rotate: { x: Zdog.TAU / 4 },
        translate: { y: 48 },
        stroke: false,
        color: '#2563EB',
        backface: '#93C5FD',
      });
    } else if (shape === 'sphere' || shape === 'quadric') {
      const d = Math.max(50, 124 * rScale);
      new Zdog.Hemisphere({
        addTo: root,
        diameter: d,
        stroke: false,
        color: '#2563EB',
        backface: '#60A5FA',
      });
      new Zdog.Hemisphere({
        addTo: root,
        diameter: d,
        rotate: { x: Zdog.TAU / 2 },
        stroke: false,
        color: '#1D4ED8',
        backface: '#93C5FD',
      });
      new Zdog.Ellipse({
        addTo: root,
        diameter: d + 4,
        rotate: { x: Zdog.TAU / 4 },
        stroke: 3,
        color: '#F59E0B',
      });
    } else if (shape === 'cube' || shape === 'prism') {
      new Zdog.Box({
        addTo: root,
        width: Math.max(40, 104 * bScale),
        height: Math.max(40, 104 * hScale),
        depth: Math.max(40, 104 * bScale),
        stroke: false,
        color: '#3B82F6',
        leftFace: '#2563EB',
        rightFace: '#1D4ED8',
        topFace: '#60A5FA',
        bottomFace: '#1E3A8A',
      });
    } else if (shape === 'pyramid') {
      const b = Math.max(36, 62 * bScale);
      const h = Math.max(44, 120 * hScale);
      const baseY = 48;
      const apex = { x: 0, y: baseY - h, z: 0 };
      const corners = [
        { x: -b, y: baseY, z: -b },
        { x: b, y: baseY, z: -b },
        { x: b, y: baseY, z: b },
        { x: -b, y: baseY, z: b },
      ];
      const colors = ['#3B82F6', '#2563EB', '#1D4ED8', '#60A5FA'];
      corners.forEach((c1, idx) => {
        const c2 = corners[(idx + 1) % 4];
        new Zdog.Shape({
          addTo: root,
          path: [c1, c2, apex],
          closed: true,
          fill: true,
          stroke: 2,
          color: colors[idx],
        });
      });
    } else if (shape === 'vectors' && params.vectors && params.vectors.length > 0) {
      params.vectors.forEach((v, idx) => {
        const [vx, vy, vz] = v.components;
        const col = v.color || ['#2563EB', '#10B981', '#F59E0B'][idx % 3];
        new Zdog.Shape({
          addTo: root,
          path: [
            { x: 0, y: 0, z: 0 },
            { x: vx * 24, y: -vy * 24, z: vz * 24 },
          ],
          stroke: 5,
          color: col,
        });
      });
    } else {
      new Zdog.Cylinder({
        addTo: root,
        diameter: Math.max(42, 106 * rScale),
        length: Math.max(44, 122 * hScale),
        rotate: { x: Zdog.TAU / 4 },
        stroke: false,
        color: '#2563EB',
        frontFace: '#60A5FA',
        backface: '#1E40AF',
      });
    }

    // Smooth GSAP zoom tween on step or cameraZoom change
    gsap.to(zoomTweenRef.current, {
      zoom: Math.max(0.65, Math.min(1.85, cameraZoom)),
      duration: 0.55,
      ease: 'power2.out',
    });

    if (onAnchorsChange) {
      onAnchorsChange({
        overview: { x: width * 0.5, y: height * 0.5 },
        apex: { x: width * 0.5, y: height * 0.28 },
        base: { x: width * 0.5, y: height * 0.72 },
      });
    }

    let rafId = 0;
    const animate = () => {
      if (!isDraggingRef.current && (autoRotate || isPlaying)) {
        illo.rotate.y += 0.008;
      }
      illo.zoom = zoomTweenRef.current.zoom;
      illo.updateRenderGraph();
      rafId = window.requestAnimationFrame(animate);
    };
    animate();

    const ro = new ResizeObserver(() => {
      if (!container || !canvas) return;
      const nw = Math.max(320, container.clientWidth);
      const nh = Math.max(240, container.clientHeight);
      canvas.width = nw;
      canvas.height = nh;
      illo.setSize(nw, nh);
    });
    ro.observe(container);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [params, sliderValues, autoRotate, cameraZoom, stepIndex, isPlaying, onAnchorsChange]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden select-none cursor-grab active:cursor-grabbing"
    >
      <canvas ref={canvasRef} className="block w-full h-full touch-none" />
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/90 border border-black/[0.06] px-2.5 py-1 text-[11px] font-medium text-[#6E6E73] shadow-xs">
        Zdog 2.5D · Sichqoncha bilan aylantiring
      </div>
    </div>
  );
};

export default ZdogStage;
