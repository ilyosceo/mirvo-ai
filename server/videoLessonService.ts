import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { findBuiltInCachedLesson } from '../lib/lessonMatch.js';
import {
  extractObjectIntent,
  generateProceduralObjectSvg,
  generateProceduralPrimitives3D,
} from '../lib/objectCatalog.js';
import { normalizeModalLesson } from './modalLesson.js';
import { extractYouTubeVideoId, fetchYouTubeContext } from './youtubeTranscript.js';
import type { TokenUsageInfo, TutorLesson } from '../types/tutor.js';

function isUsableApiKey(raw?: string): raw is string {
  if (!raw) return false;
  const k = raw.trim();
  if (k.length < 20) return false;
  if (/^(MY_|YOUR_|TEST_|DEMO_|PLACEHOLDER|REPLACE|CHANGEME|GEMINI_API_KEY)/i.test(k)) {
    return false;
  }
  return true;
}

export interface ExplainVideoRequestBody {
  frames?: string[];
  audioBase64?: string;
  audioMime?: string;
  topic?: string;
  notes?: string;
  youtubeUrl?: string;
  language?: 'uz';
  depth?: 'overview' | 'standard' | 'deep';
}

export interface ExplainVideoResult {
  lesson: TutorLesson;
  stage: 'modal-backend' | 'video-lesson';
  provider: 'modal-qwen-vl' | 'dashscope-qwen-vl' | 'gemini-multimodal' | 'fallback' | 'cache';
  latency_ms: number;
  cached?: boolean;
  token_usage?: TokenUsageInfo;
}

const DASHSCOPE_URL =
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';

const videoMemoryCache = new Map<string, ExplainVideoResult>();
const VIDEO_CACHE_FILE = path.join(
  process.env.TMPDIR || '/tmp',
  'mirvo-video-lesson-cache.json'
);

function loadVideoDiskCache(): void {
  if (videoMemoryCache.size > 0) return;
  try {
    if (fs.existsSync(VIDEO_CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(VIDEO_CACHE_FILE, 'utf8')) as Record<
        string,
        ExplainVideoResult
      >;
      for (const [k, v] of Object.entries(parsed)) {
        if (k && v?.lesson?.steps?.length) {
          videoMemoryCache.set(k, v);
        }
      }
    }
  } catch {
    // Ignore corrupt temp cache
  }
}

function persistVideoCacheEntry(cacheKey: string, result: ExplainVideoResult): void {
  if (!cacheKey || result.provider === 'fallback') return;
  videoMemoryCache.set(cacheKey, result);
  try {
    const obj: Record<string, ExplainVideoResult> = {};
    let count = 0;
    for (const [k, v] of videoMemoryCache.entries()) {
      obj[k] = v;
      count += 1;
      if (count >= 60) break;
    }
    fs.writeFileSync(VIDEO_CACHE_FILE, JSON.stringify(obj), 'utf8');
  } catch {
    // Ignore read-only serverless fs errors
  }
}

function buildVideoCacheKey(body: ExplainVideoRequestBody): string | null {
  const ytId = body.youtubeUrl ? extractYouTubeVideoId(body.youtubeUrl) : null;
  if (ytId) {
    const notesPart = (body.notes || '').trim().toLowerCase();
    return `v2:yt:${ytId}:${notesPart.slice(0, 80)}`;
  }
  const hasFrames = Array.isArray(body.frames) && body.frames.length > 0;
  const hasAudio = Boolean(body.audioBase64?.trim());
  if (!hasFrames && !hasAudio) return null;
  const h = crypto.createHash('sha256');
  h.update(body.topic?.trim().toLowerCase() || '');
  h.update('|');
  h.update(body.notes?.trim().toLowerCase() || '');
  h.update('|');
  for (const f of (body.frames || []).slice(0, 4)) {
    h.update(f.slice(0, 120));
    h.update(String(f.length));
  }
  if (body.audioBase64) {
    h.update(body.audioBase64.slice(0, 120));
    h.update(String(body.audioBase64.length));
  }
  return `v2:media:${h.digest('hex').slice(0, 24)}`;
}

export function getCachedExplainVideoResult(
  body: ExplainVideoRequestBody
): ExplainVideoResult | null {
  loadVideoDiskCache();
  const key = buildVideoCacheKey(body);
  if (!key) return null;
  const hit = videoMemoryCache.get(key);
  if (!hit) return null;
  return {
    ...hit,
    cached: true,
    latency_ms: 4,
    lesson: {
      ...hit.lesson,
      source: 'cache',
    },
  };
}

