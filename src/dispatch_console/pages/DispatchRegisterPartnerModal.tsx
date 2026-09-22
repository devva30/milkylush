import { useState } from 'react';
import { X, UserPlus, ShieldCheck, Truck, BadgeCheck, MapPin } from 'lucide-react';
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
  
  // New Vehicle, License, and Recognition Badge Fields
  const [formVehicleNumber, setFormVehicleNumber] = useState('TN 29 AB 4521');
  const [formVehicleType, setFormVehicleType] = useState('Electric Scooter');
  const [formLicenseNumber, setFormLicenseNumber] = useState('DL-90823411');
  const [formLicenseValidity, setFormLicenseValidity] = useState('Valid till 2030');
  const [formRiderId, setFormRiderId] = useState('#ML-RIDER-' + Math.floor(1000 + Math.random() * 9000));
  const [formBadgeLevel, setFormBadgeLevel] = useState('Top Performer');
  const [formRecognitionTag, setFormRecognitionTag] = useState('Top Performer • 100% Bottle Return Rate');

  if (!isOpen) return null;

  const targetHub = selectedHubId || 'hub_hosur';
  const hubName = targetHub === 'hub_bengaluru' ? "Bangalore Central Hub (Bengaluru)" : "Hosur Central Hub (Hosur)";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone || !formEmail) {
      showToast("Name, Phone, and Email are required", "error");
      return;
    }

    setIsSaving(true);
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
        riderId: formRiderId,
        name: formName,
        phone: formPhone,
        email: formEmail,
        password: pass,
        address: formAddress || '',
        assignedVehicle: `${formVehicleNumber} • ${formVehicleType}`,
        vehicleNumber: formVehicleNumber,
        vehicleType: formVehicleType,
        drivingLicense: `${formLicenseNumber} • ${formLicenseValidity}`,
        licenseNumber: formLicenseNumber,
        licenseValidity: formLicenseValidity,
        recognitionBadge: formBadgeLevel,
        recognitionTag: formRecognitionTag,
        hubId: targetHub,
        assignedHubId: targetHub,
        isOnline: false,
        isActive: true,
        inactiveReason: '',
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
        width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={20} style={{ color: '#044E35' }} /> Register Delivery Partner
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
            <X size={20} />
          </button>
        </div>

        {/* Auto Hub Banner */}
        <div style={{ padding: '0.65rem 1rem', borderRadius: '10px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', fontSize: '0.8rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={16} /> Auto-assigned to logged admin hub: <span>{hubName}</span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#334155' }}>Rider ID Code *</label>
              <input
                type="text"
                value={formRiderId}
                onChange={(e) => setFormRiderId(e.target.value)}
                required
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginTop: '4px', outline: 'none', fontWeight: 700, color: '#044E35' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#334155' }}>Partner Full Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                required
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#334155' }}>Mobile Phone Number *</label>
              <input
                type="text"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                required
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#334155' }}>Email (Login ID) *</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="ramesh@milkylush.com"
                required
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#334155' }}>App Password *</label>
            <input
              type="text"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder="delivery123"
              required
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginTop: '4px', outline: 'none' }}
            />
          </div>

          {/* VEHICLE & IDENTITY DOCUMENTS SECTION */}
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '0.85rem', marginTop: '0.2rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#044E35', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.65rem' }}>
              <Truck size={16} /> Vehicle & Driving License Registration
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#475569' }}>Vehicle Registration No.</label>
                <input
                  type="text"
                  value={formVehicleNumber}
                  onChange={(e) => setFormVehicleNumber(e.target.value)}
                  placeholder="TN 29 AB 4521"
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', marginTop: '4px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#475569' }}>Vehicle Type</label>
                <select
                  value={formVehicleType}
                  onChange={(e) => setFormVehicleType(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', marginTop: '4px', backgroundColor: '#FFFFFF', outline: 'none' }}
                >
                  <option value="Electric Scooter">Electric Scooter</option>
                  <option value="Delivery Bike">Delivery Bike</option>
                  <option value="EV Mini Van">EV Mini Van</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.65rem' }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#475569' }}>Driving License No.</label>
                <input
                  type="text"
                  value={formLicenseNumber}
                  onChange={(e) => setFormLicenseNumber(e.target.value)}
                  placeholder="DL-90823411"
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', marginTop: '4px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#475569' }}>License Validity</label>
                <input
                  type="text"
                  value={formLicenseValidity}
                  onChange={(e) => setFormLicenseValidity(e.target.value)}
                  placeholder="Valid till 2030"
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', marginTop: '4px', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* RECOGNITION BADGE SECTION */}
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '0.85rem', marginTop: '0.2rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#D97706', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.65rem' }}>
              <BadgeCheck size={16} /> Initial Partner Recognition Tier
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#475569' }}>Badge Level</label>
                <select
                  value={formBadgeLevel}
                  onChange={(e) => {
                    const lvl = e.target.value;
                    setFormBadgeLevel(lvl);
                    if (lvl === 'Top Performer') setFormRecognitionTag('Top Performer • 100% Bottle Return Rate');
                    else if (lvl === 'Gold Partner') setFormRecognitionTag('Gold Partner • 99% On-Time Drops');
                    else if (lvl === 'Silver Partner') setFormRecognitionTag('Silver Partner • Verified Fleet Rider');
                    else if (lvl === 'Bronze Partner') setFormRecognitionTag('Bronze Partner • Active Rider');
                    else setFormRecognitionTag('Junior Partner • Onboarding Completed');
                  }}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', marginTop: '4px', backgroundColor: '#FFFFFF', outline: 'none' }}
                >
                  <option value="Top Performer">Top Performer (Gold)</option>
                  <option value="Gold Partner">Gold Partner</option>
                  <option value="Silver Partner">Silver Partner</option>
                  <option value="Bronze Partner">Bronze Partner</option>
                  <option value="Junior Partner">Junior Partner</option>
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#475569' }}>Recognition Subtitle Tag</label>
                <input
                  type="text"
                  value={formRecognitionTag}
                  onChange={(e) => setFormRecognitionTag(e.target.value)}
                  placeholder="Top Performer • 100% Bottle Return Rate"
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', marginTop: '4px', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
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
