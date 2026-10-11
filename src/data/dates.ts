// All business dates are Indian Standard Time, whatever the browser's timezone.
// Never use toISOString() for a calendar day: it is UTC, so before 5:30 AM IST it
// returns yesterday's date.

import { Timestamp } from 'firebase/firestore';

const TZ = 'Asia/Kolkata';
const IST_OFFSET_MIN = 330;

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** 'yyyy-MM-dd' of the given instant in IST. */
export function istDateKey(date: Date = new Date()): string {
  return dayFormatter.format(date); // en-CA formats as yyyy-MM-dd
}

/** Today in IST as 'yyyy-MM-dd'. */
export function todayKey(): string {
  return istDateKey(new Date());
}

/** Adds whole days to a 'yyyy-MM-dd' key (calendar arithmetic, no timezone drift). */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10); // safe: utc is midnight UTC of a pure date
}

/** Start of an IST day as a Date (for Timestamp range queries on createdAt etc.). */
export function istDayStart(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MIN * 60_000);
}

/** Exclusive end of an IST day (start of the next day). */
export function istDayEnd(key: string): Date {
  return istDayStart(addDays(key, 1));
}

/** Inclusive list of day keys from `from` to `to`. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Firestore Timestamp | Date | ISO string | millis → Date, or null if unusable. */
export function toDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    // Only unambiguous ISO forms; "07/10/2026" style strings are rejected on purpose.
    if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
    const d = new Date(value.length === 10 ? `${value}T00:00:00+05:30` : value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && 'seconds' in (value as object)) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
}

const displayDate = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' });
const displayDateTime = new Intl.DateTimeFormat('en-IN', {
  timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
});

/** "08 Oct 2026" from a day key or any date-like value. */
export function formatDay(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return displayDate.format(istDayStart(value));
  }
  const d = toDate(value);
  return d ? displayDate.format(d) : '—';
}

/** "08 Oct 2026, 07:30 pm" in IST. */
export function formatDateTime(value: unknown): string {
  const d = toDate(value);
  return d ? displayDateTime.format(d) : '—';
}

/** Current IST hour (0–23), e.g. to compare with settings/delivery.orderCutoffHour. */
export function istHour(date: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(date)) % 24;
}

/** 'yyMMdd' for order IDs (HSR-ORD-261008-0001). */
export function orderDayCode(key: string = todayKey()): string {
  return key.slice(2).replace(/-/g, '');
}
