import { GoogleGenAI } from '@google/genai';
import express from 'express';
import { createTutorResolveRouter } from '../../tutor/resolve.js';

const app = express();
app.use(express.json({ limit: '20mb' }));

const { router } = createTutorResolveRouter({
  dataDir: process.env.TMPDIR || '/tmp',
  getGeminiClient: () => {
    const apiKey = process.env.GEMINI_API_KEY;
    return apiKey ? new GoogleGenAI({ apiKey }) : null;
  },
});

app.use(router);

export default app;
