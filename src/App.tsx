import { useState, useEffect, lazy, Suspense } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { PageLoader } from './components/common/DataState';
import { DeliveriesRangeShell } from './components/common/DeliveriesRangeShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import type { HubId } from './data/hubs';
import { useHubProducts } from './data/products';
import { useRecentActivity } from './data/activity';

import { HubContextProvider, useHubContext } from './context/HubContext';
import { useMilkyLushData } from './hooks/useMilkyLushData';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { Toast } from './components/Toast';
import { HubModal } from './components/modals/HubModal';
import { AddOrderModal } from './components/modals/AddOrderModal';

const DispatchConsoleLayout = lazy(() => import('./dispatch_console/DispatchConsoleLayout'));
const CommercialConsoleLayout = lazy(() => import('./commercial_console/CommercialConsoleLayout'));

// Dedicated Modular Pages
import LoginPage from './pages/LoginPage';
const PortalGatewayPage = lazy(() => import('./pages/PortalGatewayPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TodaysDeliveriesPage = lazy(() => import('./pages/TodaysDeliveriesPage'));
const AllDeliveriesPage = lazy(() => import('./pages/AllDeliveriesPage'));
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const SubscriptionsPage = lazy(() => import('./pages/SubscriptionsPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const ServiceAreasPage = lazy(() => import('./pages/ServiceAreasPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const DeliveryManagementPage = lazy(() => import('./pages/DeliveryManagementPage'));
const UserControlPage = lazy(() => import('./pages/UserControlPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const MobileControlPage = lazy(() => import('./pages/MobileControlPage'));
const ReferEarnPage = lazy(() => import('./pages/ReferEarnPage'));
const PromoCodesPage = lazy(() => import('./pages/PromoCodesPage'));
const FreeSamplesPage = lazy(() => import('./pages/FreeSamplesPage'));
const PrepaidSubscriptionsPage = lazy(() => import('./pages/PrepaidSubscriptionsPage'));
const ManageSubscriptionsPage = lazy(() => import('./pages/ManageSubscriptionsPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const DeliveredHistoryPage = lazy(() => import('./pages/DeliveredHistoryPage'));
const AdminAccessPage = lazy(() => import('./pages/AdminAccessPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const BottleManagementPage = lazy(() => import('./pages/BottleManagementPage'));
const QualityReportsPage = lazy(() => import('./pages/QualityReportsPage'));


function AppContent() {
  const {
    isAuthReady,
    isAdminLoggedIn,
    selectedHubId,
    setSelectedHubId,
    selectedConsole,
    setSelectedConsole,
    adminUsername,
    theme,
    toggleTheme,
    logoutAdmin,
  } = useHubContext();

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [targetCustomerId, setTargetCustomerId] = useState<string | null>(null);
  const [targetSubscriptionId, setTargetSubscriptionId] = useState<string | null>(null);
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);

  const handleNavigateTab = (tab: string, targetId?: string) => {
    if (tab === 'portal-gateway') {
      setSelectedConsole(null);
    }
    if (tab === 'customers' && targetId) {
      setTargetCustomerId(targetId);
    }
    if (tab === 'subscriptions' && targetId) {
      setTargetSubscriptionId(targetId);
    }
    if (tab === 'orders' && targetId) {
      setTargetOrderId(targetId);
    }
    setActiveTab(tab);
  };
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isHubModalOpen, setIsHubModalOpen] = useState<boolean>(false);
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Riders of the hub + the customers listener that sends the WhatsApp welcome (unchanged).
  // Every page reads its own hub data from src/data/*.
  const { hubUsers, hubDeliveryAgents } = useMilkyLushData(selectedHubId);
  // Header bell + portal counters: latest orders / subscriptions and the hub's products
  const activity = useRecentActivity(selectedHubId as HubId);
  const hubProductsCount = useHubProducts(selectedHubId as HubId).data.length;

  // 0. Waiting for Firebase to restore (or not) the previous session
  if (!isAuthReady) {
    return <PageLoader label="Checking your login…" />;
  }

  // 1. Unauthenticated Login Screen
  if (!isAdminLoggedIn) {
    return (
      <LoginPage
        onLoginSuccess={() => {
          setSelectedConsole(null);
          setActiveTab('portal-gateway');
        }}
        showToast={showToast}
        selectedHubId={selectedHubId}
        onSelectHub={setSelectedHubId}
      />
    );
  }

  // 2. Portal Gateway Landing Screen
  if (!selectedConsole || activeTab === 'portal-gateway') {
    return (
      <ErrorBoundary fallbackTitle="Portal Gateway Error">
        <Suspense fallback={<PageLoader />}>
          <PortalGatewayPage
            selectedHubId={selectedHubId}
            onSelectHub={setSelectedHubId}
            onSelectConsole={(mode) => {
              setSelectedConsole(mode === 'admin-access' ? 'catalog' : mode);
              if (mode === 'admin-access') {
                setActiveTab('admin-access');
              } else {
                setActiveTab('dashboard');
              }
            }}
            onLogout={logoutAdmin}
            showToast={showToast}
            ordersCount={activity.openOrders}
            productsCount={hubProductsCount}
            deliveryAgentsCount={hubDeliveryAgents.length}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // 3. Dedicated Delivery & Dispatch Console Layout
  if (selectedConsole === 'delivery') {
    return (
      <ErrorBoundary fallbackTitle="Dispatch Console Error">
        <Suspense fallback={<PageLoader />}>
          <DispatchConsoleLayout
            selectedHubId={selectedHubId}
            onSelectHub={setSelectedHubId}
            onExitConsole={() => setSelectedConsole(null)}
            showToast={showToast}
            hubDeliveryAgents={hubDeliveryAgents}
            hubOrders={[]}
            hubUsers={hubUsers}
            adminUsername={adminUsername || 'Tomadmin@gmail.com'}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // 4. Dedicated Commercial, Marketing & Procurement Console Layout
  if (selectedConsole === 'commercial') {
    return (
      <ErrorBoundary fallbackTitle="Commercial Console Error">
        <Suspense fallback={<PageLoader />}>
          <CommercialConsoleLayout
            selectedHubId={selectedHubId}
            onSelectHub={setSelectedHubId}
            onExitConsole={() => setSelectedConsole(null)}
            showToast={showToast}
            adminUsername={adminUsername || 'tomadmin@gmail.com'}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // 4. Main Operational Admin Layout
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}>
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => handleNavigateTab(tab)}
        onLogout={logoutAdmin}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content Viewport */}
      <div className="main-content-viewport" style={{ marginLeft: isSidebarCollapsed ? '76px' : '260px', transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>
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
          orders={activity.orders}
          subscriptions={activity.subscriptions}
          onNavigateTab={handleNavigateTab}
        />

        {!isOnline && (
          <div style={{
            backgroundColor: '#FEF2F2',
            borderBottom: '1px solid #FCA5A5',
            color: '#991B1B',
            padding: '0.65rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
            fontWeight: 700,
            fontFamily: "'Poppins', sans-serif"
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <WifiOff size={16} /> No internet connection detected. Please check your network to sync live updates.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '0.3rem 0.7rem', borderRadius: '6px',
                backgroundColor: '#DC2626', color: '#FFFFFF',
                border: 'none', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer'
              }}
            >
              <RefreshCw size={13} /> Retry Connection
            </button>
          </div>
        )}

        <main style={{ flex: 1, padding: '1.75rem', boxSizing: 'border-box' }}>
          <ErrorBoundary fallbackTitle="Portal Tab Error">
            <Suspense fallback={<PageLoader />}>
              {activeTab === 'dashboard' && (
                <DashboardPage
                  selectedHubId={selectedHubId}
                  adminUsername={adminUsername}
                  hubDeliveryAgents={hubDeliveryAgents}
                  onNavigateTab={handleNavigateTab}
                />
              )}

              {activeTab === 'todays-deliveries' && (
                <TodaysDeliveriesPage
                  selectedHubId={selectedHubId}
                  deliveryAgents={hubDeliveryAgents}
                  onOpenAddOrderModal={() => setIsAddOrderModalOpen(true)}
                  showToast={showToast}
                  onNavigateTab={handleNavigateTab}
                />
              )}

              {activeTab === 'all-deliveries' && (
                <DeliveriesRangeShell hubId={selectedHubId} deliveryAgents={hubDeliveryAgents} showToast={showToast} defaultDays={60}>
                  {(d) => (
                    <AllDeliveriesPage
                      selectedHubId={selectedHubId}
                      orders={d.orders}
                      subscriptions={[]}
                      users={d.users}
                      deliveryAgents={hubDeliveryAgents}
                      onUpdateOrderStatus={d.onUpdateOrderStatus}
                      onUpdateOrderDriver={d.onUpdateOrderDriver}
                      showToast={showToast}
                      onNavigateTab={handleNavigateTab}
                    />
                  )}
                </DeliveriesRangeShell>
              )}

              {activeTab === 'analysis' && (
                <AnalysisPage selectedHubId={selectedHubId} />
              )}

              {activeTab === 'orders' && (
                <OrdersPage
                  selectedHubId={selectedHubId}
                  deliveryAgents={hubDeliveryAgents}
                  targetOrderId={targetOrderId}
                  onOpenAddOrderModal={() => setIsAddOrderModalOpen(true)}
                  showToast={showToast}
                  onNavigateTab={handleNavigateTab}
                />
              )}

              {activeTab === 'subscriptions' && (
                <SubscriptionsPage
                  selectedHubId={selectedHubId}
                  targetSubscriptionId={targetSubscriptionId}
                  onNavigateTab={handleNavigateTab}
                  showToast={showToast}
                />
              )}

              {activeTab === 'customers' && (
                <CustomersPage
                  targetCustomerId={targetCustomerId}
                  onNavigateTab={handleNavigateTab}
                />
              )}

              {activeTab === 'service-area' && (
                <ServiceAreasPage
                  selectedHubId={selectedHubId}
                  showToast={showToast}
                />
              )}

              {activeTab === 'products' && (
                <ProductsPage
                  selectedHubId={selectedHubId}
                  showToast={showToast}
                />
              )}

              {activeTab === 'delivery' && (
                <DeliveryManagementPage
                  hubDeliveryAgents={hubDeliveryAgents}
                  selectedHubId={selectedHubId}
                />
              )}

              {activeTab === 'user-control' && (
                <UserControlPage showToast={showToast} />
              )}

              {activeTab === 'payments' && (
                <PaymentsPage
                  selectedHubId={selectedHubId}
                  showToast={showToast}
                />
              )}

              {activeTab === 'mobile-control' && (
                <MobileControlPage
                  selectedHubId={selectedHubId}
                  showToast={showToast}
                />
              )}

              {activeTab === 'refer-earn' && (
                <ReferEarnPage />
              )}

              {activeTab === 'promo-codes' && (
                <PromoCodesPage />
              )}

              {activeTab === 'free-samples' && (
                <FreeSamplesPage
                  selectedHubId={selectedHubId}
                  deliveryAgents={hubDeliveryAgents}
                  onNavigateTab={handleNavigateTab}
                  showToast={showToast}
                />
              )}

              {activeTab === 'prepaid-subscriptions' && (
                <PrepaidSubscriptionsPage showToast={showToast} />
              )}

              {activeTab === 'manage-subscriptions' && (
                <ManageSubscriptionsPage
                  selectedHubId={selectedHubId}
                  adminUsername={adminUsername}
                  showToast={showToast}
                />
              )}

              {activeTab === 'bottle-management' && (
                <BottleManagementPage
                  selectedHubId={selectedHubId}
                  adminUsername={adminUsername}
                  onNavigateTab={handleNavigateTab}
                  showToast={showToast}
                />
              )}

              {activeTab === 'audit-logs' && (
                <AuditLogsPage selectedHubId={selectedHubId} />
              )}

              {activeTab === 'delivered-history' && (
                <DeliveriesRangeShell hubId={selectedHubId} deliveryAgents={hubDeliveryAgents} showToast={showToast} defaultDays={30}>
                  {(d) => (
                    <DeliveredHistoryPage
                      orders={d.orders}
                      users={d.users}
                      deliveryAgents={hubDeliveryAgents}
                    />
                  )}
                </DeliveriesRangeShell>
              )}

              {activeTab === 'admin-access' && (
                <AdminAccessPage
                  adminUsername={adminUsername}
                  selectedHubId={selectedHubId}
                  showToast={showToast}
                />
              )}

              {activeTab === 'quality-reports' && (
                <QualityReportsPage
                  selectedHubId={selectedHubId}
                  showToast={showToast}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsPage theme={theme} onToggleTheme={toggleTheme} showToast={showToast} />
              )}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Shared Modals & Notifications */}
      <Toast toast={toast} onClose={() => setToast(null)} />
      <HubModal
        isOpen={isHubModalOpen}
        onClose={() => setIsHubModalOpen(false)}
        selectedHubId={selectedHubId}
        onSelectHub={setSelectedHubId}
      />
      <AddOrderModal
        isOpen={isAddOrderModalOpen}
        onClose={() => setIsAddOrderModalOpen(false)}
        deliveryAgents={hubDeliveryAgents}
        selectedHubId={selectedHubId}
        showToast={showToast}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="Portal System Error">
      <HubContextProvider>
        <AppContent />
      </HubContextProvider>
    </ErrorBoundary>
  );
}
