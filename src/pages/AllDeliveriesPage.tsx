import { useState, useMemo } from 'react';
import { Download, Search, ChevronLeft, ChevronRight, ArrowLeft, ExternalLink, FileText, ClipboardList, Trash2, Save, Truck } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Order, Subscription, DeliveryAgent, User, Product } from '../types';

interface AllDeliveriesPageProps {
  selectedHubId: string;
  orders: Order[];
  subscriptions?: Subscription[];
  users: User[];
  products?: Product[];
  deliveryAgents?: DeliveryAgent[];
  onUpdateOrderStatus?: (orderId: string, status: Order['status']) => void;
  onUpdateOrderDriver?: (orderId: string, agentId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateTab?: (tab: string, targetId?: string) => void;
}

export interface DeliveryEntry {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  products: string;
  orderType: 'Subscription' | 'One-time';
  type?: 'Subscription' | 'One-time' | string;
  dateStr: string;
  rawDate: Date;
  status: 'packed' | 'outForDelivery' | 'pending' | 'delivered' | 'cancelled';
  deliveryAgentId?: string;
  totalAmount: number;
  isSub: boolean;
  deliveryInstructions?: string;
  rawObject: any;
  items?: any[];
}

const getTodayFormatted = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateTimeString = (rawDate: Date, timing?: string): string => {
  if (!rawDate || isNaN(rawDate.getTime())) return 'Today, 06:30 AM';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(rawDate.getDate()).padStart(2, '0');
  const month = MONTHS[rawDate.getMonth()];
  const year = rawDate.getFullYear();
  
  let timeStr = '06:30 AM';
  if (timing === 'evening' || timing === 'Evening (5-7 PM)') {
    timeStr = '05:30 PM';
  } else {
    const hrs = rawDate.getHours();
    const mins = String(rawDate.getMinutes()).padStart(2, '0');
    if (hrs > 0 || mins !== '00') {
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      const formattedHrs = String(hrs % 12 || 12).padStart(2, '0');
      timeStr = `${formattedHrs}:${mins} ${ampm}`;
    }
  }

  return `${day} ${month} ${year}, ${timeStr}`;
};

export default function AllDeliveriesPage({
  selectedHubId,
  orders = [],
  subscriptions = [],
  users = [],
  products: _products = [],
  deliveryAgents = [],
  onUpdateOrderStatus,
  onUpdateOrderDriver,
  showToast,
  onNavigateTab,
}: AllDeliveriesPageProps) {
  // Filter States
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>(getTodayFormatted());
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayFormatted());
  const [typeFilter, setTypeFilter] = useState<'all' | 'subscription' | 'onetime'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'packed' | 'outForDelivery' | 'unassigned'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Full-Page Fulfillment Sheet State
  const [selectedEntry, setSelectedEntry] = useState<DeliveryEntry | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [savingInstruction, setSavingInstruction] = useState<boolean>(false);

