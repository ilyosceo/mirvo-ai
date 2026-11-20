import type { Primitive3DItem } from '../types/tutor.js';

export interface ObjectIntent {
  raw: string;
  name_uz: string;
  name_en: string;
  known_in_dict: boolean;
  is_3d: boolean;
  is_explicit_draw: boolean;
  is_botanical: boolean;
}

const UZ_TO_EN_DICT: Record<string, string> = {
  // Botany & Plants
  daraxt: 'tree',
  archa: 'pine tree',
  palma: 'palm tree',
  eman: 'oak tree',
  terak: 'tree',
  chinor: 'tree',
  tol: 'willow tree',
  buta: 'bush',
  "o'simlik": 'plant',
  osimlik: 'plant',
  nihol: 'seedling',
  gul: 'flower',
  atirgul: 'rose',
  lola: 'tulip',
  kungaboqar: 'sunflower',
  moychechak: 'daisy',
  nilufar: 'lotus',
  chivinqopar: 'venus flytrap',
  venera: 'venus flytrap',
  barg: 'leaf',
  ildiz: 'roots',
  poya: 'plant stem',
  "o't": 'grass',
  maysa: 'grass',
  kaktus: 'cactus',
  "qo'ziqorin": 'mushroom',
  qoziqorin: 'mushroom',
  urug: 'seed',
  "urug'": 'seed',
  meva: 'fruit',
  olma: 'apple',
  nok: 'pear',
  banan: 'banana',
  uzum: 'grapes',
  gilos: 'cherries',
  tarvuz: 'watermelon',
  qulupnay: 'strawberry',
  limon: 'lemon',
  apelsin: 'orange',
  sabzi: 'carrot',
  pomidor: 'tomato',
  bodring: 'cucumber',
  kartoshka: 'potato',

  // Nature, Earth & Space
  quyosh: 'sun',
  oy: 'moon',
  yulduz: 'star',
  yer: 'earth',
  sayyora: 'planet',
  saturn: 'saturn',
  mars: 'planet mars',
  raketa: 'rocket',
  fazogir: 'astronaut',
  kema: 'ship',
  kosmik: 'spacecraft',
  teleskop: 'telescope',
  vulqon: 'volcano',
  "tog'": 'mountain',
  tog: 'mountain',
  tepalik: 'hill',
  daryo: 'river',
  okean: 'ocean',
  dengiz: 'sea wave',
  bulut: 'cloud',
  "yomg'ir": 'rain',
  yomgir: 'rain',
  qor: 'snowflake',
  chaqmoq: 'lightning',
  kamalak: 'rainbow',
  olov: 'fire',
  gulxan: 'campfire',
  shamol: 'wind',
  tosh: 'rock',
  olmos: 'diamond',
  kristall: 'crystal',

  // Biology & Human Anatomy
  yurak: 'heart',
  miya: 'brain',
  miyya: 'brain',
  "o'pka": 'lungs',
  opka: 'lungs',
  oshqozon: 'stomach',
  jigar: 'liver',
  buyrak: 'kidney',
  "ko'z": 'eye',
  koz: 'eye',
  quloq: 'ear',
  burun: 'nose',
  tish: 'tooth',
  suyak: 'bone',
  skelet: 'skeleton',
  bosh: 'skull',
  "qo'l": 'hand',
  hujayra: 'biological cell',
  yadro: 'cell nucleus',
  mitoxondriya: 'mitochondria',
  xloroplast: 'chloroplast',
  sitoplazma: 'cytoplasm',
  membrana: 'cell membrane',
  bakteriya: 'bacteria',
  mikrob: 'microbe',
  virus: 'virus',
  dnk: 'dna',
  mikroskop: 'microscope',

  // Animals
  qush: 'bird',
  burgut: 'eagle',
  boyqush: 'owl',
  kabutar: 'dove',
  "o'rdak": 'duck',
  tovuq: 'chicken',
  pingvin: 'penguin',
  baliq: 'fish',
  akula: 'shark',
  kit: 'whale',
  delfin: 'dolphin',
  sakkizoyoq: 'octopus',
  qisqichbaqa: 'crab',
  kapalak: 'butterfly',
  asalari: 'bee',
  ari: 'bee',
  chumoli: 'ant',
  "o'rgimchak": 'spider',
  mushuk: 'cat',
  it: 'dog',
  kuchuk: 'dog',
  ot: 'horse',
  sigir: 'cow',
  "qo'y": 'sheep',
  quyon: 'rabbit',
  tulki: 'fox',
  "bo'ri": 'wolf',
  ayiq: 'bear',
  sher: 'lion',
  qoplon: 'leopard',
  "yo'lbars": 'tiger',
  fil: 'elephant',
  jirafa: 'giraffe',
  maymun: 'monkey',
  toshbaqa: 'turtle',
  ilon: 'snake',
  qurbaqa: 'frog',
  dinozavr: 'dinosaur',

  // Architecture & Everyday Objects
  uy: 'house',
  maktab: 'school',
  bino: 'building',
  saroy: 'castle',
  "qal'a": 'castle',
  minora: 'tower',
  "ko'prik": 'bridge',
  koprik: 'bridge',
  chodir: 'tent',
  mashina: 'car',
  avtomobil: 'car',
  avtobus: 'bus',
  poyezd: 'train',
  metro: 'train',
  samolyot: 'airplane',
  vertolyot: 'helicopter',
  traktor: 'tractor',
  velosiped: 'bicycle',
  mototsikl: 'motorcycle',
  qayiq: 'boat',
  kitob: 'book',
  daftar: 'notebook',
  qalam: 'pencil',
  ruchka: 'pen',
  sumka: 'backpack',
  soat: 'clock',
  kompyuter: 'computer',
  noutbuk: 'laptop',
  telefon: 'smartphone',
  televizor: 'television',
  kamera: 'camera',
  robot: 'robot',
  gitara: 'guitar',
  pianino: 'piano',
  skripka: 'violin',
  lampochka: 'light bulb',
  lampa: 'lamp',
  chiroq: 'lamp',
  fonus: 'flashlight',
  transformator: 'transformer',
  dvigatel: 'engine',
  motor: 'engine',
  mator: 'engine',
  elektromotor: 'engine',
  elektromator: 'engine',
  kalit: 'key',
  qulf: 'lock',
  soyabon: 'umbrella',
  stul: 'chair',
  stol: 'table',
  koptok: 'soccer ball',
  "to'p": 'ball',
  kubok: 'trophy',
  medal: 'medal',
  bayroq: 'flag',
  toj: 'crown',
  kozoynak: 'glasses',
  "ko'zoynak": 'glasses',
  shlyapa: 'hat',
  oyoq: 'foot',
  etik: 'boot',
  piyola: 'cup',
  choynak: 'teapot',
  non: 'bread',
  tort: 'cake',

  // Physics, Electrical & Chemistry Lab Objects
  generator: 'electric generator',
  dinamo: 'electric generator',
  alternator: 'electric generator',
  turbina: 'turbine',
  turbin: 'turbine',
  nasos: 'water pump',
  kompressor: 'compressor',
  akkumulyator: 'battery',
  rezistor: 'resistor',
  kondensator: 'capacitor',
  tranzistor: 'transistor',
  diod: 'diode',
  svetodiod: 'light emitting diode',
  antenna: 'antenna',
  ventilyator: 'fan',
  parrak: 'propeller',
  tegirmon: 'wind turbine',
  panel: 'solar panel',
  lazer: 'laser',
  prizma: 'prism',
  radiator: 'radiator',
  mikrofon: 'microphone',
  dinamik: 'speaker',
  karnay: 'speaker',
  protsessor: 'microchip',
  mikrosxema: 'microchip',
  elektron: 'atom',
  magnit: 'magnet',
  batareya: 'battery',
  kompas: 'compass',
  termometr: 'thermometer',
  tarozi: 'balance scale',
  kolba: 'flask',
  probirka: 'test tube',
  atom: 'atom',
  linza: 'magnifying glass',
  lupa: 'magnifying glass',
  kema_yelkan: 'sailboat',
};

