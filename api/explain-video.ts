import express, { type Request, type Response } from 'express';
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

const app = express();
app.use(express.json({ limit: '6mb' }));

app.post(['/api/explain-video', '/'], async (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as ExplainVideoRequestBody;
    const hasFrames = Array.isArray(body.frames) && body.frames.length > 0;
    const hasAudio = Boolean(body.audioBase64?.trim());
    const hasTopicOrUrl = Boolean(
      body.topic?.trim() || body.youtubeUrl?.trim() || body.notes?.trim()
    );
    if (!hasFrames && !hasAudio && !hasTopicOrUrl) {
      res.status(400).json({
        error: 'Video kadrlar, audio, YouTube havolasi yoki mavzu nomi yuborilishi kerak.',
      });
      return;
    }

    const cached = getCachedExplainVideoResult(body);
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

    const result = await handleExplainVideoRequest(body);
    res.json(result);
  } catch (err) {
    console.error('Error in /api/explain-video:', err);
    res.status(500).json({
      error: "Videodan dars yaratishda xatolik yuz berdi. Qayta urinib ko'ring.",
    });
  }
});

export default app;
