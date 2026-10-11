// src/services/paymentSettingsService.ts
// Razorpay Key ID per hub, stored in hubs/{hubId}/settings/payment so the
// customer app reads the right key for the customer's hub.
//
// ONLY the Key ID belongs here. It is designed to be public — the mobile app
// shows it to Razorpay's checkout. The Key SECRET must never be stored in
// Firestore or sent to any app: anyone holding it can issue refunds and read
// every transaction. There is no fallback key: a hub without one can't take
// payments until an admin saves it.

import { getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { hubDoc } from '../data/hubs';
import { logAudit } from '../utils/auditLogger';

export interface RazorpayHubConfig {
  keyId: string;
  /** Lets a hub be switched off without deleting its key. */
  enabled: boolean;
}

export type RazorpaySettings = Record<string, RazorpayHubConfig>;

const paymentDoc = (hubId: string) => hubDoc(hubId, 'settings', 'payment');

export const getRazorpaySettings = async (hubIds: string[]): Promise<RazorpaySettings> => {
  const entries = await Promise.all(
    hubIds.map(async (hubId) => {
      try {
        const data = (await getDoc(paymentDoc(hubId))).data() ?? {};
        return [hubId, { keyId: data.razorpayKeyId ?? '', enabled: data.razorpayEnabled ?? false }] as const;
      } catch {
        return [hubId, { keyId: '', enabled: false }] as const; // no access to this hub
      }
    }),
  );
  return Object.fromEntries(entries);
};

export const saveRazorpayForHub = async (hubId: string, config: RazorpayHubConfig): Promise<void> => {
  const keyId = config.keyId.trim();
  if (!describeKeyId(keyId).ok) throw new Error('That is not a valid Razorpay Key ID.');
  await setDoc(
    paymentDoc(hubId),
    { razorpayKeyId: keyId, razorpayEnabled: config.enabled && !!keyId, updatedAt: serverTimestamp() },
    { merge: true },
  );
  await logAudit({
    hubId,
    category: 'Financials & Refunds',
    action: `Razorpay key ${keyId ? 'saved' : 'cleared'} (${config.enabled ? 'enabled' : 'disabled'})`,
    target: `hubs/${hubId}/settings/payment`,
    after: { razorpayKeyId: keyId, razorpayEnabled: config.enabled },
  });
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
