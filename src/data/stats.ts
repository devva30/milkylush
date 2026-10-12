// Daily and monthly totals (hubs/{hub}/stats/{yyyy-MM-dd} and /{yyyy-MM}), written by
// "Close day", plus the live counts the dashboards show. Everything here uses
// count()/sum() aggregations or a handful of small docs — never a whole collection.

import {
  collection, count, doc, getAggregateFromServer, getDoc, getDocs, increment, limit, orderBy, query,
  runTransaction, serverTimestamp, sum, where, writeBatch, type Query,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { hubCol, hubDoc, type HubId } from './hubs';
import { addDays, istDayEnd, istDayStart, todayKey } from './dates';
import { logAudit } from '../utils/auditLogger';
import type { DeliveryDoc, DeliveryStatus } from './deliveries';
import { syncMissedDrops } from './subscriptions';

export interface DayStats {
  deliveriesScheduled: number;
  deliveriesDone: number;
  deliveriesFailed: number;
  ordersCount: number;
  /** paise, captured payments that day */
  revenue: number;
  newCustomers: number;
  bottlesCollected: number;
  /** paise, value of delivered drops (subscription + one-time) */
  deliveredValue: number;
  subscriptionValue: number;
  orderValue: number;
  /** litres of milk delivered (items with a ml / L unit) */
  milkLitres: number;
  /** paise, counter (walk-in) sales that day */
  counterSales: number;
}

export interface ProductLine { name: string; unit: string; qty: number; value: number }
export interface RiderLine { name: string; drops: number; failed: number; /** paise */ charges?: number }
export type FullDayStats = DayStats & { products?: Record<string, ProductLine>; riders?: Record<string, RiderLine> };

const ZERO: DayStats = {
  deliveriesScheduled: 0, deliveriesDone: 0, deliveriesFailed: 0, ordersCount: 0, revenue: 0, newCustomers: 0, bottlesCollected: 0,
  deliveredValue: 0, subscriptionValue: 0, orderValue: 0, milkLitres: 0, counterSales: 0,
};

const countOf = async (q: Query) => (await getAggregateFromServer(q, { n: count() })).data().n;

/** Litres in one unit of "500ml", "1L", "1 Ltr"; 0 for non-liquid units. */
export function litresPerUnit(unit: string): number {
  const m = (unit || '').toLowerCase().replace(/\s+/g, '').match(/^(\d+(?:\.\d+)?)(ml|l|ltr|litre|liter)s?$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return m[2] === 'ml' ? n / 1000 : n;
}

/**
 * Close a delivery day: copies each one-time order's result from its delivery,
 * writes stats/{date} (totals, per product, per rider) and adds the change to
 * stats/{yyyy-MM}. Reads that day's drops once. Safe to press again (the month
 * gets only the difference).
 */
export async function closeDay(hubId: HubId, date: string): Promise<DayStats & { ordersUpdated: number }> {
  const drops = await getDocs(query(hubCol(hubId, 'deliveries'), where('date', '==', date)));

  const stats: DayStats = { ...ZERO };
  const products: Record<string, ProductLine> = {};
  const riders: Record<string, RiderLine> = {};
  let batch = writeBatch(db);
  let inBatch = 0;
  let ordersUpdated = 0;

  for (const snap of drops.docs) {
    const d = snap.data() as DeliveryDoc;
    if (d.status !== 'skipped' && d.status !== 'cancelled') stats.deliveriesScheduled++;
    if (d.sourceType === 'order') stats.ordersCount++;
    if (d.riderUid) {
      const r = (riders[d.riderUid] ||= { name: d.riderName ?? '', drops: 0, failed: 0, charges: 0 });
      if (d.status === 'delivered') { r.drops++; r.charges = (r.charges ?? 0) + (d.deliveryCharge ?? 0); }
      if (d.status === 'failed') r.failed++;
    }
    if (d.status === 'failed') stats.deliveriesFailed++;
    if (d.status === 'delivered') {
      stats.deliveriesDone++;
      stats.bottlesCollected += d.bottlesCollected ?? 0;
      stats.deliveredValue += d.amount ?? 0;
      if (d.sourceType === 'subscription') stats.subscriptionValue += d.amount ?? 0;
      else stats.orderValue += d.amount ?? 0;
      for (const it of d.items ?? []) {
        const p = (products[it.productId] ||= { name: it.name, unit: it.unit, qty: 0, value: 0 });
        p.qty += it.qty;
        p.value += it.price * it.qty;
        stats.milkLitres += litresPerUnit(it.unit) * it.qty;
      }
    }
    // One-time orders: copy delivered / failed onto the order
    if (d.sourceType === 'order' && (d.status === 'delivered' || d.status === 'failed')) {
      batch.update(hubDoc(hubId, 'orders', d.sourceId), { status: d.status, updatedAt: serverTimestamp() });
      ordersUpdated++;
      if (++inBatch === 450) { await batch.commit(); batch = writeBatch(db); inBatch = 0; }
    }
  }
  if (inBatch) await batch.commit();
  // Subscription drops that were not delivered move their plan's end date out (paid drops).
  if (date < todayKey()) {
    await syncMissedDrops(hubId, date, drops.docs.map((s) => s.data() as DeliveryDoc));
  }
  stats.milkLitres = Math.round(stats.milkLitres * 10) / 10;

  const dayStart = istDayStart(date);
  const dayEnd = istDayEnd(date);
  const [newCustomers, revenueAgg, counterAgg] = await Promise.all([
    countOf(query(collection(db, 'users'), where('hubId', '==', hubId),
      where('createdAt', '>=', dayStart), where('createdAt', '<=', dayEnd))),
    getAggregateFromServer(query(hubCol(hubId, 'payments'), where('status', '==', 'captured'),
      where('createdAt', '>=', dayStart), where('createdAt', '<=', dayEnd)), { amount: sum('amount') }),
    getAggregateFromServer(query(hubCol(hubId, 'counterSales'), where('date', '==', date)), { total: sum('total') }),
  ]);
  stats.newCustomers = newCustomers;
  stats.revenue = revenueAgg.data().amount ?? 0;
  stats.counterSales = counterAgg.data().total ?? 0;

  const dayRef = hubDoc(hubId, 'stats', date);
  const monthRef = hubDoc(hubId, 'stats', date.slice(0, 7));
  await runTransaction(db, async (tx) => {
    const prevDoc = ((await tx.get(dayRef)).data() ?? {}) as Partial<FullDayStats>;
    const prev = { ...ZERO, ...prevDoc };
    const delta: Record<string, unknown> = Object.fromEntries(
      (Object.keys(ZERO) as (keyof DayStats)[]).map((k) => [k, increment(stats[k] - (prev[k] ?? 0))]));
    // per-product / per-rider differences, merged into the month's maps
    const prevProducts = prevDoc.products ?? {};
    const productDelta: Record<string, unknown> = {};
    for (const id of new Set([...Object.keys(products), ...Object.keys(prevProducts)])) {
      const now = products[id] ?? { ...prevProducts[id], qty: 0, value: 0 };
      const was = prevProducts[id] ?? { qty: 0, value: 0 };
      productDelta[id] = { name: now.name, unit: now.unit, qty: increment(now.qty - was.qty), value: increment(now.value - was.value) };
    }
    const prevRiders = prevDoc.riders ?? {};
    const riderDelta: Record<string, unknown> = {};
    for (const id of new Set([...Object.keys(riders), ...Object.keys(prevRiders)])) {
      const now = riders[id] ?? { ...prevRiders[id], drops: 0, failed: 0, charges: 0 };
      const was = prevRiders[id] ?? { drops: 0, failed: 0, charges: 0 };
      riderDelta[id] = {
        name: now.name, drops: increment(now.drops - was.drops), failed: increment(now.failed - was.failed),
        charges: increment((now.charges ?? 0) - (was.charges ?? 0)),
      };
    }
    tx.set(dayRef, { ...stats, products, riders, kind: 'day', date, closedByUid: auth.currentUser?.uid ?? null, closedAt: serverTimestamp() });
    tx.set(monthRef, { ...delta, products: productDelta, riders: riderDelta, kind: 'month', month: date.slice(0, 7), updatedAt: serverTimestamp() }, { merge: true });
  });

  await logAudit({
    hubId, category: 'Hub Operations',
    action: `Closed ${date}: ${stats.deliveriesDone}/${stats.deliveriesScheduled} delivered, ${stats.deliveriesFailed} failed, ${ordersUpdated} orders updated`,
    target: `hubs/${hubId}/stats/${date}`,
  });
  return { ...stats, ordersUpdated };
}

/** Day docs for the last `days` days ending today (missing days = zeros), oldest first. */
export async function loadDayStats(hubId: HubId, days: number): Promise<{ date: string; stats: FullDayStats }[]> {
  const to = todayKey();
  const from = addDays(to, -(days - 1));
  const snap = await getDocs(query(hubCol(hubId, 'stats'), where('kind', '==', 'day'),
    where('date', '>=', from), where('date', '<=', to)));
  const byDate = new Map(snap.docs.map((d) => [d.id, d.data() as FullDayStats]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return { date, stats: { ...ZERO, ...byDate.get(date) } };
  });
}

/** Month docs Jan–Dec of a year (12 small reads). */
export async function loadMonthStats(hubId: HubId, year: string): Promise<{ month: string; stats: FullDayStats }[]> {
  return Promise.all(Array.from({ length: 12 }, async (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    const snap = await getDoc(hubDoc(hubId, 'stats', month));
    return { month, stats: { ...ZERO, ...(snap.data() as Partial<FullDayStats> | undefined) } };
  }));
}

export interface HubCounts {
  customers: number;
  activeSubscriptions: number;
  subsDaily: number;
  subsAlternate: number;
  subsCustom: number;
  placedOrders: number;
  products: number;
  todayTotal: number;
  todayScheduled: number;
  todayOut: number;
  todayDelivered: number;
  monthRevenue: number; // paise, closed days of this month
}

/** All dashboard numbers in ~13 aggregation reads. */
export function useHubCounts(hubId: HubId) {
  const [counts, setCounts] = useState<HubCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setCounts(null);
    setError(null);
    const today = todayKey();
    const subs = hubCol(hubId, 'subscriptions');
    const dels = hubCol(hubId, 'deliveries');
    const activeSubs = (freq?: string) => freq
      ? query(subs, where('status', '==', 'active'), where('frequency', '==', freq))
      : query(subs, where('status', '==', 'active'));
    const todayStatus = (s: DeliveryStatus) => query(dels, where('date', '==', today), where('status', '==', s));
    Promise.all([
      countOf(query(collection(db, 'users'), where('hubId', '==', hubId))),
      countOf(activeSubs()), countOf(activeSubs('daily')), countOf(activeSubs('alternate')),
      countOf(query(hubCol(hubId, 'orders'), where('status', '==', 'placed'))),
      countOf(hubCol(hubId, 'products')),
      countOf(query(dels, where('date', '==', today))),
      countOf(todayStatus('scheduled')), countOf(todayStatus('out_for_delivery')), countOf(todayStatus('delivered')),
      getDoc(hubDoc(hubId, 'stats', today.slice(0, 7))),
    ]).then(([customers, active, daily, alternate, placed, products, tTotal, tSched, tOut, tDone, month]) => {
      if (!alive) return;
      setCounts({
        customers, activeSubscriptions: active, subsDaily: daily, subsAlternate: alternate,
        subsCustom: Math.max(0, active - daily - alternate),
        placedOrders: placed, products,
        todayTotal: tTotal, todayScheduled: tSched, todayOut: tOut, todayDelivered: tDone,
        monthRevenue: (month.data()?.revenue as number | undefined) ?? 0,
      });
    }).catch((err) => alive && setError((err as Error).message));
    return () => { alive = false; };
  }, [hubId, tick]);
  return { counts, error, retry: () => setTick((t) => t + 1) };
}

