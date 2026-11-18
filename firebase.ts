import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
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

export const BLUEPRINT_LIMITS = {
  MAX_ID_LEN: 128,
  MAX_QUERY_LEN: 300,
  MAX_TOPIC_LEN: 200,
  MAX_DISPLAY_NAME_LEN: 120,
  MAX_EMAIL_LEN: 160,
  MAX_PHOTO_URL_LEN: 500,
  MIN_SPEECH_RATE: 0.7,
  MAX_SPEECH_RATE: 1.5,
  MIN_SPEECH_PITCH: 0.7,
  MAX_SPEECH_PITCH: 1.5,
  MAX_STEPS: 20,
} as const;

export function toValidDocId(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_\-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const base = cleaned || 'lesson';
  return base.slice(0, BLUEPRINT_LIMITS.MAX_ID_LEN);
}

/**
 * Recursively strips `undefined` and non-serializable values so Firestore native Maps/Lists
 * never fail with invalid field errors.
 */
export function sanitizeFirestoreValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number') {
    return (Number.isFinite(value) ? value : 0) as unknown as T;
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) =>
        Array.isArray(item)
          ? { items: sanitizeFirestoreValue(item) }
          : sanitizeFirestoreValue(item)
      ) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined && typeof v !== 'function' && typeof v !== 'symbol') {
        out[k] = sanitizeFirestoreValue(v);
      }
    }
    return out as T;
  }
  return String(value) as unknown as T;
}
