import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import {
  auth,
  BLUEPRINT_LIMITS,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  sanitizeFirestoreValue,
  toValidDocId,
} from '../firebase';
import type { SavedLessonEntry } from '../lib/lessonStorage';
import type { TutorLesson } from '../types/tutor';

interface CloudLessonDoc {
  ownerId: string;
  lessonId: string;
  query: string;
  topicTitle: string;
  subject: TutorLesson['subject'];
  engine: TutorLesson['engine'];
  lesson: TutorLesson;
  lastStepIndex: number;
  completed: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

interface FirebaseAuthContextValue {
  user: User | null;
  authReady: boolean;
  isSigningIn: boolean;
  authError: string | null;
  clearAuthError: () => void;
  cloudLessons: SavedLessonEntry[];
  signInWithGoogle: () => Promise<void>;
  signOutGoogle: () => Promise<void>;
  saveLessonToCloud: (
    queryText: string,
    lesson: TutorLesson,
    stepIndex?: number,
    completed?: boolean
  ) => Promise<void>;
  removeCloudLesson: (lessonId: string) => Promise<void>;
  syncVoiceSettingsToCloud: (rate: number, pitch: number) => Promise<void>;
  syncTokenStatsToCloud: (totalTokens: number, totalCostUsd: number) => Promise<void>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | null>(null);

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function mapFirebaseAuthErrorUz(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Kirish oynasi yopildi. Davom etish uchun Gmail hisobingizni tanlang.';
    case 'auth/popup-blocked':
      return 'Brauzer kirish oynasini blokladi. Iltimos, pop-up ruxsatini yoqing.';
    case 'auth/cancelled-popup-request':
      return 'Kirish so‘rovi bekor qilindi. Qayta urinib ko‘ring.';
    case 'auth/network-request-failed':
      return 'Internet aloqasi uzildi. Tarmoqni tekshirib qayta urinib ko‘ring.';
    case 'auth/unauthorized-domain':
      return 'Ushbu domen Firebase Auth ro‘yxatiga qo‘shilmagan.';
    default:
      return error instanceof Error
        ? `Gmail orqali kirishda xatolik: ${error.message}`
        : 'Gmail orqali kirishda xatolik yuz berdi.';
  }
}

export const FirebaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudLessons, setCloudLessons] = useState<SavedLessonEntry[]>([]);
  const [asyncFatalError, setAsyncFatalError] = useState<Error | null>(null);

  if (asyncFatalError) {
    throw asyncFatalError;
  }

  const ensureUserProfile = useCallback(async (u: User) => {
    const userPath = `users/${u.uid}`;
    const userRef = doc(db, 'users', u.uid);
    const displayName = (u.displayName || '').trim().slice(0, BLUEPRINT_LIMITS.MAX_DISPLAY_NAME_LEN);
    const email = (u.email || '').trim().slice(0, BLUEPRINT_LIMITS.MAX_EMAIL_LEN);
    const photoURL = (u.photoURL || '').trim().slice(0, BLUEPRINT_LIMITS.MAX_PHOTO_URL_LEN);

    if (!email) return;

    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: u.uid,
          email,
          displayName,
          photoURL,
          preferredSpeechRate: 1,
          preferredSpeechPitch: 1.02,
          totalTokens: 0,
          totalCostUsd: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(userRef, {
          displayName,
          photoURL,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setCloudLessons([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;
    let unsubscribeLessons: (() => void) | null = null;

    const initCloudSync = async () => {
      try {
        await ensureUserProfile(user);
      } catch (error) {
        if (!cancelled) {
          setAsyncFatalError(error instanceof Error ? error : new Error(String(error)));
        }
        return;
      }

      if (cancelled) return;

      const lessonsPath = `users/${user.uid}/lessons`;
      const lessonsQuery = query(
        collection(db, 'users', user.uid, 'lessons'),
        where('ownerId', '==', user.uid),
        limit(30)
      );

      unsubscribeLessons = onSnapshot(
        lessonsQuery,
        (snapshot) => {
          const items: SavedLessonEntry[] = snapshot.docs
            .map((d) => {
              const data = d.data() as CloudLessonDoc;
              const millis = data.updatedAt?.toMillis?.() ?? Date.now();
              return {
                key: data.lessonId || d.id,
                query: data.query || data.topicTitle,
                lesson: { ...data.lesson, source: 'cache' as const },
                savedAt: millis,
              };
            })
            .sort((a, b) => b.savedAt - a.savedAt)
            .slice(0, 20);
          setCloudLessons(items);
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.LIST, lessonsPath);
          } catch (structured) {
            if (!cancelled) {
              setAsyncFatalError(
                structured instanceof Error ? structured : new Error(String(structured))
              );
            }
          }
        }
      );
    };

    void initCloudSync();

    return () => {
      cancelled = true;
      if (unsubscribeLessons) unsubscribeLessons();
    };
  }, [authReady, user, ensureUserProfile]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(mapFirebaseAuthErrorUz(error));
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOutGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signOut(auth);
      setCloudLessons([]);
    } catch (error) {
      setAuthError(mapFirebaseAuthErrorUz(error));
    }
  }, []);

  const saveLessonToCloud = useCallback(
    async (
      queryText: string,
      lesson: TutorLesson,
      stepIndex = 0,
      completed = false
    ) => {
      if (!authReady || !user) return;

      const rawId = lesson.id || lesson.topic_title || queryText;
      const lessonId = toValidDocId(rawId);
      const docPath = `users/${user.uid}/lessons/${lessonId}`;
      const docRef = doc(db, 'users', user.uid, 'lessons', lessonId);

      const cleanQuery = (queryText.trim() || lesson.topic_title || 'Dars').slice(
        0,
        BLUEPRINT_LIMITS.MAX_QUERY_LEN
      );
      const cleanTitle = (lesson.topic_title || cleanQuery).slice(
        0,
        BLUEPRINT_LIMITS.MAX_TOPIC_LEN
      );
      const boundedSteps = lesson.steps.slice(0, BLUEPRINT_LIMITS.MAX_STEPS);
      const sanitizedLesson = sanitizeFirestoreValue<TutorLesson>({
        ...lesson,
        topic_title: cleanTitle,
        steps: boundedSteps,
        source: 'cache',
      });

      const boundedStepIdx = Math.max(0, Math.min(20, Math.floor(stepIndex)));

      try {
        await ensureUserProfile(user);
        const existingSnap = await getDoc(docRef);
        if (existingSnap.exists()) {
          await updateDoc(docRef, {
            query: cleanQuery,
            topicTitle: cleanTitle,
            subject: lesson.subject,
            engine: lesson.engine,
            lesson: sanitizedLesson,
            lastStepIndex: boundedStepIdx,
            completed: Boolean(completed),
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(docRef, {
            ownerId: user.uid,
            lessonId,
            query: cleanQuery,
            topicTitle: cleanTitle,
            subject: lesson.subject,
            engine: lesson.engine,
            lesson: sanitizedLesson,
            lastStepIndex: boundedStepIdx,
            completed: Boolean(completed),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, docPath);
      }
    },
    [authReady, user, ensureUserProfile]
  );

  const removeCloudLesson = useCallback(
    async (lessonId: string) => {
      if (!authReady || !user) return;
      const safeId = toValidDocId(lessonId);
      const docPath = `users/${user.uid}/lessons/${safeId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'lessons', safeId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [authReady, user]
  );

  const syncVoiceSettingsToCloud = useCallback(
    async (rate: number, pitch: number) => {
      if (!authReady || !user) return;
      const userPath = `users/${user.uid}`;
      try {
        await ensureUserProfile(user);
        await updateDoc(doc(db, 'users', user.uid), {
          preferredSpeechRate: clamp(rate, BLUEPRINT_LIMITS.MIN_SPEECH_RATE, BLUEPRINT_LIMITS.MAX_SPEECH_RATE),
          preferredSpeechPitch: clamp(pitch, BLUEPRINT_LIMITS.MIN_SPEECH_PITCH, BLUEPRINT_LIMITS.MAX_SPEECH_PITCH),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }
    },
    [authReady, user, ensureUserProfile]
  );

  const syncTokenStatsToCloud = useCallback(
    async (totalTokens: number, totalCostUsd: number) => {
      if (!authReady || !user) return;
      const userPath = `users/${user.uid}`;
      try {
        await ensureUserProfile(user);
        await updateDoc(doc(db, 'users', user.uid), {
          totalTokens: Math.max(0, Math.round(totalTokens)),
          totalCostUsd: Math.max(0, Number(totalCostUsd.toFixed(6))),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }
    },
    [authReady, user, ensureUserProfile]
  );

  return (
    <FirebaseAuthContext.Provider
      value={{
        user,
        authReady,
        isSigningIn,
        authError,
        clearAuthError: () => setAuthError(null),
        cloudLessons,
        signInWithGoogle,
        signOutGoogle,
        saveLessonToCloud,
        removeCloudLesson,
        syncVoiceSettingsToCloud,
        syncTokenStatsToCloud,
      }}
    >
      {children}
    </FirebaseAuthContext.Provider>
  );
};

export function useFirebaseAuth(): FirebaseAuthContextValue {
  const ctx = useContext(FirebaseAuthContext);
  if (!ctx) {
    throw new Error('useFirebaseAuth must be used inside FirebaseAuthProvider');
  }
  return ctx;
}
