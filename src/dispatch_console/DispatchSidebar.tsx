import { useState } from 'react';
import { 
  LayoutDashboard, 
  Truck, 
  Zap, 
  Users, 
  UserCheck,
  MapPin, 
  UserPlus, 
  Wine, 
  Archive, 
  History, 
  Settings, 
  LogOut, 
  Search, 
  Grid,
  Calendar,
  Layers,
  PhoneCall
} from 'lucide-react';
import logoImg from '../assets/logo.png';

interface DispatchSidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onExitConsole: () => void;
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

export default function DispatchSidebar({
  activeTab,
  onSelectTab,
  onExitConsole,
  isMobileOpen = false,
  onCloseMobile
}: DispatchSidebarProps) {
  const [menuSearch, setMenuSearch] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuStructure: MenuGroup[] = [
    {
      title: 'OVERVIEW & DISPATCH',
      items: [
        { id: 'dispatch-dashboard', label: 'Dashboard Overview', icon: LayoutDashboard },
        { id: 'todays-deliveries', label: "Today's Deliveries", icon: Truck },
        { id: 'dispatch-board', label: 'Active Dispatch Board', icon: Zap },
      ]
    },
    {
      title: 'LOGISTICS & FLEET',
      items: [
        { id: 'delivery-partners', label: 'Delivery Partners', icon: Users },
        { id: 'customer-assignments', label: 'Customer Rider Mapping', icon: UserCheck },
        { id: 'route-grouping', label: 'Route Grouping & Sequence', icon: Layers },
        { id: 'rider-attendance', label: 'Rider Attendance', icon: Calendar },
        { id: 'live-tracking', label: 'Live Rider Tracking', icon: MapPin },
        { id: 'register-partner', label: 'Register Partner', icon: UserPlus },
      ]
    },
    {
      title: 'RECORDS & RECLAMATION',
      items: [
        { id: 'bottle-reclamation', label: 'Bottle Reclamation Log', icon: Wine },
        { id: 'deliveries-archive', label: 'Deliveries Archive', icon: Archive },
        { id: 'delivery-history', label: 'Delivery History', icon: History },
      ]
    },
    {
      title: 'SYSTEM & CONTROLS',
      items: [
        { id: 'system-controls', label: 'System Controls', icon: Settings },
        { id: 'hub-contacts', label: 'Hub Contacts & Help Settings', icon: PhoneCall },
        { id: 'portal-gateway', label: 'Exit to Gateway', icon: Grid },
      ]
    }
  ];

  const handleNavClick = (tabId: string) => {
    if (tabId === 'portal-gateway') {
      onExitConsole();
    } else {
      onSelectTab(tabId);
    }
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarWidth = isCollapsed ? '76px' : '260px';

  return (
    <>
      {isMobileOpen && (
        <div 
          className="sidebar-mobile-backdrop" 
          onClick={onCloseMobile} 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99
          }}
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
                <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '1.05rem', color: '#044E35', lineHeight: 1.1 }}>
                  MilkyLush
                </div>
                <div style={{ fontSize: '0.62rem', color: '#D97706', fontWeight: 800, letterSpacing: '0.06em' }}>
                  DISPATCH CONSOLE
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Menu Search Box */}
        {!isCollapsed && (
          <div style={{ padding: '0.85rem 1.25rem 0.4rem 1.25rem' }}>
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: '#9CA3AF' }} />
              <input
                type="text"
                placeholder="Filter dispatch menu..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem 0.45rem 30px',
                  borderRadius: '8px',
                  border: '1px solid #F1F5F9',
                  backgroundColor: '#F8FAFC',
                  fontSize: '0.78rem',
                  color: '#334155',
                  outline: 'none',
                  fontFamily: "'Poppins', sans-serif"
                }}
              />
            </div>
          </div>
        )}

        {/* Navigation Groups */}
        <div style={{ flex: 1, padding: isCollapsed ? '0.5rem' : '0.5rem 0.85rem', display: 'flex', flexDirection: 'column', gap: isCollapsed ? '0.5rem' : '1.1rem' }}>
          {menuStructure.map((group, groupIdx) => {
            const filteredItems = group.items.filter(item => 
              item.label.toLowerCase().includes(menuSearch.toLowerCase())
            );

            if (menuSearch && filteredItems.length === 0) return null;

            return (
              <div key={groupIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {!isCollapsed && (
                  <div style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    color: '#94A3B8',
                    letterSpacing: '0.06em',
                    padding: '0.4rem 0.65rem 0.2rem 0.65rem',
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
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'left',
                        fontFamily: "'Poppins', sans-serif"
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <IconComp size={17} style={{ color: isActive ? '#047857' : '#94A3B8', transition: 'color 0.2s ease' }} />
                        {!isCollapsed && <span style={{ color: isActive ? '#047857' : '#475569', fontWeight: isActive ? 700 : 500 }}>{item.label}</span>}
                      </div>

                      {!isCollapsed && item.badge && (
                        <span style={{
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          backgroundColor: isActive ? '#047857' : '#FEF3C7',
                          color: isActive ? '#FFFFFF' : '#B45309',
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

        {/* Bottom Footer: Collapse & Sign Out */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid #F1F5F9',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          backgroundColor: '#FAFAFA'
        }}>
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
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#64748B',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>{isCollapsed ? '➔' : '❮'}</span>
            {!isCollapsed && <span>Collapse Menu</span>}
          </button>

          <button
            onClick={onExitConsole}
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
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="Sign Out"
          >
            <LogOut size={16} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>

      </aside>
    </>
  );
}
