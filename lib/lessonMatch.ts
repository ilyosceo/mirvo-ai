import { CACHED_LESSONS } from '../data/cachedLessons.js';
import type { TutorLesson } from '../types/tutor.js';
import { normalizeUzToken } from './objectCatalog.js';

export function normalizeCacheSearchText(raw: string): string {
  return normalizeUzToken(raw)
    .replace(/\b([og])\s+(?=[a-z])/g, '$1')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripUzSuffixForMatch(word: string): string[] {
  const out = [word];
  const suffixes = [
    'larining',
    'lardan',
    'lariga',
    'larini',
    'larga',
    'larda',
    'lari',
    'lar',
    'ning',
    'dan',
    'ga',
    'ka',
    'qa',
    'da',
    'ni',
    'si',
    'i',
  ];
  for (const sfx of suffixes) {
    if (word.length > sfx.length + 3 && word.endsWith(sfx)) {
      const stem = word.slice(0, -sfx.length);
      out.push(stem);
      if (stem.endsWith('lar') && stem.length > 6) {
        out.push(stem.slice(0, -3));
      }
    }
  }
  return Array.from(new Set(out));
}

// Generic discipline/structural keywords that are too broad on their own unless paired with topic context
const GENERIC_IGNORE_KEYWORDS = new Set([
  'fizika',
  'kimyo',
  'ona tili',
  'biokimyo',
  'grammatika',
  'teorema',
  'tenglama',
  'sirt',
  '3d sirt',
  '3d grafik',
  'kvadrik',
  'kvadrik sirt',
  'kesim',
  'hajm',
  'ildiz',
  'ekstremum',
  'molekula',
  'protein',
  'oqsil',
  'osimliklar',
  'uchburchak',
  'kuch',
  'ega',
  'aniqlovchi',
  'yoruglik',
  'pubchem',
  'pdb',
  'stereometriya',
]);

// Extra curated natural-language phrases mapped directly to built-in DB lesson IDs
const EXTRA_LESSON_PHRASES: Record<string, string[]> = {
  'biology-cell-structure': [
    'hujayra',
    'hujayra tuzilishi',
    'hujayra qismlari',
    'hujayra nima',
    'hujayra haqida',
    'tirik hujayra',
    'hayvon hujayrasi',
    'osimlik hujayrasi',
    'mitoxondriya',
    'hujayra yadrosi',
    'sitoplazma',
  ],
  'photosynthesis-visual': [
    'fotosintez',
    'osimliklar qanday oziqlanadi',
    'xloroplast',
    'xlorofill',
  ],
  'pythagoras-visual': ['pifagor', 'pifagor teoremasi', 'gipotenuza', 'katet'],
  'pyramid-section': ['piramida', 'muntazam piramida', 'apofema', 'piramida kesimi'],
  'saddle-surface-3d': ['giperbolik paraboloid', 'egar sirt', 'egar sirti'],
  'two-sheet-hyperboloid-3d': ['ikki pallali giperboloid'],
  'ellipsoid-3d': ['ellipsoid'],
  'insulin-1zni-pdb': ['insulin', '1zni', 'insulin oqsili'],
  'caffeine-pubchem-3d': ['kofein', 'caffeine', 'kofein molekulasi'],
  'quadratic-parabola': ['kvadrat funksiya', 'diskriminant'],
  'parabola-y-x2': ['parabola', 'y x 2', 'y=x^2'],
  'vectors-3d-physics': ['vektor', 'vektorlar', '3d vektor', 'skalyar kopaytma'],
  'sky-blue-physics': ['osmon moviy', 'nega osmon moviy', 'reley sochilishi'],
  'uzbek-grammar-syntax': ['gap bolaklari', 'ega va kesim'],
  'physics-transformer': [
    'transformator',
    'transformator tuzilishi',
    'transformator qismlari',
    'transformator nima',
    'transformator haqida',
    'transformator qanday ishlaydi',
    'birlamchi chulgam',
    'ikkilamchi chulgam',
    'temir ozak',
  ],
  'hydraulic-press-pascal': [
    'gidravlik press',
    'paskal qonuni',
    'paskal',
    'gidravlika',
    'porshen',
  ],
  'wind-turbine-energy': [
    'shamol turbinasi',
    'shamol elektr stansiyasi',
    'shes',
    'bets qonuni',
    'shamol energetikasi',
  ],
  'electric-generator-ac': [
    'elektr generatori',
    'elektr generator',
    'generator',
    'sinxron generator',
    'faradey induksiya',
    'dinamo',
  ],
  'solar-pv-inverter': [
    'quyosh paneli',
    'quyosh elektr stansiyasi',
    'qes',
    'fotoelektr',
    'inverter',
    'fotoelement',
  ],
};

function apply3DModeIfRequested(lesson: TutorLesson, rawQuery: string): TutorLesson {
  const wants3d = /\b3\s*d\b|uch\s*o['‘’`ʻ]?lchamli|hajmli/i.test(rawQuery);
  if (!wants3d || lesson.engine !== 'svg2d') return lesson;
  const hasPrims = lesson.steps.some(
    (s) => s.render_params?.primitives_3d && s.render_params.primitives_3d.length > 0
  );
  if (!hasPrims) return lesson;

  return {
    ...lesson,
    engine: 'threejs',
    sliders: [
      ...(lesson.sliders || []),
      {
        id: 'scale',
        label: 'Model o‘lchami',
        min: 0.6,
        max: 1.6,
        step: 0.1,
        default: 1.0,
        unit: 'x',
      },
    ],
    steps: lesson.steps.map((s) => ({
      ...s,
      render_params: {
        ...s.render_params,
        shape: 'composite3d' as const,
      },
    })),
  };
}

/**
 * Matches user queries against the built-in curated CACHED_LESSONS database
 * BEFORE spending external network calls or Gemini AI tokens.
 */
export function findBuiltInCachedLesson(rawQuery: string): TutorLesson | null {
  const qTrim = String(rawQuery || '').trim();
  const norm = normalizeCacheSearchText(qTrim);
  if (!norm) return null;

  const compactRaw = qTrim.toLowerCase().replace(/\s+/g, '');

  // 1. Exact title, ID, or canonical equation match (always wins)
  for (const lesson of CACHED_LESSONS) {
    const titleNorm = normalizeCacheSearchText(lesson.topic_title);
    const idNorm = lesson.id ? normalizeCacheSearchText(lesson.id) : '';
    if (norm === titleNorm || (idNorm && norm === idNorm)) {
      return apply3DModeIfRequested({ ...lesson, source: 'cache' }, qTrim);
    }
    if (
      (lesson.keywords || []).some(
        (kw) => kw.toLowerCase().replace(/\s+/g, '') === compactRaw
      )
    ) {
      return apply3DModeIfRequested({ ...lesson, source: 'cache' }, qTrim);
    }
  }

  // Do not hijack custom math formulas/equations or parametric geometry dimensions
  if (/[=<>^*/+]/.test(qTrim)) return null;
  if (
    /\d/.test(qTrim) &&
    /\b(uchburchak|burchak|aylana|doira|konus|silindr|tsilindr|piramida|kub|sfera|tomoni|radiusi)\b/i.test(
      norm
    )
  ) {
    return null;
  }

  // Domain disambiguation guards
  const isSolarCell = /\bquyosh\b.*\bhujayra|\bbatareya\b/i.test(norm);
  const isOneSheetHyperboloid = /\bbir\s*pallali\b/i.test(norm);
  const isEllipticParaboloid = /\belliptik\s*paraboloid\b/i.test(norm);

  const tokens = norm.split(' ').filter(Boolean);
  const tokenStemSet = new Set<string>();
  for (const tok of tokens) {
    for (const s of stripUzSuffixForMatch(tok)) {
      tokenStemSet.add(s);
    }
  }

  let bestLesson: TutorLesson | null = null;
  let bestScore = 0;

  for (const lesson of CACHED_LESSONS) {
    if (lesson.id === 'biology-cell-structure' && isSolarCell) continue;
    if (lesson.id === 'two-sheet-hyperboloid-3d' && isOneSheetHyperboloid) continue;
    if (lesson.id === 'saddle-surface-3d' && isEllipticParaboloid) continue;

    const candidateTerms = new Set<string>([
      ...(lesson.keywords || []).map(normalizeCacheSearchText),
      ...((lesson.id ? EXTRA_LESSON_PHRASES[lesson.id] : []) || []).map(normalizeCacheSearchText),
    ]);

    let lessonScore = 0;
    for (const kw of candidateTerms) {
      if (!kw || GENERIC_IGNORE_KEYWORDS.has(kw)) continue;
      if (/[=<>^*/+]/.test(kw)) continue;

      if (norm === kw) {
        lessonScore = Math.max(lessonScore, 100 + kw.length);
      } else if (kw.includes(' ')) {
        // Multi-word phrase match with word-boundary safety
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`).test(norm)) {
          lessonScore = Math.max(lessonScore, 70 + kw.length);
        }
      } else if (tokenStemSet.has(kw)) {
        // Exact token or Uzbek-stemmed token match
        lessonScore = Math.max(lessonScore, 45 + kw.length);
      }
    }

    if (lessonScore > bestScore) {
      bestScore = lessonScore;
      bestLesson = lesson;
    }
  }

  if (bestLesson && bestScore >= 45) {
    return apply3DModeIfRequested({ ...bestLesson, source: 'cache' }, qTrim);
  }

  return null;
}
