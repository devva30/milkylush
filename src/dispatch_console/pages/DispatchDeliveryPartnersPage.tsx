import { useState } from 'react';
import { Users, Phone, MapPin, Plus, Search, Eye } from 'lucide-react';
import type { DeliveryAgent } from '../../types';

interface DispatchDeliveryPartnersPageProps {
  hubDeliveryAgents: DeliveryAgent[];
  selectedHubId: string;
  onOpenRegisterPage: () => void;
  onSelectPartner: (partner: DeliveryAgent) => void;
}

export default function DispatchDeliveryPartnersPage({
  hubDeliveryAgents,
  selectedHubId,
  onOpenRegisterPage,
  onSelectPartner
}: DispatchDeliveryPartnersPageProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAgents = (hubDeliveryAgents || []).filter(agent => {
    return (
      (agent.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (agent.phone || '').includes(searchQuery) ||
      (agent.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            👥 Delivery Fleet Partners
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
            Registered fleet personnel, duty states, and route assignments in {selectedHubId}.
          </p>
        </div>

        <button
          onClick={onOpenRegisterPage}
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
            gap: '6px'
          }}
        >
          <Plus size={16} /> Register New Partner
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1rem 1.25rem', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
          Registered Personnel List ({filteredAgents.length})
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search name, phone, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 36px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem', outline: 'none' }}
          />
        </div>

      </div>

      {/* Delivery Partners Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', textTransform: 'uppercase', fontSize: '0.72rem', color: '#64748B' }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>PARTNER NAME</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>MOBILE PHONE</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>EMAIL ADDRESS</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>ASSIGNED ZONE</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>DUTY STATE</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>
                    No delivery personnel registered for this hub. Click "+ Register New Partner" above.
                  </td>
                </tr>
              ) : (
                filteredAgents.map(agent => (
                  <tr key={agent.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#1E293B', fontSize: '0.85rem' }}>
                      {agent.name}
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.82rem', color: '#475569' }}>
                      📞 {agent.phone || 'N/A'}
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.82rem', color: '#475569' }}>
                      {agent.email || 'N/A'}
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.82rem', color: '#475569' }}>
                      <span style={{ backgroundColor: '#ECFDF5', color: '#047857', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                        {agent.assignedZone || 'General Delivery Route'}
                      </span>
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
                        onClick={() => onSelectPartner(agent)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          backgroundColor: '#044E35',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <Eye size={13} /> View Details
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
