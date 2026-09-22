import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export interface CleanupResult {
  ordersCleaned: number;
  subscriptionsCleaned: number;
  totalSpaceSavedMB: number;
}

/**
 * Scans orders and subscriptions collections in Firestore and removes
 * heavy base64 proof images for items older than 30 days.
 */
export async function cleanupPhotosOlderThan30Days(): Promise<CleanupResult> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffIso = cutoffDate.toISOString();

  let ordersCleaned = 0;
  let subscriptionsCleaned = 0;
  let totalBytesFreed = 0;

  try {
    // 1. Clean Orders
    const ordersRef = collection(db, 'orders');
    const ordersSnap = await getDocs(ordersRef);

    for (const d of ordersSnap.docs) {
      const data = d.data();
      const dateStr = data.deliveredAt || data.cancelledAt || data.completedAt || data.orderDate || data.createdAt;
      
      let itemDate: Date | null = null;
      if (dateStr?.toDate) itemDate = dateStr.toDate();
      else if (typeof dateStr === 'string') itemDate = new Date(dateStr);

      if (itemDate && itemDate < cutoffDate) {
        let hasPhoto = false;
        const updatePayload: Record<string, any> = {};

        if (data.proofImageUrl) {
          totalBytesFreed += (data.proofImageUrl.length || 0);
          updatePayload.proofImageUrl = null;
          hasPhoto = true;
        }
        if (data.dropoffPhotoUrl) {
          totalBytesFreed += (data.dropoffPhotoUrl.length || 0);
          updatePayload.dropoffPhotoUrl = null;
          hasPhoto = true;
        }

        if (hasPhoto) {
          updatePayload.photoArchivedAt = new Date().toISOString();
          updatePayload.photoArchiveNotice = 'Auto-cleared photo proof older than 30 days for optimization';
          await updateDoc(doc(db, 'orders', d.id), updatePayload);
          ordersCleaned++;
        }
      }
    }

    // 2. Clean Subscriptions
    const subRef = collection(db, 'subscriptions');
    const subSnap = await getDocs(subRef);

    for (const d of subSnap.docs) {
      const data = d.data();
      const dateStr = data.deliveredAt || data.cancelledAt || data.updatedAt || data.createdAt;
      
      let itemDate: Date | null = null;
      if (dateStr?.toDate) itemDate = dateStr.toDate();
      else if (typeof dateStr === 'string') itemDate = new Date(dateStr);

      if (itemDate && itemDate < cutoffDate) {
        let hasPhoto = false;
        const updatePayload: Record<string, any> = {};

        if (data.proofImageUrl) {
          totalBytesFreed += (data.proofImageUrl.length || 0);
          updatePayload.proofImageUrl = null;
          hasPhoto = true;
        }
        if (data.dropoffPhotoUrl) {
          totalBytesFreed += (data.dropoffPhotoUrl.length || 0);
          updatePayload.dropoffPhotoUrl = null;
          hasPhoto = true;
        }

        if (hasPhoto) {
          updatePayload.photoArchivedAt = new Date().toISOString();
          await updateDoc(doc(db, 'subscriptions', d.id), updatePayload);
          subscriptionsCleaned++;
        }
      }
    }
  } catch (error) {
    console.error('Error executing 30-day photo cleanup:', error);
  }

  const totalSpaceSavedMB = Number((totalBytesFreed / (1024 * 1024)).toFixed(2));

  return {
    ordersCleaned,
    subscriptionsCleaned,
    totalSpaceSavedMB
  };
}
