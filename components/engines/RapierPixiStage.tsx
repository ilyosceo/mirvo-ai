import React, { useEffect, useRef, useState } from 'react';
import { Application, Graphics } from 'pixi.js';
import type { RenderParams, StageAnchorsMap } from '../../types/tutor';

export interface RapierPixiStageProps {
  params: RenderParams;
  sliderValues: Record<string, number>;
  isPlaying?: boolean;
  stepIndex?: number;
  onAnchorsChange?: (anchors: StageAnchorsMap) => void;
}

export const RapierPixiStage: React.FC<RapierPixiStageProps> = ({
  params,
  sliderValues,
  isPlaying = true,
  stepIndex = 0,
  onAnchorsChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let app: Application | null = null;
    let rafId = 0;

    (async () => {
      try {
        const RAPIER = await import('@dimforge/rapier2d-compat');
        await RAPIER.init();
        if (cancelled || !container) return;

        const width = Math.max(320, container.clientWidth || 640);
        const height = Math.max(240, container.clientHeight || 400);

        app = new Application();
        await app.init({
          width,
          height,
          backgroundAlpha: 0,
          antialias: true,
        });
        if (cancelled) {
          app.destroy(true);
          return;
        }

        container.innerHTML = '';
        container.appendChild(app.canvas);
        setReady(true);

        onAnchorsChange?.({
          overview: { x: width * 0.5, y: height * 0.5 },
        });

        const gravityVal = sliderValues.g ?? sliderValues.gravity ?? 9.81;
        const world = new RAPIER.World({ x: 0.0, y: gravityVal * 32 });

        // Floor & walls
        const floorDesc = RAPIER.ColliderDesc.cuboid(width * 0.44, 10)
          .setTranslation(width * 0.5, height - 34)
          .setRestitution(0.72);
        world.createCollider(floorDesc);

        const inclineAngle = ((sliderValues.angle ?? params.angle_deg ?? 14) * Math.PI) / 180;
        const rampDesc = RAPIER.ColliderDesc.cuboid(120, 7)
          .setTranslation(width * 0.34, height * 0.56)
          .setRotation(inclineAngle)
          .setRestitution(0.6);
        world.createCollider(rampDesc);

        const staticGfx = new Graphics();
        staticGfx.roundRect(width * 0.06, height - 44, width * 0.88, 20, 8).fill(0xcbd5e1);
        app.stage.addChild(staticGfx);

        const rampGfx = new Graphics();
        rampGfx.roundRect(-120, -7, 240, 14, 6).fill(0x64748b);
        rampGfx.position.set(width * 0.34, height * 0.56);
        rampGfx.rotation = inclineAngle;
        app.stage.addChild(rampGfx);

        const colors = [0x2563eb, 0x10b981, 0xf59e0b, 0xef4444, 0x6366f1];
        const bodies: Array<{ body: InstanceType<typeof RAPIER.RigidBody>; gfx: Graphics; r: number }> = [];

        for (let i = 0; i < 12; i++) {
          const r = 12 + (i % 3) * 4;
          const rbDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(width * 0.24 + i * 22, 50 + (i % 4) * 24);
          const body = world.createRigidBody(rbDesc);
          const colDesc = RAPIER.ColliderDesc.ball(r)
            .setRestitution(0.78)
            .setFriction(0.25);
          world.createCollider(colDesc, body);

          const gfx = new Graphics();
          gfx.circle(0, 0, r).fill(colors[i % colors.length]);
          app.stage.addChild(gfx);
          bodies.push({ body, gfx, r });
        }

        const stepLoop = () => {
          if (cancelled) return;
          world.step();
          for (const item of bodies) {
            const pos = item.body.translation();
            if (pos.y > height + 60) {
              item.body.setTranslation({ x: width * 0.28 + Math.random() * 120, y: 40 }, true);
              item.body.setLinvel({ x: 0, y: 0 }, true);
            }
            const nextPos = item.body.translation();
            item.gfx.position.set(nextPos.x, nextPos.y);
          }
          rafId = window.requestAnimationFrame(stepLoop);
        };
        stepLoop();
      } catch {
        // fallback cleanly on unmount
      }
    })();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      if (app) {
        try {
          app.destroy(true);
        } catch {
          // ignore cleanup error
        }
      }
    };
  }, [params.angle_deg, sliderValues, isPlaying, stepIndex, onAnchorsChange]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-[#6E6E73]">
          Rapier2D + PixiJS v8 simulyatsiyasi yuklanmoqda...
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/90 border border-black/[0.06] px-2.5 py-1 text-[11px] font-medium text-[#6E6E73] shadow-xs">
        Rapier2D (Rust WASM) + PixiJS v8
      </div>
    </div>
  );
};

export default RapierPixiStage;
