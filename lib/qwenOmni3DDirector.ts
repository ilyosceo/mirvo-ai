import type {
  EmojiEmotion,
  FlowType,
  LessonStep,
  PartAnimationType,
  Primitive3DItem,
  SliderDef,
  SubjectType,
  TokenUsageInfo,
  TutorLesson,
} from '../types/tutor.js';
import { resolveMachine3DAssembly } from './machine3DCatalog.js';
import { usageFromDashScope, type DashScopeUsageLike } from './tokenUsage.js';

export const DEFAULT_QWEN_OMNI_MODELS = [
  'qwen3.8-omni-flash',
  'qwen3-omni-flash',
  'qwen-plus',
] as const;

const DASHSCOPE_ENDPOINTS = [
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  'https://dashscope.aliyuncs.com/compatible-mode/v1',
];

const VALID_3D_TYPES = new Set<Primitive3DItem['type']>([
  'box',
  'rounded_box',
  'cylinder',
  'capsule',
  'sphere',
  'cone',
  'torus',
  'ring',
  'octahedron',
  'dodecahedron',
  'tube',
  'lathe',
  'gear',
  'coil',
  'helical_coil',
  'turbine_runner',
  'impeller',
  'dial_gauge',
]);

const VALID_ANIMATIONS = new Set<PartAnimationType>([
  'none',
  'spin',
  'spin_reverse',
  'oscillate_y',
  'oscillate_x',
  'pulse_scale',
  'orbit',
]);

const VALID_EMOTIONS = new Set<EmojiEmotion>([
  'explaining',
  'thinking',
  'happy',
  'surprised',
  'pointing',
  'encouraging',
]);

function extractCleanJson(raw: string): Record<string, any> | null {
  const text = (raw || '').trim();
  if (!text) return null;

  const tryParse = (candidate: string) => {
    const cleaned = candidate.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(cleaned);
  };

  try {
    return tryParse(text);
  } catch {}

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return tryParse(fenced[1].trim());
    } catch {}
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return tryParse(text.slice(start, end + 1));
    } catch {}
  }
  return null;
}

function toVec3(val: unknown, fallback: [number, number, number] = [0, 0, 0]): [number, number, number] {
  if (Array.isArray(val) && val.length >= 3) {
    const x = Number(val[0]);
    const y = Number(val[1]);
    const z = Number(val[2]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      return [
        Math.max(-4.5, Math.min(4.5, x)),
        Math.max(-3.5, Math.min(3.5, y)),
        Math.max(-4.5, Math.min(4.5, z)),
      ];
    }
  }
  return fallback;
}

function sanitizePrimitive3D(raw: any, idx: number): Primitive3DItem {
  const rawType = String(raw?.type || 'rounded_box').toLowerCase() as Primitive3DItem['type'];
  const type: Primitive3DItem['type'] = VALID_3D_TYPES.has(rawType) ? rawType : 'rounded_box';
  const args = Array.isArray(raw?.args)
    ? raw.args.map((n: unknown) => (Number.isFinite(Number(n)) ? Number(n) : 0.5))
    : [0.6, 0.6, 0.6];

  const points = Array.isArray(raw?.points)
    ? raw.points
        .filter((p: unknown) => Array.isArray(p) && p.length >= 3)
        .map((p: number[]) => toVec3(p))
    : undefined;

  const animRaw = String(raw?.animation || 'none') as PartAnimationType;
  const animation: PartAnimationType = VALID_ANIMATIONS.has(animRaw) ? animRaw : 'none';

  const flowRaw = String(raw?.flowType || 'none') as FlowType;
  const flowType: FlowType =
    flowRaw === 'dc' || flowRaw === 'ac' || flowRaw === 'pulse' ? flowRaw : 'none';

  const axisRaw = String(raw?.animationAxis || 'y');
  const animationAxis: 'x' | 'y' | 'z' =
    axisRaw === 'x' || axisRaw === 'z' ? axisRaw : 'y';

  return {
    id: String(raw?.id || `part-mesh-${idx}`),
    type,
    position: toVec3(raw?.position, [0, 0, 0]),
    rotation: raw?.rotation ? toVec3(raw.rotation, [0, 0, 0]) : undefined,
    args,
    points: points && points.length >= 2 ? points : undefined,
    color:
      typeof raw?.color === 'string' && raw.color.trim().startsWith('#')
        ? raw.color.trim()
        : '#3B82F6',
    emissive:
      typeof raw?.emissive === 'string' && raw.emissive.trim().startsWith('#')
        ? raw.emissive.trim()
        : undefined,
    emissiveIntensity:
      typeof raw?.emissiveIntensity === 'number' ? raw.emissiveIntensity : undefined,
    opacity:
      typeof raw?.opacity === 'number'
        ? Math.max(0.18, Math.min(1, raw.opacity))
        : 1,
    metalness:
      typeof raw?.metalness === 'number'
        ? Math.max(0, Math.min(1, raw.metalness))
        : 0.62,
    roughness:
      typeof raw?.roughness === 'number'
        ? Math.max(0.08, Math.min(0.95, raw.roughness))
        : 0.28,
    transmission:
      typeof raw?.transmission === 'number'
        ? Math.max(0, Math.min(0.85, raw.transmission))
        : undefined,
    clearcoat:
      typeof raw?.clearcoat === 'number'
        ? Math.max(0, Math.min(1, raw.clearcoat))
        : undefined,
    explodeOffset: Array.isArray(raw?.explodeOffset)
      ? toVec3(raw.explodeOffset, [0, 0.4, 0])
      : undefined,
    partId: String(raw?.partId || `part_${idx + 1}`),
    label: typeof raw?.label === 'string' ? raw.label : undefined,
    flowType,
    flowSpeed: typeof raw?.flowSpeed === 'number' ? raw.flowSpeed : 1.1,
    flowReverse: Boolean(raw?.flowReverse),
    animation,
    animationAxis,
    animationSpeed:
      typeof raw?.animationSpeed === 'number'
        ? Math.max(0.2, Math.min(8, raw.animationSpeed))
        : 2.0,
    animationAmp:
      typeof raw?.animationAmp === 'number'
        ? Math.max(0.05, Math.min(1.2, raw.animationAmp))
        : 0.25,
  };
}

