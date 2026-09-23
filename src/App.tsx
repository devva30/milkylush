import { useState } from 'react';
import { setDoc, doc, deleteDoc, updateDoc, collection } from 'firebase/firestore';
import { db } from './firebase';
import type { Product } from './types';

import { HubContextProvider, useHubContext } from './context/HubContext';
import { useMilkyLushData } from './hooks/useMilkyLushData';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { Toast } from './components/Toast';
import { HubModal } from './components/modals/HubModal';
import { AddOrderModal } from './components/modals/AddOrderModal';

import DispatchConsoleLayout from './dispatch_console/DispatchConsoleLayout';
import CommercialConsoleLayout from './commercial_console/CommercialConsoleLayout';

// Dedicated Modular Pages
import LoginPage from './pages/LoginPage';
import PortalGatewayPage from './pages/PortalGatewayPage';
import DashboardPage from './pages/DashboardPage';
import TodaysDeliveriesPage from './pages/TodaysDeliveriesPage';
import AllDeliveriesPage from './pages/AllDeliveriesPage';
import AnalysisPage from './pages/AnalysisPage';
import OrdersPage from './pages/OrdersPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import CustomersPage from './pages/CustomersPage';
import ServiceAreasPage from './pages/ServiceAreasPage';
import ProductsPage from './pages/ProductsPage';
import DeliveryManagementPage from './pages/DeliveryManagementPage';
import UserControlPage from './pages/UserControlPage';
import PaymentsPage from './pages/PaymentsPage';
import MobileControlPage from './pages/MobileControlPage';
import ReferEarnPage from './pages/ReferEarnPage';
import PrepaidSubscriptionsPage from './pages/PrepaidSubscriptionsPage';
import ManageSubscriptionsPage from './pages/ManageSubscriptionsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import DeliveredHistoryPage from './pages/DeliveredHistoryPage';
import AdminAccessPage from './pages/AdminAccessPage';
import SettingsPage from './pages/SettingsPage';
import BottleManagementPage from './pages/BottleManagementPage';
import QualityReportsPage from './pages/QualityReportsPage';

import type { Order } from './types';