const STRIP_MODIFIERS = new Set([
  'katta',
  'kichik',
  'kichkina',
  'ulkan',
  'baland',
  'past',
  'uzun',
  'qisqa',
  'keng',
  'tor',
  'yashil',
  'qizil',
  "ko'k",
  'kok',
  'moviy',
  'sariq',
  'oq',
  'qora',
  'pushti',
  'binafsha',
  'jigarrang',
  'kulrang',
  'oltin',
  'kumush',
  'chiroyli',
  'gozal',
  "go'zal",
  'ajoyib',
  'oddiy',
  'sodda',
  'yangi',
  'eski',
  'qadimiy',
  'zamonaviy',
  'jonli',
  'bitta',
  'ikkita',
  'uchta',
  'bir',
  'yaxshi',
  'haqiqiy',
  'tabiiy',
  'eng',
  'vahshiy',
  'yirtqich',
  'mening',
  'menga',
  'bizga',
  'iltimos',
  '2d',
  '3d',
  'rasm',
  'rasmi',
  'rasmini',
  'chizma',
  'chizmasi',
  'chizmasini',
  'shakl',
  'shakli',
  'shaklini',
  'model',
  'modeli',
  'modelini',
  'sxema',
  'sxemasi',
  'tasvir',
  'tasviri',
  'haqida',
  'malumot',
  "ma'lumot",
  'uchun',
  'bilan',
  'va',
  'ham',
  'chiz',
  'chizib',
  'ber',
  'bering',
  'ayt',
  'aytib',
  "ko'rsat",
  "ko'rsatib",
  'korsat',
  'yasa',
  'yasab',
  'tasvirla',
  'tasvirlab',
  'chiqar',
  'chiqarib',
  'ol',
  'olib',
  'top',
  'topib',
  'qil',
  'qilib',
  // Conceptual/analytical words so queries like "Teleskopning ishlash printsipi" extract "teleskop" cleanly
  'ishlash',
  'ishlashi',
  'printsipi',
  'printsip',
  'printsiplari',
  'asoslari',
  'tuzilishi',
  'tuzilish',
  'mexanizmi',
  'qonuni',
  'jarayoni',
  'jarayon',
  'vazifasi',
  'qanday',
  'nima',
  // Separated Uzbek suffixes when user adds a space (e.g., "o'simlik lar")
  'lar',
  'lari',
  'lariga',
  'lardan',
  'larni',
  'ni',
  'ning',
  'ga',
  'da',
  'dan',
  'ta',
]);

// Words already handled by specialized math/3D geometry/chemistry engines
const SPECIALIZED_ENGINE_KEYWORDS =
  /\b(pifagor|pythagor|uchburchak|to['ʻ`]?g['ʻ`]?ri\s*burchak|kvadrat|aylana|doira|sektor|burchak|ko['ʻ`]?pburchak|piramida|konus|silindr|tsilindr|kub|sfera|shar|ellipsoid|giperboloid|paraboloid|vektor|parabola|giperbola|sinus|kosinus|tangens|hosila|integral|tenglama|funksiya|molekula|oqsil|insulin|kofein|aspirin|glyukoza|glukoza|metan|ammiak|benzol|etanol|sulfat|h2o|co2|ch4|nh3|c6h6|h2so4|pdb|fotosintez|osmon\s*moviy)\b/i;

const CYRILLIC_TO_LATIN_UZ: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'j',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'x',
  ц: 's',
  ч: 'ch',
  ш: 'sh',
  ъ: "'",
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ў: "o'",
  қ: 'q',
  ғ: "g'",
  ҳ: 'h',
};

