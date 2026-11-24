import { GoogleGenAI } from '@google/genai';
import express, { type Request, type Response } from 'express';
import { findBuiltInCachedLesson } from '../../lib/lessonMatch.js';
import { generateSceneArchitecturePlan } from '../../lib/sceneArchitect.js';
import { createTutorResolveRouter } from '../../tutor/resolve.js';
import type { TutorLesson } from '../../types/tutor.js';

export const maxDuration = 60;

const DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

function extractJson(raw: string): any {
  const text = (raw || '').trim();
  try {
    return jsonParseClean(text);
  } catch {}

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return jsonParseClean(fenced[1].trim());
    } catch {}
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return jsonParseClean(text.slice(start, end + 1));
    } catch {}
  }
  return null;
}

function jsonParseClean(str: string): any {
  // Strip trailing commas before closing braces/brackets if any
  const cleaned = str.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(cleaned);
}

const app = express();
app.use(express.json({ limit: '20mb' }));

// Core handler for /api/tutor/resolve with Qwen / Modal / Gemini multi-tier support
async function handleResolveLesson(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const {
    query = '',
    stepsCount,
    stepCount,
    device_tier,
  } = req.body || {};

  const trimmedQuery = String(query || '').trim();
  const safeCount = Math.max(4, Math.min(12, Number(stepsCount || stepCount || 6)));
  const deviceTier = (device_tier === 'high' || device_tier === 'mid' ? device_tier : 'low') as 'low' | 'mid' | 'high';
  const scenePlan = generateSceneArchitecturePlan(trimmedQuery || 'energetika muhandisligi', deviceTier);

  if (!trimmedQuery) {
    res.status(400).json({ error: 'Query parametri kiritilishi shart' });
    return;
  }

  // 1. Built-in instant cache check ($0 cost, 0ms latency)
  const cached = findBuiltInCachedLesson(trimmedQuery);
  if (cached) {
    const lesson: TutorLesson = {
      ...cached,
      requested_steps: safeCount,
      scenePlan,
    };
    res.json({
      lesson,
      stage: 'cache',
      latency_ms: Date.now() - startTime,
    });
    return;
  }

  // 2. Try deployed Modal backend if configured
  const rawModalUrl = process.env.MODAL_BACKEND_URL?.trim();
  const modalUrl = (rawModalUrl || '').replace(/\/+$/, '');
  const internalSecret = process.env.MIRVO_INTERNAL_SECRET?.trim() || '';

  if (modalUrl && !modalUrl.includes('PASTE_YOUR_MODAL_URL_HERE')) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 35_000);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (internalSecret) {
        headers['X-Mirvo-Secret'] = internalSecret;
        headers['Authorization'] = `Bearer ${internalSecret}`;
      }

      // Check generate-lesson or explain-video on Modal
      const modalResp = await fetch(`${modalUrl}/api/generate-lesson`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          topic: trimmedQuery,
          mode: 'image_or_topic',
          stepsCount: safeCount,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (modalResp.ok) {
        const modalData = await modalResp.json();
        const lesson = modalData.lesson || modalData;
        if (lesson && Array.isArray(lesson.steps) && lesson.steps.length > 0) {
          lesson.scenePlan = scenePlan;
          res.json({
            lesson,
            stage: 'modal-backend',
            latency_ms: Date.now() - startTime,
          });
          return;
        }
      }
    } catch (err) {
      console.warn('Modal backend resolve failed, falling back to Qwen:', err);
    }
  }

  // 3. Connect to Alibaba Cloud Qwen (DashScope API)
  const qwenApiKey = process.env.QWEN_API_KEY?.trim() || process.env.DASHSCOPE_API_KEY?.trim();
  if (qwenApiKey) {
    try {
      const qwenController = new AbortController();
      const qwenTimer = setTimeout(() => qwenController.abort(), 40_000);

      const systemPrompt = `You are Mirvo AI, an elite STEM & interactive visual whiteboard tutor teaching in Uzbek (Lotin alifbosi).
Generate a structured, progressive ${safeCount}-step lesson for the given topic.
Return ONLY valid JSON matching this TutorLesson schema:
{
  "topic_title": "Mavzu nomi (o'zbekcha)",
  "subject": "physics" | "math" | "geometry" | "chemistry" | "biology" | "history" | "language",
  "engine": "svg2d" | "zdog" | "mafs" | "jsxgraph" | "konva" | "matter" | "rapier2d" | "rdkit" | "pubchem" | "cytoscape" | "xyflow" | "plotly2d" | "mermaid",
  "sliders": [
    { "id": "param1", "label": "Tezlik", "min": 1, "max": 10, "step": 1, "default": 5, "unit": "m/s" }
  ],
  "steps": [
    {
      "step_number": 1,
      "board_title": "Qadam sarlavhasi",
      "step_title": "Qadam tavsifi",
      "latex": "Formula (LaTeX ko'rinishida)",
      "katex_formulas": ["F = m \\cdot a"],
      "visual_type": "custom_3d_scene" | "custom_2d_svg" | "pythagoras" | "circle" | "polygon",
      "visual_data": {
        "showAxes": true,
        "objects": [
          { "type": "box", "position": [0, 0, 0], "color": "#2563EB", "label": "Jism" }
        ],
        "svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 360'>...</svg>"
      },
      "speech_text": "Nutq uchun tabiiy o'zbekcha matn (formulalarni so'z bilan yozing, masalan: ef teng em ko'paytirilgan a)",
      "explanation_uz": "Batafsil o'zbekcha tushuntirish",
      "emoji_emotion": "explaining",
      "quiz": {
        "question": "Tekshiruv savoli?",
        "options": ["A javob", "B javob", "C javob"],
        "correct_index": 0,
        "explanation_uz": "Nima uchun bu javob to'g'riligi"
      }
    }
  ]
}`;

      const qwenResp = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${qwenApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Mavzu: "${trimmedQuery}". AYNAN ${safeCount} qadamli to'liq dars yarat.` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.25,
        }),
        signal: qwenController.signal,
      });
      clearTimeout(qwenTimer);

      if (qwenResp.ok) {
        const qwenData = await qwenResp.json();
        const rawContent = qwenData.choices?.[0]?.message?.content || '';
        const parsedLesson = extractJson(rawContent);

        if (parsedLesson && Array.isArray(parsedLesson.steps) && parsedLesson.steps.length > 0) {
          const lesson: TutorLesson = {
            topic_title: parsedLesson.topic_title || trimmedQuery,
            subject: parsedLesson.subject || 'physics',
            engine: parsedLesson.engine || 'threejs',
            sliders: Array.isArray(parsedLesson.sliders) ? parsedLesson.sliders : [],
            steps: parsedLesson.steps.map((st: any, idx: number) => ({
              step_number: st.step_number || idx + 1,
              board_title: st.board_title || `Qadam ${idx + 1}`,
              step_title: st.step_title || `Qadam ${idx + 1}`,
              latex: st.latex || '',
              katex_formulas: Array.isArray(st.katex_formulas) ? st.katex_formulas : [],
              visual_type: st.visual_type || 'custom_3d_scene',
              visual_data: st.visual_data || { showAxes: true, objects: [] },
              speech_text: st.speech_text || st.explanation_uz || '',
              explanation_uz: st.explanation_uz || '',
              emoji_emotion: st.emoji_emotion || 'explaining',
              quiz: st.quiz || undefined,
            })),
            requested_steps: safeCount,
            scenePlan,
          };

          res.json({
            lesson,
            stage: 'modal-backend',
            provider: 'qwen-dashscope',
            latency_ms: Date.now() - startTime,
            token_usage: qwenData.usage,
          });
          return;
        }
      }
    } catch (err) {
      console.warn('Qwen DashScope resolve failed, falling back to Gemini:', err);
    }
  }

  // 4. Delegate to existing Gemini / procedural fallback router
  defaultRouter(req, res, () => {
    res.status(500).json({
      error: "Dars yaratish uchun QWEN_API_KEY, MODAL_BACKEND_URL yoki GEMINI_API_KEY talab qilinadi.",
    });
  });
}

// Instantiate existing router for Gemini, local procedural fallback, check-answer, and evaluate
const { router: defaultRouter } = createTutorResolveRouter({
  dataDir: process.env.TMPDIR || '/tmp',
  getGeminiClient: () => {
    const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
    return apiKey
      ? new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        })
      : null;
  },
});

app.post(['/api/tutor/resolve', '/tutor/resolve', '/'], (req: Request, res: Response) => {
  void handleResolveLesson(req, res);
});

// Pass through all other subroutes (check-answer, evaluate-lesson, objects/resolve, etc.)
app.use(defaultRouter);

export default app;
