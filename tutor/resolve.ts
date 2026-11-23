import fs from 'fs';
import path from 'path';
import express, { type Request, type Response, type Router } from 'express';
import { ThinkingLevel, Type, type GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { CACHED_LESSONS } from '../data/cachedLessons.js';
import {
  extractObjectIntent,
  generateProceduralObjectSvg,
  generateProceduralPrimitives3D,
  generateZeroTokenFallbackSvg,
  normalizeUzToken,
  sanitizeSvgString,
  shouldTreatAsObjectDrawing,
  type ObjectIntent,
} from '../lib/objectCatalog.js';
import {
  findBuiltInCachedLesson,
  normalizeCacheSearchText,
} from '../lib/lessonMatch.js';
import {
  mergeTokenUsage,
  usageFromGeminiMetadata,
  ZERO_TOKEN_USAGE,
} from '../lib/tokenUsage.js';
import {
  applyRateLimitHeaders,
  checkIpRateLimit,
  sendRateLimitError,
} from '../server/rateLimit.js';
import {
  buildEvaluationSummarySpeech,
  evaluateLessonAnswersLocally,
} from '../lib/lessonEvaluator.js';
import { generateSceneArchitecturePlan } from '../lib/sceneArchitect.js';
import type {
  EvaluateLessonResponse,
  FlowType,
  Primitive3DItem,
  ResolvedObjectPayload,
  StepEvaluationInput,
  StepEvaluationResult,
  TokenUsageInfo,
  TutorLesson,
} from '../types/tutor.js';

// Gemini Flash & Flash-Lite model aliases per @google/genai guidelines
const GEMINI_FLASH_MODEL = 'gemini-4-hydrogen';
const GEMINI_LITE_MODEL = 'gemini-3.1-flash-lite';

export interface CachedVisualObjectEntry {
  id: string;
  name_uz: string;
  name_en: string;
  aliases_uz: string[];
  svg_data: string;
  viewBox: string;
  source: 'iconify' | 'wikimedia' | 'procedural' | 'gemini-svg' | 'poly-pizza' | 'poly-haven' | 'open-gltf';
  mode: '2d' | '3d';
  model_url?: string;
  primitives_3d?: Primitive3DItem[];
  parts_uz?: Array<{ label: string; partId?: string; desc?: string }>;
  createdAt: string;
}

interface DynamicCacheEntry {
  normalizedKey: string;
  query: string;
  lesson: TutorLesson;
  createdAt: string;
}

function sanitizeFlowType(value: unknown): FlowType {
  if (value === 'dc' || value === 'ac' || value === 'pulse' || value === 'none') {
    return value;
  }
  return 'none';
}

function clampFlowSpeedServer(value: unknown, fallback = 1.0): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0.5, Math.min(2.5, Number(num.toFixed(2))));
}

function normalizeQuery(q: string): string {
  return (
    normalizeCacheSearchText(q) ||
    q
      .toLowerCase()
      .replace(/[‘’'`ʻʼ]/g, "'")
      .replace(/[^\p{L}\p{N}\s^+\-*/=().]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export const LESSON_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    topic_title: {
      type: Type.STRING,
      description: "Mavzuning qisqa va tushunarli o'zbekcha nomi",
    },
    subject: {
      type: Type.STRING,
      description: 'math | geometry | physics | chemistry | biology | history | language',
    },
    engine: {
      type: Type.STRING,
      description: 'plotly2d | plotly3d | threejs | pdb | pubchem | mermaid | svg2d',
    },
    sliders: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING },
          min: { type: Type.NUMBER },
          max: { type: Type.NUMBER },
          step: { type: Type.NUMBER },
          default: { type: Type.NUMBER },
          unit: { type: Type.STRING },
        },
        required: ['id', 'label', 'min', 'max', 'step', 'default'],
      },
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step_number: { type: Type.INTEGER },
          step_title: { type: Type.STRING },
          speech_text: { type: Type.STRING },
          katex_formulas: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          explanation_uz: { type: Type.STRING },
          emoji_emotion: {
            type: Type.STRING,
            description: 'explaining | thinking | happy | surprised | pointing | encouraging',
          },
          camera: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
          },
          focusPart: {
            type: Type.STRING,
            description:
              "2- va 3-qadamlarda yaqinlashib ko'rsatiladigan ichki qism IDsi (masalan: core, coil_1, coil_2, filament, nucleus, mitochondria, aorta, ventricles, cylinder, spark, square_a, square_c, height_axis, cut_section)",
          },
          cameraZoom: {
            type: Type.NUMBER,
            description:
              "1.0 (umumiy ko'rinish, 1- va 4-qadamlar) dan 1.6-1.9 (ichki detalga zoom, 2- va 3-qadamlar) gacha kamera yaqinlashuvi (max 2.0)",
          },
          dimInactiveParts: {
            type: Type.BOOLEAN,
            description:
              "Faol focusPart dan tashqari qolgan qismlarni xiralashtirish (opacity: 0.22). 1- va 4-qadamlarda false, 2- va 3-qadamlarda true.",
          },
          flowType: {
            type: Type.STRING,
            description:
              'Dinamik tok va oqim animatsiyasi turi: none | dc | ac | pulse',
          },
          flowSpeed: {
            type: Type.NUMBER,
            description:
              'Oqim animatsiyasi tezligi: 0.5 dan 2.5 gacha (odatda 1.0)',
          },
          flowReverse: {
            type: Type.BOOLEAN,
            description:
              'Oqim yo‘nalishini teskari aylantirish (masalan, ikkilamchi chulg‘am qarama-qarshi fazasi uchun true)',
          },
          beats: {
            type: Type.ARRAY,
            description:
              "Har bir qadam uchun 2-3 ta ketma-ket mikro-qadam: jumla + sahnadagi fokus nuqtasi + ustoz holati + kamera yaqinlashuvi",
            items: {
              type: Type.OBJECT,
              properties: {
                sentence: {
                  type: Type.STRING,
                  description: "Shu mikro-qadamda o'qiladigan bitta tabiiy o'zbekcha gap",
                },
                focus_target: {
                  type: Type.STRING,
                  description:
                    'overview | drawing_tip | core | coil_1 | coil_2 | bulb | filament | base | nucleus | mitochondria | membrane | cylinder | spark | crankshaft | aorta | atria | ventricles | vertex_S | base_plane | cut_section | height_axis | apothem | axes_origin | equator_ring | meridian_xz | vector_A | resultant_R | peak_height | square_a | square_b | square_c | triangle_center | radius_r | vertex_min | x_intercept | saddle_point | chain_A | chain_B | disulfide_bridge | active_ring | node_0 | node_1 | node_last',
                },
                focusPart: {
                  type: Type.STRING,
                  description: "Shu mikro-qadamda yaqinlashtiriladigan qism IDsi (ixtiyoriy)",
                },
                tutor_pose: {
                  type: Type.STRING,
                  description: 'approach | step_back | formula_check',
                },
                camera_zoom: {
                  type: Type.NUMBER,
                  description: '1.0 (umumiy ko‘rinish) dan 1.9 (ichki detalga yaqinlashish) gacha kamera masshtabi',
                },
                dimInactiveParts: {
                  type: Type.BOOLEAN,
                  description: 'Faol detaldan boshqa qismlarni 0.22 shaffoflikka tushirish',
                },
                flowType: {
                  type: Type.STRING,
                  description: 'none | dc | ac | pulse',
                },
                flowSpeed: {
                  type: Type.NUMBER,
                  description: '0.5 dan 2.5 gacha oqim tezligi',
                },
                flowReverse: {
                  type: Type.BOOLEAN,
                  description: 'Oqim yo‘nalishini teskari qilish',
                },
                note: {
                  type: Type.STRING,
                  description: "Qisqa 1-3 so'zli yorliq",
                },
              },
              required: ['sentence', 'focus_target', 'tutor_pose', 'camera_zoom'],
            },
          },
          open_question: {
            type: Type.OBJECT,
            description:
              "Har bir qadam/dars tugaganda o'quvchi o'z so'zi bilan yozma javob beradigan ochiq nazorat savoli (variantlarsiz!)",
            properties: {
              question: {
                type: Type.STRING,
                description: "Shu qadam mazmunini tekshiruvchi aniq o'zbekcha ochiq savol",
              },
              expected_points: {
                type: Type.STRING,
                description: "To'g'ri javobda bo'lishi kerak bo'lgan asosiy tushuncha, qoida yoki formula",
              },
              hint_uz: {
                type: Type.STRING,
                description: "O'quvchi noto'g'ri yozsa ko'rsatiladigan qisqa ishora",
              },
            },
            required: ['question', 'expected_points'],
          },
          quiz: {
            type: Type.OBJECT,
            description: "Ixtiyoriy qo'shimcha ma'lumot (asosiy tekshiruv open_question orqali olinadi)",
            properties: {
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              correct_index: { type: Type.INTEGER },
              explanation_uz: { type: Type.STRING },
            },
            required: ['question', 'options', 'correct_index', 'explanation_uz'],
          },
          render_params: {
            type: Type.OBJECT,
            properties: {
              shape: { type: Type.STRING },
              template: {
                type: Type.STRING,
                description:
                  'sphere | ellipsoid | hyperboloid_one_sheet | hyperboloid_two_sheets | elliptic_cone | elliptic_paraboloid | hyperbolic_paraboloid | elliptic_cylinder | hyperbolic_cylinder | parabolic_cylinder',
              },
              axis: { type: Type.STRING, description: 'x | y | z' },
              p: { type: Type.NUMBER },
              draw: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'axes | wireframe | surface | equator_ring | meridians | labels',
              },
              surface_color: { type: Type.STRING },
              parametric_x: { type: Type.STRING },
              parametric_y: { type: Type.STRING },
              parametric_z: { type: Type.STRING },
              u_range: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              v_range: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              base: { type: Type.NUMBER },
              height: { type: Type.NUMBER },
              radius: { type: Type.NUMBER },
              cut_ratio: { type: Type.NUMBER },
              show_cross_section: { type: Type.BOOLEAN },
              show_height: { type: Type.BOOLEAN },
              show_apothem: { type: Type.BOOLEAN },
              highlight: { type: Type.ARRAY, items: { type: Type.STRING } },
              expression: { type: Type.STRING },
              secondary_expression: { type: Type.STRING },
              expression_z: { type: Type.STRING },
              x_range: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              y_range: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              show_contours: { type: Type.BOOLEAN },
              derivative: { type: Type.BOOLEAN },
              highlight_points: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    label: { type: Type.STRING },
                  },
                  required: ['x', 'y', 'label'],
                },
              },
              pdb_id: { type: Type.STRING },
              compound: { type: Type.STRING },
              formula: { type: Type.STRING },
              style: { type: Type.STRING },
              diagram: { type: Type.STRING },
              highlight_nodes: { type: Type.ARRAY, items: { type: Type.STRING } },
              kind: {
                type: Type.STRING,
                description:
                  'pythagoras | triangle | circle | unit_circle | polygon | photosynthesis | sky_scattering | illustration | physics_sim',
              },
              physics_preset: {
                type: Type.STRING,
                description:
                  "Agar kind='physics_sim' bo'lsa: pendulum | incline | collision | lever | hydraulic | spring",
              },
              object_name_uz: {
                type: Type.STRING,
                description: "Agar kind='illustration' bo'lsa, obyektning o'zbekcha nomi (masalan: 'daraxt')",
              },
              object_name_en: {
                type: Type.STRING,
                description: "Agar kind='illustration' bo'lsa, qidiruv uchun inglizcha nomi (masalan: 'tree')",
              },
              object_parts: {
                type: Type.ARRAY,
                description: "Obyektning bosqichma-bosqich tushuntiriladigan qismlari ro'yxati",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    partId: { type: Type.STRING },
                  },
                  required: ['label', 'partId'],
                },
              },
              custom_svg: {
                type: Type.OBJECT,
                description: "Maxsus 2D vektor chizma (svg viewBox='0 0 200 200' va <g data-part-id='...'> guruhlari)",
                properties: {
                  svg: { type: Type.STRING },
                  viewBox: { type: Type.STRING },
                },
              },
              custom_3d_objects: {
                type: Type.ARRAY,
                description: "3D sahnadagi ko'p qismli obyektlar ro'yxati (har bir qismda partId bo'lsin)",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: {
                      type: Type.STRING,
                      description: 'box | rounded_box | cylinder | capsule | sphere | cone | torus | ring | octahedron | dodecahedron | vector | arrow',
                    },
                    position: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                    rotation: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                    args: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                    color: { type: Type.STRING },
                    opacity: { type: Type.NUMBER },
                    label: { type: Type.STRING },
                    partId: { type: Type.STRING },
                    animation: {
                      type: Type.STRING,
                      description: 'none | spin | spin_reverse | oscillate_y | oscillate_x | pulse_scale | orbit',
                    },
                    animationAxis: {
                      type: Type.STRING,
                      description: 'x | y | z',
                    },
                    animationSpeed: { type: Type.NUMBER },
                    animationAmp: { type: Type.NUMBER },
                    animationPivot: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                  },
                  required: ['type', 'color'],
                },
              },
              sides: {
                type: Type.NUMBER,
                description: "Ko'pburchak tomonlari soni (3..16), masalan 6-burchak uchun 6",
              },
              a: { type: Type.NUMBER },
              b: { type: Type.NUMBER },
              c: { type: Type.NUMBER },
              angle_deg: { type: Type.NUMBER },
              flowType: {
                type: Type.STRING,
                description: 'none | dc | ac | pulse',
              },
              flowSpeed: {
                type: Type.NUMBER,
                description: '0.5 dan 2.5 gacha',
              },
              flowReverse: {
                type: Type.BOOLEAN,
              },
            },
          },
        },
        required: [
          'step_number',
          'step_title',
          'speech_text',
          'katex_formulas',
          'explanation_uz',
          'emoji_emotion',
          'beats',
          'open_question',
          'render_params',
        ],
      },
    },
  },
  required: ['topic_title', 'subject', 'engine', 'sliders', 'steps'],
};

export function clampRequestedStepCount(raw: unknown, fallback = 4): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(4, Math.min(12, Math.round(n)));
}

