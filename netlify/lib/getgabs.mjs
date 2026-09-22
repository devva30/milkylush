// Server-side Getgabs client. Runs only in Netlify Functions, so the API key
// stays out of anything a browser can read.

const BASE = 'https://app.getgabs.com';

export const apiKey = () => process.env.GETGABS_API_KEY || '';
export const sender = () => process.env.GETGABS_SENDER || '919902882332';
export const campaignId = () => process.env.GETGABS_CAMPAIGN_ID || '';

// Templates approved with a media header are sent with an empty link, which Meta
// rejects, so a hosted MilkyLush image is substituted.
export const headerImage = () =>
  process.env.GETGABS_HEADER_IMAGE ||
  'https://app.getgabs.com/getgabs-uploads/cdngallery/16aba4cadbfcc7fc1e24f75181699fe3fdccd4a40563f8fdf579cba71cd11c07/files/Rl3qbzdQQdSw10BK.png';

export function normalizePhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(1);
  return null;
}

let cachedToken = null;

async function sessionToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const res = await fetch(`${BASE}/partners/getSessionToken?api_key=${encodeURIComponent(apiKey())}`);
  const data = await res.json();
  if (!data?.access_token) throw new Error(data?.message || 'Getgabs authentication failed');

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(0, (data.expires_in ?? 3600) - 60) * 1000,
  };
  return cachedToken.token;
}

export async function listTemplates() {
  const token = await sessionToken();
  const seen = new Map();

  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`${BASE}/partners/api/template/fetchAll?page=${page}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ adminauthToken: apiKey(), searchValue: '' }),
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
}

export async function templateSpec(templateName) {
  const token = await sessionToken();
  const res = await fetch(`${BASE}/partners/api/template/fetchJson`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ adminauthToken: apiKey(), template_name: templateName }),
  });
  const spec = await res.json();
  if (!spec?.template) throw new Error(spec?.message || `No Getgabs spec for "${templateName}"`);
  return spec;
}

/** Sends one approved template to one recipient. */
export async function sendTemplate(spec, phone, customerName) {
  const payload = JSON.parse(JSON.stringify(spec));

  payload.api_key = apiKey();
  payload.sender = sender();
  payload.campaign_id = campaignId();
  payload.to = phone;
  payload.receiver_name = customerName || 'Valued Customer';

  for (const component of payload.template?.components ?? []) {
    for (const param of component.parameters ?? []) {
      for (const media of ['image', 'video', 'document']) {
        if (param[media] && !param[media].link) param[media].link = headerImage();
      }
    }
  }

  try {
    const res = await fetch(`${BASE}/whatsappbusiness/send-templated-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Read as text first: Getgabs sometimes answers 200 with a non-JSON body,
    // and parsing straight to JSON threw that detail away, leaving a useless
    // "HTTP 200" as the reason a send failed.
    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return { success: false, error: `Getgabs returned non-JSON (HTTP ${res.status}): ${raw.slice(0, 200)}` };
    }

    const messageId = data?.messages?.[0]?.id;
    if (messageId) return { success: true, messageId };

    // Getgabs reports failures as "message" on some errors and "msg" on others.
    const reason = data?.message || data?.msg || data?.error?.message;
    return { success: false, error: reason || `HTTP ${res.status}: ${raw.slice(0, 200)}` };
  } catch (err) {
    return { success: false, error: err?.message || 'Network error' };
  }
}
