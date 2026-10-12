import { query, where } from 'firebase/firestore';
import { hubCol, type HubId } from '../../data/hubs';
import { useLiveQuery } from '../../data/useFirestore';
import { isoWeekday } from '../../data/deliveries';

interface PlanLike {
  id: string;
  hubId?: string;
  duration?: string;
  totalDrops?: number;
  startDate?: string;
  frequency?: string;
  customDays?: number[];
  pausedDates?: string[];
  vacationStart?: string;
  vacationEnd?: string;
}

/** Days between two 'yyyy-MM-dd' keys. */
function daysBetween(a: string, b: string): number {
  const t = (k: string) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** Would the plan deliver on [day] (frequency only)? */
function planDay(p: PlanLike, day: string): boolean {
  if (!p.startDate || day < p.startDate) return false;
  const f = (p.frequency ?? '').toLowerCase();
  if (f.includes('alternate')) return daysBetween(p.startDate, day) % 2 === 0;
  if (f.includes('custom')) return (p.customDays ?? []).includes(isoWeekday(day));
  return true;
}

/**
 * Plan summary from real data: paid drops (subscription.totalDrops), drops actually delivered
 * (hubs/{hub}/deliveries where sourceId == subscription id, live), skipped / vacation plan days,
 * and what is still to come.
 */
export function SubscriptionDropStats({ plan }: { plan: PlanLike }) {
  const drops = useLiveQuery<{ status: string; date: string }>(
    plan.hubId ? query(hubCol(plan.hubId as HubId, 'deliveries'), where('sourceId', '==', plan.id)) : null,
    [plan.hubId, plan.id],
  );
  const delivered = drops.data.filter((d) => d.status === 'delivered').length;
  const notDelivered = drops.data.filter((d) => d.status === 'failed').length;

  // Skipped days + vacation days that were real delivery days of the plan.
  const pausedList = plan.pausedDates ?? [];
  const paused = new Set(pausedList.map((d) => String(d).slice(0, 10)));
  let skipped = paused.size;
  if (plan.vacationStart && plan.vacationEnd) {
    for (let d = plan.vacationStart.slice(0, 10); d <= plan.vacationEnd.slice(0, 10);) {
      if (!paused.has(d) && planDay(plan, d)) skipped++;
      const [y, m, dd] = d.split('-').map(Number);
      d = new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10);
    }
  }

  const total = plan.totalDrops ?? 0;
  // Drops that were not delivered are added at the end (Close day), so only delivered ones count.
  const remaining = Math.max(0, total - delivered);

  const cell = (label: string, value: string, color: string) => (
    <div>
      <div style={{ fontSize: '0.7rem', color: '#6B7280', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, color, marginTop: 2 }}>{value}</div>
    </div>
  );

  return (
    <div style={{
      backgroundColor: '#F9FAFB', borderRadius: 12, padding: '0.85rem 1.25rem', display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '1rem', textAlign: 'center',
      marginBottom: '1.25rem', border: '1px solid #E5E7EB',
    }}>
      {cell('PLAN DURATION', plan.duration ?? '—', '#111827')}
      {cell('TOTAL DROPS', total ? `${total} drops` : '—', '#047857')}
      {cell('DELIVERED', `${delivered} drops`, '#0284C7')}
      {notDelivered > 0 && cell('NOT DELIVERED', `${notDelivered} drops`, '#DC2626')}
      {cell('SKIPPED / VACATION', `${skipped} days`, '#D97706')}
      {cell('REMAINING', total ? `${remaining} drops` : '—', '#047857')}
    </div>
  );
}
