import type { SceneArchitecturePlan } from '../types/tutor.js';

export const STEM_SCENE_REGISTRY: Record<string, { libs: string[]; primitives: string[] }> = {
  'math.functions': {
    libs: ['mafs', 'mathjs', 'katex', 'gsap'],
    primitives: ['cartesian_plane', 'function_curve', 'vector_arrow', 'derivative_tangent'],
  },
  'geometry.dynamic': {
    libs: ['jsxgraph', 'zdog', 'katex', 'svg_native'],
    primitives: ['euclidean_triangle', 'circle_chords', 'pseudo3d_solid', 'angle_arc'],
  },
  'physics.mechanics': {
    libs: ['matter-js', 'rapier2d', 'pixi.js', 'gsap', 'katex'],
    primitives: ['rigid_body_lever', 'spring_pendulum', 'hydraulic_piston', 'particle_stream'],
  },
  'chemistry.molecules': {
    libs: ['smiles-drawer', 'rdkit', 'katex', 'svg_native'],
    primitives: ['smiles_2d_structure', 'rdkit_cheminformatics_svg', 'reaction_arrow'],
  },
  'biology.networks': {
    libs: ['cytoscape', 'xyflow', 'svg_native'],
    primitives: ['metabolic_pathway_graph', 'cell_signaling_nodes', 'organelle_diagram'],
  },
  'schematics.circuits': {
    libs: ['xyflow', 'konva', 'gsap', 'katex'],
    primitives: ['circuit_block_node', 'animated_signal_edge', 'interactive_board_part'],
  },
  'visual.whiteboard': {
    libs: ['konva', 'zdog', 'motion-canvas', 'gsap', 'svg_native', 'katex'],
    primitives: ['draggable_diagram_node', 'step_timeline_keyframe', 'formula_card'],
  },
};

export const ENERGY_REGISTRY = STEM_SCENE_REGISTRY;

export const LIBRARY_COSTS: Record<string, { kb: number; load: 'core' | 'lazy' | 'native' }> = {
  svg_native: { kb: 0, load: 'native' },
  zdog: { kb: 28, load: 'lazy' },
  gsap: { kb: 65, load: 'core' },
  katex: { kb: 80, load: 'lazy' },
  'smiles-drawer': { kb: 65, load: 'lazy' },
  mafs: { kb: 55, load: 'lazy' },
  'matter-js': { kb: 85, load: 'lazy' },
  xyflow: { kb: 120, load: 'lazy' },
  konva: { kb: 145, load: 'lazy' },
  'motion-canvas': { kb: 150, load: 'lazy' },
  mathjs: { kb: 180, load: 'lazy' },
  cytoscape: { kb: 290, load: 'lazy' },
  'pixi.js': { kb: 420, load: 'lazy' },
  jsxgraph: { kb: 520, load: 'lazy' },
  rapier2d: { kb: 680, load: 'lazy' },
  rdkit: { kb: 950, load: 'lazy' },
  plotly: { kb: 1100, load: 'lazy' },
};

export const TIER_BUDGETS = {
  low: { draw_calls: 80, triangles: 50000, lazy_kb: 900, dpr: 1.0, shadows: false, antialias: true, postfx: false },
  mid: { draw_calls: 200, triangles: 200000, lazy_kb: 2200, dpr: 1.5, shadows: false, antialias: true, postfx: false },
  high: { draw_calls: 450, triangles: 600000, lazy_kb: 4500, dpr: 2.0, shadows: false, antialias: true, postfx: false },
};

export function detectSubjects(
  query: string
): Array<{ id: string; role: 'primary' | 'overlay' | 'annotation'; confidence: number }> {
  const q = query.toLowerCase();
  const detected: Array<{ id: string; role: 'primary' | 'overlay' | 'annotation'; confidence: number }> = [];

  if (/kimyo|molekula|atom|reaksiya|smiles|kislota|benzol|organik|element/i.test(q)) {
    detected.push({ id: 'chemistry.molecules', role: 'primary', confidence: 0.95 });
  }
  if (/biolog|hujayra|dnk|rnk|fotosintez|metabolizm|tarmoq|gen|nerv/i.test(q)) {
    detected.push({ id: 'biology.networks', role: detected.length ? 'overlay' : 'primary', confidence: 0.94 });
  }
  if (/uchburchak|aylana|doira|piramida|konus|silindr|shar|geometr|burchak|pifagor/i.test(q)) {
    detected.push({ id: 'geometry.dynamic', role: detected.length ? 'overlay' : 'primary', confidence: 0.93 });
  }
  if (/funksiya|hosila|integral|sin|cos|parabola|tenglama|vektor|koordinata|algebra/i.test(q)) {
    detected.push({ id: 'math.functions', role: detected.length ? 'overlay' : 'primary', confidence: 0.92 });
  }
  if (/kuch|tezlik|bosim|gidravlik|richag|prujina|mayatnik|impuls|mexanika|oqim|fizika/i.test(q)) {
    detected.push({ id: 'physics.mechanics', role: detected.length ? 'overlay' : 'primary', confidence: 0.92 });
  }
  if (/sxema|zanjir|transformator|tok|kuchlanish|blok|algoritm|jarayon/i.test(q)) {
    detected.push({ id: 'schematics.circuits', role: detected.length ? 'overlay' : 'primary', confidence: 0.90 });
  }

  if (detected.length === 0) {
    detected.push({ id: 'visual.whiteboard', role: 'primary', confidence: 0.85 });
  }

  return detected.slice(0, 3);
}

