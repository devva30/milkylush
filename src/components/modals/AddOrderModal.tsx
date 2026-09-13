import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { User, Product, DeliveryAgent, Order } from '../../types';

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  products: Product[];
  deliveryAgents: DeliveryAgent[];
  selectedHubId: string;
  onSaveOrder: (newOrder: Order) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AddOrderModal: React.FC<AddOrderModalProps> = ({
  isOpen,
  onClose,
  users,
  products,
  deliveryAgents,
  selectedHubId,
  onSaveOrder,
  showToast,
}) => {
  if (!isOpen) return null;

  const firstUser = users[0];
  const firstProd = products[0];
  const firstAgent = deliveryAgents[0];

  const [userId, setUserId] = useState(firstUser ? firstUser.id : '');
  const [productId, setProductId] = useState(firstProd ? firstProd.id : '');
  const [quantity, setQuantity] = useState(1);
  const [orderType, setOrderType] = useState<'one-time' | 'subscription'>('one-time');
  const [agentId, setAgentId] = useState(firstAgent ? firstAgent.id : '');
  const [address, setAddress] = useState(firstUser?.savedAddresses?.[0] || 'Operational Hub Area');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selProd = products.find((p) => p.id === productId);
    if (!selProd) {
      showToast('Please select a valid product.', 'error');
      return;
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    const total = (selProd.price || 0) * quantity;

    const newOrder: Order = {
      id: orderId,
      userId: userId || 'guest-user',
      items: [
        {
          id: `item-${Date.now()}`,
          product: selProd,
          quantity: quantity,
          isSubscription: orderType === 'subscription',
        },
      ],
      orderDate: new Date().toISOString(),
      estimatedDelivery: new Date().toISOString(),
      totalAmount: total,
      status: 'packed',
      isSubscriptionDelivery: orderType === 'subscription',
      orderType: orderType,
      bottlesReturned: 0,
      bottleCreditsApplied: 0,
      deliveryAgentId: agentId,
      hubId: selectedHubId,
      address: address,
      deliveryAddress: address,
    };

    onSaveOrder(newOrder);
    onClose();
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
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
              Select Customer
            </label>
            <select
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                const u = users.find((usr) => usr.id === e.target.value);
                if (u?.savedAddresses?.[0]) setAddress(u.savedAddresses[0]);
              }}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.phone})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
              Select Product
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ₹{p.price} ({p.unit})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                Quantity
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                Order Type
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as 'one-time' | 'subscription')}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                <option value="one-time">One-Time Delivery</option>
                <option value="subscription">Subscription Delivery</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
              Assign Fleet Rider
            </label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            >
              <option value="">Unassigned Rider</option>
              {deliveryAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.assignedZone || 'Route'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
              Delivery Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{
              padding: '0.85rem',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '0.95rem',
              marginTop: '0.5rem',
            }}
          >
            Create Order & Dispatch
          </button>
        </form>
      </div>
    </div>
  );
};
