import { useState, useMemo, useEffect } from 'react';
import { subscriptionEndDate } from '../data/deliveries';
import {
  loadSubscriptionAnalytics, useExpiringSubscriptions, extendSubscription, sendRenewalReminder, type SubscriptionAnalytics,
} from '../data/subscriptions';
import { todayKey, formatDay, istDayStart } from '../data/dates';
import { count, getAggregateFromServer, query, sum, where } from 'firebase/firestore';
import { hubCol } from '../data/hubs';
import { BarChart2, Plus, TrendingUp, Edit3, Trash2, RefreshCw } from 'lucide-react';
import type { Subscription, PrepaidPackage, Product } from '../types';
import { isHubId, type HubId } from '../data/hubs';
import { useHubPlans, savePlan, deletePlan } from '../data/plans';
import { useHubProducts } from '../data/products';
import { useHubContext } from '../context/HubContext';
import { DataState } from '../components/common/DataState';

interface ManageSubscriptionsPageProps {
  selectedHubId: string;
  /** Unused: per-plan counts are read from the database on export. */
  subscriptions?: Subscription[];
  prepaidPackages?: PrepaidPackage[];
  products?: Product[];
  adminUsername?: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface ExpiringSubscription {
  id: string;
  customerName: string;
  phone: string;
  productName: string;
  expiryDate: string;
  daysLeft: number;
  planDuration: string;
  dailyRate: number;
  churnRisk: 'High' | 'Medium' | 'Low';
  customerUid: string;
  /** end date as yyyy-MM-dd */
  endKey: string;
}

export default function ManageSubscriptionsPage({
  selectedHubId,
  showToast,
}: ManageSubscriptionsPageProps) {
  const hubId = selectedHubId as HubId;
  const { allowedHubIds } = useHubContext();
  const plansQuery = useHubPlans(hubId);
  const prepaidPackages = plansQuery.data;
  const products: Product[] = useHubProducts(hubId).data;
  const expiringQuery = useExpiringSubscriptions(hubId, 15);
  const expiringList: (ExpiringSubscription & { customerUid: string; endKey: string })[] = useMemo(() => {
    const today = istDayStart(todayKey()).getTime();
    return expiringQuery.data.map((d) => {
      // Live end date: skips / vacation push a paid-drop plan's last drop later.
      const endKey = subscriptionEndDate(d as any) ?? d.endDate ?? todayKey();
      const daysLeft = Math.max(0, Math.round((istDayStart(endKey).getTime() - today) / 86400000));
      return {
        id: d.id,
        customerUid: d.customerUid,
        endKey,
        customerName: d.customerId ? `${d.customerName ?? 'Customer'} (${d.customerId})` : (d.customerName ?? 'Customer'),
        phone: d.customerPhone ?? '—',
        productName: `${d.productName} x${d.quantity}`,
        expiryDate: formatDay(endKey),
        daysLeft,
        planDuration: d.planTitle ?? d.frequency,
        dailyRate: (d.unitPrice ?? 0) / 100,
        churnRisk: (daysLeft <= 3 ? 'High' : daysLeft <= 7 ? 'Medium' : 'Low') as ExpiringSubscription['churnRisk'],
      };
    }).filter((x) => x.daysLeft <= 15).sort((a, b) => a.daysLeft - b.daysLeft);
  }, [expiringQuery.data]);
  const [analytics, setAnalytics] = useState<SubscriptionAnalytics | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PrepaidPackage | null>(null);

  // Search & Filter state for expiring track
  const [expiringSearch, setExpiringSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Form State for Package Modal
  const [pkgTitle, setPkgTitle] = useState('');
  const [pkgDuration, setPkgDuration] = useState('30');
  const [pkgDiscount, setPkgDiscount] = useState('10');
  const [pkgBadge, setPkgBadge] = useState('10% OFF');
  const [pkgOrder, setPkgOrder] = useState('1');
  const [pkgRecommended, setPkgRecommended] = useState(false);
  const [pkgActive, setPkgActive] = useState(true);
  const [pkgHubId, setPkgHubId] = useState('all');
  const [pkgProductId, setPkgProductId] = useState('all');

  const isHosur = selectedHubId === 'hosur';
  const hubCodeName = isHosur ? 'Hosur Central Hub' : 'Bangalore Electronic City Hub';

  // Filter products to list ONLY subscription-enabled products for subscription packages
  const subscriptionProducts = useMemo(() => {
    return products.filter((p) => p.isSubscriptionEnabled);
  }, [products]);

  // Filter package list by current active admin hub
  const displayedPackages = useMemo(() => {
    return prepaidPackages.filter((pkg) => {
      if (!pkg.hubId || pkg.hubId === 'all') return true;
      if (selectedHubId && pkg.hubId !== selectedHubId) return false;
      return true;
    });
  }, [prepaidPackages, selectedHubId]);

  const planKey = prepaidPackages.map((p) => p.id).join(',');
  useEffect(() => {
    let alive = true;
    setAnalytics(null);
    loadSubscriptionAnalytics(hubId, prepaidPackages.map((p) => ({ id: p.id, title: p.title || p.name || p.id })))
      .then((a) => alive && setAnalytics(a))
      .catch((err) => showToast(`Could not load subscription analytics: ${(err as Error).message}`, 'error'));
    return () => { alive = false; };
  }, [hubId, planKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Retention = active out of all subscriptions that ran (active + ended + cancelled)
  const a = analytics;
  const ran = a ? a.active + a.completed + a.cancelled : 0;
  const retention = a && ran > 0 ? Math.round((a.active / ran) * 1000) / 10 : 0;
  const churn = ran > 0 ? Math.round((100 - retention) * 10) / 10 : 0;
  const totalActive = a?.active ?? 0;
  const topPlans = (a?.perPlan ?? []).slice(0, 3).map((p) => ({ ...p, pct: totalActive ? Math.round((p.n / totalActive) * 100) : 0 }));
  const top = topPlans[0];
  const revenue30 = (a?.last30 ?? 0) / 100;
  const growth = a && a.prev30 > 0 ? Math.round(((a.last30 - a.prev30) / a.prev30) * 1000) / 10 : null;

  const handleOpenAddPackage = () => {
    setEditingPackage(null);
    setPkgTitle('');
    setPkgDuration('30');
    setPkgDiscount('10');
    setPkgBadge('10% OFF');
    setPkgOrder(String(prepaidPackages.length + 1));
    setPkgRecommended(false);
    setPkgActive(true);
    setPkgHubId(selectedHubId || 'all');
    setPkgProductId('all');
    setIsPackageModalOpen(true);
  };

  const handleOpenEditPackage = (pkg: PrepaidPackage) => {
    setEditingPackage(pkg);
    setPkgTitle(pkg.title || pkg.name || '');
    setPkgDuration(String(pkg.durationDays));
    setPkgDiscount(String(pkg.discountPercent));
    setPkgBadge(pkg.badgeLabel || '');
    setPkgOrder(String(pkg.displayOrder));
    setPkgRecommended(!!pkg.isRecommended);
    setPkgActive(pkg.isActive ?? true);
    setPkgHubId(pkg.hubId || 'all');
    setPkgProductId(pkg.productId || 'all');
    setIsPackageModalOpen(true);
  };

  const handleSavePackage = async () => {
    if (!pkgTitle.trim()) {
      showToast('Please enter a package title', 'error');
      return;
    }

    const selectedProduct = products.find((p) => p.id === pkgProductId);
    const selProductName = pkgProductId === 'all' ? 'All Products' : selectedProduct ? selectedProduct.name : '';

    const newPkg: PrepaidPackage = {
      id: editingPackage ? editingPackage.id : '',
      name: pkgTitle,
      title: pkgTitle,
      price: 0,
      durationDays: parseInt(pkgDuration) || 30,
      discountPercent: parseInt(pkgDiscount) || 0,
      badgeLabel: pkgBadge || `${pkgDiscount}% OFF`,
      displayOrder: parseInt(pkgOrder) || 1,
      isRecommended: pkgRecommended,
      isActive: pkgActive,
      hubId: pkgHubId,
      productId: pkgProductId,
      productName: selProductName,
    };

    // "All hubs" copies the plan to every hub this admin manages; a plan tied to a
    // specific product stays in this hub, because products are per hub.
    const targetHubs: HubId[] =
      pkgHubId === 'all' && pkgProductId === 'all' ? allowedHubIds : [isHubId(pkgHubId) ? pkgHubId : hubId];

    try {
      await savePlan(targetHubs, newPkg);
      showToast(`${editingPackage ? 'Updated' : 'Created'} plan "${newPkg.title}"${targetHubs.length > 1 ? ' for all hubs' : ''}!`, 'success');
      setIsPackageModalOpen(false);
    } catch (e) {
      showToast(`Could not save plan: ${(e as Error).message}`, 'error');
    }
  };

  const handleDeletePackage = async (id: string) => {
    try {
      await deletePlan(hubId, id);
      showToast('Deleted package tier.', 'info');
    } catch (e) {
      showToast(`Could not delete plan: ${(e as Error).message}`, 'error');
    }
  };

  // Filter Expiring List
  const filteredExpiring = useMemo(() => {
    return expiringList.filter((item: ExpiringSubscription) => {
      const matchesSearch =
        item.customerName.toLowerCase().includes(expiringSearch.toLowerCase()) ||
        item.phone.includes(expiringSearch) ||
        item.productName.toLowerCase().includes(expiringSearch.toLowerCase());
      if (!matchesSearch) return false;

      if (riskFilter === 'high' && item.churnRisk !== 'High') return false;
      if (riskFilter === 'medium' && item.churnRisk !== 'Medium') return false;
      if (riskFilter === 'low' && item.churnRisk !== 'Low') return false;

      return true;
    });
  }, [expiringList, expiringSearch, riskFilter]);

  return (
    <DataState loading={plansQuery.loading} error={plansQuery.error} onRetry={plansQuery.retry} loadingLabel="Loading plans…">
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      
      {/* Header Banner */}
      <div style={{
        backgroundColor: '#ECFDF5',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        border: '1px solid #A7F3D0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            backgroundColor: '#047857',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <BarChart2 size={24} />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#064E3B' }}>
              📊 Subscription Analytics &amp; Plans Console
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#047857', marginTop: '3px' }}>
              Track subscription retention metrics, expiring customer alerts, and configure app checkout prepaid discount packages for {hubCodeName}.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={async () => {
              const headers = ['Package Title', 'Duration Days', 'Discount %', 'Active Subscribers', 'Paid by them (₹)', 'Target Hub', 'Target Product'];
              // Active subscriptions on each plan and what they paid (count/sum queries)
              const stats = await Promise.all(displayedPackages.map((pkg) => getAggregateFromServer(
                query(hubCol(hubId, 'subscriptions'), where('status', '==', 'active'), where('planId', '==', pkg.id)),
                { n: count(), paid: sum('amountPaid') }).then((a) => a.data()).catch(() => ({ n: 0, paid: 0 }))));
              const rows = displayedPackages.map((pkg, idx) => {
                const count = stats[idx].n;
                const estRev = (stats[idx].paid ?? 0) / 100;
                return [
                  `"${pkg.title}"`,
                  pkg.durationDays,
                  `"${pkg.discountPercent || 0}%"`,
                  count,
                  `"₹${Math.round(estRev)}"`,
                  `"${pkg.hubId || 'All'}"`,
                  `"${pkg.productName || 'All'}"`
                ].join(',');
              });
              const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
              const link = document.createElement('a');
              link.setAttribute('href', encodeURI(csvContent));
              link.setAttribute('download', `Subscription_Packages_Analytics_${isHosur ? 'Hosur' : 'Bangalore'}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              showToast('Exported Subscription Analytics to CSV!', 'success');
            }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              backgroundColor: '#FFFFFF',
              color: '#047857',
              fontWeight: 700,
              fontSize: '0.8rem',
              border: '1px solid #A7F3D0',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            📊 Export Analytics CSV
          </button>

          <button
            onClick={handleOpenAddPackage}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              backgroundColor: '#047857',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.8rem',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={16} /> Create New Prepaid Package
          </button>
        </div>
      </div>

      {/* SECTION 1: Subscription Growth & Retention Analytics Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        
        {/* Card 1: Retention & Churn Rate */}
        <div className="card-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>RETENTION &amp; CHURN</span>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#047857', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '8px' }}>{a ? `${totalActive} active` : '…'}</span>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.4rem', fontFamily: 'var(--font-title)' }}>
              {a ? `${retention}%` : '…'}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Still active out of all subscriptions ({a?.cancelled ?? 0} cancelled, {a?.completed ?? 0} ended)
            </div>
          </div>

          {/* Retention Progress Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, marginBottom: '4px' }}>
              <span style={{ color: '#047857' }}>Active Retained ({retention}%)</span>
              <span style={{ color: '#DC2626' }}>Churn ({churn}%)</span>
            </div>
            <div style={{ height: '8px', backgroundColor: '#FEE2E2', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${retention}%`, backgroundColor: '#047857', height: '100%' }}></div>
            </div>
          </div>
        </div>

        {/* Card 2: Plan Duration Popularity */}
        <div className="card-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PACKAGE PREFERENCE</span>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0284C7', backgroundColor: '#EFF6FF', padding: '2px 8px', borderRadius: '8px' }}>Top: {top && top.n > 0 ? top.title : '—'}</span>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.4rem', fontFamily: 'var(--font-title)' }}>
              {top ? `${top.pct}%` : '0%'}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {top && top.n > 0 ? `of active subscribers choose ${top.title}` : 'No active subscriptions on a plan yet'}
            </div>
          </div>

          {/* Multi-Bar Graph */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {topPlans.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
                <span style={{ width: '90px', color: 'var(--text-muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                <div style={{ flex: 1, backgroundColor: 'var(--bg-main)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${p.pct}%`, backgroundColor: ['#047857', '#0284C7', '#9333EA'][i], height: '100%' }}></div>
                </div>
                <span style={{ fontWeight: 800, width: '30px' }}>{p.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Monthly Recurring Sub Revenue */}
        <div className="card-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>FORECAST REVENUE</span>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#9333EA', backgroundColor: '#F3E8FF', padding: '2px 8px', borderRadius: '8px' }}>MRR Growth</span>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#047857', marginTop: '0.4rem', fontFamily: 'var(--font-title)' }}>
              ₹{revenue30.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Subscription deliveries, last 30 days (closed days)
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', backgroundColor: 'var(--bg-main)', padding: '6px 10px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={15} color="#047857" /> <span>{growth === null ? 'No earlier 30 days to compare yet' : `${growth >= 0 ? '+' : ''}${growth}% vs previous 30 days`}</span>
          </div>
        </div>

      </div>

      {/* SECTION 2: 🎁 Prepaid Subscription Packages (Offered in Customer App Checkout for All Hubs) */}
      <div className="card-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🎁 Prepaid Subscription Packages (Offered in Customer App Checkout for All Hubs)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              These package tiers are displayed directly on customer mobile app subscription checkout.
            </p>
          </div>

          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#047857', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '3px 10px', borderRadius: '12px' }}>
            {displayedPackages.filter((p: PrepaidPackage) => p.isActive).length} Active Checkout Packages ({hubCodeName})
          </span>
        </div>

        {/* Packages Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.1rem' }}>
          {displayedPackages.map((pkg: PrepaidPackage) => (
            <div
              key={pkg.id}
              style={{
                backgroundColor: 'var(--bg-main)',
                borderRadius: '14px',
                border: pkg.isRecommended ? '2px solid #047857' : '1px solid var(--border-color)',
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
                position: 'relative'
              }}
            >
              {pkg.isRecommended && (
                <span style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '14px',
                  backgroundColor: '#047857',
                  color: '#FFFFFF',
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '8px',
                  letterSpacing: '0.05em'
                }}>
                  ⭐ RECOMMENDED
                </span>
              )}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    {pkg.title}
                  </h4>
                  <span style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    backgroundColor: (pkg.discountPercent || 0) > 0 ? '#ECFDF5' : '#F1F5F9',
                    color: (pkg.discountPercent || 0) > 0 ? '#047857' : '#64748B',
                    border: (pkg.discountPercent || 0) > 0 ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                    padding: '3px 9px',
                    borderRadius: '8px'
                  }}>
                    {pkg.badgeLabel}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '12px', marginTop: '0.35rem' }}>
                  <span>Duration: <strong>{pkg.durationDays} Days</strong></span>
                  <span>Discount: <strong>{pkg.discountPercent || 0}% OFF</strong></span>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    backgroundColor: '#F3F4F6',
                    color: '#374151',
                    padding: '2px 7px',
                    borderRadius: '6px',
                    border: '1px solid #E5E7EB'
                  }}>
                    🏢 Hub: {pkg.hubId === 'hosur' ? 'Hosur' : pkg.hubId === 'bengaluru' ? 'Bangalore E-City' : 'All Hubs (Global)'}
                  </span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    padding: '2px 7px',
                    borderRadius: '6px',
                    border: '1px solid #BFDBFE'
                  }}>
                    🥛 Product: {pkg.productName || (pkg.productId && pkg.productId !== 'all' ? pkg.productId : 'All Products')}
                  </span>
                </div>

                <div style={{ fontSize: '0.74rem', color: pkg.isActive ? '#047857' : '#DC2626', fontWeight: 700, marginTop: '0.5rem' }}>
                  {pkg.isActive ? '🟢 Active in App Checkout' : '🔴 Hidden from Checkout'}
                </div>
              </div>

              {/* Actions */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Display Order: #{pkg.displayOrder}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleOpenEditPackage(pkg)}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                  <button
                    onClick={() => handleDeletePackage(pkg.id)}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '6px',
                      border: '1px solid #FCA5A5',
                      backgroundColor: '#FEE2E2',
                      color: '#EF4444',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: ⚠️ Expiring Subscriptions & Customer Maintenance Track */}
      <div className="card-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚠️ Expiring Subscriptions &amp; Customer Retention Track
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Identify subscribers expiring within the next 15 days to offer timely renewals and maintain high retention.
            </p>
          </div>

          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#D97706', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', padding: '4px 12px', borderRadius: '14px' }}>
            {expiringList.length} Plans Expiring Soon
          </span>
        </div>

        {/* Unified Filter Toolbar */}
        <div style={{ padding: '0.85rem 1rem', marginBottom: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Expiring' },
              { id: 'high', label: '🔴 High Churn Risk' },
              { id: 'medium', label: '🟡 Medium Risk' },
              { id: 'low', label: '🟢 Low Risk' },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setRiskFilter(r.id as any)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: riskFilter === r.id ? '#047857' : 'var(--bg-card)',
                  color: riskFilter === r.id ? '#FFFFFF' : 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '230px' }}>
            <input 
              type="text" 
              placeholder="Search customer, phone..." 
              value={expiringSearch}
              onChange={(e) => setExpiringSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                fontSize: '0.78rem',
                color: 'var(--text-main)',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Expiring Subscriptions Data Table */}
        <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 0.85rem' }}>CUSTOMER &amp; CONTACT</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>SUBSCRIBED PLAN</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>EXPIRY DATE</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>COUNTDOWN</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>CHURN RISK</th>
                <th style={{ padding: '0.75rem 0.85rem' }}>RETENTION ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpiring.map((exp: ExpiringSubscription) => (
                <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 0.85rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>{exp.customerName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📞 {exp.phone}</div>
                  </td>

                  <td style={{ padding: '0.75rem 0.85rem' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>{exp.productName}</div>
                    <div style={{ fontSize: '0.74rem', color: '#047857', fontWeight: 700 }}>{exp.planDuration}</div>
                  </td>

                  <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                    📅 {exp.expiryDate}
                  </td>

                  <td style={{ padding: '0.75rem 0.85rem' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      backgroundColor: exp.daysLeft <= 3 ? '#FEF2F2' : '#FFFBEB',
                      color: exp.daysLeft <= 3 ? '#DC2626' : '#D97706',
                      border: exp.daysLeft <= 3 ? '1px solid #FCA5A5' : '1px solid #FDE68A'
                    }}>
                      ⏳ {exp.daysLeft} Days Left
                    </span>
                  </td>

                  <td style={{ padding: '0.75rem 0.85rem' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '10px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: exp.churnRisk === 'High' ? '#FEE2E2' : exp.churnRisk === 'Medium' ? '#FEF3C7' : '#D1FAE5',
                      color: exp.churnRisk === 'High' ? '#991B1B' : exp.churnRisk === 'Medium' ? '#92400E' : '#065F46'
                    }}>
                      {exp.churnRisk === 'High' ? '🔴 High Risk' : exp.churnRisk === 'Medium' ? '⚠️ Medium Risk' : '🟢 Low Risk'}
                    </span>
                  </td>

                  <td style={{ padding: '0.75rem 0.85rem' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        disabled={busyId === exp.id}
                        onClick={async () => {
                          setBusyId(exp.id);
                          try {
                            await sendRenewalReminder(exp.customerUid, exp.productName, exp.expiryDate);
                            showToast(`Renewal reminder sent to ${exp.customerName} in the app`, 'success');
                          } catch (err) {
                            showToast(`Could not send: ${(err as Error).message}`, 'error');
                          } finally { setBusyId(null); }
                        }}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-main)',
                          color: 'var(--text-main)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <RefreshCw size={12} /> Send reminder
                      </button>
                      
                      <button
                        onClick={() => {
                          if (!window.confirm(`Give ${exp.customerName} 30 extra days for free? (Ends ${exp.expiryDate} now.)`)) return;
                          setBusyId(exp.id);
                          extendSubscription(hubId, exp.id, exp.endKey, 30)
                            .then((next) => showToast(`Extended ${exp.customerName}'s plan to ${formatDay(next)}`, 'success'))
                            .catch((err) => showToast(`Could not extend: ${(err as Error).message}`, 'error'))
                            .finally(() => setBusyId(null));
                        }}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          backgroundColor: '#047857',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        + Extend Plan
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpiring.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No expiring subscriptions match your risk filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PACKAGE EDIT / ADD MODAL */}
      {isPackageModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            padding: '1.5rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                {editingPackage ? 'Edit Prepaid Package' : 'Create New Prepaid Package'}
              </h3>
              <button
                onClick={() => setIsPackageModalOpen(false)}
                style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>Package Title</label>
                <input
                  type="text"
                  placeholder="e.g. 30 Days Gold Plan"
                  value={pkgTitle}
                  onChange={(e) => setPkgTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.82rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>Duration (Days)</label>
                  <input
                    type="number"
                    value={pkgDuration}
                    onChange={(e) => setPkgDuration(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>Discount Percent (%)</label>
                  <input
                    type="number"
                    value={pkgDiscount}
                    onChange={(e) => setPkgDiscount(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>Target Operating Hub</label>
                  <select
                    value={pkgHubId}
                    onChange={(e) => setPkgHubId(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.82rem', outline: 'none', color: 'var(--text-main)' }}
                  >
                    <option value="all">🌐 All Hubs (Global)</option>
                    <option value="hosur">🏢 Hosur Central Hub</option>
                    <option value="bengaluru">🏢 Bangalore Electronic City Hub</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>Target Specific Product</label>
                  <select
                    value={pkgProductId}
                    onChange={(e) => setPkgProductId(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.82rem', outline: 'none', color: 'var(--text-main)' }}
                  >
                    <option value="all">🥛 All Subscription Products (Global Default)</option>
                    {subscriptionProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.price}/{p.unit})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>Badge Label</label>
                  <input
                    type="text"
                    placeholder="e.g. 10% OFF"
                    value={pkgBadge}
                    onChange={(e) => setPkgBadge(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>Display Order</label>
                  <input
                    type="number"
                    value={pkgOrder}
                    onChange={(e) => setPkgOrder(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: 'var(--text-main)' }}>
                  <input
                    type="checkbox"
                    checked={pkgRecommended}
                    onChange={(e) => setPkgRecommended(e.target.checked)}
                  />
                  Recommended Tag
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: 'var(--text-main)' }}>
                  <input
                    type="checkbox"
                    checked={pkgActive}
                    onChange={(e) => setPkgActive(e.target.checked)}
                  />
                  Active in App Checkout
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.85rem' }}>
                <button
                  onClick={() => setIsPackageModalOpen(false)}
                  style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text-main)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePackage}
                  style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', backgroundColor: '#047857', color: '#FFFFFF', border: 'none', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Package
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
    </DataState>
  );
}

