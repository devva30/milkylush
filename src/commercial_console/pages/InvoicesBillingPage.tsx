import React, { useState, useEffect } from 'react';
import {
  collection, count, getAggregateFromServer, getDoc, getDocs, limit, orderBy, query, setDoc, sum, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useHubContext } from '../../context/HubContext';
import { hubCol, hubDoc, HUB_NAMES, type HubId } from '../../data/hubs';
import { formatDay, todayKey } from '../../data/dates';
import { logAudit } from '../../utils/auditLogger';

interface InvoiceRow {
  id: string;
  customerName: string;
  deliveryAddress: string;
  totalAmount: number;
  date: string;
  items: { name: string; unit: string; qty: number; price: number }[];
}

/** Paid / delivered one-time orders of the hub, newest first. */
async function loadInvoices(hubId: HubId): Promise<InvoiceRow[]> {
  const snap = await getDocs(query(hubCol(hubId, 'orders'), orderBy('createdAt', 'desc'), limit(30)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Record<string, any>)
    .filter((o) => o.status === 'placed' || o.status === 'delivered')
    .map((o) => ({
      id: o.id,
      customerName: o.customerName ?? 'Customer',
      deliveryAddress: o.addressText ?? '',
      totalAmount: (o.total ?? 0) / 100,
      date: o.deliveryDate ?? '',
      items: (o.items ?? []).map((i: any) => ({ name: i.name, unit: i.unit, qty: i.qty, price: (i.price ?? 0) / 100 })),
    }));
}
import {
  Receipt,
  FileText,
  Download,
  Printer,
  Search,
  Users,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import type { Order, UserProfile } from '../../types';

interface InvoicesBillingPageProps {
  selectedTab: 'invoice-details' | 'invoice-summary';
  /** Unused: invoices and statements are loaded for the selected hub. */
  orders?: Order[];
  users?: UserProfile[];
}

export default function InvoicesBillingPage({ selectedTab }: InvoicesBillingPageProps) {
  const { selectedHubId } = useHubContext();
  const hubId = selectedHubId as HubId;
  const [orders, setOrders] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<InvoiceRow | null>(null);
  const [gstin, setGstin] = useState('');
  // Monthly statement: latest customers with this month's delivered drops and value
  const [statements, setStatements] = useState<{ id: string; name: string; drops: number; total: number }[]>([]);
  const month = todayKey().slice(0, 7);
  const monthLabel = new Date(`${month}-01T00:00:00+05:30`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([loadInvoices(hubId), getDoc(hubDoc(hubId, 'settings', 'contact'))]).then(([rows, contact]) => {
      if (!alive) return;
      setOrders(rows);
      setSelectedOrder(rows[0] ?? null);
      setGstin((contact.data()?.gstin as string) ?? '');
    }).catch(() => alive && setOrders([])).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [hubId]);

  useEffect(() => {
    if (selectedTab !== 'invoice-summary') return;
    let alive = true;
    (async () => {
      const custs = await getDocs(query(collection(db, 'users'), where('hubId', '==', hubId), orderBy('createdAt', 'desc'), limit(10)));
      const rows = await Promise.all(custs.docs.map(async (c) => {
        const agg = await getAggregateFromServer(query(hubCol(hubId, 'deliveries'), where('customerUid', '==', c.id),
          where('status', '==', 'delivered'), where('date', '>=', `${month}-01`), where('date', '<=', `${month}-31`)),
          { n: count(), total: sum('amount') });
        return { id: c.id, name: (c.data().name as string) ?? 'Customer', drops: agg.data().n, total: (agg.data().total ?? 0) / 100 };
      }));
      if (alive) setStatements(rows);
    })().catch(() => alive && setStatements([]));
    return () => { alive = false; };
  }, [hubId, selectedTab, month]);

  const handleSetGstin = async () => {
    const value = window.prompt(`GSTIN for ${HUB_NAMES[hubId]} (15 characters)`, gstin)?.trim().toUpperCase();
    if (value === undefined) return;
    if (value && !/^[0-9]{2}[A-Z0-9]{13}$/.test(value)) { alert('That does not look like a 15-character GSTIN.'); return; }
    await setDoc(hubDoc(hubId, 'settings', 'contact'), { gstin: value, updatedAt: serverTimestamp() }, { merge: true });
    await logAudit({ hubId, category: 'Financials & Refunds', action: `Set GSTIN ${value || '(removed)'}`, target: `hubs/${hubId}/settings/contact` });
    setGstin(value);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#166534', margin: 0 }}>
          {selectedTab === 'invoice-details' ? 'Tax Invoices & Transaction Receipts' : 'Customer Monthly Invoice Summary'}
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '4px 0 0 0' }}>
          {selectedTab === 'invoice-details'
            ? 'Itemized GST compliant billing invoices for orders & subscription charges.'
            : 'Monthly subscription billing statements and customer invoice summary exports.'}
        </p>
      </div>

      {selectedTab === 'invoice-details' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Order / Invoice List */}
          <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '20px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
              Recent Invoices
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {loading && <div style={{ fontSize: '0.82rem', color: '#64748B' }}>Loading invoices…</div>}
              {!loading && orders.length === 0 && <div style={{ fontSize: '0.82rem', color: '#64748B' }}>No paid orders yet.</div>}
              {orders.slice(0, 30).map((o) => (
                <div
                  key={o.id}
                  onClick={() => setSelectedOrder(o)}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '12px',
                    border: selectedOrder?.id === o.id ? '2px solid #166534' : '1px solid #E2E8F0',
                    backgroundColor: selectedOrder?.id === o.id ? '#ECFDF5' : '#F8FAFC',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#166534' }}>{o.id}</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>{o.customerName} · {formatDay(o.date)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: '#1E293B', fontSize: '0.9rem' }}>₹{o.totalAmount}</div>
                    <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>PAID</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Printable Invoice Preview Box */}
          <div style={{ backgroundColor: '#FFFFFF', padding: '1.5rem', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 14px rgba(0,0,0,0.04)' }}>
            {selectedOrder ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #166534', paddingBottom: '0.85rem' }}>
                  <div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#166534' }}>MILKYLUSH DAIRY PRODUCTS</div>
                    <div onClick={handleSetGstin} title="Click to set this hub's GSTIN" style={{ fontSize: '0.75rem', color: '#64748B', cursor: 'pointer' }}>GSTIN: {gstin || 'not set (click to add)'} • {HUB_NAMES[hubId]}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1E293B' }}>{gstin ? 'TAX INVOICE' : 'INVOICE'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{selectedOrder.id} · {formatDay(selectedOrder.date)}</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                  <strong>Billed To:</strong> {selectedOrder.customerName} <br />
                  <strong>Delivery Address:</strong> {selectedOrder.deliveryAddress || '—'}
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem' }}>Item</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 600 }}>{it.name} ({it.unit})</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>{it.qty}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>₹{(it.price * it.qty).toFixed(2)}</td>
                    </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #E2E8F0', paddingTop: '0.75rem', fontSize: '1rem', fontWeight: 800, color: '#166534' }}>
                  <span>Invoice Total:</span>
                  <span>₹{selectedOrder.totalAmount.toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{ flex: 1, padding: '0.65rem', borderRadius: '10px', backgroundColor: '#166534', color: '#FFFFFF', border: 'none', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Printer size={15} />
                    <span>Print Invoice</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()} title="Choose 'Save as PDF' in the print window"
                    style={{ flex: 1, padding: '0.65rem', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#166534', border: '1px solid #166534', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Download size={15} />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>
            ) : (
              <div>Select an invoice to preview</div>
            )}
          </div>
        </div>
      )}

      {selectedTab === 'invoice-summary' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
            Customer Monthly Subscription Billing Statements
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>CUSTOMER NAME</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>BILLING MONTH</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>DROPS DELIVERED</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800, textAlign: 'right' }}>MONTHLY INVOICE TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {statements.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#64748B' }}>Loading statements…</td></tr>
              )}
              {statements.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E293B' }}>{u.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{monthLabel}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#166534' }}>{u.drops} Drops</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#166534' }}>₹{u.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
