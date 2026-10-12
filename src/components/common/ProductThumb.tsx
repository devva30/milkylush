import { useState } from 'react';
import { Package } from 'lucide-react';
import { useProductImages } from '../../data/products';

/**
 * The real product photo (from the hub's catalogue) for an order/delivery item.
 * Items without a catalogue photo show a neutral box, never a stock photo.
 */
export function ProductThumb({ hubId, productId, name, size = 48, radius = 10 }: {
  hubId?: string; productId?: string; name?: string; size?: number; radius?: number;
}) {
  const images = useProductImages(hubId);
  const [broken, setBroken] = useState(false);
  const url = productId ? images.get(productId) : undefined;
  if (url && !broken) {
    return (
      <img src={url} alt={name ?? ''} onError={() => setBroken(true)}
        style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0 }} />
    );
  }
  return (
    <div title={name} style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0, backgroundColor: '#F1F5F9',
      border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8',
    }}>
      <Package size={Math.round(size * 0.45)} />
    </div>
  );
}
