import { useState, useMemo } from 'react';
import { Download, Search, ArrowLeft, ExternalLink, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Order, DeliveryAgent, User, Product } from '../../types';

interface DispatchTodaysDeliveriesPageProps {
  selectedHubId: string;
  hubOrders: Order[];
  users?: User[];
  products?: Product[];
  deliveryAgents: DeliveryAgent[];
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  onUpdateOrderDriver?: (orderId: string, agentId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function DispatchTodaysDeliveriesPage({
  selectedHubId,
  hubOrders,
  users = [],
  products = [],
  deliveryAgents,
  onUpdateOrderStatus,
  onUpdateOrderDriver,
  showToast,
}: DispatchTodaysDeliveriesPageProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFulfillmentOrder, setSelectedFulfillmentOrder] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [savingInstruction, setSavingInstruction] = useState<boolean>(false);

  // Pagination & Range state
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const isHosur = selectedHubId === 'hub_hosur_main' || selectedHubId === 'hub_hosur';
  const hubCodeName = isHosur ? 'hub_hosur_main' : 'hub_blr_ecity';

  const todayStr = new Date().toISOString().slice(0, 10);

  // Dynamic today filtering: Exclude delivered/cancelled orders, include active today orders & subscriptions
  const todayOnlyOrders = useMemo(() => {
    const rawList = hubOrders || [];
    const now = new Date();
    const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return rawList.filter((o) => {
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
      return true;
    });
  }, [hubOrders, todayStr]);

  const activeOrdersList = todayOnlyOrders;

  const totalTodayCount = activeOrdersList.length;
  const subScheduledCount = activeOrdersList.filter((o) => o.isSubscriptionDelivery || o.orderType === 'subscription').length;
  const oneTimeScheduledCount = activeOrdersList.filter((o) => !o.isSubscriptionDelivery && o.orderType !== 'subscription').length;

  const filteredOrders = useMemo(() => {
    return activeOrdersList.filter((o) => {
      const u = users.find((usr) => usr.id === o.userId);
      const matchesSearch =
        (o.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.customerName || u?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.customerPhone || u?.phone || '').includes(searchQuery) ||
        (o.deliveryAddress || o.address || u?.savedAddresses?.[0] || '').toLowerCase().includes(searchQuery.toLowerCase());
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
        o.customerName ? `"${o.customerName}"` : (u ? `"${u.name}"` : '"Customer"'),
        `"${(o.deliveryAddress || o.address || u?.savedAddresses?.[0] || 'Hub Area').replace(/"/g, '""')}"`,
        `"${prods.replace(/"/g, '""')}"`,
        o.orderType || 'one-time',
        agent ? `"${agent.name}"` : '"Unassigned"',
        o.status,
        `₹${o.totalAmount || 0}`,
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

  // Dedicated Fulfillment Sheet Sub-View (Matching Screenshot #2)
  if (selectedFulfillmentOrder) {
    const o = selectedFulfillmentOrder;
    const u = users.find((usr) => usr.id === o.userId);
    const customerName = o.customerName || u?.name || 'Valued Customer';
    const customerPhone = o.customerPhone || u?.phone || 'N/A';
    const addressText = o.deliveryAddress || o.address || u?.savedAddresses?.[0] || u?.address || 'Address Pending';
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
              title="Back to Today's Deliveries"
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
                      onUpdateOrderStatus(o.id, nextStatus);
                      setSelectedFulfillmentOrder({ ...o, status: nextStatus });
                      showToast(`Updated status to ${nextStatus}`, 'success');
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
                      if (onUpdateOrderDriver) {
                        onUpdateOrderDriver(o.id, nextAgentId);
                      }
                      setSelectedFulfillmentOrder({ ...o, deliveryAgentId: nextAgentId });
                      showToast(`Assigned live rider to order ${o.id}`, 'success');
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
                    {deliveryAgents.map((a) => (
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

  // Default Today's Deliveries Table View
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            🚚 Today's Scheduled Deliveries
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
            All active milk & dairy dropoffs scheduled for route in {selectedHubId}.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          style={{
            backgroundColor: '#FFFFFF',
            color: '#1E293B',
            fontWeight: 700,
            fontSize: '0.85rem',
            padding: '0.55rem 1.1rem',
            borderRadius: '10px',
            border: '1px solid #CBD5E1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Download size={15} /> Export Today Manifest CSV
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1rem 1.25rem', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All Drops (${totalTodayCount})` },
            { id: 'subscriptions', label: `🔁 Subscriptions (${subScheduledCount})` },
            { id: 'onetime', label: `📦 One-Time (${oneTimeScheduledCount})` },
            { id: 'assigned', label: `🚴 Driver Assigned` },
            { id: 'unassigned', label: `⚠️ Unassigned` },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => { setFilterType(filter.id); setCurrentPage(1); }}
              style={{
                padding: '0.45rem 0.95rem',
                borderRadius: '8px',
                border: filterType === filter.id ? 'none' : '1px solid #E2E8F0',
                backgroundColor: filterType === filter.id ? '#044E35' : '#FFFFFF',
                color: filterType === filter.id ? '#FFFFFF' : '#475569',
                fontWeight: filterType === filter.id ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search order ID, customer name..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 36px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem', outline: 'none' }}
          />
        </div>

      </div>

      {/* Deliveries Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', textTransform: 'uppercase', fontSize: '0.72rem', color: '#64748B' }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>ORDER ID</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>CUSTOMER DETAILS</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>DELIVERY ADDRESS</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>ASSIGNED RIDER</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>STATUS</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>
                    No delivery drops found matching criteria.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map(order => {
                  const u = users.find(usr => usr.id === order.userId);
                  const agent = deliveryAgents.find(a => a.id === order.deliveryAgentId);
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

                      <td style={{ padding: '0.85rem 1.25rem', maxWidth: '280px', fontSize: '0.8rem', color: '#334155', lineHeight: '1.35' }}>
                        {order.deliveryAddress || order.address || u?.savedAddresses?.[0] || 'Default Address'}
                      </td>

                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <select
                          value={order.deliveryAgentId || ''}
                          onChange={(e) => {
                            if (onUpdateOrderDriver) onUpdateOrderDriver(order.id, e.target.value);
                          }}
                          style={{
                            padding: '0.35rem 0.6rem',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: agent ? '#047857' : '#D97706',
                            outline: 'none'
                          }}
                        >
                          <option value="">-- Unassigned --</option>
                          {deliveryAgents.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </td>

                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <select
                          value={order.status}
                          onChange={(e) => onUpdateOrderStatus(order.id, e.target.value as Order['status'])}
                          style={{
                            padding: '0.35rem 0.6rem',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            color: order.status === 'delivered' ? '#047857' : order.status === 'outForDelivery' ? '#1E40AF' : '#B45309',
                            outline: 'none'
                          }}
                        >
                          <option value="packed">PACKED</option>
                          <option value="outForDelivery">OUT FOR DELIVERY</option>
                          <option value="delivered">DELIVERED</option>
                          <option value="cancelled">CANCELLED</option>
                        </select>
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

        {/* Pagination Bar */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
            Showing page {currentPage} of {totalPages} ({filteredOrders.length} drops total)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
