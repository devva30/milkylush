import React, { useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Trash2,
  Printer,
  Truck,
  Clock,
  CheckCircle2,
  CreditCard
} from 'lucide-react';
import type { Product } from '../../types';

interface CounterSalesPageProps {
  selectedTab: 'counter-sales' | 'daily-sales-load' | 'sales-requirement';
  products: Product[];
  selectedHubId: string;
}

export default function CounterSalesPage({ selectedTab, products, selectedHubId }: CounterSalesPageProps) {
  const [cart, setCart] = useState<Array<{ product: Product; qty: number }>>([]);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi'>('upi');
  const [customerPhone, setCustomerPhone] = useState('');

  const addToCart = (prod: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === prod.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].qty += 1;
        return copy;
      }
      return [...prev, { product: prod, qty: 1 }];
    });
  };

  const removeFromCart = (prodId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== prodId));
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.product.price * i.qty, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Toolbar */}
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#166534', margin: 0 }}>
          {selectedTab === 'counter-sales' && 'Counter Sales POS & Direct Billing'}
          {selectedTab === 'daily-sales-load' && 'Daily Fleet Sales Load Sheet'}
          {selectedTab === 'sales-requirement' && 'Sales Requirement & Demand Forecast'}
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '4px 0 0 0' }}>
          {selectedTab === 'counter-sales' && 'Direct store walk-in customer billing with cash / UPI instant receipts.'}
          {selectedTab === 'daily-sales-load' && 'Dispatch route product allocation and crate count loading manifests.'}
          {selectedTab === 'sales-requirement' && 'Projected dairy products required for tomorrow morning drops.'}
        </p>
      </div>

      {selectedTab === 'counter-sales' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Products Grid */}
          <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '20px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
              Select Dairy Products
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
              {products.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => addToCart(prod)}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '14px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#F8FAFC',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B', marginBottom: '4px' }}>{prod.name}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#166534' }}>₹{prod.price}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>{prod.unit || '1 L'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Cart & Billing Checkout Panel */}
          <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '20px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
              Current Cart &amp; Checkout
            </div>

            {cart.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', padding: '2rem' }}>
                <ShoppingBag size={36} style={{ marginBottom: '8px' }} />
                <div>Click items on the left to add to cart</div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {cart.map((item) => (
                    <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem', borderRadius: '10px', backgroundColor: '#F8FAFC' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>{item.product.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>₹{item.product.price} x {item.qty}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 800, color: '#166534', fontSize: '0.9rem' }}>₹{item.product.price * item.qty}</span>
                        <button type="button" onClick={() => removeFromCart(item.product.id)} style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '2px solid #E2E8F0', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Customer Phone (Optional)</label>
                    <input
                      type="text"
                      placeholder="Enter customer 10-digit phone..."
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['upi', 'cash'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMode(m)}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          borderRadius: '8px',
                          border: paymentMode === m ? '2px solid #166534' : '1px solid #CBD5E1',
                          backgroundColor: paymentMode === m ? '#ECFDF5' : '#FFFFFF',
                          color: paymentMode === m ? '#166534' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        {m.toUpperCase()} PAYMENT
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.1rem', fontWeight: 800, color: '#166534' }}>
                    <span>Grand Total:</span>
                    <span>₹{cartTotal.toFixed(2)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      alert(`Counter sale processed! ₹${cartTotal} received via ${paymentMode.toUpperCase()}. Receipt printed.`);
                      setCart([]);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '12px',
                      backgroundColor: '#166534',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <Printer size={16} />
                    <span>Complete Sale &amp; Print Receipt</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedTab === 'daily-sales-load' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
            Daily Dispatch Route Vehicle Loading Manifest
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>ROUTE / VEHICLE</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>RIDER PARTNER</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>MILK BOTTLES LOADED</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>CRATES</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800, textAlign: 'right' }}>LOAD STATUS</th>
              </tr>
            </thead>
            <tbody>
              {[
                { route: 'Route A - Hosur Town', rider: 'Murugan (TN-HSR-01)', bottles: '145 Bottles', crates: '12 Crates', status: 'Loaded & Dispatched' },
                { route: 'Route B - Bagalur Road', rider: 'Kumar (TN-HSR-02)', bottles: '180 Bottles', crates: '15 Crates', status: 'Loaded & Dispatched' },
                { route: 'Route C - Shoolagiri', rider: 'Ramesh (TN-HSR-03)', bottles: '120 Bottles', crates: '10 Crates', status: 'Loading in Progress' },
              ].map((r) => (
                <tr key={r.route} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E293B' }}>{r.route}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{r.rider}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#166534' }}>{r.bottles}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{r.crates}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <span style={{ backgroundColor: '#DCFCE7', color: '#166534', padding: '4px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTab === 'sales-requirement' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
            Tomorrow's Projected Sales Requirement &amp; Stock Demand
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>PRODUCT</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>SUBSCRIPTION DROPS</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>STORE COUNTER BUFFER</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800, textAlign: 'right' }}>TOTAL REQUIRED STOCK</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E293B' }}>{p.name}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#166534' }}>{120 - idx * 15} units</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>20 units buffer</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#166534' }}>{140 - idx * 15} units</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
