import React, { useEffect, useState } from 'react';
import { ArrowLeft, Coins, Download, Loader2, RefreshCw } from 'lucide-react';
import type { TokenUsageInfo } from '../types/tutor';
import {
  formatCostUsd,
  formatCostUzsApprox,
  formatTokenCount,
} from '../lib/tokenUsage';

export interface HtmlLessonState {
  topicTitle: string;
  sourceLabel: 'library' | 'cache' | 'qwen-generated';
  publicPath?: string;
  htmlContent?: string;
  tokenUsage?: TokenUsageInfo;
  modelUsed?: string;
}

export interface HtmlStreamProgress {
  active: boolean;
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

function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function detectBuildPhase(codeTail: string, totalLines: number, totalChars: number): number {
  const tail = codeTail.toLowerCase();
  if (
    tail.includes('speechsynthesis') ||
    tail.includes('const steps') ||
    tail.includes('</html>') ||
    totalChars > 16000 ||
    totalLines > 420
  ) {
    return 4;
  }
  if (
    tail.includes('requestanimationframe') ||
    tail.includes('renderdynamic') ||
    tail.includes('animate(') ||
    totalChars > 9500 ||
    totalLines > 260
  ) {
    return 3;
  }
  if (
    tail.includes('isobox') ||
    tail.includes('isocylinder') ||
    tail.includes('<svg') ||
    totalChars > 3000 ||
    totalLines > 90
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
    const slug = lesson.topicTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '') || 'mirvo_model';
    a.download = `${slug}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const title = lesson?.topicTitle || progress.topicTitle || 'Interaktiv HTML Model';
  const usage = lesson?.tokenUsage;
  const activePhase = detectBuildPhase(
    progress.codeTail,
    progress.totalLines,
    progress.totalChars
  );

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#FAFAFA] text-[#1F2937] overflow-hidden">
      {/* Slim Non-Overlapping Top Bar */}
      <header className="h-12 shrink-0 bg-white border-b border-black/[0.07] px-3 sm:px-5 flex items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => {
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
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!progress.active && lesson && (
            <>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] text-[11px] font-mono font-semibold text-[#374151]"
                title={
                  usage && usage.total_tokens > 0
                    ? `Model: ${lesson.modelUsed || usage.model || 'qwen3.8-omni-flash'} | Kirish: ${formatTokenCount(usage.prompt_tokens)} (Kesh: ${formatTokenCount(usage.cached_tokens || 0)}) | Chiqish: ${formatTokenCount(usage.output_tokens)} | ${formatCostUzsApprox(usage.cost_usd)}`
                    : 'Kutubxona / keshdan ochildi — 0 token'
                }
              >
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                {usage && usage.total_tokens > 0 ? (
                  <span>
                    {formatTokenCount(usage.total_tokens)} tok ·{' '}
                    <span className="text-emerald-600">{formatCostUsd(usage.cost_usd)}</span>
                  </span>
                ) : (
                  <span className="text-[#6B7280]">
                    {lesson.sourceLabel === 'library' ? 'Saqlangan · 0 tok' : 'Kesh · 0 tok'}
                  </span>
                )}
              </span>

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
                  onClick={onRegenerate}
                  title="Qwen bilan qaytadan 0 dan yaratish"
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

      {/* Main Content: Live Streaming Build View OR Full-Viewport Standalone HTML Iframe */}
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

              {/* 4 Real Generation Phases */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11.5px]">
                {[
                  { id: 1, label: '1. Dizayn va CSS' },
                  { id: 2, label: '2. Izometrik SVG' },
                  { id: 3, label: '3. 60 FPS animatsiya' },
                  { id: 4, label: '4. 5 qadam va ovoz' },
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

              {/* Live Metrics Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4B5563] font-mono bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 py-2.5">
                <span>
                  Yozildi: <strong className="text-[#111827]">{progress.totalLines}</strong> qator (
                  {(progress.totalChars / 1024).toFixed(1)} KB)
                </span>
                <span>Bosqich: #{progress.pass}</span>
              </div>

              {/* Honest Live Code Stream Preview (Last 6 lines) */}
              {progress.codeTail && (
                <pre className="m-0 p-3 rounded-xl bg-[#0F172A] text-[#94A3B8] text-[11px] leading-relaxed font-mono overflow-hidden max-h-28 whitespace-pre-wrap break-all">
                  {progress.codeTail.split('\n').slice(-6).join('\n')}
                </pre>
              )}

              <p className="m-0 text-xs text-[#6B7280] leading-relaxed">
                Sifatli izometrik animatsiyali HTML kod 0 dan yozilmoqda — odatda 1–3 daqiqa vaqt
                oladi. Tayyor bo‘lishi bilan brauzeringizga saqlanadi va keyingi safar 0.1 soniyada
                ochiladi.
              </p>

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
              <p className="text-xs text-red-600 m-0 leading-relaxed break-words">
                {progress.error}
              </p>
              <div className="flex items-center gap-2">
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
            key={lesson.publicPath}
            src={lesson.publicPath}
            title={lesson.topicTitle}
            className="flex-1 w-full h-full border-0 bg-[#FAFAFA]"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : lesson?.htmlContent ? (
          <iframe
            key={`${lesson.topicTitle}-${lesson.htmlContent.length}`}
            srcDoc={lesson.htmlContent}
            title={lesson.topicTitle}
            className="flex-1 w-full h-full border-0 bg-[#FAFAFA]"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : null}
      </main>
    </div>
  );
};