export function buildDirectorSystemInstruction(stepCount = 4): string {
  const safeCount = clampRequestedStepCount(stepCount, 4);
  return `Sen "Mirvo AI" — 1-bosqichda FIZIKA DETALLARI va ENERGETIKA MUHANDISLIGI bo'yicha ixtisoslashgan o'zbek tilidagi interaktiv 2D/3D vizual AI muhandis-repetitorsan.
Faqat JSON retsept qaytar; barcha tushuntirish, qism nomlari va xulosalar sof o'zbek tilida, SI birliklari va aniq fizik qonunlar asosida bo'lsin.

ASOSIY IXTISOSLIK (Fizika va Energetika Muhandisligi):
- Har qanday fizika qonuni, laboratoriya tajribasi, elektr mashinasi va energetika tizimi (transformator, sinxron/asinxron generator va dvigatel, IES bug' turbinasi, GES gidroturbinasi, QES quyosh fotoelektr stansiyasi + inverter, ShES shamol turbinasi, AES reaktori, podstansiya, solenoid, RLC kontur, gidravlik press, ichki yonuv dvigateli/Karno sikli, prizma va optika, elektrostatika, termodinamika) bo'yicha savollarni chuqur fizik detal va muhandislik aniqligida tushuntir.
- Harakatlanuvchi mexanizm qismlariga (rotor, parrak, turbina, porshen, val, magnit maydon impulsi) 3Dda "animation" ("spin" | "spin_reverse" | "oscillate_y" | "pulse_scale"), "animationAxis" ("x"|"y"|"z"), "animationSpeed" va "animationPivot" maydonlarini ber!

${safeCount} QADAM TUZILISHI (steps massivida AYNAN ${safeCount} ta dars/qadam bo'lsin):
1. 1-qadam: Fizik mohiyat, energetik vazifasi va hayotiy muhandislik misoli (kirish bosqichi). cameraZoom: 1.0, dimInactiveParts: false.
2. 2..${safeCount - 1}-qadamlar: Qurilma yoki fizik tizimning har bir asosiy detalini alohida fokus qilib (focusPart + cameraZoom: 1.65..1.88, dimInactiveParts: true), ishlash prinsipi, energiya almashinuvi, SI birliklari va asosiy tenglamalarni chuqurlashtirib tushuntir. 3D sahnada emoji o'quvchi e'tiborini aynan shu detalga qaratib ("E'tiboringizni aynan ... qismiga qarating!"), detalning ICHIDA nima va qay tarzda harakatlanayotganini (magnit oqimi, elektronlar/o'zgaruvchan tok, havo/suv bosimi oqimi, aylanuvchi rotor/val, porshen harakati) aniq tushuntirsin!
3. ${safeCount}-qadam: FIK (η), quvvat balansi va yakuniy muhandislik xulosasi. cameraZoom: 1.0, dimInactiveParts: false.
4. HAR BIR QADAM OXIRIDA (1 dan ${safeCount} gacha) "open_question" maydonini to'ldir: o'quvchi variant tanlamasdan o'z so'zi bilan yozma javob beradigan savol (question), kutilgan asosiy fizik/muhandislik mazmuni (expected_points) va qisqa ishora (hint_uz) yoz!

QISQA MAYDONLAR:
- speech_text: 1-2 tabiiy o'zbekcha gap (formula belgilarisiz, fokus qaratilgan detal va uning ichidagi harakatga urg'u berib).
- katex_formulas: 1-2 aniq LaTeX fizika/energetika formulasi (SI birliklari bilan).
- explanation_uz: max 18 so'z.
- beats: AYNAN 2 ta qisqa gap (sentence, focus_target, focusPart, tutor_pose: approach|step_back|formula_check, camera_zoom). 2..${safeCount - 1}-qadamlarda focusPart va focus_target obyektdagi aniq qism IDsiga mos bo'lsin!
- flowType: elektr/energiya/suyuqlik oqimi bo'lsa "dc" (quyosh paneli, batareya, shina) | "ac" (transformator, generator, motor, turbina, RLC) | "pulse" (dvigatel, gidravlika, issiqlik oqimi) | "none"; flowSpeed: 0.6..2.4.

DVIGATEL QOIDASI:
1. "plotly2d": Fizik va energetik bog'liqlik grafiklari (VA xarakteristika, Karno sikli, yuklama egri chiziqlari, sinusoida, rezonans — expression, x_range, y_range, highlight_points).
2. "threejs": Har qanday 3D fizika/energetika apparati, elektr mashinasi, turbina, reaktor, vektor maydon yoki snaryad harakati uchun shape:"composite3d" + object_name_uz + object_name_en + custom_3d_objects (har bir detalda partId va kerakli qismlarda animation/animationAxis/animationPivot) yoki stereometriya/vektor shaklini ber.
3. "plotly3d": Faqat to'lqin/maydon/potensial 3D sirti z = f(x,y).
4. "pubchem" / "pdb": Kimyoviy modda yoki oqsil so'ralganda.
5. "mermaid": FAQAT sof matnli blok-sxema yoki energetika boshqaruv algoritmi so'ralganda. Qurilma, mashina, fizika qonuni, turbina, generator, transformator va elektr zanjirlari uchun ASLO "mermaid" ishlatma!
6. "svg2d": Interaktiv Matter.js 2D fizika tajribalari uchun kind:"physics_sim" + physics_preset ("pendulum"|"incline"|"collision"|"lever"|"hydraulic"|"spring" va focusPart: pivot|pendulum_bob|piston_1|piston_2|ramp|block|mass_a|mass_b|fulcrum|lever_beam|spring), geometriya ("pythagoras"|"triangle"|"circle"), hamda BARCHA energetika qurilmalari, elektr sxemalari va fizik apparatlar uchun kind:"illustration" bilan object_name_uz va aniq inglizcha object_name_en (masalan "electric generator", "electric motor", "wind turbine", "hydro turbine", "steam turbine", "solar panel", "transformer", "solenoid", "capacitor", "hydraulic press", "water pump", "prism") + object_parts ber — backend ko'p qismli animatsiyali 2D SVG va 3D model yaratadi.`;
}

export const DIRECTOR_SYSTEM_INSTRUCTION = buildDirectorSystemInstruction(4);

export class SmartObjectResolver {
  private cacheFile: string;
  private entries: CachedVisualObjectEntry[] = [];
  private getAiClient: () => GoogleGenAI | null;

