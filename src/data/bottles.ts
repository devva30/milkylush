// Glass bottles: each customer doc carries the running counts (bottlesAtHome,
// bottlesReturned, bottlesDamaged, lastBottleCollectedDate). Riders update them on
// delivery; admins record returns or correct counts here. Totals use sum()
// aggregations, so the page never loads every customer.

import {
  doc, getAggregateFromServer, orderBy, query, runTransaction, serverTimestamp, sum, updateDoc, where,
  collection, type Query,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { hubCol, type HubId } from './hubs';
import { todayKey } from './dates';
import { usePagedQuery } from './useFirestore';
import type { CustomerDoc } from './customers';
import { logAudit } from '../utils/auditLogger';

export type BottleFilter = 'all' | 'pending' | 'today' | 'overdue';

export interface BottleCounts {
  bottlesAtHome?: number;
  bottlesReturned?: number;
  bottlesDamaged?: number;
  lastBottleCollectedDate?: string;
}

/** Customers of the hub for the chosen filter, 50 per page. */
export function useBottleCustomers(hubId: HubId, filter: BottleFilter) {
  const users = collection(db, 'users');
  let q: Query;
  if (filter === 'pending' || filter === 'overdue') {
    q = query(users, where('hubId', '==', hubId), where('bottlesAtHome', '>', 0), orderBy('bottlesAtHome', 'desc'));
  } else if (filter === 'today') {
    q = query(users, where('hubId', '==', hubId), where('lastBottleCollectedDate', '==', todayKey()));
  } else {
    q = query(users, where('hubId', '==', hubId), orderBy('createdAt', 'desc'));
  }
  return usePagedQuery<CustomerDoc & BottleCounts>(q, [hubId, filter]);
}

export interface BottleTotals { atHome: number; returned: number; damaged: number; collectedToday: number }

/** Hub-wide totals (a few aggregation reads, not one read per customer). */
export function useBottleTotals(hubId: HubId, refreshKey = 0) {
  const [totals, setTotals] = useState<BottleTotals | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await getAggregateFromServer(query(collection(db, 'users'), where('hubId', '==', hubId)), {
          atHome: sum('bottlesAtHome'), returned: sum('bottlesReturned'), damaged: sum('bottlesDamaged'),
        });
        const d = await getAggregateFromServer(query(hubCol(hubId, 'deliveries'), where('date', '==', todayKey())), {
          collected: sum('bottlesCollected'),
        });
        if (alive) setTotals({
          atHome: u.data().atHome ?? 0, returned: u.data().returned ?? 0, damaged: u.data().damaged ?? 0,
          collectedToday: d.data().collected ?? 0,
        });
      } catch (err) {
        console.warn('Bottle totals:', err);
        if (alive) setTotals({ atHome: 0, returned: 0, damaged: 0, collectedToday: 0 });
      }
    })();
    return () => { alive = false; };
  }, [hubId, refreshKey]);
  return totals;
}

/** Admin records bottles handed back (e.g. at the hub or a missed pickup). */
export async function recordBottleReturn(hubId: HubId, uid: string, name: string, qty: number, damaged: number, remarks: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'users', uid);
    const c = ((await tx.get(ref)).data() ?? {}) as BottleCounts;
    tx.update(ref, {
      bottlesAtHome: Math.max(0, (c.bottlesAtHome ?? 0) - qty - damaged),
      bottlesReturned: (c.bottlesReturned ?? 0) + qty,
      bottlesDamaged: (c.bottlesDamaged ?? 0) + damaged,
      lastBottleCollectedDate: todayKey(),
      updatedAt: serverTimestamp(),
    });
  });
  await logAudit({
    hubId, category: 'Hub Operations',
    action: `Recorded ${qty} bottle(s) returned${damaged ? `, ${damaged} damaged` : ''} for ${name}${remarks ? ` (${remarks})` : ''}`,
    target: `users/${uid}`,
  });
}

/** Admin corrects returned / damaged counts; bottles at home = issued − returned − damaged. */
export async function setBottleCounts(hubId: HubId, uid: string, name: string, issued: number, returned: number, damaged: number): Promise<number> {
  const atHome = Math.max(0, issued - returned - damaged);
  await updateDoc(doc(db, 'users', uid), {
    bottlesAtHome: atHome, bottlesReturned: returned, bottlesDamaged: damaged, updatedAt: serverTimestamp(),
  });
  await logAudit({
    hubId, category: 'Hub Operations',
    action: `Corrected bottles for ${name}: returned ${returned}, damaged ${damaged}, at home ${atHome}`,
    target: `users/${uid}`,
  });
  return atHome;
}
