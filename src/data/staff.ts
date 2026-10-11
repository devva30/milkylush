// Riders and admins live in staff/{uid} (uid = Firebase Auth uid). Riders get a
// readable staffCode (HSR-RDR-001) from the hub counter. Passwords are never stored
// in Firestore — only Firebase Auth holds them.

import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  doc, query, collection, where, serverTimestamp, updateDoc, setDoc, type Timestamp,
} from 'firebase/firestore';
import { db, secondaryAuth } from '../firebase';
import type { DeliveryAgent } from '../types';
import type { HubId } from './hubs';
import { withNextId } from './ids';
import { useLiveQuery } from './useFirestore';
import { formatDateTime } from './dates';
import { logAudit } from '../utils/auditLogger';

export interface StaffDoc {
  name: string;
  email: string;
  phone: string;
  role: 'super_admin' | 'hub_admin' | 'rider';
  hubIds: HubId[];
  active: boolean;
  staffCode?: string;
  address?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  licenseNumber?: string;
  licenseValidity?: string;
  badgeLevel?: string;
  recognitionTag?: string;
  onDuty?: boolean;
  /** Written by the rider app while on duty (GeoPoint). */
  lastLocation?: { latitude: number; longitude: number } | null;
  createdAt?: Timestamp;
}

/** DeliveryAgent is the shape the existing rider screens render. */
export type RiderRow = DeliveryAgent & {
  staffCode?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  licenseNumber?: string;
  licenseValidity?: string;
  badgeLevel?: string;
  recognitionTag?: string;
  inactiveReason?: string;
  latitude?: number;
  longitude?: number;
};

export function riderToRow(uid: string, d: StaffDoc): RiderRow {
  const vehicle = [d.vehicleNumber, d.vehicleType].filter(Boolean).join(' • ');
  return {
    id: uid,
    name: d.name,
    phone: d.phone ?? '',
    email: d.email,
    address: d.address ?? '',
    vehicle: vehicle || undefined,
    hubId: d.hubIds?.[0],
    assignedHubId: d.hubIds?.[0],
    isOnline: !!d.onDuty,
    isActive: !!d.active,
    createdAt: d.createdAt ? formatDateTime(d.createdAt) : undefined,
    staffCode: d.staffCode,
    vehicleNumber: d.vehicleNumber,
    vehicleType: d.vehicleType,
    licenseNumber: d.licenseNumber,
    licenseValidity: d.licenseValidity,
    badgeLevel: d.badgeLevel,
    recognitionTag: d.recognitionTag,
    inactiveReason: (d as StaffDoc & { inactiveReason?: string }).inactiveReason,
    latitude: d.lastLocation?.latitude,
    longitude: d.lastLocation?.longitude,
  };
}

/** Live riders of one hub (active and inactive). */
export function useHubRiders(hubId: HubId) {
  const res = useLiveQuery<StaffDoc>(
    query(collection(db, 'staff'), where('hubIds', 'array-contains', hubId), where('role', '==', 'rider')),
    [hubId],
  );
  const data = res.data
    .map((d) => riderToRow(d.id, d))
    .sort((a, b) => (a.staffCode ?? '').localeCompare(b.staffCode ?? ''));
  return { ...res, data };
}

export interface NewRiderForm {
  name: string;
  phone: string;
  email: string;
  password: string;
  address?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  licenseNumber?: string;
  licenseValidity?: string;
  badgeLevel?: string;
  recognitionTag?: string;
}

function authMessage(code?: string): string {
  switch (code) {
    case 'auth/email-already-in-use': return 'That email already has a login. Use a different email for this rider.';
    case 'auth/invalid-email': return 'That email address is not valid.';
    case 'auth/weak-password': return 'Password is too weak.';
    case 'auth/network-request-failed': return 'No internet connection.';
    default: return 'Could not create the rider login.';
  }
}

/**
 * Creates the rider's Firebase login (through a secondary auth instance, so the
 * admin stays signed in) and staff/{uid} with the next HSR-RDR-### code.
 * Nothing is saved if the login can't be created.
 */
