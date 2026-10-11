// Latest hub activity for the header bell: the 20 newest one-time orders and the
// 10 newest subscriptions (small live queries, ~30 docs).

import { limit, orderBy, query } from 'firebase/firestore';
import { useMemo } from 'react';
import { hubCol, type HubId } from './hubs';
import { useLiveQuery } from './useFirestore';
import { toDate } from './dates';
import { subToUi, type SubscriptionDoc } from './subscriptions';
import type { Order, Product } from '../types';

const ORDER_STATUS: Record<string, string> = {
  placed: 'pending', delivered: 'delivered', cancelled: 'cancelled', failed: 'failed', pending_payment: 'pending',
};

export function useRecentActivity(hubId: HubId) {
  const ordersQ = useLiveQuery<Record<string, any>>(
    query(hubCol(hubId, 'orders'), orderBy('createdAt', 'desc'), limit(20)), [hubId]);
  const subsQ = useLiveQuery<SubscriptionDoc>(
    query(hubCol(hubId, 'subscriptions'), orderBy('createdAt', 'desc'), limit(10)), [hubId]);

  const orders = useMemo(() => ordersQ.data
    .filter((o) => o.status !== 'pending_payment')
    .map((o) => ({
      id: o.id,
      userId: o.customerUid,
      customerName: o.customerName,
      items: (o.items ?? []).map((i: any) => ({
        id: i.productId, quantity: i.qty, product: { id: i.productId, name: i.name, unit: i.unit, price: (i.price ?? 0) / 100 } as Product,
      })),
      orderDate: toDate(o.createdAt)?.toISOString() ?? '',
      status: ORDER_STATUS[o.status] ?? o.status,
      totalAmount: (o.total ?? 0) / 100,
      hubId,
    }) as unknown as Order), [ordersQ.data, hubId]);

  const subscriptions = useMemo(() => subsQ.data.map((d) => subToUi(d.id, d)), [subsQ.data]);

  /** One-time orders placed and not yet delivered. */
  const openOrders = orders.filter((o) => o.status === 'pending').length;
  return { orders, subscriptions, openOrders };
}
