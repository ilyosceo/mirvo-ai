import { safeParseJsonOrNull } from './safeFetchJson';

export type VoiceGender = 'auto' | 'female' | 'male';

export interface VoiceSettings {
  rate: number; // 0.7..1.5
  pitch: number; // 0.7..1.5
  gender: VoiceGender;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  rate: 1.0,
  pitch: 1.02,
  gender: 'auto',
};

const VOICE_SETTINGS_STORAGE_KEY = 'qalamai_voice_settings_v1';

export const VOICE_RATE_PRESETS = [0.8, 1.0, 1.25, 1.5] as const;

export function clampVoiceRate(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOICE_SETTINGS.rate;
  return Math.max(0.7, Math.min(1.5, Math.round(value * 20) / 20));
}

export function formatVoiceRate(rate: number): string {
  const safe = clampVoiceRate(rate);
  const rounded1 = Math.round(safe * 10) / 10;
  if (Math.abs(safe - rounded1) < 0.005) {
    return `${rounded1.toFixed(1)}×`;
  }
  return `${safe.toFixed(2)}×`;
}

export function cycleVoiceRatePreset(currentRate: number): number {
  const safe = clampVoiceRate(currentRate);
  for (const preset of VOICE_RATE_PRESETS) {
    if (preset > safe + 0.02) {
      return preset;
    }
  }
  return VOICE_RATE_PRESETS[0];
}

export function clampVoicePitch(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOICE_SETTINGS.pitch;
  return Math.max(0.7, Math.min(1.5, Math.round(value * 100) / 100));
}

export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VOICE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    const gender: VoiceGender =
      parsed.gender === 'female' || parsed.gender === 'male' || parsed.gender === 'auto'
        ? parsed.gender
        : DEFAULT_VOICE_SETTINGS.gender;
    return {
      rate: clampVoiceRate(Number(parsed.rate ?? DEFAULT_VOICE_SETTINGS.rate)),
      pitch: clampVoicePitch(Number(parsed.pitch ?? DEFAULT_VOICE_SETTINGS.pitch)),
      gender,
    };
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

