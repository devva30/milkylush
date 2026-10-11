import React, { useState, useMemo, useEffect } from 'react';
import { getDoc, query, where } from 'firebase/firestore';
import { useHubContext } from '../../context/HubContext';
import { hubCol, hubDoc, type HubId } from '../../data/hubs';
import { formatDay, todayKey } from '../../data/dates';
import { useDeliveriesRange, deliveryToOrder } from '../../data/deliveries';
import { useHubCustomers, type Customer, type CustomerSummary } from '../../data/customers';
import { useHubSubscriptions, type SubscriptionDoc } from '../../data/subscriptions';
import { useHubRoutes } from '../../data/routes';
import { useLiveQuery } from '../../data/useFirestore';
import { usePeriodTotals, periodRange, type Period } from '../../data/commercial';
import { LoadMore } from '../../components/common/DataState';
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
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import type { Order, UserProfile, Product, Subscription } from '../../types';

interface SalesReportsPageProps {
  selectedTab: 'sales-detail' | 'sales-summary' | 'sold-products' | 'customer-ledger' | 'delivery-charge-report' | 'leaves-report';
  /** Unused: each report loads its own data for the chosen period. */
  orders?: Order[];
  users?: UserProfile[];
  products?: Product[];
  subscriptions?: Subscription[];
}

