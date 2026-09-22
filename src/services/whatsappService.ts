// src/services/whatsappService.ts
// Getgabs WhatsApp integration for the MilkyLush admin panel.
//
// LOCAL DEVELOPMENT ONLY.
// Calls go through the /api/getgabs proxy declared in vite.config.ts, which
// exists only in `npm run dev`. That proxy is what gets around the browser's
// CORS block, and the API key is read from .env.local, which means it is
// compiled into the JavaScript bundle. Both are fine on localhost and neither
// is acceptable on a public site, so before deploying, switch the calls back to
// the Netlify Functions in netlify/functions — they already do all of this
// server-side with the key kept out of the browser.

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

const getApiKey = (): string =>
  env.VITE_GETGABS_API_KEY || localStorage.getItem('GETGABS_API_KEY') || '';

// Getgabs rejects a send with "Wrong parameters!" when campaign_id is missing
// and "Wrong Campaign ID!" when it is not a real campaign, so this must be an
// id copied from Broadcast > Campaign List in the Getgabs dashboard.
const getCampaignId = (): string =>
  env.VITE_GETGABS_CAMPAIGN_ID || localStorage.getItem('GETGABS_CAMPAIGN_ID') || '';

const getSender = (): string =>
  env.VITE_GETGABS_SENDER || localStorage.getItem('GETGABS_SENDER_NUMBER') || '919902882332';

export const WELCOME_TEMPLATE_NAME: string =
  env.VITE_GETGABS_WELCOME_TEMPLATE ||
  localStorage.getItem('GETGABS_WELCOME_TEMPLATE') ||
  '7days_free_milk';

// Templates approved with a media header arrive with an empty link, which Meta
// rejects, so a hosted MilkyLush image is substituted.
const HEADER_IMAGE =
  'https://app.getgabs.com/getgabs-uploads/cdngallery/16aba4cadbfcc7fc1e24f75181699fe3fdccd4a40563f8fdf579cba71cd11c07/files/Rl3qbzdQQdSw10BK.png';

const url = (path: string) => `/api/getgabs${path}`;

/** Formats mobile numbers to E.164 with the India country code. */
export const formatPhoneNumberForWhatsApp = (phone: string): string => {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(1);
  return '';
};

let cachedToken: { token: string; expiresAt: number } | null = null;

const getSessionToken = async (): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No Getgabs API key configured — add it in Settings or .env.local');
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const res = await fetch(url(`/partners/getSessionToken?api_key=${encodeURIComponent(apiKey)}`));
  const text = await res.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    // The dev proxy is missing, so the SPA fallback answered with index.html.
    throw new Error('Getgabs proxy is not running — start the app with "npm run dev"');
  }

  if (!data?.access_token) throw new Error(data?.message || 'Getgabs authentication failed');

  // Renew a minute early so a broadcast never starts on an expiring token.
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(0, (data.expires_in ?? 3600) - 60) * 1000,
  };
  return cachedToken.token;
};

/** Lists the approved templates on the MilkyLush Getgabs account. */
export const fetchApprovedTemplates = async (): Promise<GetgabsTemplate[]> => {
  const apiKey = getApiKey();
  const token = await getSessionToken();
  const seen = new Map<string, GetgabsTemplate>();

  for (let page = 1; page <= 10; page++) {
    const res = await fetch(url(`/partners/api/template/fetchAll?page=${page}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ adminauthToken: apiKey, searchValue: '' }),
    });
    const data = await res.json();

    for (const row of data?.data ?? []) {
      // The account lists one row per language variant of the same template.
      if (!seen.has(row.template_name)) {
        seen.set(row.template_name, { name: row.template_name, category: row.category });
      }
    }
    if (page >= (data?.last_page ?? 1)) break;
  }

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
};

/** Returns the exact send payload Getgabs defines for a template. */
const fetchTemplateSpec = async (templateName: string): Promise<any> => {
  const token = await getSessionToken();

  const res = await fetch(url('/partners/api/template/fetchJson'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ adminauthToken: getApiKey(), template_name: templateName }),
  });
  const spec = await res.json();
  if (!spec?.template) throw new Error(spec?.message || `Getgabs has no spec for "${templateName}"`);
  return spec;
};

const buildPayload = (spec: any, phone: string, customerName: string) => {
  const payload = JSON.parse(JSON.stringify(spec));

  payload.api_key = getApiKey();
  payload.sender = getSender();
  payload.campaign_id = getCampaignId();
  payload.to = phone;
  payload.receiver_name = customerName || 'Valued Customer';

  for (const component of payload.template?.components ?? []) {
    for (const param of component.parameters ?? []) {
      for (const media of ['image', 'video', 'document'] as const) {
        if (param[media] && !param[media].link) param[media].link = HEADER_IMAGE;
      }
    }
  }

  return payload;
};

const sendOne = async (spec: any, phone: string, name: string): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await fetch(url('/whatsappbusiness/send-templated-message'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(spec, phone, name)),
    });

    // Read as text first: Getgabs sometimes answers 200 with a non-JSON body,
    // and parsing straight to JSON threw that detail away, leaving a useless
    // "HTTP 200" as the reason a send failed.
    const raw = await res.text();
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return { success: false, message: `Getgabs returned non-JSON (HTTP ${res.status}): ${raw.slice(0, 160)}` };
    }

    const messageId = data?.messages?.[0]?.id;
    if (messageId) return { success: true, message: messageId };

    // Getgabs reports failures as "message" on some errors and "msg" on others.
    const reason = data?.message || data?.msg || data?.error?.message;
    return { success: false, message: reason || `HTTP ${res.status}: ${raw.slice(0, 160)}` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error' };
  }
};

/**
 * Sends one approved template to many recipients, one at a time so a partial
 * failure is visible per customer rather than failing the whole run.
 */
export const broadcastTemplate = async (
  templateName: string,
  recipients: BroadcastRecipient[],
  onProgress?: (done: number, total: number) => void
): Promise<BroadcastResult[]> => {
  if (!getCampaignId()) {
    throw new Error(
      'No Getgabs campaign ID configured. Copy one from Broadcast > Campaign List in Getgabs into VITE_GETGABS_CAMPAIGN_ID — Getgabs refuses every send without it.'
    );
  }

  const spec = await fetchTemplateSpec(templateName);
  const results: BroadcastResult[] = [];
  let sentSoFar = 0;

  for (const recipient of recipients) {
    const phone = formatPhoneNumberForWhatsApp(recipient.phone);

    if (!phone) {
      results.push({ recipient, success: false, message: 'Invalid phone number' });
    } else {
      // Pace the run. Firing a whole audience back to back trips Getgabs rate
      // limiting, which answers 200 with a body that carries no message id.
      if (sentSoFar > 0) await new Promise((r) => setTimeout(r, 400));
      sentSoFar++;

      const outcome = await sendOne(spec, phone, recipient.name);
      results.push({ recipient: { ...recipient, phone }, ...outcome });
    }

    onProgress?.(results.length, recipients.length);
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
