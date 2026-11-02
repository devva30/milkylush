// Tells each hub's staff, on WhatsApp, when a customer places an order or starts
// a subscription.
//
// Each hub's alerts go to its own number, held in a Netlify environment variable
// (STAFF_ALERT_PHONE_HOSUR, STAFF_ALERT_PHONE_BENGALURU) rather than in
// Firestore. config/ and hubs/*/settings are readable by anyone, signed in or
// not, so a staff member's mobile number kept there would be public.
//
// A hub with no number set gets no alerts, and nothing is read from the
// database at all until at least one number is configured.

import { connect, getAutomations } from '../lib/firestore.mjs';
import { templateSpec, sendTemplate, normalizePhone, apiKey, campaignId } from '../lib/getgabs.mjs';
import { orderValues, subscriptionValues } from '../lib/staffAlerts.mjs';

const HUBS = [
  { id: 'hosur', name: 'Hosur', phoneEnv: 'STAFF_ALERT_PHONE_HOSUR' },
  { id: 'bengaluru', name: 'Bangalore', phoneEnv: 'STAFF_ALERT_PHONE_BENGALURU' },
];

// Only records created this recently are looked at. A customer's payment can
// complete minutes after the record was created, so this has to be wider than
// that, but every extra hour is re-read on every run.
const WINDOW_HOURS = Number(process.env.STAFF_ALERT_WINDOW_HOURS) || 72;

// Keeps one run inside Netlify's execution limit; the next run takes the rest.
const MAX_PER_RUN = 10;

const KINDS = [
  {
    key: 'orders',
    collection: 'orders',
    rule: 'staffOrderAlert',
    // Created as pending_payment before Razorpay opens, so only a placed order is
    // real. Alerting on creation would announce every abandoned checkout.
    isReady: (d) => d.status === 'placed',
    values: orderValues,
  },
  {
    key: 'subscriptions',
    collection: 'subscriptions',
    rule: 'staffSubscriptionAlert',
    isReady: (d) => d.status === 'active',
    values: subscriptionValues,
  },
];

const handled = (d) => Boolean(d.staffAlertStatus);

export default async () => {
  if (!apiKey() || !campaignId()) {
    console.error('Getgabs is not configured; set GETGABS_API_KEY and GETGABS_CAMPAIGN_ID');
    return;
  }

  const hubs = HUBS.map((h) => ({ ...h, phone: normalizePhone(process.env[h.phoneEnv]) })).filter((h) => h.phone);
  if (hubs.length === 0) {
    console.log('no staff alert numbers set (STAFF_ALERT_PHONE_HOSUR / STAFF_ALERT_PHONE_BENGALURU)');
    return;
  }

  const db = await connect();
  const rules = await getAutomations(db);
  const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000);
  const stateRef = db.collection('settings').doc('staff_alerts');
  const state = (await stateRef.get()).data() ?? {};
  let budget = MAX_PER_RUN;

  for (const kind of KINDS) {
    if (!rules[kind.rule]?.enabled) continue;

    const recent = {};
    for (const hub of hubs) {
      recent[hub.id] = await db
        .collection('hubs').doc(hub.id).collection(kind.collection)
        .where('createdAt', '>=', since)
        .get();
    }

    // First run with this switched on: whatever is already paid for predates it and
    // must not be announced. Doing this when it is switched on, not when the code
    // is deployed, means "on" really does mean "from now".
    if (!state[kind.key]) {
      let marked = 0;
      for (const hub of hubs) {
        for (const snap of recent[hub.id].docs) {
          const d = snap.data();
          if (handled(d) || !kind.isReady(d)) continue;
          await snap.ref.set({ staffAlertStatus: 'skipped_existing' }, { merge: true });
          marked++;
        }
      }
      await stateRef.set({ [kind.key]: true, [`${kind.key}At`]: new Date().toISOString() }, { merge: true });
      console.log(`${kind.key}: switched on, marked ${marked} existing as seen, alerted nobody`);
      continue;
    }

    const todo = [];
    for (const hub of hubs) {
      for (const snap of recent[hub.id].docs) {
        const d = snap.data();
        if (!handled(d) && kind.isReady(d)) todo.push({ hub, snap });
      }
    }
    if (todo.length === 0 || budget <= 0) continue;

    let spec;
    try {
      spec = await templateSpec(rules[kind.rule].template);
    } catch (err) {
      // Left unmarked, so these are sent once the template exists and is approved.
      console.error(`${kind.key}: could not load template ${rules[kind.rule].template}: ${err.message}`);
      continue;
    }

    for (const { hub, snap } of todo) {
      if (budget <= 0) break;

      // Claimed in a transaction so an overlapping run cannot alert twice.
      const claimed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(snap.ref);
        if (!fresh.exists || handled(fresh.data()) || !kind.isReady(fresh.data())) return false;
        tx.update(snap.ref, { staffAlertStatus: 'sending' });
        return true;
      });
      if (!claimed) continue;

      const values = kind.values(hub.name, snap.id, snap.data());
      const filled = JSON.parse(JSON.stringify(spec));
      for (const component of filled.template?.components ?? []) {
        if (component.type?.toUpperCase() !== 'BODY' || !component.parameters?.length) continue;
        component.parameters = component.parameters.map((p, i) => ({ type: 'text', text: values[i] ?? p.text ?? '-' }));
      }

      const result = await sendTemplate(filled, hub.phone, 'MilkyLush Team');
      budget--;

      await snap.ref.set(
        {
          staffAlertStatus: result.success ? 'sent' : 'failed',
          staffAlertSentAt: new Date().toISOString(),
          staffAlertError: result.success ? null : result.error,
        },
        { merge: true }
      );

      console.log(
        result.success
          ? `${kind.key}: alerted ${hub.name} staff about ${snap.id}`
          : `${kind.key}: alert failed for ${snap.id}: ${result.error}`
      );

      // Pace the run so a burst does not trip Getgabs rate limiting.
      await new Promise((r) => setTimeout(r, 400));
    }
  }
};

export const config = { schedule: '*/5 * * * *' };
