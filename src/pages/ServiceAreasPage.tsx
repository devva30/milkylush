import React, { useState, useEffect } from 'react';
import { MapPin, Save, Navigation, Compass, Map as MapIcon, Building, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { GeoPoint, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLiveDoc } from '../data/useFirestore';
import { DataState } from '../components/common/DataState';
import { logAudit } from '../utils/auditLogger';

interface ServiceAreasPageProps {
  selectedHubId: string;
  /** Unused: the page reads and saves hubs/{hubId} itself. Kept so existing callers compile. */
  deliverySettings?: unknown;
  onSaveSettings?: unknown;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface HubDoc {
  address?: string;
  location?: GeoPoint;
  radiusKm?: number;
  active?: boolean;
}

export default function ServiceAreasPage({
  selectedHubId,
  showToast,
}: ServiceAreasPageProps) {
  const hub = useLiveDoc<HubDoc>(doc(db, 'hubs', selectedHubId), [selectedHubId]);
  const [saving, setSaving] = useState(false);
  const isHosur = selectedHubId === 'hosur' || selectedHubId.includes('hosur');

  const hubTitle = isHosur ? 'Hosur - Central Hub (TN)' : 'Bangalore - Electronic City Hub (KA)';
  const hubCity = isHosur ? 'Hosur' : 'Bangalore';
  const hubState = isHosur ? 'Tamil Nadu' : 'Karnataka';

  const defaultAddress = isHosur
    ? 'Plot 45, Sipcot Industrial Complex Phase 1, Hosur - 635126'
    : 'Building 12, Electronics City Phase 1, Bengaluru, Karnataka 560100';

  const defaultLat = isHosur ? '12.742253' : '12.867697';
  const defaultLng = isHosur ? '77.824213' : '77.666721';
  const defaultRadius = isHosur ? '15.0' : '5.0';

  const [address, setAddress] = useState(defaultAddress);
  const [lat, setLat] = useState(defaultLat);
  const [lng, setLng] = useState(defaultLng);
  const [radius, setRadius] = useState(defaultRadius);
  const [isActive, setIsActive] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(isHosur ? 12 : 13);

  // Fill the form from the hub document whenever it loads or the hub changes
  useEffect(() => {
    const deliverySettings = hub.data && {
      address: hub.data.address ?? '',
      hubLatitude: hub.data.location ? String(hub.data.location.latitude) : '',
      hubLongitude: hub.data.location ? String(hub.data.location.longitude) : '',
      radiusKm: hub.data.radiusKm != null ? String(hub.data.radiusKm) : '',
    };
    setIsActive(hub.data?.active ?? false);
    const fallbackAddress = isHosur ? 'Plot 45, Sipcot Industrial Complex Phase 1, Hosur - 635126' : 'Building 12, Electronics City Phase 1, Bengaluru, Karnataka 560100';
    const fallbackLat = isHosur ? '12.742253' : '12.867697';
    const fallbackLng = isHosur ? '77.824213' : '77.666721';
    const fallbackRadius = isHosur ? '15.0' : '5.0';

    if (deliverySettings) {
      setAddress(deliverySettings.address || fallbackAddress);
      setLat(deliverySettings.hubLatitude ? String(deliverySettings.hubLatitude) : fallbackLat);
      setLng(deliverySettings.hubLongitude ? String(deliverySettings.hubLongitude) : fallbackLng);
      setRadius(deliverySettings.radiusKm ? String(deliverySettings.radiusKm) : fallbackRadius);
    } else {
      setAddress(fallbackAddress);
      setLat(fallbackLat);
      setLng(fallbackLng);
      setRadius(fallbackRadius);
    }
    setZoomLevel(isHosur ? 12 : 13);
  }, [selectedHubId, hub.data, isHosur]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = parseFloat(radius);
    if (!(Math.abs(latitude) <= 90) || !(Math.abs(longitude) <= 180) || !(radiusKm > 0)) {
      showToast('Enter a valid latitude, longitude and a radius above 0 KM.', 'error');
      return;
    }
    setSaving(true);
    try {
      const data = { address: address.trim(), location: new GeoPoint(latitude, longitude), radiusKm, active: isActive };
      await setDoc(doc(db, 'hubs', selectedHubId), { ...data, updatedAt: serverTimestamp() }, { merge: true });
      await logAudit({
        hubId: selectedHubId,
        category: 'Hub Operations',
        action: `Service area saved: ${radiusKm} KM, ${isActive ? 'active' : 'inactive'}`,
        target: `hubs/${selectedHubId}`,
        after: { address: data.address, latitude, longitude, radiusKm, active: isActive },
      });
      showToast(`Saved delivery service area & hub map radius (${radiusKm} KM) for ${hubTitle}!`, 'success');
    } catch (err) {
      showToast(`Could not save service area: ${(err as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const latNum = parseFloat(lat) || (isHosur ? 12.742253 : 12.867697);
  const lngNum = parseFloat(lng) || (isHosur ? 77.824213 : 77.666721);
  const numericRadius = parseFloat(radius) || (isHosur ? 15.0 : 5.0);

  // Dynamic Leaflet HTML for rendered map canvas inside iframe
  const leafletSrcDoc = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background-color: #f8fafc; }
        .leaflet-popup-content-wrapper { border-radius: 12px; font-family: sans-serif; font-size: 13px; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', { zoomControl: false }).setView([${latNum}, ${lngNum}], ${zoomLevel});
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        const hubPinSvg = \`<div style="background-color: ${isHosur ? '#047857' : '#0284C7'}; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">📍</div>\`;
        
        const hubIcon = L.divIcon({
          className: 'custom-hub-pin',
          html: hubPinSvg,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        L.marker([${latNum}, ${lngNum}], { icon: hubIcon })
          .addTo(map)
          .bindPopup("<b>${hubTitle.replace(/'/g, "\\'")}</b><br/>${address.replace(/'/g, "\\'")}<br/><b>Radius:</b> ${numericRadius} KM");

        // Delivery area = this circle (hub location + radius); the customer app checks the same circle.
        L.circle([${latNum}, ${lngNum}], {
          radius: ${numericRadius * 1000},
          color: '${isHosur ? '#047857' : '#0284C7'}',
          weight: 3.5,
          dashArray: '6, 6',
          fillColor: '${isHosur ? '#047857' : '#0284C7'}',
          fillOpacity: 0.12
        }).addTo(map);
      </script>
    </body>
    </html>
  `;

  return (
    <DataState loading={hub.loading} error={hub.error} onRetry={hub.retry} loadingLabel="Loading hub settings…">
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>

      {/* Page Header */}
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
            Active operational details, GPS coordinates, and doorstep delivery boundary outline map for <strong>{hubTitle}</strong>.
          </p>
        </div>
      </div>

      {/* TOP HERO SECTION: Full Interactive Leaflet Hub Map with Polygon & Radius Border Line */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MapIcon size={22} style={{ color: isHosur ? '#047857' : '#0284C7' }} />
            <div>
              <h3 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.15rem', margin: 0, color: '#111827' }}>
                {isHosur ? 'Hosur Sector Boundary Outline Map' : 'Bangalore Electronic City Hub Radius Map'}
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                Interactive map displaying operational hub pin, outer boundary border, and real-time coverage radius ({numericRadius} KM).
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 1, 18))}
              title="Zoom In"
              style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 700 }}
            >
              <ZoomIn size={15} /> Zoom In
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 1, 8))}
              title="Zoom Out"
              style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 700 }}
            >
              <ZoomOut size={15} /> Zoom Out
            </button>
            <button
              onClick={() => setZoomLevel(isHosur ? 12 : 13)}
              title="Recenter"
              style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', border: `1px solid ${isHosur ? '#047857' : '#0284C7'}`, backgroundColor: isHosur ? '#ECFDF5' : '#E0F2FE', color: isHosur ? '#047857' : '#0284C7', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 700 }}
            >
              <RefreshCw size={14} /> Reset View
            </button>
          </div>
        </div>

        {/* Dynamic Leaflet Map Iframe with Outer Polygon/Circle Line */}
        <div style={{ position: 'relative', width: '100%', height: '420px', borderRadius: '16px', overflow: 'hidden', border: '2px solid #E5E7EB' }}>
          <iframe
            key={`${selectedHubId}_${latNum}_${lngNum}_${numericRadius}_${zoomLevel}`}
            title="Interactive Hub Location & Boundary Map"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            srcDoc={leafletSrcDoc}
          />

          {/* Floating Status & Radius Badge */}
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            padding: '10px 18px',
            borderRadius: '24px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            fontSize: '0.82rem',
            fontWeight: 800,
            color: '#111827',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid #E5E7EB'
          }}>
            <Compass size={16} style={{ color: isHosur ? '#047857' : '#0284C7' }} />
            <span>{isHosur ? `Hosur Hub Radius Border (${numericRadius} KM Circle)` : `Bangalore Hub Radius Border (${numericRadius} KM Circle)`}</span>
          </div>

          <div style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            color: '#FFFFFF',
            padding: '8px 16px',
            borderRadius: '12px',
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Navigation size={14} style={{ color: isHosur ? '#34D399' : '#38BDF8' }} />
            <span>Strict Service Boundary Enforced: GPS Radius {numericRadius} KM</span>
          </div>
        </div>

        {/* Coverage Legend Info */}
        <div style={{ backgroundColor: '#F9FAFB', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: isHosur ? '#047857' : '#0284C7' }}></div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827' }}>Hub Center GPS: {latNum}, {lngNum}</span>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#4B5563' }}>
            {isHosur 
              ? `Hosur Hub strictly restricts doorstep delivery within ${numericRadius} KM radius.` 
              : `Bangalore Electronic City Hub strictly restricts doorstep delivery within ${numericRadius} KM radius.`}
          </div>
        </div>

      </div>

      {/* BOTTOM SECTION: Edit Active Hub Operations Form */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F3F4F6', paddingBottom: '0.75rem' }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.15rem', margin: 0, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={20} style={{ color: isHosur ? '#047857' : '#0284C7' }} /> Edit Active Hub Operations
          </h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isHosur ? '#059669' : '#0284C7', backgroundColor: isHosur ? '#ECFDF5' : '#E0F2FE', padding: '4px 12px', borderRadius: '10px' }}>
            {isHosur ? 'Hosur Sector 1 & 2' : 'Electronic City Phase 1 & 2'}
          </span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>HUB NAME / TITLE</label>
            <input
              type="text"
              value={hubTitle}
              readOnly
              style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', color: '#111827', fontSize: '0.88rem', fontWeight: 700, marginTop: '4px', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>CITY</label>
              <input
                type="text"
                value={hubCity}
                readOnly
                style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', color: '#111827', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>STATE</label>
              <input
                type="text"
                value={hubState}
                readOnly
                style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', color: '#111827', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>OPERATIONAL STREET ADDRESS</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', color: '#111827', fontSize: '0.88rem', fontWeight: 600, marginTop: '4px', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>HUB LATITUDE</label>
              <input
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', color: '#111827', fontSize: '0.88rem', marginTop: '4px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>HUB LONGITUDE</label>
              <input
                type="text"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '10px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', color: '#111827', fontSize: '0.88rem', marginTop: '4px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: isHosur ? '#047857' : '#0284C7', textTransform: 'uppercase' }}>MAXIMUM DELIVERY RADIUS (KM)</label>
              <input
                type="text"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                placeholder="e.g. 15.0"
                style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '10px', border: `2px solid ${isHosur ? '#047857' : '#0284C7'}`, backgroundColor: isHosur ? '#ECFDF5' : '#E0F2FE', color: isHosur ? '#047857' : '#0284C7', fontSize: '0.95rem', fontWeight: 800, marginTop: '4px', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="activeHubCheck"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: isHosur ? '#047857' : '#0284C7' }}
              />
              <label htmlFor="activeHubCheck" style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111827', cursor: 'pointer' }}>
                Active Operational Hub Branch
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                opacity: saving ? 0.7 : 1,
                padding: '0.85rem 1.75rem',
                fontSize: '0.92rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: isHosur ? '#047857' : '#0284C7',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                boxShadow: isHosur ? '0 4px 6px -1px rgba(4, 120, 87, 0.2)' : '0 4px 6px -1px rgba(2, 132, 199, 0.2)'
              }}
            >
              <Save size={18} /> {saving ? 'Saving…' : 'Save Hub Settings & Update Map Bounds'}
            </button>
          </div>
        </form>

      </div>

    </div>
    </DataState>
  );
}
