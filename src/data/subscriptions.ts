// Subscriptions of one hub (hubs/{hubId}/subscriptions/{HSR-SUB-#####}).
// Created by the customer app; the admin pauses, skips days, cancels, reactivates.

import {
  arrayUnion, addDoc, collection, count, getAggregateFromServer, getDoc, orderBy, query, serverTimestamp, updateDoc, where, type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { logAudit } from '../utils/auditLogger';
import { loadDayStats } from './stats';
import type { Product, Subscription } from '../types';
import { hubCol, hubDoc, type HubId } from './hubs';
import { useLiveQuery, usePagedQuery, type WithId } from './useFirestore';
import { todayKey, addDays } from './dates';
import { subscriptionEndDate, subscriptionSkipReason, type DeliveryAddress } from './deliveries';
import { withGps } from './customers';

export interface SubscriptionDoc {
  hubId: HubId;
  customerUid: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  addressId?: string;
  address?: DeliveryAddress;
  addressText?: string;
  productId: string;
  productName: string;
  unit: string;
  unitPrice: number; // paise
  quantity: number;
  returnableBottle?: boolean;
  imageUrl?: string;
  frequency: 'daily' | 'alternate' | 'weekdays' | 'custom';
  customDays?: number[];
  planId?: string;
  planTitle?: string;
  planDurationDays?: number;
  missedDates?: string[]; // past drops not delivered (Close day) — they move the end date out
  totalDrops?: number; // paid drops; the end date follows from these + skips (deliveries.ts → subscriptionEndDate)
  timing?: string;
  couponCode?: string | null;
  discount?: number; // paise, coupon
  planDiscount?: number; // paise
  grossAmount?: number; // paise
  startDate: string;
  endDate?: string | null;
  status: 'pending_payment' | 'active' | 'paused' | 'completed' | 'cancelled';
  pausedDates?: string[];
  pausedDateReasons?: Record<string, string>;
  vacationStart?: string | null;
  vacationEnd?: string | null;
  amountPaid?: number; // paise
  paymentId?: string;
  deliveryInstructions?: string;
  cancellationReason?: string | null;
  historyLog?: unknown[];
  createdAt?: Timestamp;
}

const UI_FREQUENCY: Record<SubscriptionDoc['frequency'], Subscription['frequency']> = {
  daily: 'daily', alternate: 'alternateDays', weekdays: 'customDays', custom: 'customDays',
};

/** A subscription in the shape the existing Subscriptions screens render. */
export function subToUi(id: string, s: SubscriptionDoc): Subscription {
  const product = {
    id: s.productId, name: s.productName, price: (s.unitPrice ?? 0) / 100, unit: s.unit, imageUrl: s.imageUrl ?? '',
  } as Product;
  const days = s.endDate && s.startDate
    ? Math.round((Date.parse(s.endDate) - Date.parse(s.startDate)) / 86_400_000) + 1 : undefined;
  return {
    id,
    userId: s.customerUid,
    userName: s.customerName,
    customerName: s.customerName,
    customerPhone: s.customerPhone,
    product,
    productName: s.productName,
    frequency: UI_FREQUENCY[s.frequency] ?? 'daily',
    customDays: s.frequency === 'weekdays' ? [1, 2, 3, 4, 5] : (s.customDays ?? []),
    quantity: s.quantity,
    timing: 'morning',
    startDate: s.startDate,
    // Paid-drop plans: end date follows from totalDrops + skips/vacation (live, same rule as the apps).
    endDate: (s.totalDrops ? subscriptionEndDate(s) : s.endDate) ?? undefined,
    status: s.status as Subscription['status'],
    pausedDates: s.pausedDates ?? [],
    vacationStart: s.vacationStart ?? undefined,
    vacationEnd: s.vacationEnd ?? undefined,
    planDuration: s.planDurationDays ? `${s.planDurationDays}days` : (s.planTitle ?? (days ? `${days}days` : undefined)),
    planDurationDays: s.planDurationDays,
    totalDrops: s.totalDrops,
    prepaidAmountPaid: (s.amountPaid ?? 0) / 100,
    hubId: s.hubId,
    deliveryAddress: withGps(s.addressText ?? '', s.address?.location),
    deliveryInstructions: s.deliveryInstructions,
    // fields the page reads that aren't in the Subscription type
    historyLog: s.historyLog ?? [],
    pausedDateReasons: s.pausedDateReasons ?? {},
    customerId: s.customerId,
    createdAt: s.createdAt ? s.createdAt.toDate().toISOString() : undefined,
    cancellationReason: s.cancellationReason ?? undefined,
    prepaidPlanId: s.planId,
    prepaidDays: days,
  } as unknown as Subscription;
}

/** Hub subscriptions, newest first, 50 per page; status filter runs in the database. */
export function useHubSubscriptions(hubId: HubId, status?: SubscriptionDoc['status']) {
  const base = hubCol(hubId, 'subscriptions');
  const q = status
    ? query(base, where('status', '==', status), orderBy('createdAt', 'desc'))
    : query(base, orderBy('createdAt', 'desc'));
  const res = usePagedQuery<SubscriptionDoc>(q, [hubId, status ?? 'all']);
  return { ...res, ui: res.data.map((d: WithId<SubscriptionDoc>) => subToUi(d.id, d)) };
}

/** Active subscriptions that start after today (advance-paid, not yet delivering), soonest first. */
export function useUpcomingSubscriptions(hubId: HubId) {
  const res = useLiveQuery<SubscriptionDoc>(
    query(hubCol(hubId, 'subscriptions'), where('status', '==', 'active'), where('startDate', '>', todayKey()), orderBy('startDate')),
    [hubId]);
  return { ...res, ui: res.data.map((d) => subToUi(d.id, d)) };
}

/** Admin moves a subscription's first delivery day (yyyy-MM-dd). */
export async function setSubscriptionStart(hubId: HubId, subId: string, startDate: string): Promise<void> {
  await updateDoc(hubDoc(hubId, 'subscriptions', subId), { startDate, updatedAt: serverTimestamp() });
}

/**
 * Keeps an already-generated delivery in step with a skip/unskip of that day.
 * No-op when the day hasn't been generated yet (generation reads pausedDates).
 */
export async function syncDeliveryForSkip(hubId: HubId, subId: string, date: string, skipped: boolean): Promise<void> {
  const ref = hubDoc(hubId, 'deliveries', `${date}_${subId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const status = snap.data().status;
  if (skipped && status === 'scheduled') {
    await updateDoc(ref, { status: 'skipped', failReason: 'skipped by admin', updatedAt: serverTimestamp() });
  } else if (!skipped && status === 'skipped') {
    await updateDoc(ref, { status: 'scheduled', failReason: null, updatedAt: serverTimestamp() });
  }
}

// ---- Subscription Analytics (Manage Subscriptions page) ----

export interface SubscriptionAnalytics {
  active: number;
  paused: number;
  cancelled: number;
  completed: number;
  /** active subscriptions per plan, most popular first */
  perPlan: { id: string; title: string; n: number }[];
  /** paise, delivered subscription value from closed days */
  last30: number;
  prev30: number;
}

export async function loadSubscriptionAnalytics(hubId: HubId, plans: { id: string; title: string }[]): Promise<SubscriptionAnalytics> {
  const subs = hubCol(hubId, 'subscriptions');
  const countWhere = async (status: SubscriptionDoc['status'], planId?: string) => {
    const q = planId
      ? query(subs, where('status', '==', status), where('planId', '==', planId))
      : query(subs, where('status', '==', status));
    return (await getAggregateFromServer(q, { n: count() })).data().n;
  };
  const [active, paused, cancelled, completed, perPlanCounts, days] = await Promise.all([
    countWhere('active'), countWhere('paused'), countWhere('cancelled'), countWhere('completed'),
    Promise.all(plans.map((p) => countWhere('active', p.id))),
    loadDayStats(hubId, 60),
  ]);
  const value = (rows: typeof days) => rows.reduce((n, d) => n + (d.stats.subscriptionValue ?? 0), 0);
  return {
    active, paused, cancelled, completed,
    perPlan: plans.map((p, i) => ({ id: p.id, title: p.title, n: perPlanCounts[i] })).sort((a, b) => b.n - a.n),
    last30: value(days.slice(30)),
    prev30: value(days.slice(0, 30)),
  };
}

/** Active subscriptions whose end date is within the next `days` days, soonest first. */
export function useExpiringSubscriptions(hubId: HubId, days = 14) {
  const today = todayKey();
  return useLiveQuery<SubscriptionDoc>(
    query(hubCol(hubId, 'subscriptions'), where('status', '==', 'active'),
      where('endDate', '>=', today), where('endDate', '<=', addDays(today, days)), orderBy('endDate')),
    [hubId, today, days]);
}

/** Admin gives extra days on a subscription (e.g. goodwill); audit-logged. */
export async function extendSubscription(hubId: HubId, subId: string, endDate: string, extraDays: number): Promise<string> {
  const ref = hubDoc(hubId, 'subscriptions', subId);
  const sub = (await getDoc(ref)).data() as SubscriptionDoc | undefined;
  let next = addDays(endDate, extraDays);
  if (sub?.totalDrops) {
    // Paid-drop plans: add the drops that fall in the extra days; the end date follows.
    const from = subscriptionEndDate(sub) ?? endDate;
    let extraDrops = 0;
    for (let i = 1; i <= extraDays; i++) {
      if (!subscriptionSkipReasonIgnoringEnd(sub, addDays(from, i))) extraDrops++;
    }
    const updated = { ...sub, totalDrops: sub.totalDrops + extraDrops };
    next = subscriptionEndDate(updated) ?? next;
    await updateDoc(ref, { totalDrops: updated.totalDrops, endDate: next, updatedAt: serverTimestamp() });
  } else {
    await updateDoc(ref, { endDate: next, updatedAt: serverTimestamp() });
  }
  await logAudit({ hubId, category: 'Hub Operations', action: `Extended ${subId} by ${extraDays} days to ${next}`, target: `hubs/${hubId}/subscriptions/${subId}` });
  return next;
}

/**
 * Option A — the admin gives the customer extra paid drops (e.g. for a missed or bad
 * delivery). The end date follows; the customer sees it in the plan's activity history.
 */
export async function addPaidDrops(hubId: HubId, subId: string, drops: number, reason: string): Promise<string | null> {
  const ref = hubDoc(hubId, 'subscriptions', subId);
  const sub = (await getDoc(ref)).data() as SubscriptionDoc | undefined;
  if (!sub) throw new Error('Subscription not found');
  if (!sub.totalDrops) throw new Error('This older plan has no paid-drop count; use Extend instead.');
  const n = Math.max(1, Math.min(60, Math.round(drops)));
  const updated = { ...sub, totalDrops: sub.totalDrops + n };
  const end = subscriptionEndDate(updated);
  await updateDoc(ref, {
    totalDrops: updated.totalDrops,
    ...(end ? { endDate: end } : {}),
    historyLog: arrayUnion({
      id: `log_${Date.now()}`,
      type: 'admin_added_drops',
      date: todayKey(),
      reason: `${n} extra drop${n > 1 ? 's' : ''} added — ${reason}`,
      notes: '',
      actor: 'admin',
      actorName: 'MilkyLush Support',
      timestamp: new Date().toISOString(),
    }),
    updatedAt: serverTimestamp(),
  });
  await logAudit({ hubId, category: 'Hub Operations', action: `Added ${n} paid drop(s) to ${subId} (${reason}); ends ${end}`, target: `hubs/${hubId}/subscriptions/${subId}` });
  return end;
}

/**
 * Option B — run by Close day. A subscription drop of [date] that was not delivered
 * (failed, or never done) is recorded in the plan's missedDates, so it does not use up a
 * paid drop and the end date moves out. Closing the day again after a correction
 * (e.g. the drop was set to delivered) removes it again.
 */
export async function syncMissedDrops(hubId: HubId, date: string, drops: { sourceType: string; sourceId: string; status: string }[]): Promise<number> {
  let changed = 0;
  for (const d of drops) {
    if (d.sourceType !== 'subscription') continue;
    const missed = d.status === 'failed' || d.status === 'scheduled' || d.status === 'out_for_delivery';
    const ref = hubDoc(hubId, 'subscriptions', d.sourceId);
    const sub = (await getDoc(ref)).data() as SubscriptionDoc | undefined;
    if (!sub || sub.status === 'cancelled') continue;
    const had = (sub.missedDates ?? []).includes(date);
    if (had === missed) continue;
    const missedDates = missed ? [...(sub.missedDates ?? []), date] : (sub.missedDates ?? []).filter((x) => x !== date);
    const end = sub.totalDrops ? subscriptionEndDate({ ...sub, missedDates }) : null;
    await updateDoc(ref, {
      missedDates,
      ...(end ? { endDate: end } : {}),
      historyLog: arrayUnion({
        id: `log_${Date.now()}_${changed}`,
        type: missed ? 'drop_missed' : 'drop_missed_cleared',
        date,
        reason: missed ? 'Drop not delivered — added at the end of the plan' : 'Drop confirmed delivered',
        notes: '',
        actor: 'admin',
        actorName: 'MilkyLush Support',
        timestamp: new Date().toISOString(),
      }),
      updatedAt: serverTimestamp(),
    });
    changed++;
  }
  return changed;
}

/** Is `date` a delivery day of the plan (frequency, skips, vacation), ignoring its end? */
function subscriptionSkipReasonIgnoringEnd(sub: SubscriptionDoc, date: string): string | null {
  return subscriptionSkipReason({ ...sub, status: 'active', totalDrops: undefined, endDate: null }, date);
}

/** In-app reminder to the customer (users/{uid}/inbox), shown in the customer app. */
export async function sendRenewalReminder(customerUid: string, productName: string, endDate: string): Promise<void> {
  await addDoc(collection(db, 'users', customerUid, 'inbox'), {
    title: 'Your subscription is ending soon',
    body: `Your ${productName} subscription ends on ${endDate}. Renew in the app to keep your deliveries coming.`,
    type: 'renewal_reminder',
    read: false,
    createdAt: serverTimestamp(),
  });
}
