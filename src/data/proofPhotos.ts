// Delivery proof photos without Cloud Storage (Spark plan has no bucket):
// a compressed JPEG (~30 KB) in hubs/{hubId}/proofPhotos/{deliveryId}, kept 30 days
// (deleted automatically after that; admins can delete any photo earlier).
// Kept out of the delivery doc so delivery lists never download photos.

import {
  deleteDoc, getCountFromServer, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { hubCol, hubDoc, type HubId } from './hubs';
import { addDays, todayKey } from './dates';
import { useLiveDoc } from './useFirestore';

export const PROOF_PHOTO_DAYS = 30;
const MAX_SIDE = 640;
const MAX_BYTES = 60_000; // data-URL length cap, also enforced by firestore.rules

/** Shrinks an image file to a JPEG data URL under MAX_BYTES. */
export async function compressPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const q of [0.6, 0.45, 0.3, 0.2]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length <= MAX_BYTES) return url;
  }
  throw new Error('Photo is too detailed to compress; try another photo.');
}

export async function saveProofPhoto(hubId: HubId, deliveryId: string, date: string, file: File): Promise<void> {
  const dataUrl = await compressPhoto(file);
  await setDoc(hubDoc(hubId, 'proofPhotos', deliveryId), { dataUrl, date, source: 'admin', createdAt: serverTimestamp() });
  await updateDoc(hubDoc(hubId, 'deliveries', deliveryId), { hasProofPhoto: true, updatedAt: serverTimestamp() });
}

/** The photo for one delivery (null if none or already expired). */
export function useProofPhoto(hubId: HubId | null, deliveryId: string | null) {
  return useLiveDoc<{ dataUrl: string; date: string }>(
    hubId && deliveryId ? hubDoc(hubId, 'proofPhotos', deliveryId) : null, [hubId, deliveryId]);
}

/** Deletes photos older than PROOF_PHOTO_DAYS (or dated before [before]). Returns how many were removed.
 *  Marks the deliveries hasProofPhoto = false so no screen offers a photo that is gone. */
export async function purgeOldProofPhotos(hubId: HubId, before?: string): Promise<number> {
  const cutoff = before ?? addDays(todayKey(), -PROOF_PHOTO_DAYS);
  let removed = 0;
  for (;;) {
    const snap = await getDocs(query(hubCol(hubId, 'proofPhotos'), where('date', '<', cutoff), limit(400)));
    if (snap.empty) return removed;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.delete(d.ref);
      batch.set(hubDoc(hubId, 'deliveries', d.id), { hasProofPhoto: false }, { merge: true });
    });
    await batch.commit();
    removed += snap.size;
  }
}

// ---------- Dispatch → Delivery Photos page ----------

export interface ProofPhotoRow {
  id: string; // delivery id {date}_{orderId|subId}
  date: string;
  source: string;
  dataUrl: string;
  sizeKb: number;
}

/** Photos of one day, newest first (the page shows one day at a time to keep reads small). */
export async function loadProofPhotosOfDay(hubId: HubId, date: string): Promise<ProofPhotoRow[]> {
  const snap = await getDocs(query(hubCol(hubId, 'proofPhotos'), where('date', '==', date), limit(300)));
  return snap.docs.map((d: QueryDocumentSnapshot) => {
    const x = d.data() as { dataUrl?: string; date?: string; source?: string };
    return { id: d.id, date: x.date ?? date, source: x.source ?? 'rider', dataUrl: x.dataUrl ?? '', sizeKb: Math.round((x.dataUrl?.length ?? 0) / 1024) };
  });
}

/** How many photos the hub keeps and the oldest date (2 cheap reads). */
export async function proofPhotoStats(hubId: HubId): Promise<{ count: number; oldest: string | null }> {
  const [c, first] = await Promise.all([
    getCountFromServer(hubCol(hubId, 'proofPhotos')),
    getDocs(query(hubCol(hubId, 'proofPhotos'), orderBy('date'), limit(1))),
  ]);
  return { count: c.data().count, oldest: first.empty ? null : (first.docs[0].data().date as string) };
}

export async function deleteProofPhoto(hubId: HubId, deliveryId: string): Promise<void> {
  await deleteDoc(hubDoc(hubId, 'proofPhotos', deliveryId));
  await updateDoc(hubDoc(hubId, 'deliveries', deliveryId), { hasProofPhoto: false, updatedAt: serverTimestamp() });
}
