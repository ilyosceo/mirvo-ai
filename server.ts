import path from 'path';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { createTutorResolveRouter } from './tutor/resolve.js';
import {
  applyRateLimitHeaders,
  checkIpRateLimit,
  sendRateLimitError,
} from './server/rateLimit.js';
import {
  getCachedExplainVideoResult,
  handleExplainVideoRequest,
  type ExplainVideoRequestBody,
} from './server/videoLessonService.js';
import {
  generateUz3DLesson,
  getCachedUz3DLesson,
  type GenerateUz3DLessonRequest,
} from './server/uz3dLessonService.js';

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

function isUsableGeminiKey(raw?: string): raw is string {
  if (!raw) return false;
  const k = raw.trim();
  if (k.length < 20) return false;
  return !/^(MY_|YOUR_|TEST_|DEMO_|PLACEHOLDER|REPLACE|CHANGEME|GEMINI_API_KEY)/i.test(k);
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  return isUsableGeminiKey(apiKey)
    ? new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      })
    : null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  const { router: tutorRouter } = createTutorResolveRouter({
    dataDir: process.cwd(),
    getGeminiClient,
  });
  app.use(tutorRouter);

  app.get('/api/generate-lesson', (req, res) => {
    const videoId = String(req.query.video_id || '').trim();
    if (!videoId) {
      res.status(400).json({ error: 'video_id parametri talab qilinadi.' });
      return;
    }
    const hit = getCachedUz3DLesson(videoId);
    if (!hit) {
      res.status(404).json({ cached: false });
      return;
    }
    res.json(hit);
  });

  app.post('/api/generate-lesson', async (req, res) => {
    try {
      const body = (req.body || {}) as GenerateUz3DLessonRequest;
      const hasContent = Boolean(
        body.subtitles?.trim() ||
          body.audio_base64?.trim() ||
          body.image_base64?.trim() ||
          body.topic?.trim() ||
          body.video_id?.trim()
      );
      if (!hasContent) {
        res.status(400).json({
          error: 'Subtitr matni, audio, rasm yoki mavzu nomi yuborilishi shart.',
        });
        return;
      }

      const videoId = body.video_id?.trim();
      if (videoId) {
        const hit = getCachedUz3DLesson(videoId);
        if (hit) {
          res.json(hit);
          return;
        }
      }

      const limitStatus = checkIpRateLimit(req, { bucket: 'ai-lessons' });
      if (!limitStatus.allowed) {
        sendRateLimitError(res, limitStatus);
        return;
      }
      applyRateLimitHeaders(res, limitStatus);

      const lesson = await generateUz3DLesson(body);
      res.json(lesson);
    } catch (err) {
      console.error('Error in /api/generate-lesson:', err);
      res.status(500).json({ error: 'Uz3D darsini yaratishda xatolik yuz berdi.' });
    }
  });

  app.post('/api/explain-video', async (req, res) => {
    try {
      const body = (req.body || {}) as ExplainVideoRequestBody;
      const hasFrames = Array.isArray(body.frames) && body.frames.length > 0;
      const hasAudio = Boolean(body.audioBase64?.trim());
      const hasTopicOrUrl = Boolean(
        body.topic?.trim() || body.youtubeUrl?.trim() || body.notes?.trim()
      );
      if (!hasFrames && !hasAudio && !hasTopicOrUrl) {
        res.status(400).json({
          error: 'Video kadrlar, audio, YouTube havolasi yoki mavzu nomi yuborilishi kerak.',
        });
        return;
      }

      const cached = getCachedExplainVideoResult(body);
      if (cached) {
        res.json(cached);
        return;
      }

      const limitStatus = checkIpRateLimit(req, { bucket: 'ai-lessons' });
      if (!limitStatus.allowed) {
        sendRateLimitError(res, limitStatus);
        return;
      }
      applyRateLimitHeaders(res, limitStatus);

      const result = await handleExplainVideoRequest(body);
      res.json(result);
    } catch (err) {
      console.error('Error in /api/explain-video:', err);
      res.status(500).json({ error: "Videodan dars yaratishda xatolik yuz berdi." });
    }
  });

  app.post('/api/tts', (_req, res) => {
    res.json({
      fallback: true,
      missingKey: !process.env.GEMINI_API_KEY?.trim(),
    });
  });

  // Proxy RCSB PDB files for 3Dmol.js molecule viewer
  app.get('/api/chem/pdb/:id', async (req, res) => {
    const rawId = String(req.params.id || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(rawId)) {
      res.status(400).json({ error: "Noto'g'ri PDB identifikatori." });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const upstream = await fetch(`https://files.rcsb.org/download/${rawId}.pdb`, {
        signal: controller.signal,
      });
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `PDB (${rawId}) topilmadi.` });
        return;
      }
      const text = await upstream.text();
      res.type('text/plain').send(text);
    } catch {
      res.status(502).json({ error: "PDB serveridan ma'lumot olib bo'lmadi." });
    } finally {
      clearTimeout(timer);
    }
  });

  // Proxy PubChem 3D SDF structures for 3Dmol.js molecule viewer
  app.get('/api/chem/pubchem/:id', async (req, res) => {
    const compound = String(req.params.id || '').trim();
    if (!compound) {
      res.status(400).json({ error: 'Molekula nomi kiritilmadi.' });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      let upstream = await fetch(
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(
          compound
        )}/SDF?record_type=3d`,
        { signal: controller.signal }
      );
      if (upstream.status === 404) {
        upstream = await fetch(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(
            compound
          )}/SDF`,
          { signal: controller.signal }
        );
      }
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `PubChem (${compound}) topilmadi.` });
        return;
      }
      const sdf = await upstream.text();
      res.type('text/plain').send(sdf);
    } catch {
      res.status(502).json({ error: "PubChem serveridan ma'lumot olib bo'lmadi." });
    } finally {
      clearTimeout(timer);
    }
  });

  // Fetch PubChem Canonical/Connectivity SMILES & Formula for 2D IUPAC skeletal drawing (smiles-drawer)
  app.get('/api/chem/pubchem-smiles/:id', async (req, res) => {
    const compound = String(req.params.id || '').trim();
    if (!compound) {
      res.status(400).json({ error: 'Molekula nomi kiritilmadi.' });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const upstream = await fetch(
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(
          compound
        )}/property/CanonicalSMILES,ConnectivitySMILES,IsomericSMILES,MolecularFormula/JSON`,
        { signal: controller.signal }
      );
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `PubChem SMILES (${compound}) topilmadi.` });
        return;
      }
      const data = (await upstream.json()) as {
        PropertyTable?: {
          Properties?: Array<{
            CanonicalSMILES?: string;
            ConnectivitySMILES?: string;
            IsomericSMILES?: string;
            MolecularFormula?: string;
          }>;
        };
      };
      const prop = data.PropertyTable?.Properties?.[0];
      const smiles =
        prop?.CanonicalSMILES || prop?.ConnectivitySMILES || prop?.IsomericSMILES || '';
      res.json({
        smiles,
        formula: prop?.MolecularFormula || '',
      });
    } catch {
      res.status(502).json({ error: "PubChem SMILES ma'lumotini olib bo'lmadi." });
    } finally {
      clearTimeout(timer);
    }
  });

  // TTS endpoint — client falls back smoothly to native Web Speech API when fallback is true
  app.post('/api/speech/tts', (_req, res) => {
    res.json({
      fallback: true,
      missingKey: !process.env.GEMINI_API_KEY?.trim(),
    });
  });

  // Audio transcription fallback endpoint using Gemini when browser Web Speech STT is unavailable
  app.post('/api/speech/transcribe', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: "Gemini API kaliti sozlanmagan (GEMINI_API_KEY).",
      });
      return;
    }
    const { audioBase64, mimeType } = req.body as {
      audioBase64?: string;
      mimeType?: string;
    };
    if (!audioBase64) {
      res.status(400).json({ error: "Audio ma'lumot topilmadi." });
      return;
    }
    try {
      const resp = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: audioBase64,
              },
            },
            {
              text: "Transcribe this Uzbek educational question accurately into plain Uzbek text. Output ONLY the transcribed text.",
            },
          ],
        },
      });
      res.json({ text: (resp.text ?? '').trim() });
    } catch {
      res.status(500).json({ error: "Ovozni matnga o'girishda xatolik yuz berdi." });
    }
  });

  // Guarantee /api/* never falls through to Vite/static SPA index.html (<!doctype html>)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API manzili topilmadi.' });
  });

  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (req.path.startsWith('/api')) {
        console.error('Unhandled API error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            error:
              err instanceof Error && err.message
                ? err.message
                : 'Server xatoligi yuz berdi.',
          });
        }
        return;
      }
      next(err);
    }
  );

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`Mirvo AI server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Mirvo AI server:', err);
  process.exit(1);
});
