import { GoogleGenAI } from '@google/genai';
import express from 'express';
import { createTutorResolveRouter } from '../../tutor/resolve.js';

export const maxDuration = 60;

const app = express();
app.use(express.json({ limit: '20mb' }));

const { router } = createTutorResolveRouter({
  dataDir: process.env.TMPDIR || '/tmp',
  getGeminiClient: () => {
    const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
    return apiKey
      ? new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        })
      : null;
  },
});

app.use(router);

export default app;
