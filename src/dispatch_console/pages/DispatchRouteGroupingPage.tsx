import { useState, useMemo, useEffect } from 'react';
import { Layers, MoveUp, MoveDown, RefreshCw, Save, MapPin, Truck, CheckCircle2, User, Phone, Package, Eye, X } from 'lucide-react';
import type { HubId } from '../../data/hubs';
import { useHubRoutes, saveStopOrder, type RouteStop } from '../../data/routes';
import { DataState } from '../../components/common/DataState';
import type { DeliveryAgent, Order, Subscription, User as CustomerUser } from '../../types';

interface DispatchRouteGroupingPageProps {
  hubDeliveryAgents: DeliveryAgent[];
  /** Ignored: stops come from the riders' routes. Kept so existing callers compile. */
  hubOrders?: Order[];
  hubSubscriptions?: Subscription[];
  users?: CustomerUser[];
  selectedHubId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface CustomerStopItem {
  id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  allDocItems: {
    id: string;
    collection: string;
    isSubscription: boolean;
    itemsSummary: string;
    dropSequence: number;
  }[];
  dropSequence: number;
}

export default function DispatchRouteGroupingPage({
  hubDeliveryAgents,
  selectedHubId,
  showToast,
}: DispatchRouteGroupingPageProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    hubDeliveryAgents[0]?.id || ''
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selectedItemsModal, setSelectedItemsModal] = useState<CustomerStopItem | null>(null);

  // Stops come from each rider's route document; the array order is the drop sequence.
  const routesQuery = useHubRoutes(selectedHubId as HubId);
  const routeOf = (agentId: string) => routesQuery.data.find((r) => r.riderUid === agentId);

