import { useState, useEffect, useMemo } from 'react';
import { Gift, Search, Edit2, CheckCircle2, Truck, Package, X, Save, Power, Sparkles, Eye, Printer, User as UserIcon, MapPin } from 'lucide-react';
import type { HubId } from '../data/hubs';
import { formatDay, formatDateTime } from '../data/dates';
import { useHubProducts } from '../data/products';
import { loadHubSetting, saveHubSetting } from '../data/appContent';
import {
  useFreeSampleDeliveries, deliveryToOrder, setDeliveryStatus, reassignDelivery, setDeliveryAddressText, DB_STATUS,
} from '../data/deliveries';
import { LoadMore } from '../components/common/DataState';
import type { Order, User, Product, DeliveryAgent } from '../types';
import FulfillmentSheetView from '../components/common/FulfillmentSheetView';
import { formatAddressDetails } from '../utils/addressFormatter';

interface FreeSamplesPageProps {
  selectedHubId: string;
  /** Unused: customers come with each drop; products are loaded for the hub. */
  users?: User[];
  products?: Product[];
  deliveryAgents?: DeliveryAgent[];
  onUpdateOrderStatus?: (orderId: string, status: Order['status']) => void;
  onUpdateOrderDriver?: (orderId: string, agentId: string) => void;
  onNavigateTab?: (tab: string, targetId?: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface FreeSampleSettings {
  active: boolean;
  title: string;
  subtitle: string;
  productName: string;
  imageUrl: string;
  maxClaimsPerDevice: number;
}

export default function FreeSamplesPage({
  selectedHubId,
  deliveryAgents = [],
  onUpdateOrderStatus,
  onUpdateOrderDriver,
  onNavigateTab,
  showToast,
}: FreeSamplesPageProps) {
  const hubId = selectedHubId as HubId;
  const products = useHubProducts(hubId).data;
  // Free-sample drops (deliveries flagged isFreeSample), with live rider status
  const samplesQuery = useFreeSampleDeliveries(hubId);
  const orders: Order[] = useMemo(() => samplesQuery.data.map(deliveryToOrder), [samplesQuery.data]);
  const loading = samplesQuery.loading;
  const users: User[] = useMemo(() => {
    const m = new Map<string, User>();
    samplesQuery.data.forEach((d) => m.set(d.customerUid, {
      id: d.customerUid, name: d.customerName, phone: d.customerPhone, savedAddresses: [d.addressText], customerId: d.customerId,
    } as unknown as User));
    return Array.from(m.values());
  }, [samplesQuery.data]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'new_customer' | 'claimed' | 'not_claimed'>('all');

  // Campaign Settings State
  const [settings, setSettings] = useState<FreeSampleSettings>({
    active: true,
    title: 'Get Free Sample Today!',
    subtitle: 'Taste our farm fresh organic A2 milk delivered directly to your doorstep. 100% Free!',
    productName: 'Free Sample 500ml A2 Desi Cow Milk',
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800',
    maxClaimsPerDevice: 1,
  });
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // View Fulfillment Sheet Details Modal State
  const [selectedSampleSheet, setSelectedSampleSheet] = useState<Order | null>(null);

  // Edit Address Modal State
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editHouseNo, setEditHouseNo] = useState<string>('');
  const [editStreet, setEditStreet] = useState<string>('');
  const [editArea, setEditArea] = useState<string>('');
  const [editCity, setEditCity] = useState<string>('Hosur');
  const [editState, setEditState] = useState<string>('Tamil Nadu');
  const [editPin, setEditPin] = useState<string>('');
  const [isUpdatingAddress, setIsUpdatingAddress] = useState<boolean>(false);

  // Campaign settings of this hub: hubs/{hub}/settings/freeSample
  useEffect(() => {
    let alive = true;
    loadHubSetting<Record<string, unknown>>(hubId, 'freeSample').then((data) => {
      if (!alive) return;
      setSettings((prev) => ({
        active: (data.isActive as boolean | undefined) ?? false,
        title: (data.title as string) || prev.title,
        subtitle: (data.subtitle as string) || prev.subtitle,
        productName: (data.productName as string) || prev.productName,
        imageUrl: (data.imageUrl as string) || prev.imageUrl,
        maxClaimsPerDevice: Number(data.maxClaimsPerDevice) || 1,
      }));
      setSelectedProductId((data.productId as string) || '');
    }).catch((err) => showToast(`Could not load free sample settings: ${(err as Error).message}`, 'error'));
    return () => { alive = false; };
  }, [hubId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hub Filtering & Products Stock Filtering per Selected Hub
  const isHosur = selectedHubId === 'hosur';
  
  const hubProducts = products;
  const hubSampleOrders = orders;

  const filteredOrders = useMemo(() => {
    return hubSampleOrders.filter((o) => {
      const user = users.find((u) => u.id === o.userId);
      const matchesSearch =
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user?.phone || '').includes(searchQuery) ||
        (o.address || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;

      if (customerFilter !== 'all') {
        // every row here is a claimed sample
        const isClaimed = true;
        const isNewCustomer = !user || (user as any).customerType === 'new';
        if (customerFilter === 'new_customer' && !isNewCustomer) return false;
        if (customerFilter === 'claimed' && !isClaimed) return false;
        if (customerFilter === 'not_claimed' && isClaimed) return false;
      }

      return true;
    });
  }, [hubSampleOrders, users, searchQuery, statusFilter, customerFilter]);

  // Realtime Metrics Calculated per Selected Hub
  const totalClaims = hubSampleOrders.length;
  const packedCount = hubSampleOrders.filter((o) => o.status === 'packed').length;
  const outForDeliveryCount = hubSampleOrders.filter((o) => o.status === 'outForDelivery').length;
  const deliveredCount = hubSampleOrders.filter((o) => o.status === 'delivered').length;

  // Handle Save Campaign Settings
  const settingsPayload = (active: boolean) => ({
    isActive: active,
    productId: selectedProductId || '',
    quantity: 1,
    title: settings.title,
    subtitle: settings.subtitle,
    productName: settings.productName,
    imageUrl: settings.imageUrl,
    maxClaimsPerDevice: Number(settings.maxClaimsPerDevice) || 1,
    onlyNewCustomers: true,
  });

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await saveHubSetting([hubId], 'freeSample', settingsPayload(settings.active));
      showToast(`Free Sample Campaign Settings Saved for ${isHosur ? 'Hosur Hub' : 'Bangalore Hub'}! 🎉`, 'success');
    } catch (err) {
      showToast(`Failed to save settings: ${(err as Error).message}`, 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleToggleActive = async () => {
    const newActive = !settings.active;
    try {
      await saveHubSetting([hubId], 'freeSample', { isActive: newActive });
      setSettings((prev) => ({ ...prev, active: newActive }));
      showToast(`Campaign offer status updated to ${newActive ? 'ACTIVE' : 'OFF'} for ${isHosur ? 'Hosur Hub' : 'Bangalore Hub'}!`, 'success');
    } catch (err) {
      showToast(`Failed to update campaign status: ${(err as Error).message}`, 'error');
    }
  };

  // Handle Product Stock Selection from Dropdown
  const handleSelectProductFromStock = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setSettings((prev) => ({
        ...prev,
        productName: `${prod.name} (${prod.unit || '500ml'})`,
        imageUrl: prod.imageUrl || prev.imageUrl,
      }));
    }
  };

  // Handle Order Status Update
  const handleUpdateStatus = async (deliveryId: string, newStatus: string) => {
    const next = DB_STATUS[newStatus];
    if (!next) return;
    try {
      await setDeliveryStatus(hubId, deliveryId, next);
      showToast(`Updated sample drop ${deliveryId} to ${next.replace(/_/g, ' ')}`, 'success');
      samplesQuery.retry();
    } catch (err) {
      showToast(`Could not update status: ${err}`, 'error');
    }
  };

  // Handle Open Edit Address Modal
  const handleOpenEditAddress = (order: Order) => {
    setEditingOrder(order);
    const fullAddr = order.address || order.deliveryAddress || '';
    const parts = fullAddr.split('|')[0].replace(/\(.*?\)/g, '').split(',').map((s) => s.trim());
    if (parts.length >= 4) {
      setEditHouseNo(parts[0] || '');
      setEditStreet(parts[1] || '');
      setEditArea(parts[2] || parts[1] || '');
      setEditCity(parts[3]?.includes('Hosur') ? 'Hosur' : parts[3]?.includes('Bengaluru') || parts[3]?.includes('Bangalore') ? 'Bengaluru' : 'Hosur');
      setEditState(parts[4]?.includes('Karnataka') ? 'Karnataka' : 'Tamil Nadu');
      const pinMatch = fullAddr.match(/\b\d{6}\b/);
      setEditPin(pinMatch ? pinMatch[0] : '');
    } else {
      setEditHouseNo('');
      setEditStreet(fullAddr);
      setEditArea('');
      setEditCity(isHosur ? 'Hosur' : 'Bengaluru');
      setEditState(isHosur ? 'Tamil Nadu' : 'Karnataka');
      setEditPin('');
    }
  };

  // Save Address Changes to Firestore
  const handleSaveAddress = async () => {
    if (!editingOrder) return;
    setIsUpdatingAddress(true);
    try {
      const formattedAddress = `${editHouseNo ? editHouseNo + ', ' : ''}${editStreet ? editStreet + ', ' : ''}${editArea ? editArea + ', ' : ''}${editCity}, ${editState} - ${editPin}`;

      const drop = samplesQuery.data.find((d) => d.id === editingOrder.id);
      if (!drop) throw new Error('drop not found');
      await setDeliveryAddressText(hubId, drop, formattedAddress);
      samplesQuery.retry();

      showToast(`Address updated for order ${editingOrder.id}! 📍`, 'success');
      setEditingOrder(null);
    } catch (err) {
      showToast(`Failed to update address: ${(err as Error).message}`, 'error');
    } finally {
      setIsUpdatingAddress(false);
    }
  };

  const cleanAddressText = (rawStr: string) => {
    if (!rawStr) return 'No Address Provided';
    return formatAddressDetails(rawStr).cleanAddress;
  };

  if (selectedSampleSheet) {
    return (
      <FulfillmentSheetView
        order={selectedSampleSheet}
        users={users}
        deliveryAgents={deliveryAgents}
        selectedHubId={selectedHubId}
        onClose={() => setSelectedSampleSheet(null)}
        onUpdateOrderStatus={(orderId, status) => {
          handleUpdateStatus(orderId, status);
        }}
        onUpdateOrderDriver={async (id, agentId) => {
          const agent = deliveryAgents.find((a) => a.id === agentId);
          try {
            await reassignDelivery(hubId, id, agent ? { uid: agent.id, name: agent.name } : null);
            showToast(agent ? `Assigned ${agent.name}` : 'Rider removed', 'success');
            samplesQuery.retry();
          } catch (err) {
            showToast(`Could not reassign: ${(err as Error).message}`, 'error');
          }
          onUpdateOrderDriver?.(id, agentId);
        }}
        onNavigateTab={onNavigateTab}
        showToast={showToast}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: "'Poppins', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ backgroundColor: '#ECFDF5', padding: '8px', borderRadius: '12px', color: '#047857' }}>
              <Gift size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, lineHeight: 1.2 }}>
                Free Sample Campaign &amp; Realtime Orders
              </h1>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                Managing live campaign for <span style={{ fontWeight: 800, color: '#047857' }}>{isHosur ? 'Hosur Main Hub' : 'Bangalore Electronic City Hub'}</span> (Admin Tracking Only)
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: settings.active ? '#ECFDF5' : '#FEF2F2', padding: '0.5rem 1rem', borderRadius: '12px', border: settings.active ? '1px solid #A7F3D0' : '1px solid #FECACA' }}>
          <Power size={18} color={settings.active ? '#047857' : '#DC2626'} />
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: settings.active ? '#047857' : '#DC2626' }}>
            Offer Status: {settings.active ? 'LIVE & ACTIVE ON APP' : 'OFF / DISABLED'}
          </span>
        </div>
      </div>

      {/* Realtime Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '1.15rem', borderLeft: '4px solid #047857', borderTop: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>TOTAL CLAIMS</span>
            <Gift size={18} color="#047857" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>{totalClaims}</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '1.15rem', borderLeft: '4px solid #0284C7', borderTop: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PACKED &amp; PENDING</span>
            <Package size={18} color="#0284C7" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0284C7', marginTop: '4px' }}>{packedCount}</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '1.15rem', borderLeft: '4px solid #D97706', borderTop: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>OUT FOR DELIVERY</span>
            <Truck size={18} color="#D97706" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>{outForDeliveryCount}</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '1.15rem', borderLeft: '4px solid #059669', borderTop: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>DELIVERED SAMPLES</span>
            <CheckCircle2 size={18} color="#059669" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{deliveredCount}</div>
        </div>
      </div>

      {/* Campaign Configuration Form */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#D97706" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Campaign Configuration Settings</h3>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={isSavingSettings}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              backgroundColor: '#047857',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <Save size={14} /> {isSavingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Campaign Status</label>
            <button
              type="button"
              onClick={handleToggleActive}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: settings.active ? '#ECFDF5' : '#FEF2F2',
                color: settings.active ? '#047857' : '#DC2626',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {settings.active ? '✅ OFFER ACTIVE ON APP' : '❌ OFFER OFF ON APP'}
            </button>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Max Claims Allowed Per Device / User</label>
            <input
              type="number"
              min={1}
              max={999}
              value={settings.maxClaimsPerDevice}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setSettings({ ...settings, maxClaimsPerDevice: isNaN(val) ? 1 : Math.max(1, val) });
              }}
              placeholder="Enter number (e.g. 1, 2, 5...)"
              style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 700, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Target Free Product ({isHosur ? 'Hosur Stock' : 'Bangalore Stock'})
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => handleSelectProductFromStock(e.target.value)}
              style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 700, outline: 'none' }}
            >
              <option value="">-- Choose Hub Product Stock --</option>
              {hubProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.unit || '500ml'}) - ₹{p.price}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Free Sample Display Title</label>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
              placeholder="e.g. Get Free Sample Today!"
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Free Sample Subtitle / Description</label>
            <input
              type="text"
              value={settings.subtitle}
              onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
              placeholder="e.g. Taste our farm fresh organic A2 milk delivered directly to your doorstep. 100% Free!"
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Real-time Free Sample Orders Table */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              type="text"
              placeholder="Search sample order ID, customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.45rem 0.85rem 0.45rem 32px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.82rem', color: 'var(--text-main)', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: `All Orders (${hubSampleOrders.length})` },
              { id: 'new_customer', label: 'New Customer' },
              { id: 'claimed', label: 'Claimed Sample' },
              { id: 'not_claimed', label: 'Not Claimed' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setCustomerFilter(f.id as any)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  border: customerFilter === f.id ? '1px solid #D97706' : '1px solid var(--border-color)',
                  backgroundColor: customerFilter === f.id ? '#D97706' : 'var(--bg-main)',
                  color: customerFilter === f.id ? '#FFFFFF' : 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}

            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 4px' }}>|</span>

            {['all', 'packed', 'outForDelivery', 'delivered'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  border: statusFilter === st ? '1px solid #047857' : '1px solid var(--border-color)',
                  backgroundColor: statusFilter === st ? '#047857' : 'var(--bg-main)',
                  color: statusFilter === st ? '#FFFFFF' : 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {st === 'all' ? 'All Statuses' : st === 'outForDelivery' ? 'Out For Delivery' : st}
              </button>
            ))}
          </div>
        </div>

        <div className="table-container">
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.85rem 1rem' }}>SAMPLE ORDER ID</th>
                <th style={{ padding: '0.85rem 1rem' }}>CUSTOMER</th>
                <th style={{ padding: '0.85rem 1rem' }}>DELIVERY ADDRESS</th>
                <th style={{ padding: '0.85rem 1rem' }}>SAMPLE ITEM</th>
                <th style={{ padding: '0.85rem 1rem' }}>DATE</th>
                <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
                <th style={{ padding: '0.85rem 1rem' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Loading real-time free sample orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No free sample orders found for this hub.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const user = users.find((u) => u.id === o.userId);
                  const cleanAddr = cleanAddressText(o.address || o.deliveryAddress || '');

                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)', padding: '0.85rem 1rem' }}>
                        <span style={{ backgroundColor: '#FEF3C7', color: '#D97706', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                          🎁 {o.id.slice(11)}
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                          {user?.name || 'Customer'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {user?.phone || 'No Phone'}
                        </div>
                      </td>

                      <td style={{ fontSize: '0.8rem', color: 'var(--text-main)', maxWidth: '260px', padding: '0.85rem 1rem', lineHeight: 1.4 }}>
                        {cleanAddr}
                      </td>

                      <td style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', padding: '0.85rem 1rem' }}>
                        {o.items?.[0]?.product?.name || settings.productName} (x1)
                      </td>

                      <td style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        {o.deliveredAt ? formatDateTime(o.deliveredAt) : formatDay(o.orderDate)}
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <select
                          value={o.status === 'pending' ? 'packed' : o.status}
                          onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                          style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: '8px',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            border: '1px solid var(--border-color)',
                            backgroundColor: o.status === 'delivered' ? '#DCFCE7' : o.status === 'outForDelivery' ? '#FEF3C7' : '#EFF6FF',
                            color: o.status === 'delivered' ? '#059669' : o.status === 'outForDelivery' ? '#D97706' : '#2563EB',
                            cursor: 'pointer',
                            outline: 'none',
                          }}
                        >
                          <option value="packed">Packed</option>
                          <option value="outForDelivery">Out For Delivery</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => setSelectedSampleSheet(o)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '0.4rem 0.65rem',
                              borderRadius: '8px',
                              border: '1px solid #047857',
                              backgroundColor: '#ECFDF5',
                              color: '#047857',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Eye size={12} /> View Sheet
                          </button>
                          <button
                            onClick={() => handleOpenEditAddress(o)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '0.4rem 0.65rem',
                              borderRadius: '8px',
                              border: '1px solid #D1D5DB',
                              backgroundColor: '#FFFFFF',
                              color: '#111827',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Edit2 size={12} color="#047857" /> Edit Address
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>



      <LoadMore hasMore={samplesQuery.hasMore} loading={samplesQuery.loadingMore} onClick={samplesQuery.loadMore} />

      {/* EDIT ADDRESS MODAL */}
      {editingOrder && (
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
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '520px',
            padding: '1.5rem',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} color="#047857" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Edit Shipping Address ({editingOrder.id})
                </h3>
              </div>
              <button
                onClick={() => setEditingOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>House / Door No.</label>
                  <input
                    type="text"
                    value={editHouseNo}
                    onChange={(e) => setEditHouseNo(e.target.value)}
                    placeholder="e.g. Flat 302, Door 45"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Street / Road</label>
                  <input
                    type="text"
                    value={editStreet}
                    onChange={(e) => setEditStreet(e.target.value)}
                    placeholder="e.g. Gandhi Road"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Area / Locality</label>
                <input
                  type="text"
                  value={editArea}
                  onChange={(e) => setEditArea(e.target.value)}
                  placeholder="e.g. Darga / Electronic City"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>City</label>
                  <select
                    value={editCity}
                    onChange={(e) => {
                      const newCity = e.target.value;
                      setEditCity(newCity);
                      setEditState(newCity === 'Hosur' ? 'Tamil Nadu' : 'Karnataka');
                    }}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 700 }}
                  >
                    <option value="Hosur">Hosur</option>
                    <option value="Bengaluru">Bengaluru</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>State</label>
                  <input
                    type="text"
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>PIN Code</label>
                  <input
                    type="text"
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value)}
                    placeholder="e.g. 635109"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem' }}>
              <button
                onClick={() => setEditingOrder(null)}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-main)', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAddress}
                disabled={isUpdatingAddress}
                style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', backgroundColor: '#047857', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
              >
                {isUpdatingAddress ? 'Saving...' : 'Update Address'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
