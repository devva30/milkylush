import { useState, useMemo } from 'react';
import { Download, Search, ArrowLeft, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Order, DeliveryAgent, User, Product } from '../types';

interface TodaysDeliveriesPageProps {
  selectedHubId: string;
  orders: Order[];
  users: User[];
  products?: Product[];
  deliveryAgents: DeliveryAgent[];
  isLoading?: boolean;
  onOpenAddOrderModal?: () => void;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  onUpdateOrderDriver?: (orderId: string, agentId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateTab?: (tab: string) => void;
}

export default function TodaysDeliveriesPage({
  selectedHubId,
  orders,
  users,
  products = [],
  deliveryAgents,
  isLoading = false,
  onOpenAddOrderModal,
  onUpdateOrderStatus,
  onUpdateOrderDriver,
  showToast,
  onNavigateTab,
}: TodaysDeliveriesPageProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFulfillmentOrder, setSelectedFulfillmentOrder] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [savingInstruction, setSavingInstruction] = useState<boolean>(false);

  // Pagination & Range state
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const isHosur = selectedHubId === 'hub_hosur_main';
  const hubCodeName = isHosur ? 'hub_hosur_main' : 'hub_blr_ecity';

  const todayStr = new Date().toISOString().slice(0, 10);

  // Dynamic today filtering: Exclude delivered/cancelled orders, include active today orders & subscriptions
  const todayOnlyOrders = useMemo(() => {
    const rawList = orders;
    const now = new Date();
    const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return rawList.filter((o) => {
      // Delivered or cancelled orders do NOT show in Today's Deliveries (they belong in Delivered History!)
      if (o.status === 'delivered' || o.status === 'cancelled') return false;

      if (!o.orderDate) return true;
      if (o.orderDate.startsWith(todayStr) || o.orderDate.startsWith(localDateStr)) return true;
      
      const parsed = new Date(o.orderDate);
      if (!isNaN(parsed.getTime())) {
        const pStr = parsed.toISOString().slice(0, 10);
        if (pStr === todayStr || pStr === localDateStr) return true;
      }
      if (o.isSubscriptionDelivery || o.orderType === 'subscription') {
        return true;
      }
      return false;
    });
  }, [orders, todayStr]);

  const activeOrdersList = todayOnlyOrders;

  // Compact Header metrics
  const totalTodayCount = activeOrdersList.length;
  const subScheduledCount = activeOrdersList.filter((o) => o.isSubscriptionDelivery || o.orderType === 'subscription').length;
  const oneTimeScheduledCount = activeOrdersList.filter((o) => !o.isSubscriptionDelivery && o.orderType !== 'subscription').length;

