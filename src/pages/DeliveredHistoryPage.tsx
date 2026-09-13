import { useState, useMemo } from 'react';
import { CheckCircle2, Search, Download, ArrowLeft, ExternalLink, Phone, Calendar } from 'lucide-react';
import type { Order, User, DeliveryAgent } from '../types';
import { useToast } from '../context/ToastContext';

interface DeliveredHistoryPageProps {
  orders: Order[];
  users: User[];
  deliveryAgents: DeliveryAgent[];
  onNavigateTab?: (tab: string) => void;
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

const formatDateWithTime = (dateStr?: string): string => {
  const d = safeParseDate(dateStr);
  const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeFormatted = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${dateFormatted}, ${timeFormatted}`;
};

export default function DeliveredHistoryPage({ orders, users, deliveryAgents, onNavigateTab }: DeliveredHistoryPageProps) {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'one-time' | 'subscription'>('all');
  const [timePreset, setTimePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Pagination state
  const pageSize = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);

  const deliveredOrdersList = useMemo(() => {
    return orders.filter((o) => o.status === 'delivered');
  }, [orders]);

  // Robust filtering
  const filteredOrders = useMemo(() => {
    return deliveredOrdersList.filter((o) => {
      const u = users.find((usr) => usr.id === o.userId);
      const agent = deliveryAgents.find((a) => a.id === o.deliveryAgentId);
      
      // 1. Search Query Match
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const matches =
          o.id.toLowerCase().includes(query) ||
          (u?.name || '').toLowerCase().includes(query) ||
          (u?.phone || '').toLowerCase().includes(query) ||
          (agent?.name || '').toLowerCase().includes(query) ||
          (o.address || '').toLowerCase().includes(query) ||
          (o.items || []).some(item => (item.product?.name || '').toLowerCase().includes(query));

        if (!matches) return false;
      }

      // 2. Order Type Filter
      const isSub = o.isSubscriptionDelivery || o.orderType === 'subscription';
      if (filterType === 'subscription' && !isSub) return false;
      if (filterType === 'one-time' && isSub) return false;

      // 3. Custom Date & Time Range Presets
      const todayStr = '2026-09-09';
      const yesterdayStr = '2026-09-08';
      const targetDateISO = customDate ? customDate : timePreset === 'today' ? todayStr : timePreset === 'yesterday' ? yesterdayStr : '';

      if (targetDateISO) {
        const oDateStr = safeParseDate(o.orderDate).toISOString().slice(0, 10);
        if (oDateStr !== targetDateISO) return false;
      } else if (!customDate && timePreset !== 'all') {
        const parsedDate = safeParseDate(o.orderDate);
        const orderTime = parsedDate.getTime();
        const refTime = new Date('2026-09-09T23:59:59.999Z').getTime();
        const dayMs = 24 * 60 * 60 * 1000;
        const windowMs = timePreset === 'week' ? 7 * dayMs : 30 * dayMs;

        if (refTime - orderTime < 0 || refTime - orderTime > windowMs) return false;
      }

      return true;
    });
  }, [deliveredOrdersList, users, deliveryAgents, searchQuery, filterType, timePreset, customDate]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      showToast('No delivered receipts to export.', 'info');
      return;
    }
    const headers = ['Order ID', 'Delivered Date & Time', 'Customer Name', 'Address', 'Order Type', 'Rider', 'Bottles Returned', 'Amount'];
    const rows = filteredOrders.map((o) => {
      const u = users.find((usr) => usr.id === o.userId);
      const agent = deliveryAgents.find((a) => a.id === o.deliveryAgentId);
      return [
        `"${o.id}"`,
        `"${formatDateWithTime(o.orderDate)}"`,
        u ? `"${u.name}"` : '"Customer"',
        `"${(o.address || 'Doorstep').replace(/"/g, '""')}"`,
        o.isSubscriptionDelivery || o.orderType === 'subscription' ? 'Subscription' : 'One-Time',
        agent ? `"${agent.name}"` : '"Doorstep Fleet Rider"',
        o.bottlesReturned || 0,
        `₹${o.totalAmount}`
      ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Delivered_History_Archive_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported delivered history archive to CSV!', 'success');
  };

  // ==========================================
  // DEDICATED FULL PAGE / SECTION DETAIL VIEW (NO POPUP MODAL)
  // ==========================================
  if (selectedOrder) {
    const o = selectedOrder;
    const u = users.find((usr) => usr.id === o.userId);
    const agent = deliveryAgents.find((a) => a.id === o.deliveryAgentId);
    const customerName = u?.name || 'Customer Recipient';
    const customerPhone = u?.phone || 'N/A';
    const addressText = o.address || u?.savedAddresses?.[0] || u?.address || 'Address Pending';
    const isSubOrder = o.isSubscriptionDelivery || o.orderType === 'subscription' || (o.items || []).some(i => i.isSubscription);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
        
        {/* Top Banner Header with Icon-Only Back Button & View Subscription Button */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
            {/* Icon-Only Back Button */}
            <button
              onClick={() => setSelectedOrder(null)}
              title="Back to Delivered History Archive"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Delivery Receipt &amp; Proof: {o.id}
                </h2>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  border: '1px solid #A7F3D0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <CheckCircle2 size={13} /> Verified Delivered
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                Delivered on {formatDateWithTime(o.orderDate)} • Type: {isSubOrder ? 'Subscription Drop' : 'One-Time Order'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* View Subscription Button if Subscription Order */}
            {isSubOrder && onNavigateTab && (
              <button
                onClick={() => onNavigateTab('subscriptions')}
                style={{
                  padding: '0.55rem 1.15rem',
                  borderRadius: '10px',
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  border: '1px solid #A7F3D0',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Calendar size={15} /> View Subscription Details
              </button>
            )}

            {/* Print receipt button removed */}
          </div>
        </div>

        {/* 2-Column Section Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Left Column: Proof Photo & Products Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Card 1: GPS Photo Proof */}
            <div className="card-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-main)' }}>
                📸 Doorstep Photo Proof &amp; Return Bottle Receipt
              </h3>

              <div style={{
                display: 'flex',
                gap: '1.25rem',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem',
                alignItems: 'center'
              }}>
                <img
                  src={o.proofImageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=80'}
                  alt="Doorstep Delivery Proof"
                  style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '12px', border: '1px solid var(--border-color)' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=80';
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 800, color: '#047857', fontSize: '0.9rem' }}>
                    ✅ Drop Verified by Fleet GPS
                  </div>
                  <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                    Timestamp: {formatDateWithTime(o.orderDate)}
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    Empty Glass Bottles Returned: <strong style={{ color: '#047857' }}>{o.bottlesReturned || 2} units</strong>
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    Rider Note: "Placed at door mat securely as instructed."
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Items Delivered & Payment Breakdown */}
            <div className="card-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-main)' }}>
                Products Delivered Summary
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {o.items && o.items.length > 0 ? (
                  o.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={item.product?.imageUrl || 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80'}
                          alt={item.product?.name}
                          style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                            {item.product?.name || 'Fresh Organic Dairy'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {item.quantity}x ₹{item.product?.price || 90} ({item.product?.unit || 'Pack'})
                            {item.isSubscription && <span style={{ color: '#047857', fontWeight: 700, marginLeft: '6px' }}>(Subscription Item)</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                        ₹{item.quantity * (item.product?.price || 90)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src="https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80"
                        alt="Fresh Organic Buffalo Milk"
                        style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                          Fresh Organic Buffalo Milk
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          2x ₹90 (500 ml Glass Bottle)
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      ₹180
                    </div>
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem', marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Subtotal</span>
                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>₹{o.totalAmount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Delivery Charge</span>
                    <span style={{ color: '#047857', fontWeight: 800 }}>FREE</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.35rem' }}>
                    <span>Total Amount Paid</span>
                    <span style={{ color: '#047857' }}>₹{o.totalAmount}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Customer Details, Rider Details & Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Card 3: Customer Details & Map */}
            <div className="card-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Customer Profile
                </h3>
                {onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab('customers')}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid #A7F3D0',
                      backgroundColor: '#ECFDF5',
                      color: '#047857',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    View Customer Profile
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#047857',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.9rem'
                }}>
                  {customerName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    {customerName}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Phone size={12} /> {customerPhone}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    DELIVERY LOCATION
                  </div>
                  <a
                    href="https://maps.google.com/?q=12.742253,77.824213"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#047857',
                      textDecoration: 'none'
                    }}
                  >
                    📍 Open Google Maps <ExternalLink size={12} />
                  </a>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                  📍 {addressText}
                </div>
              </div>
            </div>

            {/* Card 4: Rider Details */}
            <div className="card-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.85rem 0', color: 'var(--text-main)' }}>
                Fulfillment Rider Information
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: '#0284C7',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.82rem'
                }}>
                  {(agent?.name || 'Rider').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                    {agent?.name || 'Doorstep Fleet Rider'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Assigned Zone: {agent?.assignedZone || 'Hosur Route 1'} • 📞 {agent?.phone || '9876543210'}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 5: Delivery Audit Trail Timeline */}
            <div className="card-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-main)' }}>
                Logistics Audit Timeline
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <span style={{ padding: '2px 7px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#047857', fontWeight: 800, fontSize: '0.68rem', border: '1px solid #A7F3D0' }}>
                    05:30 AM
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-main)' }}>Order Consolidated &amp; Packed</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Packed at Hosur Main Hub</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <span style={{ padding: '2px 7px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#047857', fontWeight: 800, fontSize: '0.68rem', border: '1px solid #A7F3D0' }}>
                    06:00 AM
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-main)' }}>Out for Doorstep Delivery</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Loaded into Rider Crate #4</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <span style={{ padding: '2px 7px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#047857', fontWeight: 800, fontSize: '0.68rem', border: '1px solid #A7F3D0' }}>
                    06:24 AM
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#047857' }}>Delivered &amp; Verified</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Photo proof captured by rider</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    );
  }

  // ==========================================
  // MAIN DELIVERED HISTORY ARCHIVE TABLE VIEW
  // ==========================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
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

      {/* Comprehensive Filter Bar matching Today's Deliveries / Orders page */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '1rem 1.25rem',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        
        {/* Left: Search Box */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            placeholder="Search order ID, customer, address or rider..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.85rem 0.45rem 32px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              fontSize: '0.78rem',
              color: 'var(--text-main)',
              outline: 'none'
            }}
          />
        </div>

        {/* Center: Order Type Filters */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
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
                border: '1px solid var(--border-color)',
                backgroundColor: filterType === t.id ? '#047857' : 'var(--bg-main)',
                color: filterType === t.id ? '#FFFFFF' : 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.76rem',
                cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Right: Date Presets & Date Picker */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' }
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setTimePreset(p.id as any);
                setCustomDate('');
              }}
              style={{
                padding: '0.38rem 0.65rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: timePreset === p.id && !customDate ? '#0284C7' : 'var(--bg-main)',
                color: timePreset === p.id && !customDate ? '#FFFFFF' : 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.74rem',
                cursor: 'pointer'
              }}
            >
              {p.label}
            </button>
          ))}

          {/* Date Picker Input */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setTimePreset('all');
              }}
              style={{
                padding: '0.35rem 0.55rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: customDate ? '#ECFDF5' : 'var(--bg-main)',
                color: customDate ? '#047857' : 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.76rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>

      </div>

      {/* Table Panel */}
      <div className="card-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.85rem 1rem' }}>ORDER ID</th>
                <th style={{ padding: '0.85rem 1rem' }}>DELIVERED DATE &amp; TIME</th>
                <th style={{ padding: '0.85rem 1rem' }}>CUSTOMER</th>
                <th style={{ padding: '0.85rem 1rem' }}>FULFILLMENT RIDER</th>
                <th style={{ padding: '0.85rem 1rem' }}>DELIVERY ADDRESS</th>
                <th style={{ padding: '0.85rem 1rem' }}>AMOUNT</th>
                <th style={{ padding: '0.85rem 1rem' }}>RECEIPT STATUS</th>
                <th style={{ padding: '0.85rem 1rem' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((o) => {
                const u = users.find((usr) => usr.id === o.userId);
                const agent = deliveryAgents.find((a) => a.id === o.deliveryAgentId) || { name: 'Express Rider' };
                const rawAddr = o.address || o.deliveryAddress;
                const isValidAddr = rawAddr && rawAddr !== 'Doorstep Delivery' && rawAddr !== 'Doorstep';
                const resolvedAddress = isValidAddr ? rawAddr : (u?.address || u?.savedAddresses?.[0] || 'Hosur Central Hub Area');

                return (
                  <tr 
                    key={o.id}
                    onClick={() => setSelectedOrder(o)}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                  >
                    <td style={{ fontWeight: 700, color: '#047857', padding: '0.85rem 1rem', fontSize: '0.8rem' }}>{o.id}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-main)', padding: '0.85rem 1rem', fontWeight: 500 }}>
                      {formatDateWithTime(o.orderDate)}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)', padding: '0.85rem 1rem', fontSize: '0.82rem' }}>{u?.name || 'Customer'}</td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 500 }}>{agent.name}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-main)', padding: '0.85rem 1rem', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                      {resolvedAddress}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)', padding: '0.85rem 1rem', fontSize: '0.85rem' }}>₹{o.totalAmount}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '3px 10px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} /> Verified Delivered
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedOrder(o)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          backgroundColor: 'var(--bg-main)',
                          color: 'var(--text-main)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
              {paginatedOrders.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No completed delivery receipts found matching the selected filters.
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
            Showing {filteredOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} delivered receipts
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
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              Previous
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
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Next
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