export async function createRider(hubId: HubId, form: NewRiderForm): Promise<{ uid: string; staffCode: string }> {
  const name = form.name.trim();
  const email = form.email.trim().toLowerCase();
  const phone = form.phone.replace(/[^\d+]/g, '');
  if (!name || !email || !phone) throw new Error('Name, phone and email are required.');
  if ((form.password ?? '').length < 6) throw new Error('Set a password of at least 6 characters for the rider.');

  const activeHubId: HubId = hubId === 'bengaluru' || (typeof hubId === 'string' && hubId.toLowerCase().includes('bengaluru')) ? 'bengaluru' : 'hosur';

  let uid: string;
  try {
    uid = (await createUserWithEmailAndPassword(secondaryAuth, email, form.password)).user.uid;
  } catch (err) {
    throw new Error(authMessage((err as { code?: string }).code));
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
  }

  const data: StaffDoc = {
    name, email, phone,
    role: 'rider',
    hubIds: [activeHubId],
    active: true,
    address: form.address?.trim() ?? '',
    vehicleNumber: form.vehicleNumber?.trim().toUpperCase() ?? '',
    vehicleType: form.vehicleType?.trim() ?? '',
    licenseNumber: form.licenseNumber?.trim().toUpperCase() ?? '',
    licenseValidity: form.licenseValidity?.trim() ?? '',
    badgeLevel: form.badgeLevel?.trim() ?? '',
    recognitionTag: form.recognitionTag?.trim() ?? '',
    onDuty: false,
  };
  let staffCode: string;
  try {
    staffCode = await withNextId(activeHubId, 'rider', (tx, code) =>
      tx.set(doc(db, 'staff', uid), { ...data, staffCode: code, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  } catch (err) {
    // The login exists but the profile didn't save; re-running with the same email
    // would hit "already in use", so say exactly what happened.
    throw new Error(`Login ${email} was created but the rider profile could not be saved (${(err as Error).message}). Contact the super admin to finish setup.`);
  }
  await logAudit({ hubId: activeHubId, category: 'User Roles', action: `Registered rider ${staffCode} ${name}`, target: `staff/${uid}` });
  return { uid, staffCode };
}

/** Editable rider fields (never role, hubs or code from here). */
export async function updateRider(
  hubId: HubId, uid: string,
  patch: Partial<Pick<StaffDoc, 'name' | 'phone' | 'address' | 'vehicleNumber' | 'vehicleType' | 'licenseNumber' | 'licenseValidity' | 'badgeLevel' | 'recognitionTag'>>,
): Promise<void> {
  await updateDoc(doc(db, 'staff', uid), { ...patch, updatedAt: serverTimestamp() });
  await logAudit({ hubId, category: 'User Roles', action: `Updated rider ${uid}`, target: `staff/${uid}`, after: patch });
}

/**
 * Deactivating removes all access immediately (rules check staff.active). Riders
 * are never hard-deleted, so past deliveries keep pointing at a real person.
 */
export async function setRiderActive(hubId: HubId, uid: string, active: boolean, reason = ''): Promise<void> {
  await updateDoc(doc(db, 'staff', uid), { active, inactiveReason: active ? '' : reason, onDuty: false, updatedAt: serverTimestamp() });
  await logAudit({ hubId, category: 'User Roles', action: `${active ? 'Re-activated' : 'Deactivated'} rider ${uid}`, target: `staff/${uid}` });
}

// ---- Admin accounts (Admin Access page) ----

export type AdminRole = 'super_admin' | 'hub_admin';
export interface AdminDoc extends StaffDoc {
  /** Display title, e.g. "Hosur Hub Manager", "Billing & Finance Admin". */
  title?: string;
  /** Screens this admin may use (shown/enforced in the admin site; rules use role + hubs). */
  permissions?: string[];
}

/** Admins who can see this hub (super admins included), live. */
export function useHubAdmins(hubId: HubId) {
  return useLiveQuery<AdminDoc>(
    query(collection(db, 'staff'), where('hubIds', 'array-contains', hubId), where('role', 'in', ['super_admin', 'hub_admin'])),
    [hubId]);
}

export interface NewAdminForm {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
  title: string;
  hubIds: HubId[];
  permissions: string[];
}

/** Super admin only (rules). Creates the login via the secondary app, then staff/{uid}. */
export async function createAdmin(form: NewAdminForm): Promise<string> {
  const name = form.name.trim();
  const email = form.email.trim().toLowerCase();
  if (!name || !email) throw new Error('Name and email are required.');
  if ((form.password ?? '').length < 8) throw new Error('Set a password of at least 8 characters.');
  if (!form.hubIds.length) throw new Error('Choose at least one hub.');
  let uid: string;
  try {
    uid = (await createUserWithEmailAndPassword(secondaryAuth, email, form.password)).user.uid;
  } catch (err) {
    throw new Error(authMessage((err as { code?: string }).code).replace('rider', 'admin'));
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
  }
  try {
    await setDoc(doc(db, 'staff', uid), {
      name, email, phone: '', role: form.role, title: form.title, hubIds: form.hubIds, permissions: form.permissions,
      active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw new Error(`Login ${email} was created but the admin profile could not be saved (${(err as Error).message}). Only a super admin can add admins.`);
  }
  await logAudit({ category: 'User Roles', action: `Added admin ${email} (${form.title})`, target: `staff/${uid}` });
  return uid;
}

export async function updateAdmin(uid: string, patch: Partial<Pick<AdminDoc, 'role' | 'title' | 'hubIds' | 'permissions' | 'active'>>): Promise<void> {
  await updateDoc(doc(db, 'staff', uid), { ...patch, updatedAt: serverTimestamp() });
  await logAudit({ category: 'User Roles', action: `Updated admin ${uid}`, target: `staff/${uid}`, after: patch as Record<string, unknown> });
}