const VIDEO_LESSON_SYSTEM_PROMPT = `You are Mirvo AI — an interactive STEM & visual whiteboard tutor teaching in Uzbek (Lotin alifbosi).
Analyze the provided video keyframes, teacher audio/transcript, and topic notes carefully:
1. Read EVERY diagram, 2D schematic, 3D geometry, force vector, circuit, biological process, number, label, and equation shown across the frames AND listen to/read the spoken explanation ("nega bunday bo'ldi?", examples, definitions).
2. Break the video explanation into 4 to 8 clear, logical whiteboard steps.
3. For EACH step, choose the best visual mode:
   - "custom_2d_svg": reconstruct 2D physics/math/biology/circuit diagrams cleanly with well-proportioned SVG markup (viewBox="0 0 600 360", crisp colors #2563EB, #F59E0B, #10B981, #EF4444, #0F172A, arrows, clear Uzbek labels). CRITICAL: Group each named part inside <g data-part-id="part_0">...</g>, <g data-part-id="part_1">...</g>, etc. Include visual_data: { svg, viewBox: "0 0 600 360", labels: [{ text, x, y, color, partId }], highlights: [{ x, y, r, color, label, partId }] }.
   - "custom_3d_scene": reconstruct 3D shapes, axes, forces, pistons, machines, organs, or spatial models using interactive 3D primitives. EVERY object MUST have a unique/grouped "partId" ("part_0", "part_1", ...). Include visual_data: { showAxes: true, objects: [{ type: "box"|"cylinder"|"sphere"|"cone"|"torus"|"vector"|"arrow"|"plane", position: [x,y,z], rotation: [rx,ry,rz], args: [...], from: [x,y,z], to: [x,y,z], color, opacity, label, partId }] }.
   - "physics_sim": real-time 2D Matter.js rigid-body mechanics simulation! Use for pendulum, inclined plane, elastic collision, lever/torque, hydraulic press, or Hooke's spring. Include visual_data: { physics_preset: "pendulum" | "incline" | "collision" | "lever" | "hydraulic" | "spring", title }.
   - Existing catalog templates when exact: "pythagoras", "triangle", "circle", "unit_circle", "polygon", "photosynthesis", "sky_scattering", "plotly2d" ({ expression }), "plotly3d" ({ expression_z }), "mermaid" ({ diagram }), "object_2d" / "object_3d".
4. CRITICAL FOCUS & BEATS RULE: On EVERY step, include "focusPart" AND "beats" (2-3 spoken sentences), where each beat points the Mirvo Mentor emoji directly at that sentence's detail ("focus_target" and "focusPart" MUST match a real data-part-id / 3D partId from that step's visual_data, with "tutor_pose": "approach", "camera_zoom": 1.35).
5. Write simple, warm, step-by-step Uzbek explanations:
   - "speech_text" and "beats[*].sentence": MUST be written strictly in spoken Uzbek words ONLY — NO raw LaTeX, NO $, +, =, ×, /, ^, √, π symbols (write "qo‘shilgan", "teng", "ko‘paytirilgan", "bo‘lingan", "kvadrat", "pi" in words so TTS reads naturally).
   - "latex" and "katex_formulas": clean KaTeX math strings for the whiteboard display.
6. Return ONLY valid JSON matching:
{
  "topic_title": "...",
  "subject": "physics" | "math" | "geometry" | "chemistry" | "biology" | "history" | "language",
  "engine": "svg2d" | "threejs" | "plotly2d" | "plotly3d" | "mermaid",
  "sliders": [{ "id": "...", "label": "...", "min": 0, "max": 10, "step": 1, "default": 5, "unit": "" }],
  "steps": [
    {
      "step_number": 1,
      "board_title": "...",
      "step_title": "...",
      "latex": "...",
      "katex_formulas": ["..."],
      "visual_type": "custom_2d_svg" | "custom_3d_scene" | "physics_sim" | ...,
      "visual_data": { ... },
      "focusPart": "part_0",
      "speech_text": "...",
      "explanation_uz": "...",
      "emoji_emotion": "explaining" | "pointing" | "thinking" | "happy",
      "beats": [
        {
          "sentence": "...",
          "focus_target": "part_0",
          "focusPart": "part_0",
          "tutor_pose": "approach",
          "camera_zoom": 1.35,
          "note": "Qism nomi"
        }
      ],
      "quiz": {
        "question": "...",
        "options": ["...", "...", "..."],
        "correct_index": 0,
        "explanation_uz": "..."
      }
    }
  ]
}`;

