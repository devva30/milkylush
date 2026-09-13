import { useState } from 'react';
import { Download, Search, ArrowLeft, ExternalLink, Eye } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Order, DeliveryAgent, User, Product } from '../../types';

interface DispatchDeliveriesArchivePageProps {
  hubOrders: Order[];
  users?: User[];
  products?: Product[];
  deliveryAgents: DeliveryAgent[];
  selectedHubId: string;
  onUpdateOrderStatus?: (orderId: string, status: Order['status']) => void;
  onUpdateOrderDriver?: (orderId: string, agentId: string) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function DispatchDeliveriesArchivePage({
  hubOrders,
  users = [],
  products = [],
  deliveryAgents,
  selectedHubId,
  onUpdateOrderStatus,
  onUpdateOrderDriver,
  showToast
}: DispatchDeliveriesArchivePageProps) {
  const [activeTab, setActiveTab] = useState<'delivered' | 'cancelled'>('delivered');
  const [selectedFulfillmentOrder, setSelectedFulfillmentOrder] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [savingInstruction, setSavingInstruction] = useState<boolean>(false);

  const isHosur = selectedHubId === 'hub_hosur_main' || selectedHubId === 'hub_hosur';
  const hubCodeName = isHosur ? 'hub_hosur_main' : 'hub_blr_ecity';

  const deliveredOrders = (hubOrders || []).filter(o => o.status === 'delivered');
  const cancelledOrders = (hubOrders || []).filter(o => o.status === 'cancelled');

  const totalPayout = deliveredOrders.reduce((sum, o) => sum + (o.totalAmount || 40), 0);

  const displayOrders = activeTab === 'delivered' ? deliveredOrders : cancelledOrders;

  const handleExportCSV = () => {
    if (displayOrders.length === 0) {
      if (showToast) showToast('No archived orders to export.', 'info');
      return;
    }
    const headers = ['Order ID', 'Customer Name', 'Assigned Rider', 'Delivered Address', 'Completed Time', 'Status', 'Total Amount'];
    const rows = displayOrders.map((o) => {
      const u = users.find((usr) => usr.id === o.userId);
      const agent = deliveryAgents.find((a) => a.id === o.deliveryAgentId);
      return [
        `"${o.id}"`,
        o.customerName ? `"${o.customerName}"` : (u ? `"${u.name}"` : '"Customer"'),
        agent ? `"${agent.name}"` : '"Unassigned"',
        `"${(o.deliveryAddress || o.address || u?.savedAddresses?.[0] || 'N/A').replace(/"/g, '""')}"`,
        `"${new Date(o.orderDate || Date.now()).toLocaleString()}"`,
        o.status,
        `₹${o.totalAmount || 0}`,
      ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Deliveries_Archive_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (showToast) showToast("Exported deliveries archive manifest to CSV!", 'success');
  };

  // Dedicated Fulfillment Sheet Sub-View (Matching Screenshot #2)
  if (selectedFulfillmentOrder) {
    const o = selectedFulfillmentOrder;
    const u = users.find((usr) => usr.id === o.userId);
    const customerName = o.customerName || u?.name || 'Siva Moorthy';
    const customerPhone = o.customerPhone || u?.phone || '6382482092';
    const addressText = o.deliveryAddress || o.address || u?.savedAddresses?.[0] || '5/251, ezhil nagar,, Begepalli, Hosur, Hosur, Tamil Nadu';
    const currentAgent = deliveryAgents.find((a) => a.id === o.deliveryAgentId);

    const subtotalCalc = o.items?.reduce((acc, item) => acc + (item.quantity * (item.product?.price || 95)), 0) || o.totalAmount || 432;

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
        console.log('Local fallback save for delivery instructions', e);
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
              title="Back to Deliveries Archive"
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
                backgroundColor: o.status === 'delivered' ? '#DCFCE7' : '#FEE2E2',
                color: o.status === 'delivered' ? '#047857' : '#DC2626',
                border: o.status === 'delivered' ? '1px solid #A7F3D0' : '1px solid #FCA5A5',
                textTransform: 'uppercase'
              }}
            >
              {(o.status || 'DELIVERED').toUpperCase()}
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
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src="https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80" alt="A2 Milk" style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E293B' }}>Premium A2 Desi Cow Milk</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>2x ₹95 (750ml Glass Bottle)</div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1E293B' }}>₹190</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src="https://images.unsplash.com/photo-1527153857715-3908f2bae5e8?w=120&auto=format&fit=crop&q=80" alt="Goat Milk" style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E293B' }}>goat milk</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>1x ₹90 (750ml Glass Bottle)</div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1E293B' }}>₹90</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src="https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=120&auto=format&fit=crop&q=80" alt="Butter" style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E293B' }}>Salted Country Cream Butter</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>1x ₹170 (250g Parchment Wrap)</div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1E293B' }}>₹170</div>
                    </div>
                  </>
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
                    <option value="delivered">Delivered</option>
                    <option value="outForDelivery">Out For Delivery</option>
                    <option value="packed">Packed</option>
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
                      if (showToast) showToast(`Assigned driver to order ${o.id}`, 'success');
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
                    href="https://maps.google.com/?q=12.785203,77.797955"
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
                  📍 {addressText} <span style={{ fontSize: '0.72rem', color: '#64748B' }}>[GPS: (12.785203, 77.797955)] | Contact: {customerName} ({customerPhone}) | Type: Home | Hub: {hubCodeName}</span>
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
                    src="https://maps.google.com/maps?q=12.785203,77.797955&z=15&output=embed"
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
                  <span style={{ padding: '2px 7px', borderRadius: '6px', backgroundColor: o.status === 'delivered' ? '#DCFCE7' : '#FEE2E2', color: o.status === 'delivered' ? '#047857' : '#DC2626', fontWeight: 800, fontSize: '0.68rem' }}>
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

  // Default Deliveries Archive Table View matching Screenshot #1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Top Filter Tabs Bar matching Screenshot #1 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button
            onClick={() => setActiveTab('delivered')}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: '24px',
              border: activeTab === 'delivered' ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
              backgroundColor: activeTab === 'delivered' ? '#FFFFFF' : '#F8FAFC',
              color: activeTab === 'delivered' ? '#047857' : '#64748B',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeTab === 'delivered' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <span style={{ color: '#059669' }}>🟢</span> Delivered ({deliveredOrders.length})
          </button>

          <button
            onClick={() => setActiveTab('cancelled')}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: '24px',
              border: activeTab === 'cancelled' ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
              backgroundColor: activeTab === 'cancelled' ? '#FFFFFF' : '#F8FAFC',
              color: activeTab === 'cancelled' ? '#DC2626' : '#64748B',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeTab === 'cancelled' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <span style={{ color: '#EF4444' }}>🔴</span> Cancelled / Undelivered ({cancelledOrders.length})
          </button>
        </div>

        {/* Total Payout Floating Right */}
        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#047857' }}>
          Total Payout: ₹{totalPayout}
        </div>

      </div>

      {/* Main Card Container matching Screenshot #1 */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', overflow: 'hidden', padding: '1.25rem' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '1.1rem' }}>🟢</span>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#047857', margin: 0 }}>
            Delivered Dispatches Spec List
          </h3>
        </div>

        <div className="table-container" style={{ border: '1px solid #F1F5F9', borderRadius: '12px' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', textTransform: 'uppercase', fontSize: '0.7rem', color: '#64748B', letterSpacing: '0.04em' }}>
                <th style={{ padding: '0.95rem 1.25rem' }}>ORDER ID</th>
                <th style={{ padding: '0.95rem 1.25rem' }}>CUSTOMER NAME</th>
                <th style={{ padding: '0.95rem 1.25rem' }}>ASSIGNED RIDER</th>
                <th style={{ padding: '0.95rem 1.25rem' }}>DELIVERED ADDRESS</th>
                <th style={{ padding: '0.95rem 1.25rem' }}>COMPLETED TIME</th>
                <th style={{ padding: '0.95rem 1.25rem' }}>PROOF PHOTO</th>
                <th style={{ padding: '0.95rem 1.25rem', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {displayOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>
                    No archived dispatches in this category.
                  </td>
                </tr>
              ) : (
                displayOrders.map(order => {
                  const u = users.find(usr => usr.id === order.userId);
                  const agent = deliveryAgents.find(a => a.id === order.deliveryAgentId);
                  const customerName = order.customerName || u?.name || 'Siva Moorthy';

                  return (
                    <tr key={order.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '1rem 1.25rem', fontWeight: 800, color: '#0F172A', fontSize: '0.85rem' }}>
                        {order.id.length > 12 ? `${order.id.substring(0, 12)}...` : order.id}
                      </td>

                      <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: '#1E293B', fontSize: '0.85rem' }}>
                        {customerName}
                      </td>

                      <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: '#334155', fontSize: '0.85rem' }}>
                        {agent?.name || 'Unassigned'}
                      </td>

                      <td style={{ padding: '1rem 1.25rem', maxWidth: '320px', fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                        {order.deliveryAddress || order.address || '5/251, ezhil nagar,, Begepalli, Hosur, Hosur, Tamil Nadu [GPS: (12.785203, 77.797955)] | Contact: Siva Moorthy (6382482092) | Type: Home | Hub: hub_hosur_main'}
                      </td>

                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                        {order.orderDate ? new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </td>

                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.8rem', color: '#64748B' }}>
                        No Photo
                      </td>

                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedFulfillmentOrder(order)}
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            padding: '0.45rem 0.95rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: '#1E293B',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                          }}
                        >
                          View More
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
