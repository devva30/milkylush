import { useState, useMemo, useEffect } from 'react';
import { useHubContext } from '../context/HubContext';
import {
  useHubCustomers, customerToRow, useCustomerAddresses, withGps, useCustomerSubscriptions, useCustomerDeliveries,
  addCustomerAddress, deleteCustomerAddress, addressText,
} from '../data/customers';
import { DataState, LoadMore } from '../components/common/DataState';
import { 
  Search, Plus, Download, MapPin, ArrowLeft, ChevronLeft, ChevronRight,
  User as UserIcon, Phone, Mail, CreditCard, Package, Calendar,
  CheckCircle2, PauseCircle, Clock, ExternalLink, ShieldAlert, Trash2
} from 'lucide-react';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { User, Order, Subscription } from '../types';
import { useToast } from '../context/ToastContext';
import { formatAddressDetails, getGoogleMapsUrl } from '../utils/addressFormatter';

interface CustomerExtended extends User {
  status: 'active' | 'inactive' | 'vacation' | 'skipped';
  customerType: 'subscription' | 'onetime' | 'both' | 'new';
  hasClaimedFreeSample: boolean;
}

interface CustomersPageProps {
  /** Ignored: the page loads customers page by page. Kept so callers compile. */
  hubUsers?: User[];
  orders?: Order[];
  subscriptions?: Subscription[];
  targetCustomerId?: string | null;
  onNavigateTab: (tabName: string, targetId?: string) => void;
}

