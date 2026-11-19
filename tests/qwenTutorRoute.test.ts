import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import test from 'node:test';
import { createTutorResolveRouter } from '../tutor/resolve';

test('lesson route uses the injected Qwen adapter and preserves depth mode', async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'mirvo-qwen-route-'));
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  let geminiClientRequested = false;
  let generationInput:
    | {
        query: string;
        userPrompt: string;
        systemInstruction: string;
        depthMode: string;
      }
    | undefined;

  const { router } = createTutorResolveRouter({
    dataDir,
    getGeminiClient: () => {
      geminiClientRequested = true;
      return null;
    },
    generateLesson: async (input) => {
      generationInput = input;
      return {
        text: JSON.stringify({
          topic_title: 'Kvadrat funksiya',
          subject: 'math',
          engine: 'plotly2d',
          sliders: [],
          steps: Array.from({ length: 4 }, (_, index) => ({
            step_number: index + 1,
            step_title: `Grafik ${index + 1}`,
            speech_text: 'Parabola grafigi.',
            katex_formulas: [],
            explanation_uz: 'Kvadrat funksiya parabola hosil qiladi.',
            emoji_emotion: 'explaining',
            render_params: { expression: 'x^2' },
          })),
        }),
        usageMetadata: {
          promptTokenCount: 20,
          candidatesTokenCount: 30,
          totalTokenCount: 50,
        },
        cacheHit: false,
      };
    },
  });
  app.use(router);

  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    await rm(dataDir, { recursive: true, force: true });
  });

  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/tutor/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'Please explain the quadratic function graph',
      depthMode: 'overview',
    }),
  });
  const payload = (await response.json()) as {
    stage: string;
    lesson: { depth_mode: string; source: string };
  };

  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal(payload.stage, 'qwen-director');
  assert.equal(payload.lesson.source, 'qwen-director');
  assert.equal(payload.lesson.depth_mode, 'overview');
  assert.equal(geminiClientRequested, false);
  assert.equal(generationInput?.depthMode, 'overview');
  assert.match(generationInput?.systemInstruction ?? '', /DARS CHUQURLIGI/);
});
