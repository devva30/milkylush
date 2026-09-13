import { useState, useMemo } from 'react';
import { Search, ArrowLeft, Calendar, Users as UsersIcon, Printer, X, Download } from 'lucide-react';
import type { Order, User, Product, DeliveryAgent } from '../types';

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

      // Date Filter & Custom Date Picker Evaluation
      const todayISO = '2026-09-09';
      const yesterdayISO = '2026-09-08';
      const targetDateISO = customDate ? customDate : dateFilter === 'today' ? todayISO : dateFilter === 'yesterday' ? yesterdayISO : '';

      if (targetDateISO) {
        const itemISO = safeParseDate(o.orderDate).toISOString().slice(0, 10);
        if (itemISO !== targetDateISO) return false;
      }

      return true;
    });
  }, [activeOrders, users, searchQuery, statusFilter, dateFilter, customDate]);

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

  // Dedicated Fulfillment Sheet View (No Pop-up)
  if (selectedOrderDetail) {
    const o = selectedOrderDetail;
    const u = users.find((usr) => usr.id === o.userId);
    const custName = u?.name || 'Customer';
    const custPhone = u?.phone || 'N/A';
    const custEmail = u?.email || 'N/A';
    const addressText = o.address || u?.savedAddresses?.[0] || 'Address Pending';
    const currentAgent = deliveryAgents.find((a) => a.id === o.deliveryAgentId);
    const subtotalCalc = o.items?.reduce((sum, i) => sum + i.quantity * (i.product?.price || 90), 0) || o.totalAmount || 360;

    const cgstCalc = Math.round(subtotalCalc * 0.025 * 100) / 100;
    const sgstCalc = Math.round(subtotalCalc * 0.025 * 100) / 100;
    const grandTotalCalc = subtotalCalc + cgstCalc + sgstCalc;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
        
        {/* Banner Header with Back Button */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '16px',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setSelectedOrderDetail(null)}
              title="Back to Orders Console"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '1px solid #E5E7EB',
                backgroundColor: '#F9FAFB',
                color: '#111827',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#111827' }}>
                Order Fulfillment Sheet: {o.id}
              </h2>
              <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px' }}>
                Created on {new Date(o.orderDate || Date.now()).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'medium' })} • Hub: {hubCodeName}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            
            {/* PRINT TAX BILL BUTTON */}
            <button
              onClick={() => {
                setActivePrintOrder(o);
                setShowPrintBillModal(true);
              }}
              style={{
                padding: '0.55rem 1.15rem',
                borderRadius: '10px',
                backgroundColor: '#047857',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(4, 120, 87, 0.2)'
              }}
            >
              <Printer size={16} /> Print Tax Bill Invoice
            </button>

            {(o.isSubscriptionDelivery || o.orderType === 'subscription') && onNavigateTab && (
              <button
                onClick={() => onNavigateTab('subscriptions', o.id)}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '10px',
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  border: '1px solid #A7F3D0',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Calendar size={14} /> View Subscription Schedule
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Left Column: Items Spec & Action Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Products Spec */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#111827' }}>
                  Products &amp; Items Spec
                </h3>
                <button
                  onClick={() => {
                    setActivePrintOrder(o);
                    setShowPrintBillModal(true);
                  }}
                  style={{ fontSize: '0.78rem', fontWeight: 700, color: '#047857', border: '1px solid #A7F3D0', backgroundColor: '#ECFDF5', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Printer size={14} /> Print Bill
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {o.items?.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '12px', backgroundColor: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src={item.product?.imageUrl || 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80'}
                        alt={item.product?.name}
                        style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#111827' }}>
                          {item.product?.name || 'Organic Farm Milk'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px' }}>
                          Qty: <strong>{item.quantity}</strong> x ₹{item.product?.price || 90} ({item.product?.unit || 'Glass Bottle'})
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#111827' }}>
                      ₹{item.quantity * (item.product?.price || 90)}
                    </div>
                  </div>
                ))}

                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6B7280' }}>
                    <span>Subtotal Items</span>
                    <span style={{ fontWeight: 700, color: '#111827' }}>₹{subtotalCalc}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6B7280' }}>
                    <span>CGST (2.5%) + SGST (2.5%)</span>
                    <span style={{ fontWeight: 700, color: '#111827' }}>₹{cgstCalc + sgstCalc}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6B7280' }}>
                    <span>Doorstep Hub Delivery</span>
                    <span style={{ fontWeight: 800, color: '#059669' }}>FREE</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 800, color: '#111827', marginTop: '6px', borderTop: '1.5px solid #E5E7EB', paddingTop: '8px' }}>
                    <span>Total Amount Payable</span>
                    <span style={{ color: '#047857' }}>₹{grandTotalCalc}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Status Panel */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#111827' }}>
                Fulfillment Operations Panel
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: '#374151' }}>UPDATE DELIVERY STATUS</label>
                  <select
                    value={o.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value as Order['status'];
                      onUpdateOrderStatus(o.id, nextStatus);
                      setSelectedOrderDetail({ ...o, status: nextStatus });
                      showToast(`Updated order status to ${nextStatus}`, 'success');
                    }}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#F9FAFB', fontSize: '0.85rem', fontWeight: 700 }}
                  >
                    <option value="packed">Packed</option>
                    <option value="outForDelivery">Out For Delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: '#374151' }}>CANCEL ORDER</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Enter cancellation reason..."
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      style={{ flex: 1, padding: '0.55rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.82rem', outline: 'none' }}
                    />
                    <button
                      onClick={() => {
                        onUpdateOrderStatus(o.id, 'cancelled');
                        setSelectedOrderDetail({ ...o, status: 'cancelled' });
                        showToast(`Cancelled order #${o.id}: ${cancellationReason || 'No reason provided'}`, 'error');
                      }}
                      style={{ backgroundColor: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '8px', padding: '0.55rem 1rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                    >
                      Cancel Order
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Customer Profile & Rider Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Customer Details */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#111827' }}>Customer Details</h3>
                {onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab('customers', u?.id || custName)}
                    style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1px solid #A7F3D0', backgroundColor: '#ECFDF5', color: '#047857', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <UsersIcon size={14} /> View Customer Profile →
                  </button>
                )}
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#111827' }}>{custName}</div>
              <div style={{ fontSize: '0.8rem', color: '#6B7280', marginTop: '2px' }}>📞 {custPhone} • ✉️ {custEmail}</div>
              <div style={{ fontSize: '0.82rem', color: '#374151', marginTop: '6px', lineHeight: '1.4' }}>📍 {addressText}</div>
            </div>

            {/* Fulfillment Rider Info */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.85rem 0', color: '#111827' }}>
                Fulfillment Rider Information
              </h3>
              {currentAgent ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#047857', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                      {currentAgent.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#111827' }}>{currentAgent.name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>📞 {currentAgent.phone || '9876543210'} • Route: {currentAgent.assignedZone || 'Hosur Route 1'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 700, marginTop: '2px' }}>🟢 Live Active Rider ({currentAgent.vehicle || 'EV Delivery Bike'})</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#D97706', marginBottom: '0.35rem' }}>⚠️ No Driver Assigned Yet</div>
                  {onUpdateOrderDriver && (
                    <select
                      value=""
                      onChange={(e) => {
                        const agentId = e.target.value;
                        onUpdateOrderDriver(o.id, agentId);
                        setSelectedOrderDetail({ ...o, deliveryAgentId: agentId });
                        showToast('Assigned driver to order in real-time!', 'success');
                      }}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #FCD34D', backgroundColor: '#FFFFFF', color: '#111827', fontSize: '0.8rem', fontWeight: 700 }}
                    >
                      <option value="">-- Assign Realtime Driver --</option>
                      {deliveryAgents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name} ({a.assignedZone || 'Route'})</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

          </div>

        </div>

        {/* PRINT TAX BILL INVOICE MODAL & OVERLAY */}
        {renderPrintBillModal()}
      </div>
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

        {/* Status Filter Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
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
                border: '1px solid #E5E7EB',
                backgroundColor: statusFilter === s.id ? '#047857' : '#FFFFFF',
                color: statusFilter === s.id ? '#FFFFFF' : '#374151',
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
                border: '1px solid #E5E7EB',
                backgroundColor: dateFilter === p.id && !customDate ? '#0284C7' : '#FFFFFF',
                color: dateFilter === p.id && !customDate ? '#FFFFFF' : '#374151',
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
              border: '1px solid #E5E7EB',
              backgroundColor: customDate ? '#ECFDF5' : '#FFFFFF',
              color: customDate ? '#047857' : '#374151',
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
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textTransform: 'uppercase', fontSize: '0.72rem', color: '#6B7280' }}>
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

                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ fontWeight: 800, fontSize: '0.85rem', color: '#111827', padding: '0.85rem 1rem' }}>{o.id}</td>
                    <td style={{ fontWeight: 700, fontSize: '0.85rem', color: '#111827', padding: '0.85rem 1rem' }}>{customerName}</td>
                    <td style={{ fontSize: '0.78rem', color: '#374151', maxWidth: '240px', padding: '0.85rem 1rem', lineHeight: 1.4 }}>{displayAddress}</td>
                    <td style={{ fontWeight: 700, fontSize: '0.82rem', color: '#374151', padding: '0.85rem 1rem' }}>
                      {o.items?.map((i) => `${i.product?.name || 'Milk'} (x${i.quantity})`).join(', ') || 'Fresh Dairy Product'}
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
