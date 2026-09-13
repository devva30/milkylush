import { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  ShoppingBag, 
  Truck, 
  Search, 
  LogOut, 
  Calendar, 
  BarChart2, 
  ShieldCheck, 
  FileText,
  CreditCard,
  Smartphone,
  Gift,
  Clock,
  Lock,
  Settings,
  Grid,
  Wine
} from 'lucide-react';
import logoImg from '../assets/logo.png';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabName: string) => void;
  onLogout: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface MenuGroup {
  title: string;
  items: {
    id: string;
    label: string;
    icon: any;
    badge?: string;
  }[];
}

export default function Sidebar({
  activeTab,
  onSelectTab,
  onLogout,
  isMobileOpen = false,
  onCloseMobile
}: SidebarProps) {
  const [menuSearch, setMenuSearch] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuStructure: MenuGroup[] = [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'analysis', label: 'Analytics & Reports', icon: BarChart2 }
      ]
    },
    {
      title: 'OPERATIONS & FULFILLMENT',
      items: [
        { id: 'todays-deliveries', label: "Today's Deliveries", icon: Truck },
        { id: 'all-deliveries', label: 'All Deliveries', icon: Truck },
        { id: 'orders', label: 'Orders', icon: ShoppingBag },
        { id: 'delivered-history', label: 'Delivered History', icon: Truck }
      ]
    },
    {
      title: 'MANAGE SUBSCRIPTIONS',
      items: [
        { id: 'subscriptions', label: 'Subscriptions', icon: Calendar },
        { id: 'prepaid-subscriptions', label: 'Prepaid Subscriptions', icon: Calendar },
        { id: 'manage-subscriptions', label: 'Subscription Analytics & Packages', icon: Settings }
      ]
    },
    {
      title: 'CATALOG & FLEET',
      items: [
        { id: 'products', label: 'Products & Stock', icon: ShoppingBag },
        { id: 'bottle-management', label: 'Bottle Management', icon: Wine },
        { id: 'delivery', label: 'Delivery Fleet', icon: Truck },
        { id: 'service-area', label: 'Service Areas', icon: FileText }
      ]
    },
    {
      title: 'CUSTOMERS & ACCOUNTS',
      items: [
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'user-control', label: 'User Control', icon: ShieldCheck },
        { id: 'admin-access', label: 'Admin Access', icon: Lock }
      ]
    },
    {
      title: 'MARKETING & SETTINGS',
      items: [
        { id: 'payments', label: 'Payments Ledger', icon: CreditCard },
        { id: 'mobile-control', label: 'Mobile Control', icon: Smartphone },
        { id: 'refer-earn', label: 'Refer & Earn', icon: Gift },
        { id: 'audit-logs', label: 'Audit Logs', icon: Clock },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'portal-gateway', label: 'Portal Gateway', icon: Grid }
      ]
    }
  ];

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarWidth = isCollapsed ? '76px' : '260px';

  return (
    <>
      {isMobileOpen && (
        <div 
          className="sidebar-mobile-backdrop" 
          onClick={onCloseMobile} 
        />
      )}
      <aside 
        className={`sidebar-container ${isMobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: sidebarWidth,
          height: '100vh',
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #F1F5F9',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 100,
          boxSizing: 'border-box',
          overflowY: 'auto',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          fontFamily: "'Poppins', sans-serif"
        }}
      >
        {/* Brand Header */}
        <div style={{
          padding: isCollapsed ? '1rem 0.5rem' : '1.25rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          borderBottom: '1px solid #F1F5F9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src={logoImg} alt="MilkyLush Logo" style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'contain' }} />
            {!isCollapsed && (
              <div>
                <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '1.1rem', color: '#044E35', lineHeight: 1.1 }}>
                  MilkyLush
                </div>
                <div style={{ fontSize: '0.65rem', color: '#059669', fontWeight: 600, letterSpacing: '0.05em' }}>
                  DAIRY ADMIN
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Menu Search Box */}
        {!isCollapsed && (
          <div style={{ padding: '0.85rem 1.25rem 0.5rem 1.25rem' }}>
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: '#9CA3AF' }} />
              <input
                type="text"
                placeholder="Filter menu..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem 0.45rem 30px',
                  borderRadius: '8px',
                  border: '1px solid #F1F5F9',
                  backgroundColor: '#F8FAFC',
                  fontSize: '0.8rem',
                  color: '#334155',
                  outline: 'none',
                  fontFamily: "'Poppins', sans-serif"
                }}
              />
            </div>
          </div>
        )}

        {/* Navigation Groups */}
        <div style={{ flex: 1, padding: isCollapsed ? '0.5rem' : '0.5rem 0.85rem', display: 'flex', flexDirection: 'column', gap: isCollapsed ? '0.5rem' : '1.25rem' }}>
          {menuStructure.map((group, groupIdx) => {
            const filteredItems = group.items.filter(item => 
              item.label.toLowerCase().includes(menuSearch.toLowerCase())
            );

            if (menuSearch && filteredItems.length === 0) return null;

            return (
              <div key={groupIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {!isCollapsed && (
                  <div style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#94A3B8',
                    letterSpacing: '0.06em',
                    padding: '0.45rem 0.65rem 0.2rem 0.65rem',
                    textTransform: 'uppercase',
                    fontFamily: "'Poppins', sans-serif"
                  }}>
                    {group.title}
                  </div>
                )}

                {filteredItems.map(item => {
                  const IconComp = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`nav-link ${isActive ? 'active' : ''}`}
                      title={isCollapsed ? item.label : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'space-between',
                        width: '100%',
                        padding: isCollapsed ? '0.65rem 0' : '0.55rem 0.75rem',
                        borderRadius: '10px',
                        border: isActive ? '1px solid #A7F3D0' : '1px solid transparent',
                        backgroundColor: isActive ? '#ECFDF5' : 'transparent',
                        color: isActive ? '#047857' : '#475569',
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                        textAlign: 'left',
                        fontFamily: "'Poppins', sans-serif"
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <IconComp size={18} style={{ color: isActive ? '#047857' : '#94A3B8', transition: 'color 0.2s ease' }} />
                        {!isCollapsed && <span style={{ color: isActive ? '#047857' : '#475569', fontWeight: isActive ? 700 : 500 }}>{item.label}</span>}
                      </div>

                      {!isCollapsed && item.badge && (
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          backgroundColor: isActive ? '#047857' : '#ECFDF5',
                          color: isActive ? '#FFFFFF' : '#047857',
                          padding: '2px 6px',
                          borderRadius: '6px'
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Bottom Footer: Collapse Toggle & Logout */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          backgroundColor: 'var(--bg-card)'
        }}>
          {/* Bottom Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: '8px',
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>{isCollapsed ? '➔' : '❮'}</span>
            {!isCollapsed && <span>Collapse Sidebar</span>}
          </button>

          <button
            onClick={onLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: '8px',
              width: '100%',
              padding: '0.55rem 0.75rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#EF4444',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="Log Out"
          >
            <LogOut size={16} />
            {!isCollapsed && <span>Log Out</span>}
          </button>
        </div>

      </aside>
    </>
  );
}
