import { compile, derivative, simplify } from 'mathjs';
import type { QuadricTemplate, SliderDef, TutorLesson } from '../types/tutor.js';

const KNOWN_CHEMICALS: Array<{
  patterns: RegExp[];
  compound: string;
  formula: string;
  titleUz: string;
  descUz: string;
}> = [
  {
    patterns: [/\bh2so4\b/i, /sulfat\s*kislota/i],
    compound: 'Sulfuric acid',
    formula: 'H2SO4',
    titleUz: 'Sulfat kislota (H₂SO₄) 3D molekulasi',
    descUz: "Kuchli ikki asosli mineral kislota. Markaziy oltingugurt atomi tetraedrik tarzda to'rtta kislorod atomi bilan bog'langan.",
  },
  {
    patterns: [/\bh2o\b/i, /\bsuv\b/i, /water/i],
    compound: 'Water',
    formula: 'H2O',
    titleUz: 'Suv (H₂O) 3D molekulasi',
    descUz: "Suv molekulasi burchakli tuzilishga ega bo'lib, H-O-H bog'lanish burchagi 104.5° ga teng.",
  },
  {
    patterns: [/\bco2\b/i, /karbonat\s*angidrid/i],
    compound: 'Carbon dioxide',
    formula: 'CO2',
    titleUz: 'Karbonat angidrid (CO₂) 3D molekulasi',
    descUz: "Chiziqli tuzilishga (180°) ega molekula; uglerod atomi ikki kislorod bilan qo'shbog' hosil qiladi.",
  },
  {
    patterns: [/\bch4\b/i, /\bmetan\b/i, /methane/i],
    compound: 'Methane',
    formula: 'CH4',
    titleUz: 'Metan (CH₄) tetraedrik 3D molekulasi',
    descUz: "Eng oddiy alkan. Uglerod atomi markazda, vodorod atomlari 109.5° burchak ostida tetraedr uchlarida joylashgan.",
  },
  {
    patterns: [/\bnh3\b/i, /\bammiak\b/i, /ammonia/i],
    compound: 'Ammonia',
    formula: 'NH3',
    titleUz: 'Ammiak (NH₃) 3D molekulasi',
    descUz: "Uchburchakli piramidal tuzilishga ega; azot atomining taqsimlanmagan elektron jufti burchakni 107° ga siqadi.",
  },
  {
    patterns: [/\bc6h6\b/i, /\bbenzol\b/i, /benzene/i],
    compound: 'Benzene',
    formula: 'C6H6',
    titleUz: 'Benzol (C₆H₆) aromatik halqa molekulasi',
    descUz: "Olti uglerod atomidan tashkil topgan tekis muntazam oltiburchakli aromatik halqa.",
  },
  {
    patterns: [/\bc2h5oh\b/i, /\betanol\b/i, /ethanol/i],
    compound: 'Ethanol',
    formula: 'C2H5OH',
    titleUz: 'Etanol (C₂H₅OH) 3D molekulasi',
    descUz: "Bir atomli to'yingan spirt; tarkibida qutbli -OH gidroksil guruhi mavjud.",
  },
  {
    patterns: [/caffeine/i, /kofein/i, /c8h10n4o2/i],
    compound: 'Caffeine',
    formula: 'C8H10N4O2',
    titleUz: 'Kofein (C₈H₁₀N₄O₂) 3D molekulasi',
    descUz: "Purin alkaloidi bo'lib, ikkita tutashgan halqali tuzilishga ega.",
  },
  {
    patterns: [/aspirin/i, /c9h8o4/i],
    compound: 'Aspirin',
    formula: 'C9H8O4',
    titleUz: 'Aspirin (Atsetilsalitsil kislota) 3D molekulasi',
    descUz: "Keng qo'llaniladigan yallig'lanishga qarshi va og'riq qoldiruvchi organik birikma.",
  },
  {
    patterns: [/glucose/i, /glyukoza/i, /glukoza/i, /c6h12o6/i],
    compound: 'Glucose',
    formula: 'C6H12O6',
    titleUz: 'Glyukoza (C₆H₁₂O₆) 3D molekulasi',
    descUz: "Tirik organizmlarning asosiy energiya manbai bo'lgan monosaxarid.",
  },
];

const KNOWN_PDB_DESCRIPTIONS: Record<string, string> = {
  '1ZNI': 'Insulin oqsili geksamer tuzilishi',
  '1A3N': 'Odam gemoglobini (kislorod tashuvchi oqsil)',
  '1BNA': 'B-DNK qo‘sh spirali (12 juft nukleotid)',
  '4HHB': 'Deoksigemoglobin oqsili tuzilishi',
  '6LU7': 'Koronavirus asosiy proteazasi',
};

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : Number(n.toFixed(3)).toString();
}

function normalizeMathExpr(raw: string): string {
  return raw
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/(\d)([a-zA-Z(])/g, '$1*$2')
    .replace(/\)\(/g, ')*(')
    .replace(/\b([xy])([a-zA-Z])/g, '$1*$2')
    .trim();
}

function findRealRoots(exprStr: string, xMin = -10, xMax = 10): number[] {
  const roots: number[] = [];
  try {
    const compiled = compile(exprStr);
    const steps = 400;
    const dx = (xMax - xMin) / steps;
    let prevX = xMin;
    let prevY = Number(compiled.evaluate({ x: prevX }));

    for (let i = 1; i <= steps; i++) {
      const currX = xMin + i * dx;
      const currY = Number(compiled.evaluate({ x: currX }));
      if (Number.isFinite(prevY) && Number.isFinite(currY)) {
        if (Math.abs(currY) < 1e-6) {
          if (!roots.some((r) => Math.abs(r - currX) < 0.05)) {
            roots.push(Number(currX.toFixed(3)));
          }
        } else if (prevY * currY < 0) {
          // Bisection refinement
          let lo = prevX;
          let hi = currX;
          let fLo = prevY;
          for (let iter = 0; iter < 24; iter++) {
            const mid = (lo + hi) / 2;
            const fMid = Number(compiled.evaluate({ x: mid }));
            if (fLo * fMid <= 0) {
              hi = mid;
            } else {
              lo = mid;
              fLo = fMid;
            }
          }
          const root = Number(((lo + hi) / 2).toFixed(3));
          if (!roots.some((r) => Math.abs(r - root) < 0.05)) {
            roots.push(root);
          }
        }
      }
      prevX = currX;
      prevY = currY;
    }
  } catch {
    return [];
  }
  return roots.slice(0, 6);
}

