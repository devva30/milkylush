import { useState, useEffect } from 'react';
import { Settings, Lock, Clock, ShieldCheck } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface DispatchSystemControlsPageProps {
  selectedHubId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function DispatchSystemControlsPage({ selectedHubId, showToast }: DispatchSystemControlsPageProps) {
  const [statusMode, setStatusMode] = useState<'auto' | 'force-open' | 'force-closed'>('auto');
  const [openTime, setOpenTime] = useState('05:00');
  const [closeTime, setCloseTime] = useState('22:00');
  const [closedMessage, setClosedMessage] = useState('MilkyLush operations are currently closed for the night. Deliveries resume at 05:00 AM.');
  const [isSaving, setIsSaving] = useState(false);

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
        }
      } catch (e) {
        console.warn("Config load note:", e);
      }
    };
    fetchConfig();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'system_settings', 'config'), {
        statusMode,
        openTime,
        closeTime,
        closedMessage,
        isAppOpen: statusMode === 'force-open' ? true : statusMode === 'force-closed' ? false : true,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      showToast("Dispatch System Controls updated successfully!", "success");
    } catch (err: any) {
      showToast("Failed to update config: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
          ⚙️ Dispatch System Controls & Schedules
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
          Configure operational dispatch hours, app status modes, and hub broadcast settings for {selectedHubId}.
        </p>
      </div>

      {/* Settings Form Card */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.5rem', border: '1px solid #E2E8F0', maxWidth: '650px' }}>
        
        <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div>
            <label style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={16} style={{ color: '#047857' }} /> Operation Mode Status
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '8px' }}>
              {(['auto', 'force-open', 'force-closed'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setStatusMode(mode)}
                  style={{
                    padding: '0.65rem 0.5rem',
                    borderRadius: '10px',
                    border: statusMode === mode ? '2px solid #047857' : '1px solid #CBD5E1',
                    backgroundColor: statusMode === mode ? '#ECFDF5' : '#FFFFFF',
                    color: statusMode === mode ? '#047857' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {mode === 'auto' ? '⏱ Auto Schedule' : mode === 'force-open' ? '🟢 Force Open' : '🔴 Force Closed'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155' }}>Opening Dispatch Time</label>
              <input
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155' }}>Closing Dispatch Time</label>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155' }}>Closed Announcement Message</label>
            <textarea
              rows={3}
              value={closedMessage}
              onChange={(e) => setClosedMessage(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', marginTop: '4px', outline: 'none' }}
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            style={{
              backgroundColor: '#044E35',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.88rem',
              padding: '0.75rem',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              marginTop: '0.5rem'
            }}
          >
            {isSaving ? 'Saving Settings...' : 'Save Dispatch Controls'}
          </button>

        </form>

      </div>

    </div>
  );
}
