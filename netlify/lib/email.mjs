// EmailJS greeting for customers who signed up with Google and so have an email
// address but no phone number.
//
// EmailJS refuses server-side calls by default with "API access from
// non-browser environments is currently disabled". Turn it on at
// EmailJS > Account > Security, otherwise this returns that message and the
// customer is marked failed. Server-side calls also require the private key.

const ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

export async function sendWelcomeEmail(toEmail, toName) {
  const publicKey = process.env.EMAILJS_PUBLIC_KEY || '';
  const privateKey = process.env.EMAILJS_PRIVATE_KEY || '';
  const serviceId = process.env.EMAILJS_SERVICE_ID || '';
  const templateId = process.env.EMAILJS_TEMPLATE_ID || '';

  if (!publicKey || !serviceId || !templateId) {
    return { success: false, error: 'EmailJS is not configured on the server' };
  }
  if (!toEmail) return { success: false, error: 'Customer has no email address' };

  const name = toName || 'Valued Customer';

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        // Required for non-browser calls; ignored by browser requests.
        accessToken: privateKey,
        // The template decides which variable name it reads, and EmailJS
        // ignores any it has no placeholder for.
        template_params: {
          to_email: toEmail,
          email: toEmail,
          user_email: toEmail,
          reply_to: toEmail,
          to_name: name,
          name,
          user_name: name,
          customer_name: name,
        },
      }),
    });

    // EmailJS answers "OK" as plain text on success, not JSON.
    const body = (await res.text()).trim();
    return res.ok ? { success: true, messageId: body || 'OK' } : { success: false, error: body || `HTTP ${res.status}` };
  } catch (err) {
    return { success: false, error: err?.message || 'Network error' };
  }
}
