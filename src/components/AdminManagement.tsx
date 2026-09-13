import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../firebase';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';

export default function AdminManagement({ showToast, currentAdminEmail, hubs }: { showToast: (msg: string, type?: 'success' | 'error') => void; currentAdminEmail: string; hubs: any[] }) {
  const [admins, setAdmins] = useState<any[]>([]);
  const [mockAdmins, setMockAdmins] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('mockAdmins') || '[]');
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [assignedHubId, setAssignedHubId] = useState('all');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'admins'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdmins(data);
      setIsLoading(false);
    }, (err) => {
      console.warn("Firestore collection listen failed, falling back to mock lists.", err);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newName || !newPhone) {
      showToast("Please fill in all fields", "error");
      return;
    }
    
    setIsCreating(true);
    
    const localFallback = () => {
      const newAdmin = {
        id: "mock_" + Math.random().toString(36).substr(2, 9),
        email: newEmail,
        name: newName,
        phone: newPhone,
        role: 'admin',
        hubId: assignedHubId,
        createdAt: new Date().toISOString(),
        isMock: true
      };
      const updated = [...mockAdmins, newAdmin];
      setMockAdmins(updated);
      localStorage.setItem('mockAdmins', JSON.stringify(updated));
      showToast("Admin created locally in browser cache!", "success");
      setShowAddModal(false);
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewPhone('');
      setAssignedHubId('all');
    };

    try {
      // Create user using the secondary auth instance so it doesn't log out the current admin
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
      const uid = userCred.user.uid;
      
      // Add to admins collection
      await setDoc(doc(db, 'admins', uid), {
        email: newEmail,
        name: newName,
        phone: newPhone,
        role: 'admin',
        hubId: assignedHubId,
        createdAt: new Date().toISOString()
      });
      
      showToast("Admin created successfully!", "success");
      setShowAddModal(false);
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewPhone('');
      setAssignedHubId('all');
      
    } catch (error: any) {
      console.error("Error creating admin:", error);
      if (error.code === 'auth/operation-not-allowed') {
        const confirmBypass = window.confirm(
          "Email/Password Authentication is disabled in your Firebase console.\n\n" +
          "Would you like to bypass this and register this administrator locally in your browser cache (localStorage) for testing?"
        );
        if (confirmBypass) {
          localFallback();
        } else {
          showToast("Error: Email/Password auth is disabled in Firebase Console. Please enable it.", "error");
        }
      } else {
        // Any other error (e.g. Firestore permission denied), offer local fallback too
        const confirmBypass = window.confirm(
          `Firebase Error: ${error.message || "Request blocked"}\n\n` +
          "Would you like to save this administrator locally in your browser cache instead for testing?"
        );
        if (confirmBypass) {
          localFallback();
        } else {
          showToast(error.message || "Failed to create admin", "error");
        }
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteAdmin = async (id: string, email: string, isMock?: boolean) => {
    if (email === currentAdminEmail) {
      showToast("You cannot delete your own admin account!", "error");
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete administrator "${email}"?`);
    if (!confirmDelete) return;

    try {
      if (isMock) {
        const updated = mockAdmins.filter(a => a.id !== id);
        setMockAdmins(updated);
        localStorage.setItem('mockAdmins', JSON.stringify(updated));
        showToast("Mock Admin deleted locally!", "success");
      } else {
        await deleteDoc(doc(db, 'admins', id));
        showToast("Admin deleted from database. Remember to manually disable their account in the Firebase Console.", "success");
      }
    } catch (error: any) {
      console.error("Error deleting admin:", error);
      showToast(error.message || "Failed to delete admin", "error");
    }
  };

  const allAdmins = [...admins, ...mockAdmins];

  if (isLoading) {
    return <div className="loading-state">Loading administrators...</div>;
  }

  return (
    <div className="tab-pane active fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '2rem', color: 'var(--text-dark)' }}>Admin Management</h2>
          <p style={{ color: 'var(--text-muted)' }}>Manage dashboard access and create new admin accounts.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={18} />
          <span>Add New Admin</span>
        </button>
      </div>

      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Admin Name</th>
              <th>Email Address</th>
              <th>Phone Number</th>
              <th>Role</th>
              <th>Hub Scope</th>
              <th>Created At</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {allAdmins.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No administrators found.
                </td>
              </tr>
            ) : (
              allAdmins.map(admin => (
                <tr key={admin.id}>
                  <td style={{ fontWeight: 600 }}>{admin.name}</td>
                  <td>{admin.email}</td>
                  <td>{admin.phone || 'N/A'}</td>
                  <td>
                    <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                       <ShieldCheck size={14} />
                      {admin.role || 'Admin'}
                      {admin.isMock && ' (Local Mock)'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {admin.hubId === 'all' || !admin.hubId
                      ? 'All Hubs'
                      : hubs.find(h => h.id === admin.hubId)?.name || admin.hubId}
                  </td>
                  <td>{admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'N/A'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      onClick={() => handleDeleteAdmin(admin.id, admin.email, admin.isMock)}
                      className="btn btn-danger"
                      disabled={admin.email === currentAdminEmail}
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.25rem', 
                        padding: '0.35rem 0.75rem', 
                        fontSize: '0.75rem', 
                        borderRadius: '8px',
                        opacity: admin.email === currentAdminEmail ? 0.5 : 1,
                        cursor: admin.email === currentAdminEmail ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => !isCreating && setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-dark)' }}>
              Add New Administrator
            </h3>
            
            <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="admin@milkylush.com"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Assigned Operations Hub</label>
                <select
                  className="form-select"
                  value={assignedHubId}
                  onChange={(e) => setAssignedHubId(e.target.value)}
                  style={{ padding: '0.5rem', width: '100%', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#fff' }}
                >
                  <option value="all">All Hubs (Multi-Hub Overview)</option>
                  {hubs.map((hub) => (
                    <option key={hub.id} value={hub.id}>
                      {hub.name} ({hub.cityName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Secure Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => setShowAddModal(false)}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  disabled={isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
