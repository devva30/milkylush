// src/services/emailService.ts
// EmailJS greeting for customers who signed up with Google and therefore have
// an email address but no phone number.
//
// Only the EmailJS PUBLIC key is used here. The private key is for server-side
// sending and must never be put in browser code, where anyone could read it.

const env = (import.meta as any).env ?? {};

const publicKey = (): string => env.VITE_EMAILJS_PUBLIC_KEY || localStorage.getItem('EMAILJS_PUBLIC_KEY') || '';
const serviceId = (): string => env.VITE_EMAILJS_SERVICE_ID || localStorage.getItem('EMAILJS_SERVICE_ID') || '';
const templateId = (): string => env.VITE_EMAILJS_TEMPLATE_ID || localStorage.getItem('EMAILJS_TEMPLATE_ID') || '';

const ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

/**
 * Sends the welcome email.
 *
 * The recipient is passed under several common EmailJS variable names because
 * the template decides which one it reads; EmailJS ignores the ones it has no
 * placeholder for. If the email never arrives, check that the template's "To
 * Email" field references one of these rather than a fixed address.
 */
export const sendWelcomeEmail = async (
  toEmail: string,
  toName: string
): Promise<{ success: boolean; message: string }> => {
  if (!publicKey() || !serviceId() || !templateId()) {
    return { success: false, message: 'EmailJS is not fully configured (public key, service id, template id)' };
  }
  if (!toEmail) return { success: false, message: 'Customer has no email address' };

  const name = toName || 'Valued Customer';

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId(),
        template_id: templateId(),
        user_id: publicKey(),
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
    if (res.ok) return { success: true, message: body || 'OK' };

    return { success: false, message: body || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error' };
  }
};
