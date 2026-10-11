// Customers of one hub (users where hubId == hub). Lists are paginated: a hub with
// thousands of customers must never be loaded in one go.

import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from '../types';
import { hubCol, type HubId } from './hubs';
import { useLiveQuery, usePagedQuery, type WithId } from './useFirestore';
import { addDays, formatDateTime, todayKey } from './dates';
import { subToUi, type SubscriptionDoc } from './subscriptions';
import { deliveryToOrder, type DeliveryDoc } from './deliveries';
import { logAudit } from '../utils/auditLogger';

export interface CustomerDoc {
  customerId?: string; // HSR-CUS-00001
  name: string;
  phone: string;
  email?: string;
  hubId: HubId;
  defaultAddressId?: string;
  defaultAddressText?: string; // one-line copy of the default address, for admin lists
  defaultAddressLocation?: unknown; // GeoPoint of the default address (exact pin, for map links)
  routeId?: string | null;
  bottlesAtHome?: number;
  bottlesReturned?: number;
  blocked?: boolean;
  createdAt?: Timestamp;
}

export type Customer = WithId<CustomerDoc>;

const usersCol = () => collection(db, 'users');

/** Newest customers of the hub, 50 per page. */
export function useHubCustomers(hubId: HubId, pageSize = 50) {
  return usePagedQuery<CustomerDoc>(
    query(usersCol(), where('hubId', '==', hubId), orderBy('createdAt', 'desc')), [hubId], pageSize);
}

/**
 * Server-side search: exact phone (last 10 digits) or exact customer ID. Name
 * search is done on the rows already loaded, because Firestore can't do
 * "contains" queries.
 */
export async function findCustomers(hubId: HubId, text: string): Promise<Customer[]> {
  const raw = text.trim();
  const digits = raw.replace(/\D/g, '');
  let q;
  if (/^[A-Z]{3}-CUS-\d+$/i.test(raw)) {
    q = query(usersCol(), where('hubId', '==', hubId), where('customerId', '==', raw.toUpperCase()), limit(5));
  } else if (digits.length >= 10) {
    q = query(usersCol(), where('hubId', '==', hubId), where('phone', 'in', [digits.slice(-10), `+91${digits.slice(-10)}`]), limit(5));
  } else {
    return [];
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as CustomerDoc) }));
}

/** True when `text` should trigger findCustomers() instead of a local name filter. */
export function isServerSearch(text: string): boolean {
  const raw = text.trim();
  return /^[A-Z]{3}-CUS-\d+$/i.test(raw) || raw.replace(/\D/g, '').length >= 10;
}

// ---------- single-customer views & admin edits ----------


/** Summary counters the customer app keeps on users/{uid} so lists need no extra reads. */
export interface CustomerSummary {
  activeSubscriptionCount?: number;
  pausedSubscriptionCount?: number;
  orderCount?: number;
  freeSampleClaimed?: boolean;
}

export type CustomerRow = User & {
  customerId?: string;
  status: 'active' | 'inactive' | 'vacation' | 'skipped';
  customerType: 'subscription' | 'onetime' | 'both' | 'new';
  hasClaimedFreeSample: boolean;
};

export function customerToRow(c: Customer & CustomerSummary): CustomerRow {
  const subs = c.activeSubscriptionCount ?? 0;
  const paused = c.pausedSubscriptionCount ?? 0;
  const orders = c.orderCount ?? 0;
  const hasSub = subs + paused > 0;
  const customerType = hasSub && orders > 0 ? 'both' : hasSub ? 'subscription' : orders > 0 ? 'onetime' : 'new';
  const status = hasSub ? (subs === 0 ? 'vacation' : 'active') : orders > 0 ? 'active' : 'inactive';
  return {
    id: c.id,
    name: c.name ?? '',
    phone: c.phone ?? '',
    email: c.email,
    address: withGps(c.defaultAddressText ?? '', c.defaultAddressLocation),
    savedAddresses: c.defaultAddressText ? [withGps(c.defaultAddressText, c.defaultAddressLocation)] : [],
    activeAddressIndex: 0,
    hubId: c.hubId,
    bottlesAtHome: c.bottlesAtHome ?? 0,
    emptyBottlesReturned: c.bottlesReturned ?? 0,
    createdAt: c.createdAt ? formatDateTime(c.createdAt) : undefined,
    customerId: c.customerId,
    status,
    customerType,
    hasClaimedFreeSample: !!c.freeSampleClaimed,
  } as unknown as CustomerRow;
}

export interface AddressDoc {
  label: 'Home' | 'Work' | 'Hotel' | 'Other';
  line1: string;
  line2: string;
  landmark: string;
  area: string;
  city: string;
  pincode: string;
  receiverName: string;
  receiverPhone: string;
  hubId: HubId;
  location: unknown | null;
  doorNotes: string;
}

