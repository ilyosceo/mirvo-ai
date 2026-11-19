import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Box,
  CheckCircle2,
  Coins,
  Layers,
  Leaf,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sun,
  Trash2,
  TrendingUp,
  Triangle,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import { CACHED_LESSONS } from './data/cachedLessons';
import { tryLocalDeterministicParse } from './lib/deterministicParser';
import {
  DAILY_LESSON_USAGE_STORAGE_KEY,
  loadDailyLessonUsage,
  saveDailyLessonCreation,
} from './lib/dailyLessonUsage';
import { findBuiltInCachedLesson } from './lib/lessonMatch';
import { generateProceduralPrimitives3D } from './lib/objectCatalog';
import {
  formatCostUsd,
  formatCostUzsApprox,
  formatTokenCount,
  loadSessionTokenStats,
  recordSessionTokenStats,
  resetSessionTokenStats,
  ZERO_TOKEN_USAGE,
  type SessionTokenStats,
} from './lib/tokenUsage';
import {
  findSavedLesson,
  loadLegacyHistory,
  loadSavedLessons,
  normalizeLessonKey,
  removeSavedLessonEntry,
  saveLegacyHistory,
  saveLessonEntry,
  type SavedLessonEntry,
} from './lib/lessonStorage';
import {
  DEFAULT_VOICE_SETTINGS,
  loadVoiceSettings,
  saveVoiceSettings,
  startUzbekSpeechRecognition,
  voiceEngine,
  type EdgeVoice,
  type SttSession,
  type VoiceGender,
  type VoiceSettings,
} from './lib/voiceEngine';
import {
  ENGINE_LABELS_UZ,
  LESSON_DEPTH_OPTIONS,
  SUBJECT_LABELS_UZ,
  type LessonBeat,
  type LessonDepthMode,
  type ResolveResponse,
  type StageAnchorsMap,
  type TutorLesson,
} from './types/tutor';
import { VisualStage } from './components/VisualStage';
import { TeacherStageActor } from './components/TeacherStageActor';
import { MirvoMentor } from './components/MirvoMentor';
import { MirvoLogo } from './components/MirvoLogo';
import { resolveStepBeats } from './lib/teacherChoreography';
import { KaTeXBlock } from './components/KaTeXBlock';

const HOME_STARTER_CARDS = [
  {
    id: 'pythagoras-visual',
    subjectLabel: 'Geometriya · 2D',
    title: 'Pifagor teoremasi qanday ishlaydi?',
    subtitle: 'Uchburchak va kvadratlar maydoni isboti',
    icon: Triangle,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
  },
  {
    id: 'photosynthesis-visual',
    subjectLabel: 'Biologiya · 2D',
    title: "O'simliklar qanday oziqlanadi?",
    subtitle: 'Quyosh nuri, suv va xloroplast jarayoni',
    icon: Leaf,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
  },
  {
    id: 'sky-blue-physics',
    subjectLabel: 'Fizika · 3D',
    title: 'Nega osmon moviy?',
    subtitle: 'Yorug‘lik to‘lqinlarining atmosferada sochilishi',
    icon: Sun,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
  },
  {
    id: 'parabola-y-x2',
    subjectLabel: 'Algebra · Grafik',
    title: 'y = x² grafiki qanday ko‘rinadi?',
    subtitle: 'Jonli koordinata o‘qi va parametr slaydleri',
    icon: TrendingUp,
    iconColor: 'text-indigo-600',
    iconBg: 'bg-indigo-50',
  },
] as const;

const QUICK_VISUAL_TOPICS = [
  { label: 'Transformator', query: 'transformator' },
  { label: 'Inson yuragi', query: 'yurak' },
  { label: 'Hujayra tuzilishi', query: 'hujayra' },
  { label: 'Piramida kesimi', query: 'piramida' },
] as const;

const CORE_LESSON_IDS = [
  'parabola-y-x2',
  'pythagoras-visual',
  'photosynthesis-visual',
  'biology-cell-structure',
  'physics-transformer',
  'sky-blue-physics',
  'pyramid-section',
  'saddle-surface-3d',
  'two-sheet-hyperboloid-3d',
  'ellipsoid-3d',
  'insulin-1zni-pdb',
  'caffeine-pubchem-3d',
];

function buildDefaultSliders(lesson: TutorLesson): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of lesson.sliders || []) {
    map[s.id] = s.default;
  }
  return map;
}

