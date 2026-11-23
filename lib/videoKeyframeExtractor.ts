export interface ExtractedVideoResult {
  frames: string[];
  durationSec: number;
  totalBytes: number;
  width: number;
  height: number;
}

const MAX_KEYFRAMES = 14;
const TARGET_CANDIDATE_PROBES = 24;
const MAX_WIDTH_PX = 640;
const INITIAL_JPEG_QUALITY = 0.65;
const MAX_TOTAL_BYTES = 580 * 1024; // Strictly < 600KB

function seekVideoTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      clearTimeout(timer);
      resolve();
    };
    const onSeeked = () => finish();
    const onError = () => finish();
    const timer = window.setTimeout(finish, 3500);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    try {
      video.currentTime = Math.max(0, timeSec);
    } catch {
      finish();
    }
  });
}

function loadVideoMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video faylni brauzerda o'qib bo'lmadi."));
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Video ma'lumotlarini yuklash vaqti tugadi."));
    }, 15_000);
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
      clearTimeout(timer);
    };
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });
}

function computeLumaSignature(
  ctx: CanvasRenderingContext2D,
  srcCanvas: HTMLCanvasElement,
  sigCanvas: HTMLCanvasElement,
  sigCtx: CanvasRenderingContext2D
): Uint8Array {
  sigCtx.drawImage(srcCanvas, 0, 0, sigCanvas.width, sigCanvas.height);
  const data = sigCtx.getImageData(0, 0, sigCanvas.width, sigCanvas.height).data;
  const out = new Uint8Array(sigCanvas.width * sigCanvas.height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    out[p] = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }
  return out;
}

function meanSignatureDiff(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 255;
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum / len;
}

function measurePayloadBytes(frames: string[]): number {
  let bytes = 0;
  for (const f of frames) {
    bytes += f.length;
  }
  return bytes;
}

function reencodeCanvas(
  srcCanvas: HTMLCanvasElement,
  targetW: number,
  targetH: number,
  quality: number
): string {
  const tmp = document.createElement('canvas');
  tmp.width = targetW;
  tmp.height = targetH;
  const tctx = tmp.getContext('2d');
  if (!tctx) return srcCanvas.toDataURL('image/jpeg', quality);
  tctx.drawImage(srcCanvas, 0, 0, targetW, targetH);
  return tmp.toDataURL('image/jpeg', quality);
}

/**
 * Extracts up to 12-15 visually distinct keyframes directly in the browser using offscreen
 * <video> + <canvas>, keeping max width <= 640px and total payload strictly < 600KB.
 */
export async function extractVideoKeyframes(
  file: File,
  onProgress?: (pct: number, status: string) => void
): Promise<ExtractedVideoResult> {
  if (!file) {
    throw new Error('Video fayl tanlanmadi.');
  }

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.src = objectUrl;

  try {
    onProgress?.(5, 'Video metama’lumotlari o‘qilmoqda...');
    await loadVideoMetadata(video);

    const rawDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
    const natW = video.videoWidth || 640;
    const natH = video.videoHeight || 360;
    const scale = Math.min(1, MAX_WIDTH_PX / Math.max(1, natW));
    const width = Math.max(160, Math.round(natW * scale));
    const height = Math.max(90, Math.round(natH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Brauzer 2D canvas kontekstini yaratib bo‘lmadi.');
    }

    const sigCanvas = document.createElement('canvas');
    sigCanvas.width = 32;
    sigCanvas.height = 18;
    const sigCtx = sigCanvas.getContext('2d');

    const probeCount = rawDuration < 8 ? Math.max(6, Math.min(12, Math.ceil(rawDuration * 2))) : TARGET_CANDIDATE_PROBES;
    const startSec = rawDuration > 2 ? rawDuration * 0.03 : 0;
    const endSec = rawDuration > 2 ? rawDuration * 0.97 : rawDuration;
    const timestamps: number[] = [];
    for (let i = 0; i < probeCount; i++) {
      const t =
        probeCount === 1
          ? startSec
          : startSec + ((endSec - startSec) * i) / (probeCount - 1);
      timestamps.push(Number(t.toFixed(2)));
    }

    interface CapturedFrame {
      timestamp: number;
      dataUrl: string;
      sig: Uint8Array | null;
      diffFromPrev: number;
      bitmapCanvas: HTMLCanvasElement;
    }

    const captured: CapturedFrame[] = [];
    let lastKeptSig: Uint8Array | null = null;

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      await seekVideoTo(video, ts);
      ctx.drawImage(video, 0, 0, width, height);

      const sig = sigCtx ? computeLumaSignature(ctx, canvas, sigCanvas, sigCtx) : null;
      const diff = sig && lastKeptSig ? meanSignatureDiff(sig, lastKeptSig) : 255;

      // Always keep first frame and frames with meaningful visual change (>= 6.5 luma diff)
      if (i === 0 || diff >= 6.5 || captured.length < 4) {
        const snap = document.createElement('canvas');
        snap.width = width;
        snap.height = height;
        const sctx = snap.getContext('2d');
        sctx?.drawImage(canvas, 0, 0, width, height);

        const dataUrl = snap.toDataURL('image/jpeg', INITIAL_JPEG_QUALITY);
        captured.push({
          timestamp: ts,
          dataUrl,
          sig,
          diffFromPrev: diff,
          bitmapCanvas: snap,
        });
        lastKeptSig = sig;
      }

      const pct = 10 + Math.round(((i + 1) / timestamps.length) * 78);
      onProgress?.(
        pct,
        `Kadrlar ajratilmoqda: ${captured.length} ta noyob kadr (${i + 1}/${timestamps.length})...`
      );
    }

    // Subsample evenly down to MAX_KEYFRAMES if more than 14 captured
    let selected = captured;
    if (captured.length > MAX_KEYFRAMES) {
      selected = [];
      for (let i = 0; i < MAX_KEYFRAMES; i++) {
        const idx = Math.round((i * (captured.length - 1)) / (MAX_KEYFRAMES - 1));
        selected.push(captured[idx]);
      }
    }

    onProgress?.(92, 'Kadrlar hajmi optimallashtirilmoqda (< 600 KB)...');

    let frames = selected.map((c) => c.dataUrl);
    let totalBytes = measurePayloadBytes(frames);

    // Adaptive compression pass 1: lower quality 0.54
    if (totalBytes > MAX_TOTAL_BYTES) {
      frames = selected.map((c) => c.bitmapCanvas.toDataURL('image/jpeg', 0.54));
      totalBytes = measurePayloadBytes(frames);
    }

    // Adaptive compression pass 2: resize to 480px width & quality 0.48
    if (totalBytes > MAX_TOTAL_BYTES) {
      const compactW = Math.min(480, width);
      const compactH = Math.max(90, Math.round((height * compactW) / width));
      frames = selected.map((c) =>
        reencodeCanvas(c.bitmapCanvas, compactW, compactH, 0.48)
      );
      totalBytes = measurePayloadBytes(frames);
    }

    // Adaptive pass 3: reduce frame count to 10–12 if still above 580 KB
    while (totalBytes > MAX_TOTAL_BYTES && frames.length > 8) {
      const reduced: string[] = [];
      for (let i = 0; i < frames.length; i++) {
        if (i === 0 || i === frames.length - 1 || i % 2 === 0) {
          reduced.push(frames[i]);
        }
      }
      frames = reduced;
      totalBytes = measurePayloadBytes(frames);
    }

    onProgress?.(100, 'Kadrlar tayyor!');

    return {
      frames,
      durationSec: Math.round(rawDuration),
      totalBytes,
      width,
      height,
    };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}
