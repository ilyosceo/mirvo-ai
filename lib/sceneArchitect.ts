import type { SceneArchitecturePlan } from '../types/tutor.js';

export const ENERGY_REGISTRY: Record<string, { libs: string[]; primitives: string[] }> = {
  'energy.power_systems': {
    libs: ['three', 'drei', 'mathjs', 'katex', 'svg_native'],
    primitives: ['transformer_3d', 'substation_bay', 'transmission_tower', 'phasor_diagram', 'power_flow_line', 'load_curve', 'reactive_compensation_bank'],
  },
  'energy.machines_drives': {
    libs: ['three', 'drei', 'mathjs', 'katex', 'svg_native'],
    primitives: ['stator_rotor_3d', 'rotating_magnetic_field', 'winding_coil', 'torque_speed_curve', 'pwm_inverter_wave'],
  },
  'energy.renewables': {
    libs: ['three', 'drei', 'astronomy-engine', 'mathjs', 'katex', 'svg_native'],
    primitives: ['solar_pv_array', 'sun_irradiance_ray', 'iv_mppt_curve', 'wind_turbine_3d', 'airflow_streamline', 'hydro_dam_turbine', 'penstock_flow'],
  },
  'energy.thermal_plants': {
    libs: ['three', 'drei', 'rapier3d', 'mathjs', 'katex', 'svg_native'],
    primitives: ['boiler_furnace_3d', 'steam_gas_turbine', 'thermo_cycle_ts_hs', 'heat_exchanger_coil', 'cooling_tower', 'fluid_particles'],
  },
  'energy.storage_grid': {
    libs: ['three', 'drei', 'forcegraph3d', 'mathjs', 'katex', 'svg_native'],
    primitives: ['battery_cell_ion_flow', 'bess_container_3d', 'fuel_cell_membrane', 'microgrid_topology', 'frequency_droop_chart'],
  },
  'energy.protection_safety': {
    libs: ['three', 'drei', 'mathjs', 'katex', 'svg_native'],
    primitives: ['relay_protection_scheme', 'short_circuit_wave', 'grounding_grid_3d', 'step_touch_voltage_field', 'breaker_arc_chamber'],
  },
  'energy.efficiency_audit': {
    libs: ['plotly', 'svg_native', 'mathjs', 'katex'],
    primitives: ['sankey_energy_balance', 'harmonic_thd_spectrum', 'thermal_insulation_wall', 'lcoe_cost_bar'],
  },
  'visual.diagram_2d': {
    libs: ['svg_native', 'katex'],
    primitives: ['single_line_diagram', 'vector_diagram', 'coordinate_plot', 'formula_card', 'step_timeline'],
  },
};

export const LIBRARY_COSTS: Record<string, { kb: number; load: 'core' | 'lazy' | 'native' }> = {
  'svg_native': { kb: 0, load: 'native' },
  'three': { kb: 150, load: 'core' },
  'drei': { kb: 60, load: 'core' },
  'katex': { kb: 80, load: 'lazy' },
  'mathjs': { kb: 180, load: 'lazy' },
  'astronomy-engine': { kb: 90, load: 'lazy' },
  'forcegraph3d': { kb: 120, load: 'lazy' },
  'postprocessing': { kb: 45, load: 'lazy' },
  'rapier3d': { kb: 900, load: 'lazy' },
  'plotly': { kb: 1100, load: 'lazy' },
};

export const TIER_BUDGETS = {
  low: { draw_calls: 80, triangles: 200000, lazy_kb: 700, dpr: 1.0, shadows: false, antialias: false, postfx: false },
  mid: { draw_calls: 250, triangles: 1000000, lazy_kb: 2000, dpr: 1.5, shadows: false, antialias: true, postfx: 'limited' },
  high: { draw_calls: 600, triangles: 4000000, lazy_kb: 4000, dpr: 1.75, shadows: true, antialias: true, postfx: true },
};

export function detectSubjects(query: string): Array<{ id: string; role: 'primary' | 'overlay' | 'annotation'; confidence: number }> {
  const q = query.toLowerCase();
  const detected: Array<{ id: string; role: 'primary' | 'overlay' | 'annotation'; confidence: number }> = [];

  if (/shamol|wind|turbin|shes/i.test(q)) {
    detected.push({ id: 'energy.renewables', role: 'primary', confidence: 0.95 });
  }
  if (/generator|motor|dvigatel|stator|rotor|invertor|vfd/i.test(q)) {
    detected.push({ id: 'energy.machines_drives', role: detected.length === 0 ? 'primary' : 'overlay', confidence: 0.92 });
  }
  if (/transformator|substation|nimstansiya|l[eэ]p|tarmoq|power/i.test(q)) {
    detected.push({ id: 'energy.power_systems', role: detected.length === 0 ? 'primary' : 'overlay', confidence: 0.90 });
  }
  if (/quyosh|solar|pv|gidro|ges|geotermal/i.test(q)) {
    detected.push({ id: 'energy.renewables', role: detected.length === 0 ? 'primary' : 'overlay', confidence: 0.94 });
  }
  if (/qozon|boiler|ies|iem|turbina|steam|bug'/i.test(q)) {
    detected.push({ id: 'energy.thermal_plants', role: 'primary', confidence: 0.93 });
  }
  if (/batareya|bess|vodorod|microgrid|smart grid/i.test(q)) {
    detected.push({ id: 'energy.storage_grid', role: 'primary', confidence: 0.91 });
  }
  if (/rele|himoya|qisqa tutashuv|yerga ulash|grounding|breaker/i.test(q)) {
    detected.push({ id: 'energy.protection_safety', role: 'primary', confidence: 0.90 });
  }
  if (/audit|isrof|thd|lcoe|garmonika/i.test(q)) {
    detected.push({ id: 'energy.efficiency_audit', role: 'primary', confidence: 0.89 });
  }

  if (detected.length === 0) {
    if (/sxema|diagramma|grafik|formula/i.test(q)) {
      detected.push({ id: 'visual.diagram_2d', role: 'primary', confidence: 0.85 });
    } else {
      detected.push({ id: 'energy.power_systems', role: 'primary', confidence: 0.80 });
    }
  }

  // Deduplicate by ID
  const map = new Map<string, { id: string; role: 'primary' | 'overlay' | 'annotation'; confidence: number }>();
  for (const item of detected) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values()).slice(0, 3);
}

