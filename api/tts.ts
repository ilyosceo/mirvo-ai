import type { ServerResponse } from 'node:http';
import {
  getModalProxyConfig,
  MAX_TTS_AUDIO_BYTES,
  MAX_TTS_BODY_BYTES,
  parseJsonBody,
  readRequestBody,
  sendJson,
  type RequestWithOptionalBody,
} from './lib/modalProxy.ts';
import { isEdgeVoice, normalizeTtsText } from '../lib/ttsContract.ts';

export const config = {
  maxDuration: 25,
  api: { bodyParser: false },
};

export default async function handler(
  req: RequestWithOptionalBody,
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const proxyConfig = getModalProxyConfig();
  if (!proxyConfig) {
    sendJson(res, 500, {
      error: 'TTS service is not configured. Set MODAL_BACKEND_URL and MIRVO_INTERNAL_SECRET in Vercel.',
    });
    return;
  }

  let requestBody: Buffer | null;
  try {
    requestBody = await readRequestBody(req, MAX_TTS_BODY_BYTES);
  } catch {
    sendJson(res, 413, { error: 'TTS request exceeds the size limit.' });
    return;
  }
  const body = parseJsonBody(requestBody);
  if (
    !body ||
    Object.keys(body).some((key) => key !== 'text' && key !== 'voice') ||
    !normalizeTtsText(body.text) ||
    !isEdgeVoice(body.voice)
  ) {
    sendJson(res, 400, {
      error: 'Invalid TTS request. Provide text and a supported Uzbek voice.',
    });
    return;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${proxyConfig.backendUrl}/tts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${proxyConfig.secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: normalizeTtsText(body.text),
        voice: body.voice,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    sendJson(res, 502, { error: 'TTS service is temporarily unavailable.' });
    return;
  }

  const contentType = upstream.headers.get('content-type')?.toLowerCase() || '';
  if (!upstream.ok || !contentType.startsWith('audio/mpeg')) {
    await upstream.body?.cancel();
    const status = upstream.status === 429 ? 429 : upstream.status === 503 ? 503 : 502;
    sendJson(res, status, {
      error:
        status === 429
          ? 'TTS service is busy. Please try again shortly.'
          : 'TTS service could not synthesize audio.',
    });
    return;
  }

  const contentLength = Number(upstream.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_TTS_AUDIO_BYTES) {
    await upstream.body?.cancel();
    sendJson(res, 502, { error: 'TTS service returned oversized audio.' });
    return;
  }

  try {
    const audio = Buffer.from(await upstream.arrayBuffer());
    if (audio.length === 0 || audio.length > MAX_TTS_AUDIO_BYTES) {
      sendJson(res, 502, { error: 'TTS service returned invalid audio.' });
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audio.length);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(audio);
  } catch {
    sendJson(res, 502, { error: 'TTS service returned invalid audio.' });
  }
}
