import { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Download,
  Package,
  CreditCard,
  CheckCircle2,
  BarChart2,
  ArrowUpRight
} from 'lucide-react';
import type { Order, Product } from '../../types';
import type { HubId } from '../../data/hubs';
import { useHubProducts } from '../../data/products';
import {
  usePeriodTotals, procurementTotals, loadExpenses, saveExpense, periodRange, NO_EXPENSES,
  type Period, type ExpenseMonth,
} from '../../data/commercial';
import { PageLoader, ErrorState } from '../../components/common/DataState';

interface ProfitLossPageProps {
  selectedHubId: string;
  /** Unused: the page loads closed-day totals, purchases and expenses itself. */
  orders?: Order[];
  products?: Product[];
  totalRevenue?: number;
  viewMode?: 'profit-loss' | 'products-analytics' | 'expenses';
}

export default function ProfitLossPage({
  selectedHubId,
  viewMode = 'profit-loss'
}: ProfitLossPageProps) {
  const [dateRange, setDateRange] = useState<'today' | 'this_week' | 'this_month' | 'this_year'>('this_month');
  const isHosur = selectedHubId === 'hosur';
  const hubName = isHosur ? 'Hosur Hub' : 'Bangalore Hub';

  const hubId = selectedHubId as HubId;
  const products = useHubProducts(hubId).data;
  const period: Period = dateRange === 'today' ? 'today' : dateRange === 'this_week' ? 'week' : dateRange === 'this_year' ? 'year' : 'month';
  const totalsQuery = usePeriodTotals(hubId, period);
  const [costs, setCosts] = useState<{ procurement: number; expenses: ExpenseMonth } | null>(null);
  const [costTick, setCostTick] = useState(0);

  // Milk bought in the period + expenses (monthly amounts; part of the month for today / this week)
  useEffect(() => {
    let alive = true;
    setCosts(null);
    const { from, to } = periodRange(period);
    const thisMonth = to.slice(0, 7);
    const months = period === 'year'
      ? Array.from({ length: Number(thisMonth.slice(5, 7)) }, (_, i) => `${thisMonth.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`)
      : [thisMonth];
    const daysInMonth = new Date(Number(thisMonth.slice(0, 4)), Number(thisMonth.slice(5, 7)), 0).getDate();
    const share = period === 'today' ? 1 / daysInMonth : period === 'week' ? 7 / daysInMonth : 1;
    Promise.all([procurementTotals(hubId, from, to), loadExpenses(hubId, months)]).then(([p, e]) => {
      if (!alive) return;
      const scaled = Object.fromEntries(Object.entries(e).map(([k, v]) => [k, Math.round(v * share)])) as unknown as ExpenseMonth;
      setCosts({ procurement: p.amount, expenses: scaled });
    }).catch(() => alive && setCosts({ procurement: 0, expenses: { ...NO_EXPENSES } }));
    return () => { alive = false; };
  }, [hubId, period, costTick]);

  const t = totalsQuery.data?.sum;
  // Sales = delivered drops + counter sales (closed days), in ₹
  const realTotalRevenue = t ? ((t.deliveredValue ?? 0) + (t.counterSales ?? 0)) / 100 : 0;
  const deliveredOrders = { length: t?.deliveriesDone ?? 0 };

  const productAnalyticsList = useMemo(() => (totalsQuery.data?.products ?? []).map((p) => {
    const catalog = products.find((c) => c.id === p.id);
    return {
      name: p.name,
      category: catalog?.category || '—',
      price: p.qty ? Math.round(p.value / p.qty) / 100 : 0,
      unitsSold: p.qty,
      totalRev: p.value / 100,
    };
  }), [totalsQuery.data, products]);

  const e = costs?.expenses ?? NO_EXPENSES;
  const cogsProcurement = (costs?.procurement ?? 0) / 100;
  const cogsPackaging = e.packaging / 100;
  const cogsLogistics = e.logistics / 100;
  const totalCogs = cogsProcurement + cogsPackaging + cogsLogistics;
  const grossProfit = realTotalRevenue - totalCogs;
  const opexSalaries = e.payroll / 100;
  const opexElectricity = e.utilities / 100;
  const opexMarketing = e.marketing / 100;
  const totalOpex = opexSalaries + opexElectricity + opexMarketing;
  const netProfit = grossProfit - totalOpex;
  const netMargin = realTotalRevenue > 0 ? ((netProfit / (realTotalRevenue || 1)) * 100).toFixed(1) : '0.0';

  // Expenses are entered per month on the Expenses view (click an amount)
  const editExpense = async (field: keyof ExpenseMonth, label: string) => {
    const month = periodRange('month').to.slice(0, 7);
    const raw = window.prompt(`${label} for ${month} (₹, whole month)`);
    if (raw === null) return;
    const rupees = Number(raw.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(rupees) || rupees < 0) { alert('Enter a valid amount.'); return; }
    await saveExpense(hubId, month, field, Math.round(rupees * 100));
    setCostTick((x) => x + 1);
  };

  const csv = (name: string, rows: (string | number)[][]) => {
    const body = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(body));
    link.setAttribute('download', `${name}_${hubId}_${periodRange(period).from}_to_${periodRange(period).to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportReport = () => {
    if (viewMode === 'products-analytics') {
      csv('Products', [['Product', 'Category', 'Unit price', 'Units delivered', 'Revenue'],
        ...productAnalyticsList.map((p) => [p.name, p.category, p.price, p.unitsSold, p.totalRev])]);
    } else {
      csv(viewMode === 'expenses' ? 'Expenses' : 'ProfitLoss', [['Line', 'Amount (₹)'],
        ['Sales (delivered + counter)', realTotalRevenue], ['Milk purchases', cogsProcurement], ['Packaging', cogsPackaging],
        ['Logistics', cogsLogistics], ['Payroll', opexSalaries], ['Utilities', opexElectricity], ['Marketing', opexMarketing],
        ['Net profit', netProfit]]);
    }
  };

  if (totalsQuery.error) return <ErrorState message={`Could not load totals: ${totalsQuery.error}`} onRetry={totalsQuery.retry} />;
  if (!totalsQuery.data || !costs) return <PageLoader label="Loading profit & loss…" />;

  // RENDER VIEW 1: PRODUCTS ANALYTICS
  if (viewMode === 'products-analytics') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 800, color: '#047857', margin: 0 }}>
              My Products Revenue &amp; Sales Analytics
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Real-time sales breakdown by dairy product catalog, unit volumes sold, and revenue share for {hubName}.
            </p>
          </div>

          <button
            onClick={handleExportReport}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              border: '1px solid #A7F3D0',
              backgroundColor: '#ECFDF5',
              color: '#047857',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={15} /> Export Products Report
          </button>
        </div>

        {/* 3 Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.15rem', borderRadius: '14px', border: '1px solid var(--border-color)', borderLeft: '4px solid #047857' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>CATALOG PRODUCTS</div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#047857', margin: '4px 0', fontFamily: 'var(--font-title)' }}>{productAnalyticsList.length} Items</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active dairy SKUs</div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.15rem', borderRadius: '14px', border: '1px solid var(--border-color)', borderLeft: '4px solid #0284C7' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>TOTAL UNITS SOLD</div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0284C7', margin: '4px 0', fontFamily: 'var(--font-title)' }}>
              {productAnalyticsList.reduce((acc, p) => acc + p.unitsSold, 0)} Units
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fulfilled drops</div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.15rem', borderRadius: '14px', border: '1px solid var(--border-color)', borderLeft: '4px solid #8B5CF6' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>GROSS PRODUCT REVENUE</div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#8B5CF6', margin: '4px 0', fontFamily: 'var(--font-title)' }}>
              ₹{realTotalRevenue.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Realtime Firestore sales</div>
          </div>
        </div>

        {/* Product Sales Table */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="admin-table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-main)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>PRODUCT NAME</th>
                  <th style={{ padding: '0.85rem 1rem' }}>CATEGORY</th>
                  <th style={{ padding: '0.85rem 1rem' }}>UNIT PRICE</th>
                  <th style={{ padding: '0.85rem 1rem' }}>UNITS DELIVERED</th>
                  <th style={{ padding: '0.85rem 1rem' }}>GROSS REVENUE</th>
                  <th style={{ padding: '0.85rem 1rem' }}>SHARE %</th>
                </tr>
              </thead>
              <tbody>
                {productAnalyticsList.map((p, idx) => {
                  const share = realTotalRevenue > 0 ? ((p.totalRev / (realTotalRevenue || 1)) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Package size={16} style={{ color: '#047857' }} />
                          {p.name}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.category}</td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>₹{p.price}</td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#0284C7', fontSize: '0.88rem' }}>{p.unitsSold} units</td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#047857', fontSize: '0.9rem' }}>₹{p.totalRev.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', backgroundColor: '#ECFDF5', padding: '3px 8px', borderRadius: '10px' }}>
                          {share}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // RENDER VIEW 2: EXPENSES & CATEGORIES
  if (viewMode === 'expenses') {
    const expenseCategories = [
      { category: 'Farmer Raw Milk Procurement', vendor: 'Milk purchases (Farmers page)', monthlyCost: cogsProcurement, type: 'Direct COGS', status: cogsProcurement > 0 ? 'FROM PURCHASES' : 'NONE', field: null },
      { category: 'Glass Bottles & Foil Seals', vendor: 'Click amount to enter', monthlyCost: cogsPackaging, type: 'Packaging', status: cogsPackaging > 0 ? 'ENTERED' : 'NOT SET', field: 'packaging' as const },
      { category: 'Delivery Rider Fleet Payouts', vendor: 'Click amount to enter', monthlyCost: cogsLogistics, type: 'Logistics', status: cogsLogistics > 0 ? 'ENTERED' : 'NOT SET', field: 'logistics' as const },
      { category: 'Hub Operations & Staff Payroll', vendor: 'Click amount to enter', monthlyCost: opexSalaries, type: 'Payroll', status: opexSalaries > 0 ? 'ENTERED' : 'NOT SET', field: 'payroll' as const },
      { category: 'Cold Storage Refrigeration & Utilities', vendor: 'Click amount to enter', monthlyCost: opexElectricity, type: 'Utilities', status: opexElectricity > 0 ? 'ENTERED' : 'NOT SET', field: 'utilities' as const },
      { category: 'WhatsApp Marketing & Broadcasts', vendor: 'Click amount to enter', monthlyCost: opexMarketing, type: 'Marketing', status: opexMarketing > 0 ? 'ENTERED' : 'NOT SET', field: 'marketing' as const },
    ];

    const totalExpenseSum = expenseCategories.reduce((acc, c) => acc + c.monthlyCost, 0);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 800, color: '#DC2626', margin: 0 }}>
              Expenses &amp; Cost Categories Ledger
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Real-time operational expenses, procurement payouts, logistics costs, and utilities for {hubName}.
            </p>
          </div>

          <button
            onClick={handleExportReport}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              border: '1px solid #FCA5A5',
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={15} /> Export Expenses CSV
          </button>
        </div>

        {/* 3 Metric Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.15rem', borderRadius: '14px', border: '1px solid var(--border-color)', borderLeft: '4px solid #DC2626' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>TOTAL OPERATIONAL EXPENSES</div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#DC2626', margin: '4px 0', fontFamily: 'var(--font-title)' }}>
              ₹{totalExpenseSum.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>COGS + Operating Expenses</div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.15rem', borderRadius: '14px', border: '1px solid var(--border-color)', borderLeft: '4px solid #D97706' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>MILK PROCUREMENT SHARE</div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#D97706', margin: '4px 0', fontFamily: 'var(--font-title)' }}>
              ₹{cogsProcurement.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Farmer payouts</div>
          </div>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.15rem', borderRadius: '14px', border: '1px solid var(--border-color)', borderLeft: '4px solid #2563EB' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>FLEET &amp; LOGISTICS FEE</div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#2563EB', margin: '4px 0', fontFamily: 'var(--font-title)' }}>
              ₹{cogsLogistics.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rider route commissions</div>
          </div>
        </div>

        {/* Expenses Table */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="admin-table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-main)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>EXPENSE CATEGORY</th>
                  <th style={{ padding: '0.85rem 1rem' }}>VENDOR / RECIPIENT</th>
                  <th style={{ padding: '0.85rem 1rem' }}>COST CLASSIFICATION</th>
                  <th style={{ padding: '0.85rem 1rem' }}>MONTHLY OUTFLOW</th>
                  <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {expenseCategories.map((exp, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CreditCard size={16} style={{ color: '#DC2626' }} />
                        {exp.category}
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{exp.vendor}</td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#D97706', fontSize: '0.8rem' }}>{exp.type}</td>
                    <td onClick={() => exp.field && editExpense(exp.field, exp.category)} title={exp.field ? 'Click to set this month\'s amount' : 'From milk purchases'}
                      style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#DC2626', fontSize: '0.9rem', cursor: exp.field ? 'pointer' : 'default', textDecoration: exp.field ? 'underline dotted' : 'none' }}>₹{exp.monthlyCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857', backgroundColor: '#ECFDF5', padding: '3px 8px', borderRadius: '10px' }}>
                        {exp.status}
                      </span>
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

  // DEFAULT RENDER: PROFIT & LOSS STATEMENT (P&L)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      {/* Header & Date Range Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '1.6rem', fontWeight: 800, color: '#047857', margin: 0 }}>
            Profit &amp; Loss Statement (P&amp;L)
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Real-time financial performance summary, gross income, farmer procurement costs &amp; net margin for {hubName}.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-main)', padding: '4px', borderRadius: '12px', gap: '4px', border: '1px solid var(--border-color)' }}>
            {(['today', 'this_week', 'this_month', 'this_year'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDateRange(r)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: dateRange === r ? '#047857' : 'transparent',
                  color: dateRange === r ? '#FFFFFF' : 'var(--text-main)',
                  transition: 'all 0.15s ease',
                }}
              >
                {r.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportReport}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '10px',
              border: '1px solid #A7F3D0',
              backgroundColor: '#ECFDF5',
              color: '#047857',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Download size={15} />
            <span>Export P&amp;L Report</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)', borderLeft: '4px solid #047857' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL GROSS INCOME</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#047857', margin: '4px 0', fontFamily: 'var(--font-title)' }}>
            ₹{realTotalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>Subscriptions + One-Time orders</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)', borderLeft: '4px solid #DC2626' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>COST OF GOODS SOLD (COGS)</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#DC2626', margin: '4px 0', fontFamily: 'var(--font-title)' }}>
            ₹{totalCogs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 700 }}>Milk purchase, bottles &amp; rider fee</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)', borderLeft: '4px solid #D97706' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>OPERATING EXPENSES</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#D97706', margin: '4px 0', fontFamily: 'var(--font-title)' }}>
            ₹{totalOpex.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#D97706', fontWeight: 700 }}>Salaries, electricity &amp; marketing</div>
        </div>

        <div style={{ backgroundColor: '#ECFDF5', padding: '1.25rem', borderRadius: '16px', border: '1px solid #A7F3D0' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#047857' }}>NET OPERATING PROFIT</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#047857', margin: '4px 0', fontFamily: 'var(--font-title)' }}>
            ₹{netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 800 }}>Net Margin: {netMargin}%</div>
        </div>
      </div>

      {/* Itemized P&L Table */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '20px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>
          Financial Statement Breakdown
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>ACCOUNT / CATEGORY</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>TYPE</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 800, textAlign: 'right' }}>AMOUNT (₹)</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 800, textAlign: 'right' }}>% OF REVENUE</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ backgroundColor: 'rgba(4, 120, 87, 0.1)', fontWeight: 800, color: '#047857' }}>
              <td colSpan={4} style={{ padding: '0.75rem 1rem' }}>1. REVENUE STREAMS (INCOME)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600, color: 'var(--text-main)' }}>Fulfilled Milk Drops Revenue</td>
              <td style={{ padding: '0.75rem 1rem', color: '#047857', fontWeight: 700 }}>Income</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>₹{realTotalRevenue.toLocaleString('en-IN')}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-main)' }}>100.0%</td>
            </tr>

            <tr style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', fontWeight: 800, color: '#DC2626' }}>
              <td colSpan={4} style={{ padding: '0.75rem 1rem' }}>2. DIRECT COST OF GOODS SOLD (COGS)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600, color: 'var(--text-main)' }}>Farmer Milk Procurement Payouts (Raw Milk)</td>
              <td style={{ padding: '0.75rem 1rem', color: '#DC2626', fontWeight: 700 }}>Direct Cost</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>- ₹{cogsProcurement.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-main)' }}>{((cogsProcurement / (realTotalRevenue || 1)) * 100).toFixed(1)}%</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600, color: 'var(--text-main)' }}>Glass Bottles &amp; Packaging</td>
              <td style={{ padding: '0.75rem 1rem', color: '#DC2626', fontWeight: 700 }}>Direct Cost</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>- ₹{cogsPackaging.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-main)' }}>{((cogsPackaging / (realTotalRevenue || 1)) * 100).toFixed(1)}%</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600, color: 'var(--text-main)' }}>Delivery Fleet Rider Drop Fee</td>
              <td style={{ padding: '0.75rem 1rem', color: '#DC2626', fontWeight: 700 }}>Direct Cost</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>- ₹{cogsLogistics.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-main)' }}>{((cogsLogistics / (realTotalRevenue || 1)) * 100).toFixed(1)}%</td>
            </tr>

            <tr style={{ backgroundColor: 'rgba(217, 119, 6, 0.1)', fontWeight: 800, color: '#D97706' }}>
              <td colSpan={4} style={{ padding: '0.75rem 1rem' }}>3. OPERATING EXPENSES (OPEX)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600, color: 'var(--text-main)' }}>Hub Operations Staff Salaries</td>
              <td style={{ padding: '0.75rem 1rem', color: '#D97706', fontWeight: 700 }}>Expense</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#D97706' }}>- ₹{opexSalaries.toLocaleString()}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-main)' }}>{((opexSalaries / (realTotalRevenue || 1)) * 100).toFixed(1)}%</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600, color: 'var(--text-main)' }}>Hub Cold Storage Refrigeration</td>
              <td style={{ padding: '0.75rem 1rem', color: '#D97706', fontWeight: 700 }}>Expense</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#D97706' }}>- ₹{opexElectricity.toLocaleString()}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-main)' }}>{((opexElectricity / (realTotalRevenue || 1)) * 100).toFixed(1)}%</td>
            </tr>

            <tr style={{ backgroundColor: '#ECFDF5', fontSize: '1rem', fontWeight: 800, color: '#047857' }}>
              <td colSpan={2} style={{ padding: '1rem' }}>FINAL NET OPERATING PROFIT</td>
              <td style={{ padding: '1rem', textAlign: 'right' }}>₹{netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
              <td style={{ padding: '1rem', textAlign: 'right' }}>{netMargin}% Net Margin</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
