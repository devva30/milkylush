import { useState, useMemo } from 'react';
import { Wine, Download, Search, Truck, RotateCcw, Eye, Calendar, CheckCircle2 } from 'lucide-react';
import type { User, Order, BottleRecordItem } from '../types';
import type { HubId } from '../data/hubs';
import { todayKey, addDays, formatDay, formatDateTime } from '../data/dates';
import { useHubRoutes } from '../data/routes';
import { useCustomerDeliveries } from '../data/customers';
import { useBottleCustomers, useBottleTotals, recordBottleReturn, setBottleCounts } from '../data/bottles';
import { DataState, LoadMore } from '../components/common/DataState';

export interface BottleRecord {
  id: string;
  customerId?: string;
  customerName: string;
  phone: string;
  address: string;
  route: string;
  assignedRider: string;
  issuedCount: number;
  returnedCount: number;
  pendingCount: number;
  damagedCount: number;
  lastCollectedDate: string;
  status: 'Pending Return' | 'Collected Today' | 'Overdue (> 7 Days)' | 'Cleared';
}

interface BottleManagementPageProps {
  selectedHubId: string;
  users?: User[];
  orders?: Order[];
  bottleRecords?: BottleRecordItem[];
  adminUsername?: string;
  onNavigateTab?: (tabName: string, targetId?: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function BottleManagementPage({ selectedHubId, onNavigateTab, showToast }: BottleManagementPageProps) {
  const hubId = selectedHubId as HubId;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'today' | 'overdue'>('all');
  
  // Modal State for Recording Bottle Return & Viewing Doorstep Delivery Logs
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BottleRecord | null>(null);

  // Direct Admin Edit State inside Details Modal
  const [editReturnedInput, setEditReturnedInput] = useState<number>(0);
  const [editDamagedInput, setEditDamagedInput] = useState<number>(0);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const historyDeliveries = useCustomerDeliveries(hubId, isHistoryModalOpen && selectedRecord ? selectedRecord.id : null);

  // Customers of this hub with their bottle counts (filtered in the database), 50 per page
  const customersQ = useBottleCustomers(hubId, statusFilter);
  const [totalsKey, setTotalsKey] = useState(0);
  const totals = useBottleTotals(hubId, totalsKey);
  const routes = useHubRoutes(hubId);
  const today = todayKey();
  const weekAgo = addDays(today, -7);

  const liveRecords: BottleRecord[] = useMemo(() => {
    const routeById = new Map(routes.data.map((r) => [r.id, r]));
    return customersQ.data.map((c) => {
      const atHome = c.bottlesAtHome ?? 0;
      const returned = c.bottlesReturned ?? 0;
      const damaged = c.bottlesDamaged ?? 0;
      const last = c.lastBottleCollectedDate ?? '';
      const route = c.routeId ? routeById.get(c.routeId) : undefined;
      const status: BottleRecord['status'] =
        last === today ? 'Collected Today'
        : atHome === 0 ? 'Cleared'
        : (!last || last < weekAgo) ? 'Overdue (> 7 Days)'
        : 'Pending Return';
      return {
        id: c.id,
        customerId: c.customerId,
        customerName: c.customerId ? `${c.name} (${c.customerId})` : c.name,
        phone: c.phone || '—',
        address: c.defaultAddressText || '—',
        route: route?.name || 'No route',
        assignedRider: route?.riderName || 'Unassigned',
        issuedCount: atHome + returned + damaged,
        returnedCount: returned,
        pendingCount: atHome,
        damagedCount: damaged,
        lastCollectedDate: last ? formatDay(last) : 'Never',
        status,
      };
    });
  }, [customersQ.data, routes.data, today, weekAgo]);
  const records = liveRecords;
  const refresh = () => { customersQ.retry(); setTotalsKey((k) => k + 1); };

  const [returnQty, setReturnQty] = useState('1');
  const [damagedInputQty, setDamagedInputQty] = useState('0');
  const [remarks, setRemarks] = useState('');

  const isHosur = selectedHubId === 'hosur' || selectedHubId === 'hub_hosur';
  const hubName = isHosur ? 'Hosur Central Hub' : 'Bangalore Electronic City Hub';

  // Filtered List
  const filteredRecords = useMemo(() => {
    return records.filter((r: BottleRecord) => {
      const matchesSearch =
        r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.phone.includes(searchQuery) ||
        r.route.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.assignedRider.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (statusFilter === 'overdue' && r.status !== 'Overdue (> 7 Days)') return false;

      return true;
    });
  }, [records, searchQuery, statusFilter]);

  // Metric Summaries
  // Hub-wide totals (aggregations), not just the loaded page
  const totalIssued = totals ? totals.atHome + totals.returned + totals.damaged : 0;
  const totalPending = totals?.atHome ?? 0;
  const collectedToday = totals?.collectedToday ?? 0;
  const totalDamaged = totals?.damaged ?? 0;

  const handleOpenReturnModal = (rec: BottleRecord) => {
    setSelectedRecord(rec);
    setReturnQty(String(rec.pendingCount > 0 ? rec.pendingCount : 1));
    setDamagedInputQty('0');
    setRemarks('');
    setIsReturnModalOpen(true);
  };

  const handleSaveBottleReturn = async () => {
    if (!selectedRecord) return;
    const qty = parseInt(returnQty, 10) || 0;
    const damagedCount = parseInt(damagedInputQty, 10) || 0;

    try {
      await recordBottleReturn(hubId, selectedRecord.id, selectedRecord.customerName, qty, damagedCount, remarks.trim());
      refresh();
    } catch (e) {
      showToast(`Could not save the return: ${(e as Error).message}`, 'error');
      return;
    }
    showToast(`Recorded return of ${qty} bottle(s)${damagedCount > 0 ? ` (${damagedCount} damaged)` : ''} for ${selectedRecord.customerName}!`, 'success');
    setIsReturnModalOpen(false);
  };

  const handleExportCSV = () => {
    const headers = ['Customer Name', 'Phone', 'Route', 'Assigned Rider', 'Issued', 'Returned', 'Pending', 'Damaged Bottles', 'Status'];
    const rows = filteredRecords.map((r) => [
      `"${r.customerName}"`,
      `"${r.phone}"`,
      `"${r.route}"`,
      `"${r.assignedRider}"`,
      r.issuedCount,
      r.returnedCount,
      r.pendingCount,
      r.damagedCount,
      r.status,
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Bottle_Management_Inventory_${isHosur ? 'Hosur' : 'Bangalore'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Bottle Tracking Inventory to CSV!', 'success');
  };

  const handleOpenHistoryModal = (rec: BottleRecord) => {
    setSelectedRecord(rec);
    setEditReturnedInput(rec.returnedCount);
    setEditDamagedInput(rec.damagedCount);
    setIsHistoryModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* Header Banner */}
      <div style={{
        backgroundColor: '#ECFDF5',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        border: '1px solid #A7F3D0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            backgroundColor: '#047857',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Wine size={24} />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#064E3B' }}>
              Bottle Management &amp; Return Tracking Console
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#047857', marginTop: '3px' }}>
              Monitor glass/plastic milk bottle dispatches, daily empty bottle returns, damaged bottle tracking, and delivery rider collections for {hubName}.
            </div>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          style={{
            padding: '0.45rem 0.95rem',
            borderRadius: '10px',
            backgroundColor: '#FFFFFF',
            color: '#047857',
            fontWeight: 700,
            fontSize: '0.8rem',
            border: '1px solid #A7F3D0',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Download size={15} /> Export Bottle Log
        </button>
      </div>

      {/* 4 Themed Metric Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        
        {/* Card 1: TOTAL BOTTLES ISSUED */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '0.85rem 1.15rem',
          borderLeft: '4px solid #0284C7',
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            TOTAL BOTTLES ISSUED
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0284C7', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)' }}>
            {totalIssued} Units
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Cumulative milk drops
          </div>
        </div>

        {/* Card 2: PENDING WITH CUSTOMERS */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '0.85rem 1.15rem',
          borderLeft: '4px solid #D97706',
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            PENDING WITH CUSTOMERS
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#D97706', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)' }}>
            {totalPending} Bottles
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Awaiting empty pickup
          </div>
        </div>

        {/* Card 3: COLLECTED TODAY */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '0.85rem 1.15rem',
          borderLeft: '4px solid #047857',
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            COLLECTED TODAY
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#047857', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)' }}>
            {collectedToday} Bottles
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Returned by riders today
          </div>
        </div>

        {/* Card 4: DAMAGED / BROKEN BOTTLES */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '0.85rem 1.15rem',
          borderLeft: '4px solid #DC2626',
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            DAMAGED / BROKEN BOTTLES
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#DC2626', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)' }}>
            {totalDamaged} Units
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Reported broken / lost
          </div>
        </div>

      </div>

      {/* Single-Row Unified Filter Bar (Matching Theme) */}
      <div className="card-panel" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Records' },
            { id: 'pending', label: 'Pending Return Only' },
            { id: 'today', label: 'Collected Today' },
            { id: 'overdue', label: 'Overdue (> 7 Days)' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id as any)}
              style={{
                padding: '0.38rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: statusFilter === f.id ? '#047857' : 'var(--bg-main)',
                color: statusFilter === f.id ? '#FFFFFF' : 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.76rem',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div style={{ position: 'relative', width: '250px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search customer, rider, route..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.38rem 0.75rem 0.38rem 28px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              fontSize: '0.78rem',
              color: 'var(--text-main)',
              outline: 'none'
            }}
          />
        </div>

      </div>

      {/* Bottle Inventory Data Table */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-main)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.85rem 1rem' }}>CUSTOMER &amp; ROUTE</th>
                <th style={{ padding: '0.85rem 1rem' }}>ASSIGNED RIDER</th>
                <th style={{ padding: '0.85rem 1rem' }}>ISSUED BOTTLES</th>
                <th style={{ padding: '0.85rem 1rem' }}>RETURNED BOTTLES</th>
                <th style={{ padding: '0.85rem 1rem' }}>PENDING RETURN</th>
                <th style={{ padding: '0.85rem 1rem' }}>DAMAGED / BROKEN</th>
                <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
                <th style={{ padding: '0.85rem 1rem' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {customersQ.loading && (
                <tr><td colSpan={9} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading customers…</td></tr>
              )}
              {filteredRecords.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.88rem' }}>{r.customerName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Route: {r.route}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Phone: {r.phone}</div>
                  </td>
                  
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: '#047857' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Truck size={14} /> {r.assignedRider}
                    </div>
                  </td>

                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {r.issuedCount} units
                  </td>

                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#047857' }}>
                    {r.returnedCount} units
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      color: r.pendingCount > 0 ? '#D97706' : '#047857'
                    }}>
                      {r.pendingCount} Pending
                    </span>
                  </td>

                  <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: r.damagedCount > 0 ? '#DC2626' : 'var(--text-muted)', fontSize: '0.88rem' }}>
                    {r.damagedCount} Units
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: r.status === 'Collected Today' ? '#047857' : r.status === 'Overdue (> 7 Days)' ? '#DC2626' : '#D97706',
                      backgroundColor: r.status === 'Collected Today' ? '#ECFDF5' : r.status === 'Overdue (> 7 Days)' ? '#FEE2E2' : '#FEF3C7',
                      border: r.status === 'Collected Today' ? '1px solid #A7F3D0' : r.status === 'Overdue (> 7 Days)' ? '1px solid #FCA5A5' : '1px solid #FDE68A',
                      padding: '3px 9px',
                      borderRadius: '12px'
                    }}>
                      {r.status}
                    </span>
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        onClick={() => handleOpenHistoryModal(r)}
                        style={{
                          padding: '0.38rem 0.7rem',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          backgroundColor: 'var(--bg-main)',
                          color: 'var(--text-main)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="View Doorstep Delivery & Empty Return History"
                      >
                        <Eye size={13} /> View Details
                      </button>

                      <button
                        onClick={() => handleOpenReturnModal(r)}
                        style={{
                          padding: '0.38rem 0.75rem',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          backgroundColor: '#047857',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <RotateCcw size={13} /> Return
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No bottle inventory tracking records found matching your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <DataState loading={false} error={customersQ.error} onRetry={customersQ.retry}>
        <LoadMore hasMore={customersQ.hasMore} loading={customersQ.loadingMore} onClick={customersQ.loadMore} />
      </DataState>

      {/* RECORD BOTTLE RETURN MODAL POP-UP */}
      {isReturnModalOpen && selectedRecord && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '20px',
            padding: '1.75rem',
            maxWidth: '480px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Record Empty Bottle Return
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#047857', fontWeight: 700 }}>Customer: {selectedRecord.customerName}</span>
              </div>
              <button 
                onClick={() => setIsReturnModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ backgroundColor: 'var(--bg-main)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                <div>Current Issued Total: <strong>{selectedRecord.issuedCount} Bottles</strong></div>
                <div>Currently Pending Return: <strong style={{ color: '#D97706' }}>{selectedRecord.pendingCount} Bottles</strong></div>
                <div>Rider Route: <strong>{selectedRecord.assignedRider}</strong></div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                  Number of Empty Bottles Returned Today
                </label>
                <input 
                  type="number" 
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                  Damaged / Broken Bottles (If Any)
                </label>
                <input 
                  type="number" 
                  value={damagedInputQty}
                  onChange={(e) => setDamagedInputQty(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                  Collector Rider Notes / Remarks
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Returned 4 glass bottles at doorstep pickup"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setIsReturnModalOpen(false)}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '10px', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontWeight: 700, border: '1px solid var(--border-color)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBottleReturn}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '10px', backgroundColor: '#047857', color: '#FFFFFF', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                  Save Bottle Return
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DOORSTEP DELIVERY & BOTTLE RETURN HISTORY LOG MODAL */}
      {isHistoryModalOpen && selectedRecord && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '20px',
            padding: '1.75rem',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Doorstep Delivery &amp; Empty Bottle History
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#047857', fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>{selectedRecord.customerName} • 📞 {selectedRecord.phone}</span>
                  {onNavigateTab && (
                    <button
                      onClick={() => {
                        setIsHistoryModalOpen(false);
                        const targetId = selectedRecord.customerId || selectedRecord.id.replace('btl_', '');
                        onNavigateTab('customers', targetId);
                      }}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#ECFDF5',
                        color: '#047857',
                        border: '1px solid #A7F3D0',
                        fontWeight: 800,
                        fontSize: '0.74rem',
                        cursor: 'pointer'
                      }}
                    >
                      👤 View Customer Profile &amp; Plan →
                    </button>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setIsHistoryModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Quick Summary Chips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: 'var(--bg-main)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL ISSUED</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0284C7' }}>{selectedRecord.issuedCount} Bottles</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-main)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>RETURNED TO DATE</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#047857' }}>{selectedRecord.returnedCount} Bottles</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-main)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>PENDING PICKUP</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#D97706' }}>{selectedRecord.pendingCount} Bottles</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-main)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>DAMAGED</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#DC2626' }}>{selectedRecord.damagedCount} Units</div>
              </div>
            </div>

            {/* Admin Manual Override Controls */}
            <div style={{ backgroundColor: '#ECFDF5', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #A7F3D0', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#047857', marginBottom: '6px' }}>
                ⚙️ Admin Manual Bottle Counter Override (Syncs directly to Customer Profile)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '0.75rem', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#047857', display: 'block', marginBottom: '2px' }}>Returned Bottles</label>
                  <input
                    type="number"
                    value={editReturnedInput}
                    onChange={(e) => setEditReturnedInput(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #A7F3D0', fontSize: '0.82rem', fontWeight: 700, outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#DC2626', display: 'block', marginBottom: '2px' }}>Damaged / Broken</label>
                  <input
                    type="number"
                    value={editDamagedInput}
                    onChange={(e) => setEditDamagedInput(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #FCA5A5', fontSize: '0.82rem', fontWeight: 700, outline: 'none' }}
                  />
                </div>
                <button
                  disabled={isSavingEdit}
                  onClick={async () => {
                    setIsSavingEdit(true);
                    try {
                      const newPending = await setBottleCounts(hubId, selectedRecord.id, selectedRecord.customerName,
                        selectedRecord.issuedCount, editReturnedInput, editDamagedInput);
                      setSelectedRecord({
                        ...selectedRecord,
                        returnedCount: editReturnedInput,
                        damagedCount: editDamagedInput,
                        pendingCount: newPending,
                      });
                      refresh();
                      showToast(`Updated bottle counts for ${selectedRecord.customerName}.`, 'success');
                    } catch (err) {
                      showToast('Failed to update bottle counters: ' + String(err), 'error');
                    } finally {
                      setIsSavingEdit(false);
                    }
                  }}
                  style={{
                    backgroundColor: '#047857',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: '16px'
                  }}
                >
                  {isSavingEdit ? 'Saving...' : 'Save & Sync Customer Profile'}
                </button>
              </div>
            </div>

            {/* Realtime Order & Return Logs */}
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} style={{ color: '#047857' }} />
              Doorstep Delivery &amp; Pickup Event Trail
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Map customer's orders or generate detailed audit records */}
              {(() => {
                const displayEvents = historyDeliveries.data.map((d) => ({
                  id: d.id,
                  date: formatDay(d.date),
                  time: d.deliveredAt ? formatDateTime(d.deliveredAt).split(', ').pop() : d.status.replace(/_/g, ' '),
                  items: d.items.map((i) => `${i.name} (${i.unit}) x${i.qty}`).join(', '),
                  bottlesIssued: d.bottlesDue ?? 0,
                  bottlesReturned: d.bottlesCollected ?? 0,
                  pendingBalance: Math.max(0, (d.bottlesDue ?? 0) - (d.bottlesCollected ?? 0)),
                  rider: d.riderName || 'Unassigned',
                  status: d.status === 'delivered' ? 'Delivered' : d.status === 'failed' ? `Failed${d.failReason ? `: ${d.failReason}` : ''}` : d.status.replace(/_/g, ' '),
                }));

                if (historyDeliveries.loading) {
                  return <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading delivery history…</div>;
                }

                if (displayEvents.length === 0) {
                  return (
                    <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', backgroundColor: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      No delivery or empty bottle return history recorded for this customer yet.
                    </div>
                  );
                }

                return displayEvents.map(evt => (
                  <div 
                    key={evt.id} 
                    style={{ 
                      padding: '1rem', 
                      borderRadius: '14px', 
                      backgroundColor: 'var(--bg-main)', 
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        <CheckCircle2 size={16} style={{ color: '#047857' }} />
                        <span>Date &amp; Time: {evt.date} • {evt.time}</span>
                      </div>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        backgroundColor: evt.bottlesReturned > 0 ? '#ECFDF5' : '#FEF3C7',
                        color: evt.bottlesReturned > 0 ? '#047857' : '#D97706',
                        border: evt.bottlesReturned > 0 ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                        padding: '3px 10px',
                        borderRadius: '12px'
                      }}>
                        {evt.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 600 }}>
                      📦 Items: {evt.items}
                    </div>

                    <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.76rem', color: 'var(--text-muted)', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
                      <div>🥛 <strong>Issued:</strong> {evt.bottlesIssued} Bottles</div>
                      <div>🍾 <strong>Returned:</strong> <span style={{ color: '#047857', fontWeight: 700 }}>{evt.bottlesReturned} Empties</span></div>
                      <div>⏳ <strong>Pending at Home:</strong> <span style={{ color: evt.pendingBalance > 0 ? '#D97706' : '#047857', fontWeight: 700 }}>{evt.pendingBalance} Bottles</span></div>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                style={{
                  padding: '0.6rem 1.25rem',
                  borderRadius: '10px',
                  backgroundColor: '#047857',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Close Log Window
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

