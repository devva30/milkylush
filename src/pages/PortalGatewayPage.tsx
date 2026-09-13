import { useState } from 'react';
import { LayoutDashboard, Truck, LogOut, ArrowRight, TrendingUp, MapPin } from 'lucide-react';
import logoImg from '../assets/logo.png';

interface PortalGatewayPageProps {
  selectedHubId: string;
  onSelectHub: (hubId: string) => void;
  onSelectConsole: (consoleType: 'catalog' | 'delivery' | 'commercial' | 'admin-access') => void;
  onLogout: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  ordersCount: number;
  productsCount: number;
  deliveryAgentsCount: number;
}

export default function PortalGatewayPage({
  selectedHubId,
  onSelectConsole,
  onLogout,
  showToast,
  ordersCount,
  productsCount,
  deliveryAgentsCount
}: PortalGatewayPageProps) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [btnHover, setBtnHover] = useState(false);
  const [logoutHover, setLogoutHover] = useState(false);

  const isHosur = selectedHubId === 'hub_hosur_main';
  const hubTitle = isHosur ? 'Hosur Management Portal' : 'Bangalore Management Portal';
  const hubSubtitle = isHosur ? 'Dedicated Hub Management System (Hosur Operations Only)' : 'Dedicated Hub Management System (Bangalore Operations Only)';
  const stateBadge = isHosur ? 'Tamil Nadu' : 'Karnataka';

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(135deg, #ECFDF5 0%, #F4F8F5 45%, #FFFFFF 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      fontFamily: "'Poppins', sans-serif",
      boxSizing: 'border-box',
      padding: '2.5rem 1.5rem',
      overflowX: 'hidden'
    }}>
      
      {/* Main Content Container Card - Bigger & Perfectly Aligned */}
      <div style={{
        width: '100%',
        maxWidth: '840px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box'
      }}>
        
        {/* Top Centered Logo Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '24px',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            boxShadow: '0 12px 30px rgba(4, 120, 87, 0.15)',
            border: '2px solid #A7F3D0'
          }}>
            <img src={logoImg} alt="MilkyLush Logo" style={{ width: '100%', height: '100%', borderRadius: '16px', objectFit: 'contain' }} />
          </div>
        </div>

        {/* Portal Title Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem', padding: '0 1rem' }}>
          <h1 style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 800,
            fontSize: '2.1rem',
            color: '#047857',
            letterSpacing: '-0.5px',
            margin: '0 0 6px 0',
            lineHeight: 1.25
          }}>
            MilkyLush {hubTitle}
          </h1>
          <p style={{
            fontSize: '0.95rem',
            color: '#475569',
            margin: 0,
            fontWeight: 500,
            lineHeight: 1.4
          }}>
            {hubSubtitle}
          </p>
        </div>

        {/* Dedicated Hub Control Container Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '28px',
          padding: '2.5rem 2.25rem',
          width: '100%',
          boxShadow: '0 25px 60px rgba(2, 44, 34, 0.25), 0 8px 25px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          boxSizing: 'border-box'
        }}>
          
          {/* Card Header Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.75rem',
            paddingBottom: '1.25rem',
            borderBottom: '1px solid #E2E8F0',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#059669',
                marginBottom: '4px'
              }}>
                DEDICATED HUB CONTROL
              </div>
              <h2 style={{
                fontSize: '1.6rem',
                fontWeight: 800,
                color: '#064E3B',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontFamily: "'Poppins', sans-serif"
              }}>
                {/* Green Location Pin Icon */}
                <MapPin size={24} style={{ color: '#059669' }} /> 
                <span>{isHosur ? 'HOSUR PORTAL' : 'BANGALORE PORTAL'}</span>
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '3px', fontWeight: 500 }}>
                MilkyLush {isHosur ? 'Hosur Operations Only' : 'Bangalore Operations Only'}
              </div>
            </div>

            {/* Top Right Header Controls (State Badge & Sign Out Button) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                backgroundColor: '#ECFDF5',
                color: '#047857',
                border: '1.5px solid #A7F3D0',
                padding: '7px 16px',
                borderRadius: '20px',
                fontSize: '0.82rem',
                fontWeight: 700
              }}>
                {stateBadge}
              </div>

              {/* Redesigned Sign Out Button in Header */}
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  showToast("Signed out successfully. Session ended.", "info");
                }}
                onMouseEnter={() => setLogoutHover(true)}
                onMouseLeave={() => setLogoutHover(false)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '20px',
                  border: logoutHover ? '1.5px solid #F87171' : '1.5px solid #FCA5A5',
                  backgroundColor: logoutHover ? '#FFE4E6' : '#FFF1F2',
                  color: '#991B1B',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: logoutHover ? 'translateY(-1px)' : 'none',
                  boxShadow: logoutHover ? '0 4px 12px rgba(225, 29, 72, 0.15)' : 'none',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* 3 Console Action Cards Grid - Bigger & Hover Animated */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '1.25rem',
            marginBottom: '2rem'
          }}>
            
            {/* Card 1: Catalog & Orders */}
            <div
              onClick={() => {
                onSelectConsole('catalog');
                showToast(`Opened Catalog & Orders Console for ${isHosur ? 'Hosur' : 'Bangalore'} Hub`, "success");
              }}
              onMouseEnter={() => setHoveredCard('catalog')}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                backgroundColor: hoveredCard === 'catalog' ? '#D1FAE5' : '#ECFDF5',
                border: hoveredCard === 'catalog' ? '2px solid #059669' : '1.5px solid #A7F3D0',
                borderRadius: '22px',
                padding: '1.6rem 1.25rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: hoveredCard === 'catalog' ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(1)',
                boxShadow: hoveredCard === 'catalog' ? '0 16px 35px rgba(5, 150, 105, 0.2)' : '0 4px 14px rgba(16, 185, 129, 0.06)'
              }}
            >
              <div style={{
                backgroundColor: '#047857',
                color: '#FFFFFF',
                width: '56px',
                height: '56px',
                borderRadius: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                boxShadow: '0 8px 18px rgba(4, 120, 87, 0.3)',
                transition: 'all 0.25s ease',
                transform: hoveredCard === 'catalog' ? 'scale(1.1) rotate(-3deg)' : 'none'
              }}>
                <LayoutDashboard size={28} />
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#047857', marginBottom: '6px' }}>
                Catalog &amp; Orders
              </div>
              <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>
                {ordersCount} Orders • {productsCount} Products
              </div>
            </div>

            {/* Card 2: Delivery & Dispatch */}
            <div
              onClick={() => {
                onSelectConsole('delivery');
                showToast(`Opened Delivery & Dispatch Console for ${isHosur ? 'Hosur' : 'Bangalore'} Fleet`, "success");
              }}
              onMouseEnter={() => setHoveredCard('delivery')}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                backgroundColor: hoveredCard === 'delivery' ? '#FEF3C7' : '#FFFBEB',
                border: hoveredCard === 'delivery' ? '2px solid #D97706' : '1.5px solid #FDE68A',
                borderRadius: '22px',
                padding: '1.6rem 1.25rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: hoveredCard === 'delivery' ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(1)',
                boxShadow: hoveredCard === 'delivery' ? '0 16px 35px rgba(217, 119, 6, 0.2)' : '0 4px 14px rgba(217, 119, 6, 0.06)'
              }}
            >
              <div style={{
                backgroundColor: '#D97706',
                color: '#FFFFFF',
                width: '56px',
                height: '56px',
                borderRadius: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                boxShadow: '0 8px 18px rgba(217, 119, 6, 0.3)',
                transition: 'all 0.25s ease',
                transform: hoveredCard === 'delivery' ? 'scale(1.1) rotate(3deg)' : 'none'
              }}>
                <Truck size={28} />
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#92400E', marginBottom: '6px' }}>
                Delivery &amp; Dispatch
              </div>
              <div style={{ fontSize: '0.8rem', color: '#B45309', fontWeight: 600 }}>
                {deliveryAgentsCount} Active Fleet Partners
              </div>
            </div>

            {/* Card 3: Sales, Marketing & Procurement Console */}
            <div
              onClick={() => {
                onSelectConsole('commercial');
                showToast(`Opened Sales, Marketing & Procurement Console for ${isHosur ? 'Hosur' : 'Bangalore'} Hub`, "success");
              }}
              onMouseEnter={() => setHoveredCard('commercial')}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                backgroundColor: hoveredCard === 'commercial' ? '#DCFCE7' : '#F0FDF4',
                border: hoveredCard === 'commercial' ? '2px solid #166534' : '1.5px solid #BBF7D0',
                borderRadius: '22px',
                padding: '1.6rem 1.25rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: hoveredCard === 'commercial' ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(1)',
                boxShadow: hoveredCard === 'commercial' ? '0 16px 35px rgba(22, 101, 52, 0.2)' : '0 4px 14px rgba(22, 101, 52, 0.06)'
              }}
            >
              <div style={{
                backgroundColor: '#166534',
                color: '#FFFFFF',
                width: '56px',
                height: '56px',
                borderRadius: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                boxShadow: '0 8px 18px rgba(22, 101, 52, 0.3)',
                transition: 'all 0.25s ease',
                transform: hoveredCard === 'commercial' ? 'scale(1.1) rotate(-3deg)' : 'none'
              }}>
                <TrendingUp size={28} />
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#166534', marginBottom: '6px' }}>
                Marketing &amp; Finance
              </div>
              <div style={{ fontSize: '0.8rem', color: '#15803D', fontWeight: 600 }}>
                P&amp;L • Farmers • Invoices • WhatsApp
              </div>
            </div>

          </div>

          {/* Big Dark Green Primary Action Button */}
          <button
            type="button"
            onClick={() => {
              onSelectConsole('catalog');
              showToast(`Entered ${isHosur ? 'Hosur' : 'Bangalore'} Management Console! 🚀`, "success");
            }}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            style={{
              width: '100%',
              padding: '1.1rem 2rem',
              borderRadius: '18px',
              border: 'none',
              backgroundColor: btnHover ? '#065F46' : '#047857',
              color: '#FFFFFF',
              fontSize: '1.05rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: btnHover ? '0 12px 30px rgba(4, 120, 87, 0.45)' : '0 8px 24px rgba(4, 120, 87, 0.35)',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: btnHover ? 'translateY(-2px)' : 'translateY(0)',
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            <span>Open {isHosur ? 'Hosur' : 'Bangalore'} Management Portal</span>
            <ArrowRight size={22} style={{ transition: 'transform 0.2s ease', transform: btnHover ? 'translateX(4px)' : 'none' }} />
          </button>

        </div>

      </div>
    </div>
  );
}
