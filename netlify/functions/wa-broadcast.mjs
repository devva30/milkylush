import { templateSpec, sendTemplate, normalizePhone, apiKey, campaignId } from '../lib/getgabs.mjs';
import { requireTrustedOrigin, json } from '../lib/auth.mjs';

// Netlify allows roughly 10s of synchronous execution. With 400ms of pacing
// between sends, 10 recipients per call leaves comfortable headroom; the client
// splits a larger audience across several calls.
const MAX_PER_CALL = 10;

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const auth = requireTrustedOrigin(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  if (!apiKey()) return json({ error: 'GETGABS_API_KEY is not set on this site' }, 500);
  if (!campaignId()) return json({ error: 'GETGABS_CAMPAIGN_ID is not set on this site' }, 500);

  const body = await req.json().catch(() => null);
  const templateName = body?.templateName;
  const recipients = Array.isArray(body?.recipients) ? body.recipients : [];

  if (!templateName) return json({ error: 'templateName is required' }, 400);
  if (recipients.length === 0) return json({ error: 'No recipients supplied' }, 400);
  if (recipients.length > MAX_PER_CALL) {
    return json({ error: `Send at most ${MAX_PER_CALL} recipients per request` }, 400);
  }

  let spec;
  try {
    spec = await templateSpec(templateName);
  } catch (err) {
    return json({ error: err?.message || 'Unknown template' }, 502);
  }

  const results = [];
  let sentSoFar = 0;

  for (const recipient of recipients) {
    const phone = normalizePhone(recipient?.phone);
    if (!phone) {
      results.push({ id: recipient?.id ?? null, name: recipient?.name ?? '', phone: recipient?.phone ?? '', success: false, error: 'Invalid phone number' });
      continue;
    }

    // Pace the run. Firing a whole audience back to back trips Getgabs rate
    // limiting, which answers 200 with a body that carries no message id.
    if (sentSoFar > 0) await new Promise((r) => setTimeout(r, 400));
    sentSoFar++;

    const outcome = await sendTemplate(spec, phone, recipient?.name);
    results.push({ id: recipient?.id ?? null, name: recipient?.name ?? '', phone, ...outcome });
  }

  return json({
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
};

export const config = { path: '/api/wa-broadcast' };