export default function App() {
  const [viewMode, setViewMode] = useState<'home' | 'lesson'>('home');
  const [depthMode, setDepthMode] = useState<LessonDepthMode>('standard');
  const [lesson, setLesson] = useState<TutorLesson>(() => CACHED_LESSONS[0]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [sliderValues, setSliderValues] = useState<Record<string, number>>(() =>
    buildDefaultSliders(CACHED_LESSONS[0])
  );
  const [cameraOverride, setCameraOverride] = useState<[number, number, number] | undefined>(
    CACHED_LESSONS[0].steps[0]?.camera
  );
  const [autoRotate3D, setAutoRotate3D] = useState(false);

  // Quiz answer tracking per step index + immediate feedback animation state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizFeedback, setQuizFeedback] = useState<{
    stepIndex: number;
    shakingIdx: number | null;
    pulsing: boolean;
  } | null>(null);

  // Drawers & mobile typing resilience
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'library' | 'history' | 'settings'>('library');
  const [isMobileTyping, setIsMobileTyping] = useState(false);

  // Mirvo Mentor voice settings (rate, pitch, gender) persisted in localStorage
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => loadVoiceSettings());
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [previewMouthOpen, setPreviewMouthOpen] = useState(0);
  const [sliderPreviewTarget, setSliderPreviewTarget] = useState<'rate' | 'pitch' | null>(null);
  const [sliderPreviewMouthOpen, setSliderPreviewMouthOpen] = useState(0);
  const sliderPreviewTimerRef = useRef<number | null>(null);

  // Input & Multimodal state
  const [queryText, setQueryText] = useState('');
  const [imagePreview, setImagePreview] = useState<{
    dataUrl: string;
    base64: string;
    mimeType: string;
    name: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Playback, Voice TTS/STT & Progressive Drawing Choreography state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [activeBeatIndex, setActiveBeatIndex] = useState(0);
  const [beatProgress, setBeatProgress] = useState(0);
  const [stageAnchors, setStageAnchors] = useState<StageAnchorsMap>({});

  // Local query history, saved lessons & live token/cost telemetry
  const [savedLessons, setSavedLessons] = useState<SavedLessonEntry[]>(() =>
    loadSavedLessons()
  );
  const [history, setHistory] = useState<string[]>(() => loadLegacyHistory());
  const [sessionTokenStats, setSessionTokenStats] = useState<SessionTokenStats>(() =>
    loadSessionTokenStats()
  );
  const [dailyLessonCount, setDailyLessonCount] = useState(
    () => loadDailyLessonUsage().count
  );

  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sttSessionRef = useRef<SttSession | null>(null);
  const autoPlayTimerRef = useRef<number | null>(null);
  const activeStepIndexRef = useRef(activeStepIndex);
  const lessonStepsRef = useRef(lesson.steps);
  const viewModeRef = useRef(viewMode);
  const voiceSettingsRef = useRef(voiceSettings);
  const handleStepChangeRef = useRef<(nextIndex: number, autoPlay?: boolean) => void>(() => {});
  const scrubbingRef = useRef<{
    active: boolean;
    wasPlaying: boolean;
    lastBeatIdx: number;
    lastBeatFrac: number;
  }>({
    active: false,
    wasPlaying: false,
    lastBeatIdx: 0,
    lastBeatFrac: 0,
  });

  useEffect(() => {
    activeStepIndexRef.current = activeStepIndex;
  }, [activeStepIndex]);

  useEffect(() => {
    lessonStepsRef.current = lesson.steps;
  }, [lesson.steps]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    voiceSettingsRef.current = voiceSettings;
  }, [voiceSettings]);

  useEffect(() => {
    const refreshDailyCount = () => setDailyLessonCount(loadDailyLessonUsage().count);
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === DAILY_LESSON_USAGE_STORAGE_KEY || event.key === null) {
        refreshDailyCount();
      }
    };
    const intervalId = window.setInterval(refreshDailyCount, 60_000);
    window.addEventListener('focus', refreshDailyCount);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshDailyCount);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const currentStep = useMemo(
    () => lesson.steps[activeStepIndex] || lesson.steps[0],
    [lesson, activeStepIndex]
  );

  const activeStepBeats = useMemo(
    () => resolveStepBeats(currentStep, lesson.engine, activeStepIndex, lesson.steps.length),
    [currentStep, lesson.engine, activeStepIndex, lesson.steps.length]
  );

  const activeBeat = useMemo(() => {
    const raw = activeStepBeats[activeBeatIndex] || activeStepBeats[0];
    const isMicroStep = activeStepIndex === 1 || activeStepIndex === 2;
    const stepFocusPart = currentStep?.focusPart?.trim() || undefined;
    const beatFocusPart = raw?.focusPart?.trim() || undefined;

    const effectiveFocusPart = isMicroStep
      ? beatFocusPart ||
        stepFocusPart ||
        (raw?.focus_target && raw.focus_target !== 'overview' && raw.focus_target !== 'drawing_tip'
          ? raw.focus_target
          : undefined)
      : undefined;

    const effectiveZoom = isMicroStep
      ? raw?.tutor_pose === 'step_back'
        ? 1.0
        : Math.max(1.6, Math.min(1.9, raw?.cameraZoom ?? raw?.camera_zoom ?? currentStep?.cameraZoom ?? 1.72))
      : 1.0;

    const effectiveDim = Boolean(
      isMicroStep &&
        effectiveFocusPart &&
        raw?.tutor_pose !== 'step_back' &&
        (raw?.dimInactiveParts ?? currentStep?.dimInactiveParts ?? true)
    );

    const effectiveFlowType =
      raw?.flowType ?? currentStep?.flowType ?? currentStep?.render_params?.flowType ?? 'none';
    const rawFlowSpeed =
      raw?.flowSpeed ?? currentStep?.flowSpeed ?? currentStep?.render_params?.flowSpeed;
    const effectiveFlowSpeed =
      typeof rawFlowSpeed === 'number' && Number.isFinite(rawFlowSpeed)
        ? Math.max(0.5, Math.min(2.5, rawFlowSpeed))
        : 1.0;
    const effectiveFlowReverse = Boolean(
      raw?.flowReverse ??
        currentStep?.flowReverse ??
        currentStep?.render_params?.flowReverse ??
        false
    );

    return {
      ...raw,
      focusPart: effectiveFocusPart,
      cameraZoom: effectiveZoom,
      camera_zoom: effectiveZoom,
      dimInactiveParts: effectiveDim,
      flowType: effectiveFlowType,
      flowSpeed: effectiveFlowSpeed,
      flowReverse: effectiveFlowReverse,
    };
  }, [activeStepBeats, activeBeatIndex, activeStepIndex, currentStep]);

  const coreLessons = useMemo(
    () => CACHED_LESSONS.filter((item) => item.id && CORE_LESSON_IDS.includes(item.id)),
    []
  );

  const extraLessons = useMemo(
    () => CACHED_LESSONS.filter((item) => !item.id || !CORE_LESSON_IDS.includes(item.id)),
    []
  );

  useEffect(() => {
    const unlockOnce = () => {
      voiceEngine.unlockAudio();
    };
    window.addEventListener('pointerdown', unlockOnce, { passive: true });
    window.addEventListener('keydown', unlockOnce, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
      if (autoPlayTimerRef.current !== null) window.clearTimeout(autoPlayTimerRef.current);
      if (sliderPreviewTimerRef.current !== null) window.clearTimeout(sliderPreviewTimerRef.current);
      voiceEngine.stop();
      sttSessionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen || drawerTab !== 'settings') {
      if (sliderPreviewTimerRef.current !== null) {
        window.clearTimeout(sliderPreviewTimerRef.current);
        sliderPreviewTimerRef.current = null;
      }
      setSliderPreviewTarget(null);
      setSliderPreviewMouthOpen(0);
      return;
    }

    if (!sliderPreviewTarget || isPreviewingVoice) {
      setSliderPreviewMouthOpen(0);
      return;
    }

    let rafId = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsedSec = (now - start) / 1000;
      const rate = voiceSettingsRef.current.rate;
      const pitch = voiceSettingsRef.current.pitch;
      const cadenceFreq = 7.5 * rate;
      const syllableWave =
        0.5 +
        0.34 * Math.sin(elapsedSec * cadenceFreq) +
        0.16 * Math.cos(elapsedSec * cadenceFreq * 1.9);
      const pitchScale = 0.85 + Math.max(0, Math.min(0.35, (pitch - 0.7) * 0.35));
      setSliderPreviewMouthOpen(Math.max(0.14, Math.min(0.96, syllableWave * pitchScale)));
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      setSliderPreviewMouthOpen(0);
    };
  }, [drawerOpen, drawerTab, sliderPreviewTarget, isPreviewingVoice]);

  const stopPlayback = useCallback(() => {
    if (autoPlayTimerRef.current !== null) {
      window.clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    voiceEngine.stop();
    setIsPlaying(false);
    setMouthOpen(0);
    setIsPreviewingVoice(false);
    setPreviewMouthOpen(0);
  }, []);

  const activeStepProgress = useMemo(() => {
    const total = Math.max(1, activeStepBeats.length);
    return Math.max(0, Math.min(1, (activeBeatIndex + beatProgress) / total));
  }, [activeBeatIndex, beatProgress, activeStepBeats.length]);

  const speakBeatsList = useCallback(
    (
      beats: LessonBeat[],
      mutedOverride?: boolean,
      startBeatIdx = 0,
      startBeatFrac = 0,
      settingsOverride?: VoiceSettings
    ) => {
      if (autoPlayTimerRef.current !== null) {
        window.clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      setIsPreviewingVoice(false);
      setPreviewMouthOpen(0);
      const sentences = beats.map((b) => b.sentence).filter(Boolean);
      if (sentences.length === 0) return;
      const mutedNow = mutedOverride ?? isMuted;
      const clampedIdx = Math.max(0, Math.min(sentences.length - 1, startBeatIdx));
      const clampedFrac = Math.max(0, Math.min(0.95, startBeatFrac));
      const activeVoiceSettings = settingsOverride ?? voiceSettingsRef.current;
      voiceEngine.speakBeats(
        sentences,
        {
          onStart: () => {
            setIsPlaying(true);
            setActiveBeatIndex(clampedIdx);
            setBeatProgress(clampedFrac);
          },
          onBeatStart: (idx) => {
            setActiveBeatIndex(idx);
            setBeatProgress(idx === clampedIdx ? clampedFrac : 0);
          },
          onTick: (open, progress) => {
            setMouthOpen(mutedNow ? 0 : open);
            setBeatProgress(progress);
          },
          onEnd: () => {
            setBeatProgress(1);
            setMouthOpen(0);
            const currentIdx = activeStepIndexRef.current;
            const steps = lessonStepsRef.current;
            const nextIdx = currentIdx + 1;
            if (viewModeRef.current === 'lesson' && nextIdx < steps.length) {
              // Brief breath at 100% before auto-advancing to the next kesma
              autoPlayTimerRef.current = window.setTimeout(() => {
                autoPlayTimerRef.current = null;
                handleStepChangeRef.current(nextIdx, true);
              }, 650);
            } else {
              setIsPlaying(false);
            }
          },
        },
        activeVoiceSettings,
        mutedNow,
        clampedIdx,
        clampedFrac
      );
    },
    [isMuted]
  );

  const startVoicePreview = useCallback((settingsToSpeak: VoiceSettings) => {
    if (autoPlayTimerRef.current !== null) {
      window.clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    setIsPlaying(false);
    setMouthOpen(0);
    voiceEngine.unlockAudio();

    voiceEngine.speak(
      'Salom! Men Mirvo Ustozman. Mavzuni doskaga chizib, ovoz chiqarib tushuntirib beraman.',
      {
        onStart: () => {
          setIsPreviewingVoice(true);
          setPreviewMouthOpen(0.25);
        },
        onTick: (open) => {
          setPreviewMouthOpen(open);
        },
        onEnd: () => {
          setIsPreviewingVoice(false);
          setPreviewMouthOpen(0);
        },
      },
      true,
      settingsToSpeak
    );
  }, []);

  const triggerSliderPreview = useCallback((target: 'rate' | 'pitch') => {
    setSliderPreviewTarget(target);
    if (sliderPreviewTimerRef.current !== null) {
      window.clearTimeout(sliderPreviewTimerRef.current);
    }
    sliderPreviewTimerRef.current = window.setTimeout(() => {
      sliderPreviewTimerRef.current = null;
      setSliderPreviewTarget(null);
    }, 1500);
  }, []);

  const updateVoiceSettings = useCallback(
    (patch: Partial<VoiceSettings>, applyLiveNow = false) => {
      const next = saveVoiceSettings({
        ...voiceSettingsRef.current,
        ...patch,
      });
      voiceSettingsRef.current = next;
      setVoiceSettings(next);

      if (!applyLiveNow) return;
      if (isPreviewingVoice) {
        startVoicePreview(next);
      } else if (isPlaying && !isMuted && activeStepBeats.length > 0) {
        speakBeatsList(activeStepBeats, undefined, activeBeatIndex, beatProgress, next);
      }
    },
    [
      isPreviewingVoice,
      startVoicePreview,
      isPlaying,
      isMuted,
      activeStepBeats,
      activeBeatIndex,
      beatProgress,
      speakBeatsList,
    ]
  );

  const applyPendingVoiceSettings = useCallback(() => {
    if (isPreviewingVoice) {
      startVoicePreview(voiceSettingsRef.current);
    } else if (isPlaying && !isMuted && activeStepBeats.length > 0) {
      speakBeatsList(
        activeStepBeats,
        undefined,
        activeBeatIndex,
        beatProgress,
        voiceSettingsRef.current
      );
    }
  }, [
    isPreviewingVoice,
    startVoicePreview,
    isPlaying,
    isMuted,
    activeStepBeats,
    activeBeatIndex,
    beatProgress,
    speakBeatsList,
  ]);

  const handleToggleVoicePreview = useCallback(() => {
    if (isPreviewingVoice) {
      voiceEngine.stop();
      setIsPreviewingVoice(false);
      setPreviewMouthOpen(0);
      return;
    }
    startVoicePreview(voiceSettingsRef.current);
  }, [isPreviewingVoice, startVoicePreview]);

  const loadLesson = useCallback(
    (nextLesson: TutorLesson, autoPlay = true) => {
      stopPlayback();
      activeStepIndexRef.current = 0;
      lessonStepsRef.current = nextLesson.steps;
      viewModeRef.current = 'lesson';
      setActiveBeatIndex(0);
      setBeatProgress(0);
      setStageAnchors({});
      setLesson(nextLesson);
      setActiveStepIndex(0);
      setSliderValues(buildDefaultSliders(nextLesson));
      setCameraOverride(nextLesson.steps[0]?.camera);
      setAutoRotate3D(false);
      setQuizAnswers({});
      setQuizFeedback(null);
      setErrorMsg(null);
      setDrawerOpen(false);
      setViewMode('lesson');

      if (autoPlay && nextLesson.steps[0]) {
        voiceEngine.unlockAudio();
        const firstBeats = resolveStepBeats(
          nextLesson.steps[0],
          nextLesson.engine,
          0,
          nextLesson.steps.length
        );
        autoPlayTimerRef.current = window.setTimeout(() => {
          speakBeatsList(firstBeats);
        }, 120);
      }
    },
    [stopPlayback, speakBeatsList]
  );

  const handleStepChange = useCallback(
    (nextIndex: number, autoPlay = true) => {
      if (nextIndex < 0 || nextIndex >= lesson.steps.length) return;
      stopPlayback();
      activeStepIndexRef.current = nextIndex;
      setActiveBeatIndex(0);
      setBeatProgress(0);
      setActiveStepIndex(nextIndex);
      const step = lesson.steps[nextIndex];
      if (step?.camera) {
        setCameraOverride([...step.camera]);
      }
      if (autoPlay && step) {
        const beats = resolveStepBeats(step, lesson.engine, nextIndex, lesson.steps.length);
        autoPlayTimerRef.current = window.setTimeout(() => {
          speakBeatsList(beats);
        }, 90);
      }
    },
    [lesson.steps, lesson.engine, stopPlayback, speakBeatsList]
  );

  useEffect(() => {
    handleStepChangeRef.current = handleStepChange;
  }, [handleStepChange]);

  const saveLessonToCache = useCallback(
    (q: string, nextLesson?: TutorLesson) => {
      const cleanQ = (q || nextLesson?.topic_title || '').trim();
      if (!cleanQ) return;

      setHistory((prev) => {
        const next = [cleanQ, ...prev.filter((item) => item !== cleanQ)].slice(0, 8);
        saveLegacyHistory(next);
        return next;
      });

      if (nextLesson) {
        setSavedLessons((prev) => saveLessonEntry(prev, cleanQ, nextLesson));
      }
    },
    []
  );

  const mergedSavedLessons = useMemo(
    () => [...savedLessons].sort((a, b) => b.savedAt - a.savedAt),
    [savedLessons]
  );

  const legacyOnlyHistory = useMemo(() => {
    const savedKeys = new Set<string>();
    for (const entry of mergedSavedLessons) {
      savedKeys.add(entry.key);
      savedKeys.add(normalizeLessonKey(entry.lesson.topic_title));
    }
    return history.filter((item) => !savedKeys.has(normalizeLessonKey(item)));
  }, [mergedSavedLessons, history]);

  const totalHistoryCount = mergedSavedLessons.length + legacyOnlyHistory.length;

  const resolveQuery = async (rawQuery: string, withImage = imagePreview) => {
    const q = rawQuery.trim();
    if (!q && !withImage) {
      setErrorMsg("Savol yozing, mikrofon orqali ayting yoki masala rasmini yuklang.");
      return;
    }

    setErrorMsg(null);

    if (!withImage && q) {
      const localLesson =
        depthMode === 'overview' ? tryLocalDeterministicParse(q) : null;
      if (localLesson) {
        const freeLesson = { ...localLesson, token_usage: ZERO_TOKEN_USAGE };
        setDailyLessonCount(saveDailyLessonCreation().count);
        setSessionTokenStats((prev) => recordSessionTokenStats(prev, ZERO_TOKEN_USAGE));
        saveLessonToCache(q, freeLesson);
        setQueryText('');
        loadLesson(freeLesson, true);
        return;
      }

      const builtInLesson = findBuiltInCachedLesson(q);
      if (builtInLesson) {
        const freeLesson = { ...builtInLesson, source: 'cache' as const, token_usage: ZERO_TOKEN_USAGE };
        setSessionTokenStats((prev) => recordSessionTokenStats(prev, ZERO_TOKEN_USAGE));
        saveLessonToCache(q, freeLesson);
        setQueryText('');
        loadLesson(freeLesson, true);
        return;
      }

      const cachedSaved = findSavedLesson(mergedSavedLessons, q);
      if (cachedSaved) {
        const freeLesson = { ...cachedSaved, token_usage: ZERO_TOKEN_USAGE };
        setSessionTokenStats((prev) => recordSessionTokenStats(prev, ZERO_TOKEN_USAGE));
        saveLessonToCache(q, freeLesson);
        setQueryText('');
        loadLesson(freeLesson, true);
        return;
      }
    }

    setIsLoading(true);
    setViewMode('lesson');
    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          imageBase64: withImage?.base64,
          imageMimeType: withImage?.mimeType,
          depthMode,
        }),
      });

      const payload = (await res.json()) as Partial<ResolveResponse> & { error?: string };
      if (!res.ok || !payload.lesson) {
        throw new Error(payload.error || "Savolni tahlil qilib bo'lmadi.");
      }

      const usage = payload.token_usage ?? payload.lesson.token_usage ?? ZERO_TOKEN_USAGE;
      const lessonWithUsage = { ...payload.lesson, token_usage: usage };
      if (
        payload.stage === 'gemini-director' ||
        payload.stage === 'qwen-director' ||
        payload.stage === 'local-parser'
      ) {
        setDailyLessonCount(saveDailyLessonCreation().count);
      }
      setSessionTokenStats((prev) => recordSessionTokenStats(prev, usage));
      saveLessonToCache(q || payload.lesson.topic_title, lessonWithUsage);
      setQueryText('');
      setImagePreview(null);
      loadLesson(lessonWithUsage, true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Server bilan bog'lanishda xatolik yuz berdi."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isObjectLesson = useMemo(
    () =>
      lesson.steps.some(
        (s) =>
          s.render_params?.kind === 'illustration' ||
          s.render_params?.shape === 'composite3d' ||
          s.render_params?.shape === 'svg_extrude' ||
          Boolean(s.render_params?.svg_data)
      ),
    [lesson.steps]
  );

  const handleSwitchObjectDimension = useCallback(
    async (targetMode: '2d' | '3d') => {
      if (targetMode === '3d' && lesson.engine === 'threejs') return;
      if (targetMode === '2d' && lesson.engine === 'svg2d') return;

      const sampleStep =
        lesson.steps.find((s) => s.render_params?.svg_data || s.render_params?.object_name_en) ||
        lesson.steps[0];
      const fallbackName =
        sampleStep?.render_params?.object_name_en ||
        sampleStep?.render_params?.object_name_uz ||
        lesson.topic_title;

      let fetchedSvgData: string | undefined;
      let fetchedViewBox: string | undefined;
      let fetchedPrimitives = sampleStep?.render_params?.primitives_3d;

      if (targetMode === '2d' && !sampleStep?.render_params?.svg_data && fallbackName) {
        try {
          const res = await fetch('/api/objects/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: fallbackName, mode: '2d' }),
          });
          if (res.ok) {
            const data = (await res.json()) as {
              object?: { svg_data?: string; viewBox?: string; primitives_3d?: typeof fetchedPrimitives };
            };
            fetchedSvgData = data.object?.svg_data;
            fetchedViewBox = data.object?.viewBox;
            if (!fetchedPrimitives && data.object?.primitives_3d) {
              fetchedPrimitives = data.object.primitives_3d;
            }
          }
        } catch {
          // Graceful fallback if offline
        }
      }

      const nextSteps = lesson.steps.map((step) => {
        const rp = step.render_params || {};
        const nameEn = rp.object_name_en || fallbackName || 'object';
        const svgData = rp.svg_data || fetchedSvgData;
        const svgViewBox = rp.svg_viewbox || fetchedViewBox;
        const prims = rp.primitives_3d || fetchedPrimitives || generateProceduralPrimitives3D(nameEn);

        if (targetMode === '3d') {
          return {
            ...step,
            render_params: {
              ...rp,
              shape: prims && prims.length > 0 ? ('composite3d' as const) : ('svg_extrude' as const),
              svg_data: svgData,
              svg_viewbox: svgViewBox,
              primitives_3d: prims,
              object_name_en: nameEn,
              object_name_uz: rp.object_name_uz || lesson.topic_title,
            },
          };
        }

        return {
          ...step,
          render_params: {
            ...rp,
            kind: 'illustration' as const,
            svg_data: svgData,
            svg_viewbox: svgViewBox,
            primitives_3d: prims,
            object_name_en: nameEn,
            object_name_uz: rp.object_name_uz || lesson.topic_title,
          },
        };
      });

      const hasScaleSlider = (lesson.sliders || []).some((s) => s.id === 'scale');
      const nextSliders =
        targetMode === '3d' && !hasScaleSlider
          ? [
              ...(lesson.sliders || []),
              {
                id: 'scale',
                label: 'Masshtab',
                min: 0.6,
                max: 1.6,
                step: 0.05,
                default: 1.0,
              },
            ]
          : lesson.sliders || [];

      const nextLesson: TutorLesson = {
        ...lesson,
        engine: targetMode === '3d' ? 'threejs' : 'svg2d',
        sliders: nextSliders,
        steps: nextSteps,
      };

      setStageAnchors({});
      setLesson(nextLesson);
      lessonStepsRef.current = nextLesson.steps;
      if (targetMode === '3d' && sliderValues.scale === undefined) {
        setSliderValues((prev) => ({ ...prev, scale: 1.0 }));
      }
      if (targetMode === '3d') {
        setCameraOverride([0.2, 4.2, 11.5]);
      }
    },
    [lesson, sliderValues.scale]
  );

  const handleStarterCard = (cardId: string) => {
    const found = CACHED_LESSONS.find((l) => l.id === cardId);
    if (found) {
      const cached = { ...found, source: 'cache' as const };
      loadLesson(cached, true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inputRef.current?.blur();
    setIsMobileTyping(false);
    resolveQuery(queryText);
  };

  const handleToggleMic = () => {
    if (isListening) {
      sttSessionRef.current?.stop();
      setIsListening(false);
      return;
    }
    setErrorMsg(null);
    setIsListening(true);
    sttSessionRef.current = startUzbekSpeechRecognition({
      onResult: (transcript, isFinal) => {
        setQueryText(transcript);
        if (isFinal && transcript) {
          setIsListening(false);
          resolveQuery(transcript);
        }
      },
      onError: (msg) => {
        setErrorMsg(msg);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.split(',')[1] || '';
      setImagePreview({
        dataUrl,
        base64,
        mimeType: file.type || 'image/jpeg',
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const computeBeatFromRatio = useCallback(
    (ratio: number) => {
      const total = Math.max(1, activeStepBeats.length);
      const clamped = Math.max(0, Math.min(0.995, ratio));
      const scaled = clamped * total;
      const beatIdx = Math.min(total - 1, Math.floor(scaled));
      const beatFrac = Math.max(0, Math.min(0.95, scaled - beatIdx));
      return { beatIdx, beatFrac };
    },
    [activeStepBeats.length]
  );

  const handleTogglePlay = () => {
    voiceEngine.unlockAudio();
    if (isPlaying) {
      stopPlayback();
    } else if (activeStepBeats.length > 0) {
      const isAtEnd =
        activeBeatIndex >= activeStepBeats.length - 1 && beatProgress >= 0.98;
      if (isAtEnd) {
        setActiveBeatIndex(0);
        setBeatProgress(0);
        speakBeatsList(activeStepBeats, undefined, 0, 0);
      } else {
        speakBeatsList(activeStepBeats, undefined, activeBeatIndex, beatProgress);
      }
    }
  };

  const handleReplayStep = () => {
    voiceEngine.unlockAudio();
    if (activeStepBeats.length > 0) {
      setActiveBeatIndex(0);
      setBeatProgress(0);
      speakBeatsList(activeStepBeats, undefined, 0, 0);
    }
  };

  const handlePrevBeatOrStep = () => {
    if (activeBeatIndex > 0 || beatProgress > 0.25) {
      const targetBeat =
        beatProgress > 0.25 ? activeBeatIndex : Math.max(0, activeBeatIndex - 1);
      setActiveBeatIndex(targetBeat);
      setBeatProgress(0);
      if (isPlaying && activeStepBeats.length > 0) {
        speakBeatsList(activeStepBeats, undefined, targetBeat, 0);
      }
      return;
    }
    const prevStep = activeStepIndex > 0 ? activeStepIndex - 1 : lesson.steps.length - 1;
    handleStepChange(prevStep, true);
  };

  const handleNextBeatOrStep = () => {
    if (activeBeatIndex + 1 < activeStepBeats.length) {
      const targetBeat = activeBeatIndex + 1;
      setActiveBeatIndex(targetBeat);
      setBeatProgress(0);
      if (isPlaying && activeStepBeats.length > 0) {
        speakBeatsList(activeStepBeats, undefined, targetBeat, 0);
      }
      return;
    }
    const nextStep = activeStepIndex + 1 < lesson.steps.length ? activeStepIndex + 1 : 0;
    handleStepChange(nextStep, true);
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (isPlaying && activeStepBeats.length > 0) {
      speakBeatsList(activeStepBeats, nextMuted, activeBeatIndex, beatProgress);
    }
  };

  const handleSelectQuizOption = useCallback(
    (optIdx: number, isCorrectOption: boolean) => {
      setQuizAnswers((prev) => ({ ...prev, [activeStepIndex]: optIdx }));
      setQuizFeedback((prev) => {
        const shouldReplaySameChoice =
          prev?.stepIndex === activeStepIndex &&
          ((!isCorrectOption && prev.shakingIdx === optIdx) ||
            (isCorrectOption && prev.shakingIdx === null && prev.pulsing));

        if (shouldReplaySameChoice) {
          requestAnimationFrame(() => {
            setQuizFeedback({
              stepIndex: activeStepIndex,
              shakingIdx: isCorrectOption ? null : optIdx,
              pulsing: true,
            });
          });
          return {
            stepIndex: activeStepIndex,
            shakingIdx: null,
            pulsing: false,
          };
        }

        return {
          stepIndex: activeStepIndex,
          shakingIdx: isCorrectOption ? null : optIdx,
          pulsing: true,
        };
      });
    },
    [activeStepIndex]
  );

  const selectedQuizChoice = quizAnswers[activeStepIndex];
  const activeQuiz = currentStep?.quiz;
  const cleanStepTitle = (title: string) => title.replace(/^\d+\.\s*/, '');

  const globalLessonProgress = useMemo(() => {
    const totalSteps = Math.max(1, lesson.steps.length);
    const isFinalStepQuizCorrect =
      activeStepIndex === totalSteps - 1 &&
      Boolean(activeQuiz) &&
      selectedQuizChoice !== undefined &&
      selectedQuizChoice === activeQuiz?.correct_index;
    const effectiveStepProgress = isFinalStepQuizCorrect ? 1 : activeStepProgress;
    return Math.max(0, Math.min(1, (activeStepIndex + effectiveStepProgress) / totalSteps));
  }, [lesson.steps.length, activeStepIndex, activeStepProgress, activeQuiz, selectedQuizChoice]);

  const globalLessonPercent = Math.round(globalLessonProgress * 100);
  const currentLessonUsage = lesson.token_usage ?? ZERO_TOKEN_USAGE;

  const isSpeakingNow = isPlaying && !isMuted;

  const activeDisplayError = errorMsg;
  const dismissDisplayError = () => {
    setErrorMsg(null);
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#F8FAFC] text-slate-900 overflow-hidden pt-[env(safe-area-inset-top)]">
      {/* Hidden shared file input for photo math uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {viewMode === 'home' ? (
        /* ==================== EYE-PLEASING DAYLIGHT HOME DISCOVERY SCREEN ==================== */
        <div className="flex-1 min-h-0 flex flex-col mirvo-home-bg overflow-y-auto academic-scroll">
          {/* Clean 3-Zone Top Bar */}
          <header className="h-14 sm:h-16 shrink-0 px-3 sm:px-8 flex items-center justify-between gap-2 sm:gap-8 max-w-6xl w-full mx-auto">
            {/* Zone 1: Brand Wordmark */}
            <MirvoLogo size="md" />

            {/* Zone 2: Clean Text Navigation Links */}
            <nav
              aria-label="Asosiy bo‘limlar"
              className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
            >
              <button
                type="button"
                onClick={() => {
                  setDrawerTab('library');
                  setDrawerOpen(true);
                }}
                className="hover:text-blue-600 transition-colors cursor-pointer whitespace-nowrap shrink-0 py-1 hover:underline underline-offset-4"
              >
                Darslar kutubxonasi
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrawerTab('history');
                  setDrawerOpen(true);
                }}
                className="hover:text-blue-600 transition-colors cursor-pointer whitespace-nowrap shrink-0 py-1 hover:underline underline-offset-4"
              >
                Saqlangan tarix ({totalHistoryCount})
              </button>
            </nav>

            {/* Mobile library trigger */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDrawerTab('settings');
                  setDrawerOpen(true);
                }}
                className="hidden md:inline-flex items-center text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors cursor-pointer whitespace-nowrap py-1"
              >
                Ovoz sozlamalari
              </button>
              <span
                aria-live="polite"
                aria-label={`Bugun: ${dailyLessonCount}/3 dars. Qurilmangizdagi mahalliy hisoblagich.`}
                title="Bugun yaratilgan darslar soni — faqat shu qurilmadagi hisoblagich"
                className="whitespace-nowrap rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 text-[10px] sm:text-xs font-semibold font-mono-tabular text-slate-600"
              >
                Bugun: {dailyLessonCount}/3 dars
              </span>
              <button
                type="button"
                onClick={() => {
                  setDrawerTab('settings');
                  setDrawerOpen(true);
                }}
                aria-label="Ovoz sozlamalari"
                className="md:hidden h-8 w-8 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:border-blue-400 text-slate-700 cursor-pointer shrink-0 shadow-xs"
              >
                <SlidersHorizontal className="w-4 h-4 text-slate-600" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrawerTab('library');
                  setDrawerOpen(true);
                }}
                aria-label="Kutubxona"
                className="md:hidden h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:border-blue-400 text-slate-700 cursor-pointer shrink-0 shadow-xs"
              >
                <BookOpen className="w-4 h-4 text-blue-600" />
              </button>
            </div>
          </header>

          {/* Centered Daylight Studio Hero & Workspace */}
          <main className="flex-1 flex flex-col items-center justify-start sm:justify-center px-3 sm:px-6 pt-3 sm:pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] max-w-5xl w-full mx-auto">
            {/* Mascot + Welcoming Headline */}
            <div className="flex flex-col items-center text-center max-w-2xl">
              <div className="mb-3 sm:mb-4 transition-transform duration-300 hover:scale-105">
                <MirvoMentor
                  isSpeaking={false}
                  size={94}
                  depth="mid"
                />
              </div>

              <h1
                className="text-[clamp(1.85rem,3.6vw,2.75rem)] font-bold tracking-tight text-slate-900 leading-[1.14]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Murakkab mavzularni ko‘rib tushuning
              </h1>
              <p className="mt-2.5 text-sm sm:text-base text-slate-600 max-w-xl leading-relaxed">
                Savol yozing, masala rasmini yuklang yoki ovozda so‘rang — Mirvo Ustoz doskada qadamma-qadam chizib, jonlantirib tushuntiradi.
              </p>
            </div>

            {/* Tactile Prompt Composer */}
            <div className="mt-6 sm:mt-7 w-full max-w-2xl space-y-2.5">
              {activeDisplayError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 flex items-center justify-between gap-2">
                  <span>{activeDisplayError}</span>
                  <button
                    type="button"
                    onClick={dismissDisplayError}
                    className="p-0.5 text-rose-500 hover:text-rose-800 cursor-pointer shrink-0"
                    aria-label="Xatoni yopish"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {imagePreview && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={imagePreview.dataUrl}
                      alt="Yuklangan masala rasmi"
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 object-cover rounded-lg border border-slate-200 shrink-0"
                    />
                    <span className="text-xs font-medium text-slate-700 truncate">
                      {imagePreview.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImagePreview(null)}
                    className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                    aria-label="Rasmni olib tashlash"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="bg-white border border-slate-200/95 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 rounded-2xl p-2.5 shadow-md shadow-blue-950/[0.04] flex flex-col gap-2 transition-all"
              >
                <div className="flex items-center gap-2 px-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    placeholder="Masalan: transformator qanday ishlaydi yoki y = x² grafigi..."
                    className="flex-1 min-w-0 h-11 bg-transparent text-[16px] sm:text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1.5 px-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Masala rasmini yuklash"
                      aria-label="Masala rasmini yuklash"
                      className="h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Rasm</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleMic}
                      title="Ovoz bilan savol berish"
                      aria-label="Ovoz bilan savol berish"
                      className={`h-9 px-3 rounded-xl border inline-flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        isListening
                          ? 'bg-rose-600 border-rose-600 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      <span>{isListening ? 'Eshitmoqda...' : 'Ovoz'}</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    aria-label="Savolni yuborish"
                    className="h-10 px-5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Tushuntirish</span>
                        <ArrowUp className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="space-y-1.5 pt-1">
                <span className="block text-[10px] font-semibold text-slate-500">
                  Dars chuqurligi
                </span>
                <div
                  role="group"
                  aria-label="Dars chuqurligini tanlash"
                  className="grid grid-cols-3 gap-1.5"
                >
                  {LESSON_DEPTH_OPTIONS.map((option) => {
                    const selected = depthMode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        title={option.shortDesc}
                        onClick={() => setDepthMode(option.id)}
                        className={`min-h-10 rounded-xl border px-1.5 py-1 text-[10px] sm:text-xs font-semibold leading-tight transition-colors cursor-pointer ${
                          selected
                            ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500/20'
                            : 'border-slate-200 bg-white/90 text-slate-600 hover:border-blue-300 hover:text-blue-700'
                        }`}
                      >
                        {option.label} {option.rangeLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Topic Launchers */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
                <span className="text-slate-400 font-medium">Tez tanlov:</span>
                {QUICK_VISUAL_TOPICS.map((topic) => (
                  <button
                    key={topic.query}
                    type="button"
                    onClick={() => resolveQuery(topic.query, null)}
                    className="px-3 py-1 rounded-lg bg-white/90 border border-slate-200 hover:border-blue-400 hover:text-blue-700 text-slate-700 font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {topic.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4-Column Interactive Showcase Grid */}
            <div className="mt-7 sm:mt-8 w-full grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {HOME_STARTER_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleStarterCard(card.id)}
                    className="group text-left bg-white border border-slate-200/90 hover:border-blue-400 rounded-2xl p-3 sm:p-4 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 min-h-[120px] sm:min-h-[128px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`w-9 h-9 rounded-xl ${card.iconBg} ${card.iconColor} flex items-center justify-center shrink-0`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-medium text-slate-400 group-hover:text-blue-600 transition-colors">
                        {card.subjectLabel}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[13px] sm:text-sm font-bold text-slate-900 group-hover:text-blue-700 leading-snug transition-colors">
                        {card.title}
                      </div>
                      <div className="hidden sm:block text-xs text-slate-500 leading-snug line-clamp-2">
                        {card.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Local lesson storage + token cost metadata */}
            <div className="mt-6 w-full max-w-2xl flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-slate-500 text-center">
              <span className="font-medium text-slate-600">
                Darslar ushbu qurilmada saqlanadi
              </span>

              <span className="hidden sm:inline text-slate-300" aria-hidden="true">
                ·
              </span>

              <button
                type="button"
                onClick={() => {
                  setDrawerTab('settings');
                  setDrawerOpen(true);
                }}
                className="inline-flex items-center gap-1.5 font-mono-tabular text-[11px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>
                  Sessiya sarfi: {formatTokenCount(sessionTokenStats.total_tokens)} tok ·{' '}
                  <strong className="text-slate-700 font-semibold">
                    {formatCostUsd(sessionTokenStats.cost_usd)}
                  </strong>
                </span>
              </button>
            </div>
          </main>
        </div>
      ) : (
        /* ==================== INTERACTIVE WHITEBOARD LESSON VIEW ==================== */
        <>
          {/* Global Lesson Completion Progress Bar at the very top edge */}
          <div
            role="progressbar"
            aria-label="Umumiy dars bajarilishi"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={globalLessonPercent}
            className="h-1 w-full shrink-0 bg-slate-200/80 overflow-hidden z-30"
          >
            <div
              className={`h-full w-full origin-left transition-[transform,background-color] duration-200 ease-out will-change-transform ${
                globalLessonPercent >= 100
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-amber-500'
              }`}
              style={{ transform: `scaleX(${globalLessonProgress})` }}
            />
          </div>

          {/* Slim Top Header */}
          <header className="h-12 shrink-0 bg-white border-b border-slate-200/90 px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-3 z-20">
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  stopPlayback();
                  setViewMode('home');
                }}
                aria-label="Bosh sahifaga qaytish"
                className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  stopPlayback();
                  setViewMode('home');
                }}
                className="hidden md:inline-flex items-center cursor-pointer"
                aria-label="Mirvo AI bosh sahifa"
              >
                <MirvoLogo size="sm" />
              </button>
            </div>

            <div className="min-w-0 flex-1 text-center">
              <div className="truncate text-xs sm:text-sm font-bold text-slate-900">
                {lesson.topic_title}
              </div>
              <div className="text-[11px] text-slate-500 font-mono-tabular leading-tight flex items-center justify-center gap-1 overflow-hidden whitespace-nowrap">
                <span>
                  {activeStepIndex + 1}-qadam / {lesson.steps.length}
                </span>
                <span className="hidden sm:inline">· {SUBJECT_LABELS_UZ[lesson.subject]}</span>
                <span
                  className={`font-semibold transition-colors ${
                    globalLessonPercent >= 100 ? 'text-emerald-600' : 'text-blue-600'
                  }`}
                >
                  · {globalLessonPercent}%
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerTab('settings');
                    setDrawerOpen(true);
                  }}
                  title={`Kirish: ${formatTokenCount(currentLessonUsage.prompt_tokens)} · Chiqish: ${formatTokenCount(currentLessonUsage.output_tokens)} · Jami sessiya: ${formatCostUsd(sessionTokenStats.cost_usd)}`}
                  className={`inline-flex items-center gap-1 rounded px-1 py-0.2 font-semibold transition-colors cursor-pointer shrink-0 ${
                    currentLessonUsage.total_tokens === 0
                      ? 'text-emerald-700 hover:bg-emerald-50'
                      : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <span>·</span>
                  <span>{formatTokenCount(currentLessonUsage.total_tokens)} tok</span>
                  <span>({formatCostUsd(currentLessonUsage.cost_usd)})</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDrawerTab('library');
                  setDrawerOpen(true);
                }}
                aria-label="Mavzular kutubxonasi"
                className="h-9 px-2.5 sm:px-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-400 text-xs font-semibold text-slate-700 transition-colors shrink-0 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">Kutubxona</span>
              </button>
            </div>
          </header>

          {/* Studio Main Body (Mobile: Whiteboard + 4 Kesma + Playback/Ask Dock; Desktop: Whiteboard Left + Outline/Quiz Right) */}
          <main className="flex-1 min-h-0 flex flex-col lg:flex-row max-w-[1600px] w-full mx-auto overflow-hidden">
            {/* LEFT / MAIN WHITEBOARD COLUMN */}
            <section
              aria-label="Interaktiv Chizma Doskasi"
              className="flex-1 min-h-0 flex flex-col lg:w-[64%] overflow-hidden"
            >
              {/* Warm Graph-Paper Whiteboard Canvas */}
              <div
                className={`relative flex-1 min-h-0 overflow-hidden studio-dot-grid ${
                  isMobileTyping ? 'hidden lg:block' : 'block'
                }`}
              >
                {/* Clean Top-Left Formula Chip (only when step has KaTeX formula) */}
                {currentStep.katex_formulas && currentStep.katex_formulas.length > 0 && (
                  <div
                    className={`pointer-events-none absolute top-2.5 left-2.5 sm:top-3.5 sm:left-3.5 z-10 bg-white/92 backdrop-blur-xs border border-[#E5DEC9] rounded-xl px-2.5 py-1 shadow-xs overflow-hidden ${
                      isObjectLesson || lesson.engine === 'threejs'
                        ? 'max-w-[44%] sm:max-w-[54%]'
                        : 'max-w-[68%]'
                    }`}
                  >
                    <KaTeXBlock
                      latex={currentStep.katex_formulas[0]}
                      displayMode={false}
                      className="text-xs sm:text-sm font-semibold text-slate-900"
                    />
                  </div>
                )}

                {/* Compact Top-Right 2D/3D Object Switcher & 3D Camera Controls */}
                {(isObjectLesson || lesson.engine === 'threejs') && (
                  <div className="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 z-20 flex items-center gap-1.5 max-w-[52%] sm:max-w-none overflow-x-auto no-scrollbar">
                    {isObjectLesson && (
                      <div
                        role="group"
                        aria-label="Tasvir o'lchami"
                        className="flex items-center gap-0.5 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-0.5 shadow-xs shrink-0"
                      >
                        <button
                          type="button"
                          onClick={() => void handleSwitchObjectDimension('2d')}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            lesson.engine === 'svg2d'
                              ? 'bg-[#2563EB] text-white shadow-xs'
                              : 'text-slate-700 hover:text-blue-700 hover:bg-blue-50/60'
                          }`}
                        >
                          <Layers className="w-3 h-3" />
                          <span>2D</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSwitchObjectDimension('3d')}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            lesson.engine === 'threejs'
                              ? 'bg-[#2563EB] text-white shadow-xs'
                              : 'text-slate-700 hover:text-blue-700 hover:bg-blue-50/60'
                          }`}
                        >
                          <Box className="w-3 h-3" />
                          <span>3D</span>
                        </button>
                      </div>
                    )}

                    {lesson.engine === 'threejs' && (
                      <div className="flex items-center gap-0.5 sm:gap-1 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-0.5 shadow-xs shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setAutoRotate3D(false);
                            setCameraOverride([0.2, 4.2, 11.5]);
                          }}
                          className="hidden sm:inline-flex px-2 py-1 text-[11px] font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50/60 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Oldindan
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAutoRotate3D(false);
                            setCameraOverride([0.1, 13.5, 0.5]);
                          }}
                          className="hidden sm:inline-flex px-2 py-1 text-[11px] font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50/60 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Yuqoridan
                        </button>
                        <button
                          type="button"
                          onClick={() => setAutoRotate3D((v) => !v)}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            autoRotate3D
                              ? 'bg-[#2563EB] text-white shadow-xs'
                              : 'text-slate-700 hover:text-blue-700 hover:bg-blue-50/60'
                          }`}
                        >
                          <RotateCw className={`w-3 h-3 ${autoRotate3D ? 'animate-spin' : ''}`} />
                          <span>360°</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Interactive Animated Visual Engine */}
                <VisualStage
                  engine={lesson.engine}
                  params={currentStep.render_params}
                  sliderValues={sliderValues}
                  cameraPreset={cameraOverride}
                  autoRotate={autoRotate3D}
                  focusTarget={activeBeat.focus_target}
                  focusPart={activeBeat.focusPart}
                  dimInactiveParts={activeBeat.dimInactiveParts}
                  cameraZoom={activeBeat.cameraZoom ?? activeBeat.camera_zoom}
                  flowType={activeBeat.flowType}
                  flowSpeed={activeBeat.flowSpeed}
                  flowReverse={activeBeat.flowReverse}
                  stepIndex={activeStepIndex}
                  beatIndex={activeBeatIndex}
                  beatProgress={beatProgress}
                  totalBeats={activeStepBeats.length}
                  isPlaying={isPlaying}
                  onAnchorsChange={setStageAnchors}
                />

                {/* Single Living Mirvo Mascot Moving & Drawing Across the Board */}
                <TeacherStageActor
                  activeBeat={activeBeat}
                  anchors={stageAnchors}
                  isSpeaking={isSpeakingNow}
                  isPlaying={isPlaying}
                  isListening={isListening}
                  mouthOpen={mouthOpen}
                />

                {/* Live Synchronized Subtitle Caption Pill */}
                <div className="pointer-events-none absolute bottom-2.5 left-3 right-3 z-20 flex justify-center">
                  <div className="bg-slate-900/92 text-white border border-blue-400/25 backdrop-blur-sm rounded-2xl px-3.5 py-2 text-xs sm:text-[13px] font-medium leading-snug text-center shadow-lg max-w-xl">
                    {activeBeat?.sentence || currentStep.explanation_uz}
                  </div>
                </div>

                {/* AI Generation Loading Overlay */}
                {isLoading && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#F8FAFC]/85 backdrop-blur-[2px] p-4">
                    <div className="inline-flex items-center gap-2.5 rounded-2xl border border-blue-200 bg-white px-4 py-3 shadow-md text-xs sm:text-sm font-semibold text-slate-800">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                      <span>Mirvo AI chizma va dars tuzmoqda...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Step 4 Interactive Mini-Quiz Compact Card (only shown when step has quiz) */}
              {!isMobileTyping && activeQuiz && activeQuiz.options && activeQuiz.options.length > 0 && (
                <div className="lg:hidden shrink-0 border-t border-violet-200 bg-violet-50/75 px-3 py-2 space-y-1.5 max-h-[34dvh] overflow-y-auto">
                  <p className="text-xs font-bold text-slate-900 leading-snug">
                    {activeQuiz.question}
                  </p>
                  <div className="grid grid-cols-1 gap-1">
                    {activeQuiz.options.slice(0, 3).map((opt, optIdx) => {
                      const isPicked = selectedQuizChoice === optIdx;
                      const isAnswered = selectedQuizChoice !== undefined;
                      const isCorrect = optIdx === activeQuiz.correct_index;
                      const isStepFeedbackActive = quizFeedback?.stepIndex === activeStepIndex;
                      const shouldShake =
                        isAnswered &&
                        isPicked &&
                        !isCorrect &&
                        (!isStepFeedbackActive || quizFeedback?.shakingIdx === optIdx);
                      const shouldPulse =
                        isAnswered &&
                        isCorrect &&
                        (!isStepFeedbackActive || Boolean(quizFeedback?.pulsing));

                      let btnStyle =
                        'border-slate-200 bg-white text-slate-700 hover:border-blue-400';
                      if (isAnswered) {
                        if (isCorrect) {
                          btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold';
                        } else if (isPicked) {
                          btnStyle = 'border-rose-400 bg-rose-50 text-rose-900';
                        } else {
                          btnStyle = 'border-slate-200 bg-white/70 text-slate-400';
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectQuizOption(optIdx, isCorrect)}
                          className={`w-full min-h-[36px] text-left px-2.5 py-1 rounded-xl border text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${btnStyle} ${
                            shouldShake ? 'animate-quiz-shake' : ''
                          } ${shouldPulse ? 'animate-quiz-pulse' : ''}`}
                        >
                          <span>
                            <strong className="mr-1.5 font-mono-tabular">
                              {String.fromCharCode(65 + optIdx)}.
                            </strong>
                            {opt}
                          </span>
                          {isAnswered && isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          {isAnswered && isPicked && !isCorrect && (
                            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {selectedQuizChoice !== undefined && (
                    <div
                      className={`text-[11px] rounded-lg px-2.5 py-1 ${
                        selectedQuizChoice === activeQuiz.correct_index
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-amber-50 text-amber-900 border border-amber-200'
                      }`}
                    >
                      {selectedQuizChoice === activeQuiz.correct_index
                        ? `To‘g‘ri! ${activeQuiz.explanation_uz}`
                        : `Izoh: ${activeQuiz.explanation_uz}`}
                    </div>
                  )}
                </div>
              )}

              {/* 4 TA KESMA DIRECTLY BENEATH THE WHITEBOARD (Live GPU Fill + Scrubbing) */}
              {!isMobileTyping && (
                <nav
                  aria-label="4 ta dars kesmasi"
                  className="shrink-0 border-t border-slate-200/80 bg-white px-2.5 sm:px-4 py-1.5"
                >
                  <div className="flex items-stretch gap-1.5 sm:gap-2">
                    {lesson.steps.map((step, idx) => {
                      const isActive = idx === activeStepIndex;
                      const isDone = idx < activeStepIndex;
                      const stepPct = Math.round(activeStepProgress * 100);

                      const handleScrubRatio = (clientX: number, el: HTMLDivElement) => {
                        const rect = el.getBoundingClientRect();
                        if (rect.width <= 0) return { beatIdx: 0, beatFrac: 0 };
                        const ratio = (clientX - rect.left) / rect.width;
                        const { beatIdx, beatFrac } = computeBeatFromRatio(ratio);
                        setActiveBeatIndex(beatIdx);
                        setBeatProgress(beatFrac);
                        return { beatIdx, beatFrac };
                      };

                      return (
                        <div
                          key={step.step_number || idx}
                          className="flex-1 min-w-0 flex flex-col justify-center gap-0.5"
                        >
                          {isActive ? (
                            <div
                              role="slider"
                              tabIndex={0}
                              aria-label={`${idx + 1}-dars jarayoni`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={stepPct}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                e.currentTarget.setPointerCapture(e.pointerId);
                                const wasPlaying = isPlaying;
                                if (wasPlaying) stopPlayback();
                                const { beatIdx, beatFrac } = handleScrubRatio(
                                  e.clientX,
                                  e.currentTarget
                                );
                                scrubbingRef.current = {
                                  active: true,
                                  wasPlaying,
                                  lastBeatIdx: beatIdx,
                                  lastBeatFrac: beatFrac,
                                };
                              }}
                              onPointerMove={(e) => {
                                if (!scrubbingRef.current.active) return;
                                const { beatIdx, beatFrac } = handleScrubRatio(
                                  e.clientX,
                                  e.currentTarget
                                );
                                scrubbingRef.current.lastBeatIdx = beatIdx;
                                scrubbingRef.current.lastBeatFrac = beatFrac;
                              }}
                              onPointerUp={(e) => {
                                if (!scrubbingRef.current.active) return;
                                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                                  e.currentTarget.releasePointerCapture(e.pointerId);
                                }
                                const { wasPlaying, lastBeatIdx, lastBeatFrac } =
                                  scrubbingRef.current;
                                scrubbingRef.current.active = false;
                                if (wasPlaying && activeStepBeats.length > 0) {
                                  speakBeatsList(
                                    activeStepBeats,
                                    undefined,
                                    lastBeatIdx,
                                    lastBeatFrac
                                  );
                                }
                              }}
                              onPointerCancel={() => {
                                scrubbingRef.current.active = false;
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'ArrowLeft') {
                                  e.preventDefault();
                                  handlePrevBeatOrStep();
                                } else if (e.key === 'ArrowRight') {
                                  e.preventDefault();
                                  handleNextBeatOrStep();
                                }
                              }}
                              className="relative h-5 flex items-center touch-none cursor-ew-resize select-none focus:outline-none"
                            >
                              <div className="relative w-full h-2 rounded-full bg-slate-200/90 overflow-hidden">
                                <div
                                  className="absolute inset-0 rounded-full bg-[#2563EB] origin-left will-change-transform"
                                  style={{ transform: `scaleX(${activeStepProgress})` }}
                                />
                                {activeStepBeats.length > 1 &&
                                  activeStepBeats.slice(0, -1).map((_, tickIdx) => (
                                    <span
                                      key={tickIdx}
                                      className="pointer-events-none absolute top-0 bottom-0 w-[1.5px] bg-white/80"
                                      style={{
                                        left: `${((tickIdx + 1) / activeStepBeats.length) * 100}%`,
                                      }}
                                    />
                                  ))}
                              </div>
                              <span
                                className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#2563EB] border-2 border-white shadow-sm"
                                style={{
                                  left: `${Math.max(4, Math.min(96, activeStepProgress * 100))}%`,
                                }}
                              />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStepChange(idx, true)}
                              aria-label={`${idx + 1}. ${cleanStepTitle(step.step_title)}`}
                              className="h-5 flex items-center cursor-pointer group"
                            >
                              <span
                                className={`block w-full h-1.5 rounded-full transition-colors ${
                                  isDone
                                    ? 'bg-blue-300 group-hover:bg-blue-400'
                                    : 'bg-slate-200 group-hover:bg-slate-300'
                                }`}
                              />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleStepChange(idx, true)}
                            aria-current={isActive ? 'step' : undefined}
                            title={`${idx + 1}. ${cleanStepTitle(step.step_title)}`}
                            className="w-full min-w-0 text-center cursor-pointer group"
                          >
                            <span
                              className={`inline-flex items-center justify-center gap-1 max-w-full truncate text-[10px] sm:text-[11px] leading-tight transition-colors ${
                                isActive
                                  ? 'font-bold text-blue-700'
                                  : isDone
                                  ? 'font-medium text-slate-600'
                                  : 'font-medium text-slate-400 group-hover:text-slate-600'
                              }`}
                            >
                              <span className="sm:hidden truncate">{idx + 1}-dars</span>
                              <span className="hidden sm:inline truncate">
                                {idx + 1}. {cleanStepTitle(step.step_title)}
                              </span>
                              {isActive && (
                                <span className="font-mono-tabular text-[10px] text-blue-600/80 font-semibold shrink-0">
                                  {stepPct}%
                                </span>
                              )}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </nav>
              )}

              {/* SLEEK PLAYBACK DOCK + MOBILE FOLLOW-UP BAR */}
              <div className="shrink-0 border-t border-slate-200 bg-white px-3 pt-2 pb-[max(0.55rem,env(safe-area-inset-bottom))] space-y-2">
                {/* Media-Style Playback Controls */}
                {!isMobileTyping && (
                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={handlePrevBeatOrStep}
                      aria-label="Oldingi qism"
                      title="Orqaga"
                      className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleReplayStep}
                      aria-label="Qadamni qaytadan chizish"
                      title="Qayta ko‘rish"
                      className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleTogglePlay}
                      aria-label={isPlaying ? "To‘xtatish" : "O‘ynatish"}
                      className={`h-10 px-6 rounded-2xl font-semibold text-xs sm:text-sm text-white inline-flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer ${
                        isPlaying
                          ? 'bg-slate-900 hover:bg-slate-800'
                          : 'bg-[#2563EB] hover:bg-[#1D4ED8]'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-4 h-4 fill-current" />
                          <span>Pauza</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span>
                            {activeStepProgress > 0.02 && activeStepProgress < 0.98
                              ? 'Davom etish'
                              : 'Boshlash'}
                          </span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleMute}
                      aria-label={isMuted ? 'Ovozni yoqish' : "Ovozni o‘chirish"}
                      title={isMuted ? 'Ovozni yoqish' : "Ovozni o‘chirish"}
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                        isMuted
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={handleNextBeatOrStep}
                      aria-label="Keyingi qism"
                      title="Oldinga"
                      className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Mobile Error / Image Preview */}
                {errorMsg && (
                  <div className="lg:hidden rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800 flex items-center justify-between gap-2">
                    <span>{errorMsg}</span>
                    <button
                      type="button"
                      onClick={() => setErrorMsg(null)}
                      className="p-0.5 text-rose-500 hover:text-rose-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {imagePreview && (
                  <div className="lg:hidden flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={imagePreview.dataUrl}
                        alt="Yuklangan rasm"
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 object-cover rounded-lg border border-slate-200 shrink-0"
                      />
                      <span className="text-xs text-slate-700 truncate">{imagePreview.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImagePreview(null)}
                      className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Mobile Follow-Up Ask Bar */}
                <form onSubmit={handleSubmit} className="lg:hidden flex items-center gap-1.5">
                  <div className="flex-1 min-w-0 h-10 flex items-center rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-600 pl-3 pr-1 transition-colors">
                    <input
                      ref={inputRef}
                      type="text"
                      value={queryText}
                      onFocus={() => setIsMobileTyping(true)}
                      onBlur={() => {
                        window.setTimeout(() => setIsMobileTyping(false), 160);
                      }}
                      onChange={(e) => setQueryText(e.target.value)}
                      placeholder="Yana so‘rang..."
                      className="flex-1 min-w-0 bg-transparent text-[16px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Rasm yuklash"
                      className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleMic}
                    aria-label="Ovozli savol"
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      isListening
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading}
                    aria-label="Yuborish"
                    className="w-10 h-10 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white inline-flex items-center justify-center shrink-0 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </section>

            {/* DESKTOP RIGHT PANEL: Steps Outline, Formulas, Explanation & Quiz */}
            <aside
              aria-label="Dars tafsilotlari va savollar"
              className="hidden lg:flex lg:w-[36%] bg-white border-l border-slate-200 flex-col overflow-hidden"
            >
              <div className="flex-1 min-h-0 overflow-y-auto academic-scroll p-5 space-y-5">
                {/* Active Step Detail */}
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-blue-700">
                    {activeStepIndex + 1}-qadam · {lesson.steps.length} bosqichdan
                  </div>
                  <h2
                    className="text-lg font-bold text-slate-900 leading-snug"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {cleanStepTitle(currentStep.step_title)}
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {currentStep.explanation_uz}
                  </p>

                  {currentStep.katex_formulas && currentStep.katex_formulas.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {currentStep.katex_formulas.map((latex, i) => (
                        <div
                          key={i}
                          className="inline-flex items-center rounded-xl bg-blue-50/75 border border-blue-200/70 px-3 py-1.5"
                        >
                          <KaTeXBlock latex={latex} displayMode={false} className="text-sm text-slate-900" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step 4 Interactive Mini-Quiz */}
                {activeQuiz && activeQuiz.options && activeQuiz.options.length > 0 && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/45 p-4 space-y-2.5">
                    <p className="text-sm font-bold text-slate-900 leading-snug">
                      {activeQuiz.question}
                    </p>
                    <div className="space-y-1.5">
                      {activeQuiz.options.slice(0, 3).map((opt, optIdx) => {
                        const isPicked = selectedQuizChoice === optIdx;
                        const isAnswered = selectedQuizChoice !== undefined;
                        const isCorrect = optIdx === activeQuiz.correct_index;
                        const isStepFeedbackActive = quizFeedback?.stepIndex === activeStepIndex;
                        const shouldShake =
                          isAnswered &&
                          isPicked &&
                          !isCorrect &&
                          (!isStepFeedbackActive || quizFeedback?.shakingIdx === optIdx);
                        const shouldPulse =
                          isAnswered &&
                          isCorrect &&
                          (!isStepFeedbackActive || Boolean(quizFeedback?.pulsing));

                        let btnStyle =
                          'border-slate-200 bg-white text-slate-700 hover:border-blue-500';
                        if (isAnswered) {
                          if (isCorrect) {
                            btnStyle =
                              'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold';
                          } else if (isPicked) {
                            btnStyle = 'border-rose-400 bg-rose-50 text-rose-900';
                          } else {
                            btnStyle = 'border-slate-200 bg-white/70 text-slate-400';
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handleSelectQuizOption(optIdx, isCorrect)}
                            className={`w-full min-h-[42px] text-left px-3 py-2 rounded-xl border text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer ${btnStyle} ${
                              shouldShake ? 'animate-quiz-shake' : ''
                            } ${shouldPulse ? 'animate-quiz-pulse' : ''}`}
                          >
                            <span>
                              <strong className="mr-1.5 font-mono-tabular">
                                {String.fromCharCode(65 + optIdx)}.
                              </strong>
                              {opt}
                            </span>
                            {isAnswered && isCorrect && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                            {isAnswered && isPicked && !isCorrect && (
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {selectedQuizChoice !== undefined && (
                      <div
                        className={`text-xs rounded-xl px-3 py-2 ${
                          selectedQuizChoice === activeQuiz.correct_index
                            ? 'bg-emerald-100/80 text-emerald-900'
                            : 'bg-amber-50 text-amber-900 border border-amber-200'
                        }`}
                      >
                        {selectedQuizChoice === activeQuiz.correct_index
                          ? `To‘g‘ri! ${activeQuiz.explanation_uz}`
                          : `Izoh: ${activeQuiz.explanation_uz}`}
                      </div>
                    )}
                  </div>
                )}

                {/* 4-Step Outline List */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-500">Dars bosqichlari</div>
                  <div className="space-y-1.5">
                    {lesson.steps.map((step, idx) => {
                      const isActive = idx === activeStepIndex;
                      return (
                        <button
                          key={step.step_number || idx}
                          type="button"
                          onClick={() => handleStepChange(idx, true)}
                          className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors cursor-pointer ${
                            isActive
                              ? 'border-blue-600 bg-blue-50/60 text-slate-900'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <div className="text-xs font-bold text-slate-900">
                            {idx + 1}. {cleanStepTitle(step.step_title)}
                          </div>
                          <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {step.explanation_uz}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Token & Cost Summary Card in Desktop Sidebar */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                      <span>Token va xarajat</span>
                    </div>
                    <span
                      className={`text-[11px] font-mono-tabular font-semibold ${
                        currentLessonUsage.total_tokens === 0
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {formatCostUsd(currentLessonUsage.cost_usd)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-tabular">
                    <div className="rounded-xl bg-white border border-slate-200/80 px-2.5 py-1.5">
                      <div className="text-slate-400">Ushbu dars</div>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        {formatTokenCount(currentLessonUsage.total_tokens)} tok
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {formatCostUzsApprox(currentLessonUsage.cost_usd)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200/80 px-2.5 py-1.5">
                      <div className="text-slate-400">Jami sessiya</div>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        {formatTokenCount(sessionTokenStats.total_tokens)} tok
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {formatCostUsd(sessionTokenStats.cost_usd)} ({formatCostUzsApprox(sessionTokenStats.cost_usd)})
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop Bottom Follow-Up Ask Bar */}
              <div className="shrink-0 border-t border-slate-200 bg-white p-4 space-y-2">
                {errorMsg && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-800 flex items-center justify-between gap-2">
                    <span>{errorMsg}</span>
                    <button
                      type="button"
                      onClick={() => setErrorMsg(null)}
                      className="text-rose-500 hover:text-rose-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {imagePreview && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={imagePreview.dataUrl}
                        alt="Yuklangan rasm"
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 object-cover rounded-lg border border-slate-200 shrink-0"
                      />
                      <span className="text-xs text-slate-700 truncate">{imagePreview.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImagePreview(null)}
                      className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 h-10 flex items-center rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-blue-600 pl-3 pr-1 transition-colors">
                    <input
                      type="text"
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      placeholder="Yana so‘rang..."
                      className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Rasm yuklash"
                      className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleMic}
                    aria-label="Ovoz bilan savol"
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      isListening
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading}
                    aria-label="Savolni yuborish"
                    className="w-10 h-10 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white inline-flex items-center justify-center shrink-0 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </aside>
          </main>
        </>
      )}

      {/* ==================== SLIDE-OVER LIBRARY, HISTORY & SETTINGS DRAWER ==================== */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-[1px] flex justify-end"
          onClick={() => {
            if (isPreviewingVoice) {
              voiceEngine.stop();
              setIsPreviewingVoice(false);
              setPreviewMouthOpen(0);
            }
            setDrawerOpen(false);
          }}
        >
          <aside
            className="w-[360px] max-w-[92vw] h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
            aria-label="Mirvo AI Menyusi"
          >
            <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {drawerTab === 'settings' ? (
                  <>
                    <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                    <span
                      className="text-sm font-bold text-slate-900 whitespace-nowrap"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      Ustoz sozlamalari
                    </span>
                  </>
                ) : (
                  <MirvoLogo size="sm" />
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isPreviewingVoice) {
                    voiceEngine.stop();
                    setIsPreviewingVoice(false);
                    setPreviewMouthOpen(0);
                  }
                  setDrawerOpen(false);
                }}
                className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                aria-label="Menyuni yopish"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Tab Filter: Library, History, Settings */}
            <div className="px-4 pt-3 shrink-0">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDrawerTab('library')}
                  className={`flex-1 min-h-[36px] px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    drawerTab === 'library'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Darslar
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('history')}
                  className={`flex-1 min-h-[36px] px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    drawerTab === 'history'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tarix ({totalHistoryCount})
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('settings')}
                  className={`flex-1 min-h-[36px] px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    drawerTab === 'settings'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sozlamalar
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto academic-scroll p-4 space-y-4">
              {drawerTab === 'library' ? (
                <>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-500">
                      Asosiy interaktiv darslar
                    </div>
                    {coreLessons.map((item, index) => {
                      const isActive = viewMode === 'lesson' && lesson.id === item.id;
                      return (
                        <button
                          key={item.id || item.topic_title}
                          type="button"
                          onClick={() => loadLesson({ ...item, source: 'cache' }, true)}
                          className={`w-full text-left rounded-xl border p-3 transition-all cursor-pointer ${
                            isActive
                              ? 'bg-blue-50/75 border-blue-500 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {index + 1}. {item.topic_title}
                            </span>
                            <span className="shrink-0 font-mono-tabular text-[11px] text-blue-600 font-semibold">
                              {item.steps.length} qadam
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {SUBJECT_LABELS_UZ[item.subject]} · {ENGINE_LABELS_UZ[item.engine]}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {extraLessons.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="text-xs font-semibold text-slate-500">
                        Qo‘shimcha fanlar
                      </div>
                      {extraLessons.map((item) => {
                        const isActive = viewMode === 'lesson' && lesson.id === item.id;
                        return (
                          <button
                            key={item.id || item.topic_title}
                            type="button"
                            onClick={() => loadLesson({ ...item, source: 'cache' }, true)}
                            className={`w-full text-left rounded-xl border p-2.5 transition-all cursor-pointer ${
                              isActive
                                ? 'bg-blue-50/75 border-blue-500'
                                : 'bg-white border-slate-200 hover:border-blue-400'
                            }`}
                          >
                            <div className="text-xs font-semibold text-slate-900">
                              {item.topic_title}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {SUBJECT_LABELS_UZ[item.subject]} · {item.steps.length} qadam
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : drawerTab === 'history' ? (
                totalHistoryCount > 0 ? (
                  <div className="space-y-2">
                    {mergedSavedLessons.map((entry) => {
                      const isActive =
                        viewMode === 'lesson' &&
                        normalizeLessonKey(lesson.topic_title) ===
                          normalizeLessonKey(entry.lesson.topic_title);
                      return (
                        <div
                          key={entry.key}
                          className={`group flex items-stretch rounded-xl border transition-colors ${
                            isActive
                              ? 'bg-blue-50/75 border-blue-500'
                              : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setDrawerOpen(false);
                              loadLesson({ ...entry.lesson, source: 'cache' }, true);
                            }}
                            className="flex-1 min-w-0 text-left px-3 py-2.5 cursor-pointer"
                          >
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {entry.lesson.topic_title}
                            </div>
                            {normalizeLessonKey(entry.query) !==
                              normalizeLessonKey(entry.lesson.topic_title) && (
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                “{entry.query}”
                              </div>
                            )}
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                              <span>{SUBJECT_LABELS_UZ[entry.lesson.subject]}</span>
                              <span>·</span>
                              <span className="font-mono-tabular text-blue-600 font-medium">
                                {entry.lesson.steps.length} qadam
                              </span>
                              <span>·</span>
                              <span className="text-emerald-700 font-medium">
                                Saqlangan
                              </span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSavedLessons((prev) => removeSavedLessonEntry(prev, entry.key));
                            }}
                            aria-label={`${entry.lesson.topic_title} darsini o‘chirish`}
                            title="O‘chirish"
                            className="px-2.5 text-slate-400 hover:text-rose-600 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}

                    {legacyOnlyHistory.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setDrawerOpen(false);
                          const matched = findBuiltInCachedLesson(item);
                          if (matched) {
                            setSessionTokenStats((prev) =>
                              recordSessionTokenStats(prev, ZERO_TOKEN_USAGE)
                            );
                            loadLesson({ ...matched, source: 'cache', token_usage: ZERO_TOKEN_USAGE }, true);
                          } else {
                            resolveQuery(item, null);
                          }
                        }}
                        className="w-full text-left rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-800 transition-colors cursor-pointer"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs text-slate-500">
                    Hozircha saqlangan savollar tarixi yo‘q. Istalgan mavzuni tanlang yoki savol bering!
                  </div>
                )
              ) : (
                <div className="space-y-6">
                  {/* Live Mirvo Mentor voice preview */}
                  <div className="pb-5 border-b border-slate-100 flex items-center gap-3.5">
                    <div className="shrink-0">
                      <MirvoMentor
                        isSpeaking={
                          isPreviewingVoice || sliderPreviewTarget !== null || isSpeakingNow
                        }
                        voiceActivity={
                          isPreviewingVoice
                            ? previewMouthOpen
                            : sliderPreviewTarget !== null
                            ? sliderPreviewMouthOpen
                            : isSpeakingNow
                            ? mouthOpen
                            : 0
                        }
                        speechRate={voiceSettings.rate}
                        speechPitch={voiceSettings.pitch}
                        tiltDeg={
                          sliderPreviewTarget === 'pitch'
                            ? (voiceSettings.pitch - 1.0) * -10
                            : 0
                        }
                        size={60}
                        depth="mid"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-bold text-slate-900">Mirvo Ustoz ovozi</div>
                        {(sliderPreviewTarget !== null || isPreviewingVoice) && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                            <span>
                              {isPreviewingVoice
                                ? 'Gapirmoqda'
                                : sliderPreviewTarget === 'rate'
                                ? 'Tezlik ko‘rinishi'
                                : 'Ohang ko‘rinishi'}
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono-tabular flex items-center gap-2">
                        <span>
                          {voiceSettings.rate.toFixed(2)}× · {voiceSettings.pitch.toFixed(2)} ton ·{' '}
                          {voiceSettings.gender === 'female'
                            ? 'Ayol'
                            : voiceSettings.gender === 'male'
                            ? 'Erkak'
                            : 'Avto'}
                        </span>
                        {(sliderPreviewTarget !== null || isPreviewingVoice) && (
                          <span className="inline-flex items-end gap-0.5 h-3" aria-hidden="true">
                            {[0.55, 1, 0.72, 0.9].map((factor, barIdx) => {
                              const activeMouth = isPreviewingVoice
                                ? previewMouthOpen
                                : sliderPreviewMouthOpen;
                              const barHeight = Math.max(
                                3,
                                Math.round((4 + activeMouth * 8 * factor) * (0.8 + (voiceSettings.pitch - 0.7) * 0.25))
                              );
                              return (
                                <span
                                  key={barIdx}
                                  className="w-[2.5px] rounded-full bg-blue-600 transition-[height] duration-75"
                                  style={{ height: `${Math.min(12, barHeight)}px` }}
                                />
                              );
                            })}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleVoicePreview}
                        className="mt-2.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {isPreviewingVoice ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>To‘xtatish</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Ovozni sinash</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Speaking Speed Slider */}
                  <div className="space-y-2 pb-5 border-b border-slate-100">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <label htmlFor="voice-rate-slider" className="font-semibold text-slate-800">
                        Nutq tezligi
                      </label>
                      <span className="font-mono-tabular font-semibold text-blue-700">
                        {voiceSettings.rate.toFixed(2)}× ·{' '}
                        {voiceSettings.rate < 0.9
                          ? 'Sekin'
                          : voiceSettings.rate > 1.15
                          ? 'Tez'
                          : 'Me’yoriy'}
                      </span>
                    </div>
                    <input
                      id="voice-rate-slider"
                      type="range"
                      min={0.7}
                      max={1.5}
                      step={0.05}
                      value={voiceSettings.rate}
                      onPointerDown={() => triggerSliderPreview('rate')}
                      onChange={(e) => {
                        updateVoiceSettings({ rate: parseFloat(e.target.value) }, false);
                        triggerSliderPreview('rate');
                      }}
                      onPointerUp={applyPendingVoiceSettings}
                      onKeyUp={applyPendingVoiceSettings}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-tabular">
                      <span>0.70×</span>
                      <span>1.00×</span>
                      <span>1.50×</span>
                    </div>
                  </div>

                  {/* Voice Pitch Slider */}
                  <div className="space-y-2 pb-5 border-b border-slate-100">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <label htmlFor="voice-pitch-slider" className="font-semibold text-slate-800">
                        Ovoz toni (balandligi)
                      </label>
                      <span className="font-mono-tabular font-semibold text-blue-700">
                        {voiceSettings.pitch.toFixed(2)} ·{' '}
                        {voiceSettings.pitch < 0.92
                          ? 'Past'
                          : voiceSettings.pitch > 1.12
                          ? 'Baland'
                          : 'Tabiiy'}
                      </span>
                    </div>
                    <input
                      id="voice-pitch-slider"
                      type="range"
                      min={0.7}
                      max={1.5}
                      step={0.05}
                      value={voiceSettings.pitch}
                      onPointerDown={() => triggerSliderPreview('pitch')}
                      onChange={(e) => {
                        updateVoiceSettings({ pitch: parseFloat(e.target.value) }, false);
                        triggerSliderPreview('pitch');
                      }}
                      onPointerUp={applyPendingVoiceSettings}
                      onKeyUp={applyPendingVoiceSettings}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-tabular">
                      <span>0.70 (Past)</span>
                      <span>1.02</span>
                      <span>1.50 (Baland)</span>
                    </div>
                  </div>

                  {/* Voice Gender Selector */}
                  <div className="space-y-2.5 pb-5 border-b border-slate-100">
                    <div className="text-xs font-semibold text-slate-800">Ovoz turi</div>
                    <div
                      role="radiogroup"
                      aria-label="Mirvo Ustoz ovoz turi"
                      className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl"
                    >
                      {(
                        [
                          { id: 'auto', label: 'Avtomatik' },
                          { id: 'female', label: 'Ayol' },
                          { id: 'male', label: 'Erkak' },
                        ] as { id: VoiceGender; label: string }[]
                      ).map((opt) => {
                        const active = voiceSettings.gender === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => updateVoiceSettings({ gender: opt.id }, true)}
                            className={`min-h-[40px] px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                              active
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Qurilmangizdagi mos ovozni tanlaydi; agar alohida ovoz topilmasa, ohang avtomatik moslashtiriladi.
                    </p>
                  </div>

                  <div className="space-y-2.5 pb-5 border-b border-slate-100">
                    <div className="text-xs font-semibold text-slate-800">
                      O‘zbekcha Neural ovoz · tajribaviy
                    </div>
                    <div
                      role="radiogroup"
                      aria-label="O‘zbekcha Neural ovoz"
                      className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl"
                    >
                      {(
                        [
                          { id: 'uz-UZ-SardorNeural', label: 'Sardor' },
                          { id: 'uz-UZ-MadinaNeural', label: 'Madina' },
                        ] as { id: EdgeVoice; label: string }[]
                      ).map((opt) => {
                        const active = voiceSettings.voice === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => updateVoiceSettings({ voice: opt.id }, true)}
                            className={`min-h-[40px] px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                              active
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Bu internet orqali ishlaydigan norasmiy xizmat. U mavjud bo‘lmasa, qurilmangizdagi nutq sintezi ishlatiladi.
                    </p>
                  </div>

                  {/* Reset Defaults */}
                  <button
                    type="button"
                    onClick={() => updateVoiceSettings(DEFAULT_VOICE_SETTINGS, true)}
                    disabled={
                      voiceSettings.rate === DEFAULT_VOICE_SETTINGS.rate &&
                      voiceSettings.pitch === DEFAULT_VOICE_SETTINGS.pitch &&
                      voiceSettings.gender === DEFAULT_VOICE_SETTINGS.gender &&
                      voiceSettings.voice === DEFAULT_VOICE_SETTINGS.voice
                    }
                    className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed text-xs font-semibold text-slate-700 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Asl holatga qaytarish</span>
                  </button>

                  {/* Token & Cost Breakdown Ledger */}
                  <div className="pt-5 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <Coins className="w-4 h-4 text-amber-600" />
                        <span>Tokenlar va xarajat hisoblagichi</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSessionTokenStats(resetSessionTokenStats())}
                        disabled={
                          sessionTokenStats.total_tokens === 0 &&
                          sessionTokenStats.ai_requests === 0 &&
                          sessionTokenStats.free_requests === 0
                        }
                        className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                      >
                        Nollash
                      </button>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2 text-xs font-mono-tabular">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Ushbu dars:</span>
                        <span
                          className={`font-bold ${
                            currentLessonUsage.total_tokens === 0
                              ? 'text-emerald-700'
                              : 'text-slate-900'
                          }`}
                        >
                          {formatTokenCount(currentLessonUsage.total_tokens)} tok ·{' '}
                          {formatCostUsd(currentLessonUsage.cost_usd)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Kirish / Chiqish:</span>
                        <span>
                          {formatTokenCount(currentLessonUsage.prompt_tokens)} /{' '}
                          {formatTokenCount(currentLessonUsage.output_tokens)}
                        </span>
                      </div>
                      <div className="h-px bg-slate-200/80" />
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Sessiya jami:</span>
                        <span className="font-bold text-slate-900">
                          {formatTokenCount(sessionTokenStats.total_tokens)} tok ·{' '}
                          {formatCostUsd(sessionTokenStats.cost_usd)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Taxminiy qiymat:</span>
                        <span>{formatCostUzsApprox(sessionTokenStats.cost_usd)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Bepul kesh / AI so‘rovlar:</span>
                        <span>
                          {sessionTokenStats.free_requests} bepul · {sessionTokenStats.ai_requests} AI
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
