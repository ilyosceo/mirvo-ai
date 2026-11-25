import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Layers,
  Loader2,
  Mic,
  MicOff,
  Minus,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { PbrMachine3DStage } from './engines/PbrMachine3DStage';
import { FloatingEmojiUstoz } from './FloatingEmojiUstoz';
import { type UstozExpression } from './MirvoMentor';
import { PWAInstallButton } from './PWAInstallButton';
import { voiceEngine } from '../lib/voiceEngine';
import {
  formatCostUsd,
  formatCostUzsApprox,
  formatTokenCount,
  loadLessonTokenLogs,
  type SessionTokenStats,
} from '../lib/tokenUsage';

export type LabModel = 'transformer' | 'turbine' | 'hydraulic' | 'gaes';

const LAB_STEPS_BY_MODEL: Record<
  LabModel,
  readonly {
    index: number;
    partId: string;
    shortLabel: string;
    title: string;
    explanation: string;
    anchorPct: { x: number; y: number };
  }[]
> = {
  transformer: [
    {
      index: 0,
      partId: 'primary_coil',
      shortLabel: '1. N₁ chulg‘am',
      title: '1-qadam: Birlamchi 3D chulg‘am (N₁)',
      explanation: 'Kirish o‘zgaruvchan kuchlanishi U₁ mis chulg‘amda magnit yurituvchi kuch hosil qiladi.',
      anchorPct: { x: 28, y: 52 },
    },
    {
      index: 1,
      partId: 'core',
      shortLabel: '2. O‘zak (Φ)',
      title: '2-qadam: Po‘lat o‘zak va magnit oqimi (Φ)',
      explanation: 'Qatlamli ferromagnit o‘zak o‘zgaruvchan magnit oqimini deyarli yo‘qotishsiz ikkinchi chulg‘amga uzatadi.',
      anchorPct: { x: 46, y: 34 },
    },
    {
      index: 2,
      partId: 'secondary_coil',
      shortLabel: '3. N₂ chulg‘am',
      title: '3-qadam: Ikkilamchi oltin-mis chulg‘am (N₂)',
      explanation: 'Faradey induksiya qonuniga binoan o‘ramlar nisbati N₂/N₁ ga mos chiqish kuchlanishi U₂ hosil bo‘ladi.',
      anchorPct: { x: 62, y: 52 },
    },
    {
      index: 3,
      partId: 'voltmeter',
      shortLabel: '4. Voltmetr',
      title: '4-qadam: 3D Analog Voltmetr ko‘rsatkichi',
      explanation: 'Strelka real vaqtda chiqish kuchlanishi U₂ qiymatini burchak bo‘yicha aniq ko‘rsatadi.',
      anchorPct: { x: 82, y: 56 },
    },
  ],
  turbine: [
    {
      index: 0,
      partId: 'wind_flow',
      shortLabel: '1. Shamol',
      title: '1-qadam: Kinetik shamol oqimi',
      explanation: 'Havo oqimi tezligi v oshganda kinetik energiya tezlikning kubiga (v³) proporsional ortadi.',
      anchorPct: { x: 26, y: 42 },
    },
    {
      index: 1,
      partId: 'blades',
      shortLabel: '2. Parraklar',
      title: '2-qadam: Aerodinamik 3D parraklar',
      explanation: 'Uchta qanot ko‘tarish kuchi hisobiga shamol energiyasini aylanma mexanik momentga aylantiradi.',
      anchorPct: { x: 52, y: 36 },
    },
    {
      index: 2,
      partId: 'gearbox',
      shortLabel: '3. Reduktor',
      title: '3-qadam: Tishli ko‘paytiruvchi reduktor',
      explanation: 'Gondola kesimida ko‘rinib turgan 3D tishli g‘ildiraklar sekin aylanishni yuqori tezlikka ko‘paytiradi.',
      anchorPct: { x: 50, y: 40 },
    },
    {
      index: 3,
      partId: 'generator',
      shortLabel: '4. Generator',
      title: '4-qadam: Mis chulg‘amli sinxron generator',
      explanation: 'Generator mexanik aylanishni tarmoq uchun toza elektr quvvatiga (kW) aylantiradi.',
      anchorPct: { x: 48, y: 44 },
    },
  ],
  hydraulic: [
    {
      index: 0,
      partId: 'small_piston',
      shortLabel: '1. Kichik A₁',
      title: '1-qadam: Kichik kirish porsheni (F₁)',
      explanation: 'Kichik yuzali porshenga berilgan F₁ kuch suyuqlikda P = F₁ / S₁ bosim uyg‘otadi.',
      anchorPct: { x: 28, y: 48 },
    },
    {
      index: 1,
      partId: 'fluid',
      shortLabel: '2. Suyuqlik',
      title: '2-qadam: Paskal bosim kanali',
      explanation: 'Siqilmas moy bosimni yopiq U-kanal orqali barcha nuqtalarga bir xil uzatadi (P₁ = P₂).',
      anchorPct: { x: 48, y: 74 },
    },
    {
      index: 2,
      partId: 'large_piston',
      shortLabel: '3. Katta A₂',
      title: '3-qadam: Katta chiqish silindri (F₂)',
      explanation: 'Yuza necha marta katta bo‘lsa, porshendagi ko‘tarish kuchi ham shuncha marta ortadi.',
      anchorPct: { x: 68, y: 54 },
    },
    {
      index: 3,
      partId: 'load',
      shortLabel: '4. Yuk bloki',
      title: '4-qadam: Ko‘tarilayotgan oltin yuk',
      explanation: 'Kichik kirish kuchi yordamida bir necha barobar og‘ir 3D yuk silliq ko‘tariladi.',
      anchorPct: { x: 68, y: 36 },
    },
  ],
  gaes: [
    {
      index: 0,
      partId: 'upper_reservoir',
      shortLabel: '1. Yuqori havza',
      title: '1-qadam: Yuqori suv havzasi (Potensial energiya)',
      explanation: 'H balandlikda to‘plangan suv E = m·g·H potensial energiya zaxirasini saqlaydi.',
      anchorPct: { x: 26, y: 30 },
    },
    {
      index: 1,
      partId: 'penstock',
      shortLabel: '2. Quvur',
      title: '2-qadam: Bosimli suv quvuri (Penstock)',
      explanation: 'Generatsiyada suv pastga otiladi, Nasos rejimida esa teskari yuqoriga haydaladi.',
      anchorPct: { x: 44, y: 48 },
    },
    {
      index: 2,
      partId: 'runner',
      shortLabel: '3. Turbina',
      title: '3-qadam: Qaytarma Frensis nasos-turbinasi',
      explanation: 'Kesim ichidagi 8 parrakli 3D ishchi g‘ildirak suv bosimini aylanma harakatga aylantiradi.',
      anchorPct: { x: 58, y: 64 },
    },
    {
      index: 3,
      partId: 'generator',
      shortLabel: '4. Generator',
      title: '4-qadam: Sinxron generator-motor va transformator',
      explanation: 'Tig‘iz soatlarda elektr ishlab chiqaradi, tunda esa motor bo‘lib suvni yuqoriga qaytaradi.',
      anchorPct: { x: 58, y: 40 },
    },
  ],
};

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
type VoiceMood = 'Jonli' | 'Sokin' | 'Hayrat';
type SubjectFilter = 'Barchasi' | 'Fizika' | 'Matematika' | 'Kimyo' | 'Biologiya';
type PayMethod = 'click' | 'payme' | 'uzum' | 'card';

