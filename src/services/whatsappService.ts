// src/services/whatsappService.ts
// Getgabs WhatsApp integration for the MilkyLush admin panel.
//
// Sending always happens server-side, so the Getgabs API key never reaches the
// browser. The same code serves both environments: netlify/functions in
// production, and a Vite middleware in `npm run dev` (see vite.config.ts).

import { collection, addDoc, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { sendWelcomeEmail } from './emailService';

export interface GetgabsTemplate {
  name: string;
  category: string;
}

export interface BroadcastRecipient {
  id?: string;
  name: string;
  phone: string;
}

export interface BroadcastResult {
  recipient: BroadcastRecipient;
  success: boolean;
  message: string;
}

const env = (import.meta as any).env ?? {};

export const WELCOME_TEMPLATE_NAME: string =
  env.VITE_GETGABS_WELCOME_TEMPLATE || '7days_free_milk';

/** Formats mobile numbers to E.164 with the India country code. */
export const formatPhoneNumberForWhatsApp = (phone: string): string => {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(1);
  return '';
};

const readError = async (res: Response, fallback: string): Promise<string> => {
  // A missing route falls through to the SPA and returns index.html, so this
  // has to cope with a body that is not JSON.
  const text = await res.text();
  try {
    return JSON.parse(text)?.error || fallback;
  } catch {
    return res.status === 404
      ? 'WhatsApp endpoints are not available here — run "npm run dev" locally, or deploy to Netlify'
      : fallback;
  }
};

/** Lists the approved templates on the MilkyLush Getgabs account. */
export const fetchApprovedTemplates = async (): Promise<GetgabsTemplate[]> => {
  const res = await fetch('/api/wa-templates');
  if (!res.ok) throw new Error(await readError(res, 'Could not load templates'));
  return (await res.json()).templates ?? [];
};

// Matches MAX_PER_CALL in netlify/lib/handlers.mjs so a larger audience is
// split across calls rather than timing out a single function invocation.
const BATCH_SIZE = 10;

/**
 * Sends one approved template to many recipients. Sending happens server-side,
 * so the Getgabs API key is never exposed to the browser.
 */
export const broadcastTemplate = async (
  templateName: string,
  recipients: BroadcastRecipient[],
  onProgress?: (done: number, total: number) => void
): Promise<BroadcastResult[]> => {
  const results: BroadcastResult[] = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    const res = await fetch('/api/wa-broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateName, recipients: batch }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Broadcast failed'));

    for (const row of (await res.json()).results ?? []) {
      results.push({
        recipient: { id: row.id, name: row.name, phone: row.phone },
        success: row.success,
        message: row.success ? row.messageId : row.error,
      });
    }

    onProgress?.(Math.min(i + BATCH_SIZE, recipients.length), recipients.length);
  }

  try {
    await addDoc(collection(db, 'whatsapp_notifications'), {
      templateName,
      trigger: 'admin_broadcast',
      recipientCount: recipients.length,
      sentCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      dispatchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Could not log broadcast to Firestore:', e);
  }

  return results;
};

export const NOTHING_TO_DO = 'already handled, or no phone number and no email';

/**
 * Greets one new customer on whichever channel they can actually be reached on.
 *
 * Customers who sign up manually give a phone number and get WhatsApp.
 * Customers who use "Continue with Google" only give an email, so they get the
 * welcome email instead. WhatsApp is preferred when both are present.
 *
 * The send is claimed in a transaction first, so two admin tabs watching the
 * same signup cannot both greet the same customer.
 */
export const sendWelcomeToNewCustomer = async (
  userId: string
): Promise<{ sent: boolean; channel: 'whatsapp' | 'email' | 'none'; reason: string }> => {
  const userRef = doc(db, 'users', userId);

  const claim = await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) return null;

    const user = snap.data() as any;
    // welcomeWhatsappSent is the older flag and is still set on some customers.
    if (user.welcomeWhatsappStatus || user.welcomeWhatsappSent) return null;

    const phone = formatPhoneNumberForWhatsApp(user.phone || user.phoneNumber || user.mobile || '');
    const email = (user.email || '').trim();
    if (!phone && !email) return null;

    tx.update(userRef, {
      welcomeWhatsappStatus: 'sending',
      welcomeWhatsappClaimedAt: new Date().toISOString(),
    });

    return { phone, email, name: user.name || 'Valued Customer' };
  });

  if (!claim) return { sent: false, channel: 'none', reason: NOTHING_TO_DO };

  const channel: 'whatsapp' | 'email' = claim.phone ? 'whatsapp' : 'email';

  const outcome = claim.phone
    ? (await broadcastTemplate(WELCOME_TEMPLATE_NAME, [
        { id: userId, name: claim.name, phone: claim.phone },
      ]))[0]
    : await sendWelcomeEmail(claim.email, claim.name);

  await updateDoc(userRef, {
    welcomeWhatsappStatus: outcome.success ? 'sent' : 'failed',
    welcomeWhatsappChannel: channel,
    welcomeWhatsappSentAt: new Date().toISOString(),
    welcomeWhatsappError: outcome.success ? null : outcome.message,
  });

  return { sent: outcome.success, channel, reason: outcome.message };
};
