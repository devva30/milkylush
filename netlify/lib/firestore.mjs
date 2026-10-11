// Shared Firestore connection for the scheduled senders.
//
// Uses the Admin SDK with a service account rather than signing in as a person.
// Server code has no business holding someone's password, and an admin user is
// still subject to Firestore security rules: when those rules were tightened,
// every automation silently stopped because it could no longer read the
// settings telling it what to send. The Admin SDK is not bound by rules, so
// tightening them protects customers without disabling the automations.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * The whole service account JSON, as one line, in FIREBASE_SERVICE_ACCOUNT.
 * Netlify environment variables are plain strings, so the file is stored as
 * JSON text rather than a path to something that will not exist on their disk.
 */
function credentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }

  // Some dashboards turn the newlines in a private key into literal \n.
  if (typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  return parsed;
}

export async function connect() {
  const app = getApps()[0] ?? initializeApp({ credential: cert(credentials()) });
  return getFirestore(app);
}

const DEFAULTS = {
  welcome: { enabled: true, template: process.env.GETGABS_WELCOME_TEMPLATE || 'milkylush_welcome' },
  subscriptionExpiry: { enabled: false, template: 'subscription_expiry_alert', daysBefore: 1 },
  subscriptionConfirmation: { enabled: false, template: 'subscription_confirmation' },
};

/** Reads the automation rules the admin chose in the panel. */
export async function getAutomations(db) {
  try {
    const stored = (await db.collection('settings').doc('whatsapp_automations').get()).data() ?? {};
    return {
      welcome: { ...DEFAULTS.welcome, ...(stored.welcome ?? {}) },
      subscriptionExpiry: { ...DEFAULTS.subscriptionExpiry, ...(stored.subscriptionExpiry ?? {}) },
      subscriptionConfirmation: { ...DEFAULTS.subscriptionConfirmation, ...(stored.subscriptionConfirmation ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}
