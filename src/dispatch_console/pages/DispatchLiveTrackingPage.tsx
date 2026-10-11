import { useState, useMemo } from 'react';
import { MapPin, Navigation, Phone, Radio, Battery, ShieldCheck, Clock, Package } from 'lucide-react';
import type { DeliveryAgent } from '../../types';

interface DispatchLiveTrackingPageProps {
  hubDeliveryAgents: DeliveryAgent[];
  selectedHubId: string;
}

export default function DispatchLiveTrackingPage({ hubDeliveryAgents, selectedHubId }: DispatchLiveTrackingPageProps) {
  const isHosur = selectedHubId.includes('hosur');
  const defaultLat = isHosur ? 12.742253 : 12.867697;
  const defaultLng = isHosur ? 77.824213 : 77.666721;

  // Filter active riders in selected hub
  const activeAgents = useMemo(() => {
    return (hubDeliveryAgents || []).map(a => {
      const lat = typeof (a as any).latitude === 'number' ? (a as any).latitude : parseFloat((a as any).latitude || String(defaultLat));
      const lng = typeof (a as any).longitude === 'number' ? (a as any).longitude : parseFloat((a as any).longitude || String(defaultLng));
      const isOnline = a.isOnline !== undefined ? Boolean(a.isOnline) : true;
      return {
        ...a,
        lat: isNaN(lat) ? defaultLat : lat,
        lng: isNaN(lng) ? defaultLng : lng,
        isOnline
      };
    });
  }, [hubDeliveryAgents, defaultLat, defaultLng]);

  const onlineCount = activeAgents.filter(a => a.isOnline).length;
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const selectedAgent = activeAgents.find(a => a.id === selectedAgentId) || activeAgents[0];

  const currentLat = selectedAgent ? selectedAgent.lat : defaultLat;
  const currentLng = selectedAgent ? selectedAgent.lng : defaultLng;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            📍 Live Rider GPS Tracking & Telemetry
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
            Real-time GPS route monitoring for active delivery partners in {selectedHubId}.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ECFDF5', padding: '0.55rem 1.1rem', borderRadius: '12px', border: '1px solid #A7F3D0' }}>
          <Radio size={16} style={{ color: '#047857' }} className="animate-pulse" />
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#047857' }}>
            {onlineCount || activeAgents.length} Active Riders Online (Realtime GPS)
          </span>
        </div>
      </div>

      {/* 2 Column Layout: Map & Rider Roster */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 0.6fr)', gap: '1.25rem' }}>
        
        {/* Map Container */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={18} style={{ color: '#047857' }} /> Live GPS Map View — {selectedAgent ? selectedAgent.name : selectedHubId}
            </span>
            {selectedAgent && (
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#047857', backgroundColor: '#ECFDF5', padding: '3px 10px', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
                GPS Coords: {currentLat.toFixed(5)}, {currentLng.toFixed(5)}
              </span>
            )}
          </div>

          <div style={{ position: 'relative', width: '100%', height: '460px', borderRadius: '14px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
            <iframe
              key={`${currentLat}_${currentLng}`}
              title="Live Rider GPS Map"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              src={`https://maps.google.com/maps?q=${currentLat},${currentLng}&z=16&output=embed`}
            />
          </div>

          {selectedAgent && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', backgroundColor: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={18} style={{ color: '#047857' }} />
                <div>
                  <div style={{ fontWeight: 800, color: '#1E293B' }}>{selectedAgent.name} ({selectedAgent.phone || '—'})</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Assigned Zone: {selectedAgent.assignedZone || selectedHubId}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <a
                  href={`tel:${selectedAgent.phone || ''}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#047857', color: '#FFFFFF', padding: '4px 12px', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '0.76rem' }}
                >
                  <Phone size={13} /> Call Rider
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Online Riders Sidebar */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
              Fleet Telemetry ({activeAgents.length})
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto' }}>
            {activeAgents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94A3B8', fontSize: '0.82rem' }}>
                No active riders registered in this hub.
              </div>
            ) : (
              activeAgents.map(agent => {
                const isSelected = selectedAgent?.id === agent.id;

                return (
                  <div
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #047857' : '1px solid #E2E8F0',
                      backgroundColor: isSelected ? '#ECFDF5' : '#F8FAFC',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E293B' }}>
                        🚴 {agent.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                        Zone: {agent.assignedZone || 'Hosur Central'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 700, marginTop: '2px' }}>
                        GPS: {agent.lat.toFixed(4)}, {agent.lng.toFixed(4)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: agent.isOnline ? '#047857' : '#D97706',
                        backgroundColor: agent.isOnline ? '#DCFCE7' : '#FEF3C7',
                        padding: '2px 8px',
                        borderRadius: '10px'
                      }}>
                        {agent.isOnline ? '🟢 Live GPS' : '🟡 On Duty'}
                      </span>
                      {isSelected && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#047857' }}>
                          ✓ Tracking
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

