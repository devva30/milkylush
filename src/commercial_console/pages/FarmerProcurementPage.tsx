import React, { useState, useMemo, useEffect } from 'react';
import {
  Milk,
  Users,
  Plus,
  Search,
  Download,
  Filter,
  UserCheck,
  Truck,
  Receipt,
  FileText,
  CreditCard,
  CheckCircle2,
  X
} from 'lucide-react';
import { auth } from '../../firebase';
import type { HubId } from '../../data/hubs';
import { formatDay, formatDateTime, todayKey } from '../../data/dates';
import {
  useFarmers, addFarmer, useProcurement, addProcurement, useFarmerPayments, pendingFarmerDues, payFarmer,
} from '../../data/commercial';
import { LoadMore } from '../../components/common/DataState';
import type { Farmer, MilkProcurementItem } from '../../types';

interface FarmerProcurementPageProps {
  selectedTab: 'farmers' | 'collection-persons' | 'milk-purchase' | 'purchase-reports' | 'rate-chart' | 'farmer-payments';
  selectedHubId: string;
  /** Unused: farmers and purchases are loaded for the hub. */
  farmers?: Farmer[];
  milkProcurements?: MilkProcurementItem[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function FarmerProcurementPage({
  selectedTab,
  selectedHubId,
  showToast,
}: FarmerProcurementPageProps) {
  const hubId = selectedHubId as HubId;
  const farmersQuery = useFarmers(hubId);
  const procQuery = useProcurement(hubId);
  const payments = useFarmerPayments(hubId);
  const [dues, setDues] = useState<Record<string, { amount: number; count: number }>>({});
  const [duesTick, setDuesTick] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    pendingFarmerDues(hubId).then((d) => alive && setDues(d)).catch(() => alive && setDues({}));
    return () => { alive = false; };
  }, [hubId, duesTick]);

