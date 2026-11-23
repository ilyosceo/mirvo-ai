import { GoogleGenAI } from '@google/genai';
import express, { type Request, type Response } from 'express';
import { createTutorResolveRouter } from '../tutor/resolve.js';
import { normalizeModalLesson } from '../server/modalLesson.js';
import {
  applyRateLimitHeaders,
  checkIpRateLimit,
  sendRateLimitError,
} from '../server/rateLimit.js';
import {
  getCachedExplainVideoResult,
  handleExplainVideoRequest,
  type ExplainVideoRequestBody,
} from '../server/videoLessonService.js';

export const maxDuration = 60;

function isUsableApiKey(raw?: string): raw is string {
  if (!raw) return false;
  const k = raw.trim();
  if (k.length < 20) return false;
  return !/^(MY_|YOUR_|TEST_|DEMO_|PLACEHOLDER|REPLACE|CHANGEME|GEMINI_API_KEY)/i.test(k);
}

const app = express();
app.use(express.json({ limit: '10mb' }));

const { router: localTutorRouter } = createTutorResolveRouter({
  dataDir: process.env.TMPDIR || '/tmp',
  getGeminiClient: () => {
    const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
    return isUsableApiKey(apiKey)
      ? new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        })
      : null;
  },
});

app.post(['/api/tutor', '/'], async (req: Request, res: Response, next) => {
  const body = (req.body || {}) as Record<string, unknown>;

  if (body.mode === 'video') {
    try {
      const videoBody = body as ExplainVideoRequestBody;
      const cached = getCachedExplainVideoResult(videoBody);
      if (cached) {
        res.json(cached);
        return;
      }
      const limitStatus = checkIpRateLimit(req, { bucket: 'ai-lessons' });
      if (!limitStatus.allowed) {
        sendRateLimitError(res, limitStatus);
        return;
      }
      applyRateLimitHeaders(res, limitStatus);

      const result = await handleExplainVideoRequest(videoBody);
      res.json(result);
    } catch (err) {
      console.error('Error in /api/tutor (video mode):', err);
      res.status(500).json({ error: "Videodan dars yaratishda xatolik yuz berdi." });
    }
    return;
  }

  const hasGemini = isUsableApiKey(
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()
  );
  const modalUrl = process.env.MODAL_BACKEND_URL?.trim().replace(/\/+$/, '');
  const internalSecret = process.env.MIRVO_INTERNAL_SECRET?.trim() || '';
  if (!hasGemini && modalUrl && typeof body.query === 'string' && body.query.trim()) {
    const limitStatus = checkIpRateLimit(req, { bucket: 'ai-lessons' });
    if (!limitStatus.allowed) {
      sendRateLimitError(res, limitStatus);
      return;
    }
    applyRateLimitHeaders(res, limitStatus);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50_000);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (internalSecret) {
        headers['X-Mirvo-Secret'] = internalSecret;
        headers['Authorization'] = `Bearer ${internalSecret}`;
      }
      const upstream = await fetch(`${modalUrl}/tutor`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (upstream.ok) {
        const raw = await upstream.json();
        const lesson = normalizeModalLesson(raw, String(body.query), 'modal-backend');
        res.json({
          lesson,
          stage: 'modal-backend',
          latency_ms:
            typeof (raw as { latency_ms?: number }).latency_ms === 'number'
              ? (raw as { latency_ms: number }).latency_ms
              : 0,
          token_usage: lesson.token_usage,
        });
        return;
      }
    } catch (err) {
      console.warn('Modal /tutor proxy fallback to local Gemini/catalog:', err);
    } finally {
      clearTimeout(timer);
    }
  }

  next();
});

app.use(localTutorRouter);

export default app;
