import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Box,
  Droplets,
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
  Upload,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { MirvoLogo } from './MirvoLogo';
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

interface BentoExample {
  id: string;
  category: string;
  title: string;
  description: string;
  formulaPreview: string;
  icon: React.ComponentType<{ className?: string }>;
}

const BENTO_QUICK_EXAMPLES: readonly BentoExample[] = [
  {
    id: 'physics-transformer',
    category: 'Energetika · 2D/3D',
    title: 'Transformator va induksiya',
    description: 'Birlamchi va ikkilamchi chulg‘amlar, magnit oqimi hamda kuchlanish o‘zgarishi.',
    formulaPreview: 'U₁ / U₂ = N₁ / N₂',
    icon: Zap,
  },
  {
    id: 'wind-turbine-energy',
    category: 'ShES · 3D Animatsiya',
    title: 'Shamol turbinasi va Bets qonuni',
    description: 'Aerodinamik parraklar aylanishi, gondola generatori va shamol quvvati tahlili.',
    formulaPreview: 'P = ½ρAv³C_p',
    icon: Wind,
  },
  {
    id: 'hydraulic-press-pascal',
    category: 'Fizika · Gidravlika',
    title: 'Gidravlik press va Paskal qonuni',
    description: 'Suyuqliklarda bosim uzatilishi va kichik kuchdan katta yutish mexanizmi.',
    formulaPreview: 'F₁ / A₁ = F₂ / A₂',
    icon: Droplets,
  },
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
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);

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
    <div className="flex-1 min-h-0 flex flex-col bg-[#F5F5F7] text-[#1D1D1F] overflow-y-auto academic-scroll">
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

      {/* ==================== MINIMALIST APPLE GLASS TOP NAVBAR ==================== */}
      <header className="sticky top-0 z-30 h-14 shrink-0 apple-glass border-b border-black/5">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-3">
          {/* Left: Clean Brand Mark */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center cursor-pointer shrink-0"
            aria-label="Mirvo AI bosh sahifasi"
          >
            <MirvoLogo size="md" />
          </button>

          {/* Center: Apple Segmented Pill Switcher */}
          <nav
            aria-label="Asosiy rejim"
            className="inline-flex items-center p-1 rounded-full bg-black/[0.045] border border-black/[0.04]"
          >
            <button
              type="button"
              onClick={() => setSpotlightMode('topic')}
              aria-pressed={spotlightMode === 'topic'}
              className={`min-h-[30px] px-3 sm:px-4 rounded-full text-xs sm:text-[13px] font-medium apple-transition cursor-pointer whitespace-nowrap shrink-0 ${
                spotlightMode === 'topic'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              Mavzu bo‘yicha
            </button>
            <button
              type="button"
              onClick={() => setSpotlightMode('video')}
              aria-pressed={spotlightMode === 'video'}
              className={`min-h-[30px] px-3 sm:px-4 rounded-full text-xs sm:text-[13px] font-medium apple-transition cursor-pointer whitespace-nowrap shrink-0 ${
                spotlightMode === 'video'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              Videodan dars
            </button>
          </nav>

          {/* Right: Saved / Recent Lessons + PWA Install + Settings */}
          <div className="flex items-center gap-1.5 shrink-0">
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={() => onOpenDrawer('history')}
              aria-label="Saqlangan darslar tarixi"
              className="h-9 px-3 rounded-full bg-white/80 hover:bg-white border border-black/[0.06] text-xs font-medium text-[#1D1D1F] inline-flex items-center gap-1.5 apple-transition cursor-pointer whitespace-nowrap"
            >
              <History className="w-3.5 h-3.5 text-[#0071E3]" />
              <span className="hidden sm:inline">Saqlanganlar</span>
              {totalHistoryCount > 0 && (
                <span className="font-mono-tabular px-1.5 py-0.5 rounded-full bg-[#0071E3]/[0.1] text-[#0071E3] text-[10px] font-semibold leading-none">
                  {totalHistoryCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onOpenDrawer('settings')}
              aria-label="Sozlamalar va hisob"
              title={userEmail || 'Sozlamalar'}
              className="w-9 h-9 rounded-full bg-white/80 hover:bg-white border border-black/[0.06] text-[#6E6E73] hover:text-[#1D1D1F] inline-flex items-center justify-center apple-transition cursor-pointer shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ==================== HERO + SPOTLIGHT + BENTO GRID ==================== */}
      <main className="flex-1 px-4 sm:px-6 pt-12 sm:pt-16 pb-16">
        <div className="max-w-5xl mx-auto">
          {/* Hero Copy */}
          <section className="max-w-3xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center rounded-full px-3.5 py-1.5 bg-[#0071E3]/[0.08] text-[#0071E3] text-xs font-medium tracking-[-0.01em]">
              AI Interaktiv Doska • O‘zbek tilida
            </div>

            <h1
              className="text-4xl md:text-5xl font-semibold tracking-[-0.025em] text-[#1D1D1F] leading-[1.08]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Murakkab mavzularni jonli ko‘ring.
            </h1>

            <p className="text-base sm:text-lg text-[#6E6E73] leading-relaxed max-w-2xl mx-auto">
              2D va 3D modellar, chizmalar hamda ovozli tahlil bilan istalgan mavzuni bosqichma-bosqich
              tushuning.
            </p>
          </section>

          {/* Decluttered Unified Spotlight Action Card */}
          <section aria-label="Dars yaratish maydoni" className="mt-9 sm:mt-11">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingVideo(true);
              }}
              onDragLeave={() => setIsDraggingVideo(false)}
              onDrop={handleCardDrop}
              className={`max-w-2xl mx-auto rounded-3xl bg-white p-3.5 sm:p-4 apple-transition ${
                isDraggingVideo
                  ? 'border-2 border-[#0071E3] ring-4 ring-[#0071E3]/10 shadow-[0_12px_36px_rgba(0,113,227,0.12)]'
                  : 'border border-black/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.04)]'
              }`}
            >
              {spotlightMode === 'topic' ? (
                <form onSubmit={onSubmitPrompt} className="space-y-3">
                  {imagePreview && (
                    <div className="flex items-center justify-between gap-2.5 rounded-2xl bg-[#F5F5F7] px-3 py-2 border border-black/[0.04]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={imagePreview.dataUrl}
                          alt="Yuklangan masala rasmi"
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-xl object-cover border border-black/[0.06] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[#1D1D1F] truncate">
                            {imagePreview.name}
                          </div>
                          <div className="text-[11px] text-[#6E6E73]">Doska uchun rasm</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onClearImagePreview}
                        aria-label="Rasmni olib tashlash"
                        className="w-8 h-8 rounded-full hover:bg-black/[0.05] text-[#6E6E73] hover:text-[#1D1D1F] flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Primary Clean Input Row */}
                  <div className="flex items-center gap-2 pl-2 pr-0.5">
                    <input
                      type="text"
                      value={queryText}
                      onChange={(e) => onQueryTextChange(e.target.value)}
                      placeholder="Savol yoki mavzu yozing..."
                      aria-label="Mavzu yoki savol"
                      className="flex-1 min-w-0 h-11 bg-transparent text-[15px] sm:text-base text-[#1D1D1F] placeholder:text-[#6E6E73]/75 focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={onToggleMic}
                      aria-label={isListening ? 'Ovoz yozishni to‘xtatish' : 'Ovoz bilan savol'}
                      title={isListening ? 'Tinglanmoqda...' : 'Ovozli savol'}
                      className={`w-9 h-9 rounded-full inline-flex items-center justify-center apple-transition cursor-pointer shrink-0 ${
                        isListening
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-[#F5F5F7] hover:bg-black/[0.07] text-[#6E6E73] hover:text-[#1D1D1F]'
                      }`}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    <button
                      type="submit"
                      disabled={isLoading}
                      aria-label="Dars yaratish"
                      className="h-10 px-4 sm:px-5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-medium inline-flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 apple-transition cursor-pointer whitespace-nowrap"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span className="hidden sm:inline">Boshlash</span>
                          <ArrowUp className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Organized Compact Control Bar: + Attach Menu (Left) + 4..12 Step Count Selector (Right) */}
                  <div className="pt-2.5 border-t border-black/[0.05] flex items-center justify-between gap-2 px-1">
                    <div ref={attachMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setAttachMenuOpen((v) => !v)}
                        aria-expanded={attachMenuOpen}
                        className="h-8 px-3 rounded-full bg-[#F5F5F7] hover:bg-black/[0.06] text-xs font-medium text-[#1D1D1F] inline-flex items-center gap-1.5 apple-transition cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#0071E3]" />
                        <span>Rasm · Video</span>
                      </button>

                      {attachMenuOpen && (
                        <div className="absolute left-0 top-10 z-30 w-52 rounded-2xl bg-white border border-black/[0.08] shadow-[0_14px_36px_rgba(0,0,0,0.12)] p-1.5 space-y-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAttachMenuOpen(false);
                              onOpenFilePicker();
                            }}
                            className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F5F7] text-left text-xs font-medium text-[#1D1D1F] flex items-center gap-2.5 cursor-pointer"
                          >
                            <ImageIcon className="w-4 h-4 text-[#0071E3] shrink-0" />
                            <span>Masala rasmini yuklash</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAttachMenuOpen(false);
                              videoInputRef.current?.click();
                            }}
                            className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F5F7] text-left text-xs font-medium text-[#1D1D1F] flex items-center gap-2.5 cursor-pointer"
                          >
                            <Film className="w-4 h-4 text-[#0071E3] shrink-0" />
                            <span>MP4 video yuklash</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAttachMenuOpen(false);
                              onOpenVideoModal();
                            }}
                            className="w-full px-3 py-2 rounded-xl hover:bg-[#F5F5F7] text-left text-xs font-medium text-[#1D1D1F] flex items-center gap-2.5 cursor-pointer"
                          >
                            <Link2 className="w-4 h-4 text-[#0071E3] shrink-0" />
                            <span>YouTube havola qo‘shish</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* User-Selectable Lesson Count (4 to 12) */}
                    <div
                      role="group"
                      aria-label="Dars bosqichlari soni (4 dan 12 gacha)"
                      className="inline-flex items-center gap-1.5"
                    >
                      <span className="text-[11px] font-medium text-[#6E6E73] hidden sm:inline">
                        Darslar soni:
                      </span>
                      <div className="inline-flex items-center rounded-full bg-[#F5F5F7] border border-black/[0.05] p-0.5">
                        <button
                          type="button"
                          onClick={() => onLessonStepCountChange(clampStepCount(lessonStepCount - 1))}
                          disabled={lessonStepCount <= 4}
                          aria-label="Dars sonini kamaytirish"
                          className="w-7 h-7 rounded-full hover:bg-white disabled:opacity-35 text-[#1D1D1F] flex items-center justify-center apple-transition cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="min-w-[56px] px-2 text-center font-mono-tabular text-xs font-semibold text-[#1D1D1F] whitespace-nowrap">
                          {lessonStepCount} ta dars
                        </span>
                        <button
                          type="button"
                          onClick={() => onLessonStepCountChange(clampStepCount(lessonStepCount + 1))}
                          disabled={lessonStepCount >= 12}
                          aria-label="Dars sonini oshirish"
                          className="w-7 h-7 rounded-full hover:bg-white disabled:opacity-35 text-[#1D1D1F] flex items-center justify-center apple-transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVideoFormSubmit} className="space-y-3">
                  <div className="flex items-center gap-2 pl-2 pr-0.5">
                    <Link2 className="w-4 h-4 text-[#0071E3] shrink-0" />
                    <input
                      type="url"
                      value={youtubeDraft}
                      onChange={(e) => setYoutubeDraft(e.target.value)}
                      placeholder="YouTube video havolasini kiriting (https://youtube.com/watch?v=...)..."
                      aria-label="YouTube video havolasi"
                      className="flex-1 min-w-0 h-11 bg-transparent text-[15px] text-[#1D1D1F] placeholder:text-[#6E6E73]/75 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="h-10 px-4 sm:px-5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-medium inline-flex items-center justify-center gap-1.5 shrink-0 apple-transition cursor-pointer whitespace-nowrap"
                    >
                      <span>Davom etish</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="pt-2.5 border-t border-black/[0.05] flex flex-wrap items-center justify-between gap-2 px-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        className="h-8 px-3.5 rounded-full bg-[#0071E3]/[0.08] hover:bg-[#0071E3]/[0.14] text-xs font-medium text-[#0071E3] inline-flex items-center gap-1.5 apple-transition cursor-pointer whitespace-nowrap"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Lokal MP4 fayl</span>
                      </button>

                      <button
                        type="button"
                        onClick={onOpenUz3DPlayer}
                        className="h-8 px-3.5 rounded-full bg-[#F5F5F7] hover:bg-black/[0.06] text-xs font-medium text-[#1D1D1F] inline-flex items-center gap-1.5 apple-transition cursor-pointer whitespace-nowrap"
                      >
                        <Box className="w-3.5 h-3.5 text-[#0071E3]" />
                        <span>Uz3D Pleyer</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {errorMsg && (
                <div className="mt-3 rounded-2xl bg-rose-50 border border-rose-200/70 px-3.5 py-2.5 text-xs text-rose-800 flex items-center justify-between gap-2">
                  <span>{errorMsg}</span>
                  <button
                    type="button"
                    onClick={onDismissError}
                    aria-label="Xatoni yopish"
                    className="p-1 text-rose-600 hover:text-rose-900 cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ==================== 3-COLUMN BENTO GRID QUICK-START EXAMPLES ==================== */}
          <section aria-label="Tezkor dars misollari" className="mt-10 sm:mt-12 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              {BENTO_QUICK_EXAMPLES.map((item) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectStarterCard(item.id)}
                    className="group text-left rounded-3xl bg-white border border-black/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_14px_38px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 p-6 flex flex-col justify-between gap-5 apple-transition cursor-pointer"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#0071E3]/[0.08] text-[#0071E3] flex items-center justify-center shrink-0">
                          <IconComp className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-medium text-[#6E6E73]">
                          {item.category}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <h2
                          className="text-base sm:text-[17px] font-semibold tracking-[-0.02em] text-[#1D1D1F] group-hover:text-[#0071E3] apple-transition leading-snug"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {item.title}
                        </h2>
                        <p className="text-[13px] text-[#6E6E73] leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-black/[0.05] flex items-center justify-between gap-2">
                      <span className="font-mono-tabular text-xs font-medium text-[#1D1D1F] bg-[#F5F5F7] px-2.5 py-1 rounded-full">
                        {item.formulaPreview}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0071E3]">
                        <span>Ochish</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 apple-transition" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Minimal Utility Links Strip */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onOpenDrawer('library')}
                className="h-8 px-3.5 rounded-full bg-white/85 hover:bg-white border border-black/[0.06] text-xs font-medium text-[#1D1D1F] inline-flex items-center gap-1.5 apple-transition cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#0071E3]" />
                <span>Darslar kutubxonasi</span>
              </button>

              <button
                type="button"
                onClick={onOpenUz3DPlayer}
                className="h-8 px-3.5 rounded-full bg-white/85 hover:bg-white border border-black/[0.06] text-xs font-medium text-[#1D1D1F] inline-flex items-center gap-1.5 apple-transition cursor-pointer whitespace-nowrap"
              >
                <Box className="w-3.5 h-3.5 text-[#0071E3]" />
                <span>Uz3D Studio</span>
              </button>

              <button
                type="button"
                onClick={onEnterWorkspace}
                className="h-8 px-3.5 rounded-full bg-white/85 hover:bg-white border border-black/[0.06] text-xs font-medium text-[#1D1D1F] apple-transition cursor-pointer whitespace-nowrap"
              >
                Oxirgi doska
              </button>

              {!userEmail && (
                <button
                  type="button"
                  onClick={() => onRequestAuth()}
                  className="h-8 px-3.5 rounded-full bg-white/85 hover:bg-white border border-black/[0.06] text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] apple-transition cursor-pointer whitespace-nowrap"
                >
                  Hisobga kirish
                </button>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
