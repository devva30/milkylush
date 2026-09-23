import type { Order, User, BottleRecordItem } from '../../types';
import BottleManagementPage from '../../pages/BottleManagementPage';

interface DispatchBottleReclamationPageProps {
  hubOrders: Order[];
  selectedHubId: string;
  users?: User[];
  bottleRecords?: BottleRecordItem[];
  adminUsername?: string;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function DispatchBottleReclamationPage({
  hubOrders,
  selectedHubId,
  users = [],
  bottleRecords = [],
  adminUsername = 'Tom SuperAdmin',
  showToast = () => {},
}: DispatchBottleReclamationPageProps) {
  return (
    <BottleManagementPage
      selectedHubId={selectedHubId}
      users={users}
      orders={hubOrders}
      bottleRecords={bottleRecords}
      adminUsername={adminUsername}
      showToast={showToast}
    />
  );
}
