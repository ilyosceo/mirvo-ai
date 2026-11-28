import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Coins,
  Download,
  Layers,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { MirvoLessonStep, MirvoPartMeta } from '../data/htmlModelsLibrary';
import type { TokenUsageInfo } from '../types/tutor';
import {
  formatCostUsd,
  formatCostUzsApprox,
  formatTokenCount,
  getQwenModelRates,
} from '../lib/tokenUsage';
import { voiceEngine } from '../lib/voiceEngine';

export interface HtmlLessonState {
  topicTitle: string;
  kind?: 'mirvo-scene' | 'self-contained';
  sourceLabel:
    | 'library'
    | 'cache'
    | 'scene-focus'
    | 'scene-addon'
    | 'qwen-generated';
  publicPath?: string;
  htmlContent?: string;
  steps?: MirvoLessonStep[];
  parts?: MirvoPartMeta[];
  tokenUsage?: TokenUsageInfo;
  modelUsed?: string;
}

export interface HtmlStreamProgress {
  active: boolean;
  mode?: 'scene-adapt' | 'full-html';
  topicTitle: string;
  statusMessage: string;
  pass: number;
  totalLines: number;
  totalChars: number;
  codeTail: string;
  startedAt: number;
  error?: string | null;
}

interface HtmlLessonViewerProps {
  lesson: HtmlLessonState | null;
  progress: HtmlStreamProgress;
  onBack: () => void;
  onCancelStream: () => void;
  onRetry: () => void;
  onRegenerate: () => void;
}

const SPEEDS = [1.0, 1.2, 0.85] as const;

function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function detectBuildPhase(
  codeTail: string,
  totalLines: number,
  totalChars: number
): number {
  const tail = codeTail.toLowerCase();
  if (
    tail.includes('const steps') ||
    tail.includes('mirvo_scene_end') ||
    tail.includes('function ontick') ||
    tail.includes('speechsynthesis') ||
    tail.includes('</html>') ||
    totalChars > 8200 ||
    totalLines > 210
  ) {
    return 4;
  }
  if (
    tail.includes('const parts') ||
    tail.includes('tubepieces') ||
    tail.includes('radialticks') ||
    tail.includes('requestanimationframe') ||
    tail.includes('renderdynamic') ||
    totalChars > 5200 ||
    totalLines > 135
  ) {
    return 3;
  }
  if (
    tail.includes('mirvo-part') ||
    tail.includes('solidof') ||
    tail.includes('framealong') ||
    tail.includes('isobox') ||
    tail.includes('<svg') ||
    totalChars > 1800 ||
    totalLines > 50
  ) {
    return 2;
  }
  return 1;
}

