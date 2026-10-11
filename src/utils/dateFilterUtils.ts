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

export const matchesDatePreset = (
  dateInput: any,
  preset: 'all' | 'today' | 'yesterday' | 'week' | 'month' | string
): boolean => {
  if (!preset || preset === 'all' || preset === 'All Dates' || preset === 'All Time') return true;

  const targetDate = parseLocalDate(dateInput);
  const targetMs = targetDate.getTime();

  const now = new Date();
  const startOfToday = getStartOfDay(now).getTime();
  const endOfToday = getEndOfDay(now).getTime();

  if (preset === 'today' || preset === 'Today') {
    return targetMs >= startOfToday && targetMs <= endOfToday;
  }

  if (preset === 'yesterday' || preset === 'Yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = getStartOfDay(yesterday).getTime();
    const endOfYesterday = getEndOfDay(yesterday).getTime();
    return targetMs >= startOfYesterday && targetMs <= endOfYesterday;
  }

  if (preset === 'week' || preset === 'This Week' || preset === 'Past 7 Days') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startOfWeek = getStartOfDay(weekAgo).getTime();
    return targetMs >= startOfWeek && targetMs <= endOfToday;
  }

  if (preset === 'month' || preset === 'This Month') {
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);
    const startOfMonth = getStartOfDay(monthAgo).getTime();
    return targetMs >= startOfMonth && targetMs <= endOfToday;
  }

  return true;
};

export const matchesCustomDateRange = (
  dateInput: any,
  startDateStr?: string,
  endDateStr?: string
): boolean => {
  if (!startDateStr && !endDateStr) return true;

  const targetDate = parseLocalDate(dateInput);
  const targetMs = targetDate.getTime();

  if (startDateStr) {
    const startObj = parseLocalDate(startDateStr);
    const startMs = getStartOfDay(startObj).getTime();
    if (targetMs < startMs) return false;
  }

  if (endDateStr) {
    const endObj = parseLocalDate(endDateStr);
    const endMs = getEndOfDay(endObj).getTime();
    if (targetMs > endMs) return false;
  }

  return true;
};
