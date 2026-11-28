// Bundles .claude/skills/anatomy/kit/{iso-kit.mjs, lathe.mjs, tube.mjs, iso.css}
// into lib/anatomyKitBundle.ts so every Qwen-generated HTML lesson has the genuine
// wheresryan22/anatomy CAD engine (window.ANATOMY = { k, G, T }) pre-loaded!
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kitDir = resolve(root, '.claude/skills/anatomy/kit');

function extractExportedNames(code) {
  const names = new Set();
  for (const m of code.matchAll(/^export\s+(?:const|let|var|function)\s+([A-Za-z0-9_$]+)/gm)) {
    names.add(m[1]);
  }
  for (const m of code.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const part of m[1].split(',')) {
      const asMatch = part.trim().split(/\s+as\s+/);
      const exported = (asMatch[1] || asMatch[0]).trim();
      if (exported) names.add(exported);
    }
  }
  return [...names];
}

function stripImportsAndExports(code) {
  return code
    .replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, '')
    .replace(/^export\s+(const|let|var|function)\s+/gm, '$1 ')
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
}

const isoKitRaw = readFileSync(resolve(kitDir, 'iso-kit.mjs'), 'utf8')
  .replace(
    'const point = axis === "x" ? [along, center[0] + u, center[1] + v] : [center[0] + u, along, center[1] + v];',
    'const point = axis === "x" ? [along, center[0] + u, center[1] + v] : axis === "z" ? [center[0] + u, center[1] + v, along] : [center[0] + u, along, center[1] + v];'
  )
  .replace(
    'const normal = axis === "x" ? [0, Math.cos(angle), Math.sin(angle)] : [Math.cos(angle), 0, Math.sin(angle)];',
    'const normal = axis === "x" ? [0, Math.cos(angle), Math.sin(angle)] : axis === "z" ? [Math.cos(angle), Math.sin(angle), 0] : [Math.cos(angle), 0, Math.sin(angle)];'
  );
const latheRaw = readFileSync(resolve(kitDir, 'lathe.mjs'), 'utf8');
const tubeRaw = readFileSync(resolve(kitDir, 'tube.mjs'), 'utf8');
const isoCssRaw = readFileSync(resolve(kitDir, 'iso.css'), 'utf8');

const kExports = extractExportedNames(isoKitRaw);
const gExports = extractExportedNames(latheRaw);
const tExports = extractExportedNames(tubeRaw);

const runtimeJs = `(() => {
  const k = (() => {
${stripImportsAndExports(isoKitRaw)}
    return { ${kExports.join(', ')} };
  })();

  const G = (() => {
    const { cameraOf, iso, pathOf } = k;
${stripImportsAndExports(latheRaw)}
    return { ${gExports.join(', ')} };
  })();

  const T = (() => {
    const { iso, pathOf } = k;
${stripImportsAndExports(tubeRaw)}
    return { ${tExports.join(', ')} };
  })();

  window.ANATOMY = { k, G, T };
})();`;

// Verify bundle executes cleanly in an isolated VM-like Function before writing!
const sandboxWin = {};
new Function('window', runtimeJs)(sandboxWin);
const A = sandboxWin.ANATOMY;
const testP = A.k.fitProjection(
  [
    [-80, -50, -12],
    [80, 50, 60],
  ],
  640,
  400,
  { pad: 28, azimuth: 42 }
);
const testSlab = A.k.solidSvg(
  A.k.slabOf({ x: -60, y: -40, w: 120, d: 80, r: 6 }, -10, 10, testP, 6, 1.2),
  { tone: 'mid' }
);
const testLathe = A.k.solidSvg(
  A.G.solidOf(
    [
      [0, 14],
      [12, 14, 1],
      [24, 9, 1],
      [34, 9],
    ],
    A.G.frameAlong([0, 0, 0], [0, 0, 1]),
    testP
  ),
  { tone: 'hi' }
);
const testTube = A.T.tubePieces(
  A.G.fillet(
    [
      [-40, 0, 8],
      [-40, 0, 32],
      [20, 0, 32],
    ],
    8,
    7,
    { P: testP, tube: 2.5 }
  ),
  2.5,
  testP
)
  .map((p) => A.T.tubeSvg(p))
  .join('');

if (!testSlab.includes('<path') || !testLathe.includes('<path') || !testTube.includes('<g class="tb">')) {
  throw new Error('ANATOMY bundle self-test failed!');
}

