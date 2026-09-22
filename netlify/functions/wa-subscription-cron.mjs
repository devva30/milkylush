// Warns customers the day before their subscription ends.
//
// Runs once a day rather than every few minutes: an expiry reminder is tied to a
// calendar day, not to the minute, and sending it at a civil hour matters more
// than sending it promptly. 03:30 UTC is 09:00 IST.

import { collection, getDocs, doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { connect, getAutomations } from '../lib/firestore.mjs';
import { templateSpec, sendTemplate, normalizePhone, apiKey, campaignId } from '../lib/getgabs.mjs';

// Keeps one run inside Netlify's execution limit; the rest wait for tomorrow.
const MAX_PER_RUN = 25;

const startOfDay = (value) => {
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

export default async () => {
  if (!apiKey() || !campaignId()) {
    console.error('Getgabs is not configured; set GETGABS_API_KEY and GETGABS_CAMPAIGN_ID');
    return;
  }

  const db = await connect();
  const rule = (await getAutomations(db)).subscriptionExpiry;

  if (!rule.enabled) {
    console.log('subscription expiry reminder is switched off in the admin panel');
    return;
  }

  const today = startOfDay(new Date());
  const daysBefore = Number(rule.daysBefore) || 1;

  const [subs, users] = await Promise.all([
    getDocs(collection(db, 'subscriptions')),
    getDocs(collection(db, 'users')),
  ]);

  const phoneOf = new Map();
  const nameOf = new Map();
  users.forEach((u) => {
    const d = u.data();
    phoneOf.set(u.id, d.phone || d.phoneNumber || d.mobile || '');
    nameOf.set(u.id, d.name || 'Valued Customer');
  });

  const due = subs.docs.filter((snap) => {
    const s = snap.data();
    if (s.status !== 'active') return false;

    const end = startOfDay(s.endDate);
    if (!end) return false;
    if (Math.round((end - today) / 86400000) !== daysBefore) return false;

    // Keyed by endDate, so a customer who renews is warned again before the new
    // end date rather than being permanently marked as already reminded.
    return s.expiryAlertForEndDate !== s.endDate;
  });

  if (due.length === 0) {
    console.log(`no subscriptions ending in ${daysBefore} day(s)`);
    return;
  }

  let spec;
  try {
    spec = await templateSpec(rule.template);
  } catch (err) {
    console.error(`could not load template ${rule.template}: ${err.message}`);
    return;
  }

  for (const snap of due.slice(0, MAX_PER_RUN)) {
    const sub = snap.data();
    const phone = normalizePhone(phoneOf.get(sub.userId) || sub.customerPhone);

    if (!phone) {
      // 12 of these subscriptions point at a userId with no customer record.
      console.warn(`skipping ${snap.id}: no phone for user ${sub.userId}`);
      continue;
    }

    // Claiming in a transaction stops a retried run from warning twice.
    const claimed = await runTransaction(db, async (tx) => {
      const fresh = await tx.get(snap.ref);
      if (!fresh.exists()) return false;
      if (fresh.data().expiryAlertForEndDate === sub.endDate) return false;
      tx.update(snap.ref, { expiryAlertForEndDate: sub.endDate });
      return true;
    });
    if (!claimed) continue;

    const name = nameOf.get(sub.userId) || sub.customerName;

    // The template carries one body variable, which Getgabs' own example fills
    // with a number of days.
    const withDays = JSON.parse(JSON.stringify(spec));
    for (const component of withDays.template?.components ?? []) {
      if (component.type?.toUpperCase() === 'BODY' && component.parameters?.length) {
        component.parameters[0] = { type: 'text', text: String(daysBefore) };
      }
    }

    const result = await sendTemplate(withDays, phone, name);

    await setDoc(
      snap.ref,
      {
        expiryAlertStatus: result.success ? 'sent' : 'failed',
        expiryAlertSentAt: new Date().toISOString(),
        expiryAlertError: result.success ? null : result.error,
      },
      { merge: true }
    );

    console.log(
      result.success
        ? `expiry reminder sent to ${name} (${phone}) for ${snap.id}`
        : `expiry reminder failed for ${name} (${phone}): ${result.error}`
    );

    // Pace the run so a batch does not trip Getgabs rate limiting.
    await new Promise((r) => setTimeout(r, 400));
  }
};

export const config = { schedule: '30 3 * * *' };
