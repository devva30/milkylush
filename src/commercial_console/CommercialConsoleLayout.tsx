import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from '../types';
import CommercialSidebar from './CommercialSidebar';
import Header from '../components/Header';
import { Toast } from '../components/Toast';
import { HubModal } from '../components/modals/HubModal';
import { useHubContext } from '../context/HubContext';

import CommercialDashboardPage from './pages/CommercialDashboardPage';
import ProfitLossPage from './pages/ProfitLossPage';
import SalesReportsPage from './pages/SalesReportsPage';
import FarmerProcurementPage from './pages/FarmerProcurementPage';
import CounterSalesPage from './pages/CounterSalesPage';
import InvoicesBillingPage from './pages/InvoicesBillingPage';
import WhatsAppMarketingPage from './pages/WhatsAppMarketingPage';

interface CommercialConsoleLayoutProps {
  selectedHubId: string;
  onSelectHub: (hubId: string) => void;
  onExitConsole: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  adminUsername: string;
}

export default function CommercialConsoleLayout({
  selectedHubId,
  onSelectHub,
  onExitConsole,
  showToast,
  adminUsername,
}: CommercialConsoleLayoutProps) {
  const { theme, toggleTheme, logoutAdmin } = useHubContext();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isHubModalOpen, setIsHubModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Each commercial page loads its own hub data. WhatsApp Marketing (unchanged) still
  // takes a customer list: this hub's customers, read once when that tab is opened.
  const isWhatsApp = activeTab === 'whatsapp-campaigns' || activeTab === 'whatsapp-notifications' || activeTab === 'customer-cohorts';
  const [hubUsers, setHubUsers] = useState<User[]>([]);
  const [usersLoadedFor, setUsersLoadedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!isWhatsApp || usersLoadedFor === selectedHubId) return;
    let alive = true;
    getDocs(query(collection(db, 'users'), where('hubId', '==', selectedHubId))).then((snap) => {
      if (!alive) return;
      setHubUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as User));
      setUsersLoadedFor(selectedHubId);
    }).catch((err) => showToast(`Could not load customers: ${(err as Error).message}`, 'error'));
    return () => { alive = false; };
  }, [isWhatsApp, selectedHubId, usersLoadedFor]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main, #FDFBF7)', color: 'var(--text-main, #1E293B)' }}>
      {/* Commercial Sidebar */}
      <CommercialSidebar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onExitConsole={onExitConsole}
        onLogout={logoutAdmin}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="main-content-viewport">
        <Header
          activeTab={activeTab}
          selectedHubId={selectedHubId}
          onOpenHubModal={() => setIsHubModalOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          adminUsername={adminUsername}
          onLogout={logoutAdmin}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onExitConsole={onExitConsole}
        />

        <main style={{ flex: 1, padding: '1.75rem', boxSizing: 'border-box' }}>
          {activeTab === 'dashboard' && (
            <CommercialDashboardPage
              selectedHubId={selectedHubId}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {(activeTab === 'profit-loss' || activeTab === 'products-analytics' || activeTab === 'expenses') && (
            <ProfitLossPage
              selectedHubId={selectedHubId}
              viewMode={activeTab as 'profit-loss' | 'products-analytics' | 'expenses'}
            />
          )}

          {(activeTab === 'sales-detail' ||
            activeTab === 'sales-summary' ||
            activeTab === 'sold-products' ||
            activeTab === 'customer-ledger' ||
            activeTab === 'delivery-charge-report' ||
            activeTab === 'leaves-report') && (
            <SalesReportsPage
              selectedTab={activeTab as any}
            />
          )}

          {(activeTab === 'farmers' ||
            activeTab === 'collection-persons' ||
            activeTab === 'milk-purchase' ||
            activeTab === 'purchase-reports' ||
            activeTab === 'rate-chart' ||
            activeTab === 'farmer-payments') && (
            <FarmerProcurementPage
              selectedTab={activeTab as any}
              selectedHubId={selectedHubId}
              showToast={showToast}
            />
          )}

          {(activeTab === 'counter-sales' || activeTab === 'daily-sales-load' || activeTab === 'sales-requirement') && (
            <CounterSalesPage
              selectedTab={activeTab as any}
              selectedHubId={selectedHubId}
            />
          )}

          {(activeTab === 'invoice-details' || activeTab === 'invoice-summary') && (
            <InvoicesBillingPage
              selectedTab={activeTab as any}
            />
          )}

          {(activeTab === 'whatsapp-campaigns' || activeTab === 'whatsapp-notifications' || activeTab === 'customer-cohorts') && (
            <WhatsAppMarketingPage
              selectedTab={activeTab as any}
              users={hubUsers}
            />
          )}
        </main>
      </div>

      <HubModal
        isOpen={isHubModalOpen}
        onClose={() => setIsHubModalOpen(false)}
        selectedHubId={selectedHubId}
        onSelectHub={onSelectHub}
      />
    </div>
  );
}
