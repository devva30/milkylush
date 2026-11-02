// What the staff alert says about a new order or subscription.
//
// Kept apart from the sender so the wording can be checked against real records
// without sending anything. The values are positional: they fill the {{1}},
// {{2}}... placeholders of the approved WhatsApp template in this exact order,
// so reordering them here changes the message, and the template has to match.

/** WhatsApp rejects a placeholder value that is empty or spans lines. */
export const clean = (value, max = 160) =>
  String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, max) || '-';

const rupees = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** "2026-10-18" or a full timestamp -> "18 Oct 2026". */
export const shortDate = (value) => {
  const raw = value?.toDate ? value.toDate().toISOString() : String(value ?? '');
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!parts) return '';
  const [, y, m, d] = parts;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const PAYMENT_LABELS = { razorpay: 'Online (Razorpay)', free: 'Free sample', cod: 'Cash on delivery' };

/**
 * {{1}} hub  {{2}} customer  {{3}} phone  {{4}} items  {{5}} total in rupees
 * {{6}} payment  {{7}} delivery date  {{8}} address  {{9}} order id
 */
export function orderValues(hubName, id, o) {
  const items = (Array.isArray(o.items) ? o.items : [])
    .map((i) => `${i.qty ?? 1} x ${i.name ?? 'item'}`)
    .join(', ');

  return [
    hubName,
    o.customerName,
    o.customerPhone,
    items,
    rupees(o.total),
    PAYMENT_LABELS[o.paymentMethod] ?? o.paymentMethod,
    shortDate(o.deliveryDate),
    o.addressText,
    id,
  ].map((v, i) => clean(v, i === 3 || i === 7 ? 200 : 100));
}

/**
 * {{1}} hub  {{2}} customer  {{3}} phone  {{4}} product  {{5}} plan
 * {{6}} quantity  {{7}} start date  {{8}} amount paid in rupees  {{9}} subscription id
 *
 * Subscriptions record money in paise where orders use rupees (a 30-day plan at
 * Rs 45 a day is stored as 121500, not 1215), so this converts, or the alert
 * would announce a hundred times the real amount.
 */
export function subscriptionValues(hubName, id, s) {
  return [
    hubName,
    s.customerName,
    s.customerPhone,
    s.productName,
    s.planTitle,
    s.quantity ?? 1,
    shortDate(s.startDate),
    rupees(Number(s.amountPaid || 0) / 100),
    id,
  ].map((v) => clean(v, 100));
}

/** The hubs that can have a staff alert number. Ids match hubs/{hubId} in Firestore. */
export const ALERT_HUBS = [
  { id: 'hosur', name: 'Hosur' },
  { id: 'bengaluru', name: 'Bangalore' },
];
