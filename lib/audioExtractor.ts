import { Mp3Encoder } from '@breezystack/lamejs';

export interface ExtractedAudioPayload {
  base64: string;
  mimeType: 'audio/mp3';
  durationSec: number;
  sizeKb: number;
  sampleRate: number;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

/**
 * Extracts audio from a local MP4/WebM/MOV/audio file strictly in-browser via Web Audio API,
 * resamples to 16kHz mono, encodes to compact MP3 using @breezystack/lamejs (max ~150s),
 * and avoids uploading large raw video files to the server.
 */
export async function extractCompressedMonoMp3FromFile(
  file: File,
  onProgress?: (percent: number, label: string) => void,
  maxDurationSec = 150
): Promise<ExtractedAudioPayload> {
  onProgress?.(10, 'Video fayl xotiraga o‘qilmoqda...');
  const arrayBuffer = await file.arrayBuffer();

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Brauzeringiz Web Audio API ni qo‘llab-quvvatlamaydi.');
  }

  const audioCtx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    onProgress?.(28, 'Audio yo‘lakcha ajratilmoqda...');
    decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await audioCtx.close().catch(() => {});
  }

  const targetRate = 16000;
  const clampedDuration = Math.min(decoded.duration, maxDurationSec);
  const targetLength = Math.max(1, Math.floor(clampedDuration * targetRate));

  onProgress?.(48, '16 kHz mono formatga siqilmoqda...');
  const offlineCtx = new OfflineAudioContext(1, targetLength, targetRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0, 0, clampedDuration);

  const rendered = await offlineCtx.startRendering();
  const floatSamples = rendered.getChannelData(0);

  // Convert Float32 [-1, 1] -> Int16 PCM
  const pcm16 = new Int16Array(floatSamples.length);
  for (let i = 0; i < floatSamples.length; i++) {
    const s = Math.max(-1, Math.min(1, floatSamples[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  onProgress?.(72, 'MP3 formatga kodlanmoqda...');
  const mp3Encoder = new Mp3Encoder(1, targetRate, 48); // 48 kbps mono speech MP3
  const blockSize = 1152;
  const mp3Chunks: Uint8Array[] = [];

  for (let i = 0; i < pcm16.length; i += blockSize) {
    const sampleChunk = pcm16.subarray(i, i + blockSize);
    const mp3buf = mp3Encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) {
      mp3Chunks.push(new Uint8Array(mp3buf));
    }
  }
  const flushBuf = mp3Encoder.flush();
  if (flushBuf.length > 0) {
    mp3Chunks.push(new Uint8Array(flushBuf));
  }

  const totalBytes = mp3Chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of mp3Chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  onProgress?.(95, 'Tayyor!');
  const base64 = uint8ToBase64(merged);
  return {
    base64,
    mimeType: 'audio/mp3',
    durationSec: Number(clampedDuration.toFixed(1)),
    sizeKb: Math.max(1, Math.round(merged.byteLength / 1024)),
    sampleRate: targetRate,
  };
}
