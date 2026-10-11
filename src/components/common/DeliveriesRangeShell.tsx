// Loads a hub's deliveries for a chosen period (paginated) and hands them, in the
// Order/User shapes the older history pages render, to `children`. Those pages keep
// their own screens and in-page filters; this shell supplies correct, bounded data.

import { useMemo, useState, type ReactNode } from 'react';
import type { DeliveryAgent, Order, User } from '../../types';
import type { HubId } from '../../data/hubs';
import { formatDay, todayKey } from '../../data/dates';
import { closeDay } from '../../data/stats';
import type { WithId } from '../../data/useFirestore';
import {
  useDeliveries, useDeliveriesRange, useRiderDeliveries, deliveryToOrder, setDeliveryStatus, reassignDelivery, generateDeliveries,
  DB_STATUS, type DeliveryStatus, type DeliveryDoc,
} from '../../data/deliveries';
import { DateFilter, lastDaysRange, todayRange, type DateRange } from './DateFilter';
import { DataState, LoadMore } from './DataState';

export interface DeliveriesShellData {
  orders: Order[];
  users: User[];
  onUpdateOrderStatus: (id: string, status: Order['status']) => void;
  onUpdateOrderDriver: (id: string, agentId: string) => void;
}

interface Props {
  hubId: HubId;
  deliveryAgents: DeliveryAgent[];
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  defaultDays?: 7 | 30;
  status?: DeliveryStatus;
  children: (data: DeliveriesShellData) => ReactNode;
}

/** Customer rows built from the details each delivery carries (no customer list is loaded). */
function usersFrom(list: WithId<DeliveryDoc>[]): User[] {
  const m = new Map<string, User>();
  list.forEach((d) => m.set(d.customerUid, {
    id: d.customerUid, name: d.customerName, phone: d.customerPhone, savedAddresses: [d.addressText], customerId: d.customerId,
  } as unknown as User));
  return Array.from(m.values());
}

/** Status and rider changes, written to the delivery docs. */
function useDeliveryActions(hubId: HubId, deliveryAgents: DeliveryAgent[], showToast: Props['showToast']) {
  const onUpdateOrderStatus = async (id: string, s: Order['status']) => {
    const next = DB_STATUS[s as string];
    if (!next) return;
    try {
      await setDeliveryStatus(hubId, id, next);
      showToast(`${id} -> ${next.replace(/_/g, ' ')}`, 'success');
    } catch (err) {
      showToast(`Could not update: ${(err as Error).message}`, 'error');
    }
  };
  const onUpdateOrderDriver = async (id: string, agentId: string) => {
    const agent = deliveryAgents.find((a) => a.id === agentId);
    try {
      await reassignDelivery(hubId, id, agent ? { uid: agent.id, name: agent.name } : null);
      showToast(agent ? `Assigned ${agent.name}` : 'Rider removed', 'success');
    } catch (err) {
      showToast(`Could not reassign: ${(err as Error).message}`, 'error');
    }
  };
  return { onUpdateOrderStatus, onUpdateOrderDriver };
}

export function DeliveriesRangeShell({ hubId, deliveryAgents, showToast, defaultDays = 30, status, children }: Props) {
  const [range, setRange] = useState<DateRange>(lastDaysRange(defaultDays));
  const q = useDeliveriesRange(hubId, range.from, range.to, status);
  const orders = useMemo(() => q.data.map(deliveryToOrder), [q.data]);
  const users = useMemo(() => usersFrom(q.data), [q.data]);
  const { onUpdateOrderStatus, onUpdateOrderDriver } = useDeliveryActions(hubId, deliveryAgents, showToast);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)' }}>
          Period: {formatDay(range.from)} – {formatDay(range.to)}
        </span>
        <DateFilter value={range} onChange={setRange} presets={['today', 'yesterday', 'last7', 'last30']} allowRange />
      </div>
      <DataState loading={q.loading} error={q.error} onRetry={q.retry} loadingLabel="Loading deliveries…">
        {children({ orders, users, onUpdateOrderStatus, onUpdateOrderDriver })}
        <LoadMore hasMore={q.hasMore} loading={q.loadingMore} onClick={q.loadMore} />
      </DataState>
    </div>
  );
}

