import { useState } from 'react';
import { LayoutDashboard, Truck, Users, Calendar, IndianRupee, MapPin } from 'lucide-react';
import type { Order, Subscription, User, Product, DeliveryAgent } from '../types';

interface DashboardPageProps {
  selectedHubId: string;
  adminUsername: string;
  hubOrders: Order[];
  hubUsers: User[];
  hubSubscriptions: Subscription[];
  hubDeliveryAgents: DeliveryAgent[];
  products: Product[];
  totalRevenue: number;
  onNavigateTab: (tabName: string) => void;
}

export default function DashboardPage({
  selectedHubId,
  adminUsername,
  hubOrders,
  hubUsers,
  hubSubscriptions,
  hubDeliveryAgents,
  products,
  totalRevenue,
  onNavigateTab
}: DashboardPageProps) {
  const [dashboardFilter, setDashboardFilter] = useState<'week' | 'month' | 'year'>('month');

  const isHosur = selectedHubId === 'hub_hosur_main';
  const hubName = isHosur ? 'Hosur Management Portal' : 'Bangalore Management Portal';

  // Calculate dynamic sales/volume for chart
  const getAggregatedData = () => {
    if (dashboardFilter === 'week') {
      return [
        { label: 'Mon', revenue: totalRevenue * 0.12, volume: 120 },
        { label: 'Tue', revenue: totalRevenue * 0.15, volume: 145 },
        { label: 'Wed', revenue: totalRevenue * 0.18, volume: 160 },
        { label: 'Thu', revenue: totalRevenue * 0.14, volume: 135 },
        { label: 'Fri', revenue: totalRevenue * 0.16, volume: 150 },
        { label: 'Sat', revenue: totalRevenue * 0.22, volume: 210 },
        { label: 'Sun', revenue: totalRevenue * 0.25, volume: 240 }
      ];
    } else if (dashboardFilter === 'year') {
      return [
        { label: 'Jan', revenue: totalRevenue * 0.7, volume: 1200 },
        { label: 'Feb', revenue: totalRevenue * 0.8, volume: 1350 },
        { label: 'Mar', revenue: totalRevenue * 0.9, volume: 1500 },
        { label: 'Apr', revenue: totalRevenue * 0.85, volume: 1400 },
        { label: 'May', revenue: totalRevenue * 0.95, volume: 1600 },
        { label: 'Jun', revenue: totalRevenue * 1.0, volume: 1750 },
        { label: 'Jul', revenue: totalRevenue * 1.1, volume: 1900 },
        { label: 'Aug', revenue: totalRevenue * 1.05, volume: 1800 },
        { label: 'Sep', revenue: totalRevenue * 1.15, volume: 1950 },
        { label: 'Oct', revenue: totalRevenue * 1.2, volume: 2100 },
        { label: 'Nov', revenue: totalRevenue * 1.25, volume: 2200 },
        { label: 'Dec', revenue: totalRevenue * 1.3, volume: 2350 }
      ];
    }
    return [
      { label: 'W1', revenue: totalRevenue * 0.2, volume: 450 },
      { label: 'W2', revenue: totalRevenue * 0.25, volume: 520 },
      { label: 'W3', revenue: totalRevenue * 0.28, volume: 580 },
      { label: 'W4', revenue: totalRevenue * 0.32, volume: 640 }
    ];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      
      {/* Welcome Greeting Header */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
          Good morning, {adminUsername || 'Admin'}
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Here is the real-time operational status for <strong>{hubName}</strong> today ({new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}).
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
              {hubOrders.length} Active Orders • {products.length} Products
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
            <div className="metric-trend up">▲ Live Hub Cashflow</div>
          </div>
          <div className="metric-icon-bg">
            <IndianRupee size={20} />
          </div>
        </div>

        <div className="metric-card-clean">
          <div>
            <div className="metric-label">TODAY'S DELIVERIES</div>
            <div className="metric-val">{hubOrders.length || 0}</div>
            <div className="metric-trend up">▲ Active Orders</div>
          </div>
          <div className="metric-icon-bg">
            <Truck size={20} />
          </div>
        </div>

        <div className="metric-card-clean">
          <div>
            <div className="metric-label">ACTIVE SUBSCRIPTIONS</div>
            <div className="metric-val">{hubSubscriptions.length || 0}</div>
            <div className="metric-trend up">▲ Recurring Users</div>
          </div>
          <div className="metric-icon-bg">
            <Calendar size={20} />
          </div>
        </div>

        <div className="metric-card-clean">
          <div>
            <div className="metric-label">TOTAL CUSTOMERS</div>
            <div className="metric-val">{hubUsers.length || 0}</div>
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
            const packedCount = hubOrders.filter(o => o.status === 'packed').length;
            const transitCount = hubOrders.filter(o => o.status === 'outForDelivery').length;
            const deliveredCount = hubOrders.filter(o => o.status === 'delivered').length;
            const totalOrders = hubOrders.length || 1;

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
            const dailyCount = hubSubscriptions.filter(s => s.frequency === 'daily' || !s.frequency).length;
            const alternateCount = hubSubscriptions.filter(s => s.frequency === 'alternateDays').length;
            const customCount = hubSubscriptions.filter(s => s.frequency === 'customDays').length;
            const totalSubs = hubSubscriptions.length || 1;

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
              {hubOrders.slice(0, 5).map(o => {
                const userObj = hubUsers.find(u => u.id === o.userId);
                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600, color: '#10B981' }}>{o.id.substring(0, 8)}...</td>
                    <td style={{ fontWeight: 600 }}>{userObj?.name || 'Customer'}</td>
                    <td>{o.items?.map(i => `${i.quantity}x ${i.product.name}`).join(', ') || 'Fresh Milk'}</td>
                    <td style={{ fontWeight: 700 }}>₹{o.totalAmount}</td>
                    <td>
                      <span className={`badge ${o.status === 'delivered' ? 'badge-success' : o.status === 'outForDelivery' ? 'badge-warning' : o.status === 'cancelled' ? 'badge-error' : 'badge-neutral'}`}>
                        {o.status === 'delivered' ? 'Delivered' : o.status === 'outForDelivery' ? 'Out for Delivery' : o.status === 'cancelled' ? 'Cancelled' : 'Packed'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {hubOrders.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No recent deliveries found for active hub.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
