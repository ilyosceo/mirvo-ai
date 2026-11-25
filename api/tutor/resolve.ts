import { GoogleGenAI } from '@google/genai';
import express, { type Request, type Response } from 'express';
import { findBuiltInCachedLesson } from '../../lib/lessonMatch.js';
import {
  generateQwenOmni3DLesson,
  upgradeDeviceLessonToTrue3D,
} from '../../lib/qwenOmni3DDirector.js';
import { generateSceneArchitecturePlan } from '../../lib/sceneArchitect.js';
import { ZERO_TOKEN_USAGE } from '../../lib/tokenUsage.js';
import { createTutorResolveRouter } from '../../tutor/resolve.js';
import type { TutorLesson } from '../../types/tutor.js';

export const maxDuration = 60;

const app = express();
app.use(express.json({ limit: '20mb' }));

async function handleResolveLesson(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const {
    query = '',
    stepsCount,
    stepCount,
    imageBase64,
    imageMimeType,
    forceAi = false,
    device_tier,
  } = req.body || {};

  const trimmedQuery = String(query || '').trim();
  const safeCount = Math.max(4, Math.min(12, Number(stepsCount || stepCount || 4)));
  const deviceTier = (
    device_tier === 'high' || device_tier === 'mid' ? device_tier : 'low'
  ) as 'low' | 'mid' | 'high';
  const scenePlan = generateSceneArchitecturePlan(
    trimmedQuery || 'energetika muhandisligi',
    deviceTier
  );

  if (!trimmedQuery && !imageBase64) {
    res.status(400).json({ error: 'Query yoki rasm kiritilishi shart' });
    return;
  }

  // 1. Instant built-in cache check ($0 cost) when no image & not forcing AI
  if (!imageBase64 && !forceAi && trimmedQuery) {
    const cached = findBuiltInCachedLesson(trimmedQuery);
    if (cached && cached.steps.length >= Math.min(safeCount, 4)) {
      const upgraded = upgradeDeviceLessonToTrue3D(cached, trimmedQuery);
      const lesson: TutorLesson = {
        ...upgraded,
        requested_steps: safeCount,
        token_usage: ZERO_TOKEN_USAGE,
        scenePlan,
      };
      res.json({
        lesson,
        stage: 'cache',
        latency_ms: Date.now() - startTime,
        token_usage: ZERO_TOKEN_USAGE,
      });
      return;
    }
  }

  // 2. Primary: Alibaba Cloud Qwen 3.8 Omni Flash (True 3D PBR Generator + Exact Token Metering)
  const qwenApiKey =
    process.env.QWEN_API_KEY?.trim() || process.env.DASHSCOPE_API_KEY?.trim();
  if (qwenApiKey) {
    const qwenResult = await generateQwenOmni3DLesson({
      apiKey: qwenApiKey,
      query: trimmedQuery || 'Rasm asosida 3D texnik tahlil',
      stepCount: safeCount,
      imageBase64,
      imageMimeType,
    });

    if (qwenResult) {
      qwenResult.lesson.scenePlan = scenePlan;
      res.json({
        lesson: qwenResult.lesson,
        stage: 'qwen-omni',
        provider: 'qwen-dashscope',
        model: qwenResult.modelUsed,
        latency_ms: Date.now() - startTime,
        token_usage: qwenResult.tokenUsage,
      });
      return;
    }
  }

  // 3. Secondary: Deployed Modal backend if configured
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
        const rawLesson = modalData.lesson || modalData;
        if (rawLesson && Array.isArray(rawLesson.steps) && rawLesson.steps.length > 0) {
          const lesson = upgradeDeviceLessonToTrue3D(rawLesson, trimmedQuery);
          lesson.scenePlan = scenePlan;
          res.json({
            lesson,
            stage: 'modal-backend',
            latency_ms: Date.now() - startTime,
            token_usage: modalData.token_usage ?? lesson.token_usage,
          });
          return;
        }
      }
    } catch (err) {
      console.warn('Modal backend resolve failed, falling back to Gemini/procedural:', err);
    }
  }

  // 4. Fallback: Gemini / procedural fallback router
  defaultRouter(req, res, () => {
    res.status(500).json({
      error:
        'Dars yaratish uchun QWEN_API_KEY (DashScope), MODAL_BACKEND_URL yoki GEMINI_API_KEY sozlanishi kerak.',
    });
  });
}

const { router: defaultRouter } = createTutorResolveRouter({
  dataDir: process.env.TMPDIR || '/tmp',
  getGeminiClient: () => {
    const apiKey =
      process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
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

app.use(defaultRouter);

export default app;