export default function SalesReportsPage({
  selectedTab,
}: SalesReportsPageProps) {
  const { selectedHubId } = useHubContext();
  const hubId = selectedHubId as HubId;
  const [period, setPeriod] = useState<Period>('month');
  const range = periodRange(period);
  const totals = usePeriodTotals(hubId, period);
  // Detail report: delivered drops of the period, 50 per page
  const delivered = useDeliveriesRange(hubId, range.from, range.to, 'delivered');
  const orders = useMemo(() => delivered.data.map(deliveryToOrder), [delivered.data]);
  const customers = useHubCustomers(hubId);
  const routes = useHubRoutes(hubId);
  const paused = useHubSubscriptions(hubId, 'paused');
  // Active subscriptions on a vacation that hasn't ended yet
  const onVacation = useLiveQuery<SubscriptionDoc>(
    query(hubCol(hubId, 'subscriptions'), where('status', '==', 'active'), where('vacationEnd', '>=', todayKey())), [hubId]);
  const [payPerDrop, setPayPerDrop] = useState(0);
  useEffect(() => {
    getDoc(hubDoc(hubId, 'settings', 'delivery'))
      .then((d) => setPayPerDrop(Number(d.data()?.riderPayPerDrop) || 0))
      .catch(() => setPayPerDrop(0));
  }, [hubId]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const reportTitles: Record<string, { title: string; desc: string }> = {
    'sales-detail': { title: 'Detail Sales Report', desc: 'Itemized list of every fulfilled order with customer contact, amount & delivery timestamp.' },
    'sales-summary': { title: 'Daily & Monthly Sales Summary', desc: 'Aggregated revenue metrics, order volumes and daily sales averages.' },
    'sold-products': { title: 'Sold Product Report', desc: 'Product velocity, quantities sold per SKU and revenue contribution breakdown.' },
    'customer-ledger': { title: 'Customer Account Ledger', desc: 'Customers with their orders, active subscriptions and total paid.' },
    'delivery-charge-report': { title: 'Delivery Charge Report', desc: 'Delivery fee revenue, hub route charges and rider drop payouts.' },
    'leaves-report': { title: 'Subscription Leaves & Pause Report', desc: 'Active subscription pauses, vacation holds and temporary delivery holds.' },
  };

  const info = reportTitles[selectedTab] || reportTitles['sales-detail'];

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesSearch =
        (o.id && o.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.customerName && o.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchesSearch) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      return true;
    });
  }, [orders, searchTerm, statusFilter]);

  // Daily (or monthly, for this year) sales from closed days
  const salesSummaryList = useMemo(() => (totals.data?.rows ?? [])
    .filter((r) => r.stats.deliveriesDone > 0 || r.stats.counterSales > 0)
    .map((r) => ({
      date: r.key.length === 7 ? r.key : formatDay(r.key),
      totalOrders: r.stats.deliveriesDone,
      subRevenue: (r.stats.subscriptionValue ?? 0) / 100,
      oneTimeRevenue: ((r.stats.orderValue ?? 0) + (r.stats.counterSales ?? 0)) / 100,
      totalRevenue: ((r.stats.deliveredValue ?? 0) + (r.stats.counterSales ?? 0)) / 100,
    }))
    .reverse(), [totals.data]);

  // Per rider: drops delivered, delivery charges collected, payout at settings/delivery.riderPayPerDrop
  const deliveryChargeList = useMemo(() => (totals.data?.riders ?? []).map((r) => {
    const route = routes.data.find((rt) => rt.riderUid === r.id);
    const fee = (r.charges ?? 0) / 100;
    const payout = (r.drops * payPerDrop) / 100;
    return { route: route?.name ?? '—', rider: r.name || 'Rider', totalDrops: r.drops, feeCollected: fee, riderPayout: payout, netMargin: fee - payout };
  }), [totals.data, routes.data, payPerDrop]);

  const soldProductsList = useMemo(() => (totals.data?.products ?? []).map((p) => ({
    name: p.name, price: p.qty ? Math.round(p.value / p.qty) / 100 : 0, unit: p.unit, soldQty: p.qty, revenue: p.value / 100,
  })), [totals.data]);

  // Customers: counts kept on each customer doc by the customer app (no order scan)
  const customerLedgerList = useMemo(() => (customers.data as (Customer & CustomerSummary & { totalPaid?: number })[])
    .filter((u) => !searchTerm || (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (u.phone || '').includes(searchTerm))
    .map((u) => ({
      id: u.id,
      name: u.customerId ? `${u.name} (${u.customerId})` : (u.name || 'Customer'),
      phone: u.phone || '—',
      walletBalance: `${u.orderCount ?? 0} orders · ${u.activeSubscriptionCount ?? 0} subs`,
      totalSpent: (u.totalPaid ?? 0) / 100,
    })), [customers.data, searchTerm]);

  // Paused subscriptions and running vacations
  const pausedSubscriptions = useMemo(() => [
    ...paused.data.map((d) => ({ id: d.id, customerName: d.customerName, productName: d.productName, pauseStartDate: 'Paused', pauseEndDate: 'until resumed' })),
    ...onVacation.data.map((d) => ({
      id: d.id, customerName: d.customerName, productName: d.productName,
      pauseStartDate: d.vacationStart ? formatDay(d.vacationStart) : '', pauseEndDate: d.vacationEnd ? formatDay(d.vacationEnd) : '',
    })),
  ], [paused.data, onVacation.data]);

  const handleExportCSV = () => {
    const table: (string | number)[][] =
      selectedTab === 'sales-summary' ? [['Date', 'Drops', 'Subscription ₹', 'One-time + counter ₹', 'Total ₹'],
        ...salesSummaryList.map((r) => [r.date, r.totalOrders, r.subRevenue, r.oneTimeRevenue, r.totalRevenue])]
      : selectedTab === 'sold-products' ? [['Product', 'Unit', 'Unit price ₹', 'Units', 'Revenue ₹'],
        ...soldProductsList.map((p) => [p.name, p.unit, p.price, p.soldQty, p.revenue])]
      : selectedTab === 'customer-ledger' ? [['Customer', 'Phone', 'Orders / subscriptions', 'Total paid ₹'],
        ...customerLedgerList.map((c) => [c.name, c.phone, c.walletBalance, c.totalSpent])]
      : selectedTab === 'delivery-charge-report' ? [['Route', 'Rider', 'Drops', 'Charges ₹', 'Payout ₹', 'Net ₹'],
        ...deliveryChargeList.map((r) => [r.route, r.rider, r.totalDrops, r.feeCollected, r.riderPayout, r.netMargin])]
      : selectedTab === 'leaves-report' ? [['Subscriber', 'Product', 'From', 'To'],
        ...pausedSubscriptions.map((p) => [p.customerName ?? '', p.productName ?? '', p.pauseStartDate, p.pauseEndDate])]
      : [['Drop', 'Customer', 'Items', 'Status', 'Amount ₹'],
        ...filteredOrders.map((o) => [o.id, o.customerName ?? '', (o.items ?? []).map((i) => `${i.product?.name} x${i.quantity}`).join('; '), o.status, o.totalAmount ?? 0])];
    const body = table.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(body));
    link.setAttribute('download', `${selectedTab}_${hubId}_${range.from}_to_${range.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      {/* Header Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            {info.title}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            {info.desc}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: '#047857',
            color: '#FFFFFF',
            fontSize: '0.85rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(4, 120, 87, 0.2)',
          }}
        >
          <Download size={16} />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ backgroundColor: 'var(--bg-card)', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search report by customer, order ID or product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem 0.55rem 2.4rem',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            style={{
              padding: '0.55rem 0.85rem',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              outline: 'none',
              fontWeight: 600,
            }}
          >
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">This month</option>
            <option value="year">This year</option>
          </select>
        </div>
      </div>

      {/* Dynamic Content Views per Selected Tab */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '20px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
        
        {/* VIEW 1: DETAIL SALES REPORT */}
        {selectedTab === 'sales-detail' && (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="admin-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-main)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>ORDER ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>CUSTOMER DETAILS</th>
                  <th style={{ padding: '0.75rem 1rem' }}>ITEMS SUMMARY</th>
                  <th style={{ padding: '0.75rem 1rem' }}>STATUS</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>TOTAL AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#047857' }}>{order.id.slice(11)}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{order.customerName || 'Customer'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDay(order.orderDate)} · {order.deliveryAddress?.slice(0, 28) || '—'}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-main)' }}>
                      {order.items && order.items.length > 0 ? order.items.map((i: any) => `${i.productName || i.product?.name || 'Milk'} (x${i.quantity || 1})`).join(', ') : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ backgroundColor: order.status === 'delivered' ? '#ECFDF5' : '#FEF3C7', color: order.status === 'delivered' ? '#047857' : '#D97706', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800 }}>
                        {order.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: 'var(--text-main)' }}>
                      ₹{order.totalAmount ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedTab === 'sales-detail' && <LoadMore hasMore={delivered.hasMore} loading={delivered.loadingMore} onClick={delivered.loadMore} />}
        {selectedTab === 'customer-ledger' && <LoadMore hasMore={customers.hasMore} loading={customers.loadingMore} onClick={customers.loadMore} />}
        {(delivered.loading || totals.loading) && <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading report…</div>}

        {/* VIEW 2: DAILY & MONTHLY SALES SUMMARY */}
        {selectedTab === 'sales-summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Metric Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>TOTAL AGGREGATED SALES</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#047857', marginTop: '4px' }}>
                  ₹{salesSummaryList.reduce((acc, s) => acc + s.totalRevenue, 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>SUBSCRIPTION REVENUE</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0284C7', marginTop: '4px' }}>
                  ₹{salesSummaryList.reduce((acc, s) => acc + s.subRevenue, 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>ONE-TIME SALES</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#8B5CF6', marginTop: '4px' }}>
                  ₹{salesSummaryList.reduce((acc, s) => acc + s.oneTimeRevenue, 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="admin-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-main)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>DATE</th>
                    <th style={{ padding: '0.75rem 1rem' }}>FULFILLED DROPS</th>
                    <th style={{ padding: '0.75rem 1rem' }}>SUBSCRIPTION SALES</th>
                    <th style={{ padding: '0.75rem 1rem' }}>ONE-TIME SALES</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>TOTAL DAILY SALES</th>
                  </tr>
                </thead>
                <tbody>
                  {salesSummaryList.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--text-main)' }}>{row.date}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0284C7' }}>{row.totalOrders} Drops</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#047857' }}>₹{row.subRevenue.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#8B5CF6' }}>₹{row.oneTimeRevenue.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#047857', fontSize: '0.9rem' }}>
                        ₹{row.totalRevenue.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 3: SOLD PRODUCTS REPORT */}
        {selectedTab === 'sold-products' && (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="admin-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-main)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>PRODUCT NAME</th>
                  <th style={{ padding: '0.75rem 1rem' }}>UNIT PRICE</th>
                  <th style={{ padding: '0.75rem 1rem' }}>UNITS SOLD</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>GROSS REVENUE</th>
                </tr>
              </thead>
              <tbody>
                {soldProductsList.map((prod, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-main)' }}>{prod.name}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>₹{prod.price} / {prod.unit}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#047857' }}>{prod.soldQty} units</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#047857' }}>₹{prod.revenue.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 4: CUSTOMER LEDGER REPORT */}
        {selectedTab === 'customer-ledger' && (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="admin-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-main)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>CUSTOMER NAME</th>
                  <th style={{ padding: '0.75rem 1rem' }}>PHONE NUMBER</th>
                  <th style={{ padding: '0.75rem 1rem' }}>ORDERS / SUBSCRIPTIONS</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>TOTAL SPENT</th>
                </tr>
              </thead>
              <tbody>
                {customerLedgerList.map((user) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-main)' }}>{user.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{user.phone}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ backgroundColor: '#ECFDF5', color: '#047857', padding: '3px 8px', borderRadius: '8px', fontWeight: 800, fontSize: '0.78rem' }}>
                        {user.walletBalance}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#047857' }}>₹{user.totalSpent.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 5: DELIVERY CHARGE REPORT */}
        {selectedTab === 'delivery-charge-report' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>DELIVERY FEES COLLECTED</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#047857', marginTop: '4px' }}>
                  ₹{deliveryChargeList.reduce((acc, r) => acc + r.feeCollected, 0)}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>RIDER PAYOUT COMMISSIONS</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
                  ₹{deliveryChargeList.reduce((acc, r) => acc + r.riderPayout, 0)}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>NET LOGISTICS MARGIN</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0284C7', marginTop: '4px' }}>
                  ₹{deliveryChargeList.reduce((acc, r) => acc + r.netMargin, 0)}
                </div>
              </div>
            </div>

            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="admin-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-main)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>ROUTE NAME</th>
                    <th style={{ padding: '0.75rem 1rem' }}>ASSIGNED RIDER</th>
                    <th style={{ padding: '0.75rem 1rem' }}>COMPLETED DROPS</th>
                    <th style={{ padding: '0.75rem 1rem' }}>FEE COLLECTED</th>
                    <th style={{ padding: '0.75rem 1rem' }}>RIDER PAYOUT</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>NET LOGISTICS MARGIN</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryChargeList.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--text-main)' }}>{row.route}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#047857' }}>{row.rider}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0284C7' }}>{row.totalDrops} Drops</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#047857' }}>₹{row.feeCollected}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#DC2626' }}>₹{row.riderPayout}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#0284C7', fontSize: '0.9rem' }}>
                        ₹{row.netMargin}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 6: LEAVES & HOLDS REPORT */}
        {selectedTab === 'leaves-report' && (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="admin-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-main)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>SUBSCRIBER</th>
                  <th style={{ padding: '0.75rem 1rem' }}>PRODUCT PLAN</th>
                  <th style={{ padding: '0.75rem 1rem' }}>LEAVE / HOLD STATUS</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>PAUSE PERIOD</th>
                </tr>
              </thead>
              <tbody>
                {pausedSubscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No active subscription vacation holds or leaves recorded.
                    </td>
                  </tr>
                ) : (
                  pausedSubscriptions.map((sub, idx) => (
                    <tr key={sub.id || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-main)' }}>{sub.customerName || 'Subscriber'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#047857', fontWeight: 600 }}>{sub.productName || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ backgroundColor: '#FEF3C7', color: '#D97706', padding: '3px 8px', borderRadius: '8px', fontWeight: 800, fontSize: '0.75rem' }}>
                          ON VACATION HOLD
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#D97706' }}>
                        {sub.pauseStartDate} - {sub.pauseEndDate}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
