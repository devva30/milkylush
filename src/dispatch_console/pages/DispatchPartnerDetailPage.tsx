import { useState } from 'react';
import { ArrowLeft, Trash2, Phone, Mail, MapPin, CheckCircle, Clock, Truck, ShieldCheck } from 'lucide-react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { DeliveryAgent, Order } from '../../types';

interface DispatchPartnerDetailPageProps {
  partner: DeliveryAgent;
  hubOrders: Order[];
  onBack: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function DispatchPartnerDetailPage({
  partner,
  hubOrders,
  onBack,
  showToast
}: DispatchPartnerDetailPageProps) {
  const [dateFilter, setDateFilter] = useState('All Dates');
  const [jobStatusFilter, setJobStatusFilter] = useState('All Statuses');
  const [isActive, setIsActive] = useState(partner?.isActive !== false);

  const partnerId = partner?.id || '';
  const partnerName = partner?.name || 'Delivery Partner';
  const partnerPhone = partner?.phone || 'N/A';
  const partnerEmail = partner?.email || 'N/A';
  const partnerAddress = partner?.address || 'No address logged';
  const assignedZone = partner?.assignedZone || 'General Delivery Route';
  const isOnline = partner?.isOnline || false;

  // Filter orders associated with this partner
  const partnerOrders = (hubOrders || []).filter(o => 
    o.assignedPartner === partnerName || 
    o.assignedPartner === partnerId || 
    (o.status === 'outForDelivery' || o.status === 'delivered')
  );

  const assignedJobsCount = partnerOrders.length;
  const completedDropsCount = partnerOrders.filter(o => o.status === 'delivered').length;
  const cancelledDropsCount = partnerOrders.filter(o => o.status === 'cancelled').length;
  const successRate = assignedJobsCount > 0 ? Math.round((completedDropsCount / assignedJobsCount) * 100) : 0;

  const handleToggleActiveStatus = async () => {
    try {
      const nextState = !isActive;
      setIsActive(nextState);
      await updateDoc(doc(db, 'delivery_agents', partnerId), {
        isActive: nextState
      });
      showToast(`Partner account status updated to ${nextState ? 'Active' : 'Suspended'}`, "success");
    } catch (e: any) {
      showToast("Failed to update status: " + e.message, "error");
    }
  };

  const handleDeletePartner = async () => {
    const confirmDelete = window.confirm(`Are you sure you want to delete delivery partner "${partnerName}"?`);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, 'delivery_agents', partnerId));
      showToast(`Partner "${partnerName}" deleted from database!`, "success");
      onBack();
    } catch (e: any) {
      showToast("Failed to delete partner: " + e.message, "error");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Top Action Bar matching Screenshot #1 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0.45rem 0.85rem',
            borderRadius: '10px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            fontWeight: 700,
            fontSize: '0.82rem',
            color: '#334155',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={16} /> Back to Registry
        </button>

        <button
          onClick={handleDeletePartner}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0.45rem 0.95rem',
            borderRadius: '8px',
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '0.82rem',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Trash2 size={15} /> Delete Partner
        </button>
      </div>

      {/* Partner Profile Header Card matching Screenshot #1 */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.5rem', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          
          {/* Avatar & Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#044E35', color: '#EBC154', fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {partnerName.substring(0, 1).toUpperCase()}
            </div>

            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                {partnerName}
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <MapPin size={14} style={{ color: '#E11D48' }} /> Zone Region: <strong style={{ color: '#334155' }}>{assignedZone}</strong>
              </div>
            </div>
          </div>

          {/* Account Status Switch & Duty Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ACCOUNT STATUS</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isActive ? '#059669' : '#EF4444' }}>
                  {isActive ? 'Active' : 'Suspended'}
                </span>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={handleToggleActiveStatus}
                  style={{ width: '36px', height: '20px', accentColor: '#044E35', cursor: 'pointer' }}
                />
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DUTY STATUS</div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '12px',
                backgroundColor: isOnline ? '#DCFCE7' : '#FEE2E2',
                color: isOnline ? '#047857' : '#DC2626',
                marginTop: '4px',
                display: 'inline-block'
              }}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

        </div>

        <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.82rem', color: '#475569' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            📞 <strong>Phone:</strong> {partnerPhone}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            ✉ <strong>Email:</strong> {partnerEmail}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            🏠 <strong>Address:</strong> {partnerAddress}
          </span>
        </div>

      </div>

      {/* 4 Performance Stat Cards matching Screenshot #1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0', borderLeft: '4px solid #044E35' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>ASSIGNED JOBS</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1E293B', marginTop: '4px' }}>{assignedJobsCount}</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0', borderLeft: '4px solid #059669' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>COMPLETED DROPS</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{completedDropsCount}</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0', borderLeft: '4px solid #EF4444' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>CANCELLED DROPS</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#EF4444', marginTop: '4px' }}>{cancelledDropsCount}</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0', borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>SUCCESS RATE</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#8B5CF6', marginTop: '4px' }}>{successRate}%</div>
        </div>

      </div>

      {/* Filter Bar matching Screenshot #1 */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '0.85rem 1.25rem', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>FILTER DATE:</span>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{ padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8rem', backgroundColor: '#FFFFFF', outline: 'none' }}
          >
            <option value="All Dates">All Dates</option>
            <option value="Today">Today</option>
            <option value="This Week">This Week</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>JOB STATUS:</span>
          <select
            value={jobStatusFilter}
            onChange={(e) => setJobStatusFilter(e.target.value)}
            style={{ padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8rem', backgroundColor: '#FFFFFF', outline: 'none' }}
          >
            <option value="All Statuses">All Statuses</option>
            <option value="Packed">Packed</option>
            <option value="Out for Delivery">Out for Delivery</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>
      </div>

      {/* Bottom 2 Cards: Job Dispatches History + Duty Attendance Logs matching Screenshot #1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 0.7fr)', gap: '1.25rem' }}>
        
        {/* Left Column: Job Dispatches & History */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E2E8F0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              🚚 Job Dispatches & History ({partnerOrders.length})
            </h4>
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            <table className="admin-table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', textTransform: 'uppercase', fontSize: '0.68rem', color: '#64748B' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>ORDER ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>CUSTOMER</th>
                  <th style={{ padding: '0.75rem 1rem' }}>ITEMS</th>
                  <th style={{ padding: '0.75rem 1rem' }}>STATUS</th>
                  <th style={{ padding: '0.75rem 1rem' }}>DATE</th>
                  <th style={{ padding: '0.75rem 1rem' }}>VERIFICATION PROOF</th>
                </tr>
              </thead>
              <tbody>
                {partnerOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#94A3B8', fontSize: '0.82rem' }}>
                      No job dispatches logged for this partner.
                    </td>
                  </tr>
                ) : (
                  partnerOrders.map(order => (
                    <tr key={order.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#044E35', fontSize: '0.82rem' }}>
                        {order.id}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 600 }}>
                        {order.customerName || 'Unknown Recipient'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: '#475569' }}>
                        {Array.isArray(order.items) ? `${order.items.length} Item(s)` : 'Milk Drop'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '8px', backgroundColor: order.status === 'delivered' ? '#DCFCE7' : '#F1F5F9', color: order.status === 'delivered' ? '#047857' : '#475569' }}>
                          {(order.status || 'PACKED').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: '#64748B' }}>
                        {new Date().toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: '#64748B' }}>
                        In Transit / Packed
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Duty Attendance Logs */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            🗓 Duty Attendance Logs (0)
          </h4>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem', color: '#94A3B8', fontSize: '0.82rem' }}>
            No attendance activity logged.
          </div>
        </div>

      </div>

    </div>
  );
}
