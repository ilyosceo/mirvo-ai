import React, { useEffect, useMemo, useRef, useState } from 'react';
import Matter from 'matter-js';
import type { RenderParams, StageAnchorsMap } from '../../types/tutor';

export type PhysicsPreset =
  | 'pendulum'
  | 'incline'
  | 'collision'
  | 'lever'
  | 'hydraulic'
  | 'spring';

interface MatterPhysicsStageProps {
  params: RenderParams;
  sliderValues: Record<string, number>;
  focusPart?: string;
  focusTarget?: string;
  dimInactiveParts?: boolean;
  isPlaying?: boolean;
  onAnchorsChange?: (anchors: StageAnchorsMap) => void;
}

interface PhysicsBodyMeta {
  partId: string;
  labelUz: string;
  fill: string;
  stroke: string;
  role: 'static' | 'dynamic' | 'fluid' | 'piston';
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function inferPhysicsPreset(params: RenderParams): PhysicsPreset {
  if (params.physics_preset) return params.physics_preset;
  const hay = `${params.object_name_en || ''} ${params.object_name_uz || ''}`.toLowerCase();
  if (/hydraul|gidravlik|piston|press|paskal|pascal/.test(hay)) return 'hydraulic';
  if (/pendulum|mayatnik|tebranish|oscillat/.test(hay)) return 'pendulum';
  if (/incline|ramp|qiya|ishqalanish|friction/.test(hay)) return 'incline';
  if (/collision|impulse|momentum|impuls|to['‘’`ʻ]?qnashuv|nyuton|newton/.test(hay)) return 'collision';
  if (/lever|richag|moment|torque|muvozanat/.test(hay)) return 'lever';
  if (/spring|prujina|garmon|elastic|hooke/.test(hay)) return 'spring';
  return 'pendulum';
}

function matchesFocus(partId: string, focusKey?: string): boolean {
  if (!focusKey) return true;
  const p = partId.toLowerCase();
  const f = focusKey.toLowerCase();
  return p === f || p.includes(f) || f.includes(p);
}

const PRESET_BADGES: Record<PhysicsPreset, string> = {
  pendulum: 'Matematik mayatnik (Matter.js)',
  incline: 'Qiya tekislik va kuchlar',
  collision: 'Elastik to‘qnashuv va impuls',
  lever: 'Richag muvozanati (M₁ = M₂)',
  hydraulic: 'Gidravlik press (Paskal qonuni)',
  spring: 'Prujinali garmonik tebranish',
};

export const MatterPhysicsStage: React.FC<MatterPhysicsStageProps> = ({
  params,
  sliderValues,
  focusPart,
  focusTarget,
  dimInactiveParts = false,
  isPlaying = true,
  onAnchorsChange,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onAnchorsChangeRef = useRef(onAnchorsChange);
  onAnchorsChangeRef.current = onAnchorsChange;

  const [simPaused, setSimPaused] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);
  const [readout, setReadout] = useState<string>('');
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: 680,
    height: 480,
  });

  const preset = useMemo(() => inferPhysicsPreset(params), [params]);

  const activeFocusKey = useMemo(() => {
    const cleanPart =
      focusPart && focusPart !== 'overview' && focusPart !== 'drawing_tip'
        ? focusPart.trim()
        : undefined;
    const cleanTarget =
      focusTarget && focusTarget !== 'overview' && focusTarget !== 'drawing_tip'
        ? focusTarget.trim()
        : undefined;
    return cleanPart || cleanTarget || undefined;
  }, [focusPart, focusTarget]);

  const activeFocusRef = useRef(activeFocusKey);
  activeFocusRef.current = activeFocusKey;
  const dimInactiveRef = useRef(dimInactiveParts);
  dimInactiveRef.current = dimInactiveParts;
  const simRunningRef = useRef(!simPaused);
  simRunningRef.current = !simPaused;

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 120 && h > 120) {
        setStageSize((prev) =>
          Math.abs(prev.width - w) < 2 && Math.abs(prev.height - h) < 2
            ? prev
            : { width: w, height: h }
        );
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Live Matter.js physics world lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = stageSize.width;
    const H = stageSize.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    const engine = Matter.Engine.create();
    const gravityG = sliderValues.gravity ?? sliderValues.g ?? 1.0;
    engine.gravity.y = clamp(gravityG / 9.8 || gravityG, 0.35, 2.0);
    if (preset === 'collision') {
      engine.gravity.y = 0.85;
    }

    const metaMap = new Map<number, PhysicsBodyMeta>();
    const namedBodies: Record<string, Matter.Body> = {};
    const constraintsToDraw: Array<{
      constraint: Matter.Constraint;
      partId: string;
      style: 'rod' | 'spring';
    }> = [];

    const registerBody = (body: Matter.Body, meta: PhysicsBodyMeta) => {
      metaMap.set(body.id, meta);
      namedBodies[meta.partId] = body;
      Matter.Composite.add(engine.world, body);
      return body;
    };

    const cx = W * 0.5;
    const floorY = H - 56;

    // Static ground bar for scenes that need a floor
    if (preset !== 'pendulum' && preset !== 'spring') {
      const ground = Matter.Bodies.rectangle(cx, floorY + 14, W * 0.9, 28, {
        isStatic: true,
        friction: 0.35,
        restitution: 0.4,
      });
      registerBody(ground, {
        partId: 'base_floor',
        labelUz: 'Asos tekislik',
        fill: '#E2E8F0',
        stroke: '#94A3B8',
        role: 'static',
      });
    }

    // Build preset physics mechanisms
    const hydraulicTargets = { leftStartY: 0, rightStartY: 0, ratio: 3.0 };

    if (preset === 'pendulum') {
      const pivotX = cx;
      const pivotY = Math.max(66, H * 0.16);
      const cordLen = clamp(
        ((sliderValues.length ?? sliderValues.l ?? 1.8) / 2.5) * (H * 0.48),
        H * 0.28,
        H * 0.54
      );
      const angleRad = ((sliderValues.angle ?? sliderValues.theta ?? 34) * Math.PI) / 180;
      const bobR = clamp(18 + ((sliderValues.mass ?? sliderValues.m ?? 2) - 1) * 3.5, 18, 34);

      const pivotBody = registerBody(
        Matter.Bodies.circle(pivotX, pivotY, 10, { isStatic: true, isSensor: true }),
        {
          partId: 'pivot',
          labelUz: 'Osilish nuqtasi',
          fill: '#1D1D1F',
          stroke: '#FFFFFF',
          role: 'static',
        }
      );

      const bobX = pivotX + Math.sin(angleRad) * cordLen;
      const bobY = pivotY + Math.cos(angleRad) * cordLen;
      const bob = registerBody(
        Matter.Bodies.circle(bobX, bobY, bobR, {
          frictionAir: 0.002,
          restitution: 0.8,
          density: 0.004,
        }),
        {
          partId: 'pendulum_bob',
          labelUz: 'Yuk (m)',
          fill: '#0071E3',
          stroke: '#1E40AF',
          role: 'dynamic',
        }
      );

      const rod = Matter.Constraint.create({
        pointA: { x: pivotX, y: pivotY },
        bodyB: bob,
        length: cordLen,
        stiffness: 1,
      });
      Matter.Composite.add(engine.world, rod);
      constraintsToDraw.push({ constraint: rod, partId: 'pendulum_rod', style: 'rod' });
      namedBodies.pendulum_rod = bob;
      void pivotBody;
    } else if (preset === 'incline') {
      const angleDeg = clamp(sliderValues.angle ?? sliderValues.alpha ?? 26, 12, 46);
      const angleRad = (angleDeg * Math.PI) / 180;
      const rampLen = Math.min(W * 0.68, 420);
      const rampCx = cx;
      const rampCy = floorY - Math.sin(angleRad) * rampLen * 0.42 - 14;

      const ramp = registerBody(
        Matter.Bodies.rectangle(rampCx, rampCy, rampLen, 18, {
          isStatic: true,
          angle: angleRad,
          friction: clamp(sliderValues.mu ?? sliderValues.friction ?? 0.08, 0.01, 0.6),
        }),
        {
          partId: 'ramp',
          labelUz: `Qiya tekislik (${angleDeg}°)`,
          fill: '#CBD5E1',
          stroke: '#475569',
          role: 'static',
        }
      );

      const startOffset = -rampLen * 0.34;
      const bx = rampCx + Math.cos(angleRad) * startOffset + Math.sin(angleRad) * 32;
      const by = rampCy + Math.sin(angleRad) * startOffset - Math.cos(angleRad) * 32;
      registerBody(
        Matter.Bodies.rectangle(bx, by, 48, 36, {
          angle: angleRad,
          friction: clamp(sliderValues.mu ?? 0.06, 0.01, 0.5),
          frictionAir: 0.005,
          restitution: 0.15,
        }),
        {
          partId: 'block',
          labelUz: 'Jism (m)',
          fill: '#F59E0B',
          stroke: '#B45309',
          role: 'dynamic',
        }
      );
      void ramp;
    } else if (preset === 'collision') {
      const m1 = clamp(sliderValues.m1 ?? sliderValues.mass ?? 3, 1, 8);
      const m2 = clamp(sliderValues.m2 ?? 5, 1, 10);
      const r1 = clamp(18 + m1 * 2.5, 18, 34);
      const r2 = clamp(18 + m2 * 2.5, 18, 38);

      // Side walls to keep elastic collisions in view
      Matter.Composite.add(engine.world, [
        Matter.Bodies.rectangle(20, H * 0.5, 24, H, { isStatic: true, restitution: 1 }),
        Matter.Bodies.rectangle(W - 20, H * 0.5, 24, H, { isStatic: true, restitution: 1 }),
      ]);

      const ballA = registerBody(
        Matter.Bodies.circle(cx - W * 0.24, floorY - r1 - 2, r1, {
          restitution: 0.98,
          friction: 0,
          frictionAir: 0.001,
          mass: m1,
        }),
        {
          partId: 'mass_a',
          labelUz: `Sharcha m₁ (${m1} kg)`,
          fill: '#0071E3',
          stroke: '#1D4ED8',
          role: 'dynamic',
        }
      );
      const ballB = registerBody(
        Matter.Bodies.circle(cx + W * 0.12, floorY - r2 - 2, r2, {
          restitution: 0.98,
          friction: 0,
          frictionAir: 0.001,
          mass: m2,
        }),
        {
          partId: 'mass_b',
          labelUz: `Sharcha m₂ (${m2} kg)`,
          fill: '#10B981',
          stroke: '#047857',
          role: 'dynamic',
        }
      );
      Matter.Body.setVelocity(ballA, {
        x: clamp(sliderValues.velocity ?? sliderValues.v ?? 6.5, 2, 12),
        y: 0,
      });
      void ballB;
    } else if (preset === 'lever') {
      const fulcrumX = cx;
      const fulcrumY = floorY - 46;
      const beamW = Math.min(W * 0.72, 420);

      registerBody(
        Matter.Bodies.polygon(fulcrumX, fulcrumY + 24, 3, 28, {
          isStatic: true,
          angle: Math.PI / 6,
        }),
        {
          partId: 'fulcrum',
          labelUz: 'Tayanch nuqta',
          fill: '#475569',
          stroke: '#1E293B',
          role: 'static',
        }
      );

      const beam = registerBody(
        Matter.Bodies.rectangle(fulcrumX, fulcrumY - 6, beamW, 14, {
          frictionAir: 0.02,
          density: 0.002,
        }),
        {
          partId: 'lever_beam',
          labelUz: 'Richag yelkasi',
          fill: '#F59E0B',
          stroke: '#B45309',
          role: 'dynamic',
        }
      );

      const pivotConstraint = Matter.Constraint.create({
        pointA: { x: fulcrumX, y: fulcrumY - 6 },
        bodyB: beam,
        length: 0,
        stiffness: 1,
      });
      Matter.Composite.add(engine.world, pivotConstraint);

      const loadL = registerBody(
        Matter.Bodies.rectangle(fulcrumX - beamW * 0.36, fulcrumY - 44, 40, 34, {
          density: 0.003 * clamp((sliderValues.m1 ?? 2) / 2, 0.5, 3),
          friction: 0.8,
        }),
        {
          partId: 'mass_a',
          labelUz: 'Yuk F₁',
          fill: '#0071E3',
          stroke: '#1D4ED8',
          role: 'dynamic',
        }
      );
      const loadR = registerBody(
        Matter.Bodies.rectangle(fulcrumX + beamW * 0.28, fulcrumY - 44, 48, 38, {
          density: 0.003 * clamp((sliderValues.m2 ?? 2.4) / 2, 0.5, 3),
          friction: 0.8,
        }),
        {
          partId: 'mass_b',
          labelUz: 'Yuk F₂',
          fill: '#10B981',
          stroke: '#047857',
          role: 'dynamic',
        }
      );
      void loadL;
      void loadR;
    } else if (preset === 'hydraulic') {
      // Coupled Pascal hydraulic cylinders (two connected pistons + fluid chamber)
      const leftX = cx - Math.min(130, W * 0.22);
      const rightX = cx + Math.min(115, W * 0.19);
      const cylBottom = floorY - 12;
      const smallW = 54;
      const ratio = clamp(sliderValues.ratio ?? sliderValues.S2 ?? 2.8, 1.8, 4.0);
      const largeW = clamp(smallW * Math.sqrt(ratio), 86, 130);
      hydraulicTargets.ratio = ratio;

      // Static chamber bottom + vertical walls
      registerBody(
        Matter.Bodies.rectangle(cx, cylBottom - 22, rightX - leftX + largeW + 24, 44, {
          isStatic: true,
        }),
        {
          partId: 'fluid_chamber',
          labelUz: 'Gidravlik suyuqlik (Paskal)',
          fill: '#38BDF8',
          stroke: '#0284C7',
          role: 'fluid',
        }
      );

      // Left small cylinder shell
      registerBody(
        Matter.Bodies.rectangle(leftX, cylBottom - 104, smallW + 14, 150, {
          isStatic: true,
          isSensor: true,
        }),
        {
          partId: 'cylinder_small',
          labelUz: 'Kichik silindr (S₁)',
          fill: 'rgba(186, 230, 253, 0.35)',
          stroke: '#0284C7',
          role: 'static',
        }
      );

      // Right large cylinder shell
      registerBody(
        Matter.Bodies.rectangle(rightX, cylBottom - 104, largeW + 14, 150, {
          isStatic: true,
          isSensor: true,
        }),
        {
          partId: 'cylinder_large',
          labelUz: 'Katta silindr (S₂)',
          fill: 'rgba(186, 230, 253, 0.35)',
          stroke: '#0284C7',
          role: 'static',
        }
      );

      const leftStartY = cylBottom - 135;
      const rightStartY = cylBottom - 100;
      hydraulicTargets.leftStartY = leftStartY;
      hydraulicTargets.rightStartY = rightStartY;

      registerBody(
        Matter.Bodies.rectangle(leftX, leftStartY, smallW, 24, {
          isStatic: true,
        }),
        {
          partId: 'piston_1',
          labelUz: 'Kichik porshen (F₁, S₁)',
          fill: '#F59E0B',
          stroke: '#B45309',
          role: 'piston',
        }
      );
      registerBody(
        Matter.Bodies.rectangle(rightX, rightStartY, largeW, 28, {
          isStatic: true,
        }),
        {
          partId: 'piston_2',
          labelUz: 'Katta porshen (F₂, S₂)',
          fill: '#0071E3',
          stroke: '#1E40AF',
          role: 'piston',
        }
      );
    } else {
      // Harmonic spring-mass oscillator
      const anchorX = cx;
      const anchorY = Math.max(66, H * 0.15);
      const restLen = H * 0.38;
      const kVal = clamp(sliderValues.k ?? 0.04, 0.015, 0.12);

      registerBody(
        Matter.Bodies.rectangle(anchorX, anchorY, 84, 14, { isStatic: true }),
        {
          partId: 'pivot',
          labelUz: 'Mahkamlash nuqtasi',
          fill: '#334155',
          stroke: '#0F172A',
          role: 'static',
        }
      );
      const massBox = registerBody(
        Matter.Bodies.rectangle(anchorX, anchorY + restLen + 45, 62, 52, {
          frictionAir: 0.003,
          density: 0.004,
        }),
        {
          partId: 'mass_a',
          labelUz: 'Yuk (m)',
          fill: '#10B981',
          stroke: '#047857',
          role: 'dynamic',
        }
      );
      const spring = Matter.Constraint.create({
        pointA: { x: anchorX, y: anchorY + 7 },
        bodyB: massBox,
        length: restLen,
        stiffness: kVal,
        damping: 0.004,
      });
      Matter.Composite.add(engine.world, spring);
      constraintsToDraw.push({ constraint: spring, partId: 'spring', style: 'spring' });
      namedBodies.spring = massBox;
    }

    // Enable interactive pointer grab/drag with Matter.MouseConstraint
    const mouse = Matter.Mouse.create(canvas);
    mouse.pixelRatio = dpr;
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.25, render: { visible: false } },
    });
    Matter.Composite.add(engine.world, mouseConstraint);

    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let lastAnchorEmit = 0;

    const drawArrow = (x1: number, y1: number, x2: number, y2: number, color: string, label: string) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 10) return;
      const angle = Math.atan2(dy, dx);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 9 * Math.cos(angle - Math.PI / 6), y2 - 9 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - 9 * Math.cos(angle + Math.PI / 6), y2 - 9 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      ctx.font = '600 11px Inter, -apple-system, sans-serif';
      ctx.fillText(label, x2 + 6, y2 + 4);
      ctx.restore();
    };

    const renderFrame = (now: number) => {
      const dt = clamp(now - lastTime, 4, 24);
      lastTime = now;

      if (simRunningRef.current) {
        elapsed += dt / 1000;
        if (preset === 'hydraulic') {
          const p1 = namedBodies.piston_1;
          const p2 = namedBodies.piston_2;
          if (p1 && p2) {
            const stroke = Math.sin(elapsed * 1.9) * 26 + 26;
            const p1Y = hydraulicTargets.leftStartY + stroke;
            const p2Y = hydraulicTargets.rightStartY - stroke / hydraulicTargets.ratio;
            Matter.Body.setPosition(p1, { x: p1.position.x, y: p1Y });
            Matter.Body.setPosition(p2, { x: p2.position.x, y: p2Y });
            const f1 = Math.round(sliderValues.force ?? 120);
            const f2 = Math.round(f1 * hydraulicTargets.ratio);
            setReadout(`F₁ = ${f1} N  →  F₂ = ${f2} N (${hydraulicTargets.ratio.toFixed(1)}×)`);
          }
        } else {
          Matter.Engine.update(engine, dt);
          if (preset === 'pendulum' && namedBodies.pendulum_bob) {
            const v = namedBodies.pendulum_bob.speed;
            setReadout(`Tezlik v ≈ ${(v * 0.45).toFixed(2)} m/s`);
          } else if (preset === 'collision' && namedBodies.mass_a && namedBodies.mass_b) {
            const v1 = namedBodies.mass_a.velocity.x;
            const v2 = namedBodies.mass_b.velocity.x;
            setReadout(`v₁ = ${v1.toFixed(1)} | v₂ = ${v2.toFixed(1)} m/s`);
          } else if (preset === 'incline' && namedBodies.block) {
            setReadout(`Tezlik v = ${namedBodies.block.speed.toFixed(1)} m/s`);
          } else if (preset === 'spring' && namedBodies.mass_a) {
            setReadout(`Tezlik v = ${Math.abs(namedBodies.mass_a.velocity.y).toFixed(1)} m/s`);
          } else if (preset === 'lever' && namedBodies.lever_beam) {
            const deg = ((namedBodies.lever_beam.angle * 180) / Math.PI).toFixed(1);
            setReadout(`Og‘ish burchagi: ${deg}°`);
          }
        }
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      // Subtle architectural dot grid background
      ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
      for (let gx = 24; gx < W; gx += 28) {
        for (let gy = 24; gy < H - 30; gy += 28) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const focusKey = activeFocusRef.current;
      const shouldDim = Boolean(dimInactiveRef.current && focusKey);

      // Draw constraints (rods & zig-zag springs)
      for (const cItem of constraintsToDraw) {
        const pA = Matter.Constraint.pointAWorld(cItem.constraint);
        const pB = Matter.Constraint.pointBWorld(cItem.constraint);
        const isMatched = !shouldDim || matchesFocus(cItem.partId, focusKey);
        ctx.save();
        ctx.globalAlpha = isMatched ? 1 : 0.24;
        ctx.strokeStyle = isMatched && focusKey ? '#F59E0B' : '#334155';
        ctx.lineWidth = cItem.style === 'spring' ? 2.4 : 2.8;
        ctx.beginPath();
        if (cItem.style === 'spring') {
          const coils = 11;
          const dx = pB.x - pA.x;
          const dy = pB.y - pA.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          ctx.moveTo(pA.x, pA.y);
          for (let i = 1; i < coils; i++) {
            const t = i / coils;
            const side = i % 2 === 0 ? 11 : -11;
            ctx.lineTo(pA.x + dx * t + nx * side, pA.y + dy * t + ny * side);
          }
          ctx.lineTo(pB.x, pB.y);
        } else {
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Draw all registered physics bodies
      const bodies = Matter.Composite.allBodies(engine.world);
      for (const body of bodies) {
        const meta = metaMap.get(body.id);
        if (!meta) continue;
        const isFocused = Boolean(focusKey && matchesFocus(meta.partId, focusKey));
        const alpha = shouldDim && !isFocused ? 0.25 : 1;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        const verts = body.vertices;
        ctx.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < verts.length; i++) {
          ctx.lineTo(verts[i].x, verts[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = meta.fill;
        ctx.fill();
        ctx.lineWidth = isFocused ? 3 : 1.8;
        ctx.strokeStyle = isFocused ? '#F59E0B' : meta.stroke;
        ctx.stroke();

        // Highlight halo ring around actively explained part
        if (isFocused) {
          ctx.beginPath();
          ctx.arc(
            body.position.x,
            body.position.y,
            Math.max(26, (body.bounds.max.x - body.bounds.min.x) * 0.65),
            0,
            Math.PI * 2
          );
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }

      // Draw educational force vectors cleanly
      if (preset === 'pendulum' && namedBodies.pendulum_bob) {
        const b = namedBodies.pendulum_bob;
        drawArrow(b.position.x, b.position.y, b.position.x, b.position.y + 48, '#EF4444', 'mg');
      } else if (preset === 'incline' && namedBodies.block) {
        const b = namedBodies.block;
        drawArrow(b.position.x, b.position.y, b.position.x, b.position.y + 46, '#EF4444', 'mg');
        drawArrow(
          b.position.x,
          b.position.y,
          b.position.x + Math.sin(b.angle) * 42,
          b.position.y - Math.cos(b.angle) * 42,
          '#0071E3',
          'N'
        );
      } else if (preset === 'hydraulic' && namedBodies.piston_1 && namedBodies.piston_2) {
        const p1 = namedBodies.piston_1;
        const p2 = namedBodies.piston_2;
        drawArrow(p1.position.x, p1.position.y - 46, p1.position.x, p1.position.y - 14, '#EF4444', 'F₁');
        drawArrow(p2.position.x, p2.position.y - 14, p2.position.x, p2.position.y - 54, '#10B981', 'F₂');
      }

      ctx.restore();

      // Emit pixel anchors for emoji mentor tracking (~20 Hz)
      if (now - lastAnchorEmit > 50 && onAnchorsChangeRef.current) {
        lastAnchorEmit = now;
        const map: StageAnchorsMap = {
          overview: { x: W * 0.5, y: H * 0.46, width: W * 0.65, height: H * 0.6 },
        };
        let tipPt = { x: W * 0.5, y: H * 0.46 };

        for (const [partId, body] of Object.entries(namedBodies)) {
          const bw = Math.max(28, body.bounds.max.x - body.bounds.min.x);
          const bh = Math.max(28, body.bounds.max.y - body.bounds.min.y);
          map[partId] = {
            x: body.position.x,
            y: body.position.y,
            width: bw,
            height: bh,
            label: metaMap.get(body.id)?.labelUz,
          };
          if (focusKey && matchesFocus(partId, focusKey)) {
            tipPt = { x: body.position.x, y: body.position.y };
          }
        }
        if (!focusKey) {
          const primary =
            namedBodies.pendulum_bob ||
            namedBodies.block ||
            namedBodies.piston_1 ||
            namedBodies.mass_a ||
            namedBodies.lever_beam;
          if (primary) {
            tipPt = { x: primary.position.x, y: primary.position.y };
          }
        }
        map.drawing_tip = { x: tipPt.x, y: tipPt.y, width: 28, height: 28 };
        onAnchorsChangeRef.current(map);
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
    };
  }, [preset, stageSize, sliderValues, resetCounter, isPlaying]);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full bg-transparent overflow-hidden select-none"
      aria-label="Interaktiv Matter.js 2D fizika simulyatsiyasi"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none cursor-grab active:cursor-grabbing"
      />

      <div className="pointer-events-none absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/85 backdrop-blur-md border border-black/[0.06] px-3 py-1 text-[11px] font-semibold text-[#1D1D1F] shadow-xs">
          <span className="h-2 w-2 rounded-full bg-[#0071E3]" />
          <span>{PRESET_BADGES[preset]}</span>
          {readout && (
            <>
              <span className="text-black/20">·</span>
              <span className="font-mono text-[#0071E3]">{readout}</span>
            </>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/85 backdrop-blur-md border border-black/[0.06] p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setSimPaused((p) => !p)}
            className="px-2.5 py-0.5 rounded-full text-[11px] font-medium text-[#1D1D1F] hover:bg-black/[0.05] cursor-pointer"
          >
            {simPaused ? 'Davom etish' : 'Pauza'}
          </button>
          <button
            type="button"
            onClick={() => setResetCounter((c) => c + 1)}
            className="px-2.5 py-0.5 rounded-full text-[11px] font-medium text-[#0071E3] hover:bg-[#0071E3]/10 cursor-pointer"
          >
            Qayta
          </button>
        </div>
      </div>
    </div>
  );
};
