import { useState, useMemo } from 'react';
import { Download, Search, ArrowLeft, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Order, DeliveryAgent, User, Product } from '../types';
import FulfillmentSheetView from '../components/common/FulfillmentSheetView';

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

  if (selectedFulfillmentOrder) {
    return (
      <FulfillmentSheetView
        order={selectedFulfillmentOrder}
        users={users}
        products={products}
        deliveryAgents={deliveryAgents}
        selectedHubId={selectedHubId}
        onClose={() => setSelectedFulfillmentOrder(null)}
        onUpdateOrderStatus={(orderId, status) => {
          onUpdateOrderStatus(orderId, status);
          setSelectedFulfillmentOrder((prev) => prev ? { ...prev, status } : null);
        }}
        onUpdateOrderDriver={(orderId, agentId) => {
          if (onUpdateOrderDriver) onUpdateOrderDriver(orderId, agentId);
          setSelectedFulfillmentOrder((prev) => prev ? { ...prev, deliveryAgentId: agentId } : null);
        }}
        showToast={showToast}
        onNavigateTab={onNavigateTab}
      />
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {o.items.map((it, idx) => {
                            const unitVal = it.product?.unit || '500ml';
                            return (
                              <div key={idx} style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                                • {it.product?.name || 'Milk Product'} - <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{unitVal}</span> (x{it.quantity})
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                          • Premium A2 Desi Cow Milk - 500ml (x2)<br />• Fresh Artisanal Paneer - 200g (x1)
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
