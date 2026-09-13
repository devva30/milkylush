import { useState } from 'react';
import { Wine, CheckCircle2, Search, Eye, Filter } from 'lucide-react';
import type { Order } from '../../types';

interface DispatchBottleReclamationPageProps {
  hubOrders: Order[];
  selectedHubId: string;
}

export default function DispatchBottleReclamationPage({ hubOrders, selectedHubId }: DispatchBottleReclamationPageProps) {
  const displayOrders = hubOrders || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'reclaimed' | 'pending'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filteredOrders = displayOrders.filter(order => {
    const matchesSearch = 
      (order.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.deliveryAddress || order.address || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    const returnedCount = order.bottlesReturned || 0;
    if (filterMode === 'reclaimed' && returnedCount <= 0) return false;
    if (filterMode === 'pending' && returnedCount > 0) return false;

    return true;
  });

  const totalCollectedBottles = displayOrders.reduce((sum, o) => sum + (o.bottlesReturned || 0), 0);
  const deliveredOrdersCount = displayOrders.filter(o => o.status === 'delivered').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
          🍾 Glass Milk Bottle Reclamation Log
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
          Tracking empty glass milk bottles collected from doorsteps by riders in {selectedHubId}.
        </p>
      </div>

      {/* 2 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.85rem', borderRadius: '14px', backgroundColor: '#FEF3C7', color: '#D97706' }}>
            <Wine size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>BOTTLES RECLAIMED TODAY</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#D97706' }}>{totalCollectedBottles} Glass Bottles</div>
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.85rem', borderRadius: '14px', backgroundColor: '#DCFCE7', color: '#047857' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>FULFILLED DOORSTEPS</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#047857' }}>{deliveredOrdersCount} Doorsteps</div>
          </div>
        </div>

      </div>

      {/* Search & Filter Control Panel */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1rem 1.25rem', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['all', 'reclaimed', 'pending'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              style={{
                padding: '0.45rem 0.95rem',
                borderRadius: '8px',
                border: filterMode === mode ? 'none' : '1px solid #E2E8F0',
                backgroundColor: filterMode === mode ? '#044E35' : '#FFFFFF',
                color: filterMode === mode ? '#FFFFFF' : '#475569',
                fontWeight: filterMode === mode ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {mode === 'all' ? 'All Doorsteps' : mode === 'reclaimed' ? '🍾 Bottles Reclaimed' : '⏳ Pending Collection'}
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
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 36px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem', outline: 'none' }}
          />
        </div>

      </div>

      {/* Table Log */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '1.15rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
            Bottle Reclamation & Collection Log ({filteredOrders.length})
          </h3>
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', textTransform: 'uppercase', fontSize: '0.72rem', color: '#64748B' }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>ORDER / DROP ID</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>CUSTOMER DETAILS</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>DELIVERY ADDRESS</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>BOTTLES COLLECTED</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: '#94A3B8' }}>
                    No bottle return logs recorded matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#044E35', fontSize: '0.85rem' }}>
                      {order.id}
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#1E293B', fontSize: '0.85rem' }}>
                      {order.customerName || 'Customer'}
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.82rem', color: '#475569' }}>
                      {order.deliveryAddress || order.address || 'Address N/A'}
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: (order.bottlesReturned || 0) > 0 ? '#D97706' : '#94A3B8' }}>
                      {(order.bottlesReturned || 0) > 0 ? `🍼 ${order.bottlesReturned} Bottles` : '-'}
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedOrder(order)}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedOrder && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.5rem',
            width: '100%', maxWidth: '480px', textAlign: 'left', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#D97706', textTransform: 'uppercase' }}>BOTTLE RECLAMATION</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#111827', margin: '2px 0 0 0' }}>
                  Doorstep Collection #{selectedOrder.id}
                </h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontWeight: 700 }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
              <div><strong>Customer Name:</strong> {selectedOrder.customerName || 'N/A'}</div>
              <div><strong>Delivery Address:</strong> {selectedOrder.deliveryAddress || selectedOrder.address || 'N/A'}</div>
              <div><strong>Bottles Returned:</strong> {selectedOrder.bottlesReturned || 0} Glass Bottles</div>
              <div><strong>Delivery Status:</strong> {(selectedOrder.status || 'DELIVERED').toUpperCase()}</div>
            </div>

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{ backgroundColor: '#044E35', color: '#FFFFFF', border: 'none', padding: '0.55rem 1.25rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
              >
                Close Log Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
