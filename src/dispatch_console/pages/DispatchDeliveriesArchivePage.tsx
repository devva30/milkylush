import { useState } from 'react';
import { Download, Search, Eye } from 'lucide-react';
import type { Order, DeliveryAgent, User, Product } from '../../types';
import FulfillmentSheetView from '../../components/common/FulfillmentSheetView';

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

  const isHosur = selectedHubId === 'hub_hosur_main' || selectedHubId === 'hub_hosur';
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

  // Shared Common Fulfillment Sheet View
  if (selectedFulfillmentOrder) {
    return (
      <FulfillmentSheetView
        order={selectedFulfillmentOrder}
        users={users}
        deliveryAgents={deliveryAgents}
        selectedHubId={selectedHubId}
        onClose={() => setSelectedFulfillmentOrder(null)}
        onUpdateOrderStatus={onUpdateOrderStatus || (() => {})}
        onUpdateOrderDriver={onUpdateOrderDriver}
        showToast={showToast || (() => {})}
      />
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
