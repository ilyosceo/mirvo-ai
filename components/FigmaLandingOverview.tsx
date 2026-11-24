import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Box,
  Droplets,
  Eye,
  Film,
  History,
  Image as ImageIcon,
  Link2,
  Loader2,
  Mic,
  MicOff,
  Minus,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Waves,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { MirvoMentor } from './MirvoMentor';
import { PWAInstallButton } from './PWAInstallButton';
import type { SessionTokenStats } from '../lib/tokenUsage';

export interface StarterCardItem {
  id: string;
  subjectLabel: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
}

export interface QuickTopicItem {
  label: string;
  query: string;
}

interface FigmaLandingOverviewProps {
  userEmail: string | null;
  userName: string | null;
  totalHistoryCount: number;
  sessionTokenStats: SessionTokenStats;
  starterCards: readonly StarterCardItem[];
  quickTopics: readonly QuickTopicItem[];
  queryText: string;
  onQueryTextChange: (val: string) => void;
  lessonStepCount: number;
  onLessonStepCountChange: (count: number) => void;
  imagePreview: { dataUrl: string; name: string } | null;
  onClearImagePreview: () => void;
  onOpenFilePicker: () => void;
  onToggleMic: () => void;
  isListening: boolean;
  isLoading: boolean;
  errorMsg: string | null;
  onDismissError: () => void;
  onSubmitPrompt: (e: React.FormEvent) => void;
  onSelectStarterCard: (cardId: string) => void;
  onSelectQuickTopic: (query: string, label: string) => void;
  onOpenVideoModal: () => void;
  onOpenVideoWithFile?: (file: File) => void;
  onOpenVideoWithYoutube?: (url: string) => void;
  onOpenUz3DPlayer: () => void;
  onOpenDrawer: (tab: 'library' | 'history' | 'settings') => void;
  onRequestAuth: (pendingLabel?: string) => void;
  onEnterWorkspace: () => void;
  onLogout: () => void;
}

type HomeSpotlightMode = 'topic' | 'video';

