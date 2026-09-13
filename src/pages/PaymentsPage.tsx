import { useState } from 'react';
import { CreditCard, Search } from 'lucide-react';
import type { User, Order } from '../types';

interface PaymentsPageProps {
  selectedHubId: string;
  users: User[];
  orders: Order[];
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function PaymentsPage({ selectedHubId, users, orders, showToast }: PaymentsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const isHosur = selectedHubId === 'hub_hosur_main';

  const totalWalletBalances = users.reduce((sum, u) => sum + (u.walletBalance || 0), 0);
  const totalDeliveredRevenue = orders
    .filter((o) => o.status === 'delivered')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
      
      {/* Header */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          Payments Ledger & Wallet Cashflow 💳
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Real-time payment transactions, customer wallet balances, and revenue audit for <strong>{isHosur ? 'Hosur Hub' : 'Bangalore Hub'}</strong>.
        </p>
      </div>

      {/* Summary Stat Cards */}
      <div className="metrics-grid-4">
        <div className="metric-card-clean">
          <div>
            <div className="metric-label">TOTAL DELIVERED CASHFLOW</div>
            <div className="metric-val">₹{totalDeliveredRevenue.toLocaleString('en-IN')}</div>
            <div className="metric-trend up">▲ Verified Receipts</div>
          </div>
          <div className="metric-icon-bg">
            <CreditCard size={20} />
          </div>
        </div>

        <div className="metric-card-clean">
          <div>
            <div className="metric-label">PREPAID WALLET BALANCES</div>
            <div className="metric-val">₹{totalWalletBalances.toLocaleString('en-IN')}</div>
            <div className="metric-trend up">▲ Customer Float</div>
          </div>
          <div className="metric-icon-bg" style={{ backgroundColor: '#D1FAE5', color: '#10B981' }}>
            <CreditCard size={20} />
          </div>
        </div>
      </div>

      {/* Table Panel */}
      <div className="card-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', fontWeight: 700, margin: 0 }}>Customer Wallet Ledger</h3>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.4rem 0.85rem 0.4rem 30px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                fontSize: '0.8rem',
                color: 'var(--text-main)',
                outline: 'none',
                width: '240px',
              }}
            />
          </div>
        </div>

        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Current Wallet Balance</th>
                <th>Eco Credits</th>
                <th>Bottles Returned</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter((u) => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.phone.includes(searchQuery))
                .map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>{u.phone}</td>
                    <td style={{ fontWeight: 800, color: u.walletBalance >= 0 ? '#10B981' : '#EF4444' }}>
                      ₹{u.walletBalance || 0}
                    </td>
                    <td style={{ fontWeight: 600 }}>{u.ecoCreditsEarned || 0} pts</td>
                    <td>{u.emptyBottlesReturned || 0} bottles</td>
                    <td>
                      <button
                        onClick={() => showToast(`Opened wallet topup modal for ${u.name}`, 'info')}
                        className="btn-secondary"
                        style={{ padding: '0.25rem 0.65rem', fontSize: '0.72rem' }}
                      >
                        Topup / Adjust Wallet
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
