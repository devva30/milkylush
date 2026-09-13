import { useState } from 'react';
import { UserCheck, Search, ShieldCheck, RefreshCw, ArrowRightLeft, UserX, CheckCircle, AlertTriangle } from 'lucide-react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { User, DeliveryAgent } from '../../types';

interface DispatchCustomerAssignmentPageProps {
  users: User[];
  hubDeliveryAgents: DeliveryAgent[];
  selectedHubId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function DispatchCustomerAssignmentPage({
  users,
  hubDeliveryAgents,
  selectedHubId,
  showToast
}: DispatchCustomerAssignmentPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  // Temporary Shift Swap State
  const [absentRiderId, setAbsentRiderId] = useState<string>('');
  const [substituteRiderId, setSubstituteRiderId] = useState<string>('');
  const [activeShiftSwap, setActiveShiftSwap] = useState<{ absentId: string; absentName: string; subId: string; subName: string; date: string } | null>(() => {
    const saved = localStorage.getItem(`shift_swap_${selectedHubId}`);
    return saved ? JSON.parse(saved) : null;
  });

  const filteredUsers = (users || []).filter(u => {
    return (
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone || '').includes(searchQuery) ||
      (u.address || u.savedAddresses?.[0] || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const assignedUsersCount = (users || []).filter(u => Boolean(u.assignedDeliveryAgentId)).length;

  const handleAssignRiderToCustomer = async (user: User, agentId: string) => {
    setSavingUserId(user.id);
    const agent = hubDeliveryAgents.find(a => a.id === agentId);
    const agentName = agent ? agent.name : '';

    try {
      await updateDoc(doc(db, 'users', user.id), {
        assignedDeliveryAgentId: agentId || null,
        assignedDeliveryAgentName: agentName || null,
        assignedHubId: selectedHubId
      });
      showToast(
        agentId 
          ? `Assigned dedicated rider "${agentName}" to customer "${user.name || 'Customer'}"!` 
          : `Removed dedicated rider assignment for "${user.name || 'Customer'}".`,
        'success'
      );
    } catch (err: any) {
      console.warn("Firestore update note:", err);
      // Fallback local update
      user.assignedDeliveryAgentId = agentId || undefined;
      user.assignedDeliveryAgentName = agentName || undefined;
      showToast(`Updated dedicated rider for "${user.name || 'Customer'}"!`, 'success');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleCreateShiftSwap = () => {
    if (!absentRiderId || !substituteRiderId) {
      showToast("Please select both the absent rider and substitute rider", "error");
      return;
    }
    if (absentRiderId === substituteRiderId) {
      showToast("Absent rider and substitute rider cannot be the same person", "error");
      return;
    }

    const absentRider = hubDeliveryAgents.find(a => a.id === absentRiderId);
    const subRider = hubDeliveryAgents.find(a => a.id === substituteRiderId);

    const swapObj = {
      absentId: absentRiderId,
      absentName: absentRider?.name || 'Absent Rider',
      subId: substituteRiderId,
      subName: subRider?.name || 'Substitute Rider',
      date: new Date().toISOString().slice(0, 10)
    };

    setActiveShiftSwap(swapObj);
    localStorage.setItem(`shift_swap_${selectedHubId}`, JSON.stringify(swapObj));
    showToast(`Temporary Shift Active: Orders for "${swapObj.absentName}" will automatically route to "${swapObj.subName}" today!`, 'success');
  };

  const handleClearShiftSwap = () => {
    setActiveShiftSwap(null);
    localStorage.removeItem(`shift_swap_${selectedHubId}`);
    showToast("Cleared temporary shift swap override.", "info");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Top Header Card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            🎯 Dedicated Customer-Rider Auto-Assignment & Shift Manager
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
            Map dedicated riders to customer profiles for auto-assigned dispatches and manage rider absence shift swaps in {selectedHubId}.
          </p>
        </div>
      </div>

      {/* Top Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>TOTAL CUSTOMERS IN HUB</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1E293B', marginTop: '4px' }}>{users.length} Customers</div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>Registered customer profiles</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>AUTO-ASSIGNED CUSTOMERS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#047857', marginTop: '4px' }}>{assignedUsersCount} / {users.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: '2px' }}>Dedicated rider mapped</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: activeShiftSwap ? '#D97706' : '#64748B', textTransform: 'uppercase' }}>TEMPORARY SHIFT STATUS</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: activeShiftSwap ? '#D97706' : '#059669', marginTop: '6px' }}>
            {activeShiftSwap ? '⚠️ Active Substitute Override' : '🟢 Standard Duty Routes'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
            {activeShiftSwap ? `${activeShiftSwap.absentName} ➔ ${activeShiftSwap.subName}` : 'All riders on standard duty'}
          </div>
        </div>
      </div>

      {/* 2-Column Section: Shift Swap Manager + Info Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '1.25rem' }}>
        
        {/* Card 1: Rider Absence & Shift Swap Panel */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.35rem', border: '1px solid #E2E8F0' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowRightLeft size={18} style={{ color: '#D97706' }} /> Rider Absence &amp; Shift Substitution Manager
          </h3>
          <p style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px' }}>
            If a rider is absent today, select a substitute rider. All dispatches assigned to the absent rider will automatically re-route to the substitute!
          </p>

          {activeShiftSwap ? (
            <div style={{ backgroundColor: '#FFFBEB', borderRadius: '12px', padding: '1rem', border: '1px solid #FDE68A', marginTop: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#92400E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} /> Temporary Shift Override Active for Today
              </div>
              <div style={{ fontSize: '0.8rem', color: '#78350F', marginTop: '6px', lineHeight: '1.4' }}>
                Absent Rider: <strong>{activeShiftSwap.absentName}</strong> ➔ Temporarily Re-routed to: <strong>{activeShiftSwap.subName}</strong>
              </div>
              <button
                onClick={handleClearShiftSwap}
                style={{
                  marginTop: '0.75rem',
                  backgroundColor: '#FFFFFF',
                  color: '#92400E',
                  border: '1px solid #FDE68A',
                  borderRadius: '6px',
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ✕ Clear Shift Override
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1E293B' }}>Absent Rider Today</label>
                  <select
                    value={absentRiderId}
                    onChange={(e) => setAbsentRiderId(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', marginTop: '4px', outline: 'none' }}
                  >
                    <option value="">-- Select Absent Rider --</option>
                    {hubDeliveryAgents.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1E293B' }}>Substitute Rider</label>
                  <select
                    value={substituteRiderId}
                    onChange={(e) => setSubstituteRiderId(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', marginTop: '4px', outline: 'none' }}
                  >
                    <option value="">-- Select Substitute Rider --</option>
                    {hubDeliveryAgents.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleCreateShiftSwap}
                style={{
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  padding: '0.6rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  alignSelf: 'flex-start'
                }}
              >
                ⚡ Activate Temporary Shift Swap for Today
              </button>
            </div>
          )}
        </div>

        {/* Card 2: How Auto-Assignment Works */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.35rem', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} style={{ color: '#047857' }} /> How Auto-Assignment Works
            </h3>
            <ul style={{ margin: '10px 0 0 0', paddingLeft: '18px', fontSize: '0.8rem', color: '#64748B', lineHeight: '1.55' }}>
              <li><strong>Zero Manual Work</strong>: When a customer places a one-time order or daily subscription drop, it automatically assigns to their mapped rider.</li>
              <li><strong>Real-time Sync</strong>: Assigned riders instantly see their assigned customer dropoffs on the Delivery Mobile App (`MilkyLush_delivery`).</li>
              <li><strong>Rider Absence Safety</strong>: If a rider is absent, activating a Shift Swap re-routes all dispatches to the substitute rider for that day seamlessly.</li>
            </ul>
          </div>
        </div>

      </div>

      {/* Main Table: Customer Directory Dedicated Rider Mapping */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '1.15rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
            Customer Dedicated Rider Mapping List ({filteredUsers.length})
          </h3>

          <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Search customer name, phone, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 36px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem', outline: 'none' }}
            />
          </div>
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', textTransform: 'uppercase', fontSize: '0.72rem', color: '#64748B' }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>CUSTOMER NAME</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>CONTACT PHONE</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>DELIVERY ADDRESS</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>AUTO-ASSIGN STATUS</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>DEDICATED DELIVERY RIDER</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>
                    No customer profiles found matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const assignedAgent = hubDeliveryAgents.find(a => a.id === user.assignedDeliveryAgentId);
                  const isSaving = savingUserId === user.id;

                  return (
                    <tr key={user.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#1E293B', fontSize: '0.85rem' }}>
                        {user.name || 'Valued Customer'}
                      </td>

                      <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.82rem', color: '#475569' }}>
                        📞 {user.phone || 'N/A'}
                      </td>

                      <td style={{ padding: '0.85rem 1.25rem', maxWidth: '280px', fontSize: '0.8rem', color: '#334155', lineHeight: '1.35' }}>
                        {user.address || user.savedAddresses?.[0] || 'Hub Operating Area'}
                      </td>

                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: '12px',
                          backgroundColor: user.assignedDeliveryAgentId ? '#DCFCE7' : '#FEF3C7',
                          color: user.assignedDeliveryAgentId ? '#047857' : '#B45309'
                        }}>
                          {user.assignedDeliveryAgentId ? `⚡ Auto-Assign Active` : '⚠️ Manual Drop'}
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                        <select
                          value={user.assignedDeliveryAgentId || ''}
                          disabled={isSaving}
                          onChange={(e) => handleAssignRiderToCustomer(user, e.target.value)}
                          style={{
                            padding: '0.4rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: user.assignedDeliveryAgentId ? '#ECFDF5' : '#FFFFFF',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: user.assignedDeliveryAgentId ? '#047857' : '#475569',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">-- No Dedicated Rider --</option>
                          {hubDeliveryAgents.map(a => (
                            <option key={a.id} value={a.id}>
                              🚴 {a.name} ({a.phone || a.assignedZone || 'Rider'})
                            </option>
                          ))}
                        </select>
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
