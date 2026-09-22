import { handleBroadcast } from '../lib/handlers.mjs';
import { requireTrustedOrigin, json } from '../lib/auth.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const auth = requireTrustedOrigin(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const payload = await req.json().catch(() => null);
  const { status, body } = await handleBroadcast(payload);
  return json(body, status);
};

export const config = { path: '/api/wa-broadcast' };
