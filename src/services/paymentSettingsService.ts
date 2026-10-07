// src/services/paymentSettingsService.ts
// Razorpay Key ID per hub, so the mobile app can fetch the right one for the
// customer's location instead of hardcoding it and needing an app release to
// change it.
//
// ONLY the Key ID belongs here. It is designed to be public — the mobile app
// shows it to Razorpay's checkout. The Key SECRET must never be stored in
// Firestore or sent to any app: anyone holding it can issue refunds and read
// every transaction. When payment verification is added, the secret goes in a
// server environment variable and is used only by a server function.

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const RAZORPAY_DOC = ['settings', 'razorpay'] as const;

export interface RazorpayHubConfig {
  keyId: string;
  /** Lets a hub be switched off without deleting its key. */
  enabled: boolean;
  googleMapsKey?: string;
  fcmServerKey?: string;
  smsWebhookUrl?: string;
}

export type RazorpaySettings = Record<string, RazorpayHubConfig>;

const defaultHubConfig = (hubId: string): RazorpayHubConfig => ({
  keyId: hubId === 'hub_hosur_main' ? 'rzp_test_TVUJtWno7iUXYw' : 'rzp_test_Rt3Ppu4aqXwsO6',
  enabled: true,
  googleMapsKey: '',
  fcmServerKey: '',
  smsWebhookUrl: '',
});

export const getRazorpaySettings = async (hubIds: string[]): Promise<RazorpaySettings> => {
  let stored: Record<string, Partial<RazorpayHubConfig>> = {};
  try {
    stored = ((await getDoc(doc(db, ...RAZORPAY_DOC))).data() ?? {}) as typeof stored;
  } catch {
    stored = {};
  }

  return Object.fromEntries(
    hubIds.map((hubId) => [hubId, { ...defaultHubConfig(hubId), ...(stored[hubId] ?? {}) }])
  );
};

export const saveRazorpayForHub = async (
  hubId: string,
  config: RazorpayHubConfig
): Promise<void> => {
  const payload = {
    ...config,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(
    doc(db, ...RAZORPAY_DOC),
    { [hubId]: payload },
    { merge: true }
  );
  // Also sync to hub-specific doc for direct Flutter app subscriptions
  await setDoc(
    doc(db, 'settings', `hub_keys_${hubId}`),
    payload,
    { merge: true }
  );
};

/**
 * A Razorpay Key ID looks like rzp_test_XXXXXXXXXXXX or rzp_live_XXXXXXXXXXXX.
 * Checking the shape catches the common mistake of pasting the Key Secret here,
 * which must never be stored in Firestore.
 */
export const describeKeyId = (keyId: string): { ok: boolean; note: string } => {
  const value = keyId.trim();
  if (!value) return { ok: true, note: '' };
  if (/^rzp_(test|live)_[A-Za-z0-9]{10,}$/.test(value)) {
    return { ok: true, note: value.startsWith('rzp_live_') ? 'Live key' : 'Test key' };
  }
  if (/^rzp_/.test(value)) return { ok: false, note: 'Does not look like a complete Key ID' };
  return { ok: false, note: 'Key IDs start with rzp_test_ or rzp_live_ — never paste the Key Secret here' };
};
