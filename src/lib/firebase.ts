import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, setPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION ?? 'us-central1');

let emulatorsConnected = false;

export function connectFirebaseEmulators() {
  if (emulatorsConnected || import.meta.env.VITE_USE_FIREBASE_EMULATORS !== 'true') {
    return;
  }

  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);

  emulatorsConnected = true;
}

export async function configureAuthPersistence(remember: boolean) {
  const persistence = typeof window === 'undefined'
    ? inMemoryPersistence
    : remember ? browserLocalPersistence : browserSessionPersistence;

  await setPersistence(auth, persistence);
}

connectFirebaseEmulators();
