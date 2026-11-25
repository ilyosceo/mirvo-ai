import type { TokenUsageInfo } from '../types/tutor.js';

// Official Qwen 3.8 Omni Flash rates on Alibaba Cloud DashScope (USD per 1M tokens)
export const QWEN_OMNI_INPUT_RATE_PER_1M = 0.15;
export const QWEN_OMNI_CACHED_INPUT_RATE_PER_1M = 0.016;
export const QWEN_OMNI_OUTPUT_RATE_PER_1M = 0.47;

// Gemini Flash fallback rates (USD per 1M tokens)
export const GEMINI_INPUT_RATE_PER_1M = 0.30;
export const GEMINI_CACHED_INPUT_RATE_PER_1M = 0.03;
export const GEMINI_OUTPUT_RATE_PER_1M = 2.50;

export const APPROX_USD_TO_UZS = 12850;

export const ZERO_TOKEN_USAGE: TokenUsageInfo = {
  prompt_tokens: 0,
  cached_tokens: 0,
  output_tokens: 0,
  thoughts_tokens: 0,
  total_tokens: 0,
  cost_usd: 0,
  llm_calls: 0,
};

export interface GeminiUsageMetadataLike {
  promptTokenCount?: number;
  cachedContentTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export interface DashScopeUsageLike {
  prompt_tokens?: number;
  completion_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cached_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    audio_tokens?: number;
    image_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
    audio_tokens?: number;
  };
}

