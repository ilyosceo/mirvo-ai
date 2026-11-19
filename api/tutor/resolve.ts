import { GoogleGenAI } from '@google/genai';
import express from 'express';
import { generateLessonWithQwen } from '../lib/qwenGateway.ts';
import { createTutorResolveRouter } from '../../tutor/resolve.ts';

export const config = { maxDuration: 60 };

const app = express();
app.use(express.json({ limit: '20mb' }));

const { router } = createTutorResolveRouter({
  dataDir: process.env.TMPDIR || '/tmp',
  getGeminiClient: () => {
    const apiKey = process.env.GEMINI_API_KEY;
    return apiKey ? new GoogleGenAI({ apiKey }) : null;
  },
  generateLesson: (input) =>
    generateLessonWithQwen({
      query: input.query,
      userPrompt: input.userPrompt,
      systemInstruction: input.systemInstruction,
      depthMode: input.depthMode,
      imageBase64: input.imageBase64,
      imageMimeType: input.imageMimeType,
    }),
});

app.use(router);

export default app;
