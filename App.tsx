import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  Box,
  CheckCircle2,
  Coins,
  Droplets,
  FileText,
  History,
  Layers,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Mic,
  MicOff,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Volume2,
  VolumeX,
  Wind,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { CACHED_LESSONS } from './data/cachedLessons';
import { tryLocalDeterministicParse } from './lib/deterministicParser';
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
  loadActiveSessionSnapshot,
  loadLegacyHistory,
  loadSavedLessons,
  normalizeLessonKey,
  removeSavedLessonEntry,
  saveActiveSessionSnapshot,
  saveLegacyHistory,
  saveLessonEntry,
  type SavedLessonEntry,
} from './lib/lessonStorage';
import {
  clampVoiceRate,
  cycleVoiceRatePreset,
  DEFAULT_VOICE_SETTINGS,
  formatVoiceRate,
  loadVoiceSettings,
  saveVoiceSettings,
  startUzbekSpeechRecognition,
  voiceEngine,
  type SttSession,
  type VoiceGender,
  type VoiceSettings,
} from './lib/voiceEngine';
import {
  ENGINE_LABELS_UZ,
  SUBJECT_LABELS_UZ,
  type CheckAnswerResponse,
  type EvaluateLessonResponse,
  type LessonBeat,
  type LessonStep,
  type OpenQuestionDef,
  type ResolveResponse,
  type StageAnchorsMap,
  type StepEvaluationInput,
  type TutorLesson,
} from './types/tutor';
import { evaluateLessonAnswersLocally } from './lib/lessonEvaluator';
import { VisualStage } from './components/VisualStage';
import { TeacherStageActor } from './components/TeacherStageActor';
import { MirvoMentor } from './components/MirvoMentor';
import { MirvoLogo } from './components/MirvoLogo';
import { resolveStepBeats } from './lib/teacherChoreography';
import { KaTeXBlock } from './components/KaTeXBlock';
import { SummaryBoard } from './components/SummaryBoard';
import { VideoLessonModal } from './components/VideoLessonModal';
import { useAuth } from './components/AuthProvider';
import { AuthGateModal } from './components/AuthGateModal';
import { FigmaLandingOverview } from './components/FigmaLandingOverview';
import { Uz3DLessonPlayer } from './components/Uz3DLessonPlayer';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { buildOfflineObjectLesson } from './lib/pwa';
import {
  NonJsonResponseError,
  safeParseJson,
  safeParseJsonOrNull,
} from './lib/safeFetchJson';
import { MOCK_UZ3D_LESSONS } from './lib/modelCatalog';
import { getCachedVideoLessonFromFirestore } from './lib/firebaseClient';
import type { Uz3DLessonResponse } from './types/uz3d';

const HOME_STARTER_CARDS = [
  {
    id: 'physics-transformer',
    subjectLabel: 'Energetika · 2D/3D',
    title: 'Transformator qanday ishlaydi?',
    subtitle: 'Temir o‘zak, chulg‘amlar va elektromagnit induksiya',
    icon: Zap,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
  },
  {
    id: 'wind-turbine-energy',
    subjectLabel: 'ShES · 3D Animatsiya',
    title: 'Shamol turbinasi va Bets qonuni',
    subtitle: 'Aylanuvchi parraklar, gondola generatori va quvvat',
    icon: Wind,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
  },
  {
    id: 'electric-generator-ac',
    subjectLabel: 'Elektrotexnika · 3D',
    title: 'Elektr generatori va 50 Hz tok',
    subtitle: 'Stator, rotor, Faradey qonuni va sirpanish halqalari',
    icon: Sun,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
  },
  {
    id: 'hydraulic-press-pascal',
    subjectLabel: 'Fizika · Gidravlika',
    title: 'Gidravlik press va Paskal qonuni',
    subtitle: 'Suyuqlik bosimi va kuchdan yutish mexanizmi',
    icon: Droplets,
    iconColor: 'text-indigo-600',
    iconBg: 'bg-indigo-50',
  },
] as const;

const QUICK_VISUAL_TOPICS = [
  { label: 'Transformator', query: 'transformator' },
  { label: 'Shamol turbinasi (3D)', query: 'shamol turbinasi 3D' },
  { label: 'Elektr dvigatel (3D)', query: 'elektr dvigatel 3D' },
  { label: 'Gidroturbina (GES)', query: 'gidroturbina' },
] as const;

const CORE_LESSON_IDS = [
  'physics-transformer',
  'wind-turbine-energy',
  'electric-generator-ac',
  'solar-pv-inverter',
  'hydraulic-press-pascal',
  'sky-blue-physics',
  'vectors-3d-physics',
  'pythagoras-visual',
  'quadratic-parabola',
  'parabola-y-x2',
  'pyramid-section',
  'saddle-surface-3d',
  'two-sheet-hyperboloid-3d',
  'ellipsoid-3d',
  'photosynthesis-visual',
  'biology-cell-structure',
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

function clampLessonStepCount(raw: number): number {
  if (!Number.isFinite(raw)) return 4;
  return Math.max(4, Math.min(12, Math.round(raw)));
}

function resolveStepOpenQuestion(
  step: LessonStep | undefined,
  lesson: TutorLesson
): OpenQuestionDef {
  if (step?.open_question?.question?.trim()) {
    return step.open_question;
  }
  if (step?.quiz?.question?.trim()) {
    return {
      question: step.quiz.question.trim(),
      expected_points: step.quiz.explanation_uz || step.explanation_uz,
      hint_uz: `${lesson.topic_title} bo‘yicha asosiy qoidani o‘z so‘zingiz bilan yozing.`,
    };
  }
  const cleanTitle = (step?.step_title || lesson.topic_title)
    .replace(/^\d+[\.\)\-\:]\s*/, '')
    .trim();
  return {
    question: `"${cleanTitle}" bosqichida tushuntirilgan asosiy qoida yoki jarayonni o‘z so‘zingiz bilan qisqacha tushuntiring.`,
    expected_points: step?.explanation_uz || step?.speech_text || lesson.topic_title,
    hint_uz: `Doskadagi formula va asosiy fikrga tayanib 1–2 gap yozing.`,
  };
}

