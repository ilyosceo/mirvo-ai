import express, { type Request, type Response } from 'express';
import { adaptMirvoSceneWithQwen } from '../../lib/qwenSceneAdapter.js';

export const maxDuration = 60;

const app = express();
app.use(express.json({ limit: '4mb' }));

async function handleSceneAdapt(req: Request, res: Response): Promise<void> {
  const { query = '', modelId = '', stepCount = 5 } = req.body || {};
  const trimmedQuery = String(query || '').trim();
  const trimmedModelId = String(modelId || '').trim();

  if (!trimmedQuery || !trimmedModelId) {
    res.status(400).json({ error: 'query va modelId kiritilishi shart.' });
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

  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  const originUrl = host ? `${proto}://${host}` : undefined;

  try {
    const result = await adaptMirvoSceneWithQwen({
      apiKey: qwenApiKey,
      query: trimmedQuery,
      modelId: trimmedModelId,
      stepCount: Math.max(4, Math.min(6, Number(stepCount) || 5)),
      originUrl,
    });
    res.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Shablonni moslashtirishda kutilmagan xatolik.';
    res.status(502).json({ error: message });
  }
}

app.post(
  ['/api/tutor/html-scene-adapt', '/tutor/html-scene-adapt', '/'],
  (req: Request, res: Response) => {
    void handleSceneAdapt(req, res);
  }
);

export default app;