export function buildQwenTrue3DSystemPrompt(stepCount: number): string {
  return `Sen Mirvo AI — O'zbek tilida (Lotin alifbosida) dars beruvchi professional 3D muhandislik va STEM interaktiv doska ustozisan.

QAT'IY TEXNIK QOIDALAR (HAQIQIY WEBGL THREE.JS 3D):
1. TAQIQLANADI: Qurilma, mashina, stansiya, dvigatel, mexanizm, asbob yoki fizik obyektlar uchun tekis 2D <svg>, 2.5D izometrik proyeksiya yoki yassi shakl ISHLATMA! Nazorat savollari (open_question / majburiy sinov) QO'SHMA!
2. TALAB QILINADI: "engine": "threejs" qilib belgilang va Three.js WebGL PerspectiveCamera + OrbitControls + MeshPhysicalMaterial (PBR) + real-time soyalar uchun "assembly_3d" massivida 14 tadan 24 tagacha rangli, hajmli 3D detallardan iborat TO'LIQ MEXANIZM quring!
3. Har bir muhim funktsional qism (masalan: korpus kesimi, rotor/parrak, val, chulg'am, tishli uzatma, quvur va oqim, klapan, porshen, manometr/voltmetr, tayanch platforma) alohida "partId" va o'zbekcha "label" ga ega bo'lsin!
4. Qo'llab-quvvatlanadigan 3D primitiv turlari ("type"):
   - "rounded_box": args=[width, height, depth, segments(3), radius(0.05)] — asos platforma, korpus, bloklar
   - "box": args=[width, height, depth]
   - "cylinder": args=[radiusTop, radiusBottom, height, radialSegments(32), openEnded(0|1), thetaStart(0), thetaLength(6.28)] — eslatma: ichki mexanizm ko'rinishi uchun kesim (cutaway) korpuslarda thetaLength=4.2 ishlating!
   - "sphere": args=[radius] — klapan, rulman, kamera
   - "cone": args=[radius, height, radialSegments(28)]
   - "capsule": args=[radius, length]
   - "torus": args=[radius, tubeRadius] — flanets, halqa
   - "tube": args=[tubeRadius], points=[[x1,y1,z1],[x2,y2,z2],...], flowType="dc"|"ac"|"none", flowSpeed=1.2 — quvurlar, kabellar va ularning ichida oqayotgan 3D suv/elektr zarralari!
   - "gear": args=[outerRadius, thickness, teethCount, holeRadius] — 3D tishli g'ildirak / reduktor!
   - "helical_coil": args=[radius, height, turnsCount, wireRadius] — haqiqiy 3D mis yoki oltin spiral chulg'am / prujina!
   - "turbine_runner": args=[radius, hubHeight, bladeCount, pitchAngle] — 3D gidroturbina / bug' turbinasi / nasos ishchi g'ildiragi!
   - "impeller": args=[radius, hubHeight, bladeCount, pitchAngle] — 3D aerodinamik parraklar / ventilyator!
   - "dial_gauge": args=[radius, depth, normalizedValue0to1] — 3D strelkali manometr / voltmetr / quvvat o'lchagich!
5. Koordinatalar fazosi: X=[-2.6..2.6], Y=[-1.3..1.6], Z=[-1.8..1.8]. Detallar havoda osilib qolmasin — pastda tayanch platforma (Y ≈ -1.2) bo'lsin va qismlar mantiqan bir-biriga ulansin!
6. PBR Materiallar va Harakat:
   - Po'lat/xrom: color="#94A3B8" yoki "#475569", metalness=0.85, roughness=0.22
   - Mis/oltin chulg'am: color="#F97316" yoki "#F59E0B", metalness=0.88, roughness=0.18
   - Suv/shaffof oyna: color="#0EA5E9" yoki "#BAE6FD", opacity=0.35..0.75, transmission=0.6, clearcoat=0.9
   - Harakatlanuvchi qismlarga animation="spin" | "spin_reverse" | "oscillate_y" | "oscillate_x" | "pulse_scale", animationAxis="x"|"y"|"z", animationSpeed=1.5..4.0 bering!
   - Har bir detalga "explodeOffset": [dx, dy, dz] bering ("Qismlarga ajratish" tugmasi bosilganda fazoda chiroyli ochilishi uchun).
7. Dars aynan ${stepCount} ta bosqichdan ("steps") iborat bo'lsin. Har bir bosqichda:
   - "focusPart": aynan o'sha bosqichda tushuntirilayotgan detalning "partId" si (kamera va 3D Emoji Ustoz o'sha detalga yaqinlashadi!)
   - "camera": [x, y, z] — shu qism eng yaxshi ko'rinadigan 3D kamera nuqtasi (masalan [4.2, 2.6, 4.8])
   - "katex_formulas": 1-2 ta aniq LaTeX formula
   - "speech_text": Ustoz ovoz chiqarib o'qiydigan ravon, jonli o'zbekcha nutq (formulalarni harf-belgi emas, tabiiy so'z bilan yozing)
   - "explanation_uz": Ekranda o'qish uchun qisqa va aniq muhandislik tushuntirishi.

FAQAT toza JSON qaytaring (hech qanday markdown izohsiz):
{
  "topic_title": "Qurilma yoki mavzu nomi (O'zbekcha)",
  "subject": "physics",
  "engine": "threejs",
  "sliders": [
    { "id": "load", "label": "Yuklama / Tezlik", "min": 10, "max": 100, "step": 5, "default": 75, "unit": "%" },
    { "id": "pressure", "label": "Bosim / Kuchlanish", "min": 50, "max": 400, "step": 10, "default": 220, "unit": "V" }
  ],
  "assembly_3d": [
    {
      "id": "base-1",
      "type": "rounded_box",
      "position": [0, -1.2, 0],
      "args": [4.6, 0.18, 2.6, 3, 0.05],
      "color": "#1E293B",
      "metalness": 0.72,
      "roughness": 0.3,
      "partId": "foundation",
      "label": "Po'lat asos platformasi",
      "explodeOffset": [0, -0.45, 0]
    }
  ],
  "steps": [
    {
      "step_number": 1,
      "step_title": "1. Umumiy tuzilish va asosiy qismlar",
      "focusPart": "foundation",
      "camera": [4.4, 2.8, 4.8],
      "katex_formulas": ["P = \\\\eta \\\\cdot U \\\\cdot I"],
      "speech_text": "Keling, qurilmaning haqiqiy uch o'lchamli modelini ko'rib chiqamiz...",
      "explanation_uz": "Ushbu 3D modelda barcha asosiy uzellar real metall va shaffof materiallar bilan ko'rsatilgan.",
      "emoji_emotion": "explaining"
    }
  ]
}`;
}