function AppContent() {
  const {
    isAdminLoggedIn,
    selectedHubId,
    setSelectedHubId,
    selectedConsole,
    setSelectedConsole,
    adminUsername,
    theme,
    toggleTheme,
    loginAdmin,
    logoutAdmin,
  } = useHubContext();

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [targetCustomerId, setTargetCustomerId] = useState<string | null>(null);
  const [targetSubscriptionId, setTargetSubscriptionId] = useState<string | null>(null);

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
    setActiveTab(tab);
  };
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isHubModalOpen, setIsHubModalOpen] = useState<boolean>(false);
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Stream data from custom hook
  const {
    products,
    banners: _banners,
    onboardingSlides,
    deliverySettings,
    hubOrders,
    hubUsers,
    hubSubscriptions,
    hubDeliveryAgents,
    hubBanners,
    hubProducts,
    hubPrepaidPackages,
    prepaidPackages: _prepaidPackages,
    adminAuditLogs,
    bottleRecords,
    totalRevenue,
    loading,
  } = useMilkyLushData(selectedHubId);

  // Firestore Mutations
  const handleSaveOrder = async (newOrder: Order) => {
    try {
      await setDoc(doc(db, 'orders', newOrder.id), newOrder);
      showToast(`Created order ${newOrder.id} successfully!`, 'success');
    } catch (err) {
      showToast(`Error creating order: ${err}`, 'error');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
      showToast(`Updated order ${orderId} to ${status}`, 'success');
    } catch (err) {
      showToast(`Error updating order: ${err}`, 'error');
    }
  };

  const handleUpdateOrderDriver = async (orderId: string, agentId: string) => {
    try {
      const agent = hubDeliveryAgents.find((a: DeliveryAgent) => a.id === agentId);
      const isSub = orderId.startsWith('SUB_') || orderId.startsWith('DISPATCH_');
      const targetCol = isSub ? 'subscriptions' : 'orders';
      const realId = orderId.replace('SUB_', '').replace('DISPATCH_', '');

      const updateData = {
        deliveryAgentId: agentId,
        assignedRiderId: agentId,
        assignedPartner: agent ? agent.name : '',
        assignedRiderEmail: agent ? agent.email : '',
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, targetCol, realId), updateData);
      showToast(`Assigned ${agent ? agent.name : 'rider'} to order ${orderId}`, 'success');
    } catch (err) {
      showToast(`Error assigning driver: ${err}`, 'error');
    }
  };

  const handleToggleProductStock = async (productId: string, currentStock: boolean) => {
    try {
      await updateDoc(doc(db, 'products', productId), { inStock: !currentStock });
      showToast(`Stock updated for product ${productId}`, 'success');
    } catch (err) {
      showToast(`Error updating stock: ${err}`, 'error');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteDoc(doc(db, 'products', productId));
      showToast('Product deleted from Firestore.', 'info');
    } catch (err) {
      showToast(`Error deleting product: ${err}`, 'error');
    }
  };

  const handleSaveProduct = async (product: Partial<Product>) => {
    try {
      const targetHubs = (product as any).hubIds && (product as any).hubIds.length > 0
        ? (product as any).hubIds
        : [selectedHubId];
      if (product.id) {
        await setDoc(doc(db, 'products', product.id), { ...product, hubIds: targetHubs }, { merge: true });
        showToast(`Saved product specs for ${product.name}`, 'success');
      } else {
        const newRef = doc(collection(db, 'products'));
        await setDoc(newRef, { ...product, id: newRef.id, hubIds: targetHubs });
        showToast('Created new product specs!', 'success');
      }
    } catch (err) {
      showToast(`Error saving product: ${err}`, 'error');
    }
  };

  const handleSaveServiceArea = async (address: string, lat: string, lng: string, radius: string) => {
    try {
      const data = {
        address,
        hubLatitude: parseFloat(lat) || 0,
        hubLongitude: parseFloat(lng) || 0,
        radiusKm: parseFloat(radius) || 0,
        hubId: selectedHubId,
      };
      await setDoc(doc(db, 'settings', `delivery_${selectedHubId}`), data, { merge: true });
      await setDoc(doc(db, 'settings', 'delivery'), data, { merge: true });
      showToast(`Updated service area settings for ${selectedHubId === 'hub_hosur_main' ? 'Hosur Hub' : 'Bangalore Hub'} in Firestore.`, 'success');
    } catch (err) {
      showToast(`Error saving service area: ${err}`, 'error');
    }
  };

  const handleSaveBanner = async (banner: Partial<import('./types').Banner>) => {
    try {
      const bannerId = banner.id || `ban_${Date.now()}`;
      const targetHubIds = (banner as any).hubIds && (banner as any).hubIds.length > 0
        ? (banner as any).hubIds
        : [selectedHubId];
      await setDoc(doc(db, 'banners', bannerId), {
        ...banner,
        id: bannerId,
        hubIds: targetHubIds,
        active: banner.active ?? true,
      }, { merge: true });
      showToast(`Saved banner live to Firestore for ${selectedHubId === 'hub_hosur_main' ? 'Hosur Hub' : 'Bangalore Hub'}!`, 'success');
    } catch (err) {
      showToast(`Error saving banner: ${err}`, 'error');
    }
  };

  const handleSaveOnboardingSlide = async (slide: Partial<import('./types').OnboardingSlide>) => {
    try {
      const slideId = slide.id || `onb_${Date.now()}`;
      await setDoc(doc(db, 'onboarding', slideId), { ...slide, id: slideId }, { merge: true });
      showToast('Saved onboarding slide in Firestore!', 'success');
    } catch (err) {
      showToast(`Error saving onboarding slide: ${err}`, 'error');
    }
  };

  const handleDeleteBanner = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'banners', id));
      showToast('Banner deleted.', 'info');
    } catch (err) {
      showToast(`Error deleting banner: ${err}`, 'error');
    }
  };

  const handleDeleteOnboardingSlide = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'onboarding', id));
      showToast('Onboarding slide deleted.', 'info');
    } catch (err) {
      showToast(`Error deleting onboarding slide: ${err}`, 'error');
    }
  };

  // 1. Unauthenticated Login Screen
  if (!isAdminLoggedIn) {
    return (
      <LoginPage
        onLoginSuccess={(username, hubId) => {
          loginAdmin(username, hubId);
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
        ordersCount={hubOrders.length}
        productsCount={products.length}
        deliveryAgentsCount={hubDeliveryAgents.length}
      />
    );
  }

  // 3. Dedicated Delivery & Dispatch Console Layout
  if (selectedConsole === 'delivery') {
    return (
      <DispatchConsoleLayout
        selectedHubId={selectedHubId}
        onSelectHub={setSelectedHubId}
        onExitConsole={() => setSelectedConsole(null)}
        showToast={showToast}
        hubDeliveryAgents={hubDeliveryAgents}
        hubOrders={hubOrders}
        hubUsers={hubUsers}
        products={products}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onUpdateOrderDriver={handleUpdateOrderDriver}
        adminUsername={adminUsername || 'Tomadmin@gmail.com'}
      />
    );
  }

  // 4. Dedicated Commercial, Marketing & Procurement Console Layout
  if (selectedConsole === 'commercial') {
    return (
      <CommercialConsoleLayout
        selectedHubId={selectedHubId}
        onSelectHub={setSelectedHubId}
        onExitConsole={() => setSelectedConsole(null)}
        showToast={showToast}
        adminUsername={adminUsername || 'tomadmin@gmail.com'}
      />
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
      />

      {/* Main Content Viewport */}
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
          orders={hubOrders}
          subscriptions={hubSubscriptions}
          onNavigateTab={handleNavigateTab}
        />

        <main style={{ flex: 1, padding: '1.75rem', boxSizing: 'border-box' }}>
          {activeTab === 'dashboard' && (
            <DashboardPage
              selectedHubId={selectedHubId}
              adminUsername={adminUsername}
              hubOrders={hubOrders}
              hubUsers={hubUsers}
              hubSubscriptions={hubSubscriptions}
              hubDeliveryAgents={hubDeliveryAgents}
              products={products}
              totalRevenue={totalRevenue}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {activeTab === 'todays-deliveries' && (
            <TodaysDeliveriesPage
              selectedHubId={selectedHubId}
              orders={hubOrders}
              subscriptions={hubSubscriptions}
              users={hubUsers}
              products={products}
              deliveryAgents={hubDeliveryAgents}
              isLoading={loading}
              onOpenAddOrderModal={() => setIsAddOrderModalOpen(true)}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onUpdateOrderDriver={handleUpdateOrderDriver}
              showToast={showToast}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {activeTab === 'all-deliveries' && (
            <AllDeliveriesPage
              selectedHubId={selectedHubId}
              orders={hubOrders}
              subscriptions={hubSubscriptions}
              users={hubUsers}
              products={products}
              deliveryAgents={hubDeliveryAgents}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onUpdateOrderDriver={handleUpdateOrderDriver}
              showToast={showToast}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {activeTab === 'analysis' && (
            <AnalysisPage
              selectedHubId={selectedHubId}
              orders={hubOrders}
              subscriptions={hubSubscriptions}
              products={products}
              users={hubUsers}
              totalRevenue={totalRevenue}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersPage
              selectedHubId={selectedHubId}
              orders={hubOrders}
              users={hubUsers}
              products={products}
              deliveryAgents={hubDeliveryAgents}
              onOpenAddOrderModal={() => setIsAddOrderModalOpen(true)}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onUpdateOrderDriver={handleUpdateOrderDriver}
              showToast={showToast}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {activeTab === 'subscriptions' && (
            <SubscriptionsPage
              selectedHubId={selectedHubId}
              hubSubscriptions={hubSubscriptions}
              users={hubUsers}
              products={products}
              targetSubscriptionId={targetSubscriptionId}
              isLoading={loading}
              onNavigateTab={handleNavigateTab}
              showToast={showToast}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersPage
              hubUsers={hubUsers}
              orders={hubOrders}
              subscriptions={hubSubscriptions}
              targetCustomerId={targetCustomerId}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {activeTab === 'service-area' && (
            <ServiceAreasPage
              selectedHubId={selectedHubId}
              deliverySettings={deliverySettings}
              onSaveSettings={handleSaveServiceArea}
              showToast={showToast}
            />
          )}

          {activeTab === 'products' && (
            <ProductsPage
              selectedHubId={selectedHubId}
              products={hubProducts}
              onOpenAddProduct={() => showToast('Opened add product modal', 'info')}
              onOpenEditProduct={(prod) => showToast(`Opened edit product for ${prod.name}`, 'info')}
              onToggleStock={handleToggleProductStock}
              onDeleteProduct={handleDeleteProduct}
              onSaveProduct={handleSaveProduct}
              showToast={showToast}
            />
          )}

          {activeTab === 'delivery' && (
            <DeliveryManagementPage
              hubDeliveryAgents={hubDeliveryAgents}
              hubOrders={hubOrders}
              selectedHubId={selectedHubId}
            />
          )}

          {activeTab === 'user-control' && (
            <UserControlPage users={hubUsers} showToast={showToast} />
          )}

          {activeTab === 'payments' && (
            <PaymentsPage
              selectedHubId={selectedHubId}
              users={hubUsers}
              orders={hubOrders}
              showToast={showToast}
            />
          )}

          {activeTab === 'mobile-control' && (
            <MobileControlPage
              selectedHubId={selectedHubId}
              banners={hubBanners}
              onboardingSlides={onboardingSlides}
              onSaveBanner={handleSaveBanner}
              onSaveOnboardingSlide={handleSaveOnboardingSlide}
              onDeleteBanner={handleDeleteBanner}
              onDeleteOnboardingSlide={handleDeleteOnboardingSlide}
              showToast={showToast}
            />
          )}

          {activeTab === 'refer-earn' && (
            <ReferEarnPage users={hubUsers} showToast={showToast} />
          )}

          {activeTab === 'prepaid-subscriptions' && (
            <PrepaidSubscriptionsPage subscriptions={hubSubscriptions} prepaidPackages={hubPrepaidPackages} isLoading={loading} showToast={showToast} />
          )}

          {activeTab === 'manage-subscriptions' && (
            <ManageSubscriptionsPage
              selectedHubId={selectedHubId}
              subscriptions={hubSubscriptions}
              prepaidPackages={hubPrepaidPackages}
              products={products}
              adminUsername={adminUsername}
              showToast={showToast}
            />
          )}

          {activeTab === 'bottle-management' && (
            <BottleManagementPage
              selectedHubId={selectedHubId}
              users={hubUsers}
              orders={hubOrders}
              bottleRecords={bottleRecords}
              adminUsername={adminUsername}
              showToast={showToast}
            />
          )}

          {activeTab === 'audit-logs' && (
            <AuditLogsPage selectedHubId={selectedHubId} auditLogs={adminAuditLogs} />
          )}

          {activeTab === 'delivered-history' && (
            <DeliveredHistoryPage
              orders={hubOrders}
              users={hubUsers}
              deliveryAgents={hubDeliveryAgents}
            />
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
        users={hubUsers}
        products={products}
        deliveryAgents={hubDeliveryAgents}
        selectedHubId={selectedHubId}
        onSaveOrder={handleSaveOrder}
        showToast={showToast}
      />
    </div>
  );
}

export default function App() {
  return (
    <HubContextProvider>
      <AppContent />
    </HubContextProvider>
  );
}
