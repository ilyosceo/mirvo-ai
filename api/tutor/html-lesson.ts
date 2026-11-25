import express, { type Request, type Response } from 'express';
import { streamQwenHtmlLesson } from '../../lib/qwenHtmlGenerator.js';

export const maxDuration = 60;

const app = express();
app.use(express.json({ limit: '4mb' }));

async function handleHtmlLesson(req: Request, res: Response): Promise<void> {
  const { query = '', stepCount = 5, continueFrom = '', pass = 1 } = req.body || {};
  const trimmed = String(query || '').trim();
  if (!trimmed) {
    res.status(400).json({ error: 'Mavzu yoki qurilma nomi kiritilishi shart.' });
    return;
  }

  const qwenApiKey =
    process.env.QWEN_API_KEY?.trim() || process.env.DASHSCOPE_API_KEY?.trim();

  if (!qwenApiKey) {
    res.status(503).json({
      error:
        'QWEN_API_KEY (Alibaba Cloud DashScope) sozlanmagan. Vercel Environment Variables bo‘limiga QWEN_API_KEY kiriting.',
    });
    return;
  }

  const safeSteps = Math.max(4, Math.min(6, Number(stepCount) || 5));
  const safePass = Math.max(1, Math.min(5, Number(pass) || 1));

  await streamQwenHtmlLesson({
    apiKey: qwenApiKey,
    query: trimmed,
    stepCount: safeSteps,
    continueFrom: String(continueFrom || ''),
    pass: safePass,
    res,
    maxRunMs: 51_000,
  });
}

app.post(['/api/tutor/html-lesson', '/tutor/html-lesson', '/'], (req: Request, res: Response) => {
  void handleHtmlLesson(req, res);
});

export default app;
