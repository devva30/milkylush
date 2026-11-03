import {
  TrendingUp, Package, FileText, Users, Milk, Receipt, MessageSquare, Calendar, Layers, ShoppingBag,
  Clock, PieChart, Truck, CreditCard, Send, UserCheck, Grid, Wallet, ClipboardList, Contact,
} from 'lucide-react';
import SideNav, { type NavGroup } from '../components/SideNav';

interface CommercialSidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onExitConsole: () => void;
  onLogout: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const GROUPS: NavGroup[] = [
  {
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
      { id: 'whatsapp-campaigns', label: 'WhatsApp Broadcasts', icon: Send },
      { id: 'sales-detail', label: 'Sales Report', icon: FileText },
      { id: 'customer-ledger', label: 'Customer Ledger', icon: Contact },
    ],
  },
  {
    title: 'WhatsApp',
    collapsible: true,
    items: [
      { id: 'whatsapp-notifications', label: 'Automatic Messages', icon: MessageSquare },
      { id: 'customer-cohorts', label: 'Customer Groups', icon: Users },
    ],
  },
  {
    title: 'Sales Reports',
    collapsible: true,
    items: [
      { id: 'sales-summary', label: 'Summary Report', icon: Layers },
      { id: 'sold-products', label: 'Products Sold', icon: ShoppingBag },
      { id: 'delivery-charge-report', label: 'Delivery Charges', icon: Truck },
      { id: 'leaves-report', label: 'Subscription Leaves', icon: Calendar },
    ],
  },
  {
    title: 'Profit & Expenses',
    collapsible: true,
    items: [
      { id: 'profit-loss', label: 'Profit & Loss', icon: PieChart },
      { id: 'products-analytics', label: 'Product Analytics', icon: Package },
      { id: 'expenses', label: 'Expenses', icon: Wallet },
    ],
  },
  {
    title: 'Milk Buying',
    collapsible: true,
    items: [
      { id: 'farmers', label: 'Farmers (Sellers)', icon: Users },
      { id: 'collection-persons', label: 'Collection Persons', icon: UserCheck },
      { id: 'milk-purchase', label: 'Buy Milk', icon: Milk },
      { id: 'purchase-reports', label: 'Purchase Reports', icon: Receipt },
      { id: 'rate-chart', label: 'Fat & SNF Rate Chart', icon: FileText },
      { id: 'farmer-payments', label: 'Farmer Payments', icon: CreditCard },
    ],
  },
  {
    title: 'Counter & Invoices',
    collapsible: true,
    items: [
      { id: 'daily-sales-load', label: 'Daily Load Sheet', icon: Truck },
      { id: 'sales-requirement', label: 'Sales Requirement', icon: Clock },
      { id: 'invoice-details', label: 'Tax Invoices', icon: ClipboardList },
      { id: 'invoice-summary', label: 'Monthly Customer Summary', icon: Receipt },
    ],
  },
];

export default function CommercialSidebar({ activeTab, onSelectTab, onExitConsole, onLogout, isMobileOpen, onCloseMobile }: CommercialSidebarProps) {
  return (
    <SideNav
      groups={GROUPS}
      activeTab={activeTab}
      onSelectTab={onSelectTab}
      onLogout={onLogout}
      exit={{ label: 'Back to portals', icon: Grid, onClick: onExitConsole }}
      isMobileOpen={isMobileOpen}
      onCloseMobile={onCloseMobile}
      consoleName="Commercial"
    />
  );
}
