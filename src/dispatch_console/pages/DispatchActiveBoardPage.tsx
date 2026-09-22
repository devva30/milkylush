import { useState, useMemo } from 'react';
import { Package, Truck, CheckCircle2, Search, Filter, Eye, Calendar } from 'lucide-react';
import type { Order, DeliveryAgent, User, Product } from '../../types';
import FulfillmentSheetView from '../../components/common/FulfillmentSheetView';

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'packed' | 'outForDelivery' | 'delivered' | 'cancelled'>('all');
  const [selectedFulfillmentOrder, setSelectedFulfillmentOrder] = useState<Order | null>(null);

  const isHosur = selectedHubId === 'hub_hosur_main' || selectedHubId === 'hub_hosur';
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
      if (statusFilter === 'cancelled' && order.status !== 'cancelled') return false;

      // 4. Date Filter
      if (dateFilter === 'today') {
        const orderDateStr = (order.orderDate || '').slice(0, 10);
        if (orderDateStr && orderDateStr !== todayStr && !isSub) return false;
      }

      return true;
    });
  }, [displayOrders, users, searchQuery, typeFilter, statusFilter, dateFilter, todayStr]);

  // Shared Common Fulfillment Sheet View
  if (selectedFulfillmentOrder) {
    return (
      <FulfillmentSheetView
        order={selectedFulfillmentOrder}
        users={users}
        deliveryAgents={hubDeliveryAgents}
        selectedHubId={selectedHubId}
        onClose={() => setSelectedFulfillmentOrder(null)}
        onUpdateOrderStatus={onUpdateOrderStatus || (() => {})}
        onUpdateOrderDriver={onUpdateOrderDriver}
        showToast={showToast || (() => {})}
      />
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
            {(['all', 'packed', 'outForDelivery', 'delivered', 'cancelled'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: statusFilter === st ? (st === 'cancelled' ? '1px solid #DC2626' : '1px solid #047857') : '1px solid #E2E8F0',
                  backgroundColor: statusFilter === st ? (st === 'cancelled' ? '#DC2626' : '#047857') : '#FFFFFF',
                  color: statusFilter === st ? '#FFFFFF' : '#475569',
                  fontWeight: statusFilter === st ? 700 : 500,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {st === 'all' ? 'All Statuses' : st === 'packed' ? 'Packed' : st === 'outForDelivery' ? 'Out for Delivery' : st === 'delivered' ? 'Delivered' : 'Cancelled'}
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
                <th style={{ padding: '0.85rem 1.25rem' }}>PHOTO PROOF</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>
                    No active dispatches found matching filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const u = users.find(usr => usr.id === order.userId);
                  const isSub = Boolean(order.subscriptionId || order.isSubscriptionDelivery || order.orderType === 'subscription' || (order.id && order.id.startsWith('SUB_')));
                  const customerName = order.customerName || u?.name || 'Valued Customer';
                  const customerPhone = order.customerPhone || u?.phone || 'N/A';

                  const rawProof = order.proofImageUrl || (order as any).dropoffPhotoUrl || (order as any).deliveryProofUrl || (order as any).proofUrl || (order as any).photoProofPath || '';
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
                  const isDelivered = order.status === 'delivered';
                  const isCancelled = order.status === 'cancelled';
                  const cancelReason = (order as any).cancellationReason || (order as any).cancelReason;

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
                          backgroundColor: isDelivered ? '#DCFCE7' : order.status === 'outForDelivery' ? '#DBEAFE' : isCancelled ? '#FEE2E2' : '#FEF3C7',
                          color: isDelivered ? '#047857' : order.status === 'outForDelivery' ? '#1E40AF' : isCancelled ? '#DC2626' : '#B45309'
                        }}>
                          {(order.status || 'PACKED').toUpperCase()}
                        </span>
                      </td>

                      {/* Photo Proof Cell */}
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        {proofUrl ? (
                          <div
                            onClick={() => setSelectedFulfillmentOrder(order)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                          >
                            <img
                              src={proofUrl}
                              alt="Proof"
                              style={{ width: '46px', height: '46px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #047857' }}
                            />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857' }}>View Photo ✓</span>
                          </div>
                        ) : isCancelled ? (
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#DC2626' }}>
                            {cancelReason ? `✕ ${cancelReason}` : '✕ Cancelled'}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>📷 Pending Photo</span>
                        )}
                      </td>

                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedFulfillmentOrder(order)}
                          style={{
                            backgroundColor: '#044E35',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Eye size={13} /> View Sheet
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