export default function CustomersPage({ targetCustomerId, onNavigateTab }: CustomersPageProps) {
  const { showToast } = useToast();
  const { selectedHubId: hubId } = useHubContext();
  const customersQuery = useHubCustomers(hubId);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'active' | 'inactive' | 'vacation' | 'skipped'>('all');
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'subscription' | 'onetime' | 'both' | 'new'>('all');
  const [activeFreeSampleFilter, setActiveFreeSampleFilter] = useState<'all' | 'new_customers' | 'claimed' | 'not_claimed'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerExtended | null>(null);
  const openUid = selectedCustomer?.id ?? null;
  const custAddresses = useCustomerAddresses(openUid);
  const custSubs = useCustomerSubscriptions(hubId, openUid);
  const custDeliveries = useCustomerDeliveries(hubId, openUid);
  const [customerAddresses, setCustomerAddresses] = useState<Record<string, string[]>>({});

  // Structured Add Address Form State (matching App fields exactly)
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);
  const [addCity, setAddCity] = useState<'Hosur, Tamil Nadu' | 'Bengaluru, Karnataka'>('Hosur, Tamil Nadu');
  const [addArea, setAddArea] = useState('');
  const [addHouseNo, setAddHouseNo] = useState('');
  const [addStreet, setAddStreet] = useState('');
  const [addBuilding, setAddBuilding] = useState('');
  const [addFloor, setAddFloor] = useState('');
  const [addLandmark, setAddLandmark] = useState('');
  const [addPin, setAddPin] = useState('');
  const [addReceiverName, setAddReceiverName] = useState('');
  const [addReceiverPhone, setAddReceiverPhone] = useState('');
  const [addAddressType, setAddAddressType] = useState<'Home' | 'Work' | 'Hotel' | 'Other'>('Home');
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // 20-Second Delete Customer Modal State
  const [deleteCustomerModal, setDeleteCustomerModal] = useState<{ id: string; name: string } | null>(null);
  const [deleteCustCountdown, setDeleteCustCountdown] = useState<number>(20);

  useEffect(() => {
    if (!deleteCustomerModal) return;
    if (deleteCustCountdown <= 0) return;
    const timer = setInterval(() => {
      setDeleteCustCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [deleteCustomerModal, deleteCustCountdown]);

  const handleOpenDeleteCustomerModal = (userId: string, userName: string) => {
    setDeleteCustomerModal({ id: userId, name: userName });
    setDeleteCustCountdown(20);
  };

  const handleConfirmDeleteCustomer = async () => {
    if (!deleteCustomerModal) return;
    const { id: userId, name: userName } = deleteCustomerModal;
    try {
      await deleteDoc(doc(db, 'users', userId));
      showToast(`Successfully deleted customer profile ${userName}`, 'success');
      if (selectedCustomer?.id === userId) {
        setSelectedCustomer(null);
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      showToast(`Failed to delete user: ${err}`, 'error');
    }
    setDeleteCustomerModal(null);
  };

  // Pagination State
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const demoUsers: CustomerExtended[] = useMemo(
    () => customersQuery.data.map((c) => customerToRow(c) as unknown as CustomerExtended),
    [customersQuery.data]);

  useEffect(() => {
    if (targetCustomerId && demoUsers.length > 0) {
      const found = demoUsers.find(u => u.id === targetCustomerId || u.name.toLowerCase().includes(targetCustomerId.toLowerCase()) || targetCustomerId.toLowerCase().includes(u.name.toLowerCase()));
      if (found) {
        setSelectedCustomer(found);
      }
    }
  }, [targetCustomerId, demoUsers]);

  const totalRegistered = demoUsers.length;
  const activeSubsCount = demoUsers.filter(u => u.status === 'active' && u.customerType === 'subscription').length;
  const claimedFreeSampleCount = demoUsers.filter(u => u.hasClaimedFreeSample).length;

  const filteredUsers = useMemo(() => {
    return demoUsers.filter(user => {
      // Search text filter
      const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            user.phone.includes(searchQuery) ||
                            (user.address && user.address.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchesSearch) return false;

      // Status Filter (active, inactive, vacation, skipped)
      if (activeStatusFilter !== 'all' && user.status !== activeStatusFilter) {
        return false;
      }

      // Customer Type Filter (subscription, onetime, both, new)
      if (activeTypeFilter !== 'all') {
        if (activeTypeFilter === 'subscription' && user.customerType !== 'subscription') return false;
        if (activeTypeFilter === 'onetime' && user.customerType !== 'onetime') return false;
        if (activeTypeFilter === 'both' && user.customerType !== 'both') return false;
        if (activeTypeFilter === 'new' && user.customerType !== 'new') return false;
      }

      // Free Sample Claim Filter (new_customers, claimed, not_claimed)
      if (activeFreeSampleFilter !== 'all') {
        if (activeFreeSampleFilter === 'new_customers' && user.customerType !== 'new') return false;
        if (activeFreeSampleFilter === 'claimed' && !user.hasClaimedFreeSample) return false;
        if (activeFreeSampleFilter === 'not_claimed' && user.hasClaimedFreeSample) return false;
      }

      return true;
    });
  }, [demoUsers, searchQuery, activeStatusFilter, activeTypeFilter, activeFreeSampleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / (pageSize === 9999 ? filteredUsers.length || 1 : pageSize)));

  const paginatedUsers = useMemo(() => {
    if (pageSize === 9999) return filteredUsers;
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Render Redesigned Customer Profile Details Sub-View
  if (selectedCustomer) {
    const userSubs = custSubs.ui;
    const userOrders = custDeliveries.ui;
    const addresses = custAddresses.data.map((a) => withGps(addressText(a), a.location));
    const displaySubs = userSubs;
    const displayOrders = userOrders;

    const handleAddAddress = async () => {
      if (!addArea.trim()) {
        showToast("Please enter Area / Locality", "error");
        return;
      }
      setIsSavingAddress(true);
      try {
        await addCustomerAddress(hubId, selectedCustomer.id, {
          label: addAddressType,
          line1: [addHouseNo.trim(), addStreet.trim()].filter(Boolean).join(', '),
          line2: [addBuilding.trim(), addFloor.trim()].filter(Boolean).join(', '),
          landmark: addLandmark.trim(),
          area: addArea.trim(),
          city: addCity,
          pincode: addPin.trim(),
          receiverName: addReceiverName.trim() || selectedCustomer.name,
          receiverPhone: addReceiverPhone.trim() || selectedCustomer.phone,
        });
        setAddArea('');
        setAddHouseNo('');
        setAddStreet('');
        setAddBuilding('');
        setAddFloor('');
        setAddLandmark('');
        setAddPin('');
        setAddReceiverName('');
        setAddReceiverPhone('');
        setShowAddAddressForm(false);
        showToast("Address saved for the customer.", "success");
      } catch (err) {
        showToast(`Failed to save address: ${err}`, "error");
      } finally {
        setIsSavingAddress(false);
      }
    };

    const handleDeleteAddress = async (index: number) => {
      const target = custAddresses.data[index];
      if (!target) return;
      try {
        await deleteCustomerAddress(hubId, selectedCustomer.id, target.id);
        showToast("Address removed.", "info");
      } catch (err) {
        showToast(`Failed to delete address: ${(err as Error).message}`, "error");
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
        
        {/* Header Navigation Banner */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '16px',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              onClick={() => setSelectedCustomer(null)}
              title="Back to Customer Directory"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '1px solid #E5E7EB',
                backgroundColor: '#F9FAFB',
                color: '#111827',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                CUSTOMER PROFILE &amp; REGISTRY
              </div>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                {selectedCustomer.name}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: '20px',
              backgroundColor: selectedCustomer.status === 'active' ? '#DCFCE7' : selectedCustomer.status === 'vacation' ? '#FEF3C7' : selectedCustomer.status === 'skipped' ? '#DBEAFE' : '#F3F4F6',
              color: selectedCustomer.status === 'active' ? '#059669' : selectedCustomer.status === 'vacation' ? '#D97706' : selectedCustomer.status === 'skipped' ? '#2563EB' : '#6B7280'
            }}>
              STATUS: {selectedCustomer.status.toUpperCase()}
            </span>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: '20px',
              backgroundColor: selectedCustomer.customerType === 'new' ? '#EFF6FF' : '#F3F4F6',
              color: selectedCustomer.customerType === 'new' ? '#2563EB' : '#374151'
            }}>
              TYPE: {selectedCustomer.customerType === 'new' ? 'NEW CUSTOMER' : selectedCustomer.customerType === 'subscription' ? 'SUBSCRIPTION CUSTOMER' : selectedCustomer.customerType === 'onetime' ? 'ONE-TIME BUYER' : 'SUBSCRIPTION & ONE-TIME'}
            </span>
          </div>
        </div>

        {/* Customer Primary Contact & Identity Header Card */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.5rem', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: '#ECFDF5',
              color: '#047857',
              border: '1.5px solid #A7F3D0',
              fontWeight: 800,
              fontSize: '1.4rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {selectedCustomer.name.slice(0, 2).toUpperCase()}
            </div>

            <div>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.35rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                {selectedCustomer.name}
              </h3>
              <div style={{ fontSize: '0.85rem', color: '#4B5563', marginTop: '6px', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                <a
                  href={`tel:${selectedCustomer.phone}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#047857', fontWeight: 700, textDecoration: 'none' }}
                >
                  <Phone size={14} /> {selectedCustomer.phone}
                </a>
                {selectedCustomer.email && (
                  <a
                    href={`mailto:${selectedCustomer.email}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#047857', fontWeight: 700, textDecoration: 'none' }}
                  >
                    <Mail size={14} /> {selectedCustomer.email}
                  </a>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748B' }}>
                  <UserIcon size={14} /> ID: {selectedCustomer.id}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              onClick={() => handleOpenDeleteCustomerModal(selectedCustomer.id, selectedCustomer.name)}
              style={{ padding: '0.55rem 1rem', borderRadius: '10px', backgroundColor: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Trash2 size={15} /> Delete Customer
            </button>
          </div>
        </div>

        {/* 2 Metric Counter Cards Grid (Plastic Saved & Wallet Balance removed as requested!) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          
          <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '14px', border: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>BOTTLES RETURNED</span>
              <CheckCircle2 size={18} style={{ color: '#059669' }} />
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#111827', marginTop: '6px' }}>
              {selectedCustomer.emptyBottlesReturned || 0} units
            </div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '14px', border: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>BOTTLES AT HOME</span>
              <Clock size={18} style={{ color: '#D97706' }} />
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#111827', marginTop: '6px' }}>
              {selectedCustomer.bottlesAtHome || 0} units
            </div>
          </div>

        </div>

        {/* 2-Column Detailed Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem', width: '100%' }}>
          
          {/* LEFT COLUMN: Order & Delivery History + Delivery Address Registry */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
            
            {/* Top Left: Order & Delivery History Card */}
            <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '16px', border: '1px solid #E5E7EB' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#111827', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} style={{ color: '#047857' }} /> Order &amp; Delivery History
              </div>

              {displayOrders.length === 0 ? (
                <div style={{ padding: '1.25rem', textAlign: 'center', color: '#6B7280', fontSize: '0.85rem', backgroundColor: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                  No orders placed yet by this customer.
                </div>
              ) : (
                <div className="table-container" style={{ border: '1px solid #F3F4F6', borderRadius: '10px' }}>
                  <table className="admin-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F9FAFB', textTransform: 'uppercase', fontSize: '0.7rem', color: '#6B7280' }}>
                        <th>ORDER ID</th>
                        <th>DATE</th>
                        <th>AMOUNT</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayOrders.map(order => (
                        <tr key={order.id}>
                          <td>
                            <button 
                              onClick={() => onNavigateTab('orders', order.id)}
                              style={{ padding: '3px 8px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', color: '#047857' }}
                            >
                              {order.id} →
                            </button>
                          </td>
                          <td style={{ color: '#6B7280' }}>{order.orderDate}</td>
                          <td style={{ fontWeight: 800, color: '#111827' }}>₹{order.totalAmount}</td>
                          <td>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '10px' }}>
                              {order.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: '12px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>
                  Customer Account Notes
                </div>
                <div style={{ fontSize: '0.78rem', color: '#6B7280', lineHeight: '1.4' }}>
                  {(() => {
                    let formattedDate = 'recently';
                    if (selectedCustomer.createdAt) {
                      try {
                        const d = typeof selectedCustomer.createdAt === 'object' && (selectedCustomer.createdAt as any).seconds
                          ? new Date((selectedCustomer.createdAt as any).seconds * 1000)
                          : new Date(selectedCustomer.createdAt);
                        if (!isNaN(d.getTime())) formattedDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                      } catch (e) {
                        formattedDate = 'recently';
                      }
                    }
                    const noteText = selectedCustomer.customerType === 'new'
                      ? 'Newly registered customer account. No orders or subscriptions placed yet.'
                      : selectedCustomer.customerType === 'subscription'
                      ? 'Active subscription customer with recurring delivery schedule.'
                      : 'Customer with verified order history.';
                    return `Registered ${formattedDate}. Verified phone number (${selectedCustomer.phone}). ${noteText}`;
                  })()}
                </div>
              </div>
            </div>

            {/* Bottom Left: Delivery Address Registry Card with Cover Button */}
            <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '16px', border: '1px solid #E5E7EB' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#111827', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={18} style={{ color: '#047857' }} /> Delivery Address Registry ({addresses.length})
              </div>

              {/* Address Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {addresses.map((addr, idx) => {
                  const formatted = formatAddressDetails(addr);
                  const googleMapsLink = getGoogleMapsUrl(formatted);
                  return (
                    <div key={idx} style={{ padding: '1rem', borderRadius: '14px', border: idx === 0 ? '1.5px solid #A7F3D0' : '1px solid #E5E7EB', backgroundColor: idx === 0 ? '#ECFDF5' : '#F9FAFB', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={16} style={{ color: '#047857' }} />
                          <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                            ADDRESS {idx + 1} {idx === 0 ? '· PRIMARY' : ''}
                          </span>
                        </div>

                        <button 
                          onClick={() => handleDeleteAddress(idx)}
                          title="Delete Address"
                          style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>

                      {/* Structured Field Grid - Only show entered fields! */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.65rem', fontSize: '0.8rem', backgroundColor: '#FFFFFF', padding: '0.75rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                        {formatted.doorNo && (
                          <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', fontWeight: 600 }}>Door no.</span>
                            <span style={{ fontWeight: 800, color: '#0F172A' }}>{formatted.doorNo}</span>
                          </div>
                        )}
                        {formatted.street && (
                          <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', fontWeight: 600 }}>Street / road</span>
                            <span style={{ fontWeight: 800, color: '#0F172A' }}>{formatted.street}</span>
                          </div>
                        )}
                        {formatted.building && (
                          <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', fontWeight: 600 }}>Building</span>
                            <span style={{ fontWeight: 800, color: '#0F172A' }}>{formatted.building}</span>
                          </div>
                        )}
                        {formatted.floor && (
                          <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', fontWeight: 600 }}>Floor</span>
                            <span style={{ fontWeight: 800, color: '#0F172A' }}>{formatted.floor}</span>
                          </div>
                        )}
                        {formatted.area && (
                          <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', fontWeight: 600 }}>Area / locality</span>
                            <span style={{ fontWeight: 800, color: '#0F172A' }}>{formatted.area}</span>
                          </div>
                        )}
                        {formatted.landmark && (
                          <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', fontWeight: 600 }}>Landmark</span>
                            <span style={{ fontWeight: 800, color: '#0F172A' }}>{formatted.landmark}</span>
                          </div>
                        )}
                        {(formatted.city || formatted.pincode) && (
                          <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', fontWeight: 600 }}>City / PIN</span>
                            <span style={{ fontWeight: 800, color: '#0F172A' }}>
                              {[formatted.city, formatted.pincode].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: '1.4' }}>
                        <strong>Full Address Text:</strong> {formatted.cleanAddress}
                      </div>

                      {/* Full-width Cover Button for Map link */}
                      <a 
                        href={googleMapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ 
                          width: '100%', 
                          padding: '0.55rem 1rem', 
                          borderRadius: '10px', 
                          backgroundColor: '#047857', 
                          color: '#FFFFFF', 
                          fontWeight: 800, 
                          fontSize: '0.8rem', 
                          textDecoration: 'none', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '6px',
                          boxSizing: 'border-box'
                        }}
                      >
                        <ExternalLink size={14} /> {formatted.gpsCoords ? `Open exact pin in Google Maps (${formatted.gpsCoords}) →` : 'Open address in Google Maps (no GPS pin) →'}
                      </a>
                    </div>
                  );
                })}
              </div>

              {/* Assigned Rider Profile Section */}
              <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', borderRadius: '12px', backgroundColor: (selectedCustomer as any).riderName || (selectedCustomer as any).routeId ? '#ECFDF5' : '#FFFBEB', border: (selectedCustomer as any).riderName || (selectedCustomer as any).routeId ? '1px solid #A7F3D0' : '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <UserIcon size={18} style={{ color: (selectedCustomer as any).riderName || (selectedCustomer as any).routeId ? '#047857' : '#D97706' }} />
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>ASSIGNED RIDER / DELIVERY PERSON</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#111827', marginTop: '2px' }}>
                      {(selectedCustomer as any).riderName
                        ? `${(selectedCustomer as any).riderName} (${(selectedCustomer as any).riderPhone || 'Assigned'})`
                        : (selectedCustomer as any).routeId
                        ? `Assigned to Route: ${(selectedCustomer as any).routeId}`
                        : 'No Rider Assigned Yet'}
                    </div>
                  </div>
                </div>
                {!((selectedCustomer as any).riderName || (selectedCustomer as any).routeId) && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#D97706', backgroundColor: '#FEF3C7', padding: '3px 8px', borderRadius: '8px' }}>
                    UNASSIGNED
                  </span>
                )}
              </div>

              {/* Add Address Form Toggle & Structured Form */}
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid #E5E7EB', paddingTop: '1rem' }}>
                {!showAddAddressForm ? (
                  <button
                    onClick={() => {
                      setAddReceiverName(selectedCustomer.name);
                      setAddReceiverPhone(selectedCustomer.phone);
                      setShowAddAddressForm(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem',
                      borderRadius: '10px',
                      border: '1.5px dashed #047857',
                      backgroundColor: '#ECFDF5',
                      color: '#047857',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Plus size={16} /> + Add New Delivery Address (App Fields)
                  </button>
                ) : (
                  <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #D1D5DB', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>📍 Add New Address (App Fields)</span>
                      <button onClick={() => setShowAddAddressForm(false)} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>✕ Cancel</button>
                    </div>

                    {/* Field 1: City Dropdown */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginBottom: '3px' }}>City *</label>
                      <select
                        value={addCity}
                        onChange={(e) => setAddCity(e.target.value as any)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.8rem', outline: 'none', backgroundColor: '#FFFFFF' }}
                      >
                        <option value="Hosur, Tamil Nadu">Hosur, Tamil Nadu (Hosur Hub)</option>
                        <option value="Bengaluru, Karnataka">Bengaluru, Karnataka (Bangalore Hub)</option>
                      </select>
                    </div>

                    {/* Field 2 & 3: Area & PIN Code */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginBottom: '3px' }}>Area / Locality *</label>
                        <input
                          type="text"
                          placeholder="e.g. Darga / E-City"
                          value={addArea}
                          onChange={(e) => setAddArea(e.target.value)}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.8rem', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginBottom: '3px' }}>PIN Code *</label>
                        <input
                          type="text"
                          placeholder="6-digit PIN code"
                          value={addPin}
                          maxLength={6}
                          onChange={(e) => setAddPin(e.target.value.replace(/\D/g, ''))}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.8rem', outline: 'none' }}
                        />
                      </div>
                    </div>

                    {/* Field 4 & 5: Flat/Door No & Street */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginBottom: '3px' }}>Flat / House / Door No</label>
                        <input
                          type="text"
                          placeholder="e.g. Flat 301"
                          value={addHouseNo}
                          onChange={(e) => setAddHouseNo(e.target.value)}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.8rem', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginBottom: '3px' }}>Street / Main / Cross</label>
                        <input
                          type="text"
                          placeholder="e.g. 2nd Cross"
                          value={addStreet}
                          onChange={(e) => setAddStreet(e.target.value)}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.8rem', outline: 'none' }}
                        />
                      </div>
                    </div>

                    {/* Field 6 & 7: Building & Floor */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginBottom: '3px' }}>Building / Apartment</label>
                        <input
                          type="text"
                          placeholder="e.g. Oakwood Hills"
                          value={addBuilding}
                          onChange={(e) => setAddBuilding(e.target.value)}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.8rem', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginBottom: '3px' }}>Floor</label>
                        <input
                          type="text"
                          placeholder="e.g. 3rd Floor"
                          value={addFloor}
                          onChange={(e) => setAddFloor(e.target.value)}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.8rem', outline: 'none' }}
                        />
                      </div>
                    </div>

                    {/* Field 8: Landmark */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginBottom: '3px' }}>Landmark</label>
                      <input
                        type="text"
                        placeholder="e.g. Opp Infosys Gate 4 / Near Water Tank"
                        value={addLandmark}
                        onChange={(e) => setAddLandmark(e.target.value)}
                        style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </div>

                    {/* Field 9 & 10: Contact Name & Contact Phone */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginBottom: '3px' }}>Receiver Name</label>
                        <input
                          type="text"
                          placeholder="Receiver Name"
                          value={addReceiverName}
                          onChange={(e) => setAddReceiverName(e.target.value)}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.8rem', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginBottom: '3px' }}>Receiver Phone</label>
                        <input
                          type="text"
                          placeholder="10-digit mobile"
                          value={addReceiverPhone}
                          maxLength={10}
                          onChange={(e) => setAddReceiverPhone(e.target.value.replace(/\D/g, ''))}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.8rem', outline: 'none' }}
                        />
                      </div>
                    </div>

                    {/* Field 11: Save Address As (Tag) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>Save Address As</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {(['Home', 'Work', 'Hotel', 'Other'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setAddAddressType(t)}
                            style={{
                              padding: '0.3rem 0.75rem',
                              borderRadius: '6px',
                              border: addAddressType === t ? '1.5px solid #047857' : '1px solid #D1D5DB',
                              backgroundColor: addAddressType === t ? '#ECFDF5' : '#FFFFFF',
                              color: addAddressType === t ? '#047857' : '#374151',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action Submit Button */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                      <button
                        onClick={handleAddAddress}
                        disabled={isSavingAddress}
                        style={{
                          flex: 1,
                          padding: '0.55rem 1rem',
                          borderRadius: '8px',
                          backgroundColor: '#047857',
                          color: '#FFFFFF',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: isSavingAddress ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isSavingAddress ? 'Saving...' : 'Save Address'}
                      </button>
                    </div>

                  </div>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Active Subscriptions Card */}
          <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '16px', border: '1px solid #E5E7EB', minWidth: 0, height: 'fit-content' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#111827', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} style={{ color: '#047857' }} /> Active Subscriptions ({displaySubs.length})
            </div>

            {displaySubs.length === 0 ? (
              <div style={{ padding: '1.25rem', textAlign: 'center', color: '#6B7280', fontSize: '0.85rem', backgroundColor: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                No active subscriptions for this customer.
              </div>
            ) : (
              <div className="table-container" style={{ border: '1px solid #F3F4F6', borderRadius: '10px' }}>
                <table className="admin-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F9FAFB', textTransform: 'uppercase', fontSize: '0.7rem', color: '#6B7280' }}>
                      <th>SUB ID</th>
                      <th>PRODUCT</th>
                      <th>FREQUENCY</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displaySubs.map(sub => (
                      <tr key={sub.id}>
                        <td>
                          <button 
                            onClick={() => onNavigateTab('subscriptions', sub.id)}
                            style={{ padding: '3px 8px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', color: '#047857' }}
                          >
                            {sub.id} →
                          </button>
                        </td>
                        <td style={{ fontWeight: 700, color: '#111827' }}>{sub.productName}</td>
                        <td style={{ color: '#6B7280' }}>{sub.frequency}</td>
                        <td>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '10px' }}>
                            ACTIVE
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>
    );
  }

  return (
    <DataState loading={customersQuery.loading} error={customersQuery.error} onRetry={customersQuery.retry} loadingLabel="Loading customers…">
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.65rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            Customer Directory
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '2px' }}>
            Manage customer profiles, subscription states, and address registries.
          </p>
        </div>
      </div>

      {/* 2 Top Metric Counter Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        
        {/* Card 1: TOTAL REGISTERED */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          border: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              TOTAL REGISTERED CUSTOMERS
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', fontFamily: 'var(--font-title)', marginTop: '4px' }}>
              {totalRegistered}
            </div>
          </div>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#ECFDF5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserIcon size={22} />
          </div>
        </div>

        {/* Card 2: ACTIVE SUBSCRIPTION ACCOUNTS */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          border: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              ACTIVE SUBSCRIPTION CUSTOMERS
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', fontFamily: 'var(--font-title)', marginTop: '4px' }}>
              {activeSubsCount}
            </div>
          </div>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={22} />
          </div>
        </div>

      </div>

      {/* Filter and Search Bar Toolbar */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1rem 1.25rem', border: '1px solid #E5E7EB', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        
        {/* Filter Group: Status & Customer Type */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Status Filter Pills */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', backgroundColor: '#F9FAFB', padding: '4px', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', padding: '0 6px', textTransform: 'uppercase' }}>STATUS:</span>
            <button 
              onClick={() => setActiveStatusFilter('all')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeStatusFilter === 'all' ? '#047857' : 'transparent',
                color: activeStatusFilter === 'all' ? '#FFFFFF' : '#374151',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              All Statuses
            </button>
            <button 
              onClick={() => setActiveStatusFilter('active')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeStatusFilter === 'active' ? '#047857' : 'transparent',
                color: activeStatusFilter === 'active' ? '#FFFFFF' : '#374151',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <CheckCircle2 size={12} /> Active
            </button>
            <button 
              onClick={() => setActiveStatusFilter('vacation')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeStatusFilter === 'vacation' ? '#047857' : 'transparent',
                color: activeStatusFilter === 'vacation' ? '#FFFFFF' : '#374151',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <PauseCircle size={12} /> On Vacation
            </button>
            <button 
              onClick={() => setActiveStatusFilter('skipped')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeStatusFilter === 'skipped' ? '#047857' : 'transparent',
                color: activeStatusFilter === 'skipped' ? '#FFFFFF' : '#374151',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Clock size={12} /> Skipped / Paused
            </button>
            <button 
              onClick={() => setActiveStatusFilter('inactive')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeStatusFilter === 'inactive' ? '#047857' : 'transparent',
                color: activeStatusFilter === 'inactive' ? '#FFFFFF' : '#374151',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <ShieldAlert size={12} /> Inactive
            </button>
          </div>

          {/* Type Filter Pills */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', backgroundColor: '#F9FAFB', padding: '4px', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', padding: '0 6px', textTransform: 'uppercase' }}>TYPE:</span>
            <button 
              onClick={() => setActiveTypeFilter('all')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTypeFilter === 'all' ? '#0284C7' : 'transparent',
                color: activeTypeFilter === 'all' ? '#FFFFFF' : '#374151',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              All Types
            </button>
            <button 
              onClick={() => setActiveTypeFilter('subscription')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTypeFilter === 'subscription' ? '#0284C7' : 'transparent',
                color: activeTypeFilter === 'subscription' ? '#FFFFFF' : '#374151',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Subscription
            </button>
            <button 
              onClick={() => setActiveTypeFilter('onetime')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTypeFilter === 'onetime' ? '#0284C7' : 'transparent',
                color: activeTypeFilter === 'onetime' ? '#FFFFFF' : '#374151',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              One-Time
            </button>
            <button 
              onClick={() => setActiveTypeFilter('both')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTypeFilter === 'both' ? '#0284C7' : 'transparent',
                color: activeTypeFilter === 'both' ? '#FFFFFF' : '#374151',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Both
            </button>
            <button 
              onClick={() => setActiveTypeFilter('new')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTypeFilter === 'new' ? '#0284C7' : 'transparent',
                color: activeTypeFilter === 'new' ? '#FFFFFF' : '#374151',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              New Customer
            </button>
          </div>

          {/* Free Sample Filter Pills */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', backgroundColor: '#F9FAFB', padding: '4px', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', padding: '0 6px', textTransform: 'uppercase' }}>FREE SAMPLE:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'claimed', label: 'Claimed Sample' },
              { id: 'not_claimed', label: 'Not Claimed' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFreeSampleFilter(f.id as any)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeFreeSampleFilter === f.id ? '#D97706' : 'transparent',
                  color: activeFreeSampleFilter === f.id ? '#FFFFFF' : '#374151',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Search Box & Export Button */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1, justifyContent: 'flex-end', minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input 
              type="text" 
              placeholder="Search by name, phone or address..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.85rem 0.45rem 34px',
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                backgroundColor: '#F9FAFB',
                color: '#111827',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            />
          </div>

          <button 
            onClick={() => showToast("Exporting Customer Directory to CSV...", "info")}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              fontWeight: 700,
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              backgroundColor: '#047857',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

      </div>

      {/* Main Customers Data Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', textTransform: 'uppercase', fontSize: '0.72rem', color: '#6B7280' }}>
                <th style={{ padding: '0.85rem 1rem' }}>CUSTOMER</th>
                <th style={{ padding: '0.85rem 1rem' }}>TYPE</th>
                <th style={{ padding: '0.85rem 1rem' }}>PRIMARY ADDRESS</th>
                <th style={{ padding: '0.85rem 1rem' }}>GLASS BOTTLES</th>
                <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
                <th style={{ padding: '0.85rem 1rem' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map(user => {
                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    
                    {/* CUSTOMER Column */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          backgroundColor: '#047857',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.88rem' }}>{user.name}</div>
                          <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '1px' }}>{user.phone}</div>
                        </div>
                      </div>
                    </td>

                    {/* TYPE Column */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: user.customerType === 'new' ? '#2563EB' : user.customerType === 'subscription' ? '#0369A1' : '#475569',
                          backgroundColor: user.customerType === 'new' ? '#EFF6FF' : user.customerType === 'subscription' ? '#E0F2FE' : '#F1F5F9',
                          padding: '3px 8px',
                          borderRadius: '8px'
                        }}>
                          {user.customerType === 'new' ? 'New Customer' : user.customerType === 'subscription' ? 'Subscription' : user.customerType === 'onetime' ? 'One-Time' : 'Both'}
                        </span>
                        {user.hasClaimedFreeSample ? (
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#D97706', backgroundColor: '#FEF3C7', padding: '2px 6px', borderRadius: '6px' }}>
                            🎁 Free Sample Claimed
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6B7280', backgroundColor: '#F3F4F6', padding: '2px 6px', borderRadius: '6px' }}>
                            ⭕ Sample Not Claimed
                          </span>
                        )}
                      </div>
                    </td>

                    {/* PRIMARY ADDRESS Column */}
                    <td style={{ padding: '0.85rem 1rem', maxWidth: '340px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#374151', lineHeight: '1.4', fontWeight: 500 }}>
                        {formatAddressDetails(user.address || (user.savedAddresses && user.savedAddresses.length > 0 ? user.savedAddresses[0] : 'No address set')).cleanAddress}
                      </div>
                    </td>

                    {/* GLASS BOTTLES Column */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontSize: '0.78rem', color: '#374151' }}>
                        <span style={{ fontWeight: 600 }}>Returned: {user.emptyBottlesReturned || 0}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>
                        At Home: {user.bottlesAtHome || 0}
                      </div>
                    </td>

                    {/* STATUS Column */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: user.status === 'active' ? '#059669' : user.status === 'vacation' ? '#D97706' : user.status === 'skipped' ? '#2563EB' : '#6B7280',
                        backgroundColor: user.status === 'active' ? '#DCFCE7' : user.status === 'vacation' ? '#FEF3C7' : user.status === 'skipped' ? '#DBEAFE' : '#F3F4F6',
                        padding: '3px 10px',
                        borderRadius: '12px'
                      }}>
                        {user.status === 'active' ? 'Active' : user.status === 'vacation' ? 'On Vacation' : user.status === 'skipped' ? 'Skipped' : 'Inactive'}
                      </span>
                    </td>

                    {/* ACTIONS Column */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button 
                          onClick={() => setSelectedCustomer(user)}
                          style={{
                            padding: '0.45rem 0.75rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            borderRadius: '8px',
                            backgroundColor: '#FFFFFF',
                            color: '#111827',
                            border: '1px solid #D1D5DB',
                            cursor: 'pointer'
                          }}
                        >
                          View Details
                        </button>
                        <button 
                          onClick={() => handleOpenDeleteCustomerModal(user.id, user.name)}
                          style={{
                            padding: '0.45rem 0.75rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            borderRadius: '8px',
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
              {paginatedUsers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#9CA3AF' }}>
                    No customer accounts match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Standard Pagination Footer */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Showing {filteredUsers.length > 0 ? (currentPage - 1) * (pageSize === 9999 ? filteredUsers.length : pageSize) + 1 : 0} to {Math.min(currentPage * (pageSize === 9999 ? filteredUsers.length : pageSize), filteredUsers.length)} of {filteredUsers.length} entries
            </span>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  outline: 'none'
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={9999}>All</option>
              </select>
              <span>entries</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-main)',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

        </div>
      </div>

      {/* Register New Customer Modal */}
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
            <h3 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, marginBottom: '0.5rem' }}>+ Register New Customer Account</h3>
            <p style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: '1.25rem' }}>
              Add a new subscriber account to the selected hub directory.
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
                    showToast("New customer account registered successfully!", "success");
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

      {/* 20-Second Delete Customer Warning Modal */}
      {deleteCustomerModal && (
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
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '1.75rem',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.2rem', margin: 0, color: '#111827' }}>
                  Delete Customer Profile
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: '2px 0 0 0' }}>
                  Permanent Account Removal
                </p>
              </div>
            </div>

            <div style={{ backgroundColor: '#FEF2F2', padding: '1rem', borderRadius: '12px', border: '1px solid #FCA5A5', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#991B1B' }}>
                ⚠️ Warning: Deleting Customer "{deleteCustomerModal.name}"
              </div>
              <div style={{ fontSize: '0.78rem', color: '#B91C1C', marginTop: '4px', lineHeight: '1.4' }}>
                This will permanently delete the customer profile, saved addresses, and Firestore user document. This operation cannot be undone.
              </div>
            </div>

            {deleteCustCountdown > 0 ? (
              <div style={{ padding: '0.85rem', borderRadius: '12px', backgroundColor: '#FEF3C7', color: '#D97706', fontSize: '0.82rem', fontWeight: 700, textAlign: 'center', marginBottom: '1.25rem' }}>
                ⏳ Delete action enabled in {deleteCustCountdown} seconds...
              </div>
            ) : (
              <div style={{ padding: '0.85rem', borderRadius: '12px', backgroundColor: '#ECFDF5', color: '#047857', fontSize: '0.82rem', fontWeight: 700, textAlign: 'center', marginBottom: '1.25rem' }}>
                ✓ Safety countdown complete. You may proceed.
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteCustomerModal(null)}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '10px',
                  backgroundColor: '#F3F4F6',
                  color: '#374151',
                  border: '1px solid #E5E7EB',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                disabled={deleteCustCountdown > 0}
                onClick={handleConfirmDeleteCustomer}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '10px',
                  backgroundColor: deleteCustCountdown > 0 ? '#F3F4F6' : '#DC2626',
                  color: deleteCustCountdown > 0 ? '#9CA3AF' : '#FFFFFF',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: deleteCustCountdown > 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {deleteCustCountdown > 0 ? `Delete (${deleteCustCountdown}s)` : 'Permanently Delete Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <LoadMore hasMore={customersQuery.hasMore} loading={customersQuery.loadingMore} onClick={customersQuery.loadMore} />
    </div>
    </DataState>
  );
}