const materialCss = `
/* Mirvo Rich Engineering Material Palettes for Anatomy Solids & Tubes (Light Theme) */
.iso[data-theme="light"] {
  --anatomy-page: #ffffff;
  --anatomy-card: #ffffff;
  --anatomy-paper: #ffffff;
  --anatomy-face: #ffffff;
  --anatomy-top: #f8fafc;
  --anatomy-shade-0: #cbd5e1;
  --anatomy-shade-1: #dbe2ea;
  --anatomy-shade-2: #e8edf3;
  --anatomy-shade-3: #f1f5f9;
  --anatomy-hi: #1e293b;
  --anatomy-mid: #475569;
  --anatomy-lo: #94a3b8;
  --anatomy-faint: #cbd5e1;
  --anatomy-lit: #0f172a;
  --anatomy-weight: 0.95px;
}
.iso [data-mat="steel"] {
  --anatomy-top: #f8fafc; --anatomy-shade-3: #e2e8f0; --anatomy-shade-2: #cbd5e1; --anatomy-shade-1: #94a3b8; --anatomy-shade-0: #64748b; --anatomy-hi: #1e293b;
}
.iso [data-mat="copper"] {
  --anatomy-top: #fed7aa; --anatomy-shade-3: #fdba74; --anatomy-shade-2: #fb923c; --anatomy-shade-1: #ea580c; --anatomy-shade-0: #9a3412; --anatomy-hi: #431407;
}
.iso [data-mat="cobalt"] {
  --anatomy-top: #bfdbfe; --anatomy-shade-3: #93c5fd; --anatomy-shade-2: #60a5fa; --anatomy-shade-1: #3b82f6; --anatomy-shade-0: #1d4ed8; --anatomy-hi: #1e3a8a;
}
.iso [data-mat="bronze"] {
  --anatomy-top: #fef08a; --anatomy-shade-3: #fde047; --anatomy-shade-2: #facc15; --anatomy-shade-1: #eab308; --anatomy-shade-0: #a16207; --anatomy-hi: #422006;
}
.iso [data-mat="water"] {
  --anatomy-top: #e0f2fe; --anatomy-shade-3: #bae6fd; --anatomy-shade-2: #7dd3fc; --anatomy-shade-1: #38bdf8; --anatomy-shade-0: #0284c7; --anatomy-hi: #0c4a6e;
}
.iso [data-mat="emerald"] {
  --anatomy-top: #bbf7d0; --anatomy-shade-3: #86efac; --anatomy-shade-2: #4ade80; --anatomy-shade-1: #16a34a; --anatomy-shade-0: #15803d; --anatomy-hi: #052e16;
}
.iso [data-mat="amber"] {
  --anatomy-top: #fef3c7; --anatomy-shade-3: #fde68a; --anatomy-shade-2: #fbbf24; --anatomy-shade-1: #f59e0b; --anatomy-shade-0: #b45309; --anatomy-hi: #451a03;
}
.iso [data-mat="dark"] {
  --anatomy-top: #64748b; --anatomy-shade-3: #475569; --anatomy-shade-2: #334155; --anatomy-shade-1: #1e293b; --anatomy-shade-0: #0f172a; --anatomy-hi: #020617; --anatomy-lo: #94a3b8; --anatomy-faint: #64748b;
}
.mirvo-part {
  cursor: pointer;
  transition: opacity 0.42s cubic-bezier(0.22, 1, 0.36, 1), filter 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}
.mirvo-part.is-dimmed {
  opacity: 0.24;
  filter: saturate(0.45);
}
.mirvo-part.is-focused {
  opacity: 1;
  filter: drop-shadow(0 6px 16px rgba(37, 99, 235, 0.22));
}
`;

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const tsOut = `// AUTO-GENERATED by scripts/build-anatomy-bundle.mjs from .claude/skills/anatomy/kit/
export const ANATOMY_ISO_CSS = \`${esc(isoCssRaw + '\n' + materialCss)}\`;

export const ANATOMY_RUNTIME_JS = \`${esc(runtimeJs)}\`;
`;

writeFileSync(resolve(root, 'lib/anatomyKitBundle.ts'), tsOut, 'utf8');
console.log(
  'Verified & wrote lib/anatomyKitBundle.ts:',
  tsOut.length,
  'chars | k exports:',
  kExports.length,
  '| G exports:',
  gExports.length,
  '| T exports:',
  tExports.length
);
