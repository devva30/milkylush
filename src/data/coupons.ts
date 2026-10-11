// Coupons of one hub (hubs/{hubId}/coupons/{CODE}) and their redemptions
// (…/coupons/{CODE}/redemptions/{id}, written by the customer app).

import {
  collectionGroup, deleteDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp,
  Timestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { hubCol, hubDoc, type HubId } from './hubs';
import { addDays, formatDateTime, istDayEnd, todayKey, toDate } from './dates';
import { useLiveQuery } from './useFirestore';
import { logAudit } from '../utils/auditLogger';

export interface CouponDoc {
  discountType: 'flat' | 'percent';
  discountValue: number; // paise for flat, whole percent for percent
  maxDiscount: number | null; // paise cap for percent coupons
  minOrderValue: number; // paise
  perUserLimit: number;
  totalLimit: number;
  usedCount: number; // +1 by the customer app with each redemption
  purchaseType: 'all' | 'onetime' | 'subscription';
  productId: string | null;
  productName: string | null;
  firstOrderOnly: boolean;
  active: boolean;
  startsAt: Timestamp;
  expiresAt: Timestamp | null;
}

/** Row shape the Promo Codes page already renders (rupees, display strings). */
export interface CouponRow {
  id: string;
  code: string;
  discountType: 'flat' | 'percentage';
  discountValue: number;
  discountOffer: string;
  minCart: number;
  validityDays?: number;
  expiryDate?: string;
  purchaseType: 'all' | 'onetime' | 'subscription';
  targetProductId?: string;
  targetProductName?: string;
  maxUsageLimit: number;
  perUserLimit: number;
  targetHub: string;
  uses: number;
  status: 'active' | 'paused';
  createdAt?: string;
}

const HUB_LABEL: Record<HubId, string> = { hosur: 'Hosur Hub 📍', bengaluru: 'Bangalore Hub 📍' };

function toRow(id: string, hubId: HubId, c: CouponDoc & { createdAt?: Timestamp }): CouponRow {
  const value = c.discountType === 'flat' ? c.discountValue / 100 : c.discountValue;
  const expires = toDate(c.expiresAt);
  return {
    id,
    code: id,
    discountType: c.discountType === 'flat' ? 'flat' : 'percentage',
    discountValue: value,
    discountOffer: c.discountType === 'flat' ? `₹${value} OFF` : `${value}% OFF`,
    minCart: (c.minOrderValue ?? 0) / 100,
    expiryDate: expires ? formatDateTime(expires) : undefined,
    purchaseType: c.purchaseType ?? 'all',
    targetProductId: c.productId ?? undefined,
    targetProductName: c.productName ?? undefined,
    maxUsageLimit: c.totalLimit,
    perUserLimit: c.perUserLimit,
    targetHub: HUB_LABEL[hubId],
    uses: c.usedCount ?? 0,
    status: c.active ? 'active' : 'paused',
    createdAt: c.createdAt ? formatDateTime(c.createdAt) : undefined,
  };
}

export function useHubCoupons(hubId: HubId) {
  const res = useLiveQuery<CouponDoc & { createdAt?: Timestamp }>(
    query(hubCol(hubId, 'coupons'), orderBy('createdAt', 'desc')), [hubId]);
  return { ...res, data: res.data.map((c) => toRow(c.id, hubId, c)) };
}

/** Normalised code: letters/digits only, upper-case, 3–20 chars. */
export function cleanCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Creates a coupon. Fails if the code already exists in this hub (never overwrites usage). */
export async function createCoupon(hubId: HubId, input: {
  code: string;
  discountType: 'flat' | 'percentage';
  value: number; // rupees or percent
  minCart: number; // rupees
  validityDays?: number;
  purchaseType: 'all' | 'onetime' | 'subscription';
  productId?: string;
  productName?: string;
  totalLimit: number;
  perUserLimit: number;
}): Promise<string> {
  const code = cleanCode(input.code);
  if (code.length < 3 || code.length > 20) throw new Error('Code must be 3–20 letters or digits.');
  if (!(input.value > 0)) throw new Error('Discount must be more than 0.');
  if (input.discountType === 'percentage' && input.value > 100) throw new Error('Percentage cannot be above 100.');

  const ref = hubDoc(hubId, 'coupons', code);
  const days = input.validityDays && input.validityDays > 0 ? Math.floor(input.validityDays) : null;
  const data: CouponDoc = {
    discountType: input.discountType === 'flat' ? 'flat' : 'percent',
    discountValue: input.discountType === 'flat' ? Math.round(input.value * 100) : Math.round(input.value),
    maxDiscount: null,
    minOrderValue: Math.round((input.minCart || 0) * 100),
    perUserLimit: Math.max(1, Math.floor(input.perUserLimit || 1)),
    totalLimit: Math.max(1, Math.floor(input.totalLimit || 1)),
    usedCount: 0,
    purchaseType: input.purchaseType,
    productId: input.productId ?? null,
    productName: input.productName ?? null,
    firstOrderOnly: false,
    active: true,
    startsAt: Timestamp.now(),
    // valid through the end of the last IST day
    expiresAt: days ? Timestamp.fromDate(istDayEnd(addDays(todayKey(), days))) : null,
  };
  await runTransaction(db, async (tx) => {
    if ((await tx.get(ref)).exists()) throw new Error(`Code ${code} already exists in this hub.`);
    tx.set(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  await logAudit({ hubId, category: 'Financials & Refunds', action: `Created coupon ${code}`, target: ref.path, after: { ...data, startsAt: null, expiresAt: days } });
  return code;
}

export async function setCouponActive(hubId: HubId, code: string, active: boolean): Promise<void> {
  await updateDoc(hubDoc(hubId, 'coupons', code), { active, updatedAt: serverTimestamp() });
  await logAudit({ hubId, category: 'Financials & Refunds', action: `${active ? 'Resumed' : 'Paused'} coupon ${code}`, target: `hubs/${hubId}/coupons/${code}` });
}

export async function deleteCoupon(hubId: HubId, code: string): Promise<void> {
  await deleteDoc(hubDoc(hubId, 'coupons', code));
  await logAudit({ hubId, category: 'Financials & Refunds', action: `Deleted coupon ${code}`, target: `hubs/${hubId}/coupons/${code}` });
}

export interface RedemptionRow {
  id: string;
  customerName: string;
  contact: string;
  appliedCode: string;
  discountSaved: number;
  hub: string;
  dateTime: string;
}

/** Latest 50 redemptions of this hub across all its coupons. */
export async function loadRedemptions(hubId: HubId): Promise<RedemptionRow[]> {
  const snap = await getDocs(query(
    collectionGroup(db, 'redemptions'), where('hubId', '==', hubId), orderBy('createdAt', 'desc'), limit(50)));
  return snap.docs.map((d) => {
    const r = d.data();
    const phone: string = r.customerPhone ?? '';
    return {
      id: d.id,
      customerName: r.customerName || r.customerId || 'Customer',
      contact: phone.length >= 10 ? `${phone.slice(0, 3)}*** ***${phone.slice(-2)}` : phone,
      appliedCode: r.code ?? d.ref.parent.parent?.id ?? '',
      discountSaved: (r.discount ?? 0) / 100,
      hub: HUB_LABEL[hubId],
      dateTime: formatDateTime(r.createdAt),
    };
  });
}
