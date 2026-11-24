import type { Primitive3DItem } from '../types/tutor.js';
import { buildSineWaveD, buildSmoothCurveD } from './roughDiagramHelper.js';

export interface ObjectIntent {
  raw: string;
  name_uz: string;
  name_en: string;
  known_in_dict: boolean;
  is_3d: boolean;
  is_explicit_draw: boolean;
  is_botanical: boolean;
}

const COMPOUND_UZ_PHRASES: Array<{ re: RegExp; uz: string; en: string }> = [
  { re: /gidravlik\s*press/i, uz: 'gidravlik press', en: 'hydraulic press' },
  { re: /suv\s*nasos\w*/i, uz: 'suv nasosi', en: 'water pump' },
  { re: /quyosh\s*tizim\w*/i, uz: 'quyosh tizimi', en: 'solar system' },
  { re: /elektr\s*zanjir\w*/i, uz: 'elektr zanjiri', en: 'electric circuit' },
  { re: /shamol\s*turbina\w*/i, uz: 'shamol turbinasi', en: 'wind turbine' },
  { re: /quyosh\s*panel\w*/i, uz: 'quyosh paneli', en: 'solar panel' },
  { re: /ichki\s*yonuv\s*dvigatel\w*/i, uz: 'ichki yonuv dvigateli', en: 'engine' },
  { re: /elektr\s*dvigatel\w*|asinxron\s*dvigatel\w*|elektromotor\w*/i, uz: 'elektr dvigatel', en: 'electric motor' },
  { re: /elektr\s*generator\w*|sinxron\s*generator\w*|turbogenerator\w*/i, uz: 'elektr generatori', en: 'electric generator' },
  { re: /\bgaes\b|gidro\s*akkumulyator\w*(?:\s+elektr)?(?:\s+stansiya\w*)?/i, uz: 'gidroakkumulyator elektr stansiyasi (GAES)', en: 'hydro turbine' },
  { re: /gidroturbina\w*|gidro\s*turbina\w*|gidroelektr\s*stansiya\w*|\bges\b/i, uz: 'gidroturbina', en: 'hydro turbine' },
  { re: /bug['`‘’]?\s*turbina\w*|issiqlik\s*elektr\s*stansiya\w*|\bies\b/i, uz: "bug' turbinasi", en: 'steam turbine' },
  { re: /atom\s*elektr\s*stansiya\w*|yadro\s*reaktor\w*|\baes\b/i, uz: 'yadro reaktori', en: 'steam turbine' },
  { re: /quyosh\s*elektr\s*stansiya\w*|\bqes\b/i, uz: 'quyosh elektr stansiyasi', en: 'solar panel' },
  { re: /shamol\s*elektr\s*stansiya\w*|\bshes\b/i, uz: 'shamol elektr stansiyasi', en: 'wind turbine' },
  { re: /tebranish\s*kontur\w*|rlc\s*zanjir\w*/i, uz: 'tebranish konturi', en: 'rlc circuit' },
  { re: /elektromagnit\s*maydon\w*|induktiv\s*g['`‘’]?altak\w*|solenoid\w*/i, uz: 'solenoid', en: 'solenoid' },
  { re: /optik\s*prizma\w*/i, uz: 'optik prizma', en: 'prism' },
  { re: /karno\s*sikl\w*|issiqlik\s*dvigatel\w*/i, uz: 'issiqlik dvigateli', en: 'engine' },
  { re: /inson\s*yurag\w*/i, uz: 'yurak', en: 'heart' },
  { re: /inson\s*ko['`]?z\w*/i, uz: "ko'z", en: 'eye' },
  { re: /inson\s*miya\w*/i, uz: 'miya', en: 'brain' },
  { re: /dnk\s*spiral\w*/i, uz: 'dnk', en: 'dna' },
];

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
  zanjir: 'electric circuit',
  press: 'hydraulic press',
  gidravlik: 'hydraulic press',
  kompas: 'compass',
  termometr: 'thermometer',
  tarozi: 'balance scale',
  kolba: 'flask',
  probirka: 'test tube',
  atom: 'atom',
  linza: 'magnifying glass',
  lupa: 'magnifying glass',
  kema_yelkan: 'sailboat',
  // Power & Energy Engineering Specialization
  gidroturbina: 'hydro turbine',
  gidroakkumulyator: 'hydro turbine',
  gaes: 'hydro turbine',
  ges: 'hydro turbine',
  ies: 'steam turbine',
  aes: 'steam turbine',
  qes: 'solar panel',
  shes: 'wind turbine',
  elektrstansiya: 'steam turbine',
  kuchlanish: 'transformer',
  inverter: 'solar panel',
  solenoid: 'solenoid',
  elektromagnit: 'solenoid',
  "g'altak": 'solenoid',
  galtak: 'solenoid',
  reostat: 'resistor',
  podstansiya: 'transformer',
  nimstansiya: 'transformer',
  rele: 'electric circuit',
  turbogenerator: 'electric generator',
  stator: 'electric motor',
  rotor: 'electric motor',
  induktor: 'solenoid',
  kollektor: 'electric motor',
  "cho'tka": 'electric generator',
  chotka: 'electric generator',
  "yarimo'tkazgich": 'diode',
  yarimotkazgich: 'diode',
  fotoelement: 'solar panel',
  mayatnik: 'pendulum',
  prujina: 'spring',
  richag: 'lever',
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

  for (const phrase of COMPOUND_UZ_PHRASES) {
    if (phrase.re.test(normalized)) {
      matchedUz = phrase.uz;
      matchedEn = phrase.en;
      known_in_dict = true;
      break;
    }
  }

  // Prefer checking exact dictionary hits (scanning from end to start because head noun in Uzbek is usually last!)
  if (!known_in_dict) {
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
        { label: 'Temir o‘zak', partId: 'core', desc: 'Ichida yopiq magnit oqimi impulslari halqa bo‘ylab birlamchidan ikkilamchiga aylanib o‘tadi' },
        { label: 'Birlamchi chulg‘am (N₁)', partId: 'coil_1', desc: 'Mis o‘ramlari ichida o‘zgaruvchan elektronlar tebranib, magnit maydon qo‘zg‘atadi' },
        { label: 'Ikkilamchi chulg‘am (N₂)', partId: 'coil_2', desc: 'Magnit oqimi o‘zgarishi chulg‘am ichida induksion tokni harakatga keltiradi' },
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

  if (key.includes('electric motor') || nameUz.includes('elektr dvigatel') || nameUz.includes('elektromotor')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="stator">
    <rect x="28" y="42" width="144" height="112" rx="18" fill="#E2E8F0" stroke="#334155" stroke-width="3.2"/>
    <path d="M 38 66 H 68 V 130 H 38 Z" fill="#EF4444" stroke="#991B1B" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M 132 66 H 162 V 130 H 132 Z" fill="#3B82F6" stroke="#1E40AF" stroke-width="2.4" stroke-linejoin="round"/>
    <text x="53" y="103" text-anchor="middle" font-size="13" font-weight="800" fill="#FFFFFF">N</text>
    <text x="147" y="103" text-anchor="middle" font-size="13" font-weight="800" fill="#FFFFFF">S</text>
    <line x1="56" y1="30" x2="144" y2="30" stroke="#64748B" stroke-width="3.2" stroke-linecap="round"/>
    <line x1="72" y1="22" x2="128" y2="22" stroke="#64748B" stroke-width="3" stroke-linecap="round"/>
  </g>
  <g data-part="1" data-part-id="rotor">
    <circle cx="100" cy="98" r="28" fill="#FDE68A" stroke="#D97706" stroke-width="3"/>
    <g data-animate="spin">
      <circle cx="100" cy="98" r="24" fill="none" stroke="none"/>
      <line x1="100" y1="74" x2="100" y2="122" stroke="#B45309" stroke-width="4" stroke-linecap="round"/>
      <line x1="76" y1="98" x2="124" y2="98" stroke="#B45309" stroke-width="4" stroke-linecap="round"/>
      <circle cx="100" cy="98" r="8" fill="#334155" stroke="#0F172A" stroke-width="2"/>
    </g>
    <line x1="100" y1="98" x2="184" y2="98" stroke="#475569" stroke-width="6" stroke-linecap="round"/>
  </g>
  <g data-part="2" data-part-id="commutator">
    <rect x="64" y="154" width="72" height="22" rx="6" fill="#1E293B" stroke="#0F172A" stroke-width="2.2"/>
    <path d="M 80 154 V 136 M 120 154 V 136" stroke="#F59E0B" stroke-width="3.2" stroke-linecap="round"/>
    <circle cx="80" cy="165" r="4" fill="#22C55E"/>
    <circle cx="120" cy="165" r="4" fill="#EF4444"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Stator va magnit qutblar (N/S)', partId: 'stator', desc: 'Ichki bo‘shliqda N dan S ga doimiy magnit kuch chiziqlari oqimini hosil qiladi' },
        { label: 'Aylanuvchi rotor va val', partId: 'rotor', desc: 'O‘ramlari ichidan tok o‘tganda Amper kuchi ta’sirida o‘q atrofida aylanadi' },
        { label: 'Klemma qutisi va cho‘tkalar', partId: 'commutator', desc: 'Kollektor halqalari bo‘ylab sirpanib rotor chulg‘amiga elektron oqimini uzatadi' },
      ],
    };
  }

  if (key.includes('engine') || nameUz.includes('dvigatel') || nameUz.includes('motor')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="cylinder">
    <rect x="64" y="54" width="72" height="82" rx="6" fill="#E2E8F0" stroke="#334155" stroke-width="3.2"/>
    <g data-animate="bob">
      <rect x="72" y="84" width="56" height="28" rx="4" fill="#94A3B8" stroke="#1E293B" stroke-width="2.6"/>
      <line x1="72" y1="92" x2="128" y2="92" stroke="#475569" stroke-width="2"/>
    </g>
  </g>
  <g data-part="1" data-part-id="spark">
    <rect x="92" y="22" width="16" height="32" rx="3" fill="#CBD5E1" stroke="#334155" stroke-width="2.5"/>
    <g data-animate="pulse">
      <polygon points="100,56 90,72 98,72 95,82 110,66 102,66" fill="#F97316" stroke="#C2410C" stroke-width="1.8" stroke-linejoin="round"/>
    </g>
  </g>
  <g data-part="2" data-part-id="crankshaft">
    <line x1="100" y1="112" x2="114" y2="152" stroke="#475569" stroke-width="7" stroke-linecap="round"/>
    <g data-animate="spin">
      <circle cx="100" cy="156" r="24" fill="#CBD5E1" stroke="#334155" stroke-width="3"/>
      <circle cx="100" cy="156" r="9" fill="#0F172A"/>
      <circle cx="114" cy="152" r="6" fill="#2563EB" stroke="#1E40AF" stroke-width="2"/>
    </g>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Silindr va porshen', partId: 'cylinder', desc: 'Qizigan gaz kengayishi natijasida porshen silindr ichida yuqori-pastga tebranadi' },
        { label: 'Sham va yonish kamerasi', partId: 'spark', desc: 'Ichida yoqilg‘i-havo aralashmasi uchqundan portlab bosim to‘lqini yaratadi' },
        { label: 'Shatun va tirsakli val', partId: 'crankshaft', desc: 'Porshenning ilgarilanma harakatini tirsakli valning aylanma harakatiga o‘tkazadi' },
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
    <g data-animate="pulse">
      <path d="M 68 74 H 132 M 68 100 H 132 M 68 126 H 132" fill="none" stroke="#64748B" stroke-width="1.8" stroke-dasharray="4 4"/>
      <path d="M 122 69 L 130 74 L 122 79" fill="none" stroke="#64748B" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M 122 121 L 130 126 L 122 131" fill="none" stroke="#64748B" stroke-width="1.8" stroke-linecap="round"/>
    </g>
  </g>
  <g data-part="1" data-part-id="rotor">
    <g data-animate="pulse">
      <rect x="74" y="64" width="52" height="72" rx="6" fill="none" stroke="#D97706" stroke-width="4.5" stroke-linejoin="round"/>
      <rect x="82" y="72" width="36" height="56" rx="4" fill="#FEF3C7" stroke="#F59E0B" stroke-width="2.4" stroke-linejoin="round"/>
    </g>
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
        { label: 'Stator magnit qutblari (N/S)', partId: 'stator', desc: 'Ichki havo tirqishida N qutbdan S qutbga o‘tuvchi magnit oqimini yaratadi' },
        { label: 'Aylanuvchi rotor chulg‘ami', partId: 'rotor', desc: 'Magnit maydon ichida aylanib, simlarida elektronlarni 50 Hz chastotada tebrantiradi' },
        { label: 'Halqalar va tashqi zanjir', partId: 'brushes', desc: 'Sirpanuvchi cho‘tkalar orqali induksion tokni tashqi tarmoqqa chiqaradi' },
      ],
    };
  }

  if (
    key.includes('hydraulic') ||
    key.includes('press') ||
    nameUz.includes('gidravlik')
  ) {
    const fluidPath = buildSmoothCurveD(
      [
        [52, 134],
        [52, 162],
        [100, 166],
        [146, 162],
        [146, 128],
      ],
      false
    );
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="piston_small">
    <rect x="34" y="70" width="36" height="66" rx="4" fill="#E2E8F0" stroke="#334155" stroke-width="2.8"/>
    <rect x="40" y="54" width="24" height="34" rx="4" fill="#F59E0B" stroke="#B45309" stroke-width="2.4"/>
    <line x1="52" y1="22" x2="52" y2="54" stroke="#475569" stroke-width="6" stroke-linecap="round"/>
    <path d="M 52 16 L 52 38 M 45 31 L 52 39 L 59 31" fill="none" stroke="#EA580C" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <g data-part="1" data-part-id="hydraulic_fluid">
    <path d="M 36 102 V 164 Q 36 174 48 174 H 152 Q 168 174 168 162 V 102 H 122 V 148 H 70 V 102 Z" fill="#BAE6FD" stroke="#0284C7" stroke-width="2.8" stroke-linejoin="round"/>
    <path d="${fluidPath}" fill="none" stroke="#0369A1" stroke-width="2.4" stroke-dasharray="5 4"/>
  </g>
  <g data-part="2" data-part-id="piston_large">
    <rect x="118" y="64" width="54" height="72" rx="4" fill="#F1F5F9" stroke="#334155" stroke-width="2.8"/>
    <rect x="122" y="72" width="46" height="26" rx="4" fill="#2563EB" stroke="#1E40AF" stroke-width="2.4"/>
    <rect x="128" y="34" width="34" height="20" rx="4" fill="#CBD5E1" stroke="#334155" stroke-width="2.4"/>
    <line x1="145" y1="54" x2="145" y2="72" stroke="#1E40AF" stroke-width="8" stroke-linecap="round"/>
    <path d="M 145 48 L 145 20 M 137 28 L 145 19 L 153 28" fill="none" stroke="#10B981" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Kichik porshen (F₁, S₁)', partId: 'piston_small', desc: 'Pastga bosilganda ichki moy ustunini siqib bosim impulsini yuboradi' },
        { label: 'Gidravlik suyuqlik (P)', partId: 'hydraulic_fluid', desc: 'Quvur ichida siqilmas moy zarrachalari bosimni har nuqtaga bir xil oqimda uzatadi' },
        { label: 'Katta porshen (F₂, S₂)', partId: 'piston_large', desc: 'Pastdan ta’sir etgan suyuqlik bosimi katta porshenni S₂/S₁ karra kuch bilan ko‘taradi' },
      ],
    };
  }

  if (key.includes('water pump') || key.includes('pump') || nameUz.includes('nasos')) {
    const swirlPath = buildSmoothCurveD(
      [
        [72, 118],
        [94, 84],
        [124, 96],
        [114, 130],
      ],
      false
    );
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="intake">
    <rect x="18" y="96" width="52" height="32" rx="4" fill="#93C5FD" stroke="#1D4ED8" stroke-width="2.8"/>
    <path d="M 24 112 H 60 M 52 106 L 61 112 L 52 118" fill="none" stroke="#1E3A8A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <g data-part="1" data-part-id="impeller">
    <circle cx="102" cy="112" r="46" fill="#E0F2FE" stroke="#0F172A" stroke-width="3.2"/>
    <path d="${swirlPath}" fill="none" stroke="#0284C7" stroke-width="2.2" stroke-dasharray="4 3"/>
    <g data-animate="spin">
      <circle cx="102" cy="112" r="34" fill="none" stroke="none"/>
      <circle cx="102" cy="112" r="14" fill="#F59E0B" stroke="#92400E" stroke-width="2.6"/>
      <path d="M 102 98 Q 118 82 132 92 M 116 112 Q 132 128 122 142 M 102 126 Q 86 142 72 132 M 88 112 Q 72 96 82 82" fill="none" stroke="#B45309" stroke-width="4.2" stroke-linecap="round"/>
    </g>
  </g>
  <g data-part="2" data-part-id="outlet">
    <rect x="118" y="28" width="32" height="58" rx="4" fill="#60A5FA" stroke="#1D4ED8" stroke-width="2.8"/>
    <path d="M 134 74 V 34 M 127 42 L 134 33 L 141 42" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Kirish quvuri (so‘rish)', partId: 'intake', desc: 'Quvur ichida suv oqimi vakuum hisobiga g‘ildirak markaziga tortiladi' },
        { label: 'Parra g‘ildirak (impeller)', partId: 'impeller', desc: 'Kurakchalar tez aylanib, suvni markazdan chetga haydab bosimini oshiradi' },
        { label: 'Chiqish quvuri (bosim)', partId: 'outlet', desc: 'Yuqori bosimli suv oqimi quvur bo‘ylab tepaga ko‘tariladi' },
      ],
    };
  }

  if (key.includes('dna') || nameUz.includes('dnk')) {
    const strandA = buildSineWaveD({ x0: 30, x1: 170, centerY: 100, amplitude: 32, cycles: 1.75, phaseRad: 0 });
    const strandB = buildSineWaveD({ x0: 30, x1: 170, centerY: 100, amplitude: 32, cycles: 1.75, phaseRad: Math.PI });
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="1" data-part-id="base_pairs">
    <line x1="48" y1="74" x2="48" y2="126" stroke="#10B981" stroke-width="4" stroke-linecap="round"/>
    <line x1="72" y1="72" x2="72" y2="128" stroke="#F59E0B" stroke-width="4" stroke-linecap="round"/>
    <line x1="100" y1="74" x2="100" y2="126" stroke="#EF4444" stroke-width="4" stroke-linecap="round"/>
    <line x1="128" y1="72" x2="128" y2="128" stroke="#8B5CF6" stroke-width="4" stroke-linecap="round"/>
    <line x1="152" y1="74" x2="152" y2="126" stroke="#10B981" stroke-width="4" stroke-linecap="round"/>
  </g>
  <g data-part="0" data-part-id="backbone">
    <path d="${strandA}" fill="none" stroke="#2563EB" stroke-width="6.5" stroke-linecap="round"/>
    <path d="${strandB}" fill="none" stroke="#EC4899" stroke-width="6.5" stroke-linecap="round"/>
  </g>
  <g data-part="2" data-part-id="helix_groove">
    <circle cx="48" cy="70" r="5" fill="#1D4ED8"/>
    <circle cx="100" cy="130" r="5" fill="#BE185D"/>
    <circle cx="152" cy="70" r="5" fill="#1D4ED8"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Shakar-fosfat zanjiri', partId: 'backbone', desc: 'Qo‘sh spiralning tashqi tayanch karkasi' },
        { label: 'Azot asoslari (A-T, G-C)', partId: 'base_pairs', desc: 'Komplementar juftlar genetik kodni saqlaydi' },
        { label: 'Spiral bog‘lamlar', partId: 'helix_groove', desc: 'Vodorod bog‘lari spiral barqarorligini ta’minlaydi' },
      ],
    };
  }

  if (key.includes('microscope') || nameUz.includes('mikroskop')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="eyepiece">
    <rect x="78" y="18" width="24" height="22" rx="4" fill="#334155" stroke="#0F172A" stroke-width="2.4"/>
    <rect x="74" y="38" width="32" height="54" rx="5" fill="#CBD5E1" stroke="#334155" stroke-width="2.8"/>
    <path d="M 106 54 C 148 54 156 122 134 156" fill="none" stroke="#475569" stroke-width="11" stroke-linecap="round"/>
  </g>
  <g data-part="1" data-part-id="objective">
    <rect x="70" y="92" width="40" height="12" rx="3" fill="#64748B" stroke="#1E293B" stroke-width="2.2"/>
    <rect x="76" y="104" width="12" height="20" rx="2" fill="#3B82F6" stroke="#1E40AF" stroke-width="2"/>
    <rect x="92" y="104" width="12" height="16" rx="2" fill="#F59E0B" stroke="#B45309" stroke-width="2"/>
  </g>
  <g data-part="2" data-part-id="stage">
    <rect x="52" y="132" width="76" height="10" rx="3" fill="#1E293B"/>
    <ellipse cx="90" cy="154" rx="14" ry="6" fill="#FEF08A" stroke="#CA8A04" stroke-width="2"/>
    <rect x="44" y="168" width="112" height="16" rx="6" fill="#334155" stroke="#0F172A" stroke-width="2.6"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Okulyar va tubus', partId: 'eyepiece', desc: 'Ko‘zga eng yaqin kattalashtiruvchi linza' },
        { label: 'Obyektiv linzalar', partId: 'objective', desc: 'Namuna tasvirini 4x–100x kattalashtiradi' },
        { label: 'Buyum stolchasi va yoritgich', partId: 'stage', desc: 'Namuna joylashtiriladigan va yoritiladigan sathi' },
      ],
    };
  }

  if (key.includes('telescope') || nameUz.includes('teleskop')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="primary_lens">
    <polygon points="34,54 88,68 80,96 26,82" fill="#3B82F6" stroke="#1D4ED8" stroke-width="2.8" stroke-linejoin="round"/>
    <ellipse cx="30" cy="68" rx="7" ry="15" transform="rotate(16 30 68)" fill="#BAE6FD" stroke="#0284C7" stroke-width="2.2"/>
  </g>
  <g data-part="1" data-part-id="tube_body">
    <polygon points="88,68 152,86 146,108 80,96" fill="#E2E8F0" stroke="#334155" stroke-width="2.8" stroke-linejoin="round"/>
    <line x1="100" y1="100" x2="62" y2="178" stroke="#475569" stroke-width="5" stroke-linecap="round"/>
    <line x1="100" y1="100" x2="100" y2="180" stroke="#64748B" stroke-width="5" stroke-linecap="round"/>
    <line x1="100" y1="100" x2="138" y2="178" stroke="#475569" stroke-width="5" stroke-linecap="round"/>
    <circle cx="100" cy="100" r="9" fill="#F59E0B" stroke="#B45309" stroke-width="2.2"/>
  </g>
  <g data-part="2" data-part-id="eyepiece">
    <rect x="148" y="88" width="24" height="14" rx="3" transform="rotate(16 148 88)" fill="#1E293B"/>
    <circle cx="174" cy="101" r="5" fill="#FDE047" stroke="#CA8A04" stroke-width="1.8"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Obyektiv linza', partId: 'primary_lens', desc: 'Yulduzlardan kelgan yorug‘likni yig‘adi' },
        { label: 'Optik truba va shtativ', partId: 'tube_body', desc: 'Tasvirni fokuslab barqaror ushlab turadi' },
        { label: 'Okulyar', partId: 'eyepiece', desc: 'Fokuslangan tasvirni kuzatish imkonini beradi' },
      ],
    };
  }

  if (key === 'eye' || nameUz.includes("ko'z")) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="cornea_lens">
    <circle cx="96" cy="100" r="58" fill="#F8FAFC" stroke="#334155" stroke-width="3.2"/>
    <path d="M 46 66 Q 24 100 46 134" fill="#E0F2FE" stroke="#0284C7" stroke-width="3.4"/>
    <ellipse cx="58" cy="100" rx="10" ry="24" fill="#93C5FD" stroke="#1D4ED8" stroke-width="2.4"/>
    <circle cx="48" cy="100" r="8" fill="#0F172A"/>
  </g>
  <g data-part="1" data-part-id="retina">
    <path d="M 74 48 A 54 54 0 0 1 150 100 A 54 54 0 0 1 74 152" fill="none" stroke="#F59E0B" stroke-width="6" stroke-linecap="round"/>
    <line x1="48" y1="90" x2="146" y2="100" stroke="#EF4444" stroke-width="1.8" stroke-dasharray="4 3"/>
    <line x1="48" y1="110" x2="146" y2="100" stroke="#EF4444" stroke-width="1.8" stroke-dasharray="4 3"/>
  </g>
  <g data-part="2" data-part-id="optic_nerve">
    <path d="M 150 92 H 184 M 150 108 H 184" stroke="#EA580C" stroke-width="6" stroke-linecap="round"/>
    <rect x="150" y="92" width="34" height="16" fill="#FDBA74" opacity="0.75"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Shox parda va gavhar', partId: 'cornea_lens', desc: 'Yorug‘lik nurlarini sindirib fokuslaydi' },
        { label: 'To‘r parda (Retina)', partId: 'retina', desc: 'Teskari tasvirni nerv signallariga aylantiradi' },
        { label: 'Ko‘rish nervi', partId: 'optic_nerve', desc: 'Signallarni bosh miyaga uzatadi' },
      ],
    };
  }

  if (key === 'brain' || nameUz.includes('miya')) {
    const foldA = buildSmoothCurveD([[52, 86], [70, 72], [92, 84], [116, 70], [138, 86]], false);
    const foldB = buildSmoothCurveD([[60, 108], [84, 96], [108, 110], [134, 98]], false);
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="cerebrum">
    <path d="M 42 108 C 32 72 60 36 102 38 C 146 38 168 68 160 106 C 154 128 134 134 106 130 C 78 134 50 128 42 108 Z" fill="#FBCFE8" stroke="#DB2777" stroke-width="3.2"/>
    <path d="${foldA}" fill="none" stroke="#BE185D" stroke-width="2.8" stroke-linecap="round"/>
    <path d="${foldB}" fill="none" stroke="#BE185D" stroke-width="2.8" stroke-linecap="round"/>
  </g>
  <g data-part="1" data-part-id="cerebellum">
    <ellipse cx="132" cy="138" rx="26" ry="18" fill="#DDD6FE" stroke="#7C3AED" stroke-width="2.8"/>
    <line x1="112" y1="138" x2="152" y2="138" stroke="#6D28D9" stroke-width="2"/>
  </g>
  <g data-part="2" data-part-id="brainstem">
    <path d="M 96 130 L 100 176 H 116 L 114 130 Z" fill="#FDE68A" stroke="#D97706" stroke-width="2.6" stroke-linejoin="round"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Katta yarim sharlar', partId: 'cerebrum', desc: 'Fikrlash, xotira va sezgi markazi' },
        { label: 'Miyacha', partId: 'cerebellum', desc: 'Muvozanat va harakatlarni muvofiqlashtiradi' },
        { label: 'Miya ustuni', partId: 'brainstem', desc: 'Nafas olish va yurak urishini boshqaradi' },
      ],
    };
  }

  if (key.includes('solar system') || nameUz.includes('quyosh tizim')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="sun">
    <circle cx="100" cy="100" r="22" fill="#FACC15" stroke="#EA580C" stroke-width="3"/>
    <circle cx="100" cy="100" r="29" fill="none" stroke="#FDBA74" stroke-width="1.8" stroke-dasharray="4 4"/>
  </g>
  <g data-part="1" data-part-id="inner_planets">
    <ellipse cx="100" cy="100" rx="46" ry="26" fill="none" stroke="#94A3B8" stroke-width="1.6" stroke-dasharray="4 3"/>
    <circle cx="144" cy="94" r="6" fill="#3B82F6" stroke="#1D4ED8" stroke-width="1.8"/>
    <circle cx="62" cy="116" r="5" fill="#EF4444" stroke="#B91C1C" stroke-width="1.6"/>
  </g>
  <g data-part="2" data-part-id="outer_planets">
    <ellipse cx="100" cy="100" rx="80" ry="48" fill="none" stroke="#64748B" stroke-width="1.8" stroke-dasharray="5 4"/>
    <circle cx="34" cy="72" r="10" fill="#F59E0B" stroke="#B45309" stroke-width="2"/>
    <ellipse cx="164" cy="128" rx="14" ry="5" transform="rotate(-20 164 128)" fill="none" stroke="#D97706" stroke-width="2.4"/>
    <circle cx="164" cy="128" r="8" fill="#FDE68A" stroke="#B45309" stroke-width="1.8"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Quyosh', partId: 'sun', desc: 'Tizim markazidagi gravitatsiya va energiya manbai' },
        { label: 'Ichki sayyoralar (Yer, Mars)', partId: 'inner_planets', desc: 'Tosh qobiqli yaqin sayyoralar' },
        { label: 'Tashqi gigantlar (Yupiter, Saturn)', partId: 'outer_planets', desc: 'Gazli ulkan sayyoralar va halqalar' },
      ],
    };
  }

  if (key.includes('battery') || key.includes('electric circuit') || nameUz.includes('batareya') || nameUz.includes('zanjir')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="battery_cell">
    <rect x="26" y="72" width="38" height="62" rx="6" fill="#22C55E" stroke="#15803D" stroke-width="2.8"/>
    <rect x="37" y="64" width="16" height="8" rx="2" fill="#94A3B8" stroke="#334155" stroke-width="2"/>
    <text x="45" y="96" text-anchor="middle" font-size="14" font-weight="800" fill="#FFFFFF">+</text>
    <text x="45" y="124" text-anchor="middle" font-size="14" font-weight="800" fill="#FFFFFF">−</text>
  </g>
  <g data-part="1" data-part-id="conductor">
    <path d="M 45 64 V 40 H 152 V 82 M 152 126 V 162 H 45 V 134" fill="none" stroke="#F59E0B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="98" cy="40" r="4" fill="#1D4ED8"/>
    <line x1="98" y1="40" x2="118" y2="28" stroke="#1D4ED8" stroke-width="3.2" stroke-linecap="round"/>
  </g>
  <g data-part="2" data-part-id="load_bulb">
    <circle cx="152" cy="102" r="22" fill="#FEF08A" stroke="#CA8A04" stroke-width="3"/>
    <path d="M 142 108 L 148 96 L 156 108 L 162 96" fill="none" stroke="#EA580C" stroke-width="2.6" stroke-linecap="round"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Tok manbai (Batareya)', partId: 'battery_cell', desc: 'Kuchlanish (EYuK) hosil qiladi' },
        { label: 'O‘tkazgich va kalit', partId: 'conductor', desc: 'Elektronlar oqimini yuklamaga uzatadi' },
        { label: 'Yuklama (Chiroq)', partId: 'load_bulb', desc: 'Elektr energiyasini yorug‘likka aylantiradi' },
      ],
    };
  }

  if (key.includes('hydro turbine') || nameUz.includes('gidroturbina') || nameUz.includes('gaes')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200">
  <g data-part="0" data-part-id="penstock">
    <!-- Yuqori suv ombori (H1) va beton to'g'on -->
    <rect x="10" y="22" width="54" height="36" rx="4" fill="#38BDF8" stroke="#0284C7" stroke-width="2.2"/>
    <path d="M 14 30 Q 24 26 34 30 T 58 30" fill="none" stroke="#E0F2FE" stroke-width="2" stroke-linecap="round"/>
    <path d="M 14 40 Q 26 36 38 40 T 58 40" fill="none" stroke="#BAE6FD" stroke-width="1.6" stroke-linecap="round"/>
    <!-- Beton to'g'on devori -->
    <polygon points="58,16 74,16 88,166 56,166" fill="#CBD5E1" stroke="#334155" stroke-width="2.4" stroke-linejoin="round"/>
    <line x1="63" y1="28" x2="74" y2="28" stroke="#64748B" stroke-width="1.6"/>
    <line x1="62" y1="54" x2="77" y2="54" stroke="#64748B" stroke-width="1.6"/>
    <line x1="60" y1="84" x2="80" y2="84" stroke="#64748B" stroke-width="1.6"/>
    <!-- Bosimli naporniy quvur (Penstock) -->
    <polygon points="56,42 74,42 122,124 102,134" fill="#2563EB" stroke="#1E3A8A" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M 64 49 L 110 125" fill="none" stroke="#93C5FD" stroke-width="2.6" stroke-dasharray="6 4" stroke-linecap="round"/>
    <!-- Quvur halqalari -->
    <line x1="68" y1="68" x2="85" y2="59" stroke="#1E3A8A" stroke-width="2.4" stroke-linecap="round"/>
    <line x1="84" y1="95" x2="101" y2="86" stroke="#1E3A8A" stroke-width="2.4" stroke-linecap="round"/>
    <!-- Pastki suv havzasi (H2) va chiqish trubasi -->
    <path d="M 122 152 H 228 V 182 H 88 V 158 H 116 Z" fill="#7DD3FC" stroke="#0284C7" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M 142 165 Q 160 160 178 165 T 218 165" fill="none" stroke="#0369A1" stroke-width="2" stroke-linecap="round"/>
  </g>
  <g data-part="1" data-part-id="runner_blades">
    <!-- Spiral kamera va Frensis gidroturbinasi -->
    <circle cx="128" cy="134" r="28" fill="#F1F5F9" stroke="#0F172A" stroke-width="2.8"/>
    <circle cx="128" cy="134" r="22" fill="#E0F2FE" stroke="#0284C7" stroke-width="1.8" stroke-dasharray="4 3"/>
    <g data-animate="spin">
      <circle cx="128" cy="134" r="19" fill="none" stroke="none"/>
      <line x1="128" y1="113" x2="128" y2="155" stroke="#0284C7" stroke-width="4.2" stroke-linecap="round"/>
      <line x1="107" y1="134" x2="149" y2="134" stroke="#0284C7" stroke-width="4.2" stroke-linecap="round"/>
      <line x1="113" y1="119" x2="143" y2="149" stroke="#1D4ED8" stroke-width="3.6" stroke-linecap="round"/>
      <line x1="143" y1="119" x2="113" y2="149" stroke="#1D4ED8" stroke-width="3.6" stroke-linecap="round"/>
      <circle cx="128" cy="134" r="8" fill="#F59E0B" stroke="#111827" stroke-width="2.2"/>
    </g>
  </g>
  <g data-part="2" data-part-id="generator_unit">
    <!-- Mashina zali, vertikal val va Gidrogenerator-Dvigatel (G/M) -->
    <rect x="96" y="18" width="64" height="62" rx="6" fill="#F8FAFC" stroke="#334155" stroke-width="2.4"/>
    <line x1="128" y1="74" x2="128" y2="112" stroke="#334155" stroke-width="6" stroke-linecap="round"/>
    <!-- Generator stator va rotori -->
    <rect x="106" y="28" width="44" height="38" rx="6" fill="#1D4ED8" stroke="#1E3A8A" stroke-width="2.4"/>
    <rect x="114" y="35" width="28" height="24" rx="4" fill="#FDE047" stroke="#CA8A04" stroke-width="2"/>
    <line x1="120" y1="39" x2="120" y2="55" stroke="#B45309" stroke-width="2"/>
    <line x1="128" y1="39" x2="128" y2="55" stroke="#B45309" stroke-width="2"/>
    <line x1="136" y1="39" x2="136" y2="55" stroke="#B45309" stroke-width="2"/>
    <!-- Kuchaytiruvchi transformator va LEP ustuni -->
    <rect x="172" y="48" width="22" height="28" rx="3" fill="#F59E0B" stroke="#78350F" stroke-width="2.2"/>
    <path d="M 150 44 H 178 V 48" fill="none" stroke="#DC2626" stroke-width="2.2" stroke-linecap="round"/>
    <!-- Elektr uzatish minorasi (LEP) -->
    <path d="M 206 78 L 214 26 L 222 78 M 202 38 H 226 M 204 52 H 224" fill="none" stroke="#334155" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 194 48 Q 204 42 214 38" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 240 200',
      parts_uz: [
        { label: 'Yuqori suv ombori, to‘g‘on va bosim quvuri', partId: 'penstock', desc: 'H₁ balandlikdagi suv naporniy truboprovod orqali katta bosim bilan turbinaga tushadi (nasos rejimida qayta yuqoriga haydaladi)' },
        { label: 'Spiral kamera va Frensis ishchi g‘ildiragi', partId: 'runner_blades', desc: 'Suv oqimi kuraklarga urilib, g‘ildirak va markaziy valni katta aylanish momenti bilan aylantiradi' },
        { label: 'Vertikal val, Gidrogenerator (G/M) va LEP', partId: 'generator_unit', desc: 'Rotor magnit maydoni stator chulg‘amlarida elektr toki hosil qilib, transformator orqali tarmoqqa uzatadi' },
      ],
    };
  }

  if (key.includes('steam turbine') || nameUz.includes("bug' turbina") || nameUz.includes('reaktor')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="boiler">
    <rect x="18" y="64" width="44" height="96" rx="8" fill="#FEE2E2" stroke="#DC2626" stroke-width="2.8"/>
    <path d="M 32 146 Q 40 124 48 146" fill="#F97316"/>
    <g data-animate="pulse">
      <path d="M 62 76 H 96" fill="none" stroke="#F97316" stroke-width="5" stroke-linecap="round"/>
      <circle cx="40" cy="86" r="10" fill="#FED7AA" opacity="0.85"/>
    </g>
  </g>
  <g data-part="1" data-part-id="turbine_blades">
    <polygon points="90,60 138,44 138,118 90,102" fill="#E2E8F0" stroke="#334155" stroke-width="2.8" stroke-linejoin="round"/>
    <g data-animate="bob">
      <line x1="100" y1="68" x2="100" y2="94" stroke="#475569" stroke-width="4" stroke-linecap="round"/>
      <line x1="114" y1="60" x2="114" y2="102" stroke="#334155" stroke-width="4" stroke-linecap="round"/>
      <line x1="128" y1="52" x2="128" y2="110" stroke="#1E293B" stroke-width="4" stroke-linecap="round"/>
    </g>
    <line x1="84" y1="81" x2="152" y2="81" stroke="#64748B" stroke-width="5" stroke-linecap="round"/>
  </g>
  <g data-part="2" data-part-id="generator_unit">
    <rect x="148" y="58" width="38" height="46" rx="8" fill="#2563EB" stroke="#1E3A8A" stroke-width="2.8"/>
    <rect x="156" y="68" width="22" height="26" rx="4" fill="#FEF08A" stroke="#CA8A04" stroke-width="1.8"/>
    <path d="M 108 110 V 156 H 40" fill="none" stroke="#38BDF8" stroke-width="4" stroke-dasharray="5 3" stroke-linecap="round"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Bug‘ qozoni va qizdirish kamerasi', partId: 'boiler', desc: 'Ichida suv qizib qaynaydi va yuqori bosimli bug‘ oqimi chiqish quvuriga otiladi' },
        { label: 'Ko‘p pog‘onali bug‘ turbinasi', partId: 'turbine_blades', desc: 'Qizigan bug‘ kuraklar orasidan kengayib o‘tayotganda valni minglab aylanish tezligida aylantiradi' },
        { label: 'Turbogenerator va kondensator', partId: 'generator_unit', desc: 'Generator rotori ichida tok hosil bo‘ladi, kondensatorda esa bug‘ sovib yana suvga aylanadi' },
      ],
    };
  }

  if (key.includes('wind turbine') || key.includes('turbine') || nameUz.includes('turbina')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="tower">
    <polygon points="92,76 108,76 116,178 84,178" fill="#E2E8F0" stroke="#334155" stroke-width="2.8" stroke-linejoin="round"/>
    <rect x="64" y="176" width="72" height="10" rx="3" fill="#64748B"/>
  </g>
  <g data-part="1" data-part-id="nacelle_generator">
    <rect x="86" y="62" width="38" height="18" rx="6" fill="#2563EB" stroke="#1E40AF" stroke-width="2.4"/>
    <circle cx="100" cy="71" r="8" fill="#F59E0B" stroke="#92400E" stroke-width="2.2"/>
  </g>
  <g data-part="2" data-part-id="rotor_blades">
    <g data-animate="spin">
      <circle cx="100" cy="71" r="52" fill="none" stroke="none"/>
      <path d="M 100 63 L 94 18 L 106 20 Z" fill="#F8FAFC" stroke="#0F172A" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M 106 75 L 146 102 L 138 112 Z" fill="#F8FAFC" stroke="#0F172A" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M 94 75 L 54 102 L 62 112 Z" fill="#F8FAFC" stroke="#0F172A" stroke-width="2.4" stroke-linejoin="round"/>
    </g>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Tayanch minora', partId: 'tower', desc: 'Ichidan o‘tgan kuch kabellari bo‘ylab generatordagi tok pastga podstansiyaga oqadi' },
        { label: 'Gondola va generator', partId: 'nacelle_generator', desc: 'Ichida tishli multiplikator sekin aylanishni tezlashtirib generator rotorini aylantiradi' },
        { label: 'Aerodinamik parraklar', partId: 'rotor_blades', desc: 'Havo oqimi bosim farqi bilan parraklarni va markaziy gubka valini aylantiradi' },
      ],
    };
  }

  if (key.includes('volcano') || nameUz.includes('vulqon')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="magma_chamber">
    <polygon points="24,174 82,76 118,76 176,174" fill="#78350F" stroke="#451A03" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="100" cy="160" rx="44" ry="16" fill="#EF4444" stroke="#B91C1C" stroke-width="2.4"/>
  </g>
  <g data-part="1" data-part-id="conduit">
    <rect x="92" y="76" width="16" height="74" fill="#F97316" stroke="#C2410C" stroke-width="2"/>
  </g>
  <g data-part="2" data-part-id="crater_eruption">
    <path d="M 80 76 Q 68 42 52 38 M 100 74 V 24 M 120 76 Q 132 42 148 38" fill="none" stroke="#F59E0B" stroke-width="4" stroke-linecap="round"/>
    <circle cx="84" cy="30" r="11" fill="#CBD5E1" stroke="#64748B" stroke-width="2"/>
    <circle cx="114" cy="26" r="13" fill="#94A3B8" stroke="#475569" stroke-width="2"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Magma o‘chog‘i', partId: 'magma_chamber', desc: 'Yer ostidagi erigan tog‘ jinslari rezervuari' },
        { label: 'Vulqon bo‘g‘zi (kanal)', partId: 'conduit', desc: 'Magma yuqoriga ko‘tariladigan yo‘l' },
        { label: 'Krater va lava otilishi', partId: 'crater_eruption', desc: 'Lava, kul va gazlar tashqariga chiqadigan og‘iz' },
      ],
    };
  }

  if (key === 'car' || nameUz.includes('mashina') || nameUz.includes('avtomobil')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="chassis">
    <path d="M 24 128 H 176 V 104 L 146 98 L 122 68 H 66 L 46 98 L 24 106 Z" fill="#2563EB" stroke="#1E3A8A" stroke-width="3" stroke-linejoin="round"/>
    <polygon points="70,74 118,74 136,96 54,96" fill="#BAE6FD" stroke="#0284C7" stroke-width="2.2" stroke-linejoin="round"/>
  </g>
  <g data-part="1" data-part-id="engine_bay">
    <rect x="134" y="102" width="28" height="16" rx="3" fill="#F59E0B" stroke="#92400E" stroke-width="2"/>
    <circle cx="172" cy="112" r="5" fill="#FEF08A" stroke="#CA8A04" stroke-width="1.8"/>
  </g>
  <g data-part="2" data-part-id="wheels">
    <circle cx="58" cy="134" r="18" fill="#1E293B" stroke="#0F172A" stroke-width="3"/>
    <circle cx="58" cy="134" r="8" fill="#CBD5E1"/>
    <circle cx="142" cy="134" r="18" fill="#1E293B" stroke="#0F172A" stroke-width="3"/>
    <circle cx="142" cy="134" r="8" fill="#CBD5E1"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Kuzov va kabina', partId: 'chassis', desc: 'Aerodinamik korpus va yo‘lovchi bo‘limi' },
        { label: 'Dvigatel bo‘limi', partId: 'engine_bay', desc: 'Haraktlantiruvchi kuch hosil qiluvchi qism' },
        { label: 'G‘ildiraklar', partId: 'wheels', desc: 'Yo‘l bilan ishqalanish va harakatni ta’minlaydi' },
      ],
    };
  }

  if (key.includes('airplane') || nameUz.includes('samolyot')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="fuselage">
    <path d="M 22 104 Q 100 84 176 98 Q 186 102 174 110 Q 100 120 22 108 Z" fill="#F1F5F9" stroke="#334155" stroke-width="3"/>
    <path d="M 148 94 Q 168 96 172 103 H 146 Z" fill="#38BDF8" stroke="#0284C7" stroke-width="2"/>
  </g>
  <g data-part="1" data-part-id="wings">
    <polygon points="88,100 122,42 138,44 114,102" fill="#2563EB" stroke="#1E3A8A" stroke-width="2.6" stroke-linejoin="round"/>
    <polygon points="84,110 116,162 134,160 112,108" fill="#3B82F6" stroke="#1E3A8A" stroke-width="2.6" stroke-linejoin="round"/>
  </g>
  <g data-part="2" data-part-id="tail_engine">
    <polygon points="28,100 16,66 34,68 48,100" fill="#EF4444" stroke="#991B1B" stroke-width="2.4" stroke-linejoin="round"/>
    <rect x="92" y="124" width="24" height="12" rx="5" fill="#F59E0B" stroke="#92400E" stroke-width="2"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Fyuzelyaj (korpus)', partId: 'fuselage', desc: 'Samolyotning asosiy tanasi va kabinasi' },
        { label: 'Qanotlar', partId: 'wings', desc: 'Bernulli qonuni bo‘yicha ko‘tarish kuchini yaratadi' },
        { label: 'Dum va reaktiv dvigatel', partId: 'tail_engine', desc: 'Yo‘nalishni boshqaradi va tortish kuchi beradi' },
      ],
    };
  }

  if (key.includes('solar panel') || nameUz.includes('quyosh panel') || nameUz.includes('fotoelement') || nameUz.includes('quyosh elektr')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="pv_cells">
    <polygon points="24,110 82,58 148,58 92,110" fill="#1D4ED8" stroke="#0F172A" stroke-width="3" stroke-linejoin="round"/>
    <line x1="53" y1="84" x2="119" y2="84" stroke="#93C5FD" stroke-width="1.6"/>
    <line x1="62" y1="58" x2="104" y2="110" stroke="#93C5FD" stroke-width="1.6"/>
    <line x1="94" y1="58" x2="124" y2="110" stroke="#93C5FD" stroke-width="1.6"/>
    <line x1="86" y1="110" x2="86" y2="164" stroke="#475569" stroke-width="5" stroke-linecap="round"/>
    <rect x="64" y="162" width="44" height="10" rx="3" fill="#64748B"/>
    <g data-animate="pulse">
      <circle cx="42" cy="30" r="12" fill="#FACC15" stroke="#EA580C" stroke-width="2"/>
      <path d="M 54 38 L 76 58 M 64 32 L 94 56" stroke="#F59E0B" stroke-width="2.4" stroke-dasharray="4 3" stroke-linecap="round"/>
    </g>
  </g>
  <g data-part="1" data-part-id="inverter">
    <path d="M 102 100 H 126 V 136" fill="none" stroke="#F59E0B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="112" y="134" width="32" height="32" rx="5" fill="#F1F5F9" stroke="#334155" stroke-width="2.5"/>
    <path d="M 118 150 Q 123 142 128 150 T 138 150" fill="none" stroke="#0071E3" stroke-width="2.4" stroke-linecap="round"/>
  </g>
  <g data-part="2" data-part-id="grid_load">
    <path d="M 144 150 H 164" stroke="#2563EB" stroke-width="3" stroke-linecap="round"/>
    <rect x="158" y="128" width="26" height="40" rx="4" fill="#DBEAFE" stroke="#1D4ED8" stroke-width="2.4"/>
    <circle cx="171" cy="144" r="7" fill="#FEF08A" stroke="#CA8A04" stroke-width="2"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Fotoelektr (PV) kremniy elementlar', partId: 'pv_cells', desc: 'Fotonlar urilganda p-n o‘tishi ichida elektronlar ajralib, bir tomonga doimiy tok bo‘lib oqadi' },
        { label: 'Inverter (DC → AC)', partId: 'inverter', desc: 'Ichidagi elektron kalitlar doimiy tokni 50 Hz chastotada tebranuvchi sinusoidaga aylantiradi' },
        { label: 'Yuklama va elektr tarmog‘i', partId: 'grid_load', desc: 'Chiqish simlari bo‘ylab o‘zgaruvchan tok iste’molchi va podstansiyaga oqadi' },
      ],
    };
  }

  if (key.includes('solenoid') || key.includes('electromagnet') || nameUz.includes('solenoid') || nameUz.includes("g'altak")) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="core">
    <rect x="38" y="84" width="124" height="32" rx="6" fill="#94A3B8" stroke="#334155" stroke-width="2.8"/>
    <text x="50" y="105" text-anchor="middle" font-size="13" font-weight="800" fill="#EF4444">N</text>
    <text x="150" y="105" text-anchor="middle" font-size="13" font-weight="800" fill="#2563EB">S</text>
  </g>
  <g data-part="1" data-part-id="winding">
    <path d="M 60 76 C 68 62 76 62 76 124 M 78 76 C 86 62 94 62 94 124 M 96 76 C 104 62 112 62 112 124 M 114 76 C 122 62 130 62 130 124" fill="none" stroke="#D97706" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M 60 124 V 156 H 140 V 124" fill="none" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/>
  </g>
  <g data-part="2" data-part-id="magnetic_field">
    <g data-animate="pulse">
      <ellipse cx="100" cy="100" rx="84" ry="52" fill="none" stroke="#3B82F6" stroke-width="2" stroke-dasharray="6 4"/>
      <ellipse cx="100" cy="100" rx="72" ry="38" fill="none" stroke="#60A5FA" stroke-width="1.8" stroke-dasharray="5 4"/>
    </g>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Ferromagnit o‘zak', partId: 'core', desc: 'Ichidagi magnit domenlari tok yo‘nalishiga moslanib magnit oqimini kuchaytiradi' },
        { label: 'Mis o‘ramli g‘altak (N)', partId: 'winding', desc: 'O‘ramlar bo‘ylab aylanib yuruvchi elektronlar o‘zak bo‘ylab magnit maydon qo‘zg‘atadi' },
        { label: 'Magnit maydon chiziqlari (B)', partId: 'magnetic_field', desc: 'N qutbdan chiqib o‘zak va tashqi fazo orqali S qutbga yopiq halqa bo‘ylab harakatlanadi' },
      ],
    };
  }

  if (key.includes('capacitor') || key.includes('rlc') || nameUz.includes('kondensator') || nameUz.includes('kontur')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="plates">
    <rect x="44" y="42" width="12" height="72" rx="3" fill="#EF4444" stroke="#991B1B" stroke-width="2.4"/>
    <rect x="86" y="42" width="12" height="72" rx="3" fill="#3B82F6" stroke="#1E40AF" stroke-width="2.4"/>
    <g data-animate="pulse">
      <rect x="58" y="46" width="26" height="64" rx="2" fill="#E0F2FE" opacity="0.85"/>
      <line x1="60" y1="62" x2="82" y2="62" stroke="#0284C7" stroke-width="2" stroke-dasharray="3 2"/>
      <line x1="60" y1="78" x2="82" y2="78" stroke="#0284C7" stroke-width="2" stroke-dasharray="3 2"/>
      <line x1="60" y1="94" x2="82" y2="94" stroke="#0284C7" stroke-width="2" stroke-dasharray="3 2"/>
    </g>
  </g>
  <g data-part="1" data-part-id="inductor">
    <path d="M 136 52 Q 154 58 136 66 Q 154 74 136 82 Q 154 90 136 98 Q 154 106 136 112" fill="none" stroke="#D97706" stroke-width="4.2" stroke-linecap="round"/>
  </g>
  <g data-part="2" data-part-id="ac_source">
    <path d="M 44 78 H 24 V 156 H 136 V 112 M 98 78 H 136 V 52" fill="none" stroke="#334155" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="80" cy="156" r="14" fill="#FEF9C3" stroke="#CA8A04" stroke-width="2.4"/>
    <path d="M 72 156 Q 76 148 80 156 T 88 156" fill="none" stroke="#1E293B" stroke-width="2"/>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Kondensator qoplamalari (C)', partId: 'plates', desc: 'Qoplamalar orasida elektr maydon kuchayib-kamayib zaryadlarni to‘playdi' },
        { label: 'Induktivlik g‘altagi (L)', partId: 'inductor', desc: 'O‘ramlari ichida tok o‘tib magnit maydon energiyasini to‘playdi va qaytaradi' },
        { label: 'Zanjir va tebranish manbai', partId: 'ac_source', desc: 'Elektronlar C va L orasida davriy oldinga-orqaga tebranib energiya almashadi' },
      ],
    };
  }

  if (key.includes('prism') || nameUz.includes('prizma')) {
    const svg_data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <g data-part="0" data-part-id="incident_ray">
    <line x1="16" y1="112" x2="72" y2="92" stroke="#F8FAFC" stroke-width="5" stroke-linecap="round"/>
    <line x1="16" y1="112" x2="72" y2="92" stroke="#0F172A" stroke-width="2" stroke-dasharray="5 3" stroke-linecap="round"/>
  </g>
  <g data-part="1" data-part-id="glass_prism">
    <polygon points="100,36 46,154 154,154" fill="#E0F2FE" fill-opacity="0.72" stroke="#0284C7" stroke-width="3.2" stroke-linejoin="round"/>
  </g>
  <g data-part="2" data-part-id="spectrum">
    <g data-animate="pulse">
      <line x1="120" y1="88" x2="184" y2="68" stroke="#EF4444" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="122" y1="94" x2="184" y2="86" stroke="#F59E0B" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="125" y1="100" x2="184" y2="104" stroke="#22C55E" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="128" y1="106" x2="184" y2="122" stroke="#3B82F6" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="131" y1="112" x2="184" y2="140" stroke="#8B5CF6" stroke-width="3.5" stroke-linecap="round"/>
    </g>
  </g>
</svg>`;
    return {
      svg_data,
      viewBox: '0 0 200 200',
      parts_uz: [
        { label: 'Tushuvchi oq yorug‘lik nuri', partId: 'incident_ray', desc: 'Barcha spektr ranglarini o‘zida jamlagan nur' },
        { label: 'Shisha uchburchak prizma', partId: 'glass_prism', desc: 'Turli to‘lqin uzunliklarini turlicha sindiradi (n = c/v)' },
        { label: 'Dispersiya spektri (Qizildan Binafshagacha)', partId: 'spectrum', desc: 'Yorug‘likning ranglarga ajralish natijasi' },
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

  if (key.includes('electric motor')) {
    return [
      { type: 'cylinder', position: [0, 1.8, 0], rotation: [0, 0, Math.PI / 2], args: [1.32, 1.32, 2.3, 28], color: '#cbd5e1', opacity: 0.35, label: 'Stator korpusi', partId: 'stator' },
      { type: 'rounded_box', position: [0, 2.55, -0.55], args: [1.2, 0.72, 0.7, 0.1], color: '#ef4444', label: 'N qutb', partId: 'stator' },
      { type: 'rounded_box', position: [0, 1.05, 0.55], args: [1.2, 0.72, 0.7, 0.1], color: '#3b82f6', label: 'S qutb', partId: 'stator' },
      { type: 'cylinder', position: [0, 1.8, 0], rotation: [0, 0, Math.PI / 2], args: [0.68, 0.68, 1.55, 24], color: '#f59e0b', label: 'Rotor o‘rami', partId: 'rotor', animation: 'spin', animationAxis: 'x', animationSpeed: 2.6, animationPivot: [0, 1.8, 0] },
      { type: 'cylinder', position: [0.4, 1.8, 0], rotation: [0, 0, Math.PI / 2], args: [0.16, 0.16, 3.2, 18], color: '#475569', label: 'Aylanuvchi val', partId: 'rotor', animation: 'spin', animationAxis: 'x', animationSpeed: 2.6, animationPivot: [0, 1.8, 0] },
      { type: 'box', position: [1.7, 1.8, 0], args: [0.22, 0.95, 0.25], color: '#0ea5e9', partId: 'rotor', animation: 'spin', animationAxis: 'x', animationSpeed: 2.6, animationPivot: [0, 1.8, 0] },
      { type: 'rounded_box', position: [-1.1, 2.95, 0], args: [0.75, 0.42, 0.75, 0.08], color: '#1e293b', label: 'Klemma qutisi', partId: 'commutator' },
      { type: 'torus', position: [-0.95, 1.8, 0], rotation: [0, Math.PI / 2, 0], args: [0.36, 0.09, 12, 24], color: '#fbbf24', label: 'Kollektor va cho‘tkalar', partId: 'commutator' },
    ];
  }

  if (key.includes('engine')) {
    return [
      { type: 'cylinder', position: [0, 2.2, 0], args: [1.0, 1.0, 1.9, 24], color: '#cbd5e1', opacity: 0.42, label: 'Silindr', partId: 'cylinder' },
      { type: 'cylinder', position: [0, 1.9, 0], args: [0.82, 0.82, 0.72, 24], color: '#64748b', label: 'Porshen', partId: 'cylinder', animation: 'oscillate_y', animationSpeed: 3.0, animationAmp: 0.28 },
      { type: 'cylinder', position: [0, 3.45, 0], args: [0.22, 0.22, 0.65, 16], color: '#94a3b8', label: 'Sham', partId: 'spark' },
      { type: 'sphere', position: [0, 2.8, 0], args: [0.35, 16, 16], color: '#f97316', partId: 'spark', animation: 'pulse_scale', animationSpeed: 3.4, animationAmp: 0.22 },
      { type: 'cylinder', position: [0, 0.65, 0], rotation: [Math.PI / 2, 0, 0], args: [0.62, 0.62, 0.55, 24], color: '#334155', label: 'Tirsakli val', partId: 'crankshaft', animation: 'spin', animationAxis: 'z', animationSpeed: 2.8, animationPivot: [0, 0.65, 0] },
      { type: 'cylinder', position: [0.15, 1.25, 0], rotation: [0, 0, -0.2], args: [0.14, 0.14, 1.1, 12], color: '#475569', partId: 'crankshaft', animation: 'oscillate_y', animationSpeed: 3.0, animationAmp: 0.22 },
    ];
  }

  if (key.includes('generator') || key.includes('alternator') || key.includes('dynamo')) {
    return [
      { type: 'rounded_box', position: [-1.45, 1.8, 0], args: [0.7, 2.1, 1.4, 0.12], color: '#ef4444', label: 'N qutb (Stator)', partId: 'stator' },
      { type: 'rounded_box', position: [1.45, 1.8, 0], args: [0.7, 2.1, 1.4, 0.12], color: '#3b82f6', label: 'S qutb (Stator)', partId: 'stator' },
      { type: 'box', position: [0, 1.8, 0], args: [1.25, 1.45, 0.22], color: '#f59e0b', label: 'Rotor chulg‘ami', partId: 'rotor', animation: 'spin', animationAxis: 'z', animationSpeed: 2.2, animationPivot: [0, 1.8, 0] },
      { type: 'cylinder', position: [0, 1.8, 0], rotation: [Math.PI / 2, 0, 0], args: [0.12, 0.12, 2.8, 16], color: '#475569', partId: 'rotor', animation: 'spin', animationAxis: 'z', animationSpeed: 2.2, animationPivot: [0, 1.8, 0] },
      { type: 'torus', position: [0, 1.8, 1.05], args: [0.32, 0.08, 12, 24], color: '#fbbf24', label: 'Sirpanish halqasi', partId: 'brushes', animation: 'spin', animationAxis: 'z', animationSpeed: 2.2, animationPivot: [0, 1.8, 0] },
      { type: 'torus', position: [0, 1.8, 1.32], args: [0.32, 0.08, 12, 24], color: '#d97706', partId: 'brushes', animation: 'spin', animationAxis: 'z', animationSpeed: 2.2, animationPivot: [0, 1.8, 0] },
    ];
  }

  if (key.includes('hydraulic') || key.includes('press')) {
    return [
      { type: 'cylinder', position: [-1.25, 1.35, 0], args: [0.42, 0.42, 1.6, 24], color: '#cbd5e1', opacity: 0.45, label: 'Kichik silindr', partId: 'piston_small' },
      { type: 'cylinder', position: [-1.25, 1.85, 0], args: [0.36, 0.36, 0.42, 24], color: '#f59e0b', label: 'Kichik porshen (F₁)', partId: 'piston_small', animation: 'oscillate_y', animationSpeed: 1.5, animationAmp: -0.15 },
      { type: 'cylinder', position: [-1.25, 2.35, 0], args: [0.1, 0.1, 0.9, 14], color: '#475569', partId: 'piston_small', animation: 'oscillate_y', animationSpeed: 1.5, animationAmp: -0.15 },
      { type: 'tube', position: [0, 0, 0], args: [0.24, 32, 14], points: [[-1.25, 0.75, 0], [-1.25, 0.35, 0], [0, 0.35, 0], [1.15, 0.35, 0], [1.15, 0.75, 0]], color: '#0ea5e9', opacity: 0.85, label: 'Gidravlik suyuqlik', partId: 'hydraulic_fluid' },
      { type: 'cylinder', position: [1.15, 1.45, 0], args: [0.85, 0.85, 1.8, 28], color: '#e2e8f0', opacity: 0.42, partId: 'piston_large' },
      { type: 'cylinder', position: [1.15, 1.6, 0], args: [0.76, 0.76, 0.46, 28], color: '#2563eb', label: 'Katta porshen (F₂)', partId: 'piston_large', animation: 'oscillate_y', animationSpeed: 1.5, animationAmp: 0.06 },
      { type: 'rounded_box', position: [1.15, 2.35, 0], args: [1.1, 0.28, 1.1, 0.08], color: '#334155', partId: 'piston_large', animation: 'oscillate_y', animationSpeed: 1.5, animationAmp: 0.06 },
    ];
  }

  if (key.includes('water pump') || key.includes('pump')) {
    return [
      { type: 'cylinder', position: [-1.55, 1.35, 0], rotation: [0, 0, Math.PI / 2], args: [0.38, 0.38, 1.3, 24], color: '#60a5fa', label: 'Kirish quvuri', partId: 'intake' },
      { type: 'torus', position: [0, 1.35, 0], args: [0.95, 0.34, 18, 32], color: '#0284c7', opacity: 0.55, label: 'Nasos korpusi', partId: 'impeller' },
      { type: 'cylinder', position: [0, 1.35, 0], rotation: [Math.PI / 2, 0, 0], args: [0.42, 0.42, 0.55, 24], color: '#f59e0b', label: 'Impeller', partId: 'impeller', animation: 'spin', animationAxis: 'z', animationSpeed: 2.8, animationPivot: [0, 1.35, 0] },
      { type: 'box', position: [0, 1.35, 0], args: [1.4, 0.16, 0.35], color: '#d97706', partId: 'impeller', animation: 'spin', animationAxis: 'z', animationSpeed: 2.8, animationPivot: [0, 1.35, 0] },
      { type: 'box', position: [0, 1.35, 0], rotation: [0, 0, Math.PI / 2], args: [1.4, 0.16, 0.35], color: '#d97706', partId: 'impeller', animation: 'spin', animationAxis: 'z', animationSpeed: 2.8, animationPivot: [0, 1.35, 0] },
      { type: 'cylinder', position: [0.78, 2.45, 0], args: [0.34, 0.34, 1.4, 24], color: '#2563eb', label: 'Chiqish quvuri', partId: 'outlet' },
    ];
  }

  if (key.includes('dna')) {
    const ptsA: [number, number, number][] = [];
    const ptsB: [number, number, number][] = [];
    const rungItems: Primitive3DItem[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const angle = t * Math.PI * 3.2;
      const y = 0.4 + t * 3.6;
      const r = 0.85;
      ptsA.push([Math.cos(angle) * r, y, Math.sin(angle) * r]);
      ptsB.push([Math.cos(angle + Math.PI) * r, y, Math.sin(angle + Math.PI) * r]);
      if (i % 2 === 1 && i < 16) {
        rungItems.push({
          type: 'capsule',
          position: [0, y, 0],
          rotation: [0, -angle, Math.PI / 2],
          args: [0.09, 1.35],
          color: i % 4 === 1 ? '#10b981' : '#f59e0b',
          partId: 'base_pairs',
          label: i === 7 ? 'Azot asoslari (A-T, G-C)' : undefined,
        });
      }
    }
    return [
      { type: 'tube', position: [0, 0, 0], args: [0.13, 40, 12], points: ptsA, color: '#2563eb', label: 'Shakar-fosfat zanjiri', partId: 'backbone' },
      { type: 'tube', position: [0, 0, 0], args: [0.13, 40, 12], points: ptsB, color: '#ec4899', partId: 'helix_groove' },
      ...rungItems,
    ];
  }

  if (key.includes('microscope')) {
    return [
      { type: 'rounded_box', position: [0, 0.3, 0], args: [1.9, 0.35, 1.5, 0.08], color: '#334155', label: 'Taglik', partId: 'stage' },
      { type: 'rounded_box', position: [-0.25, 1.15, 0], args: [1.25, 0.14, 1.1, 0.04], color: '#1e293b', label: 'Buyum stolchasi', partId: 'stage' },
      { type: 'tube', position: [0, 0, 0], args: [0.16, 28, 12], points: [[0.5, 0.45, 0], [0.95, 1.4, 0], [0.75, 2.45, 0], [0.05, 2.7, 0]], color: '#475569', partId: 'eyepiece' },
      { type: 'cylinder', position: [-0.25, 2.55, 0], rotation: [0, 0, 0.2], args: [0.22, 0.24, 1.2, 20], color: '#cbd5e1', label: 'Tubus va okulyar', partId: 'eyepiece' },
      { type: 'cylinder', position: [-0.38, 3.25, 0], rotation: [0, 0, 0.2], args: [0.17, 0.17, 0.45, 20], color: '#0f172a', partId: 'eyepiece' },
      { type: 'cylinder', position: [-0.18, 1.82, 0], args: [0.14, 0.14, 0.42, 16], color: '#2563eb', label: 'Obyektiv', partId: 'objective' },
      { type: 'cylinder', position: [-0.42, 1.85, 0.15], args: [0.11, 0.11, 0.36, 16], color: '#f59e0b', partId: 'objective' },
    ];
  }

  if (key.includes('telescope')) {
    return [
      { type: 'cylinder', position: [0, 2.2, 0], rotation: [0, 0, 1.22], args: [0.46, 0.28, 2.9, 28], color: '#e2e8f0', label: 'Optik truba', partId: 'tube_body' },
      { type: 'cylinder', position: [-1.35, 2.68, 0], rotation: [0, 0, 1.22], args: [0.48, 0.48, 0.28, 28], color: '#2563eb', label: 'Obyektiv linza', partId: 'primary_lens' },
      { type: 'cylinder', position: [1.45, 1.68, 0], rotation: [0, 0, 1.22], args: [0.16, 0.16, 0.55, 20], color: '#1e293b', label: 'Okulyar', partId: 'eyepiece' },
      { type: 'cylinder', position: [-0.45, 1.05, 0.52], rotation: [-0.28, 0, -0.25], args: [0.06, 0.08, 2.1, 12], color: '#475569', partId: 'tube_body' },
      { type: 'cylinder', position: [-0.45, 1.05, -0.52], rotation: [0.28, 0, -0.25], args: [0.06, 0.08, 2.1, 12], color: '#475569', partId: 'tube_body' },
      { type: 'cylinder', position: [0.55, 1.05, 0], rotation: [0, 0, 0.28], args: [0.06, 0.08, 2.1, 12], color: '#475569', partId: 'tube_body' },
    ];
  }

  if (key === 'eye') {
    return [
      { type: 'sphere', position: [0, 1.5, 0], args: [1.25, 28, 28], color: '#f8fafc', opacity: 0.72, label: 'To‘r parda (Retina)', partId: 'retina' },
      { type: 'sphere', position: [-0.95, 1.5, 0], args: [0.55, 22, 22], color: '#93c5fd', opacity: 0.85, label: 'Shox parda va gavhar', partId: 'cornea_lens' },
      { type: 'sphere', position: [-1.32, 1.5, 0], args: [0.24, 18, 18], color: '#0f172a', partId: 'cornea_lens' },
      { type: 'cylinder', position: [1.55, 1.5, 0], rotation: [0, 0, Math.PI / 2], args: [0.24, 0.28, 1.1, 18], color: '#f59e0b', label: 'Ko‘rish nervi', partId: 'optic_nerve' },
    ];
  }

  if (key === 'brain') {
    return [
      { type: 'sphere', position: [-0.45, 1.85, 0.25], args: [0.92, 24, 24], color: '#fbcfe8', label: 'Katta yarim sharlar', partId: 'cerebrum' },
      { type: 'sphere', position: [0.45, 1.85, -0.25], args: [0.92, 24, 24], color: '#f9a8d4', partId: 'cerebrum' },
      { type: 'sphere', position: [0.65, 1.05, 0], args: [0.52, 20, 20], color: '#c4b5fd', label: 'Miyacha', partId: 'cerebellum' },
      { type: 'capsule', position: [0.15, 0.65, 0], args: [0.24, 0.75], color: '#fde68a', label: 'Miya ustuni', partId: 'brainstem' },
    ];
  }

  if (key.includes('solar system')) {
    return [
      { type: 'sphere', position: [0, 1.4, 0], args: [0.75, 28, 28], color: '#facc15', label: 'Quyosh', partId: 'sun' },
      { type: 'ring', position: [0, 1.4, 0], rotation: [Math.PI / 2, 0, 0], args: [1.35, 0.03, 10, 48], color: '#94a3b8', partId: 'inner_planets' },
      { type: 'sphere', position: [1.35, 1.4, 0], args: [0.22, 18, 18], color: '#3b82f6', label: 'Yer', partId: 'inner_planets' },
      { type: 'ring', position: [0, 1.4, 0], rotation: [Math.PI / 2, 0, 0], args: [2.25, 0.03, 10, 56], color: '#64748b', partId: 'outer_planets' },
      { type: 'sphere', position: [-1.85, 1.4, 1.25], args: [0.36, 22, 22], color: '#f59e0b', label: 'Saturn', partId: 'outer_planets' },
      { type: 'ring', position: [-1.85, 1.4, 1.25], rotation: [Math.PI / 2.4, 0.25, 0], args: [0.58, 0.08, 12, 32], color: '#fde68a', partId: 'outer_planets' },
    ];
  }

  if (key.includes('battery') || key.includes('electric circuit')) {
    return [
      { type: 'cylinder', position: [-1.4, 1.2, 0], args: [0.42, 0.42, 1.4, 24], color: '#22c55e', label: 'Batareya', partId: 'battery_cell' },
      { type: 'cylinder', position: [-1.4, 1.98, 0], args: [0.16, 0.16, 0.18, 16], color: '#94a3b8', partId: 'battery_cell' },
      { type: 'tube', position: [0, 0, 0], args: [0.08, 36, 10], points: [[-1.4, 2.05, 0], [-1.4, 2.5, 0], [1.4, 2.5, 0], [1.4, 1.8, 0]], color: '#f59e0b', label: 'O‘tkazgich sim', partId: 'conductor' },
      { type: 'tube', position: [0, 0, 0], args: [0.08, 36, 10], points: [[1.4, 0.7, 0], [1.4, 0.35, 0], [-1.4, 0.35, 0], [-1.4, 0.5, 0]], color: '#3b82f6', partId: 'conductor' },
      { type: 'sphere', position: [1.4, 1.35, 0], args: [0.48, 22, 22], color: '#fef08a', opacity: 0.7, label: 'Chiroq (yuklama)', partId: 'load_bulb' },
      { type: 'cylinder', position: [1.4, 0.8, 0], args: [0.24, 0.24, 0.32, 18], color: '#64748b', partId: 'load_bulb' },
    ];
  }

  if (key.includes('hydro turbine')) {
    return [
      { type: 'tube', position: [0, 0, 0], args: [0.34, 28, 16], points: [[-2.1, 2.9, 0], [-1.25, 2.1, 0], [-0.55, 1.15, 0]], color: '#38bdf8', opacity: 0.8, label: 'Bosim quvuri', partId: 'penstock' },
      { type: 'torus', position: [0, 1.05, 0], rotation: [Math.PI / 2, 0, 0], args: [1.05, 0.25, 16, 32], color: '#64748b', opacity: 0.48, partId: 'runner_blades' },
      { type: 'cylinder', position: [0, 1.05, 0], args: [0.32, 0.32, 0.55, 20], color: '#0284c7', label: 'Ishchi parraklar', partId: 'runner_blades', animation: 'spin', animationAxis: 'y', animationSpeed: 2.4, animationPivot: [0, 1.05, 0] },
      { type: 'box', position: [0, 1.05, 0], args: [1.75, 0.14, 0.34], color: '#0ea5e9', partId: 'runner_blades', animation: 'spin', animationAxis: 'y', animationSpeed: 2.4, animationPivot: [0, 1.05, 0] },
      { type: 'box', position: [0, 1.05, 0], rotation: [0, Math.PI / 2, 0], args: [1.75, 0.14, 0.34], color: '#0ea5e9', partId: 'runner_blades', animation: 'spin', animationAxis: 'y', animationSpeed: 2.4, animationPivot: [0, 1.05, 0] },
      { type: 'cylinder', position: [0, 2.1, 0], args: [0.12, 0.12, 1.9, 16], color: '#475569', partId: 'generator_unit', animation: 'spin', animationAxis: 'y', animationSpeed: 2.4, animationPivot: [0, 2.1, 0] },
      { type: 'cylinder', position: [0, 3.0, 0], args: [0.95, 0.95, 0.9, 28], color: '#2563eb', label: 'Gidrogenerator', partId: 'generator_unit' },
    ];
  }

  if (key.includes('steam turbine')) {
    return [
      { type: 'cylinder', position: [-1.75, 1.55, 0], args: [0.72, 0.72, 1.9, 24], color: '#ef4444', opacity: 0.72, label: 'Bug‘ qozoni', partId: 'boiler' },
      { type: 'cylinder', position: [-0.95, 2.35, 0], rotation: [0, 0, Math.PI / 2], args: [0.16, 0.16, 1.0, 16], color: '#f97316', partId: 'boiler', animation: 'pulse_scale', animationSpeed: 2.2, animationAmp: 0.12 },
      { type: 'cylinder', position: [-0.15, 1.75, 0], rotation: [0, 0, Math.PI / 2], args: [0.48, 0.48, 0.25, 24], color: '#94a3b8', label: 'Turbina parraklari', partId: 'turbine_blades', animation: 'spin', animationAxis: 'x', animationSpeed: 3.2, animationPivot: [0, 1.75, 0] },
      { type: 'cylinder', position: [0.25, 1.75, 0], rotation: [0, 0, Math.PI / 2], args: [0.72, 0.72, 0.25, 24], color: '#64748b', partId: 'turbine_blades', animation: 'spin', animationAxis: 'x', animationSpeed: 3.2, animationPivot: [0, 1.75, 0] },
      { type: 'cylinder', position: [0.65, 1.75, 0], rotation: [0, 0, Math.PI / 2], args: [0.94, 0.94, 0.25, 24], color: '#475569', partId: 'turbine_blades', animation: 'spin', animationAxis: 'x', animationSpeed: 3.2, animationPivot: [0, 1.75, 0] },
      { type: 'cylinder', position: [0.5, 1.75, 0], rotation: [0, 0, Math.PI / 2], args: [0.14, 0.14, 2.4, 16], color: '#1e293b', partId: 'turbine_blades', animation: 'spin', animationAxis: 'x', animationSpeed: 3.2, animationPivot: [0, 1.75, 0] },
      { type: 'rounded_box', position: [1.65, 1.75, 0], args: [0.95, 1.15, 1.15, 0.14], color: '#2563eb', label: 'Turbogenerator', partId: 'generator_unit' },
    ];
  }

  if (key.includes('wind turbine') || key.includes('turbine')) {
    return [
      { type: 'lathe', position: [0, 0.1, 0], args: [24], profile: [[0.38, 0], [0.22, 1.4], [0.14, 2.9]], color: '#e2e8f0', label: 'Tayanch minora', partId: 'tower' },
      { type: 'rounded_box', position: [0, 3.05, -0.15], args: [0.48, 0.42, 0.95, 0.1], color: '#2563eb', label: 'Generator', partId: 'nacelle_generator' },
      { type: 'sphere', position: [0, 3.05, 0.42], args: [0.2, 18, 18], color: '#f59e0b', partId: 'rotor_blades', animation: 'spin', animationAxis: 'z', animationSpeed: 1.8, animationPivot: [0, 3.05, 0.42] },
      { type: 'capsule', position: [0, 3.75, 0.42], args: [0.09, 1.2], color: '#f8fafc', label: 'Parraklar', partId: 'rotor_blades', animation: 'spin', animationAxis: 'z', animationSpeed: 1.8, animationPivot: [0, 3.05, 0.42] },
      { type: 'capsule', position: [0.62, 2.68, 0.42], rotation: [0, 0, -2.09], args: [0.09, 1.2], color: '#f8fafc', partId: 'rotor_blades', animation: 'spin', animationAxis: 'z', animationSpeed: 1.8, animationPivot: [0, 3.05, 0.42] },
      { type: 'capsule', position: [-0.62, 2.68, 0.42], rotation: [0, 0, 2.09], args: [0.09, 1.2], color: '#f8fafc', partId: 'rotor_blades', animation: 'spin', animationAxis: 'z', animationSpeed: 1.8, animationPivot: [0, 3.05, 0.42] },
    ];
  }

  if (key.includes('volcano')) {
    return [
      { type: 'cone', position: [0, 1.25, 0], args: [2.1, 2.3, 28], color: '#78350f', opacity: 0.78, label: 'Vulqon konusi', partId: 'magma_chamber' },
      { type: 'sphere', position: [0, 0.45, 0], args: [0.78, 20, 20], color: '#ef4444', label: 'Magma o‘chog‘i', partId: 'magma_chamber' },
      { type: 'cylinder', position: [0, 1.45, 0], args: [0.22, 0.28, 1.85, 16], color: '#f97316', label: 'Vulqon bo‘g‘zi', partId: 'conduit' },
      { type: 'sphere', position: [0, 2.65, 0], args: [0.45, 18, 18], color: '#f59e0b', label: 'Krater va lava', partId: 'crater_eruption' },
    ];
  }

  if (key === 'car') {
    return [
      { type: 'rounded_box', position: [0, 0.85, 0], args: [3.0, 0.65, 1.45, 0.14], color: '#2563eb', label: 'Kuzov', partId: 'chassis' },
      { type: 'rounded_box', position: [-0.15, 1.38, 0], args: [1.55, 0.56, 1.25, 0.14], color: '#93c5fd', partId: 'chassis' },
      { type: 'box', position: [1.05, 0.92, 0], args: [0.65, 0.45, 1.0], color: '#f59e0b', label: 'Dvigatel', partId: 'engine_bay' },
      { type: 'torus', position: [-0.95, 0.42, 0.72], args: [0.34, 0.12, 14, 24], color: '#1e293b', label: 'G‘ildiraklar', partId: 'wheels' },
      { type: 'torus', position: [0.95, 0.42, 0.72], args: [0.34, 0.12, 14, 24], color: '#1e293b', partId: 'wheels' },
      { type: 'torus', position: [-0.95, 0.42, -0.72], args: [0.34, 0.12, 14, 24], color: '#1e293b', partId: 'wheels' },
      { type: 'torus', position: [0.95, 0.42, -0.72], args: [0.34, 0.12, 14, 24], color: '#1e293b', partId: 'wheels' },
    ];
  }

  if (key.includes('airplane')) {
    return [
      { type: 'capsule', position: [0, 1.45, 0], rotation: [0, 0, Math.PI / 2], args: [0.38, 2.7], color: '#f8fafc', label: 'Fyuzelyaj', partId: 'fuselage' },
      { type: 'box', position: [0.1, 1.42, 0], args: [0.85, 0.09, 3.6], color: '#2563eb', label: 'Qanotlar', partId: 'wings' },
      { type: 'cone', position: [-1.45, 1.95, 0], rotation: [0, 0, -0.2], args: [0.22, 0.85, 12], color: '#ef4444', label: 'Dum va dvigatel', partId: 'tail_engine' },
      { type: 'cylinder', position: [0.15, 1.18, 0.95], rotation: [0, 0, Math.PI / 2], args: [0.18, 0.18, 0.65, 16], color: '#f59e0b', partId: 'tail_engine' },
      { type: 'cylinder', position: [0.15, 1.18, -0.95], rotation: [0, 0, Math.PI / 2], args: [0.18, 0.18, 0.65, 16], color: '#f59e0b', partId: 'tail_engine' },
    ];
  }

  if (key.includes('solar panel')) {
    return [
      { type: 'sphere', position: [-1.55, 3.2, -0.6], args: [0.42, 22, 22], color: '#facc15', label: 'Quyosh nuri', partId: 'pv_cells', animation: 'pulse_scale', animationSpeed: 1.6, animationAmp: 0.14 },
      { type: 'rounded_box', position: [-0.35, 1.85, 0], rotation: [0.45, 0, 0], args: [2.4, 0.14, 1.5, 0.05], color: '#1d4ed8', label: 'PV Kremniy paneli', partId: 'pv_cells' },
      { type: 'cylinder', position: [-0.35, 1.0, 0], args: [0.12, 0.16, 1.6, 16], color: '#64748b', partId: 'pv_cells' },
      { type: 'rounded_box', position: [1.35, 1.15, 0], args: [0.75, 0.85, 0.6, 0.08], color: '#f1f5f9', label: 'Inverter (DC→AC)', partId: 'inverter' },
      { type: 'rounded_box', position: [2.25, 1.15, 0], args: [0.65, 1.1, 0.65, 0.08], color: '#2563eb', label: 'Elektr tarmog‘i', partId: 'grid_load' },
    ];
  }

  if (key.includes('solenoid') || key.includes('electromagnet')) {
    return [
      { type: 'cylinder', position: [0, 1.6, 0], rotation: [0, 0, Math.PI / 2], args: [0.42, 0.42, 2.8, 24], color: '#64748b', label: 'Temir o‘zak', partId: 'core' },
      { type: 'torus', position: [-0.9, 1.6, 0], rotation: [0, Math.PI / 2, 0], args: [0.56, 0.1, 12, 28], color: '#f59e0b', label: 'Mis g‘altak', partId: 'winding' },
      { type: 'torus', position: [-0.45, 1.6, 0], rotation: [0, Math.PI / 2, 0], args: [0.56, 0.1, 12, 28], color: '#fbbf24', partId: 'winding' },
      { type: 'torus', position: [0, 1.6, 0], rotation: [0, Math.PI / 2, 0], args: [0.56, 0.1, 12, 28], color: '#f59e0b', partId: 'winding' },
      { type: 'torus', position: [0.45, 1.6, 0], rotation: [0, Math.PI / 2, 0], args: [0.56, 0.1, 12, 28], color: '#fbbf24', partId: 'winding' },
      { type: 'torus', position: [0.9, 1.6, 0], rotation: [0, Math.PI / 2, 0], args: [0.56, 0.1, 12, 28], color: '#f59e0b', partId: 'winding' },
      { type: 'ring', position: [0, 1.6, 0], args: [1.55, 0.04, 12, 48], color: '#3b82f6', label: 'Magnit maydon (B)', partId: 'magnetic_field', animation: 'pulse_scale', animationSpeed: 1.8, animationAmp: 0.09 },
    ];
  }

  if (key.includes('capacitor') || key.includes('rlc')) {
    return [
      { type: 'box', position: [-0.95, 1.75, 0], args: [0.16, 1.65, 1.35], color: '#ef4444', label: 'Musbat qoplama', partId: 'plates' },
      { type: 'box', position: [-0.35, 1.75, 0], args: [0.16, 1.65, 1.35], color: '#3b82f6', label: 'Manfiy qoplama', partId: 'plates' },
      { type: 'box', position: [-0.65, 1.75, 0], args: [0.32, 1.5, 1.2], color: '#bae6fd', opacity: 0.45, partId: 'plates', animation: 'pulse_scale', animationSpeed: 2.0, animationAmp: 0.08 },
      { type: 'torus', position: [1.15, 2.05, 0], rotation: [Math.PI / 2, 0, 0], args: [0.42, 0.09, 12, 24], color: '#f59e0b', label: 'Induktivlik (L)', partId: 'inductor' },
      { type: 'torus', position: [1.15, 1.65, 0], rotation: [Math.PI / 2, 0, 0], args: [0.42, 0.09, 12, 24], color: '#d97706', partId: 'inductor' },
      { type: 'torus', position: [1.15, 1.25, 0], rotation: [Math.PI / 2, 0, 0], args: [0.42, 0.09, 12, 24], color: '#f59e0b', partId: 'inductor' },
      { type: 'cylinder', position: [0.35, 0.65, 0], args: [0.38, 0.38, 0.25, 24], color: '#facc15', label: 'O‘zgaruvchan manba', partId: 'ac_source' },
    ];
  }

  if (key.includes('prism')) {
    return [
      { type: 'cylinder', position: [-1.75, 1.45, 0], rotation: [0, 0, Math.PI / 2 + 0.25], args: [0.06, 0.06, 1.6, 12], color: '#f8fafc', label: 'Oq yorug‘lik', partId: 'incident_ray' },
      { type: 'cone', position: [0, 1.55, 0], args: [1.15, 2.0, 3], color: '#bae6fd', opacity: 0.58, label: 'Shisha prizma', partId: 'glass_prism' },
      { type: 'cylinder', position: [1.65, 1.75, 0], rotation: [0, 0, Math.PI / 2 - 0.12], args: [0.05, 0.05, 1.8, 12], color: '#ef4444', label: 'Dispersiya spektri', partId: 'spectrum' },
      { type: 'cylinder', position: [1.65, 1.45, 0], rotation: [0, 0, Math.PI / 2 - 0.22], args: [0.05, 0.05, 1.8, 12], color: '#22c55e', partId: 'spectrum' },
      { type: 'cylinder', position: [1.65, 1.15, 0], rotation: [0, 0, Math.PI / 2 - 0.32], args: [0.05, 0.05, 1.8, 12], color: '#8b5cf6', partId: 'spectrum' },
    ];
  }

  return undefined;
}
