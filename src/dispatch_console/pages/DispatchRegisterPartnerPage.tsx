import { useState } from 'react';
import { ArrowLeft, UserPlus, Info, CheckCircle, ShieldCheck, Share2, Copy, Send, Mail, MessageSquare, Printer, X } from 'lucide-react';
import { createRider } from '../../data/staff';
import type { HubId } from '../../data/hubs';

interface DispatchRegisterPartnerPageProps {
  selectedHubId: string;
  onBack: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface CreatedPartnerData {
  staffCode: string;
  name: string;
  phone: string;
  email: string;
  password: string;
  vehicleNumber: string;
  vehicleType: string;
  hubName: string;
}

export default function DispatchRegisterPartnerPage({
  selectedHubId,
  onBack,
  showToast
}: DispatchRegisterPartnerPageProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [createdPartner, setCreatedPartner] = useState<CreatedPartnerData | null>(null);
  
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formVehicleNumber, setFormVehicleNumber] = useState('');
  const [formVehicleType, setFormVehicleType] = useState('Electric Scooter');
  const [formLicenseNumber, setFormLicenseNumber] = useState('');
  const [formLicenseValidity, setFormLicenseValidity] = useState('');
  const [formHubId, setFormHubId] = useState(selectedHubId || 'hub_hosur');

  const getEffectiveHubId = (hubId?: string) => {
    if (!hubId) return 'hub_hosur';
    const lower = hubId.toLowerCase();
    if (lower.includes('bengaluru') || lower.includes('blr') || lower.includes('bangalore')) {
      return 'bengaluru';
    }
    return 'hub_hosur';
  };

