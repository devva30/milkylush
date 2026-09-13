import { useState, useMemo } from 'react';
import { Calendar, Clock, Search } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Subscription, PrepaidPackage } from '../types';

interface PrepaidSubscriptionsPageProps {
  subscriptions: Subscription[];
  prepaidPackages?: PrepaidPackage[];
  isLoading?: boolean;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function PrepaidSubscriptionsPage({ subscriptions, isLoading = false, showToast }: PrepaidSubscriptionsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [timeframeFilter, setTimeframeFilter] = useState<'all' | '7days' | '15days' | '30days'>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | 'daily' | 'alternateDays'>('all');
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [editingStartDate, setEditingStartDate] = useState<string>('');
  const [isSavingDate, setIsSavingDate] = useState<boolean>(false);

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  // Helper to format date strings cleanly (e.g. 11 Sep 2026)
  const formatDateLabel = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  // Compute days until start helper
  const getDaysUntilStart = (startStr?: string) => {
    if (!startStr) return 0;
    try {
      const start = new Date(startStr);
      if (isNaN(start.getTime())) return 0;
      start.setHours(0, 0, 0, 0);
      const diffTime = start.getTime() - todayDate.getTime();
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return days < 0 ? 0 : days;
    } catch (e) {
      return 0;
    }
  };

  // Filter live prepaid subscriptions: ONLY show future-scheduled upcoming subscriptions (startDate > todayDate)
  // Once a subscription start date arrives (startDate <= todayDate), it moves to Active Subscriptions and is hidden here.
  const upcomingPrepaids = useMemo(() => {
    return subscriptions
      .filter((s) => {
        if (!s.startDate) return false;
        const start = new Date(s.startDate);
        if (isNaN(start.getTime())) return false;
        start.setHours(0, 0, 0, 0);
        return start.getTime() > todayDate.getTime() || (s.status as string) === 'upcoming';
      })
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  }, [subscriptions, todayDate]);

  // Filtered List
  const filteredSubs = useMemo(() => {
    return upcomingPrepaids.filter((s) => {
      // Search Filter
      const matchesSearch =
        (s.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.productName || s.product?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Timeframe Window Filter
      const days = getDaysUntilStart(s.startDate);
      if (timeframeFilter === '7days' && days > 7) return false;
      if (timeframeFilter === '15days' && days > 15) return false;
      if (timeframeFilter === '30days' && days > 30) return false;

      // Frequency Filter
      if (frequencyFilter !== 'all') {
        if (frequencyFilter === 'daily' && s.frequency.toLowerCase() !== 'daily') return false;
        if (frequencyFilter === 'alternateDays' && !s.frequency.toLowerCase().includes('alternate')) return false;
      }

      return true;
    });
  }, [upcomingPrepaids, searchQuery, timeframeFilter, frequencyFilter]);

  // Metric Summaries
  const totalUpcoming = upcomingPrepaids.length;
  const startingNext7Days = upcomingPrepaids.filter((s) => getDaysUntilStart(s.startDate) <= 7).length;
  const totalPrepaidRevenue = upcomingPrepaids.reduce((acc, curr) => acc + (curr.prepaidAmountPaid || 0), 0);
  const avgPrepaidAmount = totalUpcoming > 0 ? Math.round(totalPrepaidRevenue / totalUpcoming) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* Banner */}
      <div style={{
        backgroundColor: '#EFF6FF',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        border: '1px solid #BFDBFE',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            backgroundColor: '#0284C7',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Calendar size={24} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', fontWeight: 800, color: '#1E3A8A', margin: 0 }}>
                ⏳ Upcoming Prepaid Subscriptions Console
              </h3>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0284C7', backgroundColor: '#DBEAFE', padding: '2px 8px', borderRadius: '10px' }}>
                Strict Future Start Dates Only
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#1E40AF', marginTop: '3px', margin: 0 }}>
              Monitor advance paid subscriptions scheduled for future start dates. Track countdown days before first doorstep delivery dispatch.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#1E40AF', fontWeight: 700, backgroundColor: '#DBEAFE', padding: '6px 12px', borderRadius: '10px' }}>
          <Clock size={15} /> System Date: <strong>{todayDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</strong>
        </div>
      </div>

      {/* 4 Themed Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        
        {/* Card 1: TOTAL UPCOMING STARTS */}
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
            TOTAL UPCOMING STARTS
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#D97706', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)' }}>
            {totalUpcoming}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Future scheduled start dates
          </div>
        </div>

        {/* Card 2: STARTING IN NEXT 7 DAYS */}
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
            STARTING NEXT 7 DAYS
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#047857', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)' }}>
            {startingNext7Days}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Dispatch begins this week
          </div>
        </div>

        {/* Card 3: UPCOMING PREPAID REVENUE */}
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
            UPCOMING PREPAID REVENUE
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0284C7', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)' }}>
            ₹{totalPrepaidRevenue.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Collected advance online
          </div>
        </div>

        {/* Card 4: AVG PREPAID VALUE */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '14px',
          padding: '0.85rem 1.15rem',
          borderLeft: '4px solid #9333EA',
          borderTop: '1px solid var(--border-color)',
          borderRight: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            AVG PREPAID VALUE
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#9333EA', margin: '0.15rem 0 0.05rem 0', fontFamily: 'var(--font-title)' }}>
            ₹{avgPrepaidAmount.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Per upcoming order
          </div>
        </div>

      </div>

      {/* Single-Row Unified Filter Bar (Matching Theme) */}
      <div className="card-panel" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Upcoming' },
            { id: '7days', label: '⚡ Starting Next 7 Days' },
            { id: '15days', label: '📅 Next 15 Days' },
            { id: '30days', label: '🗓️ Next 30 Days' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTimeframeFilter(t.id as any)}
              style={{
                padding: '0.38rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: timeframeFilter === t.id ? '#047857' : 'var(--bg-main)',
                color: timeframeFilter === t.id ? '#FFFFFF' : 'var(--text-main)',
                fontWeight: 700,
                fontSize: '0.76rem',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}

          <span style={{ color: 'var(--border-color)', margin: '0 2px' }}>|</span>

          {[
            { id: 'all', label: 'All Frequencies' },
            { id: 'daily', label: 'Daily' },
            { id: 'alternateDays', label: 'Alternate Days' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFrequencyFilter(f.id as any)}
              style={{
                padding: '0.38rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: frequencyFilter === f.id ? '#0284C7' : 'var(--bg-main)',
                color: frequencyFilter === f.id ? '#FFFFFF' : 'var(--text-main)',
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
            placeholder="Search upcoming customer, ID..." 
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

      {/* Upcoming Prepaid Subscriptions Data Table */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-main)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.85rem 1rem' }}>CUSTOMER &amp; SUB ID</th>
                <th style={{ padding: '0.85rem 1rem' }}>PRODUCT &amp; QTY</th>
                <th style={{ padding: '0.85rem 1rem' }}>SCHEDULED START DATE</th>
                <th style={{ padding: '0.85rem 1rem' }}>TIMELINE COUNTDOWN</th>
                <th style={{ padding: '0.85rem 1rem' }}>FREQUENCY</th>
                <th style={{ padding: '0.85rem 1rem' }}>PREPAID PAID</th>
                <th style={{ padding: '0.85rem 1rem' }}>ADMIN ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        border: '3.5px solid #E5E7EB',
                        borderTop: '3.5px solid #047857',
                        borderRadius: '50%',
                        animation: 'spinPrepaid 0.8s linear infinite'
                      }} />
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#047857' }}>
                        Syncing &amp; Fetching Upcoming Prepaid Subscriptions...
                      </div>
                      <style>{`@keyframes spinPrepaid { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                  </td>
                </tr>
              ) : filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    No upcoming prepaid subscriptions found matching the selected timeframe.
                  </td>
                </tr>
              ) : (
                filteredSubs.map((s) => {
                  const daysToGo = getDaysUntilStart(s.startDate);

                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.88rem' }}>{s.userName || 'Subscriber'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 700, marginTop: '2px' }}>{s.id}</div>
                      </td>
                      
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>{s.productName || s.product?.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Qty: {s.quantity} unit(s)</div>
                      </td>

                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Calendar size={14} style={{ color: '#047857' }} />
                          <span>{formatDateLabel(s.startDate)}</span>
                        </div>
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          color: daysToGo <= 7 ? '#D97706' : '#0284C7',
                          backgroundColor: daysToGo <= 7 ? '#FEF3C7' : '#EFF6FF',
                          border: daysToGo <= 7 ? '1px solid #FDE68A' : '1px solid #BFDBFE',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Clock size={12} /> Starts in {daysToGo} days
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: 'var(--text-main)', textTransform: 'capitalize' }}>
                        {s.frequency}
                      </td>

                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#047857', fontSize: '0.9rem' }}>
                        ₹{s.prepaidAmountPaid?.toLocaleString('en-IN') || '2,700'}
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <button
                          onClick={() => setSelectedSub(s)}
                          style={{
                            padding: '0.4rem 0.8rem',
                            borderRadius: '8px',
                            backgroundColor: '#047857',
                            color: '#FFFFFF',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.76rem',
                            cursor: 'pointer'
                          }}
                        >
                          Modify Schedule
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW PREPAID PLAN DETAIL MODAL POP-UP */}
      {selectedSub && (
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
            maxWidth: '520px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Upcoming Prepaid Details
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#047857', fontWeight: 700 }}>ID: {selectedSub.id}</span>
              </div>
              <button 
                onClick={() => setSelectedSub(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>
              <div><strong>Customer Name:</strong> {selectedSub.userName}</div>
              <div><strong>Product Plan:</strong> {selectedSub.productName || selectedSub.product?.name}</div>
              <div><strong>Delivery Address:</strong> {selectedSub.deliveryAddress || 'Hosur Main Route'}</div>
              <div><strong>Prepaid Advance Paid:</strong> <span style={{ color: '#047857', fontWeight: 800 }}>₹{selectedSub.prepaidAmountPaid}</span></div>
              <div><strong>Scheduled Start Date:</strong> {formatDateLabel(selectedSub.startDate)}</div>
              <div><strong>Calculated End Date:</strong> {formatDateLabel(selectedSub.endDate || '2026-11-08')}</div>
              <div><strong>Frequency:</strong> {selectedSub.frequency}</div>
              <div><strong>Countdown:</strong> <span style={{ color: '#D97706', fontWeight: 800 }}>Starts in {getDaysUntilStart(selectedSub.startDate)} days</span></div>
              
              {/* Modify Start Date Input Box */}
              <div style={{ marginTop: '0.5rem', backgroundColor: '#F8FAFC', padding: '0.85rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                  📅 Select New Scheduled Start Date:
                </label>
                <input
                  type="date"
                  value={editingStartDate || (selectedSub.startDate ? selectedSub.startDate.split('T')[0] : '')}
                  onChange={(e) => setEditingStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#0F172A'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                disabled={isSavingDate}
                onClick={async () => {
                  const targetDate = editingStartDate || (selectedSub.startDate ? selectedSub.startDate.split('T')[0] : '');
                  if (!targetDate) {
                    if (showToast) showToast('Please select a valid date', 'error');
                    return;
                  }
                  setIsSavingDate(true);
                  try {
                    const isoDateStr = new Date(targetDate).toISOString();
                    await updateDoc(doc(db, 'subscriptions', selectedSub.id), {
                      startDate: isoDateStr
                    });
                    if (showToast) showToast(`Updated start date to ${formatDateLabel(isoDateStr)}!`, 'success');
                    setSelectedSub(null);
                    setEditingStartDate('');
                  } catch (err) {
                    console.error('Failed to update start date:', err);
                    if (showToast) showToast('Failed to update start date in database.', 'error');
                  } finally {
                    setIsSavingDate(false);
                  }
                }}
                style={{ flex: 1, padding: '0.65rem', borderRadius: '10px', backgroundColor: '#047857', color: '#FFFFFF', fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                {isSavingDate ? 'Saving Date...' : 'Save New Start Date'}
              </button>
              <button
                onClick={() => { setSelectedSub(null); setEditingStartDate(''); }}
                style={{ flex: 1, padding: '0.65rem', borderRadius: '10px', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', fontWeight: 700, border: '1px solid var(--border-color)', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

