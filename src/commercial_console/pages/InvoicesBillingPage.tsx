import React, { useState } from 'react';
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
  orders: Order[];
  users: UserProfile[];
}

export default function InvoicesBillingPage({ selectedTab, orders, users }: InvoicesBillingPageProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(orders[0] || null);

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
              {orders.slice(0, 8).map((o) => (
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
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#166534' }}>INV-#{o.id.slice(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>{o.customerName || 'Valued Customer'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: '#1E293B', fontSize: '0.9rem' }}>₹{o.totalAmount || 70}</div>
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
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>GSTIN: 33AAACM1234F1Z9 • Hosur Central Hub</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1E293B' }}>TAX INVOICE</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>INV-#{selectedOrder.id.slice(0, 8).toUpperCase()}</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                  <strong>Billed To:</strong> {selectedOrder.customerName || 'Valued Customer'} <br />
                  <strong>Delivery Address:</strong> {selectedOrder.deliveryAddress || '5/251, Ezhil Nagar, Hosur'}
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
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 600 }}>Farm Fresh A2 Cow Milk (1 L)</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>1</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>₹{selectedOrder.totalAmount || 70}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #E2E8F0', paddingTop: '0.75rem', fontSize: '1rem', fontWeight: 800, color: '#166534' }}>
                  <span>Invoice Total:</span>
                  <span>₹{selectedOrder.totalAmount || 70}</span>
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
                    onClick={() => alert(`Downloaded PDF for Invoice INV-#${selectedOrder.id.slice(0, 8)}`)}
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
              {users.slice(0, 10).map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E293B' }}>{u.name || 'Subscriber'}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>September 2026</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#166534' }}>30 Drops</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#166534' }}>₹2,100.00</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