function extractJsonFromText(rawText: string): Record<string, unknown> | null {
  if (!rawText) return null;
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // Strip markdown fences if present
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim()) as Record<string, unknown>;
    } catch {
      // fall through
    }
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeFrameDataUrl(
  frame: string
): { mimeType: string; base64: string; dataUrl: string } | null {
  if (!frame || typeof frame !== 'string') return null;
  const trimmed = frame.trim();
  const dataUrlMatch = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1],
      base64: dataUrlMatch[2],
      dataUrl: trimmed,
    };
  }
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed.slice(0, 120))) {
    return {
      mimeType: 'image/jpeg',
      base64: trimmed,
      dataUrl: `data:image/jpeg;base64,${trimmed}`,
    };
  }
  return null;
}

function normalizeAudioPayload(
  audioBase64?: string,
  audioMime?: string
): { mimeType: string; base64: string; format: string } | null {
  if (!audioBase64 || typeof audioBase64 !== 'string') return null;
  const trimmed = audioBase64.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^data:(audio\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i);
  const mimeType = match?.[1] || audioMime || 'audio/mp3';
  const base64 = (match?.[2] || trimmed).replace(/\s+/g, '');
  if (base64.length < 32) return null;
  const format = mimeType.includes('wav')
    ? 'wav'
    : mimeType.includes('ogg')
    ? 'ogg'
    : 'mp3';
  return { mimeType, base64, format };
}

