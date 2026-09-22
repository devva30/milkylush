import { useState, useMemo, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, ShoppingBag, Calendar, Truck, RefreshCw, X } from 'lucide-react';
import type { Order, Subscription } from '../types';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  rawTime: number;
  type: 'order' | 'subscription' | 'delivery' | 'system';
  isRead: boolean;
  targetTab: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string, targetId?: string) => void;
  orders: Order[];
  subscriptions: Subscription[];
}

export default function NotificationCenter({
  isOpen,
  onClose,
  onNavigateTab,
  orders = [],
  subscriptions = []
}: NotificationCenterProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Generate dynamic notification items from orders and subscriptions
  const notifications = useMemo(() => {
    const list: NotificationItem[] = [];

    orders.forEach((o) => {
      const itemsText = o.items?.map(i => `${i.quantity}x ${i.product?.name || 'Milk'}`).join(', ') || 'Milk Order';
      const orderDateObj = new Date(o.orderDate || Date.now());
      const rawTime = isNaN(orderDateObj.getTime()) ? Date.now() : orderDateObj.getTime();
      const formattedTime = isNaN(orderDateObj.getTime()) ? 'Just now' : orderDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      if (o.status === 'outForDelivery') {
        list.push({
          id: `notif_out_${o.id}`,
          title: `🚚 Order #${o.id.substring(0, 8)} Out for Delivery`,
          message: `${itemsText} is currently out for doorstep drop.`,
          timestamp: formattedTime,
          rawTime,
          type: 'delivery',
          isRead: readIds.has(`notif_out_${o.id}`),
          targetTab: 'todays-deliveries',
        });
      } else if (o.status === 'delivered') {
        list.push({
          id: `notif_del_${o.id}`,
          title: `✅ Delivery Verified #${o.id.substring(0, 8)}`,
          message: `${itemsText} was verified delivered successfully.`,
          timestamp: formattedTime,
          rawTime,
          type: 'delivery',
          isRead: readIds.has(`notif_del_${o.id}`),
          targetTab: 'delivered-history',
        });
      } else {
        list.push({
          id: `notif_ord_${o.id}`,
          title: `📦 New Order Received #${o.id.substring(0, 8)}`,
          message: `${itemsText} - Total ₹${o.totalAmount}`,
          timestamp: formattedTime,
          rawTime,
          type: 'order',
          isRead: readIds.has(`notif_ord_${o.id}`),
          targetTab: 'orders',
        });
      }
    });

    subscriptions.forEach((s) => {
      const prodName = s.productName || s.product?.name || 'A2 Desi Cow Milk';
      const subDateObj = new Date(s.startDate || Date.now());
      const rawTime = isNaN(subDateObj.getTime()) ? Date.now() - 3600000 : subDateObj.getTime();
      const formattedTime = isNaN(subDateObj.getTime()) ? 'Today' : subDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      if (s.status === 'active') {
        list.push({
          id: `notif_sub_${s.id}`,
          title: `🔔 Active Subscription Drop Scheduled`,
          message: `${s.customerName || 'Customer'} - ${s.quantity || 1}x ${prodName} (${s.frequency || 'Daily'})`,
          timestamp: formattedTime,
          rawTime,
          type: 'subscription',
          isRead: readIds.has(`notif_sub_${s.id}`),
          targetTab: 'subscriptions',
        });
      }
    });

    // Add fallback static alerts if list is small
    if (list.length === 0) {
      list.push(
        {
          id: 'sys_1',
          title: '🌱 Eco Glass Bottle Reclamation Alert',
          message: '14 empty glass bottles queued for doorstep return collection today.',
          timestamp: '06:00 AM',
          rawTime: Date.now() - 10000,
          type: 'system',
          isRead: readIds.has('sys_1'),
          targetTab: 'bottle-management',
        },
        {
          id: 'sys_2',
          title: '⚡ Daily Dispatch Route Optimized',
          message: 'All Hosur & Bangalore morning delivery routes assigned to active riders.',
          timestamp: '05:45 AM',
          rawTime: Date.now() - 20000,
          type: 'system',
          isRead: readIds.has('sys_2'),
          targetTab: 'todays-deliveries',
        }
      );
    }

    // Filter out dismissed
    return list
      .filter((n) => !dismissedIds.has(n.id))
      .sort((a, b) => b.rawTime - a.rawTime);
  }, [orders, subscriptions, readIds, dismissedIds]);

  const filteredList = notifications.filter((n) => {
    if (activeFilter === 'unread') return !n.isRead;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = () => {
    const allIds = new Set(readIds);
    notifications.forEach((n) => allIds.add(n.id));
    setReadIds(allIds);
  };

  const handleItemClick = (notif: NotificationItem) => {
    setReadIds((prev) => new Set(prev).add(notif.id));
    onNavigateTab(notif.targetTab);
    onClose();
  };

  const handleDismissItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDismissedIds((prev) => new Set(prev).add(id));
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        top: '48px',
        right: '0',
        width: '380px',
        maxWidth: '92vw',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
        zIndex: 1000,
        overflow: 'hidden',
        animation: 'popoverSlideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: "'Poppins', sans-serif",
        textAlign: 'left'
      }}
    >
      <style>{`
        @keyframes popoverSlideDown {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '1rem 1.15rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-card)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#ECFDF5',
              color: '#047857',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Bell size={15} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, lineHeight: 1.1 }}>
              Notifications
            </h4>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              title="Mark all as read"
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                color: '#047857',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                borderRadius: '6px',
                padding: '3px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Check size={12} /> Mark Read
            </button>
          )}

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          padding: '0.65rem 1.15rem',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-main)'
        }}
      >
        <button
          onClick={() => setActiveFilter('all')}
          style={{
            padding: '0.3rem 0.75rem',
            borderRadius: '14px',
            border: activeFilter === 'all' ? '1px solid #047857' : '1px solid var(--border-color)',
            backgroundColor: activeFilter === 'all' ? '#047857' : 'var(--bg-card)',
            color: activeFilter === 'all' ? '#FFFFFF' : 'var(--text-main)',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          All ({notifications.length})
        </button>

        <button
          onClick={() => setActiveFilter('unread')}
          style={{
            padding: '0.3rem 0.75rem',
            borderRadius: '14px',
            border: activeFilter === 'unread' ? '1px solid #047857' : '1px solid var(--border-color)',
            backgroundColor: activeFilter === 'unread' ? '#047857' : 'var(--bg-card)',
            color: activeFilter === 'unread' ? '#FFFFFF' : 'var(--text-main)',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notification List */}
      <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
        {filteredList.length > 0 ? (
          filteredList.map((notif) => {
            const getIcon = () => {
              if (notif.type === 'order') return <ShoppingBag size={15} style={{ color: '#2563EB' }} />;
              if (notif.type === 'subscription') return <Calendar size={15} style={{ color: '#047857' }} />;
              if (notif.type === 'delivery') return <Truck size={15} style={{ color: '#D97706' }} />;
              return <RefreshCw size={15} style={{ color: '#8B5CF6' }} />;
            };

            return (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                style={{
                  padding: '0.85rem 1.15rem',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: notif.isRead ? 'var(--bg-card)' : 'var(--bg-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '10px',
                  transition: 'background-color 0.15s ease',
                  position: 'relative'
                }}
              >
                {!notif.isRead && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '4px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '5px',
                      height: '24px',
                      borderRadius: '3px',
                      backgroundColor: '#047857'
                    }}
                  />
                )}

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1 }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {getIcon()}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.25 }}>
                      {notif.title}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.35 }}>
                      {notif.message}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '4px', fontWeight: 600 }}>
                      {notif.timestamp}
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => handleDismissItem(e, notif.id)}
                  title="Dismiss notification"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '4px'
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        ) : (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Bell size={28} style={{ opacity: 0.4, marginBottom: '8px' }} />
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>No notifications found</div>
            <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>You are all caught up!</div>
          </div>
        )}
      </div>
    </div>
  );
}