export interface QwenResolveInput {
  apiKey: string;
  query: string;
  stepCount: number;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface QwenResolveOutput {
  lesson: TutorLesson;
  tokenUsage: TokenUsageInfo;
  modelUsed: string;
}

export async function generateQwenOmni3DLesson(
  input: QwenResolveInput
): Promise<QwenResolveOutput | null> {
  const { apiKey, query, stepCount, imageBase64, imageMimeType } = input;
  const nodeEnv = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  const preferredModel = nodeEnv?.QWEN_MODEL?.trim();
  const modelsToTry = preferredModel
    ? [preferredModel, ...DEFAULT_QWEN_OMNI_MODELS.filter((m) => m !== preferredModel)]
    : [...DEFAULT_QWEN_OMNI_MODELS];

  const customBase = nodeEnv?.DASHSCOPE_BASE_URL?.trim();
  const baseUrls = customBase
    ? [customBase.replace(/\/+$/, ''), ...DASHSCOPE_ENDPOINTS]
    : DASHSCOPE_ENDPOINTS;

  const systemPrompt = buildQwenTrue3DSystemPrompt(stepCount);
  const userText = `Mavzu / Qurilma: "${query}". AYNAN ${stepCount} qadamli, har bir detali alohida rangli PBR 3D mesh ("assembly_3d") sifatida qurilgan haqiqiy Three.js 3D dars yarat. Nazorat savollari qo'shma.`;

  const userContent: any = imageBase64
    ? [
        {
          type: 'image_url',
          image_url: {
            url: imageBase64.startsWith('data:')
              ? imageBase64
              : `data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}`,
          },
        },
        { type: 'text', text: userText },
      ]
    : userText;

  for (const baseUrl of baseUrls) {
    for (const modelName of modelsToTry) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 42_000);
      try {
        const isOmniModel = modelName.toLowerCase().includes('omni');
        const requestBody: Record<string, unknown> = {
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          temperature: 0.25,
        };
        if (isOmniModel) {
          requestBody.modalities = ['text'];
        } else {
          requestBody.response_format = { type: 'json_object' };
        }

        const resp = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!resp.ok) {
          const status = resp.status;
          // If unauthorized on intl endpoint, break inner loop to try cn endpoint
          if (status === 401 || status === 403) break;
          continue;
        }

        const data = (await resp.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: DashScopeUsageLike;
          model?: string;
        };
        const rawContent = data.choices?.[0]?.message?.content || '';
        const parsed = extractCleanJson(rawContent);
        if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
          continue;
        }

