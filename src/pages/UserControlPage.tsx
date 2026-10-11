import { useState, useEffect, useMemo } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, Plus, Edit2, Trash2, Users, Truck, Shield } from 'lucide-react';
import type { User } from '../types';
import { useToast } from '../context/ToastContext';
import { useHubContext } from '../context/HubContext';
import type { HubId } from '../data/hubs';
import { useHubCustomers, findCustomers, isServerSearch, type Customer, type CustomerSummary } from '../data/customers';
import { useHubRiders } from '../data/staff';
import { logAudit } from '../utils/auditLogger';
import { DataState, LoadMore } from '../components/common/DataState';

interface UserControlPageProps {
  /** Unused: the page loads the hub's customers page by page. */
  users?: User[];
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function UserControlPage(_props: UserControlPageProps) {
  const { showToast } = useToast();
  const { selectedHubId } = useHubContext();
  const hubId = selectedHubId as HubId;
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRoleTab, setActiveRoleTab] = useState<'customers' | 'delivery' | 'caterers'>('customers');
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'subscription' | 'normal' | 'deleted'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const customersQuery = useHubCustomers(hubId);
  const riders = useHubRiders(hubId);
  const [searchHits, setSearchHits] = useState<Customer[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Phone / HSR-CUS search goes to the database; name search filters the loaded rows
  useEffect(() => {
    if (!isServerSearch(searchQuery)) { setSearchHits(null); return; }
    let alive = true;
    findCustomers(hubId, searchQuery).then((h) => alive && setSearchHits(h)).catch(() => alive && setSearchHits([]));
    return () => { alive = false; };
  }, [hubId, searchQuery]);

  type Row = Customer & CustomerSummary;
  const displayUsers = (searchHits ?? customersQuery.data) as Row[];
  const isSub = (u: Row) => (u.activeSubscriptionCount ?? 0) + (u.pausedSubscriptionCount ?? 0) > 0;
  const filteredUsers = useMemo(() => displayUsers.filter((u) => {
    if (!searchHits) {
      const q = searchQuery.toLowerCase();
      const matches = (u.name || '').toLowerCase().includes(q) || (u.phone || '').includes(searchQuery)
        || (u.email || '').toLowerCase().includes(q) || (u.customerId || '').toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (activeTypeFilter === 'deleted') return !!u.blocked;
    if (u.blocked) return false;
    if (activeTypeFilter === 'subscription') return isSub(u);
    if (activeTypeFilter === 'normal') return !isSub(u);
    return true;
  }), [displayUsers, searchHits, searchQuery, activeTypeFilter]);

  const handleEdit = async (u: Row) => {
    const name = window.prompt('Customer name', u.name ?? '');
    if (name === null) return;
    const email = window.prompt('Email (leave empty if none)', u.email ?? '');
    if (email === null) return;
    if (!name.trim()) { showToast('Name cannot be empty.', 'error'); return; }
    setBusyId(u.id);
    try {
      await updateDoc(doc(db, 'users', u.id), { name: name.trim(), email: email.trim(), updatedAt: serverTimestamp() });
      await logAudit({ hubId, category: 'User Roles', action: `Edited customer ${u.customerId ?? u.id}: ${name.trim()}`, target: `users/${u.id}` });
      showToast('Customer updated.', 'success');
      customersQuery.retry();
    } catch (err) {
      showToast(`Could not update: ${(err as Error).message}`, 'error');
    } finally { setBusyId(null); }
  };

  // Customers own their phone login, so the admin blocks instead of deleting.
  const handleBlock = async (u: Row) => {
    const block = !u.blocked;
    if (!window.confirm(`${block ? 'Block' : 'Unblock'} ${u.name}? ${block ? 'They will not be able to order or get deliveries.' : ''}`)) return;
    setBusyId(u.id);
    try {
      await updateDoc(doc(db, 'users', u.id), { blocked: block, updatedAt: serverTimestamp() });
      await logAudit({ hubId, category: 'User Roles', action: `${block ? 'Blocked' : 'Unblocked'} customer ${u.customerId ?? u.id}`, target: `users/${u.id}` });
      showToast(block ? 'Customer blocked.' : 'Customer unblocked.', block ? 'info' : 'success');
      customersQuery.retry();
    } catch (err) {
      showToast(`Could not update: ${(err as Error).message}`, 'error');
    } finally { setBusyId(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* Page Title Header matching Screenshot 2 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.65rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            User Control Hub
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '2px' }}>
            Manage credentials, details, and access states for Customers, Delivery Partners, and Caterers.
          </p>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            fontWeight: 700,
            padding: '0.65rem 1.25rem',
            borderRadius: '10px',
            backgroundColor: '#047857',
            color: '#FFFFFF',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} /> Add New Customer
        </button>
      </div>

      {/* Role Tabs Bar matching Screenshot 2 */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '0.85rem 1.25rem', border: '1px solid #E5E7EB', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveRoleTab('customers')}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: activeRoleTab === 'customers' ? '#044E35' : '#FFFFFF',
            color: activeRoleTab === 'customers' ? '#FFFFFF' : '#374151',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Users size={16} /> Customers ({displayUsers.length}{customersQuery.hasMore && !searchHits ? '+' : ''})
        </button>

        <button
          onClick={() => setActiveRoleTab('delivery')}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '10px',
            border: activeRoleTab === 'delivery' ? 'none' : '1px solid #E5E7EB',
            backgroundColor: activeRoleTab === 'delivery' ? '#044E35' : '#FFFFFF',
            color: activeRoleTab === 'delivery' ? '#FFFFFF' : '#374151',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Truck size={16} /> Delivery Persons ({riders.data.length})
        </button>

        <button
          onClick={() => setActiveRoleTab('caterers')}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '10px',
            border: activeRoleTab === 'caterers' ? 'none' : '1px solid #E5E7EB',
            backgroundColor: activeRoleTab === 'caterers' ? '#044E35' : '#FFFFFF',
            color: activeRoleTab === 'caterers' ? '#FFFFFF' : '#374151',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Shield size={16} /> Caterers (0)
        </button>
      </div>

      {/* User Type Filter & Search Bar matching Screenshot 2 */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '0.85rem 1.25rem', border: '1px solid #E5E7EB', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        
        {/* Type Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            onClick={() => setActiveTypeFilter('all')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: activeTypeFilter === 'all' ? 'none' : '1px solid #E5E7EB',
              backgroundColor: activeTypeFilter === 'all' ? '#044E35' : '#FFFFFF',
              color: activeTypeFilter === 'all' ? '#FFFFFF' : '#374151',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            All Customers
          </button>
          <button 
            onClick={() => setActiveTypeFilter('subscription')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: activeTypeFilter === 'subscription' ? 'none' : '1px solid #E5E7EB',
              backgroundColor: activeTypeFilter === 'subscription' ? '#044E35' : '#FFFFFF',
              color: activeTypeFilter === 'subscription' ? '#FFFFFF' : '#374151',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Subscription Users
          </button>
          <button 
            onClick={() => setActiveTypeFilter('normal')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: activeTypeFilter === 'normal' ? 'none' : '1px solid #E5E7EB',
              backgroundColor: activeTypeFilter === 'normal' ? '#044E35' : '#FFFFFF',
              color: activeTypeFilter === 'normal' ? '#FFFFFF' : '#374151',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Normal Users
          </button>
          <button 
            onClick={() => setActiveTypeFilter('deleted')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: activeTypeFilter === 'deleted' ? 'none' : '1px solid #FCA5A5',
              backgroundColor: activeTypeFilter === 'deleted' ? '#DC2626' : '#FEF2F2',
              color: activeTypeFilter === 'deleted' ? '#FFFFFF' : '#DC2626',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Blocked Accounts
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            type="text"
            placeholder="Search by name, phone, HSR-CUS-…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.85rem 0.45rem 34px',
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              backgroundColor: '#F9FAFB',
              fontSize: '0.82rem',
              color: '#111827',
              outline: 'none',
            }}
          />
        </div>
      </div>

      <DataState loading={customersQuery.loading} error={customersQuery.error} onRetry={customersQuery.retry} loadingLabel="Loading customers…">
      {/* Main Table Panel matching Screenshot 2 */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', textTransform: 'uppercase', fontSize: '0.72rem', color: '#6B7280' }}>
                <th style={{ padding: '0.85rem 1rem' }}>CUSTOMER NAME</th>
                <th style={{ padding: '0.85rem 1rem' }}>MOBILE NUMBER</th>
                <th style={{ padding: '0.85rem 1rem' }}>EMAIL ADDRESS</th>
                <th style={{ padding: '0.85rem 1rem' }}>DEFAULT DELIVERY ADDRESS</th>
                <th style={{ padding: '0.85rem 1rem' }}>PROFILE STATUS</th>
                <th style={{ padding: '0.85rem 1rem' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isSubUser = isSub(u);
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#111827', fontSize: '0.88rem' }}>
                      {u.name}
                      {u.customerId && <div style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: 600 }}>{u.customerId}</div>}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#374151' }}>
                      {u.phone}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#047857', fontWeight: 600 }}>
                      {u.email || '—'}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', maxWidth: '340px', fontSize: '0.78rem', color: '#4B5563', lineHeight: '1.35' }}>
                      {u.defaultAddressText || '—'}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: isSubUser ? '#059669' : '#B45309',
                        backgroundColor: isSubUser ? '#DCFCE7' : '#FEF3C7',
                        padding: '3px 10px',
                        borderRadius: '12px'
                      }}>
                        {u.blocked ? 'Blocked' : isSubUser ? 'Subscription' : 'Normal User'}
                      </span>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          disabled={busyId === u.id} onClick={() => handleEdit(u)} title="Edit name / email"
                          style={{
                            padding: '0.35rem 0.55rem',
                            fontSize: '0.78rem',
                            borderRadius: '6px',
                            backgroundColor: '#FFFFFF',
                            color: '#374151',
                            border: '1px solid #D1D5DB',
                            cursor: 'pointer'
                          }}
                        >
                          <Edit2 size={14} />
                        </button>

                        <button
                          disabled={busyId === u.id} onClick={() => handleBlock(u)} title={u.blocked ? 'Unblock customer' : 'Block customer'}
                          style={{
                            padding: '0.35rem 0.55rem',
                            fontSize: '0.78rem',
                            borderRadius: '6px',
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#9CA3AF' }}>
                    No user accounts found matching query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination matching Screenshot 2 */}
        <div style={{ padding: '0.85rem 1.25rem', backgroundColor: '#F9FAFB', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#6B7280' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Show</span>
            <select style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', fontSize: '0.8rem' }}>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
            <span>entries per page (Showing: {filteredUsers.length})</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', color: '#374151', cursor: 'pointer', fontSize: '0.78rem' }}>Prev</button>
            <span style={{ fontWeight: 700, color: '#111827' }}>Page 1 of 1</span>
            <button style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', color: '#374151', cursor: 'pointer', fontSize: '0.78rem' }}>Next</button>
          </div>
        </div>
      </div>

      {!searchHits && <LoadMore hasMore={customersQuery.hasMore} loading={customersQuery.loadingMore} onClick={customersQuery.loadMore} />}
      </DataState>

      {/* Quick Add Customer Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '2rem',
            maxWidth: '460px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, marginBottom: '0.5rem' }}>+ Register New Customer</h3>
            <p style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: '1.25rem' }}>
              Customers sign up in the MilkyLush app with phone OTP, which creates their account and HSR-CUS id. An account made here would not match their login.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280' }}>FULL NAME</label>
                <input type="text" placeholder="e.g. Ramesh Kumar" style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid #E5E7EB', marginTop: '4px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280' }}>MOBILE NUMBER</label>
                <input type="text" placeholder="+91 98765 43210" style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid #E5E7EB', marginTop: '4px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280' }}>DELIVERY ADDRESS &amp; FLAT</label>
                <input type="text" placeholder="Flat 204, Green Heights, Hosur" style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1px solid #E5E7EB', marginTop: '4px', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.85rem', marginTop: '1rem' }}>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary" 
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '12px' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setShowAddModal(false);
                    showToast("Customers register themselves in the MilkyLush app with their phone number (OTP). Use Add Order for phone orders once they have signed up.", "info");
                  }}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', backgroundColor: '#047857', color: '#FFFFFF', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
