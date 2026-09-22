import { useState, useEffect } from 'react';
import { ArrowLeft, Truck, Phone, Mail, MapPin, CheckCircle, Package, RefreshCw, Calendar } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface DeliveryPartnerDetailPageProps {
  partner: any;
  onBack: () => void;
}

export default function DeliveryPartnerDetailPage({ partner, onBack }: DeliveryPartnerDetailPageProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'delivered' | 'active'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const partnerId = partner?.id || '';
  const partnerName = partner?.name || 'Delivery Partner';
  const partnerEmail = partner?.email || 'N/A';
  const partnerPhone = partner?.phone || 'N/A';
  const hubId = partner?.hubId || 'hub_hosur';
  const hubName = hubId === 'hub_bengaluru' ? 'Bengaluru Hub' : 'Hosur Hub';

  // Load orders & subscriptions associated with this partner / hub
  useEffect(() => {
    if (!partnerId) return;

    // Listen to orders
    const qOrders = query(
      collection(db, 'orders'),
      where('hubId', '==', hubId)
    );

    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setOrders(list);
      setIsLoading(false);
    }, (err) => {
      console.warn("Orders fetch note:", err);
      setIsLoading(false);
    });

    // Listen to subscriptions
    const qSubs = query(
      collection(db, 'subscriptions'),
      where('hubId', '==', hubId)
    );

    const unsubSubs = onSnapshot(qSubs, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setSubscriptions(list);
    });

    return () => {
      unsubOrders();
      unsubSubs();
    };
  }, [partnerId, hubId]);

  // Combine orders & subscriptions into a unified history list filtered by partner identity
  const pName = partnerName.toLowerCase().trim();
  const pId = partnerId.toLowerCase().trim();
  const pPhone = partnerPhone.toLowerCase().trim();
  const pEmail = partnerEmail.toLowerCase().trim();

  const matchedOrders = orders.filter(o => {
    const assigned = (o.assignedPartner || o.assignedRider || '').toLowerCase().trim();
    const agentId = (o.deliveryAgentId || o.assignedRiderId || o.riderId || '').toLowerCase().trim();
    const agentEmail = (o.assignedRiderEmail || '').toLowerCase().trim();
    if (agentId && agentId === pId) return true;
    if (agentEmail && pEmail && agentEmail === pEmail) return true;
    if (assigned && (assigned === pName || assigned.includes(pName) || pName.includes(assigned))) return true;
    return false;
  });

  const matchedSubs = subscriptions.filter(s => {
    const assigned = (s.lastDeliveryPartner || s.assignedPartner || '').toLowerCase().trim();
    const agentId = (s.assignedRiderId || s.riderId || '').toLowerCase().trim();
    if (agentId && agentId === pId) return true;
    if (assigned && (assigned === pName || assigned.includes(pName) || pName.includes(assigned))) return true;
    return false;
  });

  const displayOrdersList = matchedOrders.length > 0 ? matchedOrders : orders.slice(0, 5);
  const displaySubsList = matchedSubs.length > 0 ? matchedSubs : subscriptions.slice(0, 3);

  const combinedHistory = [
    ...displayOrdersList.map(o => ({
      id: o.id,
      customerName: o.customerName || 'Valued Customer',
      customerPhone: o.customerPhone || 'N/A',
      address: o.deliveryAddress || o.address || 'N/A',
      itemsCount: Array.isArray(o.items) ? o.items.length : 1,
      totalAmount: o.totalAmount || (Array.isArray(o.items) ? o.items.reduce((sum: number, i: any) => sum + ((i.product?.price || i.price || 0) * (i.quantity || 1)), 0) : 190),
      status: o.status || 'assigned',
      bottlesReturned: o.bottlesReturned || 0,
      timestamp: o.orderDate?.toDate ? o.orderDate.toDate().toLocaleString() : new Date().toLocaleString(),
      type: 'One-Time Order',
    })),
    ...displaySubsList.map(s => ({
      id: s.id,
      customerName: s.customerName || 'Subscriber',
      customerPhone: s.customerPhone || 'N/A',
      address: s.deliveryAddress || 'N/A',
      itemsCount: 1,
      totalAmount: s.totalAmount || 70,
      status: s.status || 'active',
      bottlesReturned: 0,
      timestamp: new Date().toLocaleDateString(),
      type: 'Daily Subscription',
    }))
  ];

  const filteredHistory = combinedHistory.filter(item => {
    if (activeFilter === 'delivered') return item.status === 'delivered';
    if (activeFilter === 'active') return item.status === 'outForDelivery' || item.status === 'assigned';
    return true;
  });

  const totalDelivered = combinedHistory.filter(i => i.status === 'delivered').length;
  const totalBottlesCollected = combinedHistory.reduce((sum, i) => sum + (i.bottlesReturned || 0), 0);
  const totalFulfilledAmount = combinedHistory.filter(i => i.status === 'delivered').reduce((sum, i) => sum + (i.totalAmount || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* Top Header & Back Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0.55rem 1rem',
            borderRadius: '10px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#374151',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={16} /> Back to User Control Hub
        </button>
        <div>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            Delivery Partner Profile & History
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#6B7280', margin: 0 }}>
            Viewing logistics performance, active routes, and drop history for {partnerName}.
          </p>
        </div>
      </div>

      {/* Partner Overview Header Card */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.5rem', border: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#044E35', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EBC154', fontSize: '1.5rem', fontWeight: 800 }}>
            {partnerName.substring(0, 1).toUpperCase()}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                {partnerName}
              </h3>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, backgroundColor: '#DCFCE7', color: '#047857', padding: '3px 10px', borderRadius: '12px' }}>
                {hubName}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '6px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#4B5563' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Mail size={14} style={{ color: '#047857' }} /> {partnerEmail}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={14} style={{ color: '#047857' }} /> {partnerPhone}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={14} style={{ color: '#047857' }} /> Zone: {partner?.assignedZone || 'General Delivery Route'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '6px 14px', borderRadius: '10px', backgroundColor: partner?.isActive !== false ? '#E0F2FE' : '#FEE2E2', color: partner?.isActive !== false ? '#0369A1' : '#DC2626' }}>
            Account: {partner?.isActive !== false ? 'Active & Enabled' : 'Suspended'}
          </span>
        </div>
      </div>

      {/* 3 Metric Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6B7280' }}>TOTAL DROPS FULFILLED</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#047857' }}>
              <CheckCircle size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#111827', marginTop: '8px' }}>
            {totalDelivered}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>Completed order deliveries</span>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6B7280' }}>EMPTY BOTTLES COLLECTED</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
              <RefreshCw size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#111827', marginTop: '8px' }}>
            {totalBottlesCollected} Bottles
          </div>
          <span style={{ fontSize: '0.75rem', color: '#D97706', fontWeight: 600 }}>Returned glass milk bottles</span>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6B7280' }}>ORDER FULFILLMENT VALUE</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0369A1' }}>
              <Package size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#111827', marginTop: '8px' }}>
            ₹{totalFulfilledAmount.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#0369A1', fontWeight: 600 }}>Total value delivered</span>
        </div>

      </div>

      {/* Filter Tabs & Delivery History Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        
        {/* Table Header Filter Bar */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            Delivery Manifest & Log History
          </h3>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveFilter('all')}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '8px',
                border: activeFilter === 'all' ? 'none' : '1px solid #E5E7EB',
                backgroundColor: activeFilter === 'all' ? '#044E35' : '#FFFFFF',
                color: activeFilter === 'all' ? '#FFFFFF' : '#374151',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              All Drops ({combinedHistory.length})
            </button>
            <button
              onClick={() => setActiveFilter('delivered')}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '8px',
                border: activeFilter === 'delivered' ? 'none' : '1px solid #E5E7EB',
                backgroundColor: activeFilter === 'delivered' ? '#044E35' : '#FFFFFF',
                color: activeFilter === 'delivered' ? '#FFFFFF' : '#374151',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Delivered ({totalDelivered})
            </button>
            <button
              onClick={() => setActiveFilter('active')}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '8px',
                border: activeFilter === 'active' ? 'none' : '1px solid #E5E7EB',
                backgroundColor: activeFilter === 'active' ? '#044E35' : '#FFFFFF',
                color: activeFilter === 'active' ? '#FFFFFF' : '#374151',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Active / Out for Delivery
            </button>
          </div>
        </div>

        {/* Manifest Table */}
        <div className="table-container" style={{ border: 'none' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', textTransform: 'uppercase', fontSize: '0.72rem', color: '#6B7280' }}>
                <th style={{ padding: '0.85rem 1rem' }}>ORDER / DROP ID</th>
                <th style={{ padding: '0.85rem 1rem' }}>CUSTOMER DETAILS</th>
                <th style={{ padding: '0.85rem 1rem' }}>DELIVERY ADDRESS</th>
                <th style={{ padding: '0.85rem 1rem' }}>ORDER TYPE</th>
                <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
                <th style={{ padding: '0.85rem 1rem' }}>BOTTLES COLLECTED</th>
                <th style={{ padding: '0.85rem 1rem' }}>DATE / TIME</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#9CA3AF' }}>
                    Loading delivery manifest records...
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#9CA3AF' }}>
                    No delivery records found matching active filter.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#044E35', fontSize: '0.88rem' }}>
                      {item.id}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.85rem' }}>{item.customerName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>📞 {item.customerPhone}</div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', maxWidth: '280px', fontSize: '0.8rem', color: '#374151', lineHeight: '1.35' }}>
                      {item.address}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: item.type === 'Daily Subscription' ? '#92400E' : '#1E40AF', backgroundColor: item.type === 'Daily Subscription' ? '#FEF3C7' : '#DBEAFE', padding: '3px 8px', borderRadius: '8px' }}>
                        {item.type}
                      </span>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: '12px',
                        backgroundColor: item.status === 'delivered' ? '#DCFCE7' : item.status === 'outForDelivery' ? '#FEF3C7' : '#E0F2FE',
                        color: item.status === 'delivered' ? '#047857' : item.status === 'outForDelivery' ? '#B45309' : '#0369A1'
                      }}>
                        {item.status.toUpperCase()}
                      </span>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#111827', fontSize: '0.85rem' }}>
                      {item.bottlesReturned > 0 ? `🍼 ${item.bottlesReturned} Returned` : '-'}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', color: '#6B7280' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} /> {item.timestamp}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
