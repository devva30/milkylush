import { Eye, ShieldCheck, BarChart3, TrendingUp, MapPin, Activity } from 'lucide-react';
import type { DeliveryAgent, Order } from '../../types';

interface DispatchDashboardPageProps {
  hubDeliveryAgents: DeliveryAgent[];
  hubOrders: Order[];
  selectedHubId: string;
  onOpenRegisterModal: () => void;
  onSelectPartner?: (partner: DeliveryAgent) => void;
}

export default function DispatchDashboardPage({
  hubDeliveryAgents,
  hubOrders,
  selectedHubId,
  onOpenRegisterModal,
  onSelectPartner
}: DispatchDashboardPageProps) {
  const displayAgents = hubDeliveryAgents || [];
  const displayOrders = hubOrders || [];

  const totalDispatchesToday = displayOrders.length;
  const pendingDispatch = displayOrders.filter(o => o.status === 'packed' || o.status === 'pending' || o.status === 'confirmed' || o.status === 'processing').length;
  const outForDelivery = displayOrders.filter(o => o.status === 'outForDelivery' || o.status === 'assigned').length;
  const deliveredToday = displayOrders.filter(o => o.status === 'delivered').length;
  const cancelledToday = displayOrders.filter(o => o.status === 'cancelled').length;

  const onlineRiders = displayAgents.filter(a => a.isOnline).length;
  const totalRiders = displayAgents.length;
  const onlinePercentage = totalRiders > 0 ? Math.round((onlineRiders / totalRiders) * 100) : 0;

  const successRate = totalDispatchesToday > 0 
    ? Math.round((deliveredToday / totalDispatchesToday) * 100) 
    : 100;

  const hubLabel = selectedHubId.includes('bengaluru') || selectedHubId.includes('ecity') 
    ? 'Bengaluru Electronic City Hub' 
    : 'Hosur Central Hub';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Top Header Card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {hubLabel} • Dispatch Center
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111827', margin: '2px 0 0 0' }}>
            🚚 Delivery Fleet Overview
          </h2>
        </div>

        <button
          onClick={onOpenRegisterModal}
          style={{
            backgroundColor: '#044E35',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '0.85rem',
            padding: '0.6rem 1.2rem',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(4, 78, 53, 0.25)'
          }}
        >
          + Register Partner
        </button>
      </div>

      {/* 5 Top Summary Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.05em' }}>TOTAL DISPATCHES TODAY</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1E293B', marginTop: '6px' }}>{totalDispatchesToday}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>Scheduled for route</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#D97706', letterSpacing: '0.05em' }}>PENDING DISPATCH</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#D97706', marginTop: '6px' }}>{pendingDispatch}</div>
          <div style={{ fontSize: '0.75rem', color: '#B45309', marginTop: '2px' }}>Awaiting driver route</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#2563EB', letterSpacing: '0.05em' }}>OUT FOR DELIVERY</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#2563EB', marginTop: '6px' }}>{outForDelivery}</div>
          <div style={{ fontSize: '0.75rem', color: '#1D4ED8', marginTop: '2px' }}>Live on-road packages</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#059669', letterSpacing: '0.05em' }}>DELIVERED TODAY</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#059669', marginTop: '6px' }}>{deliveredToday}</div>
          <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: '2px' }}>Successful dropoffs</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.05em' }}>ACTIVE RIDERS ONLINE</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#047857', marginTop: '6px' }}>{onlineRiders} <span style={{ fontSize: '1rem', color: '#94A3B8' }}>/ {totalRiders}</span></div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>Drivers on duty status</div>
        </div>

      </div>

      {/* Middle 2-Column Section: Today's Delivery Stages Chart + Fleet Availability */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 0.7fr)', gap: '1.25rem' }}>
        
        {/* Left Card: Today's Delivery Stages Bar Chart */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.5rem', border: '1px solid #E2E8F0' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
            Today's Delivery Stages
          </h3>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '180px', marginTop: '1.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #E2E8F0' }}>
            
            {/* Packed / Pending Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#D97706' }}>{pendingDispatch}</span>
              <div style={{ width: '60px', height: `${Math.max((pendingDispatch / (totalDispatchesToday || 1)) * 130, 12)}px`, backgroundColor: '#D97706', borderRadius: '6px 6px 0 0', transition: 'all 0.3s ease' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>Packed</span>
            </div>

            {/* Out for Delivery Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2563EB' }}>{outForDelivery}</span>
              <div style={{ width: '60px', height: `${Math.max((outForDelivery / (totalDispatchesToday || 1)) * 130, 12)}px`, backgroundColor: '#2563EB', borderRadius: '6px 6px 0 0', transition: 'all 0.3s ease' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>Out for Delivery</span>
            </div>

            {/* Delivered Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#059669' }}>{deliveredToday}</span>
              <div style={{ width: '60px', height: `${Math.max((deliveredToday / (totalDispatchesToday || 1)) * 130, 12)}px`, backgroundColor: '#059669', borderRadius: '6px 6px 0 0', transition: 'all 0.3s ease' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>Delivered</span>
            </div>

            {/* Cancelled Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#EF4444' }}>{cancelledToday}</span>
              <div style={{ width: '60px', height: `${Math.max((cancelledToday / (totalDispatchesToday || 1)) * 130, 12)}px`, backgroundColor: '#EF4444', borderRadius: '6px 6px 0 0', transition: 'all 0.3s ease' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>Cancelled</span>
            </div>

          </div>
        </div>

        {/* Right Card: Riders Fleet Availability Gauge */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.5rem', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
            Riders Fleet Availability
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '1.5rem 0' }}>
            <div style={{ position: 'relative', width: '130px', height: '130px', borderRadius: '50%', border: '12px solid #E2E8F0', borderTopColor: '#059669', borderRightColor: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-45deg)' }}>
              <div style={{ transform: 'rotate(45deg)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E293B' }}>{onlinePercentage}%</div>
                <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700 }}>Online</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669' }} /> {onlineRiders} Online
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#CBD5E1' }} /> {totalRiders - onlineRiders} Offline
            </span>
          </div>
        </div>

      </div>

      {/* NEW: Additional Analytics Graphs Section at Bottom */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        
        {/* Graph 1: Hourly Dispatch Velocity Bar Chart */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <BarChart3 size={18} style={{ color: '#047857' }} />
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                Hourly Dispatch Velocity
              </h4>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Peak morning milk dropoff time slots</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', paddingTop: '1rem', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857' }}>72%</span>
              <div style={{ width: '28px', height: '90px', backgroundColor: '#059669', borderRadius: '4px 4px 0 0' }} />
              <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>5 AM - 7 AM</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563EB' }}>20%</span>
              <div style={{ width: '28px', height: '35px', backgroundColor: '#3B82F6', borderRadius: '4px 4px 0 0' }} />
              <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>7 AM - 9 AM</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#D97706' }}>5%</span>
              <div style={{ width: '28px', height: '18px', backgroundColor: '#F59E0B', borderRadius: '4px 4px 0 0' }} />
              <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>9 AM - 12 PM</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280' }}>3%</span>
              <div style={{ width: '28px', height: '12px', backgroundColor: '#9CA3AF', borderRadius: '4px 4px 0 0' }} />
              <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>Evening</span>
            </div>
          </div>
        </div>

        {/* Graph 2: Fulfillment Ratio Gauge & Success Metric */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} style={{ color: '#047857' }} />
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                Fulfillment Success Rate
              </h4>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Successful doorstep fulfillment ratio</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', margin: '1rem 0' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#047857', lineHeight: 1 }}>
              {successRate}%
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700 }}>
                <span style={{ color: '#059669' }}>Fulfilled ({deliveredToday})</span>
                <span style={{ color: '#EF4444' }}>Returned ({cancelledToday})</span>
              </div>
              <div style={{ width: '100%', height: '10px', backgroundColor: '#FEE2E2', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${successRate}%`, height: '100%', backgroundColor: '#059669', borderRadius: '10px' }} />
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: '#64748B', borderTop: '1px solid #F1F5F9', paddingTop: '0.5rem' }}>
            ⚡ Target threshold rate is 98.5% doorstep SLA.
          </div>
        </div>

        {/* Graph 3: Zone Delivery Distribution */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <MapPin size={18} style={{ color: '#047857' }} />
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                Zone Distribution
              </h4>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Route allocation across sectors</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                <span>Sector 1 & Begepalli</span>
                <span>65%</span>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '6px', marginTop: '4px', overflow: 'hidden' }}>
                <div style={{ width: '65%', height: '100%', backgroundColor: '#047857' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                <span>Central Town & Ezhil Nagar</span>
                <span>25%</span>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '6px', marginTop: '4px', overflow: 'hidden' }}>
                <div style={{ width: '25%', height: '100%', backgroundColor: '#2563EB' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                <span>Border Area & Outskirts</span>
                <span>10%</span>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '6px', marginTop: '4px', overflow: 'hidden' }}>
                <div style={{ width: '10%', height: '100%', backgroundColor: '#D97706' }} />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Table: Active Rider Roster with View Profile Button */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '1.15rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} style={{ color: '#047857' }} /> Active Rider Roster
          </h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>
            Hub: {selectedHubId}
          </span>
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', textTransform: 'uppercase', fontSize: '0.7rem', color: '#64748B' }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>RIDER NAME</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>PHONE</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>ASSIGNED ZONE</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>DUTY STATE</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {displayAgents.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: '#94A3B8' }}>
                    No delivery personnel registered for this hub.
                  </td>
                </tr>
              ) : (
                displayAgents.map(agent => (
                  <tr key={agent.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#1E293B', fontSize: '0.85rem' }}>
                      {agent.name}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.82rem', color: '#475569' }}>
                      {agent.phone || 'N/A'}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.82rem', color: '#475569' }}>
                      {agent.assignedZone || 'General Delivery Route'}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: '12px',
                        backgroundColor: agent.isOnline ? '#DCFCE7' : '#F1F5F9',
                        color: agent.isOnline ? '#047857' : '#64748B'
                      }}>
                        {agent.isOnline ? '🟢 Online' : '⚪ Offline'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <button
                        onClick={() => onSelectPartner && onSelectPartner(agent)}
                        style={{
                          backgroundColor: '#F1F5F9',
                          border: '1px solid #CBD5E1',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#334155',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Eye size={13} /> View Profile
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