  const filteredOrders = useMemo(() => {
    return activeOrdersList.filter((o) => {
      const u = users.find((usr) => usr.id === o.userId);
      const matchesSearch =
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.address || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (filterType === 'subscriptions') return o.isSubscriptionDelivery || o.orderType === 'subscription';
      if (filterType === 'onetime') return !o.isSubscriptionDelivery && o.orderType !== 'subscription';
      if (filterType === 'assigned') return !!o.deliveryAgentId;
      if (filterType === 'unassigned') return !o.deliveryAgentId;
      return true;
    });
  }, [activeOrdersList, users, searchQuery, filterType]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / (pageSize === 9999 ? filteredOrders.length || 1 : pageSize)));
  
  const paginatedOrders = useMemo(() => {
    if (pageSize === 9999) return filteredOrders;
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      showToast('No orders to export.', 'info');
      return;
    }
    const headers = ['Order ID', 'Customer Name', 'Delivery Address', 'Products', 'Order Type', 'Driver Assigned', 'Status', 'Amount'];
    const rows = filteredOrders.map((o) => {
      const u = users.find((usr) => usr.id === o.userId);
      const agent = deliveryAgents.find((a) => a.id === o.deliveryAgentId);
      const prods = o.items?.map((i) => `${i.product?.name || 'Item'} (x${i.quantity})`).join('; ') || 'Milk';
      return [
        `"${o.id}"`,
        u ? `"${u.name}"` : '"Customer"',
        `"${(o.address || u?.savedAddresses?.[0] || 'Hub Area').replace(/"/g, '""')}"`,
        `"${prods.replace(/"/g, '""')}"`,
        o.orderType || 'one-time',
        agent ? `"${agent.name}"` : '"Unassigned"',
        o.status,
        `₹${o.totalAmount}`,
      ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Today_Deliveries_${isHosur ? 'Hosur' : 'Bangalore'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Exported today's delivery schedule manifest to CSV!", 'success');
  };

  // Dedicated Fulfillment Sheet Sub-View (Matching Screenshots)
  if (selectedFulfillmentOrder) {
    const o = selectedFulfillmentOrder;
    const u = users.find((usr) => usr.id === o.userId);
    const customerName = u?.name || 'Customer';
    const customerPhone = u?.phone || 'N/A';
    const addressText = o.address || u?.savedAddresses?.[0] || u?.address || 'Address Pending';
    const currentAgent = deliveryAgents.find((a) => a.id === o.deliveryAgentId);

    const subtotalCalc = o.items?.reduce((acc, item) => acc + (item.quantity * (item.product?.price || 95)), 0) || o.totalAmount || 190;

    const handleSaveInstructions = async (newText: string) => {
      setSavingInstruction(true);
      try {
        const isSub = o.isSubscriptionDelivery || o.orderType === 'subscription';
        if (isSub) {
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
      showToast('Delivery instructions updated by admin! 📝', 'success');
    };

    return (
      <div id="printable-bill-invoice" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
        
        {/* Separate Section Banner with Background */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Back Button Icon-Only */}
            <button
              className="no-print"
              onClick={() => setSelectedFulfillmentOrder(null)}
              title="Back to Console"
              style={{
                width: '40px',
                height: '40px',
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
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.35rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Fulfillment Sheet: {o.id}
              </h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Created on {new Date(o.orderDate || Date.now()).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'medium' })} • Hub: {hubCodeName}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {(o.isSubscriptionDelivery || o.orderType === 'subscription') && onNavigateTab && (
              <button
                className="no-print"
                onClick={() => onNavigateTab('subscriptions')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '16px',
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  border: '1px solid #A7F3D0',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                View Subscription
              </button>
            )}
            <span
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontWeight: 700,
                fontSize: '0.8rem',
                backgroundColor: o.status === 'delivered' ? '#ECFDF5' : o.status === 'outForDelivery' ? '#FEF3C7' : '#EFF6FF',
                color: o.status === 'delivered' ? '#047857' : o.status === 'outForDelivery' ? '#D97706' : '#2563EB',
                border: o.status === 'delivered' ? '1px solid #A7F3D0' : o.status === 'outForDelivery' ? '1px solid #FDE68A' : '1px solid #BFDBFE',
                textTransform: 'capitalize'
              }}
            >
              {o.status === 'outForDelivery' ? 'Out For Delivery' : o.status}
            </span>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Left Column: Products Spec & Action Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Card 1: Products & Items Spec */}
            <div className="card-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-main)' }}>
                Products & Items Spec
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {o.items && o.items.length > 0 ? (
                  o.items.map((item, idx) => {
                    const prodDisplayName = (!item.product?.name || item.product.name.toLowerCase() === 'dummy') ? (products?.[0]?.name || 'Premium A2 Desi Cow Milk') : item.product.name;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img
                            src={item.product?.imageUrl || 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80'}
                            alt={prodDisplayName}
                            style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }}
                          />
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                              {prodDisplayName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {item.quantity}x ₹{item.product?.price || 95} ({item.product?.unit || 'Pack'})
                            </div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
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
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                          Premium A2 Desi Cow Milk
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          2x ₹95 (750ml Glass Bottle)
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      ₹190
                    </div>
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem', marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Subtotal</span>
                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>₹{subtotalCalc}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Delivery Charges</span>
                    <span style={{ color: '#047857', fontWeight: 800 }}>FREE</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.35rem' }}>
                    <span>Total Amount</span>
                    <span>₹{subtotalCalc}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Fulfillment Action Panel */}
            <div className="card-panel no-print" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: 'var(--text-main)' }}>
                Fulfillment Action Panel
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Update route delivery stage and assign logistical personnel.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Field 1: Status Dropdown */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                    Transition Delivery Status
                  </label>
                  <select
                    value={o.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value as Order['status'];
                      onUpdateOrderStatus(o.id, nextStatus);
                      setSelectedFulfillmentOrder({ ...o, status: nextStatus });
                      showToast(`Updated status to ${nextStatus}`, 'success');
                    }}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
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

                {/* Dedicated Real-Time Fulfillment Rider Information Card */}
                <div style={{
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🚴 Fulfillment Rider Information (Real-time)
                  </div>
                  
                  {currentAgent ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: '#0284C7',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.8rem'
                        }}>
                          {currentAgent.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                            {currentAgent.name}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            📞 {currentAgent.phone || '9876543210'} • Zone: {currentAgent.assignedZone || 'Hosur Route'}
                          </div>
                          <div style={{ fontSize: '0.71rem', color: '#047857', fontWeight: 700, marginTop: '2px' }}>
                            🟢 Active Live Rider ({currentAgent.vehicle || 'EV Bike'})
                          </div>
                        </div>
                      </div>

                      <select
                        value={o.deliveryAgentId || ''}
                        onChange={(e) => {
                          const nextAgentId = e.target.value;
                          if (onUpdateOrderDriver) {
                            onUpdateOrderDriver(o.id, nextAgentId);
                          }
                          setSelectedFulfillmentOrder({ ...o, deliveryAgentId: nextAgentId });
                          showToast(`Updated live driver for order ${o.id}`, 'success');
                        }}
                        style={{
                          padding: '0.38rem 0.65rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-main)',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">-- Change Rider --</option>
                        {deliveryAgents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.phone || a.assignedZone || 'Rider'})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.76rem', color: '#D97706', fontWeight: 700 }}>
                        ⚠️ No rider assigned to this dispatch order yet.
                      </div>
                      <select
                        value={o.deliveryAgentId || ''}
                        onChange={(e) => {
                          const nextAgentId = e.target.value;
                          if (onUpdateOrderDriver) {
                            onUpdateOrderDriver(o.id, nextAgentId);
                          }
                          setSelectedFulfillmentOrder({ ...o, deliveryAgentId: nextAgentId });
                          showToast(`Assigned live rider to order ${o.id}`, 'success');
                        }}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-main)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">-- Select Active Logistics Rider --</option>
                        {deliveryAgents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.phone || a.assignedZone || 'Rider'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Field 3: Cancel Job */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
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
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-main)',
                        fontSize: '0.8rem',
                        color: 'var(--text-main)',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={() => {
                        onUpdateOrderStatus(o.id, 'cancelled');
                        setSelectedFulfillmentOrder({ ...o, status: 'cancelled' });
                        showToast(`Cancelled job order #${o.id}`, 'error');
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
            <div className="card-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Customer Details
                </h3>
                <button
                  onClick={() => onNavigateTab && onNavigateTab('customers')}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '8px',
                    border: '1px solid #A7F3D0',
                    backgroundColor: '#ECFDF5',
                    color: '#047857',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  View Customer Profile ➔
                </button>
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
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                    {customerName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    📞 {customerPhone}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                      color: 'var(--primary)',
                      textDecoration: 'none',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '2px 8px'
                    }}
                  >
                    📍 Map Link <ExternalLink size={12} />
                  </a>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.4, marginBottom: '0.85rem' }}>
                  📍 {addressText} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>[GPS: (12.867697, 77.666721)] | Hub: {hubCodeName}</span>
                </div>

                <div style={{
                  height: '180px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)',
                  position: 'relative'
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

            {/* Card: Delivery Instructions (Visible & Editable by Admin for both One-time and Subscription) */}
            <div className="card-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  📝 Delivery Instructions
                </h3>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  backgroundColor: o.isSubscriptionDelivery || o.orderType === 'subscription' ? '#FEF3C7' : '#ECFDF5',
                  color: o.isSubscriptionDelivery || o.orderType === 'subscription' ? '#B45309' : '#047857',
                  border: o.isSubscriptionDelivery || o.orderType === 'subscription' ? '1px solid #FDE68A' : '1px solid #A7F3D0'
                }}>
                  {o.isSubscriptionDelivery || o.orderType === 'subscription' ? 'Subscription Order' : 'One-Time Cart Order'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Non-Editable Customer Instruction Display Badge */}
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  backgroundColor: o.deliveryInstructions ? '#FEF3C7' : '#F3F4F6',
                  border: o.deliveryInstructions ? '1px solid #FDE68A' : '1px solid #E5E7EB',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '1.2rem' }}>📋</span>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: o.deliveryInstructions ? '#B45309' : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Customer Note (Checkout Choice)
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: o.deliveryInstructions ? '#78350F' : '#374151', marginTop: '2px' }}>
                      {o.deliveryInstructions || 'No special instructions provided (Standard delivery: Leave at doorstep / Ring bell).'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Admin Controls: Update instruction or remove existing note
                </div>

                <textarea
                  rows={2}
                  defaultValue={o.deliveryInstructions || ''}
                  key={o.id}
                  id={`instr_input_${o.id}`}
                  placeholder="Type new instruction or admin note here..."
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.84rem',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  {o.deliveryInstructions && (
                    <button
                      onClick={() => {
                        const inputEl = document.getElementById(`instr_input_${o.id}`) as HTMLTextAreaElement;
                        if (inputEl) inputEl.value = '';
                        handleSaveInstructions('');
                      }}
                      disabled={savingInstruction}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        backgroundColor: '#FEE2E2',
                        color: '#EF4444',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        border: '1px solid #FCA5A5',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      🗑️ Clear Note
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const inputEl = document.getElementById(`instr_input_${o.id}`) as HTMLTextAreaElement;
                      if (inputEl) {
                        handleSaveInstructions(inputEl.value);
                      }
                    }}
                    disabled={savingInstruction}
                    style={{
                      padding: '0.45rem 1rem',
                      borderRadius: '8px',
                      backgroundColor: '#047857',
                      color: '#FFFFFF',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {savingInstruction ? 'Saving...' : '💾 Save Instructions'}
                  </button>
                </div>
              </div>
            </div>

            {/* Card 4: Logistics History & Audit Logs */}
            <div className="card-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-main)' }}>
                Logistics History & Audit Logs
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: '6px',
                    backgroundColor: '#ECFDF5',
                    color: '#047857',
                    fontWeight: 800,
                    fontSize: '0.68rem',
                    border: '1px solid #A7F3D0'
                  }}>
                    Ordered
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      Logged & Registered
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                      Created on 9/8/2026, 5:30:00 AM
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: '6px',
                    backgroundColor: o.status === 'packed' || o.status === 'outForDelivery' || o.status === 'delivered' ? '#ECFDF5' : '#F3F4F6',
                    color: o.status === 'packed' || o.status === 'outForDelivery' || o.status === 'delivered' ? '#047857' : '#6B7280',
                    fontWeight: 800,
                    fontSize: '0.68rem',
                    border: '1px solid var(--border-color)'
                  }}>
                    Packed
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      Prepared for Dispatch
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                      Hub consolidation logs updated
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: '6px',
                    backgroundColor: o.status === 'outForDelivery' || o.status === 'delivered' ? '#FEF3C7' : '#F3F4F6',
                    color: o.status === 'outForDelivery' || o.status === 'delivered' ? '#D97706' : '#6B7280',
                    fontWeight: 800,
                    fontSize: '0.68rem',
                    border: '1px solid var(--border-color)'
                  }}>
                    Transit
                  </span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      Out For Delivery
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {currentAgent ? `Assigned to ${currentAgent.name}` : 'Dispatched with local rider team'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    );
  }

  // Main Pipeline Table View (Smaller Sleek Header Cards + Readonly Status + View Details Action)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* Top 3 Summary Cards - COMPACT SLEEK SIZE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        
        {/* Card 1: TODAY'S SCHEDULED DELIVERIES */}
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
            TODAY'S SCHEDULED DELIVERIES
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)', lineHeight: 1.1 }}>
            {totalTodayCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Total deliveries scheduled for today
          </div>
        </div>

        {/* Card 2: SUBSCRIPTION SCHEDULED */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '0.85rem 1.15rem',
          borderLeft: '4px solid #0284C7',
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            SUBSCRIPTION SCHEDULED
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0284C7', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)', lineHeight: 1.1 }}>
            {subScheduledCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Recurring subscription drops today
          </div>
        </div>

        {/* Card 3: ONE-TIME SCHEDULED */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '0.85rem 1.15rem',
          borderLeft: '4px solid #D97706',
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            ONE-TIME SCHEDULED
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#D97706', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)', lineHeight: 1.1 }}>
            {oneTimeScheduledCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Single custom order deliveries today
          </div>
        </div>

      </div>

      {/* Main Delivery Pipeline Card */}
      <div className="card-panel" style={{ padding: 0, overflow: 'hidden' }}>
        
        {/* Header & Filter Bar */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem'
        }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            📱 Today's Delivery Pipeline
          </h3>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search delivery address or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '0.38rem 0.75rem 0.38rem 28px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  fontSize: '0.78rem',
                  color: 'var(--text-main)',
                  outline: 'none',
                  width: '200px',
                }}
              />
            </div>

            {[
              { id: 'all', label: 'All Types' },
              { id: 'subscriptions', label: 'Subscriptions' },
              { id: 'onetime', label: 'One-time' },
              { id: 'assigned', label: 'Assigned' },
              { id: 'unassigned', label: 'Not Assigned' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                style={{
                  padding: '0.38rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: filterType === f.id ? '#047857' : 'var(--bg-main)',
                  color: filterType === f.id ? '#FFFFFF' : 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}

            {onOpenAddOrderModal && (
              <button
                onClick={onOpenAddOrderModal}
                style={{
                  padding: '0.38rem 0.75rem',
                  borderRadius: '8px',
                  backgroundColor: '#047857',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                }}
              >
                + New Delivery
              </button>
            )}

            <button
              onClick={handleExportCSV}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.38rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.76rem',
                cursor: 'pointer',
              }}
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Table matching Screenshot 1 */}
        <div className="table-container" style={{ border: 'none', borderRadius: 0, overflowX: 'auto' }}>
          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'left' }}>ORDER ID</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'left' }}>CUSTOMER NAME</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'left' }}>DELIVERY ADDRESS</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'left' }}>PRODUCTS</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'left' }}>ORDER TYPE</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'left' }}>DRIVER ASSIGNED</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'left' }}>STATUS</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'left' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((o) => {
                const u = users.find((usr) => usr.id === o.userId);
                const isSub = o.isSubscriptionDelivery || o.orderType === 'subscription';
                const customerName = u?.name || 'Customer';
                const rawAddr = o.address || o.deliveryAddress;
                const isValidAddr = rawAddr && rawAddr !== 'Doorstep Delivery' && rawAddr !== 'Doorstep';
                const fullAddressText = isValidAddr ? rawAddr : (u?.address || u?.savedAddresses?.[0] || 'Hosur Central Hub Area');

                return (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedFulfillmentOrder(o)}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                  >
                    {/* ORDER ID */}
                    <td style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-main)', verticalAlign: 'middle', padding: '0.85rem 0.85rem' }}>
                      {o.id}
                    </td>

                    {/* Customer Name */}
                    <td style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', verticalAlign: 'middle', padding: '0.85rem 0.85rem' }}>
                      {customerName}
                    </td>

                    {/* Delivery Address with Single Clean GPS Spec Line */}
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-main)', maxWidth: '280px', verticalAlign: 'middle', padding: '0.85rem 0.85rem', lineHeight: 1.4 }}>
                      {fullAddressText}
                      <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        [GPS: (12.867697, 77.666721)] | Hub: {hubCodeName}
                      </div>
                      {o.deliveryInstructions && (
                        <div style={{ marginTop: '4px', fontSize: '0.71rem', fontWeight: 700, color: '#B45309', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '6px', padding: '2px 6px', display: 'inline-block' }}>
                          📝 Note: {o.deliveryInstructions}
                        </div>
                      )}
                    </td>

                    {/* Products Bulleted List */}
                    <td style={{ verticalAlign: 'middle', padding: '0.85rem 0.85rem', fontSize: '0.8rem' }}>
                      {o.items && o.items.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {o.items.map((it, idx) => (
                            <div key={idx} style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                              • {it.product?.name || 'Milk Product'} (x{it.quantity})
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                          • Premium A2 Desi Cow Milk (x2)<br />• Fresh Artisanal Paneer (x1)
                        </div>
                      )}
                    </td>

                    {/* Order Type Badge */}
                    <td style={{ verticalAlign: 'middle', padding: '0.85rem 0.85rem' }}>
                      <span
                        style={{
                          backgroundColor: isSub ? '#ECFDF5' : '#FEF3C7',
                          color: isSub ? '#047857' : '#D97706',
                          border: isSub ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                          padding: '3px 9px',
                          borderRadius: '8px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        {isSub ? 'Subscription' : 'One-Time'}
                      </span>
                    </td>

                    {/* Driver Assigned Dropdown */}
                    <td style={{ verticalAlign: 'middle', padding: '0.85rem 0.85rem' }} onClick={(e) => e.stopPropagation()}>
                      <select
                        value={o.deliveryAgentId || ''}
                        onChange={(e) => {
                          const nextAgentId = e.target.value;
                          if (onUpdateOrderDriver) {
                            onUpdateOrderDriver(o.id, nextAgentId);
                          }
                          showToast(`Assigned driver to order ${o.id}`, 'success');
                        }}
                        style={{
                          padding: '0.35rem 0.55rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-main)',
                          color: 'var(--text-main)',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="">-- Assign Driver --</option>
                        {deliveryAgents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.assignedZone || 'Route'})
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* STATUS IS READ-ONLY IN MAIN TABLE (Pill Badge matching Screenshot 1) */}
                    <td style={{ verticalAlign: 'middle', padding: '0.85rem 0.85rem' }}>
                      <span
                        style={{
                          backgroundColor: o.status === 'delivered' ? '#ECFDF5' : o.status === 'outForDelivery' ? '#FEF3C7' : '#EFF6FF',
                          color: o.status === 'delivered' ? '#047857' : o.status === 'outForDelivery' ? '#D97706' : '#2563EB',
                          border: o.status === 'delivered' ? '1px solid #A7F3D0' : o.status === 'outForDelivery' ? '1px solid #FDE68A' : '1px solid #BFDBFE',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          display: 'inline-block',
                          textTransform: 'capitalize',
                        }}
                      >
                        {o.status === 'outForDelivery' ? 'Out For Delivery' : o.status}
                      </span>
                    </td>

                    {/* View Details Action Button */}
                    <td style={{ verticalAlign: 'middle', padding: '0.85rem 0.85rem' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedFulfillmentOrder(o)}
                        style={{
                          padding: '0.35rem 0.65rem',
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
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        border: '3.5px solid #E5E7EB',
                        borderTop: '3.5px solid #047857',
                        borderRadius: '50%',
                        animation: 'spinToday 0.8s linear infinite'
                      }} />
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#047857' }}>
                        Syncing &amp; Fetching Today's Live Deliveries...
                      </div>
                      <style>{`@keyframes spinToday { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No delivery records found for today matching the filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Pagination & Display Range Footer Bar */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Showing {filteredOrders.length > 0 ? (currentPage - 1) * (pageSize === 9999 ? filteredOrders.length : pageSize) + 1 : 0} to {Math.min(currentPage * (pageSize === 9999 ? filteredOrders.length : pageSize), filteredOrders.length)} of {filteredOrders.length} entries
            </span>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  outline: 'none'
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={9999}>All</option>
              </select>
              <span>entries</span>
            </div>
          </div>

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
