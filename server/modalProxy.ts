import type { IncomingMessage, ServerResponse } from 'node:http';

export const MAX_TUTOR_BODY_BYTES = 6 * 1024 * 1024;
export const MAX_TTS_BODY_BYTES = 16 * 1024;
export const MAX_TTS_AUDIO_BYTES = 1024 * 1024;

export interface RequestWithOptionalBody extends IncomingMessage {
  body?: unknown;
}

export interface ModalProxyConfig {
  backendUrl: string;
  secret: string;
}

export type ModalProxyConfigResult =
  | { config: ModalProxyConfig; error: null }
  | { config: null; error: 'missing' | 'invalid_url' };

export function getModalProxyConfig(): ModalProxyConfigResult {
  const configuredUrl = process.env.MODAL_BACKEND_URL?.trim();
  const secret = process.env.MIRVO_INTERNAL_SECRET;
  if (!configuredUrl || !secret?.trim()) return { config: null, error: 'missing' };

  try {
    const url = new URL(configuredUrl);
    if (
      url.protocol !== 'https:' ||
      !url.hostname.endsWith('.modal.run') ||
      Boolean(url.port && url.port !== '443') ||
      url.username ||
      url.password ||
      !/^\/*$/.test(url.pathname) ||
      url.search ||
      url.hash
    ) {
      return { config: null, error: 'invalid_url' };
    }
    return {
      config: { backendUrl: configuredUrl.replace(/\/+$/, ''), secret },
      error: null,
    };
  } catch {
    return { config: null, error: 'invalid_url' };
  }
}

export async function readRequestBody(
  req: RequestWithOptionalBody,
  maxBytes: number
): Promise<Buffer | null> {
  if (req.body !== undefined) {
    let body: Buffer;
    if (Buffer.isBuffer(req.body)) {
      body = req.body;
    } else if (typeof req.body === 'string') {
      body = Buffer.from(req.body, 'utf8');
    } else {
      let serialized: string;
      try {
        serialized = JSON.stringify(req.body);
      } catch {
        throw Object.assign(new Error('Invalid request body'), { status: 400 });
      }
      if (typeof serialized !== 'string') {
        throw Object.assign(new Error('Invalid request body'), { status: 400 });
      }
      body = Buffer.from(serialized);
    }
    if (body.length > maxBytes) {
      throw Object.assign(new Error('Request body too large'), { status: 413 });
    }
    return body;
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const cleanup = () => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      req.removeListener('aborted', onAborted);
    };
    const onData = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > maxBytes) {
        cleanup();
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        return;
      }
      chunks.push(buffer);
    };
    const onEnd = () => {
      cleanup();
      resolve(chunks.length ? Buffer.concat(chunks, size) : null);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onAborted = () => {
      cleanup();
      reject(Object.assign(new Error('Request body aborted'), { status: 400 }));
    };

    req.on('data', onData);
    req.once('end', onEnd);
    req.once('error', onError);
    req.once('aborted', onAborted);
  });
}

export function parseJsonBody(body: Buffer | null): Record<string, unknown> | null {
  if (!body) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString('utf8'));
  } catch {
    return null;
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>
): void {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(body);
}

export function getRequestErrorStatus(error: unknown): number {
  if (typeof error === 'object' && error && 'status' in error) {
    const status = Number((error as { status: unknown }).status);
    if (status === 413) return status;
  }
  return 400;
}

export function getUpstreamErrorStatus(error: unknown): 502 | 504 {
  return error instanceof Error && error.name === 'TimeoutError' ? 504 : 502;
}
