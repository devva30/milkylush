// The actual work behind /api/wa-templates and /api/wa-broadcast.
//
// Kept separate from the Netlify function wrappers so the Vite dev server can
// call the very same code (see vite.config.ts). That is what stops local and
// deployed behaviour from drifting apart, which has bitten this project before.

import { listTemplates, templateSpec, sendTemplate, normalizePhone } from './getgabs.mjs';

const configured = () => Boolean(process.env.GETGABS_API_KEY);
const campaign = () => process.env.GETGABS_CAMPAIGN_ID || '';

// Netlify allows roughly 10s per function call. With 400ms of pacing between
// sends, 10 recipients leaves headroom; the client splits larger audiences.
export const MAX_PER_CALL = 10;

export async function handleTemplates() {
  if (!configured()) return { status: 500, body: { error: 'GETGABS_API_KEY is not set on the server' } };

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

  const results = [];
  let sentSoFar = 0;

  for (const recipient of recipients) {
    const phone = normalizePhone(recipient?.phone);
    const base = { id: recipient?.id ?? null, name: recipient?.name ?? '' };

    if (!phone) {
      results.push({ ...base, phone: recipient?.phone ?? '', success: false, error: 'Invalid phone number' });
      continue;
    }

    // Pace the run. Firing a whole audience back to back trips Getgabs rate
    // limiting, which answers 200 with a body carrying no message id.
    if (sentSoFar > 0) await new Promise((r) => setTimeout(r, 400));
    sentSoFar++;

    results.push({ ...base, phone, ...(await sendTemplate(spec, phone, recipient?.name)) });
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
