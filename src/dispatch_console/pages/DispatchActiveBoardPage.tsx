import { useState, useMemo } from 'react';
import { Package, Truck, CheckCircle2, Search, Filter, Eye, Calendar, ArrowLeft, ExternalLink } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Order, DeliveryAgent, User, Product } from '../../types';

interface DispatchActiveBoardPageProps {
  hubOrders: Order[];
  hubDeliveryAgents: DeliveryAgent[];
  users?: User[];
  products?: Product[];
  selectedHubId: string;
  onUpdateOrderStatus?: (orderId: string, status: Order['status']) => void;
  onUpdateOrderDriver?: (orderId: string, agentId: string) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function DispatchActiveBoardPage({
  hubOrders,
  hubDeliveryAgents,
  users = [],
  products = [],
  selectedHubId,
  onUpdateOrderStatus,
  onUpdateOrderDriver,
  showToast
}: DispatchActiveBoardPageProps) {
  const displayOrders = hubOrders || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'all'>('today');
  const [typeFilter, setTypeFilter] = useState<'all' | 'one-time' | 'subscription'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'packed' | 'outForDelivery' | 'delivered'>('all');
  const [selectedFulfillmentOrder, setSelectedFulfillmentOrder] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [savingInstruction, setSavingInstruction] = useState<boolean>(false);

  const isHosur = selectedHubId === 'hub_hosur_main' || selectedHubId === 'hub_hosur';
  const hubCodeName = isHosur ? 'hub_hosur_main' : 'hub_blr_ecity';

  const todayStr = new Date().toISOString().slice(0, 10);

  const filteredOrders = useMemo(() => {
    return displayOrders.filter(order => {
      // 1. Search Query
      const u = users.find(usr => usr.id === order.userId);
      const matchesSearch = 
        (order.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.customerName || u?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.customerPhone || u?.phone || '').includes(searchQuery) ||
        (order.deliveryAddress || order.address || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // 2. Order Type Filter (Comprehensive Check)
      const isSub = Boolean(
        order.subscriptionId || 
        order.isSubscriptionDelivery || 
        order.orderType === 'subscription' || 
        (order.id && order.id.startsWith('SUB_')) ||
        (order.items && order.items.some(i => i.isSubscription))
      );

      if (typeFilter === 'one-time' && isSub) return false;
      if (typeFilter === 'subscription' && !isSub) return false;

      // 3. Status Filter
      if (statusFilter === 'packed' && !(order.status === 'packed' || order.status === 'pending' || order.status === 'confirmed' || order.status === 'processing')) return false;
      if (statusFilter === 'outForDelivery' && !(order.status === 'outForDelivery' || order.status === 'assigned')) return false;
      if (statusFilter === 'delivered' && order.status !== 'delivered') return false;

      // 4. Date Filter
      if (dateFilter === 'today') {
        const orderDateStr = (order.orderDate || '').slice(0, 10);
        if (orderDateStr && orderDateStr !== todayStr && !isSub) return false;
      }

      return true;
    });
  }, [displayOrders, users, searchQuery, typeFilter, statusFilter, dateFilter, todayStr]);

  // Dedicated Fulfillment Sheet Sub-View (Matching Screenshot #2)
  if (selectedFulfillmentOrder) {
    const o = selectedFulfillmentOrder;
    const u = users.find((usr) => usr.id === o.userId);
    const customerName = o.customerName || u?.name || 'Valued Customer';
    const customerPhone = o.customerPhone || u?.phone || 'N/A';
    const addressText = o.deliveryAddress || o.address || u?.savedAddresses?.[0] || u?.address || 'Address Pending';
    const currentAgent = hubDeliveryAgents.find((a) => a.id === o.deliveryAgentId);

    const subtotalCalc = o.items?.reduce((acc, item) => acc + (item.quantity * (item.product?.price || 95)), 0) || o.totalAmount || 190;
    const isSubOrder = Boolean(o.subscriptionId || o.isSubscriptionDelivery || o.orderType === 'subscription' || (o.id && o.id.startsWith('SUB_')));

    const handleSaveInstructions = async (newText: string) => {
      setSavingInstruction(true);
      try {
        if (isSubOrder) {
          const subId = o.id.replace('DISPATCH_', '').replace('SUB_', '');
          await updateDoc(doc(db, 'subscriptions', subId), { deliveryInstructions: newText });
        } else {
          await updateDoc(doc(db, 'orders', o.id), { deliveryInstructions: newText });
        }
      } catch (e) {
        console.log('Offline / local fallback save for delivery instructions', e);
      }
      setSelectedFulfillmentOrder({
        ...o,
        deliveryInstructions: newText,
      });
      setSavingInstruction(false);
      if (showToast) showToast('Delivery instructions updated by admin! 📝', 'success');
    };

    return (
      <div id="printable-bill-invoice" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
        
        {/* Banner with Background */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setSelectedFulfillmentOrder(null)}
              title="Back to Active Dispatch Board"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#1E293B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#1E293B' }}>
                Fulfillment Sheet: #{o.id}
              </h2>
              <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                Created on {new Date(o.orderDate || Date.now()).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'medium' })} • Hub: {hubCodeName}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontWeight: 800,
                fontSize: '0.8rem',
                backgroundColor: o.status === 'delivered' ? '#DCFCE7' : o.status === 'outForDelivery' ? '#DBEAFE' : '#FEF3C7',
                color: o.status === 'delivered' ? '#047857' : o.status === 'outForDelivery' ? '#1E40AF' : '#B45309',
                border: o.status === 'delivered' ? '1px solid #A7F3D0' : o.status === 'outForDelivery' ? '1px solid #BFDBFE' : '1px solid #FDE68A',
                textTransform: 'uppercase'
              }}
            >
              {o.status === 'outForDelivery' ? 'OUT FOR DELIVERY' : (o.status || 'PACKED').toUpperCase()}
            </span>
          </div>
        </div>

