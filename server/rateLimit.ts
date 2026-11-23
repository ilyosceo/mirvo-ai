import type { Request, Response } from 'express';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtIso: string;
  retryAfterSec: number;
  reason?: 'daily' | 'burst';
}

interface IpBucket {
  dayKey: string;
  dailyCount: number;
  burstWindowStart: number;
  burstCount: number;
}

const DEFAULT_DAILY_LIMIT = Number(process.env.MIRVO_DAILY_IP_LIMIT || 25) || 25;
const DEFAULT_BURST_LIMIT = Number(process.env.MIRVO_BURST_IP_LIMIT || 10) || 10;
const BURST_WINDOW_MS = 60_000;

const ipBuckets = new Map<string, IpBucket>();

function getUtcDayKey(nowMs: number): { dayKey: string; nextMidnightMs: number } {
  const d = new Date(nowMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const nextMidnightMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0);
  return { dayKey: `${y}-${m}-${day}`, nextMidnightMs };
}

export function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0 && xff[0]) {
    return String(xff[0]).split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function checkIpRateLimit(
  req: Request,
  options?: {
    bucket?: string;
    dailyLimit?: number;
    burstLimit?: number;
  }
): RateLimitResult {
  const nowMs = Date.now();
  const dailyLimit = Math.max(1, options?.dailyLimit ?? DEFAULT_DAILY_LIMIT);
  const burstLimit = Math.max(1, options?.burstLimit ?? DEFAULT_BURST_LIMIT);
  const clientIp = getClientIp(req);
  const key = `${options?.bucket || 'global'}:${clientIp}`;
  const { dayKey, nextMidnightMs } = getUtcDayKey(nowMs);

  // Prevent unbounded memory growth across days
  if (ipBuckets.size > 5000) {
    for (const [k, v] of ipBuckets.entries()) {
      if (v.dayKey !== dayKey) ipBuckets.delete(k);
    }
  }

  let entry = ipBuckets.get(key);
  if (!entry || entry.dayKey !== dayKey) {
    entry = {
      dayKey,
      dailyCount: 0,
      burstWindowStart: nowMs,
      burstCount: 0,
    };
  }

  if (nowMs - entry.burstWindowStart >= BURST_WINDOW_MS) {
    entry.burstWindowStart = nowMs;
    entry.burstCount = 0;
  }

  if (entry.dailyCount >= dailyLimit) {
    const retryAfterSec = Math.max(1, Math.ceil((nextMidnightMs - nowMs) / 1000));
    ipBuckets.set(key, entry);
    return {
      allowed: false,
      limit: dailyLimit,
      remaining: 0,
      resetAtIso: new Date(nextMidnightMs).toISOString(),
      retryAfterSec,
      reason: 'daily',
    };
  }

  if (entry.burstCount >= burstLimit) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((entry.burstWindowStart + BURST_WINDOW_MS - nowMs) / 1000)
    );
    ipBuckets.set(key, entry);
    return {
      allowed: false,
      limit: dailyLimit,
      remaining: Math.max(0, dailyLimit - entry.dailyCount),
      resetAtIso: new Date(entry.burstWindowStart + BURST_WINDOW_MS).toISOString(),
      retryAfterSec,
      reason: 'burst',
    };
  }

  entry.dailyCount += 1;
  entry.burstCount += 1;
  ipBuckets.set(key, entry);

  return {
    allowed: true,
    limit: dailyLimit,
    remaining: Math.max(0, dailyLimit - entry.dailyCount),
    resetAtIso: new Date(nextMidnightMs).toISOString(),
    retryAfterSec: 0,
  };
}

export function applyRateLimitHeaders(res: Response, result: RateLimitResult): void {
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', result.resetAtIso);
  if (!result.allowed && result.retryAfterSec > 0) {
    res.setHeader('Retry-After', String(result.retryAfterSec));
  }
}

export function sendRateLimitError(res: Response, result: RateLimitResult): void {
  applyRateLimitHeaders(res, result);
  const message =
    result.reason === 'burst'
      ? `Juda ko‘p so‘rov yuborildi. Iltimos, ${result.retryAfterSec} soniyadan so‘ng qayta urinib ko‘ring.`
      : `Kunlik bepul AI limiti (${result.limit} ta so‘rov) tugadi. Tayyor kesh darslardan cheklovsiz foydalanishingiz yoki ertaga qayta urinib ko‘rishingiz mumkin.`;

  res.status(429).json({
    error: message,
    rate_limited: true,
    reason: result.reason || 'daily',
    limit: result.limit,
    remaining: result.remaining,
    retry_after_sec: result.retryAfterSec,
    reset_at: result.resetAtIso,
  });
}
