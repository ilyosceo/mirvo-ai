import type { ServerResponse } from 'node:http';
import {
  getModalProxyConfig,
  getRequestErrorStatus,
  MAX_TTS_AUDIO_BYTES,
  MAX_TTS_BODY_BYTES,
  parseJsonBody,
  readRequestBody,
  sendJson,
  getUpstreamErrorStatus,
  type RequestWithOptionalBody,
} from '../server/modalProxy.js';
import { isEdgeVoice, normalizeTtsText } from '../lib/ttsContract.js';

export const config = {
  maxDuration: 60,
  api: { bodyParser: false },
};

async function handleRequest(
  req: RequestWithOptionalBody,
  res: ServerResponse,
  setFailureStage: (stage: string) => void
): Promise<void> {
  setFailureStage('method check');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  setFailureStage('Modal configuration');
  const { config: proxyConfig, error: configError } = getModalProxyConfig();
  if (!proxyConfig) {
    sendJson(res, 500, {
      error:
        configError === 'invalid_url'
          ? 'Invalid MODAL_BACKEND_URL. Use an HTTPS root URL on a *.modal.run host, without a path, query, or fragment.'
          : 'TTS service is not configured. Set MODAL_BACKEND_URL and MIRVO_INTERNAL_SECRET in Vercel.',
    });
    return;
  }

  let requestBody: Buffer | null;
  setFailureStage('request body read');
  try {
    requestBody = await readRequestBody(req, MAX_TTS_BODY_BYTES);
  } catch (error) {
    const status = getRequestErrorStatus(error);
    sendJson(res, status === 413 ? 413 : 400, {
      error:
        status === 413
          ? 'TTS request exceeds the size limit.'
          : 'Invalid TTS request body.',
    });
    return;
  }
  setFailureStage('request validation');
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
  setFailureStage('Modal TTS request');
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
  } catch (error) {
    const status = getUpstreamErrorStatus(error);
    sendJson(res, status, {
      error: status === 504 ? 'TTS service timed out.' : 'TTS service is temporarily unavailable.',
    });
    return;
  }

  setFailureStage('Modal TTS response');
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

export default async function handler(
  req: RequestWithOptionalBody,
  res: ServerResponse
): Promise<void> {
  let failureStage = 'handler initialization';
  try {
    await handleRequest(req, res, (stage) => {
      failureStage = stage;
    });
  } catch (error) {
    if (res.headersSent || res.writableEnded) {
      res.destroy();
      return;
    }
    const kind = error instanceof Error ? error.name : typeof error;
    sendJson(res, 500, {
      error: `TTS service encountered an unexpected error (${kind} during ${failureStage}).`,
    });
  }
}
