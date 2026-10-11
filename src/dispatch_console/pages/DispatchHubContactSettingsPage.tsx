import { useState, useEffect } from 'react';
import { PhoneCall, Mail, AlertTriangle, Target, Save, Building2, Plus, Trash2 } from 'lucide-react';
import { getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { hubDoc } from '../../data/hubs';
import { logAudit } from '../../utils/auditLogger';
import { DataState } from '../../components/common/DataState';

interface DispatchHubContactSettingsPageProps {
  selectedHubId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const defaultFaqs: FAQItem[] = [
  {
    id: 'faq_1',
    question: 'What should I do if a customer is unavailable?',
    answer: 'Unless explicitly requested otherwise, follow doorstep drop instructions (e.g. Leave at door). Always attach a photo proof of delivery using your camera.',
  },
  {
    id: 'faq_2',
    question: 'How are empty glass bottle returns logged?',
    answer: 'Count the bottles collected at the customer door and enter the number in the bottle counter screen. Hand over all bottles to your Hub Manager at shift end.',
  },
  {
    id: 'faq_3',
    question: 'What if bottle count differs from expected?',
    answer: 'Adjust the bottle stepper to match actual bottles received. The app automatically displays a warning banner and logs the count for hub auditing.',
  },
  {
    id: 'faq_4',
    question: 'How is my Partner Recognition Tier updated?',
    answer: 'Hub Managers update your recognition badge tier (Top Performer, Gold, Silver, Bronze) based on drop accuracy, on-time delivery rates, and bottle returns.',
  },
];

export default function DispatchHubContactSettingsPage({
  selectedHubId,
  showToast,
}: DispatchHubContactSettingsPageProps) {
  const activeHub = selectedHubId;
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Form State per Active Hub (empty until loaded — no placeholder numbers get saved)
  const [managerName, setManagerName] = useState<string>('');
  const [primaryPhone, setPrimaryPhone] = useState<string>('');
  const [additionalPhones, setAdditionalPhones] = useState<string>('');
  const [primaryEmail, setPrimaryEmail] = useState<string>('');
  const [additionalEmails, setAdditionalEmails] = useState<string>('');
  const [whatsappPhone, setWhatsappPhone] = useState<string>('');
  const [emergencySosPhone, setEmergencySosPhone] = useState<string>('');
  const [dailyDropTarget, setDailyDropTarget] = useState<number>(0);
  const [bottleReturnTarget, setBottleReturnTarget] = useState<number>(0);
  const [faqs, setFaqs] = useState<FAQItem[]>(defaultFaqs);

  // hubs/{hubId}/settings/contact — one doc the customer app (Help) and rider app (SOS, FAQs) read
  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = (await getDoc(hubDoc(activeHub, 'settings', 'contact'))).data() ?? {};
        setManagerName(data.managerName ?? '');
        setPrimaryPhone(data.phone ?? '');
        setAdditionalPhones(data.additionalPhones ?? '');
        setPrimaryEmail(data.email ?? '');
        setAdditionalEmails(data.additionalEmails ?? '');
        setWhatsappPhone(data.whatsapp ?? '');
        setEmergencySosPhone(data.sosPhone ?? '');
        setDailyDropTarget(data.dailyDropTarget ?? 0);
        setBottleReturnTarget(data.bottleReturnTarget ?? 0);
        setFaqs(Array.isArray(data.riderFaqs) && data.riderFaqs.length > 0 ? data.riderFaqs : defaultFaqs);
      } catch (err) {
        setLoadError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, [activeHub, reloadKey]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const contact = {
        managerName: managerName.trim(),
        phone: primaryPhone.trim(),
        additionalPhones: additionalPhones.trim(),
        email: primaryEmail.trim(),
        additionalEmails: additionalEmails.trim(),
        whatsapp: whatsappPhone.trim(),
        sosPhone: emergencySosPhone.trim(),
        dailyDropTarget: Number(dailyDropTarget) || 0,
        bottleReturnTarget: Number(bottleReturnTarget) || 0,
        riderFaqs: faqs,
      };
      await setDoc(hubDoc(activeHub, 'settings', 'contact'), { ...contact, updatedAt: serverTimestamp() }, { merge: true });
      await logAudit({
        hubId: activeHub, category: 'Hub Operations', action: 'Hub contacts, targets & FAQs saved',
        target: `hubs/${activeHub}/settings/contact`, after: { ...contact, riderFaqs: faqs.length },
      });
      showToast(`Saved ${activeHub === 'bengaluru' ? 'Bengaluru Hub' : 'Hosur Hub'} contacts & FAQs!`, 'success');
    } catch (err) {
      showToast('Failed to save hub settings: ' + (err as Error).message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFaq = () => {
    const newFaq: FAQItem = {
      id: `faq_${Date.now()}`,
      question: 'New Frequently Asked Question',
      answer: 'Provide a clear answer for delivery partners.',
    };
    setFaqs([...faqs, newFaq]);
  };

  const handleUpdateFaq = (id: string, field: 'question' | 'answer', value: string) => {
    setFaqs(faqs.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleDeleteFaq = (id: string) => {
    setFaqs(faqs.filter(f => f.id !== id));
  };

  const hubTitle = activeHub === 'bengaluru' ? 'Bengaluru Hub' : 'Hosur Hub';

  return (
    <DataState loading={isLoading} error={loadError} onRetry={() => setReloadKey((k) => k + 1)} loadingLabel="Loading hub contacts…">
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PhoneCall size={24} style={{ color: '#047857' }} /> Hub Contacts, FAQs & Target Settings
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
            Configure isolated phone numbers, extra call contacts, support emails, WhatsApp, FAQs, and daily targets for <strong>{hubTitle}</strong>.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          style={{
            backgroundColor: '#047857',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '0.84rem',
            padding: '0.6rem 1.25rem',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(4, 120, 87, 0.25)'
          }}
        >
          <Save size={16} /> {isSaving ? 'Saving Settings...' : `Save ${activeHub === 'bengaluru' ? 'Bengaluru' : 'Hosur'} Settings`}
        </button>
      </div>

      {/* Active Hub Info Banner */}
      <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '0.85rem 1.2rem', borderRadius: '12px', fontSize: '0.82rem', color: '#047857', fontWeight: 700 }}>
        📍 Active Hub Focus: <strong>{hubTitle}</strong>. Saving updates strictly this hub's contacts, FAQs, and targets without affecting other hubs.
      </div>

      {/* Settings Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
        
        {/* 1. Hub Manager & Multiple Call Phone Numbers */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
            <PhoneCall size={20} style={{ color: '#047857' }} />
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>Call Dispatch & Manager Phone Numbers</h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>Add multiple callable phone numbers (triggers call pop-up in app)</p>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
              Hub Manager Name
            </label>
            <input
              type="text"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder="e.g. Hosur Hub Manager"
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.88rem',
                fontWeight: 600,
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
              Primary Dispatch Phone Number
            </label>
            <input
              type="text"
              value={primaryPhone}
              onChange={(e) => setPrimaryPhone(e.target.value)}
              placeholder="+919876543210"
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.88rem',
                fontWeight: 600,
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
              Additional Support Phone Numbers (Comma Separated)
            </label>
            <input
              type="text"
              value={additionalPhones}
              onChange={(e) => setAdditionalPhones(e.target.value)}
              placeholder="+919123456789, +919888877777"
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.88rem',
                fontWeight: 600,
                outline: 'none'
              }}
            />
            <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
              When multiple numbers are added, tapping "Call Dispatch" in app shows a call selection pop-up modal!
            </span>
          </div>
        </div>

        {/* 2. Help Center Support Emails & WhatsApp */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
            <Mail size={20} style={{ color: '#047857' }} />
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>Help Center Support Emails & WhatsApp</h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>Configure support email addresses and WhatsApp contact</p>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
              Primary Support Email
            </label>
            <input
              type="email"
              value={primaryEmail}
              onChange={(e) => setPrimaryEmail(e.target.value)}
              placeholder="support@milkylush.com"
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.88rem',
                fontWeight: 600,
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
              Additional Support Emails (Comma Separated)
            </label>
            <input
              type="text"
              value={additionalEmails}
              onChange={(e) => setAdditionalEmails(e.target.value)}
              placeholder="help@milkylush.com, dispatch@milkylush.com"
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.88rem',
                fontWeight: 600,
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
              WhatsApp Help Number
            </label>
            <input
              type="text"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="+919876543210"
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.88rem',
                fontWeight: 600,
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* 3. Emergency SOS Call Setting */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
            <AlertTriangle size={20} style={{ color: '#DC2626' }} />
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>Emergency SOS Direct Dial</h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>Rider Profile Emergency SOS direct alert phone number</p>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
              Emergency SOS Call Number
            </label>
            <input
              type="text"
              value={emergencySosPhone}
              onChange={(e) => setEmergencySosPhone(e.target.value)}
              placeholder="+919876543210"
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.88rem',
                fontWeight: 600,
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* 4. Hub Fixed Operations Targets */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
            <Target size={20} style={{ color: '#047857' }} />
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>Hub Fixed Target Operations</h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>Daily drop and bottle collection fixed targets for {activeHub}</p>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
              Fixed Daily Drop Target (Count)
            </label>
            <input
              type="number"
              value={dailyDropTarget}
              onChange={(e) => setDailyDropTarget(Number(e.target.value))}
              placeholder="150"
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.88rem',
                fontWeight: 600,
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
              Fixed Daily Bottle Collection Target (Count)
            </label>
            <input
              type="number"
              value={bottleReturnTarget}
              onChange={(e) => setBottleReturnTarget(Number(e.target.value))}
              placeholder="100"
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.88rem',
                fontWeight: 600,
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* 5. Dynamic Frequently Asked Questions (FAQs) Manager */}
        <div style={{ gridColumn: '1 / -1', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={20} style={{ color: '#047857' }} />
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>Help Center FAQs Management</h3>
                <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>Add, edit, or remove FAQs synced live to rider app Help Center for {hubTitle}</p>
              </div>
            </div>

            <button
              onClick={handleAddFaq}
              style={{
                backgroundColor: '#ECFDF5',
                color: '#047857',
                border: '1px solid #A7F3D0',
                borderRadius: '8px',
                padding: '0.5rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plus size={15} /> Add New FAQ
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {faqs.map((faq, index) => (
              <div
                key={faq.id}
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    FAQ #{index + 1}
                  </span>
                  <button
                    onClick={() => handleDeleteFaq(faq.id)}
                    title="Delete FAQ"
                    style={{
                      backgroundColor: '#FEE2E2',
                      color: '#DC2626',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.35rem 0.6rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Question:
                  </label>
                  <input
                    type="text"
                    value={faq.question}
                    onChange={(e) => handleUpdateFaq(faq.id, 'question', e.target.value)}
                    placeholder="Enter question..."
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Answer / Guidance:
                  </label>
                  <textarea
                    rows={2}
                    value={faq.answer}
                    onChange={(e) => handleUpdateFaq(faq.id, 'answer', e.target.value)}
                    placeholder="Enter answer detail..."
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
    </DataState>
  );
}
