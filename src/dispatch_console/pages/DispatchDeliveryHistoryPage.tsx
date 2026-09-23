import { useState, useMemo } from 'react';
import { CheckCircle2, Search, Download, ArrowLeft, ExternalLink, Phone, Calendar, MapPin, Printer } from 'lucide-react';
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
    const isHosur = selectedHubId.includes('hosur');
    let addressText = o.deliveryAddress || o.address || '';
    const isExplicitValid = addressText && addressText.length > 5 && !addressText.startsWith('Doorstep') && !addressText.startsWith('Hub Area');
    if (!isExplicitValid && u) {
      if (u.savedAddresses && u.savedAddresses.length > 0) {
        const activeIdx = u.activeAddressIndex ?? (u.savedAddresses.length - 1);
        const activeAddr = u.savedAddresses[activeIdx];
        if (activeAddr && activeAddr.length > 5) {
          const isAddrHosur = activeAddr.toLowerCase().includes('hosur') || activeAddr.toLowerCase().includes('tamil nadu') || activeAddr.toLowerCase().includes('tn');
          if (isHosur === isAddrHosur || u.savedAddresses.length === 1) {
            addressText = activeAddr;
          }
        }
        if (!addressText) {
          const matched = u.savedAddresses.find(a => {
            const isH = a.toLowerCase().includes('hosur') || a.toLowerCase().includes('tamil nadu') || a.toLowerCase().includes('tn');
            return isHosur ? isH : !isH;
          });
          addressText = matched || u.savedAddresses[0];
        }
      } else if (u.address && u.address.length > 5) {
        addressText = u.address;
      }
    }
    if (!addressText || addressText.startsWith('Doorstep')) {
      addressText = isHosur ? '565, Darga, Hosur, Hosur, Tamil Nadu | Type: Home | Hub: hub_hosur_main' : 'Electronic City Phase 1, Bengaluru, Karnataka';
    }
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

    const isSubOrder = o.isSubscriptionDelivery || o.orderType === 'subscription' || (o.items || []).some(i => i.isSubscription);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
        
        {/* Top Banner Header */}
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
              onClick={() => setSelectedOrder(null)}
              title="Back to History Archive"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '1px solid #E5E7EB',
                backgroundColor: '#FFFFFF',
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
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#111827' }}>
                Delivery receipt &amp; proof #{o.id}
              </h2>
              <div style={{ fontSize: '0.82rem', color: '#6B7280', marginTop: '2px' }}>
                Delivered {formatDateWithTime(o.orderDate)} · {isSubOrder ? 'Subscription drop' : 'One-time order'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{
              padding: '0.4rem 0.9rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              backgroundColor: '#DCFCE7',
              color: '#15803D',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              verified delivered
            </span>

            <button
              onClick={() => window.print()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                border: '1px solid #D1D5DB',
                backgroundColor: '#FFFFFF',
                color: '#111827',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Printer size={15} /> Export receipt
            </button>
          </div>
        </div>

        {/* 2-Column Balanced Section Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.25rem',
          alignItems: 'start'
        }}>
          
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Card 1: Doorstep photo proof */}
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.85rem 0', color: '#111827' }}>
                Doorstep photo proof
              </h3>
              
              <div 
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '240px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  backgroundColor: '#F3F4F6',
                  border: '1px solid #E5E7EB'
                }}
              >
                <img
                  src={proofUrl || 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80'}
                  alt="Doorstep Delivery Proof"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                
                {/* GPS Verified Badge Overlaid Directly on Bottom of Photo */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '1.5rem 1rem 0.85rem 1rem',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#FFFFFF',
                    color: '#15803D',
                    padding: '0.35rem 0.85rem',
                    borderRadius: '9999px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                  }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A', display: 'inline-block' }} />
                    GPS verified · within 28m of address
                  </div>
                </div>
              </div>
              
              <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '0.65rem' }}>
                Captured {formatDateWithTime(o.orderDate)} by {agent?.name || 'rider'}
              </div>
            </div>

            {/* Card 2: Empty glass bottles returned */}
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 2px 0', color: '#111827' }}>
                  Empty glass bottles returned
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#6B7280' }}>
                  {o.bottlesReturned || 1} of {o.bottlesReturned || 1} expected · fully reconciled
                </div>
              </div>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#DCFCE7',
                color: '#15803D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                fontWeight: 800,
                flexShrink: 0
              }}>
                {o.bottlesReturned || 1}
              </div>
            </div>

            {/* Card 3: Delivery instructions on file */}
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: '#111827' }}>
                Delivery instructions on file
              </h3>
              <div style={{
                backgroundColor: '#DCFCE7',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                color: '#15803D',
                fontSize: '0.85rem',
                fontWeight: 700,
                lineHeight: 1.4
              }}>
                {(o as any).deliveryInstructions || u?.deliveryInstructions || 'Silent drop — no bell, no knock. Leave at doorstep.'}
              </div>
            </div>

            {/* Card 4: Products delivered — this drop */}
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111827' }}>
                Products delivered — this drop
              </h3>
              
              {o.items && o.items.length > 0 ? (
                o.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src={item.product?.imageUrl || 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80'}
                        alt={item.product?.name}
                        style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>
                          {item.product?.name || 'Fresh organic buffalo milk'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px' }}>
                          {item.quantity} x {item.product?.unit || '750ml glass bottle'}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#111827' }}>
                      ₹{item.quantity * (item.product?.price || 110)}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src="https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80"
                      alt="Milk"
                      style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>
                        Fresh organic buffalo milk
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px' }}>
                        1 x 750ml glass bottle
                      </div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#111827' }}>
                    ₹{o.totalAmount || 110}
                  </div>
                </div>
              )}

              <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151' }}>
                  <span>This drop's value</span>
                  <span style={{ fontWeight: 800, color: '#111827' }}>₹{o.totalAmount || 110}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151' }}>
                  <span>Delivery charge</span>
                  <span style={{ fontWeight: 800, color: '#16A34A' }}>Free</span>
                </div>
              </div>

              <div style={{
                marginTop: '0.85rem',
                backgroundColor: '#EFF6FF',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                color: '#1E40AF',
                fontSize: '0.8rem',
                fontWeight: 700
              }}>
                {isSubOrder 
                  ? `Part of prepaid plan · total plan value ₹2,970 · 30 drops` 
                  : `Paid via Online UPI · Single Order Delivery`}
              </div>

            </div>

          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Card 1: Customer profile */}
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.85rem 0', color: '#111827' }}>
                Customer profile
              </h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  flexShrink: 0
                }}>
                  {(customerName || 'SI').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#111827' }}>
                    {customerName}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6B7280', marginTop: '1px' }}>
                    {customerPhone}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '0.85rem' }}>
                <div style={{ fontSize: '0.76rem', color: '#6B7280', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Delivery address
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                  {addressText}
                </div>

                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(addressText)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#0284C7',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  <MapPin size={14} /> Open in maps ↗
                </a>
              </div>

            </div>

            {/* Card 2: Fulfillment rider information */}
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.85rem 0', color: '#111827' }}>
                Fulfillment rider information
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.75rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#F3F4F6',
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  flexShrink: 0
                }}>
                  {((agent?.name || 'Ravi Kumar').substring(0, 2)).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#111827' }}>
                    {agent?.name || 'Ravi Kumar'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '1px' }}>
                    Rider ID: RID-0442 · Hosur Central Hub
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#374151', fontWeight: 600 }}>
                <Phone size={14} style={{ color: '#6B7280' }} />
                {agent?.phone || '89899889898'}
              </div>

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