export function tryLocalDeterministicParse(rawQuery: string): TutorLesson | null {
  const t0 = performance.now();
  const query = rawQuery.trim();
  if (!query) return null;

  // Never hijack conceptual/natural-language questions (e.g. "parabola nima?", "hosila qanday topiladi?")
  // Let the real Gemini API sense the student's level and build a tailored pedagogical lesson!
  if (
    /[?]/.test(query) ||
    /\b(nima|qanday|qanaqa|nega|nimaga|tushuntir|farqi|qayerda|misol|haqida|tarifi|ta'rifi)\b/i.test(
      query
    )
  ) {
    return null;
  }

  // 1. Check explicit 4-char PDB ID (e.g. "1ZNI", "PDB 1BNA", "1A3N oqsili")
  const pdbMatch = query.match(/\b([1-9][A-Za-z0-9]{3})\b/);
  if (
    pdbMatch &&
    (/\d/.test(pdbMatch[1][0]) && /[A-Za-z]/.test(pdbMatch[1].slice(1))) &&
    query.length <= 42
  ) {
    const pdbId = pdbMatch[1].toUpperCase();
    const desc = KNOWN_PDB_DESCRIPTIONS[pdbId] || `${pdbId} makromolekulasi`;
    return {
      topic_title: `${desc} (PDB: ${pdbId})`,
      subject: 'chemistry',
      engine: 'pdb',
      source: 'local-parser',
      latency_ms: Math.max(1, Math.round(performance.now() - t0)),
      sliders: [],
      steps: [
        {
          step_number: 1,
          step_title: `1. ${pdbId} tuzilmasini RCSB PDB bazasidan yuklash`,
          speech_text: `${pdbId} kodli oqsil yoki nuklein kislota tuzilmasini Protein Data Bank ochiq bazasidan yuklab, 3D lentasimon ko'rinishda ochamiz.`,
          katex_formulas: [`\\text{PDB ID: } \\mathbf{${pdbId}}`],
          explanation_uz: `${desc}. Sichqoncha bilan aylantirib va kattalashtirib ikkilamchi spiral tuzilishini o'rganing.`,
          emoji_emotion: 'explaining',
          render_params: { pdb_id: pdbId, style: 'cartoon' },
        },
        {
          step_number: 2,
          step_title: '2. Atomlararo kimyoviy bog‘lar (Stick rejimi)',
          speech_text: `Endi molekulaning atom skeleti va aminokislota zanjirlaridagi kimyoviy bog'lanishlarni yaqindan ko'ramiz.`,
          katex_formulas: [`\\text{Bog'lanishlar: } \\text{C}-\\text{N},\\; \\text{C}=\\text{O}`],
          explanation_uz: `Stick ko'rinishida har bir atom va kovalent bog' aniq ajralib turadi.`,
          emoji_emotion: 'pointing',
          render_params: { pdb_id: pdbId, style: 'stick' },
        },
        {
          step_number: 3,
          step_title: '3. Molekulyar sirt (Surface rejimi)',
          speech_text: `Tashqi molekulyar sirt oqsilning boshqa molekulalar bilan qanday ta'sirlashishini ko'rsatadi.`,
          katex_formulas: [`\\text{Van-der-Vaals sirti}`],
          explanation_uz: `Molekulyar cho'ntaklar va faol markazlar aynan tashqi sirtda joylashadi.`,
          emoji_emotion: 'happy',
          render_params: { pdb_id: pdbId, style: 'surface' },
        },
      ],
    };
  }

  // 2. Check known chemical formulas / compound names
  for (const chem of KNOWN_CHEMICALS) {
    if (chem.patterns.some((rx) => rx.test(query))) {
      return {
        topic_title: chem.titleUz,
        subject: 'chemistry',
        engine: 'pubchem',
        source: 'local-parser',
        latency_ms: Math.max(1, Math.round(performance.now() - t0)),
        sliders: [],
        steps: [
          {
            step_number: 1,
            step_title: `1. ${chem.formula} fazoviy tuzilishi`,
            speech_text: `${chem.titleUz} — ${chem.descUz}`,
            katex_formulas: [`\\text{Formula: } \\mathbf{${chem.formula.replace(/(\d+)/g, '_$1')}}`],
            explanation_uz: chem.descUz,
            emoji_emotion: 'explaining',
            render_params: {
              compound: chem.compound,
              formula: chem.formula,
              style: 'ballstick',
            },
          },
          {
            step_number: 2,
            step_title: '2. Kovalent bog‘lar karkasi',
            speech_text: `Atomlar orasidagi barcha kimyoviy bog'larni tayoqcha modelida ko'rib chiqamiz.`,
            katex_formulas: [`\\text{PubChem 3D Konformer}`],
            explanation_uz: `Sichqoncha bilan aylantirib, valent burchaklarni har tomondan kuzating.`,
            emoji_emotion: 'pointing',
            render_params: {
              compound: chem.compound,
              formula: chem.formula,
              style: 'stick',
            },
          },
          {
            step_number: 3,
            step_title: '3. Elektron bulut hajmiy modeli',
            speech_text: `Sferik model molekulaning haqiqiy fazoviy hajmini namoyish etadi.`,
            katex_formulas: [`\\text{CPK sferik modeli}`],
            explanation_uz: `Har bir rang kimyoviy element turini bildiradi (C - kulrang, H - oq, O - qizil, N - ko'k, S - sariq).`,
            emoji_emotion: 'happy',
            render_params: {
              compound: chem.compound,
              formula: chem.formula,
              style: 'sphere',
            },
          },
        ],
      };
    }
  }

  // 3. Check Uzbek geometry: triangle with 3 sides ("tomonlari 5, 6, 7 uchburchak")
  const triMatch = query.match(/(?:tomonlari\s*)?(\d+(?:\.\d+)?)\s*[,;\s]+\s*(\d+(?:\.\d+)?)\s*[,;\s]+\s*(\d+(?:\.\d+)?)\s*(?:sm|m|cm)?\s*(?:li\s*)?uchburchak/i)
    || query.match(/uchburchak.*?(\d+(?:\.\d+)?)\s*[,;\s]+\s*(\d+(?:\.\d+)?)\s*[,;\s]+\s*(\d+(?:\.\d+)?)/i);
  if (triMatch) {
    const a = parseFloat(triMatch[1]);
    const b = parseFloat(triMatch[2]);
    const c = parseFloat(triMatch[3]);
    const valid = a + b > c && a + c > b && b + c > a;
    if (valid) {
      const p = (a + b + c) / 2;
      const area = Math.sqrt(p * (p - a) * (p - b) * (p - c));
      const angleC = (Math.acos((a * a + b * b - c * c) / (2 * a * b)) * 180) / Math.PI;
      return {
        topic_title: `Tomonlari ${a}, ${b}, ${c} bo'lgan uchburchak tahlili`,
        subject: 'geometry',
        engine: 'svg2d',
        source: 'local-parser',
        latency_ms: Math.max(1, Math.round(performance.now() - t0)),
        sliders: [
          { id: 'a', label: 'a tomoni', min: 2, max: 15, step: 0.5, default: a, unit: 'sm' },
          { id: 'b', label: 'b tomoni', min: 2, max: 15, step: 0.5, default: b, unit: 'sm' },
          { id: 'c', label: 'c tomoni', min: 2, max: 15, step: 0.5, default: c, unit: 'sm' },
        ],
        steps: [
          {
            step_number: 1,
            step_title: '1. Uchburchak tengsizligini tekshirish',
            speech_text: `Tomonlari ${a}, ${b} va ${c} bo'lgan uchburchak yasash mumkin, chunki ixtiyoriy ikki tomon yig'indisi uchinchi tomondan katta.`,
            katex_formulas: [
              `${a} + ${b} > ${c},\\quad ${a} + ${c} > ${b},\\quad ${b} + ${c} > ${a}`,
              `P = a + b + c = ${formatNum(a + b + c)}`,
            ],
            explanation_uz: `Perimetr uchala tomon uzunliklari yig'indisiga teng.`,
            emoji_emotion: 'explaining',
            render_params: { kind: 'triangle', a, b, c },
          },
          {
            step_number: 2,
            step_title: '2. Geron formulasi bilan yuzani topish',
            speech_text: `Yarim perimetr p ni topamiz: p teng ${formatNum(p)}. So'ngra Geron formulasi orqali uchburchak yuzasi ${formatNum(area)} ga teng chiqadi.`,
            katex_formulas: [
              `p = \\frac{a+b+c}{2} = ${formatNum(p)}`,
              `S = \\sqrt{p(p-a)(p-b)(p-c)} \\approx ${formatNum(area)}`,
            ],
            live_formula_expressions: [
              { label: 'Yarim perimetr', latex_lhs: 'p', expr: '(a + b + c) / 2', unit: 'sm' },
              {
                label: 'Geron yuzasi',
                latex_lhs: 'S',
                expr: 'sqrt(max(0, ((a+b+c)/2)*(((a+b+c)/2)-a)*(((a+b+c)/2)-b)*(((a+b+c)/2)-c)))',
                unit: 'sm²',
              },
            ],
            explanation_uz: `Slayderlardan tomonlarni o'zgartirsangiz ham chizma va yuza avtomatik hisoblanadi.`,
            emoji_emotion: 'happy',
            render_params: { kind: 'triangle', a, b, c, highlight: ['area'] },
          },
          {
            step_number: 3,
            step_title: '3. Kosinuslar teoremasi bo‘yicha burchak',
            speech_text: `c tomon qarshisidagi gamma burchak kosinuslar teoremasi yordamida ${formatNum(angleC)} gradusga teng ekanini ko'ramiz.`,
            katex_formulas: [
              `\\cos \\gamma = \\frac{a^2 + b^2 - c^2}{2ab}`,
              `\\gamma \\approx ${formatNum(angleC)}^\\circ`,
            ],
            explanation_uz: `Barcha ichki burchaklar yig'indisi har doim 180 gradusga teng.`,
            emoji_emotion: 'pointing',
            render_params: { kind: 'triangle', a, b, c, highlight: ['angle'] },
          },
        ],
      };
    }
  }

  // 3b. Uzbek Regular N-gon Polygon ("6 burchakni chiz", "6-burchak", "oltiburchak", "beshburchak", "ko'pburchak")
  const is3dPolyhedron = /\b(piramida|prizma|konus|silindr|kub|sfera|shar)\b/i.test(query);
  if (!is3dPolyhedron) {
    const UZ_WORD_SIDES: Array<[RegExp, number]> = [
      [/\b(o['ʻ‘`]?n\s*ikki\s*burchak|dodekagon)\b/i, 12],
      [/\b(o['ʻ‘`]?n\s*burchak|dekagon)\b/i, 10],
      [/\b(to['ʻ‘`]?qqiz\s*burchak|nonagon)\b/i, 9],
      [/\b(sakkiz\s*burchak|oktagon|octagon)\b/i, 8],
      [/\b(yetti\s*burchak|geptagon|heptagon)\b/i, 7],
      [/\b(olti\s*burchak|geksagon|hexagon)\b/i, 6],
      [/\b(besh\s*burchak|pentagon)\b/i, 5],
      [/\b(to['ʻ‘`]?rt\s*burchak|kvadrat)\b/i, 4],
      [/\b(teng\s+tomonli\s+uch\s*burchak)\b/i, 3],
    ];

    let detectedSides: number | null = null;
    const numPolygonMatch = query.match(
      /\b(\d{1,2})\s*[-\s]?\s*burchak(?:ni|ning|lar|li|ka|ga|dan)?\b/i
    );
    if (numPolygonMatch) {
      const parsedN = parseInt(numPolygonMatch[1], 10);
      if (parsedN >= 3 && parsedN <= 16) {
        detectedSides = parsedN;
      }
    }
    if (detectedSides === null) {
      for (const [rx, nVal] of UZ_WORD_SIDES) {
        if (rx.test(query)) {
          detectedSides = nVal;
          break;
        }
      }
    }

    if (detectedSides !== null) {
      const n = detectedSides;
      const sideMatch = query.match(
        /(?:tomoni|a\s*=)\s*(\d+(?:\.\d+)?)\s*(?:sm|m|cm)?/i
      );
      const sideLen = sideMatch ? Math.max(1, Math.min(12, parseFloat(sideMatch[1]))) : 4;
      const interiorAngle = ((n - 2) * 180) / n;
      const centralAngle = 360 / n;
      const diagCount = (n * (n - 3)) / 2;
      const perimeter = n * sideLen;
      const area = (n * sideLen * sideLen) / (4 * Math.tan(Math.PI / n));

      const wrongAngle1 = Math.round(interiorAngle - 15);
      const wrongAngle2 = Math.round(interiorAngle + 30);

      return {
        topic_title: `Muntazam ${n}-burchak chizmasi va xossalari`,
        subject: 'geometry',
        engine: 'svg2d',
        source: 'local-parser',
        latency_ms: Math.max(1, Math.round(performance.now() - t0)),
        sliders: [
          { id: 'sides', label: 'Tomonlar soni (n)', min: 3, max: 12, step: 1, default: n, unit: 'ta' },
          { id: 'a', label: 'Tomon uzunligi (a)', min: 2, max: 10, step: 0.5, default: sideLen, unit: 'sm' },
        ],
        steps: [
          {
            step_number: 1,
            step_title: `1. Muntazam ${n}-burchakni chizish`,
            speech_text: `Barcha ${n} ta tomoni va burchaklari o'zaro teng bo'lgan muntazam ${n}-burchakni uchlaridan boshlab ketma-ket chizamiz. Perimetri n ko'paytirilgan a ga teng.`,
            katex_formulas: [
              `n = ${n},\\quad a = ${formatNum(sideLen)}`,
              `P = n \\cdot a = ${formatNum(perimeter)}`,
            ],
            live_formula_expressions: [
              { label: 'Perimetr', latex_lhs: 'P', expr: 'sides * a', unit: 'sm' },
            ],
            explanation_uz: `Slayder orqali tomonlar sonini (n) o'zgartirib, uchburchakdan o'n ikki burchakkacha kuzating.`,
            emoji_emotion: 'explaining',
            render_params: { kind: 'polygon', sides: n, a: sideLen },
          },
          {
            step_number: 2,
            step_title: '2. Ichki va markaziy burchaklar',
            speech_text: `Muntazam ${n}-burchakning har bir ichki burchagi ${formatNum(interiorAngle)} gradusga, markaziy burchagi esa ${formatNum(centralAngle)} gradusga teng.`,
            katex_formulas: [
              `\\alpha = \\frac{(n - 2) \\cdot 180^\\circ}{n} = ${formatNum(interiorAngle)}^\\circ`,
              `\\beta = \\frac{360^\\circ}{n} = ${formatNum(centralAngle)}^\\circ`,
            ],
            live_formula_expressions: [
              {
                label: 'Ichki burchak',
                latex_lhs: '\\alpha',
                expr: '((sides - 2) * 180) / sides',
                unit: '°',
              },
            ],
            explanation_uz: `Tomonlar soni ortgan sari ichki burchak kattalashib, shakl aylanaga yaqinlashadi.`,
            emoji_emotion: 'pointing',
            render_params: { kind: 'polygon', sides: n, a: sideLen, highlight: ['angles'] },
          },
          {
            step_number: 3,
            step_title: '3. Diagonallar soni va yuza formulasi',
            speech_text: `${n}-burchakda jami ${diagCount} ta diagonal mavjud. Umumiy yuzasi esa ${formatNum(area)} kvadrat birlikka teng.`,
            katex_formulas: [
              `D = \\frac{n(n - 3)}{2} = ${diagCount}`,
              `S = \\frac{n \\cdot a^2}{4 \\tan(\\pi / n)} \\approx ${formatNum(area)}`,
            ],
            live_formula_expressions: [
              {
                label: 'Diagonallar',
                latex_lhs: 'D',
                expr: '(sides * (sides - 3)) / 2',
                unit: 'ta',
              },
              {
                label: 'Yuza',
                latex_lhs: 'S',
                expr: '(sides * a^2) / (4 * tan(pi / sides))',
                unit: 'sm²',
              },
            ],
            explanation_uz: `Markazdan tomonga tushirilgan perpendikulyar ichki chizilgan aylana radiusi (apofema) hisoblanadi.`,
            emoji_emotion: 'happy',
            render_params: {
              kind: 'polygon',
              sides: n,
              a: sideLen,
              highlight: ['angles', 'diagonals', 'apothem'],
            },
          },
          {
            step_number: 4,
            step_title: '4. Bilimni tekshirish (Mini-test)',
            speech_text: `Endi bilimingizni tekshirib ko'ramiz! Muntazam ${n}-burchakning bitta ichki burchagi necha gradusga teng?`,
            katex_formulas: [`\\alpha = \\frac{(${n} - 2) \\cdot 180^\\circ}{${n}} = ?`],
            explanation_uz: `To'g'ri javobni tanlang va natijani tekshiring.`,
            emoji_emotion: 'encouraging',
            render_params: {
              kind: 'polygon',
              sides: n,
              a: sideLen,
              highlight: ['angles'],
            },
            quiz: {
              question: `Muntazam ${n}-burchakning bitta ichki burchagi necha gradus?`,
              options: [
                `${formatNum(interiorAngle)}°`,
                `${wrongAngle1}°`,
                `${wrongAngle2}°`,
              ],
              correct_index: 0,
              explanation_uz: `Formula bo'yicha: (${n} − 2) × 180° / ${n} = ${formatNum(interiorAngle)}°.`,
            },
          },
        ],
      };
    }
  }

  // 4. Circle query ("radiusi 6 aylana")
  const circleMatch = query.match(/(?:radiusi|r\s*=)\s*(\d+(?:\.\d+)?)\s*(?:sm|m)?\s*(?:li\s*)?(?:aylana|doira)/i)
    || query.match(/(?:aylana|doira).*?(?:radiusi|r\s*=)\s*(\d+(?:\.\d+)?)/i);
  if (circleMatch) {
    const r = parseFloat(circleMatch[1]);
    return {
      topic_title: `Radiusi r = ${r} bo'lgan aylana va doira`,
      subject: 'geometry',
      engine: 'svg2d',
      source: 'local-parser',
      latency_ms: Math.max(1, Math.round(performance.now() - t0)),
      sliders: [
        { id: 'radius', label: 'Radius (r)', min: 1, max: 12, step: 0.5, default: r, unit: 'sm' },
        { id: 'angle_deg', label: 'Sektor burchagi (α)', min: 30, max: 360, step: 15, default: 90, unit: '°' },
      ],
      steps: [
        {
          step_number: 1,
          step_title: '1. Aylana uzunligi va diametri',
          speech_text: `Radiusi ${r} ga teng aylananing diametri ikki r, uzunligi esa ikki pi r formula bilan hisoblanadi.`,
          katex_formulas: [
            `d = 2r = ${formatNum(2 * r)}`,
            `L = 2\\pi r \\approx ${formatNum(2 * Math.PI * r)}`,
          ],
          live_formula_expressions: [
            { label: 'Aylana uzunligi', latex_lhs: 'L', expr: '2 * pi * radius', unit: 'sm' },
          ],
          explanation_uz: `Pi soni taxminan 3.14159 ga teng.`,
          emoji_emotion: 'explaining',
          render_params: { kind: 'circle', radius: r, angle_deg: 90 },
        },
        {
          step_number: 2,
          step_title: '2. Doira va sektor yuzasi',
          speech_text: `Doiraning to'liq yuzi pi r kvadratga teng. Sektor yuzasi esa markaziy burchak ulushiga proporsional bo'ladi.`,
          katex_formulas: [
            `S = \\pi r^2 \\approx ${formatNum(Math.PI * r * r)}`,
            `S_{\\text{sektor}} = \\pi r^2 \\cdot \\frac{\\alpha}{360^\\circ}`,
          ],
          live_formula_expressions: [
            { label: 'Doira yuzi', latex_lhs: 'S', expr: 'pi * radius^2', unit: 'sm²' },
            { label: 'Sektor yuzi', latex_lhs: 'S_{\\text{sek}}', expr: 'pi * radius^2 * (angle_deg / 360)', unit: 'sm²' },
          ],
          explanation_uz: `Burchak slayderini surib, sektor yuzasining o'zgarishini kuzating.`,
          emoji_emotion: 'happy',
          render_params: { kind: 'circle', radius: r, angle_deg: 90, highlight: ['sector'] },
        },
      ],
    };
  }

  // 5. Stereometry 3D shape keywords ("konus", "silindr", "kub", "piramida")
  const shapeNums = (query.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (/\bkonus\b/i.test(query) && query.length < 60) {
    const r = shapeNums[0] ?? 4;
    const h = shapeNums[1] ?? 7;
    return {
      topic_title: `Konus va uning kesimi (r = ${r}, h = ${h})`,
      subject: 'geometry',
      engine: 'threejs',
      source: 'local-parser',
      latency_ms: Math.max(1, Math.round(performance.now() - t0)),
      sliders: [
        { id: 'radius', label: 'Asos radiusi (r)', min: 2, max: 8, step: 0.5, default: r, unit: 'sm' },
        { id: 'height', label: 'Balandlik (h)', min: 3, max: 12, step: 0.5, default: h, unit: 'sm' },
        { id: 'cut_ratio', label: 'Kesim nisbati (k)', min: 0.2, max: 0.85, step: 0.05, default: 0.55, unit: '' },
      ],
      steps: [
        {
          step_number: 1,
          step_title: '1. Konus asosi va yasovchisi',
          speech_text: `Konus — to'g'ri burchakli uchburchakni kateti atrofida aylantirishdan hosil bo'lgan 3D jism. Asos radiusi ${r}, balandligi ${h}.`,
          katex_formulas: ['S_{\\text{asos}} = \\pi r^2', 'l = \\sqrt{r^2 + h^2}'],
          live_formula_expressions: [
            { label: 'Yasovchi', latex_lhs: 'l', expr: 'sqrt(radius^2 + height^2)', unit: 'sm' },
          ],
          explanation_uz: `Pifagor teoremasi orqali konus yasovchisi l ni topamiz.`,
          emoji_emotion: 'explaining',
          camera: [8.5, 6.2, 9.5],
          render_params: { shape: 'cone', radius: r, height: h, show_height: true, show_cross_section: false },
        },
        {
          step_number: 2,
          step_title: '2. Asosga parallel doiraviy kesim',
          speech_text: `Konusni asosga parallel tekislik bilan kesganda radiusi k ko'paytirilgan r ga teng kichik doira hosil bo'ladi.`,
          katex_formulas: ['r_{\\text{kesim}} = k \\cdot r', 'S_{\\text{yon}} = \\pi r l', 'V = \\frac{1}{3}\\pi r^2 h'],
          live_formula_expressions: [
            { label: 'Yon sirt', latex_lhs: 'S_{\\text{yon}}', expr: 'pi * radius * sqrt(radius^2 + height^2)', unit: 'sm²' },
            { label: 'Konus hajmi', latex_lhs: 'V', expr: '(1/3) * pi * radius^2 * height', unit: 'sm³' },
          ],
          explanation_uz: `Slayderlar orqali radius, balandlik va kesim darajasini jonli boshqaring.`,
          emoji_emotion: 'happy',
          camera: [9.0, 7.5, 8.8],
          render_params: { shape: 'cone', radius: r, height: h, cut_ratio: 0.55, show_height: true, show_cross_section: true },
        },
      ],
    };
  }

  if (/\b(silindr|tsilindr)\b/i.test(query) && query.length < 60) {
    const r = shapeNums[0] ?? 3.5;
    const h = shapeNums[1] ?? 7;
    return {
      topic_title: `To'g'ri doiraviy silindr (r = ${r}, h = ${h})`,
      subject: 'geometry',
      engine: 'threejs',
      source: 'local-parser',
      latency_ms: Math.max(1, Math.round(performance.now() - t0)),
      sliders: [
        { id: 'radius', label: 'Radius (r)', min: 1.5, max: 7, step: 0.5, default: r, unit: 'sm' },
        { id: 'height', label: 'Balandlik (h)', min: 3, max: 12, step: 0.5, default: h, unit: 'sm' },
        { id: 'cut_ratio', label: 'Kesim balandligi', min: 0.15, max: 0.85, step: 0.05, default: 0.5, unit: '' },
      ],
      steps: [
        {
          step_number: 1,
          step_title: '1. Silindr asoslari va yon sirti',
          speech_text: `Silindr ikkita teng doira asosdan va yoyilganda to'g'ri to'rtburchak beradigan yon sirtdan iborat.`,
          katex_formulas: ['S_{\\text{yon}} = 2\\pi r h', 'S_{\\text{to‘la}} = 2\\pi r(r + h)'],
          live_formula_expressions: [
            { label: 'Yon sirt', latex_lhs: 'S_{\\text{yon}}', expr: '2 * pi * radius * height', unit: 'sm²' },
          ],
          explanation_uz: `Yon sirt yuzi asos aylanasi uzunligining balandlikka ko'paytmasiga teng.`,
          emoji_emotion: 'explaining',
          camera: [8.5, 6.0, 9.2],
          render_params: { shape: 'cylinder', radius: r, height: h, show_height: true, show_cross_section: false },
        },
        {
          step_number: 2,
          step_title: '2. Silindr hajmi va kesimi',
          speech_text: `Silindr hajmi asos yuzini balandlikka ko'paytirish orqali topiladi.`,
          katex_formulas: ['V = \\pi r^2 h'],
          live_formula_expressions: [
            { label: 'Silindr hajmi', latex_lhs: 'V', expr: 'pi * radius^2 * height', unit: 'sm³' },
          ],
          explanation_uz: `Asosga parallel har qanday kesim asosga teng doira bo'ladi.`,
          emoji_emotion: 'happy',
          camera: [9.0, 7.2, 8.8],
          render_params: { shape: 'cylinder', radius: r, height: h, cut_ratio: 0.5, show_height: true, show_cross_section: true },
        },
      ],
    };
  }

  // 5b. Canonical Quadric Surfaces (10 families × x/y/z axes -> Three.js ParametricGeometry)
  const compactEq = query.toLowerCase().replace(/\s+/g, '');
  type Axis3 = 'x' | 'y' | 'z';
  interface QuadricMatch {
    template: QuadricTemplate;
    axis: Axis3;
    title: string;
    latex: string;
    introSpeech: string;
    sliceSpeech: string;
    formulaSpeech: string;
    explanation: string;
    quiz: { question: string; options: string[]; correct_index: number; explanation_uz: string };
    sliders: SliderDef[];
    defaults: { a?: number; b?: number; c?: number; radius?: number; p?: number };
  }

  const detectQuadric = (): QuadricMatch | null => {
    const qLower = query.toLowerCase();
    const axisMention: Axis3 = /\b(x\s*o['‘`]?qi|along\s*x)\b/i.test(qLower)
      ? 'x'
      : /\b(y\s*o['‘`]?qi|along\s*y)\b/i.test(qLower)
        ? 'y'
        : 'z';

    // Sphere: x^2 + y^2 + z^2 = r^2 (or numeric R^2) or "sfera"
    const sphereEq = compactEq.match(/^x\^2\+y\^2\+z\^2=(.+)$/);
    if (sphereEq || /\b(sfera|sphere)\b/i.test(qLower)) {
      const rhsNum = sphereEq && /^\d+(\.\d+)?$/.test(sphereEq[1]) ? Math.sqrt(Number(sphereEq[1])) : 2.1;
      const rVal = Number.isFinite(rhsNum) && rhsNum >= 0.6 && rhsNum <= 4 ? Number(rhsNum.toFixed(2)) : 2.1;
      return {
        template: 'sphere',
        axis: 'z',
        title: 'Sfera (3D Fazoviy sirt)',
        latex: 'x^2 + y^2 + z^2 = r^2',
        introSpeech: "Sfera — fazodagi markazdan bir xil r masofada joylashgan barcha nuqtalar to'plamidir. Avval x, y, z koordinata o'qlari va sfera karkasini chizamiz.",
        sliceSpeech: "Endi shaffof sfera sirtini va uning markaziy ekvator kesimini qo'shamiz. Har qanday tekislik bilan kesilganda aylana hosil bo'ladi.",
        formulaSpeech: "Radius slayderini o'zgartirib, sfera yuzi va hajmi r ga qanday bog'liqligini jonli kuzating.",
        explanation: "x² + y² + z² = r² tenglamasi markazi (0,0,0) va radiusi r bo'lgan sferani ifodalaydi.",
        defaults: { radius: rVal },
        sliders: [
          { id: 'radius', label: 'Radius (r)', min: 1.0, max: 3.2, step: 0.1, default: rVal, unit: '' },
        ],
        quiz: {
          question: "Sferani ixtiyoriy tekislik bilan kesganda qanday shakl hosil bo'ladi?",
          options: ['Aylana', 'Giperbola', 'Parabola'],
          correct_index: 0,
          explanation_uz: "Sfera to'liq simmetrik bo'lgani uchun har qanday kesim doimo aylana beradi.",
        },
      };
    }

    // Ellipsoid: x^2/a^2 + y^2/b^2 + z^2/c^2 = 1 or "ellipsoid"
    if (/^x\^2.*?\+y\^2.*?\+z\^2.*?=1$/.test(compactEq) || /\bellipsoid\b/i.test(qLower)) {
      return {
        template: 'ellipsoid',
        axis: 'z',
        title: 'Ellipsoid (3D Ikkinchi tartibli sirt)',
        latex: '\\frac{x^2}{a^2} + \\frac{y^2}{b^2} + \\frac{z^2}{c^2} = 1',
        introSpeech: "Ellipsoid — sferaning uchala o'q bo'ylab a, b va c yarim o'qlarga cho'zilgan umumlashmasidir. Avval koordinata o'qlari va to'rni ko'ramiz.",
        sliceSpeech: "Sirtni va asosiy koordinata tekisliklari bilan kesishgan ellips chiziqlarini chizamiz.",
        formulaSpeech: "a, b va c slayderlarini surib ellipsoidning x, y va z o'qlari bo'ylab cho'zilishini kuzating.",
        explanation: "Har uchala koordinata tekisligi bilan kesilganda ellipslar hosil bo'ladi.",
        defaults: { a: 2.1, b: 1.6, c: 1.3 },
        sliders: [
          { id: 'a', label: "Yarim o'q (a)", min: 0.8, max: 3.0, step: 0.1, default: 2.1, unit: '' },
          { id: 'b', label: "Yarim o'q (b)", min: 0.8, max: 3.0, step: 0.1, default: 1.6, unit: '' },
          { id: 'c', label: "Yarim o'q (c)", min: 0.8, max: 3.0, step: 0.1, default: 1.3, unit: '' },
        ],
        quiz: {
          question: "Ellipsoid tenglamasida a = b = c = r bo'lsa, u qanday sirtga aylanadi?",
          options: ['Konusga', 'Sferaga', 'Paraboloidga'],
          correct_index: 1,
          explanation_uz: "Barcha yarim o'qlar tenglashganda (a = b = c = r) ellipsoid oddiy sferaga aylanadi.",
        },
      };
    }

    // Hyperboloid of TWO sheets
    const twoSheetAxis: Axis3 | null =
      /^x\^2.*?-y\^2.*?-z\^2.*?=1$/.test(compactEq)
        ? 'x'
        : /^y\^2.*?-z\^2.*?-x\^2.*?=1$/.test(compactEq) || /^y\^2.*?-x\^2.*?-z\^2.*?=1$/.test(compactEq)
          ? 'y'
          : /^z\^2.*?-x\^2.*?-y\^2.*?=1$/.test(compactEq)
            ? 'z'
            : /\b(ikki\s*pallali|two\s*sheets|dos\s*hojas)\b/i.test(qLower)
              ? axisMention
              : null;
    if (twoSheetAxis) {
      const latexMap: Record<Axis3, string> = {
        z: '\\frac{z^2}{c^2} - \\frac{x^2}{a^2} - \\frac{y^2}{b^2} = 1',
        x: '\\frac{x^2}{c^2} - \\frac{y^2}{a^2} - \\frac{z^2}{b^2} = 1',
        y: '\\frac{y^2}{c^2} - \\frac{z^2}{a^2} - \\frac{x^2}{b^2} = 1',
      };
      return {
        template: 'hyperboloid_two_sheets',
        axis: twoSheetAxis,
        title: `Ikki pallali giperboloid (${twoSheetAxis} o'qi bo'ylab)`,
        latex: latexMap[twoSheetAxis],
        introSpeech: `Ikki pallali giperboloid ${twoSheetAxis} o'qi bo'ylab bir-biridan ajralgan ikkita simmetrik kosachadan iborat. Avval koordinata o'qlari va sirt to'rini chizamiz.`,
        sliceSpeech: `Endi har ikki pallasini to'ldirib, ko'ndalang tekislik bilan kesilganda hosil bo'ladigan ellips halqasini ko'ramiz.`,
        formulaSpeech: `c parametri ikki palla orasidagi masofani belgilaydi. Meridian giperbolalarini yashil va ko'k chiziqlarda kuzating.`,
        explanation: `Musbat ishorali o'zgaruvchi (${twoSheetAxis}) qaysi o'qda bo'lsa, ikki palla o'sha o'q bo'ylab ochiladi.`,
        defaults: { a: 1.4, b: 1.4, c: 1.3 },
        sliders: [
          { id: 'a', label: 'Parametr (a)', min: 0.7, max: 2.5, step: 0.1, default: 1.4, unit: '' },
          { id: 'b', label: 'Parametr (b)', min: 0.7, max: 2.5, step: 0.1, default: 1.4, unit: '' },
          { id: 'c', label: 'Masofa (c)', min: 0.6, max: 2.2, step: 0.1, default: 1.3, unit: '' },
        ],
        quiz: {
          question: "Ikki pallali giperboloid nechta alohida qismdan (palladan) tashkil topgan?",
          options: ['1 ta tutash qismdan', '2 ta ajralgan palladan', '3 ta tekislikdan'],
          correct_index: 1,
          explanation_uz: "Markaz atrofida bo'shliq mavjud bo'lgani uchun sirt ikkita alohida pallaga bo'linadi.",
        },
      };
    }

    // Hyperboloid of ONE sheet
    const oneSheetAxis: Axis3 | null =
      /^y\^2.*?\+z\^2.*?-x\^2.*?=1$/.test(compactEq)
        ? 'x'
        : /^x\^2.*?\+z\^2.*?-y\^2.*?=1$/.test(compactEq)
          ? 'y'
          : /^x\^2.*?\+y\^2.*?-z\^2.*?=1$/.test(compactEq)
            ? 'z'
            : /\b(bir\s*pallali|one\s*sheet|una\s*hoja|giperboloid|hyperboloid)\b/i.test(qLower)
              ? axisMention
              : null;
    if (oneSheetAxis) {
      const latexMap: Record<Axis3, string> = {
        z: '\\frac{x^2}{a^2} + \\frac{y^2}{b^2} - \\frac{z^2}{c^2} = 1',
        x: '\\frac{y^2}{a^2} + \\frac{z^2}{b^2} - \\frac{x^2}{c^2} = 1',
        y: '\\frac{z^2}{a^2} + \\frac{x^2}{b^2} - \\frac{y^2}{c^2} = 1',
      };
      return {
        template: 'hyperboloid_one_sheet',
        axis: oneSheetAxis,
        title: `Bir pallali giperboloid (${oneSheetAxis} o'qi bo'ylab)`,
        latex: latexMap[oneSheetAxis],
        introSpeech: `Bir pallali giperboloid — belidan ingichkalashgan uzluksiz quvur shaklidagi 3D sirtdir. Avval koordinata o'qlari va parametr to'rini chizamiz.`,
        sliceSpeech: `Endi sirtni hamda o'rtadagi eng tor ko'ndalang ellips halqasini ko'ramiz.`,
        formulaSpeech: `Meridian kesimlarida giperbolalar hosil bo'ladi; a va b bo'yin o'lchamini boshqaradi.`,
        explanation: `Manfiy ishorali had (${oneSheetAxis}) sirtning ochilish o'qini aniqlaydi.`,
        defaults: { a: 1.3, b: 1.3, c: 1.5 },
        sliders: [
          { id: 'a', label: 'Bo‘yin (a)', min: 0.6, max: 2.4, step: 0.1, default: 1.3, unit: '' },
          { id: 'b', label: 'Bo‘yin (b)', min: 0.6, max: 2.4, step: 0.1, default: 1.3, unit: '' },
          { id: 'c', label: 'Balandlik (c)', min: 0.7, max: 2.5, step: 0.1, default: 1.5, unit: '' },
        ],
        quiz: {
          question: "Bir pallali giperboloidning o'rtasidagi eng tor kesim qanday shaklga ega?",
          options: ['Ellips (yoki aylana)', 'To‘g‘ri chiziq', 'Parabola'],
          correct_index: 0,
          explanation_uz: "z = 0 da x²/a² + y²/b² = 1 ellips tenglamasi hosil bo'ladi.",
        },
      };
    }

    // Elliptic cone
    if (/^z\^2.*=x\^2.*\+y\^2/.test(compactEq) || /\b(elliptik\s*konus|elliptic\s*cone|ikkinchi\s*tartibli\s*konus)\b/i.test(qLower)) {
      return {
        template: 'elliptic_cone',
        axis: axisMention,
        title: `Elliptik konus (${axisMention} o'qi bo'ylab)`,
        latex: '\\frac{z^2}{c^2} = \\frac{x^2}{a^2} + \\frac{y^2}{b^2}',
        introSpeech: "Elliptik konus — koordinata boshida uchma-uch tutashgan ikkita konus bo'lagidan iborat. Avval koordinata o'qlari va yasovchi to'rini chizamiz.",
        sliceSpeech: "Sirtni va ikki tarafdagi ko'ndalang ellips kesimlarini qo'shamiz.",
        formulaSpeech: "Koordinata tekisliklari bilan kesilganda kesishuvchi to'g'ri chiziqlar hosil bo'ladi.",
        explanation: "Uchi (0,0,0) nuqtada joylashgan ikki qanotli konus sirti.",
        defaults: { a: 1.3, b: 1.1, c: 1.6 },
        sliders: [
          { id: 'a', label: 'Og‘ish (a)', min: 0.6, max: 2.2, step: 0.1, default: 1.3, unit: '' },
          { id: 'b', label: 'Og‘ish (b)', min: 0.6, max: 2.2, step: 0.1, default: 1.1, unit: '' },
          { id: 'c', label: 'Cho‘zilish (c)', min: 0.8, max: 2.4, step: 0.1, default: 1.6, unit: '' },
        ],
        quiz: {
          question: "Elliptik konusning ikki qismi qaysi nuqtada tutashadi?",
          options: ['Koordinata boshi (0,0,0) da', '(1,1,1) nuqtada', 'Tutashmaydi'],
          correct_index: 0,
          explanation_uz: "x = y = z = 0 nuqtasi konusning yagona umumiy uchi hisoblanadi.",
        },
      };
    }

    // Hyperbolic paraboloid (saddle): z = x^2 - y^2 or z/c = x^2/a^2 - y^2/b^2
    if (/^z(?:\/[^=]+)?=.*x\^2.*-.*y\^2/.test(compactEq) || /\b(giperbolik\s*paraboloid|hyperbolic\s*paraboloid|egar\s*sirt)\b/i.test(qLower)) {
      return {
        template: 'hyperbolic_paraboloid',
        axis: axisMention,
        title: 'Giperbolik paraboloid (Egar sirti)',
        latex: '\\frac{z}{c} = \\frac{x^2}{a^2} - \\frac{y^2}{b^2}',
        introSpeech: "Giperbolik paraboloid ot egari shakliga ega. Avval o'qlar va sirtning fazoviy panjarasini chizamiz.",
        sliceSpeech: "Endi shaffof egar sirtini va z = 0 darajadagi ikkita kesishuvchi to'g'ri chiziqni qo'shamiz.",
        formulaSpeech: "x bo'ylab parabola yuqoriga, y bo'ylab esa pastga qayrilganini yashil va ko'k chiziqlarda ko'ring.",
        explanation: "Koordinata boshi (0,0,0) da bir vaqtda ham minimum (x bo'ylab), ham maksimum (y bo'ylab) — egar nuqta hosil bo'ladi.",
        defaults: { a: 1.4, b: 1.4, c: 1.2 },
        sliders: [
          { id: 'a', label: 'X qanoti (a)', min: 0.8, max: 2.4, step: 0.1, default: 1.4, unit: '' },
          { id: 'b', label: 'Y qanoti (b)', min: 0.8, max: 2.4, step: 0.1, default: 1.4, unit: '' },
          { id: 'c', label: 'Egrilik (c)', min: 0.5, max: 2.2, step: 0.1, default: 1.2, unit: '' },
        ],
        quiz: {
          question: "Giperbolik paraboloid koordinata boshida qanday xarakterli nuqta hosil qiladi?",
          options: ['Egar (saddle) nuqta', 'Absolyut maksimum', 'Absolyut minimum'],
          correct_index: 0,
          explanation_uz: "Bir o'q bo'ylab yuqoriga, ikkinchisi bo'ylab pastga egilgani uchun u egar nuqta deyiladi.",
        },
      };
    }

    // Elliptic paraboloid: z = x^2 + y^2 or z/c = x^2/a^2 + y^2/b^2
    if (/^z(?:\/[^=]+)?=.*x\^2.*\+.*y\^2/.test(compactEq) || /\b(elliptik\s*paraboloid|elliptic\s*paraboloid|paraboloid)\b/i.test(qLower)) {
      return {
        template: 'elliptic_paraboloid',
        axis: axisMention,
        title: `Elliptik paraboloid (${axisMention} o'qi bo'ylab)`,
        latex: '\\frac{z}{c} = \\frac{x^2}{a^2} + \\frac{y^2}{b^2}',
        introSpeech: "Elliptik paraboloid — parabola shaklidagi ko'zgu yoki kosacha ko'rinishidagi sirt. Avval o'qlar va to'rni chizamiz.",
        sliceSpeech: "Endi sirtni va yuqori ko'ndalang ellips halqasini qo'shamiz.",
        formulaSpeech: "Har ikki koordinata tekisligi bilan kesilganda uchlari koordinata boshida yotgan parabolalar hosil bo'ladi.",
        explanation: "Parabola antenna va teleskop ko'zgulari aynan elliptik paraboloid shaklida yasaladi.",
        defaults: { a: 1.3, b: 1.1, c: 1.4 },
        sliders: [
          { id: 'a', label: 'Kenglik (a)', min: 0.7, max: 2.2, step: 0.1, default: 1.3, unit: '' },
          { id: 'b', label: 'Kenglik (b)', min: 0.7, max: 2.2, step: 0.1, default: 1.1, unit: '' },
          { id: 'c', label: 'Chuqurlik (c)', min: 0.6, max: 2.2, step: 0.1, default: 1.4, unit: '' },
        ],
        quiz: {
          question: "Elliptik paraboloidni uchini kesib o'tmaydigan gorizontal tekislik bilan kesganda nima hosil bo'ladi?",
          options: ['Ellips (yoki aylana)', 'Giperbola', 'Uchburchak'],
          correct_index: 0,
          explanation_uz: "z = const > 0 qo'yilganda x²/a² + y²/b² = const ellips tenglamasi chiqadi.",
        },
      };
    }

    // Elliptic cylinder
    if (/\b(elliptik\s*silindr|elliptic\s*cylinder)\b/i.test(qLower) || /^x\^2\/[a-z0-9.]+\+y\^2\/[a-z0-9.]+=1$/.test(compactEq)) {
      return {
        template: 'elliptic_cylinder',
        axis: axisMention,
        title: `Elliptik silindr (${axisMention} o'qi bo'ylab)`,
        latex: '\\frac{x^2}{a^2} + \\frac{y^2}{b^2} = 1',
        introSpeech: "Elliptik silindr — ellipsni o'q bo'ylab fazoga parallel siljitishdan hosil bo'ladigan cheksiz truba sirtidir.",
        sliceSpeech: "Endi sirtni va o'rtadagi asosiy ellips halqasini ko'rsatamiz.",
        formulaSpeech: "Tenglamada z qatnashmagani uchun silindr z o'qiga parallel to'g'ri chiziqlardan tashkil topadi.",
        explanation: "a = b bo'lganda oddiy doiraviy silindr sirtiga aylanadi.",
        defaults: { a: 1.5, b: 1.1, c: 1.8 },
        sliders: [
          { id: 'a', label: 'Yarim o‘q (a)', min: 0.7, max: 2.4, step: 0.1, default: 1.5, unit: '' },
          { id: 'b', label: 'Yarim o‘q (b)', min: 0.7, max: 2.4, step: 0.1, default: 1.1, unit: '' },
        ],
        quiz: {
          question: "x²/a² + y²/b² = 1 tenglamasida z o'zgaruvchisi yo'qligi nimani anglatadi?",
          options: ["Sirt z o'qiga parallel yo'nalganini", "Sirt faqat tekislik ekanini", "z = 0 bo'lishini"],
          correct_index: 0,
          explanation_uz: "Yetishmayotgan o'zgaruvchi o'qi bo'ylab sirt o'zgarmasdan cho'ziladi.",
        },
      };
    }

    // Hyperbolic cylinder
    if (/\b(giperbolik\s*silindr|hyperbolic\s*cylinder)\b/i.test(qLower) || /^x\^2\/[a-z0-9.]+-y\^2\/[a-z0-9.]+=1$/.test(compactEq)) {
      return {
        template: 'hyperbolic_cylinder',
        axis: axisMention,
        title: `Giperbolik silindr (${axisMention} o'qi bo'ylab)`,
        latex: '\\frac{x^2}{a^2} - \\frac{y^2}{b^2} = 1',
        introSpeech: "Giperbolik silindr — giperbola shoxlarini koordinata o'qiga parallel ko'chirishdan hosil bo'lgan ikki pallali sirt.",
        sliceSpeech: "Har ikki qanot sirtini va markaziy giperbola kesimini chizamiz.",
        formulaSpeech: "a va b parametrlarini o'zgartirib, giperbola qanotlari orasidagi masofani kuzating.",
        explanation: "Ikkita qarama-qarshi egri devordan iborat ochiq silindrik sirt.",
        defaults: { a: 1.0, b: 1.1, c: 1.8 },
        sliders: [
          { id: 'a', label: 'Masofa (a)', min: 0.5, max: 2.0, step: 0.1, default: 1.0, unit: '' },
          { id: 'b', label: 'Kenglik (b)', min: 0.6, max: 2.2, step: 0.1, default: 1.1, unit: '' },
        ],
        quiz: {
          question: "Giperbolik silindrni o'qiga tik tekislik bilan kesganda qanday egri chiziq hosil bo'ladi?",
          options: ['Giperbola', 'Ellips', 'Aylana'],
          correct_index: 0,
          explanation_uz: "Har bir ko'ndalang kesim x²/a² - y²/b² = 1 giperbolani beradi.",
        },
      };
    }

    // Parabolic cylinder: x^2 = 4py or y^2 = 4pz or z^2 = 4px
    const paraCylMatch = compactEq.match(/^(x|y|z)\^2=4\*?p\*?(x|y|z)$/);
    if (paraCylMatch || /\b(parabolik\s*silindr|parabolic\s*cylinder)\b/i.test(qLower)) {
      let cylAxis: Axis3 = axisMention;
      let eqLatex = 'x^2 = 4py';
      if (paraCylMatch) {
        const v1 = paraCylMatch[1];
        const v2 = paraCylMatch[2];
        if (v1 === 'x' && v2 === 'y') { cylAxis = 'z'; eqLatex = 'x^2 = 4py'; }
        else if (v1 === 'y' && v2 === 'z') { cylAxis = 'x'; eqLatex = 'y^2 = 4pz'; }
        else if (v1 === 'z' && v2 === 'x') { cylAxis = 'y'; eqLatex = 'z^2 = 4px'; }
      }
      return {
        template: 'parabolic_cylinder',
        axis: cylAxis,
        title: `Parabolik silindr (${cylAxis} o'qi bo'ylab)`,
        latex: eqLatex,
        introSpeech: "Parabolik silindr — parabolani uchinchi o'q bo'ylab siljitishdan hosil bo'ladigan tarnovsimon sirt.",
        sliceSpeech: "Sirtni va markaziy parabola kesimini to'liq fazoda ko'ramiz.",
        formulaSpeech: "p parametri parabolaning fokus masofasini va ochilish kengligini belgilaydi.",
        explanation: "Yorug'lik reflektorlari ko'pincha parabolik silindr shaklida loyihalanadi.",
        defaults: { p: 0.6, c: 1.8 },
        sliders: [
          { id: 'p', label: 'Fokus parametri (p)', min: 0.3, max: 1.5, step: 0.05, default: 0.6, unit: '' },
        ],
        quiz: {
          question: "x² = 4py parabolik silindrining yasovchilari qaysi o'qqa parallel bo'ladi?",
          options: ["z o'qiga", "x o'qiga", "y o'qiga"],
          correct_index: 0,
          explanation_uz: "Tenglamada z ishtirok etmagani uchun sirt z o'qiga parallel cho'ziladi.",
        },
      };
    }

    return null;
  };

  const quadric = detectQuadric();
  if (quadric) {
    const baseRp = {
      shape: 'quadric' as const,
      template: quadric.template,
      axis: quadric.axis,
      ...quadric.defaults,
    };
    return {
      topic_title: quadric.title,
      subject: 'math',
      engine: 'threejs',
      source: 'local-parser',
      latency_ms: Math.max(1, Math.round(performance.now() - t0)),
      sliders: quadric.sliders,
      steps: [
        {
          step_number: 1,
          step_title: '1. Koordinata o‘qlari va fazoviy to‘r',
          speech_text: quadric.introSpeech,
          katex_formulas: [quadric.latex],
          explanation_uz: "Avval x, y, z o'qlari va sirtning parametrik to'rini quramiz.",
          emoji_emotion: 'explaining',
          camera: [5.8, 3.6, 5.2],
          render_params: { ...baseRp, draw: ['axes', 'wireframe', 'labels'] },
        },
        {
          step_number: 2,
          step_title: '2. Shaffof sirt va ko‘ndalang kesim',
          speech_text: quadric.sliceSpeech,
          katex_formulas: [quadric.latex],
          explanation_uz: quadric.explanation,
          emoji_emotion: 'pointing',
          camera: [5.4, 3.9, 4.9],
          render_params: { ...baseRp, draw: ['axes', 'wireframe', 'surface', 'equator_ring', 'labels'] },
        },
        {
          step_number: 3,
          step_title: '3. Meridian kesimlar va parametrlar tahlili',
          speech_text: quadric.formulaSpeech,
          katex_formulas: [quadric.latex],
          explanation_uz: "Pastki slayderlar yordamida parametrlarni jonli o'zgartirib, 3D shaklni 360° aylantiring.",
          emoji_emotion: 'thinking',
          camera: [5.8, 3.4, 5.4],
          render_params: { ...baseRp, draw: ['axes', 'wireframe', 'surface', 'equator_ring', 'meridians', 'labels'] },
        },
        {
          step_number: 4,
          step_title: '4. Qisqa tekshiruv savoli',
          speech_text: `Bilimingizni tekshiramiz! ${quadric.quiz.question}`,
          katex_formulas: [quadric.latex],
          explanation_uz: "3D sirtga qarab to'g'ri javobni tanlang.",
          emoji_emotion: 'encouraging',
          camera: [6.2, 3.8, 5.5],
          render_params: { ...baseRp, draw: ['axes', 'wireframe', 'surface', 'equator_ring', 'meridians', 'labels'] },
          quiz: quadric.quiz,
        },
      ],
    };
  }

  // 6. Explicit 3D surface: z = ...
  const zMatch = query.match(/^z\s*=\s*(.+)$/i);
  if (zMatch) {
    const exprZ = normalizeMathExpr(zMatch[1]);
    try {
      const c = compile(exprZ);
      const test = Number(c.evaluate({ x: 1, y: 1 }));
      if (Number.isFinite(test)) {
        return {
          topic_title: `3D Sirt grafigi: z = ${zMatch[1].trim()}`,
          subject: 'math',
          engine: 'plotly3d',
          source: 'local-parser',
          latency_ms: Math.max(1, Math.round(performance.now() - t0)),
          sliders: [
            { id: 'scale', label: 'Masshtab koeffitsiyenti', min: 0.4, max: 2, step: 0.2, default: 1, unit: '' },
          ],
          steps: [
            {
              step_number: 1,
              step_title: '1. Fazoviy sirtni qurish',
              speech_text: `z teng ${zMatch[1].trim()} funksiyasini uch o'lchamli koordinatalar fazosida hisoblab chizamiz.`,
              katex_formulas: [`z(x, y) = ${zMatch[1].trim()}`],
              explanation_uz: `Grafikni aylantirib, funksiya qiymatlarining X va Y bo'yicha o'zgarishini kuzating.`,
              emoji_emotion: 'explaining',
              render_params: {
                expression_z: `scale * (${exprZ})`,
                x_range: [-3.5, 3.5],
                y_range: [-3.5, 3.5],
                show_contours: true,
              },
            },
            {
              step_number: 2,
              step_title: '2. Kontur sath chiziqlari',
              speech_text: `Pastki tekislikda bir xil balandlikka ega nuqtalar kontur chiziqlari ko'rinishida aks ettirilgan.`,
              katex_formulas: [`${zMatch[1].trim()} = C`],
              explanation_uz: `Konturlar zich joylashgan hududlarda funksiya eng tez o'zgaradi.`,
              emoji_emotion: 'happy',
              render_params: {
                expression_z: `scale * (${exprZ})`,
                x_range: [-3.5, 3.5],
                y_range: [-3.5, 3.5],
                show_contours: true,
              },
            },
          ],
        };
      }
    } catch {
      // fall through
    }
  }

  // 7. 2D Equation ("2x + 6 = 14") or Function ("y = x^2 - 4", "f(x) = ...")
  const eqMatch = query.match(/^([^=]+)=([^=]+)$/);
  if (eqMatch) {
    const lhsRaw = eqMatch[1].trim();
    const rhsRaw = eqMatch[2].trim();

    // Case A: y = f(x) or f(x) = ...
    if (/^(y|f\s*\(\s*x\s*\))$/i.test(lhsRaw)) {
      const expr = normalizeMathExpr(rhsRaw);
      try {
        const compiled = compile(expr);
        const y0 = Number(compiled.evaluate({ x: 0 }));
        const roots = findRealRoots(expr, -8, 8);
        let derivStr = '';
        try {
          derivStr = simplify(derivative(expr, 'x')).toString();
        } catch {
          derivStr = '';
        }

        const rootText =
          roots.length > 0
            ? `Funksiya OX o'qini x = ${roots.join(', ')} nuqtalarda kesib o'tadi.`
            : "Tanlangan [-8; 8] oraliqda OX o'qi bilan kesishish nuqtasi topilmadi.";

        return {
          topic_title: `Funksiya grafigi: y = ${rhsRaw}`,
          subject: 'math',
          engine: 'plotly2d',
          source: 'local-parser',
          latency_ms: Math.max(1, Math.round(performance.now() - t0)),
          sliders: [
            { id: 'shift_y', label: 'Vertikal siljish (d)', min: -5, max: 5, step: 0.5, default: 0, unit: '' },
          ],
          steps: [
            {
              step_number: 1,
              step_title: '1. Funksiyani koordinata tekisligida chizish',
              speech_text: `y teng ${rhsRaw} funksiyasini brauzerning o'zida tezkor hisoblab, aniq grafigini chizamiz. x nol bo'lganda y qiymati ${formatNum(y0)} ga teng.`,
              katex_formulas: [`y = ${rhsRaw}`, `y(0) = ${formatNum(y0)}`],
              explanation_uz: `Grafik ustiga kursorni olib borsangiz, har bir nuqtaning aniq koordinatasi ko'rinadi.`,
              emoji_emotion: 'explaining',
              render_params: {
                expression: `(${expr}) + shift_y`,
                x_range: [-8, 8],
                highlight_points: Number.isFinite(y0) ? [{ x: 0, y: y0, label: `(0; ${formatNum(y0)})` }] : [],
              },
            },
            {
              step_number: 2,
              step_title: '2. Funksiya nollari (ildizlar)',
              speech_text: rootText,
              katex_formulas: [
                `${rhsRaw} = 0`,
                roots.length > 0 ? `x \\in \\{${roots.join('; ')}\\}` : `\\text{Haqiqiy ildizlar } [-8;8] \\text{ da yo'q}`,
              ],
              explanation_uz: rootText,
              emoji_emotion: 'pointing',
              render_params: {
                expression: `(${expr}) + shift_y`,
                x_range: [-8, 8],
                equation_roots: roots,
                highlight_points: roots.map((r) => ({ x: r, y: 0, label: `x=${r}` })),
              },
            },
            {
              step_number: 3,
              step_title: '3. Birinchi tartibli hosila tahlili',
              speech_text: derivStr
                ? `Funksiyaning hosilasi ${derivStr} ga teng bo'lib, urinma chiziq og'ish burchagini belgilaydi.`
                : `Funksiyaning o'zgarish tezligini hosila egri chizig'i orqali ko'rishimiz mumkin.`,
              katex_formulas: derivStr ? [`y' = ${derivStr}`] : [`y' = \\frac{dy}{dx}`],
              explanation_uz: `Qizil punktir chiziq — funksiyaning hosilasi y'(x).`,
              emoji_emotion: 'happy',
              render_params: {
                expression: `(${expr}) + shift_y`,
                x_range: [-8, 8],
                derivative: true,
              },
            },
          ],
        };
      } catch {
        // fall through
      }
    }

    // Case B: Algebraic equation in x, e.g. "2x + 6 = 14" or "x^2 - 5x + 6 = 0"
    if (/\bx\b/i.test(lhsRaw + rhsRaw) && !/\by\b/i.test(lhsRaw + rhsRaw)) {
      const lhsExpr = normalizeMathExpr(lhsRaw);
      const rhsExpr = normalizeMathExpr(rhsRaw);
      const diffExpr = `(${lhsExpr}) - (${rhsExpr})`;
      const roots = findRealRoots(diffExpr, -15, 15);
      if (roots.length > 0) {
        const compiledLhs = compile(lhsExpr);
        const yVals = roots.map((r) => Number(compiledLhs.evaluate({ x: r })));
        return {
          topic_title: `Tenglama yechimi: ${lhsRaw} = ${rhsRaw}`,
          subject: 'math',
          engine: 'plotly2d',
          source: 'local-parser',
          latency_ms: Math.max(1, Math.round(performance.now() - t0)),
          sliders: [],
          steps: [
            {
              step_number: 1,
              step_title: '1. Tenglamaning chap va o‘ng qismlari',
              speech_text: `${lhsRaw} teng ${rhsRaw} tenglamasini grafik usulda yechish uchun chap va o'ng tomonlarni alohida funksiya sifatida chizamiz.`,
              katex_formulas: [`y_1 = ${lhsRaw}`, `y_2 = ${rhsRaw}`],
              explanation_uz: `Ikki grafikning kesishgan nuqtasi tenglamaning aniq yechimini beradi.`,
              emoji_emotion: 'explaining',
              render_params: {
                expression: lhsExpr,
                secondary_expression: rhsExpr,
                x_range: [Math.min(-6, roots[0] - 4), Math.max(6, roots[roots.length - 1] + 4)],
              },
            },
            {
              step_number: 2,
              step_title: '2. Kesishish nuqtasi va ildizlar',
              speech_text: `Grafiklar x teng ${roots.join(' va ')} nuqtalarda kesishadi. Demak, tenglama yechimi ${roots.join(', ')} ga teng!`,
              katex_formulas: [
                `${lhsRaw} - (${rhsRaw}) = 0`,
                `x = ${roots.join(',\\; ')}`,
              ],
              explanation_uz: `Tekshirish: topilgan x qiymatini tenglamaga qo'yganda chap va o'ng tomonlar tenglashadi.`,
              emoji_emotion: 'happy',
              render_params: {
                expression: lhsExpr,
                secondary_expression: rhsExpr,
                x_range: [Math.min(-6, roots[0] - 4), Math.max(6, roots[roots.length - 1] + 4)],
                highlight_points: roots.map((r, i) => ({
                  x: r,
                  y: Number.isFinite(yVals[i]) ? Number(yVals[i].toFixed(2)) : 0,
                  label: `x = ${r}`,
                })),
              },
            },
          ],
        };
      }
    }
  }

  return null;
}
