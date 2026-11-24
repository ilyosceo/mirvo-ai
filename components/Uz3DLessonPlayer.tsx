import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Box,
  Camera,
  CheckCircle2,
  Chrome,
  Film,
  Image as ImageIcon,
  Layers,
  ListVideo,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  X,
  Youtube,
} from 'lucide-react';
import type {
  EmojiMimicState,
  ModelHotspotSpec,
  Uz3DLessonResponse,
  Uz3DSegment,
} from '../types/uz3d';
import type { LessonBeat, RenderParams, StageAnchorsMap } from '../types/tutor';
import { findCatalogModel, MOCK_UZ3D_LESSONS } from '../lib/modelCatalog';
import { extractCompressedMonoMp3FromFile } from '../lib/audioExtractor';
import { findSavedUz3DLesson, saveUz3DLessonEntry } from '../lib/lessonStorage';
import {
  getCachedVideoLessonFromFirestore,
  saveVideoLessonToFirestore,
  type User,
} from '../lib/firebaseClient';
import {
  clampVoiceRate,
  cycleVoiceRatePreset,
  formatVoiceRate,
  voiceEngine,
  type VoiceSettings,
} from '../lib/voiceEngine';
import { ThreeDStage } from './engines/ThreeDStage';
import { MirvoMentor } from './MirvoMentor';
import { TeacherStageActor } from './TeacherStageActor';
import { MirvoLogo } from './MirvoLogo';
import { KaTeXBlock } from './KaTeXBlock';
import { safeParseJson, safeParseJsonOrNull } from '../lib/safeFetchJson';

interface Uz3DLessonPlayerProps {
  initialLesson?: Uz3DLessonResponse | null;
  user: User | null;
  voiceSettings: VoiceSettings;
  onChangeVoiceRate?: (rate: number) => void;
  onBackHome: () => void;
  onOpenWhiteboard?: () => void;
  onLessonChanged?: (lesson: Uz3DLessonResponse) => void;
}

const MIMIC_META: Record<
  EmojiMimicState,
  { labelUz: string; accentClass: string; tiltDeg: number; pose: 'approach' | 'step_back' | 'formula_check' }
> = {
  explaining: {
    labelUz: 'Tushuntirmoqda',
    accentClass: 'text-blue-700 bg-blue-50 border-blue-200',
    tiltDeg: 0,
    pose: 'approach',
  },
  amazed: {
    labelUz: 'Muhim kashfiyot',
    accentClass: 'text-amber-700 bg-amber-50 border-amber-200',
    tiltDeg: 4,
    pose: 'approach',
  },
  thinking: {
    labelUz: 'Tahlil qilmoqda',
    accentClass: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    tiltDeg: -6,
    pose: 'formula_check',
  },
  happy: {
    labelUz: 'Xulosa',
    accentClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    tiltDeg: 0,
    pose: 'step_back',
  },
  warning: {
    labelUz: 'E’tibor bering',
    accentClass: 'text-rose-700 bg-rose-50 border-rose-200',
    tiltDeg: 5,
    pose: 'formula_check',
  },
};

