import { useCallback, useEffect, useState } from 'react';
import { Camera, Trash2, RefreshCw, X } from 'lucide-react';
import type { HubId } from '../../data/hubs';
import { todayKey, addDays } from '../../data/dates';
import {
  PROOF_PHOTO_DAYS, deleteProofPhoto, loadProofPhotosOfDay, proofPhotoStats, purgeOldProofPhotos, type ProofPhotoRow,
} from '../../data/proofPhotos';
import { logAudit } from '../../utils/auditLogger';

interface Props {
  selectedHubId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Doorstep delivery photos (hubs/{hub}/proofPhotos). Photos are kept 30 days and deleted
 * automatically after that (each time this page opens and on "Generate deliveries");
 * the admin can delete one photo, one day, or everything older than a date at any time.
 */
export default function DispatchDeliveryPhotosPage({ selectedHubId, showToast }: Props) {
  const hubId = selectedHubId as HubId;
  const [date, setDate] = useState(todayKey());
  const [photos, setPhotos] = useState<ProofPhotoRow[]>([]);
  const [stats, setStats] = useState<{ count: number; oldest: string | null }>({ count: 0, oldest: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ProofPhotoRow | null>(null);
  const [olderThan, setOlderThan] = useState(addDays(todayKey(), -7));

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, s] = await Promise.all([loadProofPhotosOfDay(hubId, date), proofPhotoStats(hubId)]);
      setPhotos(rows);
      setStats(s);
    } catch (e) {
      showToast(`Could not load photos: ${(e as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [hubId, date, showToast]);

  // Compulsory 30-day clean-up whenever the page opens.
  useEffect(() => {
    purgeOldProofPhotos(hubId).then((n) => {
      if (n > 0) {
        showToast(`${n} photo(s) older than ${PROOF_PHOTO_DAYS} days were deleted automatically.`, 'info');
        logAudit({ hubId, category: 'Hub Operations', action: `Auto-deleted ${n} delivery photos older than ${PROOF_PHOTO_DAYS} days`, target: `hubs/${hubId}/proofPhotos` });
      }
    }).catch(() => {}).finally(reload);
  }, [hubId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { reload(); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteOne = async (p: ProofPhotoRow) => {
    if (!window.confirm(`Delete the delivery photo of ${p.id}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteProofPhoto(hubId, p.id);
      await logAudit({ hubId, category: 'Hub Operations', action: `Deleted delivery photo ${p.id}`, target: `hubs/${hubId}/proofPhotos/${p.id}` });
      setPreview(null);
      showToast('Photo deleted.', 'success');
      await reload();
    } catch (e) {
      showToast(`Could not delete: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteDay = async () => {
    if (photos.length === 0) return;
    if (!window.confirm(`Delete all ${photos.length} photo(s) of ${date}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      for (const p of photos) await deleteProofPhoto(hubId, p.id);
      await logAudit({ hubId, category: 'Hub Operations', action: `Deleted ${photos.length} delivery photos of ${date}`, target: `hubs/${hubId}/proofPhotos` });
      showToast(`${photos.length} photo(s) deleted.`, 'success');
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const deleteOlder = async () => {
    if (!window.confirm(`Delete every delivery photo dated before ${olderThan}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const n = await purgeOldProofPhotos(hubId, olderThan);
      await logAudit({ hubId, category: 'Hub Operations', action: `Deleted ${n} delivery photos dated before ${olderThan}`, target: `hubs/${hubId}/proofPhotos` });
      showToast(`${n} photo(s) deleted.`, 'success');
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const card = { backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0' } as const;
  const btn = (danger = false) => ({
    padding: '0.6rem 1rem', borderRadius: '12px', border: danger ? '1px solid #FCA5A5' : '1px solid #CBD5E1',
    backgroundColor: danger ? '#FEF2F2' : '#FFFFFF', color: danger ? '#B91C1C' : '#334155', fontWeight: 800,
    fontSize: '0.82rem', cursor: busy ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
  }) as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Camera size={22} style={{ color: '#044E35' }} /> Delivery Photos
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '6px 0 0 0' }}>
          Doorstep photos taken by riders. Kept {PROOF_PHOTO_DAYS} days, then deleted automatically to save database space.
          Only admins and the rider can see them — never the customer.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={card}>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748B' }}>PHOTOS STORED</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#111827' }}>{stats.count}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748B' }}>about {Math.round(stats.count * 12 / 1024 * 10) / 10} MB</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748B' }}>OLDEST PHOTO</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#111827' }}>{stats.oldest ?? '—'}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748B' }}>auto-delete after {addDays(todayKey(), -PROOF_PHOTO_DAYS)}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748B', marginBottom: 8 }}>DELETE OLDER PHOTOS</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="date" value={olderThan} max={todayKey()} onChange={(e) => setOlderThan(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 10, border: '1px solid #CBD5E1' }} />
            <button type="button" disabled={busy} onClick={deleteOlder} style={btn(true)}>
              <Trash2 size={14} /> Delete before date
            </button>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 800, color: '#1E293B', fontSize: '0.9rem' }}>Day</span>
            <input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 10, border: '1px solid #CBD5E1' }} />
            <button type="button" onClick={reload} style={btn()}><RefreshCw size={14} /> Refresh</button>
          </div>
          <button type="button" disabled={busy || photos.length === 0} onClick={deleteDay} style={btn(true)}>
            <Trash2 size={14} /> Delete all of this day ({photos.length})
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>Loading photos…</div>
        ) : photos.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>No delivery photos for {date}.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.9rem' }}>
            {photos.map((p) => (
              <div key={p.id} style={{ border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', background: '#F8FAFC' }}>
                <img src={p.dataUrl} alt={p.id} onClick={() => setPreview(p)}
                  style={{ width: '100%', height: 140, objectFit: 'cover', cursor: 'zoom-in', display: 'block' }} />
                <div style={{ padding: '0.55rem 0.65rem' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#111827', wordBreak: 'break-all' }}>{p.id.replace(`${p.date}_`, '')}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{p.source} • {p.sizeKb} KB</div>
                  <button type="button" disabled={busy} onClick={() => deleteOne(p)} style={{ ...btn(true), marginTop: 6, padding: '0.35rem 0.6rem', fontSize: '0.74rem' }}>
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {preview && (
        <div onClick={() => setPreview(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFF', borderRadius: 18, padding: 14, maxWidth: 560, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: '0.9rem' }}>{preview.id}</strong>
              <button type="button" onClick={() => setPreview(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <img src={preview.dataUrl} alt={preview.id} style={{ width: '100%', borderRadius: 12 }} />
            <button type="button" disabled={busy} onClick={() => deleteOne(preview)} style={{ ...btn(true), marginTop: 10 }}>
              <Trash2 size={14} /> Delete this photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
