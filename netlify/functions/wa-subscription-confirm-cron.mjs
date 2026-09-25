// Confirms a new subscription to the customer over WhatsApp.
//
// Runs often rather than daily: a confirmation is only reassuring if it arrives
// while the customer still remembers subscribing.

import { collection, getDocs, doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { connect, getAutomations } from '../lib/firestore.mjs';
import { templateSpec, sendTemplate, normalizePhone, apiKey, campaignId } from '../lib/getgabs.mjs';

// Keeps one run inside Netlify's execution limit; the next run takes the rest.
const MAX_PER_RUN = 10;

const SETTINGS_PATH = ['settings', 'subscription_confirmation'];

const alreadyHandled = (s) => Boolean(s.confirmationWhatsappStatus);

/** The template shows a readable date, not the ISO value stored in Firestore. */
const formatDate = (value) => {
  const parts = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!parts) return '';
  const [, y, m, d] = parts;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const productNameOf = (s) =>
  s.product?.name || s.productName || s.planName || 'MilkyLush Subscription';

export default async () => {
  if (!apiKey() || !campaignId()) {
    console.error('Getgabs is not configured; set GETGABS_API_KEY and GETGABS_CAMPAIGN_ID');
    return;
  }

  const db = await connect();
  const settingsRef = doc(db, ...SETTINGS_PATH);
  const settings = await getDoc(settingsRef);
  const subs = await getDocs(collection(db, 'subscriptions'));

  // First ever run: every subscription that already exists predates this
  // feature and must not be confirmed retrospectively. Marking them is what
  // stops one run messaging the entire customer base.
  if (!settings.exists() || settings.data()?.initialized !== true) {
    let marked = 0;
    for (const snap of subs.docs) {
      if (alreadyHandled(snap.data())) continue;
      await setDoc(snap.ref, { confirmationWhatsappStatus: 'skipped_existing' }, { merge: true });
      marked++;
    }
    await setDoc(
      settingsRef,
      { initialized: true, initializedAt: new Date().toISOString(), markedExisting: marked },
      { merge: true }
    );
    console.log(`first run: marked ${marked} existing subscription(s) as skipped, confirmed nobody`);
    return;
  }

  const rule = (await getAutomations(db)).subscriptionConfirmation;
  if (!rule.enabled) {
    console.log('subscription confirmation is switched off in the admin panel');
    return;
  }

  const pending = subs.docs.filter((snap) => !alreadyHandled(snap.data())).slice(0, MAX_PER_RUN);
  if (pending.length === 0) {
    console.log('no new subscriptions to confirm');
    return;
  }

  const users = await getDocs(collection(db, 'users'));
  const userById = new Map();
  users.forEach((u) => userById.set(u.id, u.data()));

  let spec;
  try {
    spec = await templateSpec(rule.template);
  } catch (err) {
    console.error(`could not load template ${rule.template}: ${err.message}`);
    return;
  }

  for (const snap of pending) {
    const sub = snap.data();
    const user = userById.get(sub.userId);
    const phone = normalizePhone(user?.phone || user?.phoneNumber || user?.mobile || sub.customerPhone);
    const name = user?.name || sub.customerName || 'Valued Customer';

    if (!phone) {
      // Some subscriptions point at a userId with no matching customer record.
      await setDoc(snap.ref, { confirmationWhatsappStatus: 'no_phone' }, { merge: true });
      console.warn(`skipping ${snap.id}: no phone for user ${sub.userId}`);
      continue;
    }

    // Claiming in a transaction stops a retried run confirming twice.
    const claimed = await runTransaction(db, async (tx) => {
      const fresh = await tx.get(snap.ref);
      if (!fresh.exists() || alreadyHandled(fresh.data())) return false;
      tx.update(snap.ref, { confirmationWhatsappStatus: 'sending' });
      return true;
    });
    if (!claimed) continue;

    // The approved template carries three body values: customer, product, date.
    const filled = JSON.parse(JSON.stringify(spec));
    for (const component of filled.template?.components ?? []) {
      if (component.type?.toUpperCase() !== 'BODY' || !component.parameters?.length) continue;
      const values = [name, productNameOf(sub), formatDate(sub.startDate) || formatDate(sub.endDate)];
      component.parameters = component.parameters.map((param, i) => ({
        type: 'text',
        text: values[i] ?? param.text ?? '',
      }));
    }

    const result = await sendTemplate(filled, phone, name);

    await setDoc(
      snap.ref,
      {
        confirmationWhatsappStatus: result.success ? 'sent' : 'failed',
        confirmationWhatsappSentAt: new Date().toISOString(),
        confirmationWhatsappError: result.success ? null : result.error,
      },
      { merge: true }
    );

    console.log(
      result.success
        ? `confirmed ${name} (${phone}) for ${snap.id}`
        : `confirmation failed for ${name} (${phone}): ${result.error}`
    );

    // Pace the run so a burst does not trip Getgabs rate limiting.
    await new Promise((r) => setTimeout(r, 400));
  }
};

export const config = { schedule: '*/5 * * * *' };
