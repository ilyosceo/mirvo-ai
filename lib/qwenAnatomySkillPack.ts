import type { MirvoLessonStep, MirvoPartMeta } from '../data/htmlModelsLibrary.js';
import { ANATOMY_ISO_CSS, ANATOMY_RUNTIME_JS } from './anatomyKitBundle.js';

export const SCENE_END_MARKER = '/* MIRVO_SCENE_END */';

/**
 * Compiles the genuine wheresryan22/anatomy skill (SKILL.md + craft.md + kit.md + motion.md)
 * + canvas-design discipline + pre-loaded window.ANATOMY ({ k, G, T }) runtime contract
 * for Qwen 4 Max.
 */
export function buildAnatomySkillSystemPrompt(stepCount = 5): string {
  const safeSteps = Math.max(4, Math.min(6, stepCount));
  return `You are an elite isometric CAD instrument builder powered by the official "anatomy" skill engine (window.ANATOMY = { k, G, T }).
Your job is to build a museum-grade, richly detailed, interactive isometric cutaway machine or physical instrument that explains the user's topic in Uzbek (Lotin alifbosi).

=========================================================================
1. CORE ANATOMY SKILL PHILOSOPHY (FROM SKILL.md & craft.md — MANDATORY)
=========================================================================
- THE OBJECT IS THE EXPLANATION: Never draw abstract floating slabs, flat diagrams, or boxes with arrows! Even if the topic is a physics law, thermodynamic state ("Holat parametrlari": P, V, T), algorithm, or chemical process, invent a REAL physical laboratory rig / cutaway machine whose working parts embody the concept (e.g., for P-V-T state parameters: a precision machined glass-and-steel gas cylinder with a weighted movable piston, a coiled copper heater jacket at the base, a Bourdon pressure dial gauge with a live needle, a mercury/digital thermometer column, and a calibrated volume ruler strip!).
- EVERY CREATION IS HIGHLY DETAILED (40–75 DISTINCT SOLID PARTS):
  Build it the way a real instrument is built:
  1) Base assembly: soft shadow halo (k.haloOf), 4 depth-sorted stepped cylindrical feet (flange + rubber foot), heavy chamfered bedplate (k.slabOf with bevel 1.4), inset perimeter groove (k.planOutline(k.insetPlan(...))), 4 corner screw rings + screw dots, an engraved ruler strip with minor/major ticks (k.topTicks), and a riveted nameplate with rule lines.
  2) Structural supports: columns, collars, mounting clamps with knurled thumb screws (k.knurl), guide rails, end stops, saddle pads.
  3) Core working cutaway mechanism: turned chambers/rotors/pistons/nozzles (G.solidOf / G.lathe / G.disc / G.ringBand / G.sphereOf), cooling fins or ribs (G.ribsOf with fade & seams), bolt circles on flanges (G.dotsOf), split coil springs/windings (k.coil -> draw back half BEFORE core, front half AFTER core!), filleted 3D pipes/manifolds with end flanges (G.fillet + T.tubePieces + T.tubeSvg).
  4) Instrumentation & live indicators: at least one precision analog dial gauge (k.cylinder + k.knurl + k.radialTicks + live moving needle) or calibrated scale + animated flow lines (k.lineSvg(..., { flow: true })) showing fluid/gas/heat/electric flow!
- STRICT ANTI-PATTERNS (FORBIDDEN):
  - NO abstract floating slabs or plain un-detailed boxes!
  - NO rectangular bricks pretending to be coils, pipes, or cylinders!
  - NO floating text balloons, leader arrows, or raw labels cluttering the air (at most 1-2 tiny engraved k.faceTextSvg labels lying flat on a part's face!).
  - NO lines stopping in mid-air: every pipe ends on a bolted flange/port, every wire ends on terminal dots (k.wireSvg).
  - STRICT PAINTER'S ORDER: Always draw back-to-front, bottom-to-top! Sort repeated items ascending by k.depthOf([x, y, z], P).

=========================================================================
2. PRE-LOADED ENGINE API: window.ANATOMY = { k, G, T } (EXACT SIGNATURES)
=========================================================================
DO NOT redefine or import k, G, or T — they are passed directly into your function!
World coordinates are [x, y, z] where x, y are on the horizontal floor and z points straight UP.
Viewport size: W = 680, H = 382.

A) Core Kit "k" (iso-kit):
- const P = k.fitProjection(extremePoints3D, 680, 382, { pad: 34, azimuth: 42, elevation: 30 });
  (Pass k.boxCorners(PLATE, -16, maxZ) plus any widest/tallest points so the whole machine fits centered!)
- k.iso([x, y, z], P) -> [sx, sy]
- k.depthOf([x, y, z], P) -> number (sort ascending: far to near!)
- k.slabOf({ x, y, w, d, r }, z, h, P, steps = 6, bevel = 0.8) -> SolidPaths (rounded box from z to z+h)
- k.cylinder(cx, cy, r, z, h, P, steps = 32, bevel = 0.5) -> SolidPaths (vertical cylinder from z to z+h)
- k.extrude(ring2D, z, h, P, { convex: true, bevel: 0.5 }) -> SolidPaths
- k.insetPlan(plan, by) -> shrunk/grown plan { x, y, w, d, r }
- k.corners(plan, inset) -> [[x,y], [x,y], [x,y], [x,y]]
- k.boxCorners(plan, z0, z1) -> 8 world corners
- k.haloOf(plan, z, h, P) -> SVG path "d" string for <path class="iso-halo" d="..."/>
- k.planOutline(plan, z, P, steps = 6) -> d string on horizontal plane z
- k.ring(cx, cy, r, z, P, steps = 24) -> circle d string on plane z
- k.sideArc(cx, cy, r, z, P, steps = 20) -> visible front arc d string on vertical cylinder
- k.sideSeam(plan, z, P, steps = 6) -> visible front seam wrapping box corners (pass as inner to solidSvg!)
- k.sideRing([x, y, z], r, "x" | "y", P) -> circle d string on vertical x or y face
- k.lineOnTop([x0, y0], [x1, y1], z, P) -> d string
- k.segment([x0, y0, z0], [x1, y1, z1], P) -> 3D line d string
- k.knurl(cx, cy, r, z0, z1, count, P, inset = 0.35) -> vertical knurl lines d string
- k.coil(from, to, [c1, c2], r, turns, "x" | "y" | "z", P) -> { back: dString, front: dString }
  (axis="x": x=from..to around [y=c1, z=c2]; axis="y": y=from..to around [x=c1, z=c2]; axis="z": vertical coil z=from..to around [x=c1, y=c2]!)
- k.topTicks(from, to, step, every, edge, z, [minorLen, majorLen], P, axis = "x") -> { minor: d, major: d }
- k.radialTicks(cx, cy, r, count, every, z, [minorLen, majorLen], P, from = 0, span = Math.PI * 2) -> { minor: d, major: d }
- k.dotGrid(x, y, cols, rows, gap, z, P) -> projected points array for k.dotsSvg
- k.translateAlong(P, [dx, dy, dz]) -> "translate(sx sy)" screen transform string for moving/exploding parts!
- k.topMatrix([x, y], z, P, "x" | "y") / k.sideMatrix([x, y], z, P, "left" | "right") -> transform for k.faceTextSvg
- Rendering to SVG strings:
  - k.solidSvg(paths, { tone: "hi" | "mid" | "lo", crease: "faint" | "lo" | "none", lit: false, inner: "" })
  - k.lineSvg(d, { tone: "hi" | "mid" | "lo" | "faint" | "lit" | "red" | "green" | "blue", dashed: false, dotted: false, flow: false, free: false })
  - k.dotsSvg(screenPoints, { size: 0.55, tone: "mid" | "hi" | "lo", pulse: false })
  - k.fadedSvg(fadedLineList, { tone: "lo" })
  - k.wireSvg(fromScreenPt, toScreenPt, { via: [], tone: "mid", flow: false, size: 1.2 })
  - k.faceTextSvg(matrixStr, "TEXT", { size: 3.2, tone: "mid", anchor: "middle" })

B) Lathe & 3D Vector Kit "G" (solids of revolution along ANY 3D axis!):
- const F = G.frameAlong([ox, oy, oz], [ax, ay, az]); // unit axis frame at origin o along axis a!
- G.solidOf(profile, F, P, opts) -> SolidPaths! profile is [[s0, r0], [s1, r1, 1], [s2, r2], ...] where 3rd item 1 marks smooth curved shading!
- G.lathe(meridian, F, P, opts) -> SolidPaths (for open/hollow sleeves, bells, rings)
- G.disc(s0, s1, r, F, P) -> SolidPaths (flanges, pucks, bosses, pistons along axis F)
- G.ringBand(s0, s1, rIn, rOut, F, P) -> SolidPaths (hollow collars, cylinder walls, open rims!)
- G.sphereOf([cx, cy, cz], r, P) -> SolidPaths (smooth 4-tone ball joint, valve ball, molecule, bulb)
- G.ribsOf(F, s0, s1, r, count, P, { fade: [0.08, 0.5], seams: true }) -> faded list for k.fadedSvg(...)
- G.dotsOf(F, s, r, count, P, { all: true, fade: [0.04, 0.42] }) -> screen points for k.dotsSvg(...) (bolt circles!)
- G.arcOf(F, s, r, P, { slope: 0 }) -> visible seam arc d string
- G.circleOf(F, s, r, P) -> full circle d string (bores, dark openings)
- G.spokesOf(F, s, r0, r1, count, P, { phase: 0, sweep: 0.35 }) -> radial turbine/impeller/fan blades d string!
- G.fillet(waypoints3D, bendRadius, 7, { P, tube: pipeRadius }) -> smooth rounded 3D route points!
- G.spiral(F, s, r0, r1, a0, a1, steps = 28) -> 3D spiral points

C) 3D Shaded Pipes & Cables Kit "T":
- T.tubePieces(routePoints3D, pipeRadius, P, { maxLength: 28, caps: true }) -> array of depth-sortable chunks (each has .mid)
- T.tubeSvg(piece, { tone: "hi" }) -> shaded <g class="tb"> ribbon with shine band, shade band & elliptical end caps!

D) Rich Engineering Color Materials (put data-mat="<material>" on <g>):
Available materials: "steel" | "copper" | "cobalt" | "bronze" | "water" | "emerald" | "amber" | "dark".
Keep the baseplate neutral (no data-mat or "steel"), and assign distinct realistic engineering materials ("cobalt", "copper", "bronze", "water", "amber", "emerald", "dark") to the working sub-assemblies so every mechanism pops with clarity!

=========================================================================
3. EXACT JAVASCRIPT OUTPUT CONTRACT (OUTPUT RAW JS ONLY!)
=========================================================================
Output ONLY valid JavaScript defining window.buildMirvoAnatomyScene and ending with ${SCENE_END_MARKER}.
Do NOT output HTML tags (<!DOCTYPE>, <html>, <style>, <script>) and do NOT wrap in markdown fences (\`\`\`).

Exact structure to follow:

window.buildMirvoAnatomyScene = function({ k, G, T }) {
  const W = 680, H = 382;
  const PLATE = { x: -135, y: -72, w: 270, d: 144, r: 8 };
  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -17, 118), [-140, -76, 0], [140, 76, 122]],
    W, H, { pad: 30, azimuth: 42, elevation: 30 }
  );
  const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

  // 1. Build neutral precision baseplate (feet, halo, groove, corner screws, ruler ticks, nameplate)
  const baseOut = [\`<path class="iso-halo" d="\${k.haloOf(PLATE, -17, 12, P)}"/>\`];
  for (const [fx, fy] of byDepth(k.corners(PLATE, 20))) {
    baseOut.push(k.solidSvg(k.cylinder(fx, fy, 7, -17, 2, P, 24), { tone: "lo" }));
    baseOut.push(k.solidSvg(k.cylinder(fx, fy, 5.2, -15, 3, P, 24), { tone: "mid" }));
  }
  baseOut.push(k.solidSvg(k.slabOf(PLATE, -12, 12, P, 8, 1.4), { tone: "mid", inner: k.lineSvg(k.sideSeam(PLATE, -6, P, 8), { tone: "faint" }) }));
  baseOut.push(k.lineSvg(k.planOutline(k.insetPlan(PLATE, 5), 0, P, 6), { tone: "faint" }));
  const screwPts = k.corners(PLATE, 10);
  baseOut.push(k.lineSvg(screwPts.map(([sx, sy]) => k.ring(sx, sy, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  baseOut.push(k.dotsSvg(screwPts.map(([sx, sy]) => k.iso([sx, sy, 0], P)), { size: 0.55, tone: "mid" }));
  const ruler = { x: -112, y: PLATE.y + PLATE.d - 14, w: 224, d: 6.5, r: 1 };
  baseOut.push(k.solidSvg(k.slabOf(ruler, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  const rTicks = k.topTicks(ruler.x + 4, ruler.x + ruler.w - 4, 4, 5, ruler.y + 0.8, 0.7, [1.8, 3.4], P);
  baseOut.push(k.lineSvg(rTicks.minor, { tone: "lo" }), k.lineSvg(rTicks.major, { tone: "mid" }));

  // 2. Build 4 to 5 modular colored assemblies in strict back-to-front painter's order!
  //    Wrap each assembly in <g class="mirvo-part" data-part="part_id" data-mat="cobalt|copper|bronze|water|steel|amber|emerald|dark">
  //    Include empty <g id="dyn_..."> or <path id="dyn_..."> slots inside the appropriate assembly for live 60 FPS animated parts!
  //    Reference patterns for real CAD solids (adapt dimensions & mechanisms to the requested topic):
  //      const Fz = G.frameAlong([0, 0, 0], [0, 0, 1]); // vertical lathe axis
  //      const vessel = k.solidSvg(G.solidOf([[0, 26], [10, 26, 1], [48, 22, 1], [62, 14]], Fz, P), { tone: "hi" });
  //      const fins = k.fadedSvg(G.ribsOf(Fz, 14, 44, 24.5, 7, P, { fade: [0.1, 0.5], seams: true }), { tone: "mid" });
  //      const bolts = k.dotsSvg(G.dotsOf(Fz, 62, 11.5, 8, P, { all: true }), { size: 0.55, tone: "hi" });
  //      const spring = k.coil(8, 52, [0, 0], 15, 6, "z", P); // draw spring.back BEFORE core shaft, spring.front AFTER!
  //      const pipePts = G.fillet([[22, 0, 36], [56, 0, 36], [56, 0, 14]], 8, 7, { P, tube: 3.2 });
  //      const pipeSvg = T.tubePieces(pipePts, 3.2, P).map((pc) => T.tubeSvg(pc)).join("");
  const staticSvg = [
    \`<g id="scene-base">\${baseOut.join("")}</g>\`,
    \`<g class="mirvo-part" data-part="part_1" data-mat="cobalt"> ... </g>\`,
    \`<g class="mirvo-part" data-part="part_2" data-mat="copper"> ... <g id="dyn_rotor"></g> ... </g>\`,
    \`<g class="mirvo-part" data-part="part_3" data-mat="water"> ... </g>\`,
    \`<g class="mirvo-part" data-part="part_4" data-mat="bronze"> ... <path id="dyn_needle" class="iso-line" data-tone="lit" style="stroke-width:1.4" d=""/> </g>\`
  ].join("\\n");

  // 3. Metadata for each interactive assembly (focusAt is [wx, wy, wz] in world coords; explode is [dx, dy, dz] world separation!)
  const parts = [
    { id: "part_1", nameUz: "O‘zbekcha 1-qism nomi", focusAt: [-55, 0, 42], zoom: 1.85, explode: [-28, -14, 18] },
    { id: "part_2", nameUz: "O‘zbekcha 2-qism nomi", focusAt: [0, 0, 48], zoom: 1.95, explode: [0, 0, 42] },
    { id: "part_3", nameUz: "O‘zbekcha 3-qism nomi", focusAt: [48, -10, 36], zoom: 1.90, explode: [26, -18, 14] },
    { id: "part_4", nameUz: "O‘zbekcha 4-qism nomi", focusAt: [72, 24, 64], zoom: 2.10, explode: [32, 22, 30] }
  ];

  // 4. Exactly ${safeSteps} concise Uzbek spoken lesson steps (keep explode: 0 so the assembled machine runs coherently; NO raw math symbols like =, *, /, ^ in textUz — write formulas in natural spoken Uzbek words so TTS reads smoothly!)
  const steps = [
    { titleUz: "Umumiy tuzilish", focusPart: "full", explode: 0, textUz: "..." },
    { titleUz: "...", focusPart: "part_1", explode: 0, textUz: "..." },
    { titleUz: "...", focusPart: "part_2", explode: 0, textUz: "..." },
    { titleUz: "...", focusPart: "part_3", explode: 0, textUz: "..." },
    { titleUz: "...", focusPart: "part_4", explode: 0, textUz: "..." }
  ];

  // 5. Smooth 60 FPS physical animation callback (query DOM elements INSIDE onTick via document.getElementById!)
  function onTick(tSec, activeStepIdx) {
    // Example: const rotorEl = document.getElementById("dyn_rotor");
    // if (rotorEl) rotorEl.innerHTML = k.lineSvg(G.spokesOf(Fz, 32, 4, 18, 6, P, { phase: tSec * 4.2, sweep: 0.35 }), { tone: "hi" });
    // Move pistons/valves via el.setAttribute("transform", k.translateAlong(P, [0, 0, Math.sin(tSec * 3) * 8]));
    // Animate dial gauge needles via k.segment([gx, gy, gz], [gx + Math.cos(ang)*r, gy, gz + Math.sin(ang)*r], P)!
  }

  return { P, W, H, staticSvg, parts, steps, onTick };
};
${SCENE_END_MARKER}`;
}