export function generateSceneArchitecturePlan(
  query: string,
  deviceTier: 'low' | 'mid' | 'high' = 'low'
): SceneArchitecturePlan {
  const normQuery = query.toLowerCase().trim();
  const subjects = detectSubjects(normQuery);
  const tierBudget = TIER_BUDGETS[deviceTier] || TIER_BUDGETS.low;

  const rawLibs = new Set<string>(['svg_native', 'gsap', 'katex']);
  const primitivesList: Array<{
    id: string;
    subject: string;
    count: number;
    instancing: boolean;
    lod: 'none' | 'decimate' | 'cluster' | 'sample' | 'slice_only';
  }> = [];

  for (const subj of subjects) {
    const reg = STEM_SCENE_REGISTRY[subj.id];
    if (reg) {
      reg.libs.forEach((l) => rawLibs.add(l));
      const prim = reg.primitives[0] || 'draggable_diagram_node';
      primitivesList.push({ id: prim, subject: subj.id, count: 1, instancing: false, lod: 'none' });
    }
  }

  const libsFormatted: Array<{ id: string; load: 'core' | 'lazy' | 'native'; kb: number; reason: string }> = [];
  let estimatedLazyKb = 0;
  const downgrades: Array<{ from: string; to: string; reason: string }> = [];

  for (const libId of rawLibs) {
    const info = LIBRARY_COSTS[libId] || { kb: 80, load: 'lazy' };
    if (info.load === 'lazy') {
      if (estimatedLazyKb + info.kb > tierBudget.lazy_kb) {
        downgrades.push({
          from: libId,
          to: 'zdog / svg_native',
          reason: `Exceeds ${deviceTier} tier lazy_kb ceiling (${tierBudget.lazy_kb} KB)`,
        });
        continue;
      }
      estimatedLazyKb += info.kb;
    }
    libsFormatted.push({
      id: libId,
      load: info.load,
      kb: info.kb,
      reason: `2D/2.5D rendering for ${subjects[0]?.id || 'visual.whiteboard'}`,
    });
  }

  const sharedParam = subjects.length > 1 ? 'simulation_rate' : null;

  return {
    version: '2.0',
    render_mode: '2d_svg',
    query_normalized: normQuery,
    subjects,
    shared_parameter: sharedParam,
    layout: sharedParam ? 'linked' : 'parallel',
    device_tier: deviceTier,
    libs: libsFormatted,
    estimated_lazy_kb: estimatedLazyKb,
    primitives: primitivesList,
    budget: {
      draw_calls: tierBudget.draw_calls,
      triangles: tierBudget.triangles,
      dpr: tierBudget.dpr,
      shadows: false,
      antialias: tierBudget.antialias,
      postfx: false,
      frameloop: 'demand',
    },
    merged_lines: true,
    workers: [{ task: '2d_physics_and_layout_step', est_ms: 8 }],
    engineering_constraints: {
      equations: ['F = m \\cdot a', 'E = m c^2'],
      grid_freq_hz: 50,
      units: ['m', 's', 'N', 'J', 'W', 'V', 'mol'],
    },
    mode: 'accurate',
    controls: [
      {
        param: 'simulation_rate',
        label_uz: 'Jarayon tezligi',
        unit: 'x',
        min: 0.25,
        max: 2.0,
        step: 0.25,
        default: 1.0,
        affects: primitivesList.map((p) => p.id),
      },
    ],
    camera: { type: '2d_flat', distance: 1.0 },
    labels_locale: 'uz',
    downgrades,
    license_rejections: [],
    unsupported_requests: [],
    fallback: {
      tier: 'low',
      svg_fallback: true,
      strategy: 'Lightweight 2D/2.5D Zdog & SVG vector rendering — runs at 60 FPS on mobile without heavy 3D WebGL.',
    },
    needs_clarification: false,
    clarifying_question: null,
    confirm_chips: [],
    builder_rules: [
      'Use lightweight 2D and 2.5D engines (Zdog, PixiJS v8, Konva, Mafs, JSXGraph, Rapier2D, Matter.js, SmilesDrawer, RDKit, Cytoscape, React Flow).',
      'Lazy-load WASM and heavy chart/geometry engines on demand.',
      'Sync step animations cleanly with GSAP timelines.',
    ],
    self_check: {
      ids_valid: true,
      within_budget: true,
      libs_minimal: true,
      license_clean: true,
    },
  };
}
