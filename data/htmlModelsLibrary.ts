export interface SavedHtmlModelEntry {
  id: string;
  titleUz: string;
  subtitleUz: string;
  category: 'Fizika' | 'Energetika' | 'Texnika' | 'Kimyo' | 'Biologiya';
  publicPath: string;
  keywords: string[];
}

export interface GeneratedHtmlCacheItem {
  key: string;
  topicTitle: string;
  html: string;
  model: string;
  createdAt: string;
  tokens?: {
    prompt_tokens: number;
    cached_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
  };
}

/**
 * Curated Gold-Standard Standalone Interactive HTML Models.
 * Drop any new verified HTML into public/models/<name>.html and add an entry here.
 */
export const HTML_MODELS_LIBRARY: readonly SavedHtmlModelEntry[] = [
  {
    id: 'microwave-oven',
    titleUz: 'Mikroto‘lqinli pech qanday ishlaydi?',
    subtitleUz: 'Magnetron, to‘lqin o‘tkazgich, 2.45 GGs to‘lqinlar va Faraday to‘ri',
    category: 'Texnika',
    publicPath: '/models/microwave.html',
    keywords: [
      'mikrotolqin',
      'microtolqin',
      'micro tolqin',
      'mikro tolqin',
      'mikrotolqinli pech',
      'micro tolqinli pech',
      'microwave',
      'mikrovolnovka',
      'magnetron',
      'svch',
    ],
  },
  {
    id: 'gaes-120',
    titleUz: 'GAES · Gidroakkumulyatsion elektr stansiyasi',
    subtitleUz: 'Yuqori va quyi havza, Frensis nasos-turbinasi, klapan va quvvat o‘lchagich',
    category: 'Energetika',
    publicPath: '/models/gaes-120.html',
    keywords: [
      'gaes',
      'gidroakkumulyator',
      'gidroakkumulyatsion',
      'gidrostansiya',
      'gidro elektr stansiya',
      'gidroelektr',
      'ges',
      'pumped hydro',
      'frensis turbinasi',
    ],
  },
];

export function normalizeHtmlTopicQuery(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .replace(/[‘’'`ʻʼ]/g, '')
    .replace(/o['’`ʻʼ]/g, 'o')
    .replace(/g['’`ʻʼ]/g, 'g')
    .replace(/[^a-z0-9а-яё\s]/gi, ' ')
    .replace(/\b(nima|qanday|ishlaydi|haqida|tuzilishi|qismlari|bu|degani|tushuntir|chizib|ber)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanTopicTitleUz(raw: string): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/\s+(nima|bu nima|degani nima)\??$/i, '')
    .replace(/\?+$/, '')
    .trim();
  if (!cleaned) return 'Interaktiv 3D / Izometrik Dars';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function findCuratedHtmlModel(query: string): SavedHtmlModelEntry | null {
  const rawLower = (query || '')
    .toLowerCase()
    .replace(/[‘’'`ʻʼ]/g, '')
    .replace(/[^a-z0-9а-яё\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const norm = normalizeHtmlTopicQuery(query);
  if (!rawLower && !norm) return null;

  for (const item of HTML_MODELS_LIBRARY) {
    for (const kw of item.keywords) {
      if (rawLower.includes(kw) || norm.includes(kw)) {
        return item;
      }
    }
  }
  return null;
}

const GENERATED_HTML_STORAGE_KEY = 'mirvo_generated_html_models_v1';

export function loadGeneratedHtmlCache(): GeneratedHtmlCacheItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GENERATED_HTML_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function findGeneratedHtmlCache(query: string): GeneratedHtmlCacheItem | null {
  const key = normalizeHtmlTopicQuery(query);
  if (!key) return null;
  const list = loadGeneratedHtmlCache();
  return list.find((item) => item.key === key) || null;
}

export function saveGeneratedHtmlCache(entry: GeneratedHtmlCacheItem): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadGeneratedHtmlCache().filter((item) => item.key !== entry.key);
    // Keep up to 12 rich standalone HTML lessons cleanly within localStorage quota
    const next = [entry, ...current].slice(0, 12);
    window.localStorage.setItem(GENERATED_HTML_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // If localStorage is full, evict oldest entries and retry once
    try {
      const current = loadGeneratedHtmlCache().slice(0, 4);
      window.localStorage.setItem(
        GENERATED_HTML_STORAGE_KEY,
        JSON.stringify([entry, ...current])
      );
    } catch {
      // ignore
    }
  }
}
