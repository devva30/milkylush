import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { User, Product, DeliveryAgent, Order } from '../../types';
import type { HubId } from '../../data/hubs';
import { addDays, todayKey } from '../../data/dates';
import { useHubProducts, sellingPrice } from '../../data/products';
import {
  useHubCustomers, findCustomers, isServerSearch, useCustomerAddresses, addressText, type Customer,
} from '../../data/customers';
import { createAdminOrder } from '../../data/orders';

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Unused: customers and products are loaded for the selected hub. Kept so callers compile. */
  users?: User[];
  products?: Product[];
  deliveryAgents: DeliveryAgent[];
  selectedHubId: string;
  /** Unused: the order is written here (HSR-ORD id + its delivery). */
  onSaveOrder?: (newOrder: Order) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.85rem',
  borderRadius: '10px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-main)',
  color: 'var(--text-main)',
  fontSize: '0.85rem',
  outline: 'none',
  boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem',
};

export const AddOrderModal: React.FC<AddOrderModalProps> = (props) => {
  // Hooks live in the form, which only mounts while the modal is open.
  if (!props.isOpen) return null;
  return <AddOrderForm {...props} />;
};

function AddOrderForm({ onClose, deliveryAgents, selectedHubId, showToast }: AddOrderModalProps) {
  const hubId = selectedHubId as HubId;
  const customersQuery = useHubCustomers(hubId);
  const products = useHubProducts(hubId).data.filter((p) => p.inStock);
  const [search, setSearch] = useState('');
  const [searchHits, setSearchHits] = useState<Customer[] | null>(null);

  const [userId, setUserId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [deliveryDate, setDeliveryDate] = useState(addDays(todayKey(), 1));
  const [agentId, setAgentId] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  // Latest customers, or phone / HSR-CUS search results
  useEffect(() => {
    if (!isServerSearch(search)) { setSearchHits(null); return; }
    let alive = true;
    findCustomers(hubId, search).then((hits) => alive && setSearchHits(hits)).catch(() => alive && setSearchHits([]));
    return () => { alive = false; };
  }, [hubId, search]);
  const customers = useMemo(() => {
    const list = searchHits ?? customersQuery.data;
    const t = search.trim().toLowerCase();
    return searchHits || !t ? list : list.filter((c) => (c.name || '').toLowerCase().includes(t));
  }, [searchHits, customersQuery.data, search]);

  useEffect(() => { if (!userId && customers[0]) setUserId(customers[0].id); }, [customers, userId]);
  useEffect(() => { if (!productId && products[0]) setProductId(products[0].id); }, [products, productId]);

  // The chosen customer's default address prefills the address box
  const addresses = useCustomerAddresses(userId || null);
  const customer = customers.find((c) => c.id === userId);
  const defaultAddr = addresses.data.find((a) => a.id === customer?.defaultAddressId) ?? addresses.data[0] ?? null;
  useEffect(() => {
    setAddress(defaultAddr ? addressText(defaultAddr) : (customer?.defaultAddressText ?? ''));
  }, [defaultAddr?.id, customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selProd = products.find((p) => p.id === productId);
    if (!customer) { showToast('Please select a customer.', 'error'); return; }
    if (!selProd) { showToast('Please select a valid product.', 'error'); return; }
    if (quantity < 1) { showToast('Quantity must be at least 1.', 'error'); return; }
    if (!address.trim()) { showToast('Please enter the delivery address.', 'error'); return; }
    if (deliveryDate < todayKey()) { showToast('Delivery date cannot be in the past.', 'error'); return; }
    const agent = deliveryAgents.find((a) => a.id === agentId);
    const useDoc = defaultAddr && address.trim() === addressText(defaultAddr);
    setSaving(true);
    try {
      const id = await createAdminOrder(hubId, {
        customer: { uid: customer.id, customerId: customer.customerId, name: customer.name, phone: customer.phone },
        address: useDoc ? defaultAddr : null,
        addressFallback: address.trim(),
        product: selProd,
        qty: quantity,
        deliveryDate,
        rider: agent ? { uid: agent.id, name: agent.name } : null,
      });
      showToast(`Created order ${id} (cash on delivery).`, 'success');
      onClose();
    } catch (err) {
      showToast(`Could not create the order: ${(err as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-color)',
          padding: '1.75rem',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Create New Doorstep Order
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
          <div>
            <label style={labelStyle}>Select Customer</label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setUserId(''); }}
              placeholder="Search name, phone or HSR-CUS-…"
              style={{ ...fieldStyle, marginBottom: '0.5rem' }}
            />
            <select value={userId} onChange={(e) => setUserId(e.target.value)} style={fieldStyle}>
              {customers.length === 0 && <option value="">{customersQuery.loading ? 'Loading customers…' : 'No customer found'}</option>}
              {customers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.customerId ? `${u.customerId}, ` : ''}{u.phone})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Select Product</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} style={fieldStyle}>
              {products.length === 0 && <option value="">No products in stock</option>}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ₹{sellingPrice(p.price, p.offerTag)} ({p.unit})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Quantity</label>
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Delivery Date</label>
              <input type="date" min={todayKey()} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} style={fieldStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Assign Fleet Rider</label>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} style={fieldStyle}>
              <option value="">From customer's route (at Generate)</option>
              {deliveryAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.assignedZone || 'Route'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Delivery Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={fieldStyle} />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{
              padding: '0.85rem',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '0.95rem',
              marginTop: '0.5rem',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Creating…' : 'Create Order & Dispatch'}
          </button>
        </form>
      </div>
    </div>
  );
}
