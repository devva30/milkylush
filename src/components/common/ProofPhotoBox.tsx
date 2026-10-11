import { useProofPhoto } from '../../data/proofPhotos';
import type { HubId } from '../../data/hubs';

/**
 * The real doorstep photo of a delivery (hubs/{hub}/proofPhotos/{deliveryId}) with the
 * distance the rider app measured to the customer's GPS pin (delivery.riderNote).
 * Shows "No photo" when there is none (never a stock picture).
 */
export function ProofPhotoBox({ hubId, deliveryId, hasProofPhoto, riderNote, onZoom, height = 240 }: {
  hubId: string;
  deliveryId: string;
  hasProofPhoto?: boolean;
  riderNote?: string;
  onZoom?: (url: string) => void;
  height?: number;
}) {
  const photo = useProofPhoto(hasProofPhoto ? (hubId as HubId) : null, hasProofPhoto ? deliveryId : null);
  const url = photo.data?.dataUrl ?? '';
  const gps = (riderNote ?? '').match(/Delivered (\d+(?:\.\d+)?) m from the customer's pin/);
  const gpsText = gps ? (Number(gps[1]) <= 25 ? `GPS verified · ${gps[1]} m from the customer's pin` : `${gps[1]} m from the customer's pin`) : '';
  return (
    <div
      onClick={() => url && onZoom?.(url)}
      style={{
        position: 'relative', width: '100%', height, borderRadius: 12, overflow: 'hidden',
        backgroundColor: '#F3F4F6', cursor: url ? 'pointer' : 'default', border: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {url ? (
        <img src={url} alt="Doorstep delivery proof" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ color: '#6B7280', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', padding: 16 }}>
          {photo.loading && hasProofPhoto ? 'Loading photo…' : hasProofPhoto ? 'Photo deleted (older than 30 days)' : 'No doorstep photo for this delivery'}
        </div>
      )}
      {gpsText && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1.5rem 1rem 0.85rem 1rem',
          background: url ? 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' : 'transparent',
          display: 'flex', alignItems: 'center',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF',
            color: Number(gps![1]) <= 25 ? '#15803D' : '#B45309', padding: '0.35rem 0.85rem', borderRadius: 9999,
            fontSize: '0.78rem', fontWeight: 800, boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: Number(gps![1]) <= 25 ? '#16A34A' : '#F59E0B', display: 'inline-block' }} />
            {gpsText}
          </div>
        </div>
      )}
    </div>
  );
}
