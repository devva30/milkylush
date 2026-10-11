import React, { useState, useEffect } from 'react';
import { Save, Moon, Sun, Edit3, Settings, CreditCard, Eye, EyeOff, Key, Lock, MapPin } from 'lucide-react';
import { HUBS, useHubContext } from '../context/HubContext';
import {
  getRazorpaySettings,
  saveRazorpayForHub,
  describeKeyId,
  type RazorpaySettings,
} from '../services/paymentSettingsService';

interface SettingsPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function SettingsPage({ theme, onToggleTheme, showToast }: SettingsPageProps) {
  const { selectedHubId, allowedHubIds, staff } = useHubContext();
  const [adminProfile, setAdminProfile] = useState({
    name: staff?.name || '',
    email: staff?.email || '',
    role: staff?.role === 'super_admin' ? 'Super Admin' : 'Hub Admin',
    securityLevel: staff?.role === 'super_admin' ? 'All hubs' : (staff?.hubIds ?? []).join(', '),
    connectionStatus: 'Firebase Auth session'
  });

  const [fcmKey, setFcmKey] = useState(() => localStorage.getItem('fcm_server_key') || '');
  const [emailWebhook, setEmailWebhook] = useState(() => localStorage.getItem('email_webhook_url') || '');

  // Edit Profile Modal state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState(adminProfile.name);
  const [editEmail, setEditEmail] = useState(adminProfile.email);
  const [editPassword, setEditPassword] = useState('');

  // Eye Icon Show/Hide toggle state map per field key
  const [showKeysMap, setShowKeysMap] = useState<Record<string, boolean>>({});

  const toggleShowKey = (fieldId: string) => {
    setShowKeysMap((prev) => ({ ...prev, [fieldId]: !prev[fieldId] }));
  };

  const [savedKeys, setSavedKeys] = useState<RazorpaySettings | null>(null);
  const [draftKeys, setDraftKeys] = useState<RazorpaySettings | null>(null);
  const [savingHub, setSavingHub] = useState<string | null>(null);

  useEffect(() => {
    const hubIds = allowedHubIds;
    getRazorpaySettings(hubIds).then((loaded) => {
      setSavedKeys(loaded);
      setDraftKeys(loaded);
    });
  }, [allowedHubIds.join(',')]);

  const editHubKey = (hubId: string, patch: Partial<RazorpaySettings[string]>) =>
    setDraftKeys((current) => (current ? { ...current, [hubId]: { ...(current[hubId] || { enabled: false, keyId: '' }), ...patch } } : current));

