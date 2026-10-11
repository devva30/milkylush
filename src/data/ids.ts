// Readable IDs from the hub counter (DATABASE.md §2.1). The counter update and the
// new document are written in one transaction; firestore.rules reject any ID that
// doesn't match the counter, so numbers are never skipped or reused.

import { runTransaction, type DocumentReference, type Transaction } from 'firebase/firestore';
import { db } from '../firebase';
import { HUB_CODES, hubDoc, type HubId } from './hubs';
import { orderDayCode, todayKey } from './dates';

export type CounterType = 'customer' | 'subscription' | 'product' | 'rider' | 'route' | 'farmer';

const FORMAT: Record<CounterType, { tag: string; digits: number }> = {
  customer: { tag: 'CUS', digits: 5 },
  subscription: { tag: 'SUB', digits: 5 },
  product: { tag: 'PRD', digits: 4 },
  rider: { tag: 'RDR', digits: 3 },
  route: { tag: 'RT', digits: 2 },
  farmer: { tag: 'FRM', digits: 3 },
};

export function formatId(hubId: HubId, type: CounterType, n: number): string {
  const { tag, digits } = FORMAT[type];
  return `${HUB_CODES[hubId]}-${tag}-${String(n).padStart(digits, '0')}`;
}

/**
 * Takes the next number of `type` in `hubId` and lets `write` create the record
 * in the same transaction. Returns the new ID.
 *
 *   const id = await withNextId('hosur', 'product', (tx, id) =>
 *     tx.set(hubDoc('hosur', 'products', id), data));
 */
export async function withNextId(
  hubId: HubId,
  type: CounterType,
  write: (tx: Transaction, id: string) => void,
): Promise<string> {
  const counterRef = hubDoc(hubId, 'counters', 'ids');
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const next = ((snap.data()?.[type] as number) ?? 0) + 1;
    const id = formatId(hubId, type, next);
    tx.update(counterRef, { [type]: next });
    write(tx, id);
    return id;
  });
}

/** Same as withNextId for orders: HSR-ORD-yyMMdd-####, restarting at 1 each IST day. */
export async function withNextOrderId(
  hubId: HubId,
  write: (tx: Transaction, id: string) => void,
): Promise<string> {
  const counterRef: DocumentReference = hubDoc(hubId, 'counters', 'ids');
  return runTransaction(db, async (tx) => {
    const data = (await tx.get(counterRef)).data() ?? {};
    const day = orderDayCode(todayKey());
    const next = data.orderDay === day ? (data.order as number) + 1 : 1;
    const id = `${HUB_CODES[hubId]}-ORD-${day}-${String(next).padStart(4, '0')}`;
    tx.update(counterRef, { order: next, orderDay: day });
    write(tx, id);
    return id;
  });
}