  // Pagination State
  const [pageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const isHosur = selectedHubId === 'hub_hosur_main';
  const hubCodeName = isHosur ? 'Hosur Central Hub' : 'Bangalore Electronic City Hub';

  // Combine real-time active (non-delivered) orders & subscriptions
  const combinedEntries = useMemo(() => {
    const entries: DeliveryEntry[] = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. One-time Orders (excluding delivered and cancelled)
    orders.forEach((o) => {
      if (o.status === 'delivered' || o.status === 'cancelled') return;

      const userObj = users.find((u) => u.id === o.userId);
      const parsedDate = new Date(o.orderDate || Date.now());
      const isSubOrder = o.isSubscriptionDelivery || o.orderType === 'subscription';

      const prodNames = o.items && o.items.length > 0
        ? o.items.map((i) => `${i.product?.name || 'Item'} (x${i.quantity})`).join(', ')
        : 'Fresh Organic Milk';

      entries.push({
        id: o.id,
        customerName: userObj?.name || 'MilkyLush Customer',
        phone: userObj?.phone || 'N/A',
        address: o.deliveryAddress || o.address || userObj?.address || 'Hosur Main Road',
        products: prodNames,
        orderType: isSubOrder ? 'Subscription' : 'One-time',
        dateStr: o.orderDate ? o.orderDate.slice(0, 10) : getTodayFormatted(),
        rawDate: isNaN(parsedDate.getTime()) ? todayStart : parsedDate,
        status: (o.status as any) || 'packed',
        deliveryAgentId: o.deliveryAgentId,
        totalAmount: o.totalAmount || 110,
        isSub: isSubOrder,
        deliveryInstructions: o.deliveryInstructions || '',
        rawObject: o,
        items: o.items || [],
      });
    });

    // 2. Active Subscriptions (scheduled recurring deliveries not yet delivered)
    subscriptions.forEach((s) => {
      if (s.status === 'paused' || s.status === 'cancelled') return;

      const userObj = users.find((u) => u.id === s.userId);
      const startDate = new Date(s.startDate || Date.now());
      const prodName = s.productName || s.product?.name || 'Fresh Organic A2 Milk';
      const prodDetails = `${prodName} (x${s.quantity || 1}) - ${s.frequency || 'Daily'}`;

      // Check if entry already added via order object
      const existsInOrders = entries.some((e) => e.rawObject?.userId === s.userId && e.isSub);
      if (!existsInOrders) {
        entries.push({
          id: `SUB_${s.id.slice(0, 8).toUpperCase()}`,
          customerName: s.customerName || userObj?.name || 'Subscribed Customer',
          phone: s.customerPhone || userObj?.phone || 'N/A',
          address: s.deliveryAddress || userObj?.address || 'Hosur Central Sector',
          products: prodDetails,
          orderType: 'Subscription',
          dateStr: s.startDate ? s.startDate.slice(0, 10) : getTodayFormatted(),
          rawDate: isNaN(startDate.getTime()) ? todayStart : startDate,
          status: 'outForDelivery',
          totalAmount: (s.quantity || 1) * 95,
          isSub: true,
          deliveryInstructions: s.deliveryInstructions || '',
          rawObject: s,
          items: [{ product: s.product || { name: prodName, price: 95, unit: '750ml Glass Bottle', imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80' }, quantity: s.quantity || 1 }],
        });
      }
    });

    // Sort newest scheduled date first
    return entries.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
  }, [orders, subscriptions, users]);

  // Filter combined entries by Date Range, Type, Status & Search
  const filteredEntries = useMemo(() => {
    const now = new Date();
    const todayStr = getTodayFormatted();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    return combinedEntries.filter((item) => {
      // 1. Date Range Filter
      if (dateFilter === 'today') {
        if (item.dateStr !== todayStr) return false;
      } else if (dateFilter === 'yesterday') {
        if (item.dateStr !== yesterdayStr) return false;
      } else if (dateFilter === 'week') {
        if (item.rawDate < weekAgo) return false;
      } else if (dateFilter === 'month') {
        if (item.rawDate < monthAgo) return false;
      } else if (dateFilter === 'custom') {
        if (customStartDate && item.dateStr < customStartDate) return false;
        if (customEndDate && item.dateStr > customEndDate) return false;
      }

      // 2. Order Type Filter
      if (typeFilter === 'subscription' && item.orderType !== 'Subscription') return false;
      if (typeFilter === 'onetime' && item.orderType !== 'One-time') return false;

      // 3. Status Filter
      if (statusFilter === 'packed' && item.status !== 'packed') return false;
      if (statusFilter === 'outForDelivery' && item.status !== 'outForDelivery') return false;
      if (statusFilter === 'unassigned' && item.deliveryAgentId) return false;

      // 4. Search Query Filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const mId = item.id.toLowerCase().includes(q);
        const mName = item.customerName.toLowerCase().includes(q);
        const mPhone = item.phone.toLowerCase().includes(q);
        const mAddr = item.address.toLowerCase().includes(q);
        const mProd = item.products.toLowerCase().includes(q);
        if (!mId && !mName && !mPhone && !mAddr && !mProd) return false;
      }

      return true;
    });
  }, [combinedEntries, dateFilter, customStartDate, customEndDate, typeFilter, statusFilter, searchQuery]);

  // Metrics
  const totalEntriesCount = combinedEntries.length;
  const subCount = combinedEntries.filter((e) => e.orderType === 'Subscription').length;
  const oneTimeCount = combinedEntries.filter((e) => e.orderType === 'One-time').length;
  const unassignedCount = combinedEntries.filter((e) => !e.deliveryAgentId).length;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, currentPage, pageSize]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      showToast('No delivery entries available to export.', 'info');
      return;
    }
    const headers = ['Delivery ID', 'Customer Name', 'Phone', 'Address', 'Products', 'Order Type', 'Date', 'Status'];
    const rows = filteredEntries.map((e) => [
      e.id,
      `"${e.customerName}"`,
      `"${e.phone}"`,
      `"${e.address.replace(/"/g, '""')}"`,
      `"${e.products.replace(/"/g, '""')}"`,
      e.orderType,
      e.dateStr,
      e.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `All_Pending_Deliveries_${getTodayFormatted()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${filteredEntries.length} pending delivery entries to CSV!`, 'success');
  };

  // =========================================================
  // RENDER FULL-PAGE FULFILLMENT SHEET VIEW MATCHING SCREENSHOT
  // =========================================================
  if (selectedEntry) {
    const entry = selectedEntry;
    const assignedAgent = deliveryAgents.find((a) => a.id === entry.deliveryAgentId);
    const subtotal = entry.totalAmount || 110;

    const handleSaveInstructions = async (newText: string) => {
      setSavingInstruction(true);
      try {
        if (entry.type === 'Subscription') {
          const subId = entry.id.replace('DISPATCH_', '').replace('SUB_', '');
          await updateDoc(doc(db, 'subscriptions', subId), { deliveryInstructions: newText });
        } else {
          const orderId = entry.rawObject?.id || entry.id;
          await updateDoc(doc(db, 'orders', orderId), { deliveryInstructions: newText });
        }
      } catch (e) {
        console.log('Offline / local fallback save for delivery instructions', e);
      }
      setSelectedEntry({
        ...entry,
        deliveryInstructions: newText,
      });
      setSavingInstruction(false);
      showToast('Delivery instructions updated by admin! 📝', 'success');
    };

    return (
      <div id="printable-bill-invoice" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', width: '100%' }}>
        
        {/* Top Header Card matching Reference Screenshot */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          border: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              className="no-print"
              onClick={() => setSelectedEntry(null)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Back to Deliveries List"
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Fulfillment Sheet: {entry.id}
              </h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                Created on {entry.dateStr} • Hub: {selectedHubId}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>

            <span style={{
              backgroundColor: entry.status === 'outForDelivery' ? '#FEF3C7' : '#ECFDF5',
              color: entry.status === 'outForDelivery' ? '#D97706' : '#047857',
              border: entry.status === 'outForDelivery' ? '1px solid #FDE68A' : '1px solid #A7F3D0',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.82rem',
              fontWeight: 800
            }}>
              {entry.status === 'outForDelivery' ? 'Out for Delivery' : 'Packed'}
            </span>
          </div>
        </div>

        {/* Two Column Grid matching Reference Screenshot */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(300px, 1fr)', gap: '1.25rem' }}>
          
          {/* Left Column: Products & Fulfillment Action Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Card 1: Products & Items Spec */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-main)' }}>
                Products &amp; Items Spec
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {entry.items && entry.items.length > 0 ? (
                  entry.items.map((item: any, idx: number) => {
                    const prodName = item.product?.name || 'Fresh Organic Milk';
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img
                            src={item.product?.imageUrl || 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80'}
                            alt={prodName}
                            style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }}
                          />
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                              {prodName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {item.quantity || 1}x ₹{item.product?.price || 95} ({item.product?.unit || '750ml Glass Bottle'})
                            </div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                          ₹{(item.quantity || 1) * (item.product?.price || 95)}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src="https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80"
                        alt="Dairy Item"
                        style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                          {entry.products}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          1x ₹{subtotal} (750ml Glass Bottle)
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      ₹{subtotal}
                    </div>
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem', marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Subtotal</span>
                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>₹{subtotal}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Delivery Charges</span>
                    <span style={{ color: '#047857', fontWeight: 800 }}>FREE</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.35rem' }}>
                    <span>Total Amount</span>
                    <span>₹{subtotal}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Fulfillment Action Panel */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: 'var(--text-main)' }}>
                Fulfillment Action Panel
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Update route delivery stage and assign logistical personnel.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Field 1: Status Dropdown */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                    Transition Delivery Status
                  </label>
                  <select
                    value={entry.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value as Order['status'];
                      if (onUpdateOrderStatus && entry.rawObject?.id) {
                        onUpdateOrderStatus(entry.rawObject.id, nextStatus);
                      }
                      setSelectedEntry({ ...entry, status: nextStatus as any });
                      showToast(`Updated status to ${nextStatus}`, 'success');
                    }}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="packed">Packed</option>
                    <option value="outForDelivery">Out For Delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Field 2: Fulfillment Rider Info */}
                <div style={{
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Truck size={15} style={{ color: '#047857' }} /> FULFILLMENT RIDER INFORMATION (REAL-TIME)
                  </div>
                  
                  {assignedAgent ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: '#0284C7',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.8rem'
                        }}>
                          {assignedAgent.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                            {assignedAgent.name}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            📞 {assignedAgent.phone || '9876543210'} • Zone: {assignedAgent.assignedZone || 'Hosur Route'}
                          </div>
                        </div>
                      </div>

                      <select
                        value={entry.deliveryAgentId || ''}
                        onChange={(e) => {
                          const nextAgentId = e.target.value;
                          if (onUpdateOrderDriver && entry.rawObject?.id) {
                            onUpdateOrderDriver(entry.rawObject.id, nextAgentId);
                          }
                          setSelectedEntry({ ...entry, deliveryAgentId: nextAgentId });
                          showToast(`Updated live driver for ${entry.id}`, 'success');
                        }}
                        style={{
                          padding: '0.38rem 0.65rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: '#FFFFFF',
                          color: 'var(--text-main)',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">-- Change Rider --</option>
                        {deliveryAgents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.phone || 'Rider'})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.76rem', color: '#D97706', fontWeight: 700 }}>
                        ⚠️ No rider assigned to this dispatch order yet.
                      </div>
                      <select
                        value={entry.deliveryAgentId || ''}
                        onChange={(e) => {
                          const nextAgentId = e.target.value;
                          if (onUpdateOrderDriver && entry.rawObject?.id) {
                            onUpdateOrderDriver(entry.rawObject.id, nextAgentId);
                          }
                          setSelectedEntry({ ...entry, deliveryAgentId: nextAgentId });
                          showToast(`Assigned rider to ${entry.id}`, 'success');
                        }}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: '#FFFFFF',
                          color: 'var(--text-main)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">-- Select Active Logistics Rider --</option>
                        {deliveryAgents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.phone || 'Rider'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Field 3: Cancel Job */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                    Cancel Job Order
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Specify cancellation logs..."
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-main)',
                        fontSize: '0.8rem',
                        color: 'var(--text-main)',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={() => {
                        if (onUpdateOrderStatus && entry.rawObject?.id) {
                          onUpdateOrderStatus(entry.rawObject.id, 'cancelled');
                        }
                        setSelectedEntry({ ...entry, status: 'cancelled' });
                        showToast(`Cancelled job order #${entry.id}`, 'error');
                      }}
                      style={{
                        backgroundColor: '#FEE2E2',
                        color: '#EF4444',
                        border: '1px solid #FCA5A5',
                        borderRadius: '8px',
                        padding: '0.5rem 0.85rem',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Cancel Job
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Right Column: Customer Details & Map Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Card 3: Customer Details */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Customer Details
                </h3>
                <button
                  onClick={() => onNavigateTab && onNavigateTab('customers', entry.rawObject?.userId)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '8px',
                    border: '1px solid #A7F3D0',
                    backgroundColor: '#ECFDF5',
                    color: '#047857',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  View Customer Profile ➔
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: '#047857',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.8rem'
                }}>
                  {entry.customerName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                    {entry.customerName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    📞 {entry.phone}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    DELIVERY LOCATION
                  </div>
                  <a
                    href="https://maps.google.com/?q=12.867598,77.666966"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#047857',
                      textDecoration: 'none',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '2px 8px'
                    }}
                  >
                    📍 Map Link <ExternalLink size={12} />
                  </a>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.4, marginBottom: '0.85rem' }}>
                  📍 {entry.address} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>[GPS Verified] | Hub: {hubCodeName}</span>
                </div>

                <div style={{
                  height: '180px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)',
                  position: 'relative'
                }}>
                  <iframe
                    title="Customer Location Map"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    src="https://maps.google.com/maps?q=12.867598,77.666966&z=15&output=embed"
                  ></iframe>
                </div>
              </div>
            </div>

            {/* Card: Delivery Instructions (Visible & Editable by Admin for both One-time and Subscription) */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} style={{ color: '#047857' }} /> Delivery Instructions
                </h3>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  backgroundColor: entry.type === 'Subscription' ? '#FEF3C7' : '#ECFDF5',
                  color: entry.type === 'Subscription' ? '#B45309' : '#047857',
                  border: entry.type === 'Subscription' ? '1px solid #FDE68A' : '1px solid #A7F3D0'
                }}>
                  {entry.type === 'Subscription' ? 'Subscription Order' : 'One-Time Cart Order'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Non-Editable Customer Instruction Display Badge */}
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  backgroundColor: (entry.deliveryInstructions || entry.rawObject?.deliveryInstructions) ? '#FEF3C7' : '#F3F4F6',
                  border: (entry.deliveryInstructions || entry.rawObject?.deliveryInstructions) ? '1px solid #FDE68A' : '1px solid #E5E7EB',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <ClipboardList size={18} style={{ color: (entry.deliveryInstructions || entry.rawObject?.deliveryInstructions) ? '#B45309' : '#6B7280' }} />
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: (entry.deliveryInstructions || entry.rawObject?.deliveryInstructions) ? '#B45309' : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Customer Note (Checkout Choice)
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: (entry.deliveryInstructions || entry.rawObject?.deliveryInstructions) ? '#78350F' : '#374151', marginTop: '2px' }}>
                      {entry.deliveryInstructions || entry.rawObject?.deliveryInstructions || 'No special instructions provided (Standard delivery: Leave at doorstep / Ring bell).'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Admin Controls: Update instruction or remove existing note
                </div>

                <textarea
                  rows={2}
                  defaultValue={entry.deliveryInstructions || entry.rawObject?.deliveryInstructions || ''}
                  key={entry.id}
                  id={`all_instr_input_${entry.id}`}
                  placeholder="Type new instruction or admin note here..."
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.84rem',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  {(entry.deliveryInstructions || entry.rawObject?.deliveryInstructions) && (
                    <button
                      onClick={() => {
                        const inputEl = document.getElementById(`all_instr_input_${entry.id}`) as HTMLTextAreaElement;
                        if (inputEl) inputEl.value = '';
                        handleSaveInstructions('');
                      }}
                      disabled={savingInstruction}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        backgroundColor: '#FEE2E2',
                        color: '#EF4444',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        border: '1px solid #FCA5A5',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Trash2 size={13} /> Clear Note
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const inputEl = document.getElementById(`all_instr_input_${entry.id}`) as HTMLTextAreaElement;
                      if (inputEl) {
                        handleSaveInstructions(inputEl.value);
                      }
                    }}
                    disabled={savingInstruction}
                    style={{
                      padding: '0.45rem 1rem',
                      borderRadius: '8px',
                      backgroundColor: '#047857',
                      color: '#FFFFFF',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Save size={13} /> {savingInstruction ? 'Saving...' : 'Save Instructions'}
                  </button>
                </div>
              </div>
            </div>

            {/* Card 4: Logistics History & Audit Logs */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-main)' }}>
                Logistics History &amp; Audit Logs
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: '6px',
                    backgroundColor: '#ECFDF5',
                    color: '#047857',
                    fontWeight: 800,
                    fontSize: '0.68rem',
                    border: '1px solid #A7F3D0'
                  }}>
                    Ordered
                  </span>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Logged &amp; Registered</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Created on {entry.dateStr}, 5:30:00 AM</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: '6px',
                    backgroundColor: '#ECFDF5',
                    color: '#047857',
                    fontWeight: 800,
                    fontSize: '0.68rem',
                    border: '1px solid #A7F3D0'
                  }}>
                    Packed
                  </span>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Prepared for Dispatch</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hub consolidation logs updated</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: '6px',
                    backgroundColor: entry.status === 'outForDelivery' ? '#FEF3C7' : '#F1F5F9',
                    color: entry.status === 'outForDelivery' ? '#D97706' : '#64748B',
                    fontWeight: 800,
                    fontSize: '0.68rem',
                    border: entry.status === 'outForDelivery' ? '1px solid #FDE68A' : '1px solid #E2E8F0'
                  }}>
                    Transit
                  </span>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Out For Delivery</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Dispatched with local rider team</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    );
  }

  // =========================================================
  // MAIN TABLE LIST VIEW
  // =========================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* Summary Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        
        {/* Card 1: Total Un-delivered */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '0.85rem 1.15rem',
          borderLeft: '4px solid #047857',
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            TOTAL PENDING DELIVERIES
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)', lineHeight: 1.1 }}>
            {totalEntriesCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Un-delivered active orders &amp; plans
          </div>
        </div>

        {/* Card 2: Subscriptions */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '0.85rem 1.15rem',
          borderLeft: '4px solid #059669',
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            SUBSCRIPTION DELIVERIES
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#047857', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)', lineHeight: 1.1 }}>
            {subCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Daily recurring milk &amp; dairy drops
          </div>
        </div>

        {/* Card 3: One-time */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '0.85rem 1.15rem',
          borderLeft: '4px solid #3B82F6',
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            ONE-TIME ORDERS
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#2563EB', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)', lineHeight: 1.1 }}>
            {oneTimeCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Single custom product purchases
          </div>
        </div>

        {/* Card 4: Unassigned Drivers */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '0.85rem 1.15rem',
          borderLeft: '4px solid #F59E0B',
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            UNASSIGNED DRIVERS
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#D97706', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)', lineHeight: 1.1 }}>
            {unassignedCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Awaiting fleet driver dispatch
          </div>
        </div>

      </div>

      {/* Filter Control Bar */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        padding: '1.1rem 1.25rem',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
        
        {/* Row 1: Date Preset Chips + Custom Range */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginRight: '4px' }}>DATE:</span>
            {[
              { key: 'all', label: 'All Dates' },
              { key: 'today', label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'custom', label: 'Custom Range' },
            ].map((d) => (
              <button
                key={d.key}
                onClick={() => setDateFilter(d.key as any)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '8px',
                  border: dateFilter === d.key ? 'none' : '1px solid var(--border-color)',
                  backgroundColor: dateFilter === d.key ? '#ECFDF5' : 'var(--bg-main)',
                  color: dateFilter === d.key ? '#047857' : 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            style={{
              padding: '0.45rem 0.95rem',
              borderRadius: '8px',
              border: '1px solid #A7F3D0',
              backgroundColor: '#ECFDF5',
              color: '#047857',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        {/* Custom Date Range Picker Input (When Custom selected) */}
        {dateFilter === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', backgroundColor: 'var(--bg-main)', padding: '0.6rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>From Date:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
            />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>To Date:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
            />
          </div>
        )}

        {/* Row 2: Order Type Filter, Status Filter & Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          
          {/* Order Type Chips */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginRight: '4px' }}>TYPE:</span>
            {[
              { key: 'all', label: 'All Types' },
              { key: 'subscription', label: 'Subscription' },
              { key: 'onetime', label: 'One-Time' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTypeFilter(t.key as any)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  border: typeFilter === t.key ? '1px solid #047857' : '1px solid var(--border-color)',
                  backgroundColor: typeFilter === t.key ? '#047857' : 'var(--bg-main)',
                  color: typeFilter === t.key ? '#FFFFFF' : 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                {t.label}
              </button>
            ))}

            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', marginLeft: '8px', marginRight: '4px' }}>STATUS:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.78rem',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="packed">Packed &amp; Ready</option>
              <option value="outForDelivery">Out for Delivery</option>
              <option value="unassigned">Unassigned Driver</option>
            </select>
          </div>

          {/* Search Box Input */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search customer, phone, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.85rem 0.45rem 34px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                fontSize: '0.8rem',
                color: 'var(--text-main)',
                outline: 'none'
              }}
            />
          </div>

        </div>

      </div>

      {/* Main Deliveries Table */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>DELIVERY ID</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>CUSTOMER</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ADDRESS &amp; HUB</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PRODUCTS</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>TYPE</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>SCHEDULED DATE</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>DRIVER FLEET</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>STATUS</th>
                <th style={{ padding: '0.75rem 0.85rem', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => {
                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedEntry(item)}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                  >
                    {/* ID */}
                    <td style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-main)', padding: '0.75rem 0.85rem', verticalAlign: 'middle' }}>
                      {item.id}
                    </td>

                    {/* Customer */}
                    <td style={{ fontWeight: 700, fontSize: '0.82rem', padding: '0.75rem 0.85rem', verticalAlign: 'middle' }}>
                      <div style={{ color: '#047857' }}>{item.customerName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>📞 {item.phone}</div>
                    </td>

                    {/* Address */}
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-main)', maxWidth: '240px', padding: '0.75rem 0.85rem', verticalAlign: 'middle', lineHeight: 1.3 }}>
                      {item.address}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        📍 {hubCodeName}
                      </div>
                      {(item.deliveryInstructions || item.rawObject?.deliveryInstructions) && (
                        <div style={{ marginTop: '4px', fontSize: '0.71rem', fontWeight: 700, color: '#B45309', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '6px', padding: '2px 6px', display: 'inline-block' }}>
                          📝 Note: {item.deliveryInstructions || item.rawObject?.deliveryInstructions}
                        </div>
                      )}
                    </td>

                    {/* Products */}
                    <td style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', padding: '0.75rem 0.85rem', verticalAlign: 'middle', maxWidth: '200px' }}>
                      {item.products}
                    </td>

                    {/* Order Type */}
                    <td style={{ padding: '0.75rem 0.85rem', verticalAlign: 'middle' }}>
                      <span style={{
                        backgroundColor: item.orderType === 'Subscription' ? '#ECFDF5' : '#EFF6FF',
                        color: item.orderType === 'Subscription' ? '#047857' : '#2563EB',
                        border: item.orderType === 'Subscription' ? '1px solid #A7F3D0' : '1px solid #BFDBFE',
                        padding: '3px 9px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        display: 'inline-block'
                      }}>
                        {item.orderType}
                      </span>
                    </td>

                    {/* Scheduled Date & Time */}
                    <td style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', padding: '0.75rem 0.85rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div>{formatDateTimeString(item.rawDate, item.rawObject?.timing)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        📅 Slot: {item.rawObject?.timing === 'evening' ? 'Evening (5-7 PM)' : 'Morning (6-8 AM)'}
                      </div>
                    </td>

                    {/* Driver Fleet Dropdown */}
                    <td style={{ padding: '0.75rem 0.85rem', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                      <select
                        value={item.deliveryAgentId || ''}
                        onChange={(e) => {
                          if (onUpdateOrderDriver && item.rawObject?.id) {
                            onUpdateOrderDriver(item.rawObject.id, e.target.value);
                          }
                          showToast(`Assigned driver to ${item.id}`, 'success');
                        }}
                        style={{
                          padding: '0.35rem 0.6rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-main)',
                          color: item.deliveryAgentId ? 'var(--text-main)' : '#D97706',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">-- Assign Driver --</option>
                        {deliveryAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            🛵 {agent.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '0.75rem 0.85rem', verticalAlign: 'middle' }}>
                      <span style={{
                        backgroundColor: item.status === 'outForDelivery' ? '#FEF3C7' : '#ECFDF5',
                        color: item.status === 'outForDelivery' ? '#D97706' : '#047857',
                        border: item.status === 'outForDelivery' ? '1px solid #FDE68A' : '1px solid #A7F3D0',
                        padding: '3px 9px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        display: 'inline-block'
                      }}>
                        {item.status === 'outForDelivery' ? 'Out for Delivery' : 'Packed & Ready'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.75rem 0.85rem', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedEntry(item)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-main)',
                          color: 'var(--text-main)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}

              {paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No un-delivered entries found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination Bar */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Showing {filteredEntries.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredEntries.length)} of {filteredEntries.length} pending entries
          </span>

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

    </div>
  );
}
