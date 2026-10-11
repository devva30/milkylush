// Admin activity trail: hubs/{hub}/auditLogs (written by utils/auditLogger.ts).

import { orderBy, query, where, type Timestamp } from 'firebase/firestore';
import { hubCol, type HubId } from './hubs';
import { formatDateTime, istDayEnd, istDayStart } from './dates';
import { usePagedQuery, type WithId } from './useFirestore';
import type { AdminAuditLogItem } from '../types';

export interface AuditDoc {
  actorUid: string;
  actorEmail: string;
  actorName?: string;
  actorRole?: string;
  category: AdminAuditLogItem['category'];
  action: string;
  target: string;
  after: Record<string, unknown> | null;
  hubId: string;
  device: string;
  createdAt?: Timestamp;
}

const ROLE: Record<string, AdminAuditLogItem['adminRole']> = {
  super_admin: 'Super Admin', hub_admin: 'Hub Manager',
};

/** The hub's audit entries between two IST days, newest first, 50 per page. */
export function useHubAuditLogs(hubId: HubId, from: string, to: string) {
  return usePagedQuery<AuditDoc>(
    query(hubCol(hubId, 'auditLogs'),
      where('createdAt', '>=', istDayStart(from)), where('createdAt', '<=', istDayEnd(to)), orderBy('createdAt', 'desc')),
    [hubId, from, to]);
}

export function auditToUi(d: WithId<AuditDoc>): AdminAuditLogItem {
  return {
    id: d.id,
    timestamp: formatDateTime(d.createdAt),
    adminName: d.actorName || d.actorEmail.split('@')[0] || 'Admin',
    adminEmail: d.actorEmail,
    adminRole: ROLE[d.actorRole ?? ''] ?? 'Hub Manager',
    category: d.category,
    actionSummary: d.action,
    targetEntity: d.target,
    ipAddress: '',
    deviceSession: d.device,
    payloadJson: d.after ? JSON.stringify(d.after, null, 2) : undefined,
    hubId: d.hubId,
  };
}
