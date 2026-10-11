// Products of one hub (hubs/{hubId}/products) and the customer app's one-read
// catalogue (hubs/{hubId}/catalog/current). Money is stored in paise; the admin
// screens keep working in rupees through toUi()/toDoc().

import {
  deleteDoc, getDocs, increment, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import type { Product } from '../types';
import { hubCol, hubDoc, type HubId } from './hubs';
import { withNextId } from './ids';
import { useLiveQuery } from './useFirestore';
import { logAudit } from '../utils/auditLogger';

type StockStatus = 'in_stock' | 'limited' | 'out_of_stock' | 'coming_soon';

/** Shape stored in Firestore (DATABASE.md → hubs/{hubId}/products). */
export interface ProductDoc {
  name: string;
  description: string;
  category: string;
  unit: string;
  price: number; // paise, what the customer pays
  mrp: number; // paise, strike-through price
  images: string[];
  subscribable: boolean;
  returnableBottle: boolean;
  stockStatus: StockStatus;
  stockQty: number;
  active: boolean;
  featured: boolean;
  displayOrder: number;
  offerTag: string;
  rating: number;
  details: {
    fat: string;
    shelfLife: string;
    farmSource: string;
    guarantee: string;
    nutrients: Record<string, string>;
  };
}

const toPaise = (rupees: number | undefined) => Math.round((Number(rupees) || 0) * 100);
const toRupees = (paise: number | undefined) => (Number(paise) || 0) / 100;

/** Selling price from the offer tag ("8% OFF", "₹10 OFF"), as the admin page shows it. */
export function sellingPrice(price: number, offerTag?: string): number {
  const tag = (offerTag || '').trim();
  if (!tag) return price;
  const pct = tag.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) {
    const p = parseFloat(pct[1]);
    if (p > 0 && p < 100) return Math.round(price * (1 - p / 100));
  }
  // "₹10 OFF", "Rs 10", "Flat 10", "10 OFF" — but not a bare number like "Pack of 5"
  const flat = tag.match(/(?:₹|rs\.?|flat)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:off|discount)\b/i);
  if (flat) {
    const amt = parseFloat(flat[1] ?? flat[2]);
    if (amt > 0 && amt < price) return Math.round(price - amt);
  }
  return price;
}

const uiStatus = (s: StockStatus): Product['stockStatus'] => (s === 'limited' ? 'limited_stock' : s);
const docStatus = (s: Product['stockStatus']): StockStatus => (s === 'limited_stock' ? 'limited' : (s ?? 'in_stock'));

export function toUi(id: string, d: ProductDoc): Product {
  const images = d.images ?? [];
  return {
    id,
    name: d.name,
    description: d.description ?? '',
    category: d.category ?? '',
    price: toRupees(d.mrp || d.price), // the admin form edits MRP; the offer tag derives the selling price
    unit: d.unit ?? '',
    imageUrl: images[0] ?? '',
    images,
    isSubscriptionEnabled: !!d.subscribable,
    isGlassBottle: !!d.returnableBottle,
    fatPercentage: d.details?.fat ?? '',
    shelfLife: d.details?.shelfLife ?? '',
    farmSource: d.details?.farmSource ?? '',
    guaranteeNote: d.details?.guarantee ?? '',
    nutrients: d.details?.nutrients ?? {},
    rating: d.rating ?? 0,
    displayOrder: d.displayOrder ?? 999,
    offerTag: d.offerTag ?? '',
    isFeatured: !!d.featured,
    stockStatus: uiStatus(d.stockStatus),
    stockQuantity: d.stockQty ?? 0,
    inStock: d.stockStatus === 'in_stock' || d.stockStatus === 'limited',
  };
}