export function cleanAnatomySceneJs(raw: string): string {
  let code = (raw || '').trim();
  code = code.replace(/^```(?:javascript|js|html)?\s*/i, '');
  code = code.replace(/\s*```$/i, '');
  const endIdx = code.indexOf(SCENE_END_MARKER);
  if (endIdx >= 0) {
    code = code.slice(0, endIdx);
  }
  // Strip accidental <script> wrapper if model added one
  code = code.replace(/^\s*<script[^>]*>/i, '').replace(/<\/script>\s*$/i, '');
  const fnIdx = code.indexOf('window.buildMirvoAnatomyScene');
  if (fnIdx > 0) {
    code = code.slice(fnIdx);
  }
  return code.trim();
}

export interface ValidatedAnatomyScene {
  html: string;
  parts: MirvoPartMeta[];
  steps: MirvoLessonStep[];
}

/**
 * Executes Qwen's scene code in an isolated server-side sandbox against the real ANATOMY engine
 * to verify 0 runtime errors and extract exact parts + steps, then wraps it into a complete
 * standalone MirvoScene HTML5 document!
 */
export function validateAndAssembleAnatomyHtml(
  titleUz: string,
  rawSceneJs: string
): ValidatedAnatomyScene {
  const cleanJs = cleanAnatomySceneJs(rawSceneJs);
  if (!cleanJs.includes('buildMirvoAnatomyScene')) {
    throw new Error('Sahna funksiyasi (buildMirvoAnatomyScene) topilmadi.');
  }

  // 1. Validate & execute in server sandbox to catch any JS bug (both build & onTick!) and extract parts/steps!
  const sandboxWindow: Record<string, any> = {};
  const mockEl = {
    setAttribute: () => {},
    removeAttribute: () => {},
    getAttribute: () => '',
    style: {},
    innerHTML: '',
    textContent: '',
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const minimalDoc = {
    getElementById: () => ({ ...mockEl, style: {} }),
    querySelector: () => ({ ...mockEl, style: {} }),
    querySelectorAll: () => [],
  };
  const runner = new Function(
    'window',
    'document',
    `${ANATOMY_RUNTIME_JS}\n${cleanJs}\nconst __scene = window.buildMirvoAnatomyScene(window.ANATOMY);\nif (__scene && typeof __scene.onTick === "function") { __scene.onTick(0.25, 0); }\nreturn __scene;`
  );

  const sceneOut = runner(sandboxWindow, minimalDoc) as {
    W?: number;
    H?: number;
    staticSvg?: string;
    parts?: Array<{
      id: string;
      nameUz: string;
      focusAt?: [number, number, number];
      zoom?: number;
      explode?: [number, number, number];
    }>;
    steps?: Array<{
      titleUz?: string;
      focusPart?: string;
      explode?: number;
      textUz?: string;
    }>;
  };

  if (!sceneOut || typeof sceneOut.staticSvg !== 'string' || sceneOut.staticSvg.length < 100) {
    throw new Error('ANATOMY sahnasi bo‘sh SVG qaytardi.');
  }

  const parts: MirvoPartMeta[] = Array.isArray(sceneOut.parts)
    ? sceneOut.parts.map((p) => ({
        id: String(p.id || '').trim(),
        nameUz: String(p.nameUz || p.id || '').trim(),
      }))
    : [];

  const validPartIds = new Set(parts.map((p) => p.id));
  const steps: MirvoLessonStep[] = Array.isArray(sceneOut.steps)
    ? sceneOut.steps
        .filter((s) => s && typeof s.textUz === 'string' && s.textUz.trim().length > 0)
        .map((s, idx) => {
          const fp = String(s.focusPart || 'full').trim();
          return {
            titleUz: String(s.titleUz || `${idx + 1}-qadam`).trim(),
            textUz: String(s.textUz || '').trim(),
            focusPart: fp === 'full' || validPartIds.has(fp) ? fp : 'full',
            explode: Number(s.explode) > 0.3 ? 1 : 0,
          };
        })
    : [];

  const escapedTitle = titleUz
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const safeInlineRuntimeJs = ANATOMY_RUNTIME_JS.replace(/<\/(script)/gi, '<\\/$1');
  const safeInlineSceneJs = cleanJs.replace(/<\/(script)/gi, '<\\/$1');
  const safeInlineCss = ANATOMY_ISO_CSS.replace(/<\/(style)/gi, '<\\/$1');

  const html = `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${escapedTitle}</title>
  <style>
${safeInlineCss}
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: #ffffff;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
    }
    .mirvo-viewport {
      width: 100vw;
      height: 100vh;
      background: #ffffff;
      display: grid;
      place-items: center;
      overflow: hidden;
    }
    .mirvo-stage {
      width: min(96vw, calc(92vh * 16 / 9));
      aspect-ratio: 16 / 9;
      transform-origin: 50% 50%;
      transition: transform 0.88s cubic-bezier(0.22, 1, 0.36, 1);
      will-change: transform;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #anatomySvg {
      width: 100%;
      height: 100%;
      display: block;
      overflow: visible;
    }
  </style>
</head>
<body class="iso" data-theme="light">
  <div class="mirvo-viewport" id="viewport">
    <div class="mirvo-stage" id="stage">
      <svg id="anatomySvg" class="iso-svg" viewBox="0 0 680 382" role="img" aria-label="${escapedTitle}"></svg>
    </div>
  </div>

  <script>
${safeInlineRuntimeJs}
  </script>
  <script id="mirvo-scene-script">
${safeInlineSceneJs}
  </script>
  <script>
    (() => {
      const A = window.ANATOMY;
      const scene = window.buildMirvoAnatomyScene(A);
      const W = scene.W || 680;
      const H = scene.H || 382;
      const P = scene.P;
      const svgEl = document.getElementById("anatomySvg");
      const stageEl = document.getElementById("stage");
      const viewportEl = document.getElementById("viewport");

      svgEl.setAttribute("viewBox", \`0 0 \${W} \${H}\`);
      svgEl.innerHTML = scene.staticSvg || "";

      const PARTS_LIST = Array.isArray(scene.parts) ? scene.parts : [];
      const PART_MAP = {};
      PARTS_LIST.forEach((p) => { PART_MAP[p.id] = p; });

      const state = {
        playing: true,
        stepIdx: 0,
        activePart: null,
        expTarget: 0,
        expCur: 0,
        expVel: 0,
        lastTs: 0,
        clock: 0
      };

      function focus(target) {
        if (!target || target === "full") {
          stageEl.style.transform = "scale(1) translate(0%, 0%)";
          return;
        }
        const meta = typeof target === "string" ? PART_MAP[target] : target;
        if (!meta) {
          stageEl.style.transform = "scale(1) translate(0%, 0%)";
          return;
        }
        let sx = W / 2, sy = H / 2;
        if (Array.isArray(meta.focusAt) && meta.focusAt.length >= 3 && P) {
          const pt = A.k.iso(meta.focusAt, P);
          sx = pt[0];
          sy = pt[1];
        } else if (typeof meta.x === "number" && typeof meta.y === "number") {
          sx = meta.x;
          sy = meta.y;
        }
        const z = Math.max(1.0, Math.min(2.6, Number(meta.zoom) || 1.75));
        const dxPct = ((W / 2 - sx) / W) * 100;
        const dyPct = ((H / 2 - sy) / H) * 100;
        stageEl.style.transform = \`scale(\${z.toFixed(3)}) translate(\${dxPct.toFixed(2)}%, \${dyPct.toFixed(2)}%)\`;
      }

      function highlight(partId) {
        state.activePart = partId || null;
        const all = svgEl.querySelectorAll(".mirvo-part");
        all.forEach((el) => {
          if (!state.activePart) {
            el.classList.remove("is-dimmed", "is-focused");
          } else {
            const match = el.getAttribute("data-part") === state.activePart;
            el.classList.toggle("is-focused", match);
            el.classList.toggle("is-dimmed", !match);
          }
        });
      }

      function setExploded(amount) {
        state.expTarget = Math.max(0, Math.min(1, Number(amount) || 0));
      }

      function reset() {
        state.expTarget = 0;
        highlight(null);
        focus("full");
      }

      function updateExplode(dt) {
        const kSpring = 120;
        const cDamp = 2 * Math.sqrt(kSpring);
        const f = kSpring * (state.expTarget - state.expCur) - cDamp * state.expVel;
        state.expVel += f * dt;
        state.expCur += state.expVel * dt;
        if (Math.abs(state.expTarget - state.expCur) < 0.0005 && Math.abs(state.expVel) < 0.001) {
          state.expCur = state.expTarget;
          state.expVel = 0;
        }
        const e = state.expCur;
        PARTS_LIST.forEach((p) => {
          if (!Array.isArray(p.explode) || !P) return;
          const els = svgEl.querySelectorAll(\`.mirvo-part[data-part="\${p.id}"]\`);
          const tr = e < 0.001
            ? ""
            : A.k.translateAlong(P, [p.explode[0] * e, p.explode[1] * e, p.explode[2] * e]);
          els.forEach((el) => {
            if (tr) el.setAttribute("transform", tr);
            else el.removeAttribute("transform");
          });
        });
      }

      function tick(ts) {
        if (!state.lastTs) state.lastTs = ts;
        const dt = Math.min(1 / 30, Math.max(0.001, (ts - state.lastTs) / 1000));
        state.lastTs = ts;
        if (state.playing) state.clock += dt;
        updateExplode(dt);
        if (typeof scene.onTick === "function") {
          try {
            scene.onTick(state.clock, state.stepIdx);
          } catch (_) {}
        }
        requestAnimationFrame(tick);
      }

      window.MirvoScene = {
        parts: PART_MAP,
        focus,
        highlight,
        setExploded,
        setAutoTour: () => {},
        setPlaying: (flag) => { state.playing = Boolean(flag); },
        reset
      };

      window.addEventListener("message", (ev) => {
        const msg = ev && ev.data;
        if (!msg || typeof msg !== "object") return;
        switch (msg.type) {
          case "FOCUS":
            focus(msg.target ?? msg.partId);
            break;
          case "HIGHLIGHT":
            highlight(msg.partId ?? null);
            break;
          case "EXPLODE":
            setExploded(msg.amount ?? msg.value ?? 0);
            break;
          case "STEP":
            state.stepIdx = Number(msg.stepIdx) || 0;
            break;
          case "SET_PLAYING":
            state.playing = Boolean(msg.playing);
            break;
          case "RESET":
            reset();
            break;
        }
      });

      viewportEl.addEventListener("click", (ev) => {
        const g = ev.target.closest(".mirvo-part");
        if (!g) {
          reset();
          return;
        }
        const partId = g.getAttribute("data-part");
        const meta = PART_MAP[partId] || { nameUz: partId };
        highlight(partId);
        focus(partId);
        try {
          window.parent.postMessage({ type: "PART_CLICK", partId, nameUz: meta.nameUz }, "*");
        } catch (_) {}
      });

      viewportEl.addEventListener("dblclick", () => {
        setExploded(state.expTarget > 0.5 ? 0 : 1);
      });

      requestAnimationFrame(tick);
    })();
  </script>
</body>
</html>`;

  return { html, parts, steps };
}