interface StudioModuleItem {
  id: string;
  code: string;
  title: string;
  description: string;
  formulaPreview: string;
  accentColor: string;
  accentBg: string;
  actionType: 'starter' | 'topic';
  query?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STUDIO_MODULES: readonly StudioModuleItem[] = [
  {
    id: 'gaes-hydro-module',
    code: '01 / GIDROTEXNIKA · 2.5D SXEMA',
    title: 'Gidroakkumulyator stansiyasi (GAES)',
    description:
      'Yuqori va pastki suv havzasi, naporniy quvur, Frensis turbinasi va teskari nasos sikli chizmasi.',
    formulaPreview: 'P = ρ · g · Q · H · η',
    accentColor: '#1D4ED8',
    accentBg: '#EFF6FF',
    actionType: 'topic',
    query: 'Gidroakkumulyator elektr stansiyasi (GAES)',
    icon: Waves,
  },
  {
    id: 'physics-transformer',
    code: '02 / ELEKTROTEXNIKA · INTERAKTIV',
    title: 'Transformator va magnit oqimi',
    description:
      'Birlamchi va ikkilamchi chulg‘amlar, po‘lat o‘zak hamda kuchlanish pasayish-oshish vektori.',
    formulaPreview: 'U₁ / U₂ = N₁ / N₂',
    accentColor: '#D97706',
    accentBg: '#FEF3C7',
    actionType: 'starter',
    icon: Zap,
  },
  {
    id: 'hydraulic-press-pascal',
    code: '03 / MEXANIKA & FIZIKA · RAPIER2D',
    title: 'Gidravlik press va Paskal qonuni',
    description:
      'Tutash idishlarda bosim taqsimoti, porshen yuzalari nisbati va kuchdan yutish simulyatsiyasi.',
    formulaPreview: 'F₁ / A₁ = F₂ / A₂',
    accentColor: '#059669',
    accentBg: '#ECFDF5',
    actionType: 'starter',
    icon: Droplets,
  },
];

const STUDIO_CHIP_TOPICS: readonly { label: string; query: string; starterId?: string }[] = [
  { label: 'Shamol turbinasi (Bets qonuni)', query: 'shamol turbinasi', starterId: 'wind-turbine-energy' },
  { label: 'Elektr generatori (50 Hz)', query: 'elektr generator', starterId: 'electric-generator-ac' },
  { label: 'Kofein molekulasi (RDKit 2D)', query: 'kofein molekulasi', starterId: 'caffeine-pubchem-3d' },
  { label: 'Pifagor teoremasi (Mafs)', query: 'Pifagor teoremasi', starterId: 'pythagoras-visual' },
  { label: 'Fotosintez jarayoni', query: 'fotosintez', starterId: 'photosynthesis-visual' },
];

export const FigmaLandingOverview: React.FC<FigmaLandingOverviewProps> = ({
  userEmail,
  totalHistoryCount,
  queryText,
  onQueryTextChange,
  lessonStepCount,
  onLessonStepCountChange,
  imagePreview,
  onClearImagePreview,
  onOpenFilePicker,
  onToggleMic,
  isListening,
  isLoading,
  errorMsg,
  onDismissError,
  onSubmitPrompt,
  onSelectStarterCard,
  onSelectQuickTopic,
  onOpenVideoModal,
  onOpenVideoWithFile,
  onOpenVideoWithYoutube,
  onOpenUz3DPlayer,
  onOpenDrawer,
  onRequestAuth,
  onEnterWorkspace,
}) => {
  const [spotlightMode, setSpotlightMode] = useState<HomeSpotlightMode>('topic');
  const [youtubeDraft, setYoutubeDraft] = useState('');
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number }>({ x: 720, y: 340 });

  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      setCursorCoords({ x: Math.round(e.clientX), y: Math.round(e.clientY) });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useEffect(() => {
    if (!attachMenuOpen) return;
    const handleOutside = (e: PointerEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleOutside);
    return () => window.removeEventListener('pointerdown', handleOutside);
  }, [attachMenuOpen]);

  const clampStepCount = (n: number) => Math.max(4, Math.min(12, Math.round(n)));

  const handleVideoFileChosen = (file: File | null | undefined) => {
    if (!file) return;
    if (onOpenVideoWithFile) {
      onOpenVideoWithFile(file);
    } else {
      onOpenVideoModal();
    }
  };

