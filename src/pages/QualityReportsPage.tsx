import { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit3, ShieldCheck, CheckCircle2, FileText, ExternalLink } from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

interface QualityReport {
  id: string;
  title: string;
  date: string;
  fat: string;
  snf: string;
  purity: string;
  labName: string;
  imageUrl: string;
  certificateUrl: string;
  active: boolean;
}

interface QualityReportsPageProps {
  selectedHubId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function QualityReportsPage({ showToast }: QualityReportsPageProps) {
  const [reports, setReports] = useState<QualityReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingReport, setEditingReport] = useState<QualityReport | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fat, setFat] = useState('4.5%');
  const [snf, setSnf] = useState('8.6%');
  const [purity, setPurity] = useState('100%');
  const [labName, setLabName] = useState('Central Dairy Analytics Lab (FSSAI Accredited)');
  const [imageUrl, setImageUrl] = useState('');
  const [certificateUrl, setCertificateUrl] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'quality_reports'), (snapshot) => {
      const list: QualityReport[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<QualityReport, 'id'>),
      }));
      setReports(list);
    });
    return () => unsub();
  }, []);

  const handleOpenAddModal = () => {
    setEditingReport(null);
    setTitle('A2 Pure Cow Milk Lab Purity Test');
    setDate(new Date().toISOString().slice(0, 10));
    setFat('4.5%');
    setSnf('8.6%');
    setPurity('100%');
    setLabName('Central Dairy Analytics Lab (FSSAI Accredited)');
    setImageUrl('https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600');
    setCertificateUrl('');
    setActive(true);
    setShowModal(true);
  };

  const handleEditModal = (r: QualityReport) => {
    setEditingReport(r);
    setTitle(r.title);
    setDate(r.date);
    setFat(r.fat);
    setSnf(r.snf);
    setPurity(r.purity);
    setLabName(r.labName);
    setImageUrl(r.imageUrl || '');
    setCertificateUrl(r.certificateUrl || '');
    setActive(r.active);
    setShowModal(true);
  };

  const handleSaveReport = async () => {
    if (!title.trim()) {
      showToast('Please enter a valid report title.', 'error');
      return;
    }
    try {
      const payload = {
        title: title.trim(),
        date,
        fat: fat.trim(),
        snf: snf.trim(),
        purity: purity.trim(),
        labName: labName.trim(),
        imageUrl: imageUrl.trim(),
        certificateUrl: certificateUrl.trim(),
        active,
        updatedAt: new Date().toISOString(),
      };

      if (editingReport) {
        await updateDoc(doc(db, 'quality_reports', editingReport.id), payload);
        showToast(`Updated lab report "${title}"`, 'success');
      } else {
        await addDoc(collection(db, 'quality_reports'), payload);
        showToast(`Added new quality report "${title}"`, 'success');
      }
      setShowModal(false);
    } catch (err) {
      showToast(`Error saving quality report: ${err}`, 'error');
    }
  };

  const handleDeleteReport = async (id: string, reportTitle: string) => {
    if (window.confirm(`Are you sure you want to delete lab report "${reportTitle}"?`)) {
      try {
        await deleteDoc(doc(db, 'quality_reports', id));
        showToast(`Deleted quality report "${reportTitle}"`, 'info');
      } catch (err) {
        showToast(`Error deleting report: ${err}`, 'error');
      }
    }
  };

  const filteredReports = reports.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.labName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Top Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main, #0F172A)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={24} style={{ color: '#047857' }} /> Milk Quality & Lab Audit Reports
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, #64748B)', margin: '2px 0 0 0' }}>
            Publish lab purity certificates, Fat %, SNF %, and antibiotic-free test audits for mobile app customers.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#047857',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '0.82rem',
            padding: '0.6rem 1.25rem',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} /> Add Lab Report
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ backgroundColor: 'var(--bg-card, #FFFFFF)', borderRadius: '16px', padding: '1rem', border: '1px solid var(--border-color, #E2E8F0)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search report title, lab name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.45rem 0.85rem 0.45rem 32px', borderRadius: '8px', border: '1px solid var(--border-color, #CBD5E1)', backgroundColor: 'var(--bg-card, #FFFFFF)', color: 'var(--text-main, #0F172A)', fontSize: '0.8rem', outline: 'none' }}
          />
        </div>
      </div>

      {/* Quality Reports Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
        {filteredReports.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--bg-card, #FFFFFF)', borderRadius: '16px', padding: '3rem', textAlign: 'center', border: '1px solid var(--border-color, #E2E8F0)', color: 'var(--text-muted, #64748B)' }}>
            No lab quality reports found. Click "Add Lab Report" to publish your first purity audit!
          </div>
        ) : (
          filteredReports.map((r) => (
            <div
              key={r.id}
              style={{
                backgroundColor: 'var(--bg-card, #FFFFFF)',
                borderRadius: '18px',
                border: r.active ? '1px solid #A7F3D0' : '1px solid var(--border-color, #E2E8F0)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                  <span style={{
                    padding: '3px 9px',
                    borderRadius: '9999px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    backgroundColor: r.active ? '#ECFDF5' : '#F1F5F9',
                    color: r.active ? '#047857' : '#64748B',
                    border: r.active ? '1px solid #A7F3D0' : '1px solid #E2E8F0'
                  }}>
                    {r.active ? 'ACTIVE ON MOBILE APP' : 'INACTIVE'}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => handleEditModal(r)}
                      style={{ padding: '5px', backgroundColor: 'transparent', border: 'none', color: 'var(--text-muted, #64748B)', cursor: 'pointer' }}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteReport(r.id, r.title)}
                      style={{ padding: '5px', backgroundColor: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main, #0F172A)', margin: '0 0 4px 0' }}>
                  {r.title}
                </h3>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #64748B)', marginBottom: '1rem' }}>
                  Tested on {r.date} · {r.labName}
                </div>

                {/* Key Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '1rem' }}>
                  <div style={{ backgroundColor: '#ECFDF5', borderRadius: '8px', padding: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#047857' }}>FAT</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#047857' }}>{r.fat}</div>
                  </div>
                  <div style={{ backgroundColor: '#FEF3C7', borderRadius: '8px', padding: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#B45309' }}>SNF</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#B45309' }}>{r.snf}</div>
                  </div>
                  <div style={{ backgroundColor: '#DCFCE7', borderRadius: '8px', padding: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#15803D' }}>PURITY</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#15803D' }}>{r.purity}</div>
                  </div>
                </div>
              </div>

              {r.certificateUrl && (
                <a
                  href={r.certificateUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: '#047857',
                    textDecoration: 'underline'
                  }}
                >
                  <FileText size={14} /> View Certificate PDF <ExternalLink size={12} />
                </a>
              )}
            </div>
          ))
        )}
      </div>

      {/* Edit / Add Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ backgroundColor: 'var(--bg-card, #FFFFFF)', borderRadius: '20px', padding: '1.5rem', width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border-color, #E2E8F0)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main, #0F172A)' }}>
              {editingReport ? 'Edit Lab Quality Report' : 'Add New Lab Quality Report'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main, #0F172A)' }}>Report Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color, #CBD5E1)', backgroundColor: 'var(--bg-card, #FFFFFF)', color: 'var(--text-main, #0F172A)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main, #0F172A)' }}>Test Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color, #CBD5E1)', backgroundColor: 'var(--bg-card, #FFFFFF)', color: 'var(--text-main, #0F172A)', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main, #0F172A)' }}>Fat %</label>
                  <input
                    type="text"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color, #CBD5E1)', backgroundColor: 'var(--bg-card, #FFFFFF)', color: 'var(--text-main, #0F172A)', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main, #0F172A)' }}>SNF %</label>
                  <input
                    type="text"
                    value={snf}
                    onChange={(e) => setSnf(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color, #CBD5E1)', backgroundColor: 'var(--bg-card, #FFFFFF)', color: 'var(--text-main, #0F172A)', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main, #0F172A)' }}>Purity Score</label>
                  <input
                    type="text"
                    value={purity}
                    onChange={(e) => setPurity(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color, #CBD5E1)', backgroundColor: 'var(--bg-card, #FFFFFF)', color: 'var(--text-main, #0F172A)', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main, #0F172A)' }}>Lab Name / Auditor</label>
                <input
                  type="text"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color, #CBD5E1)', backgroundColor: 'var(--bg-card, #FFFFFF)', color: 'var(--text-main, #0F172A)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '4px', color: 'var(--text-main, #0F172A)' }}>Certificate PDF / Image URL</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={certificateUrl}
                  onChange={(e) => setCertificateUrl(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color, #CBD5E1)', backgroundColor: 'var(--bg-card, #FFFFFF)', color: 'var(--text-main, #0F172A)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <label htmlFor="activeCheck" style={{ fontWeight: 700, cursor: 'pointer', color: 'var(--text-main, #0F172A)' }}>
                  Active on Customer Mobile App
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color, #CBD5E1)', backgroundColor: 'transparent', color: 'var(--text-main, #0F172A)', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReport}
                style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', backgroundColor: '#047857', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
              >
                Save Report
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
