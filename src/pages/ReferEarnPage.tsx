import { useState, useEffect, useMemo } from 'react';
import { Gift, Share2, Users, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { User, Product } from '../types';
import { useToast } from '../context/ToastContext';
import { useHubContext } from '../context/HubContext';
import type { HubId } from '../data/hubs';
import { useHubProducts } from '../data/products';
import {
  loadReferralSettings, saveReferralSettings, useReferralClaims, reviewClaim, loadReferrerInfo,
  type ClaimStatus, type ReferrerInfo,
} from '../data/referrals';
import { DataState, LoadMore, PageLoader } from '../components/common/DataState';

interface ReferEarnPageProps {
  users?: User[];
  products?: Product[];
}

export interface UserReferralStats {
  userId: string;
  userName: string;
  userPhone: string;
  referralCode: string;
  sharesCount: number;
  joinedCount: number;
  claimedCount: number;
  rewardStatus: 'in_progress' | 'unlocked' | 'claimed';
  joinedFriends: string[];
  claimStatus: ClaimStatus;
  rejectReason?: string;
}

export default function ReferEarnPage(_props: ReferEarnPageProps) {
  const { showToast } = useToast();
  const { selectedHubId } = useHubContext();
  const hubId = selectedHubId as HubId;
  const products = useHubProducts(hubId).data;
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [reviewingUid, setReviewingUid] = useState<string | null>(null);

  // Campaign config state
  const [isCampaignActive, setIsCampaignActive] = useState(true);
  const [appliesTo, setAppliesTo] = useState<'first_order' | 'all_orders'>('first_order');
  const [targetReferralLimit, setTargetReferralLimit] = useState('3');
  const [rewardType, setRewardType] = useState<'flat' | 'percentage' | 'bogo' | 'free_gift'>('flat');
  const [rewardValue, setRewardValue] = useState('50');
  const [minCart, setMinCart] = useState('100');
  const [freeGiftProductId, setFreeGiftProductId] = useState<string>(products[0]?.id || '');
  const [bannerHeading, setBannerHeading] = useState('Refer 3 Friends & Unlock Special Rewards!');
  const [bannerSubtitle, setBannerSubtitle] = useState('Share your unique referral code with friends. Once 3 friends join and place their first order, claim your exclusive reward!');

  // Editable "How Referral Works" Steps State
  const [step1Title, setStep1Title] = useState('Share your Referral Code');
  const [step1Sub, setStep1Sub] = useState('Send your unique referral code or link to friends & neighbors.');
  const [step2Title, setStep2Title] = useState('Friend Unlocks Special Offer');
  const [step2Sub, setStep2Sub] = useState('When they register using your code, an exclusive offer coupon is applied on their 1st order.');
  const [step3Title, setStep3Title] = useState('You Unlock Exclusive Offer');
  const [step3Sub, setStep3Sub] = useState('Once their first milk drop is delivered, an exclusive referral offer discount coupon is unlocked for your next order!');

  // Reward claims of this hub (customers who reached the target and tapped Claim)
  const claims = useReferralClaims(hubId);
  const [referrers, setReferrers] = useState<Record<string, ReferrerInfo>>({});

  useEffect(() => {
    let alive = true;
    setLoadingSettings(true);
    loadReferralSettings(hubId).then((data) => {
      if (!alive) return;
      setIsCampaignActive(data.isActive !== false);
      setAppliesTo(data.appliesTo || 'first_order');
      setTargetReferralLimit(String(data.targetReferrals || 3));
      setRewardType(data.rewardType || 'flat');
      // flat amounts are stored in paise; percentages as-is
      setRewardValue(String(data.rewardValue != null ? (data.rewardType === 'percentage' ? data.rewardValue : data.rewardValue / 100) : 50));
      setMinCart(String(data.minCartValue != null ? data.minCartValue / 100 : 100));
      setFreeGiftProductId(data.freeGiftProductId || '');
      if (data.title) setBannerHeading(data.title);
      if (data.subtitle) setBannerSubtitle(data.subtitle);
      const st = data.steps || [];
      if (st[0]) { setStep1Title(st[0].title); setStep1Sub(st[0].body); }
      if (st[1]) { setStep2Title(st[1].title); setStep2Sub(st[1].body); }
      if (st[2]) { setStep3Title(st[2].title); setStep3Sub(st[2].body); }
    }).catch((err) => showToast(`Could not load referral settings: ${(err as Error).message}`, 'error'))
      .finally(() => { if (alive) setLoadingSettings(false); });
    return () => { alive = false; };
  }, [hubId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phone / code / shares for the claim rows on screen (one read per new customer)
  useEffect(() => {
    const missing = claims.data.map((c) => c.customerUid).filter((uid) => !(uid in referrers));
    if (!missing.length) return;
    Promise.all(missing.map(async (uid) => [uid, await loadReferrerInfo(uid).catch(() => ({ phone: '', referralCode: '', referralShares: 0 }))] as const))
      .then((pairs) => setReferrers((prev) => ({ ...prev, ...Object.fromEntries(pairs) })));
  }, [claims.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const userReferralList: UserReferralStats[] = useMemo(() => claims.data
    .map((c) => {
      const info = referrers[c.customerUid];
      return {
        userId: c.customerUid,
        userName: c.customerId ? `${c.customerName} (${c.customerId})` : c.customerName,
        userPhone: info?.phone || '—',
        referralCode: info?.referralCode || '—',
        sharesCount: info?.referralShares ?? 0,
        joinedCount: c.friendsJoined,
        claimedCount: c.status === 'used' ? 1 : 0,
        rewardStatus: (c.status === 'used' || c.status === 'approved' ? 'claimed' : 'unlocked') as UserReferralStats['rewardStatus'],
        joinedFriends: [],
        claimStatus: c.status,
        rejectReason: c.rejectReason,
      };
    })
    // pending first, then newest
    .sort((a, b) => Number(b.claimStatus === 'pending') - Number(a.claimStatus === 'pending')),
  [claims.data, referrers]);

  const handleReview = async (uid: string, approve: boolean) => {
    let reason = '';
    if (!approve) {
      reason = (window.prompt('Reason for rejecting this reward (the customer will see it):') ?? '').trim();
      if (!reason) return;
    }
    setReviewingUid(uid);
    try {
      await reviewClaim(hubId, uid, approve, reason);
      showToast(approve ? "Reward approved. It applies to the customer's next order." : 'Reward rejected.', approve ? 'success' : 'info');
      claims.retry();
    } catch (err) {
      showToast(`Could not update the claim: ${(err as Error).message}`, 'error');
    } finally {
      setReviewingUid(null);
    }
  };

  const handleSaveCampaign = async () => {
    try {
      const selectedGift = products.find(p => p.id === freeGiftProductId);
      const targetNum = Number(targetReferralLimit) || 3;
      const rewardValNum = Number(rewardValue) || 50;
      const minCartNum = Number(minCart) || 100;

      await saveReferralSettings(hubId, {
        isActive: isCampaignActive,
        appliesTo,
        targetReferrals: targetNum,
        rewardType,
        rewardValue: rewardType === 'percentage' ? rewardValNum : Math.round(rewardValNum * 100),
        minCartValue: Math.round(minCartNum * 100),
        freeGiftProductId: rewardType === 'free_gift' ? (freeGiftProductId || '') : '',
        freeGiftProductName: rewardType === 'free_gift' && selectedGift ? selectedGift.name : '',
        title: bannerHeading,
        subtitle: bannerSubtitle,
        steps: [
          { title: step1Title, body: step1Sub },
          { title: step2Title, body: step2Sub },
          { title: step3Title, body: step3Sub },
        ],
      });

      showToast?.(`Referral program ${isCampaignActive ? 'Active' : 'Disabled'} & published live to Mobile App! 📱`, 'success');
    } catch (err) {
      showToast?.(`Error saving referral settings: ${err}`, 'error');
    }
  };

  const selectedGiftProduct = products.find(p => p.id === freeGiftProductId);

  if (loadingSettings) return <PageLoader label="Loading referral program…" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Header Bar */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.65rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          🎁 Refer &amp; Earn Program Control &amp; Campaign Rules
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '2px' }}>
          Configure program status (Active/Inactive), set referral target limits, select rewards (Flat ₹, %, BOGO, Free Gift), and track customer shares &amp; redemptions.
        </p>
      </div>

      {/* Main Campaign Configuration Card */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Toggle Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isCampaignActive ? '#ECFDF5' : '#F3F4F6', padding: '1rem 1.25rem', borderRadius: '14px', border: `1px solid ${isCampaignActive ? '#A7F3D0' : '#E5E7EB'}` }}>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: isCampaignActive ? '#047857' : '#374151', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Gift size={18} /> Program Status: {isCampaignActive ? 'ACTIVE & VISIBLE IN CUSTOMER APP' : 'INACTIVE (HIDDEN IN APP)'}
            </h4>
            <p style={{ fontSize: '0.8rem', color: isCampaignActive ? '#065F46' : '#6B7280', margin: '2px 0 0 0' }}>
              {isCampaignActive ? 'Customer mobile app displays Refer & Earn banners, progress bars, and referral codes.' : 'Program is disabled. Refer & Earn tab and banners are hidden across the mobile app.'}
            </p>
          </div>

          <button 
            type="button"
            onClick={() => setIsCampaignActive(!isCampaignActive)}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: isCampaignActive ? '#047857' : '#6B7280',
              color: '#FFFFFF',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isCampaignActive ? '🟢 Program Active' : '⚪ Program Inactive'}
          </button>
        </div>

        {/* Campaign Rule Options */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.1rem' }}>
          
          {/* Rule 1: Order Applicability */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>
              1. ORDER APPLICABILITY
            </label>
            <select 
              value={appliesTo}
              onChange={(e) => setAppliesTo(e.target.value as any)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none', backgroundColor: '#FFFFFF', fontWeight: 700 }}
            >
              <option value="first_order">Only Works on 1st Order</option>
              <option value="all_orders">Applicable on All Orders</option>
            </select>
            <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px', display: 'block' }}>When the friend can apply referral code</span>
          </div>

          {/* Rule 2: Target Referral Limit */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>
              2. FRIENDS SHARE TARGET LIMIT
            </label>
            <input 
              type="number"
              value={targetReferralLimit}
              onChange={(e) => setTargetReferralLimit(e.target.value)}
              placeholder="e.g. 3 friends"
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.88rem', fontWeight: 800, outline: 'none', color: '#047857' }}
            />
            <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px', display: 'block' }}>Number of friends needed to claim reward</span>
          </div>

          {/* Rule 3: Reward Type */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>
              3. REWARD OFFER TYPE
            </label>
            <select 
              value={rewardType}
              onChange={(e) => setRewardType(e.target.value as any)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none', backgroundColor: '#FFFFFF', fontWeight: 700 }}
            >
              <option value="flat">Flat Rupee Discount (₹)</option>
              <option value="percentage">Percentage Discount (%)</option>
              <option value="bogo">Buy 1 Get 1 Free (BOGO)</option>
              <option value="free_gift">Free Sample Gift Item</option>
            </select>
            <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px', display: 'block' }}>Reward type awarded to user</span>
          </div>

          {/* Rule 4: Reward Value / Amount */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>
              4. REWARD VALUE ({rewardType === 'flat' ? '₹' : rewardType === 'percentage' ? '%' : 'Qty'})
            </label>
            <input 
              type="text"
              value={rewardValue}
              onChange={(e) => setRewardValue(e.target.value)}
              placeholder="e.g. 50"
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.88rem', fontWeight: 800, outline: 'none' }}
            />
            <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px', display: 'block' }}>Amount deducted or gift quantity</span>
          </div>

          {/* Rule 5: Min Cart Value Requirement */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>
              5. MIN CART REQUIREMENT (₹)
            </label>
            <input 
              type="number"
              value={minCart}
              onChange={(e) => setMinCart(e.target.value)}
              placeholder="e.g. 100"
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.88rem', fontWeight: 800, outline: 'none' }}
            />
            <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px', display: 'block' }}>Minimum order amount needed to redeem</span>
          </div>

        </div>

        {/* Free Gift Selector (Shown if rewardType == free_gift) */}
        {rewardType === 'free_gift' && (
          <div style={{ backgroundColor: '#FFFBEB', padding: '1rem', borderRadius: '12px', border: '1px solid #FDE68A' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#92400E', display: 'block', marginBottom: '6px' }}>
              🎁 SELECT FREE GIFT PRODUCT FROM CATALOG:
            </label>
            <select
              value={freeGiftProductId}
              onChange={(e) => setFreeGiftProductId(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #FCD34D', fontSize: '0.88rem', fontWeight: 700, backgroundColor: '#FFFFFF', outline: 'none' }}
            >
              <option value="">-- Select Free Gift Item --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  🥛 {p.name} ({p.unit || 'unit'}) - ₹{p.price}
                </option>
              ))}
            </select>
            {selectedGiftProduct && (
              <p style={{ fontSize: '0.78rem', color: '#B45309', marginTop: '6px', fontWeight: 600 }}>
                Selected Gift: <strong>{selectedGiftProduct.name}</strong> will be added free of cost when customer claims reward at checkout.
              </p>
            )}
          </div>
        )}

        {/* Banner Texts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>Mobile App Banner Title</label>
            <input 
              type="text" 
              value={bannerHeading}
              onChange={(e) => setBannerHeading(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.88rem', fontWeight: 700 }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>Mobile App Subtitle / Description</label>
            <input 
              type="text" 
              value={bannerSubtitle}
              onChange={(e) => setBannerSubtitle(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* How Referral Works Steps Breakdown (Editable by Admin) */}
        <div style={{ backgroundColor: '#F9FAFB', padding: '1.15rem', borderRadius: '14px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            📖 How Referral Works Steps Breakdown (Editable in Mobile App)
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Step 1 */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', display: 'block', marginBottom: '3px' }}>STEP 1 TITLE</label>
              <input 
                type="text" 
                value={step1Title}
                onChange={(e) => setStep1Title(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}
              />
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280', display: 'block', marginBottom: '3px' }}>STEP 1 DESCRIPTION</label>
              <input 
                type="text" 
                value={step1Sub}
                onChange={(e) => setStep1Sub(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.8rem' }}
              />
            </div>

            {/* Step 2 */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', display: 'block', marginBottom: '3px' }}>STEP 2 TITLE</label>
              <input 
                type="text" 
                value={step2Title}
                onChange={(e) => setStep2Title(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}
              />
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280', display: 'block', marginBottom: '3px' }}>STEP 2 DESCRIPTION</label>
              <input 
                type="text" 
                value={step2Sub}
                onChange={(e) => setStep2Sub(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.8rem' }}
              />
            </div>

            {/* Step 3 */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', display: 'block', marginBottom: '3px' }}>STEP 3 TITLE</label>
              <input 
                type="text" 
                value={step3Title}
                onChange={(e) => setStep3Title(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}
              />
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280', display: 'block', marginBottom: '3px' }}>STEP 3 DESCRIPTION</label>
              <input 
                type="text" 
                value={step3Sub}
                onChange={(e) => setStep3Sub(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.8rem' }}
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={handleSaveCampaign}
            style={{
              padding: '0.75rem 1.75rem',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#047857',
              color: '#FFFFFF',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(4, 120, 87, 0.2)'
            }}
          >
            💾 Save &amp; Publish Referral Campaign to Mobile App
          </button>
        </div>

      </div>

      {/* Customer Referral Tracking Table */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} style={{ color: '#047857' }} /> Referral Reward Claims ({userReferralList.length})
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#6B7280', margin: '2px 0 0 0' }}>
              Customers who reached the target and claimed their reward. Approve or reject each claim; an approved reward is applied to the customer's next order.
            </p>
          </div>
        </div>

        <DataState loading={claims.loading} error={claims.error} onRetry={claims.retry} loadingLabel="Loading claims…">
        <div className="table-container" style={{ border: '1px solid #E5E7EB', borderRadius: '12px' }}>
          <table className="admin-table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', textTransform: 'uppercase', fontSize: '0.72rem', color: '#6B7280' }}>
                <th style={{ padding: '0.85rem 1rem' }}>CUSTOMER &amp; PHONE</th>
                <th style={{ padding: '0.85rem 1rem' }}>REFERRAL CODE</th>
                <th style={{ padding: '0.85rem 1rem' }}>SHARES TRACKED</th>
                <th style={{ padding: '0.85rem 1rem' }}>FRIENDS JOINED</th>
                <th style={{ padding: '0.85rem 1rem' }}>PROGRESS STATUS</th>
                <th style={{ padding: '0.85rem 1rem' }}>CLAIM STATUS</th>
              </tr>
            </thead>
            <tbody>
              {userReferralList.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '1.25rem', textAlign: 'center', color: '#6B7280' }}>No reward claims yet.</td></tr>
              )}
              {userReferralList.map((usr) => {
                const target = Number(targetReferralLimit) || 3;
                const percent = Math.min(100, Math.round((usr.joinedCount / target) * 100));

                return (
                  <tr key={usr.userId} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#111827' }}>
                      {usr.userName}
                      <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 500 }}>{usr.userPhone}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#047857' }}>
                      {usr.referralCode}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#374151' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Share2 size={13} style={{ color: '#047857' }} /> {usr.sharesCount} Shares
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#111827' }}>
                      {usr.joinedCount} / {target} Friends
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ width: '130px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, marginBottom: '2px', color: '#374151' }}>
                          <span>{percent}%</span>
                          <span>{usr.joinedCount}/{target}</span>
                        </div>
                        <div style={{ height: '6px', width: '100%', backgroundColor: '#E5E7EB', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${percent}%`, backgroundColor: percent >= 100 ? '#047857' : '#F59E0B', borderRadius: '3px' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {usr.claimStatus === 'used' ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', backgroundColor: '#DCFCE7', padding: '3px 10px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} /> Claimed Reward
                        </span>
                      ) : usr.claimStatus === 'approved' ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', backgroundColor: '#DCFCE7', padding: '3px 10px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <ShieldCheck size={12} /> Approved (next order)
                        </span>
                      ) : usr.claimStatus === 'rejected' ? (
                        <span title={usr.rejectReason} style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', backgroundColor: '#F3F4F6', padding: '3px 10px', borderRadius: '12px' }}>
                          Rejected{usr.rejectReason ? `: ${usr.rejectReason}` : ''}
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#B45309', backgroundColor: '#FEF3C7', padding: '3px 10px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            🎉 Waiting for approval
                          </span>
                          <button disabled={reviewingUid === usr.userId} onClick={() => handleReview(usr.userId, true)}
                            style={{ fontSize: '0.72rem', fontWeight: 800, color: '#FFFFFF', backgroundColor: '#047857', border: 'none', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer' }}>
                            Approve
                          </button>
                          <button disabled={reviewingUid === usr.userId} onClick={() => handleReview(usr.userId, false)}
                            style={{ fontSize: '0.72rem', fontWeight: 800, color: '#DC2626', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer' }}>
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <LoadMore hasMore={claims.hasMore} loading={claims.loadingMore} onClick={claims.loadMore} />
        </DataState>
      </div>

    </div>
  );
}
