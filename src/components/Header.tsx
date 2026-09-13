import { MapPin, Sun, Moon, Bell, Menu, Search, LogOut } from 'lucide-react';
import { HUBS } from '../context/HubContext';

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
  onExitConsole
}: HeaderProps) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button 
          onClick={onToggleMobileSidebar}
          className="btn-icon mobile-menu-btn"
          style={{ display: 'none', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-main)' }}
        >
          <Menu size={22} />
        </button>

        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            MILKYLUSH PORTAL • {activeHub.location.toUpperCase()}
          </div>
          <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', margin: '1px 0 0 0', lineHeight: 1.1 }}>
            {getTabTitle(activeTab)}
          </h1>
        </div>
      </div>

      {/* Center: Search Box if enabled */}
      {onSearchChange && (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '280px' }} className="header-search-box">
          <Search size={14} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search catalog, orders, customers..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem 0.45rem 34px',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              fontSize: '0.8rem',
              color: 'var(--text-main)',
              outline: 'none'
            }}
          />
        </div>
      )}

      {/* Right: Hub Pill, Gateway Button, Theme Toggle, Notifications, Profile Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        
        {onExitConsole && (
          <button
            onClick={onExitConsole}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#166534',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 14px',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(22, 101, 52, 0.25)',
              transition: 'transform 0.15s ease',
            }}
          >
            <span>Return to Portal Gateway</span>
          </button>
        )}

        {/* Branch Selector Pill */}
        <button 
          onClick={onOpenHubModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: '20px',
            padding: '6px 12px',
            color: '#047857',
            fontWeight: 700,
            fontSize: '0.78rem',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(4, 120, 87, 0.08)'
          }}
        >
          <MapPin size={14} style={{ color: '#059669' }} />
          <span>{activeHub.name} ({activeHub.code.split('-')[0]})</span>
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

        {/* Notification Badge */}
        <button 
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
            2
          </span>
        </button>

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
