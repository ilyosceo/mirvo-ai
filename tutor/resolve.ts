import fs from 'fs';
import path from 'path';
import express, { type Request, type Response, type Router } from 'express';
import { ThinkingLevel, Type, type GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { CACHED_LESSONS } from '../data/cachedLessons.ts';
import {
  extractObjectIntent,
  generateProceduralObjectSvg,
  generateProceduralPrimitives3D,
  generateZeroTokenFallbackSvg,
  normalizeUzToken,
  sanitizeSvgString,
  shouldTreatAsObjectDrawing,
  type ObjectIntent,
} from '../lib/objectCatalog.ts';
import {
  findBuiltInCachedLesson,
  normalizeCacheSearchText,
} from '../lib/lessonMatch.ts';
import {
  mergeTokenUsage,
  usageFromGeminiMetadata,
  ZERO_TOKEN_USAGE,
} from '../lib/tokenUsage.ts';
import type {
  FlowType,
  LessonDepthMode,
  Primitive3DItem,
  ResolvedObjectPayload,
  TokenUsageInfo,
  TutorLesson,
} from '../types/tutor.ts';

// Gemini Flash & Flash-Lite model aliases per @google/genai guidelines
const GEMINI_FLASH_MODEL = 'gemini-4-hydrogen';
const GEMINI_LITE_MODEL = 'gemini-3.1-flash-lite';

function normalizeLessonDepthMode(value: unknown): LessonDepthMode {
  return value === 'overview' || value === 'deep' ? value : 'standard';
}

function getLessonStepRange(mode: LessonDepthMode): { min: number; max: number } {
  if (mode === 'overview') return { min: 4, max: 4 };
  if (mode === 'deep') return { min: 10, max: 12 };
  return { min: 6, max: 8 };
}

function buildDirectorSystemInstruction(mode: LessonDepthMode): string {
  const countInstruction =
    mode === 'overview'
      ? 'Ushbu dars aynan 4 ta bosqichdan iborat bo‘lsin.'
      : mode === 'deep'
      ? 'Ushbu dars 10–12 ta mazmunan farqli bosqichdan iborat bo‘lsin.'
      : 'Ushbu dars 6–8 ta mazmunan farqli bosqichdan iborat bo‘lsin.';

  return `${DIRECTOR_SYSTEM_INSTRUCTION}\n\nDARS CHUQURLIGI: ${countInstruction} Mini-test faqat oxirgi bosqichda bo‘lsin. Bir xil mazmunni takrorlab bosqich sonini to‘ldirma.`;
}

export interface CachedVisualObjectEntry {
  id: string;
  name_uz: string;
  name_en: string;
  aliases_uz: string[];
  svg_data: string;
  viewBox: string;
  source: 'iconify' | 'wikimedia' | 'procedural' | 'gemini-svg' | 'poly-pizza';
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
          quiz: {
            type: Type.OBJECT,
            description: "Oxirgi (4-chi) qadam uchun 3 variantli mini-tekshiruv testi",
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
                  'pythagoras | triangle | circle | unit_circle | polygon | photosynthesis | sky_scattering | illustration',
              },
              object_name_uz: {
                type: Type.STRING,
                description: "Agar kind='illustration' bo'lsa, obyektning o'zbekcha nomi (masalan: 'daraxt')",
              },
              object_name_en: {
                type: Type.STRING,
                description: "Agar kind='illustration' bo'lsa, qidiruv uchun inglizcha nomi (masalan: 'tree')",
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
          'render_params',
        ],
      },
    },
  },
  required: ['topic_title', 'subject', 'engine', 'sliders', 'steps'],
};

