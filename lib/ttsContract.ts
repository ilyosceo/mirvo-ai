export type EdgeVoice = 'uz-UZ-SardorNeural' | 'uz-UZ-MadinaNeural';

export const EDGE_VOICES: readonly EdgeVoice[] = [
  'uz-UZ-SardorNeural',
  'uz-UZ-MadinaNeural',
];

export const DEFAULT_EDGE_VOICE: EdgeVoice = 'uz-UZ-SardorNeural';
export const MAX_TTS_TEXT_LENGTH = 1200;
export const MAX_TTS_BODY_BYTES = 16 * 1024;
export const MAX_TTS_AUDIO_BYTES = 1024 * 1024;

export function isEdgeVoice(value: unknown): value is EdgeVoice {
  return typeof value === 'string' && EDGE_VOICES.some((voice) => voice === value);
}

export function normalizeEdgeVoice(value: unknown): EdgeVoice {
  return isEdgeVoice(value) ? value : DEFAULT_EDGE_VOICE;
}

export function normalizeTtsText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\u0000/g, '').trim();
  if (!text || text.length > MAX_TTS_TEXT_LENGTH) return null;
  return text;
}
