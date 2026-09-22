import { handleTemplates } from '../lib/handlers.mjs';
import { requireTrustedOrigin, json } from '../lib/auth.mjs';

export default async (req) => {
  const auth = requireTrustedOrigin(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const { status, body } = await handleTemplates();
  return json(body, status);
};

export const config = { path: '/api/wa-templates' };
