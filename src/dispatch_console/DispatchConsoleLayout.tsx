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
import DispatchRegisterPartnerPage from './pages/DispatchRegisterPartnerPage';
import DispatchPartnerDetailPage from './pages/DispatchPartnerDetailPage';
import DispatchLiveTrackingPage from './pages/DispatchLiveTrackingPage';
import DispatchBottleReclamationPage from './pages/DispatchBottleReclamationPage';
import DispatchDeliveriesArchivePage from './pages/DispatchDeliveriesArchivePage';
import DispatchDeliveryHistoryPage from './pages/DispatchDeliveryHistoryPage';
import DispatchSystemControlsPage from './pages/DispatchSystemControlsPage';

import type { DeliveryAgent, Order, User, Product } from '../types';

interface DispatchConsoleLayoutProps {
  selectedHubId: string;
  onSelectHub: (hubId: string) => void;
  onExitConsole: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hubDeliveryAgents: DeliveryAgent[];
  hubOrders: Order[];
  hubUsers?: User[];
  products?: Product[];
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
  hubUsers = [],
  products = [],
  onUpdateOrderStatus,
  onUpdateOrderDriver,
  adminUsername = 'Tomadmin@gmail.com'
}: DispatchConsoleLayoutProps) {
  const { theme, toggleTheme } = useHubContext();
  const [activeTab, setActiveTab] = useState<string>('dispatch-dashboard');
  const [selectedPartner, setSelectedPartner] = useState<DeliveryAgent | null>(null);
  const [isHubModalOpen, setIsHubModalOpen] = useState<boolean>(false);

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
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, marginLeft: '260px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        
        {/* Top Header Navbar - Standard Catalog & Orders Header */}
        <Header
          activeTab={activeTab}
          selectedHubId={selectedHubId}
          onOpenHubModal={() => setIsHubModalOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onToggleMobileSidebar={() => {}}
          adminUsername={adminUsername}
          onLogout={onExitConsole}
        />

        {/* Dynamic Page Router */}
        <main style={{ flex: 1, padding: '1.5rem 1.75rem' }}>
          {activeTab === 'dispatch-dashboard' && (
            <DispatchDashboardPage
              hubDeliveryAgents={hubDeliveryAgents}
              hubOrders={hubOrders}
              selectedHubId={selectedHubId}
              onOpenRegisterModal={() => setActiveTab('register-partner')}
              onSelectPartner={(partner) => {
                setSelectedPartner(partner);
                setActiveTab('partner-detail');
              }}
            />
          )}

          {activeTab === 'todays-deliveries' && (
            <DispatchTodaysDeliveriesPage
              selectedHubId={selectedHubId}
              hubOrders={hubOrders}
              users={hubUsers}
              products={products}
              deliveryAgents={hubDeliveryAgents}
              onUpdateOrderStatus={handleUpdateStatus}
              onUpdateOrderDriver={handleUpdateDriver}
              showToast={showToast}
            />
          )}

          {activeTab === 'dispatch-board' && (
            <DispatchActiveBoardPage
              hubOrders={hubOrders}
              hubDeliveryAgents={hubDeliveryAgents}
              users={hubUsers}
              products={products}
              selectedHubId={selectedHubId}
              onUpdateOrderStatus={handleUpdateStatus}
              onUpdateOrderDriver={handleUpdateDriver}
              showToast={showToast}
            />
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

          {activeTab === 'register-partner' && (
            <DispatchRegisterPartnerPage
              selectedHubId={selectedHubId}
              onBack={() => setActiveTab('delivery-partners')}
              showToast={showToast}
            />
          )}

          {activeTab === 'partner-detail' && (
            <DispatchPartnerDetailPage
              partner={selectedPartner || hubDeliveryAgents[0] || {
                id: 'agent_default',
                name: 'Delivery Agent',
                phone: '+91 98765 43210',
                email: 'agent@milkylush.com',
                assignedZone: 'General Route',
                isOnline: true,
                isActive: true
              }}
              hubOrders={hubOrders}
              onBack={() => setActiveTab('delivery-partners')}
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
            />
          )}

          {activeTab === 'deliveries-archive' && (
            <DispatchDeliveriesArchivePage
              hubOrders={hubOrders}
              users={hubUsers}
              products={products}
              deliveryAgents={hubDeliveryAgents}
              selectedHubId={selectedHubId}
              onUpdateOrderStatus={handleUpdateStatus}
              onUpdateOrderDriver={handleUpdateDriver}
              showToast={showToast}
            />
          )}

          {activeTab === 'delivery-history' && (
            <DispatchDeliveryHistoryPage
              hubOrders={hubOrders}
              users={hubUsers}
              deliveryAgents={hubDeliveryAgents}
              selectedHubId={selectedHubId}
            />
          )}

          {activeTab === 'system-controls' && (
            <DispatchSystemControlsPage
              selectedHubId={selectedHubId}
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
