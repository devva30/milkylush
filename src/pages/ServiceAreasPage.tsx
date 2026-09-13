import React, { useState, useEffect } from 'react';
import { MapPin, Save, Navigation, Compass, Map as MapIcon, Building } from 'lucide-react';

interface ServiceAreasPageProps {
  selectedHubId: string;
  deliverySettings: {
    address: string;
    hubLatitude: string;
    hubLongitude: string;
    radiusKm: string;
  };
  onSaveSettings: (address: string, lat: string, lng: string, radius: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ServiceAreasPage({
  selectedHubId,
  deliverySettings,
  onSaveSettings,
  showToast,
}: ServiceAreasPageProps) {

  const isHosur = selectedHubId === 'hub_hosur_main' || selectedHubId.includes('hosur');

  // Hub specific data strictly scoped to active hub selection
  const hubTitle = isHosur ? 'Hosur - Central Hub (TN)' : 'Bangalore - Electronic City Hub (KA)';
  const hubCity = isHosur ? 'Hosur' : 'Bangalore';
  const hubState = isHosur ? 'Tamil Nadu' : 'Karnataka';
  
  const defaultAddress = isHosur 
    ? 'Plot 45, Sipcot Industrial Complex Phase 1, Hosur - 635126' 
    : 'Building 12, Electronics City Phase 1, Bengaluru, Karnataka 560100';

  const defaultLat = isHosur ? '12.742253' : '12.867697';
  const defaultLng = isHosur ? '77.824213' : '77.666721';
  const defaultRadius = isHosur ? '15.0' : '5.0';

  const [address, setAddress] = useState(deliverySettings.address || defaultAddress);
  const [lat, setLat] = useState(deliverySettings.hubLatitude || defaultLat);
  const [lng, setLng] = useState(deliverySettings.hubLongitude || defaultLng);
  const [radius, setRadius] = useState(deliverySettings.radiusKm || defaultRadius);
  const [isActive, setIsActive] = useState(true);

  // Sync state whenever selectedHubId changes from top header bar
  useEffect(() => {
    setAddress(isHosur ? 'Plot 45, Sipcot Industrial Complex Phase 1, Hosur - 635126' : 'Building 12, Electronics City Phase 1, Bengaluru, Karnataka 560100');
    setLat(isHosur ? '12.742253' : '12.867697');
    setLng(isHosur ? '77.824213' : '77.666721');
    setRadius(isHosur ? '15.0' : '5.0');
  }, [selectedHubId, isHosur]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(address, lat, lng, radius);
    showToast(`Saved delivery service area & hub map radius for ${hubTitle}!`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.65rem', fontWeight: 800, color: '#111827', margin: 0 }}>
              Service Area &amp; Hub Map
            </h2>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: isHosur ? '#059669' : '#0284C7',
              backgroundColor: isHosur ? '#ECFDF5' : '#E0F2FE',
              border: `1px solid ${isHosur ? '#A7F3D0' : '#BAE6FD'}`,
              padding: '3px 12px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <MapPin size={13} /> {hubTitle}
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '4px' }}>
            Active operational details, GPS coordinates, and doorstep delivery radius map for <strong>{hubTitle}</strong>.
          </p>
        </div>
      </div>

      {/* 2-Column Layout showing ONLY the Active Selected Hub (Hosur or Bangalore) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem' }}>
        
        {/* LEFT COLUMN: Active Hub Details & Edit Form */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.1rem', margin: 0, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={18} style={{ color: '#047857' }} /> Edit Active Hub Operations
            </h3>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', backgroundColor: '#ECFDF5', padding: '3px 10px', borderRadius: '10px' }}>
              {isHosur ? 'Hosur Sector 1 & 2' : 'Electronic City Phase 1 & 2'}
            </span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>HUB NAME / TITLE</label>
              <input
                type="text"
                value={hubTitle}
                readOnly
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', color: '#111827', fontSize: '0.88rem', fontWeight: 700, marginTop: '4px', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>CITY</label>
                <input
                  type="text"
                  value={hubCity}
                  readOnly
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', color: '#111827', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>STATE</label>
                <input
                  type="text"
                  value={hubState}
                  readOnly
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', color: '#111827', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>OPERATIONAL STREET ADDRESS</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', color: '#111827', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>HUB LATITUDE</label>
                <input
                  type="text"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', color: '#111827', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>HUB LONGITUDE</label>
                <input
                  type="text"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', color: '#111827', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>MAXIMUM DELIVERY RADIUS (KM)</label>
              <input
                type="text"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', color: '#111827', fontSize: '0.88rem', fontWeight: 800, marginTop: '4px', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <input
                type="checkbox"
                id="activeHubCheck"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#047857' }}
              />
              <label htmlFor="activeHubCheck" style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111827', cursor: 'pointer' }}>
                Active Operational Hub Branch
              </label>
            </div>

            <button
              type="submit"
              style={{
                padding: '0.75rem 1.25rem',
                fontSize: '0.88rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '0.5rem',
                backgroundColor: '#047857',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer'
              }}
            >
              <Save size={16} /> Save Hub Settings
            </button>
          </form>

        </div>

        {/* RIGHT COLUMN: Scoped Google Maps Location Preview */}
        <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.1rem', margin: 0, color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapIcon size={18} style={{ color: '#047857' }} /> Google Maps Hub Location
            </h3>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isHosur ? '#059669' : '#0284C7', backgroundColor: isHosur ? '#ECFDF5' : '#E0F2FE', padding: '3px 10px', borderRadius: '10px' }}>
              {isHosur ? 'Hosur (15km Outline Map)' : 'Bangalore (5km Hub Radius)'}
            </span>
          </div>

          {/* Dynamic Google Maps Iframe Scoped to Hosur / Bangalore */}
          <div style={{ position: 'relative', width: '100%', height: '280px', borderRadius: '14px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
            <iframe
              title="Active Hub Map"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              src={`https://maps.google.com/maps?q=${lat},${lng}&z=${isHosur ? 12 : 14}&output=embed`}
            />
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              padding: '6px 14px',
              borderRadius: '20px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#111827',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Compass size={14} style={{ color: '#047857' }} />
              {isHosur ? 'Hosur Central Hub (15km Coverage)' : 'Bangalore - Electronic City Hub (5km Coverage)'}
            </div>
          </div>

          {/* Delivery Bounds Info */}
          <div style={{ backgroundColor: '#F9FAFB', padding: '1rem', borderRadius: '12px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Navigation size={15} style={{ color: '#047857' }} />
              <span>Doorstep Delivery Coverage Zone:</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#4B5563', lineHeight: '1.4' }}>
              {isHosur 
                ? 'Hosur Central Hub delivers to Sipcot Ph 1 & 2, Bagalur Road, Mathigiri, & Zuzuvadi with full 15.0 KM outline radius.' 
                : 'Bangalore Electronic City Hub delivers to Electronic City Phase 1, Phase 2, Wipro Gate, & Velankani Tech Park within strict 5.0 KM hub radius.'
              }
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
