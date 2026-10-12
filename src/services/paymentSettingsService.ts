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

/**
 * Razorpay generates a public Key ID (starts with rzp_live_ or rzp_test_, 23 chars)
 * and a private Key Secret (24 chars).
 * Users often copy both lines together. This helper safely extracts ONLY
 * the public Key ID, discarding any attached secret.
 */
export const sanitizeRazorpayKeyId = (raw: string): { keyId: string; strippedSecret: boolean } => {
  if (!raw) return { keyId: '', strippedSecret: false };
  const cleaned = raw.trim();

  // Pattern 1: Starts with rzp_test_ or rzp_live_ followed by 14 alphanumeric chars
  const match = cleaned.match(/^(rzp_(?:test|live)_[A-Za-z0-9]{14})/);
  if (match) {
    const extracted = match[1];
    const strippedSecret = cleaned.length > extracted.length;
    return { keyId: extracted, strippedSecret };
  }

  // Pattern 2: Multiline or space-separated
  const tokens = cleaned.split(/[\r\n\s]+/);
  for (const token of tokens) {
    const t = token.trim();
    if (/^rzp_(?:test|live)_[A-Za-z0-9]{12,18}$/.test(t)) {
      return { keyId: t, strippedSecret: tokens.length > 1 };
    }
  }

  return { keyId: cleaned, strippedSecret: false };
};

export const describeKeyId = (keyId: string = ''): { ok: boolean; note: string; keyId: string; cleanedKeyId: string } => {
  const { keyId: cleanKey, strippedSecret } = sanitizeRazorpayKeyId(keyId || '');
  if (!cleanKey) return { ok: true, note: '', keyId: '', cleanedKeyId: '' };

  if (/^rzp_(test|live)_[A-Za-z0-9]{12,18}$/.test(cleanKey)) {
    const isLive = cleanKey.startsWith('rzp_live_');
    const label = isLive ? 'Live key' : 'Test key';
    if (strippedSecret) {
      return {
        ok: true,
        note: `Extracted ${label} (${cleanKey}). Secret key was safely removed!`,
        keyId: cleanKey,
        cleanedKeyId: cleanKey,
      };
    }
    return { ok: true, note: `${label} (${cleanKey.length} chars)`, keyId: cleanKey, cleanedKeyId: cleanKey };
  }

  if ((keyId || '').trim().length > 30 && !cleanKey.startsWith('rzp_')) {
    return {
      ok: false,
      note: 'This looks like a Key Secret. Please paste the Key ID (starts with rzp_live_ or rzp_test_).',
      keyId: cleanKey,
      cleanedKeyId: cleanKey,
    };
  }

  return {
    ok: false,
    note: 'Key ID must start with rzp_test_ or rzp_live_ (approx 23 chars, e.g. rzp_live_TlTFSICHYH65OL)',
    keyId: cleanKey,
    cleanedKeyId: cleanKey,
  };
};

export const saveRazorpayForHub = async (hubId: string, config: RazorpayHubConfig): Promise<void> => {
  const { keyId: cleanKey, ok } = describeKeyId(config.keyId || '');
  if ((config.keyId || '').trim() && !ok) throw new Error('That is not a valid Razorpay Key ID.');
  const finalKey = cleanKey || (config.keyId || '').trim() || '';
  await setDoc(
    paymentDoc(hubId),
    { razorpayKeyId: finalKey, razorpayEnabled: config.enabled && !!finalKey, updatedAt: serverTimestamp() },
    { merge: true },
  );
  await logAudit({
    hubId,
    category: 'Financials & Refunds',
    action: `Razorpay key ${finalKey ? 'saved' : 'cleared'} (${config.enabled ? 'enabled' : 'disabled'})`,
    target: `hubs/${hubId}/settings/payment`,
    after: { razorpayKeyId: finalKey, razorpayEnabled: config.enabled },
  });
};

