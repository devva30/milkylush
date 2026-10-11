import { useState, useEffect } from 'react';
import { Ticket, Plus, Trash2, PauseCircle, PlayCircle, Share2 } from 'lucide-react';
import type { User, Product } from '../types';
import { useToast } from '../context/ToastContext';
import { useHubContext } from '../context/HubContext';
import { useHubProducts } from '../data/products';
import {
  useHubCoupons, createCoupon, setCouponActive, deleteCoupon, loadRedemptions, type CouponRow, type RedemptionRow,
} from '../data/coupons';
import { DataState } from '../components/common/DataState';

interface PromoCodesPageProps {
  users?: User[];
  products?: Product[];
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
  targetProductId?: string;
  targetProductName?: string;
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

export default function PromoCodesPage(_props: PromoCodesPageProps) {
  const { showToast } = useToast();
  const { selectedHubId: hubId } = useHubContext();
  const products: Product[] = useHubProducts(hubId).data;
  const couponsQuery = useHubCoupons(hubId);

  // Form State
  const [newCodeName, setNewCodeName] = useState('');
  const [newDiscountType, setNewDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [newValue, setNewValue] = useState('50');
  const [newMinCart, setNewMinCart] = useState('100');
  const [newValidityDays, setNewValidityDays] = useState('30');
  const [newPurchaseType, setNewPurchaseType] = useState<'all' | 'onetime' | 'subscription'>('all');
  const [newTargetProductId, setNewTargetProductId] = useState<string>('all');
  const [newMaxUsageLimit, setNewMaxUsageLimit] = useState('100');
  const [newPerUserLimit, setNewPerUserLimit] = useState('1');

  const promoCodes: CouponRow[] = couponsQuery.data;
  const [redemptionLogs, setRedemptionLogs] = useState<RedemptionRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadRedemptions(hubId)
      .then((rows) => { if (!cancelled) setRedemptionLogs(rows); })
      .catch((err) => { if (!cancelled) showToast(`Could not load redemptions: ${err.message}`, 'error'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubId]);

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCodeName.trim()) {
      showToast('Please enter a promo code name', 'error');
      return;
    }
    const selectedProd = products.find((p) => p.id === newTargetProductId);
    try {
      const code = await createCoupon(hubId, {
        code: newCodeName,
        discountType: newDiscountType,
        value: Number(newValue) || 0,
        minCart: Number(newMinCart) || 0,
        validityDays: newValidityDays ? Number(newValidityDays) : undefined,
        purchaseType: newPurchaseType,
        productId: newTargetProductId === 'all' ? undefined : newTargetProductId,
        productName: selectedProd?.name,
        totalLimit: Number(newMaxUsageLimit) || 100,
        perUserLimit: Number(newPerUserLimit) || 1,
      });
      setNewCodeName('');
      showToast(`Created promo code "${code}" for ${hubId === 'hosur' ? 'Hosur' : 'Bengaluru'}!`, 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleToggleCodeStatus = async (item: CouponRow) => {
    try {
      await setCouponActive(hubId, item.code, item.status !== 'active');
      showToast(`${item.status === 'active' ? 'Paused' : 'Resumed'} promo code ${item.code}`, 'info');
    } catch (err) {
      showToast(`Error updating promo code: ${(err as Error).message}`, 'error');
    }
  };

  const handleDeleteCode = async (item: CouponRow) => {
    try {
      await deleteCoupon(hubId, item.code);
      showToast(`Deleted promo code ${item.code}`, 'info');
    } catch (err) {
      showToast(`Error deleting promo code: ${(err as Error).message}`, 'error');
    }
  };

  const handleShareCode = async (code: string) => {
    const shareText = `Use promo code '${code}' on MilkyLush to get instant discounts on pure farm-fresh milk & dairy products!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'MilkyLush Promo Code', text: shareText });
        showToast(`Shared promo code '${code}'!`, 'success');
        return;
      }
    } catch (e) {}

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
        showToast(`Copied promo code '${code}' to clipboard! 📋`, 'success');
        return;
      }
    } catch (e) {}

    showToast(`Promo Code: ${code}`, 'info');
  };

  return (
    <DataState loading={couponsQuery.loading} error={couponsQuery.error} onRetry={couponsQuery.retry} loadingLabel="Loading promo codes…">
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Page Header */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.65rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          🎟️ Promo Codes &amp; Coupons Management
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '2px' }}>
          Generate custom promo codes, set discount rules, cart thresholds, usage limits, and view real-time redemption logs.
        </p>
      </div>

      {/* Card 1: Create Custom Promo Code Form */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.15rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Ticket size={20} style={{ color: '#047857' }} /> Create New Promo Code / Coupon
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#6B7280', fontWeight: 600 }}>
            Syncs live with Mobile App &amp; Web Checkout
          </span>
        </div>

        <form onSubmit={handleGenerateCode} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            
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
            </div>

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
            </div>

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
            </div>

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
            </div>

          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#111827', display: 'block', marginBottom: '4px' }}>
                5. VALIDITY DURATION (DAYS)
              </label>
              <input 
                type="number"
                placeholder="e.g. 30" 
                value={newValidityDays}
                onChange={(e) => setNewValidityDays(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>

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
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#047857', display: 'block', marginBottom: '4px' }}>
                🎯 TARGET SPECIFIC PRODUCT
              </label>
              <select 
                value={newTargetProductId}
                onChange={(e) => setNewTargetProductId(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #A7F3D0', backgroundColor: '#ECFDF5', fontSize: '0.85rem', outline: 'none', fontWeight: 700, color: '#047857' }}
              >
                <option value="all">📦 All Catalog Products (Default)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    🥛 {p.name} ({p.unit || 'unit'}) - ₹{p.price}
                  </option>
                ))}
              </select>
            </div>

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
            </div>

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

      {/* Card 2: Active Promo Codes Table */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            🎟️ Active Promo Codes Registry ({promoCodes.length})
          </h3>
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

      {/* Card 3: Redemption Audit Logs */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            📜 Customer Code Redemptions &amp; Usage Audit Log ({redemptionLogs.length})
          </h3>
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
    </DataState>
  );
}