export const DIRECTOR_SYSTEM_INSTRUCTION = `Sen "Mirvo AI" — o'zbek tilidagi interaktiv 2D/3D vizual AI repetitorsan.
Hech qachon SVG/Three.js kodi yozma; faqat JSON retsept qaytar.

BOSQICH TUZILISHI:
1. Sodda tushuncha va hayotiy misol.
2. Asosiy qismlar va fokus.
Keyingi bosqichlarda formulalar, sabab-oqibatlar, misollar yoki amaliy qo‘llanishni izchil yorit.
Oxirgi bosqichda xulosa va 3 variantli "quiz" bo‘lsin.

QISQA MAYDONLAR:
- speech_text: 1-2 tabiiy o'zbekcha gap (formula belgilarisiz).
- katex_formulas: 1-2 toza LaTeX formula.
- explanation_uz: max 15 so'z.
- beats: AYNAN 2 ta qisqa gap (sentence, focus_target, focusPart, tutor_pose: approach|step_back|formula_check, camera_zoom).
- flowType: tok/oqim/puls bo'lsa "dc" | "ac" (transformator, generator, motor) | "pulse" (yurak, dvigatel) | "none"; flowSpeed: 0.5..2.5.

DVIGATEL QOIDASI:
1. "plotly2d": 2D funksiyalar (expression, x_range, y_range, highlight_points).
2. "threejs": Kvadrik (shape:"quadric", template, draw) yoki stereometriya/fizika (pyramid|cone|cylinder|cube|sphere|vectors|projectile).
3. "plotly3d": Faqat to'lqinsimon 3D sirt z = f(x,y).
4. "pdb": 4-harfli PDB oqsil/DNK.
5. "pubchem": Kimyoviy molekula (compound inglizcha).
6. "mermaid": FAQAT sof matnli grammatika, tarixiy sanalar yoki dasturlash algoritmi uchun. Qurilma, texnika (generator, motor, transformator, dvigatel), fizika, biologiya, tabiat va obyektlar uchun ASLO "mermaid" ishlatma!
7. "svg2d": Pifagor ("pythagoras"), uchburchak ("triangle"), aylana ("circle"|"unit_circle"), ko'pburchak ("polygon", sides), hamda BARCHA texnika, mashina, organ, o'simlik, hayvon va tabiat obyektlari uchun kind:"illustration" bilan object_name_uz va aniq 1-2 so'zli inglizcha object_name_en (masalan "electric generator", "electric motor", "solar panel", "volcano") ber — backend internet/bazadan vektor SVG topib chizadi.`;

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
    const missingParts = !entry.parts_uz || entry.parts_uz.length === 0;
    const prims = entry.primitives_3d || generateProceduralPrimitives3D(entry.name_en);
    if (missingPartTags || missingParts || !entry.primitives_3d) {
      return {
        ...entry,
        svg_data: missingPartTags ? proc.svg_data : entry.svg_data,
        viewBox: missingPartTags ? proc.viewBox : entry.viewBox,
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
            .filter(
              (e: CachedVisualObjectEntry) =>
                !(e?.name_en === 'cell' && e?.source === 'iconify')
            )
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

  /**
   * 5-Step Smart Fallback & Auto-Cache pipeline:
   * 1) Extract object & translate via Uzbek->English dictionary (Gemini Flash only for unknown tokens)
   * 2) Check local cache (data/object-cache.json) first
   * 3) Zero-cost external fallback chain: 3A Iconify 2D SVG -> 3B 3D (Poly Pizza / procedural 3D / SVG extrude) -> 3C Procedural / Gemini Flash SVG
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

    // Step 2: Check local cache FIRST
    const cachedImmediate = this.findInCache(nameUz, nameEn);
    if (cachedImmediate) {
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
          primitives_3d:
            cachedImmediate.primitives_3d ||
            generateProceduralPrimitives3D(cachedImmediate.name_en),
          parts_uz: cachedImmediate.parts_uz,
          from_cache: true,
          latency_ms: Math.max(1, Date.now() - t0),
          token_usage: ZERO_TOKEN_USAGE,
        },
      };
    }

    // Step 1B: Fallback translation for words outside dictionary (skipped if Director already provided englishHint)
    if (!intent.known_in_dict && !cleanHintEn) {
      const tx = await this.translateUnknownTermToEnglish(nameUz);
      nameEn = tx.nameEn;
      totalUsage = mergeTokenUsage(totalUsage, tx.usage);
      const cachedAfterTx = this.findInCache(nameUz, nameEn);
      if (cachedAfterTx) {
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
            primitives_3d:
              cachedAfterTx.primitives_3d ||
              generateProceduralPrimitives3D(cachedAfterTx.name_en),
            parts_uz: cachedAfterTx.parts_uz,
            from_cache: true,
            latency_ms: Math.max(1, Date.now() - t0),
            token_usage: totalUsage,
          },
        };
      }
    }

    // Step 3A: Domain-accurate local procedural scientific/botanical SVG FIRST (0ms, $0)
    // followed by ZERO-TOKEN free internet vector APIs (Iconify -> Wikimedia Commons SVG -> relaxed Iconify -> zero-token schematic)
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

    // Step 3B: Optional 3D model via Poly Pizza + zero-cost procedural 3D primitives
    let modelUrl: string | undefined;
    if (mode === '3d') {
      modelUrl = await this.fetchFromPolyPizza(nameEn);
    }
    const procedural3D = generateProceduralPrimitives3D(nameEn);

    // Step 3C: Relaxed single-word Iconify search (0 LLM tokens!) -> Zero-token procedural vector schematic
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
      ...(procedural3D ? { primitives_3d: procedural3D } : {}),
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
        source: modelUrl && mode === '3d' ? 'poly-pizza' : source,
        mode,
        model_url: modelUrl,
        primitives_3d: procedural3D,
        parts_uz: partsUz,
        from_cache: false,
        latency_ms: Math.max(2, Date.now() - t0),
        token_usage: totalUsage,
      },
    };
  }

  public buildObjectDrawingLesson(
    rawQuery: string,
    resolved: ResolvedObjectPayload
  ): TutorLesson {
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

    const step2Speech = `${part1.label} ga yaqinroq qaraymiz: ${part1Desc}`;
    const step3Speech =
      partsList.length >= 3
        ? `Endi ${part2.label} va ${part3.label} qismlarini yaqindan ko'ramiz. ${part2Desc} ${part3Desc}`
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
    const inferredFlowType: FlowType = /\b(transformer|transformator|inductor|coil|generator|alternator)\b/.test(
      lowerObj
    )
      ? 'ac'
      : /\b(bulb|lamp|lampochka|battery|circuit|wire|solar|windmill|fan)\b/.test(lowerObj)
      ? 'dc'
      : /\b(heart|yurak|engine|dvigatel|rocket|raketa|volcano|vulqon|sun|quyosh)\b/.test(lowerObj)
      ? 'pulse'
      : 'none';
    const inferredFlowSpeed =
      inferredFlowType === 'ac'
        ? 1.2
        : inferredFlowType === 'dc'
        ? 1.15
        : inferredFlowType === 'pulse'
        ? 1.2
        : 1.0;

    return {
      id: `obj-${resolved.name_en.replace(/\s+/g, '-')}`,
      topic_title: use3D ? `${capUz} — 3D Model va Chizma` : `${capUz} — Chizma va Tahlil`,
      subject,
      engine: use3D ? 'threejs' : 'svg2d',
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
      steps: [
        {
          step_number: 1,
          step_title: use3D
            ? `1. ${capUz} — umumiy 3D ko‘rinish`
            : `1. ${capUz} — umumiy tuzilishni chizish`,
          speech_text: use3D
            ? `Keling, ${capUz} obyektini uch o'lchamli fazoda umumiy ko'rinishda quramiz. Sichqoncha bilan modelni har tomondan aylantirib ko'rishingiz mumkin.`
            : `Keling, avval ${capUz} ning umumiy ko'rinishini qalam bilan chizgandek doskaga to'liq chizamiz.`,
          katex_formulas: [
            `\\text{Obyekt: } \\mathbf{${capUz}} \\; (${resolved.name_en})`,
          ],
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
        },
        {
          step_number: 4,
          step_title: '4. Umumiy ko‘rinish va sinov',
          speech_text: `Endi barcha qismlarni yana birgalikda umumiy ko'rinishda ko'ramiz. ${quizQuestion}`,
          katex_formulas: [`\\text{Mini-test: } \\mathbf{${capUz}}`],
          explanation_uz: `1.0x umumiy ko'rinish · To'g'ri javobni tanlang.`,
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
              note: 'Mini-test',
            },
          ],
          quiz: {
            question: quizQuestion,
            options: quizOptions,
            correct_index: 0,
            explanation_uz: quizExplanation,
          },
        },
      ],
    };
  }
}

export interface TutorResolveRouterDeps {
  dataDir: string;
  getGeminiClient: (apiVersion?: string) => GoogleGenAI | null;
  generateLesson?: (input: {
    query: string;
    userPrompt: string;
    systemInstruction: string;
    depthMode: LessonDepthMode;
    imageBase64?: string;
    imageMimeType?: string;
  }) => Promise<{
    text: string;
    usageMetadata?: GenerateContentResponse['usageMetadata'];
    cacheHit: boolean;
  }>;
}

export function createTutorResolveRouter(deps: TutorResolveRouterDeps): {
  router: Router;
  objectResolver: SmartObjectResolver;
} {
  const { dataDir, getGeminiClient, generateLesson } = deps;
  const topicCacheFile = path.join(dataDir, 'topic-cache.json');
  const objectResolver = new SmartObjectResolver(dataDir, () => getGeminiClient());

  function loadDynamicCache(): DynamicCacheEntry[] {
    try {
      if (fs.existsSync(topicCacheFile)) {
        const raw = fs.readFileSync(topicCacheFile, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
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

  function findCachedLesson(
    query: string,
    depthMode: LessonDepthMode
  ): TutorLesson | null {
    const builtIn = findBuiltInCachedLesson(query);
    if (builtIn) {
      return builtIn;
    }

    const norm = normalizeQuery(query);
    const canonical = normalizeCacheSearchText(query);
    if (!norm && !canonical) return null;

    const normalizedForFlowCheck = normalizeUzToken(query);
    const isStrictlyAbstractFlow =
      /\b(algoritm|blok\s*sxema|dasturlash|kod|qadamlar|xronologiya|tarix|sulola|urush|grammatika|morfologiya|sintaksis|gap\s*bolak|fe['`]?l|ot\s*soz|sifat|soz\s*turkum)\b/i.test(
        normalizedForFlowCheck
      );

    for (const entry of dynamicCache) {
      const entryKeyRaw = entry.normalizedKey.replace(/^v\d+:/, '');
      if (entry.lesson?.depth_mode !== depthMode) continue;
      if (
        entry.normalizedKey === `v10:${depthMode}:${norm}` ||
        (canonical &&
          (normalizeCacheSearchText(entry.query) === canonical ||
            normalizeCacheSearchText(entryKeyRaw) === canonical))
      ) {
        if (entry.lesson?.engine === 'mermaid' && !isStrictlyAbstractFlow) {
          continue;
        }
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
    depthMode: LessonDepthMode,
    prewarmedCache?: Map<string, ReturnType<SmartObjectResolver['resolveObject']>>,
    directorSource: TutorLesson['source'] = 'gemini-director'
  ): Promise<{ lesson: TutorLesson; token_usage: TokenUsageInfo; latency_ms: number }> => {
    const cleanText = rawText.trim();
    if (!cleanText) {
      throw new Error("AI bo'sh javob qaytardi.");
    }

    const parsed = JSON.parse(cleanText) as TutorLesson;
    if (!parsed.steps || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error('Dars bosqichlari topilmadi.');
    }
    const stepRange = getLessonStepRange(depthMode);
    if (parsed.steps.length < stepRange.min || parsed.steps.length > stepRange.max) {
      throw new Error(
        `Tanlangan dars chuqurligi uchun ${stepRange.min}–${stepRange.max} bosqich kerak, AI esa ${parsed.steps.length} ta qaytardi. Qayta urinib ko‘ring.`
      );
    }
    parsed.depth_mode = depthMode;

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
            if (upgradedOutcome.resolved.parts_uz) {
              rp.object_parts = upgradedOutcome.resolved.parts_uz.map((p, pIdx) => ({
                label: p.label,
                partId: p.partId || `part_${pIdx}`,
              }));
            }
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
          ].includes(rp.kind || '')
        ) {
          rp.kind = 'illustration';
        }

        if (rp.kind === 'illustration' && !rp.svg_data) {
          const lookupTerm = rp.object_name_uz || rp.object_name_en || trimmedQuery;
          if (lookupTerm) {
            const hydrated = await getHydratedObject(lookupTerm, rp.object_name_en);
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
        }
        const defaultFocusPart =
          s.focusPart ||
          (idx === 1
            ? rp.object_parts?.[0]?.partId || 'detail_center'
            : idx === 2
            ? rp.object_parts?.[1]?.partId || rp.object_parts?.[0]?.partId || 'detail_left'
            : undefined);
        const defaultZoom =
          typeof s.cameraZoom === 'number'
            ? s.cameraZoom
            : idx === 0 || idx === parsed.steps.length - 1
            ? 1.0
            : defaultFocusPart
            ? 1.72
            : 1.0;
        const defaultDim =
          typeof s.dimInactiveParts === 'boolean'
            ? s.dimInactiveParts
            : (idx === 1 || idx === 2) && Boolean(defaultFocusPart);

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
          ? s.beats.map((b) => ({
              ...b,
              flowType: sanitizeFlowType(b.flowType ?? stepFlowType),
              flowSpeed: clampFlowSpeedServer(b.flowSpeed ?? stepFlowSpeed, stepFlowSpeed),
              flowReverse: Boolean(b.flowReverse ?? stepFlowReverse),
            }))
          : s.beats;
        return {
          ...s,
          step_number: s.step_number || idx + 1,
          emoji_emotion: emotion,
          focusPart:
            idx === 0 || idx === parsed.steps.length - 1 ? undefined : defaultFocusPart,
          cameraZoom: defaultZoom,
          dimInactiveParts: defaultDim,
          flowType: stepFlowType,
          flowSpeed: stepFlowSpeed,
          flowReverse: stepFlowReverse,
          beats: normalizedBeats,
          render_params: rp,
        };
      })
    );

    const hydratedOutcomes = await Promise.all(Array.from(illustrationPromises.values()));
    const token_usage = mergeTokenUsage(
      directorUsage,
      ...hydratedOutcomes.map((o) => o?.resolved.token_usage)
    );

    const latency_ms = Date.now() - t0;
    const lesson: TutorLesson = {
      ...parsed,
      depth_mode: depthMode,
      steps: normalizedSteps,
      id: `ai-${Date.now()}`,
      sliders: Array.isArray(parsed.sliders) ? parsed.sliders : [],
      source: directorSource,
      latency_ms,
      token_usage,
    };

    if (!imageBase64 && trimmedQuery) {
      const normalizedKey = `v10:${depthMode}:${normalizeQuery(trimmedQuery)}`;
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
    depthMode: LessonDepthMode,
    imageBase64?: string,
    imageMimeType?: string
  ) => {
    const depthDescription =
      depthMode === 'overview'
        ? 'aynan 4 bosqichli'
        : depthMode === 'deep'
        ? '10–12 bosqichli'
        : '6–8 bosqichli';
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
        ? `O'quvchining savoli: "${trimmedQuery}". Uning bilim darajasiga mos, o'zbek tilida ${depthDescription} interaktiv dars yarat. 3 variantli mini-tekshiruvni faqat oxirgi bosqichga joyla.`
        : `Yuklangan rasmdagi masala yoki mavzuni tahlil qilib, o'zbek tilida ${depthDescription} interaktiv dars yarat. 3 variantli mini-tekshiruvni faqat oxirgi bosqichga joyla.`,
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
    depthMode: LessonDepthMode,
    onProgress: (rawBuffer: string) => void
  ): Promise<{ rawBuffer: string; usageMeta?: GenerateContentResponse['usageMetadata'] }> => {
    const attempts: Array<{ model: string; thinkingLevel: ThinkingLevel }> = [
      { model: GEMINI_LITE_MODEL, thinkingLevel: ThinkingLevel.MINIMAL },
      { model: GEMINI_FLASH_MODEL, thinkingLevel: ThinkingLevel.MINIMAL },
    ];

    let lastErr: unknown;
    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      try {
        const stream = await ai.models.generateContentStream({
          model: attempt.model,
          contents: { parts },
          config: {
            systemInstruction: buildDirectorSystemInstruction(depthMode),
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
    const { query = '', imageBase64, imageMimeType, depthMode: requestedDepthMode } = req.body as {
      query?: string;
      imageBase64?: string;
      imageMimeType?: string;
      depthMode?: unknown;
    };
    const depthMode = normalizeLessonDepthMode(requestedDepthMode);

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
        const cached = findCachedLesson(trimmedQuery, depthMode);
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
              outcome.resolved
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

      const ai = getGeminiClient();
      if (!ai) {
        sendEvent('error', {
          error:
            "Gemini API kaliti sozlanmagan. Iltimos, AI Studio Settings > Secrets bo'limida GEMINI_API_KEY ni kiriting.",
        });
        res.end();
        return;
      }

      sendEvent('status', { message: 'Mirvo AI mavzuni tahlil qilmoqda...' });
      const parts = buildDirectorParts(trimmedQuery, depthMode, imageBase64, imageMimeType);

      let lastNotifiedSteps = -1;
      let detectedTitle = '';
      const prewarmedIllustrations = new Map<string, ReturnType<SmartObjectResolver['resolveObject']>>();
      const triggeredObjHints = new Set<string>();

      const { rawBuffer, usageMeta } = await generateDirectorStreamWithFallback(
        ai,
        parts,
        depthMode,
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
            const key = hintEn.toLowerCase();
            if (hintEn && !triggeredObjHints.has(key)) {
              triggeredObjHints.add(key);
              prewarmedIllustrations.set(
                key,
                objectResolver.resolveObject(hintEn, '2d', hintEn).catch(() => null)
              );
            }
          }

          const stepMatches = currentBuf.match(/"step_number"\s*:\s*\d+/g);
          const stepCount = stepMatches ? stepMatches.length : 0;
          if (stepCount !== lastNotifiedSteps) {
            lastNotifiedSteps = stepCount;
            sendEvent('progress', {
              topicTitle: detectedTitle || undefined,
              stepNum: stepCount,
              elapsedMs: Date.now() - t0,
              message:
                stepCount === 0
                  ? 'Vizual dvigatel tanlanmoqda...'
                  : `${stepCount}-bosqich va chizma tuzilmoqda...`,
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
        depthMode,
        prewarmedIllustrations
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
    const { query = '', imageBase64, imageMimeType, depthMode: requestedDepthMode } = req.body as {
      query?: string;
      imageBase64?: string;
      imageMimeType?: string;
      depthMode?: unknown;
    };
    const depthMode = normalizeLessonDepthMode(requestedDepthMode);

    const trimmedQuery = String(query || '').trim();
    if (!trimmedQuery && !imageBase64) {
      res.status(400).json({ error: 'Savol matni yoki masala rasmini kiriting.' });
      return;
    }

    if (!imageBase64 && trimmedQuery) {
      const cached = findCachedLesson(trimmedQuery, depthMode);
      if (cached) {
        const latency_ms = Math.max(2, Date.now() - t0);
        res.json({
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
        return;
      }

      if (shouldTreatAsObjectDrawing(trimmedQuery)) {
        const outcome = await objectResolver.resolveObject(trimmedQuery);
        if (outcome) {
          const objLesson = objectResolver.buildObjectDrawingLesson(
            trimmedQuery,
            outcome.resolved
          );
          const stage = outcome.resolved.from_cache ? 'cache' : 'local-parser';
          const token_usage = objLesson.token_usage ?? ZERO_TOKEN_USAGE;
          res.json({
            stage,
            latency_ms: objLesson.latency_ms || Math.max(2, Date.now() - t0),
            token_usage,
            lesson: { ...objLesson, token_usage },
          });
          return;
        }
      }
    }

    const ai = generateLesson ? null : getGeminiClient();
    if (!generateLesson && !ai) {
      res.status(503).json({
        error: 'AI lesson service is not configured.',
      });
      return;
    }

    try {
      const parts = buildDirectorParts(trimmedQuery, depthMode, imageBase64, imageMimeType);
      let rawText: string;
      let directorUsage: TokenUsageInfo;
      let sharedCacheHit = false;
      if (generateLesson) {
        const generated = await generateLesson({
          query: trimmedQuery,
          userPrompt: parts
            .map((part) => part.text)
            .filter((text): text is string => Boolean(text))
            .join('\n'),
          systemInstruction: buildDirectorSystemInstruction(depthMode),
          depthMode,
          imageBase64,
          imageMimeType: imageBase64 ? imageMimeType || 'image/jpeg' : undefined,
        });
        rawText = generated.text;
        sharedCacheHit = generated.cacheHit;
        directorUsage = sharedCacheHit
          ? ZERO_TOKEN_USAGE
          : usageFromGeminiMetadata(generated.usageMetadata);
      } else {
        let response;
        try {
          response = await ai!.models.generateContent({
            model: GEMINI_LITE_MODEL,
            contents: { parts },
            config: {
              systemInstruction: buildDirectorSystemInstruction(depthMode),
              responseMimeType: 'application/json',
              responseSchema: LESSON_RESPONSE_SCHEMA,
              thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            },
          });
        } catch (primaryErr) {
          if (!isTransientOrUnavailableError(primaryErr)) throw primaryErr;
          response = await ai!.models.generateContent({
            model: GEMINI_FLASH_MODEL,
            contents: { parts },
            config: {
              systemInstruction: buildDirectorSystemInstruction(depthMode),
              responseMimeType: 'application/json',
              responseSchema: LESSON_RESPONSE_SCHEMA,
              thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            },
          });
        }
        rawText = response.text ?? '';
        directorUsage = usageFromGeminiMetadata(response.usageMetadata);
      }

      const { lesson, token_usage, latency_ms } = await finalizeDirectorLesson(
        rawText,
        directorUsage,
        trimmedQuery,
        imageBase64,
        t0,
        depthMode,
        undefined,
        sharedCacheHit ? 'cache' : generateLesson ? 'qwen-director' : 'gemini-director'
      );

      res.json({
        stage: sharedCacheHit ? 'cache' : generateLesson ? 'qwen-director' : 'gemini-director',
        latency_ms,
        token_usage,
        lesson,
      });
    } catch (err) {
      console.error(generateLesson ? 'Qwen Director error' : 'Gemini Director error');
      res.status(500).json({ error: formatFriendlyGeminiError(err) });
    }
  });

  return { router, objectResolver };
}
