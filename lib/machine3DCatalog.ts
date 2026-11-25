import type { Primitive3DItem } from '../types/tutor';

export type BuiltInMachineKey =
  | 'gaes'
  | 'transformer'
  | 'turbine'
  | 'hydraulics'
  | 'motor'
  | 'engine'
  | 'solar';

export interface MachineAssemblyResult {
  key: BuiltInMachineKey | 'custom';
  titleUz: string;
  subtitleUz: string;
  primitives: Primitive3DItem[];
  partOrder: Array<{ partId: string; label: string }>;
  defaultCamera: [number, number, number];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * 1. GAES-120 — Gidroakkumulyatsion Elektr Stansiyasi (True 3D PBR Cutaway Model)
 * Inspired by engineering anatomy cutaway benchtop rigs:
 * Machined baseplate, steel gantry, cutaway upper reservoir + water volume,
 * flanged penstock with live 3D water flow spheres (reversible for Pump mode!),
 * spherical inlet valve, cutaway scroll powerhouse, spinning 8-blade Francis runner,
 * vertical shaft + ribbed generator stator + exciter, 3-phase busbars,
 * step-up transformer with porcelain bushings, lower reservoir, and 3D MW dial gauge.
 */
export function buildGaes3D(sliders: Record<string, number> = {}): MachineAssemblyResult {
  const head = sliders.head ?? sliders.u1 ?? 120; // m (40..250)
  const flow = sliders.flow ?? sliders.load ?? 85; // % or m3/s (0..120)
  const modeVal = sliders.mode ?? 1; // 1 = Generatsiya, 0 = Kutish, -1 = Nasos
  const isPumping = modeVal < -0.2;
  const isIdle = Math.abs(modeVal) <= 0.2 || flow <= 1;

  const headNorm = clamp((head - 30) / 220, 0.2, 1);
  const flowNorm = isIdle ? 0 : clamp(flow / 100, 0.08, 1.4);
  const powerMw = isIdle ? 0 : (9.81 * head * (flow * 0.9) * 0.9) / 1000;
  const gaugeNorm = clamp(powerMw / 220, 0.04, 0.98);

  const waterUpperH = 0.42 + headNorm * 0.26;
  const waterLowerH = 0.46 - headNorm * 0.14;

  const primitives: Primitive3DItem[] = [
    // Machined benchtop baseplate
    {
      id: 'gaes-base',
      type: 'rounded_box',
      position: [0, -1.18, 0],
      args: [5.4, 0.18, 3.2, 4, 0.06],
      color: '#334155',
      metalness: 0.65,
      roughness: 0.35,
      partId: 'foundation',
      label: 'Tayanch platforma',
      explodeOffset: [0, -0.45, 0],
    },
    // Corner mounting bolts
    ...([
      [-2.45, -1.06, -1.35],
      [2.45, -1.06, -1.35],
      [-2.45, -1.06, 1.35],
      [2.45, -1.06, 1.35],
    ] as [number, number, number][]).map((pos, idx): Primitive3DItem => ({
      id: `gaes-bolt-${idx}`,
      type: 'cylinder',
      position: pos,
      args: [0.07, 0.07, 0.08, 6],
      color: '#94A3B8',
      metalness: 0.88,
      roughness: 0.22,
      partId: 'foundation',
      explodeOffset: [0, -0.5, 0],
    })),

    // Upper Reservoir Steel Gantry Columns (4 legs + crossbeams)
    ...([
      [-2.25, -0.35, -0.85],
      [-1.05, -0.35, -0.85],
      [-2.25, -0.35, 0.35],
      [-1.05, -0.35, 0.35],
    ] as [number, number, number][]).map((pos, idx): Primitive3DItem => ({
      id: `gaes-col-${idx}`,
      type: 'cylinder',
      position: pos,
      args: [0.065, 0.075, 1.5, 20],
      color: '#64748B',
      metalness: 0.78,
      roughness: 0.28,
      partId: 'upper_reservoir',
      explodeOffset: [-0.45, 0.15, 0],
    })),
    // Upper Reservoir Floor Deck
    {
      id: 'gaes-upper-deck',
      type: 'rounded_box',
      position: [-1.65, 0.44, -0.25],
      args: [1.55, 0.1, 1.55, 3, 0.03],
      color: '#475569',
      metalness: 0.6,
      roughness: 0.35,
      partId: 'upper_reservoir',
      label: 'Yuqori suv havzasi',
      explodeOffset: [-0.55, 0.55, 0],
    },
    // Cutaway Concrete Walls of Upper Reservoir (Back, Left, Right)
    {
      id: 'gaes-upper-wall-back',
      type: 'box',
      position: [-1.65, 0.92, -0.96],
      args: [1.52, 0.88, 0.1],
      color: '#CBD5E1',
      metalness: 0.15,
      roughness: 0.65,
      partId: 'upper_reservoir',
      explodeOffset: [-0.55, 0.65, -0.2],
    },
    {
      id: 'gaes-upper-wall-left',
      type: 'box',
      position: [-2.36, 0.92, -0.25],
      args: [0.1, 0.88, 1.48],
      color: '#94A3B8',
      metalness: 0.18,
      roughness: 0.6,
      partId: 'upper_reservoir',
      explodeOffset: [-0.75, 0.65, 0],
    },
    // Glass Front Window on Upper Reservoir
    {
      id: 'gaes-upper-glass',
      type: 'box',
      position: [-1.65, 0.88, 0.46],
      args: [1.4, 0.78, 0.04],
      color: '#BAE6FD',
      opacity: 0.28,
      metalness: 0.1,
      roughness: 0.08,
      transmission: 0.65,
      clearcoat: 1,
      partId: 'upper_reservoir',
      explodeOffset: [-0.55, 0.65, 0.35],
    },
    // Translucent 3D Water Volume in Upper Reservoir
    {
      id: 'gaes-upper-water',
      type: 'rounded_box',
      position: [-1.65, 0.49 + waterUpperH / 2, -0.25],
      args: [1.34, waterUpperH, 1.32, 2, 0.02],
      color: '#0EA5E9',
      emissive: '#0284C7',
      emissiveIntensity: 0.18,
      opacity: 0.74,
      metalness: 0.08,
      roughness: 0.12,
      clearcoat: 0.9,
      partId: 'upper_reservoir',
      explodeOffset: [-0.55, 0.85, 0],
    },

    // Inclined High-Pressure Penstock Pipe (with 3D flowing water spheres!)
    {
      id: 'gaes-penstock',
      type: 'tube',
      position: [0, 0, 0],
      args: [0.15],
      points: [
        [-0.95, 0.68, -0.25],
        [-0.55, 0.42, -0.22],
        [-0.12, -0.18, -0.15],
        [0.25, -0.58, -0.08],
      ],
      color: '#38BDF8',
      opacity: 0.52,
      metalness: 0.45,
      roughness: 0.18,
      clearcoat: 0.8,
      partId: 'penstock',
      label: 'Bosimli suv quvuri (Penstock)',
      flowType: isIdle ? 'none' : 'dc',
      flowSpeed: 0.7 + flowNorm * 1.4,
      flowReverse: isPumping,
      explodeOffset: [-0.2, 0.45, -0.35],
    },
    // Steel Reinforcement Rings along Penstock
    ...([
      [-0.75, 0.55, -0.23],
      [-0.35, 0.14, -0.18],
      [0.05, -0.38, -0.12],
    ] as [number, number, number][]).map((pos, idx): Primitive3DItem => ({
      id: `gaes-flange-${idx}`,
      type: 'torus',
      position: pos,
      rotation: [0.3, 0.75, 0.85],
      args: [0.175, 0.032, Math.PI * 2],
      color: '#E2E8F0',
      metalness: 0.85,
      roughness: 0.25,
      partId: 'penstock',
      explodeOffset: [-0.2, 0.45, -0.35],
    })),
    // Spherical Inlet Valve
    {
      id: 'gaes-valve',
      type: 'sphere',
      position: [0.14, -0.48, -0.1],
      args: [0.21],
      color: '#F59E0B',
      metalness: 0.65,
      roughness: 0.28,
      partId: 'penstock',
      explodeOffset: [-0.1, 0.25, -0.35],
    },

    // Reversible Hydro Turbine Scroll Housing (Cutaway Cylinder so Runner is visible!)
    {
      id: 'gaes-scroll-case',
      type: 'cylinder',
      position: [0.72, -0.62, -0.05],
      rotation: [0, -0.55, 0],
      args: [0.56, 0.6, 0.62, 32, 0, 0, Math.PI * 1.38],
      color: '#1E293B',
      metalness: 0.72,
      roughness: 0.32,
      partId: 'runner',
      explodeOffset: [0.25, -0.1, -0.35],
    },
    // Spinning 8-Blade 3D Francis Hydro Runner!
    {
      id: 'gaes-runner',
      type: 'turbine_runner',
      position: [0.72, -0.62, -0.05],
      args: [0.44, 0.28, 8, 0.45],
      color: isPumping ? '#A855F7' : '#06B6D4',
      emissive: isPumping ? '#7E22CE' : '#0891B2',
      emissiveIntensity: isIdle ? 0.05 : 0.28,
      metalness: 0.78,
      roughness: 0.2,
      partId: 'runner',
      label: isPumping ? 'Nasos-turbina ishchi g‘ildiragi' : 'Frensis gidroturbinasi',
      animation: isIdle ? 'none' : isPumping ? 'spin_reverse' : 'spin',
      animationAxis: 'y',
      animationSpeed: 1.8 + flowNorm * 4.5,
      explodeOffset: [0.35, -0.05, 0.35],
    },

    // Vertical Forged Steel Shaft
    {
      id: 'gaes-shaft',
      type: 'cylinder',
      position: [0.72, -0.08, -0.05],
      args: [0.09, 0.09, 0.95, 24],
      color: '#E2E8F0',
      metalness: 0.92,
      roughness: 0.15,
      partId: 'generator',
      animation: isIdle ? 'none' : isPumping ? 'spin_reverse' : 'spin',
      animationAxis: 'y',
      animationSpeed: 1.8 + flowNorm * 4.5,
      explodeOffset: [0.35, 0.45, 0],
    },
    // Synchronous Generator Ribbed Cutaway Stator
    {
      id: 'gaes-stator',
      type: 'cylinder',
      position: [0.72, 0.36, -0.05],
      rotation: [0, -0.5, 0],
      args: [0.5, 0.5, 0.68, 32, 0, 0, Math.PI * 1.45],
      color: '#2563EB',
      metalness: 0.58,
      roughness: 0.32,
      partId: 'generator',
      label: 'Sinxron generator-motor',
      explodeOffset: [0.4, 0.68, -0.2],
    },
    // Copper Stator Winding Coil Inside Generator
    {
      id: 'gaes-gen-coil',
      type: 'coil',
      position: [0.72, 0.36, -0.05],
      args: [0.34, 0.52, 7, 0.036],
      color: '#F97316',
      emissive: '#EA580C',
      emissiveIntensity: isIdle ? 0.04 : 0.22,
      metalness: 0.85,
      roughness: 0.22,
      partId: 'generator',
      animation: isIdle ? 'none' : isPumping ? 'spin_reverse' : 'spin',
      animationAxis: 'y',
      animationSpeed: 1.8 + flowNorm * 4.5,
      explodeOffset: [0.4, 0.82, 0.15],
    },
    // Top Exciter Dome
    {
      id: 'gaes-exciter',
      type: 'cylinder',
      position: [0.72, 0.82, -0.05],
      args: [0.24, 0.32, 0.22, 24],
      color: '#60A5FA',
      metalness: 0.72,
      roughness: 0.25,
      partId: 'generator',
      explodeOffset: [0.4, 1.05, 0],
    },

    // Step-Up Power Transformer + 3 Porcelain HV Bushings
    {
      id: 'gaes-tr-tank',
      type: 'rounded_box',
      position: [-0.25, -0.68, 0.85],
      args: [0.78, 0.66, 0.56, 3, 0.04],
      color: '#475569',
      metalness: 0.68,
      roughness: 0.34,
      partId: 'transformer',
      label: 'Kuchlanish transformatori',
      explodeOffset: [-0.25, 0.15, 0.65],
    },
    ...([-0.45, -0.25, -0.05] as number[]).map((bx, i): Primitive3DItem => ({
      id: `gaes-bushing-${i}`,
      type: 'cylinder',
      position: [bx, -0.22, 0.85],
      args: [0.04, 0.055, 0.28, 16],
      color: i === 0 ? '#EF4444' : i === 1 ? '#F59E0B' : '#10B981',
      metalness: 0.35,
      roughness: 0.25,
      partId: 'transformer',
      explodeOffset: [-0.25, 0.35, 0.65],
    })),
    // Busbar Cable from Generator to Transformer
    {
      id: 'gaes-busbar',
      type: 'tube',
      position: [0, 0, 0],
      args: [0.038],
      points: [
        [0.42, 0.38, 0.25],
        [0.12, 0.22, 0.65],
        [-0.25, -0.08, 0.85],
      ],
      color: '#FBBF24',
      metalness: 0.85,
      roughness: 0.2,
      partId: 'transformer',
      flowType: isIdle ? 'none' : 'ac',
      flowSpeed: 1.4,
      flowReverse: isPumping,
      explodeOffset: [0, 0.35, 0.55],
    },

    // Lower Reservoir Tailrace Basin + Water
    {
      id: 'gaes-lower-basin',
      type: 'rounded_box',
      position: [1.85, -0.86, 0.42],
      args: [1.42, 0.46, 1.35, 3, 0.03],
      color: '#64748B',
      metalness: 0.32,
      roughness: 0.55,
      partId: 'lower_reservoir',
      label: 'Quyi suv havzasi',
      explodeOffset: [0.65, -0.1, 0.4],
    },
    {
      id: 'gaes-lower-water',
      type: 'rounded_box',
      position: [1.85, -0.82 + waterLowerH * 0.3, 0.42],
      args: [1.26, waterLowerH, 1.18, 2, 0.02],
      color: '#0284C7',
      emissive: '#0369A1',
      emissiveIntensity: 0.16,
      opacity: 0.78,
      metalness: 0.1,
      roughness: 0.12,
      clearcoat: 0.9,
      partId: 'lower_reservoir',
      explodeOffset: [0.65, 0.15, 0.4],
    },
    // Tailrace Draft Tube connecting Turbine to Lower Reservoir
    {
      id: 'gaes-draft-tube',
      type: 'tube',
      position: [0, 0, 0],
      args: [0.14],
      points: [
        [0.98, -0.76, 0.05],
        [1.35, -0.82, 0.25],
      ],
      color: '#38BDF8',
      opacity: 0.55,
      metalness: 0.4,
      roughness: 0.2,
      partId: 'lower_reservoir',
      flowType: isIdle ? 'none' : 'dc',
      flowSpeed: 0.6 + flowNorm * 1.1,
      flowReverse: isPumping,
      explodeOffset: [0.5, -0.05, 0.25],
    },

    // Benchtop 3D Analog Power / Mode Gauge
    {
      id: 'gaes-gauge',
      type: 'dial_gauge',
      position: [-1.75, -0.76, 0.95],
      rotation: [-0.35, 0.35, 0],
      args: [0.36, 0.1, gaugeNorm],
      color: isPumping ? '#A855F7' : '#10B981',
      metalness: 0.82,
      roughness: 0.22,
      partId: 'gauge',
      label: `Quvvat manometri (${Math.round(powerMw)} MVt)`,
      explodeOffset: [-0.55, 0.2, 0.55],
    },
  ];

  return {
    key: 'gaes',
    titleUz: 'GAES-120 — Gidroakkumulyatsion Stansiya (3D WebGL)',
    subtitleUz: isPumping
      ? 'Nasos rejimi: suv yuqori havzaga qayta haydalmoqda'
      : isIdle
        ? 'Kutish rejimi: klapan yopiq'
        : `Generatsiya rejimi: ~${Math.round(powerMw)} MVt elektr quvvati`,
    primitives,
    partOrder: [
      { partId: 'upper_reservoir', label: 'Yuqori suv havzasi' },
      { partId: 'penstock', label: 'Bosimli quvur' },
      { partId: 'runner', label: 'Frensis turbinasi' },
      { partId: 'generator', label: 'Sinxron generator' },
      { partId: 'transformer', label: 'Transformator' },
      { partId: 'lower_reservoir', label: 'Quyi havza' },
    ],
    defaultCamera: [4.8, 3.3, 5.2],
  };
}

/**
 * 2. TRANSFORMER — True 3D Laminated Silicon-Steel Core, Helical Copper & Gold Windings,
 * Orbiting 3D Magnetic Flux Loop, Busbar Terminals & Live 3D Analog Voltmeter!
 */
export function buildTransformer3D(sliders: Record<string, number> = {}): MachineAssemblyResult {
  const u1 = sliders.u1 ?? sliders.voltage_in ?? 220;
  const ratio = sliders.turns_ratio ?? sliders.ratio ?? 3.0;
  const u2 = Math.round(u1 * ratio);
  const secondaryTurns = clamp(Math.round(4 + ratio * 3.2), 4, 22);
  const gaugeNorm = clamp(u2 / 1100, 0.05, 0.98);

  const primitives: Primitive3DItem[] = [
    // Heavy Insulated Lab Baseplate
    {
      id: 'tr-base',
      type: 'rounded_box',
      position: [0, -1.22, 0],
      args: [4.6, 0.2, 2.5, 4, 0.06],
      color: '#1E293B',
      metalness: 0.7,
      roughness: 0.3,
      partId: 'base',
      explodeOffset: [0, -0.45, 0],
    },

    // Laminated Ferromagnetic Silicon-Steel Core (4 limbs forming closed 3D window)
    {
      id: 'tr-core-top',
      type: 'rounded_box',
      position: [-0.35, 0.92, 0],
      args: [2.55, 0.42, 0.68, 3, 0.04],
      color: '#64748B',
      metalness: 0.82,
      roughness: 0.28,
      partId: 'core',
      label: 'Po‘lat magnit o‘zak (Φ)',
      explodeOffset: [0, 0.65, 0],
    },
    {
      id: 'tr-core-bottom',
      type: 'rounded_box',
      position: [-0.35, -0.82, 0],
      args: [2.55, 0.42, 0.68, 3, 0.04],
      color: '#475569',
      metalness: 0.82,
      roughness: 0.3,
      partId: 'core',
      explodeOffset: [0, -0.35, 0],
    },
    {
      id: 'tr-core-left',
      type: 'rounded_box',
      position: [-1.36, 0.05, 0],
      args: [0.52, 1.42, 0.66, 3, 0.03],
      color: '#64748B',
      metalness: 0.82,
      roughness: 0.28,
      partId: 'core',
      explodeOffset: [-0.35, 0, -0.35],
    },
    {
      id: 'tr-core-right',
      type: 'rounded_box',
      position: [0.66, 0.05, 0],
      args: [0.52, 1.42, 0.66, 3, 0.03],
      color: '#64748B',
      metalness: 0.82,
      roughness: 0.28,
      partId: 'core',
      explodeOffset: [0.25, 0, -0.35],
    },

    // Closed 3D Magnetic Flux Loop (Glowing Cyan Tube + Traveling Flux Particles!)
    {
      id: 'tr-flux-loop',
      type: 'tube',
      position: [0, 0, 0.38],
      args: [0.032],
      points: [
        [-1.36, -0.78, 0],
        [-1.36, 0.88, 0],
        [0.66, 0.88, 0],
        [0.66, -0.78, 0],
        [-1.36, -0.78, 0],
      ],
      color: '#38BDF8',
      emissive: '#0284C7',
      emissiveIntensity: 0.55,
      opacity: 0.65,
      metalness: 0.2,
      roughness: 0.15,
      partId: 'flux',
      label: 'O‘zgaruvchan magnit oqimi (Φ)',
      flowType: u1 > 5 ? 'ac' : 'none',
      flowSpeed: 0.8 + (u1 / 220) * 1.1,
      explodeOffset: [0, 0, 0.75],
    },

    // Primary Insulating Bobbin + True 3D Helical Blue-Copper Winding (N1)
    {
      id: 'tr-bobbin-1',
      type: 'cylinder',
      position: [-1.36, 0.05, 0],
      args: [0.44, 0.44, 1.24, 28],
      color: '#1E3A8A',
      opacity: 0.85,
      metalness: 0.25,
      roughness: 0.45,
      partId: 'primary_coil',
      explodeOffset: [-0.95, 0, 0.25],
    },
    {
      id: 'tr-coil-1',
      type: 'helical_coil',
      position: [-1.36, 0.05, 0],
      args: [0.5, 1.12, 8, 0.048],
      color: '#3B82F6',
      emissive: '#1D4ED8',
      emissiveIntensity: u1 > 5 ? 0.25 : 0.04,
      metalness: 0.86,
      roughness: 0.18,
      clearcoat: 0.6,
      partId: 'primary_coil',
      label: `Birlamchi chulg‘am N₁ (${Math.round(u1)} V)`,
      explodeOffset: [-1.15, 0, 0.35],
    },
    // Input AC Terminals
    {
      id: 'tr-in-lead-top',
      type: 'tube',
      position: [0, 0, 0],
      args: [0.036],
      points: [
        [-2.25, 0.52, 0.2],
        [-1.82, 0.52, 0.12],
      ],
      color: '#60A5FA',
      metalness: 0.8,
      roughness: 0.2,
      partId: 'primary_coil',
      flowType: u1 > 5 ? 'ac' : 'none',
      flowSpeed: 1.2,
      explodeOffset: [-1.25, 0, 0.35],
    },

    // Secondary Insulating Bobbin + Dynamic True 3D Gold/Copper Winding (N2 scales with slider!)
    {
      id: 'tr-bobbin-2',
      type: 'cylinder',
      position: [0.66, 0.05, 0],
      args: [0.44, 0.44, 1.24, 28],
      color: '#78350F',
      opacity: 0.85,
      metalness: 0.25,
      roughness: 0.45,
      partId: 'secondary_coil',
      explodeOffset: [0.85, 0, 0.25],
    },
    {
      id: 'tr-coil-2',
      type: 'helical_coil',
      position: [0.66, 0.05, 0],
      args: [0.51, 1.14, secondaryTurns, clamp(0.056 - secondaryTurns * 0.0012, 0.026, 0.05)],
      color: '#F59E0B',
      emissive: '#D97706',
      emissiveIntensity: u2 > 10 ? 0.28 : 0.05,
      metalness: 0.9,
      roughness: 0.16,
      clearcoat: 0.7,
      partId: 'secondary_coil',
      label: `Ikkilamchi chulg‘am N₂ (${u2} V)`,
      explodeOffset: [1.05, 0, 0.35],
    },

    // Output Busbars feeding 3D Analog Voltmeter
    {
      id: 'tr-out-bus',
      type: 'tube',
      position: [0, 0, 0],
      args: [0.035],
      points: [
        [1.15, 0.42, 0.1],
        [1.55, 0.35, 0.2],
        [1.75, 0.05, 0.22],
      ],
      color: '#FBBF24',
      metalness: 0.88,
      roughness: 0.2,
      partId: 'voltmeter',
      flowType: u2 > 10 ? 'ac' : 'none',
      flowSpeed: 1.5,
      explodeOffset: [1.15, 0.1, 0.45],
    },
    // Pedestal + 3D Analog Voltmeter with Live Rotating Needle!
    {
      id: 'tr-meter-stand',
      type: 'cylinder',
      position: [1.78, -0.72, 0.25],
      args: [0.09, 0.16, 0.75, 20],
      color: '#475569',
      metalness: 0.75,
      roughness: 0.3,
      partId: 'voltmeter',
      explodeOffset: [1.25, -0.1, 0.45],
    },
    {
      id: 'tr-voltmeter',
      type: 'dial_gauge',
      position: [1.78, -0.12, 0.28],
      rotation: [0, -0.28, 0],
      args: [0.46, 0.14, gaugeNorm],
      color: '#F59E0B',
      metalness: 0.85,
      roughness: 0.18,
      partId: 'voltmeter',
      label: `3D Voltmetr (${u2} V)`,
      explodeOffset: [1.35, 0.15, 0.55],
    },
  ];

  return {
    key: 'transformer',
    titleUz: 'Transformator va Elektromagnit Induksiya (3D PBR)',
    subtitleUz: `U₁ = ${Math.round(u1)} V · k = ${ratio.toFixed(1)}x → U₂ = ${u2} V`,
    primitives,
    partOrder: [
      { partId: 'primary_coil', label: 'Birlamchi chulg‘am (N₁)' },
      { partId: 'core', label: 'Po‘lat magnit o‘zak' },
      { partId: 'flux', label: 'Magnit oqimi (Φ)' },
      { partId: 'secondary_coil', label: 'Ikkilamchi chulg‘am (N₂)' },
      { partId: 'voltmeter', label: 'Chiqish voltmetri (U₂)' },
    ],
    defaultCamera: [0.4, 1.4, 5.1],
  };
}

/**
 * 3. WIND TURBINE — Cutaway Nacelle, Meshing 3D Spur Gears (Gearbox),
 * Copper Generator, Spinning 3D Aerodynamic Rotor & Wind Streamlines!
 */
export function buildWindTurbine3D(sliders: Record<string, number> = {}): MachineAssemblyResult {
  const wind = sliders.wind_speed ?? sliders.v ?? 10; // m/s
  const radiusScale = clamp((sliders.blade_r ?? sliders.r ?? 40) / 40, 0.65, 1.45);
  const powerKw = Math.round(0.5 * 1.225 * Math.PI * Math.pow(radiusScale * 22, 2) * Math.pow(wind, 3) * 0.42 / 1000);
  const spinSpeed = wind <= 0.5 ? 0 : 0.7 + (wind / 12) * 3.6;
  const gaugeNorm = clamp(powerKw / 2500, 0.04, 0.98);

  const primitives: Primitive3DItem[] = [
    // Concrete Foundation Pad + Steel Pedestal
    {
      id: 'wt-pad',
      type: 'cylinder',
      position: [0, -1.55, 0],
      args: [1.45, 1.65, 0.24, 36],
      color: '#334155',
      metalness: 0.5,
      roughness: 0.45,
      partId: 'tower',
      explodeOffset: [0, -0.5, 0],
    },
    // Tapered Steel Tubular Tower
    {
      id: 'wt-tower',
      type: 'cylinder',
      position: [0, -0.32, 0],
      args: [0.22, 0.38, 2.35, 32],
      color: '#E2E8F0',
      metalness: 0.55,
      roughness: 0.28,
      clearcoat: 0.5,
      partId: 'tower',
      label: 'Konussimon po‘lat minora',
      explodeOffset: [0, -0.35, -0.3],
    },

    // Cutaway Nacelle Housing (Open side to reveal Gearbox & Generator!)
    {
      id: 'wt-nacelle',
      type: 'cylinder',
      position: [0, 0.96, -0.05],
      rotation: [Math.PI / 2, 0.45, 0],
      args: [0.46, 0.42, 1.55, 32, 0, 0, Math.PI * 1.35],
      color: '#F8FAFC',
      metalness: 0.45,
      roughness: 0.25,
      partId: 'nacelle',
      label: 'Gondola korpusi (kesim)',
      explodeOffset: [0, 0.55, -0.45],
    },
    // Low-speed Main Rotor Shaft inside Nacelle
    {
      id: 'wt-shaft',
      type: 'cylinder',
      position: [0, 0.96, 0.45],
      rotation: [Math.PI / 2, 0, 0],
      args: [0.075, 0.075, 0.95, 20],
      color: '#94A3B8',
      metalness: 0.9,
      roughness: 0.18,
      partId: 'gearbox',
      animation: spinSpeed > 0 ? 'spin' : 'none',
      animationAxis: 'z',
      animationSpeed: spinSpeed,
      explodeOffset: [0, 0.25, 0.45],
    },
    // True 3D Meshing Spur Gears (Step-Up Gearbox / Reduktor!)
    {
      id: 'wt-gear-main',
      type: 'gear',
      position: [0, 0.96, 0.12],
      args: [0.28, 0.1, 16, 0.07],
      color: '#F59E0B',
      metalness: 0.86,
      roughness: 0.22,
      partId: 'gearbox',
      label: 'Ko‘paytiruvchi reduktor (uzatma)',
      animation: spinSpeed > 0 ? 'spin' : 'none',
      animationAxis: 'z',
      animationSpeed: spinSpeed,
      explodeOffset: [-0.55, 0.35, 0.1],
    },
    {
      id: 'wt-gear-pinion',
      type: 'gear',
      position: [0.22, 1.15, 0.02],
      args: [0.14, 0.1, 10, 0.04],
      color: '#38BDF8',
      metalness: 0.88,
      roughness: 0.2,
      partId: 'gearbox',
      animation: spinSpeed > 0 ? 'spin_reverse' : 'none',
      animationAxis: 'z',
      animationSpeed: spinSpeed * 2.2,
      explodeOffset: [0.55, 0.45, 0.05],
    },

    // High-speed Copper-Wound Synchronous Generator in Rear of Nacelle
    {
      id: 'wt-generator',
      type: 'coil',
      position: [0, 0.96, -0.45],
      rotation: [Math.PI / 2, 0, 0],
      args: [0.26, 0.42, 7, 0.032],
      color: '#EA580C',
      emissive: '#C2410C',
      emissiveIntensity: spinSpeed > 0 ? 0.28 : 0.04,
      metalness: 0.85,
      roughness: 0.2,
      partId: 'generator',
      label: `Generator (~${powerKw} kVt)`,
      animation: spinSpeed > 0 ? 'spin_reverse' : 'none',
      animationAxis: 'z',
      animationSpeed: spinSpeed * 2.5,
      explodeOffset: [0, 0.35, -0.85],
    },

    // Aerodynamic Nose Cone + 3 Swept 3D Rotor Blades!
    {
      id: 'wt-hub-cone',
      type: 'cone',
      position: [0, 0.96, 1.02],
      rotation: [Math.PI / 2, 0, 0],
      args: [0.26, 0.48, 28],
      color: '#0EA5E9',
      metalness: 0.45,
      roughness: 0.22,
      clearcoat: 0.8,
      partId: 'blades',
      animation: spinSpeed > 0 ? 'spin' : 'none',
      animationAxis: 'z',
      animationSpeed: spinSpeed,
      explodeOffset: [0, 0.2, 1.05],
    },
    {
      id: 'wt-rotor-blades',
      type: 'impeller',
      position: [0, 0.96, 0.88],
      rotation: [Math.PI / 2, 0, 0],
      args: [1.45 * radiusScale, 0.18, 3, 0.34],
      color: '#F1F5F9',
      metalness: 0.32,
      roughness: 0.2,
      clearcoat: 0.85,
      partId: 'blades',
      label: 'Aerodinamik 3 ta parrak',
      animation: spinSpeed > 0 ? 'spin' : 'none',
      animationAxis: 'z',
      animationSpeed: spinSpeed,
      explodeOffset: [0, 0.2, 0.95],
    },

    // Animated 3D Wind Streamlines
    ...([-0.85, 0.85] as number[]).map((wx, idx): Primitive3DItem => ({
      id: `wt-wind-${idx}`,
      type: 'tube',
      position: [0, 0, 0],
      args: [0.02],
      points: [
        [wx, 0.96 + (idx === 0 ? 0.35 : -0.25), 2.3],
        [wx * 1.08, 0.96 + (idx === 0 ? 0.42 : -0.3), 0.8],
        [wx * 1.18, 0.96 + (idx === 0 ? 0.38 : -0.28), -1.2],
      ],
      color: '#38BDF8',
      opacity: 0.28,
      partId: 'wind_flow',
      label: idx === 0 ? `Shamol oqimi (${wind} m/s)` : undefined,
      flowType: wind > 0.5 ? 'dc' : 'none',
      flowSpeed: 0.6 + wind * 0.16,
      explodeOffset: [wx * 0.4, 0, 0.4],
    })),

    // Base 3D Power Output Gauge
    {
      id: 'wt-gauge',
      type: 'dial_gauge',
      position: [1.15, -1.18, 0.65],
      rotation: [-0.25, -0.35, 0],
      args: [0.38, 0.1, gaugeNorm],
      color: '#10B981',
      metalness: 0.85,
      roughness: 0.2,
      partId: 'generator',
      explodeOffset: [0.65, -0.1, 0.55],
    },
  ];

  return {
    key: 'turbine',
    titleUz: 'Shamol Turbinasi va Bets Qonuni (3D PBR)',
    subtitleUz: `v = ${wind} m/s · R = ${Math.round(radiusScale * 40)} m → P ≈ ${powerKw} kVt`,
    primitives,
    partOrder: [
      { partId: 'wind_flow', label: 'Shamol kinetik oqimi' },
      { partId: 'blades', label: 'Aerodinamik parraklar' },
      { partId: 'gearbox', label: 'Ko‘paytiruvchi reduktor' },
      { partId: 'generator', label: 'Sinxron generator' },
      { partId: 'tower', label: 'Po‘lat minora' },
    ],
    defaultCamera: [3.2, 1.9, 4.8],
  };
}

/**
 * 4. HYDRAULIC PRESS — Pascal's Law True 3D Translucent Glass Cylinders,
 * Live Shifting PBR Fluid Columns, Input & Output Pistons, Extruded Gold Mass & Manometer!
 */
export function buildHydraulics3D(sliders: Record<string, number> = {}): MachineAssemblyResult {
  const f1 = sliders.force_in ?? sliders.f1 ?? 150; // N
  const ratio = sliders.area_ratio ?? sliders.ratio ?? 8; // A2/A1
  const f2 = Math.round(f1 * ratio);
  const stroke = clamp((f1 - 50) / 450, 0, 1);
  const p1Y = 0.45 - stroke * 0.55;
  const p2Y = -0.15 + stroke * 0.38;
  const largeR = clamp(0.45 + Math.sqrt(ratio) * 0.12, 0.52, 0.88);
  const gaugeNorm = clamp(f2 / 5000, 0.06, 0.98);

  const primitives: Primitive3DItem[] = [
    // Heavy Steel Press Bed
    {
      id: 'hyd-base',
      type: 'rounded_box',
      position: [0, -1.25, 0],
      args: [4.6, 0.22, 2.3, 4, 0.05],
      color: '#1E293B',
      metalness: 0.75,
      roughness: 0.28,
      partId: 'frame',
      label: 'Po‘lat press stendi',
      explodeOffset: [0, -0.45, 0],
    },

    // Small Input Cylinder (Translucent Borosilicate Glass Barrel)
    {
      id: 'hyd-cyl-small',
      type: 'cylinder',
      position: [-1.25, -0.25, 0],
      args: [0.34, 0.34, 1.65, 32],
      color: '#BAE6FD',
      opacity: 0.3,
      metalness: 0.1,
      roughness: 0.08,
      transmission: 0.7,
      clearcoat: 1,
      partId: 'small_piston',
      explodeOffset: [-0.75, 0, 0.35],
    },
    // Fluid inside Small Cylinder
    {
      id: 'hyd-fluid-small',
      type: 'cylinder',
      position: [-1.25, -1.04 + (p1Y + 0.95) / 2, 0],
      args: [0.3, 0.3, Math.max(0.25, p1Y + 0.95), 28],
      color: '#0EA5E9',
      emissive: '#0284C7',
      emissiveIntensity: 0.22,
      opacity: 0.82,
      metalness: 0.08,
      roughness: 0.12,
      partId: 'fluid',
      explodeOffset: [-0.75, -0.15, 0],
    },
    // Small Piston Head + Chrome Rod + Handle
    {
      id: 'hyd-piston-1',
      type: 'cylinder',
      position: [-1.25, p1Y, 0],
      args: [0.31, 0.31, 0.18, 28],
      color: '#3B82F6',
      metalness: 0.85,
      roughness: 0.18,
      partId: 'small_piston',
      label: `Kichik porshen A₁ (F₁ = ${Math.round(f1)} N)`,
      explodeOffset: [-0.75, 0.65, 0],
    },
    {
      id: 'hyd-rod-1',
      type: 'cylinder',
      position: [-1.25, p1Y + 0.52, 0],
      args: [0.065, 0.065, 0.9, 20],
      color: '#E2E8F0',
      metalness: 0.94,
      roughness: 0.12,
      partId: 'small_piston',
      explodeOffset: [-0.75, 0.85, 0],
    },
    {
      id: 'hyd-handle-1',
      type: 'rounded_box',
      position: [-1.25, p1Y + 0.98, 0],
      args: [0.58, 0.12, 0.2, 3, 0.04],
      color: '#EF4444',
      metalness: 0.45,
      roughness: 0.3,
      partId: 'small_piston',
      explodeOffset: [-0.75, 1.05, 0],
    },

    // Connecting Bottom U-Channel Pipe with Pascal Pressure Flow!
    {
      id: 'hyd-conduit',
      type: 'tube',
      position: [0, 0, 0],
      args: [0.16],
      points: [
        [-1.25, -0.95, 0],
        [-0.4, -0.98, 0],
        [0.85, -0.95, 0],
      ],
      color: '#0284C7',
      emissive: '#0369A1',
      emissiveIntensity: 0.25,
      opacity: 0.78,
      metalness: 0.25,
      roughness: 0.15,
      partId: 'fluid',
      label: 'Paskal bosim kanali (P₁ = P₂)',
      flowType: 'dc',
      flowSpeed: 0.6 + (f1 / 300) * 1.2,
      explodeOffset: [0, -0.25, 0.55],
    },

    // Large Output Cylinder (Translucent Barrel)
    {
      id: 'hyd-cyl-large',
      type: 'cylinder',
      position: [0.85, -0.22, 0],
      args: [largeR, largeR, 1.72, 36],
      color: '#BAE6FD',
      opacity: 0.28,
      metalness: 0.1,
      roughness: 0.08,
      transmission: 0.7,
      clearcoat: 1,
      partId: 'large_piston',
      explodeOffset: [0.75, 0, 0.35],
    },
    // Fluid inside Large Cylinder
    {
      id: 'hyd-fluid-large',
      type: 'cylinder',
      position: [0.85, -1.04 + (p2Y + 0.95) / 2, 0],
      args: [largeR - 0.04, largeR - 0.04, Math.max(0.3, p2Y + 0.95), 32],
      color: '#0EA5E9',
      emissive: '#0284C7',
      emissiveIntensity: 0.22,
      opacity: 0.82,
      metalness: 0.08,
      roughness: 0.12,
      partId: 'fluid',
      explodeOffset: [0.75, -0.15, 0],
    },
    // Large Output Piston + Heavy Gold Load Block!
    {
      id: 'hyd-piston-2',
      type: 'cylinder',
      position: [0.85, p2Y, 0],
      args: [largeR - 0.03, largeR - 0.03, 0.22, 32],
      color: '#10B981',
      metalness: 0.82,
      roughness: 0.2,
      partId: 'large_piston',
      label: `Katta porshen A₂ (F₂ = ${f2} N)`,
      explodeOffset: [0.75, 0.55, 0],
    },
    {
      id: 'hyd-load-block',
      type: 'rounded_box',
      position: [0.85, p2Y + 0.48, 0],
      args: [largeR * 1.35, 0.68, largeR * 1.25, 4, 0.06],
      color: '#F59E0B',
      metalness: 0.86,
      roughness: 0.22,
      clearcoat: 0.5,
      partId: 'load',
      label: `Ko‘tarilayotgan yuk (${f2} N)`,
      explodeOffset: [0.75, 1.05, 0],
    },

    // Center 3D Pressure Manometer
    {
      id: 'hyd-manometer',
      type: 'dial_gauge',
      position: [-0.25, -0.42, 0.42],
      args: [0.34, 0.1, gaugeNorm],
      color: '#38BDF8',
      metalness: 0.85,
      roughness: 0.2,
      partId: 'manometer',
      label: 'Gidravlik manometr',
      explodeOffset: [0, 0.35, 0.85],
    },
  ];

  return {
    key: 'hydraulics',
    titleUz: 'Gidravlik Press va Paskal Qonuni (3D PBR)',
    subtitleUz: `F₁ = ${Math.round(f1)} N · A₂/A₁ = ${ratio}x → F₂ = ${f2} N`,
    primitives,
    partOrder: [
      { partId: 'small_piston', label: 'Kichik porshen (F₁)' },
      { partId: 'fluid', label: 'Siqilmas suyuqlik (P)' },
      { partId: 'manometer', label: 'Bosim manometri' },
      { partId: 'large_piston', label: 'Katta porshen (F₂)' },
      { partId: 'load', label: 'Og‘ir yuk bloki' },
    ],
    defaultCamera: [0.3, 1.35, 5.1],
  };
}

/**
 * 5. INTERNAL COMBUSTION / PISTON ENGINE — 4-Stroke Cutaway Cylinder,
 * Oscillating Aluminum Piston, Crankshaft Counterweights, Flywheel Gear & Spark Plug!
 */
export function buildEngine3D(sliders: Record<string, number> = {}): MachineAssemblyResult {
  const rpm = sliders.rpm ?? sliders.speed ?? 1800;
  const speed = clamp(rpm / 600, 0.6, 5.5);

  const primitives: Primitive3DItem[] = [
    {
      id: 'eng-base',
      type: 'rounded_box',
      position: [0, -1.35, 0],
      args: [3.6, 0.2, 2.4, 4, 0.05],
      color: '#1E293B',
      metalness: 0.72,
      roughness: 0.3,
      partId: 'crankcase',
      explodeOffset: [0, -0.5, 0],
    },
    // Cutaway Cylinder Liner
    {
      id: 'eng-block',
      type: 'cylinder',
      position: [0, 0.22, 0],
      rotation: [0, -0.55, 0],
      args: [0.68, 0.68, 1.55, 32, 0, 0, Math.PI * 1.35],
      color: '#475569',
      metalness: 0.78,
      roughness: 0.28,
      partId: 'cylinder',
      label: 'Silindr bloki (kesim)',
      explodeOffset: [-0.55, 0.1, -0.45],
    },
    // Oscillating Forged Aluminum Piston
    {
      id: 'eng-piston',
      type: 'cylinder',
      position: [0, 0.18, 0],
      args: [0.58, 0.58, 0.48, 32],
      color: '#E2E8F0',
      metalness: 0.9,
      roughness: 0.16,
      partId: 'piston',
      label: 'Harakatlanuvchi porshen',
      animation: 'oscillate_y',
      animationSpeed: speed * 2.2,
      animationAmp: 0.34,
      explodeOffset: [0, 0.45, 0.45],
    },
    // Glowing Combustion Chamber Flash
    {
      id: 'eng-flame',
      type: 'sphere',
      position: [0, 0.72, 0],
      args: [0.36],
      color: '#F97316',
      emissive: '#EA580C',
      emissiveIntensity: 0.65,
      opacity: 0.55,
      partId: 'spark',
      label: 'Yonish kamerasi va svecha',
      animation: 'pulse_scale',
      animationSpeed: speed * 2.2,
      animationAmp: 0.28,
      explodeOffset: [0, 0.85, 0],
    },
    // Cylinder Head + Spark Plug + Intake/Exhaust Manifolds
    {
      id: 'eng-head',
      type: 'rounded_box',
      position: [0, 1.12, 0],
      args: [1.5, 0.28, 1.4, 3, 0.04],
      color: '#64748B',
      metalness: 0.75,
      roughness: 0.28,
      partId: 'spark',
      explodeOffset: [0, 1.05, 0],
    },
    {
      id: 'eng-sparkplug',
      type: 'cylinder',
      position: [0, 1.42, 0],
      args: [0.08, 0.1, 0.38, 16],
      color: '#F8FAFC',
      metalness: 0.3,
      roughness: 0.2,
      partId: 'spark',
      explodeOffset: [0, 1.35, 0],
    },
    {
      id: 'eng-intake',
      type: 'tube',
      position: [0, 0, 0],
      args: [0.11],
      points: [
        [-1.35, 1.25, 0.15],
        [-0.65, 1.12, 0.15],
      ],
      color: '#38BDF8',
      metalness: 0.5,
      roughness: 0.25,
      partId: 'valves',
      label: 'Kiritish va chiqarish klapanlari',
      flowType: 'dc',
      flowSpeed: 1.4,
      explodeOffset: [-0.65, 0.75, 0.2],
    },
    {
      id: 'eng-exhaust',
      type: 'tube',
      position: [0, 0, 0],
      args: [0.11],
      points: [
        [0.65, 1.12, -0.15],
        [1.4, 1.28, -0.15],
      ],
      color: '#EF4444',
      metalness: 0.55,
      roughness: 0.28,
      partId: 'valves',
      flowType: 'dc',
      flowSpeed: 1.6,
      explodeOffset: [0.65, 0.75, -0.2],
    },
    // Spinning Crankshaft + Toothed Flywheel Gear!
    {
      id: 'eng-crank',
      type: 'cylinder',
      position: [0, -0.78, 0],
      rotation: [0, 0, Math.PI / 2],
      args: [0.12, 0.12, 2.2, 24],
      color: '#94A3B8',
      metalness: 0.92,
      roughness: 0.16,
      partId: 'crankshaft',
      label: 'Tirsakli val va maxovik',
      animation: 'spin',
      animationAxis: 'x',
      animationSpeed: speed * 2.2,
      explodeOffset: [0, -0.35, 0.35],
    },
    {
      id: 'eng-flywheel',
      type: 'gear',
      position: [1.05, -0.78, 0],
      rotation: [0, Math.PI / 2, 0],
      args: [0.58, 0.14, 24, 0.12],
      color: '#F59E0B',
      metalness: 0.85,
      roughness: 0.22,
      partId: 'crankshaft',
      animation: 'spin',
      animationAxis: 'x',
      animationSpeed: speed * 2.2,
      explodeOffset: [0.85, -0.35, 0],
    },
  ];

  return {
    key: 'engine',
    titleUz: 'Ichki Yonuv Dvigateli (4-Taktli 3D Kesim)',
    subtitleUz: `Aylanish tezligi: ~${Math.round(rpm)} ayl/daq`,
    primitives,
    partOrder: [
      { partId: 'valves', label: 'Havo-yoqilg‘i kiritish' },
      { partId: 'piston', label: 'Siqish porsheni' },
      { partId: 'spark', label: 'Yonish kamerasi' },
      { partId: 'crankshaft', label: 'Tirsakli val va maxovik' },
    ],
    defaultCamera: [3.4, 1.8, 4.4],
  };
}

/**
 * 6. ELECTRIC MOTOR / GENERATOR — Cutaway Stator, Permanent Magnets (N/S),
 * Spinning Copper Armature Coil, Commutator & Cooling Impeller!
 */
export function buildMotor3D(sliders: Record<string, number> = {}): MachineAssemblyResult {
  const voltage = sliders.voltage ?? sliders.u1 ?? 24;
  const speed = clamp(voltage / 8, 0.5, 6);

  const primitives: Primitive3DItem[] = [
    {
      id: 'mot-base',
      type: 'rounded_box',
      position: [0, -1.05, 0],
      args: [3.8, 0.18, 2.2, 4, 0.05],
      color: '#1E293B',
      metalness: 0.7,
      roughness: 0.3,
      partId: 'housing',
      explodeOffset: [0, -0.45, 0],
    },
    // Cutaway Ribbed Stator Housing
    {
      id: 'mot-housing',
      type: 'cylinder',
      position: [0, -0.05, 0],
      rotation: [0.35, 0, Math.PI / 2],
      args: [0.82, 0.82, 2.1, 32, 0, 0, Math.PI * 1.38],
      color: '#334155',
      metalness: 0.72,
      roughness: 0.3,
      partId: 'housing',
      label: 'Stator korpusi (kesim)',
      explodeOffset: [0, 0.55, -0.45],
    },
    // North & South Stator Poles
    {
      id: 'mot-pole-n',
      type: 'box',
      position: [0, 0.56, 0],
      args: [1.35, 0.22, 0.58],
      color: '#EF4444',
      metalness: 0.55,
      roughness: 0.3,
      partId: 'magnets',
      label: 'Magnit qutblari (N / S)',
      explodeOffset: [0, 0.75, 0],
    },
    {
      id: 'mot-pole-s',
      type: 'box',
      position: [0, -0.66, 0],
      args: [1.35, 0.22, 0.58],
      color: '#3B82F6',
      metalness: 0.55,
      roughness: 0.3,
      partId: 'magnets',
      explodeOffset: [0, -0.35, 0.35],
    },
    // Rotor Shaft
    {
      id: 'mot-shaft',
      type: 'cylinder',
      position: [0.15, -0.05, 0],
      rotation: [0, 0, Math.PI / 2],
      args: [0.09, 0.09, 3.2, 24],
      color: '#E2E8F0',
      metalness: 0.94,
      roughness: 0.14,
      partId: 'rotor',
      animation: 'spin',
      animationAxis: 'x',
      animationSpeed: speed,
      explodeOffset: [0.45, 0, 0],
    },
    // Spinning Copper Rotor Winding
    {
      id: 'mot-rotor-coil',
      type: 'helical_coil',
      position: [0, -0.05, 0],
      rotation: [0, 0, Math.PI / 2],
      args: [0.38, 1.25, 10, 0.042],
      color: '#F97316',
      emissive: '#EA580C',
      emissiveIntensity: 0.25,
      metalness: 0.88,
      roughness: 0.18,
      partId: 'rotor',
      label: 'Aylanuvchi mis yakor (rotor)',
      animation: 'spin',
      animationAxis: 'x',
      animationSpeed: speed,
      explodeOffset: [0, 0, 0.65],
    },
    // Output Drive Gear + Rear Cooling Fan
    {
      id: 'mot-gear',
      type: 'gear',
      position: [1.55, -0.05, 0],
      rotation: [0, Math.PI / 2, 0],
      args: [0.36, 0.12, 14, 0.09],
      color: '#FBBF24',
      metalness: 0.88,
      roughness: 0.2,
      partId: 'commutator',
      label: 'Chiqish tishli uzatmasi',
      animation: 'spin',
      animationAxis: 'x',
      animationSpeed: speed,
      explodeOffset: [1.05, 0, 0],
    },
    {
      id: 'mot-fan',
      type: 'turbine_runner',
      position: [-1.18, -0.05, 0],
      rotation: [0, 0, Math.PI / 2],
      args: [0.52, 0.16, 7, 0.4],
      color: '#38BDF8',
      metalness: 0.6,
      roughness: 0.25,
      partId: 'commutator',
      animation: 'spin',
      animationAxis: 'x',
      animationSpeed: speed,
      explodeOffset: [-0.95, 0, 0],
    },
  ];

  return {
    key: 'motor',
    titleUz: 'Elektrodvigatel / Generator (3D Kesim)',
    subtitleUz: `Kuchlanish: ${Math.round(voltage)} V`,
    primitives,
    partOrder: [
      { partId: 'housing', label: 'Stator korpusi' },
      { partId: 'magnets', label: 'Magnit qutblari (N/S)' },
      { partId: 'rotor', label: 'Mis yakor chulg‘ami' },
      { partId: 'commutator', label: 'Val va tishli uzatma' },
    ],
    defaultCamera: [2.9, 1.8, 4.4],
  };
}

/**
 * Detect which rich 3D assembly matches a topic/object name, or synthesize a multi-part 3D rig.
 */
export function resolveMachine3DAssembly(
  queryOrKey: string,
  sliders: Record<string, number> = {}
): MachineAssemblyResult {
  const q = (queryOrKey || '').toLowerCase();

  if (
    q === 'gaes' ||
    q.includes('gaes') ||
    q.includes('gidroakkum') ||
    q.includes('ges') ||
    q.includes('hydro') ||
    q.includes('gidrostansiya') ||
    q.includes('gidroturbina')
  ) {
    return buildGaes3D(sliders);
  }

  if (q === 'transformer' || q.includes('transformator') || q.includes('induksiya') || q.includes('chulg')) {
    return buildTransformer3D(sliders);
  }

  if (q === 'turbine' || q.includes('shamol') || q.includes('wind') || q.includes('bets') || q.includes('parrak')) {
    return buildWindTurbine3D(sliders);
  }

  if (q === 'hydraulics' || q.includes('gidravlik') || q.includes('paskal') || q.includes('hydraulic') || q.includes('porshenli press')) {
    return buildHydraulics3D(sliders);
  }

  if (q === 'engine' || q.includes('dvigatel') || q.includes('ichki yonuv') || q.includes('dizel') || q.includes('motor piston')) {
    return buildEngine3D(sliders);
  }

  return buildMotor3D(sliders);
}
