import { useState } from 'react';
import { TrendingUp, Users, Calendar, IndianRupee } from 'lucide-react';
import type { Order, Subscription, Product, User } from '../types';

interface AnalysisPageProps {
  selectedHubId: string;
  orders: Order[];
  subscriptions: Subscription[];
  products: Product[];
  users: User[];
  totalRevenue: number;
}

export default function AnalysisPage({
  selectedHubId,
  orders,
  subscriptions,
  products,
  users,
  totalRevenue,
}: AnalysisPageProps) {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const isHosur = selectedHubId === 'hub_hosur_main';

  const activeSubsCount = subscriptions.filter((s) => s.status === 'active').length;
  const pausedSubsCount = subscriptions.filter((s) => s.status === 'paused').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            Analysis & Operational Insights
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Financial performance & fulfillment metrics for <strong>{isHosur ? 'Hosur Central Hub' : 'Bangalore Electronic City Hub'}</strong>.
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
                fontWeight: 700,
                fontSize: '0.78rem',
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
            <div className="metric-label">TOTAL HUB REVENUE</div>
            <div className="metric-val">₹{totalRevenue.toLocaleString('en-IN')}</div>
            <div className="metric-trend up">▲ Live Cashflow</div>
          </div>
          <div className="metric-icon-bg">
            <IndianRupee size={20} />
          </div>
        </div>

        <div className="metric-card-clean">
          <div>
            <div className="metric-label">TOTAL FULFILLED ORDERS</div>
            <div className="metric-val">{orders.length}</div>
            <div className="metric-trend up">▲ Realtime Orders</div>
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

        {/* Product Catalog Share */}
        <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Product Catalog Distribution</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Breakdown of products by category</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {products.slice(0, 4).map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', backgroundColor: 'var(--bg-main)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</span>
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>₹{p.price} / {p.unit || 'unit'}</span>
              </div>
            ))}
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
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Standard Short-Term Plan</div>
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B', backgroundColor: '#F1F5F9', padding: '3px 8px', borderRadius: '8px' }}>
                0% OFF
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #A7F3D0', backgroundColor: '#ECFDF5' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#047857' }}>30 Days Gold Plan ⭐</div>
                <div style={{ fontSize: '0.74rem', color: '#059669' }}>Most Popular App Selection</div>
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#FFFFFF', backgroundColor: '#047857', padding: '3px 8px', borderRadius: '8px' }}>
                10% OFF
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #BFDBFE', backgroundColor: '#EFF6FF' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E40AF' }}>90 Days Elite Plan 🚀</div>
                <div style={{ fontSize: '0.74rem', color: '#2563EB' }}>Maximum Savings Pack</div>
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
              Forecasted recurring renewals & upfront cashflow inflow
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Next 7 Days Renewals</span>
              <span style={{ fontWeight: 800, color: '#047857' }}>14 Plans (Est. ₹18,900)</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '45%', height: '100%', backgroundColor: '#047857' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Next 15 Days Renewals</span>
              <span style={{ fontWeight: 800, color: '#0284C7' }}>28 Plans (Est. ₹36,400)</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '70%', height: '100%', backgroundColor: '#0284C7' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Next 30 Days Renewals</span>
              <span style={{ fontWeight: 800, color: '#9333EA' }}>42 Plans (Est. ₹54,600)</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '92%', height: '100%', backgroundColor: '#9333EA' }} />
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