  const activeHubId = getEffectiveHubId(selectedHubId);
  const targetHubName = activeHubId === 'bengaluru' 
    ? 'Bengaluru Electronic City Hub (Bengaluru)' 
    : 'Hosur Central Hub (Hosur)';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone || !formEmail || !formPassword) {
      showToast("Full Name, Phone Number, Email, and Password are required", "error");
      return;
    }
    setIsSaving(true);
    try {
      const { staffCode } = await createRider(selectedHubId as HubId, {
        name: formName, phone: formPhone, email: formEmail, password: formPassword, address: formAddress,
        vehicleNumber: formVehicleNumber, vehicleType: formVehicleType,
        licenseNumber: formLicenseNumber, licenseValidity: formLicenseValidity,
      });
      
      const newPartner = {
        staffCode,
        name: formName,
        phone: formPhone,
        email: formEmail,
        password: formPassword,
        vehicleNumber: formVehicleNumber,
        vehicleType: formVehicleType,
        hubName: targetHubName
      };
      setCreatedPartner(newPartner);
      showToast(`Delivery Partner "${formName}" registered successfully! Share credentials below.`, "success");
    } catch (error) {
      showToast((error as Error).message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const buildShareText = () => {
    if (!createdPartner) return '';
    return `🥛 *MilkyLush Rider Account Credentials*\n\nHello ${createdPartner.name},\nWelcome to MilkyLush Delivery Team! Here are your mobile app login details:\n\n👤 *Rider ID:* ${createdPartner.staffCode}\n📍 *Assigned Hub:* ${createdPartner.hubName}\n📧 *Email:* ${createdPartner.email}\n🔑 *Password:* ${createdPartner.password}\n🛵 *Vehicle:* ${createdPartner.vehicleType} (${createdPartner.vehicleNumber || 'N/A'})\n\n📲 Open your MilkyLush Delivery Partner App and log in with these credentials.`;
  };

  const handleCopyText = () => {
    const text = buildShareText();
    navigator.clipboard.writeText(text);
    showToast("Login credentials copied to clipboard!", "success");
  };

  const handleShareWhatsApp = () => {
    if (!createdPartner) return;
    const cleanPhone = createdPartner.phone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const text = encodeURIComponent(buildShareText());
    window.open(`https://wa.me/${phoneWithCode}?text=${text}`, '_blank');
  };

  const handleShareSMS = () => {
    if (!createdPartner) return;
    const text = encodeURIComponent(buildShareText());
    window.open(`sms:${createdPartner.phone}?body=${text}`, '_blank');
  };

  const handleShareEmail = () => {
    if (!createdPartner) return;
    const subject = encodeURIComponent("MilkyLush Rider App Login Credentials");
    const body = encodeURIComponent(buildShareText());
    window.open(`mailto:${createdPartner.email}?subject=${subject}&body=${body}`, '_blank');
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

      {/* 2-Column Layout */}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>Vehicle Reg. Number</label>
                <input
                  type="text"
                  value={formVehicleNumber}
                  onChange={(e) => setFormVehicleNumber(e.target.value)}
                  placeholder="e.g. TN 29 AB 4521"
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', marginTop: '6px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>Vehicle Type</label>
                <select
                  value={formVehicleType}
                  onChange={(e) => setFormVehicleType(e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', marginTop: '6px', backgroundColor: '#FFFFFF', outline: 'none' }}
                >
                  <option value="Electric Scooter">Electric Scooter</option>
                  <option value="Motorbike">Motorbike</option>
                  <option value="EV Mini Van">EV Mini Van</option>
                  <option value="Bicycle">Bicycle</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>Driving License</label>
                <input
                  type="text"
                  value={formLicenseNumber}
                  onChange={(e) => setFormLicenseNumber(e.target.value)}
                  placeholder="e.g. DL-90823411"
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', marginTop: '6px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>License Validity</label>
                <input
                  type="text"
                  value={formLicenseValidity}
                  onChange={(e) => setFormLicenseValidity(e.target.value)}
                  placeholder="e.g. Valid till 2030"
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', marginTop: '6px', outline: 'none' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>Assigned Operations Hub (Auto-Assigned)</label>
              <div style={{
                width: '100%',
                padding: '0.7rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.88rem',
                marginTop: '6px',
                backgroundColor: '#F8FAFC',
                fontWeight: 700,
                color: '#0F172A',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>📍 {targetHubName}</span>
              </div>
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

      {/* SHARE CREDENTIALS MODAL */}
      {createdPartner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '2rem', maxWidth: '520px', width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', textAlign: 'left', border: '1px solid #E2E8F0', position: 'relative'
          }}>
            <button
              onClick={() => { setCreatedPartner(null); onBack(); }}
              style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'none', cursor: 'pointer', color: '#64748B' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                  Partner Account Registered!
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>
                  Share credentials with {createdPartner.name} via WhatsApp, SMS, or Email.
                </p>
              </div>
            </div>

            {/* Credentials Card Preview */}
            <div style={{ backgroundColor: '#F8FAFC', border: '1px dashed #047857', borderRadius: '12px', padding: '1.15rem', margin: '1rem 0' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🆔 RIDER LOG-IN CREDENTIALS
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1E293B', marginTop: '8px' }}>
                Rider ID: <span style={{ color: '#047857' }}>{createdPartner.staffCode}</span>
              </div>
              <div style={{ fontSize: '0.84rem', color: '#334155', marginTop: '4px' }}>
                Hub: <strong>{createdPartner.hubName}</strong>
              </div>
              <div style={{ fontSize: '0.84rem', color: '#334155', marginTop: '4px' }}>
                Email / ID: <strong>{createdPartner.email}</strong>
              </div>
              <div style={{ fontSize: '0.84rem', color: '#334155', marginTop: '4px' }}>
                Password: <strong>{createdPartner.password}</strong>
              </div>
            </div>

            {/* Share Action Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1.25rem' }}>
              
              {/* WhatsApp Button */}
              <button
                onClick={handleShareWhatsApp}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '0.65rem', borderRadius: '10px', backgroundColor: '#25D366', color: '#FFFFFF',
                  fontWeight: 700, fontSize: '0.84rem', border: 'none', cursor: 'pointer'
                }}
              >
                <Send size={16} /> WhatsApp Share
              </button>

              {/* Copy Button */}
              <button
                onClick={handleCopyText}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '0.65rem', borderRadius: '10px', backgroundColor: '#047857', color: '#FFFFFF',
                  fontWeight: 700, fontSize: '0.84rem', border: 'none', cursor: 'pointer'
                }}
              >
                <Copy size={16} /> Copy Credentials
              </button>

              {/* SMS Button */}
              <button
                onClick={handleShareSMS}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '0.65rem', borderRadius: '10px', backgroundColor: '#3B82F6', color: '#FFFFFF',
                  fontWeight: 700, fontSize: '0.84rem', border: 'none', cursor: 'pointer'
                }}
              >
                <MessageSquare size={16} /> SMS Text
              </button>

              {/* Email Button */}
              <button
                onClick={handleShareEmail}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '0.65rem', borderRadius: '10px', backgroundColor: '#6366F1', color: '#FFFFFF',
                  fontWeight: 700, fontSize: '0.84rem', border: 'none', cursor: 'pointer'
                }}
              >
                <Mail size={16} /> Send Email
              </button>

            </div>

            <button
              onClick={() => { setCreatedPartner(null); onBack(); }}
              style={{
                width: '100%', marginTop: '1rem', padding: '0.65rem', borderRadius: '10px',
                backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 700, fontSize: '0.84rem', border: 'none', cursor: 'pointer'
              }}
            >
              Done & Return to Riders List
            </button>

          </div>
        </div>
      )}

    </div>
  );
}

