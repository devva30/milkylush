// Sends the welcome WhatsApp to customers who signed up in the mobile app.
//
// This runs on Netlify's servers on a schedule, so a customer who signs up at
// 2am is greeted whether or not anyone has the admin panel open. That is the
// whole point of it existing: the browser version only ran while a tab was open.

import { collection, getDocs, doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { connect, getAutomations } from '../lib/firestore.mjs';
import { templateSpec, sendTemplate, normalizePhone, apiKey, campaignId } from '../lib/getgabs.mjs';
import { sendWelcomeEmail } from '../lib/email.mjs';

// Keeps one run well inside Netlify's execution limit; the next run picks up the rest.
const MAX_PER_RUN = 10;

const SETTINGS_PATH = ['settings', 'whatsapp_welcome'];

const hasPhone = (u) => u.phone || u.phoneNumber || u.mobile;
const hasEmail = (u) => (u.email || '').trim();
// A customer is greeted on WhatsApp if they gave a phone, otherwise by email.
const reachable = (u) => hasPhone(u) || hasEmail(u);
const alreadyHandled = (u) => u.welcomeWhatsappStatus || u.welcomeWhatsappSent;

export default async () => {
  if (!apiKey() || !campaignId()) {
    console.error('Getgabs is not configured; set GETGABS_API_KEY and GETGABS_CAMPAIGN_ID');
    return;
  }

  const db = await connect();
  const settingsRef = doc(db, ...SETTINGS_PATH);
  const settings = await getDoc(settingsRef);
  const users = await getDocs(collection(db, 'users'));

  // First ever run: everyone already registered counts as an existing customer
  // and must not be greeted. Marking them is what stops a mass send later.
  if (!settings.exists() || settings.data()?.initialized !== true) {
    let marked = 0;
    for (const snap of users.docs) {
      if (alreadyHandled(snap.data())) continue;
      await setDoc(snap.ref, { welcomeWhatsappStatus: 'skipped_existing' }, { merge: true });
      marked++;
    }
    await setDoc(settingsRef, { initialized: true, initializedAt: new Date().toISOString(), markedExisting: marked }, { merge: true });
    console.log(`first run: marked ${marked} existing customer(s) as skipped, greeted nobody`);
    return;
  }

  const pending = users.docs
    .filter((snap) => !alreadyHandled(snap.data()) && reachable(snap.data()))
    .slice(0, MAX_PER_RUN);

  if (pending.length === 0) {
    console.log('no new customers to greet');
    return;
  }

  const rule = (await getAutomations(db)).welcome;
  if (!rule.enabled) {
    console.log('welcome message is switched off in the admin panel');
    return;
  }
  const welcomeTemplate = rule.template;

  let spec = null;
  if (pending.some((snap) => hasPhone(snap.data()))) {
    try {
      spec = await templateSpec(welcomeTemplate);
    } catch (err) {
      console.error(`could not load template ${welcomeTemplate}: ${err.message}`);
      return;
    }
  }

  for (const snap of pending) {
    // Claiming in a transaction keeps overlapping runs, or a run overlapping an
    // open admin panel, from greeting the same customer twice.
    const claim = await runTransaction(db, async (tx) => {
      const fresh = await tx.get(snap.ref);
      if (!fresh.exists()) return null;
      const u = fresh.data();
      if (alreadyHandled(u)) return null;

      const phone = normalizePhone(u.phone || u.phoneNumber || u.mobile);
      const email = hasEmail(u);
      if (!phone && !email) return null;

      tx.update(snap.ref, { welcomeWhatsappStatus: 'sending', welcomeWhatsappClaimedAt: new Date().toISOString() });
      return { phone, email, name: u.name };
    });

    if (!claim) continue;

    const channel = claim.phone ? 'whatsapp' : 'email';
    const result = claim.phone
      ? await sendTemplate(spec, claim.phone, claim.name)
      : await sendWelcomeEmail(claim.email, claim.name);

    await setDoc(
      snap.ref,
      {
        welcomeWhatsappStatus: result.success ? 'sent' : 'failed',
        welcomeWhatsappChannel: channel,
        welcomeWhatsappSentAt: new Date().toISOString(),
        welcomeWhatsappError: result.success ? null : result.error,
      },
      { merge: true }
    );

    const who = `${claim.name} (${claim.phone || claim.email})`;
    console.log(
      result.success
        ? `greeted ${who} by ${channel} - ${result.messageId}`
        : `failed for ${who} by ${channel} - ${result.error}`
    );
  }
};

export const config = { schedule: '*/5 * * * *' };
