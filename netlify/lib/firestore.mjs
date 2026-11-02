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
  staffOrderAlert: { enabled: false, template: 'hub_new_order' },
  staffSubscriptionAlert: { enabled: false, template: 'hub_new_subscription' },
};

/** Reads the automation rules the admin chose in the panel. */
export async function getAutomations(db) {
  try {
    const stored = (await db.collection('config').doc('whatsapp_automations').get()).data() ?? {};
    return Object.fromEntries(
      Object.keys(DEFAULTS).map((key) => [key, { ...DEFAULTS[key], ...(stored[key] ?? {}) }])
    );
  } catch {
    return DEFAULTS;
  }
}

/**
 * The same test the Firestore security rules apply: an active staff member who is
 * a super admin, or a hub admin of this particular hub. Riders and customers, who
 * also hold valid sign-ins, are refused.
 */
export const canManageHub = (staff, hubId) =>
  Boolean(
    staff &&
      staff.active === true &&
      (staff.role === 'super_admin' ||
        (staff.role === 'hub_admin' && Array.isArray(staff.hubIds) && staff.hubIds.includes(hubId)))
  );

// The web API key is public by design (it is in the browser bundle); it only
// identifies the project to Google's own sign-in service.
const WEB_API_KEY = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyBLLmjVTiJ8uKlrSiy4A6yUjVbzgSqMR6g';

/**
 * Asks Google who a sign-in token belongs to. This deliberately does not use
 * firebase-admin/auth: its jwks-rsa dependency require()s the ESM-only jose
 * package, which crashes when Netlify ships node_modules unbundled. Every
 * function that merely imported this file then failed to start, including the
 * scheduled senders, and nothing was sent until it was removed. Google's lookup
 * also rejects an expired or forged token, so nothing is lost by asking it.
 */
async function uidFromIdToken(idToken) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) return null;
  const user = (await res.json())?.users?.[0];
  return user && user.disabled !== true ? user.localId : null;
}

/** Checks a Firebase sign-in token from the admin panel and that it may manage this hub. */
export async function verifyHubAdmin(idToken, hubId) {
  if (!idToken) return { ok: false, status: 401, error: 'Sign in to change this.' };

  const uid = await uidFromIdToken(idToken);
  if (!uid) return { ok: false, status: 401, error: 'Your sign-in has expired. Sign in again.' };

  const db = await connect();
  const staff = (await db.collection('staff').doc(uid).get()).data();
  if (!canManageHub(staff, hubId)) {
    return { ok: false, status: 403, error: 'Only an admin of this hub can change its alert number.' };
  }
  return { ok: true, uid, db };
}
