import React from 'react';

export type LabModel = 'transformer' | 'turbine' | 'hydraulic';

export interface LabStepMeta {
  index: number;
  partId: string;
  shortLabel: string;
  title: string;
  explanation: string;
  anchorPct: { x: number; y: number };
}

export const LAB_STEPS_BY_MODEL: Record<LabModel, readonly LabStepMeta[]> = {
  transformer: [
    {
      index: 0,
      partId: 'primary',
      shortLabel: '1. Kirish N₁',
      title: 'Birlamchi chulg‘am (N₁)',
      explanation:
        'Birlamchi chulg‘amga berilgan o‘zgaruvchan kuchlanish (U₁) mis o‘ramlar bo‘ylab tok oqimini hosil qiladi.',
      anchorPct: { x: 24, y: 48 },
    },
    {
      index: 1,
      partId: 'core',
      shortLabel: '2. O‘zak Φ',
      title: 'Po‘lat magnit o‘zak (Φ)',
      explanation:
        'Qatlamli elektrotexnik po‘lat o‘zak o‘zgaruvchan magnit oqimi (Φ) ni yo‘qotishlarsiz ikkinchi tomonga uzatadi.',
      anchorPct: { x: 47, y: 36 },
    },
    {
      index: 2,
      partId: 'secondary',
      shortLabel: '3. Chiqish N₂',
      title: 'Ikkilamchi chulg‘am (N₂)',
      explanation:
        'Magnit oqimi ikkilamchi o‘ramlarni kesib o‘tib, o‘ramlar nisbatiga proporsional yangi kuchlanish (U₂) uyg‘otadi.',
      anchorPct: { x: 65, y: 50 },
    },
    {
      index: 3,
      partId: 'gauge',
      shortLabel: '4. Voltmetr',
      title: 'Jonli analog voltmetr',
      explanation:
        'Voltmetr strelkasi chiqish kuchlanishi U₂ = U₁ · (N₂/N₁) qiymatini real vaqtda aniq ko‘rsatadi.',
      anchorPct: { x: 84, y: 54 },
    },
  ],
  turbine: [
    {
      index: 0,
      partId: 'blades',
      shortLabel: '1. Parraklar',
      title: 'Aerodinamik parraklar va shamol',
      explanation:
        'Havo oqimi (v) parrak profilida ko‘tarish kuchi hosil qiladi; tezlik 2 barobar oshsa, quvvat 8 barobar ortadi.',
      anchorPct: { x: 26, y: 40 },
    },
    {
      index: 1,
      partId: 'gearbox',
      shortLabel: '2. Reduktor',
      title: 'Gondola ichki reduktori',
      explanation:
        'Tishli g‘ildiraklar past aylanish tezligini generator uchun kerakli yuqori chastotaga ko‘tarib beradi.',
      anchorPct: { x: 49, y: 34 },
    },
    {
      index: 2,
      partId: 'generator',
      shortLabel: '3. Generator',
      title: 'Sinxron generator va minora',
      explanation:
        'Aylanuvchi rotor stator o‘ramlarida elektr energiyasi ishlab chiqarib, minora ichidan tarmoqqa uzatadi.',
      anchorPct: { x: 63, y: 56 },
    },
    {
      index: 3,
      partId: 'gauge',
      shortLabel: '4. Quvvat P',
      title: 'Jonli quvvat o‘lchagich (kW)',
      explanation:
        'Bets qonuni (Cp ≤ 59.3%) bo‘yicha real chiqish quvvati P = ½·ρ·A·v³·Cp analog shkalada aks etadi.',
      anchorPct: { x: 85, y: 55 },
    },
  ],
  hydraulic: [
    {
      index: 0,
      partId: 'piston_in',
      shortLabel: '1. Kichik F₁',
      title: 'Kichik porshen va kuch (F₁)',
      explanation:
        'Kichik yuzali (S₁) porshenga bosilgan F₁ kuchi suyuqlikda yuqori bosim p = F₁ / S₁ hosil qiladi.',
      anchorPct: { x: 26, y: 40 },
    },
    {
      index: 1,
      partId: 'fluid',
      shortLabel: '2. Suyuqlik',
      title: 'Paskal bosimli suyuqlik kamerasi',
      explanation:
        'Yopiq gidravlik tizimda bosim suyuqlikning barcha nuqtalariga bir xil va yo‘qotishsiz uzatiladi.',
      anchorPct: { x: 46, y: 66 },
    },
    {
      index: 2,
      partId: 'piston_out',
      shortLabel: '3. Katta F₂',
      title: 'Katta porshen va og‘ir yuk (F₂)',
      explanation:
        'Katta porshen yuzasi S₂ qancha katta bo‘lsa, yukni ko‘taruvchi F₂ = F₁ · (S₂/S₁) kuchi shuncha ortadi.',
      anchorPct: { x: 64, y: 38 },
    },
    {
      index: 3,
      partId: 'gauge',
      shortLabel: '4. Manometr',
      title: 'Analog bosim va kuch manometri',
      explanation:
        'Manometr strelkasi tizimdagi real chiqish kuchini (N) har bir slayder o‘zgarishida jonli kuzatadi.',
      anchorPct: { x: 85, y: 55 },
    },
  ],
};

