import assert from 'node:assert/strict';
import test from 'node:test';
import { generateLessonWithQwen } from '../api/lib/qwenGateway';

const endpoint =
  'https://test--mirvo-qwen-gateway-web.modal.run/v1/lesson/generate';
const validLesson = {
  topic_title: 'Pifagor teoremasi',
  subject: 'geometry',
  engine: 'svg2d',
  sliders: [],
  steps: [{}],
};

function requestInput() {
  return {
    query: 'Pifagor teoremasini tushuntir',
    userPrompt: 'Dars yarat',
    systemInstruction: 'Faqat JSON qaytar',
    depthMode: 'deep' as const,
  };
}

test('Qwen gateway forwards a bounded server-to-server request and validates the lesson', async (t) => {
  const previousEndpoint = process.env.MODAL_QWEN_URL;
  const previousSecret = process.env.MODAL_GATEWAY_SECRET;
  const previousFetch = globalThis.fetch;
  t.after(() => {
    if (previousEndpoint === undefined) delete process.env.MODAL_QWEN_URL;
    else process.env.MODAL_QWEN_URL = previousEndpoint;
    if (previousSecret === undefined) delete process.env.MODAL_GATEWAY_SECRET;
    else process.env.MODAL_GATEWAY_SECRET = previousSecret;
    globalThis.fetch = previousFetch;
  });

  process.env.MODAL_QWEN_URL = endpoint;
  process.env.MODAL_GATEWAY_SECRET = 'x'.repeat(40);
  let call: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    call = { url: String(input), init };
    return new Response(
      JSON.stringify({
        text: JSON.stringify(validLesson),
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        cache_hit: false,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const result = await generateLessonWithQwen(requestInput());
  assert.equal(call?.url, endpoint);
  assert.equal(call?.init?.method, 'POST');
  assert.equal(
    new Headers(call?.init?.headers).get('Authorization'),
    `Bearer ${'x'.repeat(40)}`
  );
  assert.deepEqual(result.usageMetadata, {
    promptTokenCount: 100,
    candidatesTokenCount: 50,
    totalTokenCount: 150,
  });
  assert.equal(result.cacheHit, false);
});

test('Qwen gateway rejects non-Modal endpoints and invalid lesson JSON', async (t) => {
  const previousEndpoint = process.env.MODAL_QWEN_URL;
  const previousSecret = process.env.MODAL_GATEWAY_SECRET;
  const previousFetch = globalThis.fetch;
  t.after(() => {
    if (previousEndpoint === undefined) delete process.env.MODAL_QWEN_URL;
    else process.env.MODAL_QWEN_URL = previousEndpoint;
    if (previousSecret === undefined) delete process.env.MODAL_GATEWAY_SECRET;
    else process.env.MODAL_GATEWAY_SECRET = previousSecret;
    globalThis.fetch = previousFetch;
  });

  process.env.MODAL_QWEN_URL =
    'https://127.0.0.1/v1/lesson/generate';
  process.env.MODAL_GATEWAY_SECRET = 'x'.repeat(40);
  globalThis.fetch = async () => {
    throw new Error('Fetch must not be called for a non-Modal URL');
  };
  await assert.rejects(generateLessonWithQwen(requestInput()), /not configured/);

  process.env.MODAL_QWEN_URL = endpoint;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ text: '{"steps":[]}', usage: {}, cache_hit: false }),
      { status: 200 }
    );
  await assert.rejects(generateLessonWithQwen(requestInput()), /invalid lesson/);

  globalThis.fetch = async () => new Response('x'.repeat(500_001), { status: 200 });
  await assert.rejects(generateLessonWithQwen(requestInput()), /oversized response/);
});
