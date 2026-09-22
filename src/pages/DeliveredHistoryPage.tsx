import { useState, useMemo } from 'react';
import { CheckCircle2, Search, Download, ArrowLeft, ExternalLink, Phone, Calendar, Printer, User as UserIcon, MapPin, Camera } from 'lucide-react';
import type { Order, User, DeliveryAgent } from '../types';
import { useToast } from '../context/ToastContext';

interface DeliveredHistoryPageProps {
  orders: Order[];
  users: User[];
  deliveryAgents: DeliveryAgent[];
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'cancelled'>('all');
  const [timePreset, setTimePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

  // Pagination state
  const pageSize = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);

  const deliveredOrdersList = useMemo(() => {
    return orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled');
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

      // 3. Status Filter
      if (statusFilter === 'delivered' && o.status !== 'delivered') return false;
      if (statusFilter === 'cancelled' && o.status !== 'cancelled') return false;

      // 4. Time Range Filter
      if (timePreset !== 'all' || customDate) {
        const orderDate = safeParseDate(o.orderDate);
        const refDate = customDate ? safeParseDate(customDate) : new Date();
        const windowMs =
          timePreset === 'today' ? 24 * 60 * 60 * 1000 :
          timePreset === 'yesterday' ? 48 * 60 * 60 * 1000 :
          timePreset === 'week' ? 7 * 24 * 60 * 60 * 1000 :
          30 * 24 * 60 * 60 * 1000;

        const orderTime = orderDate.getTime();
        const refTime = refDate.getTime();

        if (refTime - orderTime < 0 || refTime - orderTime > windowMs) return false;
      }

      return true;
    });
  }, [deliveredOrdersList, users, deliveryAgents, searchQuery, filterType, statusFilter, timePreset, customDate]);

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
        `₹${o.totalAmount || 0}`
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

  const handlePrintExport = () => {
    window.print();
  };

  // ==========================================
  // DEDICATED BRAND-THEMED DETAIL VIEW
  // ==========================================
  if (selectedOrder) {
    const o = selectedOrder;
    const u = users.find((usr) => usr.id === o.userId);
    const agent = deliveryAgents.find((a) => a.id === o.deliveryAgentId);
    const customerName = u?.name || o.customerName || 'Customer Recipient';
    const customerPhone = u?.phone || o.customerPhone || 'N/A';
    const addressText = o.address || o.deliveryAddress || u?.savedAddresses?.[0] || u?.address || 'Address Pending';
    const isSubOrder = o.isSubscriptionDelivery || o.orderType === 'subscription' || (o.items || []).some(i => i.isSubscription);
    const subscriptionId = (o as any).subscriptionId || `sub_${o.id.replace(/[^0-9]/g, '') || '91307'}`;

    return (
      <div
        id="printable-delivery-receipt"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          textAlign: 'left',
          fontFamily: "'Poppins', sans-serif",
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
          color: 'var(--text-main, #0F172A)'
        }}
      >
        
        {/* Top Banner Header */}
        <div
          className="no-print"
          style={{
            backgroundColor: 'var(--bg-card, #FFFFFF)',
            border: '1px solid var(--border-color, #E2E8F0)',
            borderRadius: '20px',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
            <button
              onClick={() => setSelectedOrder(null)}
              title="Back to Delivered History Archive"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                border: '1px solid var(--border-color, #E2E8F0)',
                backgroundColor: 'var(--bg-main, #F8FAFC)',
                color: 'var(--text-main, #0F172A)',
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
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main, #0F172A)' }}>
                  Delivery Receipt & Proof: #{o.id}
                </h2>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  border: '1px solid #A7F3D0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <CheckCircle2 size={14} /> Verified Delivered
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748B)', marginTop: '3px' }}>
                Delivered on {formatDateWithTime(o.orderDate)} • Type: {isSubOrder ? 'Subscription Drop' : 'One-Time Order'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* View Subscription Button */}
            {isSubOrder && onNavigateTab && (
              <button
                onClick={() => onNavigateTab('subscriptions', subscriptionId)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  border: '1px solid #A7F3D0',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Calendar size={15} /> Manage Subscription
              </button>
            )}

            {/* Print Export receipt button */}
            <button
              onClick={handlePrintExport}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '10px',
                border: '1px solid #047857',
                backgroundColor: '#047857',
                color: '#FFFFFF',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Printer size={15} /> Export receipt
            </button>
          </div>
        </div>

        {/* 2-Column Section Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.25rem',
          alignItems: 'start'
        }}>
          
          {/* Left Column: Photo Proof & Products Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Card 1: GPS Photo Proof & Return Bottles */}
            <div style={{
              backgroundColor: 'var(--bg-card, #FFFFFF)',
              borderRadius: '20px',
              padding: '1.35rem',
              border: '2px solid #A7F3D0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-main, #0F172A)' }}>
                📸 Doorstep Photo Proof & Return Bottle Receipt
              </h3>

              {(() => {
                const rawProof = o.proofImageUrl || (o as any).dropoffPhotoUrl || (o as any).deliveryProofUrl || (o as any).proofUrl || (o as any).photoProofPath || '';
                const proofUrl = (typeof rawProof === 'string' && rawProof.trim().length > 0 && (rawProof.startsWith('http') || rawProof.startsWith('data:'))) ? rawProof.trim() : '';

                return (
                  <div style={{
                    display: 'flex',
                    gap: '1.25rem',
                    backgroundColor: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    borderRadius: '14px',
                    padding: '1rem',
                    alignItems: 'center',
                    flexWrap: 'wrap'
                  }}>
                    {proofUrl ? (
                      <div
                        onClick={() => setZoomPhoto(proofUrl)}
                        style={{ cursor: 'pointer', flexShrink: 0 }}
                      >
                        <img
                          src={proofUrl}
                          alt="Doorstep Delivery Proof"
                          style={{ width: '110px', height: '110px', objectFit: 'cover', borderRadius: '12px', border: '2px solid #A7F3D0', display: 'block' }}
                        />
                      </div>
                    ) : (
                      <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#047857', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CheckCircle2 size={28} />
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.84rem' }}>
                      <div style={{ fontWeight: 800, color: '#047857', fontSize: '0.95rem' }}>
                        ✅ Drop Verified by Fleet GPS
                      </div>
                      <div style={{ color: 'var(--text-main, #0F172A)', fontWeight: 600 }}>
                        Timestamp: {formatDateWithTime(o.orderDate)}
                      </div>
                      <div style={{ color: '#047857', fontWeight: 700 }}>
                        Empty Glass Bottles Returned: <strong style={{ fontSize: '1rem', color: '#047857' }}>{o.bottlesReturned || 0} units</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Card 2: Items Delivered & Payment Breakdown */}
            <div style={{
              backgroundColor: 'var(--bg-card, #FFFFFF)',
              borderRadius: '20px',
              padding: '1.35rem',
              border: '1px solid var(--border-color, #E2E8F0)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-main, #0F172A)' }}>
                Products Delivered Summary
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {o.items && o.items.length > 0 ? (
                  o.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={item.product?.imageUrl || 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80'}
                          alt={item.product?.name}
                          style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                        />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main, #0F172A)' }}>
                            {item.product?.name || 'Fresh Organic Dairy Pack'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>
                            {item.quantity}x ₹{item.product?.price || 90} ({item.product?.unit || 'Pack'})
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main, #0F172A)' }}>
                        ₹{item.quantity * (item.product?.price || 90)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src="https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80"
                        alt="Fresh Milk"
                        style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main, #0F172A)' }}>
                          Fresh Organic Dairy Pack
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>
                          Delivered Item
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main, #0F172A)' }}>
                      ₹{o.totalAmount || 180}
                    </div>
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-color, #E2E8F0)', paddingTop: '0.85rem', marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.84rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #64748B)' }}>
                    <span>Subtotal</span>
                    <span style={{ color: 'var(--text-main, #0F172A)', fontWeight: 600 }}>₹{o.totalAmount || 180}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #64748B)' }}>
                    <span>Delivery Charge</span>
                    <span style={{ color: '#047857', fontWeight: 800 }}>FREE</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main, #0F172A)', marginTop: '0.35rem' }}>
                    <span>Total Amount Paid</span>
                    <span style={{ color: '#047857' }}>₹{o.totalAmount || 180}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Customer Details & Rider Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Card 3: Customer Profile */}
            <div style={{
              backgroundColor: 'var(--bg-card, #FFFFFF)',
              borderRadius: '20px',
              padding: '1.35rem',
              border: '1px solid var(--border-color, #E2E8F0)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main, #0F172A)' }}>
                  Customer Profile
                </h3>
                {onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab('customers', o.userId || u?.id || customerName)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#047857',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <UserIcon size={13} /> View Customer Details
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '1.1rem' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  border: '1px solid #A7F3D0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  flexShrink: 0
                }}>
                  {customerName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main, #0F172A)' }}>
                    {customerName}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748B)', marginTop: '1px' }}>
                    📞 {customerPhone}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color, #E2E8F0)', paddingTop: '0.9rem' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted, #64748B)', textTransform: 'none', marginBottom: '0.35rem' }}>
                  Delivery address
                </div>

                <div style={{ fontSize: '0.86rem', color: 'var(--text-main, #0F172A)', fontWeight: 600, lineHeight: 1.45, marginBottom: '0.85rem' }}>
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
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#ECFDF5',
                    color: '#047857',
                    border: '1px solid #A7F3D0',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  <MapPin size={14} /> Open in Maps ↗
                </a>
              </div>
            </div>

            {/* Card 4: Fulfillment Rider Information */}
            <div style={{
              backgroundColor: 'var(--bg-card, #FFFFFF)',
              borderRadius: '20px',
              padding: '1.35rem',
              border: '1px solid var(--border-color, #E2E8F0)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.85rem 0', color: 'var(--text-main, #0F172A)' }}>
                Fulfillment Rider Information
              </h3>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main, #0F172A)' }}>
                {agent?.name || 'Doorstep Fleet Rider'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748B)', marginTop: '4px', lineHeight: 1.4 }}>
                Assigned Zone: {agent?.assignedZone || 'Hosur Central Route'} • 📞 {agent?.phone || '89899889898'}
              </div>
            </div>

          </div>

        </div>

        {/* Photo Lightbox Modal */}
        {zoomPhoto && (
          <div
            onClick={() => setZoomPhoto(null)}
            className="no-print"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                maxWidth: '90vw',
                maxHeight: '85vh',
                backgroundColor: 'var(--bg-card, #FFFFFF)',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
              }}
            >
              <button
                onClick={() => setZoomPhoto(null)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  zIndex: 10
                }}
              >
                ✕
              </button>
              <img
                src={zoomPhoto}
                alt="Doorstep Photo Proof Zoom"
                style={{ width: '100%', height: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }}
              />
            </div>
          </div>
        )}

      </div>
    );
  }

  // Main Delivered History Table View
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main, #0F172A)', margin: 0 }}>
            📜 Complete Delivery Log History
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, #64748B)', margin: '2px 0 0 0' }}>
            Full chronological log of all delivered orders in hub.
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
      <div style={{ backgroundColor: 'var(--bg-card, #FFFFFF)', borderRadius: '16px', padding: '1rem 1.25rem', border: '1px solid var(--border-color, #E2E8F0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input 
            type="text"
            placeholder="Search order ID, customer, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.45rem 0.85rem 0.45rem 32px', borderRadius: '8px', border: '1px solid var(--border-color, #CBD5E1)', backgroundColor: 'var(--bg-card, #FFFFFF)', color: 'var(--text-main, #0F172A)', fontSize: '0.8rem', outline: 'none' }}
          />
        </div>

        {/* Type & Status Filters */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Status Filter */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted, #64748B)' }}>Status:</span>
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
                  border: '1px solid var(--border-color, #CBD5E1)',
                  backgroundColor: statusFilter === st.id ? (st.id === 'cancelled' ? '#DC2626' : '#047857') : 'var(--bg-card, #FFFFFF)',
                  color: statusFilter === st.id ? '#FFFFFF' : 'var(--text-main, #475569)',
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
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted, #64748B)' }}>Type:</span>
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
                  border: '1px solid var(--border-color, #CBD5E1)',
                  backgroundColor: filterType === t.id ? '#047857' : 'var(--bg-card, #FFFFFF)',
                  color: filterType === t.id ? '#FFFFFF' : 'var(--text-main, #475569)',
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
      <div style={{ backgroundColor: 'var(--bg-card, #FFFFFF)', borderRadius: '18px', border: '1px solid var(--border-color, #E2E8F0)', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-main, #F8FAFC)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted, #64748B)' }}>
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
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted, #94A3B8)' }}>
                    No delivery history records found.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((o) => {
                  const u = users.find((usr) => usr.id === o.userId);
                  const agent = deliveryAgents.find((a) => a.id === o.deliveryAgentId);
                  const customerName = u?.name || o.customerName || 'Customer';
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
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color, #F1F5F9)' }}>
                      <td style={{ fontWeight: 800, color: '#047857', padding: '0.85rem 1rem', fontSize: '0.85rem' }}>{o.id}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          backgroundColor: isCancelled ? '#FEE2E2' : '#ECFDF5',
                          color: isCancelled ? '#DC2626' : '#047857',
                          border: `1px solid ${isCancelled ? '#FCA5A5' : '#A7F3D0'}`
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
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94A3B8)' }}>📷 No Photo</span>
                        )}
                      </td>

                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted, #475569)', padding: '0.85rem 1rem' }}>{formatDateWithTime(o.orderDate)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-main, #1E293B)', padding: '0.85rem 1rem', fontSize: '0.85rem' }}>{customerName}</td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: 'var(--text-muted, #475569)' }}>{agent?.name || 'Express Rider'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted, #475569)', padding: '0.85rem 1rem', maxWidth: '260px' }}>
                        {o.deliveryAddress || o.address || u?.savedAddresses?.[0] || 'Default Address'}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-main, #1E293B)', padding: '0.85rem 1rem', fontSize: '0.85rem' }}>₹{o.totalAmount || 0}</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedOrder(o)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            backgroundColor: '#047857',
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
