import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import handler from '../api/tts';

function createRequest(method: string, body?: unknown): IncomingMessage & { body?: unknown } {
  const request = new EventEmitter() as IncomingMessage & { body?: unknown };
  Object.assign(request, {
    method,
    headers: {},
    body,
    [Symbol.asyncIterator]: async function* () {},
  });
  return request;
}

function createResponse(): ServerResponse & {
  headers: Record<string, string | number>;
  chunks: Buffer[];
  body: Buffer;
  ended: boolean;
} {
  const response = Object.assign(new EventEmitter(), {
    statusCode: 0,
    headers: {} as Record<string, string | number>,
    chunks: [] as Buffer[],
    body: Buffer.alloc(0),
    ended: false,
    headersSent: false,
    writableEnded: false,
    setHeader(name: string, value: string | number) {
      this.headers[name] = value;
      return this;
    },
    write(chunk: Buffer) {
      this.headersSent = true;
      this.chunks.push(Buffer.from(chunk));
      return true;
    },
    end(chunk?: Buffer | string) {
      if (chunk) this.chunks.push(Buffer.from(chunk));
      this.body = Buffer.concat(this.chunks);
      this.ended = true;
      this.writableEnded = true;
      return this;
    },
    destroy() {
      this.writableEnded = true;
      return this;
    },
  });
  return response as unknown as ServerResponse & {
    headers: Record<string, string | number>;
    chunks: Buffer[];
    body: Buffer;
    ended: boolean;
  };
}

test('TTS proxy streams Modal audio and sends the internal authorization header', async (t) => {
  const previousUrl = process.env.MODAL_BACKEND_URL;
  const previousSecret = process.env.MIRVO_INTERNAL_SECRET;
  const previousFetch = globalThis.fetch;
  t.after(() => {
    if (previousUrl === undefined) delete process.env.MODAL_BACKEND_URL;
    else process.env.MODAL_BACKEND_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.MIRVO_INTERNAL_SECRET;
    else process.env.MIRVO_INTERNAL_SECRET = previousSecret;
    globalThis.fetch = previousFetch;
  });
  process.env.MODAL_BACKEND_URL = 'https://test--mirvo-qwen-gateway-web.modal.run';
  process.env.MIRVO_INTERNAL_SECRET = 's'.repeat(40);

  let upstreamUrl = '';
  let authorization = '';
  globalThis.fetch = async (input, init) => {
    upstreamUrl = String(input);
    authorization = new Headers(init?.headers).get('Authorization') || '';
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([0x49, 0x44, 0x33]));
        controller.close();
      },
    }), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
  };

  const response = createResponse();
  await handler(createRequest('POST', { text: 'Salom', voice: 'uz-UZ-SardorNeural' }), response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'audio/mpeg');
  assert.equal(response.body.toString(), 'ID3');
  assert.equal(upstreamUrl, 'https://test--mirvo-qwen-gateway-web.modal.run/api/tts');
  assert.equal(authorization, `Bearer ${'s'.repeat(40)}`);
});

test('TTS proxy fails closed without secrets and only allows POST', async (t) => {
  const previousUrl = process.env.MODAL_BACKEND_URL;
  const previousSecret = process.env.MIRVO_INTERNAL_SECRET;
  const previousFetch = globalThis.fetch;
  t.after(() => {
    if (previousUrl === undefined) delete process.env.MODAL_BACKEND_URL;
    else process.env.MODAL_BACKEND_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.MIRVO_INTERNAL_SECRET;
    else process.env.MIRVO_INTERNAL_SECRET = previousSecret;
    globalThis.fetch = previousFetch;
  });
  delete process.env.MODAL_BACKEND_URL;
  delete process.env.MIRVO_INTERNAL_SECRET;
  globalThis.fetch = async () => {
    throw new Error('fetch must not be called');
  };

  const noSecret = createResponse();
  await handler(createRequest('POST', { text: 'Salom' }), noSecret);
  assert.equal(noSecret.statusCode, 503);

  const methodNotAllowed = createResponse();
  await handler(createRequest('GET'), methodNotAllowed);
  assert.equal(methodNotAllowed.statusCode, 405);
  assert.equal(methodNotAllowed.headers.Allow, 'POST');
});