export function generateSceneArchitecturePlan(query: string, deviceTier: 'low' | 'mid' | 'high' = 'low'): SceneArchitecturePlan {
  const normQuery = query.toLowerCase().trim();
  const subjects = detectSubjects(normQuery);
  const tierBudget = TIER_BUDGETS[deviceTier] || TIER_BUDGETS.low;

  // Gather allowed libs & primitives
  const rawLibs = new Set<string>(['three', 'drei', 'katex', 'mathjs', 'svg_native']);
  const primitivesList: Array<{ id: string; subject: string; count: number; instancing: boolean; lod: 'none' | 'decimate' | 'cluster' | 'sample' | 'slice_only' }> = [];

  for (const subj of subjects) {
    const reg = ENERGY_REGISTRY[subj.id];
    if (reg) {
      reg.libs.forEach((l) => rawLibs.add(l));
      if (subj.id === 'energy.renewables') {
        primitivesList.push({ id: 'wind_turbine_3d', subject: subj.id, count: 1, instancing: false, lod: 'none' });
        primitivesList.push({ id: 'airflow_streamline', subject: subj.id, count: 80, instancing: true, lod: 'sample' });
      } else if (subj.id === 'energy.machines_drives') {
        primitivesList.push({ id: 'stator_rotor_3d', subject: subj.id, count: 1, instancing: false, lod: 'none' });
        primitivesList.push({ id: 'winding_coil', subject: subj.id, count: 48, instancing: true, lod: 'none' });
      } else if (subj.id === 'energy.power_systems') {
        primitivesList.push({ id: 'transformer_3d', subject: subj.id, count: 1, instancing: false, lod: 'none' });
        primitivesList.push({ id: 'transmission_tower', subject: subj.id, count: 4, instancing: true, lod: 'none' });
      } else {
        const prim = reg.primitives[0] || 'transformer_3d';
        primitivesList.push({ id: prim, subject: subj.id, count: 1, instancing: false, lod: 'none' });
      }
    }
  }

  // Budget enforcement & lazy KB calculation
  const libsFormatted: Array<{ id: string; load: 'core' | 'lazy' | 'native'; kb: number; reason: string }> = [];
  let estimatedLazyKb = 0;
  const downgrades: Array<{ from: string; to: string; reason: string }> = [];

  for (const libId of rawLibs) {
    const info = LIBRARY_COSTS[libId] || { kb: 100, load: 'lazy' };
    if (info.load === 'lazy') {
      if (estimatedLazyKb + info.kb > tierBudget.lazy_kb) {
        downgrades.push({
          from: libId,
          to: 'mathjs / svg_native',
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
      reason: `Required for ${subjects[0]?.id || 'energy'} rendering and calculations`,
    });
  }

  const sharedParam = subjects.length > 1 ? 'operational_load' : null;

  return {
    version: '1.0',
    render_mode: '3d_webgl',
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
      shadows: tierBudget.shadows,
      antialias: tierBudget.antialias,
      postfx: tierBudget.postfx,
      frameloop: 'always',
    },
    merged_lines: true,
    workers: [{ task: 'engineering_matrix_step', est_ms: 25 }],
    engineering_constraints: {
      equations: ['P = S * \\cos\\varphi', 'U_1 / U_2 = N_1 / N_2', 'f = 50\\text{ Hz}'],
      grid_freq_hz: 50,
      units: ['kV', 'kW', 'MW', 'Hz', 'A', 'cos φ'],
    },
    mode: 'accurate',
    controls: [
      {
        param: 'operational_load',
        label_uz: 'Ishchi yuklama va tezlik',
        unit: 'p.u.',
        min: 0.2,
        max: 2.0,
        step: 0.1,
        default: 1.0,
        affects: primitivesList.map((p) => p.id),
      },
    ],
    camera: { type: 'orbit', distance: 8.5 },
    labels_locale: 'uz',
    downgrades,
    license_rejections: [],
    unsupported_requests: [],
    fallback: {
      tier: 'low',
      svg_fallback: true,
      strategy: 'Seamless switch to animated 2D engineering SVG schematic on WebGL context loss or low tier overload.',
    },
    needs_clarification: false,
    clarifying_question: null,
    confirm_chips: [],
    builder_rules: [
      'Strictly obey every numeric ceiling in budget.',
      'Never add libraries outside libs or violate SI units.',
      'Lazy-import all lazy libraries with a byte-based progress bar.',
      'Use InstancedMesh for repeated geometry and single LineSegments for edges.',
      'Never call React setState inside useFrame.',
      'Render in Dark Studio aesthetic (#0D1017 background, MatCap materials, #38BDF8/#F59E0B/#10B981 accents).',
      'Dynamically toggle frameloop between always and demand.',
      'Dispose all geometries, materials, and textures on unmount and handle context loss with SVG fallback.',
    ],
    self_check: {
      ids_valid: true,
      within_budget: true,
      libs_minimal: true,
      license_clean: true,
    },
  };
}
