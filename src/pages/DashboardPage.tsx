import { useState, useEffect } from 'react';
import { LayoutDashboard, Truck, Users, Calendar, IndianRupee, MapPin } from 'lucide-react';
import type { Order, Subscription, User, Product, DeliveryAgent } from '../types';
import type { HubId } from '../data/hubs';
import { todayKey, formatDay } from '../data/dates';
import { useHubCounts, loadDayStats, loadMonthStats, loadRecentOrders, type RecentOrder } from '../data/stats';
import { PageLoader, ErrorState } from '../components/common/DataState';

interface DashboardPageProps {
  selectedHubId: string;
  adminUsername: string;
  /** Unused: the dashboard loads counts itself. Kept so callers compile. */
  hubOrders?: Order[];
  hubUsers?: User[];
  hubSubscriptions?: Subscription[];
  hubDeliveryAgents: DeliveryAgent[];
  products?: Product[];
  totalRevenue?: number;
  onNavigateTab: (tabName: string) => void;
}

export default function DashboardPage({
  selectedHubId,
  adminUsername,
  hubDeliveryAgents,
  onNavigateTab
}: DashboardPageProps) {
  const [dashboardFilter, setDashboardFilter] = useState<'week' | 'month' | 'year'>('month');

  const isHosur = selectedHubId === 'hosur';
  const hubName = isHosur ? 'Hosur Management Portal' : 'Bangalore Management Portal';

  const hubId = selectedHubId as HubId;
  const { counts, error, retry } = useHubCounts(hubId);
  const [chartData, setChartData] = useState<{ label: string; revenue: number; volume: number }[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  // Chart from the closed-day totals: revenue (₹) bars, delivered drops line
  useEffect(() => {
    let alive = true;
    const toPoint = (label: string, st: { revenue: number; deliveriesDone: number }) => ({ label, revenue: st.revenue / 100, volume: st.deliveriesDone });
    (async () => {
      if (dashboardFilter === 'year') {
        const months = await loadMonthStats(hubId, todayKey().slice(0, 4));
        const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months.map((m, i) => toPoint(names[i], m.stats));
      }
      if (dashboardFilter === 'week') {
        const days = await loadDayStats(hubId, 7);
        return days.map((d) => toPoint(formatDay(d.date).slice(0, 6), d.stats));
      }
      const days = await loadDayStats(hubId, 28);
      return [0, 1, 2, 3].map((w) => {
        const part = days.slice(w * 7, w * 7 + 7);
        return toPoint(`W${w + 1}`, {
          revenue: part.reduce((a, d) => a + d.stats.revenue, 0),
          deliveriesDone: part.reduce((a, d) => a + d.stats.deliveriesDone, 0),
        });
      });
    })().then((pts) => alive && setChartData(pts)).catch((err) => console.warn('Dashboard chart:', err));
    return () => { alive = false; };
  }, [hubId, dashboardFilter]);

  useEffect(() => {
    let alive = true;
    loadRecentOrders(hubId).then((o) => alive && setRecentOrders(o)).catch((err) => console.warn('Recent orders:', err));
    return () => { alive = false; };
  }, [hubId]);

  if (error) return <ErrorState message={`Could not load the dashboard: ${error}`} onRetry={retry} />;
  if (!counts) return <PageLoader label="Loading dashboard…" />;
  const c = counts;
  const totalRevenue = c.monthRevenue / 100;
  const getAggregatedData = () => chartData;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      
      {/* Welcome Greeting Header */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
          Good morning, {adminUsername || 'Admin'}
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Here is the real-time operational status for <strong>{hubName}</strong> today ({formatDay(todayKey())}).
        </p>
      </div>

      {/* 3 Quick Banner Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        
        {/* Banner 1: Catalog & Orders */}
        <div 
          onClick={() => onNavigateTab('orders')}
          style={{
            background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
            borderRadius: '16px',
            padding: '1.25rem',
            color: '#FFFFFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)'
          }}
        >
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} /> {isHosur ? 'HOSUR PORTAL' : 'BANGALORE PORTAL'}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-title)' }}>
              Catalog &amp; Orders
            </div>
            <div style={{ fontSize: '0.75rem', opacity: 0.95, marginTop: '4px' }}>
              {c.placedOrders} Active Orders • {c.products} Products
            </div>
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.6rem', borderRadius: '12px' }}>
            <LayoutDashboard size={24} />
          </div>
        </div>

        {/* Banner 2: Delivery & Dispatch */}
        <div 
          onClick={() => onNavigateTab('delivery')}
          style={{
            background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
            borderRadius: '16px',
            padding: '1.25rem',
            color: '#FFFFFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 14px rgba(217, 119, 6, 0.25)'
          }}
        >
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} /> {isHosur ? 'HOSUR FLEET' : 'BANGALORE FLEET'}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-title)' }}>
              Delivery &amp; Dispatch
            </div>
            <div style={{ fontSize: '0.75rem', opacity: 0.95, marginTop: '4px' }}>
              {hubDeliveryAgents.length} Active Partners • Realtime Board
            </div>
          </div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.6rem', borderRadius: '12px' }}>
            <Truck size={24} />
          </div>
        </div>

        {/* Banner 3: Admin Access Control */}
        <div 
          onClick={() => onNavigateTab('admin-access')}
          style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            borderRadius: '16px',
            padding: '1.25rem',
            color: '#FFFFFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)'
          }}
        >
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#10B981', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} /> {isHosur ? 'HOSUR SECURITY' : 'BANGALORE SECURITY'}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-title)' }}>
              Admin Access Control
            </div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '4px' }}>
              Account Controls • Security Access
            </div>
          </div>
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: '0.6rem', borderRadius: '12px', color: '#10B981' }}>
            <Users size={24} />
          </div>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="metrics-grid-4">
        <div className="metric-card-clean">
          <div>
            <div className="metric-label">TOTAL REVENUE</div>
            <div className="metric-val">₹{totalRevenue.toLocaleString('en-IN')}</div>
            <div className="metric-trend up">▲ This month (closed days)</div>
          </div>
          <div className="metric-icon-bg">
            <IndianRupee size={20} />
          </div>
        </div>

        <div className="metric-card-clean">
          <div>
            <div className="metric-label">TODAY'S DELIVERIES</div>
            <div className="metric-val">{c.todayTotal}</div>
            <div className="metric-trend up">▲ Active Orders</div>
          </div>
          <div className="metric-icon-bg">
            <Truck size={20} />
          </div>
        </div>

        <div className="metric-card-clean">
          <div>
            <div className="metric-label">ACTIVE SUBSCRIPTIONS</div>
            <div className="metric-val">{c.activeSubscriptions}</div>
            <div className="metric-trend up">▲ Recurring Users</div>
          </div>
          <div className="metric-icon-bg">
            <Calendar size={20} />
          </div>
        </div>

        <div className="metric-card-clean">
          <div>
            <div className="metric-label">TOTAL CUSTOMERS</div>
            <div className="metric-val">{c.customers}</div>
            <div className="metric-trend up">▲ Registered Users</div>
          </div>
          <div className="metric-icon-bg">
            <Users size={20} />
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="card-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Sales &amp; Milk Delivery Performance</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {dashboardFilter === 'week' ? 'Last 7 Days Dynamic Sales & Volume' : dashboardFilter === 'year' ? 'Last 12 Months Sales & Volume' : 'Last 30 Days Sales & Volume Overview'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {(['week', 'month', 'year'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setDashboardFilter(filter)}
                className="btn-secondary"
                style={{
                  textTransform: 'capitalize',
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.75rem',
                  backgroundColor: dashboardFilter === filter ? 'var(--primary)' : '#FFFFFF',
                  color: dashboardFilter === filter ? '#FFFFFF' : 'var(--text-main)',
                  borderColor: dashboardFilter === filter ? 'var(--primary)' : 'var(--border-color)',
                  fontWeight: 600,
                  borderRadius: '6px'
                }}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: '100%', height: '220px' }}>
          {(() => {
            const chartData = getAggregatedData();
            const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1000);
            const maxVolume = Math.max(...chartData.map(d => d.volume), 10);
            const numPoints = chartData.length;
            const colWidth = 900 / numPoints;

            const linePath = chartData.map((d, idx) => {
              const x = 50 + (idx + 0.5) * colWidth;
              const y = 180 - (d.volume / maxVolume) * 140;
              return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ');

            return (
              <svg viewBox="0 0 1000 220" style={{ width: '100%', height: '100%' }}>
                <line x1="50" y1="30" x2="950" y2="30" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="50" y1="80" x2="950" y2="80" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="50" y1="130" x2="950" y2="130" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="50" y1="180" x2="950" y2="180" stroke="var(--border-color)" strokeWidth="1.5" />

                <text x="25" y="34" fontSize="10" fill="var(--text-muted)" textAnchor="end">₹{(maxRevenue / 1000).toFixed(1)}k</text>
                <text x="25" y="84" fontSize="10" fill="var(--text-muted)" textAnchor="end">₹{(maxRevenue * 0.66 / 1000).toFixed(1)}k</text>
                <text x="25" y="134" fontSize="10" fill="var(--text-muted)" textAnchor="end">₹{(maxRevenue * 0.33 / 1000).toFixed(1)}k</text>
                <text x="25" y="184" fontSize="10" fill="var(--text-muted)" textAnchor="end">₹0</text>

                {chartData.map((item, idx) => {
                  const x = 50 + (idx + 0.5) * colWidth;
                  const height = (item.revenue / maxRevenue) * 140;
                  const y = 180 - height;
                  const barWidth = Math.min(32, colWidth * 0.6);
                  return (
                    <g key={idx}>
                      <rect 
                        x={x - barWidth / 2} 
                        y={y} 
                        width={barWidth} 
                        height={height} 
                        rx="4" 
                        fill="var(--primary)" 
                        opacity="0.85" 
                      />
                      <text x={x} y="202" fontSize="11" fill="var(--text-muted)" textAnchor="middle" fontWeight="600">{item.label}</text>
                    </g>
                  );
                })}

                {chartData.length > 0 && (
                  <>
                    <path d={linePath} fill="none" stroke="#D97706" strokeWidth="3" strokeLinecap="round" />
                    {chartData.map((item, idx) => {
                      const x = 50 + (idx + 0.5) * colWidth;
                      const y = 180 - (item.volume / maxVolume) * 140;
                      return (
                        <g key={`dot-${idx}`}>
                          <circle cx={x} cy={y} r="5" fill="#FFFFFF" stroke="#D97706" strokeWidth="2.5" />
                          <title>{`Revenue: ₹${item.revenue}, Vol: ${item.volume}L`}</title>
                        </g>
                      );
                    })}
                  </>
                )}
              </svg>
            );
          })()}
        </div>
      </div>

      {/* Dynamic Breakdowns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Order Status Breakdown */}
        <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Order Pipeline Breakdown</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Real-time status of orders in fulfillment flow</p>
          </div>
          {(() => {
            // today's drops by status
            const packedCount = c.todayScheduled;
            const transitCount = c.todayOut;
            const deliveredCount = c.todayDelivered;
            const totalOrders = c.todayTotal || 1;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                    <span>Packed / Hub Pending</span>
                    <span>{packedCount} orders ({Math.round(packedCount / totalOrders * 100)}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${packedCount / totalOrders * 100}%`, height: '100%', backgroundColor: 'var(--text-muted)', borderRadius: '4px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                    <span>Transit / Out for Delivery</span>
                    <span>{transitCount} orders ({Math.round(transitCount / totalOrders * 100)}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${transitCount / totalOrders * 100}%`, height: '100%', backgroundColor: '#D97706', borderRadius: '4px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                    <span>Delivered Successfully</span>
                    <span>{deliveredCount} orders ({Math.round(deliveredCount / totalOrders * 100)}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${deliveredCount / totalOrders * 100}%`, height: '100%', backgroundColor: '#10B981', borderRadius: '4px' }}></div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Subscription Plans Breakdown */}
        <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Subscription Frequency & Plan Share</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Usage distribution of user delivery schedules</p>
          </div>
          {(() => {
            const dailyCount = c.subsDaily;
            const alternateCount = c.subsAlternate;
            const customCount = c.subsCustom;
            const totalSubs = c.activeSubscriptions || 1;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                    <span>Every Single Day</span>
                    <span>{dailyCount} plans ({Math.round(dailyCount / totalSubs * 100)}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${dailyCount / totalSubs * 100}%`, height: '100%', backgroundColor: '#10B981', borderRadius: '4px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                    <span>Alternate Days Schedule</span>
                    <span>{alternateCount} plans ({Math.round(alternateCount / totalSubs * 100)}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${alternateCount / totalSubs * 100}%`, height: '100%', backgroundColor: '#3B82F6', borderRadius: '4px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                    <span>Custom Weekdays Calendar</span>
                    <span>{customCount} plans ({Math.round(customCount / totalSubs * 100)}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${customCount / totalSubs * 100}%`, height: '100%', backgroundColor: '#8B5CF6', borderRadius: '4px' }}></div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

      </div>

      {/* Recent Deliveries Table */}
      <div className="card-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', fontWeight: 700 }}>Recent Deliveries Overview</h3>
          <button className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }} onClick={() => onNavigateTab('orders')}>
            View All Orders &rarr;
          </button>
        </div>
        <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Products Included</th>
                <th>Total Amount</th>
                <th>Fulfillment Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(o => {
                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600, color: '#10B981' }}>{o.id}</td>
                    <td style={{ fontWeight: 600 }}>{o.customerName}</td>
                    <td>{o.items.map(i => `${i.qty}x ${i.name}`).join(', ') || '—'}</td>
                    <td style={{ fontWeight: 700 }}>₹{o.total}</td>
                    <td>
                      <span className={`badge ${o.status === 'delivered' ? 'badge-success' : o.status === 'placed' ? 'badge-warning' : o.status === 'cancelled' || o.status === 'failed' ? 'badge-error' : 'badge-neutral'}`}>
                        {o.status === 'delivered' ? 'Delivered' : o.status === 'placed' ? 'Placed' : o.status === 'cancelled' ? 'Cancelled' : o.status === 'failed' ? 'Failed' : 'Awaiting payment'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No orders yet for this hub.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
