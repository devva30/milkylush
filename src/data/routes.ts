// Routes of one hub (hubs/{hubId}/routes/{HSR-RT-01}). One route per rider; the
// stops array order IS the drop sequence. "Generate deliveries" copies riderUid
// and stopSeq from here onto each day's deliveries.

import {
  doc, getDocs, orderBy, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '../firebase';
import { hubCol, hubDoc, type HubId } from './hubs';
import { withNextId } from './ids';
import { useLiveQuery } from './useFirestore';
import { todayKey } from './dates';
import { logAudit } from '../utils/auditLogger';

export interface RouteStop {
  customerUid: string;
  customerId: string; // HSR-CUS-00001
  name: string;
  phone: string;
  address: string; // display copy; deliveries copy the real address doc
  addressId: string;
}

export interface RouteDoc {
  name: string;
  riderUid: string;
  riderName: string;
  substitute: { riderUid: string; riderName: string; date: string } | null;
  stops: RouteStop[];
}

export function useHubRoutes(hubId: HubId) {
  return useLiveQuery<RouteDoc>(query(hubCol(hubId, 'routes'), orderBy('name')), [hubId]);
}

/** The rider's route, created (HSR-RT-##) if the rider has none yet. Returns its id. */
export async function ensureRiderRoute(hubId: HubId, rider: { uid: string; name: string }): Promise<string> {
  const existing = await getDocs(query(hubCol(hubId, 'routes'), where('riderUid', '==', rider.uid)));
  if (!existing.empty) return existing.docs[0].id;
  return withNextId(hubId, 'route', (tx, id) =>
    tx.set(hubDoc(hubId, 'routes', id), {
      name: `${id} · ${rider.name}`,
      riderUid: rider.uid,
      riderName: rider.name,
      substitute: null,
      stops: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } satisfies RouteDoc & Record<string, unknown>));
}

/**
 * Moves a customer onto `rider`'s route (appended as the last stop), removing them
 * from any other route, and records users/{uid}.routeId. rider = null unassigns.
 */
export async function assignCustomerToRider(
  hubId: HubId, stop: RouteStop, rider: { uid: string; name: string } | null,
): Promise<void> {
  const targetId = rider ? await ensureRiderRoute(hubId, rider) : null;
  const all = await getDocs(hubCol(hubId, 'routes'));
  await runTransaction(db, async (tx) => {
    const refs: DocumentReference[] = all.docs.map((d) => d.ref);
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    for (const snap of snaps) {
      const route = snap.data() as RouteDoc | undefined;
      if (!route) continue;
      const without = route.stops.filter((s) => s.customerUid !== stop.customerUid);
      const stops = snap.id === targetId ? [...without, stop] : without;
      if (stops.length !== route.stops.length || snap.id === targetId) {
        tx.update(snap.ref, { stops, updatedAt: serverTimestamp() });
      }
    }
    tx.update(doc(db, 'users', stop.customerUid), { routeId: targetId, updatedAt: serverTimestamp() });
  });
  await logAudit({
    hubId, category: 'Hub Operations',
    action: rider ? `Assigned ${stop.customerId || stop.name} to ${rider.name} (${targetId})` : `Unassigned ${stop.customerId || stop.name} from route`,
    target: `users/${stop.customerUid}`,
  });
}

/** Saves a new stop order for a route (one write). */
export async function saveStopOrder(hubId: HubId, routeId: string, stops: RouteStop[]): Promise<void> {
  await updateDoc(hubDoc(hubId, 'routes', routeId), { stops, updatedAt: serverTimestamp() });
  await logAudit({ hubId, category: 'Hub Operations', action: `Re-ordered ${stops.length} stops on ${routeId}`, target: `hubs/${hubId}/routes/${routeId}` });
}

/**
 * Absent rider: every route of `absent` is covered by `sub` on `date` (default
 * today). Deliveries for that date that are already generated and still pending
 * move to the substitute immediately; later generation uses the substitute too.
 */
export async function setSubstitute(
  hubId: HubId, absent: { uid: string; name: string }, sub: { uid: string; name: string }, date = todayKey(),
): Promise<number> {
  const routes = await getDocs(query(hubCol(hubId, 'routes'), where('riderUid', '==', absent.uid)));
  const pending = await getDocs(query(hubCol(hubId, 'deliveries'), where('date', '==', date), where('riderUid', '==', absent.uid)));
  const batch = writeBatch(db);
  routes.docs.forEach((r) => batch.update(r.ref, { substitute: { riderUid: sub.uid, riderName: sub.name, date }, updatedAt: serverTimestamp() }));
  let moved = 0;
  pending.docs.forEach((d) => {
    if (['scheduled', 'out_for_delivery'].includes(d.data().status)) {
      batch.update(d.ref, { riderUid: sub.uid, riderName: sub.name, coveringFor: absent.uid, updatedAt: serverTimestamp() });
      moved++;
    }
  });
  await batch.commit();
  await logAudit({ hubId, category: 'Hub Operations', action: `${sub.name} covers ${absent.name} on ${date} (${moved} drops moved)`, target: `hubs/${hubId}/routes` });
  return moved;
}

/** Ends a substitution: routes go back to their own rider; still-pending drops move back. */
export async function clearSubstitute(hubId: HubId, absentUid: string, date = todayKey()): Promise<number> {
  const routes = await getDocs(query(hubCol(hubId, 'routes'), where('riderUid', '==', absentUid)));
  const moved = await getDocs(query(hubCol(hubId, 'deliveries'), where('date', '==', date), where('coveringFor', '==', absentUid)));
  const batch = writeBatch(db);
  routes.docs.forEach((r) => batch.update(r.ref, { substitute: null, updatedAt: serverTimestamp() }));
  const riderName = (routes.docs[0]?.data() as RouteDoc | undefined)?.riderName ?? '';
  let back = 0;
  moved.docs.forEach((d) => {
    if (d.data().status === 'scheduled') {
      batch.update(d.ref, { riderUid: absentUid, riderName, coveringFor: null, updatedAt: serverTimestamp() });
      back++;
    }
  });
  await batch.commit();
  await logAudit({ hubId, category: 'Hub Operations', action: `Ended substitution for ${absentUid} on ${date}`, target: `hubs/${hubId}/routes` });
  return back;
}
