import type { IncomingMessage, ServerResponse } from 'node:http';

export const MAX_MODAL_PROXY_BODY_BYTES = 4_300_000;

export interface RequestWithOptionalBody extends IncomingMessage {
  body?: unknown;
}

export function getModalProxyConfig(): { backendUrl: string; secret: string } | null {
  const backendUrl = process.env.MODAL_BACKEND_URL;
  const secret = process.env.MIRVO_INTERNAL_SECRET;
  if (
    !backendUrl ||
    !/^https:\/\/[a-z0-9][a-z0-9-]*--mirvo-qwen-gateway-web\.modal\.run\/?$/i.test(backendUrl) ||
    !secret ||
    secret.length < 32
  ) {
    return null;
  }
  return { backendUrl: backendUrl.replace(/\/+$/, ''), secret };
}

export async function readRequestBody(
  req: RequestWithOptionalBody,
  maxBytes = MAX_MODAL_PROXY_BODY_BYTES
): Promise<Buffer | null> {
  if (req.body !== undefined) {
    const body = Buffer.from(JSON.stringify(req.body));
    if (body.length > maxBytes) {
      throw Object.assign(new Error('Request body too large'), { status: 413 });
    }
    return body;
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) {
      throw Object.assign(new Error('Request body too large'), { status: 413 });
    }
    chunks.push(buffer);
  }
  return chunks.length ? Buffer.concat(chunks) : null;
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