  const riderSummaries = useMemo(() => {
    return hubDeliveryAgents.map((agent) => {
      const stops = routeOf(agent.id)?.stops.length ?? 0;
      return { agent, ordersCount: 0, subsCount: stops, totalCount: stops };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubDeliveryAgents, routesQuery.data]);

  // Active Selected Agent
  const selectedAgent = useMemo(() => {
    return hubDeliveryAgents.find((a) => a.id === selectedAgentId) || hubDeliveryAgents[0];
  }, [hubDeliveryAgents, selectedAgentId]);

  const selectedRoute = selectedAgent ? routeOf(selectedAgent.id) : undefined;

  const initialCustomerStops = useMemo<CustomerStopItem[]>(() => {
    return (selectedRoute?.stops ?? []).map((st, idx) => ({
      id: st.customerUid,
      customerName: st.customerId ? `${st.name} (${st.customerId})` : st.name,
      customerPhone: st.phone,
      address: st.address,
      allDocItems: [],
      dropSequence: idx + 1,
    }));
  }, [selectedRoute]);

  const [customerStops, setCustomerStops] = useState<CustomerStopItem[]>([]);

  // Update local customer stops state when the route changes
  useEffect(() => {
    setCustomerStops(initialCustomerStops);
  }, [initialCustomerStops]);

  // One write: the route's stops array in the new order.
  const saveDropSequenceBatch = async (stopsToSave: CustomerStopItem[]) => {
    if (!selectedRoute) throw new Error('This rider has no route yet. Assign customers first.');
    const byUid = new Map(selectedRoute.stops.map((st) => [st.customerUid, st]));
    const ordered = stopsToSave.map((st) => byUid.get(st.id)).filter((x): x is RouteStop => !!x);
    setIsSaving(true);
    try {
      await saveStopOrder(selectedHubId as HubId, selectedRoute.id, ordered);
    } finally {
      setIsSaving(false);
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newStops = [...customerStops];
    const temp = newStops[index - 1];
    newStops[index - 1] = newStops[index];
    newStops[index] = temp;
    setCustomerStops(newStops);
  };

  const moveDown = (index: number) => {
    if (index === customerStops.length - 1) return;
    const newStops = [...customerStops];
    const temp = newStops[index + 1];
    newStops[index + 1] = newStops[index];
    newStops[index] = temp;
    setCustomerStops(newStops);
  };

  const handleAutoSortName = async () => {
    if (customerStops.length === 0) {
      showToast('No assigned customer stops to sort.', 'info');
      return;
    }
    const sorted = [...customerStops].sort((a, b) => a.customerName.localeCompare(b.customerName));
    setCustomerStops(sorted);
    try {
      await saveDropSequenceBatch(sorted);
      showToast(`Auto-sorted ${selectedAgent?.name || 'rider'}'s customer stops alphabetically & synced to app!`, 'success');
    } catch (err) {
      showToast('Failed to save sorted sequence: ' + String(err), 'error');
    }
  };

  const handleAutoSortAddress = async () => {
    if (customerStops.length === 0) {
      showToast('No assigned customer stops to sort.', 'info');
      return;
    }
    const sorted = [...customerStops].sort((a, b) => a.address.localeCompare(b.address));
    setCustomerStops(sorted);
    try {
      await saveDropSequenceBatch(sorted);
      showToast(`Auto-sorted ${selectedAgent?.name || 'rider'}'s customer stops by Address & synced to app!`, 'success');
    } catch (err) {
      showToast('Failed to save sorted sequence: ' + String(err), 'error');
    }
  };

  const handleSaveSequence = async () => {
    if (customerStops.length === 0) {
      showToast('No assigned customer stops to re-sequence.', 'info');
      return;
    }
    try {
      await saveDropSequenceBatch(customerStops);
      showToast(`Saved & synced customer stop sequence (#1 to #${customerStops.length}) for ${selectedAgent?.name || 'rider'} to mobile app!`, 'success');
    } catch (err) {
      showToast('Failed to save drop sequence: ' + String(err), 'error');
    }
  };

  return (
    <DataState loading={routesQuery.loading} error={routesQuery.error} onRetry={routesQuery.retry} loadingLabel="Loading routes…">
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={24} style={{ color: '#047857' }} /> Delivery Route Grouping & Sequence Manager
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
            Customer-level stop grouping (#1, #2, #3...). Each customer is listed once with a "View Items" pop-up for products.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSaveSequence}
            disabled={isSaving}
            style={{
              backgroundColor: '#047857',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.84rem',
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(4, 120, 87, 0.25)'
            }}
          >
            <Save size={16} /> {isSaving ? 'Saving Sequence...' : 'Save & Sync Sequence to Mobile App'}
          </button>
        </div>
      </div>

      {/* 1. Fleet Overview Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={18} style={{ color: '#047857' }} /> Active Delivery Partners & Assigned Customer Counts
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Click "Manage Sequence" to view and arrange customer stop sequence for any delivery person.
            </p>
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, backgroundColor: '#ECFDF5', color: '#047857', padding: '4px 12px', borderRadius: '20px', border: '1px solid #A7F3D0' }}>
            {hubDeliveryAgents.length} Active Fleet Riders
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', textTransform: 'uppercase', fontSize: '0.72rem', color: '#64748B' }}>
                <th style={{ padding: '0.75rem 1rem' }}>DELIVERY PERSON</th>
                <th style={{ padding: '0.75rem 1rem' }}>ROUTE ZONE</th>
                <th style={{ padding: '0.75rem 1rem' }}>CONTACT PHONE</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>ASSIGNED CUSTOMERS</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {riderSummaries.map(({ agent, ordersCount, subsCount, totalCount }) => {
                const isSelected = selectedAgent?.id === agent.id;
                return (
                  <tr
                    key={agent.id}
                    style={{
                      backgroundColor: isSelected ? '#F0FDF4' : 'transparent',
                      borderBottom: '1px solid #F1F5F9',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    {/* Name */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: isSelected ? '#047857' : '#E2E8F0',
                          color: isSelected ? '#FFFFFF' : '#334155',
                          fontWeight: 800,
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {agent.name ? agent.name.charAt(0).toUpperCase() : 'R'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: '#1E293B', fontSize: '0.88rem' }}>
                            🚴 {agent.name} {isSelected && <span style={{ fontSize: '0.72rem', backgroundColor: '#DCFCE7', color: '#15803D', padding: '2px 6px', borderRadius: '6px', marginLeft: '6px' }}>Active</span>}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                            ID: {agent.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Zone */}
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#334155', fontWeight: 600 }}>
                      {agent.assignedZone || 'General Route'}
                    </td>

                    {/* Phone */}
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#334155' }}>
                      📞 {agent.phone || '—'}
                    </td>

                    {/* Customer Count */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{
                          backgroundColor: totalCount > 0 ? '#047857' : '#94A3B8',
                          color: '#FFFFFF',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          padding: '3px 10px',
                          borderRadius: '12px'
                        }}>
                          {totalCount} Active Items
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                          ({subsCount} Subs, {ordersCount} Orders)
                        </span>
                      </div>
                    </td>

                    {/* Action Button */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedAgentId(agent.id)}
                        style={{
                          backgroundColor: isSelected ? '#047857' : '#FFFFFF',
                          color: isSelected ? '#FFFFFF' : '#047857',
                          border: '1px solid #047857',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          margin: '0 auto'
                        }}
                      >
                        <Layers size={14} /> {isSelected ? 'Managing Sequence' : 'Manage Sequence (#1, #2...)'}
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Selected Rider Route Sequence Manager Panel */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        
        {/* Banner Controls */}
        <div style={{ backgroundColor: '#F8FAFC', padding: '1.1rem 1.35rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              CUSTOMER-LEVEL RE-ORDER SEQUENCE BUILDER
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              🚴 {selectedAgent?.name || 'Rider'} · {selectedAgent?.assignedZone || 'Hosur Route'} ({customerStops.length} Unique Customer Stops)
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleAutoSortName}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#334155',
                fontWeight: 700,
                fontSize: '0.78rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RefreshCw size={13} /> Auto-Sort A-Z (By Customer Name)
            </button>
            <button
              onClick={handleAutoSortAddress}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#334155',
                fontWeight: 700,
                fontSize: '0.78rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <MapPin size={13} /> Sort by Address
            </button>
          </div>
        </div>

        {/* Simplified Table: STOP #, CUSTOMER NAME & PHONE, DELIVERY ADDRESS, ITEMS ACTION BUTTON, MOVE SEQUENCE */}
        <table className="admin-table" style={{ width: '100%' }}>
          <thead>
            <tr style={{ backgroundColor: '#FFFFFF', textTransform: 'uppercase', fontSize: '0.72rem', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '0.85rem 1.25rem', width: '90px' }}>STOP #</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>CUSTOMER NAME & PHONE</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>DELIVERY ADDRESS</th>
              <th style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>PRODUCTS & ITEMS</th>
              <th style={{ padding: '0.85rem 1.25rem', textAlign: 'center', width: '140px' }}>MOVE SEQUENCE</th>
            </tr>
          </thead>
          <tbody>
            {customerStops.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '3.5rem', color: '#94A3B8' }}>
                  No active customer stops currently assigned to {selectedAgent ? selectedAgent.name : 'this rider'}.
                </td>
              </tr>
            ) : (
              customerStops.map((stop, idx) => (
                <tr key={stop.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  
                  {/* Stop # Badge */}
                  <td style={{ padding: '0.85rem 1.25rem' }}>
                    <div style={{
                      backgroundColor: '#ECFDF5',
                      color: '#047857',
                      border: '1px solid #A7F3D0',
                      borderRadius: '8px',
                      padding: '4px 10px',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      display: 'inline-block'
                    }}>
                      #{idx + 1}
                    </div>
                  </td>

                  {/* Customer Details */}
                  <td style={{ padding: '0.85rem 1.25rem' }}>
                    <div style={{ fontWeight: 800, color: '#1E293B', fontSize: '0.88rem' }}>
                      {stop.customerName}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '2px' }}>
                      📞 {stop.customerPhone}
                    </div>
                  </td>

                  {/* Address */}
                  <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.82rem', color: '#334155' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                      <MapPin size={14} style={{ color: '#047857', flexShrink: 0, marginTop: '2px' }} />
                      <span>{stop.address}</span>
                    </div>
                  </td>

                  {/* Products Action Button: View Items Modal */}
                  <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                    <button
                      onClick={() => setSelectedItemsModal(stop)}
                      style={{
                        backgroundColor: '#ECFDF5',
                        color: '#047857',
                        border: '1px solid #A7F3D0',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Package size={14} /> View Items ({stop.allDocItems.length} {stop.allDocItems.length === 1 ? 'Item' : 'Items'})
                    </button>
                  </td>

                  {/* Move Up / Down Buttons */}
                  <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                      <button
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        title="Move Stop Up"
                        style={{
                          backgroundColor: idx === 0 ? '#F1F5F9' : '#FFFFFF',
                          color: idx === 0 ? '#94A3B8' : '#047857',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <MoveUp size={15} />
                      </button>

                      <button
                        onClick={() => moveDown(idx)}
                        disabled={idx === customerStops.length - 1}
                        title="Move Stop Down"
                        style={{
                          backgroundColor: idx === customerStops.length - 1 ? '#F1F5F9' : '#FFFFFF',
                          color: idx === customerStops.length - 1 ? '#94A3B8' : '#047857',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          cursor: idx === customerStops.length - 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <MoveDown size={15} />
                      </button>
                    </div>
                  </td>

                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 3. Products Details Pop-Up Modal */}
      {selectedItemsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '540px',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            textAlign: 'left'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={20} style={{ color: '#047857' }} /> Assigned Products ({selectedItemsModal.allDocItems.length} Total)
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '4px 0 0 0' }}>
                  Customer: <strong>{selectedItemsModal.customerName}</strong> · 📞 {selectedItemsModal.customerPhone}
                </p>
              </div>
              <button
                onClick={() => setSelectedItemsModal(null)}
                style={{
                  backgroundColor: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748B'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Address */}
            <div style={{ backgroundColor: '#F8FAFC', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.8rem', color: '#334155', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <MapPin size={15} style={{ color: '#047857', flexShrink: 0, marginTop: '2px' }} />
              <span>{selectedItemsModal.address}</span>
            </div>

            {/* Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '320px', overflowY: 'auto' }}>
              {selectedItemsModal.allDocItems.map((item, idx) => (
                <div key={item.id} style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1E293B', fontSize: '0.88rem' }}>
                      #{idx + 1} {item.itemsSummary}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                      Doc ID: {item.id}
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 9px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    backgroundColor: item.isSubscription ? '#DCFCE7' : '#FEF3C7',
                    color: item.isSubscription ? '#166534' : '#B45309',
                  }}>
                    {item.isSubscription ? 'Subscription' : 'One-Time Order'}
                  </span>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <button
              onClick={() => setSelectedItemsModal(null)}
              style={{
                backgroundColor: '#047857',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.85rem',
                padding: '0.65rem 1.2rem',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                marginTop: '0.5rem'
              }}
            >
              Close Items Details
            </button>
          </div>
        </div>
      )}

    </div>
    </DataState>
  );
}