        const actualModel = data.model || modelName;
        const tokenUsage = usageFromDashScope(data.usage, actualModel);

        // Extract shared assembly_3d or per-step primitives
        const rawSharedAssembly = Array.isArray(parsed.assembly_3d)
          ? parsed.assembly_3d
          : Array.isArray(parsed.primitives_3d)
            ? parsed.primitives_3d
            : [];

        let sharedPrimitives: Primitive3DItem[] = rawSharedAssembly.map(
          (item: any, idx: number) => sanitizePrimitive3D(item, idx)
        );

        // If AI returned fewer than 4 meshes at root, check step 1 or fallback to procedural catalog
        if (sharedPrimitives.length < 4) {
          const step0Objs =
            parsed.steps[0]?.render_params?.primitives_3d ||
            parsed.steps[0]?.visual_data?.objects ||
            [];
          if (Array.isArray(step0Objs) && step0Objs.length >= 4) {
            sharedPrimitives = step0Objs.map((item: any, idx: number) =>
              sanitizePrimitive3D(item, idx)
            );
          } else {
            sharedPrimitives = resolveMachine3DAssembly(query).primitives;
          }
        }

        const sliders: SliderDef[] = Array.isArray(parsed.sliders)
          ? parsed.sliders.slice(0, 4).map((s: any, idx: number) => ({
              id: String(s?.id || `param_${idx + 1}`),
              label: String(s?.label || `Parametr ${idx + 1}`),
              min: Number.isFinite(Number(s?.min)) ? Number(s.min) : 0,
              max: Number.isFinite(Number(s?.max)) ? Number(s.max) : 100,
              step: Number.isFinite(Number(s?.step)) ? Number(s.step) : 5,
              default: Number.isFinite(Number(s?.default)) ? Number(s.default) : 50,
              unit: typeof s?.unit === 'string' ? s.unit : '',
            }))
          : [];

        const topicTitle = String(parsed.topic_title || query);
        const subjectRaw = String(parsed.subject || 'physics') as SubjectType;

