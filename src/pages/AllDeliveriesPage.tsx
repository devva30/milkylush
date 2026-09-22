import { useState, useMemo } from 'react';
import { Download, Search, ChevronLeft, ChevronRight, ArrowLeft, ExternalLink, FileText, ClipboardList, Trash2, Save, Truck } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Order, Subscription, DeliveryAgent, User, Product } from '../types';
import FulfillmentSheetView from '../components/common/FulfillmentSheetView';

interface AllDeliveriesPageProps {
  selectedHubId: string;
  orders: Order[];
  subscriptions?: Subscription[];
  users: User[];
  products?: Product[];
  deliveryAgents?: DeliveryAgent[];
  onUpdateOrderStatus?: (orderId: string, status: Order['status']) => void;
  onUpdateOrderDriver?: (orderId: string, agentId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateTab?: (tab: string, targetId?: string) => void;
}

export interface DeliveryEntry {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  products: string;
  orderType: 'Subscription' | 'One-time';
  type?: 'Subscription' | 'One-time' | string;
  dateStr: string;
  rawDate: Date;
  status: 'packed' | 'outForDelivery' | 'pending' | 'delivered' | 'cancelled';
  deliveryAgentId?: string;
  totalAmount: number;
  isSub: boolean;
  deliveryInstructions?: string;
  rawObject: any;
  items?: any[];
}

const getTodayFormatted = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateTimeString = (rawDate: Date, timing?: string): string => {
  if (!rawDate || isNaN(rawDate.getTime())) return 'Today, 06:30 AM';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(rawDate.getDate()).padStart(2, '0');
  const month = MONTHS[rawDate.getMonth()];
  const year = rawDate.getFullYear();
  
  let timeStr = '06:30 AM';
  if (timing === 'evening' || timing === 'Evening (5-7 PM)') {
    timeStr = '05:30 PM';
  } else {
    const hrs = rawDate.getHours();
    const mins = String(rawDate.getMinutes()).padStart(2, '0');
    if (hrs > 0 || mins !== '00') {
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      const formattedHrs = String(hrs % 12 || 12).padStart(2, '0');
      timeStr = `${formattedHrs}:${mins} ${ampm}`;
    }
  }

  return `${day} ${month} ${year}, ${timeStr}`;
};

export default function AllDeliveriesPage({
  selectedHubId,
  orders = [],
  subscriptions = [],
  users = [],
  products: _products = [],
  deliveryAgents = [],
  onUpdateOrderStatus,
  onUpdateOrderDriver,
  showToast,
  onNavigateTab,
}: AllDeliveriesPageProps) {
  // Filter States
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>(getTodayFormatted());
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayFormatted());
  const [typeFilter, setTypeFilter] = useState<'all' | 'subscription' | 'onetime'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'packed' | 'outForDelivery' | 'unassigned'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Full-Page Fulfillment Sheet State
  const [selectedEntry, setSelectedEntry] = useState<DeliveryEntry | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [savingInstruction, setSavingInstruction] = useState<boolean>(false);

