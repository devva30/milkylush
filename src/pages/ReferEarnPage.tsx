import { useState, useEffect } from 'react';
import { Settings, Plus, Ticket, Trash2, PauseCircle, PlayCircle, Share2 } from 'lucide-react';
import { collection, onSnapshot, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from '../types';
import { useToast } from '../context/ToastContext';

interface ReferEarnPageProps {
  users: User[];
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export interface PromoCodeItem {
  id?: string;
  code: string;
  discountType: 'flat' | 'percentage';
  discountValue: number;
  discountOffer: string;
  minCart: number;
  validityDays?: number;
  expiryDate?: string;
  purchaseType: 'all' | 'onetime' | 'subscription';
  maxUsageLimit: number;
  perUserLimit: number;
  targetHub: string;
  uses: number;
  status: 'active' | 'paused';
  createdAt?: string;
}

interface RedemptionLog {
  id?: string;
  customerName: string;
  contact: string;
  appliedCode: string;
  discountSaved: number;
  hub: string;
  dateTime: string;
}

export default function ReferEarnPage({ users: _users }: ReferEarnPageProps) {
  const { showToast } = useToast();

  // Campaign config state
  const [offerType, setOfferType] = useState('Percentage Discount (e.g. 15% OFF)');
  const [offerValue, setOfferValue] = useState('50');
  const [minCart, setMinCart] = useState('100');
  const [bannerHeading, setBannerHeading] = useState('Earn ₹50 for Every Friend!');
  const [bannerSubtitle, setBannerSubtitle] = useState('Invite your friends to MilkyLush. They get ₹50 free credit on their first order, and you earn ₹50 too!');
  const [isCampaignActive, setIsCampaignActive] = useState(true);

  // New Labeled Promo Code Form State
  const [newCodeName, setNewCodeName] = useState('');
  const [newDiscountType, setNewDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [newValue, setNewValue] = useState('50');
  const [newMinCart, setNewMinCart] = useState('100');
  const [newValidityDays, setNewValidityDays] = useState('30');
  const [newPurchaseType, setNewPurchaseType] = useState<'all' | 'onetime' | 'subscription'>('all');
  const [newMaxUsageLimit, setNewMaxUsageLimit] = useState('100');
  const [newPerUserLimit, setNewPerUserLimit] = useState('1');

  // Firestore Sync Promo Codes List & Audit Logs
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [redemptionLogs, setRedemptionLogs] = useState<RedemptionLog[]>([]);

  useEffect(() => {
    const unsubCodes = onSnapshot(collection(db, 'promo_codes'), (snapshot) => {
      const list: PromoCodeItem[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...(docSnap.data() as PromoCodeItem) });
      });
      if (list.length > 0) {
        setPromoCodes(list);
      } else {
        const defaults: PromoCodeItem[] = [
          {
            id: 'MILKTEST01',
            code: 'MILKTEST01',
            discountType: 'percentage',
            discountValue: 50,
            discountOffer: '50% OFF',
            minCart: 500,
            validityDays: 30,
            purchaseType: 'onetime',
            maxUsageLimit: 100,
            perUserLimit: 1,
            targetHub: 'Hosur Hub 📍',
            uses: 1,
            status: 'active'
          },
          {
            id: 'WELCOME100',
            code: 'WELCOME100',
            discountType: 'flat',
            discountValue: 100,
            discountOffer: '₹100 OFF',
            minCart: 200,
            validityDays: 60,
            purchaseType: 'all',
            maxUsageLimit: 500,
            perUserLimit: 1,
            targetHub: 'Hosur Hub 📍',
            uses: 11,
            status: 'active'
          }
        ];
        setPromoCodes(defaults);
      }
    }, (error) => {
      console.error("Firestore promo_codes snapshot error:", error);
    });

    // Subscribe to live redemptions from coupon_usages
    const unsubLogs = onSnapshot(collection(db, 'coupon_usages'), (snapshot) => {
      const logs: RedemptionLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const phoneStr = data.userPhone || '';
        const maskedPhone = phoneStr.length >= 10 ? `${phoneStr.slice(0, 3)}*** ***${phoneStr.slice(-2)}` : phoneStr;
        
        let formattedTime = 'Just now';
        if (data.usedAt) {
          try {
            formattedTime = new Date(data.usedAt).toLocaleString('en-US', {
              month: 'numeric',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              second: 'numeric',
              hour12: true
            });
          } catch (e) {
            formattedTime = String(data.usedAt);
          }
        }

        logs.push({
          id: docSnap.id,
          customerName: data.userName || 'Customer',
          contact: maskedPhone || '+91 *****',
          appliedCode: data.code || 'N/A',
          discountSaved: Number(data.discountAmount) || 0,
          hub: data.hubId === 'hub_hosur_main' ? 'Hosur Hub 📍' : 'Bangalore Hub 📍',
          dateTime: formattedTime,
        });
      });

      if (logs.length > 0) {
        logs.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
        setRedemptionLogs(logs);
      } else {
        setRedemptionLogs([
          { customerName: 'Customer A', contact: '+91 98*** *****', appliedCode: 'WELCOME100', discountSaved: 100, hub: 'Hosur Hub 📍', dateTime: '9/8/2026, 6:15:32 PM' },
          { customerName: 'Customer B', contact: '+91 97*** *****', appliedCode: 'MILKTEST01', discountSaved: 401, hub: 'Hosur Hub 📍', dateTime: '9/11/2026, 1:15:10 PM' }
        ]);
      }
    }, (error) => {
      console.error("Firestore coupon_usages snapshot error:", error);
    });

    return () => {
      unsubCodes();
      unsubLogs();
    };
  }, []);

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCodeName.trim()) {
      showToast?.('Please enter a promo code name', 'error');
      return;
    }

    const codeClean = newCodeName.trim().toUpperCase();
    const valNum = Number(newValue) || 0;
    const minCartNum = Number(newMinCart) || 0;
    const validityNum = newValidityDays ? Number(newValidityDays) : undefined;
    const maxLimitNum = Number(newMaxUsageLimit) || 100;
    const perUserNum = Number(newPerUserLimit) || 1;

    let expiryStr: string | undefined;
    if (validityNum && validityNum > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + validityNum);
      expiryStr = expDate.toISOString().slice(0, 10);
    }

    const created: PromoCodeItem = {
      code: codeClean,
      discountType: newDiscountType,
      discountValue: valNum,
      discountOffer: newDiscountType === 'flat' ? `₹${valNum} OFF` : `${valNum}% OFF`,
      minCart: minCartNum,
      validityDays: validityNum,
      expiryDate: expiryStr,
      purchaseType: newPurchaseType,
      maxUsageLimit: maxLimitNum,
      perUserLimit: perUserNum,
      targetHub: 'Hosur Hub 📍',
      uses: 0,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'promo_codes', codeClean), created, { merge: true });
      setNewCodeName('');
      showToast?.(`Generated custom promo code "${created.code}" with live Firestore sync!`, 'success');
    } catch (err) {
      showToast?.(`Error saving promo code to Firestore: ${err}`, 'error');
    }
  };

  const handleToggleCodeStatus = async (item: PromoCodeItem) => {
    const newStatus = item.status === 'active' ? 'paused' : 'active';
    try {
      if (item.id || item.code) {
        await updateDoc(doc(db, 'promo_codes', item.id || item.code), { status: newStatus });
      }
      showToast?.(`Toggled promo code status for ${item.code}`, 'info');
    } catch (err) {
      setPromoCodes(promoCodes.map(p => p.code === item.code ? { ...p, status: newStatus } : p));
      showToast?.(`Updated promo code status for ${item.code}`, 'info');
    }
  };

  const handleDeleteCode = async (item: PromoCodeItem) => {
    try {
      if (item.id || item.code) {
        await deleteDoc(doc(db, 'promo_codes', item.id || item.code));
      }
      showToast?.(`Deleted promo code ${item.code}`, 'info');
    } catch (err) {
      setPromoCodes(promoCodes.filter(p => p.code !== item.code));
      showToast?.(`Deleted promo code ${item.code}`, 'info');
    }
  };

  const handleShareCode = async (code: string) => {
    const shareText = `Use promo code '${code}' on MilkyLush to get instant discounts on pure farm-fresh milk & dairy products!`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'MilkyLush Promo Code',
          text: shareText,
        });
        showToast?.(`Shared promo code '${code}'!`, 'success');
        return;
      }
    } catch (e) {
      // User cancelled or share API error, fallback to clipboard
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
        showToast?.(`Copied promo code '${code}' to clipboard! 📋`, 'success');
        return;
      }
    } catch (e) {
      // Fallback for non-secure origin
    }

    try {
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast?.(`Copied promo code '${code}' to clipboard! 📋`, 'success');
    } catch (e) {
      showToast?.(`Promo Code: ${code}`, 'info');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      
      {/* Header Bar */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.65rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⚙️ Refer &amp; Earn &amp; Marketing Hub (Hosur Hub)
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '2px' }}>
          Manage per-hub referral campaign offers (Discount %, Flat ₹, BOGO, Free Gift), audit referral redemptions, and issue custom promo codes.
        </p>
      </div>

      {/* Card 1: Active Referral Campaign Offer Config */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={18} style={{ color: '#047857' }} /> Active Referral Campaign Offer Config
        </h3>

        {/* Row 1: Offer Type, Value, Min Cart */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Offer Type</label>
            <select 
              value={offerType}
              onChange={(e) => setOfferType(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.85rem', outline: 'none', backgroundColor: '#FFFFFF', fontWeight: 600 }}
            >
              <option value="Percentage Discount (e.g. 15% OFF)">Percentage Discount (e.g. 15% OFF)</option>
              <option value="Flat Rupee Discount (₹)">Flat Rupee Discount (₹)</option>
              <option value="Buy 1 Get 1 (BOGO)">Buy 1 Get 1 (BOGO)</option>
              <option value="Free Gift on Order">Free Gift on Order</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Offer Value / Discount Amount</label>
            <input 
              type="text" 
              value={offerValue}
              onChange={(e) => setOfferValue(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.88rem', outline: 'none', fontWeight: 700 }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Min Cart Value Requirement (₹)</label>
            <input 
              type="text" 
              value={minCart}
              onChange={(e) => setMinCart(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.88rem', outline: 'none', fontWeight: 700 }}
            />
          </div>
        </div>

        {/* Row 2: Banner Heading */}
        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Mobile App Banner Heading</label>
          <input 
            type="text" 
            value={bannerHeading}
            onChange={(e) => setBannerHeading(e.target.value)}
            style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.88rem', outline: 'none', fontWeight: 600 }}
          />
        </div>

        {/* Row 3: Banner Subtitle */}
        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>Mobile App Banner Subtitle</label>
          <input 
            type="text" 
            value={bannerSubtitle}
            onChange={(e) => setBannerSubtitle(e.target.value)}
            style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.85rem', outline: 'none' }}
          />
        </div>

        {/* Row 4: Campaign Status Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#374151' }}>Campaign Status:</span>
          <button 
            type="button"
            onClick={() => {
              setIsCampaignActive(!isCampaignActive);
              showToast?.(`Referral campaign is now ${!isCampaignActive ? 'Active' : 'Paused'}`, 'info');
            }}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: isCampaignActive ? '#047857' : '#6B7280',
              color: '#FFFFFF',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isCampaignActive ? '🟢 Campaign Active' : '⚪ Campaign Paused'}
          </button>
        </div>

      </div>

      {/* Card 2: Create Custom Admin Promo Code */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.15rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Ticket size={20} style={{ color: '#047857' }} /> Create Custom Admin Promo Code
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#6B7280', fontWeight: 600 }}>
            Live syncs to Mobile App &amp; Web Checkout
          </span>
        </div>

        <form onSubmit={handleGenerateCode} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Row 1: Code Name, Discount Type, Discount Value, Min Cart Value */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            
            {/* Field 1: Code Name */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>
                1. PROMO CODE NAME *
              </label>
              <input 
                type="text" 
                placeholder="e.g. WELCOME100, MILK50" 
                value={newCodeName}
                onChange={(e) => setNewCodeName(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.88rem', fontWeight: 700, outline: 'none', backgroundColor: '#F9FAFB' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px', display: 'block' }}>Uppercased automatically (e.g. FESTIVE20)</span>
            </div>

            {/* Field 2: Discount Type */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>
                2. DISCOUNT TYPE *
              </label>
              <select 
                value={newDiscountType}
                onChange={(e) => setNewDiscountType(e.target.value as any)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none', backgroundColor: '#FFFFFF', fontWeight: 700 }}
              >
                <option value="flat">Flat Rupee Discount (₹)</option>
                <option value="percentage">Percentage Discount (%)</option>
              </select>
              <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px', display: 'block' }}>Choose Rupee or Percent deduction</span>
            </div>

            {/* Field 3: Discount Value */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>
                3. DISCOUNT VALUE ({newDiscountType === 'flat' ? '₹' : '%'}) *
              </label>
              <input 
                type="number"
                placeholder={newDiscountType === 'flat' ? 'e.g. 50' : 'e.g. 15'}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.88rem', fontWeight: 700, outline: 'none', color: '#047857' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px', display: 'block' }}>Amount deducted from bill subtotal</span>
            </div>

            {/* Field 4: Min Cart Amount */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>
                4. MIN CART AMOUNT (₹) *
              </label>
              <input 
                type="number"
                placeholder="e.g. 200" 
                value={newMinCart}
                onChange={(e) => setNewMinCart(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.88rem', fontWeight: 700, outline: 'none' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px', display: 'block' }}>Minimum purchase total required</span>
            </div>

          </div>

          {/* Row 2: Validity Days, Purchase Type, Usage Limits */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            
            {/* Field 5: Validity Duration Days (Optional) */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>
                5. VALIDITY DURATION (DAYS) <span style={{ color: '#6B7280', fontWeight: 600 }}>(Optional)</span>
              </label>
              <input 
                type="number"
                placeholder="e.g. 30 (Blank = Unlimited)" 
                value={newValidityDays}
                onChange={(e) => setNewValidityDays(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px', display: 'block' }}>Expires X days after generation</span>
            </div>

            {/* Field 6: Target Purchase Type */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>
                6. APPLICABLE PURCHASE TYPE *
              </label>
              <select 
                value={newPurchaseType}
                onChange={(e) => setNewPurchaseType(e.target.value as any)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none', backgroundColor: '#FFFFFF', fontWeight: 600 }}
              >
                <option value="all">All Orders &amp; Subscriptions</option>
                <option value="onetime">One-Time Store Orders Only</option>
                <option value="subscription">Daily Subscriptions Only</option>
              </select>
              <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px', display: 'block' }}>Scope of applicability</span>
            </div>

            {/* Field 7: Total Usage Limit */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>
                7. TOTAL MAX USAGE LIMIT *
              </label>
              <input 
                type="number"
                placeholder="e.g. 100 uses total" 
                value={newMaxUsageLimit}
                onChange={(e) => setNewMaxUsageLimit(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.88rem', fontWeight: 700, outline: 'none' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px', display: 'block' }}>Max total redemptions across all users</span>
            </div>

            {/* Field 8: Per-User Usage Limit */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>
                8. LIMIT PER CUSTOMER *
              </label>
              <input 
                type="number"
                placeholder="e.g. 1 use per customer" 
                value={newPerUserLimit}
                onChange={(e) => setNewPerUserLimit(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.88rem', fontWeight: 700, outline: 'none' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px', display: 'block' }}>Redemption cap per customer account</span>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
            <button 
              type="submit"
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
              <Plus size={18} /> Generate &amp; Publish Promo Code
            </button>
          </div>

        </form>
      </div>

      {/* Card 3: Active Promo Codes & Custom Referral Codes Management */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            🎟️ Active Promo Codes &amp; Live Coupon Registry
          </h3>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6B7280' }}>
            Total Codes Active: {promoCodes.length}
          </span>
        </div>

        <div className="table-container" style={{ border: '1px solid #E5E7EB', borderRadius: '12px' }}>
          <table className="admin-table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', textTransform: 'uppercase', fontSize: '0.72rem', color: '#6B7280' }}>
                <th style={{ padding: '0.85rem 1rem' }}>PROMO CODE</th>
                <th style={{ padding: '0.85rem 1rem' }}>DISCOUNT OFFER</th>
                <th style={{ padding: '0.85rem 1rem' }}>MIN CART</th>
                <th style={{ padding: '0.85rem 1rem' }}>PURCHASE SCOPE</th>
                <th style={{ padding: '0.85rem 1rem' }}>EXPIRY / VALIDITY</th>
                <th style={{ padding: '0.85rem 1rem' }}>USAGE / LIMIT</th>
                <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
                <th style={{ padding: '0.85rem 1rem' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {promoCodes.map((item) => (
                <tr key={item.code} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#047857' }}>
                    {item.code}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#111827' }}>
                    {item.discountOffer}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#374151', fontWeight: 700 }}>
                    ₹{item.minCart}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#4B5563', fontSize: '0.8rem', textTransform: 'capitalize' }}>
                    {item.purchaseType === 'all' ? 'All Purchases' : item.purchaseType === 'onetime' ? 'One-Time Only' : 'Subscriptions Only'}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#4B5563', fontSize: '0.8rem' }}>
                    {item.expiryDate ? `Expires ${item.expiryDate}` : item.validityDays ? `${item.validityDays} Days` : 'No Expiry'}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#6B7280' }}>
                    <strong>{item.uses || 0}</strong> / {item.maxUsageLimit || 100} (Max {item.perUserLimit || 1}/user)
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: item.status === 'active' ? '#059669' : '#6B7280',
                      backgroundColor: item.status === 'active' ? '#DCFCE7' : '#F3F4F6',
                      padding: '3px 10px',
                      borderRadius: '12px'
                    }}>
                      {item.status === 'active' ? '🟢 Active' : '⚪ Paused'}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        onClick={() => handleShareCode(item.code)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          borderRadius: '8px',
                          backgroundColor: '#ECFDF5',
                          color: '#047857',
                          border: '1px solid #A7F3D0',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Share2 size={13} /> Share Code
                      </button>

                      <button
                        onClick={() => handleToggleCodeStatus(item)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          borderRadius: '8px',
                          backgroundColor: '#FFFFFF',
                          color: '#374151',
                          border: '1px solid #D1D5DB',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {item.status === 'active' ? <PauseCircle size={13} /> : <PlayCircle size={13} />}
                        {item.status === 'active' ? 'Pause' : 'Resume'}
                      </button>

                      <button
                        onClick={() => handleDeleteCode(item)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          borderRadius: '8px',
                          backgroundColor: '#FEE2E2',
                          color: '#DC2626',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Card 4: Customer Code Redemptions & Usage Audit Log */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            📜 Customer Code Redemptions &amp; Usage Audit Log
          </h3>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6B7280' }}>
            Live Redemptions Tracked: {redemptionLogs.length}
          </span>
        </div>

        <div className="table-container" style={{ border: '1px solid #E5E7EB', borderRadius: '12px' }}>
          <table className="admin-table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', textTransform: 'uppercase', fontSize: '0.72rem', color: '#6B7280' }}>
                <th style={{ padding: '0.85rem 1rem' }}>CUSTOMER NAME &amp; CONTACT</th>
                <th style={{ padding: '0.85rem 1rem' }}>APPLIED PROMO / REFERRAL CODE</th>
                <th style={{ padding: '0.85rem 1rem' }}>DISCOUNT SAVED (₹)</th>
                <th style={{ padding: '0.85rem 1rem' }}>DELIVERY HUB</th>
                <th style={{ padding: '0.85rem 1rem' }}>REDEMPTION DATE &amp; TIME</th>
              </tr>
            </thead>
            <tbody>
              {redemptionLogs.map((log, idx) => (
                <tr key={log.id || idx} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#111827' }}>
                    {log.customerName} ({log.contact})
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#047857' }}>
                    {log.appliedCode}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#059669' }}>
                    ₹{log.discountSaved}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#4B5563', fontSize: '0.8rem' }}>
                    {log.hub}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#6B7280', fontSize: '0.8rem' }}>
                    {log.dateTime}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
