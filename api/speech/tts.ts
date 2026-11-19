import type { IncomingMessage, ServerResponse } from 'node:http';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import {
  MAX_TTS_AUDIO_BYTES,
  MAX_TTS_BODY_BYTES,
  isEdgeVoice,
  normalizeTtsText,
} from '../../lib/ttsContract';

type RequestWithBody = IncomingMessage & { body?: unknown };

function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>
): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(payload));
  res.setHeader('Cache-Control', 'no-store');
  res.end(payload);
}

async function readJsonBody(req: RequestWithBody): Promise<unknown> {
  if (req.body !== undefined) {
    if (Buffer.byteLength(JSON.stringify(req.body)) > MAX_TTS_BODY_BYTES) {
      throw Object.assign(new Error('Request body too large'), { status: 413 });
    }
    return req.body;
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_TTS_BODY_BYTES) {
      throw Object.assign(new Error('Request body too large'), { status: 413 });
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return null;
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}

function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function collectMp3(
  tts: MsEdgeTTS,
  voice: string,
  text: string,
  pitch: number
): Promise<Buffer> {
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(escapeXmlText(text), {
    rate: 1,
    pitch: `${Math.round((pitch - 1) * 100)}%`,
  });

  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of audioStream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_TTS_AUDIO_BYTES) {
      audioStream.destroy();
      throw Object.assign(new Error('Audio response too large'), { status: 502 });
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    throw Object.assign(new Error('Edge TTS returned no audio'), { status: 502 });
  }
  return Buffer.concat(chunks);
}

export default async function handler(
  req: RequestWithBody,
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const contentLength = req.headers['content-length'];
  if (typeof contentLength === 'string' && Number(contentLength) > MAX_TTS_BODY_BYTES) {
    sendJson(res, 413, { error: 'Request body too large' });
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    const status =
      typeof error === 'object' && error && 'status' in error
        ? Number((error as { status: unknown }).status)
        : 400;
    sendJson(res, status || 400, {
      error: status === 413 ? 'Request body too large' : 'Invalid JSON',
    });
    return;
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    sendJson(res, 400, { error: 'Invalid request body' });
    return;
  }

  const input = body as Record<string, unknown>;
  const text = normalizeTtsText(input.text);
  if (!text) {
    sendJson(res, 400, { error: 'Text is required and must be at most 1200 characters' });
    return;
  }

  if (!isEdgeVoice(input.voice)) {
    sendJson(res, 400, { error: 'Unsupported voice' });
    return;
  }
  const pitchValue = input.pitch === undefined ? 1.02 : input.pitch;
  if (
    typeof pitchValue !== 'number' ||
    !Number.isFinite(pitchValue) ||
    pitchValue < 0.7 ||
    pitchValue > 1.5
  ) {
    sendJson(res, 400, { error: 'Pitch must be between 0.7 and 1.5' });
    return;
  }
  const voice = input.voice;
  const tts = new MsEdgeTTS({
    enableLogger: false,
    connectionTimeoutMs: 8000,
    synthesisTimeoutMs: 10000,
  });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const audio = await Promise.race([
      collectMp3(tts, voice, text, pitchValue),
      new Promise<Buffer>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(Object.assign(new Error('Edge TTS timed out'), { status: 504 }));
        }, 15000);
      }),
    ]);

    if (timeoutId) clearTimeout(timeoutId);
    tts.close();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audio.length);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(audio);
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    tts.close();
    const status =
      typeof error === 'object' && error && 'status' in error
        ? Number((error as { status: unknown }).status)
        : 502;
    sendJson(res, status === 504 ? 504 : 502, {
      error: status === 504 ? 'Edge TTS timed out' : 'Edge TTS unavailable',
    });
  }
}
