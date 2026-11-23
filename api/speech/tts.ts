import express, { type Request, type Response } from 'express';

export const maxDuration = 60;

const app = express();
app.use(express.json({ limit: '6mb' }));

app.all(['/api/speech/tts', '/speech/tts', '/tts', '/'], async (req: Request, res: Response) => {
  if (req.method === 'GET') {
    res.json({ ok: true, route: '/api/speech/tts', service: 'Mirvo TTS Proxy' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const rawModalUrl = process.env.MODAL_BACKEND_URL?.trim();
  const modalUrl = (rawModalUrl || 'https://PASTE_YOUR_MODAL_URL_HERE.modal.run').replace(/\/+$/, '');
  const internalSecret = process.env.MIRVO_INTERNAL_SECRET?.trim() || '';

  const { text, texts, voice, gender, pitch } = req.body || {};
  const effectiveText = text || (Array.isArray(texts) ? texts.join(' ') : '') || '';

  // If Modal URL is still the placeholder or unset, return clean fallback JSON so Web Speech API activates
  if (!rawModalUrl || modalUrl.includes('PASTE_YOUR_MODAL_URL_HERE')) {
    res.json({
      fallback: true,
      missingKey: true,
      audioBase64: null,
      message: 'MODAL_BACKEND_URL is not configured yet in Vercel Environment Variables',
    });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28_000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, audio/*',
    };
    if (internalSecret) {
      headers['X-Mirvo-Secret'] = internalSecret;
      headers['Authorization'] = `Bearer ${internalSecret}`;
    }

    const payload = {
      text: effectiveText,
      texts: texts || (effectiveText ? [effectiveText] : []),
      voice: voice || (gender === 'male' ? 'uz-male' : 'uz-female'),
      gender: gender || 'female',
      pitch: pitch ?? 1.0,
    };

    // Try target endpoints on Modal backend
    const targetUrl = modalUrl.endsWith('/tts') ? modalUrl : `${modalUrl}/tts`;
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (upstream.ok) {
      const contentType = upstream.headers.get('content-type') || 'application/json';

      // 1. If upstream returns audio bytes
      if (contentType.includes('audio/') || contentType.includes('application/octet-stream')) {
        const buf = Buffer.from(await upstream.arrayBuffer());
        if (req.headers.accept?.includes('audio/')) {
          res.type(contentType).send(buf);
          return;
        }
        res.json({
          audioBase64: buf.toString('base64'),
          mimeType: contentType.includes('audio/') ? contentType : 'audio/mp3',
        });
        return;
      }

      // 2. If upstream returns JSON
      const json = await upstream.json();
      res.json(json);
      return;
    }

    console.warn(`Modal /tts returned HTTP ${upstream.status}`);
  } catch (err) {
    console.warn('Modal TTS proxy error, falling back:', err);
  } finally {
    clearTimeout(timer);
  }

  // Graceful fallback: return 200 JSON with fallback: true so frontend voiceEngine uses Web Speech API seamlessly
  res.json({
    fallback: true,
    audioBase64: null,
  });
});

export default app;