export function toDoc(p: Partial<Product>): ProductDoc {
  const mrpRupees = Number(p.price) || 0;
  const images = (p.images?.length ? p.images : [p.imageUrl]).filter((u): u is string => !!u && !!u.trim());
  return {
    name: (p.name ?? '').trim(),
    description: (p.description ?? '').trim(),
    category: (p.category ?? '').trim(),
    unit: (p.unit ?? '').trim(),
    mrp: toPaise(mrpRupees),
    price: toPaise(sellingPrice(mrpRupees, p.offerTag)),
    images,
    subscribable: !!p.isSubscriptionEnabled,
    returnableBottle: !!p.isGlassBottle,
    stockStatus: docStatus(p.stockStatus),
    stockQty: Math.max(0, Math.floor(Number(p.stockQuantity) || 0)),
    active: true,
    featured: !!p.isFeatured,
    displayOrder: Number(p.displayOrder) || 999,
    offerTag: (p.offerTag ?? '').trim(),
    rating: Number(p.rating) || 0,
    details: {
      fat: p.fatPercentage ?? '',
      shelfLife: p.shelfLife ?? '',
      farmSource: p.farmSource ?? '',
      guarantee: p.guaranteeNote ?? '',
      nutrients: p.nutrients ?? {},
    },
  };
}

/** Live product list of one hub, in display order (admin sees all, incl. out of stock). */
export function useHubProducts(hubId: HubId) {
  const res = useLiveQuery<ProductDoc>(query(hubCol(hubId, 'products'), orderBy('displayOrder')), [hubId]);
  return { ...res, data: res.data.map((d) => toUi(d.id, d)) };
}

/**
 * Rewrites hubs/{hubId}/catalog/current from the hub's active products, plans and
 * banners, so the customer app loads the whole storefront with one read.
 */
export async function rebuildCatalog(hubId: HubId): Promise<void> {
  const [products, plans, banners] = await Promise.all([
    getDocs(query(hubCol(hubId, 'products'), where('active', '==', true), orderBy('displayOrder'))),
    getDocs(query(hubCol(hubId, 'plans'), where('active', '==', true))),
    getDocs(query(hubCol(hubId, 'banners'), where('active', '==', true))),
  ]);
  type Ordered = { id: string; displayOrder?: number };
  const byOrder = (a: Ordered, b: Ordered) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999);
  // merge keeps nothing stale: every field is rewritten, arrays are replaced whole.
  await setDoc(hubDoc(hubId, 'catalog', 'current'), {
    products: products.docs.map((d) => ({ id: d.id, ...d.data() })),
    plans: plans.docs.map((d) => ({ id: d.id, ...d.data() }) as Ordered).sort(byOrder),
    banners: banners.docs.map((d) => ({ id: d.id, ...d.data() }) as Ordered).sort(byOrder),
    version: increment(1), // the app re-renders only when this changes
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/** Creates (empty id → next HSR-PRD-####) or updates a product, then refreshes the catalogue. */
export async function saveProduct(hubId: HubId, product: Partial<Product>): Promise<string> {
  const data = toDoc(product);
  if (!data.name) throw new Error('Product name is required.');
  let id = product.id ?? '';
  if (!id) {
    id = await withNextId(hubId, 'product', (tx, newId) =>
      tx.set(hubDoc(hubId, 'products', newId), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  } else {
    await setDoc(hubDoc(hubId, 'products', id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  }
  await rebuildCatalog(hubId);
  await logAudit({
    hubId, category: 'Catalog & Pricing', action: `${product.id ? 'Updated' : 'Created'} product ${data.name}`,
    target: `hubs/${hubId}/products/${id}`,
    after: { price: data.price, mrp: data.mrp, stockStatus: data.stockStatus, stockQty: data.stockQty },
  });
  return id;
}

export async function setProductStock(hubId: HubId, productId: string, inStock: boolean): Promise<void> {
  await updateDoc(hubDoc(hubId, 'products', productId), {
    stockStatus: inStock ? 'in_stock' : 'out_of_stock',
    updatedAt: serverTimestamp(),
  });
  await rebuildCatalog(hubId);
  await logAudit({
    hubId, category: 'Catalog & Pricing', action: `Marked ${productId} ${inStock ? 'in stock' : 'out of stock'}`,
    target: `hubs/${hubId}/products/${productId}`,
  });
}

export async function deleteProduct(hubId: HubId, productId: string): Promise<void> {
  await deleteDoc(hubDoc(hubId, 'products', productId));
  await rebuildCatalog(hubId);
  await logAudit({
    hubId, category: 'Catalog & Pricing', action: `Deleted product ${productId}`, target: `hubs/${hubId}/products/${productId}`,
  });
}
