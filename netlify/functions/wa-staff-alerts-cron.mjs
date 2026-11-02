// Tells each hub's staff, on WhatsApp, when a customer places an order or starts
// a subscription.
//
// Each hub's alerts go to its own number, set from the admin panel and kept in
// settings/staff_alerts. That document is denied to every browser by the
// security rules and is read and written only through the staff-alert-number
// function, after it has checked the caller is an admin of that hub. It is kept
// there rather than in config/ or hubs/*/settings because those are readable
// without signing in, which would publish a staff member's mobile number.
//
// A hub with no number set gets no alerts.

import { FieldValue } from 'firebase-admin/firestore';
import { connect, getAutomations } from '../lib/firestore.mjs';
import { templateSpec, sendTemplate, normalizePhone, apiKey, campaignId } from '../lib/getgabs.mjs';
import { orderValues, subscriptionValues, ALERT_HUBS } from '../lib/staffAlerts.mjs';

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

  const db = await connect();
  const stateRef = db.collection('settings').doc('staff_alerts');
  const state = (await stateRef.get()).data() ?? {};

  const hubs = ALERT_HUBS
    .map((h) => ({ ...h, phone: normalizePhone(state.phones?.[h.id]) }))
    .filter((h) => h.phone);
  if (hubs.length === 0) {
    console.log('no staff alert numbers set; add one in the admin panel');
    return;
  }

  const rules = await getAutomations(db);
  const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000);
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

      // Meta answers 132001 while a template is created but not yet approved. That
      // is not this record's failure, and Getgabs already lists the template, so the
      // earlier check for a missing one does not catch it. Release the claim so it is
      // sent on a later run instead of being marked failed for good, and stop here:
      // every other record would be refused in exactly the same way.
      if (!result.success && /132001|does not exist in the translation/i.test(result.error ?? '')) {
        await snap.ref.update({ staffAlertStatus: FieldValue.delete() });
        console.warn(`${kind.key}: template ${rules[kind.rule].template} is not approved by Meta yet, will retry`);
        break;
      }

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