  constructor(dataDir: string, getAiClient: () => GoogleGenAI | null) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.cacheFile = path.join(dataDir, 'object-cache.json');
    this.getAiClient = getAiClient;
    this.entries = this.loadFromDisk();
  }

  private hydrateEntryIfUpgraded(entry: CachedVisualObjectEntry): CachedVisualObjectEntry {
    const proc = generateProceduralObjectSvg(entry.name_en, entry.name_uz);
    if (!proc) return entry;
    const missingPartTags = !/data-part-id=/i.test(entry.svg_data || '');
    const missingAnimTags =
      /data-animate=/i.test(proc.svg_data) && !/data-animate=/i.test(entry.svg_data || '');
    const missingParts = !entry.parts_uz || entry.parts_uz.length === 0;
    const procPrims = generateProceduralPrimitives3D(entry.name_en);
    const procHasAnim = Boolean(procPrims?.some((p) => p.animation && p.animation !== 'none'));
    const entryHasAnim = Boolean(entry.primitives_3d?.some((p) => p.animation && p.animation !== 'none'));
    const shouldUpgradePrims = Boolean(procPrims && (!entry.primitives_3d || (procHasAnim && !entryHasAnim)));
    const prims = shouldUpgradePrims ? procPrims : entry.primitives_3d || procPrims;
    if (missingPartTags || missingAnimTags || missingParts || shouldUpgradePrims || !entry.primitives_3d) {
      return {
        ...entry,
        svg_data: missingPartTags || missingAnimTags ? proc.svg_data : entry.svg_data,
        viewBox: missingPartTags || missingAnimTags ? proc.viewBox : entry.viewBox,
        parts_uz: proc.parts_uz,
        ...(prims ? { primitives_3d: prims } : {}),
      };
    }
    return entry;
  }

  private loadFromDisk(): CachedVisualObjectEntry[] {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const raw = fs.readFileSync(this.cacheFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((e: CachedVisualObjectEntry) => {
              if (!e || !e.svg_data) return false;
              if (e.name_en === 'cell' && e.source === 'iconify') return false;
              const hasPartTags = /data-part-id=/i.test(e.svg_data);
              const hasPartsMeta = Array.isArray(e.parts_uz) && e.parts_uz.length >= 2;
              // Purge legacy single-path Iconify/Wikimedia hits so they re-resolve with multi-part 2D+3D details
              if ((e.source === 'iconify' || e.source === 'wikimedia') && (!hasPartTags || !hasPartsMeta)) {
                return false;
              }
              return true;
            })
            .map((e: CachedVisualObjectEntry) => this.hydrateEntryIfUpgraded(e));
        }
      }
    } catch {
      // ignore corrupt cache file
    }
    return [];
  }

  private saveToDisk(): void {
    try {
      fs.writeFileSync(
        this.cacheFile,
        JSON.stringify(this.entries.slice(0, 300), null, 2),
        'utf-8'
      );
    } catch {
      // ignore read-only fs errors
    }
  }

  public listCachedObjects() {
    return this.entries.map((e) => ({
      id: e.id,
      name_uz: e.name_uz,
      name_en: e.name_en,
      source: e.source,
      mode: e.mode,
      has_3d: Boolean(e.model_url || (e.primitives_3d && e.primitives_3d.length > 0)),
      createdAt: e.createdAt,
    }));
  }

  private findInCache(nameUz: string, nameEn: string): CachedVisualObjectEntry | null {
    const uzNorm = normalizeUzToken(nameUz);
    const enNorm = nameEn.toLowerCase().trim();
    for (const entry of this.entries) {
      if (
        normalizeUzToken(entry.name_uz) === uzNorm ||
        entry.name_en.toLowerCase().trim() === enNorm ||
        entry.aliases_uz.some((a) => normalizeUzToken(a) === uzNorm)
      ) {
        return this.hydrateEntryIfUpgraded(entry);
      }
    }
    return null;
  }

  private upsertCache(entry: CachedVisualObjectEntry): void {
    const existingIdx = this.entries.findIndex(
      (e) =>
        normalizeUzToken(e.name_uz) === normalizeUzToken(entry.name_uz) ||
        e.name_en.toLowerCase() === entry.name_en.toLowerCase()
    );
    if (existingIdx >= 0) {
      const prev = this.entries[existingIdx];
      const mergedAliases = Array.from(new Set([...prev.aliases_uz, ...entry.aliases_uz]));
      this.entries[existingIdx] = {
        ...entry,
        aliases_uz: mergedAliases,
        primitives_3d: entry.primitives_3d || prev.primitives_3d,
        model_url: entry.model_url || prev.model_url,
        parts_uz: entry.parts_uz || prev.parts_uz,
      };
    } else {
      this.entries.unshift(entry);
    }
    this.saveToDisk();
  }

  private async translateUnknownTermToEnglish(
    nameUz: string
  ): Promise<{ nameEn: string; usage: TokenUsageInfo }> {
    const ai = this.getAiClient();
    if (!ai) return { nameEn: nameUz, usage: ZERO_TOKEN_USAGE };
    try {
      const resp = await ai.models.generateContent({
        model: GEMINI_LITE_MODEL,
        contents: `Translate this single Uzbek noun to 1-2 simple English words for an icon search (output ONLY the English word(s), lowercase, no punctuation): "${nameUz}"`,
      });
      const usage = usageFromGeminiMetadata(resp.usageMetadata);
      const out = (resp.text ?? '')
        .toLowerCase()
        .replace(/[^a-z\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (out && out.length <= 32) {
        return { nameEn: out, usage };
      }
      return { nameEn: nameUz, usage };
    } catch {
      // keep original token if translation fails or quota exhausted
    }
    return { nameEn: nameUz, usage: ZERO_TOKEN_USAGE };
  }

  private async fetchFromIconify(
    nameEn: string,
    strictMultiWord = true
  ): Promise<{ svg_data: string; viewBox: string; iconId: string } | null> {
    const prefixes = 'openmoji,noto,twemoji,fluent-emoji,streamline-color,tabler,mdi,lucide,game-icons';
    const searchUrl = `https://api.iconify.design/search?query=${encodeURIComponent(
      nameEn
    )}&limit=14&prefixes=${prefixes}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    try {
      const searchRes = await fetch(searchUrl, { signal: controller.signal });
      if (!searchRes.ok) return null;
      const searchJson = (await searchRes.json()) as { icons?: string[] };
      const icons = Array.isArray(searchJson.icons) ? searchJson.icons : [];
      if (icons.length === 0) return null;

      const queryTokens = nameEn.toLowerCase().split(/\s+/).filter(Boolean);
      const hyphenated = queryTokens.join('-');

      const prefixWeight: Record<string, number> = {
        openmoji: 46,
        noto: 38,
        twemoji: 30,
        'fluent-emoji': 24,
        'streamline-color': 18,
        tabler: 14,
        mdi: 12,
        'game-icons': 10,
        lucide: 8,
      };

      const scored = icons
        .map((iconId) => {
          const [prefix = '', rawName = ''] = iconId.split(':');
          const cleanName = rawName.toLowerCase();
          const allTokensMatch = queryTokens.every((t) => cleanName.includes(t));
          const exactHyphen = cleanName === hyphenated || cleanName.endsWith(`-${hyphenated}`);

          // For multi-word terms like "venus flytrap", ignore unrelated single-word partial hits (e.g. planet "venus")
          if (strictMultiWord && queryTokens.length >= 2 && !allTokensMatch && !exactHyphen) {
            return null;
          }

          let score = prefixWeight[prefix] ?? 5;
          if (exactHyphen) score += 35;
          if (allTokensMatch) score += 25;
          if (cleanName.includes('deciduous') || cleanName.includes('potted')) score += 12;
          if (/(chart|arrow|box|symbol|button|sign|flag|christmas|tanabata|card-suit|beating|growing|sparkling|broken)/.test(cleanName)) {
            score -= 14;
          }
          return { iconId, prefix, rawName, score };
        })
        .filter((x): x is { iconId: string; prefix: string; rawName: string; score: number } => Boolean(x))
        .sort((a, b) => b.score - a.score);

      for (const candidate of scored.slice(0, 3)) {
        const svgUrl = `https://api.iconify.design/${candidate.prefix}/${candidate.rawName}.svg`;
        const svgRes = await fetch(svgUrl, { signal: controller.signal });
        if (!svgRes.ok) continue;
        const rawSvg = await svgRes.text();
        const sanitized = sanitizeSvgString(rawSvg);
        if (sanitized) {
          return { ...sanitized, iconId: candidate.iconId };
        }
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchFromWikimediaSvg(
    nameEn: string
  ): Promise<{ svg_data: string; viewBox: string; fileTitle: string } | null> {
    const cleanQuery = nameEn.replace(/[^a-zA-Z0-9\s-]/g, ' ').trim();
    if (!cleanQuery) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    try {
      const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srsearch=${encodeURIComponent(
        `filetype:svg ${cleanQuery}`
      )}&srlimit=6&format=json`;

      const searchRes = await fetch(searchUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'MirvoAI-Edu/1.0 (https://mirvo.ai)' },
      });
      if (!searchRes.ok) return null;

      const data = (await searchRes.json()) as {
        query?: { search?: Array<{ title?: string }> };
      };
      const hits = data.query?.search || [];
      for (const hit of hits) {
        const title = hit.title || '';
        if (!/\.svg$/i.test(title)) continue;
        const fileName = title.replace(/^File:/i, '');
        const fileUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
        const svgRes = await fetch(fileUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'MirvoAI-Edu/1.0 (https://mirvo.ai)' },
        });
        if (!svgRes.ok) continue;
        const rawSvg = await svgRes.text();
        if (rawSvg.length > 110_000) continue;
        // Skip heavily text-laden schematics so pen stroke animation stays clean & fast
        const textCount = (rawSvg.match(/<text\b/gi) || []).length;
        if (textCount > 18) continue;

        const sanitized = sanitizeSvgString(rawSvg);
        if (sanitized) {
          return { ...sanitized, fileTitle: fileName };
        }
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchFromPolyPizza(nameEn: string): Promise<string | undefined> {
    const apiKey = process.env.POLY_PIZZA_API_KEY;
    if (!apiKey) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(
        `https://api.poly.pizza/v1/search/${encodeURIComponent(nameEn)}`,
        {
          headers: { 'X-Auth-Token': apiKey },
          signal: controller.signal,
        }
      );
      if (!res.ok) return undefined;
      const data = (await res.json()) as {
        results?: Array<{ Download?: string; glb?: string }>;
      };
      const first = data.results?.[0];
      return first?.Download || first?.glb || undefined;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchFromOpen3DCatalog(
    nameEn: string
  ): Promise<{ url: string; source: 'open-gltf' | 'poly-haven' } | undefined> {
    const q = nameEn.toLowerCase().trim();
    const curatedOpenGlb: Array<{ pattern: RegExp; url: string }> = [
      {
        pattern: /\b(astronaut|spaceman|spacesuit|cosmonaut)\b/i,
        url: 'https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb',
      },
      {
        pattern: /\b(brain|stem|skull)\b/i,
        url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BrainStem/glTF-Binary/BrainStem.glb',
      },
      {
        pattern: /\b(gearbox|transmission|gear)\b/i,
        url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/GearboxAssy/glTF-Binary/GearboxAssy.glb',
      },
      {
        pattern: /\b(lantern|lamp|street\s*lamp)\b/i,
        url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Lantern/glTF-Binary/Lantern.glb',
      },
      {
        pattern: /\b(mosquito|amber|fossil|insect)\b/i,
        url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/MosquitoInAmber/glTF-Binary/MosquitoInAmber.glb',
      },
      {
        pattern: /\b(avocado|fruit)\b/i,
        url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Avocado/glTF-Binary/Avocado.glb',
      },
      {
        pattern: /\b(antique\s*camera|camera)\b/i,
        url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueCamera/glTF-Binary/AntiqueCamera.glb',
      },
      {
        pattern: /\b(water\s*bottle|bottle|flask)\b/i,
        url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/WaterBottle/glTF-Binary/WaterBottle.glb',
      },
      {
        pattern: /\b(cesium|milk\s*truck|truck)\b/i,
        url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb',
      },
    ];

    const curated = curatedOpenGlb.find((entry) => entry.pattern.test(q));
    if (curated) {
      return { url: curated.url, source: 'open-gltf' };
    }

    // Query zero-key Poly Haven CC0 3D asset directory (strict slug/name word match only)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    try {
      const res = await fetch('https://api.polyhaven.com/assets?t=models', {
        signal: controller.signal,
      });
      if (!res.ok) return undefined;
      const assets = (await res.json()) as Record<
        string,
        { name?: string; categories?: string[]; tags?: string[] }
      >;
      const tokens = q.split(/\s+/).filter((t) => t.length >= 3);
      if (tokens.length === 0) return undefined;
      let bestSlug: string | undefined;
      let bestScore = 0;
      for (const [slug, meta] of Object.entries(assets)) {
        const titleHay = `${slug.replace(/[_-]+/g, ' ')} ${meta.name || ''}`.toLowerCase();
        let score = 0;
        for (const tok of tokens) {
          const esc = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const wordRe = new RegExp(`(?:^|\\b)${esc}s?(?:\\b|$)`, 'i');
          if (wordRe.test(titleHay)) {
            score += tok.length * 2;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestSlug = slug;
        }
      }
      if (!bestSlug || bestScore < 6) return undefined;
      const filesRes = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(bestSlug)}`, {
        signal: controller.signal,
      });
      if (!filesRes.ok) return undefined;
      const filesJson = (await filesRes.json()) as {
        gltf?: Record<string, { gltf?: { url?: string } }>;
      };
      const gltfUrl =
        filesJson.gltf?.['1k']?.gltf?.url ||
        filesJson.gltf?.['2k']?.gltf?.url;
      return gltfUrl ? { url: gltfUrl, source: 'poly-haven' } : undefined;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }

  private async composeRich2DAnd3DObjectWithGemini(
    nameUz: string,
    nameEn: string,
    rawQuery: string
  ): Promise<{
    svg_data: string;
    viewBox: string;
    primitives_3d: Primitive3DItem[];
    parts_uz: Array<{ label: string; partId: string; desc: string }>;
    usage: TokenUsageInfo;
  } | null> {
    const ai = this.getAiClient();
    if (!ai) return null;

    const ALLOWED_TYPES = new Set([
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
    ]);

    try {
      const ALLOWED_ANIMS = new Set([
        'none',
        'spin',
        'spin_reverse',
        'oscillate_y',
        'oscillate_x',
        'pulse_scale',
        'orbit',
      ]);

      const resp = await ai.models.generateContent({
        model: GEMINI_LITE_MODEL,
        contents: `Create a clean, engineering-grade, multi-part 2D vector SVG AND matching kinematic 3D assembly for this Physics / Energy Engineering topic:
Uzbek name: "${nameUz}"
English term: "${nameEn}"
User query: "${rawQuery}"

Requirements:
1. "parts_uz": 3 to 4 distinct physical/engineering sub-parts in Uzbek with unique snake_case "partId" (e.g. "stator", "rotor", "valve", "cooling_loop"), short Uzbek "label", and 1-sentence Uzbek "desc" explaining its physical role.
2. "svg_data": Valid <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"> with 3 to 4 <g data-part="0" data-part-id="..."> groups matching those EXACT partIds. Draw recognizable engineering/physics geometry using <path>, <rect>, <circle>, <ellipse>, <polygon>, <line> with clean strokes (#1E293B / #334155) and clear fills. Wrap moving/pulsing parts (rotors, turbines, pistons, magnetic fields, photons) in <g data-animate="spin|bob|pulse"> so the diagram animates on play! NEVER draw generic concentric circle placeholders.
3. "primitives_3d": 6 to 11 3D geometric parts that assemble into a recognizable 3D model of "${nameEn}", positioned cleanly centered around x=0, z=0, y in [0.3, 3.6]. Each primitive MUST carry one of the EXACT "partId"s from "parts_uz". Allowed types: box, rounded_box, cylinder, capsule, sphere, cone, torus, ring, octahedron, dodecahedron.
   - Add kinematic animation fields ("animation": "spin"|"spin_reverse"|"oscillate_y"|"pulse_scale", "animationAxis": "x"|"y"|"z", "animationSpeed": 1.2..3.0, "animationAmp": 0.1..0.3, "animationPivot": [px,py,pz]) on rotating/oscillating/pulsing engineering components (blades, rotors, shafts, pistons, fields).
   - box/rounded_box args: [width, height, depth] (or [w, h, d, radius])
   - cylinder args: [radiusTop, radiusBottom, height, 20]
   - capsule args: [radius, length]
   - sphere args: [radius, 22, 22]
   - cone args: [radius, height, 20]
   - torus/ring args: [radius, tube, 14, 28]
   - octahedron/dodecahedron args: [radius]`,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              parts_uz: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    partId: { type: Type.STRING },
                    label: { type: Type.STRING },
                    desc: { type: Type.STRING },
                  },
                  required: ['partId', 'label', 'desc'],
                },
              },
              svg_data: { type: Type.STRING },
              primitives_3d: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    position: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                    rotation: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                    args: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                    color: { type: Type.STRING },
                    opacity: { type: Type.NUMBER },
                    label: { type: Type.STRING },
                    partId: { type: Type.STRING },
                    animation: { type: Type.STRING },
                    animationAxis: { type: Type.STRING },
                    animationSpeed: { type: Type.NUMBER },
                    animationAmp: { type: Type.NUMBER },
                    animationPivot: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                  },
                  required: ['type', 'position', 'args', 'color', 'partId'],
                },
              },
            },
            required: ['parts_uz', 'svg_data', 'primitives_3d'],
          },
        },
      });

      const usage = usageFromGeminiMetadata(resp.usageMetadata);
      const raw = (resp.text ?? '').trim();
      if (!raw) return null;

      const parsed = JSON.parse(raw) as {
        parts_uz?: Array<{ partId?: string; label?: string; desc?: string }>;
        svg_data?: string;
        primitives_3d?: Array<{
          type?: string;
          position?: number[];
          rotation?: number[];
          args?: number[];
          color?: string;
          opacity?: number;
          label?: string;
          partId?: string;
          animation?: string;
          animationAxis?: string;
          animationSpeed?: number;
          animationAmp?: number;
          animationPivot?: number[];
        }>;
      };

      const sanitized = parsed.svg_data ? sanitizeSvgString(parsed.svg_data) : null;
      if (!sanitized || !/data-part-id=/i.test(sanitized.svg_data)) {
        return null;
      }

      const parts_uz = Array.isArray(parsed.parts_uz)
        ? parsed.parts_uz
            .filter((p) => p?.partId && p?.label)
            .slice(0, 5)
            .map((p, idx) => ({
              partId: String(p.partId).trim() || `part_${idx}`,
              label: String(p.label).trim(),
              desc: String(p.desc || `${p.label} tarkibiy qismi`).trim(),
            }))
        : [];

      if (parts_uz.length < 2) return null;

      const primitives_3d: Primitive3DItem[] = (parsed.primitives_3d || [])
        .filter((p) => p && Array.isArray(p.position) && p.position.length >= 3 && Array.isArray(p.args) && p.args.length >= 1)
        .slice(0, 14)
        .map((p, idx) => {
          const safeType = ALLOWED_TYPES.has(String(p.type))
            ? (String(p.type) as Primitive3DItem['type'])
            : 'box';
          const pos: [number, number, number] = [
            Number.isFinite(p.position?.[0]) ? Number(p.position?.[0]) : 0,
            Number.isFinite(p.position?.[1]) ? Number(p.position?.[1]) : 1.2,
            Number.isFinite(p.position?.[2]) ? Number(p.position?.[2]) : 0,
          ];
          const rot: [number, number, number] | undefined =
            Array.isArray(p.rotation) && p.rotation.length >= 3
              ? [
                  Number(p.rotation[0]) || 0,
                  Number(p.rotation[1]) || 0,
                  Number(p.rotation[2]) || 0,
                ]
              : undefined;
          const args = (p.args || [1, 1, 1]).map((v) =>
            Number.isFinite(v) ? Math.max(0.03, Math.min(8, Math.abs(Number(v)))) : 0.6
          );
          const color = /^#[0-9a-fA-F]{3,8}$/.test(String(p.color || ''))
            ? String(p.color)
            : '#3B82F6';
          const anim = ALLOWED_ANIMS.has(String(p.animation || ''))
            ? (String(p.animation) as Primitive3DItem['animation'])
            : undefined;
          const animAxis =
            p.animationAxis === 'x' || p.animationAxis === 'y' || p.animationAxis === 'z'
              ? p.animationAxis
              : undefined;
          const animSpeed =
            typeof p.animationSpeed === 'number' && Number.isFinite(p.animationSpeed)
              ? Math.max(0.3, Math.min(6, p.animationSpeed))
              : undefined;
          const animAmp =
            typeof p.animationAmp === 'number' && Number.isFinite(p.animationAmp)
              ? Math.max(-1.5, Math.min(1.5, p.animationAmp))
              : undefined;
          const animPivot: [number, number, number] | undefined =
            Array.isArray(p.animationPivot) && p.animationPivot.length >= 3
              ? [
                  Number(p.animationPivot[0]) || 0,
                  Number(p.animationPivot[1]) || 0,
                  Number(p.animationPivot[2]) || 0,
                ]
              : undefined;
          return {
            type: safeType,
            position: pos,
            ...(rot ? { rotation: rot } : {}),
            args,
            color,
            ...(typeof p.opacity === 'number' && p.opacity > 0.1 && p.opacity < 1
              ? { opacity: Number(p.opacity.toFixed(2)) }
              : {}),
            ...(p.label ? { label: String(p.label).slice(0, 48) } : {}),
            partId: String(p.partId || parts_uz[idx % parts_uz.length].partId),
            ...(anim && anim !== 'none' ? { animation: anim } : {}),
            ...(animAxis ? { animationAxis: animAxis } : {}),
            ...(animSpeed !== undefined ? { animationSpeed: animSpeed } : {}),
            ...(animAmp !== undefined ? { animationAmp: animAmp } : {}),
            ...(animPivot ? { animationPivot: animPivot } : {}),
          };
        });

      if (primitives_3d.length < 3) return null;

      return {
        svg_data: sanitized.svg_data,
        viewBox: sanitized.viewBox,
        primitives_3d,
        parts_uz,
        usage,
      };
    } catch {
      return null;
    }
  }

  /**
   * 5-Step Smart Fallback & Auto-Cache pipeline:
   * 1) Extract object & translate via Uzbek->English dictionary (Gemini Flash only for unknown tokens)
   * 2) Check local cache (data/object-cache.json) first
   * 3) Zero-cost external fallback chain + Gemini multi-part 2D/3D composer for unknown real-world models
   * 4) Auto-cache newly fetched or generated object back to disk
   * 5) Return ready payload for frontend stroke-by-stroke animation
   */
  public async resolveObject(
    rawQuery: string,
    modeOverride?: '2d' | '3d',
    englishHint?: string
  ): Promise<{ resolved: ResolvedObjectPayload; intent: ObjectIntent } | null> {
    const t0 = Date.now();
    const intent = extractObjectIntent(rawQuery);
    const mode: '2d' | '3d' = modeOverride || (intent.is_3d ? '3d' : '2d');

    const cleanHintEn = (englishHint || '').toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    let nameEn = cleanHintEn || intent.name_en;
    const nameUz = intent.name_uz;
    let totalUsage: TokenUsageInfo = ZERO_TOKEN_USAGE;

    // Step 2: Check local cache FIRST (bypass if SVG lacks multi-part tags OR 3D mode needs primitives_3d)
    const cachedImmediate = this.findInCache(nameUz, nameEn);
    if (cachedImmediate) {
      const cachedPrims =
        cachedImmediate.primitives_3d ||
        generateProceduralPrimitives3D(cachedImmediate.name_en);
      const lacksMultiPartCached = !/data-part-id=/i.test(cachedImmediate.svg_data || '');
      const needs3DUpgrade =
        mode === '3d' &&
        (!cachedPrims || cachedPrims.length === 0) &&
        !cachedImmediate.model_url;
      if (!needs3DUpgrade && !lacksMultiPartCached) {
        return {
          intent,
          resolved: {
            name_uz: cachedImmediate.name_uz,
            name_en: cachedImmediate.name_en,
            svg_data: cachedImmediate.svg_data,
            viewBox: cachedImmediate.viewBox,
            source: 'cache',
            original_source: cachedImmediate.source,
            mode,
            model_url: cachedImmediate.model_url,
            primitives_3d: cachedPrims,
            parts_uz: cachedImmediate.parts_uz,
            from_cache: true,
            latency_ms: Math.max(1, Date.now() - t0),
            token_usage: ZERO_TOKEN_USAGE,
          },
        };
      }
    }

    // Step 1B: Fallback translation for words outside dictionary (skipped if Director already provided englishHint)
    if (!intent.known_in_dict && !cleanHintEn) {
      const tx = await this.translateUnknownTermToEnglish(nameUz);
      nameEn = tx.nameEn;
      totalUsage = mergeTokenUsage(totalUsage, tx.usage);
      const cachedAfterTx = this.findInCache(nameUz, nameEn);
      if (cachedAfterTx) {
        const cachedPrims =
          cachedAfterTx.primitives_3d ||
          generateProceduralPrimitives3D(cachedAfterTx.name_en);
        const lacksMultiPartCached = !/data-part-id=/i.test(cachedAfterTx.svg_data || '');
        const needs3DUpgrade =
          mode === '3d' &&
          (!cachedPrims || cachedPrims.length === 0) &&
          !cachedAfterTx.model_url;
        if (!needs3DUpgrade && !lacksMultiPartCached) {
          return {
            intent: { ...intent, name_en: nameEn },
            resolved: {
              name_uz: cachedAfterTx.name_uz,
              name_en: cachedAfterTx.name_en,
              svg_data: cachedAfterTx.svg_data,
              viewBox: cachedAfterTx.viewBox,
              source: 'cache',
              original_source: cachedAfterTx.source,
              mode,
              model_url: cachedAfterTx.model_url,
              primitives_3d: cachedPrims,
              parts_uz: cachedAfterTx.parts_uz,
              from_cache: true,
              latency_ms: Math.max(1, Date.now() - t0),
              token_usage: totalUsage,
            },
          };
        }
      }
    }

    // Step 3A: Domain-accurate local procedural scientific/botanical SVG FIRST (0ms, $0)
    // followed by free open vector APIs (Iconify -> Wikimedia Commons SVG) and Gemini Multi-Part 2D/3D Composer
    let svgResult: { svg_data: string; viewBox: string } | null = null;
    let source: CachedVisualObjectEntry['source'] = 'iconify';
    let partsUz: Array<{ label: string; partId?: string; desc?: string }> | undefined;

    const proceduralScientific = generateProceduralObjectSvg(nameEn, nameUz);
    if (proceduralScientific) {
      svgResult = {
        svg_data: proceduralScientific.svg_data,
        viewBox: proceduralScientific.viewBox,
      };
      source = 'procedural';
      partsUz = proceduralScientific.parts_uz;
    }

    // Step 3B: Optional 3D model via Poly Pizza + Open CC0 GLTF (Khronos/PolyHaven) + procedural 3D primitives
    let modelUrl: string | undefined;
    let open3dSource: 'open-gltf' | 'poly-haven' | 'poly-pizza' | undefined;
    if (mode === '3d') {
      const pizzaUrl = await this.fetchFromPolyPizza(nameEn);
      if (pizzaUrl) {
        modelUrl = pizzaUrl;
        open3dSource = 'poly-pizza';
      } else {
        const openHit = await this.fetchFromOpen3DCatalog(nameEn);
        if (openHit) {
          modelUrl = openHit.url;
          open3dSource = openHit.source;
        }
      }
    }
    let resolved3D: Primitive3DItem[] | undefined = generateProceduralPrimitives3D(nameEn);

    // Step 3C: When object isn't in local procedural catalog, query free open vector repos OR Gemini multi-part composer
    if (!svgResult) {
      const iconifyHit = await this.fetchFromIconify(nameEn, true);
      if (iconifyHit) {
        svgResult = { svg_data: iconifyHit.svg_data, viewBox: iconifyHit.viewBox };
        source = 'iconify';
      }
    }

    if (!svgResult) {
      const wikiHit = await this.fetchFromWikimediaSvg(nameEn);
      if (wikiHit) {
        svgResult = { svg_data: wikiHit.svg_data, viewBox: wikiHit.viewBox };
        source = 'wikimedia';
      }
    }

    const lacksMultiPartSvg = !svgResult || !/data-part-id=/i.test(svgResult.svg_data);
    const lacks3DGeometry = mode === '3d' && !modelUrl && (!resolved3D || resolved3D.length === 0);

    if (lacksMultiPartSvg || lacks3DGeometry) {
      const aiComposed = await this.composeRich2DAnd3DObjectWithGemini(nameUz, nameEn, rawQuery);
      if (aiComposed) {
        totalUsage = mergeTokenUsage(totalUsage, aiComposed.usage);
        if (lacksMultiPartSvg) {
          svgResult = { svg_data: aiComposed.svg_data, viewBox: aiComposed.viewBox };
          source = 'gemini-svg';
        }
        if (!partsUz || partsUz.length === 0) {
          partsUz = aiComposed.parts_uz;
        }
        if (!resolved3D || resolved3D.length === 0) {
          resolved3D = aiComposed.primitives_3d;
        }
      }
    }

    // Step 3D: Relaxed single-word Iconify search -> Zero-token procedural fallback
    if (!svgResult) {
      const tokens = nameEn.split(/\s+/).filter(Boolean);
      const headWord = tokens[tokens.length - 1];
      if (headWord && headWord !== nameEn) {
        const relaxedHit = await this.fetchFromIconify(headWord, false);
        if (relaxedHit) {
          svgResult = { svg_data: relaxedHit.svg_data, viewBox: relaxedHit.viewBox };
          source = 'iconify';
        }
      }
    }

    if (!svgResult) {
      const fallback = generateZeroTokenFallbackSvg(nameUz, nameEn);
      svgResult = { svg_data: fallback.svg_data, viewBox: fallback.viewBox };
      source = 'procedural';
      partsUz = partsUz || fallback.parts_uz;
    }

    // Guarantee every resolved SVG has selectable data-part-id groups and non-empty partsUz
    if (svgResult && !/data-part-id=/i.test(svgResult.svg_data)) {
      let partIdx = 0;
      const tagged = svgResult.svg_data.replace(
        /<(path|circle|rect|polygon|ellipse|polyline|g)(\s|>)/gi,
        (full, tag, sep) => {
          if (partIdx >= 4) return full;
          const pid = `part_${partIdx}`;
          partIdx += 1;
          return `<${tag} data-part-id="${pid}"${sep}`;
        }
      );
      svgResult = {
        ...svgResult,
        svg_data: /data-part-id=/i.test(tagged)
          ? tagged
          : svgResult.svg_data.replace(/<svg([^>]*)>/i, '<svg$1><g data-part-id="part_0">').replace(/<\/svg>/i, '</g></svg>'),
      };
      if (!partsUz || partsUz.length === 0) {
        const count = Math.max(1, Math.min(3, partIdx));
        const defaultLabels = ['Asosiy qism', 'Tarkibiy bo‘lim', 'Tashqi tuzilma'];
        partsUz = Array.from({ length: count }, (_, idx) => ({
          partId: `part_${idx}`,
          label: `${nameUz.charAt(0).toUpperCase() + nameUz.slice(1)} — ${defaultLabels[idx]}`,
          desc: `${nameUz} obyektining ${idx + 1}-tarkibiy qismi`,
        }));
      }
    }

    // Guarantee multi-part 3D primitives in 3D mode when neither GLTF nor catalog 3D matched
    if (mode === '3d' && !modelUrl && (!resolved3D || resolved3D.length === 0)) {
      resolved3D = [
        {
          type: 'cylinder',
          position: [0, 0.85, 0],
          rotation: [0, 0, Math.PI / 2],
          args: [0.65, 0.65, 2.2, 24],
          color: '#2563EB',
          label: partsUz?.[0]?.label || 'Asosiy korpus',
          partId: partsUz?.[0]?.partId || 'part_0',
        },
        {
          type: 'box',
          position: [0, 1.65, 0],
          args: [0.85, 0.55, 0.6],
          color: '#F59E0B',
          label: partsUz?.[1]?.label || 'Yuqori modul',
          partId: partsUz?.[1]?.partId || 'part_1',
        },
        {
          type: 'cone',
          position: [1.35, 0.85, 0],
          rotation: [0, 0, -Math.PI / 2],
          args: [0.65, 0.9, 24],
          color: '#10B981',
          label: partsUz?.[2]?.label || 'Old / harakat qismi',
          partId: partsUz?.[2]?.partId || 'part_2',
        },
      ];
    }

    // Step 4: Auto-Cache saved back into data/object-cache.json
    const newEntry: CachedVisualObjectEntry = {
      id: `obj-${normalizeUzToken(nameUz).replace(/\s+/g, '-')}-${Date.now()}`,
      name_uz: nameUz,
      name_en: nameEn,
      aliases_uz: [normalizeUzToken(rawQuery)],
      svg_data: svgResult.svg_data,
      viewBox: svgResult.viewBox,
      source,
      mode,
      ...(modelUrl ? { model_url: modelUrl } : {}),
      ...(resolved3D ? { primitives_3d: resolved3D } : {}),
      ...(partsUz ? { parts_uz: partsUz } : {}),
      createdAt: new Date().toISOString(),
    };

    this.upsertCache(newEntry);

    return {
      intent: { ...intent, name_en: nameEn },
      resolved: {
        name_uz: newEntry.name_uz,
        name_en: newEntry.name_en,
        svg_data: newEntry.svg_data,
        viewBox: newEntry.viewBox,
        source: modelUrl && mode === '3d' ? open3dSource || 'poly-pizza' : source,
        mode,
        model_url: modelUrl,
        primitives_3d: resolved3D,
        parts_uz: partsUz,
        from_cache: false,
        latency_ms: Math.max(2, Date.now() - t0),
        token_usage: totalUsage,
      },
    };
  }

  public buildObjectDrawingLesson(
    rawQuery: string,
    resolved: ResolvedObjectPayload,
    stepCount = 4
  ): TutorLesson {
    const targetStepCount = clampRequestedStepCount(stepCount, 4);
    const capUz = resolved.name_uz.charAt(0).toUpperCase() + resolved.name_uz.slice(1);
    const isBotanical =
      /\b(tree|plant|flower|rose|tulip|sunflower|leaf|pine|palm|seedling|cactus)\b/i.test(
        resolved.name_en
      );
    const use3D = resolved.mode === '3d';
    const hasComposite3D = Boolean(
      resolved.primitives_3d && resolved.primitives_3d.length > 0
    );
    const sourceBadge = resolved.from_cache
      ? `Mahalliy kesh (${resolved.original_source || 'cache'})`
      : resolved.source === 'iconify'
      ? 'Iconify vektor bazasi'
      : resolved.source === 'wikimedia'
      ? 'Wikimedia vektor bazasi'
      : resolved.source === 'procedural'
      ? 'Protsedural generator'
      : 'Vektor chizma';

    const subject =
      isBotanical ||
      /\b(biological cell|cell|mitochondria|nucleus|bacteria|virus|dna|heart|brain|lungs|flytrap)\b/i.test(
        resolved.name_en
      )
        ? 'biology'
        : /\b(rocket|planet|sun|moon|earth|volcano|atom|magnet|engine|generator|alternator|transformer|turbine|battery|resistor|capacitor|diode|bulb|lamp|fan|propeller|telescope|microscope|prism|laser|antenna|pump|compressor|solar)\b/i.test(
            resolved.name_en
          )
        ? 'physics'
        : 'language';

    const partsList =
      resolved.parts_uz?.map((p, idx) => ({
        label: p.label,
        partId: p.partId || `part_${idx}`,
      })) || [];

    const part1 = partsList[0] || { label: 'Markaziy tuzilish', partId: 'detail_center' };
    const part2 = partsList[1] || partsList[0] || { label: 'Chap ichki qism', partId: 'detail_left' };
    const part3 = partsList[2] || partsList[1] || partsList[0] || { label: 'O‘ng ichki qism', partId: 'detail_right' };

    const part1Desc =
      resolved.parts_uz?.[0]?.desc ||
      `${part1.label} obyektning asosiy tayanch va funksional markazini tashkil qiladi.`;
    const part2Desc =
      resolved.parts_uz?.[1]?.desc ||
      `${part2.label} ichki jarayonlarning izchil ishlashini ta'minlaydi.`;
    const part3Desc =
      resolved.parts_uz?.[2]?.desc ||
      `${part3.label} umumiy tizimning muhim tarkibiy qismidir.`;

    const base2DRender = {
      kind: 'illustration' as const,
      object_name_uz: resolved.name_uz,
      object_name_en: resolved.name_en,
      svg_data: resolved.svg_data,
      svg_viewbox: resolved.viewBox,
      object_source: resolved.source,
      object_parts: partsList,
      ...(resolved.primitives_3d ? { primitives_3d: resolved.primitives_3d } : {}),
    };

    const base3DRender = hasComposite3D
      ? {
          shape: 'composite3d' as const,
          object_name_uz: resolved.name_uz,
          object_name_en: resolved.name_en,
          primitives_3d: resolved.primitives_3d,
          model_url: resolved.model_url,
          svg_data: resolved.svg_data,
          svg_viewbox: resolved.viewBox,
        }
      : {
          shape: 'svg_extrude' as const,
          object_name_uz: resolved.name_uz,
          object_name_en: resolved.name_en,
          svg_data: resolved.svg_data,
          svg_viewbox: resolved.viewBox,
          model_url: resolved.model_url,
        };

    const describeInternalMotion = (label: string, partId: string, desc: string): string => {
      const lowerPart = `${label} ${partId}`.toLowerCase();
      if (/coil|winding|chulg|inductor|g'altak/.test(lowerPart)) {
        return `Ichki o‘ramlarda o‘zgaruvchan elektr zaryadlari tebranib, atrofida magnit oqimini hosil qilmoqda: ${desc}`;
      }
      if (/core|o'zak|o‘zak/.test(lowerPart)) {
        return `O‘zak ichida yopiq magnit oqimi impuls shaklida bir tomondan ikkinchi tomonga uzluksiz oqib o‘tmoqda: ${desc}`;
      }
      if (/rotor|blade|parrak|runner|impeller|turbine|val|crankshaft/.test(lowerPart)) {
        return `Aylanuvchi mexanizm ichida bu detal o‘q atrofida moment bilan aylanib energiyani uzatmoqda: ${desc}`;
      }
      if (/tower|minora|cable|kabel|support/.test(lowerPart)) {
        return `Minora ichidagi kuch kabellari bo‘ylab generatordan kelayotgan elektr toki pastga — podstansiya tomon oqib o‘tmoqda: ${desc}`;
      }
      if (/piston|porshen|cylinder|silindr|spark|boiler|qozon/.test(lowerPart)) {
        return `Ichki kamerada bosim va harorat ta’sirida porshen hamda gaz-suyuqlik oqimi davriy harakatlanmoqda: ${desc}`;
      }
      if (/penstock|fluid|suyuqlik|intake|outlet|quvur/.test(lowerPart)) {
        return `Quvur ichida bosimli suyuqlik zarralari kanal bo‘ylab tezlik bilan harakatlanmoqda: ${desc}`;
      }
      if (/stator|generator|nacelle|commutator|brushes|inverter|pv|plates/.test(lowerPart)) {
        return `Tashqi qobiq shaffoflashtirildi — ichki qismda tok va maydon chiziqlari uzluksiz almashinib ishlamoqda: ${desc}`;
      }
      return `Ushbu detal ichidagi ishchi jarayonni kuzating: ${desc}`;
    };

    const step2Speech = use3D
      ? `E’tiboringizni aynan ${part1.label} qismiga qarating! ${describeInternalMotion(part1.label, part1.partId, part1Desc)}`
      : `E’tiboringizni ${part1.label} qismiga qarating! ${describeInternalMotion(part1.label, part1.partId, part1Desc)}`;
    const step3Speech =
      partsList.length >= 3
        ? use3D
          ? `Endi fokusingizni ${part2.label} va ${part3.label} qismlariga qarating. ${describeInternalMotion(part2.label, part2.partId, part2Desc)} ${part3Desc}`
          : `Endi ${part2.label} va ${part3.label} qismlarini yaqindan ko'ramiz. ${part2Desc} ${part3Desc}`
        : use3D
        ? `Endi fokusingizni ${part2.label} qismiga qarating: ${describeInternalMotion(part2.label, part2.partId, part2Desc)}`
        : `Endi ${part2.label} qismini yaqindan tahlil qilamiz: ${part2Desc}`;

    const quizQuestion = isBotanical
      ? `${capUz} yashil rangda bo'lishi va quyosh nuridan ozuqa tayyorlashida qaysi jarayon asosiy rol o'ynaydi?`
      : `"${capUz}" tasviri qaysi manbadan olinib keshga saqlandi va keyingi safar nega tezroq ochiladi?`;

    const quizOptions = isBotanical
      ? [
          'Fotosintez (xlorofill ishtirokida)',
          'Faqat shamol ta’sirida',
          'Metall oksidlanishi',
        ]
      : [
          'Mahalliy bazaga (Auto-Cache) saqlangani uchun',
          'Har safar qaytadan chizilmasligi uchun o‘chiriladi',
          'Faqat rasm kattalashgani uchun',
        ];

    const quizExplanation = isBotanical
      ? `To'g'ri! Yashil o'simlik va daraxtlar barglaridagi xlorofill yordamida fotosintez jarayonini bajaradi.`
      : `To'g'ri! Yangi obyektlar (${sourceBadge}) bir marta topilgach mahalliy bazaga saqlanadi va keyingi safar 0.01 soniyada ochiladi.`;

    const lowerObj = `${resolved.name_en} ${resolved.name_uz}`.toLowerCase();
    const inferredFlowType: FlowType =
      /\b(transformer|transformator|inductor|coil|generator|alternator|dynamo|motor|dvigatel|turbine|turbina|solenoid|capacitor|rlc)\b/.test(
        lowerObj
      )
        ? 'ac'
        : /\b(bulb|lamp|lampochka|battery|circuit|wire|solar|windmill|fan|pump|nasos)\b/.test(lowerObj)
        ? 'dc'
        : /\b(heart|yurak|engine|hydraulic|press|rocket|raketa|volcano|vulqon|sun|quyosh|prism)\b/.test(
            lowerObj
          )
        ? 'pulse'
        : 'none';
    const inferredFlowSpeed =
      inferredFlowType === 'ac'
        ? 1.25
        : inferredFlowType === 'dc'
        ? 1.2
        : inferredFlowType === 'pulse'
        ? 1.2
        : 1.0;

    const getEngineeringFormula = (): string => {
      if (lowerObj.includes('transformer') || lowerObj.includes('transformator')) {
        return '\\frac{U_1}{U_2} = \\frac{N_1}{N_2} = \\frac{I_2}{I_1}';
      }
      if (lowerObj.includes('generator') || lowerObj.includes('alternator') || lowerObj.includes('dynamo')) {
        return 'E = N \\cdot B \\cdot S \\cdot \\omega \\sin(\\omega t)';
      }
      if (lowerObj.includes('electric motor') || lowerObj.includes('elektr dvigatel')) {
        return 'M = B \\cdot I \\cdot S \\cdot N \\sin\\alpha, \\quad P = M\\omega';
      }
      if (lowerObj.includes('hydro turbine') || lowerObj.includes('gidroturbina')) {
        return 'P = \\rho g Q H \\eta \\;\\text{(Vt)}';
      }
      if (lowerObj.includes('steam turbine') || lowerObj.includes("bug'")) {
        return '\\eta_{\\max} = 1 - \\frac{T_2}{T_1}, \\quad P = \\dot{m}\\Delta h \\eta';
      }
      if (lowerObj.includes('wind turbine') || lowerObj.includes('turbina')) {
        return 'P = \\frac{1}{2}\\rho A v^3 C_p \\;\\text{(Betz: } C_p \\le 0.59\\text{)}';
      }
      if (lowerObj.includes('solar panel') || lowerObj.includes('quyosh panel')) {
        return 'P_{el} = \\eta \\cdot E \\cdot A, \\quad \\eta = \\frac{U_{oc}I_{sc}FF}{P_{in}}';
      }
      if (lowerObj.includes('solenoid') || lowerObj.includes('electromagnet')) {
        return 'B = \\mu_0 \\mu_r n I, \\quad L = \\mu_0 \\mu_r n^2 V';
      }
      if (lowerObj.includes('capacitor') || lowerObj.includes('rlc')) {
        return 'W = \\frac{CU^2}{2} + \\frac{LI^2}{2}, \\quad \\omega_0 = \\frac{1}{\\sqrt{LC}}';
      }
      if (lowerObj.includes('hydraulic') || lowerObj.includes('press')) {
        return '\\frac{F_1}{A_1} = \\frac{F_2}{A_2} = P \\;\\text{(Pa)}';
      }
      if (lowerObj.includes('pump') || lowerObj.includes('nasos')) {
        return 'P = \\frac{\\rho g Q H}{\\eta} \\;\\text{(Vt)}';
      }
      if (lowerObj.includes('engine')) {
        return 'A = Q_1 - Q_2, \\quad \\eta = \\frac{Q_1 - Q_2}{Q_1}';
      }
      if (lowerObj.includes('prism') || lowerObj.includes('prizma')) {
        return 'n_1 \\sin\\alpha_1 = n_2 \\sin\\alpha_2, \\quad n = \\frac{c}{v}';
      }
      if (lowerObj.includes('battery') || lowerObj.includes('circuit')) {
        return 'I = \\frac{\\mathcal{E}}{R + r}, \\quad P = I^2 R';
      }
      return `\\text{Obyekt: } \\mathbf{${capUz}} \\; (${resolved.name_en})`;
    };
    const primaryFormula = getEngineeringFormula();

    const baseFourSteps: TutorLesson['steps'] = [
        {
          step_number: 1,
          step_title: use3D
            ? `1. ${capUz} — umumiy 3D ko‘rinish`
            : `1. ${capUz} — umumiy tuzilishni chizish`,
          speech_text: use3D
            ? `Keling, ${capUz} obyektini uch o'lchamli fazoda umumiy ko'rinishda quramiz. Sichqoncha bilan modelni har tomondan aylantirib ko'rishingiz mumkin.`
            : `Keling, avval ${capUz} ning umumiy ko'rinishini qalam bilan chizgandek doskaga to'liq chizamiz.`,
          katex_formulas: [primaryFormula],
          explanation_uz: `1.0x umumiy ko'rinish — "${rawQuery}" (${sourceBadge}).`,
          emoji_emotion: 'explaining',
          cameraZoom: 1.0,
          dimInactiveParts: false,
          flowType: inferredFlowType,
          flowSpeed: inferredFlowSpeed,
          flowReverse: false,
          render_params: use3D
            ? { ...base3DRender, flowType: inferredFlowType, flowSpeed: inferredFlowSpeed }
            : { ...base2DRender, flowType: inferredFlowType, flowSpeed: inferredFlowSpeed },
          beats: [
            {
              sentence: use3D
                ? `Keling, ${capUz} obyektini uch o'lchamli fazoda umumiy ko'rinishda quramiz.`
                : `Keling, avval ${capUz} ning umumiy ko'rinishini qalam bilan chizgandek doskaga chizamiz.`,
              focus_target: use3D ? 'overview' : 'drawing_tip',
              tutor_pose: 'approach',
              camera_zoom: 1.0,
              dimInactiveParts: false,
              flowType: inferredFlowType,
              flowSpeed: inferredFlowSpeed,
              note: use3D ? 'Umumiy 3D model' : 'Kontur chizish',
            },
            {
              sentence: use3D
                ? `Modelning umumiy shakli va qismlarini aylantirib kuzating.`
                : `Asosiy chiziqlar va ranglar to'liq ko'rinishga keldi.`,
              focus_target: 'overview',
              tutor_pose: 'step_back',
              camera_zoom: 1.0,
              dimInactiveParts: false,
              flowType: inferredFlowType,
              flowSpeed: inferredFlowSpeed,
              note: 'Umumiy ko‘rinish',
            },
          ],
          open_question: {
            question: `${capUz} nima uchun xizmat qiladi va uning umumiy tuzilishida qaysi asosiy qismlar bor?`,
            expected_points: `${capUz} ning asosiy vazifasi va qismlari (${part1.label}, ${part2.label}) haqida qisqa tushuncha.`,
            hint_uz: `Qismlar nomi va vazifasini 1-2 gapda yozing.`,
          },
        },
        {
          step_number: 2,
          step_title: `2. ${part1.label} tahlili`,
          speech_text: step2Speech,
          katex_formulas: [
            `\\text{1-qism: } \\mathbf{${part1.label}}`,
          ],
          explanation_uz: `${part1.label}: ${part1Desc}`,
          emoji_emotion: 'pointing',
          focusPart: part1.partId,
          cameraZoom: 1.72,
          dimInactiveParts: true,
          flowType: inferredFlowType,
          flowSpeed: clampFlowSpeedServer(inferredFlowSpeed * 1.1),
          flowReverse: false,
          render_params: use3D
            ? {
                ...base3DRender,
                flowType: inferredFlowType,
                flowSpeed: clampFlowSpeedServer(inferredFlowSpeed * 1.1),
              }
            : {
                ...base2DRender,
                highlight: ['parts'],
                flowType: inferredFlowType,
                flowSpeed: clampFlowSpeedServer(inferredFlowSpeed * 1.1),
              },
          beats: [
            {
              sentence: step2Speech,
              focus_target: part1.partId,
              focusPart: part1.partId,
              tutor_pose: 'approach',
              camera_zoom: 1.72,
              dimInactiveParts: true,
              flowType: inferredFlowType,
              flowSpeed: clampFlowSpeedServer(inferredFlowSpeed * 1.1),
              note: part1.label,
            },
          ],
          open_question: {
            question: `${capUz} dagi "${part1.label}" qismi qanday vazifani bajaradi?`,
            expected_points: part1Desc,
            hint_uz: `${part1.label} nimani ta'minlashini o'z so'zingiz bilan yozing.`,
          },
        },
        {
          step_number: 3,
          step_title: `3. ${part2.label} va ${part3.label}`,
          speech_text: step3Speech,
          katex_formulas:
            part3.partId !== part2.partId
              ? [
                  `\\text{2-qism: } \\mathbf{${part2.label}}`,
                  `\\text{3-qism: } \\mathbf{${part3.label}}`,
                ]
              : [`\\text{2-qism: } \\mathbf{${part2.label}}`],
          explanation_uz:
            part3.partId !== part2.partId
              ? `${part2.label} · ${part3.label}`
              : `${part2.label}: ${part2Desc}`,
          emoji_emotion: 'thinking',
          focusPart: part2.partId,
          cameraZoom: 1.82,
          dimInactiveParts: true,
          flowType: inferredFlowType,
          flowSpeed: clampFlowSpeedServer(inferredFlowSpeed * 1.2),
          flowReverse: inferredFlowType === 'ac',
          render_params: use3D
            ? {
                ...base3DRender,
                flowType: inferredFlowType,
                flowSpeed: clampFlowSpeedServer(inferredFlowSpeed * 1.2),
                flowReverse: inferredFlowType === 'ac',
              }
            : {
                ...base2DRender,
                highlight: ['parts'],
                flowType: inferredFlowType,
                flowSpeed: clampFlowSpeedServer(inferredFlowSpeed * 1.2),
                flowReverse: inferredFlowType === 'ac',
              },
          beats:
            part3.partId !== part2.partId
              ? [
                  {
                    sentence: `${part2.label} qismiga yaqinlashamiz: ${part2Desc}`,
                    focus_target: part2.partId,
                    focusPart: part2.partId,
                    tutor_pose: 'approach',
                    camera_zoom: 1.78,
                    dimInactiveParts: true,
                    flowType: inferredFlowType,
                    flowSpeed: clampFlowSpeedServer(inferredFlowSpeed * 1.2),
                    flowReverse: inferredFlowType === 'ac',
                    note: part2.label,
                  },
                  {
                    sentence: `${part3.label} qismiga o'tamiz: ${part3Desc}`,
                    focus_target: part3.partId,
                    focusPart: part3.partId,
                    tutor_pose: 'approach',
                    camera_zoom: 1.84,
                    dimInactiveParts: true,
                    flowType: inferredFlowType,
                    flowSpeed: clampFlowSpeedServer(inferredFlowSpeed * 1.2),
                    flowReverse: inferredFlowType === 'ac',
                    note: part3.label,
                  },
                ]
              : [
                  {
                    sentence: step3Speech,
                    focus_target: part2.partId,
                    focusPart: part2.partId,
                    tutor_pose: 'approach',
                    camera_zoom: 1.8,
                    dimInactiveParts: true,
                    flowType: inferredFlowType,
                    flowSpeed: clampFlowSpeedServer(inferredFlowSpeed * 1.2),
                    flowReverse: inferredFlowType === 'ac',
                    note: part2.label,
                  },
                ],
          open_question: {
            question: `${part2.label}${part3.partId !== part2.partId ? ` va ${part3.label}` : ''} qismlari o‘zaro qanday hamkorlikda ishlaydi?`,
            expected_points: `${part2Desc} ${part3Desc}`,
            hint_uz: `Har ikki qismning bir-biriga bog'liqligini tushuntiring.`,
          },
        },
        {
          step_number: 4,
          step_title: '4. Umumiy ko‘rinish va sinov',
          speech_text: `Endi barcha qismlarni yana birgalikda umumiy ko'rinishda ko'ramiz. ${quizQuestion}`,
          katex_formulas: [`\\text{Xulosa: } \\mathbf{${capUz}}`],
          explanation_uz: `1.0x umumiy ko'rinish · O'z so'zingiz bilan javob yozing.`,
          emoji_emotion: 'encouraging',
          cameraZoom: 1.0,
          dimInactiveParts: false,
          flowType: inferredFlowType,
          flowSpeed: inferredFlowSpeed,
          flowReverse: false,
          render_params: use3D
            ? { ...base3DRender, flowType: inferredFlowType, flowSpeed: inferredFlowSpeed }
            : { ...base2DRender, flowType: inferredFlowType, flowSpeed: inferredFlowSpeed },
          beats: [
            {
              sentence: `Endi barcha qismlarni yana birgalikda umumiy ko'rinishda ko'ramiz.`,
              focus_target: 'overview',
              tutor_pose: 'step_back',
              camera_zoom: 1.0,
              dimInactiveParts: false,
              flowType: inferredFlowType,
              flowSpeed: inferredFlowSpeed,
              note: 'Umumiy ko‘rinish (1.0x)',
            },
            {
              sentence: quizQuestion,
              focus_target: 'overview',
              tutor_pose: 'step_back',
              camera_zoom: 1.0,
              dimInactiveParts: false,
              flowType: inferredFlowType,
              flowSpeed: inferredFlowSpeed,
              note: 'Yozma tekshiruv',
            },
          ],
          open_question: {
            question: quizQuestion,
            expected_points: quizExplanation,
            hint_uz: `Darsdagi asosiy xulosani 1-2 jumla bilan yozing.`,
          },
          quiz: {
            question: quizQuestion,
            options: quizOptions,
            correct_index: 0,
            explanation_uz: quizExplanation,
          },
        },
      ];

    const finalSteps: TutorLesson['steps'] = [];
    if (targetStepCount <= 4) {
      finalSteps.push(...baseFourSteps);
    } else {
      finalSteps.push(baseFourSteps[0], baseFourSteps[1], baseFourSteps[2]);
      const extraNeeded = targetStepCount - 4;
      for (let i = 0; i < extraNeeded; i++) {
        const part = partsList[i % Math.max(1, partsList.length)] || part1;
        const stepNum = 4 + i;
        const extraDesc =
          resolved.parts_uz?.[i % Math.max(1, resolved.parts_uz?.length || 1)]?.desc ||
          `${part.label} qismining amaliy ahamiyati va ish tartibi.`;
        const extraMotionSpeech = use3D
          ? `${stepNum}-qadamda e’tiboringizni aynan ${part.label} qismiga qarating! ${describeInternalMotion(part.label, part.partId, extraDesc)}`
          : `${stepNum}-qadamda ${capUz} tarkibidagi ${part.label} qismining o'ziga xos jihatlarini batafsil ko'rib chiqamiz. ${extraDesc}`;
        finalSteps.push({
          step_number: stepNum,
          step_title: `${stepNum}. ${part.label} — chuqur tahlil`,
          speech_text: extraMotionSpeech,
          katex_formulas: [`\\text{${stepNum}-qism: } \\mathbf{${part.label}}`],
          explanation_uz: extraDesc,
          emoji_emotion: i % 2 === 0 ? 'pointing' : 'thinking',
          focusPart: part.partId,
          cameraZoom: 1.74,
          dimInactiveParts: true,
          flowType: inferredFlowType,
          flowSpeed: inferredFlowSpeed,
          flowReverse: i % 2 === 1 && inferredFlowType === 'ac',
          render_params: use3D
            ? { ...base3DRender, flowType: inferredFlowType, flowSpeed: inferredFlowSpeed }
            : { ...base2DRender, highlight: ['parts'], flowType: inferredFlowType, flowSpeed: inferredFlowSpeed },
          beats: [
            {
              sentence: `${part.label} bo'yicha chuqur tahlil: ${extraDesc}`,
              focus_target: part.partId,
              focusPart: part.partId,
              tutor_pose: 'approach',
              camera_zoom: 1.74,
              dimInactiveParts: true,
              flowType: inferredFlowType,
              flowSpeed: inferredFlowSpeed,
              note: part.label,
            },
          ],
          open_question: {
            question: `Nima uchun ${part.label} qismi ${capUz} ning to'g'ri ishlashida muhim o'rin tutadi?`,
            expected_points: extraDesc,
            hint_uz: `${part.label} ning amaliy vazifasini qisqa yozing.`,
          },
        });
      }
      finalSteps.push({
        ...baseFourSteps[3],
        step_number: targetStepCount,
        step_title: `${targetStepCount}. Umumiy ko‘rinish va yakuniy sinov`,
      });
    }

    return {
      id: `obj-${resolved.name_en.replace(/\s+/g, '-')}-n${targetStepCount}`,
      topic_title: use3D ? `${capUz} — 3D Model va Chizma` : `${capUz} — Chizma va Tahlil`,
      subject,
      engine: use3D ? 'threejs' : 'svg2d',
      requested_steps: targetStepCount,
      source: resolved.from_cache ? 'cache' : 'local-parser',
      latency_ms: resolved.latency_ms,
      token_usage: resolved.token_usage ?? ZERO_TOKEN_USAGE,
      sliders: use3D
        ? [
            {
              id: 'scale',
              label: 'Model o‘lchami',
              min: 0.6,
              max: 1.6,
              step: 0.1,
              default: 1.0,
              unit: 'x',
            },
          ]
        : [],
      steps: finalSteps,
    };
  }
}

export interface TutorResolveRouterDeps {
  dataDir: string;
  getGeminiClient: (apiVersion?: string) => GoogleGenAI | null;
}

export function createTutorResolveRouter(deps: TutorResolveRouterDeps): {
  router: Router;
  objectResolver: SmartObjectResolver;
} {
  const { dataDir, getGeminiClient } = deps;
  const topicCacheFile = path.join(dataDir, 'topic-cache.json');
  const objectResolver = new SmartObjectResolver(dataDir, () => getGeminiClient());

  function loadDynamicCache(): DynamicCacheEntry[] {
    try {
      if (fs.existsSync(topicCacheFile)) {
        const raw = fs.readFileSync(topicCacheFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return (parsed as DynamicCacheEntry[]).filter(
          (e) =>
            typeof e?.normalizedKey === 'string' &&
            e.normalizedKey.startsWith('v14:')
        );
      }
    } catch {
      // ignore corrupt cache
    }
    return [];
  }

  function saveDynamicCache(entries: DynamicCacheEntry[]) {
    try {
      fs.writeFileSync(
        topicCacheFile,
        JSON.stringify(entries.slice(0, 200), null, 2),
        'utf-8'
      );
    } catch {
      // ignore write failure on read-only fs
    }
  }

  let dynamicCache: DynamicCacheEntry[] = loadDynamicCache();

  function findCachedLesson(query: string, requestedStepCount = 4): TutorLesson | null {
    const safeSteps = clampRequestedStepCount(requestedStepCount, 4);
    if (safeSteps <= 4) {
      const builtIn = findBuiltInCachedLesson(query);
      if (builtIn) {
        return builtIn;
      }
    }

    const norm = normalizeQuery(query);
    const canonical = normalizeCacheSearchText(query);
    if (!norm && !canonical) return null;

    const normalizedForFlowCheck = normalizeUzToken(query);
    const isStrictlyAbstractFlow =
      /\b(algoritm|blok\s*sxema|dasturlash|kod|qadamlar|xronologiya|tarix|sulola|urush|grammatika|morfologiya|sintaksis|gap\s*bolak|fe['`]?l|ot\s*soz|sifat|soz\s*turkum)\b/i.test(
        normalizedForFlowCheck
      );

    const exactV14Key = `v14:n${safeSteps}:${norm}`;
    for (const entry of dynamicCache) {
      if (entry.lesson?.engine === 'mermaid' && !isStrictlyAbstractFlow) {
        continue;
      }
      if (entry.normalizedKey === exactV14Key) {
        return entry.lesson;
      }
      const entryKeyRaw = entry.normalizedKey.replace(/^v\d+:(?:n\d+:)?/, '');
      if (
        safeSteps === 4 &&
        canonical &&
        (normalizeCacheSearchText(entry.query) === canonical ||
          normalizeCacheSearchText(entryKeyRaw) === canonical) &&
        (entry.lesson?.steps?.length ?? 4) <= 5
      ) {
        return entry.lesson;
      }
    }
    return null;
  }

  const router: Router = express.Router();

  // List cached real-world objects (Auto-Cache store)
  router.get('/api/objects', (_req: Request, res: Response) => {
    res.json({ objects: objectResolver.listCachedObjects() });
  });

  // 5-Step Smart Fallback & Auto-Cache Object Resolver Endpoint
  router.post('/api/objects/resolve', async (req: Request, res: Response) => {
    const { query = '', mode } = req.body as {
      query?: string;
      mode?: '2d' | '3d';
    };
    const trimmed = String(query || '').trim();
    if (!trimmed) {
      res.status(400).json({ error: 'Obyekt nomi kiritilmadi' });
      return;
    }
    try {
      const outcome = await objectResolver.resolveObject(trimmed, mode);
      if (!outcome) {
        res.status(404).json({ error: `"${trimmed}" obyekti topilmadi` });
        return;
      }
      res.json({
        object: outcome.resolved,
        intent: outcome.intent,
        token_usage: outcome.resolved.token_usage ?? ZERO_TOKEN_USAGE,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Obyektni yuklashda xatolik',
      });
    }
  });

  // List available cached lessons
  router.get('/api/lessons', (_req: Request, res: Response) => {
    const builtIn = CACHED_LESSONS.map((l) => ({
      id: l.id,
      topic_title: l.topic_title,
      subject: l.subject,
      engine: l.engine,
      step_count: l.steps.length,
    }));
    const dynamic = dynamicCache.map((d, idx) => ({
      id: d.lesson.id || `dyn-${idx}`,
      topic_title: d.lesson.topic_title,
      subject: d.lesson.subject,
      engine: d.lesson.engine,
      step_count: d.lesson.steps.length,
    }));
    res.json({ lessons: [...builtIn, ...dynamic] });
  });

  const finalizeDirectorLesson = async (
    rawText: string,
    directorUsage: TokenUsageInfo,
    trimmedQuery: string,
    imageBase64: string | undefined,
    t0: number,
    prewarmedCache?: Map<string, ReturnType<SmartObjectResolver['resolveObject']>>,
    requestedStepCount = 4
  ): Promise<{ lesson: TutorLesson; token_usage: TokenUsageInfo; latency_ms: number }> => {
    const cleanText = rawText.trim();
    if (!cleanText) {
      throw new Error("AI bo'sh javob qaytardi.");
    }

    const parsed = JSON.parse(cleanText) as TutorLesson;
    if (!parsed.steps || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error('Dars bosqichlari topilmadi.');
    }

    const normalizedForFlowCheck = normalizeUzToken(trimmedQuery);
    const isStrictlyAbstractFlow =
      /\b(algoritm|blok\s*sxema|dasturlash|kod|qadamlar|xronologiya|tarix|sulola|urush|grammatika|morfologiya|sintaksis|gap\s*bolak|fe['`]?l|ot\s*soz|sifat|soz\s*turkum)\b/i.test(
        normalizedForFlowCheck
      );

    // Never show 4-corner Mermaid rectangles for physical, technical, biological, chemical, or everyday visual topics!
    const shouldReplaceMermaidWithVisual =
      Boolean(trimmedQuery) &&
      !isStrictlyAbstractFlow &&
      (parsed.engine === 'mermaid' ||
        parsed.steps.some((st) => Boolean((st.render_params as Record<string, unknown> | undefined)?.diagram)));

    const wants3DMode = /\b3\s*d\b|uch\s*o['‘’`ʻ]?lchamli|hajmli/i.test(trimmedQuery);

    const illustrationPromises = new Map<string, ReturnType<SmartObjectResolver['resolveObject']>>(
      prewarmedCache ? Array.from(prewarmedCache.entries()) : []
    );
    const getHydratedObject = (termUzOrEn: string, englishHint?: string, mode: '2d' | '3d' = '2d') => {
      const key = `${mode}:${(englishHint || termUzOrEn).toLowerCase().trim()}`;
      let p = illustrationPromises.get(key);
      if (!p) {
        p = objectResolver.resolveObject(termUzOrEn, mode, englishHint);
        illustrationPromises.set(key, p);
      }
      return p;
    };

    let upgradedOutcome: Awaited<ReturnType<SmartObjectResolver['resolveObject']>> | null = null;
    if (shouldReplaceMermaidWithVisual) {
      const existingHint = parsed.steps
        .map((st) => st.render_params?.object_name_en)
        .find((v) => typeof v === 'string' && v.trim().length > 0);
      upgradedOutcome = await getHydratedObject(
        trimmedQuery,
        existingHint,
        wants3DMode ? '3d' : '2d'
      );
      if (upgradedOutcome) {
        parsed.engine =
          wants3DMode && (upgradedOutcome.resolved.primitives_3d?.length || upgradedOutcome.resolved.model_url || upgradedOutcome.resolved.svg_data)
            ? 'threejs'
            : 'svg2d';
      }
    }

    const normalizedSteps = await Promise.all(
      parsed.steps.map(async (s, idx) => {
        const raw = s as unknown as Record<string, unknown>;
        const rp = {
          ...((raw.render_params || raw.plot_config || {}) as TutorLesson['steps'][number]['render_params']),
        };

        if (shouldReplaceMermaidWithVisual && upgradedOutcome) {
          delete rp.diagram;
          delete rp.highlight_nodes;
          if (parsed.engine === 'threejs') {
            if (upgradedOutcome.resolved.primitives_3d && upgradedOutcome.resolved.primitives_3d.length > 0) {
              rp.shape = 'composite3d';
              rp.primitives_3d = upgradedOutcome.resolved.primitives_3d;
            } else {
              rp.shape = 'svg_extrude';
            }
            rp.object_name_uz = upgradedOutcome.resolved.name_uz;
            rp.object_name_en = upgradedOutcome.resolved.name_en;
            rp.svg_data = upgradedOutcome.resolved.svg_data;
            rp.svg_viewbox = upgradedOutcome.resolved.viewBox;
            rp.model_url = upgradedOutcome.resolved.model_url;
          } else {
            rp.kind = 'illustration';
            rp.object_name_uz = upgradedOutcome.resolved.name_uz;
            rp.object_name_en = upgradedOutcome.resolved.name_en;
            rp.svg_data = upgradedOutcome.resolved.svg_data;
            rp.svg_viewbox = upgradedOutcome.resolved.viewBox;
            rp.object_source = upgradedOutcome.resolved.source;
            if (upgradedOutcome.resolved.primitives_3d) {
              rp.primitives_3d = upgradedOutcome.resolved.primitives_3d;
            }
          }
          if (!rp.object_parts && upgradedOutcome.resolved.parts_uz) {
            rp.object_parts = upgradedOutcome.resolved.parts_uz.map((p, pIdx) => ({
              label: p.label,
              partId: p.partId || `part_${pIdx}`,
            }));
          }
        }

        if (
          parsed.engine === 'svg2d' &&
          ![
            'pythagoras',
            'triangle',
            'circle',
            'unit_circle',
            'polygon',
            'photosynthesis',
            'sky_scattering',
            'illustration',
            'custom_2d_svg',
            'physics_sim',
          ].includes(rp.kind || '')
        ) {
          rp.kind = rp.custom_svg?.svg ? 'custom_2d_svg' : 'illustration';
        }

        // Hydrate custom_svg -> svg_data if Director emitted custom_svg directly
        if (rp.custom_svg?.svg && !rp.svg_data) {
          const clean = sanitizeSvgString(rp.custom_svg.svg);
          if (clean) {
            rp.svg_data = clean.svg_data;
            rp.svg_viewbox = rp.custom_svg.viewBox || clean.viewBox;
          }
        }

        // Hydrate threejs object scenes lacking 3D geometry
        const needs3DObjectHydration =
          parsed.engine === 'threejs' &&
          !['pyramid', 'cone', 'prism', 'cylinder', 'sphere', 'cube', 'vectors', 'projectile', 'quadric', 'parametric'].includes(rp.shape || '') &&
          (!rp.primitives_3d || rp.primitives_3d.length === 0) &&
          (!rp.custom_3d_objects || rp.custom_3d_objects.length === 0) &&
          !rp.model_url;

        if (needs3DObjectHydration) {
          const lookupTerm = rp.object_name_uz || rp.object_name_en || trimmedQuery;
          if (lookupTerm) {
            const hydrated = await getHydratedObject(lookupTerm, rp.object_name_en, '3d');
            if (hydrated) {
              rp.object_name_uz = rp.object_name_uz || hydrated.resolved.name_uz;
              rp.object_name_en = rp.object_name_en || hydrated.resolved.name_en;
              rp.svg_data = rp.svg_data || hydrated.resolved.svg_data;
              rp.svg_viewbox = rp.svg_viewbox || hydrated.resolved.viewBox;
              rp.model_url = rp.model_url || hydrated.resolved.model_url;
              if (hydrated.resolved.primitives_3d && hydrated.resolved.primitives_3d.length > 0) {
                rp.shape = 'composite3d';
                rp.primitives_3d = hydrated.resolved.primitives_3d;
              } else {
                rp.shape = rp.shape || 'svg_extrude';
              }
              if (!rp.object_parts && hydrated.resolved.parts_uz) {
                rp.object_parts = hydrated.resolved.parts_uz.map((p, pIdx) => ({
                  label: p.label,
                  partId: p.partId || `part_${pIdx}`,
                }));
              }
            }
          }
        }

        if ((rp.kind === 'illustration' || rp.kind === 'custom_2d_svg') && !rp.svg_data) {
          const lookupTerm = rp.object_name_uz || rp.object_name_en || trimmedQuery;
          if (lookupTerm) {
            const hydrated = await getHydratedObject(lookupTerm, rp.object_name_en, wants3DMode ? '3d' : '2d');
            if (hydrated) {
              rp.object_name_uz = rp.object_name_uz || hydrated.resolved.name_uz;
              rp.object_name_en = rp.object_name_en || hydrated.resolved.name_en;
              rp.svg_data = hydrated.resolved.svg_data;
              rp.svg_viewbox = hydrated.resolved.viewBox;
              rp.object_source = hydrated.resolved.source;
              if (hydrated.resolved.primitives_3d) {
                rp.primitives_3d = hydrated.resolved.primitives_3d;
              }
              if (!rp.object_parts && hydrated.resolved.parts_uz) {
                rp.object_parts = hydrated.resolved.parts_uz.map((p, pIdx) => ({
                  label: p.label,
                  partId: p.partId || `part_${pIdx}`,
                }));
              }
            }
          }
        } else if (rp.kind === 'illustration' && !rp.primitives_3d) {
          const proc3D = generateProceduralPrimitives3D(rp.object_name_en || rp.object_name_uz || trimmedQuery);
          if (proc3D) rp.primitives_3d = proc3D;
        }

        const beatExplicitFocus = Array.isArray(s.beats)
          ? s.beats
              .map((b) => b.focusPart || (b.focus_target && b.focus_target !== 'overview' && b.focus_target !== 'drawing_tip' ? b.focus_target : undefined))
              .find(Boolean)
          : undefined;

        const isIntroStep = idx === 0 && !s.focusPart && !beatExplicitFocus;
        const isFinalSummaryOrQuiz =
          parsed.steps.length > 1 &&
          idx === parsed.steps.length - 1 &&
          Boolean(s.quiz) &&
          !s.focusPart &&
          !beatExplicitFocus;

        const validPartIds = [
          ...(rp.object_parts?.map((p) => p.partId).filter((id): id is string => Boolean(id)) || []),
          ...(rp.primitives_3d?.map((p) => p.partId).filter((id): id is string => Boolean(id)) || []),
        ];

        const fallbackPart =
          validPartIds[Math.max(0, (idx - 1) % Math.max(1, validPartIds.length))] ||
          (idx % 2 === 1 ? 'detail_center' : 'detail_left');

        const defaultFocusPart =
          s.focusPart ||
          beatExplicitFocus ||
          (isIntroStep || isFinalSummaryOrQuiz ? undefined : fallbackPart);

        const effectiveFocusPart = isIntroStep || isFinalSummaryOrQuiz ? undefined : defaultFocusPart;
        const defaultZoom =
          typeof s.cameraZoom === 'number'
            ? s.cameraZoom
            : isIntroStep || isFinalSummaryOrQuiz
            ? 1.0
            : effectiveFocusPart
            ? idx === 1 || idx === 2
              ? 1.72
              : 1.32
            : 1.0;
        const defaultDim =
          typeof s.dimInactiveParts === 'boolean'
            ? s.dimInactiveParts
            : !isIntroStep && !isFinalSummaryOrQuiz && Boolean(effectiveFocusPart);

        const emotion = (s.emoji_emotion ||
          (raw.emotion as string) ||
          'explaining') as TutorLesson['steps'][number]['emoji_emotion'];
        const stepFlowType = sanitizeFlowType(s.flowType ?? rp.flowType);
        const stepFlowSpeed = clampFlowSpeedServer(s.flowSpeed ?? rp.flowSpeed, 1.0);
        const stepFlowReverse = Boolean(s.flowReverse ?? rp.flowReverse ?? false);
        if (stepFlowType !== 'none') {
          rp.flowType = stepFlowType;
          rp.flowSpeed = stepFlowSpeed;
          rp.flowReverse = stepFlowReverse;
        }
        const normalizedBeats = Array.isArray(s.beats)
          ? s.beats.map((b) => {
              const chosenFocus =
                b.focusPart ||
                (b.focus_target && b.focus_target !== 'overview' && b.focus_target !== 'drawing_tip'
                  ? b.focus_target
                  : effectiveFocusPart);
              return {
                ...b,
                focusPart: chosenFocus,
                tutor_pose:
                  chosenFocus && b.tutor_pose === 'step_back' ? ('approach' as const) : b.tutor_pose,
                flowType: sanitizeFlowType(b.flowType ?? stepFlowType),
                flowSpeed: clampFlowSpeedServer(b.flowSpeed ?? stepFlowSpeed, stepFlowSpeed),
                flowReverse: Boolean(b.flowReverse ?? stepFlowReverse),
              };
            })
          : s.beats;
        const fallbackOpenQuestion = s.open_question?.question?.trim()
          ? s.open_question
          : s.quiz?.question?.trim()
          ? {
              question: s.quiz.question,
              expected_points: s.quiz.explanation_uz || s.explanation_uz,
              hint_uz: `${s.step_title.replace(/^\d+[\.\)\-\:]\s*/, '')} asosiy qoidasini yozing.`,
            }
          : {
              question: `"${s.step_title.replace(/^\d+[\.\)\-\:]\s*/, '')}" bo‘yicha asosiy fikrni o‘z so‘zingiz bilan tushuntiring.`,
              expected_points: s.explanation_uz || s.speech_text,
              hint_uz: `Asosiy tushuncha yoki formulani qisqa 1-2 gapda yozing.`,
            };

        return {
          ...s,
          step_number: s.step_number || idx + 1,
          emoji_emotion: emotion,
          focusPart: effectiveFocusPart,
          cameraZoom: defaultZoom,
          dimInactiveParts: defaultDim,
          flowType: stepFlowType,
          flowSpeed: stepFlowSpeed,
          flowReverse: stepFlowReverse,
          beats: normalizedBeats,
          open_question: fallbackOpenQuestion,
          render_params: rp,
        };
      })
    );

    const hydratedOutcomes = await Promise.all(Array.from(illustrationPromises.values()));
    const token_usage = mergeTokenUsage(
      directorUsage,
      ...hydratedOutcomes.map((o) => o?.resolved.token_usage)
    );

    const safeRequestedSteps = clampRequestedStepCount(requestedStepCount, 4);
    const latency_ms = Date.now() - t0;
    const lesson: TutorLesson = {
      ...parsed,
      steps: normalizedSteps,
      id: `ai-${Date.now()}`,
      requested_steps: safeRequestedSteps,
      sliders: Array.isArray(parsed.sliders) ? parsed.sliders : [],
      source: 'gemini-director',
      latency_ms,
      token_usage,
    };

    if (!imageBase64 && trimmedQuery) {
      const normalizedKey = `v14:n${safeRequestedSteps}:${normalizeQuery(trimmedQuery)}`;
      dynamicCache = [
        {
          normalizedKey,
          query: trimmedQuery,
          lesson,
          createdAt: new Date().toISOString(),
        },
        ...dynamicCache.filter((e) => e.normalizedKey !== normalizedKey),
      ];
      saveDynamicCache(dynamicCache);
    }

    return { lesson, token_usage, latency_ms };
  };

  const buildDirectorParts = (
    trimmedQuery: string,
    stepCount = 4,
    imageBase64?: string,
    imageMimeType?: string
  ) => {
    const safeSteps = clampRequestedStepCount(stepCount, 4);
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: imageMimeType || 'image/jpeg',
          data: imageBase64,
        },
      });
    }
    parts.push({
      text: trimmedQuery
        ? `O'quvchining savoli: "${trimmedQuery}". Uning bilim darajasiga mos, o'zbek tilida AYNAN ${safeSteps} qadamli (steps massivida ${safeSteps} ta obyekt) interaktiv dars hamda har bir qadam uchun yozma tekshiruv savoli (open_question, variantlarsiz) JSON retseptini yarat.`
        : `Yuklangan rasmdagi masala yoki mavzuni tahlil qilib, o'zbek tilida AYNAN ${safeSteps} qadamli interaktiv dars hamda har bir qadam uchun yozma tekshiruv savoli (open_question, variantlarsiz) JSON retseptini yarat.`,
    });
    return parts;
  };

  const isTransientOrUnavailableError = (err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    return /503|500|502|504|UNAVAILABLE|high demand|overloaded|temporarily|ECONNRESET|ETIMEDOUT/i.test(
      msg
    );
  };

  const formatFriendlyGeminiError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : String(err);
    if (/403|PERMISSION_DENIED|API_KEY_INVALID|400.*API key/i.test(msg)) {
      return "Gemini API kaliti noto‘g‘ri yoki faol emas. Settings > Secrets bo‘limidan tekshiring.";
    }
    if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
      return "AI so‘rovlar limiti vaqtinchalik to‘ldi. Iltimos, birozdan so‘ng qayta urinib ko‘ring.";
    }
    if (isTransientOrUnavailableError(err)) {
      return "AI serverida vaqtinchalik yuklama yuqori (503). Iltimos, bir necha soniyadan so‘ng qayta urinib ko‘ring.";
    }
    return msg.length > 180 ? "AI dars tuzishda xatolik yuz berdi. Qayta urinib ko‘ring." : msg;
  };

  const generateDirectorStreamWithFallback = async (
    ai: GoogleGenAI,
    parts: ReturnType<typeof buildDirectorParts>,
    stepCount: number,
    onProgress: (rawBuffer: string) => void
  ): Promise<{ rawBuffer: string; usageMeta?: GenerateContentResponse['usageMetadata'] }> => {
    const systemInstruction = buildDirectorSystemInstruction(stepCount);
    const attempts: Array<{ model: string; thinkingLevel: ThinkingLevel }> = [
      { model: GEMINI_LITE_MODEL, thinkingLevel: ThinkingLevel.MINIMAL },
      { model: GEMINI_FLASH_MODEL, thinkingLevel: ThinkingLevel.LOW },
    ];

    let lastErr: unknown;
    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      try {
        const stream = await ai.models.generateContentStream({
          model: attempt.model,
          contents: { parts },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: LESSON_RESPONSE_SCHEMA,
            thinkingConfig: { thinkingLevel: attempt.thinkingLevel },
          },
        });

        let rawBuffer = '';
        let lastUsageMeta: GenerateContentResponse['usageMetadata'] | undefined;
        for await (const chunk of stream) {
          const c = chunk as GenerateContentResponse;
          if (c.usageMetadata) {
            lastUsageMeta = c.usageMetadata;
          }
          const chunkText = c.text ?? '';
          if (!chunkText) continue;
          rawBuffer += chunkText;
          onProgress(rawBuffer);
        }

        if (!rawBuffer.trim()) {
          throw new Error("AI bo'sh javob qaytardi.");
        }
        return { rawBuffer, usageMeta: lastUsageMeta };
      } catch (err) {
        lastErr = err;
        if (i < attempts.length - 1 && isTransientOrUnavailableError(err)) {
          await new Promise((r) => setTimeout(r, 350));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  };

  // Fast SSE Streaming Lesson Resolver
  router.post('/api/tutor/resolve-stream', async (req: Request, res: Response) => {
    const t0 = Date.now();
    const { query = '', imageBase64, imageMimeType, stepCount } = req.body as {
      query?: string;
      imageBase64?: string;
      imageMimeType?: string;
      stepCount?: number;
    };
    const requestedStepCount = clampRequestedStepCount(stepCount, 4);

    const trimmedQuery = String(query || '').trim();
    if (!trimmedQuery && !imageBase64) {
      res.status(400).json({ error: 'Savol matni yoki masala rasmini kiriting.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event: string, data: unknown) => {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      if (!imageBase64 && trimmedQuery) {
        const cached = findCachedLesson(trimmedQuery, requestedStepCount);
        if (cached) {
          const latency_ms = Math.max(2, Date.now() - t0);
          sendEvent('complete', {
            stage: 'cache',
            latency_ms,
            token_usage: ZERO_TOKEN_USAGE,
            lesson: {
              ...cached,
              source: 'cache',
              latency_ms,
              token_usage: ZERO_TOKEN_USAGE,
            },
          });
          res.end();
          return;
        }

        if (shouldTreatAsObjectDrawing(trimmedQuery)) {
          sendEvent('status', { message: 'Vektor obyekt va 3D model qidirilmoqda...' });
          const outcome = await objectResolver.resolveObject(trimmedQuery);
          if (outcome) {
            const objLesson = objectResolver.buildObjectDrawingLesson(
              trimmedQuery,
              outcome.resolved,
              requestedStepCount
            );
            const stage = outcome.resolved.from_cache ? 'cache' : 'local-parser';
            const token_usage = objLesson.token_usage ?? ZERO_TOKEN_USAGE;
            sendEvent('complete', {
              stage,
              latency_ms: objLesson.latency_ms || Math.max(2, Date.now() - t0),
              token_usage,
              lesson: { ...objLesson, token_usage },
            });
            res.end();
            return;
          }
        }
      }

      const limitStatus = checkIpRateLimit(req, { bucket: 'ai-lessons' });
      if (!limitStatus.allowed) {
        sendEvent('error', {
          error:
            limitStatus.reason === 'burst'
              ? `Juda ko‘p so‘rov yuborildi. ${limitStatus.retryAfterSec} soniyadan so‘ng qayta urinib ko‘ring.`
              : `Kunlik bepul AI limiti (${limitStatus.limit} ta so‘rov) tugadi. Tayyor kesh darslardan cheklovsiz foydalanishingiz mumkin.`,
        });
        res.end();
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        if (!imageBase64 && trimmedQuery && extractObjectIntent(trimmedQuery).known_in_dict) {
          const outcome = await objectResolver.resolveObject(trimmedQuery);
          if (outcome) {
            const objLesson = objectResolver.buildObjectDrawingLesson(
              trimmedQuery,
              outcome.resolved,
              requestedStepCount
            );
            const stage = outcome.resolved.from_cache ? 'cache' : 'local-parser';
            const token_usage = objLesson.token_usage ?? ZERO_TOKEN_USAGE;
            sendEvent('complete', {
              stage,
              latency_ms: objLesson.latency_ms || Math.max(2, Date.now() - t0),
              token_usage,
              lesson: { ...objLesson, token_usage },
            });
            res.end();
            return;
          }
        }
        sendEvent('error', {
          error:
            "Gemini API kaliti sozlanmagan. Iltimos, AI Studio Settings > Secrets bo'limida GEMINI_API_KEY ni kiriting.",
        });
        res.end();
        return;
      }

      sendEvent('status', { message: 'Mirvo AI mavzuni tahlil qilmoqda...' });
      const parts = buildDirectorParts(trimmedQuery, requestedStepCount, imageBase64, imageMimeType);

      let lastNotifiedSteps = -1;
      let detectedTitle = '';
      const streamWants3D = /\b3\s*d\b|uch\s*o['‘’`ʻ]?lchamli|hajmli/i.test(trimmedQuery);
      const streamMode: '2d' | '3d' = streamWants3D ? '3d' : '2d';
      const prewarmedIllustrations = new Map<string, ReturnType<SmartObjectResolver['resolveObject']>>();
      const triggeredObjHints = new Set<string>();

      const { rawBuffer, usageMeta } = await generateDirectorStreamWithFallback(
        ai,
        parts,
        requestedStepCount,
        (currentBuf) => {
          if (!detectedTitle) {
            const titleMatch = currentBuf.match(/"topic_title"\s*:\s*"([^"]+)"/);
            if (titleMatch?.[1]) {
              detectedTitle = titleMatch[1];
            }
          }

          // Pre-warm SVG/object lookups as soon as object_name_en streams in, parallelizing with remaining steps
          const enMatches = currentBuf.matchAll(/"object_name_en"\s*:\s*"([^"]+)"/g);
          for (const m of enMatches) {
            const hintEn = (m[1] || '').trim();
            const key = `${streamMode}:${hintEn.toLowerCase()}`;
            if (hintEn && !triggeredObjHints.has(key)) {
              triggeredObjHints.add(key);
              prewarmedIllustrations.set(
                key,
                objectResolver.resolveObject(hintEn, streamMode, hintEn).catch(() => null)
              );
            }
          }

          const stepMatches = currentBuf.match(/"step_number"\s*:\s*\d+/g);
          const stepNum = stepMatches ? Math.min(requestedStepCount, stepMatches.length) : 0;
          if (stepNum !== lastNotifiedSteps) {
            lastNotifiedSteps = stepNum;
            sendEvent('progress', {
              topicTitle: detectedTitle || undefined,
              stepNum,
              elapsedMs: Date.now() - t0,
              message:
                stepNum === 0
                  ? 'Vizual dvigatel tanlanmoqda...'
                  : stepNum < requestedStepCount
                  ? `${stepNum}/${requestedStepCount}-qadam va chizma tuzilmoqda...`
                  : `${requestedStepCount}/${requestedStepCount}-qadam va savollar yakunlanmoqda...`,
            });
          }
        }
      );

      sendEvent('status', { message: 'Sahna va vektorlar tayyorlanmoqda...' });
      const directorUsage = usageFromGeminiMetadata(usageMeta);
      const { lesson, token_usage, latency_ms } = await finalizeDirectorLesson(
        rawBuffer,
        directorUsage,
        trimmedQuery,
        imageBase64,
        t0,
        prewarmedIllustrations,
        requestedStepCount
      );

      sendEvent('complete', { stage: 'gemini-director', latency_ms, token_usage, lesson });
      res.end();
    } catch (err) {
      console.error('Gemini Director stream error:', err);
      sendEvent('error', { error: formatFriendlyGeminiError(err) });
      res.end();
    }
  });

  // Main lesson resolver: Cache -> 5-Step Smart Object Fallback -> Gemini Flash Director (Low-latency)
  router.post('/api/tutor/resolve', async (req: Request, res: Response) => {
    const t0 = Date.now();
    const { query = '', imageBase64, imageMimeType, stepCount, device_tier } = req.body as {
      query?: string;
      imageBase64?: string;
      imageMimeType?: string;
      stepCount?: number;
      device_tier?: 'low' | 'mid' | 'high';
    };
    const requestedStepCount = clampRequestedStepCount(stepCount, 4);
    const deviceTier = device_tier === 'mid' || device_tier === 'high' ? device_tier : 'low';

    const trimmedQuery = String(query || '').trim();
    if (!trimmedQuery && !imageBase64) {
      res.status(400).json({ error: 'Savol matni yoki masala rasmini kiriting.' });
      return;
    }

    const scenePlan = generateSceneArchitecturePlan(trimmedQuery || 'energetika muhandisligi', deviceTier);

    if (!imageBase64 && trimmedQuery) {
      const cached = findCachedLesson(trimmedQuery, requestedStepCount);
      if (cached) {
        const latency_ms = Math.max(2, Date.now() - t0);
        res.json({
          stage: 'cache',
          latency_ms,
          token_usage: ZERO_TOKEN_USAGE,
          scenePlan,
          lesson: {
            ...cached,
            source: 'cache',
            latency_ms,
            token_usage: ZERO_TOKEN_USAGE,
            scenePlan,
          },
        });
        return;
      }

      if (shouldTreatAsObjectDrawing(trimmedQuery)) {
        const outcome = await objectResolver.resolveObject(trimmedQuery);
        if (outcome) {
          const objLesson = objectResolver.buildObjectDrawingLesson(
            trimmedQuery,
            outcome.resolved,
            requestedStepCount
          );
          const stage = outcome.resolved.from_cache ? 'cache' : 'local-parser';
          const token_usage = objLesson.token_usage ?? ZERO_TOKEN_USAGE;
          res.json({
            stage,
            latency_ms: objLesson.latency_ms || Math.max(2, Date.now() - t0),
            token_usage,
            scenePlan,
            lesson: { ...objLesson, token_usage, scenePlan },
          });
          return;
        }
      }
    }

    const limitStatus = checkIpRateLimit(req, { bucket: 'ai-lessons' });
    if (!limitStatus.allowed) {
      sendRateLimitError(res, limitStatus);
      return;
    }
    applyRateLimitHeaders(res, limitStatus);

    const ai = getGeminiClient();
    if (!ai) {
      if (!imageBase64 && trimmedQuery && extractObjectIntent(trimmedQuery).known_in_dict) {
        const outcome = await objectResolver.resolveObject(trimmedQuery);
        if (outcome) {
          const objLesson = objectResolver.buildObjectDrawingLesson(
            trimmedQuery,
            outcome.resolved,
            requestedStepCount
          );
          const stage = outcome.resolved.from_cache ? 'cache' : 'local-parser';
          const token_usage = objLesson.token_usage ?? ZERO_TOKEN_USAGE;
          res.json({
            stage,
            latency_ms: objLesson.latency_ms || Math.max(2, Date.now() - t0),
            token_usage,
            scenePlan,
            lesson: { ...objLesson, token_usage, scenePlan },
          });
          return;
        }
      }
      res.status(503).json({
        error:
          "Gemini API kaliti sozlanmagan. Iltimos, AI Studio Settings > Secrets bo'limida GEMINI_API_KEY ni kiriting.",
      });
      return;
    }

    try {
      const parts = buildDirectorParts(trimmedQuery, requestedStepCount, imageBase64, imageMimeType);
      const systemInstruction = buildDirectorSystemInstruction(requestedStepCount);

      let response;
      try {
        response = await ai.models.generateContent({
          model: GEMINI_LITE_MODEL,
          contents: { parts },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: LESSON_RESPONSE_SCHEMA,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          },
        });
      } catch (primaryErr) {
        if (!isTransientOrUnavailableError(primaryErr)) throw primaryErr;
        response = await ai.models.generateContent({
          model: GEMINI_FLASH_MODEL,
          contents: { parts },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: LESSON_RESPONSE_SCHEMA,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
      }

      const directorUsage = usageFromGeminiMetadata(response.usageMetadata);
      const { lesson, token_usage, latency_ms } = await finalizeDirectorLesson(
        response.text ?? '',
        directorUsage,
        trimmedQuery,
        imageBase64,
        t0,
        undefined,
        requestedStepCount
      );

      res.json({
        stage: 'gemini-director',
        latency_ms,
        token_usage,
        scenePlan,
        lesson: { ...lesson, scenePlan },
      });
    } catch (err) {
      console.error('Gemini Director error:', err);
      res.status(500).json({ error: formatFriendlyGeminiError(err) });
    }
  });

  // AI Open-Ended Written Answer Verification Endpoint
  router.post('/api/tutor/check-answer', async (req: Request, res: Response) => {
    const {
      lessonTitle = '',
      stepTitle = '',
      stepExplanation = '',
      formulas = [],
      question = '',
      expectedPoints = '',
      userAnswer = '',
    } = (req.body || {}) as {
      lessonTitle?: string;
      stepTitle?: string;
      stepExplanation?: string;
      formulas?: string[];
      question?: string;
      expectedPoints?: string;
      userAnswer?: string;
    };

    const trimmedAnswer = String(userAnswer || '').trim();
    if (trimmedAnswer.length < 2) {
      res.status(400).json({
        passed: false,
        score: 0,
        feedback_uz: "Iltimos, savolga o'z so'zingiz bilan qisqa javob yozing.",
      });
      return;
    }

    const limitStatus = checkIpRateLimit(req, {
      bucket: 'ai-answer-checks',
      dailyLimit: 120,
      burstLimit: 25,
    });
    if (!limitStatus.allowed) {
      sendRateLimitError(res, limitStatus);
      return;
    }
    applyRateLimitHeaders(res, limitStatus);

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          "Gemini API kaliti sozlanmagan. Javobni AI tekshirishi uchun GEMINI_API_KEY talab qilinadi.",
      });
      return;
    }

    const gradingPrompt = `Sen "Mirvo AI" — mehribon va adolatli o'zbek tilidagi fan o'qituvchisisan.
O'quvchi dars bosqichi yakunidagi ochiq nazorat savoliga yozma javob berdi. Javobni mazmunan tekshir.

Dars mavzusi: "${lessonTitle}"
Bosqich: "${stepTitle}"
Bosqich tushuntirishi: "${stepExplanation}"
${Array.isArray(formulas) && formulas.length > 0 ? `Formulalar: ${formulas.join(', ')}` : ''}
Berilgan savol: "${question}"
Kutilgan asosiy mazmun / to'g'ri yo'nalish: "${expectedPoints || stepExplanation}"
O'quvchining yozgan javobi: "${trimmedAnswer}"

Baholash qoidalari:
1. Imloviy xatolar, apostrof farqlari (o' / o‘ / o) yoki qisqa yozilishiga qattiq turib olma — asosiy ma'no to'g'ri bo'lsa "passed": true ber.
2. Agar javob mavzuga aloqasiz, "bilmayman", bitta ma'nosiz harf/belgi, yoki ilmiy jihatdan noto'g'ri bo'lsa "passed": false ber.
3. "feedback_uz": o'zbek tilida samimiy, aniq 1-2 gaplik ustoz fikri yoz (to'g'ri bo'lsa maqtab mustahkamla, noto'g'ri bo'lsa aynan qaysi jihat yetishmayotganini tushuntir).
4. "hint_uz": faqat passed=false bo'lganda to'g'ri javobga yo'naltiruvchi qisqa maslahat ber (to'g'ridan-to'g'ri tayyor javobni aytib qo'yma).`;

    try {
      let response;
      try {
        response = await ai.models.generateContent({
          model: GEMINI_FLASH_MODEL,
          contents: gradingPrompt,
          config: {
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                passed: { type: Type.BOOLEAN },
                score: { type: Type.INTEGER },
                feedback_uz: { type: Type.STRING },
                hint_uz: { type: Type.STRING },
              },
              required: ['passed', 'score', 'feedback_uz'],
            },
          },
        });
      } catch (primaryErr) {
        if (!isTransientOrUnavailableError(primaryErr)) throw primaryErr;
        response = await ai.models.generateContent({
          model: GEMINI_LITE_MODEL,
          contents: gradingPrompt,
          config: {
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                passed: { type: Type.BOOLEAN },
                score: { type: Type.INTEGER },
                feedback_uz: { type: Type.STRING },
                hint_uz: { type: Type.STRING },
              },
              required: ['passed', 'score', 'feedback_uz'],
            },
          },
        });
      }

      const usage = usageFromGeminiMetadata(response.usageMetadata);
      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        passed?: boolean;
        score?: number;
        feedback_uz?: string;
        hint_uz?: string;
      };

      const passed = Boolean(parsed.passed);
      const score = Number.isFinite(parsed.score)
        ? Math.max(0, Math.min(100, Math.round(Number(parsed.score))))
        : passed
        ? 90
        : 35;

      res.json({
        passed,
        score,
        feedback_uz:
          parsed.feedback_uz?.trim() ||
          (passed
            ? "Barakalla! Javobingiz asosiy tushunchani to‘g‘ri aks ettirdi."
            : "Javobingiz to‘liq emas. Dars mazmuniga qarab qayta urinib ko‘ring."),
        ...(passed ? {} : { hint_uz: parsed.hint_uz?.trim() || undefined }),
        token_usage: usage,
      });
    } catch (err) {
      console.error('AI answer check error:', err);
      res.status(500).json({ error: formatFriendlyGeminiError(err) });
    }
  });

  // End-of-lesson batch assessment: grades all written answers, returns per-step %, overall %, correct answers & spoken summary.
  // Always falls back cleanly to deterministic Uzbek grading if Gemini API key is missing or temporarily unavailable.
  router.post('/api/tutor/evaluate-lesson', async (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      topicTitle?: string;
      items?: StepEvaluationInput[];
    };
    const topicTitle = String(body.topicTitle || 'Mavzu').trim();
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items: StepEvaluationInput[] = rawItems
      .filter((it) => it && typeof it.question === 'string')
      .map((it, idx) => ({
        stepIndex: Number.isFinite(it.stepIndex) ? it.stepIndex : idx,
        stepTitle: String(it.stepTitle || `${idx + 1}-dars`),
        question: String(it.question || ''),
        expectedPoints: typeof it.expectedPoints === 'string' ? it.expectedPoints : undefined,
        stepExplanation: typeof it.stepExplanation === 'string' ? it.stepExplanation : undefined,
        formulas: Array.isArray(it.formulas) ? it.formulas.map(String) : undefined,
        userAnswer: String(it.userAnswer || '').trim(),
      }));

    if (items.length === 0) {
      res.status(400).json({ error: "Baholash uchun kamida bitta savol va javob talab qilinadi." });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.json(evaluateLessonAnswersLocally(topicTitle, items));
      return;
    }

    const batchPrompt = `Sen "Mirvo AI" — adolatli va aniq o'zbek tilidagi muhandis-o'qituvchisan.
O'quvchi "${topicTitle}" mavzusidagi barcha ${items.length} ta dars savoliga yozma javob berdi.
Har bir savol uchun o'quvchining javobini 0 dan 100 foizgacha bahola, aniq TO'G'RI JAVOBni ("correct_answer_uz") va qisqa fikrni ("feedback_uz") yoz.

Savollar va javoblar:
${items
  .map(
    (it) =>
      `[${it.stepIndex + 1}-dars: ${it.stepTitle}]
Savol: ${it.question}
Kutilgan to'g'ri mazmun: ${it.expectedPoints || it.stepExplanation || ''}
O'quvchi javobi: "${it.userAnswer || 'Javob yozilmagan'}"`
  )
  .join('\n\n')}