export function saveVoiceSettings(settings: VoiceSettings): VoiceSettings {
  const normalized: VoiceSettings = {
    rate: clampVoiceRate(settings.rate),
    pitch: clampVoicePitch(settings.pitch),
    gender:
      settings.gender === 'female' || settings.gender === 'male' || settings.gender === 'auto'
        ? settings.gender
        : 'auto',
  };
  try {
    localStorage.setItem(VOICE_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage errors
  }
  return normalized;
}

const FEMALE_VOICE_RE =
  /female|woman|girl|ayol|madina|nigora|sevara|irina|svetlana|milena|katya|elena|yelda|emel|filiz|zira|samantha|victoria|karen|aria|jenny|natasha|tatyana|olga|anna|maria|sara|daria|alyona|ekaterina|wavenet-[acef]|neural2-[acef]/i;

const MALE_VOICE_RE =
  /male|man|boy|erkak|sardor|jasur|pavel|dmitry|yuri|artem|maxim|cem|ahmet|david|mark|alex|daniel|guy|andrew|ryan|boris|ivan|sergey|oleg|nikita|wavenet-[bdg]|neural2-[bdg]/i;

function normalizeLangTag(lang: string): string {
  return (lang || '').trim().toLowerCase().replace(/_/g, '-');
}

function isUzbekVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = normalizeLangTag(voice.lang);
  if (lang === 'uz' || lang.startsWith('uz-')) return true;
  const desc = `${voice.name} ${voice.voiceURI}`;
  return /\b(uzbek|o['‘’`]?zbek|uz-uz|uz_uz)\b/i.test(desc);
}

function getUzbekVoiceScore(voice: SpeechSynthesisVoice, gender: VoiceGender): {
  score: number;
  matchedGender: boolean;
} {
  const lang = normalizeLangTag(voice.lang);
  let score = 0;

  // Prefer Latin Uzbek / standard uz-UZ over Cyrillic or generic tag
  if (lang === 'uz-uz' || lang === 'uz-latn-uz' || lang === 'uz-latn') {
    score += 40;
  } else if (lang.startsWith('uz') && !lang.includes('cyrl')) {
    score += 30;
  } else {
    score += 15;
  }

  // Prioritize local platform-native speech synthesis over remote/network voices
  if (voice.localService) {
    score += 100;
  }

  // Prefer higher-quality neural/natural browser voices as secondary signal
  if (/natural|neural|online|wavenet|madina|sardor/i.test(voice.name)) {
    score += 20;
  }

  if (voice.default) {
    score += 5;
  }

  let matchedGender = gender === 'auto';
  if (gender !== 'auto' && matchesGenderHeuristic(voice, gender)) {
    matchedGender = true;
    score += 25;
  }

  return { score, matchedGender };
}

function matchesGenderHeuristic(voice: SpeechSynthesisVoice, gender: Exclude<VoiceGender, 'auto'>): boolean {
  const descriptor = `${voice.name} ${voice.voiceURI}`;
  if (gender === 'female') {
    return FEMALE_VOICE_RE.test(descriptor) && !MALE_VOICE_RE.test(descriptor);
  }
  return MALE_VOICE_RE.test(descriptor) && !FEMALE_VOICE_RE.test(descriptor);
}

/**
 * Selects genuine Uzbek (uz-*) voices ordered to prioritize local platform-native
 * synthesis first (`localService: true`), falling back to reliable browser-supported
 * Uzbek voices if no local native voice is installed.
 */
export function selectSpeechVoice(
  voices: SpeechSynthesisVoice[],
  gender: VoiceGender,
  excludeVoiceURIs?: Set<string>
): {
  voice: SpeechSynthesisVoice | null;
  fallbackVoice: SpeechSynthesisVoice | null;
  matchedGender: boolean;
  langTier: 'native-uz' | 'browser-uz' | 'none';
} {
  if (!voices || voices.length === 0) {
    return { voice: null, fallbackVoice: null, matchedGender: false, langTier: 'none' };
  }

  const regionalVoices = voices.filter(
    (v) => isUzbekVoice(v) && (!excludeVoiceURIs || !excludeVoiceURIs.has(v.voiceURI))
  );

  if (regionalVoices.length === 0) {
    return { voice: null, fallbackVoice: null, matchedGender: false, langTier: 'none' };
  }

  const ranked = regionalVoices
    .map((voice) => ({ voice, ...getUzbekVoiceScore(voice, gender) }))
    .sort((a, b) => b.score - a.score);

  const primary = ranked[0];
  const secondary = ranked.find((item) => item.voice.voiceURI !== primary.voice.voiceURI) ?? null;

  return {
    voice: primary.voice,
    fallbackVoice: secondary?.voice ?? null,
    matchedGender: primary.matchedGender,
    langTier: primary.voice.localService ? 'native-uz' : 'browser-uz',
  };
}

function resolveEffectivePitch(basePitch: number, gender: VoiceGender, matchedGender: boolean): number {
  const safePitch = clampVoicePitch(basePitch);
  if (gender === 'auto' || matchedGender) {
    return safePitch;
  }
  if (gender === 'female') {
    return Math.max(0.7, Math.min(1.5, Number((safePitch * 1.12).toFixed(2))));
  }
  return Math.max(0.7, Math.min(1.5, Number((safePitch * 0.85).toFixed(2))));
}

export interface VoicePlaybackCallbacks {
  onStart?: () => void;
  onBeatStart?: (beatIndex: number) => void;
  onTick?: (mouthOpen: number, progress: number) => void;
  onEnd?: () => void;
  onMode?: (mode: 'browser-tts' | 'server-tts' | 'cadence') => void;
}

function sanitizeSpeechText(raw: string): string {
  return raw
    .replace(/[‘’ʻʼ`]/g, "'")
    .replace(/\$+/g, '')
    .replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, '$1 taqsim $2')
    .replace(/\\sqrt\s*\{([^}]+)\}/g, 'ildiz ostida $1')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}()_\\<>±≈≠≤≥∫∑]/g, ' ')
    .replace(/π/g, ' pi ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUzbekForBrowserSpeech(text: string): string {
  return text
    .replace(/[‘’ʻʼ`]/g, "'")
    .replace(/\b(EmojiUstoz|MirvoUstoz)(?:man)?\b/gi, (m) =>
      m.toLowerCase().endsWith('man') ? 'Ustozman' : 'Ustoz'
    )
    .replace(/\bMirvo\s+AI\b/gi, 'Mirvo')
    .replace(/\bQalam\s+AI\b/gi, 'Mirvo')
    .replace(/\b3D\b/gi, "uch o'lchamli")
    .replace(/\b2D\b/gi, "ikki o'lchamli")
    .replace(/([a-zA-Z])\s*\^\s*2\b/g, '$1 kvadrat')
    .replace(/([a-zA-Z])\s*\^\s*3\b/g, '$1 kub')
    .replace(/²/g, ' kvadrat')
    .replace(/³/g, ' kub')
    .replace(/°/g, ' gradus')
    .replace(/√/g, ' ildiz ostida ')
    .replace(/=/g, ' teng ')
    .replace(/\+/g, " qo'shuv ")
    .replace(/\*/g, " ko'paytirilgan ")
    .replace(/·/g, " ko'paytirilgan ")
    .replace(/\bx\b/gi, 'iks')
    .replace(/\by\b/gi, 'igrik')
    .replace(/\bz\b/gi, 'zet')
    .replace(/(\d+)\s*-\s*burchak/gi, '$1 burchak')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeInterBeatPauseMs(sentence: string, safeRate: number, silentMode: boolean): number {
  const trimmed = sentence.trim();
  let baseMs = 210;
  if (/(?:\.\.\.|…|[?!])$/.test(trimmed)) {
    baseMs = 320;
  } else if (/[.:]$/.test(trimmed)) {
    baseMs = 250;
  } else if (/[,;—–-]$/.test(trimmed)) {
    baseMs = 140;
  }
  if (silentMode) {
    baseMs = Math.round(baseMs * 0.55);
  }
  const rateScale = 1 / Math.sqrt(clampVoiceRate(safeRate));
  return Math.max(90, Math.min(420, Math.round(baseMs * rateScale)));
}

function getPitchBucket(pitch: number): string {
  if (pitch < 0.92) return 'low';
  if (pitch > 1.12) return 'high';
  return 'normal';
}

const SILENT_WAV_DATA_URL =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

class FreeVoiceEngine {
  private currentAudio: HTMLAudioElement | null = null;
  private audioUnlocked = false;
  private rafId: number | null = null;
  private pauseTimerId: number | null = null;
  private pauseResolver: (() => void) | null = null;
  private active = false;
  private beatSessionId = 0;
  private ttsClipCache = new Map<string, string>();
  private inFlightTts = new Map<string, Promise<string | null>>();
  private serverTtsUnavailableUntil = 0;
  private liveRate = DEFAULT_VOICE_SETTINGS.rate;

  /**
   * Updates speaking speed while audio is already playing without restarting the active clip.
   * Returns true if an active HTMLAudioElement clip was updated seamlessly in-flight.
   */
  setPlaybackRateLive(rate: number): boolean {
    const safeRate = clampVoiceRate(rate);
    this.liveRate = safeRate;
    if (
      this.active &&
      this.currentAudio &&
      !this.currentAudio.paused &&
      this.currentAudio.src &&
      this.currentAudio.src !== SILENT_WAV_DATA_URL
    ) {
      try {
        this.currentAudio.playbackRate = safeRate;
        if ('preservesPitch' in this.currentAudio) {
          (this.currentAudio as HTMLAudioElement & { preservesPitch: boolean }).preservesPitch = true;
        }
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  private getOrCreateAudioElement(): HTMLAudioElement {
    if (!this.currentAudio) {
      this.currentAudio = new Audio();
      this.currentAudio.setAttribute('playsinline', 'true');
    }
    return this.currentAudio;
  }

  /**
   * Unlocks the reusable HTMLAudioElement inside a user gesture so delayed async
   * Gemini TTS audio playback never gets blocked by mobile browser autoplay rules.
   */
  unlockAudio() {
    if (this.audioUnlocked || typeof window === 'undefined' || typeof Audio === 'undefined') {
      return;
    }
    try {
      const audio = this.getOrCreateAudioElement();
      if (!audio.src || audio.paused) {
        audio.src = SILENT_WAV_DATA_URL;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise
            .then(() => {
              this.audioUnlocked = true;
            })
            .catch(() => {
              // Will retry on next user gesture
            });
        }
      }
    } catch {
      // Ignore unlock error
    }
  }

  private primeAudioElement() {
    this.unlockAudio();
  }

  stop() {
    this.active = false;
    this.beatSessionId += 1;
    if (this.pauseTimerId !== null) {
      window.clearTimeout(this.pauseTimerId);
      this.pauseTimerId = null;
    }
    if (this.pauseResolver) {
      const resolvePause = this.pauseResolver;
      this.pauseResolver = null;
      resolvePause();
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.currentAudio) {
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.onloadedmetadata = null;
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {
        // ignore audio reset error
      }
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  private waitForPause(ms: number, sessionId: number): Promise<void> {
    if (ms <= 0 || !this.active || this.beatSessionId !== sessionId) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      if (this.pauseTimerId !== null) {
        window.clearTimeout(this.pauseTimerId);
        this.pauseTimerId = null;
      }
      if (this.pauseResolver) {
        const prev = this.pauseResolver;
        this.pauseResolver = null;
        prev();
      }
      this.pauseResolver = resolve;
      this.pauseTimerId = window.setTimeout(() => {
        this.pauseTimerId = null;
        if (this.pauseResolver === resolve) {
          this.pauseResolver = null;
        }
        resolve();
      }, ms);
    });
  }

  private getLoadedVoicesAsync(timeoutMs = 350): Promise<SpeechSynthesisVoice[]> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return Promise.resolve([]);
    }
    const synth = window.speechSynthesis;
    const immediate = synth.getVoices();
    if (immediate && immediate.length > 0) {
      return Promise.resolve(immediate);
    }

    return new Promise((resolve) => {
      let done = false;
      let timerId: number | null = null;

      const finish = () => {
        if (done) return;
        done = true;
        if (timerId !== null) {
          window.clearTimeout(timerId);
          timerId = null;
        }
        if (typeof synth.removeEventListener === 'function') {
          synth.removeEventListener('voiceschanged', onVoices);
        }
        resolve(synth.getVoices() || []);
      };

      const onVoices = () => {
        if ((synth.getVoices() || []).length > 0) {
          finish();
        }
      };

      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', onVoices);
      }
      timerId = window.setTimeout(finish, timeoutMs);
    });
  }

  private getTtsCacheKey(text: string, settings: VoiceSettings): string {
    return `${settings.gender}:${getPitchBucket(settings.pitch)}:${text}`;
  }

  private fetchServerTtsUrl(text: string, settings: VoiceSettings): Promise<string | null> {
    if (!text) return Promise.resolve(null);
    if (Date.now() < this.serverTtsUnavailableUntil) {
      return Promise.resolve(null);
    }

    const key = this.getTtsCacheKey(text, settings);
    const cached = this.ttsClipCache.get(key);
    if (cached) {
      return Promise.resolve(cached);
    }

    const existing = this.inFlightTts.get(key);
    if (existing) {
      return existing;
    }

    const reqPromise = (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch('/api/speech/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              gender: settings.gender,
              pitch: settings.pitch,
            }),
          });
          if (!res.ok) {
            if (res.status === 429 || res.status === 503) {
              const errBody = await safeParseJsonOrNull<{
                error?: string;
                retryAfterMs?: number;
              }>(res);
              if (res.status === 429 || errBody?.error?.includes('GEMINI_API_KEY')) {
                this.serverTtsUnavailableUntil =
                  Date.now() + Math.min(180_000, Math.max(20_000, errBody?.retryAfterMs || 60_000));
                return null;
              }
            }
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 220));
              continue;
            }
            return null;
          }
          const data = await safeParseJsonOrNull<{
            audioBase64?: string;
            mimeType?: string;
            fallback?: boolean;
            quotaExhausted?: boolean;
            missingKey?: boolean;
            retryAfterMs?: number;
          }>(res);
          if (!data) return null;
          if (data.quotaExhausted || data.missingKey) {
            this.serverTtsUnavailableUntil =
              Date.now() + Math.min(180_000, Math.max(20_000, data.retryAfterMs || 60_000));
            return null;
          }
          if (data.fallback || !data.audioBase64) return null;

          const dataUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
          if (this.ttsClipCache.size >= 50) {
            const oldest = this.ttsClipCache.keys().next().value;
            if (oldest) this.ttsClipCache.delete(oldest);
          }
          this.ttsClipCache.set(key, dataUrl);
          return dataUrl;
        } catch {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 220));
            continue;
          }
          return null;
        }
      }
      return null;
    })().finally(() => {
      this.inFlightTts.delete(key);
    });

    this.inFlightTts.set(key, reqPromise);
    return reqPromise;
  }

  // 60 FPS smooth orb & progress cadence synced to speech or HTMLAudioElement playback
  private startCadenceLoop(
    estimatedMs: number,
    callbacks: VoicePlaybackCallbacks,
    autoEnd: boolean,
    onDone?: () => void,
    startFraction = 0,
    externalProgressRef?: { value: number | null },
    audioRef?: HTMLAudioElement
  ) {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    const clampedStart = Math.max(0, Math.min(0.95, startFraction));
    const remainingMs = Math.max(600, estimatedMs * (1 - clampedStart));
    const startTime = performance.now();

    const loop = (now: number) => {
      if (!this.active) return;
      const elapsed = now - startTime;
      const timeFraction = Math.min(1, elapsed / remainingMs);
      let progress = clampedStart + (1 - clampedStart) * timeFraction;

      if (audioRef && Number.isFinite(audioRef.duration) && audioRef.duration > 0.1) {
        progress = Math.min(0.995, Math.max(clampedStart, audioRef.currentTime / audioRef.duration));
      } else if (externalProgressRef && externalProgressRef.value !== null) {
        progress = Math.max(progress * 0.7 + externalProgressRef.value * 0.3, externalProgressRef.value);
      }

      if (!autoEnd) {
        progress = Math.min(0.99, progress);
      }

      const wave =
        0.48 +
        0.34 * Math.sin(elapsed * 0.024) +
        0.18 * Math.cos(elapsed * 0.053);

      callbacks.onTick?.(Math.max(0.08, Math.min(1, wave)), Math.min(1, progress));

      if (autoEnd && elapsed >= remainingMs) {
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        if (onDone) {
          onDone();
        } else {
          this.stop();
          callbacks.onEnd?.();
        }
        return;
      }
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  private speakWithSelectedUzbekVoice(
    spokenStr: string,
    settings: VoiceSettings,
    safeRate: number,
    estimatedMs: number,
    callbacks: VoicePlaybackCallbacks,
    sessionId: number,
    clampedStart: number,
    voices: SpeechSynthesisVoice[],
    excludeVoiceURIs: Set<string>
  ): Promise<'native-uz' | 'browser-uz' | null> {
    return new Promise((resolve) => {
      if (!this.active || this.beatSessionId !== sessionId) {
        resolve(null);
        return;
      }

      const { voice: pickedVoice, matchedGender, langTier } = selectSpeechVoice(
        voices,
        settings.gender,
        excludeVoiceURIs
      );

      if (!pickedVoice || langTier === 'none') {
        resolve(null);
        return;
      }

      let settled = false;
      let safetyTimer: number | null = null;
      const boundaryProgressRef: { value: number | null } = { value: null };

      const cleanup = (result: 'native-uz' | 'browser-uz' | null, markDone: boolean) => {
        if (settled) return;
        settled = true;
        if (safetyTimer !== null) {
          window.clearTimeout(safetyTimer);
          safetyTimer = null;
        }
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        if (markDone) {
          callbacks.onTick?.(0, 1);
        }
        resolve(result);
      };

      try {
        const synth = window.speechSynthesis;
        const normalizedText = normalizeUzbekForBrowserSpeech(spokenStr);
        const utterance = new SpeechSynthesisUtterance(normalizedText);
        const normLang = normalizeLangTag(pickedVoice.lang);
        utterance.lang = normLang === 'uz' || !normLang ? 'uz-UZ' : pickedVoice.lang;
        utterance.voice = pickedVoice;
        utterance.rate = safeRate;
        utterance.pitch = resolveEffectivePitch(settings.pitch, settings.gender, matchedGender);

        utterance.onboundary = (e) => {
          if (typeof e.charIndex === 'number' && normalizedText.length > 0) {
            const localRatio = Math.min(0.98, Math.max(0, e.charIndex / normalizedText.length));
            boundaryProgressRef.value = clampedStart + (1 - clampedStart) * localRatio;
          }
        };
        utterance.onend = () => cleanup(langTier, true);
        utterance.onerror = () => cleanup(null, false);

        const safetyMs = Math.max(3000, Math.round(estimatedMs * (1 - clampedStart) * 1.65) + 1200);
        safetyTimer = window.setTimeout(() => cleanup(langTier, true), safetyMs);

        callbacks.onMode?.('browser-tts');
        this.startCadenceLoop(
          estimatedMs,
          callbacks,
          false,
          () => cleanup(langTier, true),
          clampedStart,
          boundaryProgressRef
        );

        if (synth.paused) {
          synth.resume();
        }
        synth.speak(utterance);
      } catch {
        cleanup(null, false);
      }
    });
  }

  private async speakSingleUtterance(
    rawText: string,
    settings: VoiceSettings,
    callbacks: VoicePlaybackCallbacks,
    sessionId: number,
    muted = false,
    startFraction = 0
  ): Promise<'server-tts' | 'native-uz' | 'browser-uz' | 'cadence'> {
    const fullText = sanitizeSpeechText(rawText);
    if (!fullText || !this.active || this.beatSessionId !== sessionId) {
      return 'cadence';
    }

    const clampedStart = Math.max(0, Math.min(0.92, startFraction));
    const safeRate = clampVoiceRate(settings.rate);
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;
    const estimatedMs = Math.max(2200, Math.round((wordCount * 400 + 450) / safeRate));

    // 1. Primary: High-quality Native Uzbek Gemini TTS (/api/speech/tts)
    if (!muted) {
      const audioUrl = await this.fetchServerTtsUrl(fullText, settings);
      if (!this.active || this.beatSessionId !== sessionId) {
        return 'server-tts';
      }
      if (audioUrl) {
        const played = await this.playAudioClip(
          audioUrl,
          safeRate,
          estimatedMs,
          callbacks,
          sessionId,
          clampedStart
        );
        if (played) {
          return 'server-tts';
        }
      }
    }

    if (!this.active || this.beatSessionId !== sessionId) {
      return 'cadence';
    }

    const sliceIdx =
      clampedStart > 0.05
        ? Math.min(fullText.length - 1, Math.floor(fullText.length * clampedStart))
        : 0;
    let speakText = fullText;
    if (sliceIdx > 0) {
      const nextSpace = fullText.indexOf(' ', sliceIdx);
      const aligned =
        nextSpace !== -1 ? fullText.slice(nextSpace + 1).trim() : fullText.slice(sliceIdx).trim();
      if (aligned.length > 3) speakText = aligned;
    }

    // 2. Secondary: Local platform-native Uzbek synthesis, then browser-supported Uzbek fallback
    if (!muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const voices = await this.getLoadedVoicesAsync();
      if (!this.active || this.beatSessionId !== sessionId) {
        return 'cadence';
      }

      const triedURIs = new Set<string>();
      for (let attempt = 0; attempt < 2; attempt++) {
        const { voice: candidate } = selectSpeechVoice(voices, settings.gender, triedURIs);
        if (!candidate) break;

        const usedTier = await this.speakWithSelectedUzbekVoice(
          speakText,
          settings,
          safeRate,
          estimatedMs,
          callbacks,
          sessionId,
          clampedStart,
          voices,
          triedURIs
        );
        if (usedTier) {
          return usedTier;
        }
        if (!this.active || this.beatSessionId !== sessionId) {
          return 'cadence';
        }
        triedURIs.add(candidate.voiceURI);
      }
    }

    if (!this.active || this.beatSessionId !== sessionId) {
      return 'cadence';
    }

    // 3. Clean silent synchronized cadence (never falls back to English/Russian/Turkish voices)
    await new Promise<void>((resolve) => {
      if (!this.active || this.beatSessionId !== sessionId) {
        resolve();
        return;
      }
      callbacks.onMode?.('cadence');
      this.startCadenceLoop(
        estimatedMs,
        callbacks,
        true,
        () => {
          callbacks.onTick?.(0, 1);
          resolve();
        },
        clampedStart
      );
    });
    return 'cadence';
  }

  private playAudioClip(
    audioUrl: string,
    safeRate: number,
    estimatedMs: number,
    callbacks: VoicePlaybackCallbacks,
    sessionId: number,
    startFraction = 0
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.active || this.beatSessionId !== sessionId) {
        resolve(false);
        return;
      }

      const audio = this.getOrCreateAudioElement();
      audio.onended = null;
      audio.onerror = null;
      audio.onloadedmetadata = null;
      audio.src = audioUrl;
      audio.playbackRate = safeRate;
      if ('preservesPitch' in audio) {
        (audio as HTMLAudioElement & { preservesPitch: boolean }).preservesPitch = true;
      }

      let settled = false;
      let safetyTimer: number | null = null;

      const cleanup = (success: boolean) => {
        if (settled) return;
        settled = true;
        if (safetyTimer !== null) {
          window.clearTimeout(safetyTimer);
          safetyTimer = null;
        }
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        audio.onended = null;
        audio.onerror = null;
        audio.onloadedmetadata = null;
        if (success) {
          callbacks.onTick?.(0, 1);
        }
        resolve(success);
      };

      const seekStart = () => {
        audio.playbackRate = safeRate;
        if (startFraction > 0.04 && Number.isFinite(audio.duration) && audio.duration > 0.2) {
          try {
            audio.currentTime = audio.duration * startFraction;
          } catch {
            // ignore seek failure
          }
        }
      };

      audio.onloadedmetadata = seekStart;
      audio.onended = () => cleanup(true);
      audio.onerror = () => cleanup(false);

      safetyTimer = window.setTimeout(
        () => cleanup(true),
        Math.max(4000, Math.round(estimatedMs * 2.2) + 2500)
      );

      callbacks.onMode?.('server-tts');
      this.startCadenceLoop(estimatedMs, callbacks, false, undefined, startFraction, undefined, audio);

      audio.play().catch(() => {
        cleanup(false);
      });
    });
  }

  async speakBeats(
    sentences: string[],
    callbacks: VoicePlaybackCallbacks = {},
    rateOrSettings: number | Partial<VoiceSettings> = DEFAULT_VOICE_SETTINGS,
    muted = false,
    startBeatIndex = 0,
    startBeatFraction = 0
  ) {
    this.stop();
    const cleanList = sentences.map((s) => s.trim()).filter(Boolean);
    if (cleanList.length === 0) return;

    const settings: VoiceSettings =
      typeof rateOrSettings === 'number'
        ? { ...DEFAULT_VOICE_SETTINGS, rate: clampVoiceRate(rateOrSettings) }
        : {
            rate: clampVoiceRate(rateOrSettings.rate ?? DEFAULT_VOICE_SETTINGS.rate),
            pitch: clampVoicePitch(rateOrSettings.pitch ?? DEFAULT_VOICE_SETTINGS.pitch),
            gender: rateOrSettings.gender ?? DEFAULT_VOICE_SETTINGS.gender,
          };

    this.active = true;
    this.liveRate = settings.rate;
    if (!muted) {
      this.primeAudioElement();
    }
    const sessionId = this.beatSessionId;
    const firstIdx = Math.max(0, Math.min(cleanList.length - 1, startBeatIndex));
    callbacks.onStart?.();

    for (let i = firstIdx; i < cleanList.length; i++) {
      if (!this.active || this.beatSessionId !== sessionId) return;
      callbacks.onBeatStart?.(i);
      const frac = i === firstIdx ? startBeatFraction : 0;
      const modeUsed = await this.speakSingleUtterance(
        cleanList[i],
        { ...settings, rate: this.liveRate },
        callbacks,
        sessionId,
        muted,
        frac
      );

      if (!this.active || this.beatSessionId !== sessionId) return;

      if (i < cleanList.length - 1) {
        // Hold resting mouth state briefly between sentences so beat transitions feel natural
        callbacks.onTick?.(0, 1);
        const pauseMs = computeInterBeatPauseMs(
          cleanList[i],
          this.liveRate,
          muted || modeUsed === 'cadence'
        );
        await this.waitForPause(pauseMs, sessionId);
      }
    }

    if (this.active && this.beatSessionId === sessionId) {
      this.stop();
      callbacks.onEnd?.();
    }
  }

  async speak(
    rawText: string,
    callbacks: VoicePlaybackCallbacks = {},
    preferServerTts = true,
    rateOrSettings: number | Partial<VoiceSettings> = DEFAULT_VOICE_SETTINGS
  ) {
    this.stop();
    const text = sanitizeSpeechText(rawText);
    if (!text) return;

    const settings: VoiceSettings =
      typeof rateOrSettings === 'number'
        ? { ...DEFAULT_VOICE_SETTINGS, rate: clampVoiceRate(rateOrSettings) }
        : {
            rate: clampVoiceRate(rateOrSettings.rate ?? DEFAULT_VOICE_SETTINGS.rate),
            pitch: clampVoicePitch(rateOrSettings.pitch ?? DEFAULT_VOICE_SETTINGS.pitch),
            gender: rateOrSettings.gender ?? DEFAULT_VOICE_SETTINGS.gender,
          };

    this.active = true;
    this.liveRate = settings.rate;
    if (preferServerTts) {
      this.primeAudioElement();
    }
    const sessionId = this.beatSessionId;
    callbacks.onStart?.();
    const safeRate = clampVoiceRate(settings.rate);
    const estimatedMs = Math.max(2200, Math.round((text.split(/\s+/).length * 410) / safeRate));

    if (preferServerTts) {
      const audioUrl = await this.fetchServerTtsUrl(text, settings);
      if (!this.active || this.beatSessionId !== sessionId) return;
      if (audioUrl) {
        const played = await this.playAudioClip(
          audioUrl,
          safeRate,
          estimatedMs,
          callbacks,
          sessionId,
          0
        );
        if (played && this.active && this.beatSessionId === sessionId) {
          this.stop();
          callbacks.onEnd?.();
          return;
        }
      }
    }

    if (!this.active || this.beatSessionId !== sessionId) return;
    await this.speakWithBrowserOrCadence(text, estimatedMs, settings, callbacks, sessionId);
  }

  private async speakWithBrowserOrCadence(
    text: string,
    estimatedMs: number,
    settings: VoiceSettings,
    callbacks: VoicePlaybackCallbacks,
    sessionId: number
  ) {
    if (!this.active || this.beatSessionId !== sessionId) return;

    const safeRate = clampVoiceRate(settings.rate);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const voices = await this.getLoadedVoicesAsync();
      if (!this.active || this.beatSessionId !== sessionId) return;

      const triedURIs = new Set<string>();
      for (let attempt = 0; attempt < 2; attempt++) {
        const { voice: candidate } = selectSpeechVoice(voices, settings.gender, triedURIs);
        if (!candidate) break;

        const usedTier = await this.speakWithSelectedUzbekVoice(
          text,
          settings,
          safeRate,
          estimatedMs,
          callbacks,
          sessionId,
          0,
          voices,
          triedURIs
        );
        if (usedTier) {
          if (this.active && this.beatSessionId === sessionId) {
            this.stop();
            callbacks.onEnd?.();
          }
          return;
        }
        if (!this.active || this.beatSessionId !== sessionId) return;
        triedURIs.add(candidate.voiceURI);
      }
    }

    if (!this.active || this.beatSessionId !== sessionId) return;
    callbacks.onMode?.('cadence');
    this.startCadenceLoop(estimatedMs, callbacks, true);
  }
}

