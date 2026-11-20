import type { ServerResponse } from 'node:http';
import { mapModalLesson } from '../server/modalLesson.js';
import {
  getModalProxyConfig,
  getRequestErrorStatus,
  getUpstreamErrorStatus,
  MAX_TUTOR_BODY_BYTES,
  parseJsonBody,
  readRequestBody,
  sendJson,
  type RequestWithOptionalBody,
} from '../server/modalProxy.js';

const MAX_TUTOR_RESPONSE_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_BASE64_CHARS = 5_900_000;
const DEPTHS = new Set(['overview', 'standard', 'deep']);

async function readBoundedResponse(response: Response): Promise<Buffer | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_TUTOR_RESPONSE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export const config = {
  maxDuration: 60,
};

function validTutorInput(
  body: Record<string, unknown> | null
): body is Record<string, unknown> & {
  topic: string;
  depth: 'overview' | 'standard' | 'deep';
  thinking: boolean;
  image_base64?: string | null;
} {
  if (!body) return false;
  const allowedFields = new Set(['topic', 'depth', 'thinking', 'image_base64']);
  if (Object.keys(body).some((key) => !allowedFields.has(key))) return false;
  return (
    typeof body.topic === 'string' &&
    body.topic.trim().length > 0 &&
    body.topic.length <= 4000 &&
    typeof body.depth === 'string' &&
    DEPTHS.has(body.depth) &&
    typeof body.thinking === 'boolean' &&
    (body.image_base64 === undefined ||
      body.image_base64 === null ||
      (typeof body.image_base64 === 'string' &&
        body.image_base64.length <= MAX_IMAGE_BASE64_CHARS &&
        /^[A-Za-z0-9+/]*={0,2}$/.test(body.image_base64)))
  );
}

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
          : 'Tutor service is not configured. Set MODAL_BACKEND_URL and MIRVO_INTERNAL_SECRET in Vercel.',
    });
    return;
  }

  let requestBody: Buffer | null;
  setFailureStage('request body read');
  try {
    requestBody = await readRequestBody(req, MAX_TUTOR_BODY_BYTES);
  } catch (error) {
    const status = getRequestErrorStatus(error);
    sendJson(res, status, {
      error:
        status === 413
          ? 'Tutor request exceeds the 6 MB limit.'
          : `Invalid tutor request body (${req.body === undefined ? 'stream' : typeof req.body}).`,
    });
    return;
  }

  setFailureStage('request validation');
  const body = parseJsonBody(requestBody);
  if (!validTutorInput(body)) {
    sendJson(res, 400, { error: 'Invalid tutor request. Check topic, depth, thinking, and image_base64.' });
    return;
  }

  let upstream: Response;
  setFailureStage('Modal tutor request');
  try {
    upstream = await fetch(`${proxyConfig.backendUrl}/tutor`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${proxyConfig.secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: body.topic.trim(),
        depth: body.depth,
        thinking: body.thinking,
        image_base64: body.image_base64 ?? null,
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (error) {
    const status = getUpstreamErrorStatus(error);
    sendJson(res, status, {
      error: status === 504 ? 'Tutor service timed out.' : 'Tutor service is temporarily unavailable.',
    });
    return;
  }

  setFailureStage('Modal tutor response');
  const contentLength = Number(upstream.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_TUTOR_RESPONSE_BYTES) {
    await upstream.body?.cancel();
    sendJson(res, 502, { error: 'Tutor service returned an invalid or oversized response.' });
    return;
  }
  if (!upstream.ok) {
    await upstream.body?.cancel();
    const status = upstream.status === 429 ? 429 : upstream.status === 503 ? 503 : 502;
    sendJson(res, status, {
      error:
        status === 429
          ? 'Tutor service is busy. Please try again shortly.'
          : 'Tutor service could not generate a lesson.',
    });
    return;
  }

  let payload: unknown;
  try {
    const responseBytes = await readBoundedResponse(upstream);
    if (!responseBytes) {
      sendJson(res, 502, { error: 'Tutor service returned an invalid or oversized response.' });
      return;
    }
    payload = JSON.parse(responseBytes.toString('utf8'));
  } catch {
    sendJson(res, 502, { error: 'Tutor service returned invalid JSON.' });
    return;
  }

  setFailureStage('lesson mapping');
  const mapped = mapModalLesson(payload, body.topic);
  if (!mapped) {
    sendJson(res, 502, {
      error:
        'Tutor service lesson schema is incompatible. Expected a supported visual_type and visual_data compatible with the Mirvo renderer.',
    });
    return;
  }

  sendJson(res, 200, mapped);
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
      error: `Tutor service encountered an unexpected error (${kind} during ${failureStage}).`,
    });
  }
}