export function normalizeUzToken(raw: string): string {
  const lowered = raw
    .toLowerCase()
    .replace(/[‘’`ʻʼʹ]/g, "'")
    .replace(/[òóôõöŏ]/g, "o'")
    .replace(/[ğĝ]/g, "g'")
    .replace(/[şš]/g, 'sh')
    .replace(/[çč]/g, 'ch')
    .replace(/o[']+/g, "o'")
    .replace(/g[']+/g, "g'");

  let transliterated = '';
  for (const ch of lowered) {
    transliterated += CYRILLIC_TO_LATIN_UZ[ch] ?? ch;
  }

  return transliterated
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripUzbekSuffix(word: string): string[] {
  const candidates = [word];
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
    if (word.length > sfx.length + 2 && word.endsWith(sfx)) {
      const stemmed = word.slice(0, -sfx.length);
      candidates.push(stemmed);
      // Also handle double-stemming like "daraxtlarni" -> "daraxtlar" -> "daraxt"
      if (stemmed.endsWith('lar') && stemmed.length > 5) {
        candidates.push(stemmed.slice(0, -3));
      }
    }
  }
  return Array.from(new Set(candidates));
}

export function extractObjectIntent(rawText: string): ObjectIntent {
  const raw = String(rawText || '').trim();
  const is_3d = /\b3\s*d\b|uch\s*o['‘’`ʻ]?lchamli|hajmli/i.test(raw);
  const is_explicit_draw =
    /\b(chiz|chizib|tasvirla|yasa|yasab|ko['‘’`ʻ]?rsat|rasm|chizma|model|3d|2d)\b/i.test(raw);

  const normalized = normalizeUzToken(raw);
  const tokens = normalized
    .split(/[\s-]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const meaningfulTokens = tokens.filter((t) => !STRIP_MODIFIERS.has(t));
  const candidatePool = meaningfulTokens.length > 0 ? meaningfulTokens : tokens;

  let matchedUz = '';
  let matchedEn = '';
  let known_in_dict = false;

  // Prefer checking exact dictionary hits (scanning from end to start because head noun in Uzbek is usually last!)
  for (let i = candidatePool.length - 1; i >= 0; i--) {
    const token = candidatePool[i];
    const stems = stripUzbekSuffix(token);
    for (const stem of stems) {
      if (UZ_TO_EN_DICT[stem]) {
        matchedUz = stem;
        matchedEn = UZ_TO_EN_DICT[stem];
        known_in_dict = true;
        break;
      }
    }
    if (known_in_dict) break;
  }

  if (!known_in_dict) {
    const lastToken = candidatePool[candidatePool.length - 1] || normalized;
    const stems = stripUzbekSuffix(lastToken);
    matchedUz = stems[stems.length - 1] || lastToken;
    matchedEn = matchedUz;
  }

  const is_botanical =
    /\b(tree|plant|flower|rose|tulip|sunflower|daisy|lotus|leaf|roots|seedling|grass|cactus|bush)\b/i.test(
      matchedEn
    );

  return {
    raw,
    name_uz: matchedUz || 'obyekt',
    name_en: matchedEn || matchedUz || 'object',
    known_in_dict,
    is_3d,
    is_explicit_draw,
    is_botanical,
  };
}

/**
 * Decides whether a user prompt in Qalam AI should immediately invoke the
 * 5-Step Smart Object Fallback & Auto-Cache pipeline instead of pure math/LLM director.
 */
export function shouldTreatAsObjectDrawing(rawQuery: string): boolean {
  const q = rawQuery.trim();
  if (!q || q.length > 85) return false;
  if (/[=<>^*/+]/.test(q)) return false; // mathematical formula/equation
  if (SPECIALIZED_ENGINE_KEYWORDS.test(q)) return false;

  // Conceptual/informational queries go to Gemini Director (which draws objects with full lesson context)
  // unless the user explicitly invokes a draw command ("chiz", "chizib ber", "2D chizma", "3D model").
  const normalizedForIntent = normalizeUzToken(q);
  const hasConceptualQuestion =
    /[?]/.test(q) ||
    /\b(qanday|nega|nimaga|nima|farqi|tarifi|ta'rifi|qayerda|qachon|kim|nechta|haqida|malumot|ma'lumot|tushuntir|aytib|xususiyat\w*|turlari|qismlari)\b/i.test(
      normalizedForIntent
    );
  const intent = extractObjectIntent(q);

  if (hasConceptualQuestion && !intent.is_explicit_draw) {
    return false;
  }

  if (intent.is_explicit_draw) return true;
  if (intent.known_in_dict) return true;

  return false;
}

export function sanitizeSvgString(
  rawSvg: string
): { svg_data: string; viewBox: string } | null {
  if (!rawSvg || typeof rawSvg !== 'string') return null;
  const svgMatch = rawSvg.match(/<svg[\s\S]*?<\/svg>/i);
  if (!svgMatch) return null;

  let cleaned = svgMatch[0]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(?:href|xlink:href)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '')
    .replace(/<image[^>]+>/gi, '')
    .replace(/\bcurrentColor\b/gi, '#1E293B');

  // Extract or synthesize viewBox
  const vbMatch = cleaned.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  let viewBox = vbMatch ? vbMatch[1].trim() : '';
  if (!viewBox) {
    const wMatch = cleaned.match(/\bwidth\s*=\s*["'](\d+(?:\.\d+)?)/i);
    const hMatch = cleaned.match(/\bheight\s*=\s*["'](\d+(?:\.\d+)?)/i);
    const w = wMatch ? Number(wMatch[1]) : 128;
    const h = hMatch ? Number(hMatch[1]) : 128;
    viewBox = `0 0 ${w > 0 ? w : 128} ${h > 0 ? h : 128}`;
    cleaned = cleaned.replace(/<svg\b/i, `<svg viewBox="${viewBox}"`);
  }

  // Ensure there is at least one geometric shape
  if (!/<(path|circle|rect|line|ellipse|polygon|polyline)\b/i.test(cleaned)) {
    return null;
  }

  return { svg_data: cleaned, viewBox };
}

export function generateProceduralObjectSvg(
  nameEn: string,
  nameUz: string
): {
  svg_data: string;
  viewBox: string;
  parts_uz: Array<{ label: string; partId?: string; desc?: string }>;
} | null {
  const key = nameEn.toLowerCase();

  if (key.includes('pine') || key === 'archa') {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path d="M 45 178 Q 100 172 155 178" fill="none" stroke="#854D0E" stroke-width="4" stroke-linecap="round"/>
  <rect x="90" y="138" width="20" height="40" rx="3" fill="#92400E" stroke="#78350F" stroke-width="3"/>
  <polygon points="100,20 55,78 145,78" fill="#22C55E" stroke="#15803D" stroke-width="3" stroke-linejoin="round"/>
  <polygon points="100,52 44,114 156,114" fill="#16A34A" stroke="#14532D" stroke-width="3" stroke-linejoin="round"/>
  <polygon points="100,82 34,146 166,146" fill="#15803D" stroke="#14532D" stroke-width="3" stroke-linejoin="round"/>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Tana', desc: "Yog'och poya suvni yuqoriga ko'taradi" },
        { label: 'Ignabarg shoxlar', desc: 'Qishda ham yashil qoladi' },
        { label: 'Uch qismi', desc: 'Quyosh nuriga qarab o‘sadi' },
      ],
    };
  }

  if (key.includes('palm')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path d="M 50 180 Q 100 172 150 180" fill="none" stroke="#A16207" stroke-width="4" stroke-linecap="round"/>
  <path d="M 96 178 Q 104 128 100 78" fill="none" stroke="#92400E" stroke-width="11" stroke-linecap="round"/>
  <path d="M 100 78 Q 62 56 36 80 Q 68 78 100 78 Z" fill="#22C55E" stroke="#15803D" stroke-width="2.5"/>
  <path d="M 100 78 Q 138 56 164 80 Q 132 78 100 78 Z" fill="#22C55E" stroke="#15803D" stroke-width="2.5"/>
  <path d="M 100 78 Q 64 36 48 44 Q 76 58 100 78 Z" fill="#4ADE80" stroke="#16A34A" stroke-width="2.5"/>
  <path d="M 100 78 Q 136 36 152 44 Q 124 58 100 78 Z" fill="#4ADE80" stroke="#16A34A" stroke-width="2.5"/>
  <path d="M 100 78 Q 100 32 100 24" fill="none" stroke="#16A34A" stroke-width="3" stroke-linecap="round"/>
  <circle cx="92" cy="86" r="6" fill="#78350F" stroke="#451A03" stroke-width="1.5"/>
  <circle cx="107" cy="88" r="6" fill="#78350F" stroke="#451A03" stroke-width="1.5"/>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Egiluvchan poya', desc: 'Shamolga chidamli tana' },
        { label: 'Yelpig‘ich barglar', desc: 'Katta palma yaproqlari' },
      ],
    };
  }

  if (key === 'tree' || key.includes('tree') || nameUz.includes('daraxt')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path d="M 38 176 Q 100 168 162 176" fill="none" stroke="#92400E" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M 96 174 Q 80 184 64 188" fill="none" stroke="#78350F" stroke-width="3" stroke-linecap="round"/>
  <path d="M 104 174 Q 120 184 136 188" fill="none" stroke="#78350F" stroke-width="3" stroke-linecap="round"/>
  <path d="M 92 174 L 94 110 L 106 110 L 108 174 Z" fill="#A16207" stroke="#78350F" stroke-width="2.8" stroke-linejoin="round"/>
  <path d="M 98 124 Q 76 108 66 94" fill="none" stroke="#78350F" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M 102 120 Q 124 104 134 92" fill="none" stroke="#78350F" stroke-width="4.5" stroke-linecap="round"/>
  <circle cx="70" cy="88" r="28" fill="#22C55E" stroke="#15803D" stroke-width="2.8"/>
  <circle cx="130" cy="88" r="28" fill="#16A34A" stroke="#15803D" stroke-width="2.8"/>
  <circle cx="100" cy="60" r="34" fill="#4ADE80" stroke="#15803D" stroke-width="3"/>
  <circle cx="84" cy="54" r="5" fill="#EF4444" stroke="#B91C1C" stroke-width="1.5"/>
  <circle cx="122" cy="78" r="5" fill="#EF4444" stroke="#B91C1C" stroke-width="1.5"/>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Ildizlar', desc: 'Tuproqdan suv va mineral tuzlarni shimadi' },
        { label: 'Tana va shoxlar', desc: 'Barglarni ushlab turadi va ozuqa tashiydi' },
        { label: 'Bargli toj', desc: 'Fotosintez orqali kislorod ishlab chiqaradi' },
      ],
    };
  }

  if (key === 'plant' || key === 'seedling' || nameUz.includes("o'simlik")) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <polygon points="68,142 132,142 122,182 78,182" fill="#D97706" stroke="#92400E" stroke-width="3" stroke-linejoin="round"/>
  <rect x="62" y="132" width="76" height="12" rx="4" fill="#F59E0B" stroke="#92400E" stroke-width="2.8"/>
  <path d="M 100 132 Q 98 94 100 54" fill="none" stroke="#15803D" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M 100 104 Q 62 94 56 68 Q 84 68 100 104 Z" fill="#22C55E" stroke="#15803D" stroke-width="2.8" stroke-linejoin="round"/>
  <path d="M 100 94 Q 138 84 144 58 Q 116 58 100 94 Z" fill="#4ADE80" stroke="#15803D" stroke-width="2.8" stroke-linejoin="round"/>
  <path d="M 100 62 Q 78 36 86 24 Q 106 34 100 62 Z" fill="#4ADE80" stroke="#15803D" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M 100 62 Q 122 36 114 24 Q 94 34 100 62 Z" fill="#22C55E" stroke="#15803D" stroke-width="2.6" stroke-linejoin="round"/>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Ildiz va tuproq', desc: 'Suv va ozuqa moddalar manbai' },
        { label: 'Poya', desc: "O'simlikning tayanch o'qi" },
        { label: 'Yashil barglar', desc: 'Yorug‘lik energiyasini qabul qiladi' },
      ],
    };
  }

  if (key === 'flower' || key === 'rose' || key === 'tulip' || key === 'sunflower') {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path d="M 100 182 Q 98 134 100 84" fill="none" stroke="#15803D" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M 100 144 Q 68 134 62 114 Q 88 116 100 144 Z" fill="#22C55E" stroke="#15803D" stroke-width="2.6"/>
  <path d="M 100 132 Q 132 122 138 102 Q 112 104 100 132 Z" fill="#4ADE80" stroke="#15803D" stroke-width="2.6"/>
  <circle cx="100" cy="46" r="18" fill="#FB7185" stroke="#E11D48" stroke-width="2.5"/>
  <circle cx="126" cy="64" r="18" fill="#FB7185" stroke="#E11D48" stroke-width="2.5"/>
  <circle cx="116" cy="92" r="18" fill="#FB7185" stroke="#E11D48" stroke-width="2.5"/>
  <circle cx="84" cy="92" r="18" fill="#FB7185" stroke="#E11D48" stroke-width="2.5"/>
  <circle cx="74" cy="64" r="18" fill="#FB7185" stroke="#E11D48" stroke-width="2.5"/>
  <circle cx="100" cy="70" r="16" fill="#FACC15" stroke="#CA8A04" stroke-width="2.8"/>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Gulkosa va gulbarglar', desc: 'Hasharotlarni jalb qiladi' },
        { label: 'Gul markazi', desc: 'Changchi va urug‘chi joylashgan' },
        { label: 'Poya va barg', desc: 'Ozuqa yetkazib beradi' },
      ],
    };
  }

  if (key === 'leaf') {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path d="M 42 158 Q 52 58 158 42 Q 142 148 42 158 Z" fill="#4ADE80" stroke="#15803D" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M 28 172 L 138 62" fill="none" stroke="#14532D" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M 68 132 L 66 96" fill="none" stroke="#15803D" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M 96 104 L 94 72" fill="none" stroke="#15803D" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M 80 120 L 118 122" fill="none" stroke="#15803D" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Barg yaprog‘i', desc: 'Yorug‘likni yutuvchi yuza' },
        { label: 'Barg tomirlari', desc: 'Suv va glyukozani tashiydi' },
      ],
    };
  }

  if (
    key.includes('flytrap') ||
    key.includes('carnivorous') ||
    nameUz.includes('chivinqopar') ||
    nameUz.includes('venera')
  ) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <polygon points="72,150 128,150 120,184 80,184" fill="#D97706" stroke="#92400E" stroke-width="2.8" stroke-linejoin="round"/>
  <rect x="66" y="142" width="68" height="10" rx="4" fill="#F59E0B" stroke="#92400E" stroke-width="2.5"/>
  <path d="M 100 142 Q 94 114 98 86" fill="none" stroke="#15803D" stroke-width="5" stroke-linecap="round"/>
  <path d="M 100 142 Q 70 122 52 104 Q 78 112 96 136 Z" fill="#22C55E" stroke="#15803D" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M 100 142 Q 130 124 148 106 Q 122 114 104 136 Z" fill="#16A34A" stroke="#15803D" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M 98 88 Q 52 72 48 40 Q 82 54 98 88 Z" fill="#22C55E" stroke="#14532D" stroke-width="2.8" stroke-linejoin="round"/>
  <path d="M 98 88 Q 144 72 148 40 Q 114 54 98 88 Z" fill="#4ADE80" stroke="#14532D" stroke-width="2.8" stroke-linejoin="round"/>
  <path d="M 96 82 Q 64 68 58 46 Q 82 58 96 82 Z" fill="#FB7185" stroke="#BE123C" stroke-width="1.8"/>
  <path d="M 100 82 Q 132 68 138 46 Q 114 58 100 82 Z" fill="#F43F5E" stroke="#BE123C" stroke-width="1.8"/>
  <line x1="50" y1="44" x2="40" y2="34" stroke="#14532D" stroke-width="2.4" stroke-linecap="round"/>
  <line x1="60" y1="50" x2="52" y2="38" stroke="#14532D" stroke-width="2.4" stroke-linecap="round"/>
  <line x1="72" y1="56" x2="66" y2="44" stroke="#14532D" stroke-width="2.4" stroke-linecap="round"/>
  <line x1="146" y1="44" x2="156" y2="34" stroke="#14532D" stroke-width="2.4" stroke-linecap="round"/>
  <line x1="136" y1="50" x2="144" y2="38" stroke="#14532D" stroke-width="2.4" stroke-linecap="round"/>
  <line x1="124" y1="56" x2="130" y2="44" stroke="#14532D" stroke-width="2.4" stroke-linecap="round"/>
  <line x1="76" y1="68" x2="72" y2="60" stroke="#9F1239" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="120" y1="68" x2="124" y2="60" stroke="#9F1239" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Qizil qopqon barg', desc: 'Shirin nektar bilan hasharotni jalb qiladi' },
        { label: 'Tishli chetlar', desc: '0.1 soniyada yopilib o‘ljani tutib qoladi' },
        { label: 'Sezgir tukchalar', desc: '20 soniyada 2 marta tegilganda ishga tushadi' },
      ],
    };
  }

  if (
    key.includes('biological cell') ||
    key === 'cell' ||
    key.includes('mitochondri') ||
    key.includes('nucleus') ||
    nameUz.includes('hujayra')
  ) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="membrane">
    <ellipse cx="100" cy="102" rx="78" ry="58" fill="#E0F2FE" stroke="#0284C7" stroke-width="4"/>
    <ellipse cx="100" cy="102" rx="71" ry="51" fill="#F0F9FF" stroke="#38BDF8" stroke-width="1.8"/>
  </g>
  <g data-part="3" data-part-id="cytoplasm">
    <path d="M 62 84 Q 50 100 62 118 Q 74 128 84 122" fill="none" stroke="#818CF8" stroke-width="3" stroke-linecap="round"/>
    <path d="M 54 90 Q 44 102 54 114" fill="none" stroke="#6366F1" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M 122 122 Q 134 116 144 124" fill="none" stroke="#10B981" stroke-width="3" stroke-linecap="round"/>
    <path d="M 120 130 Q 134 124 146 132" fill="none" stroke="#059669" stroke-width="2.8" stroke-linecap="round"/>
    <circle cx="130" cy="64" r="9" fill="#BAE6FD" stroke="#0284C7" stroke-width="2.2"/>
    <circle cx="62" cy="66" r="6" fill="#BAE6FD" stroke="#0284C7" stroke-width="2"/>
    <circle cx="148" cy="112" r="2.8" fill="#10B981"/>
    <circle cx="104" cy="138" r="2.8" fill="#10B981"/>
    <circle cx="82" cy="66" r="2.8" fill="#10B981"/>
  </g>
  <g data-part="1" data-part-id="nucleus">
    <circle cx="96" cy="100" r="24" fill="#DDD6FE" stroke="#6D28D9" stroke-width="3.2"/>
    <circle cx="96" cy="100" r="9" fill="#5B21B6" stroke="#4C1D95" stroke-width="2"/>
  </g>
  <g data-part="2" data-part-id="mitochondria">
    <ellipse cx="142" cy="84" rx="17" ry="9" transform="rotate(-24 142 84)" fill="#FDBA74" stroke="#C2410C" stroke-width="2.5"/>
    <path d="M 131 89 L 137 82 L 143 87 L 149 79 L 153 82" fill="none" stroke="#9A3412" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse cx="64" cy="134" rx="16" ry="8.5" transform="rotate(18 64 134)" fill="#FDBA74" stroke="#C2410C" stroke-width="2.5"/>
    <path d="M 52 131 L 59 136 L 65 130 L 71 137 L 76 134" fill="none" stroke="#9A3412" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Hujayra membranasi', partId: 'membrane', desc: 'Hujayrani himoyalaydi va moddalar almashinuvini boshqaradi' },
        { label: 'Yadro (DNK)', partId: 'nucleus', desc: 'Irsiy axborotni saqlaydi va hujayrani boshqaradi' },
        { label: 'Mitoxondriya', partId: 'mitochondria', desc: 'Hujayra uchun energiya (ATF) ishlab chiqaradi' },
        { label: 'Sitoplazma', partId: 'cytoplasm', desc: 'Organoidlar joylashgan ichki suyuq muhit' },
      ],
    };
  }

  if (key.includes('transformer') || nameUz.includes('transformator')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="core">
    <rect x="48" y="38" width="104" height="124" rx="7" fill="#CBD5E1" stroke="#334155" stroke-width="3.2"/>
    <rect x="74" y="64" width="52" height="72" rx="4" fill="#F8FAFC" stroke="#334155" stroke-width="2.8"/>
    <path d="M 62 52 H 138 V 148 H 62 Z" fill="none" stroke="#64748B" stroke-width="1.6" stroke-dasharray="5 4"/>
    <path d="M 96 47 L 106 52 L 96 57" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 104 143 L 94 148 L 104 153" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <g data-part="1" data-part-id="coil_1">
    <path d="M 38 66 H 18 M 38 134 H 18" fill="none" stroke="#B45309" stroke-width="3" stroke-linecap="round"/>
    <circle cx="16" cy="66" r="4.5" fill="#FBBF24" stroke="#92400E" stroke-width="2"/>
    <circle cx="16" cy="134" r="4.5" fill="#FBBF24" stroke="#92400E" stroke-width="2"/>
    <rect x="38" y="60" width="42" height="14" rx="7" fill="#FBBF24" stroke="#92400E" stroke-width="2.4"/>
    <rect x="38" y="78" width="42" height="14" rx="7" fill="#FBBF24" stroke="#92400E" stroke-width="2.4"/>
    <rect x="38" y="96" width="42" height="14" rx="7" fill="#FBBF24" stroke="#92400E" stroke-width="2.4"/>
    <rect x="38" y="114" width="42" height="14" rx="7" fill="#FBBF24" stroke="#92400E" stroke-width="2.4"/>
    <rect x="38" y="132" width="42" height="12" rx="6" fill="#F59E0B" stroke="#92400E" stroke-width="2.4"/>
  </g>
  <g data-part="2" data-part-id="coil_2">
    <path d="M 162 74 H 182 M 162 126 H 182" fill="none" stroke="#1E40AF" stroke-width="3" stroke-linecap="round"/>
    <circle cx="184" cy="74" r="4.5" fill="#60A5FA" stroke="#1E40AF" stroke-width="2"/>
    <circle cx="184" cy="126" r="4.5" fill="#60A5FA" stroke="#1E40AF" stroke-width="2"/>
    <rect x="120" y="68" width="42" height="16" rx="8" fill="#60A5FA" stroke="#1E40AF" stroke-width="2.4"/>
    <rect x="120" y="92" width="42" height="16" rx="8" fill="#60A5FA" stroke="#1E40AF" stroke-width="2.4"/>
    <rect x="120" y="116" width="42" height="16" rx="8" fill="#60A5FA" stroke="#1E40AF" stroke-width="2.4"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Temir o‘zak', partId: 'core', desc: 'Magnit oqimini birlamchidan ikkilamchiga yo‘naltiradi' },
        { label: 'Birlamchi chulg‘am (N₁)', partId: 'coil_1', desc: 'Kirish kuchlanishini qabul qilib o‘zgaruvchan magnit maydon yaratadi' },
        { label: 'Ikkilamchi chulg‘am (N₂)', partId: 'coil_2', desc: 'Elektromagnit induksiya orqali chiqish kuchlanishini hosil qiladi' },
      ],
    };
  }

  if (key.includes('light bulb') || key === 'lamp' || nameUz.includes('lamp')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="bulb">
    <path d="M 100 24 C 66 24 46 50 46 78 C 46 102 64 114 74 134 H 126 C 136 114 154 102 154 78 C 154 50 134 24 100 24 Z" fill="#FEF9C3" stroke="#CA8A04" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M 64 62 Q 66 42 84 36" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
    <line x1="100" y1="8" x2="100" y2="16" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
    <line x1="42" y1="36" x2="50" y2="44" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
    <line x1="158" y1="36" x2="150" y2="44" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
  </g>
  <g data-part="1" data-part-id="filament">
    <path d="M 86 134 L 84 86 L 91 74 L 97 86 L 103 74 L 109 86 L 116 74 L 114 134" fill="none" stroke="#EA580C" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="100" cy="78" r="14" fill="rgba(249, 115, 22, 0.2)" stroke="#F97316" stroke-width="1.4" stroke-dasharray="3 3"/>
  </g>
  <g data-part="2" data-part-id="base">
    <rect x="74" y="134" width="52" height="10" rx="3" fill="#CBD5E1" stroke="#334155" stroke-width="2.5"/>
    <rect x="76" y="144" width="48" height="10" rx="3" fill="#94A3B8" stroke="#334155" stroke-width="2.5"/>
    <rect x="78" y="154" width="44" height="10" rx="3" fill="#CBD5E1" stroke="#334155" stroke-width="2.5"/>
    <path d="M 86 164 L 100 178 L 114 164 Z" fill="#475569" stroke="#1E293B" stroke-width="2.4" stroke-linejoin="round"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Shisha kolba', partId: 'bulb', desc: 'Vakuum yoki inert gazni ushlab turuvchi tashqi shisha qobiq' },
        { label: 'Volfram tolasi', partId: 'filament', desc: 'Elektr toki o‘tganda qizib yorug‘lik chiqaradigan spiral ip' },
        { label: 'Metall tsokol', partId: 'base', desc: 'Lampani elektr zanjiriga ulovchi vintli kontakt qismi' },
      ],
    };
  }

  if (key === 'heart' || nameUz.includes('yurak')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="aorta">
    <path d="M 92 66 V 34 Q 92 18 112 22 Q 128 26 128 46 V 62" fill="none" stroke="#DC2626" stroke-width="11" stroke-linecap="round"/>
    <path d="M 72 64 V 38" fill="none" stroke="#2563EB" stroke-width="9" stroke-linecap="round"/>
    <path d="M 104 54 L 138 42" fill="none" stroke="#3B82F6" stroke-width="7" stroke-linecap="round"/>
  </g>
  <g data-part="1" data-part-id="atria">
    <ellipse cx="72" cy="84" rx="26" ry="22" fill="#93C5FD" stroke="#1D4ED8" stroke-width="3"/>
    <ellipse cx="126" cy="84" rx="26" ry="22" fill="#FCA5A5" stroke="#B91C1C" stroke-width="3"/>
  </g>
  <g data-part="2" data-part-id="ventricles">
    <path d="M 48 92 C 44 134 72 162 102 178 C 134 160 156 132 150 92 Z" fill="#EF4444" stroke="#991B1B" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M 98 92 Q 99 136 102 175" fill="none" stroke="#7F1D1D" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M 49 94 C 46 132 72 158 99 174 L 97 94 Z" fill="#60A5FA" stroke="#1E40AF" stroke-width="2.5" opacity="0.88"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Aorta va tomirlar', partId: 'aorta', desc: 'Qonni yurakdan butun tanaga va o‘pkaga olib chiqadi' },
        { label: 'Yurak bo‘lmachalari', partId: 'atria', desc: 'Venalardan kelayotgan qonni qabul qiluvchi yuqori kameralar' },
        { label: 'Yurak qorinchalari', partId: 'ventricles', desc: 'Qonni katta bosim bilan tomirlarga haydovchi mushak qismi' },
      ],
    };
  }

  if (key.includes('engine') || nameUz.includes('dvigatel') || nameUz.includes('motor') || nameUz.includes('mator')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="cylinder">
    <rect x="64" y="54" width="72" height="82" rx="6" fill="#E2E8F0" stroke="#334155" stroke-width="3.2"/>
    <rect x="72" y="84" width="56" height="28" rx="4" fill="#94A3B8" stroke="#1E293B" stroke-width="2.6"/>
    <line x1="72" y1="92" x2="128" y2="92" stroke="#475569" stroke-width="2"/>
  </g>
  <g data-part="1" data-part-id="spark">
    <rect x="92" y="22" width="16" height="32" rx="3" fill="#CBD5E1" stroke="#334155" stroke-width="2.5"/>
    <polygon points="100,56 90,72 98,72 95,82 110,66 102,66" fill="#F97316" stroke="#C2410C" stroke-width="1.8" stroke-linejoin="round"/>
  </g>
  <g data-part="2" data-part-id="crankshaft">
    <line x1="100" y1="112" x2="114" y2="152" stroke="#475569" stroke-width="7" stroke-linecap="round"/>
    <circle cx="100" cy="156" r="24" fill="#CBD5E1" stroke="#334155" stroke-width="3"/>
    <circle cx="100" cy="156" r="9" fill="#0F172A"/>
    <circle cx="114" cy="152" r="6" fill="#2563EB" stroke="#1E40AF" stroke-width="2"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Silindr va porshen', partId: 'cylinder', desc: 'Gaz kengayishi natijasida yuqori-pastga harakatlanadi' },
        { label: 'Sham va yonish kamerasi', partId: 'spark', desc: 'Yoqilg‘i-havo aralashmasini uchqun bilan yoqadi' },
        { label: 'Shatun va tirsakli val', partId: 'crankshaft', desc: 'Porshen harakatini aylanma harakatga aylantiradi' },
      ],
    };
  }

  if (
    key.includes('generator') ||
    key.includes('alternator') ||
    key.includes('dynamo') ||
    nameUz.includes('generator') ||
    nameUz.includes('dinamo')
  ) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="stator">
    <path d="M 32 54 H 66 V 146 H 32 C 20 146 16 134 16 100 C 16 66 20 54 32 54 Z" fill="#FCA5A5" stroke="#DC2626" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 168 54 H 134 V 146 H 168 C 180 146 184 134 184 100 C 184 66 180 54 168 54 Z" fill="#93C5FD" stroke="#2563EB" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 68 74 H 132 M 68 100 H 132 M 68 126 H 132" fill="none" stroke="#64748B" stroke-width="1.6" stroke-dasharray="4 4"/>
    <path d="M 122 69 L 130 74 L 122 79" fill="none" stroke="#64748B" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M 122 121 L 130 126 L 122 131" fill="none" stroke="#64748B" stroke-width="1.8" stroke-linecap="round"/>
  </g>
  <g data-part="1" data-part-id="rotor">
    <rect x="74" y="64" width="52" height="72" rx="6" fill="none" stroke="#D97706" stroke-width="4.5" stroke-linejoin="round"/>
    <rect x="82" y="72" width="36" height="56" rx="4" fill="#FEF3C7" stroke="#F59E0B" stroke-width="2.4" stroke-linejoin="round"/>
    <line x1="100" y1="36" x2="100" y2="162" stroke="#475569" stroke-width="4" stroke-linecap="round"/>
    <path d="M 84 42 C 94 34 108 34 116 42" fill="none" stroke="#059669" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M 111 37 L 117 43 L 109 45" fill="none" stroke="#059669" stroke-width="2.2" stroke-linecap="round"/>
  </g>
  <g data-part="2" data-part-id="brushes">
    <circle cx="100" cy="148" r="7" fill="#FBBF24" stroke="#92400E" stroke-width="2.2"/>
    <circle cx="100" cy="162" r="7" fill="#F59E0B" stroke="#92400E" stroke-width="2.2"/>
    <rect x="78" y="144" width="12" height="9" rx="2" fill="#334155"/>
    <rect x="110" y="157" width="12" height="9" rx="2" fill="#334155"/>
    <path d="M 78 148 H 50 V 180 H 150 V 162 H 122" fill="none" stroke="#2563EB" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="100" cy="180" r="10" fill="#FEF08A" stroke="#CA8A04" stroke-width="2.4"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Stator magnit qutblari (N/S)', partId: 'stator', desc: 'Doimiy yoki elektromagnit maydon hosil qiladi' },
        { label: 'Aylanuvchi rotor chulg‘ami', partId: 'rotor', desc: 'Magnit maydon chiziqlarini kesib o‘tib EYuK induksiyalaydi' },
        { label: 'Halqalar va tashqi zanjir', partId: 'brushes', desc: 'Hosil bo‘lgan elektr tokini iste’molchiga uzatadi' },
      ],
    };
  }

  return null;
}

