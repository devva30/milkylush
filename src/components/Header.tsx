import { useState } from 'react';
import { MapPin, Sun, Moon, Bell, Menu, Search, LogOut } from 'lucide-react';
import { HUBS } from '../context/HubContext';
import NotificationCenter from './NotificationCenter';
import type { Order, Subscription } from '../types';

interface HeaderProps {
  activeTab: string;
  selectedHubId: string;
  onOpenHubModal: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onToggleMobileSidebar: () => void;
  adminUsername: string;
  onLogout: () => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  onExitConsole?: () => void;
  orders?: Order[];
  subscriptions?: Subscription[];
  onNavigateTab?: (tab: string, targetId?: string) => void;
}

export default function Header({
  activeTab,
  selectedHubId,
  onOpenHubModal,
  theme,
  onToggleTheme,
  onToggleMobileSidebar,
  adminUsername,
  onLogout,
  searchQuery = '',
  onSearchChange,
  onExitConsole,
  orders = [],
  subscriptions = [],
  onNavigateTab
}: HeaderProps) {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const activeHub = HUBS[selectedHubId] || HUBS.hub_bangalore_main;

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Dashboard Overview';
      case 'todays-deliveries': return "Today's Deliveries Schedule";
      case 'all-deliveries': return 'All Deliveries Log';
      case 'analysis': return 'Analysis & Insights';
      case 'orders': return 'Orders Management';
      case 'subscriptions': return 'Subscriptions & Recurring Delivery';
      case 'customers': return 'Customers Directory & Dues';
      case 'service-area': return 'Service Areas & GPS Config';
      case 'products': return 'Products & Catalog Inventory';
      case 'delivery': return 'Delivery Fleet & Drivers';
      case 'user-control': return 'User Access Control';
      case 'payments': return 'Payments Ledger & Wallet';
      case 'mobile-control': return 'Mobile App Control & Banners';
      case 'refer-earn': return 'Refer & Earn Rewards';
      case 'prepaid-subscriptions': return 'Prepaid Subscription Plans';
      case 'audit-logs': return 'Audit Logs & Admin Actions';
      case 'delivered-history': return 'Delivered Proof History';
      case 'admin-access': return 'Admin Access & Roles';
      case 'settings': return 'System Settings';
      case 'portal-gateway': return 'Hub Portal Gateway';
      case 'dispatch-dashboard': return 'Delivery & Dispatch Overview';
      case 'dispatch-board': return 'Active Dispatch Board';
      case 'delivery-partners': return 'Delivery Partners Fleet';
      case 'register-partner': return 'Register Delivery Partner';
      case 'partner-detail': return 'Delivery Partner Profile & Details';
      case 'live-tracking': return 'Live Fleet GPS Tracking';
      case 'bottle-reclamation': return 'Bottle Reclamation & Logs';
      case 'deliveries-archive': return 'Deliveries History & Archive';
      case 'delivery-history': return 'Delivery Partner Logs';
      case 'customer-assignments': return 'Customer Rider Auto-Assignment & Shift Manager';
      case 'system-controls': return 'Dispatch System Controls';
      default: return 'MilkyLush Admin Console';
    }
  };

  return (
    <header className="header-container" style={{
      height: '72px',
      backgroundColor: 'var(--bg-card)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.5rem',
      position: 'sticky',
      top: 0,
      zIndex: 90
    }}>
      {/* Left: Mobile Menu Trigger & Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <button 
          onClick={onToggleMobileSidebar}
          className="btn-icon mobile-menu-btn"
          style={{ display: 'none', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-main)', padding: '4px' }}
        >
          <Menu size={22} />
        </button>

        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            MILKYLUSH PORTAL • {activeHub.name.toUpperCase()}
          </div>
          <h1 className="header-page-title" style={{ fontFamily: "'Poppins', sans-serif", fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: '1px 0 0 0', lineHeight: 1.1 }}>
            {getTabTitle(activeTab)}
          </h1>
        </div>
      </div>

      {/* Center: Search Box if enabled */}
      {onSearchChange && (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '260px' }} className="header-search-box">
          <Search size={14} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search catalog, orders, customers..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.42rem 0.75rem 0.42rem 34px',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              fontSize: '0.78rem',
              color: 'var(--text-main)',
              outline: 'none'
            }}
          />
        </div>
      )}

      {/* Right: Theme Toggle, Notifications, Admin Profile Pill & Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>

        {/* Theme Toggle Button */}
        <button 
          onClick={onToggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            color: 'var(--text-main)',
            cursor: 'pointer'
          }}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? <Moon size={16} style={{ color: '#6366F1' }} /> : <Sun size={16} style={{ color: '#F59E0B' }} />}
        </button>

        {/* Notification Bell & Popover Container */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
            style={{
              position: 'relative',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
            title="Open Notifications"
          >
            <Bell size={16} />
            <span style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              fontSize: '0.6rem',
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: '10px',
              border: '2px solid var(--bg-card)'
            }}>
              {Math.max(1, orders.filter(o => o.status === 'packed' || o.status === 'outForDelivery').length)}
            </span>
          </button>

          <NotificationCenter
            isOpen={isNotificationOpen}
            onClose={() => setIsNotificationOpen(false)}
            onNavigateTab={(tab, targetId) => {
              if (onNavigateTab) onNavigateTab(tab, targetId);
              setIsNotificationOpen(false);
            }}
            orders={orders}
            subscriptions={subscriptions}
          />
        </div>

        {/* Admin Profile Chip */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingLeft: '0.5rem',
          borderLeft: '1px solid var(--border-color)'
        }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: '#047857',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.8rem'
          }}>
            {adminUsername.substring(0, 2).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>
              {adminUsername}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Administrator
            </span>
          </div>
        </div>

        {/* Sign Out Button (Matching Screenshots) */}
        <button
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>

      </div>
    </header>
  );
}
