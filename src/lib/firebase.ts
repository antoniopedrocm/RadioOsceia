import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  type Auth
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

function logFirebaseProjectContext(config: FirebaseOptions) {
  console.info('[firebase] Contexto carregado no frontend', {
    projectId: config.projectId,
    authDomain: config.authDomain,
    useEmulators: import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
  });
}

function validateFirebaseConfig(config: FirebaseOptions) {
  const requiredEntries: Array<[keyof FirebaseOptions, string | undefined]> = [
    ['apiKey', config.apiKey],
    ['authDomain', config.authDomain],
    ['projectId', config.projectId],
    ['storageBucket', config.storageBucket],
    ['messagingSenderId', config.messagingSenderId],
    ['appId', config.appId]
  ];

  const missing = requiredEntries
    .filter(([, value]) => !value || !String(value).trim())
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Variáveis ausentes: ${missing.join(', ')}`);
  }
}

let firebaseInitializationError: Error | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

try {
  validateFirebaseConfig(firebaseConfig);
  logFirebaseProjectContext(firebaseConfig);
  const app = initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
} catch (error) {
  const details = error instanceof Error ? error.message : String(error);
  firebaseInitializationError = new Error(
    `Configuração Firebase inválida ou ausente. Verifique as variáveis VITE_FIREBASE_* do ambiente (${details}).`
  );
  console.error('[firebase] Falha ao inicializar Firebase.', error);
}

export { firebaseInitializationError };

export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;

let emulatorsConnected = false;

export function connectFirebaseEmulators() {
  if (firebaseInitializationError || emulatorsConnected || import.meta.env.VITE_USE_FIREBASE_EMULATORS !== 'true') {
    return;
  }

  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);

  emulatorsConnected = true;
}

export async function configureAuthPersistence(remember: boolean) {
  if (firebaseInitializationError) {
    throw firebaseInitializationError;
  }

  const persistence = typeof window === 'undefined'
    ? inMemoryPersistence
    : remember ? browserLocalPersistence : browserSessionPersistence;

  await setPersistence(auth, persistence);
}

connectFirebaseEmulators();
