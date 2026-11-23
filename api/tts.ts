import express, { type Request, type Response } from 'express';

export const maxDuration = 60;

const app = express();
app.use(express.json({ limit: '2mb' }));

app.post(['/api/tts', '/'], async (req: Request, res: Response) => {
  const modalUrl = process.env.MODAL_BACKEND_URL?.trim().replace(/\/+$/, '');
  const internalSecret = process.env.MIRVO_INTERNAL_SECRET?.trim() || '';

  if (modalUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (internalSecret) {
        headers['X-Mirvo-Secret'] = internalSecret;
        headers['Authorization'] = `Bearer ${internalSecret}`;
      }
      const upstream = await fetch(`${modalUrl}/tts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req.body || {}),
        signal: controller.signal,
      });
      if (upstream.ok) {
        const contentType = upstream.headers.get('content-type') || 'application/json';
        if (contentType.includes('audio/')) {
          const buf = Buffer.from(await upstream.arrayBuffer());
          res.type(contentType).send(buf);
          return;
        }
        const json = await upstream.json();
        res.json(json);
        return;
      }
    } catch (err) {
      console.warn('Modal /tts fallback to Web Speech:', err);
    } finally {
      clearTimeout(timer);
    }
  }

  res.json({
    fallback: true,
    missingKey: !process.env.GEMINI_API_KEY?.trim(),
  });
});

export default app;
