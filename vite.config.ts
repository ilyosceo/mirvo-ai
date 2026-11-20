import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Manually load .env for server-side use (Vite only exposes VITE_* by default)
try {
  const envPath = resolve(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {}

export default defineConfig({
  plugins: [
    tailwindcss(),
    {
      name: 'local-api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/tts', async (req: IncomingMessage, res: ServerResponse, next) => {
          if (req.method !== 'POST') return next();
          try {
            const mod = await server.ssrLoadModule('./api/tts.ts');
            await mod.default(req, res);
          } catch (e) {
            console.error('[local-api] /api/tts error:', e);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: String(e) }));
            }
          }
        });
        server.middlewares.use('/api/tutor', async (req: IncomingMessage, res: ServerResponse, next) => {
          if (req.method !== 'POST') return next();
          try {
            const mod = await server.ssrLoadModule('./api/tutor.ts');
            await mod.default(req, res);
          } catch (e) {
            console.error('[local-api] /api/tutor error:', e);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: String(e) }));
            }
          }
        });
      },
    },
  ],
});
