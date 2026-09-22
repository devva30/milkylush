import React from 'react';
import { X, MapPin, Check } from 'lucide-react';
import { HUBS } from '../../context/HubContext';

interface HubModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedHubId: string;
  onSelectHub: (hubId: string) => void;
}

export const HubModal: React.FC<HubModalProps> = ({
  isOpen,
  onClose,
  selectedHubId,
  onSelectHub,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-color)',
          padding: '1.75rem',
          boxSizing: 'border-box',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Operational Hub Scoping
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Active regional operational branch scoping for orders and inventory.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {Object.values(HUBS).map((hub) => {
            const isSelected = hub.id === selectedHubId;
            return (
              <div
                key={hub.id}
                onClick={() => {
                  onSelectHub(hub.id);
                  onClose();
                }}
                style={{
                  padding: '1rem 1.25rem',
                  borderRadius: '14px',
                  border: isSelected ? '2px solid var(--primary-light)' : '1px solid var(--border-color)',
                  backgroundColor: isSelected ? 'rgba(4, 120, 87, 0.15)' : 'var(--bg-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <MapPin size={20} style={{ color: isSelected ? 'var(--primary-light)' : 'var(--text-muted)' }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isSelected ? 'var(--primary-light)' : 'var(--text-main)' }}>
                      {hub.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {hub.address} ({hub.state})
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary-light, #047857)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
