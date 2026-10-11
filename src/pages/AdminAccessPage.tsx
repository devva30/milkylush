import { useState, useMemo } from 'react';
import { auth } from '../firebase';
import type { HubId } from '../data/hubs';
import { useHubAdmins, createAdmin, updateAdmin, type AdminDoc, type AdminRole } from '../data/staff';
import { DataState } from '../components/common/DataState';
import { Plus } from 'lucide-react';

interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  hubAccess: string;
  status: 'Active' | 'Disabled';
  permissions: string[];
}

interface AdminAccessPageProps {
  adminUsername?: string;
  selectedHubId?: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// Role / hub labels the screen uses  ⇄  staff doc fields
const ALL_HUBS = 'All Hubs (Hosur + Bangalore)';
const HOSUR = 'Hosur Central Hub (TN)';
const BLR = 'Bangalore Electronic City Hub (KA)';
const hubIdsFromLabel = (label: string): HubId[] =>
  label === HOSUR ? ['hosur'] : label === BLR ? ['bengaluru'] : ['hosur', 'bengaluru'];
const hubLabel = (ids: HubId[] = []): string =>
  ids.length > 1 ? ALL_HUBS : ids[0] === 'hosur' ? HOSUR : ids[0] === 'bengaluru' ? BLR : '—';
function roleFromLabel(label: string, hubAccess: string): { role: AdminRole; title: string; hubIds: HubId[] } {
  if (label === 'Super Admin / Owner') return { role: 'super_admin', title: label, hubIds: ['hosur', 'bengaluru'] };
  if (label === 'Hosur Hub Manager') return { role: 'hub_admin', title: label, hubIds: ['hosur'] };
  if (label === 'Bangalore Hub Manager') return { role: 'hub_admin', title: label, hubIds: ['bengaluru'] };
  return { role: 'hub_admin', title: label, hubIds: hubIdsFromLabel(hubAccess) };
}
const toAccount = (d: AdminDoc & { id: string }): AdminAccount => ({
  id: d.id,
  name: d.name,
  email: d.email,
  role: d.title || (d.role === 'super_admin' ? 'Super Admin / Owner' : 'Hub Manager'),
  hubAccess: hubLabel(d.hubIds),
  status: d.active ? 'Active' : 'Disabled',
  permissions: d.permissions ?? ['orders', 'subscriptions', 'customers'],
});

export default function AdminAccessPage({ showToast, selectedHubId }: AdminAccessPageProps) {
  const hubId = (selectedHubId ?? 'hosur') as HubId;
  const admins = useHubAdmins(hubId);
  const adminList = useMemo(() => admins.data.map(toAccount).sort((a, b) => a.role.localeCompare(b.role)), [admins.data]);
  const [saving, setSaving] = useState(false);

  // Modal State - Add Admin
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
    role: 'Hosur Hub Manager',
    hubAccess: 'Hosur Central Hub (TN)',
    password: ''
  });

  // Modal State - Edit Permissions
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminAccount | null>(null);

  // Handlers
  const handleOpenAddModal = () => {
    setNewAdmin({
      name: '',
      email: '',
      role: 'Hosur Hub Manager',
      hubAccess: 'Hosur Central Hub (TN)',
      password: ''
    });
    setIsAddModalOpen(true);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdmin.email.trim() || !newAdmin.name.trim()) {
      showToast('Please enter both name and email for the new administrator.', 'error');
      return;
    }
    const r = roleFromLabel(newAdmin.role, newAdmin.hubAccess);
    setSaving(true);
    try {
      await createAdmin({
        name: newAdmin.name, email: newAdmin.email, password: newAdmin.password,
        role: r.role, title: r.title, hubIds: r.hubIds,
        permissions: r.role === 'super_admin' ? ['orders', 'subscriptions', 'customers', 'billing', 'broadcast'] : ['orders', 'subscriptions', 'customers'],
      });
      showToast(`Created admin login for ${newAdmin.name.trim()} (${newAdmin.email.trim()}). Share the password with them privately.`, 'success');
      setIsAddModalOpen(false);
    } catch (err) {
      const msg = (err as Error).message;
      showToast(/permission/i.test(msg) ? 'Only a super admin can add admins.' : msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditPermissions = (adm: AdminAccount) => {
    setEditingAdmin({ ...adm, permissions: [...adm.permissions] });
    setIsEditModalOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!editingAdmin) return;
    if (editingAdmin.id === auth.currentUser?.uid && editingAdmin.status === 'Disabled') {
      showToast('You cannot disable your own account.', 'error');
      return;
    }
    const r = roleFromLabel(editingAdmin.role, editingAdmin.hubAccess);
    setSaving(true);
    try {
      await updateAdmin(editingAdmin.id, {
        role: r.role, title: r.title, hubIds: r.hubIds, permissions: editingAdmin.permissions, active: editingAdmin.status === 'Active',
      });
      showToast(`Updated role and permissions for ${editingAdmin.name}.`, 'success');
      setIsEditModalOpen(false);
    } catch (err) {
      const msg = (err as Error).message;
      showToast(/permission/i.test(msg) ? 'Only a super admin can change admin accounts.' : `Could not save: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Access is revoked by disabling the account (the login stays, but every rule check fails).
  const handleDeleteAdmin = async (id: string, name: string) => {
    if (id === auth.currentUser?.uid) { showToast('You cannot revoke your own access.', 'error'); return; }
    if (!window.confirm(`Revoke admin access for ${name}? They will be signed out of all data immediately.`)) return;
    try {
      await updateAdmin(id, { active: false });
      showToast(`Revoked admin access for ${name}.`, 'info');
    } catch (err) {
      const msg = (err as Error).message;
      showToast(/permission/i.test(msg) ? 'Only a super admin can revoke admins.' : `Could not revoke: ${msg}`, 'error');
    }
  };

  const togglePermission = (perm: string) => {
    if (!editingAdmin) return;
    const exists = editingAdmin.permissions.includes(perm);
    const updated = exists 
      ? editingAdmin.permissions.filter(p => p !== perm)
      : [...editingAdmin.permissions, perm];
    setEditingAdmin({ ...editingAdmin, permissions: updated });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.65rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            Admin Access Control &amp; Security Roles
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '2px' }}>
            Manage administrator accounts, multi-hub permissions, and security credentials.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#047857',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '0.85rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} /> + Invite / Add Admin User
        </button>
      </div>

      <DataState loading={admins.loading} error={admins.error} onRetry={admins.retry} loadingLabel="Loading admin accounts…">
      {/* Admin Accounts Table Panel */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            Registered Administrator Accounts ({adminList.length})
          </h3>
        </div>

        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', textTransform: 'uppercase', fontSize: '0.72rem', color: '#6B7280' }}>
                <th style={{ padding: '0.85rem 1rem' }}>ADMIN NAME &amp; EMAIL</th>
                <th style={{ padding: '0.85rem 1rem' }}>SECURITY ROLE</th>
                <th style={{ padding: '0.85rem 1rem' }}>HUB SCOPE</th>
                <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
                <th style={{ padding: '0.85rem 1rem' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {adminList.map((adm) => (
                <tr key={adm.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 800, color: '#111827', fontSize: '0.88rem' }}>{adm.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '1px' }}>{adm.email}</div>
                  </td>
                  
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', backgroundColor: '#ECFDF5', padding: '3px 10px', borderRadius: '10px' }}>
                      {adm.role}
                    </span>
                  </td>

                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#4B5563', fontWeight: 500 }}>
                    {adm.hubAccess}
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: adm.status === 'Active' ? '#059669' : '#DC2626',
                      backgroundColor: adm.status === 'Active' ? '#DCFCE7' : '#FEE2E2',
                      padding: '3px 10px',
                      borderRadius: '12px'
                    }}>
                      {adm.status}
                    </span>
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleOpenEditPermissions(adm)}
                        style={{
                          padding: '0.45rem 0.85rem',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          backgroundColor: '#FFFFFF',
                          color: '#111827',
                          border: '1px solid #D1D5DB',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        Edit Permissions
                      </button>
                      
                      {adm.role !== 'Super Admin / Owner' && (
                        <button
                          onClick={() => handleDeleteAdmin(adm.id, adm.name)}
                          style={{
                            padding: '0.45rem 0.75rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      </DataState>

      {/* MODAL 1: ADD ADMIN USER MODAL */}
      {isAddModalOpen && (
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
            padding: '1.75rem',
            maxWidth: '480px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'left'
          }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', fontWeight: 800, color: '#111827', marginBottom: '1.25rem', borderBottom: '1px solid #F3F4F6', paddingBottom: '0.75rem' }}>
              + Create New Admin Account
            </h3>

            <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Admin Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Admin Email Address
                </label>
                <input
                  type="email"
                  placeholder="admin@milkylush.com"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Security Role
                </label>
                <select
                  value={newAdmin.role}
                  onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', backgroundColor: '#FFFFFF', outline: 'none' }}
                >
                  <option value="Super Admin / Owner">Super Admin / Owner</option>
                  <option value="Hosur Hub Manager">Hosur Hub Manager</option>
                  <option value="Bangalore Hub Manager">Bangalore Hub Manager</option>
                  <option value="Billing & Finance Admin">Billing &amp; Finance Admin</option>
                  <option value="Support Fleet Agent">Support Fleet Agent</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Hub Scope Access
                </label>
                <select
                  value={newAdmin.hubAccess}
                  onChange={(e) => setNewAdmin({ ...newAdmin, hubAccess: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', backgroundColor: '#FFFFFF', outline: 'none' }}
                >
                  <option value="All Hubs (Hosur + Bangalore)">All Hubs (Hosur + Bangalore)</option>
                  <option value="Hosur Central Hub (TN)">Hosur Central Hub (TN)</option>
                  <option value="Bangalore Electronic City Hub (KA)">Bangalore Electronic City Hub (KA)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Temporary Access Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.85rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={saving}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: 'none', backgroundColor: '#047857', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Admin
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 2: EDIT ADMIN PERMISSIONS MODAL */}
      {isEditModalOpen && editingAdmin && (
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
            padding: '1.75rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'left'
          }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', fontWeight: 800, color: '#111827', marginBottom: '1.25rem', borderBottom: '1px solid #F3F4F6', paddingBottom: '0.75rem' }}>
              Edit Admin Roles &amp; Permissions
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Admin Name / Email
                </label>
                <input
                  type="text"
                  disabled
                  value={`${editingAdmin.name} (${editingAdmin.email})`}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', fontSize: '0.85rem', color: '#6B7280' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Security Role
                </label>
                <select
                  value={editingAdmin.role}
                  onChange={(e) => setEditingAdmin({ ...editingAdmin, role: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', backgroundColor: '#FFFFFF', outline: 'none' }}
                >
                  <option value="Super Admin / Owner">Super Admin / Owner</option>
                  <option value="Hosur Hub Manager">Hosur Hub Manager</option>
                  <option value="Bangalore Hub Manager">Bangalore Hub Manager</option>
                  <option value="Billing & Finance Admin">Billing &amp; Finance Admin</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Account Status
                </label>
                <select
                  value={editingAdmin.status}
                  onChange={(e) => setEditingAdmin({ ...editingAdmin, status: e.target.value as 'Active' | 'Disabled' })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', backgroundColor: '#FFFFFF', outline: 'none' }}
                >
                  <option value="Active">Active</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </div>

              {/* Checkbox Permission Toggles */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Granular Module Permissions
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#F9FAFB', padding: '0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                  {[
                    { id: 'orders', label: 'Orders & Delivery Dispatch' },
                    { id: 'subscriptions', label: 'Subscriptions Management' },
                    { id: 'customers', label: 'Customer Account Registry' },
                    { id: 'billing', label: 'Financial Refunds & Payments' },
                    { id: 'broadcast', label: 'Broadcast Push Notifications' },
                  ].map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#111827', fontWeight: 600, cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={editingAdmin.permissions.includes(p.id)}
                        onChange={() => togglePermission(p.id)}
                        style={{ accentColor: '#047857', width: '16px', height: '16px' }}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.85rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions} disabled={saving}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: 'none', backgroundColor: '#047857', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Security Changes
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
