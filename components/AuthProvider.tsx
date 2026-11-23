import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  auth,
  createUserWithEmailAndPassword,
  googleProvider,
  onAuthStateChanged,
  recordLessonToFirestore,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  subscribeToUserLessons,
  syncUserProfileToFirestore,
  updateProfile,
  type CloudLessonSummary,
  type User,
} from '../lib/firebaseClient';
import type { TutorLesson } from '../types/tutor';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  isAuthenticated: boolean;
  cloudLessons: CloudLessonSummary[];
  signInWithGoogle: () => Promise<User>;
  signInWithEmail: (email: string, password: string) => Promise<User>;
  registerWithEmail: (email: string, password: string, displayName?: string) => Promise<User>;
  resendVerification: () => Promise<void>;
  logout: () => Promise<void>;
  syncLessonProgress: (lesson: TutorLesson) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudLessons, setCloudLessons] = useState<CloudLessonSummary[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser?.emailVerified) {
        void syncUserProfileToFirestore(nextUser).catch(() => {
          // Handled inside handleFirestoreError when needed
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setCloudLessons([]);
      return;
    }
    const unsub = subscribeToUserLessons(user, setCloudLessons);
    return () => unsub();
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async (): Promise<User> => {
    const cred = await signInWithPopup(auth, googleProvider);
    if (cred.user.emailVerified) {
      await syncUserProfileToFirestore(cred.user);
    }
    return cred.user;
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<User> => {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (cred.user.emailVerified) {
        await syncUserProfileToFirestore(cred.user);
      }
      return cred.user;
    },
    []
  );

  const registerWithEmail = useCallback(
    async (email: string, password: string, displayName?: string): Promise<User> => {
      const cleanEmail = email.trim();
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const name = (displayName || cleanEmail.split('@')[0] || 'Oquvchi').trim();
      if (name) {
        await updateProfile(cred.user, { displayName: name });
      }
      try {
        await sendEmailVerification(cred.user);
      } catch {
        // Verification email is optional if rate-limited
      }
      return cred.user;
    },
    []
  );

  const resendVerification = useCallback(async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const syncLessonProgress = useCallback(
    async (lesson: TutorLesson) => {
      if (!user || !user.emailVerified) return;
      try {
        await recordLessonToFirestore(user, lesson);
      } catch {
        // ErrorBoundary / console already records structured error
      }
    },
    [user]
  );

  const isAuthenticated = Boolean(user && user.email);

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        isAuthenticated,
        cloudLessons,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resendVerification,
        logout,
        syncLessonProgress,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
