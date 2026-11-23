import type {
  EvaluateLessonResponse,
  StepEvaluationInput,
  StepEvaluationResult,
} from '../types/tutor.js';

const UZBEK_STOPWORDS = new Set([
  'va',
  'yoki',
  'bilan',
  'uchun',
  'ham',
  'esa',
  'bu',
  'shu',
  'osha',
  'qanday',
  'nima',
  'necha',
  'nega',
  'bunda',
  'unda',
  'orqali',
  'asosida',
  'hisobiga',
  'haqida',
  'qiladi',
  'boladi',
  'bo',
  'bolgan',
  'bolsa',
  'kerak',
  'mumkin',
  'qaysi',
  'barcha',
  'har',
  'bir',
  'ikki',
  'ta',
  'da',
  'ga',
  'ni',
  'ning',
  'dan',
  'dagi',
  'lar',
  'lari',
]);

function normalizeUzText(raw: string): string {
  const cyrMap: Record<string, string> = {
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
    ъ: '',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
    ў: 'o',
    қ: 'q',
    ғ: 'g',
    ҳ: 'h',
  };
  let out = '';
  for (const ch of raw.toLowerCase()) {
    out += cyrMap[ch] ?? ch;
  }
  return out
    .replace(/o['`‘’ʼ]/g, 'o')
    .replace(/g['`‘’ʼ]/g, 'g')
    .replace(/['`‘’ʼ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTokens(text: string): string[] {
  const norm = normalizeUzText(text);
  const raw = norm.match(/[a-z0-9]+/g) || [];
  const stems: string[] = [];
  for (const tok of raw) {
    if (tok.length < 3 || UZBEK_STOPWORDS.has(tok)) continue;
    const stem = tok.length > 6 ? tok.slice(0, 5) : tok.length > 4 ? tok.slice(0, 4) : tok;
    if (!UZBEK_STOPWORDS.has(stem)) {
      stems.push(stem);
    }
  }
  return Array.from(new Set(stems));
}

function extractNumbers(text: string): string[] {
  const norm = normalizeUzText(text).replace(/,/g, '.');
  const matches = norm.match(/\d+(?:\.\d+)?/g) || [];
  return Array.from(new Set(matches));
}

function stripLatexForSpeech(raw: string): string {
  return raw
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 bo‘lingan $2')
    .replace(/\\cdot/g, ' ko‘paytiruv ')
    .replace(/\\times/g, ' ko‘paytiruv ')
    .replace(/\\approx/g, ' taxminan ')
    .replace(/\\le/g, ' kichik yoki teng ')
    .replace(/\\ge/g, ' katta yoki teng ')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^}]*)\}/g, '$1')
    .replace(/[\\{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPlaceholderOrInvalidAnswer(normAnswer: string): boolean {
  if (!normAnswer || normAnswer.length < 2) return true;
  if (/^(bilmayman|bilmadim|yoq|ha|ok|test|asdf|qwerty|123|\.+|-+)$/i.test(normAnswer)) {
    return true;
  }
  if (/^(.)\1{2,}$/.test(normAnswer.replace(/\s+/g, ''))) {
    return true;
  }
  return false;
}

export function buildCorrectAnswerText(item: StepEvaluationInput): string {
  const expected = (item.expectedPoints || '').trim();
  const expl = (item.stepExplanation || '').trim();
  let base = expected && expected.length >= 12 ? expected : expl || expected;
  if (!base) {
    base = `"${item.stepTitle}" bosqichidagi asosiy fizik-texnik qoida.`;
  }
  if (!/[.!?]$/.test(base)) {
    base += '.';
  }
  return base;
}

export function evaluateSingleAnswerLocally(item: StepEvaluationInput): StepEvaluationResult {
  const cleanUser = (item.userAnswer || '').trim();
  const normUser = normalizeUzText(cleanUser);
  const correctAnswer = buildCorrectAnswerText(item);
  const cleanTitle = item.stepTitle.replace(/^\d+[\.\)\-\:]\s*/, '').trim();

  if (isPlaceholderOrInvalidAnswer(normUser)) {
    return {
      stepIndex: item.stepIndex,
      stepTitle: cleanTitle,
      question: item.question,
      userAnswer: cleanUser || '—',
      score: 0,
      passed: false,
      correct_answer_uz: correctAnswer,
      feedback_uz: "Aniq mazmunli javob berilmagan.",
    };
  }

  const refText = [
    item.expectedPoints || '',
    item.stepExplanation || '',
    item.stepTitle || '',
  ].join(' ');
  const refTokens = extractTokens(refText);
  const userTokens = extractTokens(cleanUser);

  let matchedCount = 0;
  for (const rt of refTokens) {
    if (
      userTokens.some(
        (ut) =>
          ut === rt ||
          (ut.length >= 4 && rt.length >= 4 && (ut.startsWith(rt.slice(0, 4)) || rt.startsWith(ut.slice(0, 4))))
      )
    ) {
      matchedCount += 1;
    }
  }

  const expectedNums = extractNumbers(item.expectedPoints || '');
  const userNums = extractNumbers(cleanUser);
  const primaryExpectedNum = expectedNums.length > 0 ? expectedNums[expectedNums.length - 1] : null;
  const hasAnyExpectedNum = expectedNums.some((n) => userNums.includes(n));
  const hasConflictingNum =
    expectedNums.length > 0 && userNums.length > 0 && !hasAnyExpectedNum;

  // Detect domain-specific strong concepts (e.g. Bets, Faraday, Pascal, Induksiya, v^3, 50 Hz)
  const wordCount = cleanUser.split(/\s+/).filter(Boolean).length;
  const tokenRatio =
    refTokens.length > 0 ? Math.min(1, matchedCount / Math.min(refTokens.length, 5)) : 0.45;

  let score = Math.round(28 + tokenRatio * 62 + Math.min(10, wordCount * 1.5));

  if (hasConflictingNum) {
    // User gave a wrong numeric value (e.g., "4 marta ortadi" when "8" or "400" was expected)
    score = Math.min(score, 44);
    score = Math.max(25, score);
  } else if (expectedNums.length > 0 && hasAnyExpectedNum) {
    score = Math.max(score, 85);
  }

  // Handle negation mismatch (e.g. question asks "kamayadi/oshadi")
  if (
    /oshadi|ortadi|ko['`‘’]?payadi/i.test(item.expectedPoints || '') &&
    /kamayadi|pasayadi/i.test(normUser)
  ) {
    score = Math.min(score, 32);
  } else if (
    /kamayadi|pasayadi/i.test(item.expectedPoints || '') &&
    /oshadi|ortadi|ko['`‘’]?payadi/i.test(normUser)
  ) {
    score = Math.min(score, 32);
  }

  if (matchedCount === 0 && !hasAnyExpectedNum && wordCount < 4) {
    score = Math.min(score, 28);
  }

  score = Math.max(0, Math.min(100, score));
  const passed = score >= 65;

  let feedback_uz = '';
  if (hasConflictingNum && primaryExpectedNum) {
    feedback_uz = `Qisman yaqin, ammo sonli qiymat boshqacha (${expectedNums.join(' / ')} kutilgan).`;
  } else if (score >= 85) {
    feedback_uz = "Ajoyib! Asosiy mazmun to‘g‘ri yoritilgan.";
  } else if (score >= 65) {
    feedback_uz = "Yaxshi javob — asosiy g‘oya to‘g‘ri.";
  } else if (score >= 35) {
    feedback_uz = "Qisman to‘g‘ri, lekin asosiy fizik sabab yoki qiymat to‘liq ochilmagan.";
  } else {
    feedback_uz = "Javob dars mazmunidan uzoqroq chiqdi. To‘g‘ri javobga e’tibor bering.";
  }

  return {
    stepIndex: item.stepIndex,
    stepTitle: cleanTitle,
    question: item.question,
    userAnswer: cleanUser,
    score,
    passed,
    correct_answer_uz: correctAnswer,
    feedback_uz,
  };
}

export function buildEvaluationSummarySpeech(
  topicTitle: string,
  overallPercent: number,
  steps: StepEvaluationResult[]
): string {
  const cleanTopic = stripLatexForSpeech(topicTitle);
  const intro = `${cleanTopic} mavzusi bo‘yicha barcha ${steps.length} ta dars yakunlandi. Sizning umumiy natijangiz ${overallPercent} foiz.`;

  let verdict = '';
  if (overallPercent >= 85) {
    verdict = "Barakalla, mavzuni juda yuqori darajada o‘zlashtirdingiz!";
  } else if (overallPercent >= 65) {
    verdict = "Yaxshi natija! Endi har bir dars bo‘yicha to‘g‘ri javoblarni eshitib mustahkamlab oling.";
  } else {
    verdict = "Keling, har bir darsning to‘g‘ri javobini birgalikda ko‘rib chiqamiz.";
  }

  const perStepSpeech = steps
    .map((s) => {
      const cleanAns = stripLatexForSpeech(s.correct_answer_uz);
      return `${s.stepIndex + 1}-dars natijangiz ${s.score} foiz. To‘g‘ri javob: ${cleanAns}`;
    })
    .join(' ');

  return `${intro} ${verdict} ${perStepSpeech}`;
}

export function evaluateLessonAnswersLocally(
  topicTitle: string,
  items: StepEvaluationInput[]
): EvaluateLessonResponse {
  const steps = items.map((item) => evaluateSingleAnswerLocally(item));
  const total = steps.reduce((acc, s) => acc + s.score, 0);
  const overall_percent = steps.length > 0 ? Math.round(total / steps.length) : 0;
  const summary_speech_uz = buildEvaluationSummarySpeech(topicTitle, overall_percent, steps);
  return {
    overall_percent,
    steps,
    summary_speech_uz,
  };
}
