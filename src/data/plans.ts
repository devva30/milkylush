// Subscription plans of one hub (hubs/{hubId}/plans). The customer app gets them
// through catalog/current, so every change rebuilds the catalogue.

import { deleteDoc, doc, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import type { PrepaidPackage } from '../types';
import { hubCol, hubDoc, type HubId } from './hubs';
import { rebuildCatalog } from './products';
import { useLiveQuery } from './useFirestore';
import { logAudit } from '../utils/auditLogger';

export interface PlanDoc {
  type: 'subscription' | 'prepaid';
  title: string;
  durationDays: number;
  discountPercent: number;
  badge: string;
  recommended: boolean;
  productId: string | null; // null = any subscribable product
  productName: string;
  price: number; // paise, prepaid packs only
  active: boolean;
  displayOrder: number;
}

export function planToUi(id: string, hubId: HubId, d: PlanDoc): PrepaidPackage {
  return {
    id,
    name: d.title,
    title: d.title,
    price: (d.price ?? 0) / 100,
    durationDays: d.durationDays,
    discountPercent: d.discountPercent ?? 0,
    badgeLabel: d.badge ?? '',
    displayOrder: d.displayOrder ?? 99,
    isRecommended: !!d.recommended,
    isActive: !!d.active,
    hubId,
    productId: d.productId ?? 'all',
    productName: d.productName || 'All Products',
  } as PrepaidPackage;
}

function planToDoc(p: PrepaidPackage): PlanDoc {
  const productId = p.productId && p.productId !== 'all' ? p.productId : null;
  return {
    type: 'subscription',
    title: (p.title || p.name || '').trim(),
    durationDays: Math.max(1, Math.floor(Number(p.durationDays) || 30)),
    discountPercent: Math.min(100, Math.max(0, Number(p.discountPercent) || 0)),
    badge: (p.badgeLabel ?? '').trim(),
    recommended: !!p.isRecommended,
    productId,
    productName: productId ? (p.productName ?? '') : 'All Products',
    price: Math.round((Number(p.price) || 0) * 100),
    active: p.isActive ?? true,
    displayOrder: Number(p.displayOrder) || 99,
  };
}

export function useHubPlans(hubId: HubId) {
  const res = useLiveQuery<PlanDoc>(query(hubCol(hubId, 'plans'), orderBy('displayOrder')), [hubId]);
  return { ...res, data: res.data.map((d) => planToUi(d.id, hubId, d)) };
}

/**
 * Saves a plan to each hub in `hubIds` (same id in every hub, so "all hubs" plans
 * stay linked) and refreshes those hubs' catalogues.
 */
export async function savePlan(hubIds: HubId[], plan: PrepaidPackage): Promise<string> {
  const data = planToDoc(plan);
  if (!data.title) throw new Error('Plan title is required.');
  const id = plan.id || doc(hubCol(hubIds[0], 'plans')).id;
  for (const hubId of hubIds) {
    await setDoc(hubDoc(hubId, 'plans', id), { ...data, updatedAt: serverTimestamp(), ...(plan.id ? {} : { createdAt: serverTimestamp() }) }, { merge: true });
    await rebuildCatalog(hubId);
    await logAudit({
      hubId, category: 'Catalog & Pricing',
      action: `${plan.id ? 'Updated' : 'Created'} plan "${data.title}" (${data.durationDays} days, ${data.discountPercent}% off)`,
      target: `hubs/${hubId}/plans/${id}`, after: { ...data },
    });
  }
  return id;
}

export async function deletePlan(hubId: HubId, planId: string): Promise<void> {
  await deleteDoc(hubDoc(hubId, 'plans', planId));
  await rebuildCatalog(hubId);
  await logAudit({ hubId, category: 'Catalog & Pricing', action: `Deleted plan ${planId}`, target: `hubs/${hubId}/plans/${planId}` });
}