export default function App() {
  const { user, logout, syncLessonProgress } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPendingLabel, setAuthPendingLabel] = useState<string | undefined>(undefined);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const [initialSession] = useState(() => loadActiveSessionSnapshot());

  const [viewMode, setViewMode] = useState<'home' | 'lesson' | 'uz3d'>('home');
  const [uz3dLesson, setUz3dLesson] = useState<Uz3DLessonResponse | null>(
    () => initialSession?.uz3dLesson || MOCK_UZ3D_LESSONS[0]
  );
  const [lesson, setLesson] = useState<TutorLesson>(
    () => initialSession?.lesson || CACHED_LESSONS[0]
  );
  const [activeStepIndex, setActiveStepIndex] = useState(() => {
    const baseLesson = initialSession?.lesson || CACHED_LESSONS[0];
    const idx = initialSession?.activeStepIndex ?? 0;
    return idx >= 0 && idx < baseLesson.steps.length ? idx : 0;
  });
  const [sliderValues, setSliderValues] = useState<Record<string, number>>(() =>
    buildDefaultSliders(initialSession?.lesson || CACHED_LESSONS[0])
  );
  const [cameraOverride, setCameraOverride] = useState<[number, number, number] | undefined>(() => {
    const baseLesson = initialSession?.lesson || CACHED_LESSONS[0];
    const idx = initialSession?.activeStepIndex ?? 0;
    const step = baseLesson.steps[idx] || baseLesson.steps[0];
    return step?.camera;
  });
  const [autoRotate3D, setAutoRotate3D] = useState(false);

  // Mandatory open-ended written answers & end-of-lesson evaluation tracking
  const [passedSteps, setPassedSteps] = useState<
    Record<number, { answer: string; feedback: string; score?: number }>
  >({});
  const [answerDraft, setAnswerDraft] = useState('');
  const [checkingAnswer, setCheckingAnswer] = useState(false);
  const [answerResult, setAnswerResult] = useState<CheckAnswerResponse | null>(null);
  const [answerCheckOpen, setAnswerCheckOpen] = useState(false);
  const [answerLockNotice, setAnswerLockNotice] = useState<string | null>(null);
  const [evalModalView, setEvalModalView] = useState<'question' | 'results'>('question');
  const [evaluatingLesson, setEvaluatingLesson] = useState(false);
  const [lessonEvalResult, setLessonEvalResult] = useState<EvaluateLessonResponse | null>(null);
  const [isSpeakingResults, setIsSpeakingResults] = useState(false);
  const passedStepsRef = useRef<
    Record<number, { answer: string; feedback: string; score?: number }>
  >({});

  // Drawers & mobile typing resilience
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'library' | 'history' | 'settings'>('library');
  const [lessonPanelOpen, setLessonPanelOpen] = useState(false);
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
  const [lessonStepCount, setLessonStepCount] = useState<number>(() => {
    try {
      const saved = Number(window.localStorage.getItem('mirvo_lesson_step_count_v1') || '4');
      return clampLessonStepCount(saved);
    } catch {
      return 4;
    }
  });
  const [imagePreview, setImagePreview] = useState<{
    dataUrl: string;
    base64: string;
    mimeType: string;
    name: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Playback, Voice TTS/STT & Progressive Drawing Choreography state
  const [boardMode, setBoardMode] = useState<'detailed' | 'summary'>('detailed');
  const [summaryBeatIndex, setSummaryBeatIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [activeBeatIndex, setActiveBeatIndex] = useState(0);
  const [beatProgress, setBeatProgress] = useState(0);
  const [stageAnchors, setStageAnchors] = useState<StageAnchorsMap>({});
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoModalPrefill, setVideoModalPrefill] = useState<{
    tab?: 'file' | 'youtube';
    file?: File | null;
    youtubeUrl?: string;
  }>({});

  // Local query history, saved lessons & live token/cost telemetry
  const [savedLessons, setSavedLessons] = useState<SavedLessonEntry[]>(() =>
    loadSavedLessons()
  );
  const [history, setHistory] = useState<string[]>(() => loadLegacyHistory());
  const [sessionTokenStats, setSessionTokenStats] = useState<SessionTokenStats>(() =>
    loadSessionTokenStats()
  );

  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sttSessionRef = useRef<SttSession | null>(null);
  const autoPlayTimerRef = useRef<number | null>(null);
  const activeStepIndexRef = useRef(activeStepIndex);
  const lessonStepsRef = useRef(lesson.steps);
  const viewModeRef = useRef(viewMode);
  const boardModeRef = useRef(boardMode);
  const voiceSettingsRef = useRef(voiceSettings);
  const handleStepChangeRef = useRef<(nextIndex: number, autoPlay?: boolean) => void>(() => {});

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
    boardModeRef.current = boardMode;
  }, [boardMode]);

  useEffect(() => {
    voiceSettingsRef.current = voiceSettings;
  }, [voiceSettings]);

  useEffect(() => {
    passedStepsRef.current = passedSteps;
  }, [passedSteps]);

  useEffect(() => {
    try {
      window.localStorage.setItem('mirvo_lesson_step_count_v1', String(lessonStepCount));
    } catch {
      // ignore storage failure
    }
  }, [lessonStepCount]);

  useEffect(() => {
    saveActiveSessionSnapshot({
      viewMode,
      lesson,
      activeStepIndex,
      uz3dLesson,
      savedAt: Date.now(),
    });
  }, [viewMode, lesson, activeStepIndex, uz3dLesson]);

  const summaryBeats = useMemo<LessonBeat[]>(
    () =>
      lesson.steps.map((step) => {
        const cleanTitle = step.step_title.replace(/^\d+[\.\)\-\:]\s*/, '').trim();
        const sentence = [cleanTitle, step.explanation_uz].filter(Boolean).join('. ');
        return {
          sentence: sentence || cleanTitle || lesson.topic_title,
          focus_target: 'overview',
          tutor_pose: 'step_back',
          camera_zoom: 1.0,
        };
      }),
    [lesson.steps, lesson.topic_title]
  );

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
    const totalSteps = lesson.steps.length;
    const isMicroStep =
      totalSteps <= 2
        ? activeStepIndex === 1
        : activeStepIndex >= 1 && activeStepIndex < totalSteps - 1;
    const stepFocusPart =
      currentStep?.focusPart && currentStep.focusPart !== 'overview'
        ? currentStep.focusPart.trim()
        : undefined;
    const beatFocusPart =
      raw?.focusPart && raw.focusPart !== 'overview' && raw.focusPart !== 'drawing_tip'
        ? raw.focusPart.trim()
        : undefined;
    const beatTargetPart =
      raw?.focus_target && raw.focus_target !== 'overview' && raw.focus_target !== 'drawing_tip'
        ? raw.focus_target.trim()
        : undefined;

    const effectiveFocusPart =
      beatFocusPart ||
      beatTargetPart ||
      (isMicroStep
        ? stepFocusPart
        : raw?.tutor_pose !== 'step_back'
        ? stepFocusPart
        : undefined);

    const effectivePose =
      effectiveFocusPart && raw?.tutor_pose === 'step_back' ? 'approach' : raw?.tutor_pose;

    const effectiveZoom = isMicroStep
      ? effectivePose === 'step_back'
        ? 1.0
        : Math.max(1.6, Math.min(1.9, raw?.cameraZoom ?? raw?.camera_zoom ?? currentStep?.cameraZoom ?? 1.72))
      : effectiveFocusPart && effectivePose !== 'step_back'
      ? Math.max(1.0, Math.min(1.85, raw?.cameraZoom ?? raw?.camera_zoom ?? currentStep?.cameraZoom ?? 1.32))
      : 1.0;

    const effectiveDim = Boolean(
      effectiveFocusPart &&
        effectivePose !== 'step_back' &&
        (raw?.dimInactiveParts ?? currentStep?.dimInactiveParts ?? isMicroStep)
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
      tutor_pose: effectivePose,
      focusPart: effectiveFocusPart,
      cameraZoom: effectiveZoom,
      camera_zoom: effectiveZoom,
      dimInactiveParts: effectiveDim,
      flowType: effectiveFlowType,
      flowSpeed: effectiveFlowSpeed,
      flowReverse: effectiveFlowReverse,
    };
  }, [activeStepBeats, activeBeatIndex, activeStepIndex, currentStep, lesson.steps.length]);

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
            if (boardModeRef.current === 'summary') {
              setSummaryBeatIndex(clampedIdx);
            } else {
              setActiveBeatIndex(clampedIdx);
              setBeatProgress(clampedFrac);
            }
          },
          onBeatStart: (idx) => {
            if (boardModeRef.current === 'summary') {
              setSummaryBeatIndex(idx);
            } else {
              setActiveBeatIndex(idx);
              setBeatProgress(idx === clampedIdx ? clampedFrac : 0);
            }
          },
          onTick: (open, progress) => {
            setMouthOpen(mutedNow ? 0 : open);
            if (boardModeRef.current !== 'summary') {
              setBeatProgress(progress);
            }
          },
          onEnd: () => {
            setMouthOpen(0);
            setIsPlaying(false);
            if (boardModeRef.current === 'summary') {
              return;
            }
            setBeatProgress(1);
            const currentIdx = activeStepIndexRef.current;
            const steps = lessonStepsRef.current;
            const nextIdx = currentIdx + 1;
            const alreadyPassed = Boolean(passedStepsRef.current[currentIdx]);
            if (viewModeRef.current === 'lesson') {
              if (!alreadyPassed) {
                setAnswerLockNotice(null);
                setAnswerCheckOpen(true);
              } else if (nextIdx < steps.length) {
                autoPlayTimerRef.current = window.setTimeout(() => {
                  autoPlayTimerRef.current = null;
                  handleStepChangeRef.current(nextIdx, true);
                }, 650);
              }
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
      const isRateOnlyPatch =
        patch.rate !== undefined && patch.pitch === undefined && patch.gender === undefined;

      if (isRateOnlyPatch && voiceEngine.setPlaybackRateLive(next.rate)) {
        return;
      }

      const activeList = boardModeRef.current === 'summary' ? summaryBeats : activeStepBeats;
      const activeIdx = boardModeRef.current === 'summary' ? summaryBeatIndex : activeBeatIndex;
      const activeFrac = boardModeRef.current === 'summary' ? 0 : beatProgress;
      if (isPreviewingVoice) {
        startVoicePreview(next);
      } else if (isPlaying && activeList.length > 0) {
        speakBeatsList(activeList, isMuted, activeIdx, activeFrac, next);
      }
    },
    [
      isPreviewingVoice,
      startVoicePreview,
      isPlaying,
      isMuted,
      activeStepBeats,
      summaryBeats,
      summaryBeatIndex,
      activeBeatIndex,
      beatProgress,
      speakBeatsList,
    ]
  );

  const handleStepVoiceRate = useCallback(
    (delta: number) => {
      const nextRate = clampVoiceRate(voiceSettingsRef.current.rate + delta);
      updateVoiceSettings({ rate: nextRate }, true);
    },
    [updateVoiceSettings]
  );

  const handleCycleVoiceRate = useCallback(() => {
    const nextRate = cycleVoiceRatePreset(voiceSettingsRef.current.rate);
    updateVoiceSettings({ rate: nextRate }, true);
  }, [updateVoiceSettings]);

  const applyPendingVoiceSettings = useCallback(() => {
    const activeList = boardModeRef.current === 'summary' ? summaryBeats : activeStepBeats;
    const activeIdx = boardModeRef.current === 'summary' ? summaryBeatIndex : activeBeatIndex;
    const activeFrac = boardModeRef.current === 'summary' ? 0 : beatProgress;
    if (isPreviewingVoice) {
      startVoicePreview(voiceSettingsRef.current);
    } else if (isPlaying && !isMuted && activeList.length > 0) {
      speakBeatsList(
        activeList,
        undefined,
        activeIdx,
        activeFrac,
        voiceSettingsRef.current
      );
    }
  }, [
    isPreviewingVoice,
    startVoicePreview,
    isPlaying,
    isMuted,
    activeStepBeats,
    summaryBeats,
    summaryBeatIndex,
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
      setSummaryBeatIndex(0);
      setBeatProgress(0);
      setStageAnchors({});
      setLesson(nextLesson);
      setActiveStepIndex(0);
      setSliderValues(buildDefaultSliders(nextLesson));
      setCameraOverride(nextLesson.steps[0]?.camera);
      setAutoRotate3D(false);
      passedStepsRef.current = {};
      setPassedSteps({});
      setAnswerDraft('');
      setAnswerResult(null);
      setAnswerCheckOpen(false);
      setAnswerLockNotice(null);
      setEvalModalView('question');
      setEvaluatingLesson(false);
      setLessonEvalResult(null);
      setIsSpeakingResults(false);
      setErrorMsg(null);
      setDrawerOpen(false);
      setLessonPanelOpen(false);
      setViewMode('lesson');
      void syncLessonProgress(nextLesson);

      if (autoPlay && nextLesson.steps[0]) {
        voiceEngine.unlockAudio();
        const beatsToPlay =
          boardModeRef.current === 'summary'
            ? nextLesson.steps.map((step) => {
                const title = step.step_title.replace(/^\d+[\.\)\-\:]\s*/, '').trim();
                return {
                  sentence: [title, step.explanation_uz].filter(Boolean).join('. ') || nextLesson.topic_title,
                  focus_target: 'overview',
                  tutor_pose: 'step_back' as const,
                  camera_zoom: 1.0,
                };
              })
            : resolveStepBeats(
                nextLesson.steps[0],
                nextLesson.engine,
                0,
                nextLesson.steps.length
              );
        autoPlayTimerRef.current = window.setTimeout(() => {
          speakBeatsList(beatsToPlay);
        }, 120);
      }
    },
    [stopPlayback, speakBeatsList, syncLessonProgress]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vid = params.get('uz3d_video_id')?.trim();
    if (!vid) return;

    let cancelled = false;
    (async () => {
      try {
        const fsHit = await getCachedVideoLessonFromFirestore(user, vid).catch(() => null);
        if (fsHit && !cancelled) {
          setUz3dLesson(fsHit);
          setViewMode('uz3d');
          return;
        }
        const res = await fetch(`/api/generate-lesson?video_id=${encodeURIComponent(vid)}`);
        if (res.ok && !cancelled) {
          const data = await safeParseJsonOrNull<Uz3DLessonResponse>(res);
          if (data && Array.isArray(data.segments) && data.segments.length > 0) {
            setUz3dLesson(data);
            setViewMode('uz3d');
            return;
          }
        }
        const genRes = await fetch('/api/generate-lesson', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'youtube_subtitles', video_id: vid }),
        });
        if (genRes.ok && !cancelled) {
          const generated = await safeParseJsonOrNull<Uz3DLessonResponse>(genRes);
          if (generated && Array.isArray(generated.segments) && generated.segments.length > 0) {
            setUz3dLesson(generated);
            setViewMode('uz3d');
          }
        }
      } catch {
        // Fallback silently to home if network unavailable
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleStepChange = useCallback(
    (nextIndex: number, autoPlay = true) => {
      if (nextIndex < 0 || nextIndex >= lesson.steps.length) return;
      // Enforce passing all preceding steps before advancing forward
      if (nextIndex > activeStepIndexRef.current) {
        for (let i = 0; i < nextIndex; i++) {
          if (!passedStepsRef.current[i]) {
            stopPlayback();
            setAnswerLockNotice(
              `Keyingi darsga o‘tish uchun avval ${activeStepIndexRef.current + 1}-dars savoliga to‘g‘ri javob yozing.`
            );
            setAnswerCheckOpen(true);
            return;
          }
        }
      }
      stopPlayback();
      if (boardModeRef.current === 'summary') {
        boardModeRef.current = 'detailed';
        setBoardMode('detailed');
      }
      activeStepIndexRef.current = nextIndex;
      setActiveBeatIndex(0);
      setBeatProgress(0);
      setActiveStepIndex(nextIndex);
      const existingPass = passedStepsRef.current[nextIndex];
      setAnswerDraft(existingPass?.answer || '');
      setAnswerResult(null);
      setEvalModalView('question');
      setAnswerCheckOpen(false);
      setAnswerLockNotice(null);
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

  const handleBoardModeChange = useCallback(
    (nextMode: 'detailed' | 'summary') => {
      if (nextMode === boardModeRef.current) return;
      stopPlayback();
      boardModeRef.current = nextMode;
      setBoardMode(nextMode);
      setSummaryBeatIndex(0);
    },
    [stopPlayback]
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

  const resolveQuery = async (
    rawQuery: string,
    withImage = imagePreview,
    stepCountOverride?: number
  ) => {
    const q = rawQuery.trim();
    if (!q && !withImage) {
      setErrorMsg("Savol yozing, mikrofon orqali ayting yoki masala rasmini yuklang.");
      return;
    }

    const requestedSteps = clampLessonStepCount(stepCountOverride ?? lessonStepCount);
    setErrorMsg(null);

    if (!withImage && q) {
      const localLesson = tryLocalDeterministicParse(q);
      if (localLesson && (requestedSteps <= 4 || localLesson.steps.length >= requestedSteps)) {
        const freeLesson = { ...localLesson, token_usage: ZERO_TOKEN_USAGE };
        setSessionTokenStats((prev) => recordSessionTokenStats(prev, ZERO_TOKEN_USAGE));
        saveLessonToCache(q, freeLesson);
        setQueryText('');
        loadLesson(freeLesson, true);
        return;
      }

      const builtInLesson = findBuiltInCachedLesson(q);
      if (builtInLesson && (requestedSteps <= 4 || builtInLesson.steps.length >= requestedSteps)) {
        const freeLesson = { ...builtInLesson, source: 'cache' as const, token_usage: ZERO_TOKEN_USAGE };
        setSessionTokenStats((prev) => recordSessionTokenStats(prev, ZERO_TOKEN_USAGE));
        saveLessonToCache(q, freeLesson);
        setQueryText('');
        loadLesson(freeLesson, true);
        return;
      }

      const cachedSaved = findSavedLesson(mergedSavedLessons, q);
      if (cachedSaved && (requestedSteps <= 4 || cachedSaved.steps.length >= requestedSteps)) {
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
      const res = await fetch('/api/tutor/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          stepCount: requestedSteps,
          imageBase64: withImage?.base64,
          imageMimeType: withImage?.mimeType,
          device_tier: ((): 'low' | 'mid' | 'high' => {
            if (typeof window === 'undefined') return 'low';
            const ua = navigator.userAgent || '';
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
            const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
            const cores = navigator.hardwareConcurrency || 4;
            if (isMobile || (mem !== undefined && mem <= 4) || cores <= 4) return 'low';
            if (cores >= 8 && (mem === undefined || mem >= 8)) return 'high';
            return 'mid';
          })(),
        }),
      });

      const payload = await safeParseJson<Partial<ResolveResponse> & { error?: string }>(
        res,
        "Savolni tahlil qilib bo'lmadi."
      );
      if (!res.ok || !payload.lesson) {
        throw new Error(payload.error || "Savolni tahlil qilib bo'lmadi.");
      }

      const usage = payload.token_usage ?? payload.lesson.token_usage ?? ZERO_TOKEN_USAGE;
      const lessonWithUsage = { ...payload.lesson, token_usage: usage };
      setSessionTokenStats((prev) => recordSessionTokenStats(prev, usage));
      saveLessonToCache(q || payload.lesson.topic_title, lessonWithUsage);
      setQueryText('');
      setImagePreview(null);
      loadLesson(lessonWithUsage, true);
    } catch (err) {
      const canUseLocalFallback =
        !withImage &&
        Boolean(q) &&
        (!navigator.onLine ||
          err instanceof NonJsonResponseError ||
          err instanceof TypeError ||
          /sozlanmagan|API kaliti|502|503|504|HTML/i.test(
            err instanceof Error ? err.message : ''
          ));
      if (canUseLocalFallback) {
        const offlineLesson = buildOfflineObjectLesson(q, requestedSteps);
        if (offlineLesson) {
          const freeLesson = { ...offlineLesson, token_usage: ZERO_TOKEN_USAGE };
          setSessionTokenStats((prev) => recordSessionTokenStats(prev, ZERO_TOKEN_USAGE));
          saveLessonToCache(q, freeLesson);
          setQueryText('');
          loadLesson(freeLesson, true);
          return;
        }
      }
      setErrorMsg(
        !navigator.onLine
          ? "Internet aloqasi yo‘q. Keshlangan darslar va 3D modellar oflayn doskada ochiq."
          : err instanceof Error
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
      let fetchedModelUrl = sampleStep?.render_params?.model_url;
      let fetchedPartsUz: Array<{ label: string; partId?: string }> | undefined;

      const needs2DFetch = targetMode === '2d' && !sampleStep?.render_params?.svg_data;
      const needs3DFetch =
        targetMode === '3d' &&
        (!fetchedPrimitives || fetchedPrimitives.length === 0) &&
        !sampleStep?.render_params?.custom_3d_objects?.length &&
        !fetchedModelUrl;

      if ((needs2DFetch || needs3DFetch) && fallbackName) {
        try {
          const res = await fetch('/api/objects/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: fallbackName, mode: targetMode }),
          });
          if (res.ok) {
            const data = await safeParseJsonOrNull<{
              object?: {
                svg_data?: string;
                viewBox?: string;
                model_url?: string;
                primitives_3d?: typeof fetchedPrimitives;
                parts_uz?: Array<{ label: string; partId?: string }>;
              };
            }>(res);
            if (data) {
              fetchedSvgData = data.object?.svg_data;
              fetchedViewBox = data.object?.viewBox;
              if (!fetchedModelUrl && data.object?.model_url) {
                fetchedModelUrl = data.object.model_url;
              }
              if (
                (!fetchedPrimitives || fetchedPrimitives.length === 0) &&
                data.object?.primitives_3d
              ) {
                fetchedPrimitives = data.object.primitives_3d;
              }
              if (data.object?.parts_uz && data.object.parts_uz.length > 0) {
                fetchedPartsUz = data.object.parts_uz;
              }
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
        const prims =
          (rp.primitives_3d && rp.primitives_3d.length > 0 ? rp.primitives_3d : undefined) ||
          fetchedPrimitives ||
          generateProceduralPrimitives3D(nameEn);
        const modelUrl = rp.model_url || fetchedModelUrl;
        const objectParts =
          rp.object_parts && rp.object_parts.length > 0
            ? rp.object_parts
            : fetchedPartsUz?.map((p, idx) => ({
                label: p.label,
                partId: p.partId || `part_${idx}`,
              }));

        if (targetMode === '3d') {
          return {
            ...step,
            render_params: {
              ...rp,
              shape:
                prims && prims.length > 0
                  ? ('composite3d' as const)
                  : rp.custom_3d_objects && rp.custom_3d_objects.length > 0
                  ? ('custom_3d_scene' as const)
                  : ('svg_extrude' as const),
              svg_data: svgData,
              svg_viewbox: svgViewBox,
              primitives_3d: prims,
              model_url: modelUrl,
              object_parts: objectParts,
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
            model_url: modelUrl,
            object_parts: objectParts,
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
      saveLessonToCache(found.topic_title, cached);
      loadLesson(cached, true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inputRef.current?.blur();
    setIsMobileTyping(false);
    void resolveQuery(queryText);
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
    } else if (boardMode === 'summary') {
      if (summaryBeats.length > 0) {
        const startIdx = summaryBeatIndex >= summaryBeats.length ? 0 : summaryBeatIndex;
        speakBeatsList(summaryBeats, undefined, startIdx, 0);
      }
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
    if (boardMode === 'summary') {
      if (summaryBeats.length > 0) {
        setSummaryBeatIndex(0);
        speakBeatsList(summaryBeats, undefined, 0, 0);
      }
      return;
    }
    if (activeStepBeats.length > 0) {
      setActiveBeatIndex(0);
      setBeatProgress(0);
      speakBeatsList(activeStepBeats, undefined, 0, 0);
    }
  };

  const handlePrevBeatOrStep = () => {
    if (boardMode === 'summary') {
      const prev = Math.max(0, summaryBeatIndex - 1);
      setSummaryBeatIndex(prev);
      if (isPlaying && summaryBeats.length > 0) {
        speakBeatsList(summaryBeats, undefined, prev, 0);
      }
      return;
    }
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
    if (activeStepIndex > 0) {
      handleStepChange(activeStepIndex - 1, true);
    }
  };

  const handleNextBeatOrStep = () => {
    if (boardMode === 'summary') {
      const next =
        summaryBeatIndex + 1 < summaryBeats.length ? summaryBeatIndex + 1 : 0;
      setSummaryBeatIndex(next);
      if (isPlaying && summaryBeats.length > 0) {
        speakBeatsList(summaryBeats, undefined, next, 0);
      }
      return;
    }
    if (activeBeatIndex + 1 < activeStepBeats.length) {
      const targetBeat = activeBeatIndex + 1;
      setActiveBeatIndex(targetBeat);
      setBeatProgress(0);
      if (isPlaying && activeStepBeats.length > 0) {
        speakBeatsList(activeStepBeats, undefined, targetBeat, 0);
      }
      return;
    }
    if (!passedStepsRef.current[activeStepIndex]) {
      stopPlayback();
      setAnswerLockNotice(
        "Keyingi darsga o‘tish uchun avval ushbu dars savoliga yozma javob bering."
      );
      setAnswerCheckOpen(true);
      return;
    }
    if (activeStepIndex + 1 < lesson.steps.length) {
      handleStepChange(activeStepIndex + 1, true);
    } else {
      setAnswerLockNotice(null);
      if (lessonEvalResult) {
        setEvalModalView('results');
      } else {
        setEvalModalView('question');
      }
      setAnswerCheckOpen(true);
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted && isSpeakingResults) {
      voiceEngine.stop();
      setIsSpeakingResults(false);
    }
    if (!isPlaying) return;
    if (boardMode === 'summary' && summaryBeats.length > 0) {
      speakBeatsList(summaryBeats, nextMuted, summaryBeatIndex, 0);
    } else if (activeStepBeats.length > 0) {
      speakBeatsList(activeStepBeats, nextMuted, activeBeatIndex, beatProgress);
    }
  };

  const activeOpenQuestion = useMemo(
    () => resolveStepOpenQuestion(currentStep, lesson),
    [currentStep, lesson]
  );

  const isCurrentStepPassed = Boolean(passedSteps[activeStepIndex]);

  const highestUnlockedStep = useMemo(() => {
    for (let i = 0; i < lesson.steps.length; i++) {
      if (!passedSteps[i]) return i;
    }
    return Math.max(0, lesson.steps.length - 1);
  }, [lesson.steps.length, passedSteps]);

  const isLessonCompleted = useMemo(
    () => lesson.steps.length > 0 && lesson.steps.every((_, idx) => Boolean(passedSteps[idx])),
    [lesson.steps, passedSteps]
  );

  const speakEvaluationSummary = useCallback((result: EvaluateLessonResponse) => {
    if (!result.summary_speech_uz?.trim()) return;
    stopPlayback();
    voiceEngine.unlockAudio();
    setIsSpeakingResults(true);
    voiceEngine.speak(
      result.summary_speech_uz,
      {
        onStart: () => setIsSpeakingResults(true),
        onEnd: () => setIsSpeakingResults(false),
      },
      true,
      voiceSettingsRef.current
    );
  }, [stopPlayback]);

  const evaluateAllStepAnswers = useCallback(
    async (
      answersMap: Record<number, { answer: string; feedback: string; score?: number }>
    ) => {
      const items: StepEvaluationInput[] = lesson.steps.map((step, idx) => {
        const qDef = resolveStepOpenQuestion(step, lesson);
        return {
          stepIndex: idx,
          stepTitle: step.step_title,
          question: qDef.question,
          expectedPoints: qDef.expected_points,
          stepExplanation: step.explanation_uz,
          formulas: step.katex_formulas,
          userAnswer: answersMap[idx]?.answer || '',
        };
      });

      setEvalModalView('results');
      setEvaluatingLesson(true);
      setLessonEvalResult(null);

      let finalEval: EvaluateLessonResponse | null = null;
      try {
        const res = await fetch('/api/tutor/evaluate-lesson', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topicTitle: lesson.topic_title,
            items,
          }),
        });
        const payload = await safeParseJson<EvaluateLessonResponse>(
          res,
          'Natijalarni hisoblab bo‘lmadi.'
        );
        if (res.ok && typeof payload.overall_percent === 'number' && Array.isArray(payload.steps)) {
          finalEval = payload;
          if (payload.token_usage) {
            setSessionTokenStats((prev) => recordSessionTokenStats(prev, payload.token_usage));
          }
        }
      } catch {
        // Resilient local Uzbek evaluator fallback ensures final percentages & correct answers always load
      }

      if (!finalEval) {
        finalEval = evaluateLessonAnswersLocally(lesson.topic_title, items);
      }

      const enrichedMap: Record<number, { answer: string; feedback: string; score?: number }> = {
        ...answersMap,
      };
      for (const s of finalEval.steps) {
        enrichedMap[s.stepIndex] = {
          answer: answersMap[s.stepIndex]?.answer || s.userAnswer,
          feedback: s.feedback_uz,
          score: s.score,
        };
      }
      passedStepsRef.current = enrichedMap;
      setPassedSteps(enrichedMap);
      setLessonEvalResult(finalEval);
      setEvaluatingLesson(false);

      if (!isMuted) {
        speakEvaluationSummary(finalEval);
      }
    },
    [lesson, isMuted, speakEvaluationSummary]
  );

  const handleReplayCurrentStepFromModal = useCallback(() => {
    if (isSpeakingResults) {
      voiceEngine.stop();
      setIsSpeakingResults(false);
    }
    setAnswerCheckOpen(false);
    setAnswerLockNotice(null);
    setAnswerResult(null);
    setIsMuted(false);
    voiceEngine.unlockAudio();
    if (boardModeRef.current === 'summary') {
      boardModeRef.current = 'detailed';
      setBoardMode('detailed');
    }
    setActiveBeatIndex(0);
    setBeatProgress(0);
    if (activeStepBeats.length > 0) {
      speakBeatsList(activeStepBeats, false, 0, 0);
    }
  }, [activeStepBeats, isSpeakingResults, speakBeatsList]);

  const handleCheckWrittenAnswer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = answerDraft.trim();
    if (trimmed.length < 2) {
      setAnswerResult({
        passed: false,
        score: 0,
        feedback_uz: "Javob yozilmaguncha keyingi darsga o‘tib bo‘lmaydi. Qisqacha javob yozing.",
      });
      return;
    }

    setCheckingAnswer(true);
    setAnswerLockNotice(null);
    setAnswerResult(null);

    const nextMap = {
      ...passedStepsRef.current,
      [activeStepIndex]: {
        answer: trimmed,
        feedback: 'Javob qabul qilindi',
        score: passedStepsRef.current[activeStepIndex]?.score,
      },
    };
    passedStepsRef.current = nextMap;
    setPassedSteps(nextMap);

    const isLastStep = activeStepIndex + 1 >= lesson.steps.length;
    if (!isLastStep) {
      setCheckingAnswer(false);
      handleStepChange(activeStepIndex + 1, true);
      return;
    }

    setCheckingAnswer(false);
    await evaluateAllStepAnswers(nextMap);
  };

  const cleanStepTitle = (title: string) => title.replace(/^\d+\.\s*/, '');

  const globalLessonProgress = useMemo(() => {
    const totalSteps = Math.max(1, lesson.steps.length);
    const passedCount = lesson.steps.filter((_, idx) => Boolean(passedSteps[idx])).length;
    if (passedCount === totalSteps) return 1;
    return Math.max(
      0,
      Math.min(1, (activeStepIndex + (isCurrentStepPassed ? 1 : activeStepProgress)) / totalSteps)
    );
  }, [lesson.steps, passedSteps, activeStepIndex, isCurrentStepPassed, activeStepProgress]);

  const globalLessonPercent = Math.round(globalLessonProgress * 100);
  const currentLessonUsage = lesson.token_usage ?? ZERO_TOKEN_USAGE;

  const isSpeakingNow = isPlaying && !isMuted;

  const activeDisplayError = errorMsg;
  const dismissDisplayError = () => {
    setErrorMsg(null);
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#F5F5F7] text-[#1D1D1F] overflow-hidden pt-[env(safe-area-inset-top)]">
      {/* Hidden shared file input for photo math uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {viewMode === 'home' ? (
        <FigmaLandingOverview
          userEmail={user?.email ?? null}
          userName={user?.displayName ?? null}
          totalHistoryCount={totalHistoryCount}
          sessionTokenStats={sessionTokenStats}
          starterCards={HOME_STARTER_CARDS}
          quickTopics={QUICK_VISUAL_TOPICS}
          queryText={queryText}
          onQueryTextChange={setQueryText}
          lessonStepCount={lessonStepCount}
          onLessonStepCountChange={setLessonStepCount}
          imagePreview={imagePreview}
          onClearImagePreview={() => setImagePreview(null)}
          onOpenFilePicker={() => fileInputRef.current?.click()}
          onToggleMic={handleToggleMic}
          isListening={isListening}
          isLoading={isLoading}
          errorMsg={activeDisplayError}
          onDismissError={dismissDisplayError}
          onSubmitPrompt={handleSubmit}
          onSelectStarterCard={handleStarterCard}
          onSelectQuickTopic={(q) => {
            void resolveQuery(q, null);
          }}
          onOpenVideoModal={() => {
            setVideoModalPrefill({ tab: 'file', file: null, youtubeUrl: undefined });
            setVideoModalOpen(true);
          }}
          onOpenVideoWithFile={(file) => {
            setVideoModalPrefill({ tab: 'file', file, youtubeUrl: undefined });
            setVideoModalOpen(true);
          }}
          onOpenVideoWithYoutube={(youtubeUrl) => {
            setVideoModalPrefill({ tab: 'youtube', file: null, youtubeUrl });
            setVideoModalOpen(true);
          }}
          onOpenUz3DPlayer={() => {
            stopPlayback();
            setViewMode('uz3d');
          }}
          onOpenDrawer={(tab) => {
            setDrawerTab(tab);
            setDrawerOpen(true);
          }}
          onRequestAuth={(label) => {
            pendingActionRef.current = null;
            setAuthPendingLabel(label);
            setAuthModalOpen(true);
          }}
          onEnterWorkspace={() => loadLesson(lesson || CACHED_LESSONS[0], false)}
          onLogout={() => void logout()}
        />
      ) : viewMode === 'uz3d' ? (
        <Uz3DLessonPlayer
          initialLesson={uz3dLesson}
          user={user}
          voiceSettings={voiceSettings}
          onChangeVoiceRate={(rate) => updateVoiceSettings({ rate }, false)}
          onBackHome={() => setViewMode('home')}
          onOpenWhiteboard={() => setViewMode('lesson')}
          onLessonChanged={(next) => setUz3dLesson(next)}
        />
      ) : (
        /* ==================== FULL-VIEWPORT APPLE FREEFORM WHITEBOARD (85-90%+) ==================== */
        <>
          {/* Hairline Top Lesson Progress Indicator */}
          <div
            role="progressbar"
            aria-label="Umumiy dars bajarilishi"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={globalLessonPercent}
            className="h-[2px] w-full shrink-0 bg-black/[0.06] overflow-hidden z-30"
          >
            <div
              className={`h-full w-full origin-left transition-[transform,background-color] duration-200 ease-out will-change-transform ${
                globalLessonPercent >= 100 ? 'bg-emerald-500' : 'bg-[#0071E3]'
              }`}
              style={{ transform: `scaleX(${globalLessonProgress})` }}
            />
          </div>

          {/* Ultra-Slim Glass Top Bar (h-11) */}
          <header className="h-11 shrink-0 apple-glass border-b border-black/5 px-2.5 sm:px-4 flex items-center justify-between gap-2 z-20">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => {
                  stopPlayback();
                  setViewMode('home');
                }}
                aria-label="Bosh sahifaga qaytish"
                className="w-8 h-8 rounded-full bg-white/85 hover:bg-white border border-black/[0.06] flex items-center justify-center text-[#1D1D1F] apple-transition shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  stopPlayback();
                  setViewMode('home');
                }}
                className="hidden sm:inline-flex items-center cursor-pointer shrink-0"
                aria-label="Mirvo AI bosh sahifa"
              >
                <MirvoLogo size="sm" />
              </button>
              <span className="font-mono-tabular text-[11px] font-semibold text-[#0071E3] shrink-0">
                {activeStepIndex + 1}/{lesson.steps.length}
              </span>
              <span className="truncate max-w-[140px] sm:max-w-[280px] text-xs font-medium text-[#1D1D1F]">
                {lesson.topic_title}
              </span>
            </div>

            {/* Right: Essential Board Mode + Collapsible Inspector + Settings */}
            <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
              <div
                role="group"
                aria-label="Doska rejimi"
                className="flex items-center gap-0.5 p-0.5 rounded-full bg-black/[0.045] border border-black/[0.04] shrink-0"
              >
                <button
                  type="button"
                  onClick={() => handleBoardModeChange('detailed')}
                  aria-pressed={boardMode === 'detailed'}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full apple-transition cursor-pointer whitespace-nowrap shrink-0 ${
                    boardMode === 'detailed'
                      ? 'bg-[#0071E3] text-white shadow-xs'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Batafsil</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBoardModeChange('summary')}
                  aria-pressed={boardMode === 'summary'}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full apple-transition cursor-pointer whitespace-nowrap shrink-0 ${
                    boardMode === 'summary'
                      ? 'bg-[#0071E3] text-white shadow-xs'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span>Qisqacha</span>
                </button>
              </div>

              {boardMode === 'detailed' && isObjectLesson && (
                <div
                  role="group"
                  aria-label="Tasvir o'lchami"
                  className="flex items-center gap-0.5 p-0.5 rounded-full bg-black/[0.045] border border-black/[0.04] shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => void handleSwitchObjectDimension('2d')}
                    className={`px-2 py-1 text-[11px] font-medium rounded-full apple-transition cursor-pointer whitespace-nowrap shrink-0 ${
                      lesson.engine === 'svg2d'
                        ? 'bg-[#0071E3] text-white'
                        : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                    }`}
                  >
                    2D
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSwitchObjectDimension('3d')}
                    className={`px-2 py-1 text-[11px] font-medium rounded-full apple-transition cursor-pointer whitespace-nowrap shrink-0 ${
                      lesson.engine === 'threejs'
                        ? 'bg-[#0071E3] text-white'
                        : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                    }`}
                  >
                    3D
                  </button>
                </div>
              )}

              {boardMode === 'detailed' && lesson.engine === 'threejs' && (
                <button
                  type="button"
                  onClick={() => setAutoRotate3D((v) => !v)}
                  aria-pressed={autoRotate3D}
                  aria-label="360 daraja aylantirish"
                  className={`h-8 px-2.5 rounded-full border text-[11px] font-medium inline-flex items-center gap-1 apple-transition cursor-pointer whitespace-nowrap shrink-0 ${
                    autoRotate3D
                      ? 'bg-[#0071E3] border-[#0071E3] text-white'
                      : 'bg-white/85 border-black/[0.06] text-[#1D1D1F] hover:bg-white'
                  }`}
                >
                  <RotateCw className={`w-3 h-3 ${autoRotate3D ? 'animate-spin' : ''}`} />
                  <span>360°</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setAnswerLockNotice(null);
                  setEvalModalView(
                    lessonEvalResult && activeStepIndex === lesson.steps.length - 1
                      ? 'results'
                      : 'question'
                  );
                  setAnswerCheckOpen(true);
                }}
                aria-label="Dars savoliga javob yozish"
                className={`h-8 px-2.5 sm:px-3 rounded-full border text-[11px] font-medium inline-flex items-center gap-1.5 apple-transition cursor-pointer whitespace-nowrap shrink-0 ${
                  lessonEvalResult
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : isCurrentStepPassed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-[#0071E3]/[0.08] border-[#0071E3]/25 text-[#0071E3] hover:bg-[#0071E3]/[0.14]'
                }`}
              >
                {lessonEvalResult || isCurrentStepPassed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-[#0071E3]" />
                )}
                <span className="hidden sm:inline">
                  {lessonEvalResult
                    ? `Natija: ${lessonEvalResult.overall_percent}%`
                    : isCurrentStepPassed
                    ? 'Javob yozildi'
                    : 'Javob yozish'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setLessonPanelOpen((v) => !v)}
                aria-expanded={lessonPanelOpen}
                aria-label="Tafsilotlar va qo‘shimcha savol"
                className={`h-8 px-2.5 sm:px-3 rounded-full border text-[11px] font-medium inline-flex items-center gap-1.5 apple-transition cursor-pointer whitespace-nowrap shrink-0 ${
                  lessonPanelOpen
                    ? 'bg-[#1D1D1F] border-[#1D1D1F] text-white'
                    : 'bg-white/85 hover:bg-white border-black/[0.06] text-[#1D1D1F]'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#0071E3]" />
                <span className="hidden sm:inline">Tafsilotlar</span>
                {(lesson.sliders?.length ?? 0) > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3] shrink-0" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setDrawerTab('settings');
                  setDrawerOpen(true);
                }}
                aria-label="Sozlamalar va kutubxona"
                className="w-8 h-8 rounded-full bg-white/85 hover:bg-white border border-black/[0.06] text-[#6E6E73] hover:text-[#1D1D1F] inline-flex items-center justify-center apple-transition cursor-pointer shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>

          {/* FULL-BLEED WHITEBOARD STAGE (~90% OF VIEWPORT) */}
          <main className="flex-1 min-h-0 p-1.5 sm:p-2.5 w-full overflow-hidden flex flex-col">
            <section
              aria-label="Interaktiv Chizma Doskasi"
              className="relative flex-1 min-h-0 w-full rounded-2xl sm:rounded-3xl apple-freeform-dots border border-black/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col"
            >
              {/* Floating Glass KaTeX Formula Card (top-left, compact) */}
              {boardMode === 'detailed' &&
                currentStep.katex_formulas &&
                currentStep.katex_formulas.length > 0 && (
                  <div
                    className={`pointer-events-none absolute top-3 left-3 sm:top-4 sm:left-4 z-10 apple-glass rounded-2xl px-3 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] overflow-hidden ${
                      isObjectLesson || lesson.engine === 'threejs'
                        ? 'max-w-[46%] sm:max-w-[38%]'
                        : 'max-w-[60%] sm:max-w-[52%]'
                    }`}
                  >
                    <KaTeXBlock
                      latex={currentStep.katex_formulas[0]}
                      displayMode={false}
                      className="text-xs sm:text-sm font-semibold text-[#1D1D1F]"
                    />
                  </div>
                )}

              {boardMode === 'summary' ? (
                <SummaryBoard
                  lesson={lesson}
                  isPlaying={isPlaying}
                  activeConceptIndex={isPlaying ? summaryBeatIndex : null}
                  onInspectStep={(idx) => handleStepChange(idx, false)}
                  onSwitchToDetailed={() => handleBoardModeChange('detailed')}
                />
              ) : (
                <div className="relative flex-1 min-h-0">
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

                  <TeacherStageActor
                    activeBeat={activeBeat}
                    anchors={stageAnchors}
                    isSpeaking={isSpeakingNow}
                    isPlaying={isPlaying}
                    isListening={isListening}
                    mouthOpen={mouthOpen}
                  />

                  {/* Compact Synchronized Subtitle Pill above Dock */}
                  <div className="pointer-events-none absolute bottom-16 sm:bottom-[68px] left-3 right-3 z-20 flex justify-center">
                    <div className="bg-[#1D1D1F]/86 text-white backdrop-blur-md border border-white/10 rounded-full px-4 py-1.5 text-xs sm:text-[13px] font-medium leading-snug text-center shadow-[0_8px_24px_rgba(0,0,0,0.16)] max-w-2xl truncate sm:whitespace-normal">
                      {activeBeat?.sentence || currentStep.explanation_uz}
                    </div>
                  </div>
                </div>
              )}

              {/* AI Generation Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#F5F5F7]/85 backdrop-blur-sm p-4">
                  <div className="inline-flex items-center gap-2.5 rounded-full border border-black/[0.06] bg-white px-5 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.08)] text-xs sm:text-sm font-medium text-[#1D1D1F]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#0071E3] shrink-0" />
                    <span>Mirvo AI chizma va dars tuzmoqda...</span>
                  </div>
                </div>
              )}
            </section>
          </main>

          {/* FLOATING COMPACT BOTTOM CONTROL DOCK */}
          {!isMobileTyping && (
            <div className="fixed bottom-3 sm:bottom-3.5 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100vw-1rem)]">
              <div
                role="toolbar"
                aria-label="Dars boshqaruv paneli"
                className="apple-glass rounded-full shadow-[0_12px_36px_rgba(0,0,0,0.12)] px-2 sm:px-3 py-1 flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar"
              >
                <button
                  type="button"
                  onClick={handlePrevBeatOrStep}
                  aria-label="Oldingi qism"
                  title="Orqaga"
                  className="w-8 h-8 rounded-full hover:bg-black/[0.06] text-[#1D1D1F] flex items-center justify-center apple-transition cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleReplayStep}
                  aria-label="Qadamni qaytadan chizish"
                  title="Qayta ko‘rish"
                  className="hidden sm:flex w-8 h-8 rounded-full hover:bg-black/[0.06] text-[#6E6E73] hover:text-[#1D1D1F] items-center justify-center apple-transition cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleTogglePlay}
                  aria-label={isPlaying ? "To‘xtatish" : "O‘ynatish"}
                  className="h-9 px-3.5 sm:px-4 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 shadow-[0_4px_14px_rgba(0,113,227,0.3)] apple-transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pauza</span>
                      {!isMuted && (
                        <span className="inline-flex items-end gap-0.5 h-3 ml-0.5" aria-hidden="true">
                          <span
                            className="w-[2.5px] h-3 rounded-full bg-white apple-eq-bar"
                            style={{ animationDelay: '0ms' }}
                          />
                          <span
                            className="w-[2.5px] h-3 rounded-full bg-white apple-eq-bar"
                            style={{ animationDelay: '180ms' }}
                          />
                          <span
                            className="w-[2.5px] h-3 rounded-full bg-white apple-eq-bar"
                            style={{ animationDelay: '340ms' }}
                          />
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {activeStepProgress > 0.02 && activeStepProgress < 0.98
                          ? 'Davom etish'
                          : 'Eshitish'}
                      </span>
                    </>
                  )}
                </button>

                {/* Step Indicator Dots with Hard Lock */}
                <div
                  aria-label="Bosqichlar indikatori"
                  className="flex items-center gap-1 px-1.5 sm:px-2 shrink-0"
                >
                  {lesson.steps.map((step, idx) => {
                    const isActive = idx === activeStepIndex;
                    const isPassed = Boolean(passedSteps[idx]);
                    const isLocked = idx > highestUnlockedStep;
                    return (
                      <button
                        key={step.step_number || idx}
                        type="button"
                        onClick={() => handleStepChange(idx, true)}
                        aria-label={
                          isLocked
                            ? `${idx + 1}-qadam (qulflangan — avval joriy savolga javob bering)`
                            : `${idx + 1}-qadam: ${cleanStepTitle(step.step_title)}`
                        }
                        aria-current={isActive ? 'step' : undefined}
                        title={
                          isLocked
                            ? `${idx + 1}. Qulflangan`
                            : `${idx + 1}. ${cleanStepTitle(step.step_title)}`
                        }
                        className={`h-2 rounded-full apple-transition cursor-pointer ${
                          isActive
                            ? 'w-5 bg-[#0071E3]'
                            : isPassed
                            ? 'w-2 bg-emerald-500 hover:bg-emerald-600'
                            : isLocked
                            ? 'w-2 bg-black/10 opacity-60'
                            : 'w-2 bg-black/25 hover:bg-black/40'
                        }`}
                      />
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleNextBeatOrStep}
                  aria-label="Keyingi qism"
                  title="Oldinga"
                  className="w-8 h-8 rounded-full hover:bg-black/[0.06] text-[#1D1D1F] flex items-center justify-center apple-transition cursor-pointer shrink-0"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleToggleMute}
                  aria-label={isMuted ? 'Ovozni yoqish' : "Ovozni o‘chirish"}
                  title={isMuted ? 'Ovozni yoqish' : "Ovozni o‘chirish"}
                  className={`w-8 h-8 rounded-full flex items-center justify-center apple-transition cursor-pointer shrink-0 ${
                    isMuted
                      ? 'bg-amber-100 text-amber-700'
                      : 'hover:bg-black/[0.06] text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                {/* Live Speech Speed Controls (- | 1.0x | +) */}
                <div
                  role="group"
                  aria-label="Nutq tezligini boshqarish"
                  className="inline-flex items-center rounded-full bg-black/[0.05] border border-black/[0.05] p-0.5 shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => handleStepVoiceRate(-0.1)}
                    disabled={voiceSettings.rate <= 0.7}
                    aria-label="Nutqni sekinlashtirish"
                    title="Sekinlashtirish (−0.1×)"
                    className="w-7 h-7 rounded-full hover:bg-white disabled:opacity-35 text-[#1D1D1F] flex items-center justify-center apple-transition cursor-pointer shrink-0"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCycleVoiceRate}
                    aria-label={`Nutq tezligi ${formatVoiceRate(voiceSettings.rate)}. O‘zgartirish uchun bosing`}
                    title="Tezlikni almashtirish (0.8× / 1.0× / 1.25× / 1.5×)"
                    className="min-w-[40px] h-7 px-1.5 rounded-full hover:bg-white font-mono-tabular text-[11px] font-semibold text-[#1D1D1F] flex items-center justify-center apple-transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {formatVoiceRate(voiceSettings.rate)}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepVoiceRate(0.1)}
                    disabled={voiceSettings.rate >= 1.5}
                    aria-label="Nutqni tezlashtirish"
                    title="Tezlashtirish (+0.1×)"
                    className="w-7 h-7 rounded-full hover:bg-white disabled:opacity-35 text-[#1D1D1F] flex items-center justify-center apple-transition cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ON-DEMAND SLIDE-OVER INSPECTOR DRAWER (Explanation, Sliders, Quiz, Steps, Follow-up) */}
          {lessonPanelOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] flex justify-end"
              onClick={() => setLessonPanelOpen(false)}
            >
              <aside
                aria-label="O‘qituvchi tushuntirishi va dars tafsilotlari"
                onClick={(e) => e.stopPropagation()}
                className="w-[380px] max-w-[94vw] h-full bg-white border-l border-black/[0.06] shadow-[0_24px_60px_rgba(0,0,0,0.14)] flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
              >
                <div className="px-5 py-3.5 border-b border-black/[0.05] flex items-center justify-between gap-3 shrink-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#0071E3]">
                      <span>
                        {activeStepIndex + 1}-qadam / {lesson.steps.length}
                      </span>
                      <span className="text-[#6E6E73]">·</span>
                      <span className="text-[#6E6E73]">{SUBJECT_LABELS_UZ[lesson.subject]}</span>
                    </div>
                    <div className="text-xs text-[#6E6E73] truncate mt-0.5">
                      {lesson.topic_title}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLessonPanelOpen(false)}
                    aria-label="Panelni yopish"
                    className="w-8 h-8 rounded-full text-[#6E6E73] hover:bg-black/[0.05] hover:text-[#1D1D1F] flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto academic-scroll p-5 space-y-5">
                  <div className="space-y-2.5">
                    <h2
                      className="text-lg font-semibold tracking-[-0.025em] text-[#1D1D1F] leading-snug"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {currentStep.board_title || cleanStepTitle(currentStep.step_title)}
                    </h2>
                    <p className="text-[15px] leading-relaxed text-[#1D1D1F]">
                      {currentStep.explanation_uz}
                    </p>
                    {currentStep.katex_formulas && currentStep.katex_formulas.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {currentStep.katex_formulas.map((latex, i) => (
                          <div
                            key={i}
                            className="inline-flex items-center rounded-2xl bg-[#F5F5F7] border border-black/[0.05] px-3 py-1.5"
                          >
                            <KaTeXBlock
                              latex={latex}
                              displayMode={false}
                              className="text-sm text-[#1D1D1F]"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {lesson.sliders && lesson.sliders.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-black/[0.05]">
                      <div className="text-xs font-medium text-[#6E6E73]">
                        Interaktiv parametrlar
                      </div>
                      <div className="space-y-3 rounded-2xl bg-[#F5F5F7]/80 p-3.5 border border-black/[0.04]">
                        {lesson.sliders.map((slider) => {
                          const val = sliderValues[slider.id] ?? slider.default;
                          return (
                            <div key={slider.id} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-[#1D1D1F]">{slider.label}</span>
                                <span className="font-mono-tabular font-semibold text-[#0071E3]">
                                  {val}
                                  {slider.unit ? ` ${slider.unit}` : ''}
                                </span>
                              </div>
                              <input
                                type="range"
                                min={slider.min}
                                max={slider.max}
                                step={slider.step}
                                value={val}
                                onChange={(e) => {
                                  const num = parseFloat(e.target.value);
                                  setSliderValues((prev) => ({ ...prev, [slider.id]: num }));
                                }}
                                className="w-full accent-[#0071E3] cursor-pointer"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Mandatory Written Assessment (No Multiple Choice) */}
                  <div className="rounded-2xl border border-[#0071E3]/20 bg-[#0071E3]/[0.04] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#0071E3] inline-flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Yozma Tekshiruv</span>
                      </span>
                      {isCurrentStepPassed ? (
                        <span className="text-[11px] font-semibold text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Tasdiqlandi</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-[#6E6E73] inline-flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>Keyingi dars qulflangan</span>
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-[#1D1D1F] leading-snug">
                      {activeOpenQuestion.question}
                    </p>

                    <form onSubmit={handleCheckWrittenAnswer} className="space-y-2.5">
                      <textarea
                        rows={3}
                        value={answerDraft}
                        onFocus={() => setIsMobileTyping(true)}
                        onBlur={() => setIsMobileTyping(false)}
                        onChange={(e) => setAnswerDraft(e.target.value)}
                        placeholder="Javobingizni o‘z so‘zingiz bilan yozing..."
                        className="w-full rounded-2xl border border-black/[0.08] bg-white px-3 py-2.5 text-sm text-[#1D1D1F] placeholder:text-[#6E6E73]/75 focus:outline-none focus:border-[#0071E3] resize-none"
                      />
                      <button
                        type="submit"
                        disabled={checkingAnswer || answerDraft.trim().length < 2}
                        className="w-full h-9 rounded-full bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-50 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 apple-transition cursor-pointer"
                      >
                        {checkingAnswer ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>AI tekshirmoqda...</span>
                          </>
                        ) : (
                          <span>AI bilan tekshirish</span>
                        )}
                      </button>
                    </form>

                    {answerResult && (
                      <div
                        className={`rounded-xl px-3 py-2.5 text-xs space-y-1 ${
                          answerResult.passed
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                            : 'bg-amber-50 border border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="font-semibold flex items-center justify-between gap-2">
                          <span>
                            {answerResult.passed ? 'To‘g‘ri javob!' : 'Yana urinib ko‘ring'}
                          </span>
                          {typeof answerResult.score === 'number' && (
                            <span className="font-mono-tabular">{answerResult.score}%</span>
                          )}
                        </div>
                        <p className="leading-relaxed">{answerResult.feedback_uz}</p>
                        {!answerResult.passed && answerResult.hint_uz && (
                          <p className="text-[11px] opacity-85">Ishora: {answerResult.hint_uz}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {activeStepBeats.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-black/[0.05]">
                      <div className="text-xs font-medium text-[#6E6E73]">Asosiy fikrlar</div>
                      <ul className="space-y-1.5">
                        {activeStepBeats.map((b, bIdx) => {
                          const activeBeat = bIdx === activeBeatIndex && isPlaying;
                          return (
                            <li key={bIdx}>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveBeatIndex(bIdx);
                                  setBeatProgress(0);
                                  if (isPlaying) {
                                    speakBeatsList(activeStepBeats, undefined, bIdx, 0);
                                  }
                                }}
                                className={`w-full text-left rounded-2xl px-3 py-2 text-xs leading-relaxed flex items-start gap-2 apple-transition cursor-pointer ${
                                  activeBeat
                                    ? 'bg-[#0071E3]/[0.08] text-[#1D1D1F]'
                                    : 'bg-[#F5F5F7]/70 hover:bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F]'
                                }`}
                              >
                                <span
                                  className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                                    activeBeat ? 'bg-[#0071E3]' : 'bg-[#6E6E73]/50'
                                  }`}
                                />
                                <span>{b.sentence}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t border-black/[0.05]">
                    <div className="text-xs font-medium text-[#6E6E73]">Dars bosqichlari</div>
                    <div className="space-y-1.5">
                      {lesson.steps.map((step, idx) => {
                        const isActive = idx === activeStepIndex;
                        const isPassed = Boolean(passedSteps[idx]);
                        const isLocked = idx > highestUnlockedStep;
                        return (
                          <button
                            key={step.step_number || idx}
                            type="button"
                            onClick={() => handleStepChange(idx, true)}
                            className={`w-full text-left rounded-2xl border px-3 py-2 flex items-center justify-between gap-2 apple-transition cursor-pointer ${
                              isActive
                                ? 'border-[#0071E3] bg-[#0071E3]/[0.06] text-[#1D1D1F]'
                                : isLocked
                                ? 'border-black/[0.04] bg-[#F5F5F7]/40 text-[#6E6E73]/75'
                                : 'border-black/[0.05] bg-[#F5F5F7]/60 hover:bg-[#F5F5F7] text-[#6E6E73]'
                            }`}
                          >
                            <div className="text-xs font-semibold text-[#1D1D1F] truncate">
                              {idx + 1}. {cleanStepTitle(step.step_title)}
                            </div>
                            {isPassed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : isLocked ? (
                              <Lock className="w-3.5 h-3.5 text-[#6E6E73]/60 shrink-0" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Drawer Bottom Follow-Up Question Composer */}
                <div className="shrink-0 border-t border-black/[0.05] bg-white p-3.5 space-y-2">
                  {errorMsg && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-800 flex items-center justify-between gap-2">
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
                    <div className="flex items-center justify-between gap-2 rounded-2xl border border-black/[0.05] bg-[#F5F5F7] px-2.5 py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={imagePreview.dataUrl}
                          alt="Yuklangan rasm"
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 object-cover rounded-lg shrink-0"
                        />
                        <span className="text-xs text-[#1D1D1F] truncate">{imagePreview.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setImagePreview(null)}
                        className="p-1 text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
                    <div className="flex-1 min-w-0 h-10 flex items-center rounded-full border border-black/[0.07] bg-[#F5F5F7] focus-within:bg-white focus-within:border-[#0071E3] pl-3.5 pr-1 apple-transition">
                      <input
                        ref={inputRef}
                        type="text"
                        value={queryText}
                        onFocus={() => setIsMobileTyping(true)}
                        onBlur={() => setIsMobileTyping(false)}
                        onChange={(e) => setQueryText(e.target.value)}
                        placeholder="Qo‘shimcha savol bering..."
                        className="flex-1 min-w-0 bg-transparent text-sm text-[#1D1D1F] placeholder:text-[#6E6E73] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Rasm yuklash"
                        className="w-8 h-8 inline-flex items-center justify-center rounded-full text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleMic}
                      aria-label="Ovoz bilan savol"
                      className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 apple-transition cursor-pointer ${
                        isListening
                          ? 'bg-rose-600 border-rose-600 text-white'
                          : 'bg-[#F5F5F7] border-black/[0.06] text-[#1D1D1F] hover:bg-black/[0.06]'
                      }`}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    <button
                      type="submit"
                      disabled={isLoading}
                      aria-label="Savolni yuborish"
                      className="w-10 h-10 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white inline-flex items-center justify-center shrink-0 disabled:opacity-50 apple-transition cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </aside>
            </div>
          )}
        </>
      )}

      {/* ==================== SLIDE-OVER LIBRARY, HISTORY & SETTINGS DRAWER ==================== */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/25 backdrop-blur-xs flex justify-end"
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
            className="w-[360px] max-w-[92vw] h-full bg-white border-l border-black/[0.06] shadow-[0_24px_60px_rgba(0,0,0,0.14)] flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
            aria-label="Mirvo AI Menyusi"
          >
            <div className="h-14 px-4 border-b border-black/[0.05] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {drawerTab === 'settings' ? (
                  <>
                    <SlidersHorizontal className="w-4 h-4 text-[#0071E3]" />
                    <span
                      className="text-sm font-semibold text-[#1D1D1F] whitespace-nowrap tracking-[-0.02em]"
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
                className="w-9 h-9 inline-flex items-center justify-center rounded-full text-[#6E6E73] hover:bg-black/[0.05] hover:text-[#1D1D1F] cursor-pointer"
                aria-label="Menyuni yopish"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Tab Filter: Library, History, Settings */}
            <div className="px-4 pt-3 shrink-0">
              <div className="flex items-center gap-1 p-1 bg-[#F5F5F7] rounded-full border border-black/[0.04]">
                <button
                  type="button"
                  onClick={() => setDrawerTab('library')}
                  className={`flex-1 min-h-[34px] px-2 py-1 text-xs font-medium rounded-full apple-transition cursor-pointer whitespace-nowrap shrink-0 ${
                    drawerTab === 'library'
                      ? 'bg-white text-[#1D1D1F] shadow-xs'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  Darslar
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('history')}
                  className={`flex-1 min-h-[34px] px-2 py-1 text-xs font-medium rounded-full apple-transition cursor-pointer whitespace-nowrap shrink-0 ${
                    drawerTab === 'history'
                      ? 'bg-white text-[#1D1D1F] shadow-xs'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  Tarix ({totalHistoryCount})
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('settings')}
                  className={`flex-1 min-h-[34px] px-2 py-1 text-xs font-medium rounded-full apple-transition cursor-pointer whitespace-nowrap shrink-0 ${
                    drawerTab === 'settings'
                      ? 'bg-white text-[#1D1D1F] shadow-xs'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
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
                          className={`w-full text-left rounded-2xl border p-3 apple-transition cursor-pointer ${
                            isActive
                              ? 'bg-[#0071E3]/[0.06] border-[#0071E3] shadow-xs'
                              : 'bg-white border-black/[0.06] hover:border-[#0071E3]/40 hover:bg-[#F5F5F7]/70'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#1D1D1F]">
                              {index + 1}. {item.topic_title}
                            </span>
                            <span className="shrink-0 font-mono-tabular text-[11px] text-[#0071E3] font-semibold">
                              {item.steps.length} qadam
                            </span>
                          </div>
                          <div className="text-[11px] text-[#6E6E73] mt-1">
                            {SUBJECT_LABELS_UZ[item.subject]} · {ENGINE_LABELS_UZ[item.engine]}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {extraLessons.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-black/[0.05]">
                      <div className="text-xs font-medium text-[#6E6E73]">
                        Qo‘shimcha fanlar
                      </div>
                      {extraLessons.map((item) => {
                        const isActive = viewMode === 'lesson' && lesson.id === item.id;
                        return (
                          <button
                            key={item.id || item.topic_title}
                            type="button"
                            onClick={() => loadLesson({ ...item, source: 'cache' }, true)}
                            className={`w-full text-left rounded-2xl border p-2.5 apple-transition cursor-pointer ${
                              isActive
                                ? 'bg-[#0071E3]/[0.06] border-[#0071E3]'
                                : 'bg-white border-black/[0.06] hover:border-[#0071E3]/40'
                            }`}
                          >
                            <div className="text-xs font-semibold text-[#1D1D1F]">
                              {item.topic_title}
                            </div>
                            <div className="text-[11px] text-[#6E6E73] mt-0.5">
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
                          className={`group flex items-stretch rounded-2xl border apple-transition ${
                            isActive
                              ? 'bg-[#0071E3]/[0.06] border-[#0071E3]'
                              : 'bg-white border-black/[0.06] hover:border-[#0071E3]/40 hover:bg-[#F5F5F7]/70'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setDrawerOpen(false);
                              loadLesson({ ...entry.lesson, source: 'cache' }, true);
                            }}
                            className="flex-1 min-w-0 text-left px-3.5 py-2.5 cursor-pointer"
                          >
                            <div className="text-xs font-semibold text-[#1D1D1F] truncate">
                              {entry.lesson.topic_title}
                            </div>
                            {normalizeLessonKey(entry.query) !==
                              normalizeLessonKey(entry.lesson.topic_title) && (
                              <div className="text-[11px] text-[#6E6E73] truncate mt-0.5">
                                “{entry.query}”
                              </div>
                            )}
                            <div className="text-[11px] text-[#6E6E73] mt-1 flex items-center gap-1.5">
                              <span>{SUBJECT_LABELS_UZ[entry.lesson.subject]}</span>
                              <span>·</span>
                              <span className="font-mono-tabular text-[#0071E3] font-medium">
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
                            className="px-2.5 text-[#6E6E73] hover:text-rose-600 flex items-center justify-center cursor-pointer"
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
                            void resolveQuery(item, null);
                          }
                        }}
                        className="w-full text-left rounded-2xl border border-black/[0.06] bg-white hover:border-[#0071E3]/40 hover:bg-[#F5F5F7] px-3.5 py-2.5 text-xs font-medium text-[#1D1D1F] apple-transition cursor-pointer"
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
                        className="mt-2.5 min-h-[38px] px-4 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium inline-flex items-center gap-1.5 apple-transition cursor-pointer whitespace-nowrap"
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

                  {/* Reset Defaults */}
                  <button
                    type="button"
                    onClick={() => updateVoiceSettings(DEFAULT_VOICE_SETTINGS, true)}
                    disabled={
                      voiceSettings.rate === DEFAULT_VOICE_SETTINGS.rate &&
                      voiceSettings.pitch === DEFAULT_VOICE_SETTINGS.pitch &&
                      voiceSettings.gender === DEFAULT_VOICE_SETTINGS.gender
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

            {/* Signed-in user email footer inside drawer */}
            <div className="shrink-0 border-t border-slate-200 px-4 py-3 bg-slate-50/80 flex items-center justify-between gap-2">
              {user?.email ? (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-xs font-medium text-slate-700 truncate">
                      {user.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      stopPlayback();
                      setViewMode('home');
                      void logout();
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-xs font-semibold text-slate-700 hover:text-rose-700 inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Chiqish</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    setAuthPendingLabel(undefined);
                    setAuthModalOpen(true);
                  }}
                  className="w-full min-h-[38px] px-4 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium inline-flex items-center justify-center gap-2 apple-transition cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email bilan darsga kirish</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ==================== STEP QUESTION & FINAL PERCENTAGE RESULTS MODAL ==================== */}
      {viewMode === 'lesson' && answerCheckOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Dars yakuniy savoli va natijalar"
        >
          <div className="w-full max-w-xl rounded-3xl bg-white border border-black/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0071E3]">
                  {evalModalView === 'results' ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-[#0071E3]" />
                      <span>Yakuniy natijalar · {lesson.steps.length} ta dars</span>
                    </span>
                  ) : (
                    <span>
                      {activeStepIndex + 1}-dars / {lesson.steps.length} · Nazorat savoli
                    </span>
                  )}
                  {evalModalView === 'question' && isCurrentStepPassed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px]">
                      <CheckCircle2 className="w-3 h-3" />
                      Saqlandi
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#6E6E73] truncate mt-0.5">
                  {evalModalView === 'results'
                    ? lesson.topic_title
                    : cleanStepTitle(currentStep.step_title)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isSpeakingResults) {
                    voiceEngine.stop();
                    setIsSpeakingResults(false);
                  }
                  setAnswerCheckOpen(false);
                }}
                aria-label="Yopish"
                className="w-8 h-8 rounded-full text-[#6E6E73] hover:bg-black/[0.05] hover:text-[#1D1D1F] flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {evalModalView === 'results' ? (
              <div className="p-5 space-y-4 overflow-y-auto">
                {evaluatingLesson || !lessonEvalResult ? (
                  <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
                    <Loader2 className="w-7 h-7 animate-spin text-[#0071E3]" />
                    <div className="text-sm font-medium text-[#1D1D1F]">
                      Barcha dars javoblari tahlil qilinib, foizlarda hisoblanmoqda...
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Overall Percentage Hero Card */}
                    <div className="rounded-2xl border border-black/[0.07] bg-gradient-to-br from-[#F5F8FF] to-white p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-medium text-[#6E6E73]">
                            Umumiy o‘zlashtirish ko‘rsatkichi
                          </div>
                          <div className="flex items-baseline gap-2 mt-0.5">
                            <span
                              className="text-3xl sm:text-4xl font-bold font-mono-tabular text-[#1D1D1F]"
                              style={{ fontFamily: 'var(--font-display)' }}
                            >
                              {lessonEvalResult.overall_percent}%
                            </span>
                            <span
                              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                                lessonEvalResult.overall_percent >= 80
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : lessonEvalResult.overall_percent >= 55
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {lessonEvalResult.overall_percent >= 85
                                ? 'A’lo natija'
                                : lessonEvalResult.overall_percent >= 65
                                ? 'Yaxshi natija'
                                : lessonEvalResult.overall_percent >= 40
                                ? 'Qoniqarli'
                                : 'Qayta ko‘rib chiqing'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (isSpeakingResults) {
                              voiceEngine.stop();
                              setIsSpeakingResults(false);
                            } else {
                              speakEvaluationSummary(lessonEvalResult);
                            }
                          }}
                          className={`h-9 px-3.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 apple-transition cursor-pointer shrink-0 ${
                            isSpeakingResults
                              ? 'bg-[#1D1D1F] text-white'
                              : 'bg-[#0071E3] hover:bg-[#0077ED] text-white'
                          }`}
                        >
                          {isSpeakingResults ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5" />
                              <span>To‘xtatish</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Javoblarni eshitish</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="h-2 w-full rounded-full bg-black/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            lessonEvalResult.overall_percent >= 70
                              ? 'bg-emerald-500'
                              : lessonEvalResult.overall_percent >= 45
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${lessonEvalResult.overall_percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Per-Step Percentage + Correct Answers Breakdown */}
                    <div className="space-y-2.5">
                      {lessonEvalResult.steps.map((item) => (
                        <div
                          key={item.stepIndex}
                          className="rounded-2xl border border-black/[0.07] bg-[#F9F9FB] p-3.5 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold text-[#0071E3]">
                                {item.stepIndex + 1}-dars · {item.stepTitle}
                              </div>
                              <div className="text-xs sm:text-[13px] font-semibold text-[#1D1D1F] mt-0.5 leading-snug">
                                {item.question}
                              </div>
                            </div>
                            <span
                              className={`shrink-0 font-mono-tabular text-xs font-bold px-2.5 py-1 rounded-full ${
                                item.score >= 70
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.score >= 40
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {item.score}%
                            </span>
                          </div>

                          <div className="text-xs text-[#1D1D1F] bg-white rounded-xl border border-black/[0.05] px-3 py-2">
                            <span className="font-semibold text-[#6E6E73]">Sizning javobingiz: </span>
                            <span>{item.userAnswer || '—'}</span>
                          </div>

                          <div className="text-xs text-emerald-950 bg-emerald-50/80 rounded-xl border border-emerald-200/80 px-3 py-2 leading-relaxed">
                            <span className="font-semibold text-emerald-800">To‘g‘ri javob: </span>
                            <span>{item.correct_answer_uz}</span>
                          </div>

                          {item.feedback_uz && (
                            <div className="text-[11px] text-[#6E6E73] px-0.5">
                              {item.feedback_uz}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/[0.06]">
                      <button
                        type="button"
                        onClick={() => {
                          if (isSpeakingResults) {
                            voiceEngine.stop();
                            setIsSpeakingResults(false);
                          }
                          setAnswerCheckOpen(false);
                        }}
                        className="h-10 px-4 rounded-full bg-[#F5F5F7] hover:bg-black/[0.06] text-xs font-medium text-[#1D1D1F] apple-transition cursor-pointer"
                      >
                        Doskaga qaytish
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEvalModalView('question')}
                          className="h-10 px-4 rounded-full border border-black/[0.1] bg-white hover:bg-[#F5F5F7] text-xs font-medium text-[#1D1D1F] apple-transition cursor-pointer"
                        >
                          Javobni tahrirlash
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (isSpeakingResults) {
                              voiceEngine.stop();
                              setIsSpeakingResults(false);
                            }
                            setAnswerCheckOpen(false);
                            stopPlayback();
                            setViewMode('home');
                          }}
                          className="h-10 px-5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 apple-transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Yakunlash</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="p-5 space-y-4 overflow-y-auto">
                {answerLockNotice && !isCurrentStepPassed && (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs font-medium text-amber-900 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>{answerLockNotice}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-[#6E6E73]">
                    Javob yozilmaguncha keyingi darsga o‘tib bo‘lmaydi
                  </div>
                  <h3
                    className="text-base sm:text-[17px] font-semibold text-[#1D1D1F] leading-snug"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {activeOpenQuestion.question}
                  </h3>
                </div>

                <form onSubmit={handleCheckWrittenAnswer} className="space-y-3">
                  <textarea
                    rows={3}
                    value={answerDraft}
                    onFocus={() => setIsMobileTyping(true)}
                    onBlur={() => setIsMobileTyping(false)}
                    onChange={(e) => {
                      setAnswerDraft(e.target.value);
                      if (answerResult) setAnswerResult(null);
                    }}
                    placeholder="O‘z so‘zingiz bilan javob yozing (variant tanlash emas)..."
                    className="w-full rounded-2xl border border-black/[0.1] bg-[#F5F5F7]/70 focus:bg-white px-3.5 py-3 text-sm text-[#1D1D1F] placeholder:text-[#6E6E73]/75 focus:outline-none focus:border-[#0071E3] resize-none"
                  />

                  {answerResult && !answerResult.passed && (
                    <div className="rounded-2xl px-3.5 py-2.5 text-xs border bg-amber-50 border-amber-200 text-amber-950 flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>{answerResult.feedback_uz}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleReplayCurrentStepFromModal}
                      className="h-10 px-4 rounded-full bg-[#F5F5F7] hover:bg-black/[0.06] text-xs font-medium text-[#1D1D1F] inline-flex items-center gap-1.5 apple-transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Qayta eshitish</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {lessonEvalResult && activeStepIndex === lesson.steps.length - 1 && (
                        <button
                          type="button"
                          onClick={() => setEvalModalView('results')}
                          className="h-10 px-4 rounded-full border border-black/[0.1] bg-white hover:bg-[#F5F5F7] text-xs font-medium text-[#1D1D1F] apple-transition cursor-pointer"
                        >
                          Natija ({lessonEvalResult.overall_percent}%)
                        </button>
                      )}

                      <button
                        type="submit"
                        disabled={checkingAnswer || answerDraft.trim().length < 2}
                        className="h-10 px-5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-45 text-white text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 apple-transition cursor-pointer"
                      >
                        {checkingAnswer ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Hisoblanmoqda...</span>
                          </>
                        ) : activeStepIndex + 1 < lesson.steps.length ? (
                          <>
                            <span>Keyingi</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Natijani ko‘rish</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      <AuthGateModal
        open={authModalOpen}
        pendingLabel={authPendingLabel}
        onClose={() => {
          setAuthModalOpen(false);
          pendingActionRef.current = null;
        }}
        onAuthenticated={() => {
          setAuthModalOpen(false);
          const action = pendingActionRef.current;
          pendingActionRef.current = null;
          setAuthPendingLabel(undefined);
          if (action) {
            action();
          }
        }}
      />

      <VideoLessonModal
        open={videoModalOpen}
        initialTab={videoModalPrefill.tab}
        initialVideoFile={videoModalPrefill.file}
        initialYoutubeUrl={videoModalPrefill.youtubeUrl}
        onClose={() => setVideoModalOpen(false)}
        onLessonReady={(videoLesson, queryLabel) => {
          const usage = videoLesson.token_usage ?? ZERO_TOKEN_USAGE;
          setSessionTokenStats((prev) => recordSessionTokenStats(prev, usage));
          saveLessonToCache(queryLabel, videoLesson);
          loadLesson(videoLesson, true);
        }}
      />
      <OfflineIndicator position={viewMode === 'lesson' ? 'top-right' : 'bottom-left'} />
    </div>
  );
}
