// Hub ids, codes and paths. Must match db-tools/seed.mjs and firestore.rules → hubCode().

import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase';

export type HubId = 'hosur' | 'bengaluru';

export const HUB_IDS: HubId[] = ['hosur', 'bengaluru'];

export const HUB_CODES: Record<HubId, string> = {
  hosur: 'HSR',
  bengaluru: 'BLR',
};

export const HUB_NAMES: Record<HubId, string> = {
  hosur: 'Hosur',
  bengaluru: 'Bengaluru',
};

export function isHubId(value: unknown): value is HubId {
  return value === 'hosur' || value === 'bengaluru';
}

/** Reference to a collection under a hub, e.g. hubCol('hosur', 'orders'). */
export function hubCol(hubId: string, name: string) {
  return collection(db, 'hubs', hubId, name);
}

/** Reference to a document under a hub, e.g. hubDoc('hosur', 'settings', 'payment'). */
export function hubDoc(hubId: string, col: string, id: string) {
  return doc(db, 'hubs', hubId, col, id);
}
