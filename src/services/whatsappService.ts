// src/services/whatsappService.ts
// Getgabs WhatsApp integration for the MilkyLush admin panel.
//
// Sending always happens server-side, so the Getgabs API key never reaches the
// browser. The same code serves both environments: netlify/functions in
// production, and a Vite middleware in `npm run dev` (see vite.config.ts).

import { collection, addDoc, doc, getDoc, setDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { db, auth } from '../firebase';
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

// Used only when nothing has been chosen in the admin panel yet.
export const DEFAULT_WELCOME_TEMPLATE: string =
  env.VITE_GETGABS_WELCOME_TEMPLATE || 'milkylush_welcome';

// Which template each automatic message uses. Kept in Firestore rather than in
// code or localStorage because the scheduled senders on the server read the same
// values, and so a choice survives a browser change or a redeploy.
// Lives under config/, not settings/: the security rules expose config to the
// admin panel but deny top-level settings, so a doc kept there is invisible to
// the browser. The panel then silently fell back to built-in defaults and
// displayed automations as off while they were running.
const AUTOMATIONS_DOC = ['config', 'whatsapp_automations'] as const;

export type AutomationKey =
  | 'welcome'
  | 'subscriptionExpiry'
  | 'subscriptionConfirmation'
  | 'staffOrderAlert'
  | 'staffSubscriptionAlert';

export interface AutomationRule {
  enabled: boolean;
  template: string;
  /** Only meaningful for subscriptionExpiry: how many days ahead to warn. */
  daysBefore?: number;
}

export const AUTOMATION_LABELS: Record<AutomationKey, { title: string; description: string }> = {
  welcome: {
    title: 'Welcome message',
    description:
      'Sent once when a new customer signs up in the mobile app. Google signups have no phone number, so they get the welcome email instead.',
  },
  subscriptionExpiry: {
    title: 'Subscription expiry reminder',
    description: 'Sent once to each customer the day before their subscription ends.',
  },
  subscriptionConfirmation: {
    title: 'New subscription confirmation',
    description: 'Sent once when a customer subscribes to a product, confirming the plan and its start date.',
  },
  staffOrderAlert: {
    title: 'New order alert to hub staff',
    description:
      "Sent to the active hub's staff number (set in the card below) when a customer's order is placed and paid, with the items, total and address. A hub with no number gets no alerts.",
  },
  staffSubscriptionAlert: {
    title: 'New subscription alert to hub staff',
    description:
      "Sent to the hub's own staff number when a customer's subscription is paid and goes active, with the plan, start date and amount.",
  },
};

const DEFAULT_AUTOMATIONS: Record<AutomationKey, AutomationRule> = {
  welcome: { enabled: true, template: DEFAULT_WELCOME_TEMPLATE },
  subscriptionExpiry: { enabled: false, template: 'subscription_expiry_alert', daysBefore: 1 },
  subscriptionConfirmation: { enabled: false, template: 'subscription_confirmation' },
  staffOrderAlert: { enabled: false, template: 'hub_new_order' },
  staffSubscriptionAlert: { enabled: false, template: 'hub_new_subscription' },
};

export const getAutomations = async (): Promise<Record<AutomationKey, AutomationRule>> => {
  try {
    const stored = (await getDoc(doc(db, ...AUTOMATIONS_DOC))).data() ?? {};
    const keys = Object.keys(DEFAULT_AUTOMATIONS) as AutomationKey[];
    return Object.fromEntries(
      keys.map((key) => [key, { ...DEFAULT_AUTOMATIONS[key], ...(stored[key] ?? {}) }])
    ) as Record<AutomationKey, AutomationRule>;
  } catch {
    return DEFAULT_AUTOMATIONS;
  }
};

export const saveAutomation = async (key: AutomationKey, rule: Partial<AutomationRule>): Promise<void> => {
  await setDoc(
    doc(db, ...AUTOMATIONS_DOC),
    { [key]: rule, updatedAt: new Date().toISOString() },
    { merge: true }
  );
};

export const getWelcomeTemplate = async (): Promise<string> =>
  (await getAutomations()).welcome.template;

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

// A send to Getgabs takes about 3.5 seconds, so five per call is roughly 20, which
// sits comfortably inside the 60 seconds Netlify allows a function (see
// netlify/lib/handlers.mjs). Three calls run at once, each for different people,
// which turns a long list from a wait of an hour into one of minutes.
export const BROADCAST_BATCH_SIZE = 5;
export const BROADCAST_CONCURRENCY = 3;

/** The most contacts one uploaded list may hold. Longer lists belong in Getgabs' own Broadcast. */
export const BROADCAST_MAX_UPLOAD = 500;

/** A rough wait, so a person knows how long to leave the tab open. */
export const estimateBroadcastMinutes = (count: number): number => {
  const calls = Math.ceil(count / BROADCAST_BATCH_SIZE);
  const rounds = Math.ceil(calls / BROADCAST_CONCURRENCY);
  return Math.max(1, Math.round((rounds * 20) / 60));
};

export interface TemplateInfo {
  name: string;
  /** How many values the template's body expects. */
  bodyVariables: number;
  /** Getgabs' example for each, so a person can see what a variable stands for. */
  examples: string[];
}

/** What a template will need, asked before anything is sent. */
export const fetchTemplateInfo = async (name: string): Promise<TemplateInfo> => {
  const res = await fetch(`/api/wa-templates?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(await readError(res, 'Could not load that template'));
  return res.json();
};

export interface BroadcastOptions {
  /** Checked before each call starts; once it returns true the rest is not sent. */
  shouldStop?: () => boolean;
}

/**
 * Sends one approved template to many recipients. Sending happens server-side,
 * so the Getgabs API key is never exposed to the browser.
 *
 * Returns a result for every recipient that was attempted. If stopped part-way,
 * the ones never reached are simply absent, so the caller can say how many.
 */
export const broadcastTemplate = async (
  templateName: string,
  recipients: BroadcastRecipient[],
  onProgress?: (done: number, total: number) => void,
  options: BroadcastOptions = {}
): Promise<BroadcastResult[]> => {
  const batches: BroadcastRecipient[][] = [];
  for (let i = 0; i < recipients.length; i += BROADCAST_BATCH_SIZE) {
    batches.push(recipients.slice(i, i + BROADCAST_BATCH_SIZE));
  }

  const byBatch: BroadcastResult[][] = [];
  let nextBatch = 0;
  let done = 0;
  let refusal: Error | null = null;

  const failedBatch = (batch: BroadcastRecipient[], message: string): BroadcastResult[] =>
    batch.map((recipient) => ({ recipient, success: false, message }));

  const worker = async () => {
    while (!refusal) {
      if (options.shouldStop?.()) return;
      const index = nextBatch++;
      if (index >= batches.length) return;
      const batch = batches[index];

      try {
        const res = await fetch('/api/wa-broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateName, recipients: batch }),
        });

        if (!res.ok) {
          const message = await readError(res, 'Broadcast failed');
          // A refusal of the request itself (an unusable template) applies to every
          // call alike, so stop. Anything else is a failure of this call only.
          if (res.status >= 400 && res.status < 500) { refusal = new Error(message); return; }
          byBatch[index] = failedBatch(batch, message);
        } else {
          byBatch[index] = ((await res.json()).results ?? []).map((row: any) => ({
            recipient: { id: row.id, name: row.name, phone: row.phone },
            success: row.success,
            message: row.success ? row.messageId : row.error,
          }));
        }
      } catch (err: any) {
        byBatch[index] = failedBatch(batch, err?.message || 'Network error');
      }

      done += batch.length;
      onProgress?.(done, recipients.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(BROADCAST_CONCURRENCY, batches.length) }, worker));

  const results = byBatch.flat();
  if (refusal && results.length === 0) throw refusal;

  try {
    await addDoc(collection(db, 'whatsapp_notifications'), {
      templateName,
      trigger: 'admin_broadcast',
      recipientCount: results.length,
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
    ? (await broadcastTemplate(await getWelcomeTemplate(), [
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


// The staff alert number is private, so it is not read from Firestore directly.
// These go through a server function that checks the signed-in admin's token.
const staffAlertRequest = async (url: string, init: RequestInit = {}) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in again to change this.');
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
  });
  if (!res.ok) throw new Error(await readError(res, 'Could not reach the alert settings'));
  return (await res.json()) as { phone: string };
};

export const getStaffAlertNumber = async (hubId: string): Promise<string> =>
  (await staffAlertRequest(`/api/staff-alert-number?hub=${encodeURIComponent(hubId)}`)).phone;

export const saveStaffAlertNumber = async (hubId: string, phone: string): Promise<string> =>
  (await staffAlertRequest('/api/staff-alert-number', { method: 'POST', body: JSON.stringify({ hub: hubId, phone }) })).phone;