/** Exact pin of an address ({latitude, longitude} GeoPoint) as "lat, lng", or ''. */
export function gpsOf(location: unknown): string {
  const g = location as { latitude?: number; longitude?: number } | null | undefined;
  if (!g || typeof g.latitude !== 'number' || typeof g.longitude !== 'number') return '';
  return `${g.latitude.toFixed(6)}, ${g.longitude.toFixed(6)}`;
}

/** Address text + the customer's GPS pin, so map links open the exact spot
 *  (utils/addressFormatter reads "[GPS: (lat, lng)]" and hides it from the text). */
export function withGps(text: string, location: unknown): string {
  const g = gpsOf(location);
  return g ? `${text} [GPS: (${g})]` : text;
}

/** Labelled one-line address ("Door No: 12A, Street: …, Area: …, City: …, PIN: …"), same as the apps. */
export function addressText(a: Partial<AddressDoc> & { houseNo?: string; building?: string; floor?: string; street?: string }): string {
  const t = (v?: string) => (v ?? '').trim();
  const hasParts = !!(t(a.houseNo) || t(a.street) || t(a.building));
  return [
    hasParts && t(a.houseNo) ? `Door No: ${t(a.houseNo)}` : '',
    hasParts && t(a.building) ? `Building: ${t(a.building)}` : '',
    hasParts && t(a.floor) ? `Floor: ${t(a.floor)}` : '',
    hasParts && t(a.street) ? `Street: ${t(a.street)}` : '',
    !hasParts ? t(a.line1) : '',
    !hasParts ? t(a.line2) : '',
    t(a.area) ? `Area: ${t(a.area)}` : '',
    t(a.landmark) ? `Landmark: ${t(a.landmark)}` : '',
    t(a.city) ? `City: ${t(a.city)}` : '',
    t(a.pincode) ? `PIN: ${t(a.pincode)}` : '',
  ].filter(Boolean).join(', ');
}

/** Live addresses of one customer (null uid = nothing). */
export function useCustomerAddresses(uid: string | null) {
  return useLiveQuery<AddressDoc>(uid ? collection(db, 'users', uid, 'addresses') : null, [uid]);
}

/** That customer's subscriptions in this hub. */
export function useCustomerSubscriptions(hubId: HubId, uid: string | null) {
  const res = useLiveQuery<SubscriptionDoc>(
    uid ? query(hubCol(hubId, 'subscriptions'), where('customerUid', '==', uid), orderBy('createdAt', 'desc')) : null,
    [hubId, uid]);
  return { ...res, ui: res.data.map((d) => subToUi(d.id, d)) };
}

/** That customer's deliveries for the last 60 days and upcoming week, newest first. */
export function useCustomerDeliveries(hubId: HubId, uid: string | null) {
  const res = useLiveQuery<DeliveryDoc>(
    uid ? query(hubCol(hubId, 'deliveries'), where('customerUid', '==', uid),
      where('date', '>=', addDays(todayKey(), -60)), orderBy('date', 'desc'), limit(100)) : null,
    [hubId, uid]);
  return { ...res, ui: res.data.map(deliveryToOrder) };
}

/** Admin adds an address for a customer (support calls); becomes default if they have none. */
export async function addCustomerAddress(hubId: HubId, uid: string, a: Omit<AddressDoc, 'hubId' | 'location' | 'doorNotes'>): Promise<void> {
  const data: AddressDoc = { ...a, hubId, location: null, doorNotes: '' };
  const ref = await addDoc(collection(db, 'users', uid, 'addresses'), { ...data, createdAt: serverTimestamp(), addedByAdmin: true });
  const user = await getDoc(doc(db, 'users', uid));
  if (!user.data()?.defaultAddressId) {
    await updateDoc(doc(db, 'users', uid), { defaultAddressId: ref.id, defaultAddressText: addressText(data), updatedAt: serverTimestamp() });
  }
  await logAudit({ hubId, category: 'User Roles', action: `Added address for customer ${uid}`, target: ref.path });
}

export async function deleteCustomerAddress(hubId: HubId, uid: string, addressId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'addresses', addressId));
  const user = await getDoc(doc(db, 'users', uid));
  if (user.data()?.defaultAddressId === addressId) {
    await updateDoc(doc(db, 'users', uid), { defaultAddressId: null, defaultAddressText: '', defaultAddressLocation: null, updatedAt: serverTimestamp() });
  }
  await logAudit({ hubId, category: 'User Roles', action: `Removed address ${addressId} of customer ${uid}`, target: `users/${uid}/addresses/${addressId}` });
}

