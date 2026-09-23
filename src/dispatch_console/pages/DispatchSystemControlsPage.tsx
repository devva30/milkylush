import { useState, useEffect } from 'react';
import { Clock, Lock, Send, UserCheck, ShieldAlert, Sparkles, X, Check } from 'lucide-react';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import type { DeliveryAgent } from '../../types';

interface DispatchSystemControlsPageProps {
  selectedHubId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  deliveryAgents?: DeliveryAgent[];
}

export default function DispatchSystemControlsPage({
  selectedHubId,
  showToast,
  deliveryAgents = [],
}: DispatchSystemControlsPageProps) {
  const [statusMode, setStatusMode] = useState<'auto' | 'force-open' | 'force-closed'>('auto');
  const [openTime, setOpenTime] = useState('05:00');
  const [closeTime, setCloseTime] = useState('22:00');
  const [closedMessage, setClosedMessage] = useState(
    'Morning milk delivery shift is completed. Operations are closed. See you tomorrow at 5:00 AM!'
  );
  const [allowedRiders, setAllowedRiders] = useState<string[]>([]);
  const [selectedRiderToGrant, setSelectedRiderToGrant] = useState<string>('');

  // Notification Broadcast State
  const [alertTitle, setAlertTitle] = useState('Broadcasting Notice');
  const [alertMessage, setAlertMessage] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'system_settings', 'config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.statusMode) setStatusMode(data.statusMode);
          if (data.openTime) setOpenTime(data.openTime);
          if (data.closeTime) setCloseTime(data.closeTime);
          if (data.closedMessage) setClosedMessage(data.closedMessage);
          if (data.allowedRiders && Array.isArray(data.allowedRiders)) {
            setAllowedRiders(data.allowedRiders);
          }
        }
      } catch (e) {
        console.warn("Config load note:", e);
      }
    };
    fetchConfig();
  }, []);

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(
        doc(db, 'system_settings', 'config'),
        {
          statusMode,
          openTime,
          closeTime,
          closedMessage,
          allowedRiders,
          isAppOpen: statusMode === 'force-open' ? true : statusMode === 'force-closed' ? false : true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      showToast("App status and operational settings saved successfully!", "success");
    } catch (err: any) {
      showToast("Failed to update config: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGrantAccess = (agentId: string) => {
    if (!agentId) return;
    if (allowedRiders.includes(agentId)) {
      showToast("Rider already has custom access exception.", "info");
      return;
    }
    const updated = [...allowedRiders, agentId];
    setAllowedRiders(updated);
    setSelectedRiderToGrant('');
    const agent = deliveryAgents.find(a => a.id === agentId);
    showToast(`Granted exception access to "${agent?.name || 'Rider'}"! Save settings to apply.`, "success");
  };

  const handleRemoveAccess = (agentId: string) => {
    const updated = allowedRiders.filter(id => id !== agentId);
    setAllowedRiders(updated);
    showToast("Removed custom access exception. Save settings to apply.", "info");
  };

  const handleBroadcastAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertTitle.trim() || !alertMessage.trim()) {
      showToast("Please provide both an Alert Title and Message Text to broadcast.", "error");
      return;
    }

    setIsBroadcasting(true);
    try {
      const alertData = {
        title: alertTitle.trim(),
        message: alertMessage.trim(),
        hubId: selectedHubId,
        createdAt: new Date().toISOString(),
        timestamp: new Date().getTime(),
      };

      // Save to system_settings config for real-time app overlay listener
      await setDoc(
        doc(db, 'system_settings', 'config'),
        {
          latestAlert: alertData,
          broadcastAlert: alertData,
        },
        { merge: true }
      );

      // Add to broadcast history collection
      await addDoc(collection(db, 'system_notifications'), {
        ...alertData,
        sentAt: serverTimestamp(),
      });

      showToast(`Broadcast notice "${alertTitle}" sent to all active riders in ${selectedHubId}!`, "success");
      setAlertMessage('');
    } catch (err: any) {
      showToast("Failed to broadcast alert: " + err.message, "error");
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* 2-Column Grid Layout matching Image 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 0.75fr)', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column Card: App Operational Hours & Status */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.65rem', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
          
          {/* Card Title */}
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚙️ App Operational Hours &amp; Status
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '4px 0 0 0', lineHeight: 1.45 }}>
              Configure default operating hours and manual overrides. Toggling the app status to closed locks all rider dashboard screens in real-time.
            </p>
          </div>

          {/* Status Mode Override Selector */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '8px' }}>
              Status Mode Override
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              
              <button
                type="button"
                onClick={() => setStatusMode('auto')}
                style={{
                  padding: '0.75rem 0.6rem',
                  borderRadius: '12px',
                  border: statusMode === 'auto' ? '2px solid #044E35' : '1px solid #CBD5E1',
                  backgroundColor: statusMode === 'auto' ? '#044E35' : '#FFFFFF',
                  color: statusMode === 'auto' ? '#FFFFFF' : '#334155',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: statusMode === 'auto' ? '0 4px 12px rgba(4,78,53,0.18)' : 'none'
                }}
              >
                ⏰ Auto (Scheduled)
              </button>

              <button
                type="button"
                onClick={() => setStatusMode('force-open')}
                style={{
                  padding: '0.75rem 0.6rem',
                  borderRadius: '12px',
                  border: statusMode === 'force-open' ? '2px solid #059669' : '1px solid #CBD5E1',
                  backgroundColor: statusMode === 'force-open' ? '#ECFDF5' : '#FFFFFF',
                  color: statusMode === 'force-open' ? '#047857' : '#334155',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                🟢 Force Open
              </button>

              <button
                type="button"
                onClick={() => setStatusMode('force-closed')}
                style={{
                  padding: '0.75rem 0.6rem',
                  borderRadius: '12px',
                  border: statusMode === 'force-closed' ? '2px solid #DC2626' : '1px solid #CBD5E1',
                  backgroundColor: statusMode === 'force-closed' ? '#FEF2F2' : '#FFFFFF',
                  color: statusMode === 'force-closed' ? '#B91C1C' : '#334155',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                🔴 Force Closed
              </button>

            </div>
          </div>

          {/* Daily Operating Hours Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '6px' }}>
                Daily Open Time
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  placeholder="05:00"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem 0.65rem 2.2rem',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: '#1E293B',
                    outline: 'none',
                    backgroundColor: '#F8FAFC'
                  }}
                />
                <Clock size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '6px' }}>
                Daily Close Time
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  placeholder="22:00"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem 0.65rem 2.2rem',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: '#1E293B',
                    outline: 'none',
                    backgroundColor: '#F8FAFC'
                  }}
                />
                <Clock size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              </div>
            </div>
          </div>

          {/* Custom Closure Warning Message & Template Chips */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '6px' }}>
              Custom Closure Warning Message
            </label>
            <textarea
              rows={3}
              value={closedMessage}
              onChange={(e) => setClosedMessage(e.target.value)}
              placeholder="Enter message displayed to riders when operations are closed..."
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '12px',
                border: '1px solid #CBD5E1',
                fontSize: '0.82rem',
                color: '#1E293B',
                lineHeight: 1.45,
                outline: 'none',
                backgroundColor: '#FFFFFF',
                resize: 'none'
              }}
            />
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
              This notice is displayed to all riders immediately when the app status is closed.
            </div>

            {/* Template Suggestions Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '10px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>Use Template Suggestions:</span>
              
              <button
                type="button"
                onClick={() => setClosedMessage("Morning milk delivery shift is completed. Operations are closed. See you tomorrow at 5:00 AM!")}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                🥛 Morning Over
              </button>

              <button
                type="button"
                onClick={() => setClosedMessage("Dispatch operations are temporarily paused for warehouse inventory stock audit. Please stand by.")}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                🔍 Stock Audit
              </button>

              <button
                type="button"
                onClick={() => setClosedMessage("Deliveries temporarily suspended due to severe weather conditions. Stay safe!")}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                ⛈ Bad Weather
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #F1F5F9', margin: '4px 0' }} />

          {/* Custom Access Override (Rider Exceptions) */}
          <div>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              👤 Custom Access Override (Rider Exceptions)
            </h4>
            <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '3px 0 10px 0' }}>
              Grant specific riders complete access to use the mobile application even when the system is closed.
            </p>

            <select
              value={selectedRiderToGrant}
              onChange={(e) => {
                setSelectedRiderToGrant(e.target.value);
                if (e.target.value) handleGrantAccess(e.target.value);
              }}
              style={{
                width: '100%',
                padding: '0.65rem',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#334155',
                outline: 'none',
                backgroundColor: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              <option value="">-- Select Rider to Grant Access --</option>
              {deliveryAgents.map(a => (
                <option key={a.id} value={a.id}>
                  🚴 {a.name} ({a.phone || a.assignedZone || 'Rider'})
                </option>
              ))}
            </select>

            {/* Granted Riders List */}
            <div style={{ marginTop: '10px' }}>
              {allowedRiders.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontStyle: 'italic' }}>
                  No rider exceptions added yet.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {allowedRiders.map(riderId => {
                    const agent = deliveryAgents.find(a => a.id === riderId);
                    return (
                      <span
                        key={riderId}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '20px',
                          backgroundColor: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          color: '#047857',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        ✓ {agent?.name || riderId}
                        <button
                          type="button"
                          onClick={() => handleRemoveAccess(riderId)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#047857', padding: 0, display: 'flex' }}
                        >
                          <X size={14} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Primary Save Button */}
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={isSaving}
            style={{
              backgroundColor: '#044E35',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.92rem',
              padding: '0.85rem',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              marginTop: '0.5rem',
              boxShadow: '0 4px 14px rgba(4,78,53,0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isSaving ? 'Saving Settings...' : 'Save App Status Settings'}
          </button>

        </div>

        {/* Right Column Card: Send In-App Notification (Rider Alert) */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.65rem', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔔 Send In-App Notification (Rider Alert)
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '4px 0 0 0', lineHeight: 1.45 }}>
              Broadcast an instant push notice banner to the top of all active rider mobile screens. Useful for storm warnings, traffic alerts, or urgent announcements.
            </p>
          </div>

          <form onSubmit={handleBroadcastAlert} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '6px' }}>
                Alert Title
              </label>
              <input
                type="text"
                value={alertTitle}
                onChange={(e) => setAlertTitle(e.target.value)}
                placeholder="Broadcasting Notice"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#1E293B',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '6px' }}>
                Message Text
              </label>
              <textarea
                rows={4}
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                placeholder="e.g. Heavy rainfall expected. Please drive safely and wear reflective jackets."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                  color: '#1E293B',
                  lineHeight: 1.45,
                  outline: 'none',
                  resize: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isBroadcasting}
              style={{
                backgroundColor: '#F59E0B',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.92rem',
                padding: '0.85rem',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                marginTop: '0.5rem',
                boxShadow: '0 4px 14px rgba(245,158,11,0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Send size={16} /> {isBroadcasting ? 'Broadcasting Alert...' : 'Broadcast Live Alert Now'}
            </button>

          </form>

        </div>

      </div>

    </div>
  );
}