export async function handleExplainVideoRequest(
  body: ExplainVideoRequestBody
): Promise<ExplainVideoResult> {
  const startedAt = Date.now();
  loadVideoDiskCache();

  const cachedHit = getCachedExplainVideoResult(body);
  if (cachedHit) {
    return cachedHit;
  }
  const cacheKey = buildVideoCacheKey(body);

  const rawFrames = Array.isArray(body.frames) ? body.frames.slice(0, 15) : [];
  let parsedFrames = rawFrames
    .map(normalizeFrameDataUrl)
    .filter((f): f is NonNullable<ReturnType<typeof normalizeFrameDataUrl>> => f !== null);

  const normalizedAudio = normalizeAudioPayload(body.audioBase64, body.audioMime);

  let ytContext: Awaited<ReturnType<typeof fetchYouTubeContext>> = null;
  if (body.youtubeUrl?.trim()) {
    ytContext = await fetchYouTubeContext(body.youtubeUrl);
    if (parsedFrames.length === 0 && ytContext?.thumbnailDataUrls.length) {
      parsedFrames = ytContext.thumbnailDataUrls
        .map(normalizeFrameDataUrl)
        .filter((f): f is NonNullable<ReturnType<typeof normalizeFrameDataUrl>> => f !== null);
    }
  }

  const topicHint = [
    body.topic?.trim(),
    ytContext?.title ? `YouTube video: ${ytContext.title}` : '',
    body.notes?.trim() ? `Izoh: ${body.notes.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' — ');

  const transcriptBlock = ytContext?.transcript
    ? `\n\nYouTube subtitr / transkript (vaqt belgili):\n${ytContext.transcript}`
    : '';

  const fallbackTopic = body.topic?.trim() || ytContext?.title || 'Videodan dars';

  // 1. Primary: Gemini multimodal (gemini-4-hydrogen) with Frames + Audio + YouTube Transcript
  const geminiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (
    isUsableApiKey(geminiKey) &&
    (parsedFrames.length > 0 || normalizedAudio || ytContext?.transcript || topicHint)
  ) {
    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [
        {
          text:
            `Mavzu / kontekst: ${topicHint || 'Video kadrlardan asosiy ilmiy/o‘quv mavzuni aniqlang'}\n` +
            (ytContext?.author ? `Muallif: ${ytContext.author}\n` : '') +
            `Kadrlar soni: ${parsedFrames.length}. Ovoz yo‘lakchasi: ${
              normalizedAudio ? 'ha (audio ilova qilingan, diqqat bilan tinglang)' : 'yo‘q'
            }. Agar diagramma 2D bo‘lsa custom_2d_svg, 3D bo‘lsa custom_3d_scene ishlating. Javobni FAQAT toza JSON qilib bering.` +
            transcriptBlock,
        },
        ...parsedFrames.map((f) => ({
          inlineData: {
            mimeType: f.mimeType,
            data: f.base64,
          },
        })),
      ];

      if (normalizedAudio) {
        parts.push({
          inlineData: {
            mimeType: normalizedAudio.mimeType,
            data: normalizedAudio.base64,
          },
        });
      }

      const resp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction: VIDEO_LESSON_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsedJson = extractJsonFromText(resp.text || '');
      if (parsedJson) {
        const lesson = normalizeModalLesson(parsedJson, fallbackTopic, 'video-lesson');
        const usageMeta = resp.usageMetadata;
        const promptTok = usageMeta?.promptTokenCount || 0;
        const outTok = usageMeta?.candidatesTokenCount || 0;
        const totalTok = usageMeta?.totalTokenCount || promptTok + outTok;
        const usage: TokenUsageInfo = {
          prompt_tokens: promptTok,
          output_tokens: outTok,
          total_tokens: totalTok,
          cost_usd: Number(((promptTok * 0.75 + outTok * 3.0) / 1_000_000).toFixed(6)),
          llm_calls: 1,
        };
        lesson.token_usage = usage;
        const out: ExplainVideoResult = {
          lesson,
          stage: 'video-lesson',
          provider: 'gemini-multimodal',
          latency_ms: Date.now() - startedAt,
          token_usage: usage,
        };
        if (cacheKey) persistVideoCacheEntry(cacheKey, out);
        return out;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(msg)) {
        console.info('Gemini video service fallback:', msg.slice(0, 140));
      }
    }
  }

  // 2. Optional Modal backend fallback when MODAL_BACKEND_URL is configured
  const modalUrl = process.env.MODAL_BACKEND_URL?.trim().replace(/\/+$/, '');
  const internalSecret = process.env.MIRVO_INTERNAL_SECRET?.trim() || '';
  if (modalUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 52_000);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (internalSecret) {
        headers['X-Mirvo-Secret'] = internalSecret;
        headers['Authorization'] = `Bearer ${internalSecret}`;
      }
      const res = await fetch(`${modalUrl}/explain-video`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          frames: parsedFrames.map((f) => f.dataUrl),
          audioBase64: normalizedAudio?.base64 || '',
          audioMime: normalizedAudio?.mimeType || 'audio/mp3',
          topic: topicHint || fallbackTopic,
          notes: body.notes?.trim() || '',
          youtubeUrl: body.youtubeUrl?.trim() || '',
          transcript: ytContext?.transcript || '',
          language: body.language || 'uz',
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        const json = await res.json();
        const lesson = normalizeModalLesson(json, fallbackTopic, 'video-lesson');
        const out: ExplainVideoResult = {
          lesson,
          stage: 'modal-backend',
          provider: 'modal-qwen-vl',
          latency_ms: Date.now() - startedAt,
          token_usage: lesson.token_usage,
        };
        if (cacheKey) persistVideoCacheEntry(cacheKey, out);
        return out;
      }
    } catch {
      // fall through to secondary options
    } finally {
      clearTimeout(timer);
    }
  }

  // 3. Optional DashScope (qwen3.8-omni-flash when audio present, else qwen-vl-plus)
  const dashscopeKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (dashscopeKey && (parsedFrames.length > 0 || normalizedAudio || ytContext?.transcript || topicHint)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50_000);
    try {
      const userContent: Array<Record<string, unknown>> = [
        {
          type: 'text',
          text:
            `${VIDEO_LESSON_SYSTEM_PROMPT}\n\n` +
            `Mavzu / kontekst: ${topicHint || 'Video kadrlardan mavzuni aniqlang'}\n` +
            `Kadrlar soni: ${parsedFrames.length}. Javobni FAQAT JSON ko'rinishida qaytaring.` +
            transcriptBlock,
        },
        ...parsedFrames.map((f) => ({
          type: 'image_url',
          image_url: { url: f.dataUrl },
        })),
      ];

      const useOmniAudio = Boolean(normalizedAudio);
      if (normalizedAudio) {
        userContent.push({
          type: 'input_audio',
          input_audio: {
            data: normalizedAudio.base64,
            format: normalizedAudio.format,
          },
        });
      }

      const payloadBody: Record<string, unknown> = useOmniAudio
        ? {
            model: 'qwen3.8-omni-flash',
            modalities: ['text'],
            enable_thinking: false,
            messages: [{ role: 'user', content: userContent }],
            response_format: { type: 'json_object' },
          }
        : {
            model: parsedFrames.length > 0 ? 'qwen-vl-plus' : 'qwen-plus',
            messages: [{ role: 'user', content: userContent }],
            temperature: 0.25,
            response_format: { type: 'json_object' },
          };

      const res = await fetch(DASHSCOPE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${dashscopeKey}`,
        },
        body: JSON.stringify(payloadBody),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };
        const content = data.choices?.[0]?.message?.content || '';
        const parsedJson = extractJsonFromText(content);
        if (parsedJson) {
          const lesson = normalizeModalLesson(parsedJson, fallbackTopic, 'video-lesson');
          const usage: TokenUsageInfo | undefined = data.usage
            ? {
                prompt_tokens: data.usage.prompt_tokens || 0,
                output_tokens: data.usage.completion_tokens || 0,
                total_tokens: data.usage.total_tokens || 0,
                cost_usd: 0,
                llm_calls: 1,
              }
            : undefined;
          if (usage) lesson.token_usage = usage;
          const out: ExplainVideoResult = {
            lesson,
            stage: 'video-lesson',
            provider: 'dashscope-qwen-vl',
            latency_ms: Date.now() - startedAt,
            token_usage: usage,
          };
          if (cacheKey) persistVideoCacheEntry(cacheKey, out);
          return out;
        }
      }
    } catch {
      // fall through to local lesson builder
    } finally {
      clearTimeout(timer);
    }
  }

  // 4. Safe deterministic fallback (check built-in topic match first, else synthesize 2D+3D lesson)
  const matchedBuiltIn = findBuiltInCachedLesson(
    `${fallbackTopic} ${ytContext?.transcript?.slice(0, 300) || ''}`
  );
  if (matchedBuiltIn) {
    return {
      lesson: {
        ...matchedBuiltIn,
        source: 'video-lesson',
      },
      stage: 'video-lesson',
      provider: 'fallback',
      latency_ms: Date.now() - startedAt,
    };
  }

  const intent = extractObjectIntent(fallbackTopic);
  const procSvg =
    generateProceduralObjectSvg(intent.name_en, intent.name_uz) ||
    generateProceduralObjectSvg(fallbackTopic, fallbackTopic);
  const proc3d =
    generateProceduralPrimitives3D(intent.name_en) ||
    generateProceduralPrimitives3D(fallbackTopic);

  const svgParts = procSvg?.parts_uz || [
    { label: 'Boshlang‘ich holat', partId: 'part_0' },
    { label: 'Asosiy jarayon', partId: 'part_1' },
    { label: 'Natija', partId: 'part_2' },
  ];

  const fallbackSvgMarkup =
    procSvg?.svg_data ||
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360">
  <rect x="20" y="20" width="560" height="320" rx="20" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
  <g data-part-id="part_0">
    <rect x="65" y="135" width="130" height="90" rx="16" fill="#EFF6FF" stroke="#2563EB" stroke-width="3"/>
    <text x="130" y="185" text-anchor="middle" font-size="14" font-weight="700" fill="#1E3A8A">Kirish</text>
  </g>
  <g data-part-id="part_1">
    <path d="M 200 180 H 248" stroke="#64748B" stroke-width="3" stroke-linecap="round"/>
    <rect x="250" y="125" width="140" height="110" rx="18" fill="#FFFBEB" stroke="#F59E0B" stroke-width="3"/>
    <text x="320" y="185" text-anchor="middle" font-size="14" font-weight="700" fill="#92400E">Asosiy jarayon</text>
  </g>
  <g data-part-id="part_2">
    <path d="M 395 180 H 442" stroke="#64748B" stroke-width="3" stroke-linecap="round"/>
    <rect x="445" y="135" width="110" height="90" rx="16" fill="#ECFDF5" stroke="#10B981" stroke-width="3"/>
    <text x="500" y="185" text-anchor="middle" font-size="14" font-weight="700" fill="#065F46">Natija</text>
  </g>
</svg>`;

  const synthetic3dObjects =
    proc3d && proc3d.length > 0
      ? proc3d.map((p) => ({
          type: p.type,
          position: p.position,
          rotation: p.rotation,
          args: p.args,
          color: p.color,
          opacity: p.opacity,
          label: p.label,
          partId: p.partId || 'part_0',
        }))
      : [
          {
            type: 'box',
            position: [-0.8, 0.7, 0],
            args: [1.6, 1.0, 1.3],
            color: '#2563EB',
            label: 'Asosiy blok',
            partId: 'part_0',
          },
          {
            type: 'cylinder',
            position: [1.1, 0.85, 0],
            args: [0.45, 0.45, 1.4, 24],
            color: '#10B981',
            label: 'Chiqish qismi',
            partId: 'part_1',
          },
          {
            type: 'arrow',
            from: [-1.4, 1.5, 0],
            to: [1.5, 1.8, 0],
            color: '#F59E0B',
            label: 'Yo‘nalish',
            partId: 'part_2',
          },
        ];

  const p0 = svgParts[0]?.partId || 'part_0';
  const p1 = svgParts[1]?.partId || p0;
  const p2 = svgParts[2]?.partId || p1;

  const obj3dP0 = synthetic3dObjects[0]?.partId || 'part_0';
  const obj3dP1 = synthetic3dObjects[1]?.partId || obj3dP0;

  const syntheticLesson = normalizeModalLesson(
    {
      topic_title: fallbackTopic,
      subject: 'physics',
      engine: 'svg2d',
      steps: [
        {
          step_number: 1,
          board_title: `${fallbackTopic} — Asosiy sxema`,
          latex: 'F = m \\cdot a',
          visual_type: 'custom_2d_svg',
          focusPart: p0,
          visual_data: {
            title: fallbackTopic,
            svg: fallbackSvgMarkup,
            viewBox: procSvg?.viewBox || '0 0 600 360',
            labels: svgParts.slice(0, 4).map((pt, idx) => ({
              text: pt.label,
              x: 130 + idx * 145,
              y: 180,
              color: idx === 0 ? '#2563EB' : idx === 1 ? '#F59E0B' : '#10B981',
              partId: pt.partId || `part_${idx}`,
            })),
          },
          speech_text: `${fallbackTopic} mavzusi uch asosiy qismdan iborat. Birinchi qismda boshlang‘ich holat va kirish kattaliklari beriladi. Ikkinchi qismda asosiy jarayon va o‘zaro ta’sir bajariladi. Uchinchi qismda esa yakuniy natija olinadi.`,
          explanation_uz: `${fallbackTopic} bo‘yicha video kadrlardan ajratilgan asosiy tizim sxemasi.`,
          beats: [
            {
              sentence: `${fallbackTopic} mavzusi uch asosiy qismdan iborat.`,
              focus_target: p0,
              focusPart: p0,
              tutor_pose: 'approach',
              camera_zoom: 1.25,
              note: svgParts[0]?.label,
            },
            {
              sentence: `Birinchi qismda boshlang‘ich holat va kirish kattaliklari beriladi.`,
              focus_target: p0,
              focusPart: p0,
              tutor_pose: 'approach',
              camera_zoom: 1.35,
              note: svgParts[0]?.label,
            },
            {
              sentence: `Ikkinchi qismda asosiy jarayon va o‘zaro ta’sir bajariladi.`,
              focus_target: p1,
              focusPart: p1,
              tutor_pose: 'approach',
              camera_zoom: 1.4,
              note: svgParts[1]?.label,
            },
            {
              sentence: `Uchinchi qismda esa yakuniy natija olinadi.`,
              focus_target: p2,
              focusPart: p2,
              tutor_pose: 'approach',
              camera_zoom: 1.35,
              note: svgParts[2]?.label,
            },
          ],
        },
        {
          step_number: 2,
          board_title: `${fallbackTopic} — Fazoviy 3D model`,
          latex: 'E = E_k + E_p',
          visual_type: 'custom_3d_scene',
          focusPart: obj3dP0,
          visual_data: {
            showAxes: true,
            objects: synthetic3dObjects,
          },
          speech_text:
            'Uch o‘lchamli modelda asosiy blok va ta’sir etuvchi yo‘nalish ko‘rsatilgan. Sahna burchagini aylantirib har bir qismni yaqindan ko‘rishingiz mumkin.',
          explanation_uz:
            'Modelni sichqoncha yoki barmoq bilan aylantirib fazoviy joylashuvni tekshiring.',
          beats: [
            {
              sentence: 'Uch o‘lchamli modelda asosiy blok va ta’sir etuvchi yo‘nalish ko‘rsatilgan.',
              focus_target: obj3dP0,
              focusPart: obj3dP0,
              tutor_pose: 'approach',
              camera_zoom: 1.35,
            },
            {
              sentence: 'Sahna burchagini aylantirib har bir qismni yaqindan ko‘rishingiz mumkin.',
              focus_target: obj3dP1,
              focusPart: obj3dP1,
              tutor_pose: 'approach',
              camera_zoom: 1.45,
            },
          ],
        },
      ],
    },
    fallbackTopic,
    'video-lesson'
  );

  return {
    lesson: syntheticLesson,
    stage: 'video-lesson',
    provider: 'fallback',
    latency_ms: Date.now() - startedAt,
  };
}
