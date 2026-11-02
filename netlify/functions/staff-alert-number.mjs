import { handleStaffAlertNumber } from '../lib/handlers.mjs';
import { json } from '../lib/auth.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const body = req.method === 'POST' ? await req.json().catch(() => null) : null;

  const { status, body: out } = await handleStaffAlertNumber({
    method: req.method,
    hub: url.searchParams.get('hub') ?? body?.hub,
    phone: body?.phone,
    authorization: req.headers.get('authorization'),
  });
  return json(out, status);
};

export const config = { path: '/api/staff-alert-number' };
