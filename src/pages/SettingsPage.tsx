import React, { useState } from 'react';
import { Save, Moon, Sun, Edit3, Settings } from 'lucide-react';

interface SettingsPageProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function SettingsPage({ theme, onToggleTheme, showToast }: SettingsPageProps) {
  const [adminProfile, setAdminProfile] = useState({
    name: 'Tom Admin',
    email: 'tomadmin@gmail.com',
    role: 'Administrator',
    securityLevel: 'Root Owner Access',
    connectionStatus: 'Active Firestore Snapshots'
  });

  const [fcmKey, setFcmKey] = useState(() => localStorage.getItem('fcm_server_key') || '');
  const [emailWebhook, setEmailWebhook] = useState(() => localStorage.getItem('email_webhook_url') || '');
  const [getgabsApiKey, setGetgabsApiKey] = useState(() => localStorage.getItem('GETGABS_API_KEY') || '');
  const [getgabsTemplate, setGetgabsTemplate] = useState(() => localStorage.getItem('GETGABS_WELCOME_TEMPLATE') || 'milkylush_welcome');
  const [getgabsSender, setGetgabsSender] = useState(() => localStorage.getItem('GETGABS_SENDER_NUMBER') || '919902882332');

  // Edit Profile Modal state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState(adminProfile.name);
  const [editEmail, setEditEmail] = useState(adminProfile.email);
  const [editPassword, setEditPassword] = useState('');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('fcm_server_key', fcmKey);
    localStorage.setItem('email_webhook_url', emailWebhook);
    localStorage.setItem('GETGABS_API_KEY', getgabsApiKey);
    localStorage.setItem('GETGABS_WELCOME_TEMPLATE', getgabsTemplate);
    localStorage.setItem('GETGABS_SENDER_NUMBER', getgabsSender);
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
      
      {/* Header Bar matching Screenshot 3 */}
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          MILKYLUSH PORTAL • HOSUR
        </div>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.65rem', fontWeight: 800, color: '#111827', margin: '2px 0 0 0' }}>
          System Settings
        </h2>
      </div>

      {/* 2-Column Top Section matching Screenshot 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', width: '100%' }}>
        
        {/* LEFT CARD: Admin Profile Card matching Screenshot 3 */}
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

        {/* RIGHT CARD: Theme Preferences & System Integrity matching Screenshot 3 */}
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

          {/* API Credentials */}
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                FCM Server Key (Firebase Cloud Messaging)
              </label>
              <input
                type="password"
                placeholder="AAAA..."
                value={fcmKey}
                onChange={(e) => setFcmKey(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Email Webhook URL
              </label>
              <input
                type="text"
                placeholder="https://api.milkylush.com/webhooks/email"
                value={emailWebhook}
                onChange={(e) => setEmailWebhook(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>

            {/* Getgabs WhatsApp Integration */}
            <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                💬 Getgabs WhatsApp Auto-Greeting
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Getgabs API Key
                  </label>
                  <input
                    type="password"
                    placeholder="Your Getgabs API Key"
                    value={getgabsApiKey}
                    onChange={(e) => setGetgabsApiKey(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Welcome Template Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. milkylush_welcome"
                    value={getgabsTemplate}
                    onChange={(e) => setGetgabsTemplate(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '4px' }}>
                    Must match your approved template name in Getgabs dashboard exactly (e.g. 7days_free_milk or milkylush_welcome).
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Registered WhatsApp Sender Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 919902882332"
                    value={getgabsSender}
                    onChange={(e) => setGetgabsSender(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '0.85rem', outline: 'none' }}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '4px' }}>
                    Your official business WhatsApp number registered in your Getgabs account (e.g. 919902882332).
                  </div>
                </div>

                <div style={{ backgroundColor: '#ECFDF5', borderRadius: '10px', padding: '0.75rem', border: '1px solid #A7F3D0', fontSize: '0.78rem', color: '#065F46' }}>
                  ✅ <strong>Auto-Greeting Active:</strong> When a new customer signs up via the MilkyLush mobile app and the admin panel is open, a WhatsApp welcome message will be sent automatically via Getgabs.
                </div>
              </div>
            </div>

            <button
              type="submit"
              style={{
                padding: '0.75rem',
                borderRadius: '10px',
                backgroundColor: '#047857',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.85rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Save size={16} /> Save System Settings
            </button>
          </form>

        </div>

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
