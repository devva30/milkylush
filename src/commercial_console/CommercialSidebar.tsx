import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  FileText,
  Users,
  Milk,
  Receipt,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  LogOut,
  ArrowLeft,
  Calendar,
  Layers,
  ShoppingBag,
  Clock,
  PieChart,
  Truck,
  CreditCard,
  Send,
  UserCheck,
  Search,
  Grid
} from 'lucide-react';
import logoImg from '../assets/logo.png';

interface CommercialSidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onExitConsole: () => void;
  onLogout: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
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

export default function CommercialSidebar({
  activeTab,
  onSelectTab,
  onExitConsole,
  onLogout,
  isMobileOpen,
  onCloseMobile,
}: CommercialSidebarProps) {
  const [menuSearch, setMenuSearch] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuStructure: MenuGroup[] = [
    {
      title: 'OVERVIEW & DASHBOARD',
      items: [
        { id: 'dashboard', label: 'Commercial Dashboard', icon: TrendingUp },
      ]
    },
    {
      title: 'PRODUCTS & FINANCE',
      items: [
        { id: 'profit-loss', label: 'Profit & Loss Statement', icon: PieChart },
        { id: 'products-analytics', label: 'My Products Analytics', icon: Package },
        { id: 'expenses', label: 'Expenses & Categories', icon: CreditCard },
      ]
    },
    {
      title: 'SALES REPORTS',
      items: [
        { id: 'sales-detail', label: 'Detail Sales Report', icon: FileText },
        { id: 'sales-summary', label: 'Summary Report', icon: Layers },
        { id: 'sold-products', label: 'Sold Product Report', icon: ShoppingBag },
        { id: 'customer-ledger', label: 'Customer Account Ledger', icon: Users },
        { id: 'delivery-charge-report', label: 'Delivery Charge Report', icon: Truck },
        { id: 'leaves-report', label: 'Subscription Leaves Report', icon: Calendar },
      ]
    },
    {
      title: 'COLLECTION & FARMERS',
      items: [
        { id: 'farmers', label: 'Sellers (Farmers)', icon: Users },
        { id: 'collection-persons', label: 'Collection Person', icon: UserCheck },
        { id: 'milk-purchase', label: 'Buy Product (Milk)', icon: Milk },
        { id: 'purchase-reports', label: 'Purchase Reports', icon: Receipt },
        { id: 'rate-chart', label: 'Fat & SNF Rate Chart', icon: FileText },
        { id: 'farmer-payments', label: 'Payment Record', icon: CreditCard },
      ]
    },
    {
      title: 'COUNTER & OPERATIONS',
      items: [
        { id: 'daily-sales-load', label: 'Daily Sales Load Sheet', icon: Truck },
        { id: 'sales-requirement', label: 'Sales Requirement Demand', icon: Clock },
      ]
    },
    {
      title: 'INVOICES & BILLING',
      items: [
        { id: 'invoice-details', label: 'Tax Invoice Details', icon: FileText },
        { id: 'invoice-summary', label: 'Customer Monthly Summary', icon: Receipt },
      ]
    },
    {
      title: 'MARKETING & WHATSAPP',
      items: [
        { id: 'whatsapp-campaigns', label: 'WhatsApp Broadcasts', icon: Send },
        { id: 'whatsapp-notifications', label: 'Automated Order Alerts', icon: MessageSquare },
        { id: 'customer-cohorts', label: 'Customer Cohorts', icon: Users },
      ]
    },
    {
      title: 'PORTAL CONTROL',
      items: [
        { id: 'portal-gateway', label: 'Return to Gateway', icon: Grid },
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
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 99,
          }}
        />
      )}

      <aside
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
          fontFamily: "'Poppins', sans-serif",
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
                <div style={{ fontSize: '0.62rem', color: '#15803D', fontWeight: 800, letterSpacing: '0.06em' }}>
                  MARKETING &amp; FINANCE
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
                placeholder="Search commercial menu..."
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
            title="Return to Gateway"
          >
            <LogOut size={16} />
            {!isCollapsed && <span>Exit to Gateway</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
