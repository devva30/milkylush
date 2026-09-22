import { useState, useMemo } from 'react';
import { Search, ArrowLeft, Calendar, Users as UsersIcon, Printer, X, Download } from 'lucide-react';
import type { Order, User, Product, DeliveryAgent } from '../types';
import FulfillmentSheetView from '../components/common/FulfillmentSheetView';

interface OrdersPageProps {
  selectedHubId: string;
  orders: Order[];
  users: User[];
  products: Product[];
  deliveryAgents: DeliveryAgent[];
  onOpenAddOrderModal?: () => void;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  onUpdateOrderDriver?: (orderId: string, agentId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateTab?: (tab: string, targetId?: string) => void;
}

const safeParseDate = (dateStr?: string): Date => {
  if (!dateStr) return new Date('2026-09-09T06:00:00Z');
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  try {
    const parts = dateStr.split(',');
    if (parts.length > 0) {
      const dParts = parts[0].trim().split('/');
      if (dParts.length === 3) {
        const m = parseInt(dParts[0], 10) - 1;
        const day = parseInt(dParts[1], 10);
        const y = parseInt(dParts[2], 10);
        return new Date(y, m, day);
      }
    }
  } catch (e) {
    // fallback
  }
  return new Date('2026-09-09T06:00:00Z');
};

export default function OrdersPage({
  selectedHubId,
  orders,
  users,
  products = [],
  deliveryAgents = [],
  onOpenAddOrderModal,
  onUpdateOrderStatus,
  onUpdateOrderDriver,
  showToast,
  onNavigateTab,
}: OrdersPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'subscription' | 'onetime'>('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [customDate, setCustomDate] = useState('');
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // Invoice Print Modal State
  const [showPrintBillModal, setShowPrintBillModal] = useState(false);
  const [activePrintOrder, setActivePrintOrder] = useState<Order | null>(null);

  // Pagination State
  const pageSize = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);

  const isHosur = selectedHubId === 'hub_hosur_main';
  const hubCodeName = isHosur ? 'hub_hosur_main' : 'hub_blr_ecity';

  const activeOrders = orders;

  // Pipeline Metrics
  const totalPipeline = activeOrders.length;
  const packedPending = activeOrders.filter((o) => o.status === 'packed').length;
  const outForDelivery = activeOrders.filter((o) => o.status === 'outForDelivery').length;
  const deliveredToday = activeOrders.filter((o) => o.status === 'delivered').length;

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const yDate = new Date(now);
    yDate.setDate(yDate.getDate() - 1);
    const yesterdayISO = `${yDate.getFullYear()}-${String(yDate.getMonth() + 1).padStart(2, '0')}-${String(yDate.getDate()).padStart(2, '0')}`;

    return activeOrders.filter((o) => {
      const u = users.find((usr) => usr.id === o.userId);
      const matchesSearch =
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.items || []).some((i) => (i.product?.name || '').toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Status Filter
      if (statusFilter === 'packed' && o.status !== 'packed') return false;
      if (statusFilter === 'outForDelivery' && o.status !== 'outForDelivery') return false;
      if (statusFilter === 'delivered' && o.status !== 'delivered') return false;

      // Type Filter
      const isSub = o.isSubscriptionDelivery || o.orderType === 'subscription';
      if (typeFilter === 'subscription' && !isSub) return false;
      if (typeFilter === 'onetime' && isSub) return false;

      // Date Filter & Custom Date Picker Evaluation
      const targetDateISO = customDate ? customDate : dateFilter === 'today' ? todayISO : dateFilter === 'yesterday' ? yesterdayISO : '';

      if (targetDateISO) {
        const itemISO = safeParseDate(o.orderDate).toISOString().slice(0, 10);
        if (itemISO !== targetDateISO) return false;
      }

      return true;
    });
  }, [activeOrders, users, searchQuery, statusFilter, typeFilter, dateFilter, customDate]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      showToast('No orders available to export.', 'info');
      return;
    }
    const headers = ['Order ID', 'Customer Name', 'Address', 'Products', 'Amount', 'Status'];
    const rows = filteredOrders.map((o) => {
      const u = users.find((usr) => usr.id === o.userId);
      const itemsStr = o.items?.map((i) => `${i.product?.name || 'Item'} (x${i.quantity})`).join('; ') || 'Milk';
      return [
        `"${o.id}"`,
        u ? `"${u.name}"` : '"Customer"',
        `"${(o.address || 'Address').replace(/"/g, '""')}"`,
        `"${itemsStr.replace(/"/g, '""')}"`,
        `₹${o.totalAmount}`,
        o.status,
      ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Orders_Pipeline_${isHosur ? 'Hosur' : 'Bangalore'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Orders Pipeline to CSV!', 'success');
  };

  const handleTriggerPrintBill = () => {
    window.print();
  };

  const activeBillOrder = activePrintOrder || selectedOrderDetail;  const renderPrintBillModal = () => {
    if (!showPrintBillModal || !activeBillOrder) return null;
    const o = activeBillOrder;
    const u = users.find((usr) => usr.id === o.userId);
    const custName = u?.name || 'Customer';
    const custPhone = u?.phone || 'N/A';
    const custEmail = u?.email || 'N/A';
    const addressText = o.address || u?.savedAddresses?.[0] || 'Address Pending';
    const currentAgent = deliveryAgents.find((a) => a.id === o.deliveryAgentId);

    const subtotalCalc = (o.items || []).reduce((acc, item) => acc + item.quantity * (item.product?.price || 90), 0);
    const cgstCalc = (subtotalCalc * 0.025).toFixed(2);
    const sgstCalc = (subtotalCalc * 0.025).toFixed(2);
    const grandTotalCalc = (subtotalCalc * 1.05).toFixed(1);

    const getItemDisplayName = (item: any) => {
      if (!item?.product?.name || item.product.name.toLowerCase() === 'dummy') {
        return products?.[0]?.name || 'Premium A2 Desi Cow Milk';
      }
      return item.product.name;
    };

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '1.5rem',
        overflowY: 'auto'
      }}>
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '2rem 2.25rem',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          fontFamily: "'Poppins', sans-serif",
          color: '#111827',
          textAlign: 'left',
          margin: 'auto'
        }} id="printable-bill-invoice">
          
          {/* Modal Actions Bar (Hidden on print) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.85rem' }} className="no-print">
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#047857' }}>
              MILKYLUSH OFFICIAL TAX BILL INVOICE
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleTriggerPrintBill}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '8px',
                  backgroundColor: '#047857',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Printer size={16} /> Print Bill / Save PDF
              </button>
              <button
                onClick={() => setShowPrintBillModal(false)}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}
              >
                <X size={18} /> Close
              </button>
            </div>
          </div>

          {/* Printable Invoice Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #047857', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#047857', margin: 0, letterSpacing: '-0.02em' }}>
                MILKYLUSH DAIRY
              </h1>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginTop: '2px' }}>
                MilkyLush Technologies Pvt. Ltd.
              </div>
              <div style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px', lineHeight: '1.4' }}>
                Plot 42, Dairy Industrial Hub, Hosur, Tamil Nadu - 635109<br />
                GSTIN: <strong>33AABCM1234F1Z9</strong> | FSSAI Lic: <strong>12422003000543</strong><br />
                Support: +91 98765 43210 | www.milkylush.com
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#111827', textTransform: 'uppercase' }}>
                TAX INVOICE
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#047857', marginTop: '4px' }}>
                NO: INV-{o.id}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '2px' }}>
                Date: {new Date(o.orderDate || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                Hub: {hubCodeName}
              </div>
            </div>
          </div>

          {/* Customer & Billing Details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '1.5rem', backgroundColor: '#F9FAFB', padding: '1rem', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>BILLED &amp; DELIVERED TO:</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#111827', marginTop: '4px' }}>{custName}</div>
              <div style={{ fontSize: '0.78rem', color: '#4B5563', marginTop: '2px' }}>Mobile: <strong>{custPhone}</strong></div>
              <div style={{ fontSize: '0.78rem', color: '#4B5563' }}>Email: {custEmail}</div>
              <div style={{ fontSize: '0.78rem', color: '#374151', marginTop: '4px', lineHeight: '1.3' }}>Address: {addressText}</div>
            </div>

            <div style={{ borderLeft: '1px solid #E5E7EB', paddingLeft: '1.25rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>DELIVERY &amp; ORDER INFO:</div>
              <div style={{ fontSize: '0.82rem', color: '#374151', marginTop: '6px' }}>
                Order Type: <strong>{o.orderType === 'subscription' || o.isSubscriptionDelivery ? 'Prepaid Subscription Drop' : 'One-Time Delivery'}</strong>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#374151', marginTop: '4px' }}>
                Fulfillment Rider: <strong>{currentAgent?.name || 'Assigned Express Rider'}</strong>
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#ECFDF5', borderBottom: '2px solid #A7F3D0', color: '#065F46', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px', width: '30px' }}>#</th>
                <th style={{ padding: '8px 10px' }}>ITEMS &amp; SPECIFICATION</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>HSN</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>QTY</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>RATE (₹)</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>TOTAL (₹)</th>
              </tr>
            </thead>
            <tbody>
              {o.items?.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '10px', fontWeight: 700 }}>{idx + 1}</td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ fontWeight: 800, color: '#111827' }}>{getItemDisplayName(item)}</div>
                    <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>{item.product?.unit || '750ml Reusable Glass Bottle'}</div>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#6B7280' }}>0401</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800 }}>{item.quantity}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>₹{item.product?.price || 90}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800 }}>₹{item.quantity * (item.product?.price || 90)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Invoice Calculations Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2rem' }}>
            <div style={{ flex: 1, fontSize: '0.75rem', color: '#6B7280', lineHeight: '1.4' }}>
              <div style={{ fontWeight: 800, color: '#111827', marginBottom: '4px' }}>Terms &amp; Bottle Return Policy:</div>
              • Goods once delivered in sealed condition cannot be returned.<br />
              • Please place empty, washed glass bottles outside for next morning collection.<br />
              • This is a computer-generated tax bill invoice, no signature required.
            </div>

            <div style={{ width: '240px', backgroundColor: '#F9FAFB', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4B5563', marginBottom: '4px' }}>
                <span>Taxable Subtotal:</span>
                <span>₹{subtotalCalc}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4B5563', marginBottom: '4px' }}>
                <span>CGST (2.5%):</span>
                <span>₹{cgstCalc}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4B5563', marginBottom: '4px' }}>
                <span>SGST (2.5%):</span>
                <span>₹{sgstCalc}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700, marginBottom: '6px' }}>
                <span>Delivery Charge:</span>
                <span>FREE</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 900, color: '#047857', borderTop: '2px solid #047857', paddingTop: '6px' }}>
                <span>Grand Total:</span>
                <span>₹{grandTotalCalc}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px dashed #D1D5DB', paddingTop: '1rem', fontSize: '0.78rem', fontWeight: 700, color: '#047857' }}>
            🌱 Thank you for subscribing to MilkyLush Fresh Glass Bottle Milk Delivery!
          </div>

        </div>
      </div>
    );
  };

  // Dedicated Fulfillment Sheet View
  if (selectedOrderDetail) {
    return (
      <FulfillmentSheetView
        order={selectedOrderDetail}
        users={users}
        products={products}
        deliveryAgents={deliveryAgents}
        selectedHubId={selectedHubId}
        onClose={() => setSelectedOrderDetail(null)}
        onUpdateOrderStatus={(orderId, status) => {
          onUpdateOrderStatus(orderId, status);
          setSelectedOrderDetail((prev) => prev ? { ...prev, status } : null);
        }}
        onUpdateOrderDriver={(orderId, agentId) => {
          if (onUpdateOrderDriver) onUpdateOrderDriver(orderId, agentId);
          setSelectedOrderDetail((prev) => prev ? { ...prev, deliveryAgentId: agentId } : null);
        }}
        showToast={showToast}
        onNavigateTab={onNavigateTab}
      />
    );
  }

  // Main Table View
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* 4 Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', padding: '1.15rem', borderLeft: '4px solid #047857', borderTop: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>TOTAL ORDERS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111827', marginTop: '2px' }}>{totalPipeline}</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', padding: '1.15rem', borderLeft: '4px solid #0284C7', borderTop: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>PACKED &amp; PENDING</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284C7', marginTop: '2px' }}>{packedPending}</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', padding: '1.15rem', borderLeft: '4px solid #D97706', borderTop: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>OUT FOR DELIVERY</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#D97706', marginTop: '2px' }}>{outForDelivery}</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', padding: '1.15rem', borderLeft: '4px solid #059669', borderTop: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>DELIVERED TODAY</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>{deliveredToday}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        padding: '1rem 1.25rem',
        border: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            type="text"
            placeholder="Search by order ID, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.45rem 0.85rem 0.45rem 32px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', fontSize: '0.82rem', color: '#111827', outline: 'none' }}
          />
        </div>

        {/* Order Type & Status Filter Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Types' },
            { id: 'subscription', label: 'Subscription' },
            { id: 'onetime', label: 'One-Time' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id as any)}
              style={{
                padding: '0.38rem 0.75rem',
                borderRadius: '20px',
                border: typeFilter === t.id ? '1px solid #047857' : '1px solid var(--border-color)',
                backgroundColor: typeFilter === t.id ? '#047857' : 'var(--bg-main)',
                color: typeFilter === t.id ? '#FFFFFF' : 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 4px' }}>|</span>

          {[
            { id: 'all', label: 'All Statuses' },
            { id: 'packed', label: 'Packed' },
            { id: 'outForDelivery', label: 'Out For Delivery' },
            { id: 'delivered', label: 'Delivered' }
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              style={{
                padding: '0.38rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: statusFilter === s.id ? '#047857' : 'var(--bg-main)',
                color: statusFilter === s.id ? '#FFFFFF' : 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Date Presets & Date Picker */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => { setDateFilter(p.id); setCustomDate(''); }}
              style={{
                padding: '0.38rem 0.65rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: dateFilter === p.id && !customDate ? '#0284C7' : 'var(--bg-main)',
                color: dateFilter === p.id && !customDate ? '#FFFFFF' : 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              {p.label}
            </button>
          ))}

          <input
            type="date"
            value={customDate}
            onChange={(e) => { setCustomDate(e.target.value); setDateFilter('all'); }}
            style={{
              padding: '0.35rem 0.55rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: customDate ? '#ECFDF5' : 'var(--bg-main)',
              color: customDate ? '#047857' : 'var(--text-main)',
              fontWeight: 700,
              fontSize: '0.78rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          />

          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.38rem 0.75rem',
              borderRadius: '8px',
              backgroundColor: '#047857',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            <Download size={14} /> Export CSV
          </button>

          {onOpenAddOrderModal && (
            <button
              onClick={onOpenAddOrderModal}
              style={{
                padding: '0.38rem 0.75rem',
                borderRadius: '8px',
                backgroundColor: '#0284C7',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              + Create Order
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.85rem 1rem' }}>ORDER ID</th>
                <th style={{ padding: '0.85rem 1rem' }}>CUSTOMER NAME</th>
                <th style={{ padding: '0.85rem 1rem' }}>DELIVERY ADDRESS</th>
                <th style={{ padding: '0.85rem 1rem' }}>PRODUCTS</th>
                <th style={{ padding: '0.85rem 1rem' }}>ORDER TYPE</th>
                <th style={{ padding: '0.85rem 1rem' }}>DATE</th>
                <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
                <th style={{ padding: '0.85rem 1rem' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((o) => {
                const u = users.find((usr) => usr.id === o.userId);
                const isSub = o.isSubscriptionDelivery || o.orderType === 'subscription';
                const customerName = u?.name || 'Customer';
                const rawAddr = o.address || o.deliveryAddress;
                const isValidAddr = rawAddr && rawAddr !== 'Doorstep Delivery' && rawAddr !== 'Doorstep';
                const displayAddress = isValidAddr ? rawAddr : (u?.address || u?.savedAddresses?.[0] || 'Address Pending');

                const productsText = o.items && o.items.length > 0
                  ? o.items.map((i) => `${i.product?.name || 'Milk Product'} - ${i.product?.unit || '500ml'} (x${i.quantity})`).join(', ')
                  : 'Fresh Dairy Product - 500ml (x1)';

                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)', padding: '0.85rem 1rem' }}>{o.id}</td>
                    <td style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', padding: '0.85rem 1rem' }}>{customerName}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-main)', maxWidth: '240px', padding: '0.85rem 1rem', lineHeight: 1.4 }}>{displayAddress}</td>
                    <td style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', padding: '0.85rem 1rem' }}>
                      {productsText}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ backgroundColor: isSub ? '#ECFDF5' : '#FEF3C7', color: isSub ? '#047857' : '#D97706', padding: '3px 9px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800 }}>
                        {isSub ? 'Subscription' : 'One-Time'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', fontWeight: 700, color: '#111827', padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      {safeParseDate(o.orderDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ backgroundColor: o.status === 'delivered' ? '#DCFCE7' : o.status === 'outForDelivery' ? '#FEF3C7' : '#EFF6FF', color: o.status === 'delivered' ? '#059669' : o.status === 'outForDelivery' ? '#D97706' : '#2563EB', padding: '3px 9px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'capitalize' }}>
                        {o.status === 'outForDelivery' ? 'Out For Delivery' : o.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setSelectedOrderDetail(o)}
                          style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', color: '#111827', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          View Sheet
                        </button>
                        <button
                          onClick={() => { setSelectedOrderDetail(o); setShowPrintBillModal(true); }}
                          style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', backgroundColor: '#047857', color: '#FFFFFF', border: 'none', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Printer size={14} /> Bill
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>
            Showing {filteredOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} entries
          </span>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                backgroundColor: '#FFFFFF',
                color: currentPage === 1 ? '#9CA3AF' : '#111827',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              ❮ Prev
            </button>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#111827' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                backgroundColor: '#FFFFFF',
                color: currentPage >= totalPages ? '#9CA3AF' : '#111827',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Next ❯
            </button>
          </div>
        </div>
      </div>

      {renderPrintBillModal()}
    </div>
  );
}
