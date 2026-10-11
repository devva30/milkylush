// One-time orders entered by an admin (phone / WhatsApp orders). Created with the
// next HSR-ORD-yyMMdd-#### id together with its delivery doc in one transaction,
// so the drop shows on Today's Deliveries at once. Payment: cash on delivery.

import { doc, increment, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { hubDoc, type HubId } from './hubs';
import { withNextOrderId } from './ids';
import { addressText, type AddressDoc } from './customers';
import type { Product } from '../types';
import { sellingPrice } from './products';
import { logAudit } from '../utils/auditLogger';

export interface AdminOrderInput {
  customer: { uid: string; customerId?: string; name: string; phone: string };
  address: (AddressDoc & { id: string }) | null;
  addressFallback: string;
  product: Product;
  qty: number;
  deliveryDate: string;
  rider: { uid: string; name: string } | null;
}

export async function createAdminOrder(hubId: HubId, input: AdminOrderInput): Promise<string> {
  const { customer, address, product, qty, deliveryDate, rider } = input;
  const unit = Math.round(sellingPrice(product.price, product.offerTag) * 100); // paise
  const item = {
    productId: product.id, name: product.name, unit: product.unit ?? '', price: unit, qty,
    returnableBottle: !!product.isGlassBottle,
  };
  const total = unit * qty;
  const addrText = address ? addressText(address) : input.addressFallback;
  const addr = address
    ? { line1: address.line1, line2: address.line2, landmark: address.landmark, area: address.area, city: address.city,
        pincode: address.pincode, doorNotes: address.doorNotes ?? '', location: address.location ?? null }
    : {};

  const id = await withNextOrderId(hubId, (tx, orderId) => {
    tx.set(hubDoc(hubId, 'orders', orderId), {
      hubId, customerUid: customer.uid, customerId: customer.customerId ?? '', customerName: customer.name,
      customerPhone: customer.phone, addressId: address?.id ?? null, address: addr, addressText: addrText,
      deliveryInstructions: address?.doorNotes ?? '',
      items: [item], subtotal: total, discount: 0, deliveryCharge: 0, total,
      couponCode: null, referralDiscount: 0, isFreeSample: false,
      deliveryDate, status: 'placed', paymentMethod: 'cod', paymentId: null, cancellationReason: null,
      createdByAdminUid: auth.currentUser?.uid ?? null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    tx.set(hubDoc(hubId, 'deliveries', `${deliveryDate}_${orderId}`), {
      hubId, date: deliveryDate, sourceType: 'order', sourceId: orderId,
      customerUid: customer.uid, customerId: customer.customerId ?? '', customerName: customer.name,
      customerPhone: customer.phone, address: addr, addressText: addrText, instructions: address?.doorNotes ?? '',
      items: [item], amount: total, bottlesDue: item.returnableBottle ? qty : 0, deliveryCharge: 0,
      riderUid: rider?.uid ?? null, riderName: rider?.name ?? null, routeId: null, stopSeq: 9999,
      status: 'scheduled', deliveredAt: null, hasProofPhoto: false, bottlesCollected: 0,
      failReason: null, riderNote: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    tx.update(doc(db, 'users', customer.uid), { orderCount: increment(1), updatedAt: serverTimestamp() });
  });

  await logAudit({
    hubId, category: 'Hub Operations',
    action: `Created order ${id} for ${customer.name}: ${qty} x ${product.name} on ${deliveryDate}`,
    target: `hubs/${hubId}/orders/${id}`,
  });
  return id;
}