  const handleCardDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingVideo(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name)) {
      handleVideoFileChosen(file);
    }
  };

  const handleVideoFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = youtubeDraft.trim();
    if (url && onOpenVideoWithYoutube) {
      onOpenVideoWithYoutube(url);
      return;
    }
    onOpenVideoModal();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#FAF8F5] text-[#111827] overflow-y-auto academic-scroll">
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/*"
        onChange={(e) => {
          handleVideoFileChosen(e.target.files?.[0]);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* ==================== FIGMA STUDIO ARCHITECTURAL NAVBAR ==================== */}
      <header className="sticky top-0 z-30 h-16 shrink-0 bg-[#FAF8F5]/92 backdrop-blur-md border-b border-[#E6E2D8]">
        <div className="max-w-[1280px] mx-auto h-full px-4 sm:px-8 flex items-center justify-between gap-3">
          {/* Left: M·AI Brand Mark + Studio Tag */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="inline-flex items-center gap-2.5 cursor-pointer group"
              aria-label="Mirvo Studio bosh sahifasi"
            >
              <span className="h-9 px-2.5 rounded-lg bg-[#111827] text-[#F59E0B] font-mono-tabular text-xs font-bold tracking-wider inline-flex items-center justify-center shadow-xs group-hover:bg-[#1E293B] transition-colors">
                M·AI
              </span>
              <span
                className="text-base sm:text-[17px] font-bold tracking-[-0.03em] text-[#111827]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Mirvo Studio
              </span>
            </button>

            <span className="hidden md:inline-flex items-center px-2.5 py-1 rounded-md bg-[#F0ECE1] text-[#57534E] font-mono-tabular text-[11px] font-medium">
              2D / 2.5D STEM LAB
            </span>
          </div>

          {/* Center: Architectural Segmented Switcher */}
          <nav
            aria-label="Asosiy ish rejimi"
            className="inline-flex items-center p-1 rounded-xl bg-[#F0ECE1] border border-[#E6E2D8]"
          >
            <button
              type="button"
              onClick={() => setSpotlightMode('topic')}
              aria-pressed={spotlightMode === 'topic'}
              className={`min-h-[32px] px-3 sm:px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                spotlightMode === 'topic'
                  ? 'bg-white text-[#111827] shadow-xs'
                  : 'text-[#57534E] hover:text-[#111827]'
              }`}
            >
              Mavzu &amp; Chizma Doskasi
            </button>
            <button
              type="button"
              onClick={() => setSpotlightMode('video')}
              aria-pressed={spotlightMode === 'video'}
              className={`min-h-[32px] px-3 sm:px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                spotlightMode === 'video'
                  ? 'bg-white text-[#111827] shadow-xs'
                  : 'text-[#57534E] hover:text-[#111827]'
              }`}
            >
              Videodan Tahlil
            </button>
          </nav>

          {/* Right: History + Library + Settings */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton compact />

            <button
              type="button"
              onClick={() => onOpenDrawer('history')}
              aria-label="Saqlangan darslar tarixi"
              className="h-9 px-3 rounded-lg bg-white hover:bg-[#F5F2EB] border border-[#E6E2D8] text-xs font-semibold text-[#111827] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <History className="w-3.5 h-3.5 text-[#1D4ED8]" />
              <span className="hidden sm:inline">Saqlanganlar</span>
              <span className="font-mono-tabular px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] text-[10px] font-bold leading-none">
                {totalHistoryCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onOpenDrawer('settings')}
              aria-label="Sozlamalar va ovoz"
              title={userEmail || 'Ustoz ovozi va sozlamalar'}
              className="w-9 h-9 rounded-lg bg-white hover:bg-[#F5F2EB] border border-[#E6E2D8] text-[#57534E] hover:text-[#111827] inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ==================== ASYMMETRIC SPLIT HERO + EMOJI USTOZ STAGE ==================== */}
      <main className="flex-1 px-4 sm:px-8 pt-8 sm:pt-12 pb-16">
        <div className="max-w-[1280px] mx-auto space-y-12">
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-8 items-stretch">
            {/* LEFT COLUMN (7 cols): Editorial Copy + Ink-Bordered Workbench */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                {/* Technical Spec Eyebrow */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#FEF3C7] border border-[#F59E0B]/40">
                  <span className="w-2 h-2 rounded-full bg-[#D97706]" />
                  <span className="font-mono-tabular text-[11px] font-bold tracking-wide text-[#B45309] uppercase">
                    INTERAKTIV STEM LABORATORIYASI · ZDOG · PIXI v8 · MAFS · RAPIER2D
                  </span>
                </div>

                <h1
                  className="text-3xl sm:text-5xl font-bold tracking-[-0.035em] text-[#111827] leading-[1.08]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Murakkab fanlarni jonli chizma va Emoji Ustoz bilan kashf eting.
                </h1>

                <p className="text-sm sm:text-base text-[#57534E] leading-relaxed max-w-2xl">
                  Har bir formula, elektr sxema va fizik jarayon o‘zbek tilida bosqichma-bosqich
                  chiziladi. O‘ng tarafdagi{' '}
                  <strong className="font-semibold text-[#111827]">Emoji Ustoz</strong> sichqonchangiz
                  harakatini ko‘zi bilan jonli kuzatib, doskada har bir qismni ko‘rsatib tushuntiradi.
                </p>
              </div>

              {/* Architectural Prompt Workbench (1.5px dark border) */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingVideo(true);
                }}
                onDragLeave={() => setIsDraggingVideo(false)}
                onDrop={handleCardDrop}
                className={`rounded-2xl bg-white p-4 sm:p-5 transition-all ${
                  isDraggingVideo
                    ? 'border-2 border-[#1D4ED8] ring-4 ring-[#1D4ED8]/15'
                    : 'border-[1.5px] border-[#111827] shadow-[0_10px_30px_rgba(17,24,39,0.06)]'
                }`}
              >
                {spotlightMode === 'topic' ? (
                  <form onSubmit={onSubmitPrompt} className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-tabular text-[11px] font-bold tracking-wider text-[#1D4ED8] uppercase">
                        DOSKA TOPSHIRIG‘I // MAVZU YOKI FORMULA KIRITING
                      </span>
                      <span className="hidden sm:inline-flex items-center gap-1 font-mono-tabular text-[11px] text-[#57534E]">
                        <Sparkles className="w-3 h-3 text-[#D97706]" />
                        2D / 2.5D Chizma + Ovoz
                      </span>
                    </div>

                    {imagePreview && (
                      <div className="flex items-center justify-between gap-2.5 rounded-xl bg-[#FAF8F5] px-3 py-2 border border-[#E6E2D8]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={imagePreview.dataUrl}
                            alt="Yuklangan masala rasmi"
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-lg object-cover border border-[#E6E2D8] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#111827] truncate">
                              {imagePreview.name}
                            </div>
                            <div className="text-[11px] text-[#57534E]">Doska tahlili uchun rasm</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={onClearImagePreview}
                          aria-label="Rasmni olib tashlash"
                          className="w-7 h-7 rounded-lg hover:bg-[#E6E2D8]/60 text-[#57534E] hover:text-[#111827] flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Input + Mic + Dark Architectural CTA */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <div className="flex-1 flex items-center gap-2 rounded-xl bg-[#FAF8F5] border border-[#E6E2D8] focus-within:border-[#111827] px-3.5 h-12 transition-colors">
                        <input
                          type="text"
                          value={queryText}
                          onChange={(e) => onQueryTextChange(e.target.value)}
                          placeholder="Masalan: Gidroakkumulyator elektr stansiyasi (GAES)..."
                          aria-label="Mavzu yoki savol"
                          className="flex-1 min-w-0 bg-transparent text-sm sm:text-[15px] font-medium text-[#111827] placeholder:text-[#78716C] focus:outline-none"
                        />

                        <button
                          type="button"
                          onClick={onToggleMic}
                          aria-label={isListening ? 'Ovoz yozishni to‘xtatish' : 'Ovoz bilan so‘rash'}
                          title={isListening ? 'Tinglanmoqda...' : 'Ovozli savol'}
                          className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                            isListening
                              ? 'bg-rose-600 text-white animate-pulse'
                              : 'bg-[#F0ECE1] hover:bg-[#E6E2D8] text-[#111827]'
                          }`}
                        >
                          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        aria-label="Doskani ochish"
                        className="h-12 px-5 rounded-xl bg-[#111827] hover:bg-[#1E293B] text-[#FDE68A] text-sm font-bold inline-flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Chizilmoqda...</span>
                          </>
                        ) : (
                          <>
                            <span>Doskani ochish</span>
                            <ArrowUpRight className="w-4 h-4 text-[#F59E0B]" />
                          </>
                        )}
                      </button>
                    </div>

                    {/* Bottom Toolbar inside Workbench */}
                    <div className="pt-3 border-t border-[#E6E2D8] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div ref={attachMenuRef} className="relative">
                          <button
                            type="button"
                            onClick={() => setAttachMenuOpen((v) => !v)}
                            aria-expanded={attachMenuOpen}
                            className="h-8 px-3 rounded-lg bg-[#F0ECE1] hover:bg-[#E6E2D8] text-xs font-semibold text-[#111827] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Plus className="w-3.5 h-3.5 text-[#1D4ED8]" />
                            <span>Rasm · Video yuklash</span>
                          </button>

                          {attachMenuOpen && (
                            <div className="absolute left-0 top-10 z-30 w-56 rounded-xl bg-white border border-[#111827] shadow-xl p-1.5 space-y-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setAttachMenuOpen(false);
                                  onOpenFilePicker();
                                }}
                                className="w-full px-3 py-2 rounded-lg hover:bg-[#FAF8F5] text-left text-xs font-semibold text-[#111827] flex items-center gap-2.5 cursor-pointer"
                              >
                                <ImageIcon className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                                <span>Masala rasmini yuklash</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAttachMenuOpen(false);
                                  videoInputRef.current?.click();
                                }}
                                className="w-full px-3 py-2 rounded-lg hover:bg-[#FAF8F5] text-left text-xs font-semibold text-[#111827] flex items-center gap-2.5 cursor-pointer"
                              >
                                <Film className="w-4 h-4 text-[#D97706] shrink-0" />
                                <span>MP4 video yuklash</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAttachMenuOpen(false);
                                  onOpenVideoModal();
                                }}
                                className="w-full px-3 py-2 rounded-lg hover:bg-[#FAF8F5] text-left text-xs font-semibold text-[#111827] flex items-center gap-2.5 cursor-pointer"
                              >
                                <Link2 className="w-4 h-4 text-[#059669] shrink-0" />
                                <span>YouTube havola qo‘shish</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step Count Selector (4..12) */}
                      <div
                        role="group"
                        aria-label="Dars bosqichlari soni (4 dan 12 gacha)"
                        className="inline-flex items-center gap-2"
                      >
                        <span className="text-[11px] font-semibold text-[#57534E] hidden sm:inline">
                          Bosqichlar:
                        </span>
                        <div className="inline-flex items-center rounded-lg bg-[#F0ECE1] border border-[#E6E2D8] p-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              onLessonStepCountChange(clampStepCount(lessonStepCount - 1))
                            }
                            disabled={lessonStepCount <= 4}
                            aria-label="Dars sonini kamaytirish"
                            className="w-7 h-7 rounded-md hover:bg-white disabled:opacity-35 text-[#111827] flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="min-w-[68px] px-2 text-center font-mono-tabular text-xs font-bold text-[#111827] whitespace-nowrap">
                            {lessonStepCount} qadam
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onLessonStepCountChange(clampStepCount(lessonStepCount + 1))
                            }
                            disabled={lessonStepCount >= 12}
                            aria-label="Dars sonini oshirish"
                            className="w-7 h-7 rounded-md hover:bg-white disabled:opacity-35 text-[#111827] flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleVideoFormSubmit} className="space-y-3.5">
                    <div className="font-mono-tabular text-[11px] font-bold tracking-wider text-[#1D4ED8] uppercase">
                      VIDEO LABORATORIYA // YOUTUBE YOKI MP4 DAN DARS YARATISH
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <div className="flex-1 flex items-center gap-2 rounded-xl bg-[#FAF8F5] border border-[#E6E2D8] px-3.5 h-12">
                        <Link2 className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                        <input
                          type="url"
                          value={youtubeDraft}
                          onChange={(e) => setYoutubeDraft(e.target.value)}
                          placeholder="YouTube video havolasini kiriting (https://youtube.com/watch?v=...)..."
                          aria-label="YouTube video havolasi"
                          className="flex-1 min-w-0 bg-transparent text-sm text-[#111827] placeholder:text-[#78716C] focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="h-12 px-5 rounded-xl bg-[#111827] hover:bg-[#1E293B] text-[#FDE68A] text-sm font-bold inline-flex items-center justify-center gap-2 shrink-0 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span>Tahlil qilish</span>
                        <ArrowUpRight className="w-4 h-4 text-[#F59E0B]" />
                      </button>
                    </div>

                    <div className="pt-3 border-t border-[#E6E2D8] flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        className="h-8 px-3.5 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-xs font-semibold text-[#1D4ED8] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Kompyuterdan MP4 tanlash</span>
                      </button>

                      <button
                        type="button"
                        onClick={onOpenUz3DPlayer}
                        className="h-8 px-3.5 rounded-lg bg-[#F0ECE1] hover:bg-[#E6E2D8] text-xs font-semibold text-[#111827] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Box className="w-3.5 h-3.5 text-[#D97706]" />
                        <span>Vizual Studiya</span>
                      </button>
                    </div>
                  </form>
                )}

                {errorMsg && (
                  <div className="mt-3 rounded-xl bg-rose-50 border border-rose-300 px-3.5 py-2.5 text-xs font-medium text-rose-900 flex items-center justify-between gap-2">
                    <span>{errorMsg}</span>
                    <button
                      type="button"
                      onClick={onDismissError}
                      aria-label="Xatoni yopish"
                      className="p-1 text-rose-700 hover:text-rose-950 cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN (5 cols): LIVE INTERACTIVE EYE-TRACKING EMOJI USTOZ STAGE */}
            <div className="lg:col-span-5 flex">
              <div className="w-full rounded-3xl bg-[#111827] border-2 border-[#F59E0B] p-5 sm:p-6 text-white flex flex-col justify-between gap-5 shadow-[0_18px_45px_rgba(17,24,39,0.16)] relative overflow-hidden">
                {/* Top Status Bar inside Dark Studio Card */}
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1F2937] border border-white/10 font-mono-tabular text-[11px] font-bold text-[#F59E0B]">
                    <Eye className="w-3.5 h-3.5 text-[#F59E0B]" />
                    JONLI EMOJI USTOZ · EYE-TRACKING
                  </span>

                  <span className="font-mono-tabular text-[11px] font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-2.5 py-1 rounded-md">
                    X:{cursorCoords.x} Y:{cursorCoords.y}
                  </span>
                </div>

                {/* Center Stage: Live Eye-Tracking Emoji Ustoz + Speech Callout */}
                <div className="flex flex-col sm:flex-row items-center gap-5 my-auto py-1">
                  <div className="relative shrink-0 p-2 rounded-3xl bg-gradient-to-b from-[#1E293B] to-[#0F172A] border border-white/10 shadow-inner">
                    <MirvoMentor
                      size={118}
                      isSpeaking={isListening}
                      isListening={isListening}
                      voiceActivity={isListening ? 0.65 : 0.08}
                      interactive
                    />
                  </div>

                  <div className="space-y-2.5 text-center sm:text-left">
                    <div className="inline-block px-2.5 py-0.5 rounded bg-[#F59E0B]/20 text-[#FDE68A] font-mono-tabular text-[10px] font-bold uppercase tracking-wider">
                      Sichqonchani harakatlantiring
                    </div>
                    <p
                      className="text-base sm:text-[17px] font-bold text-white leading-snug"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      “Salom! Sichqonchani qayerga olib borsangiz, ko‘zim bilan o‘sha nuqtani
                      kuzatib turaman!”
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Dars davomida ham doskaning burchagida turib, har bir chizma qismi va
                      formulaga ko‘zim bilan qarab ovozli tushuntirib beraman.
                    </p>
                  </div>
                </div>

                {/* Bottom Quick-Action Footer inside Emoji Ustoz Card */}
                <div className="pt-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono-tabular text-[11px] text-slate-300">
                    Ko‘z vektori: <strong className="text-[#FDE68A]">360° Kursor kuzatuvi</strong>
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      onSelectQuickTopic(
                        'Gidroakkumulyator elektr stansiyasi (GAES)',
                        'Gidroakkumulyator elektr stansiyasi (GAES)'
                      )
                    }
                    className="h-8 px-3 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-[#111827] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>GAES chizmasini sinash</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ==================== 3-COLUMN FIGMA STEM LAB MODULE CARDS ==================== */}
          <section aria-label="STEM Laboratoriya modullari" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6E2D8] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-[#111827]">
                  INTERAKTIV LABORATORIYA MODULLARI
                </span>
                <span className="px-2 py-0.5 rounded bg-[#F0ECE1] font-mono-tabular text-[11px] font-semibold text-[#57534E]">
                  FIGMA DESIGN SYSTEM
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {STUDIO_CHIP_TOPICS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => {
                      if (chip.starterId) {
                        onSelectStarterCard(chip.starterId);
                      } else {
                        onSelectQuickTopic(chip.query, chip.label);
                      }
                    }}
                    className="h-7 px-2.5 rounded-md bg-white hover:bg-[#111827] hover:text-white border border-[#E6E2D8] text-[11px] font-semibold text-[#57534E] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {STUDIO_MODULES.map((mod) => {
                const IconComp = mod.icon;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => {
                      if (mod.actionType === 'topic' && mod.query) {
                        onSelectQuickTopic(mod.query, mod.title);
                      } else {
                        onSelectStarterCard(mod.id);
                      }
                    }}
                    className="group text-left rounded-2xl bg-white border border-[#E6E2D8] hover:border-[#111827] p-6 flex flex-col justify-between gap-5 transition-all hover:-translate-y-0.5 shadow-[0_6px_24px_rgba(17,24,39,0.03)] hover:shadow-[0_14px_34px_rgba(17,24,39,0.08)] cursor-pointer"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="font-mono-tabular text-[11px] font-bold tracking-wider uppercase"
                          style={{ color: mod.accentColor }}
                        >
                          {mod.code}
                        </span>
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: mod.accentBg, color: mod.accentColor }}
                        >
                          <IconComp className="w-4 h-4" />
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <h2
                          className="text-lg font-bold tracking-[-0.025em] text-[#111827] group-hover:text-[#1D4ED8] transition-colors leading-snug"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {mod.title}
                        </h2>
                        <p className="text-[13px] text-[#57534E] leading-relaxed">
                          {mod.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3.5 border-t border-[#E6E2D8] flex items-center justify-between gap-2">
                      <span className="font-mono-tabular text-xs font-bold text-[#111827] bg-[#F5F2EB] border border-[#E6E2D8] px-3 py-1.5 rounded-lg">
                        {mod.formulaPreview}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#111827] group-hover:text-[#1D4ED8] transition-colors">
                        <span>Doskada ochish</span>
                        <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom Architectural Utility Bar */}
            <div className="pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#57534E]">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenDrawer('library')}
                  className="h-8 px-3.5 rounded-lg bg-white hover:bg-[#111827] hover:text-white border border-[#E6E2D8] font-semibold text-[#111827] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  <span>Barcha darslar kutubxonasi (18+)</span>
                </button>

                <button
                  type="button"
                  onClick={onEnterWorkspace}
                  className="h-8 px-3.5 rounded-lg bg-white hover:bg-[#111827] hover:text-white border border-[#E6E2D8] font-semibold text-[#111827] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Oxirgi ochilgan doskaga qaytish</span>
                </button>

                {!userEmail && (
                  <button
                    type="button"
                    onClick={() => onRequestAuth()}
                    className="h-8 px-3.5 rounded-lg bg-white hover:bg-[#F5F2EB] border border-[#E6E2D8] font-semibold text-[#57534E] hover:text-[#111827] transition-colors cursor-pointer"
                  >
                    Hisobga kirish
                  </button>
                )}
              </div>

              <div className="font-mono-tabular text-[11px] text-[#78716C]">
                FIGMA STUDIO UI · KO‘Z BILAN KUZATUVCHI EMOJI USTOZ · O‘ZBEK TILIDA
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
