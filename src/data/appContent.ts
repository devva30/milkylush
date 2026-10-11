// Customer-app content managed on the Mobile Control page:
//   config/onboarding            intro slides (all hubs; shown before a hub is known)
//   config/app                   FSSAI number & social links
//   hubs/{hubId}/banners/{id}    home banners (also copied into catalog/current)
//   hubs/{hubId}/settings/popup | help | freeSample
//   hubs/{hubId}/broadcasts/{id} announcements — ONE document per message; the app
//                                reads the latest few, nothing is written per customer.

import {
  addDoc, deleteDoc, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query,
  runTransaction, serverTimestamp, setDoc, where, collection,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Banner, OnboardingSlide } from '../types';
import { hubCol, hubDoc, type HubId } from './hubs';
import { rebuildCatalog } from './products';
import { useLiveDoc, useLiveQuery } from './useFirestore';
import { logAudit } from '../utils/auditLogger';
import { formatDateTime } from './dates';

// ---------- onboarding (global) ----------
const onboardingRef = () => doc(db, 'config', 'onboarding');

export function useOnboardingSlides() {
  const res = useLiveDoc<{ slides?: OnboardingSlide[] }>(onboardingRef(), []);
  const slides = [...(res.data?.slides ?? [])].sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99));
  return { ...res, data: slides };
}

/** Adds or replaces one slide in config/onboarding (transaction, so two admins don't overwrite each other). */
export async function saveOnboardingSlide(slide: OnboardingSlide): Promise<void> {
  const id = slide.id || doc(collection(db, 'config')).id;
  await runTransaction(db, async (tx) => {
    const slides: OnboardingSlide[] = (await tx.get(onboardingRef())).data()?.slides ?? [];
    const next = slides.some((s) => s.id === id)
      ? slides.map((s) => (s.id === id ? { ...slide, id } : s))
      : [...slides, { ...slide, id }];
    tx.set(onboardingRef(), { slides: next, updatedAt: serverTimestamp() }, { merge: true });
  });
  await logAudit({ category: 'Hub Operations', action: `Saved onboarding slide "${slide.title}"`, target: 'config/onboarding' });
}

export async function deleteOnboardingSlide(id: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const slides: OnboardingSlide[] = (await tx.get(onboardingRef())).data()?.slides ?? [];
    tx.set(onboardingRef(), { slides: slides.filter((s) => s.id !== id), updatedAt: serverTimestamp() }, { merge: true });
  });
  await logAudit({ category: 'Hub Operations', action: `Deleted onboarding slide ${id}`, target: 'config/onboarding' });
}

// ---------- banners (per hub) ----------
interface BannerDoc {
  kind: 'home';
  title: string;
  subtitle: string;
  imageUrl: string;
  link: string | null; // product id the banner opens
  active: boolean;
  displayOrder: number;
}

export function useHubBanners(hubId: HubId) {
  const res = useLiveQuery<BannerDoc>(query(hubCol(hubId, 'banners'), orderBy('displayOrder')), [hubId]);
  const data: Banner[] = res.data.map((b) => ({
    id: b.id, title: b.title, description: b.subtitle ?? '', imageUrl: b.imageUrl, displayOrder: b.displayOrder,
    active: !!b.active, targetProductId: b.link ?? undefined,
  }));
  return { ...res, data };
}