interface MissionSpec {
  id: string;
  title: string;
  rewardXp: number;
  check: (outputVal: number) => boolean;
  hint: (outputVal: number) => string;
}

const MODEL_MISSIONS: Record<LabModel, readonly MissionSpec[]> = {
  transformer: [
    {
      id: 'tr-660',
      title: 'Chiqish kuchlanishini 660 V ga keltiring',
      rewardXp: 150,
      check: (u2) => u2 === 660,
      hint: (u2) =>
        u2 > 660
          ? `Hozir ${u2} V — biroz pasaytiring (masalan, 220 V × 3.0x)`
          : `Hozir ${u2} V — biroz oshiring (masalan, 220 V × 3.0x)`,
    },
    {
      id: 'tr-1100',
      title: 'Chiqish kuchlanishini 1 100 V ga keltiring',
      rewardXp: 200,
      check: (u2) => u2 === 1100,
      hint: (u2) =>
        u2 > 1100
          ? `Hozir ${u2} V — biroz pasaytiring (masalan, 220 V × 5.0x)`
          : `Hozir ${u2} V — biroz oshiring (masalan, 220 V × 5.0x)`,
    },
  ],
  turbine: [
    {
      id: 'tb-500',
      title: 'Shamol quvvatini 500–850 kW oralig‘iga olib chiqing',
      rewardXp: 150,
      check: (kw) => kw >= 500 && kw <= 850,
      hint: (kw) =>
        kw < 500
          ? `Hozir ${kw} kW — shamol tezligi yoki diametrni oshiring`
          : `Hozir ${kw} kW — biroz pasaytiring (500–850 kW kerak)`,
    },
    {
      id: 'tb-1200',
      title: 'Kamida 1 200 kW quvvat ishlab chiqaring',
      rewardXp: 200,
      check: (kw) => kw >= 1200,
      hint: (kw) => `Hozir ${kw} kW — tezlikni oshiring (v³ quvvatni keskin oshiradi!)`,
    },
  ],
  hydraulic: [
    {
      id: 'hy-480',
      title: 'Chiqish kuchini aniq 480 N ga keltiring',
      rewardXp: 150,
      check: (f2) => f2 === 480,
      hint: (f2) =>
        f2 > 480
          ? `Hozir ${f2} N — biroz kamaytiring (masalan, 40 N × 12x yoki 60 N × 8x)`
          : `Hozir ${f2} N — biroz oshiring (masalan, 40 N × 12x yoki 60 N × 8x)`,
    },
    {
      id: 'hy-720',
      title: 'Chiqish kuchini aniq 720 N ga keltiring',
      rewardXp: 200,
      check: (f2) => f2 === 720,
      hint: (f2) =>
        f2 > 720
          ? `Hozir ${f2} N — biroz kamaytiring (masalan, 60 N × 12x)`
          : `Hozir ${f2} N — biroz oshiring (masalan, 60 N × 12x)`,
    },
  ],
  gaes: [
    {
      id: 'gaes-110',
      title: 'Generatsiya quvvatini 95–125 MVt oralig‘iga keltiring',
      rewardXp: 150,
      check: (mw) => mw >= 95 && mw <= 125,
      hint: (mw) =>
        mw < 0
          ? 'Hozir Nasos rejimida — yuklamani musbat (+) tomonga suring'
          : `Hozir ${mw} MVt — bosim (H) yoki yuklamani moslang`,
    },
    {
      id: 'gaes-pump',
      title: 'Tungi Nasos rejimini yoqing (-50 MVt yoki pastroq)',
      rewardXp: 200,
      check: (mw) => mw <= -50,
      hint: (mw) => `Hozir ${mw} MVt — 2-slayderni chapga (manfiy Nasos rejimiga) suring!`,
    },
  ],
};

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

function playSuccessChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + idx * 0.08;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.11, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch {
    // Ignore autoplay-blocked audio
  }
}

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

  // 2.5D Exploded View + 4-Step Guided Explanation State
  const [exploded, setExploded] = useState<boolean>(false);
  const [activeLabStep, setActiveLabStep] = useState<number>(0);
  const [stepFocusActive, setStepFocusActive] = useState<boolean>(false);

  // Interactive Mini-Missions & Persisted XP
  const [xp, setXp] = useState<number>(() => {
    try {
      const saved = Number(window.localStorage.getItem('mirvo_xp_v1') || '12450');
      return Number.isFinite(saved) && saved >= 0 ? saved : 12450;
    } catch {
      return 12450;
    }
  });
  const [completedMissions, setCompletedMissions] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem('mirvo_missions_v1');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [missionIdxByModel, setMissionIdxByModel] = useState<Record<LabModel, number>>({
    transformer: 0,
    turbine: 0,
    hydraulic: 0,
    gaes: 0,
  });
  const lessonTokenLogs = useMemo(
    () => loadLessonTokenLogs(),
    // Re-read whenever sessionTokenStats updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionTokenStats.total_tokens, sessionTokenStats.ai_requests]
  );
  const [xpFlash, setXpFlash] = useState<string | null>(null);

  // Real Emotional TTS + Free-Flying Emoji Ustoz State
  const [playing, setPlaying] = useState<boolean>(false);
  const [voiceActivity, setVoiceActivity] = useState<number>(0);
  const [mood, setMood] = useState<VoiceMood>('Jonli');
  const [ustozExpr, setUstozExpr] = useState<UstozExpression>('happy');
  const [ustozBubble, setUstozBubble] = useState<string>(
    'Meni sudrang yoki istalgan qismni bosing — ko‘rsatib tushuntiraman!'
  );
  const [flightTarget, setFlightTarget] = useState<{
    x: number;
    y: number;
    side?: 'left' | 'right';
  } | null>(null);
  const [clickToFly, setClickToFly] = useState<boolean>(true);

  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>('Barchasi');
  const [reelIdx, setReelIdx] = useState<number>(0);
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const [selectedPay, setSelectedPay] = useState<PayMethod>('click');
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);

  const toastTimerRef = useRef<number | null>(null);
  const labStageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem('mirvo_theme_v1', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem('mirvo_xp_v1', String(xp));
    } catch {
      // ignore
    }
  }, [xp]);

  useEffect(() => {
    try {
      window.localStorage.setItem('mirvo_missions_v1', JSON.stringify(completedMissions));
    } catch {
      // ignore
    }
  }, [completedMissions]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      voiceEngine.stop();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
    }, 2400);
  };

  const clampStepCount = (n: number) => Math.max(4, Math.min(12, Math.round(n)));

  // Compute exact 2.5D Lab physics & live dynamic formula
  const labConfig = useMemo(() => {
    if (model === 'transformer') {
      const u2 = Math.round(sl1 * sl2);
      return {
        outputVal: u2,
        formulaSymbol: 'U₂ = U₁ · (N₂ / N₁)',
        formulaLive: `${sl1} · ${sl2.toFixed(1)} = ${u2} V`,
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
      };
    }
    if (model === 'turbine') {
      const kw = Math.round(
        (0.5 * 1.225 * Math.PI * (sl2 * 0.5) ** 2 * sl1 ** 3 * 0.45) / 1000
      );
      return {
        outputVal: kw,
        formulaSymbol: 'P = ½ · ρ · A · v³ · Cₚ',
        formulaLive: `${sl1} m/s, Ø${sl2}m = ${kw} kW`,
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
      };
    }
    if (model === 'gaes') {
      const sign = sl2 < -5 ? -1 : sl2 > 5 ? 1 : 0;
      const mwMag = Math.round((9.81 * sl1 * (Math.abs(sl2) * 0.9) * 0.9) / 1000);
      const signedMw = sign * mwMag;
      return {
        outputVal: signedMw,
        formulaSymbol: 'P = ρ · g · Q · H · η',
        formulaLive:
          sign < 0
            ? `Nasos: ${mwMag} MVt sarf (H=${sl1}m)`
            : sign === 0
              ? 'Kutish rejimi (0 MVt)'
              : `Generatsiya: +${mwMag} MVt`,
        r1l: 'Bosim (H)',
        r1v: `${sl1} m`,
        r2l: sign < 0 ? 'Nasos quvvati' : 'Generatsiya',
        r2v: `${signedMw > 0 ? '+' : ''}${signedMw} MVt`,
        s1l: 'Bosim balandligi (H)',
        s1v: `${sl1} m`,
        s1Min: 40,
        s1Max: 220,
        s1Step: 10,
        s2l: 'Rejim (-Nasos / +Generatsiya)',
        s2v: `${sl2 > 0 ? '+' : ''}${sl2}%`,
        s2Min: -100,
        s2Max: 100,
        s2Step: 10,
      };
    }
    const f2 = Math.round(sl1 * sl2);
    return {
      outputVal: f2,
      formulaSymbol: 'F₂ = F₁ · (S₂ / S₁)',
      formulaLive: `${sl1} · ${sl2} = ${f2} N`,
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
    };
  }, [model, sl1, sl2]);

  const currentSteps = LAB_STEPS_BY_MODEL[model];
  const activeStepMeta = currentSteps[activeLabStep] || currentSteps[0];

  const modelMissionList = MODEL_MISSIONS[model];
  const currentMissionIdx = missionIdxByModel[model] % modelMissionList.length;
  const activeMission = modelMissionList[currentMissionIdx];
  const isMissionSolvedNow = activeMission.check(labConfig.outputVal);
  const isMissionAlreadyClaimed = completedMissions.includes(activeMission.id);

  // Fly Emoji Ustoz smoothly to point at the active 2.5D part inside the lab
  const flyUstozToStep = (targetModel: LabModel, stepIdx: number) => {
    const stageEl = labStageRef.current;
    const stepMeta = LAB_STEPS_BY_MODEL[targetModel][stepIdx];
    if (!stageEl || !stepMeta) return;
    const rect = stageEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const partX = rect.left + (rect.width * stepMeta.anchorPct.x) / 100;
    const partY = rect.top + (rect.height * stepMeta.anchorPct.y) / 100;
    const placeOnLeft = stepMeta.anchorPct.x > 55;

    setFlightTarget({
      x: placeOnLeft ? partX - 118 : partX + 26,
      y: partY - 42,
      side: placeOnLeft ? 'right' : 'left',
    });
    setUstozBubble(`${stepMeta.shortLabel}: ${stepMeta.explanation}`);
  };

  // Detect interactive Mini-Mission completion -> award XP + celebrate!
  useEffect(() => {
    if (!isMissionSolvedNow || isMissionAlreadyClaimed) return;
    setCompletedMissions((prev) =>
      prev.includes(activeMission.id) ? prev : [...prev, activeMission.id]
    );
    setXp((prev) => prev + activeMission.rewardXp);
    setXpFlash(`+${activeMission.rewardXp} Ball`);
    setUstozExpr('proud');
    setUstozBubble(`Ofarin! Topshiriq bajarildi (+${activeMission.rewardXp} Mirvo Ball)!`);
    playSuccessChime();
    showToast(`✓ Topshiriq bajarildi! +${activeMission.rewardXp} Mirvo Ball`);
    const t = window.setTimeout(() => setXpFlash(null), 2600);
    return () => window.clearTimeout(t);
  }, [isMissionSolvedNow, isMissionAlreadyClaimed, activeMission]);

  // Speak with real Uzbek TTS (/api/speech/tts + native fallback) and live lip-sync
  const speakEmotionalStep = (text: string, chosenMood: VoiceMood) => {
    const preset =
      chosenMood === 'Sokin'
        ? { rate: 0.88, pitch: 0.94, expr: 'calm' as UstozExpression }
        : chosenMood === 'Hayrat'
        ? { rate: 1.1, pitch: 1.15, expr: 'amazed' as UstozExpression }
        : { rate: 1.03, pitch: 1.04, expr: 'happy' as UstozExpression };

    setUstozExpr(preset.expr);
    setUstozBubble(text);
    voiceEngine.unlockAudio();

    void voiceEngine.speak(
      text,
      {
        onStart: () => {
          setPlaying(true);
        },
        onTick: (mouthOpen) => {
          setVoiceActivity(mouthOpen);
        },
        onEnd: () => {
          setPlaying(false);
          setVoiceActivity(0);
        },
      },
      true,
      { rate: preset.rate, pitch: preset.pitch, gender: 'auto' }
    );
  };

  const handleSelectStep = (stepIdx: number) => {
    setActiveLabStep(stepIdx);
    setStepFocusActive(true);
    const meta = LAB_STEPS_BY_MODEL[model][stepIdx];
    flyUstozToStep(model, stepIdx);
    if (playing && meta) {
      speakEmotionalStep(`${meta.title}. ${meta.explanation}`, mood);
    } else if (meta) {
      setUstozExpr(stepIdx === 3 ? 'amazed' : 'thinking');
    }
  };

  const pickModel = (nextModel: LabModel) => {
    voiceEngine.stop();
    setPlaying(false);
    setVoiceActivity(0);
    setModel(nextModel);
    setActiveLabStep(0);
    setStepFocusActive(false);
    if (nextModel === 'transformer') {
      setSl1(220);
      setSl2(4);
    } else if (nextModel === 'turbine') {
      setSl1(10);
      setSl2(40);
    } else if (nextModel === 'gaes') {
      setSl1(120);
      setSl2(90);
    } else {
      setSl1(40);
      setSl2(6);
    }
    setUstozExpr('happy');
    setUstozBubble(
      nextModel === 'transformer'
        ? 'Transformator WebGL 3D modeli! Sichqoncha bilan 360° aylantirib ko‘ring.'
        : nextModel === 'turbine'
        ? 'Shamol turbinasi 3D kesimi! Gondola ichidagi tishli reduktor va generatorga qarang.'
        : nextModel === 'gaes'
        ? 'GAES-120 haqiqiy 3D stansiyasi! 2-slayderni chapga sursangiz Nasos rejimiga o‘tadi.'
        : 'Paskal 3D gidravlik pressi! Kichik kuch bilan og‘ir oltin yukni ko‘tarib ko‘ring.'
    );
  };

  const jumpModel = (nextModel: LabModel) => {
    setActiveTab('doska');
    pickModel(nextModel);
    showToast('Three.js WebGL 3D model yuklandi');
  };

  const openFullLabLesson = (targetModel: LabModel = model) => {
    voiceEngine.stop();
    setPlaying(false);
    if (targetModel === 'transformer') onSelectStarterCard('physics-transformer');
    else if (targetModel === 'turbine') onSelectStarterCard('wind-turbine-energy');
    else if (targetModel === 'gaes')
      onSelectQuickTopic('Gidroakkumulyator elektr stansiyasi (GAES)', 'GAES stansiya');
    else onSelectStarterCard('hydraulic-press-pascal');
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
      voiceEngine.stop();
      setPlaying(false);
      showToast('Qwen 3.8 Omni Flash orqali 3D dars yaratilmoqda...');
      onSubmitPrompt(e);
    } else {
      setStepFocusActive(true);
      flyUstozToStep(model, activeLabStep);
      showToast('4 qadamli WebGL 3D tahlil faollashtirildi');
    }
  };

  const togglePlay = () => {
    if (playing) {
      voiceEngine.stop();
      setPlaying(false);
      setVoiceActivity(0);
      showToast('Ovoz to‘xtatildi');
      return;
    }
    setStepFocusActive(true);
    flyUstozToStep(model, activeLabStep);
    const spokenLine = `${activeStepMeta.title}. ${activeStepMeta.explanation} Hozirgi natija: ${labConfig.formulaLive}.`;
    showToast(`Emotsional ustoz ovozi (${mood})`);
    speakEmotionalStep(spokenLine, mood);
  };

  const handleSetMood = (nextMood: VoiceMood) => {
    setMood(nextMood);
    const expr: UstozExpression =
      nextMood === 'Sokin' ? 'calm' : nextMood === 'Hayrat' ? 'amazed' : 'happy';
    setUstozExpr(expr);
    showToast(`Ohang: ${nextMood}`);
    if (playing) {
      const spokenLine = `${activeStepMeta.title}. ${activeStepMeta.explanation}`;
      speakEmotionalStep(spokenLine, nextMood);
    }
  };

  const handleNextMission = () => {
    setMissionIdxByModel((prev) => ({
      ...prev,
      [model]: (prev[model] + 1) % modelMissionList.length,
    }));
    setUstozExpr('thinking');
    showToast('Yangi amaliy topshiriq ochildi!');
  };

  const nextReel = () => {
    setReelIdx((prev) => (prev + 1) % REELS_DATA.length);
    setXp((prev) => prev + 50);
    setUstozExpr('proud');
    showToast('+50 Mirvo Ball qo‘shildi');
  };

  const claimXp = (cost: number, label: string) => {
    if (xp < cost) {
      setUstozExpr('alert');
      showToast('Ball yetarli emas');
      return;
    }
    setXp((prev) => prev - cost);
    setUstozExpr('proud');
    showToast(`${label} olindi`);
  };

  const copyCode = (text: string, msg: string) => {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).catch(() => {});
    }
    showToast(msg);
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

  return (
    <div className="mirvo-native flex-1 min-h-0 flex flex-col relative overflow-hidden">
      {/* Native Toast Notification */}
      <div className={`toast ${toastVisible ? 'show' : ''}`} role="status" aria-live="polite">
        {toastMsg}
      </div>

      {/* FREE-FLYING 6-EXPRESSION INTERACTIVE EMOJI USTOZ (Viewport-level, never trapped!) */}
      <FloatingEmojiUstoz
        expression={isListening ? 'amazed' : ustozExpr}
        onChangeExpression={(expr) => {
          setUstozExpr(expr);
          const labels: Record<UstozExpression, string> = {
            happy: 'Quvnoq kayfiyatda o‘rganamiz!',
            amazed: 'Qarang, qanday ajoyib fizik qonun!',
            thinking: 'Keling, bu qismni sinchiklab ko‘ramiz...',
            proud: 'Ofarin! A’lo darajada bajardingiz!',
            alert: 'Diqqat! Qiymatni biroz to‘g‘rilab ko‘ring.',
            calm: 'Shoshilmay, sokin ohangda tushuntiraman.',
          };
          setUstozBubble(labels[expr]);
        }}
        speechBubble={ustozBubble}
        isSpeaking={playing}
        voiceActivity={voiceActivity}
        isListening={isListening}
        flightTarget={flightTarget}
        clickToFlyEnabled={clickToFly}
        onToggleClickToFly={() => {
          setClickToFly((v) => {
            showToast(!v ? 'Bosilgan joyga uchish yoqildi' : 'Bosilgan joyga uchish o‘chirildi');
            return !v;
          });
        }}
      />

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

            <button
              type="button"
              className="pill-stat"
              style={
                xpFlash
                  ? { borderColor: '#F59E0B', background: 'rgba(245, 158, 11, 0.16)' }
                  : undefined
              }
              onClick={() => setActiveTab('profil')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#D97706" aria-hidden="true">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>{formatSpaceNumber(xp)}</span>
              {xpFlash && (
                <span style={{ color: '#059669', fontSize: 11, fontWeight: 800 }}>{xpFlash}</span>
              )}
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
                    Haqiqiy Three.js WebGL 3D modellar (PBR), 360° aylantirish, qismlarga ajratish
                    va 3D Emoji Ustoz ovozi bilan istalgan qurilmani o‘rganing.
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
                            showToast('Rasm yuklash ochildi (Vision tahlil)');
                            onOpenFilePicker();
                          }}
                        >
                          Rasm
                        </button>
                        <button
                          type="button"
                          className="soft-btn"
                          onClick={() => {
                            showToast('Videodan dars rejimi ochildi');
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

                  {/* Emotional Voice Strip (Real Uzbek TTS + Mood Sync + Summon Free-Flying Ustoz) */}
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
                        <button
                          type="button"
                          className="m-chip"
                          style={{
                            background: 'rgba(245, 158, 11, 0.14)',
                            color: 'var(--amber)',
                            fontWeight: 700,
                          }}
                          onClick={() => {
                            setStepFocusActive(true);
                            flyUstozToStep(model, activeLabStep);
                            showToast('Emoji Ustoz detal oldiga uchib keldi!');
                          }}
                        >
                          ✨ Ustozni chaqir
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick Workspace Links */}
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
                      onClick={() => pickModel('gaes')}
                    >
                      GAES 3D Laboratoriya
                    </button>
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
                      GAES AI dars
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

                  {/* Live Qwen 3.8 Omni Flash Per-Lesson Token & Cost Meter */}
                  <div
                    style={{
                      marginTop: 14,
                      padding: '11px 13px',
                      borderRadius: 16,
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
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
                        Qwen 3.8 Omni Flash · Aniq Token Hisoblagich
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('profil')}
                        style={{
                          border: 'none',
                          background: 'var(--surface-2)',
                          color: 'var(--accent)',
                          borderRadius: 999,
                          padding: '3px 9px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Barcha darslar ({lessonTokenLogs.length}) ›
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
                        Jami: <strong style={{ color: 'var(--ink)' }}>{formatTokenCount(sessionTokenStats.total_tokens)}</strong> tok
                      </span>
                      <span>
                        Kirish: <strong>{formatTokenCount(sessionTokenStats.prompt_tokens)}</strong>
                      </span>
                      <span>
                        Chiqish: <strong>{formatTokenCount(sessionTokenStats.output_tokens)}</strong>
                      </span>
                      <span>
                        Xarajat:{' '}
                        <strong style={{ color: '#059669' }}>
                          {formatCostUsd(sessionTokenStats.cost_usd)} ({formatCostUzsApprox(sessionTokenStats.cost_usd)})
                        </strong>
                      </span>
                    </div>

                    {lessonTokenLogs[0] && (
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Oxirgi dars: <strong style={{ color: 'var(--ink)' }}>{lessonTokenLogs[0].topic}</strong> —{' '}
                        {formatTokenCount(lessonTokenLogs[0].total_tokens)} tok (
                        {formatCostUsd(lessonTokenLogs[0].cost_usd)})
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: TRUE 2.5D ISOMETRIC LAB + EXPLODED VIEW + 4-STEP SYNC + MINI-MISSION */}
                <div className="lab">
                  {/* Top Switcher + Exploded View ("Qismlarga ajratish") Toggle */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div className="lab-switcher" style={{ flex: 1, marginBottom: 0 }}>
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
                      <button
                        type="button"
                        className={`lab-btn ${model === 'gaes' ? 'active' : ''}`}
                        onClick={() => pickModel('gaes')}
                      >
                        GAES-120
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setExploded((v) => {
                          const next = !v;
                          setUstozExpr(next ? 'amazed' : 'happy');
                          setUstozBubble(
                            next
                              ? 'Qismlarga ajratildi! Ichki tuzilishni ko‘rish uchun istalgan detalni bosing.'
                              : 'Qurilma qayta yig‘ildi!'
                          );
                          showToast(next ? 'Qismlarga ajratish rejimi yoqildi' : 'Yig‘ilgan ko‘rinish');
                          return next;
                        });
                      }}
                      aria-pressed={exploded}
                      style={{
                        border: exploded
                          ? '1px solid rgba(250, 204, 21, 0.7)'
                          : '1px solid rgba(255, 255, 255, 0.16)',
                        background: exploded
                          ? 'rgba(250, 204, 21, 0.2)'
                          : 'rgba(255, 255, 255, 0.08)',
                        color: exploded ? '#FDE68A' : '#E2E8F0',
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: '8px 10px',
                        borderRadius: 11,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{exploded ? 'Yig‘ish' : 'Qismlarga ajratish'}</span>
                    </button>
                  </div>

                  {/* Live Dynamic Formula Strip synced to sliders */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                      padding: '7px 12px',
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(56, 189, 248, 0.22)',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#93C5FD',
                      }}
                    >
                      {labConfig.formulaSymbol}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12.5,
                        fontWeight: 800,
                        color: '#FDE68A',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {labConfig.formulaLive}
                    </span>
                  </div>

                  {/* TRUE 3D WEBGL PBR STAGE (PerspectiveCamera + OrbitControls + Real-time Shadows + Exploded View) */}
                  <div ref={labStageRef} className="svg-box" id="svgBox">
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
                      exploded={exploded}
                      onExplodedChange={setExploded}
                      focusPart={stepFocusActive ? activeStepMeta.partId : undefined}
                      isPlaying={true}
                      darkSurface={true}
                      compactHud={true}
                      onPartSelect={(partId, label, screenPos) => {
                        const matchedStep = currentSteps.find((s) => s.partId === partId);
                        if (matchedStep) {
                          setActiveLabStep(matchedStep.index);
                          setStepFocusActive(true);
                        }
                        if (screenPos && labStageRef.current) {
                          const rect = labStageRef.current.getBoundingClientRect();
                          const absX = rect.left + screenPos.x;
                          const absY = rect.top + screenPos.y;
                          const onLeft = screenPos.x > rect.width * 0.52;
                          setFlightTarget({
                            x: onLeft ? absX - 115 : absX + 24,
                            y: absY - 46,
                            side: onLeft ? 'right' : 'left',
                          });
                        }
                        setUstozExpr('amazed');
                        setUstozBubble(
                          matchedStep
                            ? `${matchedStep.title} — ${matchedStep.explanation}`
                            : `${label || partId}: 3D detalni aylantirib yaqindan ko‘rishingiz mumkin!`
                        );
                      }}
                    />
                  </div>

                  {/* 4-STEP INTERACTIVE GUIDED EXPLANATION STRIP */}
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 5,
                        marginBottom: 8,
                      }}
                    >
                      {currentSteps.map((st) => {
                        const active = stepFocusActive && activeLabStep === st.index;
                        return (
                          <button
                            key={st.partId}
                            type="button"
                            onClick={() => handleSelectStep(st.index)}
                            style={{
                              border: active
                                ? '1px solid rgba(56, 189, 248, 0.7)'
                                : '1px solid rgba(255, 255, 255, 0.09)',
                              background: active
                                ? 'rgba(56, 189, 248, 0.22)'
                                : 'rgba(255, 255, 255, 0.05)',
                              color: active ? '#FFFFFF' : '#CBD5E1',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '6px 4px',
                              borderRadius: 9,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {st.shortLabel}
                          </button>
                        );
                      })}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '7px 11px',
                        borderRadius: 11,
                        background: 'rgba(15, 23, 42, 0.72)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: 12,
                        color: '#E2E8F0',
                        lineHeight: 1.4,
                      }}
                    >
                      <span>
                        <strong style={{ color: '#38BDF8' }}>{activeStepMeta.title}:</strong>{' '}
                        {activeStepMeta.explanation}
                      </span>
                      {stepFocusActive && (
                        <button
                          type="button"
                          onClick={() => setStepFocusActive(false)}
                          style={{
                            border: 'none',
                            background: 'rgba(255,255,255,0.1)',
                            color: '#CBD5E1',
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '4px 8px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          Barchasi
                        </button>
                      )}
                    </div>
                  </div>

                  {/* LIVE TABULAR READOUT PAIR */}
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

                  {/* LIVE INTERACTIVE SLIDERS */}
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

                  {/* INTERACTIVE PRACTICE MINI-MISSION (+150 MIRVO BALL XP!) */}
                  <div
                    style={{
                      marginTop: 12,
                      padding: '10px 12px',
                      borderRadius: 14,
                      background: isMissionSolvedNow
                        ? 'rgba(16, 185, 129, 0.16)'
                        : 'rgba(251, 191, 36, 0.11)',
                      border: isMissionSolvedNow
                        ? '1px solid rgba(52, 211, 153, 0.5)'
                        : '1px solid rgba(251, 191, 36, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 200 }}>
                      {isMissionSolvedNow ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Target className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#FFFFFF' }}>
                          {isMissionSolvedNow
                            ? `✓ Topshiriq bajarildi! (+${activeMission.rewardXp} Mirvo Ball)`
                            : `Amaliy topshiriq: ${activeMission.title}`}
                        </div>
                        <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 2 }}>
                          {isMissionSolvedNow
                            ? 'Ajoyib! Slayderlarni aniq sozladingiz.'
                            : activeMission.hint(labConfig.outputVal)}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleNextMission}
                      style={{
                        border: 'none',
                        background: isMissionSolvedNow ? '#10B981' : 'rgba(255,255,255,0.12)',
                        color: '#FFFFFF',
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: '6px 11px',
                        borderRadius: 9,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{isMissionSolvedNow ? 'Keyingi topshiriq →' : `+${activeMission.rewardXp} Ball`}</span>
                    </button>
                  </div>

                  {/* Fullscreen AI Whiteboard Launch Row */}
                  <div className="lab-open-row">
                    <span style={{ fontSize: 11.5, color: '#94A3B8' }}>
                      To‘liq ekranli AI chizma doskasi va ovozli dars
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
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 360,
                        height: 230,
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
                        darkSurface={true}
                        compactHud={true}
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
                      <strong>{completedMissions.length}</strong>
                      <span>Missiyalar</span>
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
                        showToast('O‘qilgan darslar tarixi ochildi');
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
                    <div>
                      <strong style={{ display: 'block', fontSize: 15 }}>
                        {userName || userEmail || 'Mirvo O‘quvchi'}
                      </strong>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Balans: {formatSpaceNumber(xp)} Mirvo Ball · {completedMissions.length} ta
                        topshiriq bajarildi
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

                  {/* Per-Lesson Exact Token Breakdown Card (Qwen 3.8 Omni Flash) */}
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
                        marginBottom: 10,
                      }}
                    >
                      <strong style={{ fontSize: 14 }}>
                        Har bir dars token sarfi (Qwen 3.8 Omni Flash)
                      </strong>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: '#059669',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        Jami: {formatCostUsd(sessionTokenStats.cost_usd)} ({formatCostUzsApprox(sessionTokenStats.cost_usd)})
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 11.5,
                        color: 'var(--muted)',
                        marginBottom: 10,
                        lineHeight: 1.45,
                      }}
                    >
                      Narx tarifi: Kirish $0.15 / 1M · Kesh $0.016 / 1M · Chiqish $0.47 / 1M token
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
                        Hozircha AI generatsiya qilingan darslar yo‘q. Doskada istalgan qurilma yoki
                        mavzuni yozib Boshlash ni bosing — sarflangan kirish, kesh va chiqish
                        tokenlari darsma-dars yozib boriladi.
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          maxHeight: 240,
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
                                {formatTokenCount(entry.total_tokens)} tok · {formatCostUsd(entry.cost_usd)}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--muted)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              Model: {entry.model} · Kirish: {formatTokenCount(entry.prompt_tokens)}{' '}
                              (Kesh: {formatTokenCount(entry.cached_tokens)}) · Chiqish:{' '}
                              {formatTokenCount(entry.output_tokens)} · {formatCostUzsApprox(entry.cost_usd)}
                            </div>
                          </div>
                        ))}
                      </div>
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
                setUstozExpr('proud');
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