        const steps: LessonStep[] = parsed.steps.map((st: any, idx: number) => {
          const stepPrimitivesRaw =
            Array.isArray(st?.primitives_3d) && st.primitives_3d.length >= 4
              ? st.primitives_3d
              : Array.isArray(st?.render_params?.primitives_3d) &&
                  st.render_params.primitives_3d.length >= 4
                ? st.render_params.primitives_3d
                : null;

          const primitivesForStep = stepPrimitivesRaw
            ? stepPrimitivesRaw.map((p: any, pIdx: number) => sanitizePrimitive3D(p, pIdx))
            : sharedPrimitives;

          const emotionRaw = String(st?.emoji_emotion || 'explaining') as EmojiEmotion;
          const emoji_emotion: EmojiEmotion = VALID_EMOTIONS.has(emotionRaw)
            ? emotionRaw
            : 'explaining';

          const fallbackPartId =
            primitivesForStep[idx % primitivesForStep.length]?.partId || undefined;
          const focusPart =
            typeof st?.focusPart === 'string' && st.focusPart.trim()
              ? st.focusPart.trim()
              : fallbackPartId;

          const cam = Array.isArray(st?.camera) && st.camera.length >= 3
            ? toVec3(st.camera, [4.0, 2.5, 4.8])
            : ([4.0, 2.5, 4.8] as [number, number, number]);

          return {
            step_number: Number(st?.step_number) || idx + 1,
            step_title: String(st?.step_title || st?.board_title || `${idx + 1}-qadam`),
            board_title: String(st?.board_title || st?.step_title || `${idx + 1}-qadam`),
            speech_text: String(st?.speech_text || st?.explanation_uz || topicTitle),
            explanation_uz: String(st?.explanation_uz || st?.speech_text || ''),
            katex_formulas: Array.isArray(st?.katex_formulas)
              ? st.katex_formulas.map(String)
              : st?.latex
                ? [String(st.latex)]
                : [],
            emoji_emotion,
            camera: cam,
            focusPart,
            dimInactiveParts: idx > 0 && idx < parsed.steps.length - 1,
            render_params: {
              shape: 'composite3d',
              object_name_uz: topicTitle,
              primitives_3d: primitivesForStep,
            },
          };
        });

        const lesson: TutorLesson = {
          topic_title: topicTitle,
          subject: subjectRaw,
          engine: 'threejs',
          source: 'qwen-omni',
          requested_steps: stepCount,
          token_usage: tokenUsage,
          sliders,
          steps,
        };

        return {
          lesson,
          tokenUsage,
          modelUsed: actualModel,
        };
      } catch {
        clearTimeout(timer);
      }
    }
  }

  return null;
}

const DEVICE_LESSON_IDS = new Set([
  'physics-transformer',
  'wind-turbine-energy',
  'electric-generator-ac',
  'hydraulic-press-pascal',
]);

/**
 * Upgrades built-in or offline device/machine lessons so they render in True 3D WebGL (PBR)
 * and removes blocking control questions ("open_question").
 */
export function upgradeDeviceLessonToTrue3D(
  lesson: TutorLesson,
  queryHint?: string
): TutorLesson {
  // Always strip blocking open_question per user requirement ("nazorat savollari kerak emas")
  const cleanedSteps = lesson.steps.map((s) => {
    const copy = { ...s };
    delete copy.open_question;
    return copy;
  });

  const hint = `${lesson.id || ''} ${lesson.topic_title || ''} ${queryHint || ''}`.toLowerCase();
  const isDeviceLesson =
    (lesson.id && DEVICE_LESSON_IDS.has(lesson.id)) ||
    hint.includes('gaes') ||
    hint.includes('gidroakkum') ||
    hint.includes('transformator') ||
    hint.includes('shamol turbina') ||
    hint.includes('gidravlik') ||
    hint.includes('dvigatel') ||
    hint.includes('generator') ||
    lesson.steps.some((s) => s.render_params?.kind === 'illustration');

  if (!isDeviceLesson) {
    return { ...lesson, steps: cleanedSteps };
  }

  // If it already has >= 6 rich 3D primitives on engine='threejs', just keep it!
  const existingPrims = cleanedSteps[0]?.render_params?.primitives_3d;
  if (lesson.engine === 'threejs' && existingPrims && existingPrims.length >= 8) {
    return { ...lesson, steps: cleanedSteps };
  }

  const assembly = resolveMachine3DAssembly(hint);
  const upgradedSteps = cleanedSteps.map((step, idx) => {
    const partChoice = assembly.partOrder[idx % Math.max(1, assembly.partOrder.length)];
    return {
      ...step,
      focusPart:
        step.focusPart && assembly.primitives.some((p) => p.partId === step.focusPart)
          ? step.focusPart
          : partChoice?.partId,
      camera: step.camera || assembly.defaultCamera,
      render_params: {
        ...step.render_params,
        shape: 'composite3d' as const,
        object_name_uz: lesson.topic_title,
        primitives_3d: assembly.primitives,
      },
    };
  });

  return {
    ...lesson,
    engine: 'threejs',
    steps: upgradedSteps,
  };
}
