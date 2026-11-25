import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Coins,
  Loader2,
  Mic,
  MicOff,
  Minus,
  Plus,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { PbrMachine3DStage } from './engines/PbrMachine3DStage';
import { PWAInstallButton } from './PWAInstallButton';
import {
  formatCostUsd,
  formatCostUzsApprox,
  formatTokenCount,
  loadLessonTokenLogs,
  type SessionTokenStats,
} from '../lib/tokenUsage';

export type LabModel = 'transformer' | 'turbine' | 'hydraulic' | 'gaes';

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

type NativeTab = 'doska' | 'darslar' | 'reels' | 'profil';
type ThemeMode = 'light' | 'dark';
type SubjectFilter = 'Barchasi' | 'Fizika' | 'Matematika' | 'Kimyo' | 'Biologiya';

interface ReelItem {
  id: string;
  model: LabModel;
  starterId: string;
  f: string;
  t: string;
  detail: string;
}

const REELS_DATA: readonly ReelItem[] = [
  {
    id: 'reel-bets',
    model: 'turbine',
    starterId: 'wind-turbine-energy',
    f: 'Bets qonuni: Cp max = 59.3%',
    t: 'Shamol tezligi 2x oshsa, quvvat 8x ortadi',
    detail:
      'Quvvat shamol tezligining kubiga (v³) proporsional. Albert Bets nazariyasiga ko‘ra, hech bir turbina shamol energiyasining 59.3% dan ortig‘ini ololmaydi.',
  },
  {
    id: 'reel-pascal',
    model: 'hydraulic',
    starterId: 'hydraulic-press-pascal',
    f: 'Paskal qonuni: F2 = F1 × (S2/S1)',
    t: 'Kichik kuch bilan og‘ir yukni ko‘tarish siri',
    detail:
      'Yopiq suyuqlikda bosim hamma tomonga bir xil uzatiladi. Katta porshen yuzasi 6 barobar katta bo‘lsa, chiqish kuchi ham 6 barobar ortadi.',
  },
  {
    id: 'reel-transformer',
    model: 'transformer',
    starterId: 'physics-transformer',
    f: 'Induksiya: U2 / U1 = N2 / N1',
    t: 'Transformator harakatsiz kuchlanishni o‘zgartiradi',
    detail:
      'Birlamchi chulg‘amdagi o‘zgaruvchan tok po‘lat o‘zakda magnit oqimi hosil qiladi va ikkilamchi chulg‘amda mutanosib kuchlanish uyg‘otadi.',
  },
];

const SUBJECT_FILTERS: readonly SubjectFilter[] = [
  'Barchasi',
  'Fizika',
  'Matematika',
  'Kimyo',
  'Biologiya',
];

