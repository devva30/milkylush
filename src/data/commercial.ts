// Commercial console data: period totals (from Close day's stats docs), farmers,
// milk purchases, farmer payouts, monthly expenses and counter (walk-in) sales.
// All per hub; money in paise. Nothing here loads every order or customer.

import {
  addDoc, collection, doc, getAggregateFromServer, getDoc, getDocs, limit, orderBy, query, serverTimestamp,
  setDoc, sum, where, writeBatch, type Timestamp,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { hubCol, hubDoc, type HubId } from './hubs';
import { addDays, todayKey } from './dates';
import { withNextId } from './ids';
import { useLiveQuery, usePagedQuery } from './useFirestore';
import { loadDayStats, loadMonthStats, type FullDayStats, type ProductLine, type RiderLine } from './stats';
import { logAudit } from '../utils/auditLogger';

// ---------- period totals ----------

export type Period = 'today' | 'week' | 'month' | 'year';

export interface PeriodTotals {
  from: string;
  to: string;
  /** one row per day (today / week / month) or per month (year), oldest first */
  rows: { key: string; stats: FullDayStats }[];
  sum: FullDayStats;
  products: (ProductLine & { id: string })[];
  riders: (RiderLine & { id: string })[];
}

function addStats(a: FullDayStats, b: FullDayStats): FullDayStats {
  const out = { ...a } as FullDayStats;
  (Object.keys(b) as (keyof FullDayStats)[]).forEach((k) => {
    if (typeof b[k] === 'number') (out as unknown as Record<string, number>)[k] = ((a[k] as number) ?? 0) + (b[k] as number);
  });
  const products = { ...(a.products ?? {}) };
  Object.entries(b.products ?? {}).forEach(([id, p]) => {
    const was = products[id];
    products[id] = was ? { ...was, qty: was.qty + p.qty, value: was.value + p.value } : { ...p };
  });
  const riders = { ...(a.riders ?? {}) };
  Object.entries(b.riders ?? {}).forEach(([id, r]) => {
    const was = riders[id];
    riders[id] = was ? { ...was, drops: was.drops + r.drops, failed: was.failed + r.failed, charges: (was.charges ?? 0) + (r.charges ?? 0) } : { ...r };
  });
  return { ...out, products, riders };
}

export function periodRange(period: Period): { from: string; to: string } {
  const to = todayKey();
  if (period === 'today') return { from: to, to };
  if (period === 'week') return { from: addDays(to, -6), to };
  if (period === 'month') return { from: `${to.slice(0, 7)}-01`, to };
  return { from: `${to.slice(0, 4)}-01-01`, to };
}

export async function loadPeriodTotals(hubId: HubId, period: Period): Promise<PeriodTotals> {
  const { from, to } = periodRange(period);
  let rows: { key: string; stats: FullDayStats }[];
  if (period === 'year') {
    rows = (await loadMonthStats(hubId, to.slice(0, 4))).map((m) => ({ key: m.month, stats: m.stats }));
  } else {
    const days = period === 'today' ? 1 : period === 'week' ? 7 : Number(to.slice(8, 10));
    rows = (await loadDayStats(hubId, days)).map((d) => ({ key: d.date, stats: d.stats }));
  }
  const total = rows.reduce((acc, r) => addStats(acc, r.stats), {} as FullDayStats);
  return {
    from, to, rows, sum: total,
    products: Object.entries(total.products ?? {}).map(([id, p]) => ({ id, ...p })).sort((a, b) => b.value - a.value),
    riders: Object.entries(total.riders ?? {}).map(([id, r]) => ({ id, ...r })).sort((a, b) => b.drops - a.drops),
  };
}

export function usePeriodTotals(hubId: HubId, period: Period) {
  const [data, setData] = useState<PeriodTotals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    loadPeriodTotals(hubId, period).then((d) => alive && setData(d)).catch((e) => alive && setError((e as Error).message));
    return () => { alive = false; };
  }, [hubId, period, tick]);
  return { data, error, loading: !data && !error, retry: () => setTick((t) => t + 1) };
}

// ---------- farmers & milk purchases ----------

export interface FarmerDoc {
  name: string;
  phone: string;
  village: string;
  dailySupplyLiters: number;
  bankAccount?: string;
  status: 'active' | 'inactive';
  createdAt?: Timestamp;
}

export function useFarmers(hubId: HubId) {
  return useLiveQuery<FarmerDoc>(query(hubCol(hubId, 'farmers'), orderBy('name')), [hubId]);
}

/** New farmer with the next HSR-FRM-### id. */
export async function addFarmer(hubId: HubId, f: Omit<FarmerDoc, 'status' | 'createdAt'>): Promise<string> {
  const id = await withNextId(hubId, 'farmer', (tx, newId) =>
    tx.set(hubDoc(hubId, 'farmers', newId), { ...f, status: 'active', createdAt: serverTimestamp() }));
  await logAudit({ hubId, category: 'Financials & Refunds', action: `Added farmer ${id} ${f.name}`, target: `hubs/${hubId}/farmers/${id}` });
  return id;
}

export interface ProcurementDoc {
  farmerId: string;
  farmerName: string;
  date: string;
  litres: number;
  fat: number;
  snf: number;
  /** paise */
  ratePerLitre: number;
  /** paise */
  amount: number;
  collectionPerson: string;
  paymentStatus: 'pending' | 'paid';
  createdAt?: Timestamp;
}

