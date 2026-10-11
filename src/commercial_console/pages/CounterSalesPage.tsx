import React, { useState, useMemo, useEffect } from 'react';
import { getDoc, query, where } from 'firebase/firestore';
import { hubCol, hubDoc, type HubId } from '../../data/hubs';
import { addDays, formatDay, todayKey } from '../../data/dates';
import { useHubProducts, sellingPrice } from '../../data/products';
import { useLiveQuery } from '../../data/useFirestore';
import type { DeliveryDoc } from '../../data/deliveries';
import { useHubRoutes } from '../../data/routes';
import { createCounterSale } from '../../data/commercial';
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
  /** Unused: the hub's in-stock products are loaded here. */
  products?: Product[];
  selectedHubId: string;
}

export default function CounterSalesPage({ selectedTab, selectedHubId }: CounterSalesPageProps) {
  const hubId = selectedHubId as HubId;
  const catalog = useHubProducts(hubId).data;
  // Counter sells at the same selling price the app shows
  const products = useMemo(() => catalog.filter((p) => p.inStock).map((p) => ({ ...p, price: sellingPrice(p.price, p.offerTag) })), [catalog]);
  const [saving, setSaving] = useState(false);

  // Load sheet = today's drops; requirement = tomorrow's drops (after Generate)
  const today = todayKey();
  const tomorrow = addDays(today, 1);
  const loadDate = selectedTab === 'daily-sales-load' ? today : selectedTab === 'sales-requirement' ? tomorrow : null;
  const drops = useLiveQuery<DeliveryDoc>(
    loadDate ? query(hubCol(hubId, 'deliveries'), where('date', '==', loadDate)) : null, [hubId, loadDate]);
  const routes = useHubRoutes(hubId);
  const [loadSettings, setLoadSettings] = useState({ bottlesPerCrate: 12, counterBufferPercent: 10 });
  useEffect(() => {
    getDoc(hubDoc(hubId, 'settings', 'delivery')).then((d) => setLoadSettings({
      bottlesPerCrate: Number(d.data()?.bottlesPerCrate) || 12,
      counterBufferPercent: Number(d.data()?.counterBufferPercent ?? 10),
    })).catch(() => undefined);
  }, [hubId]);

  const loadRows = useMemo(() => {
    const byRider = new Map<string, { route: string; rider: string; bottles: number; total: number; out: number; done: number }>();
    drops.data.filter((d) => d.status !== 'skipped' && d.status !== 'cancelled').forEach((d) => {
      const key = d.riderUid ?? 'none';
      const route = routes.data.find((r) => r.id === d.routeId || r.riderUid === d.riderUid);
      const row = byRider.get(key) ?? { route: route?.name ?? 'No route', rider: d.riderName ?? 'Unassigned', bottles: 0, total: 0, out: 0, done: 0 };
      row.bottles += d.items.reduce((n, i) => n + i.qty, 0);
      row.total++;
      if (d.status === 'out_for_delivery') row.out++;
      if (d.status === 'delivered' || d.status === 'failed') row.done++;
      byRider.set(key, row);
    });
    return Array.from(byRider.values()).map((r) => ({
      route: r.route,
      rider: r.rider,
      bottles: `${r.bottles} units`,
      crates: `${Math.ceil(r.bottles / loadSettings.bottlesPerCrate)} Crates`,
      status: r.done === r.total ? 'Route completed' : r.out > 0 || r.done > 0 ? 'Out for delivery' : 'To load',
    }));
  }, [drops.data, routes.data, loadSettings]);

  const requirementRows = useMemo(() => {
    const byProduct = new Map<string, { name: string; unit: string; qty: number }>();
    drops.data.filter((d) => d.status === 'scheduled').forEach((d) => d.items.forEach((i) => {
      const row = byProduct.get(i.productId) ?? { name: i.name, unit: i.unit, qty: 0 };
      row.qty += i.qty;
      byProduct.set(i.productId, row);
    }));
    return Array.from(byProduct.entries()).map(([id, r]) => {
      const buffer = Math.ceil((r.qty * loadSettings.counterBufferPercent) / 100);
      return { id, name: `${r.name} (${r.unit})`, qty: r.qty, buffer, total: r.qty + buffer };
    }).sort((a, b) => b.qty - a.qty);
  }, [drops.data, loadSettings]);
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
                  <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>{prod.unit || '—'}</div>
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
                        <span style={{ fontWeight: 800, color: '#166534', fontSize: '0.9rem' }}>₹{(item.product.price * item.qty).toFixed(2)}</span>
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
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await createCounterSale(hubId, cart.map((i) => ({
                          productId: i.product.id, name: i.product.name, unit: i.product.unit ?? '', price: Math.round(i.product.price * 100), qty: i.qty,
                        })), paymentMode, customerPhone);
                        window.print();
                        alert(`Counter sale saved: ₹${cartTotal.toFixed(2)} via ${paymentMode.toUpperCase()}.`);
                        setCart([]);
                        setCustomerPhone('');
                      } catch (err) {
                        alert(`Could not save the sale: ${(err as Error).message}`);
                      } finally {
                        setSaving(false);
                      }
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
            Daily Dispatch Route Vehicle Loading Manifest · {formatDay(today)}
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
              {loadRows.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#64748B' }}>{drops.loading ? 'Loading…' : `No drops for ${formatDay(today)}. Generate deliveries first.`}</td></tr>
              )}
              {[...loadRows
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
            Tomorrow's Projected Sales Requirement &amp; Stock Demand · {formatDay(tomorrow)}
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
              {requirementRows.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#64748B' }}>{drops.loading ? 'Loading…' : `No drops generated for ${formatDay(tomorrow)} yet. Generate deliveries for tomorrow first.`}</td></tr>
              )}
              {requirementRows.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E293B' }}>{p.name}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#166534' }}>{p.qty} units</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{p.buffer} units buffer ({loadSettings.counterBufferPercent}%)</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#166534' }}>{p.total} units</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
