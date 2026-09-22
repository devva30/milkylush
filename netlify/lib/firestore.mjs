// Shared Firestore connection for the scheduled senders.
//
// Signs in as the MilkyLush admin account because these run on a server with no
// user session. The credentials come from Netlify environment variables.

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const FIREBASE_CONFIG = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyBLLmjVTiJ8uKlrSiy4A6yUjVbzgSqMR6g',
  authDomain: 'milkylush-8f110.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'milkylush-8f110',
  storageBucket: 'milkylush-8f110.firebasestorage.app',
  messagingSenderId: '668523107428',
  appId: '1:668523107428:web:4c5565c8ac169fd619bb71',
};

export async function connect() {
  const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
  const email = process.env.MILKYLUSH_ADMIN_EMAIL;
  const password = process.env.MILKYLUSH_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('MILKYLUSH_ADMIN_EMAIL / MILKYLUSH_ADMIN_PASSWORD are not set');

  const auth = getAuth(app);
  if (!auth.currentUser) await signInWithEmailAndPassword(auth, email, password);
  return getFirestore(app);
}

const DEFAULTS = {
  welcome: { enabled: true, template: process.env.GETGABS_WELCOME_TEMPLATE || 'milkylush_welcome' },
  subscriptionExpiry: { enabled: false, template: 'subscription_expiry_alert', daysBefore: 1 },
};

/** Reads the automation rules the admin chose in the panel. */
export async function getAutomations(db) {
  try {
    const stored = (await getDoc(doc(db, 'settings', 'whatsapp_automations'))).data() ?? {};
    return {
      welcome: { ...DEFAULTS.welcome, ...(stored.welcome ?? {}) },
      subscriptionExpiry: { ...DEFAULTS.subscriptionExpiry, ...(stored.subscriptionExpiry ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}
