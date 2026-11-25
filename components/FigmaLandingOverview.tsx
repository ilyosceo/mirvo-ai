import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Minus, Plus, SlidersHorizontal, X } from 'lucide-react';
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

type NativeTab = 'doska' | 'darslar' | 'reels' | 'profil';
type LabModel = 'transformer' | 'turbine' | 'hydraulic';
type ThemeMode = 'light' | 'dark';
type VoiceMood = 'Jonli' | 'Sokin' | 'Hayrat';
type SubjectFilter = 'Barchasi' | 'Fizika' | 'Matematika' | 'Kimyo' | 'Biologiya';
type PayMethod = 'click' | 'payme' | 'uzum' | 'card';

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
      'Birlamchi chulg‘amdagi o‘zgaruvchan tok po‘lat o‘zakda magnit oqimi (Φ) hosil qiladi va ikkilamchi chulg‘amda mutanosib kuchlanish uyg‘otadi.',
  },
];

const PAYMENT_OPTIONS: readonly {
  id: PayMethod;
  tag: string;
  color: string;
  label: string;
}[] = [
  { id: 'click', tag: 'Click', color: '#0077FF', label: 'Click orqali to‘lash' },
  { id: 'payme', tag: 'Payme', color: '#00B8B8', label: 'Payme hamyon' },
  { id: 'uzum', tag: 'Uzum', color: '#7000FF', label: 'Uzum Bank' },
  { id: 'card', tag: 'Karta', color: '#334155', label: 'UzCard / Humo / Visa' },
];

const SUBJECT_FILTERS: readonly SubjectFilter[] = [
  'Barchasi',
  'Fizika',
  'Matematika',
  'Kimyo',
  'Biologiya',
];

function formatSpaceNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export const FigmaLandingOverview: React.FC<FigmaLandingOverviewProps> = ({
  userEmail,
  userName,
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
  onOpenDrawer,
  onRequestAuth,
  onEnterWorkspace,
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
  const [sl2, setSl2] = useState<number>(4);

  const [xp, setXp] = useState<number>(12450);
  const [playing, setPlaying] = useState<boolean>(false);
  const [mood, setMood] = useState<VoiceMood>('Jonli');
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>('Barchasi');
  const [reelIdx, setReelIdx] = useState<number>(0);

  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const [selectedPay, setSelectedPay] = useState<PayMethod>('click');
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const toastTimerRef = useRef<number | null>(null);

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
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
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

  const clampStepCount = (n: number) => Math.max(4, Math.min(12, Math.round(n)));

  const pickModel = (nextModel: LabModel) => {
    setModel(nextModel);
    if (nextModel === 'transformer') {
      setSl1(220);
      setSl2(4);
    } else if (nextModel === 'turbine') {
      setSl1(10);
      setSl2(40);
    } else {
      setSl1(40);
      setSl2(6);
    }
  };

  const jumpModel = (nextModel: LabModel) => {
    setActiveTab('doska');
    pickModel(nextModel);
    showToast('2.5D model yuklandi');
  };

  const openFullLabLesson = (targetModel: LabModel = model) => {
    if (targetModel === 'transformer') onSelectStarterCard('physics-transformer');
    else if (targetModel === 'turbine') onSelectStarterCard('wind-turbine-energy');
    else onSelectStarterCard('hydraulic-press-pascal');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = queryText.trim().toLowerCase();
    if (v.includes('shamol') || v.includes('turbin')) {
      pickModel('turbine');
    } else if (v.includes('gidrav') || v.includes('paskal') || v.includes('press')) {
      pickModel('hydraulic');
    } else if (v.includes('transformator') || v.includes('induksiya')) {
      pickModel('transformer');
    }

    if (queryText.trim() || imagePreview) {
      showToast('2.5D dars tayyorlandi');
      onSubmitPrompt(e);
    } else {
      pickModel(model);
      showToast('2.5D dars tayyorlandi');
    }
  };

  const speakMoodPreview = (nextPlaying: boolean, nextMood: VoiceMood) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      if (!nextPlaying) return;
      const sample =
        model === 'transformer'
          ? `Transformator kirish kuchlanishi ${sl1} volt, chiqish kuchlanishi ${Math.round(sl1 * sl2)} volt.`
          : model === 'turbine'
          ? `Shamol tezligi ${sl1} metr sekund, parrak diametri ${sl2} metr.`
          : `Paskal qonuni: kirish kuchi ${sl1} nyuton, chiqish kuchi ${Math.round(sl1 * sl2)} nyuton.`;
      const utter = new SpeechSynthesisUtterance(sample);
      utter.lang = 'uz-UZ';
      utter.rate = nextMood === 'Sokin' ? 0.9 : nextMood === 'Hayrat' ? 1.12 : 1.02;
      utter.pitch = nextMood === 'Hayrat' ? 1.15 : nextMood === 'Sokin' ? 0.94 : 1.0;
      utter.onend = () => setPlaying(false);
      utter.onerror = () => setPlaying(false);
      window.speechSynthesis.speak(utter);
    } catch {
      // ignore if speech synthesis unavailable
    }
  };

  const togglePlay = () => {
    const next = !playing;
    setPlaying(next);
    showToast(next ? 'Emotsional ustoz ovozi boshlandi' : 'Ovoz to‘xtatildi');
    speakMoodPreview(next, mood);
  };

  const handleSetMood = (nextMood: VoiceMood) => {
    setMood(nextMood);
    showToast(`Ohang: ${nextMood}`);
    if (playing) speakMoodPreview(true, nextMood);
  };

  const nextReel = () => {
    setReelIdx((prev) => (prev + 1) % REELS_DATA.length);
    setXp((prev) => prev + 50);
    showToast('+50 Mirvo Ball qo‘shildi');
  };

  const claimXp = (cost: number, label: string) => {
    if (xp < cost) {
      showToast('Ball yetarli emas');
      return;
    }
    setXp((prev) => prev - cost);
    showToast(`${label} olindi`);
  };

  const copyCode = (text: string, msg: string) => {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).catch(() => {});
    }
    showToast(msg);
  };

  // Compute exact 2.5D Lab parameters (100% preserved formulas & animations)
  const labConfig = (() => {
    if (model === 'transformer') {
      const u2 = Math.round(sl1 * sl2);
      const dur = Math.max(0.35, 2.0 - sl1 / 250).toFixed(2);
      const secCount = Math.min(8, Math.max(3, Math.round(sl2 + 2)));
      return {
        r1l: 'Kirish (U1)',
        r1v: `${sl1} V`,
        r2l: 'Chiqish (U2)',
        r2v: `${u2} V`,
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
        dur,
        secCount,
        f2: 0,
      };
    }
    if (model === 'turbine') {
      const kw = Math.round(
        (0.5 * 1.225 * Math.PI * (sl2 * 0.5) ** 2 * sl1 ** 3 * 0.45) / 1000
      );
      const dur = Math.max(0.38, 5.4 - sl1 * 0.24).toFixed(2);
      return {
        r1l: 'Shamol tezligi',
        r1v: `${sl1} m/s`,
        r2l: 'Quvvat (P)',
        r2v: `${kw} kW`,
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
        dur,
        secCount: 0,
        f2: 0,
      };
    }
    const f2 = Math.round(sl1 * sl2);
    return {
      r1l: 'Kirish (F1)',
      r1v: `${sl1} N`,
      r2l: 'Chiqish (F2)',
      r2v: `${f2} N`,
      s1l: 'Berilgan kuch (F1)',
      s1v: `${sl1} N`,
      s1Min: 10,
      s1Max: 100,
      s1Step: 5,
      s2l: 'Yuza nisbati (S2/S1)',
      s2v: `${sl2}x`,
      s2Min: 2,
      s2Max: 12,
      s2Step: 1,
      dur: '1.1',
      secCount: 0,
      f2,
    };
  })();

  const hydraulicP = Math.round((sl1 / 100) * 22);
  const hydraulicL = Math.round((sl1 / 100) * 14);
  const activeReel = REELS_DATA[reelIdx];

  const renderLabSvg = (targetModel: LabModel, compact = false) => {
    if (targetModel === 'transformer') {
      const count = compact ? 6 : labConfig.secCount;
      const dur = compact ? '1.1s' : `${labConfig.dur}s`;
      return (
        <svg viewBox="0 0 280 156" fill="none" aria-label="Transformator 2.5D modeli">
          <polygon
            points="58,22 222,22 232,32 232,138 68,138 58,128"
            fill="#1E293B"
            stroke="#475569"
            strokeWidth="1.5"
          />
          <rect
            x="58"
            y="22"
            width="164"
            height="106"
            rx="10"
            fill="#334155"
            stroke="#64748B"
            strokeWidth="1.5"
          />
          <rect x="92" y="46" width="96" height="58" rx="6" fill="#0B1220" />
          <rect
            x="74"
            y="34"
            width="132"
            height="82"
            rx="8"
            stroke="#38BDF8"
            strokeWidth="2.5"
            className="flux"
            style={{ animationDuration: dur }}
          />
          <rect x="48" y="42" width="32" height="9" rx="4.5" fill="#3B82F6" />
          <rect x="48" y="57" width="32" height="9" rx="4.5" fill="#3B82F6" />
          <rect x="48" y="72" width="32" height="9" rx="4.5" fill="#3B82F6" />
          <rect x="48" y="87" width="32" height="9" rx="4.5" fill="#3B82F6" />
          <rect x="48" y="102" width="32" height="9" rx="4.5" fill="#3B82F6" />
          {Array.from({ length: count }).map((_, i) => (
            <rect
              key={i}
              x="200"
              y={36 + i * 11}
              width="32"
              height="7"
              rx="3.5"
              fill="#F59E0B"
            />
          ))}
          <text x="140" y="79" textAnchor="middle" fill="#38BDF8" fontSize="11" fontWeight="700">
            Magnit oqimi Φ
          </text>
        </svg>
      );
    }

    if (targetModel === 'turbine') {
      const dur = compact ? '2.2s' : `${labConfig.dur}s`;
      return (
        <svg viewBox="0 0 280 156" fill="none" aria-label="Shamol turbinasi 2.5D modeli">
          <path
            d="M16 52 H92 M10 82 H84 M20 112 H94"
            stroke="#38BDF8"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="flux"
            style={{ animationDuration: dur }}
          />
          <polygon points="134,152 138,82 142,82 146,152" fill="#CBD5E1" />
          <g className="spin" style={{ animationDuration: dur }}>
            <path d="M140 82 L137 20 L145 76 Z" fill="#F8FAFC" />
            <path d="M140 82 L194 114 L144 88 Z" fill="#F8FAFC" />
            <path d="M140 82 L86 114 L136 88 Z" fill="#F8FAFC" />
          </g>
          <circle cx="140" cy="82" r="7" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2.5" />
        </svg>
      );
    }

    const p = compact ? 10 : hydraulicP;
    const l = compact ? 7 : hydraulicL;
    const f2Display = compact ? 240 : labConfig.f2;
    return (
      <svg viewBox="0 0 280 156" fill="none" aria-label="Gidravlik press 2.5D modeli">
        <path
          d={`M58 ${44 + p} V126 Q58 138 70 138 H210 Q222 138 222 126 V${60 - l} H174 V112 H92 V${44 + p} Z`}
          fill="#0EA5E9"
          fillOpacity="0.45"
          stroke="#38BDF8"
          strokeWidth="2.5"
        />
        <rect x="58" y={34 + p} width="34" height="12" rx="3" fill="#3B82F6" />
        <line x1="75" y1={12 + p} x2="75" y2={34 + p} stroke="#93C5FD" strokeWidth="4" />
        <rect x="174" y={50 - l} width="48" height="12" rx="3" fill="#F59E0B" />
        <rect x="182" y={28 - l} width="32" height="22" rx="4" fill="#FDE68A" />
        <text x="198" y={43 - l} textAnchor="middle" fill="#78350F" fontSize="11" fontWeight="800">
          {f2Display}N
        </text>
      </svg>
    );
  };

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

  return (
    <div className="mirvo-native flex-1 min-h-0 flex flex-col relative overflow-hidden">
      {/* Native Toast Notification */}
      <div className={`toast ${toastVisible ? 'show' : ''}`} role="status" aria-live="polite">
        {toastMsg}
      </div>

      {/* ==================== DESKTOP STICKY FROSTED TOP NAV (>= 1024px) ==================== */}
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
                OLED Qorong‘i
              </button>
            </div>

            <button type="button" className="pill-stat" onClick={() => setActiveTab('profil')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#D97706" aria-hidden="true">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>{formatSpaceNumber(xp)}</span>
            </button>

            <button type="button" className="pill-stat" onClick={() => setSheetOpen(true)}>
              Pro
            </button>

            <PWAInstallButton compact />

            <button
              type="button"
              className="pill-stat"
              onClick={() => onOpenDrawer('settings')}
              aria-label="Sozlamalar"
              title="Sozlamalar va kutubxona"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ==================== MAIN SCROLLABLE VIEWPORT ==================== */}
      <div className="scroll-area">
        <div className="stage-shell">
          {/* ==================== TAB 1: DOSKA ==================== */}
          {activeTab === 'doska' && (
            <section className="tab-view" id="tab-doska">
              {/* Mobile Top Row (100% preserved) */}
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
                      OLED
                    </button>
                  </div>
                  <button type="button" className="pill-stat" onClick={() => setActiveTab('profil')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#D97706" aria-hidden="true">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span>{formatSpaceNumber(xp)}</span>
                  </button>
                  <button type="button" className="pill-stat" onClick={() => setSheetOpen(true)}>
                    Pro
                  </button>
                </div>
              </div>

              <div className="doska-desktop-grid">
                {/* LEFT COLUMN: Hero Copy + Prompt Card + Emotional Voice Strip */}
                <div>
                  <h1 className="h1">Murakkab mavzularni jonli ko‘ring</h1>
                  <p className="lead">
                    2.5D interaktiv modellar va emotsional o‘zbekcha ustoz ovozi bilan o‘rganing.
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
                            alt="Yuklangan masala rasmi"
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
                        <button
                          type="button"
                          className="soft-btn"
                          onClick={() => {
                            showToast('Rasm yuklash ochildi');
                            onOpenFilePicker();
                          }}
                        >
                          Rasm
                        </button>
                        <button
                          type="button"
                          className="soft-btn"
                          onClick={() => {
                            showToast('Videodan dars rejimi');
                            onOpenVideoModal();
                          }}
                        >
                          Video
                        </button>
                        <button
                          type="button"
                          className={`soft-btn ${isListening ? 'listening' : ''}`}
                          onClick={onToggleMic}
                          aria-label="Ovozli kiritish"
                          title="Ovozli savol"
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
                            disabled={lessonStepCount >= 12}
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

                  {/* Emotional Voice Strip (100% preserved + Live Eye-Tracking Emoji Ustoz) */}
                  <div className={`voice-strip ${playing ? 'playing' : ''}`} id="vStrip">
                    <button
                      type="button"
                      className="play-fab"
                      onClick={togglePlay}
                      aria-label="Ovozni ijro etish"
                    >
                      {playing ? (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </svg>
                      ) : (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="6 4 20 12 6 20 6 4" />
                        </svg>
                      )}
                    </button>

                    <div className="v-body">
                      <div className="v-head">
                        <span>Emotsional ustoz ovozi</span>
                        <div className="eq" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                      <div className="moods">
                        {(['Jonli', 'Sokin', 'Hayrat'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={`m-chip ${mood === m ? 'active' : ''}`}
                            onClick={() => handleSetMood(m)}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }} title="Ko‘zlar sichqonchani kuzatadi">
                      <MirvoMentor
                        size={48}
                        isSpeaking={playing || isListening}
                        isListening={isListening}
                        voiceActivity={playing ? 0.72 : 0.08}
                        interactive
                      />
                    </div>
                  </div>

                  {/* Quick Desktop Workspace Shortcuts */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginTop: 12,
                    }}
                  >
                    <button
                      type="button"
                      className="soft-btn"
                      onClick={() =>
                        onSelectQuickTopic(
                          'Gidroakkumulyator elektr stansiyasi (GAES)',
                          'GAES stansiya'
                        )
                      }
                    >
                      GAES stansiya
                    </button>
                    <button type="button" className="soft-btn" onClick={onEnterWorkspace}>
                      Oxirgi doska
                    </button>
                    <button
                      type="button"
                      className="soft-btn"
                      onClick={() => onOpenDrawer('library')}
                    >
                      Kutubxona (18+)
                    </button>
                  </div>
                </div>

                {/* RIGHT COLUMN (on Desktop) / CENTERPIECE (on Mobile): Live 2.5D Lab */}
                <div className="lab">
                  <div className="lab-switcher">
                    <button
                      type="button"
                      className={`lab-btn ${model === 'transformer' ? 'active' : ''}`}
                      onClick={() => pickModel('transformer')}
                    >
                      Transformator
                    </button>
                    <button
                      type="button"
                      className={`lab-btn ${model === 'turbine' ? 'active' : ''}`}
                      onClick={() => pickModel('turbine')}
                    >
                      Turbina
                    </button>
                    <button
                      type="button"
                      className={`lab-btn ${model === 'hydraulic' ? 'active' : ''}`}
                      onClick={() => pickModel('hydraulic')}
                    >
                      Gidravlika
                    </button>
                  </div>

                  <div className="svg-box" id="svgBox">
                    {renderLabSvg(model)}
                  </div>

                  <div className="readout-pair">
                    <div className="r-cell">
                      <span>{labConfig.r1l}</span>
                      <strong className="cyan">{labConfig.r1v}</strong>
                    </div>
                    <div className="r-cell">
                      <span>{labConfig.r2l}</span>
                      <strong className="amber">{labConfig.r2v}</strong>
                    </div>
                  </div>

                  <div className="sliders">
                    <div className="sl">
                      <label htmlFor="sl1">
                        <span>{labConfig.s1l}</span>
                        <strong>{labConfig.s1v}</strong>
                      </label>
                      <input
                        id="sl1"
                        type="range"
                        min={labConfig.s1Min}
                        max={labConfig.s1Max}
                        step={labConfig.s1Step}
                        value={sl1}
                        onChange={(e) => setSl1(parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="sl">
                      <label htmlFor="sl2">
                        <span>{labConfig.s2l}</span>
                        <strong>{labConfig.s2v}</strong>
                      </label>
                      <input
                        id="sl2"
                        type="range"
                        min={labConfig.s2Min}
                        max={labConfig.s2Max}
                        step={labConfig.s2Step}
                        value={sl2}
                        onChange={(e) => setSl2(parseFloat(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="lab-open-row">
                    <span style={{ fontSize: 11.5, color: '#94A3B8' }}>
                      To‘liq bosqichma-bosqich AI doska va ovozli tahlil
                    </span>
                    <button
                      type="button"
                      className="lab-open-btn"
                      onClick={() => openFullLabLesson(model)}
                    >
                      Doskada ochish ↗
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ==================== TAB 2: DARSLAR (BENTO) ==================== */}
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
                    onClick={() => jumpModel('transformer')}
                  >
                    <div>
                      <div className="b-kicker">Energetika</div>
                      <div className="b-title">Transformator va elektromagnit induksiya</div>
                      <div className="b-sub">12 ta interaktiv 2.5D dars</div>
                    </div>
                  </button>
                )}

                {showCard(['Fizika']) && (
                  <button type="button" className="b-card" onClick={() => jumpModel('turbine')}>
                    <div className="b-kicker">ShES</div>
                    <div>
                      <div className="b-title">Shamol turbinasi (Bets)</div>
                      <div className="b-sub">10 ta dars</div>
                    </div>
                  </button>
                )}

                {showCard(['Fizika']) && (
                  <button type="button" className="b-card" onClick={() => jumpModel('hydraulic')}>
                    <div className="b-kicker">Gidravlika</div>
                    <div>
                      <div className="b-title">Gidravlik press (Paskal)</div>
                      <div className="b-sub">8 ta dars</div>
                    </div>
                  </button>
                )}

                {showCard(['Kimyo', 'Biologiya']) && (
                  <button
                    type="button"
                    className="b-card wide"
                    onClick={() => {
                      showToast('Kimyo 2D molekula moduli ochildi');
                      onSelectStarterCard('caffeine-pubchem-3d');
                    }}
                  >
                    <div className="b-kicker">Kimyo va Biologiya</div>
                    <div>
                      <div className="b-title">Organik molekulalar va DNK tuzilishi</div>
                      <div className="b-sub">14 ta 2D vizual tahlil</div>
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
                      <div className="b-sub">P = ρ·g·Q·H·η · 2D sxema</div>
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
                      <div className="b-sub">Mafs interaktiv koordinata</div>
                    </div>
                  </button>
                )}

                {showCard(['Biologiya']) && (
                  <button
                    type="button"
                    className="b-card wide"
                    onClick={() => onSelectStarterCard('photosynthesis-visual')}
                  >
                    <div className="b-kicker">Biologiya</div>
                    <div>
                      <div className="b-title">Fotosintez va hujayra tuzilishi</div>
                      <div className="b-sub">Xloroplast va ATP sintezi 2D tahlili</div>
                    </div>
                  </button>
                )}
              </div>
            </section>
          )}

          {/* ==================== TAB 3: REELS (30s VERTICAL LESSONS) ==================== */}
          {activeTab === 'reels' && (
            <section className="tab-view" id="tab-reels">
              <div className="top-row">
                <h1 className="h1" style={{ margin: 0, fontSize: 22 }}>
                  Qisqa darslar
                </h1>
                <span className="pill-stat">3 / 5 bugun</span>
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
                    <div style={{ width: '100%', maxWidth: 270, height: 185 }}>
                      {renderLabSvg(activeReel.model, true)}
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
                    <div className="reel-reward">
                      To‘liq ko‘rilsa: +50 Mirvo Ball va +2 AI Quvvat
                    </div>
                    <button type="button" className="btn-go full" onClick={nextReel}>
                      Keyingi qisqa dars
                    </button>
                  </div>
                </div>

                {/* Desktop Theater Side Panel */}
                <aside className="reels-aside">
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 22,
                      padding: 20,
                    }}
                  >
                    <div className="b-kicker">Qisqa dars tafsiloti</div>
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
                      To‘liq AI doskada ko‘rish ↗
                    </button>
                  </div>

                  <div className="row-group">
                    {REELS_DATA.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        className="row-item"
                        onClick={() => setReelIdx(idx)}
                      >
                        <div>
                          <strong>
                            {idx + 1}. {item.t}
                          </strong>
                          <span>{item.f}</span>
                        </div>
                        <span
                          style={{
                            color: idx === reelIdx ? 'var(--accent)' : 'var(--muted)',
                            fontWeight: 700,
                          }}
                        >
                          {idx === reelIdx ? 'Faol' : 'Ko‘rish'}
                        </span>
                      </button>
                    ))}
                  </div>
                </aside>
              </div>
            </section>
          )}

          {/* ==================== TAB 4: PROFIL & REWARDS ==================== */}
          {activeTab === 'profil' && (
            <section className="tab-view" id="tab-profil">
              <div className="top-row">
                <h1 className="h1" style={{ margin: 0, fontSize: 22 }}>
                  Profil
                </h1>
                <button
                  type="button"
                  className="pill-stat"
                  onClick={() => copyCode('MIRVO2026', 'Taklif kodi nusxalandi: MIRVO2026')}
                >
                  MIRVO2026
                </button>
              </div>

              <div className="profil-layout">
                <div>
                  <button
                    type="button"
                    className="pro-banner"
                    onClick={() => setSheetOpen(true)}
                  >
                    <div>
                      <strong>Mirvo Pro ga o‘ting</strong>
                      <span>Cheksiz 2.5D dars va emotsional ovoz</span>
                    </div>
                    <span className="pro-price-pill">44 100 so‘m</span>
                  </button>

                  <div className="mini-stats">
                    <div className="ms-cell">
                      <strong>{Math.max(24, totalHistoryCount)}</strong>
                      <span>Darslar</span>
                    </div>
                    <div className="ms-cell">
                      <strong>7 kun</strong>
                      <span>Seriya</span>
                    </div>
                    <div className="ms-cell">
                      <strong>4</strong>
                      <span>Do‘stlar</span>
                    </div>
                  </div>

                  <div className="row-group">
                    <button
                      type="button"
                      className="row-item"
                      onClick={() => claimXp(3000, '10% Pro chegirma kuponi')}
                    >
                      <div>
                        <strong>10% Pro chegirma olish</strong>
                        <span>3 000 Mirvo Ball evaziga</span>
                      </div>
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Olish</span>
                    </button>

                    <button
                      type="button"
                      className="row-item"
                      onClick={() => {
                        showToast('O‘qilgan 24 ta dars tarixi');
                        onOpenDrawer('history');
                      }}
                    >
                      <div>
                        <strong>O‘qilgan darslar tarixi</strong>
                        <span>Transformator, Bets qonuni va b.</span>
                      </div>
                      <span style={{ color: 'var(--muted)' }}>›</span>
                    </button>

                    <button
                      type="button"
                      className="row-item"
                      onClick={() =>
                        copyCode(
                          window.location.origin,
                          'Taklif havolasi nusxalandi (+500 Ball)'
                        )
                      }
                    >
                      <div>
                        <strong>Do‘st taklif qilish</strong>
                        <span>Har bir do‘st uchun +500 Ball</span>
                      </div>
                      <span style={{ color: 'var(--muted)' }}>›</span>
                    </button>
                  </div>
                </div>

                {/* Right Card (Account, XP Balance, Theme & Voice Settings) */}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <MirvoMentor size={52} isSpeaking={false} interactive />
                      <div>
                        <strong style={{ display: 'block', fontSize: 15 }}>
                          {userName || userEmail || 'Mirvo O‘quvchi'}
                        </strong>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          Balans: {formatSpaceNumber(xp)} Mirvo Ball
                        </span>
                      </div>
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
                      onClick={() => onOpenDrawer('settings')}
                    >
                      <div>
                        <strong>Ustoz ovozi va tezligi</strong>
                        <span>O‘zbekcha TTS sozlamalari</span>
                      </div>
                      <span style={{ color: 'var(--muted)' }}>›</span>
                    </button>
                    <button
                      type="button"
                      className="row-item"
                      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    >
                      <div>
                        <strong>Mavzu ko‘rinishi</strong>
                        <span>
                          Hozirgi rejim: {theme === 'dark' ? 'OLED Qorong‘i' : 'Yorug‘'}
                        </span>
                      </div>
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                        Almashtirish
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ==================== FLOATING FROSTED BOTTOM DOCK (MOBILE) ==================== */}
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

      {/* ==================== BOTTOM SHEET / MODAL: PRO CHECKOUT ==================== */}
      {sheetOpen && (
        <div
          className="sheet-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Mirvo Pro obunasi"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheetOpen(false);
          }}
        >
          <div className="sheet">
            <div className="handle" />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 18,
                    fontWeight: 800,
                  }}
                >
                  Mirvo Pro (1 oy)
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                  10% kupon qo‘llandi — 44 100 so‘m
                </div>
              </div>
              <button
                type="button"
                className="soft-btn"
                onClick={() => setSheetOpen(false)}
              >
                Yopish
              </button>
            </div>

            {PAYMENT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`pay-row ${selectedPay === opt.id ? 'active' : ''}`}
                onClick={() => setSelectedPay(opt.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="pay-tag" style={{ background: opt.color }}>
                    {opt.tag}
                  </span>
                  <strong>{opt.label}</strong>
                </div>
                <span>{selectedPay === opt.id ? '✓' : ''}</span>
              </button>
            ))}

            <button
              type="button"
              className="btn-go full"
              style={{ marginTop: 8 }}
              onClick={() => {
                setSheetOpen(false);
                showToast('Mirvo Pro muvaffaqiyatli faollashtirildi');
              }}
            >
              44 100 so‘m to‘lash
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
