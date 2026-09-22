import { listTemplates, apiKey } from '../lib/getgabs.mjs';
import { requireTrustedOrigin, json } from '../lib/auth.mjs';

export default async (req) => {
  const auth = requireTrustedOrigin(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  if (!apiKey()) return json({ error: 'GETGABS_API_KEY is not set on this site' }, 500);

  try {
    return json({ templates: await listTemplates() });
  } catch (err) {
    return json({ error: err?.message || 'Could not load templates' }, 502);
  }
};

export const config = { path: '/api/wa-templates' };
