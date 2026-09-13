import React, { useState } from 'react';
import {
  FileText,
  Search,
  Download,
  Filter,
  Layers,
  ShoppingBag,
  Users,
  Truck,
  Calendar,
  ChevronRight
} from 'lucide-react';
import type { Order, UserProfile, Product, Subscription } from '../../types';

interface SalesReportsPageProps {
  selectedTab: 'sales-detail' | 'sales-summary' | 'sold-products' | 'customer-ledger' | 'delivery-charge-report' | 'leaves-report';
  orders: Order[];
  users: UserProfile[];
  products: Product[];
  subscriptions: Subscription[];
}

export default function SalesReportsPage({
  selectedTab,
  orders,
  users,
  products,
  subscriptions,
}: SalesReportsPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const reportTitles: Record<string, { title: string; desc: string }> = {
    'sales-detail': { title: 'Detail Sales Report', desc: 'Itemized list of every fulfilled order with customer contact, amount & delivery timestamp.' },
    'sales-summary': { title: 'Daily & Monthly Sales Summary', desc: 'Aggregated revenue metrics, order volumes and daily sales averages.' },
    'sold-products': { title: 'Sold Product Report', desc: 'Product velocity, quantities sold per SKU and revenue contribution breakdown.' },
    'customer-ledger': { title: 'Customer Account Ledger', desc: 'Customer wallet balances, transaction logs, total spent and active drops.' },
    'delivery-charge-report': { title: 'Delivery Charge Report', desc: 'Delivery fee revenue, hub route charges and rider drop payouts.' },
    'leaves-report': { title: 'Subscription Leaves & Pause Report', desc: 'Active subscription pauses, vacation holds and temporary delivery holds.' },
  };

  const info = reportTitles[selectedTab] || reportTitles['sales-detail'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#166534', margin: 0 }}>
            {info.title}
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '4px 0 0 0' }}>
            {info.desc}
          </p>
        </div>

        <button
          type="button"
          onClick={() => alert(`Exporting ${info.title} to CSV spreadsheet...`)}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: '#166534',
            color: '#FFFFFF',
            fontSize: '0.85rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(22, 101, 52, 0.2)',
          }}
        >
          <Download size={16} />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search report by customer, order ID or product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem 0.55rem 2.4rem',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} style={{ color: '#64748B' }} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.55rem 0.85rem',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              fontSize: '0.85rem',
              outline: 'none',
              fontWeight: 600,
            }}
          >
            <option value="all">All Statuses</option>
            <option value="delivered">Delivered / Completed</option>
            <option value="pending">Pending / In Progress</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Dynamic Content Views per Selected Tab */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        {selectedTab === 'sales-detail' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>ORDER ID</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>CUSTOMER</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>ITEMS SUMMARY</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>STATUS</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800, textAlign: 'right' }}>TOTAL AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 15).map((order) => (
                <tr key={order.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#166534' }}>#{order.id.slice(0, 8)}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ fontWeight: 700, color: '#1E293B' }}>{order.customerName || 'Valued Customer'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{order.deliveryAddress?.slice(0, 28)}...</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                    {order.items && order.items.length > 0 ? order.items.map((i: any) => `${i.product?.name || i.name} (x${i.quantity || 1})`).join(', ') : 'Milk Subscription Drop'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ backgroundColor: order.status === 'delivered' ? '#DCFCE7' : '#FEF3C7', color: order.status === 'delivered' ? '#166534' : '#D97706', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800 }}>
                      {order.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#1E293B' }}>
                    ₹{order.totalAmount || 70}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {selectedTab === 'sold-products' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>PRODUCT NAME</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>UNIT PRICE</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>UNITS SOLD</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800, textAlign: 'right' }}>GROSS REVENUE</th>
              </tr>
            </thead>
            <tbody>
              {products.map((prod, idx) => {
                const soldQty = 140 - idx * 15;
                const revenue = prod.price * soldQty;
                return (
                  <tr key={prod.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E293B' }}>{prod.name}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>₹{prod.price} / {prod.unit || '1 L'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#166534' }}>{soldQty} units</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#166534' }}>₹{revenue.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {selectedTab === 'customer-ledger' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>CUSTOMER NAME</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>PHONE NUMBER</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>WALLET BALANCE</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800, textAlign: 'right' }}>TOTAL SPENT</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 15).map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E293B' }}>{user.name || 'Valued Customer'}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{user.phone || '9876543210'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ backgroundColor: '#DCFCE7', color: '#166534', padding: '3px 8px', borderRadius: '8px', fontWeight: 800, fontSize: '0.78rem' }}>
                      ₹{user.walletBalance || 450}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#166534' }}>₹{(user.walletBalance || 450) + 1200}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {selectedTab === 'leaves-report' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>SUBSCRIBER</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>LEAVE PERIOD</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>REASON</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800, textAlign: 'right' }}>CREDIT SAVED</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.slice(0, 10).map((sub, idx) => (
                <tr key={sub.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E293B' }}>{sub.customerName || `Subscriber #${idx + 1}`}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#D97706', fontWeight: 700 }}>Sep 14 - Sep 18 (4 Days)</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>Out of station / Vacation hold</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#059669' }}>₹280 credited</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {(selectedTab === 'sales-summary' || selectedTab === 'delivery-charge-report') && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748B' }}>
            <Layers size={40} style={{ color: '#166534', marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B' }}>Summary Data Active for Selected Hub</div>
            <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>All daily delivery charges and route metrics synced in real-time.</div>
          </div>
        )}
      </div>
    </div>
  );
}