export function generateZeroTokenFallbackSvg(nameUz: string, nameEn: string): {
  svg_data: string;
  viewBox: string;
  parts_uz: Array<{ label: string; partId?: string; desc?: string }>;
} {
  const safeLabel = (nameUz || nameEn || 'Obyekt').slice(0, 26).replace(/[<>&"']/g, '');
  const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="detail_center">
    <circle cx="100" cy="100" r="64" fill="#EFF6FF" stroke="#2563EB" stroke-width="3.2"/>
    <circle cx="100" cy="100" r="42" fill="#FFFFFF" stroke="#60A5FA" stroke-width="2.2" stroke-dasharray="6 4"/>
    <circle cx="100" cy="100" r="16" fill="#FBBF24" stroke="#B45309" stroke-width="2.6"/>
  </g>
  <g data-part="1" data-part-id="detail_left">
    <path d="M 24 100 H 58" fill="none" stroke="#1D4ED8" stroke-width="3" stroke-linecap="round"/>
    <circle cx="24" cy="100" r="6" fill="#93C5FD" stroke="#1D4ED8" stroke-width="2.2"/>
    <path d="M 100 24 V 58" fill="none" stroke="#059669" stroke-width="3" stroke-linecap="round"/>
    <circle cx="100" cy="24" r="6" fill="#6EE7B7" stroke="#059669" stroke-width="2.2"/>
  </g>
  <g data-part="2" data-part-id="detail_right">
    <path d="M 142 100 H 176" fill="none" stroke="#1D4ED8" stroke-width="3" stroke-linecap="round"/>
    <circle cx="176" cy="100" r="6" fill="#93C5FD" stroke="#1D4ED8" stroke-width="2.2"/>
    <path d="M 100 142 V 176" fill="none" stroke="#059669" stroke-width="3" stroke-linecap="round"/>
    <circle cx="100" cy="176" r="6" fill="#6EE7B7" stroke="#059669" stroke-width="2.2"/>
  </g>
  <text x="100" y="192" text-anchor="middle" font-size="11" font-weight="600" fill="#1E293B">${safeLabel}</text>
</svg>`;
  return {
    svg_data,
    viewBox: '0 0 200 200',
    parts_uz: [
      { label: 'Asosiy yadro va qobiq', partId: 'detail_center', desc: 'Tizimning markaziy ishchi qismi' },
      { label: 'Kirish oqimi va ta’siri', partId: 'detail_left', desc: 'Energiya yoki modda kirish yo‘nalishi' },
      { label: 'Chiqish natijasi', partId: 'detail_right', desc: 'Tashqi tizim bilan bog‘lanish qismi' },
    ],
  };
}

export function generateProceduralPrimitives3D(nameEn: string): Primitive3DItem[] | undefined {
  const key = nameEn.toLowerCase();

  if (key.includes('pine')) {
    return [
      { type: 'cylinder', position: [0, 0.9, 0], args: [0.35, 0.48, 1.8, 16], color: '#854d0e', label: 'Tana', partId: 'part_0' },
      { type: 'cone', position: [0, 2.3, 0], args: [1.9, 2.1, 20], color: '#15803d', label: 'Quyi shoxlar', partId: 'part_1' },
      { type: 'cone', position: [0, 3.4, 0], args: [1.45, 1.8, 20], color: '#16a34a', partId: 'part_1' },
      { type: 'cone', position: [0, 4.4, 0], args: [0.95, 1.5, 20], color: '#22c55e', label: 'Uch qismi', partId: 'part_2' },
    ];
  }

  if (key === 'tree' || key.includes('tree')) {
    return [
      { type: 'cylinder', position: [0, 1.2, 0], args: [0.36, 0.55, 2.4, 18], color: '#78350f', label: 'Tana', partId: 'part_0' },
      { type: 'cylinder', position: [-0.65, 2.2, 0], rotation: [0, 0, 0.65], args: [0.14, 0.22, 1.3, 12], color: '#78350f', partId: 'part_1' },
      { type: 'cylinder', position: [0.65, 2.25, 0.1], rotation: [0.1, 0, -0.6], args: [0.14, 0.22, 1.3, 12], color: '#78350f', partId: 'part_1' },
      { type: 'sphere', position: [0, 3.3, 0], args: [1.45, 24, 24], color: '#22c55e', label: 'Bargli toj', partId: 'part_2' },
      { type: 'sphere', position: [-1.05, 2.8, 0.25], args: [1.05, 20, 20], color: '#16a34a', partId: 'part_2' },
      { type: 'sphere', position: [1.05, 2.85, -0.2], args: [1.05, 20, 20], color: '#15803d', partId: 'part_2' },
      { type: 'sphere', position: [0, 2.9, 0.95], args: [0.95, 20, 20], color: '#4ade80', partId: 'part_2' },
      { type: 'sphere', position: [-0.5, 3.5, 0.85], args: [0.18, 12, 12], color: '#ef4444', partId: 'part_2' },
      { type: 'sphere', position: [0.6, 3.1, 0.9], args: [0.18, 12, 12], color: '#ef4444', partId: 'part_2' },
    ];
  }

  if (key.includes('flytrap') || key.includes('carnivorous')) {
    return [
      { type: 'cylinder', position: [0, 0.55, 0], args: [0.95, 0.72, 1.1, 24], color: '#d97706', label: 'Tuvak', partId: 'part_0' },
      { type: 'cylinder', position: [0, 1.08, 0], args: [1.02, 0.98, 0.18, 24], color: '#f59e0b', partId: 'part_0' },
      { type: 'cylinder', position: [0, 1.75, 0], args: [0.1, 0.14, 1.35, 12], color: '#15803d', label: 'Poya', partId: 'part_1' },
      { type: 'box', position: [-0.45, 2.55, 0], rotation: [0, 0, 0.52], args: [1.15, 0.14, 1.25], color: '#22c55e', label: 'Chap qopqon', partId: 'part_2' },
      { type: 'box', position: [0.45, 2.55, 0], rotation: [0, 0, -0.52], args: [1.15, 0.14, 1.25], color: '#16a34a', label: 'O‘ng qopqon', partId: 'part_2' },
      { type: 'box', position: [-0.36, 2.6, 0], rotation: [0, 0, 0.52], args: [0.82, 0.06, 0.95], color: '#f43f5e', label: 'Nektar hududi', partId: 'part_2' },
      { type: 'box', position: [0.36, 2.6, 0], rotation: [0, 0, -0.52], args: [0.82, 0.06, 0.95], color: '#fb7185', partId: 'part_2' },
      { type: 'sphere', position: [-0.85, 1.55, 0.25], args: [0.42, 14, 12], color: '#22c55e', partId: 'part_1' },
      { type: 'sphere', position: [0.85, 1.6, -0.2], args: [0.42, 14, 12], color: '#4ade80', partId: 'part_1' },
    ];
  }

  if (key === 'plant' || key === 'seedling' || key === 'flower') {
    return [
      { type: 'cylinder', position: [0, 0.6, 0], args: [0.95, 0.7, 1.2, 24], color: '#d97706', label: 'Tuvak', partId: 'part_0' },
      { type: 'cylinder', position: [0, 1.18, 0], args: [1.04, 1.0, 0.2, 24], color: '#f59e0b', partId: 'part_0' },
      { type: 'cylinder', position: [0, 2.3, 0], args: [0.1, 0.14, 2.2, 12], color: '#15803d', label: 'Poya', partId: 'part_1' },
      { type: 'sphere', position: [-0.75, 2.3, 0], rotation: [0, 0, 0.4], args: [0.55, 16, 12], color: '#22c55e', label: 'Barg', partId: 'part_2' },
      { type: 'sphere', position: [0.75, 2.6, 0], rotation: [0, 0, -0.4], args: [0.55, 16, 12], color: '#4ade80', partId: 'part_2' },
      ...(key === 'flower'
        ? [
            {
              type: 'sphere' as const,
              position: [0, 3.55, 0] as [number, number, number],
              args: [0.45, 18, 18],
              color: '#facc15',
              label: 'Gul',
              partId: 'part_2',
            },
            {
              type: 'torus' as const,
              position: [0, 3.55, 0] as [number, number, number],
              rotation: [Math.PI / 2, 0, 0] as [number, number, number],
              args: [0.65, 0.25, 12, 24],
              color: '#fb7185',
              partId: 'part_2',
            },
          ]
        : [
            {
              type: 'sphere' as const,
              position: [0, 3.45, 0] as [number, number, number],
              args: [0.5, 18, 18],
              color: '#4ade80',
              label: 'Yaproqlar',
              partId: 'part_2',
            },
          ]),
    ];
  }

  if (key === 'house' || key === 'school') {
    return [
      { type: 'box', position: [0, 1.1, 0], args: [2.8, 2.2, 2.4], color: '#f8fafc', label: 'Devorlar', partId: 'part_0' },
      { type: 'cone', position: [0, 2.9, 0], rotation: [0, Math.PI / 4, 0], args: [2.35, 1.4, 4], color: '#ef4444', label: 'Tom', partId: 'part_1' },
      { type: 'box', position: [0, 0.65, 1.22], args: [0.65, 1.3, 0.08], color: '#92400e', label: 'Eshik', partId: 'part_2' },
      { type: 'box', position: [-0.85, 1.25, 1.22], args: [0.55, 0.55, 0.08], color: '#38bdf8', partId: 'part_2' },
      { type: 'box', position: [0.85, 1.25, 1.22], args: [0.55, 0.55, 0.08], color: '#38bdf8', partId: 'part_2' },
    ];
  }

  if (key === 'rocket' || key === 'spacecraft') {
    return [
      { type: 'cylinder', position: [0, 2.0, 0], args: [0.65, 0.72, 2.4, 24], color: '#f8fafc', label: 'Korpus', partId: 'part_0' },
      { type: 'cone', position: [0, 3.85, 0], args: [0.66, 1.3, 24], color: '#ef4444', label: 'Burun qismi', partId: 'part_1' },
      { type: 'sphere', position: [0, 2.3, 0.56], args: [0.24, 16, 16], color: '#38bdf8', label: 'Illyuminator', partId: 'part_0' },
      { type: 'box', position: [-0.78, 0.95, 0], rotation: [0, 0, 0.25], args: [0.45, 0.9, 0.12], color: '#2563eb', partId: 'part_2' },
      { type: 'box', position: [0.78, 0.95, 0], rotation: [0, 0, -0.25], args: [0.45, 0.9, 0.12], color: '#2563eb', partId: 'part_2' },
      { type: 'cone', position: [0, 0.4, 0], rotation: [Math.PI, 0, 0], args: [0.42, 0.9, 16], color: '#f97316', label: 'Reaktiv alanga', partId: 'part_2' },
    ];
  }

  if (
    key.includes('biological cell') ||
    key === 'cell' ||
    key.includes('mitochondri') ||
    key.includes('nucleus')
  ) {
    return [
      { type: 'cylinder', position: [0, 0.35, 0], args: [2.25, 2.35, 0.42, 32], color: '#bae6fd', opacity: 0.72, label: 'Sitoplazma', partId: 'cytoplasm' },
      { type: 'torus', position: [0, 0.52, 0], rotation: [Math.PI / 2, 0, 0], args: [2.28, 0.16, 16, 40], color: '#0284c7', label: 'Hujayra membranasi', partId: 'membrane' },
      { type: 'sphere', position: [0, 0.98, 0], args: [0.74, 24, 24], color: '#7c3aed', opacity: 0.88, label: 'Yadro (DNK)', partId: 'nucleus' },
      { type: 'sphere', position: [0, 0.98, 0], args: [0.28, 16, 16], color: '#4c1d95', partId: 'nucleus' },
      { type: 'cylinder', position: [-1.18, 0.72, 0.55], rotation: [0, 0.45, Math.PI / 2], args: [0.24, 0.24, 0.76, 16], color: '#f97316', label: 'Mitoxondriya', partId: 'mitochondria' },
      { type: 'cylinder', position: [1.18, 0.72, -0.55], rotation: [0, -0.45, Math.PI / 2], args: [0.22, 0.22, 0.7, 16], color: '#ea580c', partId: 'mitochondria' },
      { type: 'sphere', position: [0.95, 0.68, 0.88], args: [0.36, 16, 16], color: '#38bdf8', opacity: 0.78, label: 'Vakuola', partId: 'cytoplasm' },
      { type: 'sphere', position: [-0.8, 0.68, -0.95], args: [0.16, 12, 12], color: '#10b981', partId: 'cytoplasm' },
      { type: 'sphere', position: [0.45, 0.65, -1.2], args: [0.14, 12, 12], color: '#10b981', partId: 'cytoplasm' },
    ];
  }

  if (key.includes('transformer')) {
    return [
      { type: 'box', position: [0, 2.7, 0], args: [2.8, 0.52, 0.8], color: '#94a3b8', label: 'Temir o‘zak', partId: 'core' },
      { type: 'box', position: [0, 0.5, 0], args: [2.8, 0.52, 0.8], color: '#94a3b8', partId: 'core' },
      { type: 'box', position: [-1.15, 1.6, 0], args: [0.52, 2.2, 0.8], color: '#64748b', partId: 'core' },
      { type: 'box', position: [1.15, 1.6, 0], args: [0.52, 2.2, 0.8], color: '#64748b', partId: 'core' },
      { type: 'torus', position: [-1.15, 2.05, 0], rotation: [Math.PI / 2, 0, 0], args: [0.56, 0.14, 12, 24], color: '#f59e0b', label: 'Birlamchi chulg‘am (N₁)', partId: 'coil_1' },
      { type: 'torus', position: [-1.15, 1.65, 0], rotation: [Math.PI / 2, 0, 0], args: [0.56, 0.14, 12, 24], color: '#fbbf24', partId: 'coil_1' },
      { type: 'torus', position: [-1.15, 1.25, 0], rotation: [Math.PI / 2, 0, 0], args: [0.56, 0.14, 12, 24], color: '#f59e0b', partId: 'coil_1' },
      { type: 'torus', position: [1.15, 1.9, 0], rotation: [Math.PI / 2, 0, 0], args: [0.56, 0.16, 12, 24], color: '#3b82f6', label: 'Ikkilamchi chulg‘am (N₂)', partId: 'coil_2' },
      { type: 'torus', position: [1.15, 1.4, 0], rotation: [Math.PI / 2, 0, 0], args: [0.56, 0.16, 12, 24], color: '#60a5fa', partId: 'coil_2' },
    ];
  }

  if (key.includes('light bulb') || key === 'lamp') {
    return [
      { type: 'sphere', position: [0, 2.75, 0], args: [1.22, 28, 28], color: '#fef08a', opacity: 0.48, label: 'Shisha kolba', partId: 'bulb' },
      { type: 'torus', position: [0, 2.75, 0], rotation: [0, 0, 0], args: [0.35, 0.08, 12, 24], color: '#f97316', label: 'Volfram tolasi', partId: 'filament' },
      { type: 'cylinder', position: [-0.22, 2.1, 0], args: [0.04, 0.04, 1.2, 10], color: '#94a3b8', partId: 'filament' },
      { type: 'cylinder', position: [0.22, 2.1, 0], args: [0.04, 0.04, 1.2, 10], color: '#94a3b8', partId: 'filament' },
      { type: 'cylinder', position: [0, 1.1, 0], args: [0.55, 0.48, 0.9, 24], color: '#94a3b8', label: 'Metall tsokol', partId: 'base' },
      { type: 'cone', position: [0, 0.5, 0], rotation: [Math.PI, 0, 0], args: [0.36, 0.38, 16], color: '#475569', partId: 'base' },
    ];
  }

  if (key === 'heart') {
    return [
      { type: 'cylinder', position: [0.2, 3.2, 0], rotation: [0, 0, -0.35], args: [0.28, 0.32, 1.3, 18], color: '#dc2626', label: 'Aorta', partId: 'aorta' },
      { type: 'cylinder', position: [-0.45, 3.1, 0.15], rotation: [0, 0, 0.25], args: [0.22, 0.25, 1.1, 16], color: '#2563eb', partId: 'aorta' },
      { type: 'sphere', position: [-0.6, 2.25, 0], args: [0.65, 20, 20], color: '#60a5fa', label: 'Bo‘lmachalar', partId: 'atria' },
      { type: 'sphere', position: [0.6, 2.25, 0], args: [0.65, 20, 20], color: '#f87171', partId: 'atria' },
      { type: 'cone', position: [0, 1.15, 0], rotation: [Math.PI, 0, 0], args: [1.2, 1.9, 24], color: '#ef4444', label: 'Qorinchalar', partId: 'ventricles' },
    ];
  }

  if (key.includes('engine')) {
    return [
      { type: 'cylinder', position: [0, 2.2, 0], args: [1.0, 1.0, 1.9, 24], color: '#cbd5e1', opacity: 0.42, label: 'Silindr', partId: 'cylinder' },
      { type: 'cylinder', position: [0, 1.9, 0], args: [0.82, 0.82, 0.72, 24], color: '#64748b', label: 'Porshen', partId: 'cylinder' },
      { type: 'cylinder', position: [0, 3.45, 0], args: [0.22, 0.22, 0.65, 16], color: '#94a3b8', label: 'Sham', partId: 'spark' },
      { type: 'sphere', position: [0, 2.8, 0], args: [0.35, 16, 16], color: '#f97316', partId: 'spark' },
      { type: 'cylinder', position: [0, 0.65, 0], rotation: [Math.PI / 2, 0, 0], args: [0.62, 0.62, 0.55, 24], color: '#334155', label: 'Tirsakli val', partId: 'crankshaft' },
      { type: 'cylinder', position: [0.15, 1.25, 0], rotation: [0, 0, -0.2], args: [0.14, 0.14, 1.1, 12], color: '#475569', partId: 'crankshaft' },
    ];
  }

  if (key.includes('generator') || key.includes('alternator') || key.includes('dynamo')) {
    return [
      { type: 'box', position: [-1.45, 1.8, 0], args: [0.7, 2.1, 1.4], color: '#ef4444', label: 'N qutb (Stator)', partId: 'stator' },
      { type: 'box', position: [1.45, 1.8, 0], args: [0.7, 2.1, 1.4], color: '#3b82f6', label: 'S qutb (Stator)', partId: 'stator' },
      { type: 'box', position: [0, 1.8, 0], args: [1.25, 1.45, 0.22], color: '#f59e0b', label: 'Rotor chulg‘ami', partId: 'rotor' },
      { type: 'cylinder', position: [0, 1.8, 0], rotation: [Math.PI / 2, 0, 0], args: [0.12, 0.12, 2.8, 16], color: '#475569', partId: 'rotor' },
      { type: 'torus', position: [0, 1.8, 1.05], args: [0.32, 0.08, 12, 24], color: '#fbbf24', label: 'Sirpanish halqasi', partId: 'brushes' },
      { type: 'torus', position: [0, 1.8, 1.32], args: [0.32, 0.08, 12, 24], color: '#d97706', partId: 'brushes' },
    ];
  }

  return undefined;
}
