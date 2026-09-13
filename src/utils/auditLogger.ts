import { collection, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import type { AdminAuditLogItem } from '../types';

export async function logAdminAuditAction(
  adminName: string,
  adminEmail: string,
  adminRole: 'Super Admin' | 'Hub Manager' | 'Inventory Lead' | 'Finance Admin',
  category: 'Security & Login' | 'Catalog & Pricing' | 'Hub Operations' | 'Financials & Refunds' | 'User Roles',
  actionSummary: string,
  targetEntity: string,
  payload?: any,
  hubId?: string
) {
  try {
    const newDocRef = doc(collection(db, 'admin_audit_logs'));
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const auditEntry: AdminAuditLogItem = {
      id: newDocRef.id,
      timestamp: dateFormatted,
      adminName: adminName || 'Tom SuperAdmin',
      adminEmail: adminEmail || 'tomadmin@gmail.com',
      adminRole: adminRole || 'Super Admin',
      category,
      actionSummary,
      targetEntity,
      ipAddress: '103.22.45.90',
      deviceSession: 'Chrome Web Admin (Windows 11)',
      payloadJson: payload ? JSON.stringify(payload, null, 2) : undefined,
      hubId: hubId || 'hub_hosur_main'
    };

    await setDoc(newDocRef, auditEntry);
  } catch (error) {
    console.error('Error logging admin audit action to Firestore:', error);
  }
}
