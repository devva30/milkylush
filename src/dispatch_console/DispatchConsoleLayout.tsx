import { useState } from 'react';
import { useHubContext } from '../context/HubContext';
import Header from '../components/Header';
import { HubModal } from '../components/modals/HubModal';

import DispatchSidebar from './DispatchSidebar';
import DispatchDashboardPage from './pages/DispatchDashboardPage';
import DispatchTodaysDeliveriesPage from './pages/DispatchTodaysDeliveriesPage';
import DispatchActiveBoardPage from './pages/DispatchActiveBoardPage';
import DispatchDeliveryPartnersPage from './pages/DispatchDeliveryPartnersPage';
import DispatchCustomerAssignmentPage from './pages/DispatchCustomerAssignmentPage';
import DispatchRouteGroupingPage from './pages/DispatchRouteGroupingPage';
import DispatchRegisterPartnerPage from './pages/DispatchRegisterPartnerPage';
import DispatchPartnerDetailPage from './pages/DispatchPartnerDetailPage';
import DispatchLiveTrackingPage from './pages/DispatchLiveTrackingPage';
import DispatchAttendancePage from './pages/DispatchAttendancePage';
import DispatchBottleReclamationPage from './pages/DispatchBottleReclamationPage';
import DispatchDeliveriesArchivePage from './pages/DispatchDeliveriesArchivePage';
import DispatchDeliveryHistoryPage from './pages/DispatchDeliveryHistoryPage';
import DispatchSystemControlsPage from './pages/DispatchSystemControlsPage';
import DispatchHubContactSettingsPage from './pages/DispatchHubContactSettingsPage';
import DispatchDeliveryPhotosPage from './pages/DispatchDeliveryPhotosPage';
import ServiceAreasPage from '../pages/ServiceAreasPage';
import { DeliveriesDayShell, DeliveriesRangeShell, RiderDeliveriesShell } from '../components/common/DeliveriesRangeShell';
import type { HubId } from '../data/hubs';

import type { DeliveryAgent, Order, Subscription, User, Product } from '../types';

interface DispatchConsoleLayoutProps {
  selectedHubId: string;
  onSelectHub: (hubId: string) => void;
  onExitConsole: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hubDeliveryAgents: DeliveryAgent[];
  hubOrders: Order[];
  hubSubscriptions?: Subscription[];
  hubUsers?: User[];
  products?: Product[];
  deliverySettings?: {
    address: string;
    hubLatitude: string;
    hubLongitude: string;
    radiusKm: string;
  };
  onSaveServiceArea?: (address: string, lat: string, lng: string, radius: string) => void;
  onUpdateOrderStatus?: (orderId: string, status: Order['status']) => void;
  onUpdateOrderDriver?: (orderId: string, agentId: string) => void;
  adminUsername?: string;
}

