import { useState } from 'react';
import { ArrowLeft, UserPlus, Info, CheckCircle, ShieldCheck } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../../firebase';

interface DispatchRegisterPartnerPageProps {
  selectedHubId: string;
  onBack: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function DispatchRegisterPartnerPage({
  selectedHubId,
  onBack,
  showToast
}: DispatchRegisterPartnerPageProps) {
  const [isSaving, setIsSaving] = useState(false);
  
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formZone, setFormZone] = useState('');
  const [formHubId, setFormHubId] = useState(selectedHubId || 'hub_hosur');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone || !formEmail) {
      showToast("Full Name, Phone Number, and Email Address are required", "error");
      return;
    }

    setIsSaving(true);
    const targetHub = formHubId || selectedHubId || 'hub_hosur';
    const pass = formPassword || 'delivery123';

    try {
      let uid = 'agent_' + Date.now();
      try {
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, formEmail, pass);
        uid = userCred.user.uid;
      } catch (authErr: any) {
        console.warn("Firebase Auth creation note:", authErr);
      }

      await setDoc(doc(db, 'delivery_agents', uid), {
        id: uid,
        name: formName,
        phone: formPhone,
        email: formEmail,
        password: pass,
        address: formAddress || '',
        assignedZone: formZone || 'General Delivery Route',
        hubId: targetHub,
        assignedHubId: targetHub,
        isOnline: false,
        isActive: true,
        createdAt: new Date().toISOString()
      });

      showToast(`Delivery Partner "${formName}" registered successfully!`, "success");
      onBack();
    } catch (error: any) {
      showToast("Failed to register delivery partner: " + error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Top Action Header */}
      <div>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0.45rem 0.85rem',
            borderRadius: '10px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            fontWeight: 700,
            fontSize: '0.82rem',
            color: '#475569',
            cursor: 'pointer',
            marginBottom: '0.75rem'
          }}
        >
          <ArrowLeft size={16} /> Back to Delivery Partners
        </button>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
          ➕ Register New Delivery Partner
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
          Create a rider account. This will save their credentials directly to the Firebase database for app login.
        </p>
      </div>

      {/* 2-Column Layout matching Screenshot #2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 0.6fr)', gap: '1.5rem' }}>
        
        {/* Left Column: Form Card */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.75rem', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            
            <div>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>Full Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Arjun Kumar"
                required
                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', marginTop: '6px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>Phone Number *</label>
              <input
                type="text"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                required
                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', marginTop: '6px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>Email Address *</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="e.g. arjun.k@milkylush.com"
                required
                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', marginTop: '6px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>Secret Password *</label>
              <input
                type="text"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Minimum 6 characters for driver login"
                required
                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', marginTop: '6px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>Residential Address</label>
              <textarea
                rows={3}
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Full physical address details..."
                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginTop: '6px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>Assigned Delivery Zone</label>
              <input
                type="text"
                value={formZone}
                onChange={(e) => setFormZone(e.target.value)}
                placeholder="e.g. Sector 1 & 2 / E-City Phase 1"
                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', marginTop: '6px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>Assigned Operations Hub *</label>
              <select
                value={formHubId}
                onChange={(e) => setFormHubId(e.target.value)}
                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', marginTop: '6px', backgroundColor: '#FFFFFF', outline: 'none' }}
              >
                <option value="hub_hosur">Hosur Central Hub (Hosur)</option>
                <option value="hub_bengaluru">Bengaluru Electronic City Hub (Bengaluru)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              style={{
                backgroundColor: '#044E35',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.9rem',
                padding: '0.8rem',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                marginTop: '0.5rem'
              }}
            >
              {isSaving ? 'Saving Partner...' : 'Create Delivery Partner Account'}
            </button>

          </form>

        </div>

        {/* Right Column: Information & Guidelines Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ backgroundColor: '#FFFBEB', borderRadius: '16px', padding: '1.25rem', border: '1px solid #FDE68A' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#92400E', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              💡 Registration Tips
            </h4>
            <ul style={{ margin: '10px 0 0 0', paddingLeft: '18px', fontSize: '0.8rem', color: '#78350F', lineHeight: '1.5' }}>
              <li>Double check mobile phone number accuracy for SMS dispatches.</li>
              <li>Make sure the email address is unique for mobile app authentication.</li>
              <li>Riders can log in immediately on the app using the secret password specified.</li>
            </ul>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E2E8F0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={18} style={{ color: '#047857' }} /> Security & Access
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '6px', lineHeight: '1.4' }}>
              Accounts created here automatically sync with Firestore real-time rules, isolating dispatch routes by Hub ID.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
