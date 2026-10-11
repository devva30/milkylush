import { useState, useEffect } from 'react';
import { TrendingUp, Users, Calendar, IndianRupee } from 'lucide-react';
import type { Order, Subscription, Product, User } from '../types';
import type { HubId } from '../data/hubs';
import { useHubProducts } from '../data/products';
import { loadAnalysis, type AnalysisData } from '../data/stats';
import { PageLoader, ErrorState } from '../components/common/DataState';

interface AnalysisPageProps {
  selectedHubId: string;
  /** Unused: the page loads its own numbers. Kept so callers compile. */
  orders?: Order[];
  subscriptions?: Subscription[];
  products?: Product[];
  users?: User[];
  totalRevenue?: number;
}

export default function AnalysisPage({
  selectedHubId,
}: AnalysisPageProps) {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const isHosur = selectedHubId === 'hosur';

  const hubId = selectedHubId as HubId;
  const products = useHubProducts(hubId).data;
  const [data, setData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    loadAnalysis(hubId, timeRange)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError((err as Error).message));
    return () => { alive = false; };
  }, [hubId, timeRange, tick]);

  if (error) return <ErrorState message={`Could not load analysis: ${error}`} onRetry={() => setTick((t) => t + 1)} />;
  if (!data) return <PageLoader label="Loading analysis…" />;

  const activeSubsCount = data.subsActive;
  const pausedSubsCount = data.subsPaused;
  const subscriptions = { length: data.subsTotal };
  const users = { length: data.customers };
  // Revenue = captured payments, drops = delivered, from the closed days of the period
  const metrics = {
    revenue: Math.round(data.revenue),
    ordersCount: data.drops,
    periodLabel: timeRange === 'week' ? 'Last 7 Days' : timeRange === 'year' ? 'This Year' : 'Last 30 Days',
    trendText: '▲ Closed days',
  };
  const plan15Count = data.plan15;
  const plan30Count = data.plan30;
  const plan90Count = data.plan90;
  const totalActiveSubs = Math.max(1, activeSubsCount);
  // Renewals = active subscriptions whose end date falls in the window; value = what they paid last time
  const [r7, r15, r30] = data.renew;
  const est7DayRenewals = r7.count;
  const est7DayValue = Math.round(r7.value);
  const est15DayRenewals = r15.count;
  const est15DayValue = Math.round(r15.value);
  const est30DayRenewals = r30.count;
  const est30DayValue = Math.round(r30.value);

  // Dynamic Live Category Distribution & Catalog Metrics
  const totalProducts = products.length;
  const categoryStats = products.reduce((acc, p) => {
    const cat = p.category?.trim() || 'General';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const categoryList = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            Analysis &amp; Operational Insights
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Financial performance &amp; fulfillment metrics for <strong>{isHosur ? 'Hosur Central Hub' : 'Bangalore Electronic City Hub'}</strong> ({metrics.periodLabel}).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['week', 'month', 'year'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className="btn-secondary"
              style={{
                textTransform: 'capitalize',
                padding: '0.35rem 0.85rem',
                backgroundColor: timeRange === r ? 'var(--primary)' : 'var(--bg-main)',
                color: timeRange === r ? '#FFFFFF' : 'var(--text-main)',
                border: timeRange === r ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="metrics-grid-4">
        <div className="metric-card-clean">
          <div>
            <div className="metric-label">{metrics.periodLabel.toUpperCase()} REVENUE</div>
            <div className="metric-val">₹{metrics.revenue.toLocaleString('en-IN')}</div>
            <div className="metric-trend up">{metrics.trendText}</div>
          </div>
          <div className="metric-icon-bg">
            <IndianRupee size={20} />
          </div>
        </div>

        <div className="metric-card-clean">
          <div>
            <div className="metric-label">{metrics.periodLabel.toUpperCase()} ORDERS</div>
            <div className="metric-val">{metrics.ordersCount}</div>
            <div className="metric-trend up">▲ Fulfilled Drops</div>
          </div>
          <div className="metric-icon-bg" style={{ backgroundColor: '#DBEAFE', color: '#2563EB' }}>
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="metric-card-clean">
          <div>
            <div className="metric-label">ACTIVE SUBSCRIPTIONS</div>
            <div className="metric-val">{activeSubsCount}</div>
            <div className="metric-trend up">✔ Daily Recurring</div>
          </div>
          <div className="metric-icon-bg" style={{ backgroundColor: '#D1FAE5', color: '#10B981' }}>
            <Calendar size={20} />
          </div>
        </div>

        <div className="metric-card-clean">
          <div>
            <div className="metric-label">REGISTERED USERS</div>
            <div className="metric-val">{users.length}</div>
            <div className="metric-trend up">▲ Total Customers</div>
          </div>
          <div className="metric-icon-bg" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
            <Users size={20} />
          </div>
        </div>
      </div>

      {/* Grid: Revenue Breakdown & Product Sales Share */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Subscription Status Card */}
        <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Subscription Health</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Active vs Paused vs Cancelled subscriptions ratio</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                <span>Active Subscriptions</span>
                <span style={{ color: '#10B981' }}>{activeSubsCount} ({Math.round((activeSubsCount / Math.max(1, subscriptions.length)) * 100)}%)</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(activeSubsCount / Math.max(1, subscriptions.length)) * 100}%`, height: '100%', backgroundColor: '#10B981' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                <span>Paused Subscriptions</span>
                <span style={{ color: '#F59E0B' }}>{pausedSubsCount} ({Math.round((pausedSubsCount / Math.max(1, subscriptions.length)) * 100)}%)</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(pausedSubsCount / Math.max(1, subscriptions.length)) * 100}%`, height: '100%', backgroundColor: '#F59E0B' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Product Catalog Distribution */}
        <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                Product Catalog Distribution
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Live products &amp; category breakdown for {isHosur ? 'Hosur' : 'Bangalore'}
              </p>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', backgroundColor: '#ECFDF5', padding: '3px 10px', borderRadius: '12px' }}>
              {totalProducts} {totalProducts === 1 ? 'Product' : 'Products'} Live
            </span>
          </div>

          {/* Dynamic Category Badges */}
          {categoryList.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {categoryList.map(([cat, count]) => (
                <span
                  key={cat}
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                  }}
                >
                  {cat}: <strong style={{ color: '#047857' }}>{count}</strong> ({Math.round((count / Math.max(1, totalProducts)) * 100)}%)
                </span>
              ))}
            </div>
          )}

          {/* Full Dynamic Live Products List (Scrollable if multiple) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
            {products.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                No products found in this hub's catalog.
              </div>
            ) : (
              products.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.55rem 0.75rem',
                    backgroundColor: 'var(--bg-main)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: p.inStock ? '#10B981' : '#EF4444',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {p.category || 'General'} · {p.stockStatus === 'limited_stock' ? 'Limited' : p.inStock ? 'In Stock' : 'Out of Stock'}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#047857', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                    ₹{p.price} / {p.unit || 'unit'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Row 2: Prepaid Subscription Packages & Real-Time Renewal Projections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        
        {/* Prepaid Subscription Packages Card */}
        <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              🎁 Prepaid Subscription Packages (Customer App Checkout)
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Offered in Customer Mobile App Checkout across all Hubs
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>15 Days Pack</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{plan15Count} Subscriptions Active · Standard Plan</div>
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', backgroundColor: '#F1F5F9', padding: '3px 8px', borderRadius: '8px' }}>
                0% OFF
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #A7F3D0', backgroundColor: '#ECFDF5' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#047857' }}>30 Days Gold Plan ⭐</div>
                <div style={{ fontSize: '0.74rem', color: '#059669' }}>{plan30Count} Subscriptions Active · Most Popular App Selection</div>
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#FFFFFF', backgroundColor: '#047857', padding: '3px 8px', borderRadius: '8px' }}>
                10% OFF
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #BFDBFE', backgroundColor: '#EFF6FF' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E40AF' }}>90 Days Elite Plan 🚀</div>
                <div style={{ fontSize: '0.74rem', color: '#2563EB' }}>{plan90Count} Subscriptions Active · Maximum Savings Pack</div>
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#FFFFFF', backgroundColor: '#2563EB', padding: '3px 8px', borderRadius: '8px' }}>
                15% OFF
              </span>
            </div>
          </div>
        </div>

        {/* Subscription Renewal Projection (Real-Time) Card */}
        <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              📈 Subscription Renewal Projection (Real-Time)
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Forecasted recurring renewals &amp; upfront cashflow inflow
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Next 7 Days Renewals</span>
              <span style={{ fontWeight: 800, color: '#047857' }}>{est7DayRenewals} Plans (Est. ₹{est7DayValue.toLocaleString('en-IN')})</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.max(15, (est7DayRenewals / Math.max(1, totalActiveSubs)) * 100))}%`, height: '100%', backgroundColor: '#047857' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Next 15 Days Renewals</span>
              <span style={{ fontWeight: 800, color: '#0284C7' }}>{est15DayRenewals} Plans (Est. ₹{est15DayValue.toLocaleString('en-IN')})</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.max(30, (est15DayRenewals / Math.max(1, totalActiveSubs)) * 100))}%`, height: '100%', backgroundColor: '#0284C7' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Next 30 Days Renewals</span>
              <span style={{ fontWeight: 800, color: '#9333EA' }}>{est30DayRenewals} Plans (Est. ₹{est30DayValue.toLocaleString('en-IN')})</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}


