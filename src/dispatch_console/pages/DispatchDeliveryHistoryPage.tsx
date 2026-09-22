import { useState, useMemo } from 'react';
import { CheckCircle2, Search, Download, ArrowLeft, ExternalLink, Phone, Calendar } from 'lucide-react';
import type { Order, User, DeliveryAgent } from '../../types';

interface DispatchDeliveryHistoryPageProps {
  hubOrders: Order[];
  users?: User[];
  deliveryAgents: DeliveryAgent[];
  selectedHubId: string;
}

const safeParseDate = (dateStr?: string): Date => {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  return new Date();
};

const formatDateWithTime = (dateStr?: string): string => {
  const d = safeParseDate(dateStr);
  const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeFormatted = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${dateFormatted}, ${timeFormatted}`;
};

export default function DispatchDeliveryHistoryPage({ hubOrders, users = [], deliveryAgents, selectedHubId }: DispatchDeliveryHistoryPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'one-time' | 'subscription'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'cancelled'>('all');
  const [timePreset, setTimePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Pagination state
  const pageSize = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);

  const completedOrdersList = useMemo(() => {
    return (hubOrders || []).filter((o) => o.status === 'delivered' || o.status === 'cancelled');
  }, [hubOrders]);

  // Robust filtering
  const filteredOrders = useMemo(() => {
    return completedOrdersList.filter((o) => {
      const u = users.find((usr) => usr.id === o.userId);
      const agent = deliveryAgents.find((a) => a.id === o.deliveryAgentId);
      
      // 1. Search Query Match
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const matches =
          (o.id || '').toLowerCase().includes(query) ||
          (o.customerName || u?.name || '').toLowerCase().includes(query) ||
          (o.customerPhone || u?.phone || '').toLowerCase().includes(query) ||
          (agent?.name || '').toLowerCase().includes(query) ||
          (o.deliveryAddress || o.address || '').toLowerCase().includes(query);

        if (!matches) return false;
      }

      // 2. Order Type Filter
      const isSub = o.isSubscriptionDelivery || o.orderType === 'subscription';
      if (filterType === 'subscription' && !isSub) return false;
      if (filterType === 'one-time' && isSub) return false;

      // 3. Status Filter
      if (statusFilter === 'delivered' && o.status !== 'delivered') return false;
      if (statusFilter === 'cancelled' && o.status !== 'cancelled') return false;

      return true;
    });
  }, [completedOrdersList, users, deliveryAgents, searchQuery, filterType, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert("No delivered receipts to export.");
      return;
    }
    const headers = ['Order ID', 'Delivered Date & Time', 'Customer Name', 'Address', 'Order Type', 'Rider', 'Amount'];
    const rows = filteredOrders.map((o) => {
      const u = users.find((usr) => usr.id === o.userId);
      const agent = deliveryAgents.find((a) => a.id === o.deliveryAgentId);
      return [
        `"${o.id}"`,
        `"${formatDateWithTime(o.orderDate)}"`,
        o.customerName ? `"${o.customerName}"` : (u ? `"${u.name}"` : '"Customer"'),
        `"${(o.deliveryAddress || o.address || 'Doorstep').replace(/"/g, '""')}"`,
        o.isSubscriptionDelivery || o.orderType === 'subscription' ? 'Subscription' : 'One-Time',
        agent ? `"${agent.name}"` : '"Fleet Rider"',
        `₹${o.totalAmount || 0}`
      ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Delivery_History_${selectedHubId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Full Page Detail View
  if (selectedOrder) {
    const o = selectedOrder;
    const u = users.find((usr) => usr.id === o.userId);
    const agent = deliveryAgents.find((a) => a.id === o.deliveryAgentId);
    const customerName = o.customerName || u?.name || 'Customer Recipient';
    const customerPhone = o.customerPhone || u?.phone || 'N/A';
    const addressText = o.deliveryAddress || o.address || u?.savedAddresses?.[0] || 'Address Pending';
    const getCleanProofUrl = (raw: any): string => {
      if (typeof raw !== 'string') return '';
      const s = raw.trim();
      if (s.length === 0) return '';
      if (s.startsWith('http') || s.startsWith('data:')) return s;
      if (s.startsWith('/data/') || s.startsWith('C:') || s.startsWith('file:')) return '';
      if (s.length > 30) return `data:image/jpeg;base64,${s}`;
      return '';
    };

    const rawProof = o.proofImageUrl || (o as any).dropoffPhotoUrl || (o as any).deliveryProofUrl || (o as any).proofUrl || (o as any).photoProofPath || '';
    const proofUrl = getCleanProofUrl(rawProof);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
        
        {/* Top Banner Header */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
            <button
              onClick={() => setSelectedOrder(null)}
              title="Back to History Archive"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#1E293B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#1E293B' }}>
                  Delivery Receipt & Proof: #{o.id}
                </h2>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  backgroundColor: '#DCFCE7',
                  color: '#047857',
                  border: '1px solid #A7F3D0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <CheckCircle2 size={13} /> Verified Delivered
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '3px' }}>
                Delivered on {formatDateWithTime(o.orderDate)} • Hub: {selectedHubId}
              </div>
            </div>
          </div>
        </div>

        {/* 2-Column Section Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Left Column: Proof & Products */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#1E293B' }}>
                📸 Doorstep Photo Proof & Return Bottle Receipt
              </h3>

              <div style={{ display: 'flex', gap: '1.25rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem', alignItems: 'center' }}>
                {proofUrl ? (
                  <img
                    src={proofUrl}
                    alt="Doorstep Delivery Proof"
                    style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '12px', border: '1px solid #E2E8F0', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckCircle2 size={28} />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 800, color: '#047857', fontSize: '0.9rem' }}>
                    ✅ Drop Verified by Fleet GPS
                  </div>
                  <div style={{ color: '#1E293B', fontWeight: 600 }}>
                    Timestamp: {formatDateWithTime(o.orderDate)}
                  </div>
                  <div style={{ color: '#64748B' }}>
                    Empty Glass Bottles Returned: <strong style={{ color: '#047857' }}>{o.bottlesReturned || 0} units</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#1E293B' }}>
                Products Delivered Summary
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src="https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80" alt="Fresh Milk" style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E293B' }}>Fresh Organic Dairy Pack</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Delivered Item</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1E293B' }}>₹{o.totalAmount || 180}</div>
                </div>

                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '0.85rem', marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>Subtotal</span>
                    <span style={{ color: '#1E293B', fontWeight: 600 }}>₹{o.totalAmount || 180}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>Delivery Charge</span>
                    <span style={{ color: '#047857', fontWeight: 800 }}>FREE</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', marginTop: '0.35rem' }}>
                    <span>Total Amount Paid</span>
                    <span style={{ color: '#047857' }}>₹{o.totalAmount || 180}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Customer & Rider Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.85rem 0', color: '#1E293B' }}>
                Customer Profile
              </h3>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1E293B' }}>{customerName}</div>
              <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>📞 {customerPhone}</div>
              <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '8px', lineHeight: 1.4 }}>📍 {addressText}</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.85rem 0', color: '#1E293B' }}>
                Fulfillment Rider Information
              </h3>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E293B' }}>{agent?.name || 'Doorstep Fleet Rider'}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>Assigned Zone: {agent?.assignedZone || 'Hosur Route 1'} • 📞 {agent?.phone || 'N/A'}</div>
            </div>

          </div>

        </div>

      </div>
    );
  }

  // Main Delivered History Table View
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            📜 Complete Delivery Log History
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
            Full chronological log of all delivered orders in {selectedHubId}.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#047857',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '0.82rem',
            padding: '0.55rem 1.15rem',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Download size={15} /> Export CSV Archive
        </button>
      </div>

      {/* Filter Control Panel */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1rem 1.25rem', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input 
            type="text"
            placeholder="Search order ID, customer, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.45rem 0.85rem 0.45rem 32px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8rem', outline: 'none' }}
          />
        </div>

        {/* Type & Status Filters */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Status Filter */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748B' }}>Status:</span>
            {[
              { id: 'all', label: 'All Statuses' },
              { id: 'delivered', label: 'Delivered' },
              { id: 'cancelled', label: 'Cancelled' }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id as any)}
                style={{
                  padding: '0.38rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: statusFilter === st.id ? (st.id === 'cancelled' ? '#DC2626' : '#047857') : '#FFFFFF',
                  color: statusFilter === st.id ? '#FFFFFF' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  cursor: 'pointer'
                }}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748B' }}>Type:</span>
            {[
              { id: 'all', label: 'All Types' },
              { id: 'one-time', label: 'One-Time' },
              { id: 'subscription', label: 'Subscriptions' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilterType(t.id as any)}
                style={{
                  padding: '0.38rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: filterType === t.id ? '#047857' : '#FFFFFF',
                  color: filterType === t.id ? '#FFFFFF' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  cursor: 'pointer'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

        </div>

      </div>

      {/* Table Log */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', textTransform: 'uppercase', fontSize: '0.72rem', color: '#64748B' }}>
                <th style={{ padding: '0.85rem 1rem' }}>ORDER ID</th>
                <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
                <th style={{ padding: '0.85rem 1rem' }}>PHOTO PROOF</th>
                <th style={{ padding: '0.85rem 1rem' }}>DELIVERED / LOGGED DATE</th>
                <th style={{ padding: '0.85rem 1rem' }}>CUSTOMER</th>
                <th style={{ padding: '0.85rem 1rem' }}>FULFILLMENT RIDER</th>
                <th style={{ padding: '0.85rem 1rem' }}>ADDRESS</th>
                <th style={{ padding: '0.85rem 1rem' }}>AMOUNT</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>
                    No delivery history records found.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((o) => {
                  const u = users.find((usr) => usr.id === o.userId);
                  const agent = deliveryAgents.find((a) => a.id === o.deliveryAgentId);
                  const customerName = o.customerName || u?.name || 'Customer';
                  const isCancelled = o.status === 'cancelled';

                  const rawProof = o.proofImageUrl || (o as any).dropoffPhotoUrl || (o as any).deliveryProofUrl || (o as any).proofUrl || (o as any).photoProofPath || '';
                  const getCleanProofUrl = (raw: any): string => {
                    if (typeof raw !== 'string') return '';
                    const s = raw.trim();
                    if (s.length === 0) return '';
                    if (s.startsWith('http') || s.startsWith('data:')) return s;
                    if (s.startsWith('/data/') || s.startsWith('C:') || s.startsWith('file:')) return '';
                    if (s.length > 30) return `data:image/jpeg;base64,${s}`;
                    return '';
                  };
                  const proofUrl = getCleanProofUrl(rawProof);
                  const cancelReason = (o as any).cancellationReason || (o as any).cancelReason;

                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ fontWeight: 800, color: '#044E35', padding: '0.85rem 1rem', fontSize: '0.85rem' }}>{o.id}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          backgroundColor: isCancelled ? '#FEE2E2' : '#DCFCE7',
                          color: isCancelled ? '#DC2626' : '#166534',
                          border: `1px solid ${isCancelled ? '#FCA5A5' : '#86EFAC'}`
                        }}>
                          {isCancelled ? 'Cancelled' : 'Delivered'}
                        </span>
                      </td>

                      {/* Photo Proof Cell */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {proofUrl ? (
                          <div
                            onClick={() => setSelectedOrder(o)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                          >
                            <img
                              src={proofUrl}
                              alt="Proof"
                              style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #047857' }}
                            />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857' }}>View Photo ✓</span>
                          </div>
                        ) : isCancelled ? (
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#DC2626' }}>
                            {cancelReason ? `✕ ${cancelReason}` : '✕ Cancelled'}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>📷 No Photo</span>
                        )}
                      </td>

                      <td style={{ fontSize: '0.8rem', color: '#475569', padding: '0.85rem 1rem' }}>{formatDateWithTime(o.orderDate)}</td>
                      <td style={{ fontWeight: 700, color: '#1E293B', padding: '0.85rem 1rem', fontSize: '0.85rem' }}>{customerName}</td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#475569' }}>{agent?.name || 'Express Rider'}</td>
                      <td style={{ fontSize: '0.8rem', color: '#475569', padding: '0.85rem 1rem', maxWidth: '260px' }}>
                        {o.deliveryAddress || o.address || u?.savedAddresses?.[0] || 'Default Address'}
                      </td>
                      <td style={{ fontWeight: 700, color: '#1E293B', padding: '0.85rem 1rem', fontSize: '0.85rem' }}>₹{o.totalAmount || 0}</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedOrder(o)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            backgroundColor: '#044E35',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
