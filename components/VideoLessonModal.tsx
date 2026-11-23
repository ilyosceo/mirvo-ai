import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Film, Link2, Loader2, Upload, Volume2, X } from 'lucide-react';
import {
  extractCompressedMonoMp3FromFile,
  type ExtractedAudioPayload,
} from '../lib/audioExtractor.js';
import {
  extractVideoKeyframes,
  type ExtractedVideoResult,
} from '../lib/videoKeyframeExtractor.js';
import type { TutorLesson } from '../types/tutor.js';
import { safeParseJson } from '../lib/safeFetchJson.js';

interface VideoLessonModalProps {
  open: boolean;
  initialTab?: VideoInputTab;
  initialVideoFile?: File | null;
  initialYoutubeUrl?: string;
  onClose: () => void;
  onLessonReady: (lesson: TutorLesson, queryLabel: string) => void;
}

type VideoInputTab = 'file' | 'youtube';

function formatDurationUz(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export const VideoLessonModal: React.FC<VideoLessonModalProps> = ({
  open,
  initialTab,
  initialVideoFile,
  initialYoutubeUrl,
  onClose,
  onLessonReady,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const processedInitialFileRef = useRef<File | null>(null);
  const [tab, setTab] = useState<VideoInputTab>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState<ExtractedVideoResult | null>(null);
  const [extractedAudio, setExtractedAudio] = useState<ExtractedAudioPayload | null>(null);
  const [audioNote, setAudioNote] = useState<string | null>(null);
  const [extractPct, setExtractPct] = useState(0);
  const [extractStatus, setExtractStatus] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialTab) setTab(initialTab);
    if (initialYoutubeUrl) {
      setYoutubeUrl(initialYoutubeUrl);
    }
  }, [open, initialTab, initialYoutubeUrl]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting && !isExtracting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, isSubmitting, isExtracting, onClose]);

  const handleVideoFileSelect = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      setErrorMsg(null);
      setSelectedFile(file);
      setExtracted(null);
      setExtractedAudio(null);
      setAudioNote(null);
      setIsExtracting(true);
      setExtractPct(2);
      setExtractStatus('Video kadrlar ajratilmoqda...');
      try {
        const result = await extractVideoKeyframes(file, (pct, status) => {
          setExtractPct(Math.round(pct * 0.65));
          setExtractStatus(status);
        });
        setExtracted(result);

        setExtractPct(68);
        setExtractStatus('Ovoz yo‘lakchasi siqilmoqda (16 kHz mono MP3)...');
        try {
          const audioRes = await extractCompressedMonoMp3FromFile(
            file,
            (pct, status) => {
              setExtractPct(68 + Math.round(pct * 0.32));
              setExtractStatus(status);
            },
            90
          );
          setExtractedAudio(audioRes);
        } catch {
          setExtractedAudio(null);
          setAudioNote('Videoda ovoz yo‘lakchasi topilmadi — faqat kadrlar tahlil qilinadi.');
        }

        const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        if (cleanName) {
          setTopicTitle((prev) => (prev.trim() ? prev : cleanName));
        }
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Videodan kadrlarni ajratib olishda xatolik yuz berdi.'
        );
        setSelectedFile(null);
      } finally {
        setIsExtracting(false);
      }
    },
    []
  );

  useEffect(() => {
    if (open && initialVideoFile && processedInitialFileRef.current !== initialVideoFile) {
      processedInitialFileRef.current = initialVideoFile;
      setTab('file');
      void handleVideoFileSelect(initialVideoFile);
    }
  }, [open, initialVideoFile, handleVideoFileSelect]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (tab === 'file' && (!extracted || extracted.frames.length === 0)) {
      setErrorMsg('Avval MP4/WebM video fayl tanlang va kadrlar ajratilishini kuting.');
      return;
    }
    if (tab === 'youtube' && !youtubeUrl.trim()) {
      setErrorMsg('YouTube video havolasini kiriting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/explain-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames: tab === 'file' ? extracted?.frames || [] : [],
          audioBase64: tab === 'file' ? extractedAudio?.base64 : undefined,
          audioMime: tab === 'file' && extractedAudio ? extractedAudio.mimeType : undefined,
          youtubeUrl: tab === 'youtube' ? youtubeUrl.trim() : undefined,
          topic: topicTitle.trim() || undefined,
          notes: notes.trim() || undefined,
          language: 'uz',
        }),
      });

      const data = await safeParseJson<{
        lesson?: TutorLesson;
        error?: string;
      }>(res, "Videodan dars yaratib bo'lmadi.");

      if (!res.ok || !data.lesson) {
        throw new Error(data.error || "Videodan dars yaratib bo'lmadi.");
      }

      const queryLabel =
        topicTitle.trim() ||
        data.lesson.topic_title ||
        (tab === 'youtube' ? youtubeUrl.trim() : selectedFile?.name || 'Videodan dars');

      onLessonReady(data.lesson, queryLabel);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Server bilan bog‘lanishda xatolik yuz berdi.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const framesKb = extracted ? Math.round(extracted.totalBytes / 1024) : 0;
  const audioKb = extractedAudio ? extractedAudio.sizeKb : 0;
  const totalPayloadKb = framesKb + audioKb;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-lesson-modal-title"
      onClick={() => {
        if (!isSubmitting && !isExtracting) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border border-black/[0.06] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.14)] overflow-hidden flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-4 bg-[#F5F5F7]/75">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0">
              <Film className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="video-lesson-modal-title"
                className="text-sm sm:text-base font-semibold tracking-[-0.02em] text-[#1D1D1F] truncate"
              >
                Videodan 2D/3D dars yaratish
              </h2>
              <p className="text-xs text-[#6E6E73] truncate">
                Video yuklanmaydi — asosiy kadrlar va siqilgan ovoz brauzerda ajratiladi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isExtracting}
            aria-label="Oynani yopish"
            className="w-9 h-9 rounded-full border border-black/[0.06] bg-white hover:bg-[#F5F5F7] flex items-center justify-center text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer disabled:opacity-40 shrink-0 apple-transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto academic-scroll">
          {/* Source Switcher */}
          <div
            role="tablist"
            aria-label="Video manbasi"
            className="grid grid-cols-2 gap-1 rounded-full bg-[#F5F5F7] p-1 border border-black/[0.05]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'file'}
              onClick={() => setTab('file')}
              className={`h-9 rounded-full text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 apple-transition cursor-pointer whitespace-nowrap ${
                tab === 'file'
                  ? 'bg-white text-[#1D1D1F] shadow-xs'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>MP4 / Video fayl</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'youtube'}
              onClick={() => setTab('youtube')}
              className={`h-9 rounded-full text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 apple-transition cursor-pointer whitespace-nowrap ${
                tab === 'youtube'
                  ? 'bg-white text-[#1D1D1F] shadow-xs'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              <Link2 className="w-4 h-4" />
              <span>YouTube havolasi</span>
            </button>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
              {errorMsg}
            </div>
          )}

          {tab === 'file' ? (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/*"
                onChange={(e) => void handleVideoFileSelect(e.target.files?.[0])}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtracting || isSubmitting}
                className="w-full rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/40 p-5 text-center transition-colors cursor-pointer disabled:opacity-60"
              >
                <div className="mx-auto w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-xs mb-2">
                  {isExtracting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div className="text-sm font-semibold text-slate-800">
                  {selectedFile ? selectedFile.name : 'Video faylni tanlang (MP4, WebM, MOV)'}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  12–14 ta asosiy kadr + siqilgan 16 kHz mono MP3 ovoz brauzerning o‘zida ajratiladi
                </div>
              </button>

              {isExtracting && (
                <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                    <span>{extractStatus}</span>
                    <span className="font-mono-tabular">{extractPct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-200"
                      style={{ width: `${extractPct}%` }}
                    />
                  </div>
                </div>
              )}

              {extracted && !isExtracting && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 font-medium">
                    <span>
                      Kadrlar: <strong>{extracted.frames.length} ta</strong> · Davomiyligi:{' '}
                      <strong className="font-mono-tabular">
                        {formatDurationUz(extracted.durationSec)}
                      </strong>
                    </span>
                    <span className="font-mono-tabular text-emerald-700 font-semibold">
                      Jami hajm: {totalPayloadKb} KB
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                    <Volume2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        extractedAudio ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    />
                    {extractedAudio ? (
                      <span className="text-slate-700">
                        Ovoz yo‘lakchasi: <strong>{extractedAudio.sizeKb} KB</strong> (16 kHz MP3 ·{' '}
                        {extractedAudio.durationSec}s) — ustoz izohlari bilan tahlil qilinadi
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        {audioNote || 'Faqat video kadrlardan tahlil qilinadi'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                    {extracted.frames.slice(0, 12).map((src, idx) => (
                      <div
                        key={`kf-${idx}`}
                        className="aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-900"
                      >
                        <img
                          src={src}
                          alt={`Video kadr ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label
                htmlFor="youtube-url-input"
                className="block text-xs font-semibold text-slate-700"
              >
                YouTube video havolasi
              </label>
              <input
                id="youtube-url-input"
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full h-11 rounded-xl border border-slate-300 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Video yuklab olinmaydi — ochiq YouTube oEmbed ma’lumotlari va preview kadrlari orqali 2D/3D doska darsi tuziladi (to‘liq subtitrlar uchun Chrome Extension yoki mavzu izohidan foydalaning).
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label
                htmlFor="video-topic-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Mavzu nomi (ixtiyoriy)
              </label>
              <input
                id="video-topic-input"
                type="text"
                value={topicTitle}
                onChange={(e) => setTopicTitle(e.target.value)}
                placeholder="Masalan: Gidravlik press va Paskal qonuni"
                className="w-full h-10 rounded-xl border border-slate-300 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="video-notes-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Qo‘shimcha izoh yoki savol (ixtiyoriy)
              </label>
              <textarea
                id="video-notes-input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Masalan: Chizmalardagi kuch vektorlari va formulalarni batafsil tushuntiring"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.06]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isExtracting}
              className="h-10 px-4 rounded-full border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-sm font-medium text-[#1D1D1F] cursor-pointer disabled:opacity-40 whitespace-nowrap apple-transition"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                isExtracting ||
                (tab === 'file' ? !extracted : !youtubeUrl.trim())
              }
              className="h-10 px-5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap apple-transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Tahlil qilinmoqda...</span>
                </>
              ) : (
                <span>Doskada dars yaratish</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
