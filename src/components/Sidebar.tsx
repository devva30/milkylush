import {
  LayoutDashboard, Users, ShoppingBag, Truck, Calendar, BarChart2, ShieldCheck,
  CreditCard, Smartphone, Gift, Ticket, Clock, Lock, Grid, Wine, MapPin,
  PackageCheck, ClipboardList, Package, Repeat, Layers, FlaskConical, UserPlus, Bike, Cog,
} from 'lucide-react';
import SideNav, { type NavGroup } from './SideNav';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabName: string) => void;
  onLogout: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// The pages used every day sit at the top and are always showing; everything
// else is grouped by what it is for and folds away until needed.
const GROUPS: NavGroup[] = [
  {
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'todays-deliveries', label: "Today's Deliveries", icon: Truck },
      { id: 'orders', label: 'Orders', icon: ShoppingBag },
      { id: 'subscriptions', label: 'Subscriptions', icon: Repeat },
      { id: 'customers', label: 'Customers', icon: Users },
    ],
  },
  {
    title: 'Deliveries',
    collapsible: true,
    items: [
      { id: 'all-deliveries', label: 'All Deliveries', icon: ClipboardList },
      { id: 'delivered-history', label: 'Delivered History', icon: PackageCheck },
      { id: 'delivery', label: 'Delivery Fleet', icon: Bike },
      { id: 'service-area', label: 'Service Areas & Map', icon: MapPin },
    ],
  },
  {
    title: 'Plans & Subscriptions',
    collapsible: true,
    items: [
      { id: 'prepaid-subscriptions', label: 'Prepaid Plans', icon: Calendar },
      { id: 'manage-subscriptions', label: 'Plan Packages & Analytics', icon: Layers },
    ],
  },
  {
    title: 'Products & Stock',
    collapsible: true,
    items: [
      { id: 'products', label: 'Products & Stock', icon: Package },
      { id: 'bottle-management', label: 'Bottles', icon: Wine },
      { id: 'quality-reports', label: 'Quality & Lab Reports', icon: FlaskConical },
    ],
  },
  {
    title: 'Money & Offers',
    collapsible: true,
    items: [
      { id: 'payments', label: 'Payments', icon: CreditCard },
      { id: 'promo-codes', label: 'Promo Codes', icon: Ticket },
      { id: 'refer-earn', label: 'Refer & Earn', icon: Gift },
      { id: 'free-samples', label: 'Free Samples', icon: UserPlus },
      { id: 'analysis', label: 'Analytics & Reports', icon: BarChart2 },
    ],
  },
  {
    title: 'Admin & Settings',
    collapsible: true,
    items: [
      { id: 'mobile-control', label: 'Mobile App Control', icon: Smartphone },
      { id: 'user-control', label: 'User Control', icon: ShieldCheck },
      { id: 'admin-access', label: 'Admin Access', icon: Lock },
      { id: 'audit-logs', label: 'Activity Log', icon: Clock },
      { id: 'settings', label: 'Settings', icon: Cog },
    ],
  },
];

export default function Sidebar(props: SidebarProps) {
  return (
    <SideNav
      groups={GROUPS}
      activeTab={props.activeTab}
      onSelectTab={props.onSelectTab}
      onLogout={props.onLogout}
      exit={{ label: 'Back to portals', icon: Grid, onClick: () => props.onSelectTab('portal-gateway') }}
      isMobileOpen={props.isMobileOpen}
      onCloseMobile={props.onCloseMobile}
      isCollapsed={props.isCollapsed}
      onToggleCollapse={props.onToggleCollapse}
      consoleName="Catalog"
    />
  );
}
