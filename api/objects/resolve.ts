import type { ServerResponse } from 'node:http';
import { objectResolver } from '../tutor/resolve.js';
import {
  readRequestBody,
  sendJson,
  parseJsonBody,
  type RequestWithOptionalBody,
} from '../../server/modalProxy.js';
import { ZERO_TOKEN_USAGE } from '../../lib/tokenUsage.js';

export const maxDuration = 60;
export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '2mb' } },
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

  let body: Record<string, unknown> | null = null;
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    body = req.body as Record<string, unknown>;
  } else {
    try {
      const raw = await readRequestBody(req, 2 * 1024 * 1024);
      body = parseJsonBody(raw);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }
  }

  const query = String(body?.query || body?.q || '').trim();
  const mode = body?.mode === '3d' ? '3d' : '2d';

  if (!query) {
    sendJson(res, 400, { error: 'Obyekt nomi kiritilmadi' });
    return;
  }

  try {
    const outcome = await objectResolver.resolveObject(query, mode);
    if (!outcome) {
      sendJson(res, 404, { error: `"${query}" obyekti topilmadi` });
      return;
    }
    sendJson(res, 200, {
      object: outcome.resolved,
      intent: outcome.intent,
      token_usage: outcome.resolved.token_usage ?? ZERO_TOKEN_USAGE,
    });
  } catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'Obyektni yuklashda xatolik',
    });
  }
}
