// Payments recorded by the customer app after Razorpay success
// (hubs/{hub}/payments/{razorpayPaymentId}). On the free plan nothing verifies the
// signature server-side, so admins compare this list with the Razorpay dashboard
// daily and mark each one checked (or refunded after refunding in Razorpay).

import { orderBy, query, serverTimestamp, updateDoc, where, type Timestamp } from 'firebase/firestore';
import { auth } from '../firebase';
import { hubCol, hubDoc, type HubId } from './hubs';
import { istDayEnd, istDayStart } from './dates';
import { usePagedQuery } from './useFirestore';
import { logAudit } from '../utils/auditLogger';

export interface PaymentDoc {
  customerUid: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  /** paise */
  amount: number;
  purpose: 'order' | 'subscription';
  /** order or subscription id */
  refId: string;
  /** Razorpay method: upi | card | netbanking | wallet | free */
  method?: string;
  razorpayOrderId?: string;
  status: 'captured' | 'failed' | 'refunded';
  reconciled?: boolean;
  createdAt?: Timestamp;
}

/** Payments of a hub created between two IST days (inclusive), newest first, 50 per page. */
export function useHubPayments(hubId: HubId, from: string, to: string) {
  return usePagedQuery<PaymentDoc>(
    query(hubCol(hubId, 'payments'),
      where('createdAt', '>=', istDayStart(from)), where('createdAt', '<=', istDayEnd(to)),
      orderBy('createdAt', 'desc')),
    [hubId, from, to]);
}

export async function markPaymentChecked(hubId: HubId, id: string, checked: boolean): Promise<void> {
  await updateDoc(hubDoc(hubId, 'payments', id), {
    reconciled: checked,
    reconciledByUid: auth.currentUser?.uid ?? null,
    reconciledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** After refunding in the Razorpay dashboard. */
export async function markPaymentRefunded(hubId: HubId, id: string): Promise<void> {
  await updateDoc(hubDoc(hubId, 'payments', id), {
    status: 'refunded',
    refundedByUid: auth.currentUser?.uid ?? null,
    refundedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAudit({ hubId, category: 'Financials & Refunds', action: 'Marked payment refunded', target: `hubs/${hubId}/payments/${id}` });
}
