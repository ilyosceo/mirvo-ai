import { registerSW } from 'virtual:pwa-register';
import {
  extractObjectIntent,
  generateProceduralObjectSvg,
  generateProceduralPrimitives3D,
} from './objectCatalog.js';
import type { TutorLesson } from '../types/tutor.js';

let swRegistered = false;

export function registerMirvoServiceWorker(): void {
  if (swRegistered || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  swRegistered = true;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true);
    },
    onOfflineReady() {
      void warmOfflinePrimitivesCache();
    },
  });

  if (navigator.onLine) {
    void warmOfflinePrimitivesCache();
  }
}

async function warmOfflinePrimitivesCache(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await window.caches.open('mirvo-3d-primitives-v1');
    const existing = await cache.match('/offline-3d-primitives.json');
    if (!existing) {
      const res = await fetch('/offline-3d-primitives.json');
      if (res.ok) {
        await cache.put('/offline-3d-primitives.json', res);
      }
    }
  } catch {
    // Best-effort offline cache warming
  }
}

export function buildOfflineObjectLesson(
  query: string,
  requestedSteps = 4
): TutorLesson | null {
  const clean = query.trim();
  if (!clean) return null;

  const intent = extractObjectIntent(clean);
  if (!intent.known_in_dict && !intent.is_3d && !intent.is_explicit_draw) {
    return null;
  }

  const primitives = generateProceduralPrimitives3D(intent.name_en);
  const svgObj = generateProceduralObjectSvg(intent.name_en, intent.name_uz);

  if (!primitives && !svgObj) {
    return null;
  }

  const use3D = Boolean(primitives && (intent.is_3d || !svgObj));
  const targetSteps = Math.max(4, Math.min(12, Math.round(requestedSteps || 4)));
  const capUz = intent.name_uz.charAt(0).toUpperCase() + intent.name_uz.slice(1);
  const lowerObj = `${intent.name_en} ${intent.name_uz}`.toLowerCase();

  const flowType = /\b(transformer|generator|motor|turbine|solenoid|capacitor|rlc)\b/.test(lowerObj)
    ? ('ac' as const)
    : /\b(solar|battery|circuit|lamp|bulb|pump|fan|wind)\b/.test(lowerObj)
    ? ('dc' as const)
    : /\b(engine|hydraulic|press|prism|heart)\b/.test(lowerObj)
    ? ('pulse' as const)
    : ('none' as const);

  const partsList =
    svgObj?.parts_uz?.map((p, idx) => ({
      label: p.label,
      partId: p.partId || `part_${idx}`,
      desc:
        p.desc ||
        `${p.label} — ${intent.name_uz} tizimining asosiy tarkibiy qismlaridan biri.`,
    })) || [
      {
        label: 'Asosiy korpus va tayanch',
        partId: 'part_0',
        desc: `${capUz} ning asosiy tashqi va konstruktiv qismi.`,
      },
      {
        label: 'Ishchi qism',
        partId: 'part_1',
        desc: `Energiya yoki kuch uzatilishini ta’minlovchi asosiy mexanizm.`,
      },
      {
        label: 'Chiqish va boshqaruv tuguni',
        partId: 'part_2',
        desc: `Tizimning natijaviy ishini shakllantiruvchi qism.`,
      },
    ];

  const baseRenderParams = {
    kind: use3D ? undefined : ('illustration' as const),
    shape: use3D ? ('composite3d' as const) : undefined,
    object_name_en: intent.name_en,
    object_name_uz: intent.name_uz,
    primitives_3d: primitives,
    svg_data: svgObj?.svg_data,
    svg_viewbox: svgObj?.viewBox,
    object_parts: partsList.map((p) => ({ label: p.label, partId: p.partId })),
    show_axes: use3D,
    flowType,
    flowSpeed: flowType === 'none' ? 1.0 : 1.25,
  };

  const steps: TutorLesson['steps'] = [];

  // Step 1: Full overview
  steps.push({
    step_number: 1,
    step_title: `1. ${capUz} — umumiy ko‘rinish`,
    board_title: capUz,
    explanation_uz: `${capUz} tuzilishi va umumiy ishlash chizmasi (${partsList.length} ta asosiy qism).`,
    speech_text: `Keling, avval ${capUz} ning umumiy ko‘rinishi va asosiy qismlari bilan tanishamiz.`,
    katex_formulas: [`\\text{Mavzu: } \\mathbf{${capUz}}`],
    emoji_emotion: 'explaining',
    cameraZoom: 1.0,
    dimInactiveParts: false,
    flowType,
    flowSpeed: 1.15,
    render_params: { ...baseRenderParams },
    beats: [
      {
        sentence: `Keling, ${capUz} ning umumiy tuzilishini 1.0x ko‘rinishda ko‘rib chiqamiz.`,
        focus_target: 'overview',
        tutor_pose: 'approach',
        camera_zoom: 1.0,
        dimInactiveParts: false,
        flowType,
        flowSpeed: 1.15,
        note: 'Umumiy ko‘rinish',
      },
    ],
    open_question: {
      question: `${capUz} nima uchun qo‘llaniladi va umumiy chizmada qaysi asosiy qismlarni ko‘ryapsiz?`,
      expected_points: `${capUz} vazifasi hamda ${partsList.map((p) => p.label).join(', ')} qismlari.`,
      hint_uz: `Chizmadagi asosiy qismlarning nomini va umumiy vazifasini qisqacha yozing.`,
    },
    camera: use3D ? [0.2, 4.2, 11.5] : undefined,
  });

  // Middle steps: part-by-part focus
  for (let i = 1; i < targetSteps - 1; i++) {
    const part = partsList[(i - 1) % partsList.length];
    const stepNum = i + 1;
    const isEven = i % 2 === 0;
    const zoom = 1.72 + ((i % 3) * 0.08);
    const speech = `E'tiboringizni aynan "${part.label}" qismiga qarating! Ichida nima harakatlanadi: ${part.desc}`;
    steps.push({
      step_number: stepNum,
      step_title: `${stepNum}. ${part.label}`,
      board_title: part.label,
      explanation_uz: part.desc,
      speech_text: speech,
      katex_formulas: [`\\text{${stepNum}-bosqich: } \\mathbf{${part.label}}`],
      emoji_emotion: isEven ? 'thinking' : 'pointing',
      focusPart: part.partId,
      cameraZoom: zoom,
      dimInactiveParts: true,
      flowType,
      flowSpeed: 1.25,
      flowReverse: isEven && flowType === 'ac',
      render_params: {
        ...baseRenderParams,
        highlight: ['parts'],
        flowReverse: isEven && flowType === 'ac',
      },
      beats: [
        {
          sentence: speech,
          focus_target: part.partId,
          focusPart: part.partId,
          tutor_pose: 'approach',
          camera_zoom: zoom,
          dimInactiveParts: true,
          flowType,
          flowSpeed: 1.25,
          flowReverse: isEven && flowType === 'ac',
          note: `Fokus: ${part.label}`,
        },
      ],
      open_question: {
        question: `${capUz} tarkibidagi "${part.label}" qismi qanday vazifani bajaradi?`,
        expected_points: part.desc,
        hint_uz: `${part.label} qismining jarayondagi rolini 1-2 gapda yozing.`,
      },
      camera: use3D ? [0.2, 4.2, 11.5] : undefined,
    });
  }

  // Final step: Synthesis & full-scale check
  const lastStepNum = steps.length + 1;
  steps.push({
    step_number: lastStepNum,
    step_title: `${lastStepNum}. Umumiy xulosa va tizimli ishlash`,
    board_title: `${capUz} — yakun`,
    explanation_uz: `Barcha qismlarning birgalikdagi ishlashi va energiya/jarayon almashinuvi.`,
    speech_text: `Endi barcha qismlarni 1.0x ko‘rinishda birlashtirib, ${capUz} tizimining umumiy ishlashini yakunlaymiz.`,
    katex_formulas: [`\\text{Yakun: } \\mathbf{${capUz}}`],
    emoji_emotion: 'encouraging',
    cameraZoom: 1.0,
    dimInactiveParts: false,
    flowType,
    flowSpeed: 1.2,
    render_params: { ...baseRenderParams },
    beats: [
      {
        sentence: `Barcha tarkibiy qismlar birgalikda ${capUz} ning uzluksiz ishlashini ta’minlaydi.`,
        focus_target: 'overview',
        tutor_pose: 'step_back',
        camera_zoom: 1.0,
        dimInactiveParts: false,
        flowType,
        flowSpeed: 1.2,
        note: 'Yakuniy ko‘rinish',
      },
    ],
    open_question: {
      question: `${capUz} qismlari o‘zaro bog‘lanib qanday yakuniy natija hosil qiladi?`,
      expected_points: `${partsList.map((p) => p.label).join(', ')} qismlarining birgalikdagi ishlashi.`,
      hint_uz: `Kirishdan chiqishgacha bo‘lgan asosiy jarayonni o‘z so‘zingiz bilan tushuntiring.`,
    },
    camera: use3D ? [0.2, 4.2, 11.5] : undefined,
  });

  return {
    id: `offline-${intent.name_en.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    topic_title: `${capUz} — interaktiv ${targetSteps} bosqichli dars`,
    subject: intent.is_botanical ? 'biology' : 'physics',
    engine: use3D ? 'threejs' : 'svg2d',
    source: 'cache',
    sliders: use3D
      ? [
          {
            id: 'scale',
            label: 'Masshtab',
            min: 0.6,
            max: 1.6,
            step: 0.05,
            default: 1.0,
          },
        ]
      : [],
    steps,
  };
}

