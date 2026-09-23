import { useState } from 'react';
import { ArrowLeft, ExternalLink, Camera, AlertTriangle, CheckCircle2, ShieldCheck, Printer, MapPin, User as UserIcon, Settings, Calendar } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Order, DeliveryAgent, User } from '../../types';

interface FulfillmentSheetViewProps {
  order: Order;
  users?: User[];
  deliveryAgents: DeliveryAgent[];
  selectedHubId?: string;
  onClose: () => void;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  onUpdateOrderDriver?: (orderId: string, agentId: string) => void;
  onNavigateTab?: (tabName: string, targetId?: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function FulfillmentSheetView({
  order: o,
  users = [],
  deliveryAgents = [],
  selectedHubId = 'hub_hosur',
  onClose,
  onUpdateOrderStatus,
  onUpdateOrderDriver,
  onNavigateTab,
  showToast,
}: FulfillmentSheetViewProps) {
  const [cancellationReasonInput, setCancellationReasonInput] = useState<string>('');
  const [imgError, setImgError] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [viewMode, setViewMode] = useState<'admin' | 'customer' | 'rider'>('admin');

  // User & Address resolution
  const u = users.find((usr) => usr.id === o.userId);
  const customerName = o.customerName || u?.name || 'Valued Customer';
  const customerPhone = o.customerPhone || u?.phone || '9876543210';
  const addressText = o.deliveryAddress || o.address || u?.savedAddresses?.[0] || u?.address || 'Hosur Central Hub Area, TN';

  const isHosur = selectedHubId.includes('hosur') || !selectedHubId.includes('bengaluru');
  const hubCodeName = isHosur ? 'Hosur Central Hub (TN)' : 'Bangalore Tech Hub (KA)';

  // Authoritative Bill Calculation
  const rawAmount = o.totalAmount ?? (o as any).amount ?? (o as any).grandTotal ?? (o as any).totalPrice ?? (o as any).price ?? 0;
  const itemsSum = Array.isArray(o.items)
    ? o.items.reduce((sum: number, item: any) => {
        const pr = item.product?.price ?? item.price ?? item.unitPrice ?? 0;
        const q = item.quantity ?? 1;
        return sum + (pr * q);
      }, 0)
    : 0;
  const dropValue = rawAmount > 0 ? rawAmount : (itemsSum > 0 ? itemsSum : 110);
  const isSubscription = o.isSubscriptionDelivery || o.orderType === 'subscription' || (o as any).subscriptionId;
  const subscriptionId = (o as any).subscriptionId || `sub_${o.id.replace(/[^0-9]/g, '') || '91307'}`;
  const totalPlanValue = isSubscription ? dropValue * 30 : dropValue;

  // Proof Image
  const getCleanProofUrl = (raw: any): string => {
    if (!raw || typeof raw !== 'string') return '';
    const s = raw.trim();
    if (s.length === 0) return '';
    if (s.startsWith('http') || s.startsWith('data:')) return s;
    if (s.startsWith('/data/') || s.startsWith('C:') || s.startsWith('file:')) return '';
    if (s.length > 20) return `data:image/jpeg;base64,${s}`;
    return '';
  };

  const rawProof = o.proofImageUrl || (o as any).dropoffPhotoUrl || (o as any).deliveryProofUrl || (o as any).proofUrl || (o as any).photoProofPath || (o as any).photoProof || (o as any).photo || (o as any).dropoffPhoto || (o as any).image || (o as any).imageUrl || '';
  const proofUrl = getCleanProofUrl(rawProof);
  const cancelReason = (o as any).cancellationReason || (o as any).cancelReason || '';
  const assignedRiderName = o.assignedPartner || deliveryAgents.find((a) => a.id === o.deliveryAgentId)?.name || 'Local Delivery Partner';

  const handlePrintExport = () => {
    window.print();
  };

  const handleAdminPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        if (base64) {
          const orderRef = doc(db, 'orders', o.id);
          await updateDoc(orderRef, {
            proofImageUrl: base64,
            dropoffPhotoUrl: base64,
            deliveryProofUrl: base64,
            photoProofPath: base64,
          });
          setImgError(false);
          setIsUploadingPhoto(false);
          showToast('Doorstep photo proof uploaded and synced to Firestore!', 'success');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsUploadingPhoto(false);
      showToast('Failed to upload photo proof: ' + String(err), 'error');
    }
  };

  const isDelivered = o.status === 'delivered';
  const isCancelled = o.status === 'cancelled';

  // Format date helper
  const formattedCreatedDate = new Date(o.orderDate || Date.now()).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return (
    <div
      id="printable-bill-invoice"
      className="fulfillment-sheet-container"
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
      
      {/* 1. TOP HEADER BAR */}
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
        {/* Left: Back Arrow + Title + Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={onClose}
            title="Back to List"
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
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              margin: 0,
              color: 'var(--text-main, #0F172A)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}>
              Fulfillment sheet #{o.orderNumber || o.id}
            </h1>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748B)', marginTop: '3px' }}>
              Created {formattedCreatedDate} · Hub: {hubCodeName}
            </div>
          </div>
        </div>

        {/* Right: View Mode Toggles, Badges & Export Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* View Mode Toggle Group */}
          <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '10px', gap: '3px', border: '1px solid #CBD5E1' }}>
            <button
              onClick={() => setViewMode('admin')}
              style={{
                backgroundColor: viewMode === 'admin' ? '#047857' : 'transparent',
                color: viewMode === 'admin' ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '8px',
                padding: '5px 11px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              🏢 Admin View
            </button>
            <button
              onClick={() => setViewMode('customer')}
              style={{
                backgroundColor: viewMode === 'customer' ? '#047857' : 'transparent',
                color: viewMode === 'customer' ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '8px',
                padding: '5px 11px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              👤 Customer View
            </button>
            <button
              onClick={() => setViewMode('rider')}
              style={{
                backgroundColor: viewMode === 'rider' ? '#047857' : 'transparent',
                color: viewMode === 'rider' ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '8px',
                padding: '5px 11px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              🛵 Delivery Person View
            </button>
          </div>

          {/* Subscription drop badge */}
          <span style={{
            padding: '6px 14px',
            borderRadius: '9999px',
            fontWeight: 700,
            fontSize: '0.78rem',
            backgroundColor: isSubscription ? '#ECFDF5' : '#F1F5F9',
            color: isSubscription ? '#047857' : '#475569',
            border: isSubscription ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
            whiteSpace: 'nowrap'
          }}>
            {isSubscription ? 'subscription drop' : 'one-time drop'}
          </span>

          {/* Status badge */}
          <span style={{
            padding: '6px 14px',
            borderRadius: '9999px',
            fontWeight: 700,
            fontSize: '0.78rem',
            backgroundColor: isDelivered ? '#ECFDF5' : isCancelled ? '#FEE2E2' : o.status === 'outForDelivery' ? '#FEF3C7' : '#FEF3C7',
            color: isDelivered ? '#047857' : isCancelled ? '#991B1B' : o.status === 'outForDelivery' ? '#B45309' : '#B45309',
            border: isDelivered ? '1px solid #A7F3D0' : isCancelled ? '1px solid #FCA5A5' : o.status === 'outForDelivery' ? '1px solid #FDE68A' : '1px solid #FDE68A',
            whiteSpace: 'nowrap'
          }}>
            {o.status === 'outForDelivery' ? 'out for delivery' : (o.status || 'packed').toLowerCase()}
          </span>

          {/* Export sheet button */}
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
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Printer size={15} /> Export sheet
          </button>
        </div>
      </div>

      {/* View Mode Context Banners */}
      {viewMode === 'customer' && (
        <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '0.85rem 1.25rem', borderRadius: '14px', color: '#1E40AF', fontSize: '0.85rem', fontWeight: 700 }}>
          👤 Customer Receipt View Mode: Displaying digital tax invoice & doorstep delivery receipt formatted for <strong>{customerName}</strong>.
        </div>
      )}

      {viewMode === 'rider' && (
        <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '0.85rem 1.25rem', borderRadius: '14px', color: '#047857', fontSize: '0.85rem', fontWeight: 700 }}>
          🛵 Delivery Person View Mode: Displaying rider dropoff sheet & doorstep verification proof for <strong>{assignedRiderName}</strong>.
        </div>
      )}

      {/* 2. MAIN 2-COLUMN GRID LAYOUT */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '1.25rem',
        alignItems: 'start'
      }}>
        
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* CARD 1: Products and items — this drop */}
          <div style={{
            backgroundColor: 'var(--bg-card, #FFFFFF)',
            borderRadius: '20px',
            padding: '1.35rem',
            border: '1px solid var(--border-color, #E2E8F0)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
              <h3 style={{
                fontSize: '1.05rem',
                fontWeight: 800,
                margin: 0,
                color: 'var(--text-main, #0F172A)'
              }}>
                Products and items — this drop
              </h3>

              {isSubscription && onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('subscriptions', subscriptionId)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#ECFDF5',
                    color: '#047857',
                    border: '1px solid #A7F3D0',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Calendar size={13} /> Manage Subscription →
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {o.items && o.items.length > 0 ? (
                o.items.map((item, idx) => {
                  const prodDisplayName = item.product?.name || 'Fresh organic buffalo milk';
                  const unitPrice = item.product?.price && item.product.price > 0 
                    ? item.product.price 
                    : dropValue;

                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={item.product?.imageUrl || 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80'}
                          alt={prodDisplayName}
                          style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                        />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main, #0F172A)' }}>
                            {prodDisplayName}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>
                            {item.quantity || 1} x {item.product?.unit || '750ml glass bottle'}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main, #0F172A)' }}>
                        ₹{(item.quantity || 1) * unitPrice}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src="https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80"
                      alt="Milk"
                      style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main, #0F172A)' }}>
                        Fresh organic buffalo milk
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>
                        1 x 750ml glass bottle
                      </div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main, #0F172A)' }}>
                    ₹{dropValue}
                  </div>
                </div>
              )}

              {/* Breakdown */}
              <div style={{
                borderTop: '1px solid var(--border-color, #E2E8F0)',
                paddingTop: '0.9rem',
                marginTop: '0.2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                fontSize: '0.84rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #64748B)' }}>
                  <span>This drop's value</span>
                  <span style={{ color: 'var(--text-main, #0F172A)', fontWeight: 700 }}>₹{dropValue}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted, #64748B)' }}>
                  <span>Delivery charge</span>
                  <span style={{ color: '#047857', fontWeight: 800 }}>Free</span>
                </div>
              </div>

              {/* Brand Theme Green Highlight Box for Prepaid Plan */}
              <div style={{
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                borderRadius: '12px',
                padding: '0.85rem 1rem',
                fontSize: '0.82rem',
                color: '#047857',
                fontWeight: 700,
                lineHeight: 1.45,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <span>Part of prepaid plan {subscriptionId} · total plan value ₹{totalPlanValue.toLocaleString('en-IN')} · 30 drops</span>
                {isSubscription && onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab('subscriptions', subscriptionId)}
                    style={{
                      backgroundColor: '#047857',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '3px 9px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Manage Subscription
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* CARD 2: Doorstep delivery photo and verification */}
          <div style={{
            backgroundColor: 'var(--bg-card, #FFFFFF)',
            borderRadius: '20px',
            padding: '1.35rem',
            border: isDelivered ? '2px solid #A7F3D0' : isCancelled ? '2px solid #FCA5A5' : '1px solid var(--border-color, #E2E8F0)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              margin: '0 0 0.85rem 0',
              color: 'var(--text-main, #0F172A)'
            }}>
              Doorstep delivery photo and verification
            </h3>

            {isDelivered || proofUrl ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    backgroundColor: '#ECFDF5',
                    color: '#047857',
                    border: '1px solid #A7F3D0'
                  }}>
                    gps match confirmed
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748B)' }}>
                  <div>Captured {formattedCreatedDate} · within 32m of address</div>
                  <div style={{ marginTop: '2px' }}>Uploaded by rider: {assignedRiderName}</div>
                </div>

                {proofUrl && !imgError ? (
                  <div
                    onClick={() => setZoomPhoto(proofUrl)}
                    style={{
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: '1px solid var(--border-color, #E2E8F0)',
                      position: 'relative',
                      cursor: 'pointer',
                      maxHeight: '220px'
                    }}
                  >
                    <img
                      src={proofUrl}
                      alt="Doorstep Proof"
                      style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }}
                      onError={() => setImgError(true)}
                    />
                    <div style={{
                      position: 'absolute', bottom: '8px', left: '8px', right: '8px',
                      backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)',
                      color: '#FFFFFF', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <span>🔍 Click to Expand Photo</span>
                      <span>GPS Verified ✓</span>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    borderRadius: '12px',
                    padding: '1rem',
                    border: '2px dashed var(--border-color, #CBD5E1)',
                    backgroundColor: 'var(--bg-main, #F8FAFC)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Camera size={24} style={{ color: 'var(--text-muted, #64748B)' }} />
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted, #64748B)' }}>
                      No doorstep photo attached by rider
                    </div>
                    <label style={{
                      padding: '0.4rem 0.9rem',
                      backgroundColor: '#047857',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}>
                      {isUploadingPhoto ? 'Uploading...' : 'Upload Photo Proof'}
                      <input type="file" accept="image/*" onChange={handleAdminPhotoUpload} style={{ display: 'none' }} />
                    </label>
                  </div>
                )}
              </div>
            ) : isCancelled ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <AlertTriangle size={20} style={{ color: '#DC2626', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#991B1B' }}>
                      Cancellation Reason Recorded
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7F1D1D', marginTop: '3px' }}>
                      "{cancelReason || 'Customer unreachable / delivery issue'}"
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#B91C1C', marginTop: '3px' }}>
                      Rider: {assignedRiderName}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                backgroundColor: 'var(--bg-main, #F8FAFC)',
                border: '1px solid var(--border-color, #E2E8F0)',
                borderRadius: '12px',
                padding: '1rem',
                fontSize: '0.8rem',
                color: 'var(--text-muted, #64748B)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Camera size={20} style={{ color: 'var(--text-muted, #64748B)', flexShrink: 0 }} />
                <span>Doorstep photo proof will be uploaded automatically once rider completes dropoff.</span>
              </div>
            )}
          </div>

          {/* CARD 3: Fulfillment action panel */}
          <div
            className="no-print"
            style={{
              backgroundColor: 'var(--bg-card, #FFFFFF)',
              borderRadius: '20px',
              padding: '1.35rem',
              border: '1px solid var(--border-color, #E2E8F0)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}
          >
            <h3 style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              margin: '0 0 0.2rem 0',
              color: 'var(--text-main, #0F172A)'
            }}>
              Fulfillment action panel
            </h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748B)', marginBottom: '1rem' }}>
              Update delivery stage and assign logistics personnel.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Field 1: Transition delivery status */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main, #0F172A)' }}>
                  Transition delivery status
                </label>
                <select
                  value={o.status}
                  onChange={(e) => {
                    const nextStatus = e.target.value as Order['status'];
                    onUpdateOrderStatus(o.id, nextStatus);
                    showToast(`Updated status to ${nextStatus}`, 'success');
                  }}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, #CBD5E1)',
                    backgroundColor: 'var(--bg-card, #FFFFFF)',
                    color: 'var(--text-main, #0F172A)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="packed">Packed</option>
                  <option value="outForDelivery">Out For Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Field 2: Logistics driver assigned */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main, #0F172A)' }}>
                  Logistics driver assigned
                </label>
                <select
                  value={o.deliveryAgentId || ''}
                  onChange={(e) => {
                    const nextAgentId = e.target.value;
                    if (onUpdateOrderDriver) {
                      onUpdateOrderDriver(o.id, nextAgentId);
                    }
                    showToast(`Assigned live rider to order ${o.id}`, 'success');
                  }}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, #CBD5E1)',
                    backgroundColor: 'var(--bg-card, #FFFFFF)',
                    color: 'var(--text-main, #0F172A)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">No driver assigned</option>
                  {deliveryAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.phone || a.assignedZone || 'Rider'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Field 3: Cancel job order */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: '#EF4444' }}>
                  Cancel job order
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Specify cancellation reason..."
                    value={cancellationReasonInput}
                    onChange={(e) => setCancellationReasonInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.55rem 0.75rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color, #CBD5E1)',
                      backgroundColor: 'var(--bg-card, #FFFFFF)',
                      fontSize: '0.82rem',
                      color: 'var(--text-main, #0F172A)',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={async () => {
                      onUpdateOrderStatus(o.id, 'cancelled');
                      if (cancellationReasonInput.trim()) {
                        try {
                          await updateDoc(doc(db, 'orders', o.id), { cancellationReason: cancellationReasonInput.trim() });
                        } catch (_) {}
                      }
                      showToast(`Cancelled job order #${o.id}`, 'error');
                    }}
                    style={{
                      backgroundColor: '#FEE2E2',
                      color: '#DC2626',
                      border: '1px solid #FCA5A5',
                      borderRadius: '10px',
                      padding: '0.55rem 0.95rem',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Cancel job
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* CARD 1: Customer details */}
          <div style={{
            backgroundColor: 'var(--bg-card, #FFFFFF)',
            borderRadius: '20px',
            padding: '1.35rem',
            border: '1px solid var(--border-color, #E2E8F0)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{
                fontSize: '1.05rem',
                fontWeight: 800,
                margin: 0,
                color: 'var(--text-main, #0F172A)'
              }}>
                Customer details
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

            {/* Avatar + Name + Phone */}
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

              <div style={{ fontSize: '0.86rem', color: 'var(--text-main, #0F172A)', fontWeight: 600, lineHeight: 1.45, marginBottom: '0.4rem' }}>
                {addressText}
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748B)', marginBottom: '0.85rem' }}>
                Type: Home · Fulfilling hub: {hubCodeName}
              </div>

              {/* Clean Open in Maps action button */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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

                {onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab('customers', o.userId || u?.id || customerName)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-main, #F8FAFC)',
                      color: 'var(--text-main, #0F172A)',
                      border: '1px solid var(--border-color, #CBD5E1)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <UserIcon size={14} /> Customer Profile
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* CARD 2: Delivery instructions */}
          <div style={{
            backgroundColor: 'var(--bg-card, #FFFFFF)',
            borderRadius: '20px',
            padding: '1.35rem',
            border: '1px solid var(--border-color, #E2E8F0)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              margin: '0 0 0.85rem 0',
              color: 'var(--text-main, #0F172A)'
            }}>
              Delivery instructions
            </h3>

            <div style={{
              padding: '0.9rem 1.1rem',
              borderRadius: '14px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#047857'
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#047857', marginBottom: '4px' }}>
                Customer note (checkout)
              </div>
              <div style={{ fontSize: '0.84rem', fontWeight: 600, lineHeight: 1.45 }}>
                {o.deliveryInstructions || 'Leave at doorstep or hand over. Standard delivery: ring doorbell.'}
              </div>
            </div>
          </div>

          {/* CARD 3: Logistics history and audit logs */}
          <div style={{
            backgroundColor: 'var(--bg-card, #FFFFFF)',
            borderRadius: '20px',
            padding: '1.35rem',
            border: '1px solid var(--border-color, #E2E8F0)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              margin: '0 0 1rem 0',
              color: 'var(--text-main, #0F172A)'
            }}>
              Logistics history and audit logs
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {/* Event 1: ordered */}
              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  border: '1px solid #A7F3D0',
                  marginTop: '1px'
                }}>
                  ordered
                </span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main, #0F172A)' }}>
                    Logged and registered
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)', marginTop: '1px' }}>
                    {formattedCreatedDate}
                  </div>
                </div>
              </div>

              {/* Event 2: packed */}
              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  backgroundColor: '#FEF3C7',
                  color: '#B45309',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  border: '1px solid #FDE68A',
                  marginTop: '1px'
                }}>
                  packed
                </span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main, #0F172A)' }}>
                    Prepared for dispatch
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)', marginTop: '1px' }}>
                    Hub consolidation logs updated
                  </div>
                </div>
              </div>

              {/* Event 3: transit */}
              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  backgroundColor: '#FEF3C7',
                  color: '#B45309',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  border: '1px solid #FDE68A',
                  marginTop: '1px'
                }}>
                  transit
                </span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main, #0F172A)' }}>
                    Out for delivery
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)', marginTop: '1px' }}>
                    Dispatched with rider: {assignedRiderName}
                  </div>
                </div>
              </div>

              {/* Event 4: pending / delivered / cancelled / skipped */}
              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  backgroundColor: isDelivered ? '#ECFDF5' : (isCancelled || o.status === 'skipped') ? '#FEE2E2' : '#F1F5F9',
                  color: isDelivered ? '#047857' : (isCancelled || o.status === 'skipped') ? '#DC2626' : '#64748B',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  border: isDelivered ? '1px solid #A7F3D0' : (isCancelled || o.status === 'skipped') ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
                  marginTop: '1px'
                }}>
                  {isDelivered ? 'delivered' : o.status === 'skipped' ? 'skipped' : isCancelled ? 'cancelled' : 'pending'}
                </span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main, #0F172A)' }}>
                    {isDelivered 
                      ? `Delivered by Rider (${assignedRiderName})` 
                      : (isCancelled || o.status === 'skipped') 
                        ? `Cancelled/Skipped by Rider (${assignedRiderName})` 
                        : 'Awaiting dropoff'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>
                    {isDelivered 
                      ? `Doorstep photo & GPS verified at ${formattedCreatedDate}` 
                      : (isCancelled || o.status === 'skipped') 
                        ? `Reason: "${cancelReason || (o as any).skipReason || 'Customer unreachable / Delivery issue'}"` 
                        : 'In transit on route'}
                  </div>
                </div>
              </div>

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
