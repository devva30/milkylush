import React, { useState } from 'react';
import CommercialSidebar from './CommercialSidebar';
import Header from '../components/Header';
import { Toast } from '../components/Toast';
import { HubModal } from '../components/modals/HubModal';
import { useMilkyLushData } from '../hooks/useMilkyLushData';
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

  // Stream data using custom hook
  const {
    products,
    hubOrders,
    hubUsers,
    hubSubscriptions,
    hubFarmers,
    hubMilkProcurements,
    totalRevenue,
  } = useMilkyLushData(selectedHubId);

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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: '260px' }}>
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
              orders={hubOrders}
              users={hubUsers}
              products={products}
              totalRevenue={totalRevenue}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {(activeTab === 'profit-loss' || activeTab === 'products-analytics' || activeTab === 'expenses') && (
            <ProfitLossPage
              selectedHubId={selectedHubId}
              orders={hubOrders}
              totalRevenue={totalRevenue}
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
              orders={hubOrders}
              users={hubUsers}
              products={products}
              subscriptions={hubSubscriptions}
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
              farmers={hubFarmers}
              milkProcurements={hubMilkProcurements}
              showToast={showToast}
            />
          )}

          {(activeTab === 'counter-sales' || activeTab === 'daily-sales-load' || activeTab === 'sales-requirement') && (
            <CounterSalesPage
              selectedTab={activeTab as any}
              products={products}
              selectedHubId={selectedHubId}
            />
          )}

          {(activeTab === 'invoice-details' || activeTab === 'invoice-summary') && (
            <InvoicesBillingPage
              selectedTab={activeTab as any}
              orders={hubOrders}
              users={hubUsers}
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