/** Milk purchases, newest day first, 50 per page. */
export function useProcurement(hubId: HubId) {
  return usePagedQuery<ProcurementDoc>(query(hubCol(hubId, 'procurement'), orderBy('date', 'desc')), [hubId]);
}

export async function addProcurement(hubId: HubId, p: Omit<ProcurementDoc, 'paymentStatus' | 'createdAt'>): Promise<void> {
  await addDoc(hubCol(hubId, 'procurement'), { ...p, paymentStatus: 'pending', createdAt: serverTimestamp() });
  await logAudit({
    hubId, category: 'Financials & Refunds',
    action: `Milk purchase ${p.litres} L from ${p.farmerName} (₹${(p.amount / 100).toFixed(2)})`, target: `hubs/${hubId}/procurement`,
  });
}

/** Litres bought and amount owed (paise) between two days. */
export async function procurementTotals(hubId: HubId, from: string, to: string): Promise<{ litres: number; amount: number }> {
  const agg = await getAggregateFromServer(
    query(hubCol(hubId, 'procurement'), where('date', '>=', from), where('date', '<=', to)),
    { litres: sum('litres'), amount: sum('amount') });
  return { litres: agg.data().litres ?? 0, amount: agg.data().amount ?? 0 };
}

export interface FarmerPaymentDoc {
  farmerId: string;
  farmerName: string;
  /** paise */
  amount: number;
  method: string;
  purchases: number;
  paidByUid: string | null;
  paidAt?: Timestamp;
}

export function useFarmerPayments(hubId: HubId) {
  return useLiveQuery<FarmerPaymentDoc>(query(hubCol(hubId, 'farmerPayments'), orderBy('paidAt', 'desc'), limit(100)), [hubId]);
}

/** Unpaid amount (paise) per farmer from pending purchases. */
export async function pendingFarmerDues(hubId: HubId): Promise<Record<string, { amount: number; count: number }>> {
  const snap = await getDocs(query(hubCol(hubId, 'procurement'), where('paymentStatus', '==', 'pending')));
  const out: Record<string, { amount: number; count: number }> = {};
  snap.docs.forEach((d) => {
    const p = d.data() as ProcurementDoc;
    const row = (out[p.farmerId] ||= { amount: 0, count: 0 });
    row.amount += p.amount;
    row.count++;
  });
  return out;
}

/** Marks all of a farmer's pending purchases paid and records one payout. */
export async function payFarmer(hubId: HubId, farmerId: string, farmerName: string, method: string): Promise<number> {
  const snap = await getDocs(query(hubCol(hubId, 'procurement'), where('farmerId', '==', farmerId), where('paymentStatus', '==', 'pending')));
  if (snap.empty) return 0;
  let amount = 0;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    amount += (d.data() as ProcurementDoc).amount;
    batch.update(d.ref, { paymentStatus: 'paid', paidAt: serverTimestamp() });
  });
  batch.set(doc(hubCol(hubId, 'farmerPayments')), {
    farmerId, farmerName, amount, method, purchases: snap.size, paidByUid: auth.currentUser?.uid ?? null, paidAt: serverTimestamp(),
  });
  await batch.commit();
  await logAudit({ hubId, category: 'Financials & Refunds', action: `Paid farmer ${farmerId} ₹${(amount / 100).toFixed(2)} (${method})`, target: `hubs/${hubId}/farmerPayments` });
  return amount;
}

// ---------- monthly expenses (hubs/{hub}/expenses/{yyyy-MM}) ----------

export interface ExpenseMonth {
  packaging: number;
  logistics: number;
  payroll: number;
  utilities: number;
  marketing: number;
}
export const NO_EXPENSES: ExpenseMonth = { packaging: 0, logistics: 0, payroll: 0, utilities: 0, marketing: 0 };

export async function loadExpenses(hubId: HubId, months: string[]): Promise<ExpenseMonth> {
  const docs = await Promise.all(months.map((m) => getDoc(hubDoc(hubId, 'expenses', m))));
  return docs.reduce<ExpenseMonth>((acc, d) => {
    const e = { ...NO_EXPENSES, ...(d.data() as Partial<ExpenseMonth> | undefined) };
    return {
      packaging: acc.packaging + e.packaging, logistics: acc.logistics + e.logistics, payroll: acc.payroll + e.payroll,
      utilities: acc.utilities + e.utilities, marketing: acc.marketing + e.marketing,
    };
  }, { ...NO_EXPENSES });
}

export async function saveExpense(hubId: HubId, month: string, field: keyof ExpenseMonth, paise: number): Promise<void> {
  await setDoc(hubDoc(hubId, 'expenses', month), { [field]: paise, month, updatedAt: serverTimestamp() }, { merge: true });
  await logAudit({ hubId, category: 'Financials & Refunds', action: `Set ${field} for ${month}: ₹${(paise / 100).toFixed(2)}`, target: `hubs/${hubId}/expenses/${month}` });
}

// ---------- counter (walk-in) sales ----------

export interface CounterSaleItem { productId: string; name: string; unit: string; price: number; qty: number }

export async function createCounterSale(hubId: HubId, items: CounterSaleItem[], paymentMode: 'cash' | 'upi', customerPhone: string): Promise<string> {
  const total = items.reduce((n, i) => n + i.price * i.qty, 0);
  const ref = await addDoc(collection(db, 'hubs', hubId, 'counterSales'), {
    date: todayKey(), items, total, paymentMode, customerPhone: customerPhone.trim(),
    soldByUid: auth.currentUser?.uid ?? null, createdAt: serverTimestamp(),
  });
  return ref.id;
}
