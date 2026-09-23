import { useState, useMemo } from 'react';
import { Download, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import type { Order, DeliveryAgent, User, Product } from '../../types';
import FulfillmentSheetView from '../../components/common/FulfillmentSheetView';

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
      const effectiveAgentId = o.deliveryAgentId || (o as any).assignedRiderId || u?.assignedDeliveryAgentId;
      if (filterType === 'assigned') return !!effectiveAgentId;
      if (filterType === 'unassigned') return !effectiveAgentId;
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

  // Shared Common Fulfillment Sheet View
  if (selectedFulfillmentOrder) {
    return (
      <FulfillmentSheetView
        order={selectedFulfillmentOrder}
        users={users}
        deliveryAgents={deliveryAgents}
        selectedHubId={selectedHubId}
        onClose={() => setSelectedFulfillmentOrder(null)}
        onUpdateOrderStatus={onUpdateOrderStatus}
        onUpdateOrderDriver={onUpdateOrderDriver}
        showToast={showToast}
      />
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
                  const effectiveAgentId = order.deliveryAgentId || (order as any).assignedRiderId || u?.assignedDeliveryAgentId || '';
                  const agent = deliveryAgents.find(a => a.id === effectiveAgentId);
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
                        {(() => {
                          let addr = order.deliveryAddress || order.address || '';
                          const isExplicitValid = addr && addr.length > 5 && !addr.startsWith('Doorstep') && !addr.startsWith('Hub Area');
                          if (!isExplicitValid && u) {
                            if (u.savedAddresses && u.savedAddresses.length > 0) {
                              const activeIdx = u.activeAddressIndex ?? (u.savedAddresses.length - 1);
                              const activeAddr = u.savedAddresses[activeIdx];
                              if (activeAddr && activeAddr.length > 5) {
                                const isAddrHosur = activeAddr.toLowerCase().includes('hosur') || activeAddr.toLowerCase().includes('tamil nadu') || activeAddr.toLowerCase().includes('tn');
                                if (isHosur === isAddrHosur || u.savedAddresses.length === 1) {
                                  addr = activeAddr;
                                }
                              }
                              if (!addr) {
                                const matched = u.savedAddresses.find(a => {
                                  const isH = a.toLowerCase().includes('hosur') || a.toLowerCase().includes('tamil nadu') || a.toLowerCase().includes('tn');
                                  return isHosur ? isH : !isH;
                                });
                                addr = matched || u.savedAddresses[0];
                              }
                            } else if (u.address && u.address.length > 5) {
                              addr = u.address;
                            }
                          }
                          if (!addr || addr.startsWith('Doorstep')) {
                            addr = isHosur ? '565, Darga, Hosur, Hosur, Tamil Nadu | Type: Home | Hub: hub_hosur_main' : 'Electronic City Phase 1, Bengaluru, Karnataka';
                          }
                          return addr;
                        })()}
                      </td>

                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <select
                          value={effectiveAgentId}
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
                            color: order.status === 'delivered' ? '#047857' : (order.status === 'skipped' || order.status === 'cancelled') ? '#DC2626' : order.status === 'outForDelivery' ? '#1E40AF' : '#B45309',
                            outline: 'none'
                          }}
                        >
                          <option value="packed">PACKED</option>
                          <option value="outForDelivery">OUT FOR DELIVERY</option>
                          <option value="delivered">DELIVERED</option>
                          <option value="skipped">SKIPPED</option>
                          <option value="cancelled">CANCELLED</option>
                        </select>
                        {((order as any).skipReason || (order as any).cancellationReason) && (
                          <div style={{ fontSize: '0.7rem', color: '#DC2626', fontWeight: 600, marginTop: '3px' }}>
                            {(order as any).skipReason || (order as any).cancellationReason}
                          </div>
                        )}
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
