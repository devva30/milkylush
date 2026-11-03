import { useState } from 'react';
import { MapPin, Sun, Moon, Bell, Menu, Search, LogOut, RefreshCw } from 'lucide-react';
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
  const activeHub = HUBS[selectedHubId] || HUBS.hosur;

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Dashboard';
      case 'todays-deliveries': return "Today's Deliveries";
      case 'all-deliveries': return 'All Deliveries';
      case 'analysis': return 'Analytics & Reports';
      case 'orders': return 'Orders';
      case 'subscriptions': return 'Subscriptions';
      case 'customers': return 'Customers';
      case 'service-area': return 'Service Areas & Map';
      case 'products': return 'Products & Stock';
      case 'delivery': return 'Delivery Fleet';
      case 'user-control': return 'User Control';
      case 'payments': return 'Payments';
      case 'mobile-control': return 'Mobile App Control';
      case 'refer-earn': return 'Refer & Earn';
      case 'prepaid-subscriptions': return 'Prepaid Plans';
      case 'audit-logs': return 'Activity Log';
      case 'delivered-history': return 'Delivered History';
      case 'admin-access': return 'Admin Access';
      case 'settings': return 'System Settings';
      case 'portal-gateway': return 'Hub Portal Gateway';
      case 'dispatch-dashboard': return 'Dashboard';
      case 'dispatch-board': return 'Live Dispatch Board';
      case 'delivery-partners': return 'Delivery Partners';
      case 'register-partner': return 'Add a Rider';
      case 'partner-detail': return 'Rider Profile';
      case 'live-tracking': return 'Live Rider Map';
      case 'bottle-reclamation': return 'Bottle Returns';
      case 'deliveries-archive': return 'Deliveries Archive';
      case 'delivery-history': return 'Delivery History';
      case 'customer-assignments': return 'Customer-Rider Mapping';
      case 'system-controls': return 'System Controls';
      case 'promo-codes': return 'Promo Codes';
      case 'free-samples': return 'Free Samples';
      case 'manage-subscriptions': return 'Plan Packages & Analytics';
      case 'bottle-management': return 'Bottles';
      case 'quality-reports': return 'Quality & Lab Reports';
      case 'rider-attendance': return 'Rider Attendance';
      case 'route-grouping': return 'Routes & Sequence';
      case 'delivery-photos': return 'Delivery Photos';
      case 'hub-contacts': return 'Hub Contacts & Help';
      case 'whatsapp-campaigns': return 'WhatsApp Broadcasts';
      case 'whatsapp-notifications': return 'Automatic Messages';
      case 'customer-cohorts': return 'Customer Groups';
      case 'sales-detail': return 'Sales Report';
      case 'sales-summary': return 'Summary Report';
      case 'sold-products': return 'Products Sold';
      case 'customer-ledger': return 'Customer Ledger';
      case 'delivery-charge-report': return 'Delivery Charges';
      case 'leaves-report': return 'Subscription Leaves';
      case 'profit-loss': return 'Profit & Loss';
      case 'products-analytics': return 'Product Analytics';
      case 'expenses': return 'Expenses';
      case 'farmers': return 'Farmers (Sellers)';
      case 'collection-persons': return 'Collection Persons';
      case 'milk-purchase': return 'Buy Milk';
      case 'purchase-reports': return 'Purchase Reports';
      case 'rate-chart': return 'Fat & SNF Rate Chart';
      case 'farmer-payments': return 'Farmer Payments';
      case 'daily-sales-load': return 'Daily Load Sheet';
      case 'sales-requirement': return 'Sales Requirement';
      case 'invoice-details': return 'Tax Invoices';
      case 'invoice-summary': return 'Monthly Customer Summary';
      default: return 'MilkyLush';
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

        <h1 className="header-page-title" style={{ fontFamily: "var(--font-body)", fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', margin: 0, lineHeight: 1.2 }}>
          {getTabTitle(activeTab)}
        </h1>
        <button
          type="button"
          onClick={onOpenHubModal}
          title="Switch hub"
          className="header-hub-pill"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-color)', background: 'var(--nav-active-bg)', color: 'var(--primary)', borderRadius: '999px', padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <MapPin size={14} />
          {activeHub.name}
        </button>
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

        {/* Refresh Portal Data Button */}
        <button 
          onClick={() => window.location.reload()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            color: '#047857',
            cursor: 'pointer'
          }}
          title="Refresh Portal Data"
        >
          <RefreshCw size={16} />
        </button>

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
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: '10px',
              border: '2px solid var(--bg-card)'
            }}>
              {orders.filter(o => o.status === 'pending' || o.status === 'packed' || o.status === 'outForDelivery').length}
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
            fontWeight: 700,
            fontSize: '0.8rem'
          }}>
            {adminUsername.substring(0, 2).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.1 }}>
              {adminUsername}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Administrator
            </span>
          </div>
        </div>

        <button
          onClick={onLogout}
          title="Sign out"
          aria-label="Sign out"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '36px', height: '36px', color: 'var(--danger)', cursor: 'pointer' }}
        >
          <LogOut size={16} />
        </button>

      </div>
    </header>
  );
}