function formatTimeSec(sec: number): string {
  const clean = Math.max(0, Math.round(sec));
  const m = Math.floor(clean / 60);
  const s = clean % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function extractYouTubeVideoId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function hotspotToCameraPreset(spot?: ModelHotspotSpec): [number, number, number] {
  if (!spot || spot.id === 'overview') {
    return [4.8, 3.4, 5.8];
  }
  const [px, py, pz] = spot.position_3d;
  const dist = 3.8;
  const dx = px >= 0 ? 2.4 : -2.4;
  const dz = pz >= 0 ? dist : -dist;
  return [px + dx, Math.max(2.1, py + 2.0), dz];
}

export const Uz3DLessonPlayer: React.FC<Uz3DLessonPlayerProps> = ({
  initialLesson,
  user,
  voiceSettings,
  onChangeVoiceRate,
  onBackHome,
  onOpenWhiteboard,
  onLessonChanged,
}) => {
  const [lesson, setLesson] = useState<Uz3DLessonResponse>(
    () => initialLesson || MOCK_UZ3D_LESSONS[0]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [manualHotspot, setManualHotspot] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showYouTubeEmbed, setShowYouTubeEmbed] = useState(Boolean(initialLesson?.video_id));
  const [glbLoadFailed, setGlbLoadFailed] = useState(false);
  const [stageAnchors, setStageAnchors] = useState<StageAnchorsMap>({});
  const [timelineOpen, setTimelineOpen] = useState(false);

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceActivity, setVoiceActivity] = useState(0);
  const muteTimerRef = useRef<number | null>(null);
  const voiceRateRef = useRef(voiceSettings.rate);
  voiceRateRef.current = voiceSettings.rate;

  // 3-Channel Generator Drawer/Modal state
  const [inputModalOpen, setInputModalOpen] = useState(false);
  const [inputTab, setInputTab] = useState<'youtube' | 'audio' | 'topic' | 'extension'>('youtube');
  const [ytInput, setYtInput] = useState('');
  const [ytSubtitles, setYtSubtitles] = useState('');
  const [ytTopic, setYtTopic] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [imagePayload, setImagePayload] = useState<{
    name: string;
    base64: string;
    mime: string;
    previewUrl: string;
  } | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioProgress, setAudioProgress] = useState<{ pct: number; label: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const segmentsRef = useRef(lesson.segments);
  segmentsRef.current = lesson.segments;

  useEffect(() => {
    if (initialLesson) {
      setLesson(initialLesson);
      setActiveIndex(0);
      setManualHotspot(null);
      setGlbLoadFailed(false);
      setShowYouTubeEmbed(Boolean(initialLesson.video_id));
    }
  }, [initialLesson]);

  const stopSpeech = useCallback(() => {
    if (muteTimerRef.current !== null) {
      window.clearTimeout(muteTimerRef.current);
      muteTimerRef.current = null;
    }
    voiceEngine.stop();
    setIsPlaying(false);
    setVoiceActivity(0);
  }, []);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

  const activeSegment: Uz3DSegment = useMemo(
    () => lesson.segments[activeIndex] || lesson.segments[0],
    [lesson.segments, activeIndex]
  );

  const catalogModel = useMemo(
    () => findCatalogModel(lesson.selected_model_id),
    [lesson.selected_model_id]
  );

  const effectiveHotspots = useMemo(
    () =>
      lesson.custom_hotspots && lesson.custom_hotspots.length > 0
        ? lesson.custom_hotspots
        : catalogModel.hotspots,
    [lesson.custom_hotspots, catalogModel.hotspots]
  );

  const effectivePrimitives = useMemo(
    () =>
      lesson.custom_primitives_3d && lesson.custom_primitives_3d.length > 0
        ? lesson.custom_primitives_3d
        : catalogModel.primitives_3d || [],
    [lesson.custom_primitives_3d, catalogModel.primitives_3d]
  );

  const activeHotspotId = manualHotspot || activeSegment?.camera_hotspot || 'overview';
  const activeHotspot = useMemo(
    () =>
      effectiveHotspots.find((h) => h.id === activeHotspotId) ||
      effectiveHotspots[0],
    [effectiveHotspots, activeHotspotId]
  );

  const mimicMeta = MIMIC_META[activeSegment?.emoji_mimic || 'explaining'];

  const threeDParams = useMemo<RenderParams>(() => {
    return {
      shape: 'composite3d',
      object_name_en: lesson.selected_model_id || catalogModel.id,
      object_name_uz: lesson.lesson_title_uz || catalogModel.title_uz,
      primitives_3d: effectivePrimitives,
      show_axes: true,
    };
  }, [lesson.selected_model_id, lesson.lesson_title_uz, catalogModel.id, catalogModel.title_uz, effectivePrimitives]);

  const threeDCameraPreset = useMemo(
    () => hotspotToCameraPreset(activeHotspot),
    [activeHotspot]
  );

  const uz3dActiveBeat = useMemo<LessonBeat>(() => {
    const isOverview = activeHotspotId === 'overview';
    return {
      sentence: activeSegment?.uzbek_explanation || '',
      focus_target: activeHotspotId || 'overview',
      focusPart: isOverview ? undefined : activeHotspotId,
      tutor_pose: isOverview
        ? 'step_back'
        : mimicMeta.pose === 'step_back'
        ? 'approach'
        : mimicMeta.pose,
      camera_zoom: isOverview ? 1.0 : 1.55,
      dimInactiveParts: !isOverview,
      note: activeHotspot?.label_uz || activeSegment?.uzbek_title,
    };
  }, [activeHotspotId, activeSegment, activeHotspot, mimicMeta.pose]);

  const playSegment = useCallback(
    (idx: number, mutedOverride?: boolean, rateOverride?: number) => {
      const segs = segmentsRef.current;
      const seg = segs[idx];
      if (!seg) return;

      if (muteTimerRef.current !== null) {
        window.clearTimeout(muteTimerRef.current);
        muteTimerRef.current = null;
      }
      voiceEngine.stop();
      voiceEngine.unlockAudio();

      setActiveIndex(idx);
      setManualHotspot(null);
      const mutedNow = mutedOverride ?? isMuted;
      const effectiveSettings: VoiceSettings = {
        ...voiceSettings,
        rate: clampVoiceRate(rateOverride ?? voiceRateRef.current),
      };

      if (mutedNow) {
        setIsPlaying(true);
        setVoiceActivity(0);
        const durationMs = Math.max(
          3200,
          Math.min(12000, Math.round(((seg.end_sec - seg.start_sec) * 400) / effectiveSettings.rate))
        );
        muteTimerRef.current = window.setTimeout(() => {
          const nextIdx = idx + 1;
          if (nextIdx < segmentsRef.current.length) {
            playSegment(nextIdx, true);
          } else {
            setIsPlaying(false);
          }
        }, durationMs);
        return;
      }

      voiceEngine.speak(
        seg.uzbek_explanation,
        {
          onStart: () => {
            setIsPlaying(true);
            setVoiceActivity(0.35);
          },
          onTick: (open) => {
            setVoiceActivity(open);
          },
          onEnd: () => {
            setVoiceActivity(0);
            const nextIdx = idx + 1;
            if (nextIdx < segmentsRef.current.length) {
              muteTimerRef.current = window.setTimeout(() => {
                playSegment(nextIdx);
              }, 550);
            } else {
              setIsPlaying(false);
            }
          },
        },
        true,
        effectiveSettings
      );
    },
    [isMuted, voiceSettings]
  );

  const handleSelectSegment = (idx: number) => {
    setManualHotspot(null);
    if (isPlaying) {
      playSegment(idx);
    } else {
      setActiveIndex(idx);
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      stopSpeech();
    } else {
      playSegment(activeIndex);
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (isPlaying) {
      playSegment(activeIndex, nextMuted);
    }
  };

  const applyRateLive = (nextRateRaw: number) => {
    const nextRate = clampVoiceRate(nextRateRaw);
    voiceRateRef.current = nextRate;
    onChangeVoiceRate?.(nextRate);
    if (!isPlaying) return;
    if (voiceEngine.setPlaybackRateLive(nextRate)) return;
    playSegment(activeIndex, isMuted, nextRate);
  };

  const applyGeneratedLesson = useCallback(
    async (nextLesson: Uz3DLessonResponse) => {
      stopSpeech();
      setStageAnchors({});
      setLesson(nextLesson);
      onLessonChanged?.(nextLesson);
      saveUz3DLessonEntry(nextLesson);
      setActiveIndex(0);
      setManualHotspot(null);
      setGlbLoadFailed(false);
      setShowYouTubeEmbed(Boolean(nextLesson.video_id));
      setInputModalOpen(false);
      if (nextLesson.video_id && user?.emailVerified) {
        await saveVideoLessonToFirestore(user, nextLesson).catch(() => {});
      }
    },
    [stopSpeech, user, onLessonChanged]
  );

  const handleGenerateYouTube = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenError(null);
    const parsedVideoId = extractYouTubeVideoId(ytInput);
    const cleanSubs = ytSubtitles.trim();
    const cleanTopic = ytTopic.trim();

    if (!parsedVideoId && !cleanSubs && !cleanTopic) {
      setGenError('YouTube havolasini, subtitr matnini yoki mavzu nomini kiriting.');
      return;
    }

    setGenerating(true);
    try {
      // 1. Check $0 LocalStorage, Firestore & Server Cache first when video_id is available
      if (parsedVideoId) {
        const localHit = findSavedUz3DLesson(parsedVideoId);
        if (localHit) {
          await applyGeneratedLesson(localHit);
          return;
        }
        const fsHit = await getCachedVideoLessonFromFirestore(user, parsedVideoId).catch(
          () => null
        );
        if (fsHit) {
          await applyGeneratedLesson(fsHit);
          return;
        }
        const cacheRes = await fetch(
          `/api/generate-lesson?video_id=${encodeURIComponent(parsedVideoId)}`
        );
        if (cacheRes.ok) {
          const cachedPayload = await safeParseJsonOrNull<Uz3DLessonResponse>(cacheRes);
          if (
            cachedPayload &&
            Array.isArray(cachedPayload.segments) &&
            cachedPayload.segments.length > 0
          ) {
            await applyGeneratedLesson(cachedPayload);
            return;
          }
        }
      }

      const res = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'youtube_subtitles',
          video_id: parsedVideoId || undefined,
          topic: cleanTopic || (parsedVideoId ? `YouTube darsi (${parsedVideoId})` : undefined),
          subtitles: cleanSubs || undefined,
        }),
      });
      const payload = await safeParseJson<Uz3DLessonResponse & { error?: string }>(
        res,
        'Dars tuzib bo‘lmadi.'
      );
      if (!res.ok || !Array.isArray(payload.segments)) {
        throw new Error(payload.error || 'Dars tuzib bo‘lmadi.');
      }
      await applyGeneratedLesson(payload);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Xatolik yuz berdi.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateLocalAudio = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenError(null);
    if (!audioFile) {
      setGenError('Iltimos, lokal .mp4, .webm yoki audio fayl tanlang.');
      return;
    }
    setGenerating(true);
    try {
      const extracted = await extractCompressedMonoMp3FromFile(audioFile, (pct, label) => {
        setAudioProgress({ pct, label });
      });
      setAudioProgress({
        pct: 98,
        label: `Siqildi: ${extracted.sizeKb} KB (${extracted.durationSec}s · 16kHz MP3). AI tahlil qilmoqda...`,
      });

      const res = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'local_audio',
          audio_base64: extracted.base64,
          audio_mime: extracted.mimeType,
          topic: audioFile.name.replace(/\.[^.]+$/, ''),
        }),
      });
      const payload = await safeParseJson<Uz3DLessonResponse & { error?: string }>(
        res,
        'Audiodan dars tuzib bo‘lmadi.'
      );
      if (!res.ok || !Array.isArray(payload.segments)) {
        throw new Error(payload.error || 'Audiodan dars tuzib bo‘lmadi.');
      }
      setAudioFile(null);
      setAudioProgress(null);
      await applyGeneratedLesson(payload);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Audio ajratishda xatolik yuz berdi.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateTopicOrImage = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenError(null);
    if (!topicInput.trim() && !imagePayload) {
      setGenError('Mavzu matnini yozing yoki darslik rasmini yuklang.');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'image_or_topic',
          topic: topicInput.trim() || imagePayload?.name || 'Interaktiv 3D dars',
          image_base64: imagePayload?.base64,
          image_mime: imagePayload?.mime,
        }),
      });
      const payload = await safeParseJson<Uz3DLessonResponse & { error?: string }>(
        res,
        'Dars tuzib bo‘lmadi.'
      );
      if (!res.ok || !Array.isArray(payload.segments)) {
        throw new Error(payload.error || 'Dars tuzib bo‘lmadi.');
      }
      setTopicInput('');
      setImagePayload(null);
      await applyGeneratedLesson(payload);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Xatolik yuz berdi.');
    } finally {
      setGenerating(false);
    }
  };

  const handleImagePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.split(',')[1] || '';
      setImagePayload({
        name: file.name,
        base64,
        mime: file.type || 'image/jpeg',
        previewUrl: dataUrl,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const useModelViewerGlb = Boolean(lesson.model_glb_url && !glbLoadFailed);
  const is2DBoardFallback =
    lesson.selected_model_id === 'none_2d_board' &&
    !useModelViewerGlb &&
    effectivePrimitives.length === 0;

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#F5F5F7] text-[#1D1D1F] overflow-hidden">
      {/* Hidden File Pickers */}
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImagePicked}
        className="hidden"
      />
      <input
        ref={videoFileInputRef}
        type="file"
        accept="video/*,audio/*"
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          setAudioFile(file);
          setAudioProgress(null);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* ==================== ULTRA-SLIM TOP HEADER (h-11) ==================== */}
      <header className="h-11 shrink-0 apple-glass border-b border-black/5 px-2.5 sm:px-4 flex items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => {
              stopSpeech();
              onBackHome();
            }}
            aria-label="Bosh sahifaga qaytish"
            className="w-8 h-8 rounded-full border border-black/[0.06] bg-white hover:bg-[#F5F5F7] flex items-center justify-center text-[#1D1D1F] cursor-pointer shrink-0 apple-transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="hidden sm:block shrink-0">
            <MirvoLogo size="sm" />
          </div>
          <span className="font-mono-tabular text-[11px] font-semibold text-[#0071E3] shrink-0">
            {activeIndex + 1}/{lesson.segments.length}
          </span>
          <h1 className="text-xs font-semibold text-[#1D1D1F] truncate max-w-[140px] sm:max-w-[260px]">
            {lesson.lesson_title_uz}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
          {!is2DBoardFallback && (
            <button
              type="button"
              onClick={() => setAutoRotate((v) => !v)}
              aria-pressed={autoRotate}
              className={`h-8 px-2.5 rounded-full border text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap apple-transition ${
                autoRotate
                  ? 'bg-[#0071E3] border-[#0071E3] text-white'
                  : 'bg-white border-black/[0.06] text-[#1D1D1F] hover:bg-[#F5F5F7]'
              }`}
            >
              <RotateCw className={`w-3 h-3 ${autoRotate ? 'animate-spin' : ''}`} />
              <span>360°</span>
            </button>
          )}

          {lesson.video_id && (
            <button
              type="button"
              onClick={() => setShowYouTubeEmbed((v) => !v)}
              className={`h-8 px-2.5 rounded-full border text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap apple-transition ${
                showYouTubeEmbed
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-white border-black/[0.06] text-[#1D1D1F] hover:bg-[#F5F5F7]'
              }`}
            >
              <Youtube className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{showYouTubeEmbed ? 'Video yopish' : 'Video'}</span>
            </button>
          )}

          {onOpenWhiteboard && (
            <button
              type="button"
              onClick={() => {
                stopSpeech();
                onOpenWhiteboard();
              }}
              className="hidden sm:inline-flex h-8 px-2.5 rounded-full border border-black/[0.06] bg-white hover:bg-[#F5F5F7] text-[11px] font-medium text-[#1D1D1F] items-center gap-1 cursor-pointer whitespace-nowrap apple-transition"
            >
              <Layers className="w-3.5 h-3.5 text-[#0071E3]" />
              <span>2D/3D</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setTimelineOpen((v) => !v)}
            aria-expanded={timelineOpen}
            className={`h-8 px-2.5 sm:px-3 rounded-full border text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap apple-transition ${
              timelineOpen
                ? 'bg-[#1D1D1F] border-[#1D1D1F] text-white'
                : 'bg-white border-black/[0.06] text-[#1D1D1F] hover:bg-[#F5F5F7]'
            }`}
          >
            <ListVideo className="w-3.5 h-3.5 text-[#0071E3]" />
            <span className="hidden sm:inline">Epizodlar</span>
            <span className="font-mono-tabular text-[10px] opacity-75">
              {lesson.segments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setGenError(null);
              setInputModalOpen(true);
            }}
            className="h-8 px-3 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[11px] font-medium inline-flex items-center gap-1 apple-transition cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Yangi</span>
          </button>
        </div>
      </header>

      {/* ==================== FULL-BLEED 3D/2D WHITEBOARD (~90% OF VIEWPORT) ==================== */}
      <main className="flex-1 min-h-0 p-1.5 sm:p-2.5 w-full overflow-hidden flex flex-col">
        <section className="relative flex-1 min-h-0 w-full rounded-2xl sm:rounded-3xl apple-freeform-dots border border-black/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
          {/* Compact Top-Left Active Focus Chip */}
          <div className="pointer-events-none absolute top-3 left-3 sm:top-4 sm:left-4 z-10 apple-glass rounded-full px-3 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.05)] inline-flex items-center gap-1.5 max-w-[65%]">
            <Camera className="w-3 h-3 text-[#0071E3] shrink-0" />
            <span className="text-[11px] font-medium text-[#1D1D1F] truncate">
              {activeHotspot?.label_uz || activeSegment.uzbek_title}
            </span>
          </div>

          <div className="flex-1 min-h-0 relative">
            {useModelViewerGlb ? (
              <ThreeDStage
                params={threeDParams}
                sliderValues={{}}
                cameraPreset={threeDCameraPreset}
              />
            ) : is2DBoardFallback ? (
              <div className="w-full h-full flex items-center justify-center p-6 sm:p-10">
                <div className="max-w-xl w-full rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="font-mono-tabular text-xs font-semibold text-blue-700">
                    {formatTimeSec(activeSegment.start_sec)} – {formatTimeSec(activeSegment.end_sec)} · 2D Doska rejimi
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {activeSegment.uzbek_title}
                  </h2>
                  {activeSegment.key_formula_or_term && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 overflow-x-auto">
                      <KaTeXBlock
                        latex={activeSegment.key_formula_or_term}
                        displayMode
                        className="text-base text-slate-900"
                      />
                    </div>
                  )}
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {activeSegment.uzbek_explanation}
                  </p>
                </div>
              </div>
            ) : (
              <ThreeDStage
                params={threeDParams}
                sliderValues={{ scale: 1.0 }}
                cameraPreset={threeDCameraPreset}
                autoRotate={autoRotate}
                focusPart={activeHotspotId}
                dimInactiveParts={activeHotspotId !== 'overview'}
                cameraZoom={activeHotspotId === 'overview' ? 1.0 : 1.55}
                stepIndex={activeHotspotId === 'overview' ? 0 : 1}
                isPlaying={isPlaying}
                onAnchorsChange={setStageAnchors}
              />
            )}

            {/* Spatial Choreographed Mirvo Mentor over 3D Stage */}
            {!is2DBoardFallback && !useModelViewerGlb && (
              <TeacherStageActor
                activeBeat={uz3dActiveBeat}
                anchors={stageAnchors}
                isSpeaking={isPlaying && !isMuted}
                isPlaying={isPlaying}
                isListening={false}
                mouthOpen={voiceActivity}
              />
            )}

            {/* Official YouTube IFrame Embed */}
            {showYouTubeEmbed && lesson.video_id && (
              <div className="absolute top-12 left-3 z-20 w-52 sm:w-64 rounded-xl overflow-hidden border border-slate-300 bg-slate-900 shadow-md">
                <div className="aspect-video w-full">
                  <iframe
                    title={lesson.lesson_title_uz}
                    src={`https://www.youtube.com/embed/${encodeURIComponent(
                      lesson.video_id
                    )}?rel=0&start=${Math.max(0, Math.round(activeSegment.start_sec))}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            )}

            {/* Inline Mentor Fallback for GLB / 2D */}
            {(is2DBoardFallback || useModelViewerGlb) && (
              <div className="pointer-events-none absolute bottom-16 right-3 z-20">
                <MirvoMentor
                  isSpeaking={isPlaying && !isMuted}
                  isDrawing={activeSegment.emoji_mimic === 'explaining' || activeSegment.emoji_mimic === 'amazed'}
                  isNodding={activeSegment.emoji_mimic === 'happy'}
                  voiceActivity={voiceActivity}
                  tiltDeg={mimicMeta.tiltDeg}
                  pose={mimicMeta.pose}
                  speechRate={voiceSettings.rate}
                  speechPitch={voiceSettings.pitch}
                  size={52}
                />
              </div>
            )}

            {/* Compact Synchronized Subtitle Pill above Floating Dock */}
            <div className="pointer-events-none absolute bottom-16 sm:bottom-[68px] left-3 right-3 z-20 flex justify-center">
              <div className="bg-[#1D1D1F]/86 text-white backdrop-blur-md border border-white/10 rounded-full px-4 py-1.5 text-xs sm:text-[13px] font-medium leading-snug text-center shadow-[0_8px_24px_rgba(0,0,0,0.16)] max-w-2xl truncate sm:whitespace-normal">
                {activeSegment.uzbek_explanation}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FLOATING COMPACT BOTTOM CONTROL DOCK */}
      <div className="fixed bottom-3 sm:bottom-3.5 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100vw-1rem)]">
        <div
          role="toolbar"
          aria-label="3D Dars boshqaruv paneli"
          className="apple-glass rounded-full shadow-[0_12px_36px_rgba(0,0,0,0.12)] px-2 sm:px-3 py-1 flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar"
        >
          <button
            type="button"
            onClick={() => handleSelectSegment(Math.max(0, activeIndex - 1))}
            disabled={activeIndex === 0}
            aria-label="Oldingi epizod"
            className="w-8 h-8 rounded-full hover:bg-black/[0.06] disabled:opacity-35 flex items-center justify-center cursor-pointer shrink-0"
          >
            <SkipBack className="w-3.5 h-3.5 text-[#1D1D1F]" />
          </button>

          <button
            type="button"
            onClick={handleTogglePlay}
            className="h-9 px-3.5 sm:px-4 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap apple-transition shrink-0"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pauza' : 'Eshitish'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleSelectSegment(Math.min(lesson.segments.length - 1, activeIndex + 1))
            }
            disabled={activeIndex >= lesson.segments.length - 1}
            aria-label="Keyingi epizod"
            className="w-8 h-8 rounded-full hover:bg-black/[0.06] disabled:opacity-35 flex items-center justify-center cursor-pointer shrink-0"
          >
            <SkipForward className="w-3.5 h-3.5 text-[#1D1D1F]" />
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Ovozni yoqish' : 'Ovozni o‘chirish'}
            className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shrink-0 ${
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
              onClick={() => applyRateLive(voiceSettings.rate - 0.1)}
              disabled={voiceSettings.rate <= 0.7}
              aria-label="Nutqni sekinlashtirish"
              title="Sekinlashtirish (−0.1×)"
              className="w-7 h-7 rounded-full hover:bg-white disabled:opacity-35 text-[#1D1D1F] flex items-center justify-center apple-transition cursor-pointer shrink-0"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyRateLive(cycleVoiceRatePreset(voiceSettings.rate))}
              aria-label={`Nutq tezligi ${formatVoiceRate(voiceSettings.rate)}. O‘zgartirish uchun bosing`}
              title="Tezlikni almashtirish (0.8× / 1.0× / 1.25× / 1.5×)"
              className="min-w-[40px] h-7 px-1.5 rounded-full hover:bg-white font-mono-tabular text-[11px] font-semibold text-[#1D1D1F] flex items-center justify-center apple-transition cursor-pointer whitespace-nowrap shrink-0"
            >
              {formatVoiceRate(voiceSettings.rate)}
            </button>
            <button
              type="button"
              onClick={() => applyRateLive(voiceSettings.rate + 0.1)}
              disabled={voiceSettings.rate >= 1.5}
              aria-label="Nutqni tezlashtirish"
              title="Tezlashtirish (+0.1×)"
              className="w-7 h-7 rounded-full hover:bg-white disabled:opacity-35 text-[#1D1D1F] flex items-center justify-center apple-transition cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Compact Hotspot Chips */}
          {effectiveHotspots.length > 0 && (
            <div className="hidden md:flex items-center gap-1 pl-1 border-l border-black/[0.08] shrink-0">
              {effectiveHotspots.slice(0, 5).map((spot) => {
                const selected = spot.id === activeHotspotId;
                return (
                  <button
                    key={spot.id}
                    type="button"
                    onClick={() => setManualHotspot(spot.id)}
                    className={`h-7 px-2.5 rounded-full text-[11px] font-medium apple-transition cursor-pointer whitespace-nowrap shrink-0 ${
                      selected
                        ? 'bg-[#0071E3] text-white'
                        : 'bg-black/[0.04] text-[#1D1D1F] hover:bg-black/[0.08]'
                    }`}
                  >
                    {spot.label_uz}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ON-DEMAND SLIDE-OVER TIMELINE & EXPLANATION DRAWER */}
      {timelineOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] flex justify-end"
          onClick={() => setTimelineOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            aria-label="Dars epizodlari va izoh"
            className="w-[380px] max-w-[94vw] h-full bg-white border-l border-black/[0.06] shadow-[0_24px_60px_rgba(0,0,0,0.14)] flex flex-col"
          >
            <div className="px-5 py-3.5 border-b border-black/[0.05] flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#0071E3]">
                  Epizod {activeIndex + 1} / {lesson.segments.length}
                </div>
                <div className="text-xs text-[#6E6E73] truncate">{lesson.lesson_title_uz}</div>
              </div>
              <button
                type="button"
                onClick={() => setTimelineOpen(false)}
                aria-label="Epizodlar panelini yopish"
                className="w-8 h-8 rounded-full text-[#6E6E73] hover:bg-black/[0.05] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-black/[0.05] space-y-2.5 shrink-0">
              <h2 className="text-base font-bold text-[#1D1D1F] leading-snug">
                {activeSegment.uzbek_title}
              </h2>
              <p className="text-sm text-[#6E6E73] leading-relaxed">
                {activeSegment.uzbek_explanation}
              </p>
              {activeSegment.key_formula_or_term && (
                <div className="rounded-xl border border-black/[0.06] bg-[#F5F5F7] px-3 py-2 overflow-x-auto">
                  <KaTeXBlock
                    latex={activeSegment.key_formula_or_term}
                    displayMode={false}
                    className="text-sm font-semibold text-[#1D1D1F]"
                  />
                </div>
              )}
              {effectiveHotspots.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {effectiveHotspots.map((spot) => {
                    const selected = spot.id === activeHotspotId;
                    return (
                      <button
                        key={spot.id}
                        type="button"
                        onClick={() => setManualHotspot(spot.id)}
                        className={`h-7 px-2.5 rounded-full text-[11px] font-medium cursor-pointer ${
                          selected
                            ? 'bg-[#0071E3] text-white'
                            : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-black/[0.08]'
                        }`}
                      >
                        {spot.label_uz}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-2 academic-scroll">
              {lesson.segments.map((seg, idx) => {
                const isCurrent = idx === activeIndex;
                const segSpot = effectiveHotspots.find((h) => h.id === seg.camera_hotspot);
                const segMimic = MIMIC_META[seg.emoji_mimic || 'explaining'];
                return (
                  <button
                    key={`${seg.start_sec}-${idx}`}
                    type="button"
                    onClick={() => handleSelectSegment(idx)}
                    className={`w-full text-left rounded-2xl border p-3 transition-colors cursor-pointer space-y-1 ${
                      isCurrent
                        ? 'border-[#0071E3] bg-[#0071E3]/[0.06]'
                        : 'border-black/[0.06] bg-white hover:bg-[#F5F5F7]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular">
                      <span className={isCurrent ? 'font-bold text-[#0071E3]' : 'text-[#6E6E73]'}>
                        {formatTimeSec(seg.start_sec)} – {formatTimeSec(seg.end_sec)}
                      </span>
                      <span className="text-[#6E6E73] truncate">{segMimic.labelUz}</span>
                    </div>
                    <div className="text-sm font-semibold text-[#1D1D1F] leading-snug">
                      {seg.uzbek_title}
                    </div>
                    <div className="text-xs text-[#6E6E73] line-clamp-2 leading-relaxed">
                      {seg.uzbek_explanation}
                    </div>
                    {segSpot && (
                      <div className="text-[11px] font-medium text-[#0071E3] pt-0.5">
                        Kamera: {segSpot.label_uz}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      {/* ==================== 3-CHANNEL GENERATOR MODAL ==================== */}
      {inputModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Yangi Uz3D dars yaratish"
        >
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Yangi Uz3D Interaktiv Dars
                </h2>
                <p className="text-xs text-slate-500">
                  3 ta mustaqil oqim: YouTube subtitr, Lokal MP4 (16kHz MP3), yoki Rasm / Mavzu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInputModalOpen(false)}
                aria-label="Yopish"
                className="min-h-[36px] min-w-[36px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-700" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-5 pt-3 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
              {(
                [
                  { id: 'youtube', label: 'Oqim A: YouTube', icon: Youtube },
                  { id: 'audio', label: 'Oqim B: Lokal MP4', icon: Film },
                  { id: 'topic', label: 'Oqim C: Rasm / Mavzu', icon: Sparkles },
                  { id: 'extension', label: 'Chrome Kengaytma', icon: Chrome },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = inputTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setGenError(null);
                      setInputTab(tab.id);
                    }}
                    className={`min-h-[40px] px-3 py-2 rounded-t-xl border-b-2 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-blue-600 text-blue-700 bg-blue-50/40'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {genError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                  {genError}
                </div>
              )}

              {inputTab === 'youtube' && (
                <form onSubmit={handleGenerateYouTube} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      YouTube video havolasi yoki ID
                    </label>
                    <input
                      type="text"
                      value={ytInput}
                      onChange={(e) => setYtInput(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=LAtMWODF0Tg"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mavzu sarlavhasi (ixtiyoriy)
                    </label>
                    <input
                      type="text"
                      value={ytTopic}
                      onChange={(e) => setYtTopic(e.target.value)}
                      placeholder="Masalan: Elektr dvigatel ishlash prinsipi"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Vaqt belgili subtitrlar (Chrome Extension yoki qo‘lda)
                    </label>
                    <textarea
                      rows={5}
                      value={ytSubtitles}
                      onChange={(e) => setYtSubtitles(e.target.value)}
                      placeholder="[00:00] Today we study how a DC electric motor converts electrical energy..."
                      className="w-full p-3.5 rounded-xl border border-slate-200 text-xs font-mono-tabular focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Serverda video yuklanmaydi. Agar ushbu video_id avval tahlil qilingan bo‘lsa, keshdan $0 xarajat bilan ochiladi.
                  </div>
                  <button
                    type="submit"
                    disabled={generating}
                    className="w-full min-h-[44px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Box className="w-4 h-4" />}
                    <span>{generating ? 'Tahlil qilinmoqda...' : 'Uz3D darsni yaratish'}</span>
                  </button>
                </form>
              )}

              {inputTab === 'audio' && (
                <form onSubmit={handleGenerateLocalAudio} className="space-y-4">
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center space-y-3">
                    <Upload className="w-7 h-7 text-blue-600 mx-auto" />
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-slate-900">
                        Lokal MP4 yoki video faylni tanlang
                      </div>
                      <p className="text-xs text-slate-600 max-w-md mx-auto">
                        Video serverga yuklanmaydi. Brauzeringiz Web Audio API orqali faqat 16 kHz mono MP3 audio yo‘lakchani ajratib yuboradi.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => videoFileInputRef.current?.click()}
                      className="min-h-[40px] px-4 rounded-xl border border-slate-300 bg-white hover:border-blue-500 text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      {audioFile ? `Tanlandi: ${audioFile.name}` : 'Fayl tanlash (.mp4 / .webm / .mp3)'}
                    </button>
                  </div>

                  {audioProgress && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-blue-800">
                        <span>{audioProgress.label}</span>
                        <span className="font-mono-tabular">{audioProgress.pct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-blue-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all"
                          style={{ width: `${audioProgress.pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={generating || !audioFile}
                    className="w-full min-h-[44px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
                    <span>{generating ? 'Audio siqilmoqda va tahlil qilinmoqda...' : 'MP3 ajratish va dars tuzish'}</span>
                  </button>
                </form>
              )}

              {inputTab === 'topic' && (
                <form onSubmit={handleGenerateTopicOrImage} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mavzu yoki savol
                    </label>
                    <input
                      type="text"
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      placeholder="Masalan: Inson yuragidagi qon aylanishi yoki Bor atom modeli"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ImageIcon className="w-5 h-5 text-blue-600 shrink-0" />
                      <span className="text-xs text-slate-700 truncate">
                        {imagePayload ? imagePayload.name : 'Darslik rasmi (ixtiyoriy)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {imagePayload && (
                        <button
                          type="button"
                          onClick={() => setImagePayload(null)}
                          className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          O‘chirish
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => imageFileInputRef.current?.click()}
                        className="min-h-[36px] px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 cursor-pointer"
                      >
                        Rasm tanlash
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={generating}
                    className="w-full min-h-[44px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                    <span>{generating ? 'Dars tayyorlanmoqda...' : '3D Darsni Boshlash'}</span>
                  </button>
                </form>
              )}

              {inputTab === 'extension' && (
                <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>YouTube Subtitr Chrome Kengaytmasi (Manifest V3)</span>
                    </div>
                    <p>
                      Serverda YouTube video yuklash (yt-dlp/pytube) taqiqlangan. Kengaytma to‘g‘ridan-to‘g‘ri brauzeringizdagi YouTube sahifasidan subtitrlarni o‘qiydi va ushbu platformaga yuboradi.
                    </p>
                  </div>
                  <ol className="list-decimal pl-5 space-y-1.5">
                    <li>
                      Chrome brauzerida <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">chrome://extensions</code> sahifasini oching.
                    </li>
                    <li>
                      Yuqori o‘ng burchakda <strong>Developer mode</strong> rejimini yoqing.
                    </li>
                    <li>
                      <strong>Load unpacked</strong> tugmasini bosib, loyiha ildizidagi <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono">/chrome-extension</code> papkasini tanlang.
                    </li>
                    <li>
                      Istalgan YouTube darsini ochib, video ostidagi <strong>Uz3D Doskada O‘rganish</strong> tugmasini bosing.
                    </li>
                  </ol>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setInputTab('youtube')}
                      className="min-h-[38px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Oqim A ga qaytish</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