  // Pagination State
  const [pageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const isHosur = selectedHubId === 'hub_hosur_main';
  const hubCodeName = isHosur ? 'Hosur Central Hub' : 'Bangalore Electronic City Hub';

  // Combine real-time active (non-delivered) orders & subscriptions
  const combinedEntries = useMemo(() => {
    const entries: DeliveryEntry[] = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. One-time Orders (excluding delivered and cancelled)
    orders.forEach((o) => {
      if (o.status === 'delivered' || o.status === 'cancelled') return;

      const userObj = users.find((u) => u.id === o.userId);
      const parsedDate = new Date(o.orderDate || Date.now());
      const isSubOrder = o.isSubscriptionDelivery || o.orderType === 'subscription';

      const prodNames = o.items && o.items.length > 0
        ? o.items.map((i) => `${i.product?.name || 'Item'} - ${i.product?.unit || '500ml'} (x${i.quantity})`).join(', ')
        : 'Fresh Organic Milk - 500ml (x1)';

      entries.push({
        id: o.id,
        customerName: userObj?.name || 'MilkyLush Customer',
        phone: userObj?.phone || 'N/A',
        address: o.deliveryAddress || o.address || userObj?.address || 'Hosur Main Road',
        products: prodNames,
        orderType: isSubOrder ? 'Subscription' : 'One-time',
        dateStr: o.orderDate ? o.orderDate.slice(0, 10) : getTodayFormatted(),
        rawDate: isNaN(parsedDate.getTime()) ? todayStart : parsedDate,
        status: (o.status as any) || 'packed',
        deliveryAgentId: o.deliveryAgentId,
        totalAmount: o.totalAmount || 110,
        isSub: isSubOrder,
        deliveryInstructions: o.deliveryInstructions || '',
        rawObject: o,
        items: o.items || [],
      });
    });

    // 2. Active Subscriptions (scheduled recurring deliveries not yet delivered)
    subscriptions.forEach((s) => {
      if (s.status === 'paused' || s.status === 'cancelled') return;

      const userObj = users.find((u) => u.id === s.userId);
      const startDate = new Date(s.startDate || Date.now());
      const prodName = s.productName || s.product?.name || 'Fresh Organic A2 Milk';
      const prodUnit = s.product?.unit || '500ml';
      const prodDetails = `${prodName} - ${prodUnit} (x${s.quantity || 1})`;

      // Check if entry already added via order object
      const existsInOrders = entries.some((e) => e.rawObject?.userId === s.userId && e.isSub);
      if (!existsInOrders) {
        entries.push({
          id: `SUB_${s.id.slice(0, 8).toUpperCase()}`,
          customerName: s.customerName || userObj?.name || 'Subscribed Customer',
          phone: s.customerPhone || userObj?.phone || 'N/A',
          address: s.deliveryAddress || userObj?.address || 'Hosur Central Sector',
          products: prodDetails,
          orderType: 'Subscription',
          dateStr: s.startDate ? s.startDate.slice(0, 10) : getTodayFormatted(),
          rawDate: isNaN(startDate.getTime()) ? todayStart : startDate,
          status: 'outForDelivery',
          totalAmount: (s.quantity || 1) * 95,
          isSub: true,
          deliveryInstructions: s.deliveryInstructions || '',
          rawObject: s,
          items: [{ product: s.product || { name: prodName, price: 95, unit: prodUnit, imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80' }, quantity: s.quantity || 1 }],
        });
      }
    });

    // Sort newest scheduled date first
    return entries.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
  }, [orders, subscriptions, users]);

  // Filter combined entries by Date Range, Type, Status & Search
  const filteredEntries = useMemo(() => {
    const now = new Date();
    const todayStr = getTodayFormatted();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    return combinedEntries.filter((item) => {
      // 1. Date Range Filter
      if (dateFilter === 'today') {
        if (item.dateStr !== todayStr) return false;
      } else if (dateFilter === 'yesterday') {
        if (item.dateStr !== yesterdayStr) return false;
      } else if (dateFilter === 'week') {
        if (item.rawDate < weekAgo) return false;
      } else if (dateFilter === 'month') {
        if (item.rawDate < monthAgo) return false;
      } else if (dateFilter === 'custom') {
        if (customStartDate && item.dateStr < customStartDate) return false;
        if (customEndDate && item.dateStr > customEndDate) return false;
      }

      // 2. Order Type Filter (Strict Check)
      if (typeFilter === 'subscription' && !item.isSub && item.orderType !== 'Subscription') return false;
      if (typeFilter === 'onetime' && (item.isSub || item.orderType === 'Subscription')) return false;

      // 3. Status Filter
      if (statusFilter === 'packed' && item.status !== 'packed') return false;
      if (statusFilter === 'outForDelivery' && item.status !== 'outForDelivery') return false;
      if (statusFilter === 'unassigned' && item.deliveryAgentId) return false;

      // 4. Search Query Filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const mId = item.id.toLowerCase().includes(q);
        const mName = item.customerName.toLowerCase().includes(q);
        const mPhone = item.phone.toLowerCase().includes(q);
        const mAddr = item.address.toLowerCase().includes(q);
        const mProd = item.products.toLowerCase().includes(q);
        if (!mId && !mName && !mPhone && !mAddr && !mProd) return false;
      }

      return true;
    });
  }, [combinedEntries, dateFilter, customStartDate, customEndDate, typeFilter, statusFilter, searchQuery]);

  // Metrics
  const totalEntriesCount = combinedEntries.length;
  const subCount = combinedEntries.filter((e) => e.orderType === 'Subscription').length;
  const oneTimeCount = combinedEntries.filter((e) => e.orderType === 'One-time').length;
  const unassignedCount = combinedEntries.filter((e) => !e.deliveryAgentId).length;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, currentPage, pageSize]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      showToast('No delivery entries available to export.', 'info');
      return;
    }
    const headers = ['Delivery ID', 'Customer Name', 'Phone', 'Address', 'Products', 'Order Type', 'Date', 'Status'];
    const rows = filteredEntries.map((e) => [
      e.id,
      `"${e.customerName}"`,
      `"${e.phone}"`,
      `"${e.address.replace(/"/g, '""')}"`,
      `"${e.products.replace(/"/g, '""')}"`,
      e.orderType,
      e.dateStr,
      e.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `All_Pending_Deliveries_${getTodayFormatted()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${filteredEntries.length} pending delivery entries to CSV!`, 'success');
  };

  // RENDER FULL-PAGE FULFILLMENT SHEET VIEW
  if (selectedEntry) {
    const targetOrder: Order = selectedEntry.rawObject && selectedEntry.rawObject.status ? selectedEntry.rawObject : {
      id: selectedEntry.id,
      userId: selectedEntry.rawObject?.userId || 'cust_1',
      items: selectedEntry.items || [],
      totalAmount: selectedEntry.totalAmount,
      status: selectedEntry.status as Order['status'],
      deliveryAddress: selectedEntry.address,
      address: selectedEntry.address,
      orderDate: selectedEntry.dateStr,
      deliveryAgentId: selectedEntry.deliveryAgentId,
      deliveryInstructions: selectedEntry.deliveryInstructions,
      isSubscriptionDelivery: selectedEntry.isSub,
      orderType: selectedEntry.orderType === 'Subscription' ? 'subscription' : 'one-time',
    };

    return (
      <FulfillmentSheetView
        order={targetOrder}
        users={users}
        products={_products}
        deliveryAgents={deliveryAgents}
        selectedHubId={selectedHubId}
        onClose={() => setSelectedEntry(null)}
        onUpdateOrderStatus={(orderId, status) => {
          if (onUpdateOrderStatus && selectedEntry.rawObject?.id) {
            onUpdateOrderStatus(selectedEntry.rawObject.id, status);
          }
          setSelectedEntry((prev) => prev ? { ...prev, status: status as any } : null);
        }}
        onUpdateOrderDriver={(orderId, agentId) => {
          if (onUpdateOrderDriver && selectedEntry.rawObject?.id) {
            onUpdateOrderDriver(selectedEntry.rawObject.id, agentId);
          }
          setSelectedEntry((prev) => prev ? { ...prev, deliveryAgentId: agentId } : null);
        }}
        showToast={showToast}
        onNavigateTab={onNavigateTab}
      />
    );
  }

  // =========================================================
  // MAIN TABLE LIST VIEW
  // =========================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* Summary Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        
        {/* Card 1: Total Un-delivered */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '0.85rem 1.15rem',
          borderLeft: '4px solid #047857',
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            TOTAL PENDING DELIVERIES
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)', lineHeight: 1.1 }}>
            {totalEntriesCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Un-delivered active orders &amp; plans
          </div>
        </div>

        {/* Card 2: Subscriptions */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '0.85rem 1.15rem',
          borderLeft: '4px solid #059669',
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            SUBSCRIPTION DELIVERIES
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#047857', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)', lineHeight: 1.1 }}>
            {subCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Daily recurring milk &amp; dairy drops
          </div>
        </div>

        {/* Card 3: One-time */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '0.85rem 1.15rem',
          borderLeft: '4px solid #3B82F6',
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            ONE-TIME ORDERS
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#2563EB', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)', lineHeight: 1.1 }}>
            {oneTimeCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Single custom product purchases
          </div>
        </div>

        {/* Card 4: Unassigned Drivers */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '0.85rem 1.15rem',
          borderLeft: '4px solid #F59E0B',
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            UNASSIGNED DRIVERS
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#D97706', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)', lineHeight: 1.1 }}>
            {unassignedCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Awaiting fleet driver dispatch
          </div>
        </div>

      </div>

      {/* Filter Control Bar */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '1.1rem 1.25rem',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
        
        {/* Row 1: Date Preset Chips + Custom Range */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginRight: '4px' }}>DATE:</span>
            {[
              { key: 'all', label: 'All Dates' },
              { key: 'today', label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'custom', label: 'Custom Range' },
            ].map((d) => (
              <button
                key={d.key}
                onClick={() => setDateFilter(d.key as any)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '8px',
                  border: dateFilter === d.key ? 'none' : '1px solid var(--border-color)',
                  backgroundColor: dateFilter === d.key ? '#ECFDF5' : 'var(--bg-main)',
                  color: dateFilter === d.key ? '#047857' : 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            style={{
              padding: '0.45rem 0.95rem',
              borderRadius: '8px',
              border: '1px solid #A7F3D0',
              backgroundColor: '#ECFDF5',
              color: '#047857',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        {/* Custom Date Range Picker Input (When Custom selected) */}
        {dateFilter === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', backgroundColor: 'var(--bg-main)', padding: '0.6rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>From Date:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
            />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>To Date:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
            />
          </div>
        )}

        {/* Row 2: Order Type Filter, Status Filter & Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          
          {/* Order Type Chips */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginRight: '4px' }}>TYPE:</span>
            {[
              { key: 'all', label: 'All Types' },
              { key: 'subscription', label: 'Subscription' },
              { key: 'onetime', label: 'One-Time' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTypeFilter(t.key as any)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  border: typeFilter === t.key ? '1px solid #047857' : '1px solid var(--border-color)',
                  backgroundColor: typeFilter === t.key ? '#047857' : 'var(--bg-main)',
                  color: typeFilter === t.key ? '#FFFFFF' : 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                {t.label}
              </button>
            ))}

            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginLeft: '8px', marginRight: '4px' }}>STATUS:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.78rem',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="packed">Packed &amp; Ready</option>
              <option value="outForDelivery">Out for Delivery</option>
              <option value="unassigned">Unassigned Driver</option>
            </select>
          </div>

          {/* Search Box Input */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search customer, phone, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.85rem 0.45rem 34px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                fontSize: '0.8rem',
                color: 'var(--text-main)',
                outline: 'none'
              }}
            />
          </div>

        </div>

      </div>

      {/* Main Deliveries Table */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>DELIVERY ID</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>CUSTOMER</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ADDRESS &amp; HUB</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PRODUCTS</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>TYPE</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>SCHEDULED DATE</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>DRIVER FLEET</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>STATUS</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => {
                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedEntry(item)}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                  >
                    {/* ID */}
                    <td style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-main)', padding: '0.75rem 0.85rem', verticalAlign: 'middle' }}>
                      {item.id}
                    </td>

                    {/* Customer */}
                    <td style={{ fontWeight: 700, fontSize: '0.82rem', padding: '0.75rem 0.85rem', verticalAlign: 'middle' }}>
                      <div style={{ color: '#047857' }}>{item.customerName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>📞 {item.phone}</div>
                    </td>

                    {/* Address */}
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-main)', maxWidth: '240px', padding: '0.75rem 0.85rem', verticalAlign: 'middle', lineHeight: 1.3 }}>
                      {item.address}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        📍 {hubCodeName}
                      </div>
                      {(item.deliveryInstructions || item.rawObject?.deliveryInstructions) && (
                        <div style={{ marginTop: '4px', fontSize: '0.71rem', fontWeight: 700, color: '#B45309', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '6px', padding: '2px 6px', display: 'inline-block' }}>
                          📝 Note: {item.deliveryInstructions || item.rawObject?.deliveryInstructions}
                        </div>
                      )}
                    </td>

                    {/* Products */}
                    <td style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', padding: '0.75rem 0.85rem', verticalAlign: 'middle', maxWidth: '200px' }}>
                      {item.products}
                    </td>

                    {/* Order Type */}
                    <td style={{ padding: '0.75rem 0.85rem', verticalAlign: 'middle' }}>
                      <span style={{
                        backgroundColor: item.orderType === 'Subscription' ? '#ECFDF5' : '#EFF6FF',
                        color: item.orderType === 'Subscription' ? '#047857' : '#2563EB',
                        border: item.orderType === 'Subscription' ? '1px solid #A7F3D0' : '1px solid #BFDBFE',
                        padding: '3px 9px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        display: 'inline-block'
                      }}>
                        {item.orderType}
                      </span>
                    </td>

                    {/* Scheduled Date & Time */}
                    <td style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', padding: '0.75rem 0.85rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div>{formatDateTimeString(item.rawDate, item.rawObject?.timing)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        📅 Slot: {item.rawObject?.timing === 'evening' ? 'Evening (5-7 PM)' : 'Morning (6-8 AM)'}
                      </div>
                    </td>

                    {/* Driver Fleet Dropdown */}
                    <td style={{ padding: '0.75rem 0.85rem', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                      <select
                        value={item.deliveryAgentId || ''}
                        onChange={(e) => {
                          if (onUpdateOrderDriver && item.rawObject?.id) {
                            onUpdateOrderDriver(item.rawObject.id, e.target.value);
                          }
                          showToast(`Assigned driver to ${item.id}`, 'success');
                        }}
                        style={{
                          padding: '0.35rem 0.6rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-main)',
                          color: item.deliveryAgentId ? 'var(--text-main)' : '#D97706',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">-- Assign Driver --</option>
                        {deliveryAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            🛵 {agent.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '0.75rem 0.85rem', verticalAlign: 'middle' }}>
                      <span style={{
                        backgroundColor: item.status === 'outForDelivery' ? '#FEF3C7' : '#ECFDF5',
                        color: item.status === 'outForDelivery' ? '#D97706' : '#047857',
                        border: item.status === 'outForDelivery' ? '1px solid #FDE68A' : '1px solid #A7F3D0',
                        padding: '3px 9px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        display: 'inline-block'
                      }}>
                        {item.status === 'outForDelivery' ? 'Out for Delivery' : 'Packed & Ready'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.75rem 0.85rem', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedEntry(item)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-main)',
                          color: 'var(--text-main)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}

              {paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No un-delivered entries found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination Bar */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Showing {filteredEntries.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredEntries.length)} of {filteredEntries.length} pending entries
          </span>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-main)',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