export function calculateQwenCostUsd(params: {
  prompt_tokens: number;
  cached_tokens?: number;
  output_tokens: number;
  model?: string;
}): number {
  const cached = Math.max(0, params.cached_tokens ?? 0);
  const uncachedInput = Math.max(0, params.prompt_tokens - cached);
  const output = Math.max(0, params.output_tokens);

  const isMax = (params.model || '').toLowerCase().includes('max');
  const inRate = isMax ? 2.0 : QWEN_OMNI_INPUT_RATE_PER_1M;
  const cacheRate = isMax ? 0.25 : QWEN_OMNI_CACHED_INPUT_RATE_PER_1M;
  const outRate = isMax ? 6.0 : QWEN_OMNI_OUTPUT_RATE_PER_1M;

  const cost =
    (uncachedInput * inRate + cached * cacheRate + output * outRate) / 1_000_000;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function usageFromDashScope(
  usage?: DashScopeUsageLike | null,
  model = 'qwen3.8-omni-flash'
): TokenUsageInfo {
  if (!usage) {
    return { ...ZERO_TOKEN_USAGE, llm_calls: 1, model };
  }
  const prompt_tokens = Math.max(0, Number(usage.prompt_tokens ?? 0));
  const cached_tokens = Math.max(
    0,
    Number(usage.prompt_tokens_details?.cached_tokens ?? usage.cached_tokens ?? 0)
  );
  const output_tokens = Math.max(
    0,
    Number(usage.completion_tokens ?? usage.output_tokens ?? 0)
  );
  const thoughts_tokens = Math.max(
    0,
    Number(usage.completion_tokens_details?.reasoning_tokens ?? 0)
  );
  const total_tokens = Math.max(
    prompt_tokens + output_tokens,
    Number(usage.total_tokens ?? 0)
  );

  return {
    prompt_tokens,
    cached_tokens,
    output_tokens,
    thoughts_tokens,
    total_tokens,
    cost_usd: calculateQwenCostUsd({
      prompt_tokens,
      cached_tokens,
      output_tokens,
      model,
    }),
    llm_calls: 1,
    model,
  };
}

export function calculateGeminiCostUsd(params: {
  prompt_tokens: number;
  cached_tokens?: number;
  output_tokens: number;
}): number {
  const cached = Math.max(0, params.cached_tokens ?? 0);
  const uncachedInput = Math.max(0, params.prompt_tokens - cached);
  const output = Math.max(0, params.output_tokens);

  const cost =
    (uncachedInput * GEMINI_INPUT_RATE_PER_1M +
      cached * GEMINI_CACHED_INPUT_RATE_PER_1M +
      output * GEMINI_OUTPUT_RATE_PER_1M) /
    1_000_000;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function usageFromGeminiMetadata(
  meta?: GeminiUsageMetadataLike | null
): TokenUsageInfo {
  if (!meta) {
    return { ...ZERO_TOKEN_USAGE, llm_calls: 1, model: 'gemini-flash' };
  }

  const prompt_tokens = Math.max(0, meta.promptTokenCount ?? 0);
  const cached_tokens = Math.max(0, meta.cachedContentTokenCount ?? 0);
  const candidates = Math.max(0, meta.candidatesTokenCount ?? 0);
  const thoughts_tokens = Math.max(0, meta.thoughtsTokenCount ?? 0);
  const output_tokens = candidates + thoughts_tokens;
  const total_tokens = Math.max(prompt_tokens + output_tokens, meta.totalTokenCount ?? 0);

  return {
    prompt_tokens,
    cached_tokens,
    output_tokens,
    thoughts_tokens,
    total_tokens,
    cost_usd: calculateGeminiCostUsd({ prompt_tokens, cached_tokens, output_tokens }),
    llm_calls: 1,
    model: 'gemini-flash',
  };
}

export function mergeTokenUsage(...items: Array<TokenUsageInfo | undefined | null>): TokenUsageInfo {
  let prompt_tokens = 0;
  let cached_tokens = 0;
  let output_tokens = 0;
  let thoughts_tokens = 0;
  let total_tokens = 0;
  let cost_usd = 0;
  let llm_calls = 0;
  let model: string | undefined;

  for (const item of items) {
    if (!item) continue;
    prompt_tokens += item.prompt_tokens || 0;
    cached_tokens += item.cached_tokens || 0;
    output_tokens += item.output_tokens || 0;
    thoughts_tokens += item.thoughts_tokens || 0;
    total_tokens += item.total_tokens || 0;
    cost_usd += item.cost_usd || 0;
    llm_calls += item.llm_calls ?? (item.total_tokens > 0 ? 1 : 0);
    if (item.model) model = item.model;
  }

  return {
    prompt_tokens,
    cached_tokens,
    output_tokens,
    thoughts_tokens,
    total_tokens,
    cost_usd: Math.round(cost_usd * 1_000_000) / 1_000_000,
    llm_calls,
    model,
  };
}

export function formatTokenCount(count: number): string {
  const safe = Math.max(0, Math.round(count || 0));
  return safe.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatCostUsd(costUsd: number): string {
  const safe = Math.max(0, costUsd || 0);
  if (safe === 0) return '$0.00';
  if (safe < 0.0001) return '<$0.0001';
  if (safe < 0.01) return `$${safe.toFixed(4)}`;
  return `$${safe.toFixed(3)}`;
}

export function formatCostUzsApprox(costUsd: number): string {
  const uzs = Math.max(0, costUsd || 0) * APPROX_USD_TO_UZS;
  if (uzs <= 0) return '0 so‘m';
  if (uzs < 1) return '<1 so‘m';
  return `~${formatTokenCount(Math.round(uzs))} so‘m`;
}

export interface LessonTokenLogEntry {
  id: string;
  topic: string;
  model: string;
  prompt_tokens: number;
  cached_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  createdAt: string;
}

export interface SessionTokenStats {
  prompt_tokens: number;
  cached_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  ai_requests: number;
  free_requests: number;
}

const SESSION_STATS_KEY = 'qalamai_token_stats_v1';
const LESSON_TOKEN_LOGS_KEY = 'mirvo_lesson_token_logs_v1';

export const EMPTY_SESSION_STATS: SessionTokenStats = {
  prompt_tokens: 0,
  cached_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
  cost_usd: 0,
  ai_requests: 0,
  free_requests: 0,
};

export function loadLessonTokenLogs(): LessonTokenLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LESSON_TOKEN_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendLessonTokenLog(
  topic: string,
  usage?: TokenUsageInfo | null
): LessonTokenLogEntry[] {
  if (typeof window === 'undefined') return [];
  const safe = usage ?? ZERO_TOKEN_USAGE;
  const entry: LessonTokenLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    topic: topic || 'Dars',
    model: safe.model || (safe.total_tokens > 0 ? 'qwen3.8-omni-flash' : 'cache (0 token)'),
    prompt_tokens: safe.prompt_tokens || 0,
    cached_tokens: safe.cached_tokens || 0,
    output_tokens: safe.output_tokens || 0,
    total_tokens: safe.total_tokens || 0,
    cost_usd: safe.cost_usd || 0,
    createdAt: new Date().toISOString(),
  };
  const next = [entry, ...loadLessonTokenLogs()].slice(0, 50);
  try {
    window.localStorage.setItem(LESSON_TOKEN_LOGS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function loadSessionTokenStats(): SessionTokenStats {
  if (typeof window === 'undefined') return { ...EMPTY_SESSION_STATS };
  try {
    const raw = window.localStorage.getItem(SESSION_STATS_KEY);
    if (!raw) return { ...EMPTY_SESSION_STATS };
    const parsed = JSON.parse(raw) as Partial<SessionTokenStats>;
    return {
      prompt_tokens: Number(parsed.prompt_tokens) || 0,
      cached_tokens: Number(parsed.cached_tokens) || 0,
      output_tokens: Number(parsed.output_tokens) || 0,
      total_tokens: Number(parsed.total_tokens) || 0,
      cost_usd: Number(parsed.cost_usd) || 0,
      ai_requests: Number(parsed.ai_requests) || 0,
      free_requests: Number(parsed.free_requests) || 0,
    };
  } catch {
    return { ...EMPTY_SESSION_STATS };
  }
}

export function recordSessionTokenStats(
  prev: SessionTokenStats,
  usage?: TokenUsageInfo | null,
  topic?: string
): SessionTokenStats {
  const safe = usage ?? ZERO_TOKEN_USAGE;
  const usedAi = (safe.total_tokens || 0) > 0 || (safe.llm_calls || 0) > 0;
  if (topic) {
    appendLessonTokenLog(topic, safe);
  }
  const next: SessionTokenStats = {
    prompt_tokens: prev.prompt_tokens + (safe.prompt_tokens || 0),
    cached_tokens: prev.cached_tokens + (safe.cached_tokens || 0),
    output_tokens: prev.output_tokens + (safe.output_tokens || 0),
    total_tokens: prev.total_tokens + (safe.total_tokens || 0),
    cost_usd: Math.round((prev.cost_usd + (safe.cost_usd || 0)) * 1_000_000) / 1_000_000,
    ai_requests: prev.ai_requests + (usedAi ? 1 : 0),
    free_requests: prev.free_requests + (usedAi ? 0 : 1),
  };
  try {
    window.localStorage.setItem(SESSION_STATS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}

export function resetSessionTokenStats(): SessionTokenStats {
  const empty = { ...EMPTY_SESSION_STATS };
  try {
    window.localStorage.setItem(SESSION_STATS_KEY, JSON.stringify(empty));
    window.localStorage.removeItem(LESSON_TOKEN_LOGS_KEY);
  } catch {
    // ignore storage errors
  }
  return empty;
}
