export const DAILY_LESSON_USAGE_STORAGE_KEY = 'mirvo_ai_daily_lesson_usage_v1';

export interface DailyLessonUsage {
  dayKey: string;
  count: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getLocalDayKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function readDailyLessonUsage(
  storage: StorageLike,
  now = new Date()
): DailyLessonUsage {
  const dayKey = getLocalDayKey(now);
  try {
    const raw = storage.getItem(DAILY_LESSON_USAGE_STORAGE_KEY);
    if (!raw) return { dayKey, count: 0 };

    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as DailyLessonUsage).dayKey !== dayKey ||
      !Number.isSafeInteger((parsed as DailyLessonUsage).count) ||
      (parsed as DailyLessonUsage).count < 0
    ) {
      return { dayKey, count: 0 };
    }

    return { dayKey, count: (parsed as DailyLessonUsage).count };
  } catch {
    return { dayKey, count: 0 };
  }
}

export function recordDailyLessonCreation(
  storage: StorageLike,
  now = new Date()
): DailyLessonUsage {
  const current = readDailyLessonUsage(storage, now);
  const next = {
    dayKey: current.dayKey,
    count: Math.min(Number.MAX_SAFE_INTEGER, current.count + 1),
  };
  try {
    storage.setItem(DAILY_LESSON_USAGE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Keep the in-memory count useful when browser storage is unavailable.
  }
  return next;
}

export function loadDailyLessonUsage(): DailyLessonUsage {
  try {
    return readDailyLessonUsage(window.localStorage);
  } catch {
    return { dayKey: getLocalDayKey(new Date()), count: 0 };
  }
}

export function saveDailyLessonCreation(): DailyLessonUsage {
  try {
    return recordDailyLessonCreation(window.localStorage);
  } catch {
    const current = loadDailyLessonUsage();
    return {
      ...current,
      count: Math.min(Number.MAX_SAFE_INTEGER, current.count + 1),
    };
  }
}
