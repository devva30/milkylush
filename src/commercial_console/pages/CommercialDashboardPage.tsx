import React from 'react';
import {
  TrendingUp,
  DollarSign,
  Milk,
  MessageSquare,
  Users,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Calendar,
  FileText
} from 'lucide-react';
import type { Order, UserProfile, Product } from '../../types';

interface CommercialDashboardPageProps {
  selectedHubId: string;
  orders: Order[];
  users: UserProfile[];
  products: Product[];
  totalRevenue: number;
  onNavigateTab: (tab: string) => void;
}

export default function CommercialDashboardPage({
  selectedHubId,
  orders,
  users,
  products,
  totalRevenue,
  onNavigateTab,
}: CommercialDashboardPageProps) {
  const isHosur = selectedHubId === 'hub_hosur_main';
  const hubName = isHosur ? 'Hosur Central Hub' : 'Bangalore Hub';

  // Calculate Key Commercial Metrics
  const completedOrders = orders.filter((o) => o.status === 'delivered');
  const totalGrossRevenue = completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), totalRevenue * 0.4);
  const totalFarmerProcurementCost = totalGrossRevenue * 0.45; // ~45% Milk Procurement Cost
  const totalDeliveryCost = completedOrders.length * 15; // ₹15 per delivery partner drop
  const estimatedNetProfit = totalGrossRevenue - (totalFarmerProcurementCost + totalDeliveryCost);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #166534 0%, #047857 100%)',
          borderRadius: '20px',
          padding: '1.75rem 2rem',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 10px 25px rgba(22, 101, 52, 0.25)',
        }}
      >
        <div>
          <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.9, fontWeight: 700 }}>
            COMMERCIAL &amp; MARKETING CONSOLE • {hubName.toUpperCase()}
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '4px 0 6px', fontFamily: "'Poppins', sans-serif" }}>
            Sales, Profit &amp; Procurement Insights
          </h1>
          <p style={{ fontSize: '0.88rem', margin: 0, opacity: 0.9 }}>
            Real-time analytics for product revenue, P&amp;L performance, farmer milk purchases, and WhatsApp campaigns.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => onNavigateTab('profit-loss')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#FFFFFF',
              color: '#166534',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <TrendingUp size={16} />
            <span>View P&amp;L Statement</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Card 1: Gross Sales */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            padding: '1.25rem',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B' }}>TOTAL GROSS SALES</span>
            <div style={{ backgroundColor: '#DCFCE7', color: '#166534', borderRadius: '10px', padding: '6px' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E293B' }}>
            ₹{totalGrossRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#166534', marginTop: '6px', fontWeight: 700 }}>
            <ArrowUpRight size={14} />
            <span>+14.2% from last week</span>
          </div>
        </div>

        {/* Card 2: Estimated Net Profit */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            padding: '1.25rem',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B' }}>ESTIMATED NET PROFIT</span>
            <div style={{ backgroundColor: '#ECFDF5', color: '#059669', borderRadius: '10px', padding: '6px' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669' }}>
            ₹{estimatedNetProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#059669', marginTop: '6px', fontWeight: 700 }}>
            <span>Net Margin: {totalGrossRevenue > 0 ? ((estimatedNetProfit / totalGrossRevenue) * 100).toFixed(1) : '32'}%</span>
          </div>
        </div>

        {/* Card 3: Farmer Milk Procured */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            padding: '1.25rem',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B' }}>FARMER MILK PROCURED</span>
            <div style={{ backgroundColor: '#FEF3C7', color: '#D97706', borderRadius: '10px', padding: '6px' }}>
              <Milk size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E293B' }}>
            1,850 Liters
          </div>
          <div style={{ fontSize: '0.78rem', color: '#D97706', marginTop: '6px', fontWeight: 700 }}>
            Avg Fat: 4.2% | Avg SNF: 8.5%
          </div>
        </div>

        {/* Card 4: Active WhatsApp Broadcasts */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            padding: '1.25rem',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B' }}>WHATSAPP BROADCASTS</span>
            <div style={{ backgroundColor: '#DCFCE7', color: '#166534', borderRadius: '10px', padding: '6px' }}>
              <MessageSquare size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E293B' }}>
            {users.length} Recipient Alerts
          </div>
          <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: '6px', fontWeight: 700 }}>
            98.4% Delivery Success Rate
          </div>
        </div>
      </div>

      {/* Main Split Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {/* Quick Module Shortcuts Card */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '1.5rem',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
            Commercial Modules
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { id: 'profit-loss', title: 'Profit & Loss Statement', sub: 'Revenue, direct costs, net margins & operating expenses', icon: TrendingUp, color: '#166534', bg: '#DCFCE7' },
              { id: 'sales-detail', title: 'Sales Reports & Ledgers', sub: 'Itemized sales, summary reports, customer ledgers & leaves', icon: FileText, color: '#2563EB', bg: '#DBEAFE' },
              { id: 'farmers', title: 'Farmer Milk Procurement', sub: 'Sellers directory, fat/SNF rate charts & milk purchase logs', icon: Milk, color: '#D97706', bg: '#FEF3C7' },
              { id: 'counter-sales', title: 'Counter POS & Demand Load', sub: 'Direct store billing, route loading sheets & sales requirements', icon: ShoppingBag, color: '#9333EA', bg: '#F3E8FF' },
              { id: 'whatsapp-campaigns', title: 'WhatsApp Marketing & Alerts', sub: 'Promotional campaigns, automated reminders & customer cohorts', icon: MessageSquare, color: '#059669', bg: '#ECFDF5' },
            ].map((item) => {
              const IconComp = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => onNavigateTab(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    borderRadius: '14px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconComp size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1E293B' }}>{item.title}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{item.sub}</div>
                    </div>
                  </div>
                  <ArrowUpRight size={18} style={{ color: '#94A3B8' }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Product Revenue Breakdown */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '1.5rem',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B' }}>
              Top Selling Dairy Products
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('products-analytics')}
              style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              View All Products
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {products.slice(0, 5).map((prod, idx) => {
              const estShare = 100 - idx * 18;
              return (
                <div key={prod.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
                      #{idx + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1E293B' }}>{prod.name}</div>
                      <div style={{ fontSize: '0.76rem', color: '#64748B' }}>₹{prod.price} per {prod.unit || 'pack'}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#166534' }}>
                      ₹{(prod.price * estShare).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>
                      {estShare} units sold
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
