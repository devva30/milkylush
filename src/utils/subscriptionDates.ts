/**
 * Keeps a subscription's end date honest when deliveries are skipped.
 *
 * Skipping a day does not reduce what the customer paid for, so the plan has to
 * run one day longer for each day skipped. Without this the end date stays at
 * its original value, and the subscription looks expired while deliveries are
 * still owed — which also made expiry reminders go out days too early.
 */
export const shiftEndDate = (endDate: unknown, days: number): string | null => {
  if (!endDate || !days) return null;

  const raw = String(endDate);
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!parts) return null;

  // Date arithmetic in UTC: parsing "2026-09-25T00:00:00.000" as local time and
  // formatting back can land on the previous day east of Greenwich.
  const [, year, month, day] = parts;
  const shifted = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  shifted.setUTCDate(shifted.getUTCDate() + days);

  // Preserve whatever time suffix the stored value used; the collection mixes
  // bare dates with full timestamps.
  return shifted.toISOString().slice(0, 10) + raw.slice(10);
};
