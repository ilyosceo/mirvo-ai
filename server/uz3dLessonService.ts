import fs from 'fs';
import path from 'path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  buildCatalogPromptSummary,
  findCatalogModel,
  matchCatalogModelByQuery,
  MOCK_UZ3D_LESSONS,
} from '../lib/modelCatalog.js';
import {
  extractObjectIntent,
  generateProceduralPrimitives3D,
} from '../lib/objectCatalog.js';
import { fetchYouTubeContext } from './youtubeTranscript.js';
import type { Primitive3DItem } from '../types/tutor.js';
import type {
  EmojiMimicState,
  ModelHotspotSpec,
  Uz3DLessonResponse,
  Uz3DSegment,
} from '../types/uz3d.js';

export interface GenerateUz3DLessonRequest {
  mode?: 'youtube_subtitles' | 'local_audio' | 'image_or_topic';
  video_id?: string;
  subtitles?: string;
  audio_base64?: string;
  audio_mime?: string;
  image_base64?: string;
  image_mime?: string;
  topic?: string;
}

const VALID_MIMICS = new Set<EmojiMimicState>([
  'explaining',
  'amazed',
  'thinking',
  'happy',
  'warning',
]);

const memoryCache = new Map<string, Uz3DLessonResponse>();
const CACHE_FILE_PATH = path.join(process.env.TMPDIR || '/tmp', 'uz3d-lesson-cache-v2.json');

function loadDiskCache(): void {
  if (memoryCache.size > 0) return;
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf8')) as Record<
        string,
        Uz3DLessonResponse
      >;
      for (const [k, v] of Object.entries(parsed)) {
        if (k && v && Array.isArray(v.segments)) {
          memoryCache.set(k, v);
        }
      }
    }
  } catch {
    // Ignore corrupt temp cache
  }
}

function persistCacheEntry(cacheKey: string, lesson: Uz3DLessonResponse): void {
  memoryCache.set(cacheKey, lesson);
  try {
    const obj: Record<string, Uz3DLessonResponse> = {};
    let count = 0;
    for (const [k, v] of memoryCache.entries()) {
      obj[k] = v;
      count += 1;
      if (count >= 100) break;
    }
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(obj), 'utf8');
  } catch {
    // Non-fatal in read-only serverless environments
  }
}

function isUsableApiKey(raw?: string): raw is string {
  if (!raw) return false;
  const k = raw.trim();
  if (k.length < 20) return false;
  return !/^(MY_|YOUR_|TEST_|DEMO_|PLACEHOLDER|REPLACE|CHANGEME|GEMINI_API_KEY)/i.test(k);
}

