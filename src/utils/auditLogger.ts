// Writes who-did-what records (DATABASE.md → auditLogs). The actor is always the
// signed-in admin; time is the server's. Hub actions go to hubs/{hubId}/auditLogs,
// actions that span hubs to the top-level auditLogs collection.

import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { hubCol, isHubId } from '../data/hubs';

export type AuditCategory =
  | 'Security & Login' | 'Catalog & Pricing' | 'Hub Operations' | 'Financials & Refunds' | 'User Roles';

function device(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  return `${browser} on ${os}`;
}

// The signed-in staff member's name and role, read once per session.
let actorCache: { uid: string; name: string; role: string } | null = null;
async function actor(uid: string) {
  if (actorCache?.uid === uid) return actorCache;
  try {
    const d = (await getDoc(doc(db, 'staff', uid))).data() ?? {};
    actorCache = { uid, name: (d.name as string) ?? '', role: (d.role as string) ?? '' };
  } catch {
    actorCache = { uid, name: '', role: '' };
  }
  return actorCache;
}

/** Records an admin action. Never throws: a failed log must not block the action itself. */
export async function logAudit(entry: {
  hubId?: string;
  category: AuditCategory;
  action: string;
  target: string;
  after?: Record<string, unknown>;
}) {
  const user = auth.currentUser;
  if (!user) return;
  const who = await actor(user.uid);
  const data = {
    actorUid: user.uid,
    actorEmail: user.email ?? '',
    actorName: who.name,
    actorRole: who.role,
    category: entry.category,
    action: entry.action,
    target: entry.target,
    after: entry.after ? JSON.parse(JSON.stringify(entry.after)) : null,
    hubId: entry.hubId ?? 'all',
    device: device(),
    createdAt: serverTimestamp(),
  };
  try {
    const col = entry.hubId && isHubId(entry.hubId) ? hubCol(entry.hubId, 'auditLogs') : collection(db, 'auditLogs');
    await addDoc(col, data);
  } catch (error) {
    console.error('Audit log failed:', error);
  }
}

/** Older call signature kept for existing pages; name/email/role arguments are ignored. */
export async function logAdminAuditAction(
  _adminName: string,
  _adminEmail: string,
  _adminRole: string,
  category: AuditCategory,
  actionSummary: string,
  targetEntity: string,
  payload?: object,
  hubId?: string,
) {
  await logAudit({ hubId, category, action: actionSummary, target: targetEntity, after: payload as Record<string, unknown> | undefined });
}