  const farmers: Farmer[] = useMemo(() => farmersQuery.data.map((d) => ({
    id: d.id, code: d.id, name: d.name, phone: d.phone, village: d.village, hubId,
    dailySupplyLiters: d.dailySupplyLiters, bankAccount: d.bankAccount, status: d.status,
    createdAt: d.createdAt ? formatDateTime(d.createdAt) : '',
  })), [farmersQuery.data, hubId]);
  const milkProcurements: MilkProcurementItem[] = useMemo(() => procQuery.data.map((p) => ({
    id: p.id, farmerId: p.farmerId, farmerName: p.farmerName, farmerCode: p.farmerId, date: p.date,
    quantityLiters: p.litres, fatPercent: p.fat, snfPercent: p.snf, ratePerLiter: p.ratePerLitre / 100,
    totalPayout: p.amount / 100, hubId, collectionPerson: p.collectionPerson, paymentStatus: p.paymentStatus, createdAt: '',
  })), [procQuery.data, hubId]);
  const isHosur = selectedHubId === 'hosur';
  const hubTitle = isHosur ? 'Hosur Milk Collection Center' : 'Bangalore Procurement Station';

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddFarmerModalOpen, setIsAddFarmerModalOpen] = useState(false);
  const [isAddPurchaseModalOpen, setIsAddPurchaseModalOpen] = useState(false);

  // New Farmer Modal State
  // The id (HSR-FRM-###) is issued from the hub counter when the farmer is saved
  const [farmerCode, setFarmerCode] = useState(`${isHosur ? 'HSR' : 'BLR'}-FRM-### (assigned on save)`);
  const [farmerName, setFarmerName] = useState('');
  const [farmerPhone, setFarmerPhone] = useState('');
  const [farmerVillage, setFarmerVillage] = useState(isHosur ? 'Hosur Dairy Circle' : 'Anekal Village');
  const [dailySupply, setDailySupply] = useState('150');
  const [bankAccount, setBankAccount] = useState('');

  // Milk Purchase Modal State
  const [selectedFarmerId, setSelectedFarmerId] = useState('');
  const [milkLiters, setMilkLiters] = useState('120');
  const [fatPercentage, setFatPercentage] = useState('4.2');
  const [snfPercentage, setSnfPercentage] = useState('8.5');
  const collectionPerson = auth.currentUser?.email ?? 'admin';

  // Rate calculation formula: Base ₹38 for Fat 4.0% & SNF 8.5% (+ ₹0.5 per 0.1% Fat)
  const calcRatePerLiter = (fatStr: string) => {
    const fat = parseFloat(fatStr) || 4.0;
    const baseRate = 38.0;
    const diff = (fat - 4.0) * 5.0;
    return Math.max(30.0, baseRate + diff);
  };

  const currentRate = calcRatePerLiter(fatPercentage);
  const currentTotalPayout = (parseFloat(milkLiters) || 0) * currentRate;

  // Firestore Action: Add New Farmer
  const handleSaveFarmer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmerName.trim()) {
      showToast('Please enter farmer name', 'error');
      return;
    }
    if (!/^\+?\d{10,13}$/.test(farmerPhone.replace(/\s/g, ''))) {
      showToast('Please enter the farmer\'s 10-digit phone number', 'error');
      return;
    }
    try {
      const id = await addFarmer(hubId, {
        name: farmerName.trim(),
        phone: farmerPhone.replace(/\s/g, ''),
        village: farmerVillage.trim(),
        dailySupplyLiters: parseFloat(dailySupply) || 0,
        bankAccount: bankAccount.trim(),
      });
      showToast(`Added farmer ${farmerName} (${id})`, 'success');
      setIsAddFarmerModalOpen(false);
      setFarmerName('');
      setFarmerPhone('');
      setBankAccount('');
    } catch (err) {
      showToast(`Error adding farmer: ${(err as Error).message}`, 'error');
    }
  };

  // Firestore Action: Log Milk Procurement
  const handleSaveMilkPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(milkLiters) || 0;
    if (qty <= 0) {
      showToast('Please enter valid milk liters', 'error');
      return;
    }
    const targetFarmer = farmers.find((f) => f.id === selectedFarmerId) || farmers[0];
    if (!targetFarmer) {
      showToast('Add a farmer first.', 'error');
      return;
    }
    try {
      await addProcurement(hubId, {
        farmerId: targetFarmer.id,
        farmerName: targetFarmer.name,
        date: todayKey(),
        litres: qty,
        fat: parseFloat(fatPercentage) || 0,
        snf: parseFloat(snfPercentage) || 0,
        ratePerLitre: Math.round(currentRate * 100),
        amount: Math.round(currentTotalPayout * 100),
        collectionPerson,
      });
      showToast(`Logged procurement: ${qty}L from ${targetFarmer.name} @ ₹${currentRate.toFixed(2)}/L`, 'success');
      setIsAddPurchaseModalOpen(false);
      procQuery.retry();
      setDuesTick((t) => t + 1);
    } catch (err) {
      showToast(`Error logging purchase: ${(err as Error).message}`, 'error');
    }
  };

  const handlePayFarmer = async (farmerId: string, farmerName: string) => {
    const due = dues[farmerId];
    if (!due) return;
    const method = window.prompt(`Pay ₹${(due.amount / 100).toFixed(2)} to ${farmerName} for ${due.count} purchase(s). Payment method (e.g. NEFT, UPI, Cash):`, 'NEFT');
    if (!method) return;
    setBusy(true);
    try {
      const paid = await payFarmer(hubId, farmerId, farmerName, method.trim());
      showToast(`Recorded ₹${(paid / 100).toFixed(2)} paid to ${farmerName}`, 'success');
      setDuesTick((t) => t + 1);
      procQuery.retry();
    } catch (err) {
      showToast(`Could not record payment: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  // Collection staff, from who logged the purchases on screen
  const collectors = useMemo(() => {
    const m = new Map<string, { litres: number; days: Set<string>; farmers: Set<string> }>();
    milkProcurements.forEach((p) => {
      const row = m.get(p.collectionPerson) ?? { litres: 0, days: new Set<string>(), farmers: new Set<string>() };
      row.litres += p.quantityLiters;
      row.days.add(p.date);
      row.farmers.add(p.farmerName);
      m.set(p.collectionPerson, row);
    });
    return Array.from(m.entries()).map(([name, r]) => ({
      name, route: `${r.farmers.size} farmer(s)`, phone: '—', qty: `${Math.round(r.litres / Math.max(1, r.days.size))} L / day`,
    }));
  }, [milkProcurements]);

  // Display Farmers (Live Firestore Data with Fallbacks)
  const displayFarmers = farmers;
  const displayProcurements = milkProcurements;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #166534 0%, #047857 100%)',
          borderRadius: '20px',
          padding: '1.5rem 2rem',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 8px 20px rgba(22, 101, 52, 0.25)',
        }}
      >
        <div>
          <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, opacity: 0.9 }}>
            FARMER MILK PROCUREMENT &amp; RATE CHART • {hubTitle.toUpperCase()}
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '4px 0 4px', fontFamily: "'Poppins', sans-serif" }}>
            Raw Milk Purchases &amp; Farmer Settlements
          </h1>
          <p style={{ fontSize: '0.85rem', margin: 0, opacity: 0.9 }}>
            Direct milk collection from partner farmers with automated Fat % &amp; SNF % quality payout calculations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setIsAddFarmerModalOpen(true)}
            style={{
              padding: '0.65rem 1.1rem',
              borderRadius: '12px',
              border: '1px solid #A7F3D0',
              backgroundColor: '#ECFDF5',
              color: '#166534',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={16} />
            <span>Add New Farmer</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddPurchaseModalOpen(true)}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#FFFFFF',
              color: '#166534',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            <Milk size={16} />
            <span>Log Milk Purchase</span>
          </button>
        </div>
      </div>

      {/* Main Content Views */}
      {selectedTab === 'farmers' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B' }}>
                Partner Farmers &amp; Dairy Sellers Directory ({displayFarmers.length} Registered)
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748B' }}>Realtime Firestore collection: farmers</div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddFarmerModalOpen(true)}
              style={{ padding: '0.55rem 1rem', borderRadius: '10px', backgroundColor: '#166534', color: '#FFFFFF', border: 'none', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>Register Farmer</span>
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>FARMER CODE</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>FARMER NAME</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>PHONE NUMBER</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>VILLAGE / HUB</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>DAILY MILK SUPPLY</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800, textAlign: 'right' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {displayFarmers.map((f) => (
                <tr key={f.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#166534' }}>{f.code}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E293B' }}>{f.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{f.phone}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{f.village}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#166534' }}>{f.dailySupplyLiters} Liters / day</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <span style={{ backgroundColor: '#DCFCE7', color: '#166534', padding: '4px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800 }}>
                      ACTIVE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTab === 'milk-purchase' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
            Raw Milk Procurement Entry &amp; Quality Fat/SNF Test
          </div>

          <form onSubmit={handleSaveMilkPurchase}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Select Farmer</label>
                <select
                  value={selectedFarmerId}
                  onChange={(e) => setSelectedFarmerId(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  {displayFarmers.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Quantity (Liters)</label>
                <input
                  type="number"
                  value={milkLiters}
                  onChange={(e) => setMilkLiters(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Fat %</label>
                <input
                  type="number"
                  step="0.1"
                  value={fatPercentage}
                  onChange={(e) => setFatPercentage(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>SNF %</label>
                <input
                  type="number"
                  step="0.1"
                  value={snfPercentage}
                  onChange={(e) => setSnfPercentage(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Calculated Realtime Payout Box */}
            <div style={{ backgroundColor: '#ECFDF5', padding: '1.25rem', borderRadius: '14px', border: '1px solid #A7F3D0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#047857' }}>QUALITY CALCULATED RATE</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#166534' }}>
                  ₹{currentRate.toFixed(2)} / Liter
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#047857' }}>TOTAL FARMER PAYOUT</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#166534' }}>
                  ₹{currentTotalPayout.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              style={{ width: '100%', marginTop: '1.25rem', padding: '0.75rem', borderRadius: '12px', backgroundColor: '#166534', color: '#FFFFFF', border: 'none', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}
            >
              Submit Raw Milk Procurement Entry to Firestore
            </button>
          </form>
        </div>
      )}

      {selectedTab === 'purchase-reports' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
            Milk Purchase Ledger ({displayProcurements.length} Transactions)
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>DATE</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>FARMER</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>QUANTITY (L)</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>FAT / SNF %</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>RATE / L</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800, textAlign: 'right' }}>TOTAL PAYOUT</th>
              </tr>
            </thead>
            <tbody>
              {displayProcurements.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748B', fontWeight: 600 }}>{formatDay(p.date)}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E293B' }}>{p.farmerName} ({p.farmerCode})</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#166534' }}>{p.quantityLiters} L</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>Fat {p.fatPercent}% | SNF {p.snfPercent}%</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>₹{p.ratePerLiter}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#166534' }}>₹{p.totalPayout.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTab === 'purchase-reports' && <LoadMore hasMore={procQuery.hasMore} loading={procQuery.loadingMore} onClick={procQuery.loadMore} />}

      {selectedTab === 'collection-persons' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
            Milk Procurement Collection Staff Directory
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>STAFF NAME</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>ASSIGNED ROUTE</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>PHONE NUMBER</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800, textAlign: 'right' }}>DAILY MILK COLLECTED</th>
              </tr>
            </thead>
            <tbody>
              {collectors.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#64748B' }}>No milk purchases logged yet.</td></tr>
              )}
              {[...collectors
].map((c) => (
                <tr key={c.name} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E293B' }}>{c.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{c.route}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{c.phone}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#166534' }}>{c.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTab === 'rate-chart' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
            Quality Milk Purchase Rate Matrix (Fat % &amp; SNF %)
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'center' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                <th style={{ padding: '0.75rem', fontWeight: 800, textAlign: 'left' }}>FAT % \ SNF %</th>
                <th style={{ padding: '0.75rem', fontWeight: 800 }}>8.0% SNF</th>
                <th style={{ padding: '0.75rem', fontWeight: 800 }}>8.3% SNF</th>
                <th style={{ padding: '0.75rem', fontWeight: 800 }}>8.5% SNF</th>
                <th style={{ padding: '0.75rem', fontWeight: 800 }}>8.8% SNF</th>
              </tr>
            </thead>
            <tbody>
              {[
                { fat: '3.5% FAT', r1: 34.0, r2: 35.0, r3: 35.5, r4: 36.5 },
                { fat: '4.0% FAT', r1: 36.5, r2: 37.5, r3: 38.0, r4: 39.0 },
                { fat: '4.5% FAT', r1: 39.0, r2: 40.0, r3: 40.5, r4: 41.5 },
                { fat: '5.0% FAT', r1: 41.5, r2: 42.5, r3: 43.0, r4: 44.0 },
              ].map((row) => (
                <tr key={row.fat} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 800, color: '#166534', textAlign: 'left' }}>{row.fat}</td>
                  <td style={{ padding: '0.75rem', fontWeight: 700 }}>₹{row.r1.toFixed(1)}</td>
                  <td style={{ padding: '0.75rem', fontWeight: 700 }}>₹{row.r2.toFixed(1)}</td>
                  <td style={{ padding: '0.75rem', fontWeight: 800, color: '#059669', backgroundColor: '#ECFDF5' }}>₹{row.r3.toFixed(1)}</td>
                  <td style={{ padding: '0.75rem', fontWeight: 700 }}>₹{row.r4.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTab === 'farmer-payments' && (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
            Farmer Payout Transaction &amp; Settlement Log
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>TRANSACTION ID</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>FARMER</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>PAYMENT METHOD</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800 }}>STATUS</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 800, textAlign: 'right' }}>AMOUNT PAID</th>
              </tr>
            </thead>
            <tbody>
              {displayFarmers.filter((f) => dues[f.id]).map((f) => (
                <tr key={`due-${f.id}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#D97706' }}>{dues[f.id].count} unpaid purchase(s)</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E293B' }}>{f.name} ({f.code})</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{f.bankAccount ? `A/c ${f.bankAccount}` : '—'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <button type="button" disabled={busy} onClick={() => handlePayFarmer(f.id, f.name)}
                      style={{ backgroundColor: '#FEF3C7', color: '#D97706', padding: '3px 8px', borderRadius: '8px', fontWeight: 800, fontSize: '0.75rem', border: '1px solid #FDE68A', cursor: 'pointer' }}>
                      PENDING · Mark paid
                    </button>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#D97706' }}>₹{(dues[f.id].amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {payments.data.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#166534' }}>{p.paidAt ? formatDateTime(p.paidAt) : '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E293B' }}>{p.farmerName} ({p.farmerId})</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748B' }}>{p.method}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ backgroundColor: '#DCFCE7', color: '#166534', padding: '3px 8px', borderRadius: '8px', fontWeight: 800, fontSize: '0.75rem' }}>SETTLED</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#166534' }}>₹{(p.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {payments.data.length === 0 && Object.keys(dues).length === 0 && (
                <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#64748B' }}>No farmer dues or payouts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add New Farmer Modal */}
      {isAddFarmerModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.75rem', width: '100%', maxWidth: '480px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#166534' }}>Register New Partner Farmer</div>
              <button type="button" onClick={() => setIsAddFarmerModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveFarmer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Farmer Code</label>
                <input type="text" value={farmerCode} readOnly onChange={(e) => setFarmerCode(e.target.value)} style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Farmer Full Name</label>
                <input type="text" placeholder="e.g. Ramesh Gowda" value={farmerName} onChange={(e) => setFarmerName(e.target.value)} style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Phone Number</label>
                <input type="text" placeholder="10-digit mobile number" value={farmerPhone} onChange={(e) => setFarmerPhone(e.target.value)} style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Village / Center</label>
                <input type="text" value={farmerVillage} onChange={(e) => setFarmerVillage(e.target.value)} style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Expected Daily Supply (Liters)</label>
                <input type="number" value={dailySupply} onChange={(e) => setDailySupply(e.target.value)} style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setIsAddFarmerModalOpen(false)} style={{ flex: 1, padding: '0.65rem', borderRadius: '10px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '0.65rem', borderRadius: '10px', border: 'none', backgroundColor: '#166534', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>Save Farmer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
