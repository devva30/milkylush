import {
  LayoutDashboard, Truck, Users, UserCheck, Layers, Calendar, MapPin, UserPlus, Wine, Archive,
  History, Camera, Settings, Grid, PhoneCall, Zap,
} from 'lucide-react';
import SideNav, { type NavGroup } from '../components/SideNav';

interface DispatchSidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onExitConsole: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const GROUPS: NavGroup[] = [
  {
    items: [
      { id: 'dispatch-dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'todays-deliveries', label: "Today's Deliveries", icon: Truck },
      { id: 'dispatch-board', label: 'Live Dispatch Board', icon: Zap },
      { id: 'live-tracking', label: 'Live Rider Map', icon: MapPin },
    ],
  },
  {
    title: 'Riders',
    collapsible: true,
    items: [
      { id: 'delivery-partners', label: 'Delivery Partners', icon: Users },
      { id: 'register-partner', label: 'Add a Rider', icon: UserPlus },
      { id: 'rider-attendance', label: 'Attendance', icon: Calendar },
      { id: 'customer-assignments', label: 'Customer-Rider Mapping', icon: UserCheck },
      { id: 'route-grouping', label: 'Routes & Sequence', icon: Layers },
    ],
  },
  {
    title: 'Records',
    collapsible: true,
    items: [
      { id: 'delivery-history', label: 'Delivery History', icon: History },
      { id: 'deliveries-archive', label: 'Deliveries Archive', icon: Archive },
      { id: 'delivery-photos', label: 'Delivery Photos', icon: Camera },
      { id: 'bottle-reclamation', label: 'Bottle Returns', icon: Wine },
    ],
  },
  {
    title: 'Settings',
    collapsible: true,
    items: [
      { id: 'service-area', label: 'Service Areas & Map', icon: MapPin },
      { id: 'hub-contacts', label: 'Hub Contacts & Help', icon: PhoneCall },
      { id: 'system-controls', label: 'System Controls', icon: Settings },
    ],
  },
];

export default function DispatchSidebar({ activeTab, onSelectTab, onExitConsole, isMobileOpen, onCloseMobile }: DispatchSidebarProps) {
  return (
    <SideNav
      groups={GROUPS}
      activeTab={activeTab}
      onSelectTab={onSelectTab}
      exit={{ label: 'Back to portals', icon: Grid, onClick: onExitConsole }}
      isMobileOpen={isMobileOpen}
      onCloseMobile={onCloseMobile}
      consoleName="Delivery"
    />
  );
}
