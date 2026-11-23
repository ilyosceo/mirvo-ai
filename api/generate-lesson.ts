import express, { type Request, type Response } from 'express';
import {
  applyRateLimitHeaders,
  checkIpRateLimit,
  sendRateLimitError,
} from '../server/rateLimit.js';
import {
  generateUz3DLesson,
  getCachedUz3DLesson,
  type GenerateUz3DLessonRequest,
} from '../server/uz3dLessonService.js';

export const maxDuration = 60;

const app = express();
app.use(express.json({ limit: '12mb' }));

app.get(['/api/generate-lesson', '/'], (req: Request, res: Response) => {
  const videoId = String(req.query.video_id || '').trim();
  if (!videoId) {
    res.status(400).json({ error: 'video_id parametri talab qilinadi.' });
    return;
  }
  const hit = getCachedUz3DLesson(videoId);
  if (!hit) {
    res.status(404).json({ cached: false });
    return;
  }
  res.json(hit);
});

app.post(['/api/generate-lesson', '/'], async (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as GenerateUz3DLessonRequest;
    const hasContent = Boolean(
      body.subtitles?.trim() ||
        body.audio_base64?.trim() ||
        body.image_base64?.trim() ||
        body.topic?.trim() ||
        body.video_id?.trim()
    );
    if (!hasContent) {
      res.status(400).json({
        error: 'Subtitr matni, audio, rasm yoki mavzu nomi yuborilishi shart.',
      });
      return;
    }

    const videoId = body.video_id?.trim();
    if (videoId) {
      const hit = getCachedUz3DLesson(videoId);
      if (hit) {
        res.json(hit);
        return;
      }
    }

    const limitStatus = checkIpRateLimit(req, { bucket: 'ai-lessons' });
    if (!limitStatus.allowed) {
      sendRateLimitError(res, limitStatus);
      return;
    }
    applyRateLimitHeaders(res, limitStatus);

    const lesson = await generateUz3DLesson(body);
    res.json(lesson);
  } catch (err) {
    console.error('Error in /api/generate-lesson:', err);
    res.status(500).json({ error: 'Uz3D darsini yaratishda xatolik yuz berdi.' });
  }
});

export default app;
