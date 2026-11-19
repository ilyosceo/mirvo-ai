import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import handler from '../api/speech/tts';

function createRequest(
  method: string,
  body?: unknown
): IncomingMessage & { body?: unknown } {
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
  body: string | Buffer;
} {
  const response = {
    statusCode: 0,
    headers: {} as Record<string, string | number>,
    body: '',
    setHeader(name: string, value: string | number) {
      this.headers[name] = value;
      return this;
    },
    end(value?: string | Buffer) {
      this.body = value ?? '';
      return this;
    },
  };
  return response as unknown as ServerResponse & {
    headers: Record<string, string | number>;
    body: string | Buffer;
  };
}

test('TTS route rejects methods other than POST', async () => {
  const req = createRequest('GET');
  const res = createResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST');
});

test('TTS route rejects an unsupported voice before making an upstream call', async () => {
  const req = createRequest('POST', { text: 'Salom', voice: 'en-US-AriaNeural' });
  const res = createResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(JSON.parse(String(res.body)), { error: 'Unsupported voice' });
});

test('TTS route rejects oversized text and invalid pitch', async () => {
  const tooLongReq = createRequest('POST', {
    text: 'x'.repeat(1201),
    voice: 'uz-UZ-SardorNeural',
  });
  const tooLongRes = createResponse();
  await handler(tooLongReq, tooLongRes);
  assert.equal(tooLongRes.statusCode, 400);

  const pitchReq = createRequest('POST', {
    text: 'Salom',
    voice: 'uz-UZ-SardorNeural',
    pitch: 5,
  });
  const pitchRes = createResponse();
  await handler(pitchReq, pitchRes);
  assert.equal(pitchRes.statusCode, 400);
});
