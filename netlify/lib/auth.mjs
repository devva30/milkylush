// Guards the WhatsApp endpoints, which can spend real credits.
//
// LIMITATION WORTH KNOWING: the admin panel has no real login
// yet (LoginPage accepts any password), so there is no signed-in identity to
// verify. This only checks the request came from the MilkyLush site itself,
// which stops casual abuse and other websites calling these endpoints, but a
// determined person can forge the header. Replace this with a real signed-in
// check once the login page authenticates properly.

const allowedOrigins = () =>
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

export function requireTrustedOrigin(req) {
  const origin = req.headers.get('origin') || req.headers.get('referer') || '';

  // Same-origin browser requests from the deployed site carry the site's own URL.
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || '';
  const allowed = [...allowedOrigins(), siteUrl].filter(Boolean);

  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(origin);
  const isAllowed = allowed.some((a) => origin.startsWith(a));

  if (!origin || (!isLocal && !isAllowed)) {
    return { ok: false, status: 403, error: 'This endpoint only serves the MilkyLush admin panel' };
  }

  return { ok: true };
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
