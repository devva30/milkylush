import { MapPin, Navigation, Phone } from 'lucide-react';
import type { DeliveryAgent } from '../../types';

interface DispatchLiveTrackingPageProps {
  hubDeliveryAgents: DeliveryAgent[];
  selectedHubId: string;
}

export default function DispatchLiveTrackingPage({ hubDeliveryAgents, selectedHubId }: DispatchLiveTrackingPageProps) {
  const isHosur = selectedHubId.includes('hosur');
  const displayAgents = (hubDeliveryAgents || []).filter(a => a.isOnline);

  const lat = isHosur ? '12.742253' : '12.867697';
  const lng = isHosur ? '77.824213' : '77.666721';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
          📍 Live Rider GPS Tracking
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
          Real-time GPS route monitoring for active riders in {selectedHubId}.
        </p>
      </div>

      {/* 2 Column Layout: Map & Rider Roster */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 0.6fr)', gap: '1.25rem' }}>
        
        {/* Map Container */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Navigation size={16} style={{ color: '#047857' }} /> Live GPS Map View ({selectedHubId})
            </span>
          </div>

          <div style={{ position: 'relative', width: '100%', height: '420px', borderRadius: '14px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
            <iframe
              title="Live Rider GPS Map"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              src={`https://maps.google.com/maps?q=${lat},${lng}&z=13&output=embed`}
            />
          </div>
        </div>

        {/* Online Riders Sidebar */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
            On-Duty Riders ({displayAgents.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {displayAgents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8', fontSize: '0.82rem' }}>
                No active riders currently online in this hub.
              </div>
            ) : (
              displayAgents.map(agent => (
                <div key={agent.id} style={{ padding: '0.85rem', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1E293B' }}>{agent.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Zone: {agent.assignedZone || 'General'}</div>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#047857', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '10px' }}>
                    🟢 Tracking
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
