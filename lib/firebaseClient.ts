import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { TutorLesson } from '../types/tutor';
import type { EmojiMimicState, Uz3DLessonResponse, Uz3DSegment } from '../types/uz3d';
import { findCatalogModel } from './modelCatalog';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export interface CloudLessonSummary {
  id: string;
  userId: string;
  topicTitle: string;
  subject: TutorLesson['subject'];
  engine: TutorLesson['engine'];
  stepCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const VALID_ID_RE = /^[a-zA-Z0-9_-]+$/;
const VALID_SUBJECTS = new Set<TutorLesson['subject']>([
  'math',
  'geometry',
  'physics',
  'chemistry',
  'biology',
  'history',
  'language',
]);
const VALID_ENGINES = new Set<TutorLesson['engine']>([
  'plotly2d',
  'plotly3d',
  'threejs',
  'pdb',
  'pubchem',
  'mermaid',
  'svg2d',
]);

function sanitizeSafeId(raw: string, fallback = 'item'): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  if (cleaned && VALID_ID_RE.test(cleaned)) return cleaned;
  return fallback;
}

function clampString(value: string, maxLen: number, fallback = ''): string {
  const trimmed = value.trim();
  return (trimmed || fallback).slice(0, maxLen);
}

export async function syncUserProfileToFirestore(
  user: User,
  lastLessonTopic?: string
): Promise<void> {
  if (!user.uid || !user.email || !user.emailVerified) return;
  if (!VALID_ID_RE.test(user.uid) || user.uid.length > 128) return;

  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const safeEmail = clampString(user.email, 160);
  const safeName = clampString(
    user.displayName || user.email.split('@')[0] || 'Oquvchi',
    100,
    'Oquvchi'
  );
  const safeTopic = lastLessonTopic ? clampString(lastLessonTopic, 180) : undefined;

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: safeEmail,
        displayName: safeName,
        ...(safeTopic ? { lastLessonTopic: safeTopic } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        email: safeEmail,
        displayName: safeName,
        ...(safeTopic ? { lastLessonTopic: safeTopic } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function recordLessonToFirestore(
  user: User,
  lesson: TutorLesson
): Promise<void> {
  if (!user.uid || !user.emailVerified) return;
  if (!VALID_ID_RE.test(user.uid) || user.uid.length > 128) return;

  const rawId = lesson.id || lesson.topic_title || 'lesson';
  const lessonId = sanitizeSafeId(rawId, `lesson-${Date.now()}`);
  const lessonPath = `users/${user.uid}/lessons/${lessonId}`;
  const lessonRef = doc(db, 'users', user.uid, 'lessons', lessonId);

  const safeTitle = clampString(lesson.topic_title || 'Dars', 180, 'Dars');
  const safeSubject = VALID_SUBJECTS.has(lesson.subject) ? lesson.subject : 'math';
  const safeEngine = VALID_ENGINES.has(lesson.engine) ? lesson.engine : 'svg2d';
  const safeStepCount = Math.max(1, Math.min(20, Math.round(lesson.steps.length || 1)));

  try {
    await syncUserProfileToFirestore(user, safeTitle);
    const existingSnap = await getDoc(lessonRef);
    if (!existingSnap.exists()) {
      await setDoc(lessonRef, {
        id: lessonId,
        userId: user.uid,
        topicTitle: safeTitle,
        subject: safeSubject,
        engine: safeEngine,
        stepCount: safeStepCount,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(lessonRef, {
        topicTitle: safeTitle,
        subject: safeSubject,
        engine: safeEngine,
        stepCount: safeStepCount,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, lessonPath);
  }
}

export function subscribeToUserLessons(
  user: User,
  onData: (records: CloudLessonSummary[]) => void
): () => void {
  if (!user.uid || !user.emailVerified) {
    onData([]);
    return () => {};
  }

  const colPath = `users/${user.uid}/lessons`;
  const q = query(
    collection(db, 'users', user.uid, 'lessons'),
    where('userId', '==', user.uid),
    orderBy('updatedAt', 'desc'),
    limit(20)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: CloudLessonSummary[] = snapshot.docs.map(
        (d) => d.data() as CloudLessonSummary
      );
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, colPath);
    }
  );
}

const VALID_UZ3D_MODELS = new Set([
  'electric_motor',
  'human_heart',
  'atom_bohr',
  'plant_cell',
  'none_2d_board',
]);
const VALID_UZ3D_SOURCES = new Set<NonNullable<Uz3DLessonResponse['source_channel']>>([
  'youtube_extension',
  'local_audio',
  'image_topic',
  'mock_demo',
]);
const VALID_MIMICS = new Set<EmojiMimicState>([
  'explaining',
  'amazed',
  'thinking',
  'happy',
  'warning',
]);

export async function getCachedVideoLessonFromFirestore(
  user: User | null,
  rawVideoId: string
): Promise<Uz3DLessonResponse | null> {
  if (!user || !user.emailVerified) return null;
  const videoId = sanitizeSafeId(rawVideoId, '');
  if (!videoId || !VALID_ID_RE.test(videoId)) return null;

  const docPath = `videoLessons/${videoId}`;
  try {
    const snap = await getDoc(doc(db, 'videoLessons', videoId));
    if (!snap.exists()) return null;
    const data = snap.data() as {
      videoId: string;
      lessonId: string;
      selectedModelId: string;
      lessonTitleUz: string;
      sourceChannel: Uz3DLessonResponse['source_channel'];
      segments: Uz3DSegment[];
    };
    if (!Array.isArray(data.segments) || data.segments.length === 0) return null;
    const model = findCatalogModel(data.selectedModelId);
    return {
      lesson_id: data.lessonId,
      video_id: data.videoId,
      source_channel: data.sourceChannel,
      selected_model_id: data.selectedModelId,
      model_glb_url: model.model_glb_url,
      lesson_title_uz: data.lessonTitleUz,
      cached: true,
      provider: 'firestore-cache',
      segments: data.segments,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

export async function saveVideoLessonToFirestore(
  user: User | null,
  lesson: Uz3DLessonResponse
): Promise<void> {
  if (!user || !user.uid || !user.emailVerified || !lesson.video_id) return;
  if (!VALID_ID_RE.test(user.uid) || user.uid.length > 128) return;

  const videoId = sanitizeSafeId(lesson.video_id, '');
  if (!videoId) return;
  const lessonId = sanitizeSafeId(lesson.lesson_id || `uz3d-${videoId}`, `uz3d-${videoId}`);
  const selectedModelId = VALID_UZ3D_MODELS.has(lesson.selected_model_id)
    ? lesson.selected_model_id
    : 'none_2d_board';
  const sourceChannel =
    lesson.source_channel && VALID_UZ3D_SOURCES.has(lesson.source_channel)
      ? lesson.source_channel
      : 'youtube_extension';
  const lessonTitleUz = clampString(lesson.lesson_title_uz || 'Uz3D Dars', 200, 'Uz3D Dars');

  const safeSegments = (lesson.segments || []).slice(0, 15).map((seg, idx) => ({
    start_sec: Number.isFinite(seg.start_sec) ? Math.max(0, Math.round(seg.start_sec)) : idx * 15,
    end_sec: Number.isFinite(seg.end_sec)
      ? Math.max(1, Math.round(seg.end_sec))
      : (idx + 1) * 15,
    uzbek_title: clampString(seg.uzbek_title || `${idx + 1}-qism`, 200, `${idx + 1}-qism`),
    uzbek_explanation: clampString(
      seg.uzbek_explanation || lessonTitleUz,
      1500,
      lessonTitleUz
    ),
    camera_hotspot: clampString(seg.camera_hotspot || 'overview', 64, 'overview'),
    emoji_mimic: VALID_MIMICS.has(seg.emoji_mimic) ? seg.emoji_mimic : 'explaining',
    key_formula_or_term: seg.key_formula_or_term
      ? clampString(seg.key_formula_or_term, 300)
      : null,
  }));

  if (safeSegments.length === 0) return;

  const docPath = `videoLessons/${videoId}`;
  const ref = doc(db, 'videoLessons', videoId);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        videoId,
        lessonId,
        selectedModelId,
        lessonTitleUz,
        sourceChannel,
        createdByUid: user.uid,
        segments: safeSegments,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (snap.data()?.createdByUid === user.uid) {
      await updateDoc(ref, {
        lessonId,
        selectedModelId,
        lessonTitleUz,
        sourceChannel,
        segments: safeSegments,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
};