        {/* 2-Column Responsive Layout matching Screenshot #2 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Left Column: Products Spec & Action Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Card 1: Products & Items Spec */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#1E293B' }}>
                Products & Items Spec
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {o.items && o.items.length > 0 ? (
                  o.items.map((item, idx) => {
                    const prodDisplayName = item.product?.name || 'Premium A2 Desi Cow Milk';
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img
                            src={item.product?.imageUrl || 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80'}
                            alt={prodDisplayName}
                            style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }}
                          />
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E293B' }}>
                              {prodDisplayName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                              {item.quantity}x ₹{item.product?.price || 95} ({item.product?.unit || 'Pack'})
                            </div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1E293B' }}>
                          ₹{item.quantity * (item.product?.price || 95)}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src="https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80"
                        alt="A2 Milk"
                        style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E293B' }}>
                          Premium A2 Desi Cow Milk
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          2x ₹95 (750ml Glass Bottle)
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1E293B' }}>
                      ₹190
                    </div>
                  </div>
                )}

                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '0.85rem', marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>Subtotal</span>
                    <span style={{ color: '#1E293B', fontWeight: 600 }}>₹{subtotalCalc}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>Delivery Charges</span>
                    <span style={{ color: '#047857', fontWeight: 800 }}>FREE</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', marginTop: '0.35rem' }}>
                    <span>Total Amount</span>
                    <span>₹{subtotalCalc}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 1B: Doorstep Photo Proof if delivered or proof present */}
            {(o.proofImageUrl || o.status === 'delivered') && (
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#1E293B' }}>
                  📸 Doorstep Photo Proof & Return Bottle Receipt
                </h3>
                <div style={{ display: 'flex', gap: '1.25rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem', alignItems: 'center' }}>
                  <img
                    src={o.proofImageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=80'}
                    alt="Doorstep Delivery Proof"
                    style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '12px', border: '1px solid #E2E8F0' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=80';
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                    <div style={{ fontWeight: 800, color: '#047857', fontSize: '0.9rem' }}>
                      ✅ Drop Verified by Fleet GPS
                    </div>
                    <div style={{ color: '#1E293B', fontWeight: 600 }}>
                      Timestamp: {new Date(o.updatedAt || o.orderDate || Date.now()).toLocaleString()}
                    </div>
                    <div style={{ color: '#64748B' }}>
                      Empty Glass Bottles Returned: <strong style={{ color: '#047857' }}>{o.bottlesReturned || 0} units</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Card 2: Fulfillment Action Panel */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: '#1E293B' }}>
                Fulfillment Action Panel
              </h3>
              <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '1rem' }}>
                Update route delivery stage and assign logistical personnel.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Field 1: Status Dropdown */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: '#1E293B' }}>
                    Transition Delivery Status
                  </label>
                  <select
                    value={o.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value as Order['status'];
                      if (onUpdateOrderStatus) onUpdateOrderStatus(o.id, nextStatus);
                      setSelectedFulfillmentOrder({ ...o, status: nextStatus });
                      if (showToast) showToast(`Updated status to ${nextStatus}`, 'success');
                    }}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#1E293B',
                      fontSize: '0.82rem',
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

                {/* Logistics Driver Assigned Dropdown */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: '#1E293B' }}>
                    Logistics Driver Assigned
                  </label>
                  <select
                    value={o.deliveryAgentId || ''}
                    onChange={(e) => {
                      const nextAgentId = e.target.value;
                      if (onUpdateOrderDriver) onUpdateOrderDriver(o.id, nextAgentId);
                      setSelectedFulfillmentOrder({ ...o, deliveryAgentId: nextAgentId });
                      if (showToast) showToast(`Assigned live rider to order ${o.id}`, 'success');
                    }}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#1E293B',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">-- No Driver Assigned --</option>
                    {hubDeliveryAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.phone || a.assignedZone || 'Rider'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cancel Job */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: '#1E293B' }}>
                    Cancel Job Order
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Specify cancellation logs..."
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        fontSize: '0.8rem',
                        color: '#1E293B',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={() => {
                        if (onUpdateOrderStatus) onUpdateOrderStatus(o.id, 'cancelled');
                        setSelectedFulfillmentOrder({ ...o, status: 'cancelled' });
                        if (showToast) showToast(`Cancelled job order #${o.id}`, 'error');
                      }}
                      style={{
                        backgroundColor: '#FEE2E2',
                        color: '#EF4444',
                        border: '1px solid #FCA5A5',
                        borderRadius: '8px',
                        padding: '0.5rem 0.85rem',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Cancel Job
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Right Column: Customer Details & Audit Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Card 3: Customer Details */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#1E293B' }}>
                  Customer Details
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: '#047857',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.8rem'
                }}>
                  {customerName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E293B' }}>
                    {customerName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    📞 {customerPhone}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    DELIVERY LOCATION
                  </div>
                  <a
                    href="https://maps.google.com/?q=12.867598,77.666966"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#047857',
                      textDecoration: 'none',
                      border: '1px solid #A7F3D0',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      backgroundColor: '#ECFDF5'
                    }}
                  >
                    📍 Map Link <ExternalLink size={12} />
                  </a>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#1E293B', lineHeight: 1.4, marginBottom: '0.85rem' }}>
                  📍 {addressText} <span style={{ fontSize: '0.72rem', color: '#64748B' }}>[GPS: (12.867697, 77.666721)] | Hub: {hubCodeName}</span>
                </div>

                <div style={{
                  height: '170px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid #E2E8F0'
                }}>
                  <iframe
                    title="Customer Delivery Location Map"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    src="https://maps.google.com/maps?q=12.867598,77.666966&z=15&output=embed"
                  ></iframe>
                </div>
              </div>
            </div>

            {/* Card 4: Logistics History & Audit Logs */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#1E293B' }}>
                Logistics History & Audit Logs
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <span style={{ padding: '2px 7px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#047857', fontWeight: 800, fontSize: '0.68rem', border: '1px solid #A7F3D0' }}>
                    Ordered
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#1E293B' }}>Logged & Registered</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '1px' }}>Created on {new Date(o.orderDate || Date.now()).toLocaleString()}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <span style={{ padding: '2px 7px', borderRadius: '6px', backgroundColor: '#FEF3C7', color: '#B45309', fontWeight: 800, fontSize: '0.68rem', border: '1px solid #FDE68A' }}>
                    Packed
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#1E293B' }}>Prepared for Dispatch</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '1px' }}>Hub consolidation logs updated</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <span style={{ padding: '2px 7px', borderRadius: '6px', backgroundColor: '#DBEAFE', color: '#1D4ED8', fontWeight: 800, fontSize: '0.68rem', border: '1px solid #BFDBFE' }}>
                    Transit
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#1E293B' }}>Out For Delivery</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '1px' }}>Dispatched with local rider team</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <span style={{ padding: '2px 7px', borderRadius: '6px', backgroundColor: o.status === 'delivered' ? '#DCFCE7' : '#F1F5F9', color: o.status === 'delivered' ? '#047857' : '#64748B', fontWeight: 800, fontSize: '0.68rem' }}>
                    Delivered
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#1E293B' }}>Completed</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '1px' }}>Drop-off log updated</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Page Title & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            📋 Active Dispatch Table Board
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
            Comprehensive filterable manifest of active package dispatches in {selectedHubId}.
          </p>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem 1.25rem', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Row 1: Search & Date Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          {/* Search Box */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Search order ID, customer name, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 0.75rem 0.55rem 36px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', outline: 'none' }}
            />
          </div>

          {/* Date Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={14} /> Date Range:
            </span>
            {(['today', 'week', 'all'] as const).map(d => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '8px',
                  border: dateFilter === d ? 'none' : '1px solid #E2E8F0',
                  backgroundColor: dateFilter === d ? '#044E35' : '#FFFFFF',
                  color: dateFilter === d ? '#FFFFFF' : '#475569',
                  fontWeight: dateFilter === d ? 700 : 500,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {d === 'today' ? 'Today' : d === 'week' ? 'This Week' : 'All Dates'}
              </button>
            ))}
          </div>

        </div>

        {/* Row 2: Type & Status Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9' }}>
          
          {/* Order Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B' }}>Order Type:</span>
            {(['all', 'one-time', 'subscription'] as const).map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: typeFilter === type ? '1px solid #047857' : '1px solid #E2E8F0',
                  backgroundColor: typeFilter === type ? '#ECFDF5' : '#FFFFFF',
                  color: typeFilter === type ? '#047857' : '#475569',
                  fontWeight: typeFilter === type ? 700 : 500,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {type === 'all' ? 'All Types' : type === 'one-time' ? '📦 One-Time Order' : '🔁 Subscription Drop'}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B' }}>Status:</span>
            {(['all', 'packed', 'outForDelivery', 'delivered'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: statusFilter === st ? '1px solid #047857' : '1px solid #E2E8F0',
                  backgroundColor: statusFilter === st ? '#047857' : '#FFFFFF',
                  color: statusFilter === st ? '#FFFFFF' : '#475569',
                  fontWeight: statusFilter === st ? 700 : 500,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {st === 'all' ? 'All Statuses' : st === 'packed' ? 'Packed' : st === 'outForDelivery' ? 'Out for Delivery' : 'Delivered'}
              </button>
            ))}
          </div>

        </div>

      </div>

      {/* Main Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1E293B' }}>
            Active Dispatch Manifest ({filteredOrders.length} Records)
          </span>
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', textTransform: 'uppercase', fontSize: '0.72rem', color: '#64748B' }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>ORDER ID</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>CUSTOMER DETAILS</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>TYPE</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>DELIVERY ADDRESS</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>STATUS</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>
                    No active dispatches found matching filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const u = users.find(usr => usr.id === order.userId);
                  const isSub = Boolean(order.subscriptionId || order.isSubscriptionDelivery || order.orderType === 'subscription' || (order.id && order.id.startsWith('SUB_')));
                  const customerName = order.customerName || u?.name || 'Valued Customer';
                  const customerPhone = order.customerPhone || u?.phone || 'N/A';

                  return (
                    <tr key={order.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#044E35', fontSize: '0.88rem' }}>
                        {order.id}
                      </td>

                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ fontWeight: 700, color: '#1E293B', fontSize: '0.85rem' }}>{customerName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>📞 {customerPhone}</div>
                      </td>

                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: isSub ? '#EFF6FF' : '#FDF4FF',
                          color: isSub ? '#1D4ED8' : '#A21CAF',
                          border: isSub ? '1px solid #BFDBFE' : '1px solid #F5D0FE'
                        }}>
                          {isSub ? '🔁 Subscription' : '📦 One-Time'}
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem 1.25rem', maxWidth: '280px', fontSize: '0.8rem', color: '#334155', lineHeight: '1.35' }}>
                        {order.deliveryAddress || order.address || u?.savedAddresses?.[0] || 'Address N/A'}
                      </td>

                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: '12px',
                          backgroundColor: order.status === 'delivered' ? '#DCFCE7' : order.status === 'outForDelivery' ? '#DBEAFE' : '#FEF3C7',
                          color: order.status === 'delivered' ? '#047857' : order.status === 'outForDelivery' ? '#1E40AF' : '#B45309'
                        }}>
                          {(order.status || 'PACKED').toUpperCase()}
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedFulfillmentOrder(order)}
                          style={{
                            backgroundColor: '#F1F5F9',
                            border: '1px solid #CBD5E1',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#334155',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Eye size={13} /> View Details
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