export const voiceEngine = new FreeVoiceEngine();

export interface SttSession {
  stop: () => void;
}

export function startUzbekSpeechRecognition(handlers: {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): SttSession {
  const win = window as unknown as {
    SpeechRecognition?: new () => {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
      onerror: ((e: { error: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    webkitSpeechRecognition?: new () => {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
      onerror: ((e: { error: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
  };

  const RecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;

  if (RecognitionCtor) {
    const recognition = new RecognitionCtor();
    recognition.lang = 'uz-UZ';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let text = '';
      let isFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      handlers.onResult(text.trim(), isFinal);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        handlers.onError("Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.");
      } else if (event.error === 'no-speech') {
        handlers.onError("Ovoz eshitilmadi, qayta urinib ko'ring.");
      } else {
        handlers.onError(`Ovozli kiritish xatosi: ${event.error}`);
      }
    };

    recognition.onend = () => {
      handlers.onEnd();
    };

    try {
      recognition.start();
    } catch {
      handlers.onError("Mikrofonni ishga tushirib bo'lmadi.");
      handlers.onEnd();
    }

    return {
      stop: () => {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      },
    };
  }

  let recorder: MediaRecorder | null = null;
  let streamRef: MediaStream | null = null;
  const chunks: BlobPart[] = [];

  navigator.mediaDevices
    ?.getUserMedia({ audio: true })
    .then((stream) => {
      streamRef = stream;
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = String(reader.result || '');
          const base64 = dataUrl.split(',')[1] || '';
          try {
            const res = await fetch('/api/speech/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: base64, mimeType: blob.type || 'audio/webm' }),
            });
            if (res.ok) {
              const json = await safeParseJsonOrNull<{ text?: string }>(res);
              if (json?.text) handlers.onResult(json.text, true);
              else handlers.onError("Ovozni matnga o'girishda xatolik yuz berdi.");
            } else {
              handlers.onError("Ovozni matnga o'girishda xatolik yuz berdi.");
            }
          } catch {
            handlers.onError("Server bilan bog'lanishda xatolik.");
          } finally {
            handlers.onEnd();
          }
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
    })
    .catch(() => {
      handlers.onError("Brauzeringizda mikrofon qo'llab-quvvatlanmadi.");
      handlers.onEnd();
    });

  return {
    stop: () => {
      try {
        if (recorder && recorder.state !== 'inactive') {
          recorder.stop();
        } else {
          streamRef?.getTracks().forEach((t) => t.stop());
          handlers.onEnd();
        }
      } catch {
        handlers.onEnd();
      }
    },
  };
}
