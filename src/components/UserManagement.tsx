import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../firebase';
import { Plus, Trash2, Edit, Search, Users, Truck, ShieldCheck, MapPin, Eye } from 'lucide-react';
import DeliveryPartnerDetailPage from '../pages/DeliveryPartnerDetailPage';


interface UserManagementProps {
  users: any[];
  subscriptions: any[];
  deliveryAgents: any[];
  hubs: any[];
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export default function UserManagement({ users, subscriptions, deliveryAgents, hubs, showToast }: UserManagementProps) {
  // Tabs: 'customers' | 'delivery' | 'caterers'
  const [activeSubTab, setActiveSubTab] = useState<'customers' | 'delivery' | 'caterers'>('customers');
  const [formHubId, setFormHubId] = useState('');
  const [selectedPartnerForDetail, setSelectedPartnerForDetail] = useState<any | null>(null);

  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'sub' | 'normal'>('all');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, customerFilter, activeSubTab]);
  
  // Caterers State (loaded locally)
  const [caterers, setCaterers] = useState<any[]>([]);
  const [isCaterersLoading, setIsCaterersLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [currentId, setCurrentId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formZone, setFormZone] = useState('');
  const [formVehicleNumber, setFormVehicleNumber] = useState('');
  const [formVehicleType, setFormVehicleType] = useState('Electric Scooter');
  const [formLicenseNumber, setFormLicenseNumber] = useState('');
  const [formLicenseValidity, setFormLicenseValidity] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsOnline, setFormIsOnline] = useState(false);
  const [formEmptyBottlesReturned, setFormEmptyBottlesReturned] = useState(0);
  const [formBottlesAtHome, setFormBottlesAtHome] = useState(0);
  // Load Caterers
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'caterers'), (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setCaterers(items);
      setIsCaterersLoading(false);
    }, (err) => {
      console.warn("Firestore collection 'caterers' read failed. Using empty list.", err);
      setIsCaterersLoading(false);
    });
    return () => unsub();
  }, []);

  // Helper: check subscription status
  const isSubscriptionUser = (userId: string) => {
    return subscriptions.some(s => s.userId === userId && s.status === 'active');
  };

  // Filter lists
  const getFilteredCustomers = () => {
    return users.filter(u => {
      const nameMatch = (u.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const phoneMatch = (u.phone || '').includes(searchQuery);
      const emailMatch = (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSearch = nameMatch || phoneMatch || emailMatch;

      if (!matchesSearch) return false;

      const hasActiveSub = isSubscriptionUser(u.id);
      if (customerFilter === 'sub') return hasActiveSub;
      if (customerFilter === 'normal') return !hasActiveSub;
      return true;
    });
  };

  const getFilteredDeliveryAgents = () => {
    return deliveryAgents.filter(a => {
      const nameMatch = (a.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const phoneMatch = (a.phone || '').includes(searchQuery);
      const emailMatch = (a.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      return nameMatch || phoneMatch || emailMatch;
    });
  };

  const getFilteredCaterers = () => {
    return caterers.filter(c => {
      const nameMatch = (c.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const phoneMatch = (c.phone || '').includes(searchQuery);
      const emailMatch = (c.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      return nameMatch || phoneMatch || emailMatch;
    });
  };

  // Reset form fields
  const resetForm = () => {
    setCurrentId('');
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormPassword('');
    setFormAddress('');
    setFormZone('');
    setFormHubId('');
    setFormIsActive(true);
    setFormIsOnline(false);
    setFormEmptyBottlesReturned(0);
    setFormBottlesAtHome(0);
  };

  const openAddModal = () => {
    resetForm();
    if (activeSubTab === 'customers') {
      setFormPassword('default_password_123'); // Default password for app logins
    }
    if (activeSubTab === 'delivery') {
      setFormHubId(hubs.length > 0 ? hubs[0].id : 'hub_blr_ecity');
    }
    setShowAddModal(true);
  };

  const openEditModal = (item: any) => {
    resetForm();
    setCurrentId(item.id);
    setFormName(item.name || '');
    setFormPhone(item.phone || '');
    setFormEmail(item.email || '');
    setFormAddress(
      activeSubTab === 'customers'
        ? (item.savedAddresses && item.savedAddresses[0]) || ''
        : item.address || ''
    );
    setFormZone(item.assignedZone || '');
    setFormHubId(item.hubId || (hubs.length > 0 ? hubs[0].id : 'hub_blr_ecity'));
    setFormIsActive(item.isActive !== undefined ? item.isActive : true);
    setFormIsOnline(item.isOnline || false);
    setFormEmptyBottlesReturned(item.emptyBottlesReturned || 0);
    setFormBottlesAtHome(item.bottlesAtHome || 0);
    setShowEditModal(true);
  };

  // Handle Add Form Submission
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone || !formEmail) {
      showToast("Name, Mobile, and Email are required", "error");
      return;
    }

    setIsSaving(true);

    const fallbackDirectFirestore = async (fallbackId: string) => {
      try {
        if (activeSubTab === 'customers') {
          await setDoc(doc(db, 'users', fallbackId), {
            id: fallbackId,
            name: formName,
            phone: formPhone,
            email: formEmail,
            password: formPassword || 'default_password_123',
            walletBalance: 0.0,
            ecoCreditsEarned: 0.0,
            plasticSaved: 0,
            emptyBottlesReturned: 0,
            bottlesAtHome: 0,
            savedAddresses: formAddress ? [formAddress] : [],
            activeAddressIndex: 0,
            createdAt: new Date().toISOString()
          });
          showToast("Customer created successfully in Firestore (Bypassed Auth)!", "success");
        } else if (activeSubTab === 'delivery') {
          await setDoc(doc(db, 'delivery_agents', fallbackId), {
            id: fallbackId,
            name: formName,
            phone: formPhone,
            email: formEmail,
            address: formAddress || '',
            assignedZone: formZone || 'General',
            hubId: formHubId || 'hub_blr_ecity',
            isOnline: false,
            isActive: formIsActive,
            createdAt: new Date().toISOString()
          });
          showToast("Delivery agent created in Firestore (Bypassed Auth)!", "success");
        } else {
          await setDoc(doc(db, 'caterers', fallbackId), {
            id: fallbackId,
            name: formName,
            phone: formPhone,
            email: formEmail,
            address: formAddress || '',
            isActive: formIsActive,
            createdAt: new Date().toISOString()
          });
          showToast("Caterer created in Firestore (Bypassed Auth)!", "success");
        }
        setShowAddModal(false);
        resetForm();
      } catch (err: any) {
        showToast("Firestore fallback creation failed: " + err.message, "error");
      }
    };

    try {
      const pass = formPassword || 'default_password_123';
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, formEmail, pass);
      const uid = userCred.user.uid;

      if (activeSubTab === 'customers') {
        await setDoc(doc(db, 'users', uid), {
          id: uid,
          name: formName,
          phone: formPhone,
          email: formEmail,
          password: pass,
          walletBalance: 0.0,
          ecoCreditsEarned: 0.0,
          plasticSaved: 0,
          emptyBottlesReturned: 0,
          bottlesAtHome: 0,
          savedAddresses: formAddress ? [formAddress] : [],
          activeAddressIndex: 0,
          createdAt: new Date().toISOString()
        });
        showToast("Customer created successfully!", "success");
      } else if (activeSubTab === 'delivery') {
        await setDoc(doc(db, 'delivery_agents', uid), {
          id: uid,
          name: formName,
          phone: formPhone,
          email: formEmail,
          address: formAddress || '',
          assignedZone: formZone || 'General',
          hubId: formHubId || 'hub_blr_ecity',
          isOnline: false,
          isActive: formIsActive,
          createdAt: new Date().toISOString()
        });
        showToast("Delivery Partner created successfully!", "success");
      } else {
        await setDoc(doc(db, 'caterers', uid), {
          id: uid,
          name: formName,
          phone: formPhone,
          email: formEmail,
          address: formAddress || '',
          isActive: formIsActive,
          createdAt: new Date().toISOString()
        });
        showToast("Caterer created successfully!", "success");
      }

      setShowAddModal(false);
      resetForm();
    } catch (error: any) {
      console.error("Auth creation failed:", error);
      
      const confirmBypass = window.confirm(
        `Firebase Auth registration failed: ${error.message || "Request blocked"}\n\n` +
        "Would you like to bypass Auth and create this user directly in the Firestore database for testing?"
      );

      if (confirmBypass) {
        const fallbackId = "mock_" + Math.random().toString(36).substr(2, 9);
        await fallbackDirectFirestore(fallbackId);
      } else {
        showToast("Error: " + (error.message || "Authentication failed"), "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Edit Form Submission
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone || !formEmail) {
      showToast("Name, Mobile, and Email are required", "error");
      return;
    }

    setIsSaving(true);
    try {
      if (activeSubTab === 'customers') {
        await updateDoc(doc(db, 'users', currentId), {
          name: formName,
          phone: formPhone,
          email: formEmail,
          emptyBottlesReturned: parseInt(formEmptyBottlesReturned as any) || 0,
          bottlesAtHome: parseInt(formBottlesAtHome as any) || 0,
          savedAddresses: formAddress ? [formAddress] : []
        });
        showToast("Customer profile updated successfully!", "success");
      } else if (activeSubTab === 'delivery') {
        await updateDoc(doc(db, 'delivery_agents', currentId), {
          name: formName,
          phone: formPhone,
          email: formEmail,
          address: formAddress,
          assignedZone: formZone,
          hubId: formHubId || 'hub_blr_ecity',
          isOnline: formIsOnline,
          isActive: formIsActive
        });
        showToast("Delivery Agent updated successfully!", "success");
      } else {
        await updateDoc(doc(db, 'caterers', currentId), {
          name: formName,
          phone: formPhone,
          email: formEmail,
          address: formAddress,
          isActive: formIsActive
        });
        showToast("Caterer updated successfully!", "success");
      }

      setShowEditModal(false);
      resetForm();
    } catch (err: any) {
      showToast("Failed to update profile: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (id: string, name: string) => {
    const label = activeSubTab === 'customers' ? 'Customer' : activeSubTab === 'delivery' ? 'Delivery Agent' : 'Caterer';
    const confirmDelete = window.confirm(`Are you sure you want to delete ${label} "${name}"?`);
    if (!confirmDelete) return;

    try {
      const collectionName = activeSubTab === 'customers' ? 'users' : activeSubTab === 'delivery' ? 'delivery_agents' : 'caterers';
      await deleteDoc(doc(db, collectionName, id));
      showToast(`${label} deleted from database successfully!`, "success");
    } catch (err: any) {
      showToast("Failed to delete user: " + err.message, "error");
    }
  };

  if (selectedPartnerForDetail) {
    return (
      <DeliveryPartnerDetailPage
        partner={selectedPartnerForDetail}
        onBack={() => setSelectedPartnerForDetail(null)}
      />
    );
  }

  return (
    <div className="tab-pane active fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '2rem', color: 'var(--text-dark)' }}>User Control Hub</h2>
          <p style={{ color: 'var(--text-muted)' }}>Manage credentials, details, and access states for Customers, Delivery Partners, and Caterers.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="btn btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={18} />
          <span>Add New {activeSubTab === 'customers' ? 'Customer' : activeSubTab === 'delivery' ? 'Delivery' : 'Caterer'}</span>
        </button>
      </div>

      {/* Internal Sub Tabs Navigation */}
      <div className="card-panel" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem', borderRadius: '16px' }}>
        <button 
          className="btn" 
          onClick={() => { setActiveSubTab('customers'); setSearchQuery(''); }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '0.9rem',
            backgroundColor: activeSubTab === 'customers' ? 'var(--primary)' : 'transparent',
            color: activeSubTab === 'customers' ? '#fff' : 'var(--text-muted)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <Users size={16} />
          <span>Customers ({users.length})</span>
        </button>
        <button 
          className="btn" 
          onClick={() => { setActiveSubTab('delivery'); setSearchQuery(''); }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '0.9rem',
            backgroundColor: activeSubTab === 'delivery' ? 'var(--primary)' : 'transparent',
            color: activeSubTab === 'delivery' ? '#fff' : 'var(--text-muted)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <Truck size={16} />
          <span>Delivery Persons ({deliveryAgents.length})</span>
        </button>
        <button 
          className="btn" 
          onClick={() => { setActiveSubTab('caterers'); setSearchQuery(''); }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '0.9rem',
            backgroundColor: activeSubTab === 'caterers' ? 'var(--primary)' : 'transparent',
            color: activeSubTab === 'caterers' ? '#fff' : 'var(--text-muted)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <ShieldCheck size={16} />
          <span>Caterers ({caterers.length})</span>
        </button>
      </div>

      {/* Filter and Search Actions Panel */}
      <div className="card-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          {/* Sub Filters for Customers only */}
          {activeSubTab === 'customers' ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['all', 'sub', 'normal'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setCustomerFilter(filter)}
                  className="btn-secondary"
                  style={{
                    textTransform: 'capitalize',
                    fontSize: '0.8rem',
                    padding: '0.4rem 0.85rem',
                    backgroundColor: customerFilter === filter ? 'var(--primary)' : '#FFFFFF',
                    color: customerFilter === filter ? '#FFFFFF' : '#334155',
                    borderColor: customerFilter === filter ? 'var(--primary)' : '#CBD5E1',
                    fontWeight: customerFilter === filter ? 600 : 500,
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  {filter === 'all' ? 'All Customers' : filter === 'sub' ? 'Subscription users' : 'Normal Users'}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
              {activeSubTab === 'delivery' ? 'Fleet Partners List' : 'Registered Caterer Outlets'}
            </div>
          )}

          {/* Search Box */}
          <div className="search-box-container" style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <Search size={16} />
            </span>
            <input
              type="text"
              className="form-input"
              placeholder={`Search by name, email, phone...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', height: '40px', fontSize: '0.85rem', borderRadius: '10px' }}
            />
          </div>

        </div>
      </div>

      {/* Main Table Content */}
      <div className="table-container">
        {activeSubTab === 'customers' && (
          <>
            <table className="admin-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Mobile Number</th>
                <th>Email Address</th>
                <th>Default Delivery Address</th>
                <th>Profile Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filtered = getFilteredCustomers();
                const startIndex = (currentPage - 1) * itemsPerPage;
                const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);
                if (filtered.length === 0) {
                  return (
                    <tr>
                      <td colSpan={7} className="empty-state" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No customers found matching criteria.
                      </td>
                    </tr>
                  );
                }
                return paginated.map(customer => {
                  const hasSub = isSubscriptionUser(customer.id);
                  const address = (customer.savedAddresses && customer.savedAddresses[customer.activeAddressIndex || 0]) || 'No address set';
                  return (
                    <tr key={customer.id}>
                      <td style={{ fontWeight: 600 }}>{customer.name}</td>
                      <td>{customer.phone || 'N/A'}</td>
                      <td>{customer.email || 'N/A'}</td>
                      <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={address}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <MapPin size={12} style={{ color: 'var(--primary)' }} />
                          <span>{address}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${hasSub ? 'status-active' : 'status-paused'}`} style={{ fontSize: '0.75rem' }}>
                          {hasSub ? 'Subscription' : 'Normal User'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button onClick={() => openEditModal(customer)} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', borderRadius: '8px' }}>
                            <Edit size={12} />
                          </button>
                          <button onClick={() => handleDeleteUser(customer.id, customer.name)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', borderRadius: '8px' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
          {/* Pagination Controls */}
          {getFilteredCustomers().length > 0 && (() => {
            const filtered = getFilteredCustomers();
            const totalPages = Math.ceil(filtered.length / itemsPerPage);
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>Show</span>
                  <select 
                    value={itemsPerPage} 
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="form-select"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', borderRadius: '6px', width: '70px', border: '1px solid var(--border-color)', outline: 'none' }}
                  >
                    {[10, 25, 50, 100].map(val => (
                      <option key={val} value={val}>{val}</option>
                    ))}
                  </select>
                  <span>entries per page (Total: {filtered.length})</span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <button 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '6px', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}
                  >
                    Prev
                  </button>
                  <span style={{ padding: '0 0.75rem', fontWeight: 600 }}>Page {currentPage} of {totalPages || 1}</span>
                  <button 
                    disabled={currentPage >= totalPages} 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '6px', opacity: currentPage >= totalPages ? 0.5 : 1, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            );
          })()}
          </>
        )}

        {activeSubTab === 'delivery' && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Agent Name</th>
                <th>Mobile Number</th>
                <th>Email Address</th>
                <th>Hub/Base Address</th>
                <th>Assigned Zone</th>
                <th>Duty Status</th>
                <th>Active Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredDeliveryAgents().length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No delivery personnel registered yet.
                  </td>
                </tr>
              ) : (
                getFilteredDeliveryAgents().map(agent => (
                  <tr key={agent.id}>
                    <td style={{ fontWeight: 600 }}>{agent.name}</td>
                    <td>{agent.phone || 'N/A'}</td>
                    <td>{agent.email || 'N/A'}</td>
                    <td>{agent.address || 'N/A'}</td>
                    <td>
                      <span className="badge badge-success">{agent.assignedZone || 'General'}</span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Hub: {hubs.find(h => h.id === agent.hubId)?.name || agent.hubId || 'Electronic City Hub'}
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600 }}>
                        <span className="pulsing-indicator" style={{ backgroundColor: agent.isOnline ? 'var(--success)' : '#94a3b8', width: '8px', height: '8px' }}></span>
                        {agent.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${agent.isActive ? 'status-active' : 'status-cancelled'}`} style={{ fontSize: '0.75rem' }}>
                        {agent.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button onClick={() => setSelectedPartnerForDetail(agent)} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Eye size={12} />
                          <span>View Details</span>
                        </button>
                        <button onClick={() => openEditModal(agent)} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', borderRadius: '8px' }}>
                          <Edit size={12} />
                        </button>
                        <button onClick={() => handleDeleteUser(agent.id, agent.name)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', borderRadius: '8px' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {activeSubTab === 'caterers' && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Caterer Outlet</th>
                <th>Mobile Number</th>
                <th>Email Address</th>
                <th>Outlet Location Address</th>
                <th>Active Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isCaterersLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Loading caterer outlets...
                  </td>
                </tr>
              ) : getFilteredCaterers().length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-state" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No caterer outlets registered.
                  </td>
                </tr>
              ) : (
                getFilteredCaterers().map(caterer => (
                  <tr key={caterer.id}>
                    <td style={{ fontWeight: 600 }}>{caterer.name}</td>
                    <td>{caterer.phone || 'N/A'}</td>
                    <td>{caterer.email || 'N/A'}</td>
                    <td>{caterer.address || 'N/A'}</td>
                    <td>
                      <span className={`status-badge ${caterer.isActive ? 'status-active' : 'status-cancelled'}`} style={{ fontSize: '0.75rem' }}>
                        {caterer.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button onClick={() => openEditModal(caterer)} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', borderRadius: '8px' }}>
                          <Edit size={12} />
                        </button>
                        <button onClick={() => handleDeleteUser(caterer.id, caterer.name)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', borderRadius: '8px' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => !isSaving && setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', textAlign: 'left' }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.5rem', marginBottom: '1.25rem', color: 'var(--text-dark)' }}>
              Add New {activeSubTab === 'customers' ? 'Customer Profile' : activeSubTab === 'delivery' ? 'Delivery Agent' : 'Caterer Outlet'}
            </h3>
            
            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Name / Outlet Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. user@milkylush.com"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Secure Password {activeSubTab === 'customers' && '(Default app login password set)'}
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Enter login password"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. 12, Green Pastures, Ooty"
                />
              </div>

              {activeSubTab === 'delivery' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label className="form-label">Vehicle Reg. Number</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={formVehicleNumber}
                        onChange={(e) => setFormVehicleNumber(e.target.value)}
                        placeholder="e.g. TN 29 AB 4521"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Vehicle Type</label>
                      <select 
                        className="form-select" 
                        value={formVehicleType}
                        onChange={(e) => setFormVehicleType(e.target.value)}
                        style={{ padding: '0.5rem', width: '100%', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#fff' }}
                      >
                        <option value="Electric Scooter">Electric Scooter</option>
                        <option value="Delivery Bike">Delivery Bike</option>
                        <option value="EV Mini Van">EV Mini Van</option>
                        <option value="Bicycle">Bicycle</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label className="form-label">Driving License</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={formLicenseNumber}
                        onChange={(e) => setFormLicenseNumber(e.target.value)}
                        placeholder="e.g. DL-90823411"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">License Validity</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={formLicenseValidity}
                        onChange={(e) => setFormLicenseValidity(e.target.value)}
                        placeholder="e.g. Valid till 2030"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Assigned Operations Hub</label>
                    <select
                      className="form-select"
                      value={formHubId}
                      onChange={(e) => setFormHubId(e.target.value)}
                      style={{ padding: '0.5rem', width: '100%', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#fff' }}
                    >
                      {hubs.map((hub) => (
                        <option key={hub.id} value={hub.id}>
                          {hub.name} ({hub.cityName})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {activeSubTab !== 'customers' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input 
                    type="checkbox" 
                    id="isActiveCheck" 
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="isActiveCheck" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', cursor: 'pointer' }}>
                    Mark account as Active & Enabled
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => setShowAddModal(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  disabled={isSaving}
                >
                  {isSaving ? 'Registering...' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => !isSaving && setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', textAlign: 'left' }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.5rem', marginBottom: '1.25rem', color: 'var(--text-dark)' }}>
              Edit {activeSubTab === 'customers' ? 'Customer Profile' : activeSubTab === 'delivery' ? 'Delivery Agent' : 'Caterer Outlet'}
            </h3>
            
            <form onSubmit={handleEditUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label className="form-label">Name / Outlet Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. 12, Green Pastures, Ooty"
                />
              </div>

              {activeSubTab === 'customers' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Empty Bottles Returned</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={formEmptyBottlesReturned}
                      onChange={(e) => setFormEmptyBottlesReturned(parseInt(e.target.value) || 0)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bottles At Home</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={formBottlesAtHome}
                      onChange={(e) => setFormBottlesAtHome(parseInt(e.target.value) || 0)}
                      required
                    />
                  </div>
                </div>
              )}


              {activeSubTab === 'delivery' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Assigned Zone</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formZone}
                      onChange={(e) => setFormZone(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Assigned Operations Hub</label>
                    <select
                      className="form-select"
                      value={formHubId}
                      onChange={(e) => setFormHubId(e.target.value)}
                      style={{ padding: '0.5rem', width: '100%', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: '#fff' }}
                    >
                      {hubs.map((hub) => (
                        <option key={hub.id} value={hub.id}>
                          {hub.name} ({hub.cityName})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <input 
                      type="checkbox" 
                      id="isOnlineCheck" 
                      checked={formIsOnline}
                      onChange={(e) => setFormIsOnline(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                    />
                    <label htmlFor="isOnlineCheck" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', cursor: 'pointer' }}>
                      Mark Rider Duty state as ONLINE
                    </label>
                  </div>
                </>
              )}

              {activeSubTab !== 'customers' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input 
                    type="checkbox" 
                    id="isActiveEditCheck" 
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="isActiveEditCheck" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)', cursor: 'pointer' }}>
                    Mark account as Active & Enabled
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => setShowEditModal(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