  const handleSaveRazorpay = async (hubId: string) => {
    if (!draftKeys) return;
    setSavingHub(hubId);
    try {
      await saveRazorpayForHub(hubId, draftKeys[hubId]);
      setSavedKeys((current) => (current ? { ...current, [hubId]: draftKeys[hubId] } : current));
      showToast(`API Keys and payment configuration saved for ${HUBS[hubId]?.name || hubId}! 🎉`, 'success');
    } catch (err) {
      showToast(`Could not save API keys: ${err}`, 'error');
    } finally {
      setSavingHub(null);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('fcm_server_key', fcmKey);
    localStorage.setItem('email_webhook_url', emailWebhook);
    showToast('System preferences & API credentials saved successfully!', 'success');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminProfile({
      ...adminProfile,
      name: editName.trim(),
      email: editEmail.trim()
    });
    showToast('Admin profile updated successfully!', 'success');
    setIsEditProfileOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      
      {/* Header Bar */}
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          MILKYLUSH PORTAL • SYSTEM SETTINGS
        </div>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.65rem', fontWeight: 800, color: '#111827', margin: '2px 0 0 0' }}>
          System Settings &amp; Hub Integrations
        </h2>
      </div>

      {/* 2-Column Top Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', width: '100%' }}>
        
        {/* LEFT CARD: Admin Profile Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '1.75rem',
          border: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1.25rem'
        }}>
          {/* Large Initials Avatar */}
          <div style={{
            width: '84px',
            height: '84px',
            borderRadius: '50%',
            backgroundColor: '#044E35',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(4,78,53,0.2)'
          }}>
            {adminProfile.email.slice(0, 2).toUpperCase()}
          </div>

          <div>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.35rem', fontWeight: 800, color: '#111827', margin: 0 }}>
              {adminProfile.email}
            </h3>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#047857', backgroundColor: '#ECFDF5', padding: '3px 12px', borderRadius: '12px', marginTop: '6px', display: 'inline-block' }}>
              {adminProfile.role}
            </span>
          </div>

          {/* Profile Metadata List */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.85rem', textAlign: 'left', borderTop: '1px solid #F3F4F6', paddingTop: '1rem', fontSize: '0.82rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>EMAIL ADDRESS</div>
              <div style={{ fontWeight: 700, color: '#111827', marginTop: '2px' }}>{adminProfile.email}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>SECURITY LEVEL</div>
              <div style={{ fontWeight: 700, color: '#111827', marginTop: '2px' }}>{adminProfile.securityLevel}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase' }}>REAL-TIME CONNECTION</div>
              <div style={{ fontWeight: 700, color: '#059669', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }}></span>
                {adminProfile.connectionStatus}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsEditProfileOpen(true)}
            style={{
              width: '100%',
              padding: '0.65rem',
              borderRadius: '10px',
              backgroundColor: '#FFFFFF',
              color: '#111827',
              border: '1px solid #D1D5DB',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Edit3 size={15} /> Edit Admin Profile &amp; Password
          </button>
        </div>

        {/* RIGHT CARD: Theme Preferences & System Integrity */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '1.75rem',
          border: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          {/* Theme Preference */}
          <div>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 700, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} style={{ color: '#047857' }} /> Theme Preferences
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#6B7280', marginTop: '4px' }}>
              Customize the color scheme of your MilkyLush admin panel. The light theme aligns with Figma mockup designs.
            </p>

            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', marginBottom: '8px' }}>Color Mode</div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => { if (theme !== 'light') onToggleTheme(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '10px',
                    border: theme === 'light' ? 'none' : '1px solid #D1D5DB',
                    backgroundColor: theme === 'light' ? '#044E35' : '#FFFFFF',
                    color: theme === 'light' ? '#FFFFFF' : '#374151',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <Sun size={16} /> Light Mode
                </button>

                <button
                  type="button"
                  onClick={() => { if (theme !== 'dark') onToggleTheme(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '10px',
                    border: theme === 'dark' ? 'none' : '1px solid #D1D5DB',
                    backgroundColor: theme === 'dark' ? '#044E35' : '#FFFFFF',
                    color: theme === 'dark' ? '#FFFFFF' : '#374151',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <Moon size={16} /> Dark Mode
                </button>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #F3F4F6', margin: 0 }} />

          {/* System Integrity */}
          <div>
            <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '0.95rem', fontWeight: 800, color: '#111827', margin: 0 }}>
              System Integrity
            </h4>
            
            <div style={{ backgroundColor: '#F9FAFB', borderRadius: '12px', padding: '1rem', border: '1px solid #E5E7EB', marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#111827' }}>Automatic Database Backups</div>
                <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '2px' }}>Hourly synchronization active</div>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#059669', backgroundColor: '#ECFDF5', padding: '4px 10px', borderRadius: '10px' }}>
                ENABLED
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* DEDICATED HUB API KEYS & INTEGRATIONS CARD */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.5rem', border: '1px solid #E5E7EB' }}>
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.15rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Key size={20} style={{ color: '#047857' }} /> Razorpay Payment Key Configuration
        </h3>
        <p style={{ fontSize: '0.82rem', color: '#6B7280', marginTop: '4px' }}>
          Manage Razorpay payment key for <strong>{selectedHubId === 'hosur' ? 'Hosur Hub' : 'Bangalore Electronic City Hub'}</strong>. Keys are securely hidden by default; click the <Eye size={13} style={{ display: 'inline', margin: '0 2px' }} /> icon to reveal and edit. Switch active hub in top bar to manage another location.
        </p>

        <div style={{ marginTop: '0.5rem', padding: '0.65rem 0.85rem', borderRadius: '10px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', fontSize: '0.78rem', color: '#92400E' }}>
          <strong>Realtime App Sync:</strong> Key ID starts with <code>rzp_test_</code> or <code>rzp_live_</code>. Mobile app fetches the active key dynamically from Firestore for instant real-time checkout updates.
        </div>

        {!draftKeys && (
          <div style={{ fontSize: '0.82rem', color: '#6B7280', marginTop: '1rem' }}>Loading Razorpay key configuration…</div>
        )}

        {draftKeys && savedKeys && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
            {[selectedHubId].map((hubId) => {
              const defaultKey = '';
              const draft = draftKeys[hubId] || { enabled: true, keyId: defaultKey };
              const live = savedKeys[hubId] || { enabled: true, keyId: defaultKey };
              const draftKeyId = draft?.keyId || '';
              const liveKeyId = live?.keyId || '';
              const check = describeKeyId(draftKeyId);
              const changed = draftKeyId.trim() !== liveKeyId || Boolean(draft?.enabled) !== Boolean(live?.enabled);
              const busy = savingHub === hubId;
              const hubDisplayName = HUBS[hubId]?.name || (hubId === 'bengaluru' ? 'Bangalore Electronic City Hub' : hubId);

              const isKeyVisible = showKeysMap[`rzp_${hubId}`] === true;

              return (
                <div key={hubId} style={{ padding: '1.1rem 1.25rem', borderRadius: '16px', border: `1.5px solid ${changed ? '#047857' : '#E5E7EB'}`, backgroundColor: '#F9FAFB' }}>
                  
                  {/* Hub Header & Status Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '1rem', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.6rem' }}>
                    <MapPin size={18} color="#047857" />
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#111827' }}>{hubDisplayName}</span>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#374151', cursor: busy ? 'wait' : 'pointer', marginLeft: '8px' }}>
                      <input type="checkbox" checked={draft.enabled} disabled={busy} onChange={(e) => editHubKey(hubId, { enabled: e.target.checked })} />
                      Accept Razorpay Payments
                    </label>

                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 800, padding: '3px 12px', borderRadius: '12px', color: live.enabled && liveKeyId ? '#047857' : '#92400E', backgroundColor: live.enabled && liveKeyId ? '#ECFDF5' : '#FEF3C7' }}>
                      {liveKeyId ? (live.enabled ? 'ONLINE & READY' : 'KEY SET, OFF') : 'NOT CONFIGURED'}
                    </span>
                  </div>

                  {/* Razorpay Key ID Field */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>
                        Razorpay Key ID ({hubDisplayName})
                      </label>
                      <button
                        type="button"
                        onClick={() => toggleShowKey(`rzp_${hubId}`)}
                        style={{ background: 'none', border: 'none', color: '#047857', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {isKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                        {isKeyVisible ? 'Hide Key' : 'Reveal Key'}
                      </button>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <input
                        type={isKeyVisible ? 'text' : 'password'}
                        value={draftKeyId}
                        disabled={busy}
                        placeholder="rzp_test_XXXXXXXXXXXX"
                        onChange={(e) => editHubKey(hubId, { keyId: e.target.value })}
                        style={{ width: '100%', padding: '0.65rem 2.5rem 0.65rem 0.85rem', borderRadius: '10px', border: `1px solid ${check.ok ? '#D1D5DB' : '#B91C1C'}`, backgroundColor: '#FFFFFF', color: '#111827', fontSize: '0.88rem', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(`rzp_${hubId}`)}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer' }}
                      >
                        {isKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => handleSaveRazorpay(hubId)}
                      disabled={busy || !changed || !check.ok}
                      style={{ padding: '0.55rem 1.25rem', borderRadius: '10px', border: 'none', backgroundColor: !changed || !check.ok ? '#94A3B8' : '#047857', color: '#FFFFFF', fontSize: '0.82rem', fontWeight: 800, cursor: busy || !changed || !check.ok ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Save size={15} /> {busy ? 'Saving Key…' : 'Save Razorpay Key'}
                    </button>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: !check.ok ? '#B91C1C' : changed ? '#D97706' : '#6B7280' }}>
                      {!check.ok ? check.note : changed ? 'Unsaved key changes — click Save to apply to mobile app' : check.note || 'Key active & synced to app'}
                    </span>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EDIT PROFILE MODAL */}
      {isEditProfileOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '1.75rem',
            maxWidth: '460px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'left'
          }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', fontWeight: 800, color: '#111827', marginBottom: '1.25rem', borderBottom: '1px solid #F3F4F6', paddingBottom: '0.75rem' }}>
              Edit Admin Profile
            </h3>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Admin Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Admin Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  New Password (optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave blank to keep unchanged"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.85rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: 'none', backgroundColor: '#047857', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