export default function DispatchConsoleLayout({
  selectedHubId,
  onSelectHub,
  onExitConsole,
  showToast,
  hubDeliveryAgents,
  hubOrders,
  hubSubscriptions = [],
  hubUsers = [],
  products = [],
  deliverySettings = {
    address: 'Electronic City, Bengaluru',
    hubLatitude: '12.8676977',
    hubLongitude: '77.6667214',
    radiusKm: '5.0',
  },
  onSaveServiceArea,
  onUpdateOrderStatus,
  onUpdateOrderDriver,
  adminUsername = 'Tomadmin@gmail.com'
}: DispatchConsoleLayoutProps) {
  const { theme, toggleTheme } = useHubContext();
  // Delivery pages read hubs/{hub}/deliveries through these shells (period + loader + status/rider writes).
  const hubId = selectedHubId as HubId;
  const shell = { hubId, deliveryAgents: hubDeliveryAgents, showToast };
  const [activeTab, setActiveTab] = useState<string>('dispatch-dashboard');
  const [selectedPartner, setSelectedPartner] = useState<DeliveryAgent | null>(null);
  const [isHubModalOpen, setIsHubModalOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  const handleUpdateStatus = (orderId: string, status: Order['status']) => {
    if (onUpdateOrderStatus) {
      onUpdateOrderStatus(orderId, status);
    } else {
      showToast(`Updated status of ${orderId} to ${status}`, 'success');
    }
  };

  const handleUpdateDriver = (orderId: string, agentId: string) => {
    if (onUpdateOrderDriver) {
      onUpdateOrderDriver(orderId, agentId);
    } else {
      showToast(`Assigned driver to ${orderId}`, 'success');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main, #F8FAFC)', color: 'var(--text-main, #1E293B)', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Sidebar Navigation */}
      <DispatchSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onExitConsole={onExitConsole}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="main-content-viewport">
        
        {/* Top Header Navbar - Standard Catalog & Orders Header */}
        <Header
          activeTab={activeTab}
          selectedHubId={selectedHubId}
          onOpenHubModal={() => setIsHubModalOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          adminUsername={adminUsername}
          onLogout={onExitConsole}
        />

        {/* Dynamic Page Router */}
        <main style={{ flex: 1, padding: '1.5rem 1.75rem' }}>
          {activeTab === 'dispatch-dashboard' && (
            <DeliveriesDayShell {...shell} fixedToday>{(d) => (
            <DispatchDashboardPage
              hubDeliveryAgents={hubDeliveryAgents}
              hubOrders={d.orders}
              users={d.users}
              products={products}
              selectedHubId={selectedHubId}
              onOpenRegisterModal={() => setActiveTab('register-partner')}
              onSelectPartner={(partner) => {
                setSelectedPartner(partner);
                setActiveTab('partner-detail');
              }}
              onUpdateOrderStatus={d.onUpdateOrderStatus}
              onUpdateOrderDriver={d.onUpdateOrderDriver}
              showToast={showToast}
            />
            )}</DeliveriesDayShell>
          )}

          {activeTab === 'todays-deliveries' && (
            <DeliveriesDayShell {...shell} allowGenerate>{(d) => (
            <DispatchTodaysDeliveriesPage
              selectedHubId={selectedHubId}
              hubOrders={d.orders}
              users={d.users}
              products={products}
              deliveryAgents={hubDeliveryAgents}
              onUpdateOrderStatus={d.onUpdateOrderStatus}
              onUpdateOrderDriver={d.onUpdateOrderDriver}
              showToast={showToast}
            />
            )}</DeliveriesDayShell>
          )}

          {activeTab === 'dispatch-board' && (
            <DeliveriesRangeShell {...shell} defaultDays="recent">{(d) => (
            <DispatchActiveBoardPage
              hubOrders={d.orders}
              hubDeliveryAgents={hubDeliveryAgents}
              users={d.users}
              products={products}
              selectedHubId={selectedHubId}
              onUpdateOrderStatus={d.onUpdateOrderStatus}
              onUpdateOrderDriver={d.onUpdateOrderDriver}
              showToast={showToast}
            />
            )}</DeliveriesRangeShell>
          )}

          {activeTab === 'delivery-partners' && (
            <DispatchDeliveryPartnersPage
              hubDeliveryAgents={hubDeliveryAgents}
              selectedHubId={selectedHubId}
              onOpenRegisterPage={() => setActiveTab('register-partner')}
              onSelectPartner={(partner) => {
                setSelectedPartner(partner);
                setActiveTab('partner-detail');
              }}
            />
          )}

          {activeTab === 'customer-assignments' && (
            <DispatchCustomerAssignmentPage
              users={hubUsers}
              hubDeliveryAgents={hubDeliveryAgents}
              selectedHubId={selectedHubId}
              showToast={showToast}
            />
          )}

          {activeTab === 'route-grouping' && (
            <DispatchRouteGroupingPage
              hubDeliveryAgents={hubDeliveryAgents}
              hubOrders={hubOrders}
              hubSubscriptions={hubSubscriptions}
              users={hubUsers}
              selectedHubId={selectedHubId}
              showToast={showToast}
            />
          )}

          {activeTab === 'register-partner' && (
            <DispatchRegisterPartnerPage
              selectedHubId={selectedHubId}
              onBack={() => setActiveTab('delivery-partners')}
              showToast={showToast}
            />
          )}

          {activeTab === 'partner-detail' && (
            <RiderDeliveriesShell {...shell} riderUid={selectedPartner?.id ?? null}>{(d) => (
            <DispatchPartnerDetailPage
              partner={selectedPartner || hubDeliveryAgents[0] || {
                id: 'agent_default',
                name: 'Delivery Agent',
                phone: '',
                email: 'agent@milkylush.com',
                assignedZone: 'General Route',
                isOnline: true,
                isActive: true
              }}
              hubOrders={d.orders}
              onBack={() => setActiveTab('delivery-partners')}
              showToast={showToast}
            />
            )}</RiderDeliveriesShell>
          )}

          {activeTab === 'rider-attendance' && (
            <DispatchAttendancePage
              selectedHubId={selectedHubId}
              hubDeliveryAgents={hubDeliveryAgents}
              showToast={showToast}
            />
          )}

          {activeTab === 'live-tracking' && (
            <DispatchLiveTrackingPage
              hubDeliveryAgents={hubDeliveryAgents}
              selectedHubId={selectedHubId}
            />
          )}

          {activeTab === 'bottle-reclamation' && (
            <DispatchBottleReclamationPage
              hubOrders={hubOrders}
              selectedHubId={selectedHubId}
              users={hubUsers}
              showToast={showToast}
            />
          )}

          {activeTab === 'deliveries-archive' && (
            <DeliveriesRangeShell {...shell} defaultDays={30}>{(d) => (
            <DispatchDeliveriesArchivePage
              hubOrders={d.orders}
              users={d.users}
              products={products}
              deliveryAgents={hubDeliveryAgents}
              selectedHubId={selectedHubId}
              onUpdateOrderStatus={d.onUpdateOrderStatus}
              onUpdateOrderDriver={d.onUpdateOrderDriver}
              showToast={showToast}
            />
            )}</DeliveriesRangeShell>
          )}

          {activeTab === 'delivery-history' && (
            <DeliveriesRangeShell {...shell} defaultDays={30}>{(d) => (
            <DispatchDeliveryHistoryPage
              hubOrders={d.orders}
              users={d.users}
              deliveryAgents={hubDeliveryAgents}
              selectedHubId={selectedHubId}
            />
            )}</DeliveriesRangeShell>
          )}

          {activeTab === 'system-controls' && (
            <DispatchSystemControlsPage
              selectedHubId={selectedHubId}
              showToast={showToast}
              deliveryAgents={hubDeliveryAgents}
            />
          )}

          {activeTab === 'delivery-photos' && (
            <DispatchDeliveryPhotosPage selectedHubId={selectedHubId} showToast={showToast} />
          )}

          {activeTab === 'hub-contacts' && (
            <DispatchHubContactSettingsPage
              selectedHubId={selectedHubId}
              showToast={showToast}
            />
          )}

          {activeTab === 'service-area' && (
            <ServiceAreasPage
              selectedHubId={selectedHubId}
              deliverySettings={deliverySettings}
              onSaveSettings={onSaveServiceArea || (() => {})}
              showToast={showToast}
            />
          )}
        </main>

      </div>

      {/* Standard Hub Modal Switcher */}
      {isHubModalOpen && (
        <HubModal
          isOpen={isHubModalOpen}
          onClose={() => setIsHubModalOpen(false)}
          selectedHubId={selectedHubId}
          onSelectHub={onSelectHub}
        />
      )}

    </div>
  );
}
