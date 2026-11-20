import type {
  EngineType,
  FlowType,
  LessonBeat,
  LessonStep,
  StageAnchorsMap,
  TeacherCue,
  TeacherDepth,
  TutorPose,
} from '../types/tutor.js';

export interface ProjectedTarget {
  xPct: number;
  yPct: number;
  zDepth: number;
}

export interface BeatPlacement {
  actorX: number;
  actorY: number;
  targetX: number;
  targetY: number;
  scale: number;
  tiltDeg: number;
  lookVector: { x: number; y: number };
  showPointer: boolean;
  isNodding: boolean;
  pose: TutorPose;
  depth: TeacherDepth;
  note?: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function splitSentences(raw: string): string[] {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [cleaned];
  if (parts.length <= 3) return parts;
  const mid = Math.ceil(parts.length / 2);
  return [parts[0], parts.slice(1, mid).join(' '), parts.slice(mid).join(' ')].filter(Boolean);
}

function normalizeFlowTypeValue(value: unknown): FlowType | undefined {
  if (value === 'none' || value === 'dc' || value === 'ac' || value === 'pulse') {
    return value;
  }
  return undefined;
}

/**
 * Resolves explicit LLM beats, or builds 2-3 synchronized micro-beats
 * from the step's focusPart, cameraZoom, speech_text, render_params, flowType, and engine.
 */
export function resolveStepBeats(
  step: LessonStep,
  engine: EngineType,
  stepIndex: number,
  totalSteps: number
): LessonBeat[] {
  const p = step.render_params || {};
  const stepFlowType = normalizeFlowTypeValue(step.flowType ?? p.flowType);
  const rawStepSpeed = step.flowSpeed ?? p.flowSpeed;
  const stepFlowSpeed =
    typeof rawStepSpeed === 'number' && Number.isFinite(rawStepSpeed)
      ? clamp(rawStepSpeed, 0.5, 2.5)
      : undefined;
  const rawStepReverse = step.flowReverse ?? p.flowReverse;
  const stepFlowReverse = typeof rawStepReverse === 'boolean' ? rawStepReverse : undefined;

  const applyFlowDefaults = (beats: LessonBeat[]): LessonBeat[] =>
    beats.map((b) => {
      const beatFlowType = normalizeFlowTypeValue(b.flowType) ?? stepFlowType;
      const beatFlowSpeed =
        typeof b.flowSpeed === 'number' && Number.isFinite(b.flowSpeed)
          ? clamp(b.flowSpeed, 0.5, 2.5)
          : stepFlowSpeed;
      const beatFlowReverse =
        typeof b.flowReverse === 'boolean' ? b.flowReverse : stepFlowReverse;
      return {
        ...b,
        ...(beatFlowType ? { flowType: beatFlowType } : {}),
        ...(typeof beatFlowSpeed === 'number' ? { flowSpeed: beatFlowSpeed } : {}),
        ...(typeof beatFlowReverse === 'boolean' ? { flowReverse: beatFlowReverse } : {}),
      };
    });

  const resolvedRawBeats: LessonBeat[] = ((): LessonBeat[] => {
  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= totalSteps - 1;
  const isMicroStep = stepIndex === 1 || stepIndex === 2;
  const stepFocusPart = step.focusPart?.trim() || undefined;
  const stepZoom = step.cameraZoom;
  const stepDim = step.dimInactiveParts ?? isMicroStep;

  if (step.beats && step.beats.length > 0) {
    return step.beats.map((b, bIdx) => {
      if (isFirst) {
        return {
          ...b,
          focusPart: b.focusPart || stepFocusPart,
          cameraZoom: 1.0,
          camera_zoom: 1.0,
          dimInactiveParts: false,
        };
      }
      if (isMicroStep) {
        const microZoom = clamp(
          b.cameraZoom ?? b.camera_zoom ?? stepZoom ?? (stepIndex === 1 ? 1.72 : 1.84),
          1.6,
          1.9
        );
        const resolvedPart = b.focusPart || stepFocusPart;
        const resolvedTarget =
          b.focus_target && b.focus_target !== 'overview' && b.focus_target !== 'drawing_tip'
            ? b.focus_target
            : resolvedPart || 'overview';
        return {
          ...b,
          focusPart: resolvedPart || resolvedTarget,
          focus_target: resolvedTarget,
          tutor_pose: b.tutor_pose === 'step_back' ? 'approach' : b.tutor_pose,
          cameraZoom: b.tutor_pose === 'formula_check' && bIdx > 0 ? 1.64 : microZoom,
          camera_zoom: b.tutor_pose === 'formula_check' && bIdx > 0 ? 1.64 : microZoom,
          dimInactiveParts: b.dimInactiveParts ?? stepDim,
        };
      }
      return {
        ...b,
        focus_target: 'overview',
        cameraZoom: 1.0,
        camera_zoom: 1.0,
        dimInactiveParts: false,
      };
    });
  }

  const sentences = splitSentences(step.speech_text || step.explanation_uz || step.step_title);
  const s1 = sentences[0] || step.explanation_uz || step.step_title;
  const s2 = sentences[1] || step.explanation_uz || s1;
  const s3 = sentences[2];

  // If the step specifies a Macro-to-Micro focusPart on Steps 2-3 (e.g. core, coil_1, coil_2, square_a, leaf_chloroplast)
  if (isMicroStep && stepFocusPart && stepFocusPart !== 'overview') {
    const microZoom = clamp(stepZoom ?? (stepIndex === 1 ? 1.72 : 1.84), 1.6, 1.9);
    return [
      {
        sentence: s1,
        focus_target: stepFocusPart,
        focusPart: stepFocusPart,
        tutor_pose: 'approach',
        camera_zoom: microZoom,
        cameraZoom: microZoom,
        dimInactiveParts: stepDim,
        note: step.step_title,
      },
      {
        sentence: s2,
        focus_target: stepFocusPart,
        focusPart: stepFocusPart,
        tutor_pose: 'approach',
        camera_zoom: microZoom,
        cameraZoom: microZoom,
        dimInactiveParts: stepDim,
        note: 'Ichki detal tahlili',
      },
    ];
  }

  if (engine === 'threejs') {
    if (p.shape === 'composite3d' || p.shape === 'svg_extrude') {
      const part0 = p.object_parts?.[0]?.partId || 'core';
      const part1 = p.object_parts?.[1]?.partId || 'coil_1';
      if (isFirst) {
        return [
          {
            sentence: s1,
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 1.0,
            cameraZoom: 1.0,
            dimInactiveParts: false,
            note: 'Umumiy ko‘rinish',
          },
          {
            sentence: s2,
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 1.0,
            cameraZoom: 1.0,
            dimInactiveParts: false,
            note: 'Tashqi tuzilish',
          },
        ];
      }
      if (isMicroStep) {
        const target = stepIndex === 1 ? part0 : part1;
        const zoom = stepIndex === 1 ? 1.72 : 1.84;
        return [
          {
            sentence: s1,
            focus_target: target,
            focusPart: target,
            tutor_pose: 'approach',
            camera_zoom: zoom,
            cameraZoom: zoom,
            dimInactiveParts: true,
            note: p.object_parts?.[stepIndex - 1]?.label || 'Asosiy detal',
          },
          {
            sentence: s2,
            focus_target: target,
            focusPart: target,
            tutor_pose: 'approach',
            camera_zoom: zoom,
            cameraZoom: zoom,
            dimInactiveParts: true,
            note: 'Yaqindan ko‘rish',
          },
        ];
      }
      return [
        {
          sentence: s1,
          focus_target: 'overview',
          tutor_pose: 'step_back',
          camera_zoom: 1.0,
          cameraZoom: 1.0,
          dimInactiveParts: false,
          note: 'Umumiy ko‘rinishga qaytish',
        },
        {
          sentence: s2,
          focus_target: 'overview',
          tutor_pose: 'step_back',
          camera_zoom: 1.0,
          cameraZoom: 1.0,
          dimInactiveParts: false,
          note: 'Yakuniy tekshiruv',
        },
      ];
    }

    if (p.show_cross_section) {
      return [
        {
          sentence: s1,
          focus_target: isMicroStep ? 'cut_section' : 'overview',
          focusPart: isMicroStep ? 'cut_section' : undefined,
          tutor_pose: isMicroStep ? 'approach' : 'step_back',
          camera_zoom: isMicroStep ? 1.76 : 1.0,
          cameraZoom: isMicroStep ? 1.76 : 1.0,
          dimInactiveParts: isMicroStep,
          note: "Kesim tekisligi a'",
        },
        {
          sentence: s2,
          focus_target: isMicroStep ? 'cut_section' : 'overview',
          focusPart: isMicroStep ? 'cut_section' : undefined,
          tutor_pose: isMicroStep ? 'approach' : 'formula_check',
          camera_zoom: isMicroStep ? 1.76 : 1.0,
          cameraZoom: isMicroStep ? 1.76 : 1.0,
          dimInactiveParts: isMicroStep,
          note: 'Nisbat formulasi',
        },
        ...(s3
          ? [
              {
                sentence: s3,
                focus_target: isMicroStep ? 'cut_section' : 'overview',
                ...(isMicroStep ? { focusPart: 'cut_section' } : {}),
                tutor_pose: 'formula_check' as const,
                camera_zoom: isMicroStep ? 1.65 : 1.0,
                cameraZoom: isMicroStep ? 1.65 : 1.0,
                dimInactiveParts: isMicroStep,
                note: 'Xulosa',
              },
            ]
          : []),
      ];
    }

    if (p.show_apothem) {
      return [
        {
          sentence: s1,
          focus_target: isMicroStep ? 'apothem' : 'overview',
          focusPart: isMicroStep ? 'apothem' : undefined,
          tutor_pose: isMicroStep ? 'approach' : 'step_back',
          camera_zoom: isMicroStep ? 1.74 : 1.0,
          cameraZoom: isMicroStep ? 1.74 : 1.0,
          dimInactiveParts: isMicroStep,
          note: 'Apofema l',
        },
        {
          sentence: s2,
          focus_target: isMicroStep ? 'height_axis' : 'overview',
          focusPart: isMicroStep ? 'height_axis' : undefined,
          tutor_pose: isMicroStep ? 'approach' : step.katex_formulas?.length ? 'formula_check' : 'step_back',
          camera_zoom: isMicroStep ? 1.68 : 1.0,
          cameraZoom: isMicroStep ? 1.68 : 1.0,
          dimInactiveParts: isMicroStep,
          note: 'Pifagor uchburchagi',
        },
      ];
    }

    if (p.show_height) {
      return [
        {
          sentence: s1,
          focus_target: isMicroStep ? 'vertex_S' : 'overview',
          focusPart: isMicroStep ? 'vertex_S' : undefined,
          tutor_pose: isMicroStep ? 'approach' : 'step_back',
          camera_zoom: isMicroStep ? 1.68 : 1.0,
          cameraZoom: isMicroStep ? 1.68 : 1.0,
          dimInactiveParts: isMicroStep,
          note: 'Uchi S',
        },
        {
          sentence: s2,
          focus_target: isMicroStep ? 'height_axis' : 'overview',
          focusPart: isMicroStep ? 'height_axis' : undefined,
          tutor_pose: isMicroStep ? 'approach' : 'step_back',
          camera_zoom: isMicroStep ? 1.68 : 1.0,
          cameraZoom: isMicroStep ? 1.68 : 1.0,
          dimInactiveParts: isMicroStep,
          note: 'Balandlik h',
        },
      ];
    }

    if (p.shape === 'vectors') {
      return [
        {
          sentence: s1,
          focus_target: isMicroStep ? 'vector_A' : 'overview',
          focusPart: isMicroStep ? 'vector_A' : undefined,
          tutor_pose: isMicroStep ? 'approach' : 'step_back',
          camera_zoom: isMicroStep ? 1.68 : 1.0,
          dimInactiveParts: isMicroStep,
          note: 'Vektor A',
        },
        {
          sentence: s2,
          focus_target: isMicroStep ? 'resultant_R' : 'overview',
          focusPart: isMicroStep ? 'resultant_R' : undefined,
          tutor_pose: isMicroStep ? 'approach' : 'step_back',
          camera_zoom: isMicroStep ? 1.68 : 1.0,
          dimInactiveParts: isMicroStep,
          note: 'Natija R = A + B',
        },
      ];
    }

    if (p.shape === 'projectile') {
      return [
        {
          sentence: s1,
          focus_target: isMicroStep ? 'launch_point' : 'overview',
          focusPart: isMicroStep ? 'launch_point' : undefined,
          tutor_pose: isMicroStep ? 'approach' : 'step_back',
          camera_zoom: isMicroStep ? 1.66 : 1.0,
          dimInactiveParts: isMicroStep,
          note: 'Boshlang‘ich burchak',
        },
        {
          sentence: s2,
          focus_target: isMicroStep ? 'peak_height' : 'overview',
          focusPart: isMicroStep ? 'peak_height' : undefined,
          tutor_pose: isMicroStep ? 'approach' : 'step_back',
          camera_zoom: isMicroStep ? 1.66 : 1.0,
          dimInactiveParts: isMicroStep,
          note: 'Maksimal nuqta',
        },
      ];
    }

    if (p.shape === 'quadric' || p.shape === 'parametric') {
      const hasSurface = !p.draw || p.draw.includes('surface');
      const hasEquator = !p.draw || p.draw.includes('equator_ring') || p.draw.includes('traces');
      return [
        {
          sentence: s1,
          focus_target: isFirst || isLast ? 'overview' : hasSurface ? 'equator_ring' : 'axes_origin',
          tutor_pose: isFirst || isLast ? 'step_back' : 'approach',
          camera_zoom: isFirst || isLast ? 1.0 : 1.64,
          note: hasSurface ? 'Asosiy kesim' : 'Koordinata o‘qlari',
        },
        {
          sentence: s2,
          focus_target: isLast || isFirst ? 'overview' : hasEquator ? 'meridian_xz' : 'overview',
          tutor_pose: isLast || isFirst ? 'step_back' : step.katex_formulas?.length ? 'formula_check' : 'approach',
          camera_zoom: isLast || isFirst ? 1.0 : 1.62,
          note: isLast ? 'To‘liq 3D sirt' : 'Fazoviy tahlil',
        },
      ];
    }

    return [
      {
        sentence: s1,
        focus_target: isMicroStep ? 'base_plane' : 'overview',
        focusPart: isMicroStep ? 'base_plane' : undefined,
        tutor_pose: isFirst || isLast ? 'step_back' : 'approach',
        camera_zoom: isMicroStep ? 1.66 : 1.0,
        dimInactiveParts: isMicroStep,
        note: isFirst ? 'To‘liq ko‘rinish' : 'Asosiy detal',
      },
      {
        sentence: s2,
        focus_target: isMicroStep ? 'base_plane' : 'overview',
        focusPart: isMicroStep ? 'base_plane' : undefined,
        tutor_pose: isLast ? 'step_back' : 'approach',
        camera_zoom: isMicroStep ? 1.66 : 1.0,
        dimInactiveParts: isMicroStep,
        note: isLast ? 'Yakuniy ko‘rinish' : 'Asos tekisligi',
      },
    ];
  }

  if (engine === 'svg2d') {
    const hl = p.highlight || [];
    if (hl.includes('squares_ab')) {
      return [
        {
          sentence: s1,
          focus_target: 'square_a',
          focusPart: 'square_a',
          tutor_pose: 'approach',
          camera_zoom: 1.72,
          cameraZoom: 1.72,
          dimInactiveParts: true,
          note: 'Kvadrat a²',
        },
        {
          sentence: s2,
          focus_target: 'square_b',
          focusPart: 'square_b',
          tutor_pose: 'approach',
          camera_zoom: 1.72,
          cameraZoom: 1.72,
          dimInactiveParts: true,
          note: 'Kvadrat b²',
        },
      ];
    }
    if (hl.includes('square_c')) {
      return [
        {
          sentence: s1,
          focus_target: isMicroStep ? 'square_c' : 'overview',
          focusPart: isMicroStep ? 'square_c' : undefined,
          tutor_pose: isMicroStep ? 'approach' : 'step_back',
          camera_zoom: isMicroStep ? 1.76 : 1.0,
          cameraZoom: isMicroStep ? 1.76 : 1.0,
          dimInactiveParts: isMicroStep,
          note: 'Gipotenuza c²',
        },
        {
          sentence: s2,
          focus_target: isMicroStep ? 'square_c' : 'overview',
          focusPart: isMicroStep ? 'square_c' : undefined,
          tutor_pose: isLast ? 'formula_check' : 'approach',
          camera_zoom: isMicroStep ? 1.72 : 1.0,
          cameraZoom: isMicroStep ? 1.72 : 1.0,
          dimInactiveParts: isMicroStep,
          note: 'a² + b² = c²',
        },
      ];
    }
    if (p.kind === 'photosynthesis') {
      const microKey = stepIndex === 1 ? 'water_roots' : stepIndex === 2 ? 'oxygen_out' : 'overview';
      return [
        {
          sentence: s1,
          focus_target: isFirst ? 'drawing_tip' : isMicroStep ? microKey : 'overview',
          focusPart: isMicroStep ? microKey : undefined,
          tutor_pose: isLast ? 'step_back' : 'approach',
          camera_zoom: isMicroStep ? 1.7 : 1.0,
          dimInactiveParts: isMicroStep,
          note: isFirst ? 'Quyosh va barg' : stepIndex === 1 ? 'Suv va CO₂' : 'Kislorod O₂',
        },
        {
          sentence: s2,
          focus_target: isFirst ? 'drawing_tip' : isMicroStep ? microKey : 'overview',
          focusPart: isMicroStep ? microKey : undefined,
          tutor_pose: isLast ? 'step_back' : 'approach',
          camera_zoom: isMicroStep ? 1.7 : 1.0,
          dimInactiveParts: isMicroStep,
          note: isLast ? 'Umumiy sikl' : 'Chizish davomi',
        },
      ];
    }

    if (p.kind === 'sky_scattering') {
      const microKey = stepIndex === 1 ? 'blue_scatter' : stepIndex === 2 ? 'red_pass' : 'overview';
      return [
        {
          sentence: s1,
          focus_target: isFirst ? 'drawing_tip' : isMicroStep ? microKey : 'overview',
          focusPart: isMicroStep ? microKey : undefined,
          tutor_pose: isLast ? 'step_back' : 'approach',
          camera_zoom: isMicroStep ? 1.7 : 1.0,
          dimInactiveParts: isMicroStep,
          note: isFirst ? 'Yorug‘lik nuri' : stepIndex === 1 ? 'Ko‘k to‘lqinlar' : 'Qizil to‘lqin',
        },
        {
          sentence: s2,
          focus_target: isFirst ? 'drawing_tip' : isMicroStep ? microKey : 'overview',
          focusPart: isMicroStep ? microKey : undefined,
          tutor_pose: isLast ? 'step_back' : 'approach',
          camera_zoom: isMicroStep ? 1.7 : 1.0,
          dimInactiveParts: isMicroStep,
          note: isLast ? 'Moviy osmon' : 'To‘lqin sochilishi',
        },
      ];
    }

    if (p.kind === 'polygon') {
      const microKey = stepIndex === 1 ? 'interior_angle' : stepIndex === 2 ? 'diagonals' : 'overview';
      return [
        {
          sentence: s1,
          focus_target: isFirst ? 'drawing_tip' : isMicroStep ? microKey : 'overview',
          focusPart: isMicroStep ? microKey : undefined,
          tutor_pose: isLast ? 'step_back' : 'approach',
          camera_zoom: isMicroStep ? 1.72 : 1.0,
          dimInactiveParts: isMicroStep,
          note: isFirst ? 'Tomonlarni chizamiz' : stepIndex === 1 ? 'Ichki burchaklar' : 'Diagonallar',
        },
        {
          sentence: s2,
          focus_target: isFirst ? 'drawing_tip' : isMicroStep ? microKey : 'overview',
          focusPart: isMicroStep ? microKey : undefined,
          tutor_pose: isLast ? 'step_back' : 'approach',
          camera_zoom: isMicroStep ? 1.72 : 1.0,
          dimInactiveParts: isMicroStep,
          note: isLast ? 'Umumiy shakl' : 'Xossalar',
        },
      ];
    }

    if (p.kind === 'illustration') {
      const part0 = p.object_parts?.[0]?.partId || 'part_0';
      const part1 = p.object_parts?.[1]?.partId || 'part_1';
      if (isFirst) {
        return [
          {
            sentence: s1,
            focus_target: 'drawing_tip',
            tutor_pose: 'approach',
            camera_zoom: 1.0,
            cameraZoom: 1.0,
            dimInactiveParts: false,
            note: 'Chizish',
          },
          {
            sentence: s2,
            focus_target: 'overview',
            tutor_pose: 'step_back',
            camera_zoom: 1.0,
            cameraZoom: 1.0,
            dimInactiveParts: false,
            note: 'Umumiy ko‘rinish',
          },
        ];
      }
      if (isMicroStep) {
        const target = stepIndex === 1 ? part0 : part1;
        const zoom = stepIndex === 1 ? 1.72 : 1.84;
        return [
          {
            sentence: s1,
            focus_target: target,
            focusPart: target,
            tutor_pose: 'approach',
            camera_zoom: zoom,
            cameraZoom: zoom,
            dimInactiveParts: true,
            note: p.object_parts?.[stepIndex - 1]?.label || 'Asosiy detal',
          },
          {
            sentence: s2,
            focus_target: target,
            focusPart: target,
            tutor_pose: 'approach',
            camera_zoom: zoom,
            cameraZoom: zoom,
            dimInactiveParts: true,
            note: 'Detal tahlili',
          },
        ];
      }
      return [
        {
          sentence: s1,
          focus_target: 'overview',
          tutor_pose: 'step_back',
          camera_zoom: 1.0,
          cameraZoom: 1.0,
          dimInactiveParts: false,
          note: 'Umumiy ko‘rinish',
        },
        {
          sentence: s2,
          focus_target: 'overview',
          tutor_pose: 'step_back',
          camera_zoom: 1.0,
          cameraZoom: 1.0,
          dimInactiveParts: false,
          note: 'Tekshiruv',
        },
      ];
    }

    return [
      {
        sentence: s1,
        focus_target: isFirst ? 'drawing_tip' : isMicroStep ? 'radius_r' : 'overview',
        focusPart: isMicroStep ? 'radius_r' : undefined,
        tutor_pose: isLast ? 'step_back' : 'approach',
        camera_zoom: isMicroStep ? 1.68 : 1.0,
        dimInactiveParts: isMicroStep,
        note: 'Chizish',
      },
      {
        sentence: s2,
        focus_target: isLast
          ? 'overview'
          : isMicroStep
          ? p.kind === 'circle' || p.kind === 'unit_circle'
            ? 'angle_alpha'
            : 'triangle_center'
          : 'drawing_tip',
        tutor_pose: isLast ? 'step_back' : 'approach',
        camera_zoom: isMicroStep ? 1.68 : 1.0,
        dimInactiveParts: isMicroStep,
        note: 'Asosiy elementlar',
      },
    ];
  }

  if (engine === 'plotly2d' || engine === 'plotly3d') {
    const hasPoints =
      (p.highlight_points && p.highlight_points.length > 0) ||
      (p.highlights && p.highlights.length > 0);
    if (engine === 'plotly2d') {
      return [
        {
          sentence: s1,
          focus_target: 'drawing_tip',
          tutor_pose: 'approach',
          camera_zoom: 1.05,
          note: isFirst ? 'Nuqtalarni chizamiz' : 'Egri chiziq',
        },
        {
          sentence: s2,
          focus_target: stepIndex === 1 ? 'drawing_tip' : hasPoints ? 'vertex_min' : 'overview',
          tutor_pose: isLast ? 'step_back' : 'approach',
          camera_zoom: 1.0,
          note: stepIndex === 1 ? 'Parabola chizish' : 'Asosiy xossa',
        },
      ];
    }
    return [
      {
        sentence: s1,
        focus_target: 'saddle_point',
        tutor_pose: 'approach',
        camera_zoom: 1.12,
        note: '3D sirt markazi',
      },
      {
        sentence: s2,
        focus_target: p.derivative ? 'derivative_tangent' : 'x_intercept',
        tutor_pose: step.katex_formulas?.length ? 'formula_check' : 'step_back',
        camera_zoom: 1.0,
        note: p.derivative ? 'Urinma va hosila' : 'Formula tekshiruvi',
      },
    ];
  }

  if (engine === 'pdb' || engine === 'pubchem') {
    return [
      {
        sentence: s1,
        focus_target: isFirst ? 'drawing_tip' : 'chain_A',
        tutor_pose: 'approach',
        camera_zoom: isFirst ? 1.0 : 1.62,
        note: engine === 'pdb' ? 'Oqsil strukturasi' : 'Molekula skeleti',
      },
      {
        sentence: s2,
        focus_target: isLast ? 'overview' : engine === 'pdb' ? 'disulfide_bridge' : 'active_ring',
        tutor_pose: isLast ? 'step_back' : 'approach',
        camera_zoom: isLast ? 1.0 : 1.68,
        note: engine === 'pdb' ? 'Kimyoviy bog‘lar' : 'Halqa markazi',
      },
    ];
  }

  return [
    {
      sentence: s1,
      focus_target: isFirst ? 'drawing_tip' : 'overview',
      tutor_pose: isLast ? 'step_back' : 'approach',
      camera_zoom: 1.0,
      note: '1-bosqich',
    },
    {
      sentence: s2,
      focus_target: isLast ? 'overview' : 'drawing_tip',
      tutor_pose: isLast ? 'step_back' : 'approach',
      camera_zoom: 1.0,
      note: isLast ? 'Umumiy sxema' : 'Keyingi bosqich',
    },
  ];
  })();

  return applyFlowDefaults(resolvedRawBeats);
}

/**
 * Computes exact pixel coordinates & pose transforms for the single Qalam Orb Mascot.
 * Places the mentor at 24px open-edge clearance around the zoomed detail's bounding box
 * without covering the active part, and directs the laser/pointer ray onto targetX/targetY.
 */
export function computeBeatPlacement(options: {
  beat: LessonBeat;
  anchors: StageAnchorsMap;
  stageSize: { width: number; height: number };
  isMobileStacked?: boolean;
}): BeatPlacement {
  const { beat, anchors, stageSize, isMobileStacked = false } = options;
  const W = Math.max(240, stageSize.width);
  const H = Math.max(160, stageSize.height);
  const isCompact = W < 520 || H < 320;
  const mentorRadius = isCompact ? 23 : 27;
  const clearancePx = 24;

  const overview = anchors.overview || { x: W * 0.5, y: H * 0.45, width: 120, height: 120 };
  const target =
    (beat.focusPart ? anchors[beat.focusPart] : undefined) ||
    anchors[beat.focus_target] ||
    anchors.drawing_tip ||
    overview;

  const padTargetX = isCompact ? 26 : 36;
  const padTargetTop = isCompact ? 34 : 44;
  const padTargetBottom = isCompact ? 56 : 64;
  const targetX = clamp(target.x, padTargetX, W - padTargetX);
  const targetY = clamp(target.y, padTargetTop, H - padTargetBottom);

  if (beat.tutor_pose === 'step_back') {
    const actorX = W - (isCompact ? 38 : 54);
    const actorY = H - (isCompact ? 76 : 84);
    const dx = targetX - actorX;
    const dy = targetY - actorY;
    const dist = Math.hypot(dx, dy) || 1;
    return {
      actorX,
      actorY,
      targetX,
      targetY,
      scale: isCompact ? 0.84 : 0.88,
      tiltDeg: -3,
      lookVector: { x: (dx / dist) * 2.1, y: (dy / dist) * 1.5 },
      showPointer: false,
      isNodding: false,
      pose: 'step_back',
      depth: 'far',
      note: beat.note,
    };
  }

  if (beat.tutor_pose === 'formula_check') {
    if (isMobileStacked) {
      const actorX = clamp(Math.round(W * 0.78), 64, W - 40);
      const actorY = H - (isCompact ? 76 : 82);
      return {
        actorX,
        actorY,
        targetX: actorX,
        targetY: H - 20,
        scale: isCompact ? 0.94 : 1.0,
        tiltDeg: 3,
        lookVector: { x: -0.5, y: -1.2 },
        showPointer: false,
        isNodding: true,
        pose: 'formula_check',
        depth: 'mid',
        note: beat.note || 'Formula tekshiruvi',
      };
    }

    const actorX = W - 52;
    const actorY = clamp(Math.round(H * 0.34), 84, H - 90);
    return {
      actorX,
      actorY,
      targetX: W - 6,
      targetY: actorY,
      scale: 1.02,
      tiltDeg: 4,
      lookVector: { x: 2.2, y: -0.15 },
      showPointer: false,
      isNodding: true,
      pose: 'formula_check',
      depth: 'mid',
      note: beat.note || 'Formula tekshiruvi',
    };
  }

  const isFollowingTip = beat.focus_target === 'drawing_tip' && !beat.focusPart;
  const edgePadX = isCompact ? 34 : 44;
  const topSafeY = isCompact ? 50 : 64;
  const bottomSafeY = H - (isCompact ? 78 : 86);

  let actorX: number;
  let actorY: number;

  if (isFollowingTip) {
    const sideOffset = isCompact ? 40 : 48;
    const placeOnLeft = targetX > W * 0.52;
    actorX = clamp(placeOnLeft ? targetX - sideOffset : targetX + sideOffset, edgePadX, W - edgePadX);
    actorY = clamp(targetY - (isCompact ? 30 : 36), topSafeY, bottomSafeY);
    if (Math.hypot(actorX - targetX, actorY - targetY) < 38) {
      actorX = clamp(placeOnLeft ? targetX + sideOffset : targetX - sideOffset, edgePadX, W - edgePadX);
    }
  } else {
    // Macro-to-Micro open-edge positioning with 24px strict clearance outside active detail bounding box
    const halfW = clamp((target.width ?? 64) / 2, 18, W * 0.32);
    const halfH = clamp((target.height ?? 64) / 2, 18, H * 0.32);

    const neededX = halfW + clearancePx + mentorRadius;
    const neededY = halfH + clearancePx + mentorRadius;

    const candidates = [
      {
        dir: 'right',
        room: W - edgePadX - (targetX + halfW),
        x: clamp(targetX + neededX, edgePadX, W - edgePadX),
        y: clamp(targetY, topSafeY, bottomSafeY),
      },
      {
        dir: 'left',
        room: targetX - halfW - edgePadX,
        x: clamp(targetX - neededX, edgePadX, W - edgePadX),
        y: clamp(targetY, topSafeY, bottomSafeY),
      },
      {
        dir: 'top',
        room: targetY - halfH - topSafeY,
        x: clamp(targetX, edgePadX, W - edgePadX),
        y: clamp(targetY - neededY, topSafeY, bottomSafeY),
      },
      {
        dir: 'bottom',
        room: bottomSafeY - (targetY + halfH),
        x: clamp(targetX, edgePadX, W - edgePadX),
        y: clamp(targetY + neededY, topSafeY, bottomSafeY),
      },
    ];

    let best = candidates[0];
    let bestScore = -Infinity;

    for (const cand of candidates) {
      // Distance from mentor sphere edge to the detail box boundary
      const overlapX = Math.max(0, halfW + mentorRadius - Math.abs(cand.x - targetX));
      const overlapY = Math.max(0, halfH + mentorRadius - Math.abs(cand.y - targetY));
      const boxOverlapPenalty = overlapX > 0 && overlapY > 0 ? Math.min(overlapX, overlapY) * 12 : 0;

      // Avoid top-right 2D/3D switcher bar and bottom subtitle capsule
      const topRightPenalty = cand.x > W - 150 && cand.y < 68 ? 45 : 0;
      const topLeftPenalty = cand.x < 170 && cand.y < 68 ? 30 : 0;
      const sideBonus = cand.dir === 'right' || cand.dir === 'left' ? 14 : 0;

      const score = cand.room + sideBonus - boxOverlapPenalty - topRightPenalty - topLeftPenalty;
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    actorX = best.x;
    actorY = best.y;
  }

  const dx = targetX - actorX;
  const dy = targetY - actorY;
  const dist = Math.hypot(dx, dy) || 1;

  return {
    actorX,
    actorY,
    targetX,
    targetY,
    scale: isFollowingTip ? 1.0 : isCompact ? 1.02 : 1.08,
    tiltDeg: clamp((dx / 120) * 6, -6, 6),
    lookVector: { x: (dx / dist) * 2.2, y: (dy / dist) * 1.6 },
    showPointer: !isFollowingTip,
    isNodding: false,
    pose: 'approach',
    depth: 'near',
    note: beat.note,
  };
}

/** Backwards-compatible helper used where step cue target label is inspected */
export function resolveTeacherCue(
  step: LessonStep,
  engine: EngineType,
  stepIndex: number,
  totalSteps: number
): TeacherCue {
  if (step.teacher_cue) return step.teacher_cue;
  const beats = resolveStepBeats(step, engine, stepIndex, totalSteps);
  const first = beats[0];
  return {
    zone: first.tutor_pose === 'step_back' ? 'bottom-right' : 'right',
    depth: first.tutor_pose === 'step_back' ? 'far' : 'near',
    motion: first.tutor_pose === 'step_back' ? 'retreat' : 'approach',
    target_label: first.focus_target,
  };
}