export async function saveBanner(hubId: HubId, banner: Banner): Promise<void> {
  const id = banner.id || doc(hubCol(hubId, 'banners')).id;
  const data: BannerDoc = {
    kind: 'home',
    title: (banner.title ?? '').trim(),
    subtitle: (banner.description ?? '').trim(),
    imageUrl: (banner.imageUrl ?? '').trim(),
    link: banner.targetProductId || null,
    active: !!banner.active,
    displayOrder: Number(banner.displayOrder) || 99,
  };
  await setDoc(hubDoc(hubId, 'banners', id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  await rebuildCatalog(hubId);
  await logAudit({ hubId, category: 'Hub Operations', action: `Saved banner "${data.title}" (${data.active ? 'active' : 'off'})`, target: `hubs/${hubId}/banners/${id}` });
}

export async function deleteBanner(hubId: HubId, id: string): Promise<void> {
  await deleteDoc(hubDoc(hubId, 'banners', id));
  await rebuildCatalog(hubId);
  await logAudit({ hubId, category: 'Hub Operations', action: `Deleted banner ${id}`, target: `hubs/${hubId}/banners/${id}` });
}

// ---------- settings docs ----------
export type HubSettingsDoc = 'popup' | 'help' | 'freeSample';

export async function loadHubSetting<T>(hubId: HubId, name: HubSettingsDoc): Promise<Partial<T>> {
  return ((await getDoc(hubDoc(hubId, 'settings', name))).data() ?? {}) as Partial<T>;
}

export async function saveHubSetting(hubIds: HubId[], name: HubSettingsDoc, data: Record<string, unknown>): Promise<void> {
  for (const hubId of hubIds) {
    await setDoc(hubDoc(hubId, 'settings', name), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    await logAudit({ hubId, category: 'Hub Operations', action: `Saved ${name} settings`, target: `hubs/${hubId}/settings/${name}` });
  }
}

export async function loadAppConfig(): Promise<Record<string, unknown>> {
  return (await getDoc(doc(db, 'config', 'app'))).data() ?? {};
}

/** config/app is shared by both hubs, so only a super admin can change it (enforced by the rules). */
export async function saveAppConfig(data: Record<string, unknown>): Promise<void> {
  await setDoc(doc(db, 'config', 'app'), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  await logAudit({ category: 'Hub Operations', action: 'Saved app config (FSSAI & social links)', target: 'config/app', after: data });
}

// ---------- broadcasts ----------
export interface CampaignRow {
  id: string;
  title: string;
  target: string;
  type: 'Offer' | 'Wishes & Info';
  recipients: number;
  sentAt: string;
  bodyPreview: string;
}

export async function loadBroadcasts(hubId: HubId): Promise<CampaignRow[]> {
  const snap = await getDocs(query(hubCol(hubId, 'broadcasts'), orderBy('sentAt', 'desc'), limit(50)));
  return snap.docs.map((d) => {
    const b = d.data();
    return {
      id: d.id, title: b.title, target: b.audienceLabel ?? 'All customers', type: b.type === 'offer' ? 'Offer' : 'Wishes & Info',
      recipients: b.recipientCount ?? 0, sentAt: formatDateTime(b.sentAt), bodyPreview: b.body ?? '',
    };
  });
}

/** One write. recipientCount is a count() aggregation (≈1 read per 1,000 customers). */
export async function sendBroadcast(
  hubId: HubId,
  b: { title: string; body: string; type: 'offer' | 'info'; audienceLabel: string; sentByUid: string },
): Promise<CampaignRow> {
  const recipients = (await getCountFromServer(query(collection(db, 'users'), where('hubId', '==', hubId)))).data().count;
  const ref = await addDoc(hubCol(hubId, 'broadcasts'), {
    title: b.title, body: b.body, type: b.type, channel: 'in_app', audience: 'all', audienceLabel: b.audienceLabel,
    sentByUid: b.sentByUid, recipientCount: recipients, sentAt: serverTimestamp(),
  });
  await logAudit({ hubId, category: 'Hub Operations', action: `Sent broadcast "${b.title}" to ${recipients} customers`, target: ref.path });
  return {
    id: ref.id, title: b.title, target: b.audienceLabel, type: b.type === 'offer' ? 'Offer' : 'Wishes & Info',
    recipients, sentAt: formatDateTime(new Date()), bodyPreview: b.body,
  };
}

export async function deleteBroadcast(hubId: HubId, id: string): Promise<void> {
  await deleteDoc(hubDoc(hubId, 'broadcasts', id));
  await logAudit({ hubId, category: 'Hub Operations', action: `Deleted broadcast ${id}`, target: `hubs/${hubId}/broadcasts/${id}` });
}
