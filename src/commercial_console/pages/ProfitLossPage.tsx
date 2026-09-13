import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Download,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import type { Order } from '../../types';

interface ProfitLossPageProps {
  selectedHubId: string;
  orders: Order[];
  totalRevenue: number;
}

export default function ProfitLossPage({ selectedHubId, orders, totalRevenue }: ProfitLossPageProps) {
  const [dateRange, setDateRange] = useState<'today' | 'this_week' | 'this_month' | 'all_time'>('this_month');

  // Compute Revenue Streams
  const deliveredOrders = orders.filter((o) => o.status === 'delivered');
  const directSubscriptionRevenue = totalRevenue > 0 ? totalRevenue : 145000;
  const oneTimeOrdersRevenue = deliveredOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 38500);
  const counterSalesRevenue = 12400;
  const totalIncome = directSubscriptionRevenue + oneTimeOrdersRevenue + counterSalesRevenue;

  // Direct Procurement & Logistics Costs
  const farmerMilkProcurementCost = totalIncome * 0.42; // 42% cost of raw milk from farmers
  const packagingBottlesCost = totalIncome * 0.08; // 8% glass bottles & sealing foil
  const deliveryRiderPayouts = deliveredOrders.length * 16 + 8500; // Rider commissions
  const hubColdStorageElectricity = 14500; // Cold storage refrigeration
  const totalCostOfGoods = farmerMilkProcurementCost + packagingBottlesCost + deliveryRiderPayouts + hubColdStorageElectricity;

  const grossProfit = totalIncome - totalCostOfGoods;

  // Operating Expenses
  const hubStaffSalaries = 28000;
  const marketingWhatsAppCharges = 4200;
  const vehicleFuelMaintenance = 12500;
  const totalOperatingExpenses = hubStaffSalaries + marketingWhatsAppCharges + vehicleFuelMaintenance;

  const netOperatingProfit = grossProfit - totalOperatingExpenses;
  const netMarginPercent = totalIncome > 0 ? ((netOperatingProfit / totalIncome) * 100).toFixed(1) : '28.5';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Date Range Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#166534', margin: 0 }}>
            Profit &amp; Loss Statement (P&amp;L)
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '4px 0 0 0' }}>
            Financial performance summary, revenue streams, farmer procurement costs &amp; net margin analysis.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '12px', gap: '4px' }}>
            {(['today', 'this_week', 'this_month', 'all_time'] as const).map((r) => (
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
                  backgroundColor: dateRange === r ? '#166534' : 'transparent',
                  color: dateRange === r ? '#FFFFFF' : '#475569',
                  transition: 'all 0.15s ease',
                }}
              >
                {r.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => alert('Exporting P&L Statement as CSV report...')}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '10px',
              border: '1px solid #166534',
              backgroundColor: '#ECFDF5',
              color: '#166534',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Download size={15} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B' }}>TOTAL GROSS INCOME</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#166534', margin: '4px 0' }}>
            ₹{totalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>Subscriptions + One-time + Counter</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B' }}>DIRECT COST OF GOODS (COGS)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#DC2626', margin: '4px 0' }}>
            ₹{totalCostOfGoods.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 700 }}>Milk purchase, packaging &amp; fleet drop fee</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748B' }}>OPERATING EXPENSES</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#D97706', margin: '4px 0' }}>
            ₹{totalOperatingExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#D97706', fontWeight: 700 }}>Salaries, fuel &amp; marketing</div>
        </div>

        <div style={{ backgroundColor: '#ECFDF5', padding: '1.25rem', borderRadius: '16px', border: '1px solid #A7F3D0' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#047857' }}>NET OPERATING PROFIT</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#047857', margin: '4px 0' }}>
            ₹{netOperatingProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 800 }}>Net Profit Margin: {netMarginPercent}%</div>
        </div>
      </div>

      {/* Itemized P&L Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '1.5rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E293B', marginBottom: '1rem' }}>
          Financial Statement Breakdown
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>ACCOUNT / CATEGORY</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>TYPE</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 800, textAlign: 'right' }}>AMOUNT (₹)</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 800, textAlign: 'right' }}>% OF REVENUE</th>
            </tr>
          </thead>
          <tbody>
            {/* Income Header */}
            <tr style={{ backgroundColor: '#F0FDF4', fontWeight: 800, color: '#166534' }}>
              <td colSpan={4} style={{ padding: '0.75rem 1rem' }}>1. REVENUE STREAMS (INCOME)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600 }}>Daily Milk Subscriptions Revenue</td>
              <td style={{ padding: '0.75rem 1rem', color: '#059669', fontWeight: 700 }}>Income</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>₹{directSubscriptionRevenue.toLocaleString()}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{((directSubscriptionRevenue / totalIncome) * 100).toFixed(1)}%</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600 }}>One-Time Product Orders</td>
              <td style={{ padding: '0.75rem 1rem', color: '#059669', fontWeight: 700 }}>Income</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>₹{oneTimeOrdersRevenue.toLocaleString()}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{((oneTimeOrdersRevenue / totalIncome) * 100).toFixed(1)}%</td>
            </tr>
            <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600 }}>Counter Store Sales</td>
              <td style={{ padding: '0.75rem 1rem', color: '#059669', fontWeight: 700 }}>Income</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>₹{counterSalesRevenue.toLocaleString()}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{((counterSalesRevenue / totalIncome) * 100).toFixed(1)}%</td>
            </tr>

            {/* COGS Header */}
            <tr style={{ backgroundColor: '#FEF2F2', fontWeight: 800, color: '#DC2626' }}>
              <td colSpan={4} style={{ padding: '0.75rem 1rem' }}>2. DIRECT COST OF GOODS SOLD (COGS)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600 }}>Farmer Milk Procurement Payouts (Raw Milk)</td>
              <td style={{ padding: '0.75rem 1rem', color: '#DC2626', fontWeight: 700 }}>Direct Cost</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>- ₹{farmerMilkProcurementCost.toLocaleString()}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{((farmerMilkProcurementCost / totalIncome) * 100).toFixed(1)}%</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600 }}>Glass Bottles, Seals &amp; Packaging</td>
              <td style={{ padding: '0.75rem 1rem', color: '#DC2626', fontWeight: 700 }}>Direct Cost</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>- ₹{packagingBottlesCost.toLocaleString()}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{((packagingBottlesCost / totalIncome) * 100).toFixed(1)}%</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600 }}>Delivery Partner Route Commissions</td>
              <td style={{ padding: '0.75rem 1rem', color: '#DC2626', fontWeight: 700 }}>Direct Cost</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>- ₹{deliveryRiderPayouts.toLocaleString()}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{((deliveryRiderPayouts / totalIncome) * 100).toFixed(1)}%</td>
            </tr>
            <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600 }}>Hub Cold Storage Refrigeration</td>
              <td style={{ padding: '0.75rem 1rem', color: '#DC2626', fontWeight: 700 }}>Direct Cost</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>- ₹{hubColdStorageElectricity.toLocaleString()}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{((hubColdStorageElectricity / totalIncome) * 100).toFixed(1)}%</td>
            </tr>

            {/* Operating Expenses */}
            <tr style={{ backgroundColor: '#FFFBEB', fontWeight: 800, color: '#D97706' }}>
              <td colSpan={4} style={{ padding: '0.75rem 1rem' }}>3. OPERATING EXPENSES (OPEX)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600 }}>Hub Operations Staff Salaries</td>
              <td style={{ padding: '0.75rem 1rem', color: '#D97706', fontWeight: 700 }}>Expense</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>- ₹{hubStaffSalaries.toLocaleString()}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{((hubStaffSalaries / totalIncome) * 100).toFixed(1)}%</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600 }}>WhatsApp Broadcast &amp; Marketing Campaigns</td>
              <td style={{ padding: '0.75rem 1rem', color: '#D97706', fontWeight: 700 }}>Expense</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>- ₹{marketingWhatsAppCharges.toLocaleString()}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{((marketingWhatsAppCharges / totalIncome) * 100).toFixed(1)}%</td>
            </tr>
            <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
              <td style={{ padding: '0.75rem 1rem 0.75rem 2rem', fontWeight: 600 }}>Logistics Fuel &amp; Vehicle Maintenance</td>
              <td style={{ padding: '0.75rem 1rem', color: '#D97706', fontWeight: 700 }}>Expense</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>- ₹{vehicleFuelMaintenance.toLocaleString()}</td>
              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{((vehicleFuelMaintenance / totalIncome) * 100).toFixed(1)}%</td>
            </tr>

            {/* Bottom Total Summary Line */}
            <tr style={{ backgroundColor: '#DCFCE7', fontSize: '1rem', fontWeight: 800, color: '#166534' }}>
              <td colSpan={2} style={{ padding: '1rem' }}>FINAL NET OPERATING PROFIT</td>
              <td style={{ padding: '1rem', textAlign: 'right' }}>₹{netOperatingProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
              <td style={{ padding: '1rem', textAlign: 'right' }}>{netMarginPercent}% Net Margin</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
