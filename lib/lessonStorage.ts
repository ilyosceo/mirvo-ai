import type { TutorLesson } from '../types/tutor';
import { normalizeCacheSearchText } from './lessonMatch';

export interface SavedLessonEntry {
  key: string;
  query: string;
  lesson: TutorLesson;
  savedAt: number;
}

const SAVED_LESSONS_KEY = 'qalamai_saved_lessons_v2';
const LEGACY_SAVED_LESSONS_KEY_V1 = 'qalamai_saved_lessons_v1';
const LEGACY_HISTORY_KEY = 'qalamai_history';
const MAX_SAVED_LESSONS = 12;

export function normalizeLessonKey(raw: string): string {
  return normalizeCacheSearchText(raw) || raw.toLowerCase().trim();
}

function isStaleBrokenCellEntry(entry: SavedLessonEntry): boolean {
  return entry.lesson.steps.some(
    (s) =>
      s.render_params?.object_name_en === 'cell' &&
      s.render_params?.object_source === 'iconify'
  );
}

function filterValidEntries(parsed: unknown): SavedLessonEntry[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (item): item is SavedLessonEntry =>
      Boolean(
        item &&
          typeof item === 'object' &&
          typeof (item as SavedLessonEntry).query === 'string' &&
          (item as SavedLessonEntry).lesson &&
          Array.isArray((item as SavedLessonEntry).lesson.steps) &&
          (item as SavedLessonEntry).lesson.steps.length > 0 &&
          !isStaleBrokenCellEntry(item as SavedLessonEntry)
      )
  );
}

export function loadSavedLessons(): SavedLessonEntry[] {
  try {
    const rawV2 = localStorage.getItem(SAVED_LESSONS_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as unknown;
      const valid = filterValidEntries(parsed);
      if (Array.isArray(parsed) && valid.length !== parsed.length) {
        persistSavedLessons(valid);
      }
      return valid;
    }
    const rawV1 = localStorage.getItem(LEGACY_SAVED_LESSONS_KEY_V1);
    if (rawV1) {
      const migrated = filterValidEntries(JSON.parse(rawV1) as unknown).filter(
        (entry) => entry.lesson.engine !== 'mermaid'
      );
      if (migrated.length > 0) {
        persistSavedLessons(migrated);
      }
      return migrated;
    }
    return [];
  } catch {
    return [];
  }
}

export function persistSavedLessons(entries: SavedLessonEntry[]): SavedLessonEntry[] {
  let list = entries.slice(0, MAX_SAVED_LESSONS);
  while (list.length > 0) {
    try {
      localStorage.setItem(SAVED_LESSONS_KEY, JSON.stringify(list));
      return list;
    } catch {
      // Storage quota exceeded: evict oldest saved lesson and retry
      list = list.slice(0, list.length - 1);
    }
  }
  try {
    localStorage.removeItem(SAVED_LESSONS_KEY);
  } catch {
    // ignore storage errors
  }
  return [];
}

export function saveLessonEntry(
  prev: SavedLessonEntry[],
  query: string,
  lesson: TutorLesson
): SavedLessonEntry[] {
  const cleanQuery = query.trim() || lesson.topic_title;
  const normQuery = normalizeLessonKey(cleanQuery);
  const normTitle = normalizeLessonKey(lesson.topic_title);

  const entry: SavedLessonEntry = {
    key: normQuery,
    query: cleanQuery,
    lesson: { ...lesson, source: 'cache' },
    savedAt: Date.now(),
  };

  const filtered = prev.filter(
    (item) =>
      item.key !== normQuery &&
      normalizeLessonKey(item.lesson.topic_title) !== normTitle
  );
  return persistSavedLessons([entry, ...filtered]);
}

export function removeSavedLessonEntry(
  prev: SavedLessonEntry[],
  key: string
): SavedLessonEntry[] {
  const next = prev.filter((item) => item.key !== key);
  if (next.length === 0) {
    try {
      localStorage.removeItem(SAVED_LESSONS_KEY);
    } catch {
      // ignore
    }
    return [];
  }
  return persistSavedLessons(next);
}

export function findSavedLesson(
  entries: SavedLessonEntry[],
  query: string
): TutorLesson | null {
  const norm = normalizeLessonKey(query);
  if (!norm) return null;
  const hit = entries.find(
    (item) =>
      item.key === norm ||
      normalizeLessonKey(item.query) === norm ||
      normalizeLessonKey(item.lesson.topic_title) === norm
  );
  return hit ? { ...hit.lesson, source: 'cache' } : null;
}

export function loadLegacyHistory(): string[] {
  try {
    const saved = localStorage.getItem(LEGACY_HISTORY_KEY);
    return saved ? (JSON.parse(saved) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveLegacyHistory(items: string[]): void {
  try {
    localStorage.setItem(LEGACY_HISTORY_KEY, JSON.stringify(items.slice(0, 8)));
  } catch {
    // ignore
  }
}
