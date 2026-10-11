import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { riderToRow, type StaffDoc } from '../data/staff';
import { db } from '../firebase';
import { sendWelcomeToNewCustomer, NOTHING_TO_DO } from '../services/whatsappService';
import type { User, DeliveryAgent } from '../types';

/**
 * What is left of the old global loader. Pages now read their own hub data
 * (src/data/*). Two listeners stay:
 *  - users: unchanged, because it drives the WhatsApp / e-mail welcome for new
 *    customers (left exactly as it was, by request);
 *  - riders of the selected hub (staff, role = rider), used across the consoles.
 */
export function useMilkyLushData(selectedHubId: string) {
  const [users, setUsers] = useState<User[]>([]);
  const [deliveryAgents, setDeliveryAgents] = useState<DeliveryAgent[]>([]);
  const isCurrentHosur = selectedHubId.includes('hosur');

  useEffect(() => {
    // Customers already registered when this panel opened, and customers whose
    // signup this panel witnessed. Most user docs have no usable createdAt, so
    // new signups are identified by tracking them here rather than by timestamp.
    const existingUserIds = new Set<string>();
    const newSignupIds = new Set<string>();
    let primedExistingUsers = false;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const items: User[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as User);
      });
      setUsers(items);

      // The first snapshot is the existing customer base. Recording it, and
      // greeting nobody, is what stops those customers being messaged.
      if (!primedExistingUsers) {
        snapshot.forEach((docSnap) => existingUserIds.add(docSnap.id));
        primedExistingUsers = true;
        return;
      }

      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') continue;

        const userId = change.doc.id;
        if (existingUserIds.has(userId)) continue;
        if (change.type === 'added') newSignupIds.add(userId);
        if (!newSignupIds.has(userId)) continue;

        const user = change.doc.data() as User & {
          welcomeWhatsappStatus?: string;
          welcomeWhatsappSent?: boolean;
        };
        if (user.welcomeWhatsappStatus || user.welcomeWhatsappSent) continue;

        // A manual signup has a phone and gets WhatsApp; a Google signup has only
        // an email and gets the welcome mail. With neither there is nothing to
        // send yet, so wait: the next update re-delivers this document.
        if (!(user.phone || (user as any).phoneNumber || (user as any).mobile || user.email)) continue;

        sendWelcomeToNewCustomer(userId)
          .then(({ sent, channel, reason }) => {
            if (sent) console.log(`[MilkyLush] welcome ${channel} sent to ${user.name}`);
            else if (reason !== NOTHING_TO_DO) {
              console.warn(`[MilkyLush] welcome ${channel} failed for ${user.name}: ${reason}`);
            }
          })
          .catch((err) => console.error('[MilkyLush] welcome error:', err));
      }
    });


    // Riders of the selected hub only (staff/{uid}, role = rider)
    const unsubAgents = onSnapshot(
      query(collection(db, 'staff'), where('hubIds', 'array-contains', selectedHubId), where('role', '==', 'rider')),
      (snapshot) => {
        setDeliveryAgents(snapshot.docs.map((d) => riderToRow(d.id, d.data() as StaffDoc)));
      },
      (err) => console.error('Riders listener:', err),
    );


    return () => {
      unsubUsers();
      unsubAgents();
    };
  }, [selectedHubId, isCurrentHosur]);

  const hubUsers = useMemo(() => {
    return users.filter((u) => {
      if (u.hubId) return u.hubId === selectedHubId;
      const addrList = (u.savedAddresses || []).join(' ').toLowerCase();
      const isHosurAddr = addrList.includes('hosur') || addrList.includes('tamil nadu') || addrList.includes('tn');
      return isCurrentHosur ? isHosurAddr : !isHosurAddr;
    });
  }, [users, selectedHubId, isCurrentHosur]);

  // Riders come from a hub-filtered query already.
  const hubDeliveryAgents = deliveryAgents;

  return { users, hubUsers, deliveryAgents, hubDeliveryAgents };
}
