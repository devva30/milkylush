// Deliveries of one hub (hubs/{hubId}/deliveries/{yyyy-MM-dd}_{sourceId}): one doc
// per drop per day — the single list the admin, the rider app and the customer app
// all read. Created by "Generate deliveries" (WORKFLOW.md §2).

import { useMemo } from 'react';
import {
  doc, getDocs, query, serverTimestamp, where, writeBatch, updateDoc, arrayUnion, type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { hubCol, hubDoc, type HubId } from './hubs';
import { useLiveQuery, usePagedQuery, type WithId } from './useFirestore';
import { orderBy as byField } from 'firebase/firestore';
import type { Order, Product } from '../types';
import { logAudit } from '../utils/auditLogger';
import type { RouteDoc } from './routes';
import { purgeOldProofPhotos } from './proofPhotos';
import { toDate, todayKey, addDays } from './dates';
import { withGps } from './customers';

export type DeliveryStatus = 'scheduled' | 'skipped' | 'out_for_delivery' | 'delivered' | 'failed' | 'cancelled';

export interface DeliveryAddress {
  line1?: string;
  line2?: string;
  landmark?: string;
  area?: string;
  city?: string;
  pincode?: string;
  doorNotes?: string;
  location?: unknown; // GeoPoint
}

export interface DeliveryItem {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  price: number; // paise per unit
  returnableBottle?: boolean;
}

export interface DeliveryDoc {
  hubId: HubId;
  date: string;
  sourceType: 'subscription' | 'order';
  sourceId: string;
  customerUid: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  address: DeliveryAddress;
  addressText: string;
  instructions: string;
  items: DeliveryItem[];
  amount: number; // paise, value of the drop (for reports)
  riderUid: string | null;
  riderName: string | null;
  routeId: string | null;
  stopSeq: number;
  status: DeliveryStatus;
  deliveredAt: Timestamp | null;
  hasProofPhoto?: boolean; // photo lives in hubs/{hubId}/proofPhotos/{id}
  bottlesDue: number;
  bottlesCollected: number;
  failReason: string | null;
  riderNote: string | null;
  coveringFor?: string | null;
  /** Copied from the order: a free-sample drop (Free Samples page lists these). */
  isFreeSample?: boolean;
  /** paise, the order's delivery charge (one-time orders only) */
  deliveryCharge?: number;
}

/** Subscription fields generation needs (DATABASE.md → subscriptions). */
interface SubscriptionDoc {
  customerUid: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  address?: DeliveryAddress;
  addressText?: string;
  deliveryInstructions?: string;
  productId: string;
  productName: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  returnableBottle?: boolean;
  frequency: 'daily' | 'alternate' | 'weekdays' | 'custom';
  customDays?: number[]; // 1 = Mon … 7 = Sun
  startDate: string;
  endDate?: string | null;
  totalDrops?: number; // paid drops (customer app plans); end date follows from these
  pausedDates?: string[];
  /** Past plan days whose drop was not delivered (set by Close day): they move the end out. */
  missedDates?: string[];
  vacationStart?: string | null;
  vacationEnd?: string | null;
  status: string;
}

interface OrderDoc {
  customerUid: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  address?: DeliveryAddress;
  addressText?: string;
  deliveryInstructions?: string;
  items: { productId: string; name: string; unit: string; price: number; qty: number; returnableBottle?: boolean }[];
  total: number;
  deliveryDate: string;
  status: string;
  isFreeSample?: boolean;
  deliveryCharge?: number;
}

/** ISO weekday of a 'yyyy-MM-dd' key: 1 = Monday … 7 = Sunday. */
export function isoWeekday(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

function daysBetween(a: string, b: string): number {
  const toUtc = (k: string) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

function plusDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function isPlanDay(sub: SubscriptionDoc, date: string): boolean {
  if (date < sub.startDate) return false;
  const wd = isoWeekday(date);
  switch (sub.frequency) {
    case 'daily': return true;
    case 'alternate': return daysBetween(sub.startDate, date) % 2 === 0;
    case 'weekdays': return wd <= 5;
    case 'custom': return (sub.customDays ?? []).includes(wd);
    default: return false;
  }
}

/**
 * Day of the last PAID drop. A plan is bought as `totalDrops`; skipped days and vacations
 * don't use drops, so the end moves out. Same rule as the customer app
 * (lib/data/subscribe.dart → subscriptionEndDate). Older plans without totalDrops keep endDate.
 */
export function subscriptionEndDate(sub: SubscriptionDoc): string | null {
  if (!sub.totalDrops || !sub.startDate) return sub.endDate ?? null;
  // Skipped days and drops that were not delivered both move the end date out.
  const paused = new Set([...(sub.pausedDates ?? []), ...(sub.missedDates ?? [])]);
  let day = sub.startDate;
  let counted = 0;
  for (let i = 0; i < 1500; i++) {
    const onVacation = !!sub.vacationStart && !!sub.vacationEnd && day >= sub.vacationStart && day <= sub.vacationEnd;
    if (isPlanDay(sub, day) && !paused.has(day) && !onVacation) {
      counted++;
      if (counted >= sub.totalDrops) return day;
    }
    day = plusDays(day, 1);
  }
  return day;
}

/** Why a subscription has no drop on `date`, or null if it is due. */
export function subscriptionSkipReason(sub: SubscriptionDoc, date: string): string | null {
  if (sub.status !== 'active') return `status ${sub.status}`;
  if (!sub.startDate || date < sub.startDate) return 'not started';
  const end = subscriptionEndDate(sub);
  if (end && date > end) return 'ended';
  if ((sub.pausedDates ?? []).includes(date)) return 'skipped by customer';
  if (sub.vacationStart && sub.vacationEnd && date >= sub.vacationStart && date <= sub.vacationEnd) return 'on vacation';
  const wd = isoWeekday(date);
  switch (sub.frequency) {
    case 'daily': return null;
    case 'alternate': return daysBetween(sub.startDate, date) % 2 === 0 ? null : 'alternate day off';
    case 'weekdays': return wd <= 5 ? null : 'weekend';
    case 'custom': return (sub.customDays ?? []).includes(wd) ? null : 'not a delivery day';
    default: return 'unknown frequency';
  }
}

export function addressLine(a?: DeliveryAddress, fallback = ''): string {
  if (!a) return fallback;
  return [a.line1, a.line2, a.landmark, a.area, a.city, a.pincode].filter(Boolean).join(', ') || fallback;
}

/** Live list of one hub's deliveries for one date. */
export function useDeliveries(hubId: HubId, date: string) {
  return useLiveQuery<DeliveryDoc>(query(hubCol(hubId, 'deliveries'), where('date', '==', date)), [hubId, date]);
}

export interface GenerateSummary {
  created: number;
  refreshed: number;
  skippedNow: number;
  unchanged: number;
  unassigned: number;
  completedSubs: number;
  photosPurged: number;
}

/**
 * Builds `date`'s drops for the hub from active subscriptions and placed one-time
 * orders. Safe to run again: existing drops keep their status; only still-scheduled
 * ones get the current rider/sequence, and drops whose subscription is now paused
 * for that day become `skipped`.
 */
export async function generateDeliveries(hubId: HubId, date: string, opts: { auto?: boolean } = {}): Promise<GenerateSummary> {
  const [subsSnap, ordersSnap, routesSnap, existingSnap] = await Promise.all([
    getDocs(query(hubCol(hubId, 'subscriptions'), where('status', '==', 'active'))),
    getDocs(query(hubCol(hubId, 'orders'), where('deliveryDate', '==', date), where('status', '==', 'placed'))),
    getDocs(hubCol(hubId, 'routes')),
    getDocs(query(hubCol(hubId, 'deliveries'), where('date', '==', date))),
  ]);

  // customer → {rider, route, seq}; a route's substitute covers that date
  const assign = new Map<string, { riderUid: string; riderName: string; routeId: string; stopSeq: number; coveringFor: string | null }>();
  routesSnap.docs.forEach((r) => {
    const route = r.data() as RouteDoc;
    const sub = route.substitute && route.substitute.date === date ? route.substitute : null;
    route.stops.forEach((s, i) => assign.set(s.customerUid, {
      riderUid: sub ? sub.riderUid : route.riderUid,
      riderName: sub ? sub.riderName : route.riderName,
      routeId: r.id,
      stopSeq: i + 1,
      coveringFor: sub ? route.riderUid : null,
    }));
  });

  const existing = new Map(existingSnap.docs.map((d) => [d.id, d.data() as DeliveryDoc]));
  const summary: GenerateSummary = { created: 0, refreshed: 0, skippedNow: 0, unchanged: 0, unassigned: 0, completedSubs: 0, photosPurged: 0 };
  const writes: { ref: ReturnType<typeof doc>; data: Record<string, unknown>; merge: boolean }[] = [];

  const plan = (id: string, base: Omit<DeliveryDoc, 'riderUid' | 'riderName' | 'routeId' | 'stopSeq' | 'status' | 'deliveredAt' | 'hasProofPhoto' | 'bottlesCollected' | 'failReason' | 'riderNote'>) => {
    const a = assign.get(base.customerUid);
    const prevRider = existing.get(id)?.riderUid ?? null;
    if (!a && !prevRider) summary.unassigned++;
    const routing = { riderUid: a?.riderUid ?? null, riderName: a?.riderName ?? null, routeId: a?.routeId ?? null, stopSeq: a?.stopSeq ?? 9999, coveringFor: a?.coveringFor ?? null };
    const ref = hubDoc(hubId, 'deliveries', id);
    const prev = existing.get(id);
    if (!prev) {
      writes.push({ ref, merge: false, data: {
        ...base, ...routing, status: 'scheduled', deliveredAt: null, hasProofPhoto: false, bottlesCollected: 0,
        failReason: null, riderNote: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      } });
      summary.created++;
    } else if (prev.status === 'scheduled') {
      // No route for this customer: keep a rider the admin picked by hand.
      const keep = !a && prevRider ? {} : routing;
      const next = { ...base, ...keep } as Record<string, unknown>;
      // Write only what really changed (free plan: every write counts).
      const changed = Object.keys(next).some((k) => JSON.stringify(next[k]) !== JSON.stringify((prev as unknown as Record<string, unknown>)[k]));
      if (changed) {
        writes.push({ ref, merge: true, data: { ...next, updatedAt: serverTimestamp() } });
        summary.refreshed++;
      } else {
        summary.unchanged++;
      }
    } else {
      summary.unchanged++;
    }
  };

  for (const d of subsSnap.docs) {
    const sub = d.data() as SubscriptionDoc;
    const id = `${date}_${d.id}`;
    const end = subscriptionEndDate(sub);
    if (end && date > end) {
      writes.push({ ref: d.ref, merge: true, data: { status: 'completed', endDate: end, updatedAt: serverTimestamp() } });
      summary.completedSubs++;
      continue;
    }
    // Skips / vacations moved the last paid drop: keep endDate current for the admin lists.
    if (end && end !== sub.endDate) {
      writes.push({ ref: d.ref, merge: true, data: { endDate: end, updatedAt: serverTimestamp() } });
    }
    const reason = subscriptionSkipReason(sub, date);
    if (reason) {
      const prev = existing.get(id);
      if (prev && prev.status === 'scheduled') {
        writes.push({ ref: hubDoc(hubId, 'deliveries', id), merge: true, data: { status: 'skipped', failReason: reason, updatedAt: serverTimestamp() } });
        summary.skippedNow++;
      }
      continue;
    }
    const qty = Math.max(1, sub.quantity || 1);
    plan(id, {
      hubId, date, sourceType: 'subscription', sourceId: d.id,
      customerUid: sub.customerUid, customerId: sub.customerId ?? '', customerName: sub.customerName ?? '',
      customerPhone: sub.customerPhone ?? '', address: sub.address ?? {}, addressText: sub.addressText ?? addressLine(sub.address),
      instructions: sub.deliveryInstructions ?? '',
      items: [{ productId: sub.productId, name: sub.productName, unit: sub.unit, qty, price: sub.unitPrice ?? 0, returnableBottle: !!sub.returnableBottle }],
      amount: (sub.unitPrice ?? 0) * qty,
      bottlesDue: sub.returnableBottle ? qty : 0,
    });
  }

  for (const d of ordersSnap.docs) {
    const o = d.data() as OrderDoc;
    plan(`${date}_${d.id}`, {
      hubId, date, sourceType: 'order', sourceId: d.id,
      customerUid: o.customerUid, customerId: o.customerId ?? '', customerName: o.customerName ?? '',
      customerPhone: o.customerPhone ?? '', address: o.address ?? {}, addressText: o.addressText ?? addressLine(o.address),
      instructions: o.deliveryInstructions ?? '',
      items: o.items.map((i) => ({ ...i, returnableBottle: !!i.returnableBottle })),
      amount: o.total ?? 0,
      bottlesDue: o.items.reduce((n, i) => n + (i.returnableBottle ? i.qty : 0), 0),
      isFreeSample: !!o.isFreeSample,
      deliveryCharge: o.deliveryCharge ?? 0,
    });
  }

  // Firestore batches hold at most 500 writes.
  for (let i = 0; i < writes.length; i += 450) {
    const batch = writeBatch(db);
    writes.slice(i, i + 450).forEach((w) => (w.merge ? batch.set(w.ref, w.data, { merge: true }) : batch.set(w.ref, w.data)));
    await batch.commit();
  }

  if (opts.auto) return summary; // quiet background run: no audit entry, no photo clean-up

  // Housekeeping: proof photos are kept 30 days (no Cloud Storage on the free plan).
  summary.photosPurged = await purgeOldProofPhotos(hubId).catch(() => 0);

  await logAudit({
    hubId, category: 'Hub Operations',
    action: `Generated deliveries for ${date}: ${summary.created} new, ${summary.refreshed} refreshed, ${summary.skippedNow} skipped, ${summary.unassigned} without rider`,
    target: `hubs/${hubId}/deliveries`, after: { ...summary },
  });
  return summary;
}

const lastAuto = new Map<string, number>();
const AUTO_EVERY_MS = 5 * 60_000;

/**
 * Makes sure the drops of today and tomorrow exist (subscriptions create theirs only here:
 * customers cannot write deliveries). Runs when an admin opens a delivery page, at most once
 * every 5 minutes per hub and day, and writes only changes. Returns true if anything changed.
 */
export async function ensureDeliveries(hubId: HubId, extraDate?: string): Promise<boolean> {
  const today = todayKey();
  const dates = Array.from(new Set([today, addDays(today, 1), ...(extraDate && extraDate >= today && extraDate <= addDays(today, 7) ? [extraDate] : [])]));
  let changed = false;
  for (const date of dates) {
    const key = `${hubId}_${date}`;
    if (Date.now() - (lastAuto.get(key) ?? 0) < AUTO_EVERY_MS) continue;
    lastAuto.set(key, Date.now());
    try {
      const r = await generateDeliveries(hubId, date, { auto: true });
      if (r.created || r.refreshed || r.skippedNow || r.completedSubs) changed = true;
    } catch {
      lastAuto.delete(key); // try again next time (e.g. offline, or not an admin)
    }
  }
  return changed;
}

/** Forget the throttle so the next ensureDeliveries runs at once (after Generate / a refresh). */
export const resetAutoDeliveries = () => lastAuto.clear();

export async function setDeliveryStatus(hubId: HubId, id: string, status: DeliveryStatus, reason?: string): Promise<void> {
  const historyEntry = {
    tag: status,
    title: `Status set to ${status.toUpperCase().replace('_', ' ')}`,
    subtitle: reason ? `Reason: "${reason}"` : `Updated by Admin at ${new Date().toLocaleTimeString()}`,
    timestamp: new Date().toISOString(),
    date: new Date().toISOString(),
  };

  await updateDoc(hubDoc(hubId, 'deliveries', id), {
    status,
    ...(status === 'delivered' ? { deliveredAt: serverTimestamp() } : {}),
    ...(reason ? { failReason: reason } : {}),
    historyLog: arrayUnion(historyEntry),
    updatedAt: serverTimestamp(),
  });
  await logAudit({ hubId, category: 'Hub Operations', action: `Delivery ${id} → ${status}${reason ? ` (${reason})` : ''}`, target: `hubs/${hubId}/deliveries/${id}` });
}

export async function reassignDelivery(hubId: HubId, id: string, rider: { uid: string; name: string } | null): Promise<void> {
  await updateDoc(hubDoc(hubId, 'deliveries', id), {
    riderUid: rider?.uid ?? null, riderName: rider?.name ?? null, updatedAt: serverTimestamp(),
  });
  await logAudit({ hubId, category: 'Hub Operations', action: `Delivery ${id} → rider ${rider?.name ?? 'none'}`, target: `hubs/${hubId}/deliveries/${id}` });
}

// ---------- shared list views (Orders, All Deliveries, Delivered History, dispatch pages) ----------


/** Delivery status ⇄ the status names the existing order tables render. */
export const UI_STATUS: Record<DeliveryStatus, string> = {
  scheduled: 'pending', out_for_delivery: 'outForDelivery', delivered: 'delivered',
  cancelled: 'cancelled', skipped: 'skipped', failed: 'failed',
};
export const DB_STATUS: Record<string, DeliveryStatus> = {
  pending: 'scheduled', assigned: 'scheduled', packed: 'scheduled', outForDelivery: 'out_for_delivery',
  delivered: 'delivered', cancelled: 'cancelled', skipped: 'skipped', failed: 'failed',
};

/** A delivery in the Order shape the existing tables and the detail panel render. */
export function deliveryToOrder(d: WithId<DeliveryDoc>): Order {
  const isSub = d.sourceType === 'subscription';
  return {
    id: d.id,
    userId: d.customerUid,
    items: d.items.map((i) => ({
      id: i.productId,
      product: { id: i.productId, name: i.name, price: i.price / 100, unit: i.unit, imageUrl: (i as any).imageUrl || '' } as Product,
      quantity: i.qty,
      isSubscription: isSub,
    })),
    orderDate: d.date,
    status: UI_STATUS[d.status] as Order['status'],
    totalAmount: d.amount / 100,
    isSubscriptionDelivery: isSub,
    orderType: isSub ? 'subscription' : 'one-time',
    subscriptionId: isSub ? d.sourceId : undefined,
    address: withGps(d.addressText ?? '', d.address?.location),
    deliveryAddress: withGps(d.addressText ?? '', d.address?.location),
    deliveryInstructions: d.instructions,
    deliveryAgentId: d.riderUid ?? '',
    assignedPartner: d.riderName ?? '',
    customerName: d.customerName,
    customerPhone: d.customerPhone,
    hubId: d.hubId,
    bottlesReturned: d.bottlesCollected,
    deliveredAt: toDate(d.deliveredAt)?.toISOString(),
    hasProofPhoto: d.hasProofPhoto,
    failReason: d.failReason ?? undefined,
    riderNote: d.riderNote ?? undefined,
    customerId: d.customerId,
  } as unknown as Order;
}

/**
 * Deliveries of a hub between two IST days (inclusive), newest day first, 50 per
 * page ("Load more" fetches the next older 50). The optional status filter runs in
 * the database (index status + date desc), so pages never miss rows.
 */
export function useDeliveriesRange(hubId: HubId, from: string, to: string, status?: DeliveryStatus) {
  const q = useMemo(() => {
    const base = hubCol(hubId, 'deliveries');
    return status
      ? query(base, where('status', '==', status), where('date', '>=', from), where('date', '<=', to), byField('date', 'desc'))
      : query(base, where('date', '>=', from), where('date', '<=', to), byField('date', 'desc'));
  }, [hubId, from, to, status]);
  return usePagedQuery<DeliveryDoc>(q, [hubId, from, to, status ?? '']);
}

/** One rider's drops over the last `days` IST days, newest first, 50 per page. */
export function useRiderDeliveries(hubId: HubId, riderUid: string | null, days = 30) {
  const to = todayKey();
  const from = addDays(to, -(days - 1));
  // Index riderUid + date desc.
  const q = useMemo(() => {
    return riderUid
      ? query(hubCol(hubId, 'deliveries'), where('riderUid', '==', riderUid),
        where('date', '>=', from), where('date', '<=', to), byField('date', 'desc'))
      : null;
  }, [hubId, riderUid, from, to]);
  return usePagedQuery<DeliveryDoc>(q, [hubId, riderUid || '', from, to]);
}

/** Free-sample drops of the hub, newest delivery day first, 50 per page. */
export function useFreeSampleDeliveries(hubId: HubId) {
  return usePagedQuery<DeliveryDoc>(
    query(hubCol(hubId, 'deliveries'), where('isFreeSample', '==', true), byField('date', 'desc')), [hubId]);
}

/** Admin corrects the address on one drop (and on its order). */
export async function setDeliveryAddressText(hubId: HubId, delivery: { id: string; sourceType: string; sourceId: string }, text: string): Promise<void> {
  await updateDoc(hubDoc(hubId, 'deliveries', delivery.id), { addressText: text, updatedAt: serverTimestamp() });
  if (delivery.sourceType === 'order') {
    await updateDoc(hubDoc(hubId, 'orders', delivery.sourceId), { addressText: text, updatedAt: serverTimestamp() });
  }
  await logAudit({ hubId, category: 'Hub Operations', action: `Changed address on ${delivery.id}`, target: `hubs/${hubId}/deliveries/${delivery.id}` });
}
