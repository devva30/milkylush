import { addDays, istDateKey, todayKey } from '../data/dates';

export const parseLocalDate = (dateInput?: string | Date | number | null): Date => {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? new Date() : dateInput;
  }
  if (typeof dateInput === 'number') {
    return new Date(dateInput);
  }

  const str = String(dateInput).trim();
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  // Fallback for custom formatted dates like "MM/DD/YYYY" or "DD/MM/YYYY"
  try {
    const parts = str.split(',');
    if (parts.length > 0) {
      const dParts = parts[0].trim().split('/');
      if (dParts.length === 3) {
        const m = parseInt(dParts[0], 10) - 1;
        const day = parseInt(dParts[1], 10);
        const y = parseInt(dParts[2], 10);
        return new Date(y, m, day);
      }
    }
  } catch (e) {
    // Ignore error and return fallback
  }

  return new Date();
};

export const getStartOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getEndOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * IST day key ('yyyy-MM-dd') of a date value. Plain 'yyyy-MM-dd' strings (delivery days)
 * are taken as they are; anything else is converted from its instant. Unknown → ''.
 */
export const toDayKey = (dateInput: any): string => {
  if (dateInput == null || dateInput === '') return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) return dateInput.trim();
  const d = dateInput instanceof Date ? dateInput
    : typeof dateInput?.toDate === 'function' ? dateInput.toDate()
    : new Date(dateInput);
  return d instanceof Date && !isNaN(d.getTime()) ? istDateKey(d) : '';
};

export const matchesDatePreset = (
  dateInput: any,
  preset: 'all' | 'today' | 'yesterday' | 'week' | 'month' | string
): boolean => {
  if (!preset || preset === 'all' || preset === 'All Dates' || preset === 'All Time') return true;
  const key = toDayKey(dateInput);
  if (!key) return false;
  const today = todayKey();
  if (preset === 'today' || preset === 'Today') return key === today;
  if (preset === 'yesterday' || preset === 'Yesterday') return key === addDays(today, -1);
  if (preset === 'tomorrow' || preset === 'Tomorrow') return key === addDays(today, 1);
  if (preset === 'week' || preset === 'This Week' || preset === 'Past 7 Days') return key >= addDays(today, -6) && key <= today;
  if (preset === 'month' || preset === 'This Month') return key >= addDays(today, -29) && key <= today;
  return true;
};

export const matchesCustomDateRange = (
  dateInput: any,
  startDateStr?: string,
  endDateStr?: string
): boolean => {
  if (!startDateStr && !endDateStr) return true;
  const key = toDayKey(dateInput);
  if (!key) return false;
  if (startDateStr && key < startDateStr.slice(0, 10)) return false;
  if (endDateStr && key > endDateStr.slice(0, 10)) return false;
  return true;
};