interface DayProps extends Omit<Props, 'defaultDays' | 'status'> {
  /** Shows the "Generate deliveries" button for the chosen day. */
  allowGenerate?: boolean;
  /** Always today, without the date row (dashboards). */
  fixedToday?: boolean;
}

/**
 * One day of a hub's deliveries, live (riders' updates appear without reload),
 * sorted by rider then stop. Date picker: yesterday / today / tomorrow or any day.
 */
export function DeliveriesDayShell({ hubId, deliveryAgents, showToast, allowGenerate = false, fixedToday = false, children }: DayProps) {
  const [range, setRange] = useState<DateRange>(todayRange());
  const date = range.from;
  const q = useDeliveries(hubId, date);
  const [generating, setGenerating] = useState(false);
  const orders = useMemo(() => q.data
    .slice()
    .sort((a, b) => (a.riderName ?? '~').localeCompare(b.riderName ?? '~') || a.stopSeq - b.stopSeq)
    .map(deliveryToOrder), [q.data]);
  const users = useMemo(() => usersFrom(q.data), [q.data]);
  const { onUpdateOrderStatus, onUpdateOrderDriver } = useDeliveryActions(hubId, deliveryAgents, showToast);

  const [closing, setClosing] = useState(false);
  const handleCloseDay = async () => {
    if (!window.confirm(`Close ${formatDay(date)}? One-time orders get their delivery result and the day's totals are saved. You can close again later to refresh them.`)) return;
    setClosing(true);
    try {
      const r = await closeDay(hubId, date);
      showToast(`${formatDay(date)} closed: ${r.deliveriesDone}/${r.deliveriesScheduled} delivered, ${r.deliveriesFailed} failed, ${r.ordersUpdated} order(s) updated.`, 'success');
    } catch (err) {
      showToast(`Could not close the day: ${(err as Error).message}`, 'error');
    } finally {
      setClosing(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const r = await generateDeliveries(hubId, date);
      showToast(
        `${formatDay(date)}: ${r.created} new, ${r.refreshed} updated, ${r.skippedNow} now skipped` +
        (r.unassigned ? `. ${r.unassigned} drop(s) have no rider - assign those customers to a route.` : '.'),
        r.unassigned ? 'info' : 'success');
    } catch (err) {
      showToast(`Could not generate deliveries: ${(err as Error).message}`, 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {!fixedToday && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)' }}>Deliveries for {formatDay(date)}</span>
          <DateFilter value={range} onChange={setRange} />
        </div>
        {allowGenerate && <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {date <= todayKey() && (
          <button className="btn-secondary" onClick={handleCloseDay} disabled={closing} style={{ opacity: closing ? 0.7 : 1 }}>
            {closing ? 'Closing…' : `Close day`}
          </button>
        )}
          <button className="btn-primary" onClick={handleGenerate} disabled={generating} style={{ opacity: generating ? 0.7 : 1 }}>
            {generating ? 'Generating…' : `Generate deliveries for ${formatDay(date)}`}
          </button>
        </div>}
      </div>}
      <DataState loading={q.loading} error={q.error} onRetry={q.retry} loadingLabel="Loading deliveries…">
        {children({ orders, users, onUpdateOrderStatus, onUpdateOrderDriver })}
      </DataState>
    </div>
  );
}

/** One rider's drops over the last 30 days (partner detail pages). */
export function RiderDeliveriesShell({ hubId, riderUid, deliveryAgents, showToast, children }:
  Omit<Props, 'defaultDays' | 'status'> & { riderUid: string | null }) {
  const q = useRiderDeliveries(hubId, riderUid, 30);
  const orders = useMemo(() => q.data.map(deliveryToOrder), [q.data]);
  const users = useMemo(() => usersFrom(q.data), [q.data]);
  const { onUpdateOrderStatus, onUpdateOrderDriver } = useDeliveryActions(hubId, deliveryAgents, showToast);
  return (
    <DataState loading={q.loading} error={q.error} onRetry={q.retry} loadingLabel="Loading rider's deliveries…">
      {children({ orders, users, onUpdateOrderStatus, onUpdateOrderDriver })}
      <LoadMore hasMore={q.hasMore} loading={q.loadingMore} onClick={q.loadMore} />
    </DataState>
  );
}
