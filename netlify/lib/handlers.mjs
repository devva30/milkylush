// The actual work behind /api/wa-templates and /api/wa-broadcast.
//
// Kept separate from the Netlify function wrappers so the Vite dev server can
// call the very same code (see vite.config.ts). That is what stops local and
// deployed behaviour from drifting apart, which has bitten this project before.

import { listTemplates, templateSpec, sendTemplate, normalizePhone } from './getgabs.mjs';
import { verifyHubAdmin } from './firestore.mjs';
import { ALERT_HUBS, clean } from './staffAlerts.mjs';

const configured = () => Boolean(process.env.GETGABS_API_KEY);
const campaign = () => process.env.GETGABS_CAMPAIGN_ID || '';

// A synchronous Netlify function gets 60 seconds, and one send to Getgabs takes
// about 3.5 seconds, so a call must stay well under 15 recipients. The panel sends
// 5 at a time (about 20 seconds) and the cap here is only a backstop.
export const MAX_PER_CALL = 10;

/** How many values a template's body expects, from Getgabs' definition of it. */
export const bodyVariableCount = (spec) =>
  (spec.template?.components ?? [])
    .filter((c) => c.type?.toUpperCase() === 'BODY')
    .reduce((n, c) => n + (c.parameters?.length ?? 0), 0);

/** Getgabs' example value for each body variable, so a person can see what it stands for. */
export const bodyExamples = (spec) =>
  (spec.template?.components ?? [])
    .filter((c) => c.type?.toUpperCase() === 'BODY')
    .flatMap((c) => (c.parameters ?? []).map((p) => String(p.text ?? '')));

/**
 * A template with one body variable is assumed to open with the person's name
 * ("Hi {{1}}, ..."). Without this the message went out carrying Getgabs' own
 * example text, so everyone was greeted as whoever the example happened to be.
 */
const withName = (spec, name) => {
  const copy = JSON.parse(JSON.stringify(spec));
  for (const component of copy.template?.components ?? []) {
    if (component.type?.toUpperCase() === 'BODY' && component.parameters?.length) {
      component.parameters[0] = { type: 'text', text: name };
    }
  }
  return copy;
};

export async function handleTemplates(name) {
  if (!configured()) return { status: 500, body: { error: 'GETGABS_API_KEY is not set on the server' } };

  // One template's details, used to tell the person what it will need before sending.
  if (name) {
    try {
      const spec = await templateSpec(name);
      return { status: 200, body: { name, bodyVariables: bodyVariableCount(spec), examples: bodyExamples(spec) } };
    } catch (err) {
      return { status: 502, body: { error: err?.message || 'Could not load that template' } };
    }
  }

  try {
    return { status: 200, body: { templates: await listTemplates() } };
  } catch (err) {
    return { status: 502, body: { error: err?.message || 'Could not load templates' } };
  }
}

export async function handleBroadcast(payload) {
  if (!configured()) return { status: 500, body: { error: 'GETGABS_API_KEY is not set on the server' } };
  if (!campaign()) return { status: 500, body: { error: 'GETGABS_CAMPAIGN_ID is not set on the server' } };

  const templateName = payload?.templateName;
  const recipients = Array.isArray(payload?.recipients) ? payload.recipients : [];

  if (!templateName) return { status: 400, body: { error: 'templateName is required' } };
  if (recipients.length === 0) return { status: 400, body: { error: 'No recipients supplied' } };
  if (recipients.length > MAX_PER_CALL) {
    return { status: 400, body: { error: `Send at most ${MAX_PER_CALL} recipients per request` } };
  }

  let spec;
  try {
    spec = await templateSpec(templateName);
  } catch (err) {
    return { status: 502, body: { error: err?.message || 'Unknown template' } };
  }

  // A broadcast can supply the person's name and nothing else. Anything more would
  // go out with Getgabs' example values in it, which is a message that is wrong
  // for every recipient, so refuse rather than send it.
  const variables = bodyVariableCount(spec);
  if (variables > 1) {
    return {
      status: 400,
      body: {
        error: `"${templateName}" needs ${variables} values filled in for each message, which a broadcast cannot supply. Choose a template with no variables, or with just the customer's name.`,
      },
    };
  }

  const results = [];
  let sentSoFar = 0;

  for (const recipient of recipients) {
    const phone = normalizePhone(recipient?.phone);
    const base = { id: recipient?.id ?? null, name: recipient?.name ?? '' };

    if (!phone) {
      results.push({ ...base, phone: recipient?.phone ?? '', success: false, error: 'Invalid phone number' });
      continue;
    }

    // A short pause between sends, so a batch does not reach Getgabs as one burst.
    if (sentSoFar > 0) await new Promise((r) => setTimeout(r, 400));
    sentSoFar++;

    const name = clean(recipient?.name, 60);
    const given = name === '-' ? 'Customer' : name;
    const outgoing = variables === 1 ? withName(spec, given) : spec;

    results.push({ ...base, phone, ...(await sendTemplate(outgoing, phone, given)) });
  }

  return {
    status: 200,
    body: {
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    },
  };
}

/**
 * Reads or sets the WhatsApp number that a hub's order and subscription alerts go
 * to. It lives in settings/staff_alerts, which the security rules deny to every
 * browser, and is reached only through here after the caller's sign-in has been
 * checked. config/ and hubs/<hub>/settings would have been simpler but are
 * readable without signing in, which would publish a staff member's mobile.
 */
export async function handleStaffAlertNumber({ method, hub, phone, authorization }) {
  if (!ALERT_HUBS.some((h) => h.id === hub)) return { status: 400, body: { error: 'Unknown hub' } };

  const token = String(authorization || '').replace(/^Bearer\s+/i, '');
  const auth = await verifyHubAdmin(token, hub);
  if (!auth.ok) return { status: auth.status, body: { error: auth.error } };

  const ref = auth.db.collection('settings').doc('staff_alerts');

  if (method === 'GET') {
    const stored = ((await ref.get()).data()?.phones ?? {})[hub] ?? '';
    return { status: 200, body: { phone: stored } };
  }

  if (method !== 'POST') return { status: 405, body: { error: 'Use GET or POST' } };

  const raw = String(phone ?? '').trim();
  if (raw === '') {
    // set() with merge treats a nested delete marker as removing that one field.
    const { FieldValue } = await import('firebase-admin/firestore');
    await ref.set({ phones: { [hub]: FieldValue.delete() } }, { merge: true });
    return { status: 200, body: { phone: '' } };
  }

  const normalized = normalizePhone(raw);
  if (!normalized) {
    return { status: 400, body: { error: 'Enter a valid Indian mobile number, 10 digits.' } };
  }
  await ref.set({ phones: { [hub]: normalized } }, { merge: true });
  return { status: 200, body: { phone: normalized } };
}