function extractJson(raw: string): Record<string, unknown> | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // try fenced json
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim()) as Record<string, unknown>;
    } catch {
      // fall through
    }
  }
  const s = trimmed.indexOf('{');
  const e = trimmed.lastIndexOf('}');
  if (s >= 0 && e > s) {
    try {
      return JSON.parse(trimmed.slice(s, e + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

const VALID_PRIMITIVE_TYPES = new Set<Primitive3DItem['type']>([
  'box',
  'cylinder',
  'sphere',
  'cone',
  'torus',
  'capsule',
  'ring',
  'tube',
  'lathe',
  'rounded_box',
]);

function normalizeCustomPrimitives(raw: unknown): Primitive3DItem[] {
  if (!Array.isArray(raw)) return [];
  const out: Primitive3DItem[] = [];
  for (let i = 0; i < raw.length; i++) {
    const rec = (raw[i] || {}) as Record<string, unknown>;
    const rawType = typeof rec.type === 'string' ? rec.type.trim().toLowerCase() : 'box';
    const type = (
      VALID_PRIMITIVE_TYPES.has(rawType as Primitive3DItem['type']) ? rawType : 'box'
    ) as Primitive3DItem['type'];
    const pos =
      Array.isArray(rec.position) && rec.position.length >= 3
        ? ([Number(rec.position[0]) || 0, Number(rec.position[1]) || 0, Number(rec.position[2]) || 0] as [
            number,
            number,
            number,
          ])
        : ([0, 1, 0] as [number, number, number]);
    const rot =
      Array.isArray(rec.rotation) && rec.rotation.length >= 3
        ? ([Number(rec.rotation[0]) || 0, Number(rec.rotation[1]) || 0, Number(rec.rotation[2]) || 0] as [
            number,
            number,
            number,
          ])
        : undefined;
    const argsRaw = Array.isArray(rec.args)
      ? rec.args.map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : [];
    const defaultArgs =
      type === 'cylinder'
        ? [0.45, 0.45, 1.5, 20]
        : type === 'sphere'
        ? [0.7, 20, 20]
        : type === 'cone'
        ? [0.8, 1.6, 20]
        : type === 'torus'
        ? [0.8, 0.2, 12, 24]
        : [1.2, 1.0, 1.2];
    out.push({
      id: typeof rec.id === 'string' ? rec.id : `prim_${i}`,
      type,
      position: pos,
      rotation: rot,
      args: argsRaw.length > 0 ? argsRaw : defaultArgs,
      color: typeof rec.color === 'string' && rec.color.trim() ? rec.color.trim() : '#2563EB',
      opacity:
        typeof rec.opacity === 'number' && Number.isFinite(rec.opacity)
          ? Math.max(0.15, Math.min(1, rec.opacity))
          : 1,
      roughness:
        typeof rec.roughness === 'number' && Number.isFinite(rec.roughness)
          ? Math.max(0.05, Math.min(1, rec.roughness))
          : 0.35,
      label: typeof rec.label === 'string' && rec.label.trim() ? rec.label.trim() : undefined,
      partId: typeof rec.partId === 'string' && rec.partId.trim() ? rec.partId.trim() : `part_${i}`,
    });
  }
  return out;
}

function buildHotspotsFromPrimitives(
  primitives: Primitive3DItem[],
  topicTitle: string
): ModelHotspotSpec[] {
  const hotspots: ModelHotspotSpec[] = [
    {
      id: 'overview',
      label_uz: 'Umumiy ko‘rinish',
      description_uz: `${topicTitle} 3D modelining umumiy fazoviy tuzilishi`,
      camera_orbit: '32deg 64deg 5.2m',
      camera_target: '0m 0.8m 0m',
      position_3d: [0, 0.9, 0],
    },
  ];
  const groups = new Map<
    string,
    { label: string; sum: [number, number, number]; count: number }
  >();
  for (const p of primitives) {
    const pid = p.partId || 'part_0';
    if (pid === 'overview') continue;
    const g = groups.get(pid) || {
      label: p.label || pid,
      sum: [0, 0, 0],
      count: 0,
    };
    g.sum[0] += p.position[0];
    g.sum[1] += p.position[1];
    g.sum[2] += p.position[2];
    g.count += 1;
    if (p.label && g.label === pid) {
      g.label = p.label;
    }
    groups.set(pid, g);
  }
  for (const [pid, g] of groups.entries()) {
    const cx = Number((g.sum[0] / g.count).toFixed(2));
    const cy = Number((g.sum[1] / g.count).toFixed(2));
    const cz = Number((g.sum[2] / g.count).toFixed(2));
    hotspots.push({
      id: pid,
      label_uz: g.label,
      description_uz: `${g.label} qismining fazoviy joylashuvi va vazifasi`,
      camera_orbit: '24deg 62deg 3.8m',
      camera_target: `${cx}m ${cy}m ${cz}m`,
      position_3d: [cx, cy, cz],
    });
  }
  return hotspots;
}

export function normalizeUz3DLesson(
  raw: Record<string, unknown>,
  fallbackTopic: string,
  videoId?: string,
  sourceChannel: Uz3DLessonResponse['source_channel'] = 'image_topic',
  provider = 'gemini'
): Uz3DLessonResponse {
  const requestedModelId =
    typeof raw.selected_model_id === 'string' ? raw.selected_model_id.trim() : '';
  const isCustomModelRequested = requestedModelId === 'custom_3d_procedural';
  const catalogEntry =
    requestedModelId &&
    !isCustomModelRequested &&
    findCatalogModel(requestedModelId).id === requestedModelId
      ? findCatalogModel(requestedModelId)
      : matchCatalogModelByQuery(
          `${String(raw.lesson_title_uz || '')} ${fallbackTopic}`
        );

  let customPrimitives = normalizeCustomPrimitives(raw.custom_primitives_3d);
  if (
    customPrimitives.length === 0 &&
    (isCustomModelRequested || catalogEntry.id === 'none_2d_board')
  ) {
    const intent = extractObjectIntent(`${String(raw.lesson_title_uz || '')} ${fallbackTopic}`);
    const proc =
      generateProceduralPrimitives3D(intent.name_en) ||
      generateProceduralPrimitives3D(fallbackTopic);
    if (proc && proc.length > 0) {
      customPrimitives = proc;
    }
  }

  const lessonTitleUz =
    typeof raw.lesson_title_uz === 'string' && raw.lesson_title_uz.trim()
      ? raw.lesson_title_uz.trim()
      : fallbackTopic || catalogEntry.title_uz;

  const customHotspots: ModelHotspotSpec[] | undefined =
    customPrimitives.length > 0
      ? buildHotspotsFromPrimitives(customPrimitives, lessonTitleUz)
      : undefined;

  const effectiveHotspots = customHotspots || catalogEntry.hotspots;
  const allowedHotspots = new Set(effectiveHotspots.map((h) => h.id));
  const rawSegments = Array.isArray(raw.segments) ? raw.segments : [];
  const segments: Uz3DSegment[] = [];

  for (let i = 0; i < rawSegments.length; i++) {
    const seg = (rawSegments[i] || {}) as Record<string, unknown>;
    const startSec =
      typeof seg.start_sec === 'number' && Number.isFinite(seg.start_sec)
        ? Math.max(0, Math.round(seg.start_sec))
        : i * 18;
    const endSec =
      typeof seg.end_sec === 'number' && Number.isFinite(seg.end_sec)
        ? Math.max(startSec + 5, Math.round(seg.end_sec))
        : startSec + 18;
    const rawHotspot =
      typeof seg.camera_hotspot === 'string' ? seg.camera_hotspot.trim() : 'overview';
    const fallbackSpot =
      effectiveHotspots.length > 1
        ? effectiveHotspots[1 + (i % (effectiveHotspots.length - 1))]?.id || 'overview'
        : effectiveHotspots[0]?.id || 'overview';
    const cameraHotspot = allowedHotspots.has(rawHotspot) ? rawHotspot : fallbackSpot;

    const rawMimic =
      typeof seg.emoji_mimic === 'string' ? seg.emoji_mimic.trim() : 'explaining';
    const emojiMimic: EmojiMimicState = VALID_MIMICS.has(rawMimic as EmojiMimicState)
      ? (rawMimic as EmojiMimicState)
      : 'explaining';

    const uzTitle =
      typeof seg.uzbek_title === 'string' && seg.uzbek_title.trim()
        ? seg.uzbek_title.trim()
        : `${i + 1}-qism`;
    const uzExp =
      typeof seg.uzbek_explanation === 'string' && seg.uzbek_explanation.trim()
        ? seg.uzbek_explanation.trim()
        : `${fallbackTopic} bo‘yicha bosqichma-bosqich tushuntirish.`;

    const formula =
      typeof seg.key_formula_or_term === 'string' && seg.key_formula_or_term.trim()
        ? seg.key_formula_or_term.trim()
        : null;

    segments.push({
      start_sec: startSec,
      end_sec: endSec,
      uzbek_title: uzTitle,
      uzbek_explanation: uzExp,
      camera_hotspot: cameraHotspot,
      emoji_mimic: emojiMimic,
      key_formula_or_term: formula,
    });
  }

  if (segments.length === 0) {
    segments.push({
      start_sec: 0,
      end_sec: 25,
      uzbek_title: fallbackTopic || catalogEntry.title_uz,
      uzbek_explanation: `${fallbackTopic || catalogEntry.title_uz} mavzusi bo‘yicha asosiy 3D va formulali tushuntirish.`,
      camera_hotspot: effectiveHotspots[1]?.id || effectiveHotspots[0]?.id || 'overview',
      emoji_mimic: 'explaining',
      key_formula_or_term: null,
    });
  }

  const lessonId =
    typeof raw.lesson_id === 'string' && raw.lesson_id.trim()
      ? raw.lesson_id.trim()
      : `uz3d-${videoId || Date.now()}`;

  return {
    lesson_id: lessonId,
    video_id: videoId,
    source_channel: sourceChannel,
    selected_model_id: customPrimitives.length > 0 ? 'custom_3d_procedural' : catalogEntry.id,
    model_glb_url: customPrimitives.length > 0 ? null : catalogEntry.model_glb_url,
    lesson_title_uz: lessonTitleUz,
    cached: false,
    provider,
    custom_primitives_3d: customPrimitives.length > 0 ? customPrimitives : undefined,
    custom_hotspots: customHotspots,
    segments,
  };
}

function buildSystemInstruction(): string {
  return `You are Uz3D AI Tutor — an Uzbek STEM interactive 3D lesson director.
Analyze the user's English/Uzbek lecture subtitles, audio, image, or topic prompt, and return ONLY valid JSON conforming strictly to this schema:
{
  "lesson_id": "string",
  "selected_model_id": "one of the catalog ids below OR 'custom_3d_procedural' for any other physical object/system",
  "model_glb_url": null,
  "lesson_title_uz": "O'zbekcha aniq dars sarlavhasi",
  "custom_primitives_3d": [
    {
      "type": "box" | "cylinder" | "sphere" | "cone" | "torus" | "capsule" | "ring",
      "position": [0, 1, 0],
      "rotation": [0, 0, 0],
      "args": [1.4, 0.8, 1.0],
      "color": "#2563EB",
      "opacity": 1,
      "label": "O'zbekcha qism nomi",
      "partId": "part_0"
    }
  ],
  "segments": [
    {
      "start_sec": 0,
      "end_sec": 20,
      "uzbek_title": "Qisqa epizod nomi",
      "uzbek_explanation": "Sodda, tabiiy o'zbek tilidagi tushuntirish (Lotin alifbosida)",
      "camera_hotspot": "MUST match either a catalog hotspot id OR a partId from custom_primitives_3d (or 'overview')",
      "emoji_mimic": "explaining" | "amazed" | "thinking" | "happy" | "warning",
      "key_formula_or_term": "LaTeX formula or key term, or null"
    }
  ]
}

Available MODEL_CATALOG:
${buildCatalogPromptSummary()}

RULES:
- If the topic matches one of the 4 physical catalog models (electric_motor, human_heart, atom_bohr, plant_cell), pick it and set custom_primitives_3d to [].
- For ANY OTHER physical object, mechanism, anatomy, solar system, volcano, vehicle, architecture, optics, or physics apparatus: set selected_model_id to "custom_3d_procedural", compose 5 to 12 recognizable 3D parts in "custom_primitives_3d" grouped by semantic "partId" ("part_0", "part_1", ...), and link every segment's "camera_hotspot" to those partIds!
- Only use "none_2d_board" if the topic is pure abstract math/algebra/history/grammar without physical 3D parts.
- Create 3 to 6 time-synced segments.`;
}

export function getCachedUz3DLesson(videoId: string): Uz3DLessonResponse | null {
  loadDiskCache();
  const hit = memoryCache.get(videoId.trim());
  return hit ? { ...hit, cached: true } : null;
}

export async function generateUz3DLesson(
  body: GenerateUz3DLessonRequest
): Promise<Uz3DLessonResponse> {
  loadDiskCache();

  const videoId = body.video_id?.trim() || undefined;
  if (videoId) {
    const existing = memoryCache.get(videoId);
    if (existing) {
      return { ...existing, cached: true };
    }
  }

  let effectiveSubtitles = body.subtitles?.trim() || '';
  let effectiveTopic = body.topic?.trim() || '';
  let effectiveImageBase64 = body.image_base64?.trim() || '';
  let effectiveImageMime = body.image_mime || 'image/jpeg';

  if (videoId && (!effectiveSubtitles || !effectiveTopic)) {
    const ytCtx = await fetchYouTubeContext(videoId);
    if (ytCtx) {
      if (!effectiveSubtitles && ytCtx.transcript) {
        effectiveSubtitles = ytCtx.transcript;
      }
      if (!effectiveTopic && ytCtx.title) {
        effectiveTopic = ytCtx.title;
      }
      if (!effectiveImageBase64 && ytCtx.thumbnailDataUrls.length > 0) {
        const firstThumb = ytCtx.thumbnailDataUrls[0];
        const m = firstThumb.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
        if (m) {
          effectiveImageMime = m[1];
          effectiveImageBase64 = m[2];
        }
      }
    }
  }

  const mode =
    body.mode ||
    (effectiveSubtitles
      ? 'youtube_subtitles'
      : body.audio_base64?.trim()
      ? 'local_audio'
      : 'image_or_topic');

  const sourceChannel: Uz3DLessonResponse['source_channel'] =
    mode === 'youtube_subtitles'
      ? 'youtube_extension'
      : mode === 'local_audio'
      ? 'local_audio'
      : 'image_topic';

  const topicHint = effectiveTopic || 'Interaktiv 3D dars';
  const promptText = [
    `Manba oqimi: ${mode}`,
    effectiveTopic ? `Mavzu: ${effectiveTopic}` : '',
    effectiveSubtitles
      ? `Vaqt belgili subtitrlar:\n${effectiveSubtitles.slice(0, 14000)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const requestWithResolvedYouTube: GenerateUz3DLessonRequest = {
    ...body,
    topic: topicHint,
    subtitles: effectiveSubtitles,
    image_base64: effectiveImageBase64,
    image_mime: effectiveImageMime,
  };
  body = requestWithResolvedYouTube;

  // 1. Primary Gemini Multimodal (gemini-4-hydrogen)
  const geminiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (isUsableApiKey(geminiKey)) {
    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [{ text: promptText || 'Ushbu dars materialini tahlil qilib 3D epizodlar tuzing.' }];

      if (body.audio_base64?.trim()) {
        const cleanAudio = body.audio_base64.replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, '');
        parts.push({
          inlineData: {
            mimeType: body.audio_mime || 'audio/mp3',
            data: cleanAudio,
          },
        });
      }

      if (body.image_base64?.trim()) {
        const cleanImg = body.image_base64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
        parts.push({
          inlineData: {
            mimeType: body.image_mime || 'image/jpeg',
            data: cleanImg,
          },
        });
      }

      const resp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction: buildSystemInstruction(),
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = extractJson(resp.text || '');
      if (parsed) {
        const normalized = normalizeUz3DLesson(
          parsed,
          topicHint,
          videoId,
          sourceChannel,
          'gemini-4-hydrogen'
        );
        if (videoId) persistCacheEntry(videoId, normalized);
        return normalized;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(msg)) {
        console.info('Gemini Uz3D fallback:', msg.slice(0, 120));
      }
    }
  }

  // 2. DashScope qwen3.8-omni-flash (with strict cost-optimization flags: modalities=["text"], enable_thinking=false)
  const dashscopeKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (dashscopeKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50_000);
    try {
      const content: Array<Record<string, unknown>> = [
        { type: 'text', text: `${buildSystemInstruction()}\n\n${promptText}` },
      ];
      if (body.image_base64?.trim()) {
        const imgUrl = body.image_base64.startsWith('data:')
          ? body.image_base64
          : `data:${body.image_mime || 'image/jpeg'};base64,${body.image_base64}`;
        content.push({ type: 'image_url', image_url: { url: imgUrl } });
      }
      if (body.audio_base64?.trim()) {
        const cleanAudio = body.audio_base64.replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, '');
        content.push({
          type: 'input_audio',
          input_audio: { data: cleanAudio, format: 'mp3' },
        });
      }

      const res = await fetch(
        'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${dashscopeKey}`,
          },
          body: JSON.stringify({
            model: 'qwen3.8-omni-flash',
            modalities: ['text'],
            enable_thinking: false,
            messages: [{ role: 'user', content }],
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        }
      );

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const parsed = extractJson(data.choices?.[0]?.message?.content || '');
        if (parsed) {
          const normalized = normalizeUz3DLesson(
            parsed,
            topicHint,
            videoId,
            sourceChannel,
            'qwen3.8-omni-flash'
          );
          if (videoId) persistCacheEntry(videoId, normalized);
          return normalized;
        }
      }
    } catch {
      // fall through
    } finally {
      clearTimeout(timer);
    }
  }

  // 3. Deterministic Catalog Fallback (matches existing mock or builds structured segments)
  const combinedText = `${topicHint} ${body.subtitles || ''}`.toLowerCase();
  const mockMatch = MOCK_UZ3D_LESSONS.find(
    (m) =>
      (videoId && m.video_id === videoId) ||
      combinedText.includes(m.selected_model_id.replace('_', ' ')) ||
      (m.selected_model_id === 'electric_motor' &&
        /\b(motor|dvigatel|induksiya|faraday|tok|magnit)\b/.test(combinedText)) ||
      (m.selected_model_id === 'human_heart' && /\b(yurak|heart|aorta|qon)\b/.test(combinedText)) ||
      (m.selected_model_id === 'atom_bohr' && /\b(atom|bohr|elektron|kvant)\b/.test(combinedText))
  );

  if (mockMatch) {
    const cloned: Uz3DLessonResponse = {
      ...mockMatch,
      lesson_id: videoId ? `uz3d-${videoId}` : mockMatch.lesson_id,
      video_id: videoId || mockMatch.video_id,
      source_channel: sourceChannel,
      cached: false,
      provider: 'catalog-fallback',
    };
    if (videoId) persistCacheEntry(videoId, cloned);
    return cloned;
  }

  const matchedModel = matchCatalogModelByQuery(combinedText);
  if (matchedModel.id === 'none_2d_board') {
    const intent = extractObjectIntent(topicHint);
    const proc =
      generateProceduralPrimitives3D(intent.name_en) ||
      generateProceduralPrimitives3D(topicHint);
    if (proc && proc.length > 0) {
      const customHotspots = buildHotspotsFromPrimitives(proc, topicHint);
      const partSpots = customHotspots.filter((h) => h.id !== 'overview');
      const synthesizedCustom: Uz3DLessonResponse = {
        lesson_id: `uz3d-${videoId || Date.now()}`,
        video_id: videoId,
        source_channel: sourceChannel,
        selected_model_id: 'custom_3d_procedural',
        model_glb_url: null,
        lesson_title_uz: topicHint,
        cached: false,
        provider: 'procedural-3d-fallback',
        custom_primitives_3d: proc,
        custom_hotspots: customHotspots,
        segments: (partSpots.length > 0 ? partSpots : customHotspots).map((spot, idx) => ({
          start_sec: idx * 20,
          end_sec: (idx + 1) * 20,
          uzbek_title: spot.label_uz,
          uzbek_explanation: `${topicHint} — ${spot.label_uz} qismining tuzilishi va asosiy vazifasi.`,
          camera_hotspot: spot.id,
          emoji_mimic:
            idx === 0
              ? 'explaining'
              : idx === (partSpots.length > 0 ? partSpots.length : customHotspots.length) - 1
              ? 'happy'
              : 'thinking',
          key_formula_or_term: null,
        })),
      };
      if (videoId) persistCacheEntry(videoId, synthesizedCustom);
      return synthesizedCustom;
    }
  }

  const synthesized: Uz3DLessonResponse = {
    lesson_id: `uz3d-${videoId || Date.now()}`,
    video_id: videoId,
    source_channel: sourceChannel,
    selected_model_id: matchedModel.id,
    model_glb_url: matchedModel.model_glb_url,
    lesson_title_uz: topicHint,
    cached: false,
    provider: 'catalog-fallback',
    segments: matchedModel.hotspots.map((spot, idx) => ({
      start_sec: idx * 20,
      end_sec: (idx + 1) * 20,
      uzbek_title: spot.label_uz,
      uzbek_explanation: `${topicHint}: ${spot.description_uz}`,
      camera_hotspot: spot.id,
      emoji_mimic: idx === 0 ? 'explaining' : idx === matchedModel.hotspots.length - 1 ? 'happy' : 'thinking',
      key_formula_or_term: null,
    })),
  };
  if (videoId) persistCacheEntry(videoId, synthesized);
  return synthesized;
}