export const FigmaLandingOverview: React.FC<FigmaLandingOverviewProps> = ({
  userEmail,
  userName,
  totalHistoryCount,
  sessionTokenStats,
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
  onOpenDrawer,
  onRequestAuth,
}) => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = window.localStorage.getItem('mirvo_theme_v1');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore
    }
    return 'light';
  });

  const [activeTab, setActiveTab] = useState<NativeTab>('doska');
  const [model, setModel] = useState<LabModel>('transformer');
  const [sl1, setSl1] = useState<number>(220);
  const [sl2, setSl2] = useState<number>(3.5);
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>('Barchasi');
  const [reelIdx, setReelIdx] = useState<number>(0);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const toastTimerRef = useRef<number | null>(null);

  const lessonTokenLogs = useMemo(
    () => loadLessonTokenLogs(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionTokenStats.total_tokens, sessionTokenStats.ai_requests]
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem('mirvo_theme_v1', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
    }, 2200);
  };

  const clampStepCount = (n: number) => Math.max(4, Math.min(6, Math.round(n)));

  const sliderConfig = useMemo(() => {
    if (model === 'turbine') {
      return {
        s1l: 'Shamol tezligi',
        s1v: `${sl1} m/s`,
        s1Min: 3,
        s1Max: 20,
        s1Step: 1,
        s2l: 'Parrak diametri',
        s2v: `${sl2} m`,
        s2Min: 20,
        s2Max: 60,
        s2Step: 5,
      };
    }
    if (model === 'hydraulic') {
      return {
        s1l: 'Kirish kuchi (F1)',
        s1v: `${sl1} N`,
        s1Min: 10,
        s1Max: 100,
        s1Step: 5,
        s2l: 'Yuza nisbati (S2/S1)',
        s2v: `${sl2}x`,
        s2Min: 2,
        s2Max: 12,
        s2Step: 1,
      };
    }
    if (model === 'gaes') {
      return {
        s1l: 'Bosim balandligi (H)',
        s1v: `${sl1} m`,
        s1Min: 40,
        s1Max: 220,
        s1Step: 10,
        s2l: 'Oqim rejimi',
        s2v: `${sl2 > 0 ? '+' : ''}${sl2}%`,
        s2Min: -100,
        s2Max: 100,
        s2Step: 10,
      };
    }
    return {
      s1l: 'Kirish kuchlanishi',
      s1v: `${sl1} V`,
      s1Min: 110,
      s1Max: 380,
      s1Step: 10,
      s2l: 'O‘ramlar nisbati',
      s2v: `${sl2.toFixed(1)}x`,
      s2Min: 1,
      s2Max: 6,
      s2Step: 0.5,
    };
  }, [model, sl1, sl2]);

  const pickModel = (nextModel: LabModel) => {
    setModel(nextModel);
    if (nextModel === 'transformer') {
      setSl1(220);
      setSl2(3.5);
    } else if (nextModel === 'turbine') {
      setSl1(10);
      setSl2(40);
    } else if (nextModel === 'gaes') {
      setSl1(120);
      setSl2(85);
    } else {
      setSl1(40);
      setSl2(6);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = queryText.trim().toLowerCase();
    if (v.includes('gaes') || v.includes('gidroakkum') || v.includes('ges')) {
      pickModel('gaes');
    } else if (v.includes('shamol') || v.includes('turbin')) {
      pickModel('turbine');
    } else if (v.includes('gidrav') || v.includes('paskal') || v.includes('press')) {
      pickModel('hydraulic');
    } else if (v.includes('transformator') || v.includes('induksiya')) {
      pickModel('transformer');
    }

    if (queryText.trim() || imagePreview) {
      onSubmitPrompt(e);
    } else {
      showToast('Mavzu yoki savol yozing');
    }
  };

  const activeReel = REELS_DATA[reelIdx];
  const showCard = (categories: readonly SubjectFilter[]) =>
    subjectFilter === 'Barchasi' || categories.includes(subjectFilter);

  const MirvoMarkSvg = (
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#1D4ED8" />
      <path
        d="M10 27V13L17 22L23 13L30 27"
        stroke="#FFFFFF"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="30" cy="12" r="3" fill="#38BDF8" />
    </svg>
  );

  const navItems: readonly { id: NativeTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'doska',
      label: 'Doska',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      ),
    },
    {
      id: 'darslar',
      label: 'Darslar',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
    },
    {
      id: 'reels',
      label: 'Qisqa',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
          <polygon points="6 4 20 12 6 20 6 4" />
        </svg>
      ),
    },
    {
      id: 'profil',
      label: 'Profil',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  const isDark = theme === 'dark';

  return (
    <div className="mirvo-native flex-1 min-h-0 flex flex-col relative overflow-hidden">
      <div className={`toast ${toastVisible ? 'show' : ''}`} role="status" aria-live="polite">
        {toastMsg}
      </div>

      {/* Desktop Header */}
      <header className="desktop-nav-bar">
        <div className="desktop-nav-inner">
          <button
            type="button"
            className="brand"
            onClick={() => setActiveTab('doska')}
            aria-label="Mirvo bosh sahifa"
          >
            {MirvoMarkSvg}
            <span>Mirvo</span>
          </button>

          <nav className="desktop-tabs" aria-label="Asosiy navigatsiya">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`desktop-tab-btn ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="top-actions">
            <div className="theme-seg" role="group" aria-label="Mavzu rejimi">
              <button
                type="button"
                className={`t-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                Yorug‘
              </button>
              <button
                type="button"
                className={`t-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                Qorong‘i
              </button>
            </div>
            <PWAInstallButton compact />
            <button
              type="button"
              className="pill-stat"
              onClick={() => onOpenDrawer('settings')}
              aria-label="Sozlamalar"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Scrollable Viewport */}
      <div className="scroll-area">
        <div className="stage-shell">
          {/* ==================== TAB 1: CLEAN HOME (LEFT: PROMPT + TOKEN METER, RIGHT: OPEN 3D CANVAS + SLIDERS) ==================== */}
          {activeTab === 'doska' && (
            <section className="tab-view" id="tab-doska">
              <div className="top-row mobile-only-top">
                <button type="button" className="brand" onClick={() => setActiveTab('doska')}>
                  {MirvoMarkSvg}
                  <span>Mirvo</span>
                </button>
                <div className="top-actions">
                  <div className="theme-seg" role="group" aria-label="Mavzu">
                    <button
                      type="button"
                      className={`t-btn ${theme === 'light' ? 'active' : ''}`}
                      onClick={() => setTheme('light')}
                    >
                      Yorug‘
                    </button>
                    <button
                      type="button"
                      className={`t-btn ${theme === 'dark' ? 'active' : ''}`}
                      onClick={() => setTheme('dark')}
                    >
                      Qorong‘i
                    </button>
                  </div>
                </div>
              </div>

              <div className="doska-desktop-grid">
                {/* LEFT COLUMN: Clean Headline + Topic Prompt Input + Compact Token Meter */}
                <div>
                  <h1 className="h1">Murakkab mavzularni jonli ko‘ring</h1>
                  <p className="lead">
                    Istalgan qurilma yoki mavzuni yozing — 3D detal bosqichma-bosqich ochiladi va
                    o‘zbekcha ovoz bilan tushuntiriladi.
                  </p>

                  <form className="prompt-card" onSubmit={handleFormSubmit}>
                    {imagePreview && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '6px 10px',
                          borderRadius: 12,
                          background: 'var(--surface-2)',
                          marginBottom: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <img
                            src={imagePreview.dataUrl}
                            alt="Yuklangan rasm"
                            style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }}
                          />
                          <span
                            style={{
                              fontSize: 12.5,
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {imagePreview.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={onClearImagePreview}
                          aria-label="Rasmni olib tashlash"
                          className="soft-btn"
                          style={{ padding: 5 }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <input
                      id="qInput"
                      type="text"
                      enterKeyHint="send"
                      value={queryText}
                      onChange={(e) => onQueryTextChange(e.target.value)}
                      placeholder="Savol yoki mavzu yozing..."
                      aria-label="Savol yoki mavzu"
                    />

                    <div className="prompt-foot">
                      <div className="tool-pills">
                        <button type="button" className="soft-btn" onClick={onOpenFilePicker}>
                          Rasm
                        </button>
                        <button type="button" className="soft-btn" onClick={onOpenVideoModal}>
                          Video
                        </button>
                        <button
                          type="button"
                          className={`soft-btn ${isListening ? 'listening' : ''}`}
                          onClick={onToggleMic}
                          aria-label="Ovozli kiritish"
                        >
                          {isListening ? (
                            <MicOff className="w-3.5 h-3.5" />
                          ) : (
                            <Mic className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <div
                          className="soft-btn"
                          style={{ padding: '4px 6px', gap: 4 }}
                          role="group"
                          aria-label="Dars bosqichlari soni"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              onLessonStepCountChange(clampStepCount(lessonStepCount - 1))
                            }
                            disabled={lessonStepCount <= 4}
                            aria-label="Kamaytirish"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'inherit',
                              cursor: 'pointer',
                              display: 'inline-flex',
                            }}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>
                            {lessonStepCount} qadam
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onLessonStepCountChange(clampStepCount(lessonStepCount + 1))
                            }
                            disabled={lessonStepCount >= 6}
                            aria-label="Oshirish"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'inherit',
                              cursor: 'pointer',
                              display: 'inline-flex',
                            }}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <button type="submit" className="btn-go" disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Boshlash'}
                      </button>
                    </div>

                    {errorMsg && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: '8px 10px',
                          borderRadius: 12,
                          background: 'rgba(225, 29, 72, 0.12)',
                          color: '#E11D48',
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span>{errorMsg}</span>
                        <button
                          type="button"
                          onClick={onDismissError}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'inherit',
                            cursor: 'pointer',
                          }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </form>

                  {/* Compact Per-Lesson Token Counter */}
                  <div
                    style={{
                      marginTop: 14,
                      padding: '11px 14px',
                      borderRadius: 16,
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--ink)',
                        }}
                      >
                        <Coins className="w-3.5 h-3.5 text-amber-500" />
                        Token hisoblagich
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('profil')}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--accent)',
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Tarix ({lessonTokenLogs.length}) ›
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        fontSize: 11.5,
                        color: 'var(--muted)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <span>
                        Jami:{' '}
                        <strong style={{ color: 'var(--ink)' }}>
                          {formatTokenCount(sessionTokenStats.total_tokens)}
                        </strong>
                      </span>
                      <span>
                        Kirish: <strong>{formatTokenCount(sessionTokenStats.prompt_tokens)}</strong>
                      </span>
                      <span>
                        Chiqish: <strong>{formatTokenCount(sessionTokenStats.output_tokens)}</strong>
                      </span>
                      <strong style={{ color: '#059669' }}>
                        {formatCostUsd(sessionTokenStats.cost_usd)} (
                        {formatCostUzsApprox(sessionTokenStats.cost_usd)})
                      </strong>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Clean Open 3D Stage (NO Emoji, NO Speech Bubble, NO Lab Chrome) + Basic Sliders */}
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 24,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: 360,
                      borderRadius: 18,
                      overflow: 'hidden',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <PbrMachine3DStage
                      machineKey={model === 'hydraulic' ? 'hydraulics' : model}
                      sliderValues={
                        model === 'transformer'
                          ? { u1: sl1, turns_ratio: sl2 }
                          : model === 'turbine'
                            ? { wind_speed: sl1, blade_r: sl2 }
                            : model === 'gaes'
                              ? {
                                  head: sl1,
                                  flow: Math.abs(sl2),
                                  mode: sl2 < -5 ? -1 : sl2 > 5 ? 1 : 0,
                                }
                              : { force_in: sl1, area_ratio: sl2 }
                      }
                      isPlaying={true}
                      darkSurface={isDark}
                      showHud={false}
                    />
                  </div>

                  {/* Basic Control Sliders Only */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 14,
                    }}
                  >
                    <div className="sl">
                      <label
                        htmlFor="sl1"
                        style={{ color: 'var(--ink)', fontSize: 12.5, fontWeight: 600 }}
                      >
                        <span>{sliderConfig.s1l}</span>
                        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {sliderConfig.s1v}
                        </strong>
                      </label>
                      <input
                        id="sl1"
                        type="range"
                        min={sliderConfig.s1Min}
                        max={sliderConfig.s1Max}
                        step={sliderConfig.s1Step}
                        value={sl1}
                        onChange={(e) => setSl1(parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="sl">
                      <label
                        htmlFor="sl2"
                        style={{ color: 'var(--ink)', fontSize: 12.5, fontWeight: 600 }}
                      >
                        <span>{sliderConfig.s2l}</span>
                        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {sliderConfig.s2v}
                        </strong>
                      </label>
                      <input
                        id="sl2"
                        type="range"
                        min={sliderConfig.s2Min}
                        max={sliderConfig.s2Max}
                        step={sliderConfig.s2Step}
                        value={sl2}
                        onChange={(e) => setSl2(parseFloat(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ==================== TAB 2: DARSLAR ==================== */}
          {activeTab === 'darslar' && (
            <section className="tab-view" id="tab-darslar">
              <div className="top-row">
                <h1 className="h1" style={{ margin: 0, fontSize: 22 }}>
                  Fanlar va darslar
                </h1>
                <button
                  type="button"
                  className="pill-stat"
                  onClick={() => onOpenDrawer('history')}
                >
                  Saqlangan: {totalHistoryCount || 6}
                </button>
              </div>

              <div className="filters">
                {SUBJECT_FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`f-btn ${subjectFilter === f ? 'active' : ''}`}
                    onClick={() => setSubjectFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="bento">
                {showCard(['Fizika']) && (
                  <button
                    type="button"
                    className="b-card wide dark"
                    onClick={() => onSelectStarterCard('physics-transformer')}
                  >
                    <div>
                      <div className="b-kicker">Energetika</div>
                      <div className="b-title">Transformator va elektromagnit induksiya</div>
                      <div className="b-sub">3D model va ovozli tushuntirish</div>
                    </div>
                  </button>
                )}

                {showCard(['Fizika']) && (
                  <button
                    type="button"
                    className="b-card"
                    onClick={() => onSelectStarterCard('wind-turbine-energy')}
                  >
                    <div className="b-kicker">ShES</div>
                    <div>
                      <div className="b-title">Shamol turbinasi (Bets)</div>
                      <div className="b-sub">3D parrak va generator</div>
                    </div>
                  </button>
                )}

                {showCard(['Fizika']) && (
                  <button
                    type="button"
                    className="b-card"
                    onClick={() => onSelectStarterCard('hydraulic-press-pascal')}
                  >
                    <div className="b-kicker">Gidravlika</div>
                    <div>
                      <div className="b-title">Gidravlik press (Paskal)</div>
                      <div className="b-sub">Bosim va kuchdan yutish</div>
                    </div>
                  </button>
                )}

                {showCard(['Fizika']) && (
                  <button
                    type="button"
                    className="b-card"
                    onClick={() =>
                      onSelectQuickTopic(
                        'Gidroakkumulyator elektr stansiyasi (GAES)',
                        'GAES stansiya'
                      )
                    }
                  >
                    <div className="b-kicker">Gidroenergetika</div>
                    <div>
                      <div className="b-title">Gidroakkumulyator (GAES)</div>
                      <div className="b-sub">3D stansiya va suv oqimi</div>
                    </div>
                  </button>
                )}

                {showCard(['Matematika']) && (
                  <button
                    type="button"
                    className="b-card"
                    onClick={() => onSelectStarterCard('pythagoras-visual')}
                  >
                    <div className="b-kicker">Matematika</div>
                    <div>
                      <div className="b-title">Pifagor teoremasi va grafiklar</div>
                      <div className="b-sub">Interaktiv geometriya</div>
                    </div>
                  </button>
                )}

                {showCard(['Kimyo', 'Biologiya']) && (
                  <button
                    type="button"
                    className="b-card wide"
                    onClick={() => onSelectStarterCard('caffeine-pubchem-3d')}
                  >
                    <div className="b-kicker">Kimyo va Biologiya</div>
                    <div>
                      <div className="b-title">Organik molekulalar va hujayra tuzilishi</div>
                      <div className="b-sub">Vizual bosqichli dars</div>
                    </div>
                  </button>
                )}
              </div>
            </section>
          )}

          {/* ==================== TAB 3: QISQA ==================== */}
          {activeTab === 'reels' && (
            <section className="tab-view" id="tab-reels">
              <div className="top-row">
                <h1 className="h1" style={{ margin: 0, fontSize: 22 }}>
                  Qisqa darslar
                </h1>
              </div>

              <div className="reels-layout">
                <div className="reel-stage">
                  <div className="reel-progress">
                    {REELS_DATA.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`reel-bar ${
                          idx < reelIdx ? 'done' : idx === reelIdx ? 'active' : ''
                        }`}
                      >
                        <span />
                      </div>
                    ))}
                  </div>

                  <div className="reel-center">
                    <span className="reel-formula">{activeReel.f}</span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 360,
                        height: 240,
                        borderRadius: 16,
                        overflow: 'hidden',
                      }}
                    >
                      <PbrMachine3DStage
                        machineKey={activeReel.model === 'hydraulic' ? 'hydraulics' : activeReel.model}
                        sliderValues={
                          activeReel.model === 'turbine'
                            ? { wind_speed: 12, blade_r: 45 }
                            : activeReel.model === 'hydraulic'
                              ? { force_in: 50, area_ratio: 8 }
                              : { u1: 220, turns_ratio: 4 }
                        }
                        autoRotate={true}
                        isPlaying={true}
                        darkSurface={false}
                        showHud={false}
                      />
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 17,
                        fontWeight: 800,
                        lineHeight: 1.3,
                      }}
                    >
                      {activeReel.t}
                    </div>
                  </div>

                  <div className="reel-foot">
                    <button
                      type="button"
                      className="btn-go full"
                      onClick={() => setReelIdx((prev) => (prev + 1) % REELS_DATA.length)}
                    >
                      Keyingi qisqa dars
                    </button>
                  </div>
                </div>

                <aside className="reels-aside">
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 22,
                      padding: 20,
                    }}
                  >
                    <div className="b-kicker">Qisqa dars</div>
                    <div className="b-title" style={{ fontSize: 20, marginBottom: 8 }}>
                      {activeReel.t}
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 16 }}>
                      {activeReel.detail}
                    </p>
                    <button
                      type="button"
                      className="btn-go"
                      onClick={() => onSelectStarterCard(activeReel.starterId)}
                    >
                      Darsni ochish
                    </button>
                  </div>
                </aside>
              </div>
            </section>
          )}

          {/* ==================== TAB 4: PROFIL & PER-LESSON TOKEN LOG ==================== */}
          {activeTab === 'profil' && (
            <section className="tab-view" id="tab-profil">
              <div className="top-row">
                <h1 className="h1" style={{ margin: 0, fontSize: 22 }}>
                  Profil va Token Hisoboti
                </h1>
              </div>

              <div className="profil-layout">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 20,
                      padding: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', fontSize: 15 }}>
                        {userName || userEmail || 'Mirvo Foydalanuvchi'}
                      </strong>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Saqlangan darslar: {totalHistoryCount} ta
                      </span>
                    </div>
                    {!userEmail && (
                      <button
                        type="button"
                        className="soft-btn"
                        onClick={() => onRequestAuth()}
                      >
                        Kirish
                      </button>
                    )}
                  </div>

                  <div className="row-group">
                    <button
                      type="button"
                      className="row-item"
                      onClick={() => onOpenDrawer('history')}
                    >
                      <div>
                        <strong>Darslar tarixi</strong>
                        <span>Oldin ochilgan darslar</span>
                      </div>
                      <span style={{ color: 'var(--muted)' }}>›</span>
                    </button>
                    <button
                      type="button"
                      className="row-item"
                      onClick={() => onOpenDrawer('settings')}
                    >
                      <div>
                        <strong>Ovoz sozlamalari</strong>
                        <span>Tezlik va ovoz turi</span>
                      </div>
                      <span style={{ color: 'var(--muted)' }}>›</span>
                    </button>
                  </div>
                </div>

                {/* Per-Lesson Exact Token Breakdown */}
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 20,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>Har bir dars token sarfi</strong>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#059669',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatCostUsd(sessionTokenStats.cost_usd)} (
                      {formatCostUzsApprox(sessionTokenStats.cost_usd)})
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
                    Qwen 3.8 Omni Flash · Kirish $0.15/1M · Kesh $0.016/1M · Chiqish $0.47/1M
                  </div>

                  {lessonTokenLogs.length === 0 ? (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: 'var(--surface-2)',
                        fontSize: 12,
                        color: 'var(--muted)',
                      }}
                    >
                      Yangi mavzu kiritib Boshlash bosilganda, har bir darsning aniq kirish, kesh va
                      chiqish tokenlari shu yerda qayd etiladi.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        maxHeight: 280,
                        overflowY: 'auto',
                      }}
                    >
                      {lessonTokenLogs.map((entry) => (
                        <div
                          key={entry.id}
                          style={{
                            padding: '9px 11px',
                            borderRadius: 12,
                            background: 'var(--surface-2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 8,
                              fontSize: 12.5,
                              fontWeight: 700,
                            }}
                          >
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {entry.topic}
                            </span>
                            <span style={{ color: '#059669', flexShrink: 0 }}>
                              {formatTokenCount(entry.total_tokens)} tok ·{' '}
                              {formatCostUsd(entry.cost_usd)}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--muted)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {entry.model} · Kirish: {formatTokenCount(entry.prompt_tokens)} (Kesh:{' '}
                            {formatTokenCount(entry.cached_tokens)}) · Chiqish:{' '}
                            {formatTokenCount(entry.output_tokens)} ·{' '}
                            {formatCostUzsApprox(entry.cost_usd)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Mobile Bottom Dock */}
      <div className="dock-box">
        <nav className="dock" aria-label="Mobil navigatsiya">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`dock-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};
