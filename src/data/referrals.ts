// Refer & Earn: the hub's campaign (hubs/{hub}/settings/referral) and the reward
// claims customers raise once enough friends joined (hubs/{hub}/referralClaims/{uid}).
// Claims are approved or rejected here; the customer app applies an approved one
// to the next order and marks it `used`.

import { doc, getDoc, orderBy, query, serverTimestamp, setDoc, updateDoc, type Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { hubCol, hubDoc, type HubId } from './hubs';
import { usePagedQuery } from './useFirestore';
import { logAudit } from '../utils/auditLogger';

export type RewardType = 'flat' | 'percentage' | 'bogo' | 'free_gift';

export interface ReferralSettings {
  isActive: boolean;
  appliesTo: 'first_order' | 'all_orders';
  targetReferrals: number;
  rewardType: RewardType;
  /** paise for `flat`, percent for `percentage`, unused otherwise */
  rewardValue: number;
  /** paise */
  minCartValue: number;
  freeGiftProductId: string;
  freeGiftProductName: string;
  title: string;
  subtitle: string;
  steps: { title: string; body: string }[];
}

export async function loadReferralSettings(hubId: HubId): Promise<Partial<ReferralSettings>> {
  const snap = await getDoc(hubDoc(hubId, 'settings', 'referral'));
  return (snap.data() ?? {}) as Partial<ReferralSettings>;
}

export async function saveReferralSettings(hubId: HubId, s: ReferralSettings): Promise<void> {
  await setDoc(hubDoc(hubId, 'settings', 'referral'), { ...s, updatedAt: serverTimestamp() }, { merge: true });
  await logAudit({
    hubId, category: 'Catalog & Pricing',
    action: `Referral campaign ${s.isActive ? 'active' : 'off'}: ${s.targetReferrals} friends → ${s.rewardType}`,
    target: `hubs/${hubId}/settings/referral`,
  });
}

export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'used';

export interface ReferralClaimDoc {
  hubId: HubId;
  customerUid: string;
  customerId?: string;
  customerName: string;
  friendsJoined: number;
  reward?: { type: RewardType; value: number; freeGiftProductId?: string };
  status: ClaimStatus;
  rejectReason?: string;
  usedOnOrderId?: string;
  createdAt?: Timestamp;
}

/** The hub's claims, newest first, 50 per page. */
export function useReferralClaims(hubId: HubId) {
  return usePagedQuery<ReferralClaimDoc>(
    query(hubCol(hubId, 'referralClaims'), orderBy('createdAt', 'desc')), [hubId]);
}

export async function reviewClaim(hubId: HubId, uid: string, approve: boolean, reason = ''): Promise<void> {
  await updateDoc(hubDoc(hubId, 'referralClaims', uid), {
    status: approve ? 'approved' : 'rejected',
    rejectReason: approve ? '' : reason,
    reviewedByUid: auth.currentUser?.uid ?? null,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAudit({
    hubId, category: 'Financials & Refunds',
    action: approve ? 'Approved referral reward' : `Rejected referral reward: ${reason}`,
    target: `hubs/${hubId}/referralClaims/${uid}`,
  });
}

/** Phone, code and share count shown next to each claim (one read per customer, cached). */
export interface ReferrerInfo { phone: string; referralCode: string; referralShares: number }
export async function loadReferrerInfo(uid: string): Promise<ReferrerInfo> {
  const d = (await getDoc(doc(db, 'users', uid))).data() ?? {};
  return { phone: d.phone ?? '', referralCode: d.referralCode ?? '', referralShares: d.referralShares ?? 0 };
}
