import { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, secondaryAuth } from '../../firebase';

interface DispatchRegisterPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedHubId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function DispatchRegisterPartnerModal({
  isOpen,
  onClose,
  selectedHubId,
  showToast
}: DispatchRegisterPartnerModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('delivery123');
  const [formAddress, setFormAddress] = useState('');
  const [formZone, setFormZone] = useState('');
  const [formHubId, setFormHubId] = useState(selectedHubId || 'hub_hosur');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone || !formEmail) {
      showToast("Name, Phone, and Email are required", "error");
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

      showToast(`Delivery Partner "${formName}" onboarded successfully!`, "success");
      onClose();
    } catch (error: any) {
      showToast("Failed to onboard delivery partner: " + error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      fontFamily: "'Poppins', sans-serif"
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.5rem',
        width: '100%', maxWidth: '500px', textAlign: 'left', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={20} style={{ color: '#044E35' }} /> Register Delivery Partner
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>Partner Full Name *</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              required
              style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>Mobile Phone Number *</label>
            <input
              type="text"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              required
              style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>Email Address (for App Login) *</label>
            <input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="e.g. ramesh@milkylush.com"
              required
              style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>Login Password *</label>
            <input
              type="text"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder="Enter password (default: delivery123)"
              required
              style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>Assigned Delivery Zone</label>
            <input
              type="text"
              value={formZone}
              onChange={(e) => setFormZone(e.target.value)}
              placeholder="e.g. Sector 1 & 2 / E-City Phase 1"
              style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>Assigned Operations Hub *</label>
            <select
              value={formHubId}
              onChange={(e) => setFormHubId(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginTop: '4px', backgroundColor: '#FFFFFF', outline: 'none' }}
            >
              <option value="hub_hosur">Hosur Central Hub (Hosur)</option>
              <option value="hub_bengaluru">Bengaluru Electronic City Hub (Bengaluru)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', cursor: 'pointer', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', backgroundColor: '#044E35', color: '#FFFFFF', border: 'none', cursor: 'pointer', fontWeight: 700 }}
            >
              {isSaving ? 'Onboarding...' : 'Onboard Partner'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
