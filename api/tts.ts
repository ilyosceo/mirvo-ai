import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  getModalProxyConfig,
  getRequestErrorStatus,
  readRequestBody,
  sendJson,
  type RequestWithOptionalBody,
} from './lib/modalProxy.ts';

const MAX_TTS_BODY_BYTES = 16 * 1024;
const MAX_TTS_AUDIO_BYTES = 1024 * 1024;

export const config = { maxDuration: 25, api: { bodyParser: false } };

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
    sendJson(res, 503, { error: 'TTS service is not configured.' });
    return;
  }

  let body: Buffer | null;
  try {
    body = await readRequestBody(req, MAX_TTS_BODY_BYTES);
  } catch (error) {
    const status = getRequestErrorStatus(error);
    sendJson(res, status, {
      error: status === 413 ? 'Request body too large' : 'Invalid request body',
    });
    return;
  }
  if (!body) {
    sendJson(res, 400, { error: 'Invalid request body' });
    return;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${proxyConfig.backendUrl}/api/tts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${proxyConfig.secret}`,
        'Content-Type': 'application/json',
      },
      body: body.toString('utf8'),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    sendJson(res, 502, { error: 'TTS service is temporarily unavailable.' });
    return;
  }

  const contentType = upstream.headers.get('content-type')?.toLowerCase() || '';
  if (!upstream.ok || !contentType.startsWith('audio/mpeg') || !upstream.body) {
    await upstream.body?.cancel();
    const status = upstream.status === 400 ? 400 : upstream.status === 429 ? 429 : upstream.status === 503 ? 503 : 502;
    sendJson(res, status, {
      error: status === 400 ? 'Invalid TTS request' : 'TTS service is temporarily unavailable.',
    });
    return;
  }

  const declaredLength = Number(upstream.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_TTS_AUDIO_BYTES) {
    await upstream.body.cancel();
    sendJson(res, 502, { error: 'TTS response exceeds size limit.' });
    return;
  }

  let firstChunk: Uint8Array | undefined;
  const reader = upstream.body.getReader();
  try {
    while (!firstChunk) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > MAX_TTS_AUDIO_BYTES) {
        await reader.cancel();
        sendJson(res, 502, { error: 'TTS response exceeds size limit.' });
        return;
      }
      firstChunk = value;
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    sendJson(res, 502, { error: 'TTS service is temporarily unavailable.' });
    return;
  }
  if (!firstChunk) {
    sendJson(res, 502, { error: 'TTS service returned no audio.' });
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (Number.isFinite(declaredLength) && declaredLength > 0) {
    res.setHeader('Content-Length', declaredLength);
  }

  let totalBytes = firstChunk.byteLength;
  try {
    if (totalBytes > MAX_TTS_AUDIO_BYTES) {
      await reader.cancel();
      sendJson(res, 502, { error: 'TTS response exceeds size limit.' });
      return;
    }
    if (!res.write(Buffer.from(firstChunk))) {
      await new Promise<void>((resolve) => res.once('drain', resolve));
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_TTS_AUDIO_BYTES) {
        await reader.cancel();
        if (!res.headersSent) sendJson(res, 502, { error: 'TTS response exceeds size limit.' });
        else res.destroy();
        return;
      }
      if (!res.write(Buffer.from(value))) {
        await new Promise<void>((resolve) => res.once('drain', resolve));
      }
    }
    res.end();
  } catch {
    await reader.cancel().catch(() => undefined);
    if (!res.writableEnded) res.destroy();
  }
}