Qoidalar:
- Agar o'quvchi sonli qiymat yoki fizik qoidada adashgan bo'lsa (masalan 8 barobar o'rniga 4 marta yozgan bo'lsa), adolatli qisman foiz (masalan 35-45%) qo'y va correct_answer_uz da aniq to'g'ri javob va sababini tushuntir.
- Imloviy xatolar yoki o'/g' belgilaridagi farqlar uchun ball kesma.
- "correct_answer_uz": sof o'zbek tilida, aniq va lo'nda (1-2 gap).
- "feedback_uz": 1 qisqa jumla.`;

    try {
      let response;
      try {
        response = await ai.models.generateContent({
          model: GEMINI_FLASH_MODEL,
          contents: batchPrompt,
          config: {
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      stepIndex: { type: Type.INTEGER },
                      score: { type: Type.INTEGER },
                      correct_answer_uz: { type: Type.STRING },
                      feedback_uz: { type: Type.STRING },
                    },
                    required: ['stepIndex', 'score', 'correct_answer_uz', 'feedback_uz'],
                  },
                },
              },
              required: ['steps'],
            },
          },
        });
      } catch (primaryErr) {
        if (!isTransientOrUnavailableError(primaryErr)) throw primaryErr;
        response = await ai.models.generateContent({
          model: GEMINI_LITE_MODEL,
          contents: batchPrompt,
          config: {
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      stepIndex: { type: Type.INTEGER },
                      score: { type: Type.INTEGER },
                      correct_answer_uz: { type: Type.STRING },
                      feedback_uz: { type: Type.STRING },
                    },
                    required: ['stepIndex', 'score', 'correct_answer_uz', 'feedback_uz'],
                  },
                },
              },
              required: ['steps'],
            },
          },
        });
      }

      const usage = usageFromGeminiMetadata(response.usageMetadata);
      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        steps?: Array<{
          stepIndex?: number;
          score?: number;
          correct_answer_uz?: string;
          feedback_uz?: string;
        }>;
      };

      const localFallback = evaluateLessonAnswersLocally(topicTitle, items);
      const aiMap = new Map<number, NonNullable<typeof parsed.steps>[number]>();
      for (const row of parsed.steps || []) {
        if (typeof row?.stepIndex === 'number') {
          aiMap.set(row.stepIndex, row);
        }
      }

      const mergedSteps: StepEvaluationResult[] = localFallback.steps.map((baseStep, idx) => {
        const aiRow = aiMap.get(baseStep.stepIndex) || parsed.steps?.[idx];
        if (!aiRow) return baseStep;
        const score = Number.isFinite(aiRow.score)
          ? Math.max(0, Math.min(100, Math.round(Number(aiRow.score))))
          : baseStep.score;
        return {
          ...baseStep,
          score,
          passed: score >= 65,
          correct_answer_uz: aiRow.correct_answer_uz?.trim() || baseStep.correct_answer_uz,
          feedback_uz: aiRow.feedback_uz?.trim() || baseStep.feedback_uz,
        };
      });

      const overall_percent =
        mergedSteps.length > 0
          ? Math.round(mergedSteps.reduce((acc, s) => acc + s.score, 0) / mergedSteps.length)
          : 0;
      const summary_speech_uz = buildEvaluationSummarySpeech(
        topicTitle,
        overall_percent,
        mergedSteps
      );

      const payload: EvaluateLessonResponse = {
        overall_percent,
        steps: mergedSteps,
        summary_speech_uz,
        token_usage: usage,
      };
      res.json(payload);
    } catch (err) {
      console.warn('Batch evaluate fallback to deterministic evaluator:', err);
      res.json(evaluateLessonAnswersLocally(topicTitle, items));
    }
  });

  return { router, objectResolver };
}