interface IsometricLab25DProps {
  model: LabModel;
  sl1: number;
  sl2: number;
  exploded: boolean;
  activeStep: number; // 0..3
  stepHighlightActive: boolean;
  onSelectStep: (stepIndex: number) => void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Machined isometric-mounted analog dial gauge inspired by wheresryan22/anatomy
 * Features: 4-tone bezel, 15 precision ticks (major every 5th), color arc zones,
 * specular glass crescent, digital readout, and live smoothly rotating needle.
 */
const AnalogDialGauge: React.FC<{
  cx: number;
  cy: number;
  ratio: number; // 0..1
  unit: string;
  valueText: string;
  title: string;
  accent: string;
  explodedOffset: { x: number; y: number };
  dimmed: boolean;
  highlighted: boolean;
  onClick: () => void;
}> = ({
  cx,
  cy,
  ratio,
  unit,
  valueText,
  title,
  accent,
  explodedOffset,
  dimmed,
  highlighted,
  onClick,
}) => {
  const safeRatio = clamp(ratio, 0, 1);
  // Needle sweeps from -120 deg to +120 deg
  const angleDeg = -120 + safeRatio * 240;
  const r = 34;

  const ticks = Array.from({ length: 15 }).map((_, i) => {
    const t = i / 14;
    const deg = -120 + t * 240 - 90;
    const rad = (deg * Math.PI) / 180;
    const isMajor = i % 7 === 0 || i === 3 || i === 11;
    const rOut = r - 4.5;
    const rIn = isMajor ? r - 10.5 : r - 7.8;
    return {
      x1: cx + Math.cos(rad) * rIn,
      y1: cy + Math.sin(rad) * rIn,
      x2: cx + Math.cos(rad) * rOut,
      y2: cy + Math.sin(rad) * rOut,
      isMajor,
    };
  });

  return (
    <g
      onClick={onClick}
      style={{
        cursor: 'pointer',
        transform: `translate(${explodedOffset.x}px, ${explodedOffset.y}px)`,
        opacity: dimmed ? 0.36 : 1,
        transition: 'transform 560ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease',
        filter: highlighted ? `drop-shadow(0 0 10px ${accent})` : undefined,
      }}
    >
      {/* Stand post connecting dial to bench */}
      <path
        d={`M ${cx - 5} ${cy + r - 2} L ${cx + 5} ${cy + r - 2} L ${cx + 7} ${cy + r + 24} L ${cx - 7} ${cy + r + 24} Z`}
        fill="#334155"
        stroke="#0F172A"
        strokeWidth="1.2"
      />
      <ellipse
        cx={cx}
        cy={cy + r + 24}
        rx="14"
        ry="5.5"
        fill="#475569"
        stroke="#0F172A"
        strokeWidth="1.2"
      />
      {/* Outer 3D extruded metallic housing depth */}
      <ellipse cx={cx + 3.5} cy={cy + 3.5} rx={r + 5} ry={r + 5} fill="#0F172A" />
      <circle
        cx={cx}
        cy={cy}
        r={r + 4.5}
        fill="url(#isoMetalBezel)"
        stroke={highlighted ? accent : '#64748B'}
        strokeWidth={highlighted ? 2.2 : 1.3}
      />
      {/* Recessed dark instrument face */}
      <circle cx={cx} cy={cy} r={r} fill="#090F1D" stroke="#1E293B" strokeWidth="1.5" />
      {/* Colored safe -> high zone arc */}
      <path
        d={`M ${cx - 24} ${cy + 14} A 28 28 0 1 1 ${cx + 24} ${cy + 14}`}
        fill="none"
        stroke="rgba(148,163,184,0.22)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx + 15} ${cy - 23} A 28 28 0 0 1 ${cx + 24} ${cy + 14}`}
        fill="none"
        stroke="#F59E0B"
        strokeWidth="3.2"
        strokeLinecap="round"
        opacity="0.85"
      />
      {/* Radial Scale Ticks */}
      {ticks.map((tk, idx) => (
        <line
          key={idx}
          x1={tk.x1}
          y1={tk.y1}
          x2={tk.x2}
          y2={tk.y2}
          stroke={tk.isMajor ? '#E2E8F0' : '#64748B'}
          strokeWidth={tk.isMajor ? 1.5 : 1}
          strokeLinecap="round"
        />
      ))}
      {/* Engraved unit & tiny title */}
      <text
        x={cx}
        y={cy - 12}
        textAnchor="middle"
        fill="#94A3B8"
        fontSize="6.5"
        fontWeight="700"
        letterSpacing="0.8"
      >
        {title}
      </text>
      {/* Digital inset readout window */}
      <rect
        x={cx - 21}
        y={cy + 12}
        width="42"
        height="13"
        rx="3.5"
        fill="#0F172A"
        stroke="rgba(56,189,248,0.35)"
        strokeWidth="0.9"
      />
      <text
        x={cx}
        y={cy + 21}
        textAnchor="middle"
        fill={accent}
        fontSize="7.6"
        fontWeight="800"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {valueText}
      </text>
      {/* Rotating Live Needle */}
      <g
        style={{
          transformOrigin: `${cx}px ${cy}px`,
          transform: `rotate(${angleDeg.toFixed(1)}deg)`,
          transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <polygon
          points={`${cx - 1.8},${cy + 7} ${cx + 1.8},${cy + 7} ${cx + 0.6},${cy - r + 8} ${cx - 0.6},${cy - r + 8}`}
          fill="#F97316"
        />
        <line
          x1={cx}
          y1={cy + 6}
          x2={cx}
          y2={cy - r + 9}
          stroke="#FDE68A"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      </g>
      {/* Center brass hub cap */}
      <circle cx={cx} cy={cy} r="4.6" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r="1.8" fill="#475569" />
      {/* Subtle glass reflection arc */}
      <path
        d={`M ${cx - 23} ${cy - 13} A 27 27 0 0 1 ${cx + 16} ${cy - 22}`}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.18"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Tiny corner label in exploded mode */}
      <text
        x={cx}
        y={cy - r - 9}
        textAnchor="middle"
        fill="#FDE68A"
        fontSize="8.5"
        fontWeight="700"
        opacity={explodedOffset.x !== 0 || highlighted ? 1 : 0}
        style={{ transition: 'opacity 250ms ease' }}
      >
        {unit}
      </text>
    </g>
  );
};

export const IsometricLab25D: React.FC<IsometricLab25DProps> = ({
  model,
  sl1,
  sl2,
  exploded,
  activeStep,
  stepHighlightActive,
  onSelectStep,
}) => {
  const isLit = (stepIdx: number) => stepHighlightActive && activeStep === stepIdx;
  const isDim = (stepIdx: number) => stepHighlightActive && activeStep !== stepIdx;

  // ==================== 1. ISOMETRIC 2.5D TRANSFORMATOR ====================
  if (model === 'transformer') {
    const u2 = Math.round(sl1 * sl2);
    const fluxDur = Math.max(0.32, 1.9 - sl1 / 260).toFixed(2);
    const secTurns = Math.min(8, Math.max(3, Math.round(sl2 + 2)));
    const gaugeRatio = clamp((u2 - 110) / (2280 - 110), 0, 1);

    const offPrimary = exploded ? { x: -34, y: -12 } : { x: 0, y: 0 };
    const offCore = exploded ? { x: 0, y: -14 } : { x: 0, y: 0 };
    const offSecondary = exploded ? { x: 26, y: 12 } : { x: 0, y: 0 };
    const offGauge = exploded ? { x: 18, y: -14 } : { x: 0, y: 0 };

    return (
      <svg
        viewBox="0 0 430 240"
        fill="none"
        className="w-full h-full select-none"
        aria-label="Izometrik 2.5D Transformator modeli"
      >
        <defs>
          <linearGradient id="isoBenchTop" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id="isoCoreTop" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>
          <linearGradient id="isoCoreFront" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="isoCoreSide" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id="isoBlueCoil" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#93C5FD" />
            <stop offset="35%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </linearGradient>
          <linearGradient id="isoGoldCoil" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="40%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#92400E" />
          </linearGradient>
          <linearGradient id="isoMetalBezel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="50%" stopColor="#64748B" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
        </defs>

        {/* Soft ambient halo under bench */}
        <ellipse cx="215" cy="212" rx="176" ry="20" fill="#020617" fillOpacity="0.65" />

        {/* Machined Isometric Bench Plinth (4-tone + corner screws) */}
        <g opacity={exploded ? 0.65 : 1} style={{ transition: 'opacity 300ms ease' }}>
          {/* 4 rubber bench feet */}
          <rect x="64" y="198" width="16" height="8" rx="3" fill="#0F172A" stroke="#334155" strokeWidth="1" />
          <rect x="348" y="198" width="16" height="8" rx="3" fill="#0F172A" stroke="#334155" strokeWidth="1" />
          {/* Top isometric slab face */}
          <polygon
            points="92,158 378,158 352,196 52,196"
            fill="url(#isoBenchTop)"
            stroke="#334155"
            strokeWidth="1.2"
          />
          {/* Front thickness face */}
          <polygon points="52,196 352,196 352,205 52,205" fill="#0B1324" stroke="#1E293B" strokeWidth="1" />
          {/* Right thickness face */}
          <polygon points="352,196 378,158 378,167 352,205" fill="#060B16" stroke="#1E293B" strokeWidth="1" />
          {/* Recessed bench groove & 4 corner hex screws */}
          <polygon
            points="100,163 366,163 344,191 66,191"
            fill="none"
            stroke="#38BDF8"
            strokeOpacity="0.14"
            strokeWidth="1"
          />
          {[
            [72, 190],
            [340, 190],
            [102, 165],
            [362, 165],
          ].map(([sx, sy], i) => (
            <g key={i}>
              <circle cx={sx} cy={sy} r="2.6" fill="#334155" stroke="#64748B" strokeWidth="0.7" />
              <circle cx={sx} cy={sy} r="1" fill="#0F172A" />
            </g>
          ))}
          {/* Tiny engraved spec plate */}
          <rect x="172" y="197.5" width="66" height="6" rx="1.5" fill="#1E293B" stroke="#475569" strokeWidth="0.6" />
          <text x="205" y="202.2" textAnchor="middle" fill="#94A3B8" fontSize="4.6" fontWeight="700" letterSpacing="0.8">
            MIRVO TR-2.5D
          </text>
        </g>

        {/* Exploded View Isometric Guide Axes */}
        {exploded && (
          <g stroke="#38BDF8" strokeOpacity="0.45" strokeWidth="1.1" strokeDasharray="4 4">
            <line x1="82" y1="112" x2="152" y2="112" />
            <line x1="258" y1="126" x2="322" y2="126" />
            <line x1="205" y1="44" x2="205" y2="180" />
          </g>
        )}

        {/* PART 2: LAMINATED 4-TONE ISOMETRIC STEEL CORE */}
        <g
          onClick={() => onSelectStep(1)}
          style={{
            cursor: 'pointer',
            transform: `translate(${offCore.x}px, ${offCore.y}px)`,
            opacity: isDim(1) ? 0.36 : 1,
            transition: 'transform 540ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease',
            filter: isLit(1) ? 'drop-shadow(0 0 12px rgba(56,189,248,0.75))' : undefined,
          }}
        >
          {/* Top beveled 3D thickness face */}
          <polygon
            points="126,44 282,44 264,58 108,58"
            fill="url(#isoCoreTop)"
            stroke={isLit(1) ? '#38BDF8' : '#94A3B8'}
            strokeWidth={isLit(1) ? 1.8 : 1.1}
          />
          {/* Right deep-shadow extruded side face */}
          <polygon
            points="282,44 282,158 264,174 264,58"
            fill="url(#isoCoreSide)"
            stroke="#334155"
            strokeWidth="1.1"
          />
          {/* Stacked steel lamination seams on right side */}
          {[0, 1, 2, 3].map((i) => (
            <line
              key={i}
              x1={268 + i * 3.8}
              y1={55 - i * 3.1}
              x2={268 + i * 3.8}
              y2={170 - i * 3.1}
              stroke="#475569"
              strokeOpacity="0.45"
              strokeWidth="0.7"
            />
          ))}
          {/* Front solid core face */}
          <rect
            x="108"
            y="58"
            width="156"
            height="116"
            rx="8"
            fill="url(#isoCoreFront)"
            stroke={isLit(1) ? '#38BDF8' : '#64748B'}
            strokeWidth={isLit(1) ? 2 : 1.3}
          />
          {/* Corner clamping rivets on core */}
          {[
            [117, 67],
            [255, 67],
            [117, 165],
            [255, 165],
          ].map(([rx, ry], i) => (
            <circle key={i} cx={rx} cy={ry} r="2.6" fill="#1E293B" stroke="#94A3B8" strokeWidth="0.9" />
          ))}
          {/* Inner Core Window with 3D bevel depth */}
          <polygon points="148,86 226,86 226,144 148,144" fill="#070D19" stroke="#1E293B" strokeWidth="1.5" />
          <polygon points="148,86 158,79 226,79 226,86" fill="#1E293B" />
          <polygon points="148,86 158,79 158,137 148,144" fill="#334155" />
          {/* Animated Magnetic Flux Φ Loop */}
          <rect
            x="128"
            y="72"
            width="116"
            height="88"
            rx="9"
            stroke="#38BDF8"
            strokeWidth="2.8"
            className="flux"
            style={{ animationDuration: `${fluxDur}s` }}
          />
          <polygon points="184,67 193,72 184,77" fill="#38BDF8" />
          <polygon points="188,155 179,160 188,165" fill="#38BDF8" />
          <text x="190" y="114" textAnchor="middle" fill="#38BDF8" fontSize="11" fontWeight="800">
            Oqim Φ
          </text>
          <text x="190" y="127" textAnchor="middle" fill="#94A3B8" fontSize="8" fontWeight="600">
            50 Hz AC
          </text>
          {exploded && (
            <text x="196" y="36" textAnchor="middle" fill="#38BDF8" fontSize="9.5" fontWeight="800">
              Po‘lat magnit o‘zak
            </text>
          )}
        </g>

        {/* PART 1: PRIMARY COIL N1 (Left Isometric Windings + Input Terminals) */}
        <g
          onClick={() => onSelectStep(0)}
          style={{
            cursor: 'pointer',
            transform: `translate(${offPrimary.x}px, ${offPrimary.y}px)`,
            opacity: isDim(0) ? 0.36 : 1,
            transition: 'transform 560ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease',
            filter: isLit(0) ? 'drop-shadow(0 0 11px rgba(59,130,246,0.9))' : undefined,
          }}
        >
          {/* Input power leads & terminal post */}
          <path
            d="M 56 88 H 96 M 56 144 H 96"
            stroke="#60A5FA"
            strokeWidth="3"
            strokeLinecap="round"
            className="flux"
            style={{ animationDuration: `${fluxDur}s` }}
          />
          <circle cx="56" cy="88" r="5" fill="#1D4ED8" stroke="#93C5FD" strokeWidth="1.6" />
          <circle cx="56" cy="144" r="5" fill="#1D4ED8" stroke="#93C5FD" strokeWidth="1.6" />
          <text x="56" y="76" textAnchor="middle" fill="#93C5FD" fontSize="8.5" fontWeight="800">
            U₁={sl1}V
          </text>
          {/* Bobbin top & bottom flanges */}
          <rect x="94" y="76" width="48" height="6" rx="2.5" fill="#1E3A8A" stroke="#60A5FA" strokeWidth="1" />
          <rect x="94" y="150" width="48" height="6" rx="2.5" fill="#1E3A8A" stroke="#60A5FA" strokeWidth="1" />
          {/* 5 Extruded 2.5D Blue Copper Coils */}
          {[0, 1, 2, 3, 4].map((i) => {
            const cy = 84 + i * 13;
            return (
              <g key={i}>
                <rect
                  x="96"
                  y={cy}
                  width="44"
                  height="10.5"
                  rx="5"
                  fill="url(#isoBlueCoil)"
                  stroke={isLit(0) ? '#BAE6FD' : '#1E3A8A'}
                  strokeWidth="1"
                />
                <line
                  x1="103"
                  y1={cy + 3}
                  x2="132"
                  y2={cy + 3}
                  stroke="#FFFFFF"
                  strokeOpacity="0.42"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
          {exploded && (
            <text x="118" y="68" textAnchor="middle" fill="#93C5FD" fontSize="9.5" fontWeight="800">
              Birlamchi N₁
            </text>
          )}
        </g>

        {/* PART 3: SECONDARY COIL N2 (Dynamic Amber-Gold Windings + Busbar to Voltmeter) */}
        <g
          onClick={() => onSelectStep(2)}
          style={{
            cursor: 'pointer',
            transform: `translate(${offSecondary.x}px, ${offSecondary.y}px)`,
            opacity: isDim(2) ? 0.36 : 1,
            transition: 'transform 560ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease',
            filter: isLit(2) ? 'drop-shadow(0 0 11px rgba(251,191,36,0.9))' : undefined,
          }}
        >
          {/* Output copper busbars to Voltmeter */}
          <path
            d="M 280 96 H 316 V 118 M 280 140 H 316"
            stroke="#FBBF24"
            strokeWidth="2.6"
            strokeLinecap="round"
            className="flux"
            style={{ animationDuration: `${fluxDur}s` }}
          />
          <rect x="234" y="72" width="48" height="6" rx="2.5" fill="#78350F" stroke="#FCD34D" strokeWidth="1" />
          <rect x="234" y="156" width="48" height="6" rx="2.5" fill="#78350F" stroke="#FCD34D" strokeWidth="1" />
          {Array.from({ length: secTurns }).map((_, i) => {
            const spacing = 74 / secTurns;
            const cy = 80 + i * spacing;
            const h = Math.max(6.5, spacing - 2.4);
            return (
              <g key={i}>
                <rect
                  x="236"
                  y={cy}
                  width="44"
                  height={h}
                  rx={h / 2}
                  fill="url(#isoGoldCoil)"
                  stroke={isLit(2) ? '#FEF08A' : '#78350F'}
                  strokeWidth="0.9"
                />
                <line
                  x1="243"
                  y1={cy + h * 0.28}
                  x2="272"
                  y2={cy + h * 0.28}
                  stroke="#FFFFFF"
                  strokeOpacity="0.48"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
          {exploded && (
            <text x="258" y="65" textAnchor="middle" fill="#FDE68A" fontSize="9.5" fontWeight="800">
              Ikkilamchi N₂ ({sl2.toFixed(1)}x)
            </text>
          )}
        </g>

        {/* PART 4: LIVE ANALOG VOLTMETER WITH ROTATING NEEDLE */}
        <AnalogDialGauge
          cx={356}
          cy={124}
          ratio={gaugeRatio}
          unit="VOLTMETR U₂"
          title="VOLT AC"
          valueText={`${u2} V`}
          accent="#FBBF24"
          explodedOffset={offGauge}
          dimmed={isDim(3)}
          highlighted={isLit(3)}
          onClick={() => onSelectStep(3)}
        />
      </svg>
    );
  }

  // ==================== 2. ISOMETRIC 2.5D SHAMOL TURBINASI ====================
  if (model === 'turbine') {
    const kw = Math.round(
      (0.5 * 1.225 * Math.PI * (sl2 * 0.5) ** 2 * sl1 ** 3 * 0.45) / 1000
    );
    const spinDur = Math.max(0.38, 5.0 - sl1 * 0.22).toFixed(2);
    const bladeScale = 0.84 + ((sl2 - 20) / 40) * 0.24;
    const gaugeRatio = clamp(kw / 3200, 0, 1);

    const offBlades = exploded ? { x: -34, y: -10 } : { x: 0, y: 0 };
    const offGear = exploded ? { x: 2, y: -20 } : { x: 0, y: 0 };
    const offGen = exploded ? { x: 24, y: 8 } : { x: 0, y: 0 };
    const offGauge = exploded ? { x: 16, y: -12 } : { x: 0, y: 0 };

    return (
      <svg
        viewBox="0 0 430 240"
        fill="none"
        className="w-full h-full select-none"
        aria-label="Izometrik 2.5D Shamol Turbinasi modeli"
      >
        <defs>
          <linearGradient id="isoTowerG" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="45%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <linearGradient id="isoNacelle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="60%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="isoMetalBezel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="50%" stopColor="#64748B" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
        </defs>

        {/* Isometric Bench Pad */}
        <ellipse cx="215" cy="214" rx="176" ry="18" fill="#020617" fillOpacity="0.65" />
        <polygon points="92,168 378,168 352,202 52,202" fill="#131F36" stroke="#334155" strokeWidth="1.2" />
        <polygon points="52,202 352,202 352,210 52,210" fill="#0B1324" />

        {exploded && (
          <g stroke="#38BDF8" strokeOpacity="0.45" strokeWidth="1.1" strokeDasharray="4 4">
            <line x1="92" y1="90" x2="296" y2="90" />
            <line x1="196" y1="96" x2="196" y2="188" />
          </g>
        )}

        {/* PART 3: TOWER + GENERATOR BASE */}
        <g
          onClick={() => onSelectStep(2)}
          style={{
            cursor: 'pointer',
            transform: `translate(${offGen.x}px, ${offGen.y}px)`,
            opacity: isDim(2) ? 0.36 : 1,
            transition: 'transform 560ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease',
            filter: isLit(2) ? 'drop-shadow(0 0 11px rgba(56,189,248,0.85))' : undefined,
          }}
        >
          {/* Hex foundation concrete collar */}
          <ellipse cx="196" cy="186" rx="34" ry="11" fill="#475569" stroke="#94A3B8" strokeWidth="1.2" />
          <ellipse cx="196" cy="182" rx="26" ry="8" fill="#64748B" />
          {/* Tapered 4-tone tubular steel mast */}
          <polygon points="184,182 190,104 202,104 208,182" fill="url(#isoTowerG)" stroke="#334155" strokeWidth="1.2" />
          {/* Internal blue power output cable */}
          <path
            d="M 196 106 V 176 H 316"
            stroke="#38BDF8"
            strokeWidth="2.4"
            strokeLinecap="round"
            className="flux"
            style={{ animationDuration: `${spinDur}s` }}
          />
          {/* Cutaway Generator Stator inside rear of Nacelle */}
          <rect
            x="228"
            y="72"
            width="44"
            height="34"
            rx="8"
            fill="#1D4ED8"
            stroke={isLit(2) ? '#93C5FD' : '#60A5FA'}
            strokeWidth="1.6"
          />
          <rect x="236" y="79" width="28" height="20" rx="4" fill="#F59E0B" stroke="#FDE68A" strokeWidth="1.1" />
          <text x="250" y="92" textAnchor="middle" fill="#0F172A" fontSize="9.5" fontWeight="900">
            GEN
          </text>
          {exploded && (
            <text x="250" y="64" textAnchor="middle" fill="#93C5FD" fontSize="9.5" fontWeight="800">
              Generator &amp; Minora
            </text>
          )}
        </g>

        {/* PART 2: CUTAWAY NACELLE + MESHING GEARBOX */}
        <g
          onClick={() => onSelectStep(1)}
          style={{
            cursor: 'pointer',
            transform: `translate(${offGear.x}px, ${offGear.y}px)`,
            opacity: isDim(1) ? 0.36 : 1,
            transition: 'transform 560ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease',
            filter: isLit(1) ? 'drop-shadow(0 0 11px rgba(251,191,36,0.85))' : undefined,
          }}
        >
          {/* Translucent cutaway nacelle shell */}
          <path
            d="M 152 68 H 270 Q 282 68 282 88 Q 282 110 266 110 H 152 Q 142 110 142 89 Q 142 68 152 68 Z"
            fill="rgba(30,41,59,0.75)"
            stroke={isLit(1) ? '#FBBF24' : '#94A3B8'}
            strokeWidth="1.6"
          />
          {/* Main drive shaft */}
          <rect x="136" y="86" width="94" height="6" rx="3" fill="#94A3B8" stroke="#0F172A" strokeWidth="1" />
          {/* Gear 1 (Primary slow gear) */}
          <circle cx="178" cy="89" r="14" fill="#475569" stroke="#FBBF24" strokeWidth="2.4" strokeDasharray="4 3" />
          <circle cx="178" cy="89" r="5" fill="#F59E0B" />
          {/* Gear 2 (High-speed multiplier gear) */}
          <circle cx="204" cy="89" r="9.5" fill="#334155" stroke="#38BDF8" strokeWidth="2.2" strokeDasharray="3 2.5" />
          <circle cx="204" cy="89" r="3.5" fill="#38BDF8" />
          {exploded && (
            <text x="192" y="59" textAnchor="middle" fill="#FDE68A" fontSize="9.5" fontWeight="800">
              Reduktor (Gondola)
            </text>
          )}
        </g>

        {/* PART 1: WIND STREAMLINES + 3-BLADE AERODYNAMIC ROTOR */}
        <g
          onClick={() => onSelectStep(0)}
          style={{
            cursor: 'pointer',
            transform: `translate(${offBlades.x}px, ${offBlades.y}px)`,
            opacity: isDim(0) ? 0.36 : 1,
            transition: 'transform 560ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease',
            filter: isLit(0) ? 'drop-shadow(0 0 11px rgba(56,189,248,0.9))' : undefined,
          }}
        >
          {/* Animated Airflow Streamlines */}
          <path
            d="M 18 52 H 84 M 12 88 H 76 M 22 124 H 86"
            stroke="#38BDF8"
            strokeWidth="2.8"
            strokeLinecap="round"
            className="flux"
            style={{ animationDuration: `${spinDur}s` }}
          />
          <text x="48" y="42" textAnchor="middle" fill="#38BDF8" fontSize="9" fontWeight="800">
            v = {sl1} m/s
          </text>
          {/* Spinning 3-blade rotor centered at (130, 89) */}
          <g transform={`translate(130, 89) scale(${bladeScale.toFixed(2)}) translate(-130, -89)`}>
            <g
              style={{
                transformOrigin: '130px 89px',
                animation: `mirvoRot ${spinDur}s linear infinite`,
              }}
            >
              <path
                d="M 130 89 L 124 18 Q 130 13 135 20 L 136 82 Z"
                fill="#F8FAFC"
                stroke="#475569"
                strokeWidth="1.2"
              />
              <path
                d="M 130 89 L 190 124 Q 192 130 184 131 L 133 95 Z"
                fill="#E2E8F0"
                stroke="#475569"
                strokeWidth="1.2"
              />
              <path
                d="M 130 89 L 70 124 Q 68 130 76 131 L 127 95 Z"
                fill="#CBD5E1"
                stroke="#475569"
                strokeWidth="1.2"
              />
            </g>
          </g>
          {/* Nose cone spinner */}
          <circle cx="130" cy="89" r="10" fill="#1D4ED8" stroke="#FFFFFF" strokeWidth="2.2" />
          <circle cx="128" cy="87" r="3" fill="#93C5FD" />
          {exploded && (
            <text x="130" y="168" textAnchor="middle" fill="#E0F2FE" fontSize="9.5" fontWeight="800">
              Parraklar (Ø {sl2} m)
            </text>
          )}
        </g>

        {/* PART 4: LIVE ANALOG POWER METER (kW) */}
        <AnalogDialGauge
          cx={356}
          cy={124}
          ratio={gaugeRatio}
          unit="QUVVAT METR"
          title="POWER kW"
          valueText={`${kw} kW`}
          accent="#38BDF8"
          explodedOffset={offGauge}
          dimmed={isDim(3)}
          highlighted={isLit(3)}
          onClick={() => onSelectStep(3)}
        />
      </svg>
    );
  }

  // ==================== 3. ISOMETRIC 2.5D GIDRAVLIK PRESS (PASKAL) ====================
  const f2 = Math.round(sl1 * sl2);
  const strokeDown = Math.round((sl1 / 100) * 28);
  const strokeUp = Math.round((sl1 / 100) * 18);
  const gaugeRatio = clamp(f2 / 1200, 0, 1);

  const offIn = exploded ? { x: -24, y: -22 } : { x: 0, y: 0 };
  const offFluid = exploded ? { x: 0, y: 12 } : { x: 0, y: 0 };
  const offOut = exploded ? { x: 20, y: -20 } : { x: 0, y: 0 };
  const offGauge = exploded ? { x: 18, y: -12 } : { x: 0, y: 0 };

  return (
    <svg
      viewBox="0 0 430 240"
      fill="none"
      className="w-full h-full select-none"
      aria-label="Izometrik 2.5D Gidravlik Press modeli"
    >
      <defs>
        <linearGradient id="isoFluidG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#0284C7" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id="isoGoldBlock" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="45%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="isoMetalBezel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#CBD5E1" />
          <stop offset="50%" stopColor="#64748B" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>
      </defs>

      {/* Machined Press Baseplate */}
      <ellipse cx="215" cy="216" rx="176" ry="18" fill="#020617" fillOpacity="0.65" />
      <polygon points="88,168 378,168 352,204 52,204" fill="#131F36" stroke="#334155" strokeWidth="1.2" />
      <polygon points="52,204 352,204 352,212 52,212" fill="#0B1324" />

      {exploded && (
        <g stroke="#38BDF8" strokeOpacity="0.45" strokeWidth="1.1" strokeDasharray="4 4">
          <line x1="112" y1="30" x2="112" y2="180" />
          <line x1="242" y1="30" x2="242" y2="180" />
        </g>
      )}

      {/* PART 2: HYDRAULIC U-CHAMBER & FLUID */}
      <g
        onClick={() => onSelectStep(1)}
        style={{
          cursor: 'pointer',
          transform: `translate(${offFluid.x}px, ${offFluid.y}px)`,
          opacity: isDim(1) ? 0.36 : 1,
          transition: 'transform 560ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease',
          filter: isLit(1) ? 'drop-shadow(0 0 11px rgba(56,189,248,0.85))' : undefined,
        }}
      >
        {/* Outer steel/glass U-cylinder body */}
        <path
          d="M 86 68 V 172 Q 86 188 104 188 H 264 Q 282 188 282 172 V 76 H 204 V 146 H 138 V 68 Z"
          fill="#1E293B"
          fillOpacity="0.55"
          stroke={isLit(1) ? '#38BDF8' : '#64748B'}
          strokeWidth="2.4"
        />
        {/* Live Displaced Hydraulic Liquid */}
        <path
          d={`M 91 ${88 + strokeDown} V 170 Q 91 182 104 182 H 264 Q 277 182 277 170 V ${104 - strokeUp} H 209 V 151 H 133 V ${88 + strokeDown} Z`}
          fill="url(#isoFluidG)"
        />
        {/* Liquid Top Meniscus Ellipses */}
        <ellipse cx="112" cy={88 + strokeDown} rx="21" ry="6" fill="#7DD3FC" />
        <ellipse cx="243" cy={104 - strokeUp} rx="34" ry="8" fill="#7DD3FC" />
        {/* Pascal Pressure Flow Arrows inside conduit */}
        <path
          d="M 118 168 H 240"
          stroke="#E0F2FE"
          strokeWidth="2.8"
          strokeLinecap="round"
          className="flux"
        />
        {/* Tap pipe connecting chamber to Pressure Gauge */}
        <path d="M 282 158 H 322 V 148" stroke="#38BDF8" strokeWidth="3.2" strokeLinecap="round" />
        {exploded && (
          <text x="180" y="198" textAnchor="middle" fill="#7DD3FC" fontSize="9.5" fontWeight="800">
            Suyuqlik kamerasi (p = F₁/S₁)
          </text>
        )}
      </g>

      {/* PART 1: SMALL INPUT PISTON (S1, F1) */}
      <g
        onClick={() => onSelectStep(0)}
        style={{
          cursor: 'pointer',
          transform: `translate(${offIn.x}px, ${offIn.y}px)`,
          opacity: isDim(0) ? 0.36 : 1,
          transition: 'transform 560ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease',
          filter: isLit(0) ? 'drop-shadow(0 0 11px rgba(59,130,246,0.9))' : undefined,
        }}
      >
        {/* Force Down Arrow */}
        <path
          d={`M 112 ${20 + strokeDown} V ${44 + strokeDown} M 104 ${36 + strokeDown} L 112 ${46 + strokeDown} L 120 ${36 + strokeDown}`}
          stroke="#38BDF8"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="112" y={15 + strokeDown} textAnchor="middle" fill="#38BDF8" fontSize="9.5" fontWeight="800">
          F₁ = {sl1} N
        </text>
        {/* Steel Rod */}
        <rect x="106" y={50 + strokeDown} width="12" height="30" rx="2" fill="#94A3B8" stroke="#0F172A" strokeWidth="1" />
        {/* 2.5D Flanged Piston Disc */}
        <rect x="91" y={76 + strokeDown} width="42" height="12" rx="4" fill="#2563EB" stroke="#93C5FD" strokeWidth="1.2" />
        <ellipse cx="112" cy={76 + strokeDown} rx="21" ry="5" fill="#60A5FA" />
      </g>

      {/* PART 3: LARGE OUTPUT PISTON & 4-TONE GOLD LOAD BLOCK (S2, F2) */}
      <g
        onClick={() => onSelectStep(2)}
        style={{
          cursor: 'pointer',
          transform: `translate(${offOut.x}px, ${offOut.y}px)`,
          opacity: isDim(2) ? 0.36 : 1,
          transition: 'transform 560ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease',
          filter: isLit(2) ? 'drop-shadow(0 0 12px rgba(251,191,36,0.9))' : undefined,
        }}
      >
        {/* Heavy Extruded 2.5D Gold Load Block */}
        <polygon
          points={`212,${56 - strokeUp} 274,${56 - strokeUp} 284,${48 - strokeUp} 222,${48 - strokeUp}`}
          fill="#FEF08A"
          stroke="#B45309"
          strokeWidth="1"
        />
        <polygon
          points={`274,${56 - strokeUp} 284,${48 - strokeUp} 284,${78 - strokeUp} 274,${86 - strokeUp}`}
          fill="#B45309"
        />
        <rect
          x="212"
          y={56 - strokeUp}
          width="62"
          height="30"
          rx="4"
          fill="url(#isoGoldBlock)"
          stroke="#78350F"
          strokeWidth="1.2"
        />
        <text
          x="243"
          y={75 - strokeUp}
          textAnchor="middle"
          fill="#451A03"
          fontSize="12"
          fontWeight="900"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {f2} N
        </text>
        {/* Piston platform & wide disc */}
        <rect x="234" y={86 - strokeUp} width="18" height="14" fill="#94A3B8" stroke="#0F172A" strokeWidth="1" />
        <rect x="209" y={95 - strokeUp} width="68" height="12" rx="4" fill="#D97706" stroke="#FDE68A" strokeWidth="1.2" />
        <ellipse cx="243" cy={95 - strokeUp} rx="34" ry="6.5" fill="#FBBF24" />
        {/* Upward lift arrow */}
        <path
          d={`M 294 ${88 - strokeUp} V ${54 - strokeUp} M 287 ${63 - strokeUp} L 294 ${53 - strokeUp} L 301 ${63 - strokeUp}`}
          stroke="#34D399"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* PART 4: LIVE ANALOG MANOMETER */}
      <AnalogDialGauge
        cx={356}
        cy={124}
        ratio={gaugeRatio}
        unit="MANOMETR F₂"
        title="FORCE N"
        valueText={`${f2} N`}
        accent="#34D399"
        explodedOffset={offGauge}
        dimmed={isDim(3)}
        highlighted={isLit(3)}
        onClick={() => onSelectStep(3)}
      />
    </svg>
  );
};