export interface RecentOrder {
  id: string; customerName: string; items: { name: string; qty: number }[]; total: number; status: string;
}

/** Latest 5 one-time orders of the hub. */
export async function loadRecentOrders(hubId: HubId): Promise<RecentOrder[]> {
  const snap = await getDocs(query(hubCol(hubId, 'orders'), orderBy('createdAt', 'desc'), limit(5)));
  return snap.docs.map((d) => {
    const o = d.data();
    return { id: d.id, customerName: o.customerName ?? 'Customer', items: o.items ?? [], total: (o.total ?? 0) / 100, status: o.status };
  });
}

export interface AnalysisData {
  revenue: number; // ₹
  drops: number;
  customers: number;
  subsTotal: number;
  subsActive: number;
  subsPaused: number;
  /** active subscriptions on 15 / 30 / 90-day plans (plan length ≤15, ≤30, longer) */
  plan15: number;
  plan30: number;
  plan90: number;
  /** active subscriptions ending within 7 / 15 / 30 days, and what they paid (₹) */
  renew: { days: number; count: number; value: number }[];
}

/** Analysis page numbers: closed-day totals for the period + a few count()/sum() reads. */
export async function loadAnalysis(hubId: HubId, range: 'week' | 'month' | 'year'): Promise<AnalysisData> {
  const totals = range === 'year'
    ? (await loadMonthStats(hubId, todayKey().slice(0, 4))).map((m) => m.stats)
    : (await loadDayStats(hubId, range === 'week' ? 7 : 30)).map((d) => d.stats);
  const subs = hubCol(hubId, 'subscriptions');
  const active = query(subs, where('status', '==', 'active'));

  // plan ids grouped by length
  const plans = await getDocs(hubCol(hubId, 'plans'));
  const bucket: Record<15 | 30 | 90, string[]> = { 15: [], 30: [], 90: [] };
  plans.docs.forEach((p) => {
    const days = (p.data().durationDays as number) ?? 30;
    bucket[days <= 15 ? 15 : days <= 30 ? 30 : 90].push(p.id);
  });
  const countPlans = async (ids: string[]) => {
    let n = 0;
    for (let i = 0; i < ids.length; i += 30) {
      n += await countOf(query(subs, where('status', '==', 'active'), where('planId', 'in', ids.slice(i, i + 30))));
    }
    return n;
  };

  const today = todayKey();
  const renewing = (days: number) => getAggregateFromServer(
    query(subs, where('status', '==', 'active'), where('endDate', '>=', today), where('endDate', '<=', addDays(today, days))),
    { n: count(), paid: sum('amountPaid') });

  const [customers, subsTotal, subsActive, subsPaused, plan15, plan30, plan90, r7, r15, r30] = await Promise.all([
    countOf(query(collection(db, 'users'), where('hubId', '==', hubId))),
    countOf(query(subs, where('status', 'in', ['active', 'paused', 'completed', 'cancelled']))),
    countOf(active),
    countOf(query(subs, where('status', '==', 'paused'))),
    countPlans(bucket[15]), countPlans(bucket[30]), countPlans(bucket[90]),
    renewing(7), renewing(15), renewing(30),
  ]);
  return {
    revenue: totals.reduce((a, t) => a + t.revenue, 0) / 100,
    drops: totals.reduce((a, t) => a + t.deliveriesDone, 0),
    customers, subsTotal, subsActive, subsPaused, plan15, plan30, plan90,
    renew: [[7, r7], [15, r15], [30, r30]].map(([days, r]) => {
      const d = (r as Awaited<ReturnType<typeof renewing>>).data();
      return { days: days as number, count: d.n, value: (d.paid ?? 0) / 100 };
    }),
  };
}