export const HtmlLessonViewer: React.FC<HtmlLessonViewerProps> = ({
  lesson,
  progress,
  onBack,
  onCancelStream,
  onRetry,
  onRegenerate,
}) => {
  const [elapsedMs, setElapsedMs] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeReadyRef = useRef(false);

  // MirvoScene external step / audio / explode state
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [exploded, setExploded] = useState(false);
  const [clickedPartSubtitle, setClickedPartSubtitle] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const playingRef = useRef(false);
  const stepIdxRef = useRef(0);
  const mutedRef = useRef(false);
  const speedIdxRef = useRef(0);
  const muteTimerRef = useRef<number | null>(null);

  playingRef.current = playing;
  stepIdxRef.current = stepIdx;
  mutedRef.current = muted;
  speedIdxRef.current = speedIdx;

  const isMirvoScene =
    lesson?.kind === 'mirvo-scene' && Array.isArray(lesson.steps) && lesson.steps.length > 0;
  const steps = isMirvoScene ? lesson!.steps! : [];

  const postToScene = useCallback((msg: Record<string, unknown>) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(msg, '*');
    } catch {
      // ignore cross-frame race
    }
  }, []);

  const syncSceneStep = useCallback(
    (idx: number) => {
      if (!isMirvoScene || !steps[idx]) return;
      const s = steps[idx];
      postToScene({ type: 'SET_AUTO_TOUR', enabled: false });
      postToScene({ type: 'STEP', stepIdx: idx });

      if (typeof s.explode === 'number') {
        const shouldExplode = s.explode > 0.3;
        setExploded(shouldExplode);
        postToScene({ type: 'EXPLODE', amount: shouldExplode ? 1 : 0 });
      }

      if (s.isAddonPart && s.focusPart && s.focusPart !== 'full') {
        postToScene({
          type: 'MIRVO_ADDON_FOCUS',
          partId: s.focusPart,
          svgX: s.svgX,
          svgY: s.svgY,
          zoom: s.zoom || 1.65,
        });
      } else if (!s.focusPart || s.focusPart === 'full') {
        postToScene({ type: 'HIGHLIGHT', partId: null });
        postToScene({ type: 'FOCUS', target: 'full' });
      } else {
        postToScene({ type: 'HIGHLIGHT', partId: s.focusPart });
        postToScene({ type: 'FOCUS', target: s.focusPart });
      }
    },
    [isMirvoScene, postToScene, steps]
  );

  const stopSceneAudio = useCallback(() => {
    if (muteTimerRef.current !== null) {
      window.clearTimeout(muteTimerRef.current);
      muteTimerRef.current = null;
    }
    voiceEngine.stop();
  }, []);

  const playStepNarration = useCallback(
    (idx: number) => {
      stopSceneAudio();
      if (!playingRef.current || !steps[idx]) return;
      const step = steps[idx];
      const rate = SPEEDS[speedIdxRef.current];

      const advance = () => {
        if (!playingRef.current) return;
        if (idx < steps.length - 1) {
          const next = idx + 1;
          setStepIdx(next);
          setClickedPartSubtitle(null);
          syncSceneStep(next);
          playStepNarration(next);
        } else {
          setPlaying(false);
        }
      };

      if (mutedRef.current) {
        const words = step.textUz.split(/\s+/).length;
        const waitMs = Math.max(3500, Math.round(((words * 420 + 900) / rate)));
        muteTimerRef.current = window.setTimeout(advance, waitMs);
        return;
      }

      void voiceEngine.speak(
        step.textUz,
        {
          onEnd: () => {
            if (!playingRef.current) return;
            muteTimerRef.current = window.setTimeout(advance, 550);
          },
        },
        true,
        rate
      );
    },
    [steps, stopSceneAudio, syncSceneStep]
  );

  const goToSceneStep = useCallback(
    (nextIdx: number, keepPlaying = false) => {
      if (!steps.length) return;
      const clamped = ((nextIdx % steps.length) + steps.length) % steps.length;
      setStepIdx(clamped);
      setClickedPartSubtitle(null);
      syncSceneStep(clamped);
      if (keepPlaying) {
        setPlaying(true);
        playingRef.current = true;
        playStepNarration(clamped);
      } else {
        setPlaying(false);
        stopSceneAudio();
      }
    },
    [playStepNarration, steps.length, stopSceneAudio, syncSceneStep]
  );

  // Reset playback state whenever a new lesson opens
  useEffect(() => {
    stopSceneAudio();
    setPlaying(false);
    setStepIdx(0);
    setExploded(false);
    setClickedPartSubtitle(null);
    iframeReadyRef.current = false;
    return () => {
      stopSceneAudio();
    };
  }, [lesson?.topicTitle, lesson?.publicPath, lesson?.htmlContent, stopSceneAudio]);

  // Listen to PART_CLICK events sent from inside the MirvoScene iframe
  useEffect(() => {
    if (!isMirvoScene) return;
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || typeof data !== 'object' || data.type !== 'PART_CLICK') return;
      const clickedId = String(data.partId || '');
      const nameUz = String(data.nameUz || clickedId);
      const foundIdx = steps.findIndex((s) => s.focusPart === clickedId);
      if (foundIdx >= 0) {
        goToSceneStep(foundIdx, playingRef.current);
      } else {
        setPlaying(false);
        stopSceneAudio();
        setClickedPartSubtitle(`${nameUz} — tanlangan modul tafsiloti.`);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [goToSceneStep, isMirvoScene, steps, stopSceneAudio]);

  // Keyboard shortcuts for MirvoScene viewer
  useEffect(() => {
    if (!isMirvoScene || progress.active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToSceneStep(stepIdxRef.current + 1, playingRef.current);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToSceneStep(stepIdxRef.current - 1, playingRef.current);
      } else if (e.key === ' ') {
        e.preventDefault();
        if (playingRef.current) {
          setPlaying(false);
          stopSceneAudio();
        } else {
          const targetIdx =
            stepIdxRef.current >= steps.length - 1 ? 0 : stepIdxRef.current;
          goToSceneStep(targetIdx, true);
        }
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setExploded((prev) => {
          const next = !prev;
          postToScene({ type: 'EXPLODE', amount: next ? 1 : 0 });
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goToSceneStep, isMirvoScene, postToScene, progress.active, steps.length, stopSceneAudio]);

  useEffect(() => {
    if (!progress.active) return;
    setElapsedMs(Date.now() - progress.startedAt);
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - progress.startedAt);
    }, 500);
    return () => window.clearInterval(id);
  }, [progress.active, progress.startedAt]);

  const handleDownloadHtml = () => {
    if (!lesson?.htmlContent) return;
    const blob = new Blob([lesson.htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug =
      lesson.topicTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '_')
        .replace(/^_+|_+$/g, '') || 'mirvo_model';
    a.download = `${slug}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleExplode = () => {
    const next = !exploded;
    setExploded(next);
    postToScene({ type: 'SET_AUTO_TOUR', enabled: false });
    postToScene({ type: 'EXPLODE', amount: next ? 1 : 0 });
  };

  const title = lesson?.topicTitle || progress.topicTitle || 'Interaktiv HTML Model';
  const usage = lesson?.tokenUsage;
  const activePhase = detectBuildPhase(
    progress.codeTail,
    progress.totalLines,
    progress.totalChars
  );
  const currentStep = steps[stepIdx] || steps[0];

  const sourceBadgeText =
    lesson?.sourceLabel === 'scene-addon'
      ? 'Shablon + AI Modul'
      : lesson?.sourceLabel === 'scene-focus'
        ? 'Shablon + AI Tahlil'
        : lesson?.sourceLabel === 'library'
          ? 'Saqlangan · 0 tok'
          : 'Kesh · 0 tok';

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#FFFFFF] text-[#1F2937] overflow-hidden">
      {/* Slim Non-Overlapping Top Bar */}
      <header className="h-12 shrink-0 bg-white border-b border-black/[0.07] px-3 sm:px-5 flex items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              stopSceneAudio();
              if (progress.active) onCancelStream();
              onBack();
            }}
            aria-label="Bosh sahifaga qaytish"
            className="w-8 h-8 rounded-full hover:bg-black/[0.06] flex items-center justify-center text-[#1F2937] transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="truncate text-sm font-semibold text-[#1F2937] tracking-tight">
            {title}
          </span>
          {!progress.active && isMirvoScene && steps.length > 0 && (
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] text-[11.5px] font-mono font-semibold text-[#374151] shrink-0">
              {stepIdx + 1} / {steps.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!progress.active && lesson && (
            <>
              {isMirvoScene && (
                <button
                  type="button"
                  onClick={toggleExplode}
                  title="Qismlarga ajratib ko‘rish (E)"
                  className={`h-8 px-2.5 rounded-full border text-[11.5px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    exploded
                      ? 'bg-[#2563EB] border-[#2563EB] text-white'
                      : 'bg-[#F9FAFB] hover:bg-[#F3F4F6] border-[#E5E7EB] text-[#1F2937]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">
                    {exploded ? 'Yig‘ish' : 'Qismlarga ajratish'}
                  </span>
                </button>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowReceipt((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] text-[11px] font-mono font-semibold text-[#374151] cursor-pointer transition-colors"
                  title="Batafsil token va xarajat chekini ko‘rish"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  {usage && usage.total_tokens > 0 ? (
                    <span>
                      {formatTokenCount(usage.total_tokens)} tok ·{' '}
                      <span className="text-emerald-600">
                        {formatCostUsd(usage.cost_usd)} ({formatCostUzsApprox(usage.cost_usd)})
                      </span>
                    </span>
                  ) : (
                    <span className="text-[#6B7280]">{sourceBadgeText}</span>
                  )}
                </button>

                {showReceipt && (
                  <div className="absolute right-0 top-10 w-80 bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-[0_16px_40px_rgba(15,23,42,0.12)] z-40 text-xs text-[#1F2937]">
                    {(() => {
                      const activeModel =
                        lesson.modelUsed || usage?.model || 'qwen4-max';
                      const rates = getQwenModelRates(activeModel);
                      const hasTokens = Boolean(usage && usage.total_tokens > 0);
                      return (
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-2">
                            <strong className="text-[12.5px] text-[#111827]">
                              Aniq Token va Xarajat Cheki
                            </strong>
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#2563EB] font-mono text-[10.5px] font-semibold">
                              {hasTokens ? activeModel : '0 token'}
                            </span>
                          </div>

                          <div className="flex flex-col gap-1.5 font-mono text-[11.5px]">
                            <div className="flex justify-between">
                              <span className="text-[#6B7280]">Kirish (Prompt):</span>
                              <strong>{formatTokenCount(usage?.prompt_tokens || 0)} tok</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#6B7280]">Shundan keshdan (95% arzon):</span>
                              <strong className="text-blue-600">
                                {formatTokenCount(usage?.cached_tokens || 0)} tok
                              </strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#6B7280]">Chiqish (Output):</span>
                              <strong>{formatTokenCount(usage?.output_tokens || 0)} tok</strong>
                            </div>
                            {(usage?.thoughts_tokens || 0) > 0 && (
                              <div className="flex justify-between">
                                <span className="text-[#6B7280]">Shundan fikrlash:</span>
                                <span>{formatTokenCount(usage?.thoughts_tokens || 0)} tok</span>
                              </div>
                            )}
                            <div className="flex justify-between border-t border-[#F3F4F6] pt-1.5">
                              <span className="font-sans font-semibold text-[#111827]">
                                Jami token:
                              </span>
                              <strong className="text-[#111827]">
                                {formatTokenCount(usage?.total_tokens || 0)} tok
                              </strong>
                            </div>
                            <div className="flex justify-between items-baseline bg-emerald-50/80 border border-emerald-200/70 rounded-xl px-2.5 py-2 mt-0.5">
                              <span className="font-sans font-semibold text-emerald-900">
                                Aniq xarajat:
                              </span>
                              <div className="text-right">
                                <div className="font-bold text-emerald-700 text-[13px]">
                                  {formatCostUsd(usage?.cost_usd || 0)}
                                </div>
                                <div className="text-[10.5px] text-emerald-700/80">
                                  ≈ {formatCostUzsApprox(usage?.cost_usd || 0)}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="text-[10.5px] text-[#6B7280] leading-snug pt-0.5">
                            Rasmiy {rates.label} tarifi: Kirish ${rates.inputPer1M}/1M · Kesh $
                            {rates.cachedPer1M}/1M · Chiqish ${rates.outputPer1M}/1M
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {lesson.htmlContent && (
                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  title="HTML faylni yuklab olish"
                  className="h-8 px-2.5 rounded-full bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] text-[11px] font-medium text-[#1F2937] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">HTML</span>
                </button>
              )}

              {lesson.sourceLabel !== 'library' && (
                <button
                  type="button"
                  onClick={() => {
                    stopSceneAudio();
                    onRegenerate();
                  }}
                  title="Qwen bilan qaytadan tahlil qilish / yaratish"
                  className="h-8 px-2.5 rounded-full bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] text-[11px] font-medium text-[#1F2937] inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Qayta yaratish</span>
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 relative w-full flex flex-col">
        {progress.active ? (
          <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-[radial-gradient(circle_at_50%_45%,#ffffff_0%,#fafafa_65%,#f3f4f6_100%)]">
            <div className="w-full max-w-xl bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-7 shadow-[0_12px_32px_rgba(15,23,42,0.06)] flex flex-col gap-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#2563EB] mb-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{progress.statusMessage}</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#111827] tracking-tight">
                    {progress.topicTitle}
                  </h2>
                </div>
                <span className="font-mono text-xs font-semibold text-[#4B5563] bg-[#F3F4F6] px-2.5 py-1 rounded-full shrink-0">
                  {formatElapsed(elapsedMs)}
                </span>
              </div>

              {progress.mode === 'scene-adapt' ? (
                <p className="m-0 text-xs text-[#4B5563] bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-3.5 leading-relaxed">
                  Tayyor professional shablon <strong>100% saqlanib qoladi</strong> — Qwen 0 dan
                  qayta yozmasdan, savolingizga javob beruvchi zum ketma-ketligini va kerak bo‘lsa
                  qo‘shimcha SVG modulni tayyor shablonga ulayapti (~8–20 soniya).
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11.5px]">
                    {[
                      { id: 1, label: '1. Asos va proyeksiya' },
                      { id: 2, label: '2. Anatomy 3D detallar' },
                      { id: 3, label: '3. Quvur va priborlar' },
                      { id: 4, label: '4. 60 FPS va ovoz' },
                    ].map((step) => {
                      const done = activePhase > step.id;
                      const current = activePhase === step.id;
                      return (
                        <div
                          key={step.id}
                          className={`px-2.5 py-2 rounded-xl border font-medium transition-colors ${
                            done
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : current
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#9CA3AF]'
                          }`}
                        >
                          {step.label}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4B5563] font-mono bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2.5">
                    <span>
                      Yozildi: <strong className="text-[#111827]">{progress.totalLines}</strong>{' '}
                      qator ({(progress.totalChars / 1024).toFixed(1)} KB)
                    </span>
                    <span>Bosqich: #{progress.pass}</span>
                  </div>

                  {progress.codeTail && (
                    <pre className="m-0 p-3 rounded-xl bg-[#0F172A] text-[#94A3B8] text-[11px] leading-relaxed font-mono overflow-hidden max-h-28 whitespace-pre-wrap break-all">
                      {progress.codeTail.split('\n').slice(-6).join('\n')}
                    </pre>
                  )}

                  <p className="m-0 text-xs text-[#6B7280] leading-relaxed">
                    <strong>Qwen 4 Max + Anatomy 3D CAD skill</strong> dvigateli yordamida burama
                    silindrlar, faskali plitalar, prujinalar, 3D quvurlar va jonli priborlardan
                    iborat kesma model yig‘ilmoqda (~25–50 soniya). Tayyor bo‘lishi bilan
                    brauzeringizga saqlanadi.
                  </p>
                </>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onCancelStream();
                    onBack();
                  }}
                  className="px-4 py-2 rounded-full border border-[#E5E7EB] bg-white hover:bg-[#F3F4F6] text-xs font-semibold text-[#374151] cursor-pointer"
                >
                  Bekor qilish
                </button>
              </div>
            </div>
          </div>
        ) : progress.error ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white border border-red-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <h2 className="text-base font-bold text-[#111827] m-0">
                HTML yaratishda xatolik yuz berdi
              </h2>
              <p className="text-xs text-red-600 leading-relaxed m-0 break-words">
                {progress.error}
              </p>
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-4 py-2 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold cursor-pointer"
                >
                  Qayta urinish
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-2 rounded-full border border-[#E5E7EB] bg-white hover:bg-[#F3F4F6] text-xs font-semibold text-[#374151] cursor-pointer"
                >
                  Orqaga
                </button>
              </div>
            </div>
          </div>
        ) : lesson?.publicPath ? (
          <iframe
            ref={iframeRef}
            key={lesson.publicPath}
            src={lesson.publicPath}
            title={lesson.topicTitle}
            onLoad={() => {
              iframeReadyRef.current = true;
              if (isMirvoScene) {
                window.setTimeout(() => syncSceneStep(stepIdxRef.current), 60);
              }
            }}
            className={`w-full flex-1 border-0 bg-white ${isMirvoScene ? 'pb-28' : ''}`}
            sandbox="allow-scripts allow-same-origin"
          />
        ) : lesson?.htmlContent ? (
          <iframe
            ref={iframeRef}
            key={`${lesson.topicTitle}-${lesson.htmlContent.length}`}
            srcDoc={lesson.htmlContent}
            title={lesson.topicTitle}
            onLoad={() => {
              iframeReadyRef.current = true;
              if (isMirvoScene) {
                window.setTimeout(() => syncSceneStep(stepIdxRef.current), 60);
              }
            }}
            className={`w-full flex-1 border-0 bg-white ${isMirvoScene ? 'pb-28' : ''}`}
            sandbox="allow-scripts allow-same-origin"
          />
        ) : null}

        {/* Floating Subtitle + High-Contrast White Audio Player Dock for Modular MirvoScene Models */}
        {!progress.active && !progress.error && isMirvoScene && currentStep && (
          <footer className="pointer-events-none absolute inset-x-0 bottom-3.5 px-3 sm:px-6 flex flex-col items-center gap-2.5 z-20">
            <div
              aria-live="polite"
              className="pointer-events-auto max-w-[700px] w-full sm:w-auto bg-[#111827]/92 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-[13px] sm:text-[13.5px] leading-relaxed text-center shadow-[0_8px_24px_rgba(17,24,39,0.18)] backdrop-blur-md"
            >
              {currentStep.titleUz && !clickedPartSubtitle && (
                <span className="font-semibold text-[#93C5FD] mr-1.5">
                  {currentStep.titleUz}:
                </span>
              )}
              <span>{clickedPartSubtitle || currentStep.textUz}</span>
            </div>

            <div
              role="group"
              aria-label="Dars va ovoz boshqaruvi"
              className="pointer-events-auto bg-white border border-[#E5E7EB] rounded-full px-2.5 py-1.5 shadow-[0_8px_28px_rgba(15,23,42,0.09)] flex items-center gap-1.5 sm:gap-2"
            >
              <button
                type="button"
                onClick={() => goToSceneStep(stepIdx - 1, playing)}
                title="Oldingi qadam (←)"
                aria-label="Oldingi qadam"
                className="w-8 h-8 rounded-full hover:bg-[#F3F4F6] flex items-center justify-center text-[#1F2937] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => goToSceneStep(stepIdx, true)}
                title="Qayta eshitish"
                aria-label="Qayta eshitish"
                className="w-8 h-8 rounded-full hover:bg-[#F3F4F6] flex items-center justify-center text-[#1F2937] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (playing) {
                    setPlaying(false);
                    stopSceneAudio();
                  } else {
                    const startIdx = stepIdx >= steps.length - 1 ? 0 : stepIdx;
                    goToSceneStep(startIdx, true);
                  }
                }}
                className="h-9 px-4 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
              >
                {playing ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pauza</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Eshitish</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-1.5 px-1.5" role="tablist">
                {steps.map((s, idx) => (
                  <button
                    key={`${s.focusPart}-${idx}`}
                    type="button"
                    onClick={() => goToSceneStep(idx, playing)}
                    title={s.titleUz}
                    aria-label={`${idx + 1}-qadam: ${s.titleUz}`}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === stepIdx
                        ? 'w-5 bg-[#2563EB]'
                        : 'w-2 bg-[#D1D5DB] hover:bg-[#9CA3AF]'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => goToSceneStep(stepIdx + 1, playing)}
                title="Keyingi qadam (→)"
                aria-label="Keyingi qadam"
                className="w-8 h-8 rounded-full hover:bg-[#F3F4F6] flex items-center justify-center text-[#1F2937] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <span className="w-px h-4 bg-[#E5E7EB] mx-0.5" aria-hidden="true" />

              <button
                type="button"
                onClick={() => {
                  const nextMuted = !muted;
                  setMuted(nextMuted);
                  mutedRef.current = nextMuted;
                  if (playing) {
                    playStepNarration(stepIdx);
                  }
                }}
                title={muted ? 'Ovozni yoqish' : 'Ovozni o‘chirish'}
                aria-label="Ovoz"
                className="w-8 h-8 rounded-full hover:bg-[#F3F4F6] flex items-center justify-center text-[#1F2937] cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4 text-[#6B7280]" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextSpd = (speedIdx + 1) % SPEEDS.length;
                  setSpeedIdx(nextSpd);
                  speedIdxRef.current = nextSpd;
                  if (playing) {
                    playStepNarration(stepIdx);
                  }
                }}
                title="O‘qish tezligi"
                className="h-7 px-2.5 rounded-full bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] font-mono text-[11.5px] font-semibold text-[#1F2937] cursor-pointer"
              >
                {SPEEDS[speedIdx].toFixed(SPEEDS[speedIdx] === 0.85 ? 2 : 1)}x
              </button>
            </div>
          </footer>
        )}
      </main>
    </div>
  );
};
