import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import tutorHandler from '../api/tutor';
import ttsHandler from '../api/tts';

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
} {
  const response = Object.assign(new EventEmitter(), {
    statusCode: 0,
    headers: {} as Record<string, string | number>,
    chunks: [] as Buffer[],
    body: Buffer.alloc(0),
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
  };
}

const originalUrl = process.env.MODAL_BACKEND_URL;
const originalSecret = process.env.MIRVO_INTERNAL_SECRET;
const originalFetch = globalThis.fetch;

function restoreEnvironment() {
  if (originalUrl === undefined) delete process.env.MODAL_BACKEND_URL;
  else process.env.MODAL_BACKEND_URL = originalUrl;
  if (originalSecret === undefined) delete process.env.MIRVO_INTERNAL_SECRET;
  else process.env.MIRVO_INTERNAL_SECRET = originalSecret;
  globalThis.fetch = originalFetch;
}

test('tutor proxy authenticates and maps the Modal lesson to the UI contract', async (t) => {
  t.after(restoreEnvironment);
  process.env.MODAL_BACKEND_URL = 'https://workspace--mirvo-ai-backend-fastapi-app.us-east.modal.run/';
  process.env.MIRVO_INTERNAL_SECRET = 's'.repeat(40);

  let url = '';
  let auth = '';
  let forwarded: Record<string, unknown> | undefined;
  globalThis.fetch = async (input, init) => {
    url = String(input);
    auth = new Headers(init?.headers).get('Authorization') || '';
    forwarded = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({
      source: 'qwen',
      lesson: {
        title: 'Parabola',
        steps: [{
          step_number: 1,
          board_title: 'Kvadrat funksiya',
          latex: 'y=x^2',
          visual_type: 'plotly2d',
          visual_data: { expression: 'x^2' },
          speech_text: 'Bu parabola.',
        }],
      },
    });
  };

  const response = createResponse();
  await tutorHandler(createRequest('POST', {
    topic: 'Parabola',
    depth: 'overview',
    thinking: false,
    image_base64: null,
  }), response);
  const payload = JSON.parse(response.body.toString()) as {
    source: string;
    lesson: { topic_title: string; engine: string; steps: Array<Record<string, unknown>> };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(url, 'https://workspace--mirvo-ai-backend-fastapi-app.us-east.modal.run/tutor');
  assert.equal(auth, `Bearer ${'s'.repeat(40)}`);
  assert.deepEqual(forwarded, {
    topic: 'Parabola',
    depth: 'overview',
    thinking: false,
    image_base64: null,
  });
  assert.equal(payload.source, 'qwen');
  assert.equal(payload.lesson.topic_title, 'Parabola');
  assert.equal(payload.lesson.engine, 'plotly2d');
  assert.equal(payload.lesson.steps[0].step_title, 'Kvadrat funksiya');
  assert.deepEqual(payload.lesson.steps[0].katex_formulas, ['y=x^2']);
  assert.deepEqual(payload.lesson.steps[0].render_params, { expression: 'x^2' });
});

test('tutor proxy returns clear configuration and schema errors', async (t) => {
  t.after(restoreEnvironment);
  delete process.env.MODAL_BACKEND_URL;
  delete process.env.MIRVO_INTERNAL_SECRET;
  globalThis.fetch = async () => {
    throw new Error('fetch must not be called');
  };

  const missingConfig = createResponse();
  await tutorHandler(createRequest('POST', {
    topic: 'Math',
    depth: 'standard',
    thinking: false,
  }), missingConfig);
  assert.equal(missingConfig.statusCode, 500);
  assert.match(missingConfig.body.toString(), /MODAL_BACKEND_URL/);

  process.env.MODAL_BACKEND_URL = 'https://workspace.modal.run';
  process.env.MIRVO_INTERNAL_SECRET = 's'.repeat(32);
  globalThis.fetch = async () => Response.json({
    source: 'qwen',
    lesson: {
      title: 'Unsupported visual',
      steps: [{
        step_number: 1,
        board_title: 'Unknown',
        visual_type: 'unrecognized-renderer',
        visual_data: {},
        speech_text: 'Text',
      }],
    },
  });
  const incompatible = createResponse();
  await tutorHandler(createRequest('POST', {
    topic: 'Math',
    depth: 'standard',
    thinking: false,
  }), incompatible);
  assert.equal(incompatible.statusCode, 502);
  assert.match(incompatible.body.toString(), /visual_type/);
});

test('TTS proxy forwards the exact contract and returns raw MP3 bytes', async (t) => {
  t.after(restoreEnvironment);
  process.env.MODAL_BACKEND_URL = 'https://workspace.modal.run///';
  process.env.MIRVO_INTERNAL_SECRET = 't'.repeat(40);
  let url = '';
  let auth = '';
  let forwarded: Record<string, unknown> | undefined;
  globalThis.fetch = async (input, init) => {
    url = String(input);
    auth = new Headers(init?.headers).get('Authorization') || '';
    forwarded = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(new Uint8Array([0x49, 0x44, 0x33]), {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  };

  const response = createResponse();
  await ttsHandler(createRequest('POST', {
    text: 'Salom',
    voice: 'uz-UZ-SardorNeural',
  }), response);
  assert.equal(response.statusCode, 200);
  assert.equal(url, 'https://workspace.modal.run/tts');
  assert.equal(auth, `Bearer ${'t'.repeat(40)}`);
  assert.deepEqual(forwarded, { text: 'Salom', voice: 'uz-UZ-SardorNeural' });
  assert.equal(response.headers['Content-Type'], 'audio/mpeg');
  assert.deepEqual(response.body, Buffer.from('ID3'));
});

test('TTS proxy rejects invalid input and missing configuration', async (t) => {
  t.after(restoreEnvironment);
  delete process.env.MODAL_BACKEND_URL;
  delete process.env.MIRVO_INTERNAL_SECRET;
  globalThis.fetch = async () => {
    throw new Error('fetch must not be called');
  };

  const missingConfig = createResponse();
  await ttsHandler(createRequest('POST', { text: 'Salom', voice: 'uz-UZ-SardorNeural' }), missingConfig);
  assert.equal(missingConfig.statusCode, 500);

  process.env.MODAL_BACKEND_URL = 'https://workspace.modal.run';
  process.env.MIRVO_INTERNAL_SECRET = 's'.repeat(32);
  const invalid = createResponse();
  await ttsHandler(createRequest('POST', { text: 'Salom', voice: 'en-US-AriaNeural' }), invalid);
  assert.equal(invalid.statusCode, 400);
});
