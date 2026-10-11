import { useState, useEffect } from 'react';
import { UserCheck, UserX, Clock, Search, Calendar, BarChart2, CheckCircle, AlertTriangle, ShieldCheck, MapPin, Phone, RefreshCw } from 'lucide-react';
import { setDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { auth } from '../../firebase';
import { hubCol, hubDoc } from '../../data/hubs';
import { todayKey, toDate } from '../../data/dates';
import { PageLoader } from '../../components/common/DataState';
import type { DeliveryAgent } from '../../types';

interface DispatchAttendancePageProps {
  selectedHubId: string;
  hubDeliveryAgents: DeliveryAgent[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface AttendanceRecord {
  date: string;
  agentId: string;
  status: 'present' | 'absent' | 'completed' | 'unchecked';
  punchInTimeStr?: string;
  punchOutTimeStr?: string;
  punchInLat?: number;
  punchInLng?: number;
  updatedBy?: string;
}

export default function DispatchAttendancePage({
  selectedHubId,
  hubDeliveryAgents,
  showToast,
}: DispatchAttendancePageProps) {
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(todayKey());
  const [selectedMonth, setSelectedMonth] = useState<string>(todayKey().slice(0, 7)); // YYYY-MM
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(parseInt(todayKey().slice(0, 4), 10));
  const [updatingAgentId, setUpdatingAgentId] = useState<string | null>(null);
  const [selectedRiderForModal, setSelectedRiderForModal] = useState<DeliveryAgent | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord[]>>({});
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const isHosur = selectedHubId.includes('hosur');

  // Riders are already this hub's (staff with hubIds containing it). The chosen day's
  // attendance doc decides present/absent; no doc yet = unchecked.
  const dayStatus = (agentId: string) =>
    (attendanceRecords[agentId] || []).find((l) => l.date === selectedDate)?.status;
  const filteredAgents = (hubDeliveryAgents || [])
    .map((agent) => {
      const st = dayStatus(agent.id);
      return { ...agent, attendanceStatus: st === 'present' || st === 'completed' ? 'present' : st === 'absent' ? 'absent' : undefined } as DeliveryAgent;
    })
    .filter((agent) =>
      (agent.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (agent.phone || '').includes(searchQuery) ||
      (agent.assignedZone || '').toLowerCase().includes(searchQuery.toLowerCase()));

  // Calculate days in selected month
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '10', 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Live attendance for one month of this hub: the month being viewed, or the chosen day's month.
  const queryMonth = viewMode === 'daily' ? selectedDate.slice(0, 7) : selectedMonth;
  useEffect(() => {
    setIsLoadingLogs(true);
    const [qy, qm] = queryMonth.split('-').map(Number);
    const startDate = `${queryMonth}-01`;
    const endDate = `${queryMonth}-${String(new Date(qy, qm, 0).getDate()).padStart(2, '0')}`;
    const timeOf = (v: unknown) => {
      const d = toDate(v);
      return d ? d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : undefined;
    };
    const q = query(hubCol(selectedHubId, 'attendance'), where('date', '>=', startDate), where('date', '<=', endDate));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsByAgent: Record<string, AttendanceRecord[]> = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const agentId = data.riderUid as string;
        if (!agentId) return;
        (recordsByAgent[agentId] ||= []).push({
          date: data.date,
          agentId,
          status: data.status === 'leave' ? 'absent' : data.status,
          punchInTimeStr: timeOf(data.checkInAt),
          punchOutTimeStr: timeOf(data.checkOutAt),
          punchInLat: data.checkInLat,
          punchInLng: data.checkInLng,
        });
      });
      setAttendanceRecords(recordsByAgent);
      setIsLoadingLogs(false);
    }, (err) => {
      console.warn('Attendance listener:', err);
      showToast(`Could not load attendance: ${err.message}`, 'error');
      setIsLoadingLogs(false);
    });
    return () => unsubscribe();
  }, [selectedHubId, queryMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Overall statistics calculation
  const presentCount = filteredAgents.filter((a) => a.attendanceStatus === 'present').length;
  const absentCount = filteredAgents.filter((a) => a.attendanceStatus === 'absent').length;
  const uncheckedCount = Math.max(0, filteredAgents.length - presentCount - absentCount);
  const punctualityRate = filteredAgents.length > 0 ? Math.round((presentCount / filteredAgents.length) * 100) : 100;

  const handleToggleAttendance = async (agent: DeliveryAgent, newStatus: 'present' | 'absent', dateToUpdate?: string) => {
    setUpdatingAgentId(agent.id);
    const isPresent = newStatus === 'present';
    const targetDate = dateToUpdate || selectedDate;

    try {
      // Admin override: only the status is set; real check-in/out times come from the rider app.
      await setDoc(hubDoc(selectedHubId, 'attendance', `${targetDate}_${agent.id}`), {
        riderUid: agent.id,
        riderName: agent.name,
        date: targetDate,
        status: newStatus,
        markedBy: auth.currentUser?.uid ?? null,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      showToast(
        `Updated attendance for "${agent.name}" on ${targetDate}: Marked ${newStatus.toUpperCase()}!`,
        isPresent ? 'success' : 'info'
      );
    } catch (err: any) {
      console.warn("Attendance update error:", err);
      showToast(`Failed to update attendance: ${err.message}`, 'error');
    } finally {
      setUpdatingAgentId(null);
    }
  };

  const getRiderMonthlyStats = (agentId: string) => {
    const logs = attendanceRecords[agentId] || [];
    const presentDays = logs.filter(l => l.status === 'present' || l.status === 'completed').length;
    const absentDays = logs.filter(l => l.status === 'absent').length;
    const attendancePct = daysInMonth > 0 ? Math.round((presentDays / daysInMonth) * 100) : 0;
    return { presentDays, absentDays, attendancePct, logs };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Outfit', sans-serif" }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', backgroundColor: '#FFFFFF', padding: '1.25rem 1.5rem', borderRadius: '18px', border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534' }}>
              <UserCheck size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                Rider Shift & Attendance Dispatch Roster
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Real-time punch logs, monthly attendance matrix & admin overrides for <strong>{selectedHubId === 'bengaluru' ? 'Bangalore Hub' : 'Hosur Central Hub'}</strong>
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* View Mode Switcher (DAILY FIRST, MONTHLY SECOND) */}
          <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '12px', gap: '4px', border: '1px solid #CBD5E1' }}>
            <button
              onClick={() => setViewMode('daily')}
              style={{
                backgroundColor: viewMode === 'daily' ? '#166534' : 'transparent',
                color: viewMode === 'daily' ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 16px',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <Calendar size={16} /> Daily Shift Log
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              style={{
                backgroundColor: viewMode === 'monthly' ? '#166534' : 'transparent',
                color: viewMode === 'monthly' ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 16px',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <BarChart2 size={16} /> Monthly Matrix
            </button>
          </div>

          {/* Month / Date Selector Popup */}
          {viewMode === 'monthly' ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#FFFFFF',
                  padding: '0.5rem 0.9rem',
                  borderRadius: '12px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  color: '#1E293B',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <Calendar size={17} style={{ color: '#166534' }} />
                <span>
                  {new Date(`${selectedMonth}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <Calendar size={15} style={{ color: '#64748B', marginLeft: '4px' }} />
              </button>

              {/* POPUP MONTH PICKER OVERLAY (Matches user uploaded image 1!) */}
              {isMonthPickerOpen && (
                <div style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  width: '280px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '14px',
                  border: '1px solid #CBD5E1',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  zIndex: 999,
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {/* Year Selection Bar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#E2E8F0',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    color: '#1E293B'
                  }}>
                    <button
                      onClick={() => setPickerYear(y => y - 1)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 800, color: '#334155' }}
                    >
                      ‹
                    </button>
                    <span>{pickerYear}</span>
                    <button
                      onClick={() => setPickerYear(y => y + 1)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 800, color: '#334155' }}
                    >
                      ›
                    </button>
                  </div>

                  {/* 3x4 Month Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '8px',
                    padding: '4px 0'
                  }}>
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((mName, idx) => {
                      const mNum = (idx + 1).toString().padStart(2, '0');
                      const monthKey = `${pickerYear}-${mNum}`;
                      const isSelected = selectedMonth === monthKey;

                      return (
                        <button
                          key={mName}
                          onClick={() => {
                            setSelectedMonth(monthKey);
                            setIsMonthPickerOpen(false);
                          }}
                          style={{
                            padding: '8px 4px',
                            borderRadius: '8px',
                            border: isSelected ? '2px solid #000000' : '1px solid transparent',
                            backgroundColor: isSelected ? '#4B5563' : 'transparent',
                            color: isSelected ? '#FFFFFF' : '#1E293B',
                            fontWeight: isSelected ? 800 : 600,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {mName}
                        </button>
                      );
                    })}
                  </div>

                  {/* Bottom Action Footer */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderTop: '1px solid #F1F5F9',
                    paddingTop: '8px'
                  }}>
                    <button
                      onClick={() => {
                        setSelectedMonth(todayKey().slice(0, 7));
                        setIsMonthPickerOpen(false);
                      }}
                      style={{ border: 'none', background: 'none', color: '#0284C7', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Clear
                    </button>

                    <button
                      onClick={() => {
                        const nowKey = todayKey().slice(0, 7);
                        setSelectedMonth(nowKey);
                        setPickerYear(parseInt(nowKey.slice(0, 4), 10));
                        setIsMonthPickerOpen(false);
                      }}
                      style={{ border: 'none', background: 'none', color: '#0284C7', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      This month
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#F8FAFC', padding: '0.5rem 0.9rem', borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700 }}>
              <Calendar size={17} style={{ color: '#166534' }} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', fontWeight: 800, color: '#1E293B', cursor: 'pointer' }}
              />
            </div>
          )}
        </div>
      </div>

      {isLoadingLogs && <PageLoader label="Loading attendance…" />}

      {/* Top Metric KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL FLEET</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
              <UserCheck size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1E293B', marginTop: '6px' }}>{filteredAgents.length} Riders</div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>Assigned to {selectedHubId === 'bengaluru' ? 'Bangalore' : 'Hosur'} Hub</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #86EFAC', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ON SHIFT NOW</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534' }}>
              <CheckCircle size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#166534', marginTop: '6px' }}>{presentCount} Active</div>
          <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: '2px' }}>Punched in & on duty</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #FCA5A5', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MARKED ABSENT</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
              <UserX size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#DC2626', marginTop: '6px' }}>{absentCount} Absent</div>
          <div style={{ fontSize: '0.78rem', color: '#DC2626', marginTop: '2px' }}>Off-duty or leave today</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', padding: '1.25rem', border: '1px solid #93C5FD', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PUNCTUALITY RATE</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1E40AF' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1E40AF', marginTop: '6px' }}>{punctualityRate}%</div>
          <div style={{ fontSize: '0.78rem', color: '#1E40AF', marginTop: '2px' }}>On-time morning shift check-ins</div>
        </div>
      </div>

      {/* VIEW 1: MONTHLY ATTENDANCE MATRIX */}
      {viewMode === 'monthly' ? (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          {/* Table Toolbar */}
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', backgroundColor: '#F8FAFC' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                Monthly Rider Attendance Roster ({selectedMonth})
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Interactive daily punch status matrix for all {daysInMonth} days in {selectedMonth}
              </p>
            </div>

            <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search rider name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem 0.55rem 38px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F1F5F9', textTransform: 'uppercase', fontSize: '0.72rem', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left', minWidth: '190px' }}>Rider Name & Phone</th>
                  <th style={{ padding: '0.9rem 0.75rem', textAlign: 'center' }}>Present</th>
                  <th style={{ padding: '0.9rem 0.75rem', textAlign: 'center' }}>Absent</th>
                  <th style={{ padding: '0.9rem 0.75rem', textAlign: 'center' }}>Shift %</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left', minWidth: '340px' }}>Daily Attendance Matrix (Days 1-{daysInMonth})</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem', color: '#94A3B8' }}>
                      No delivery riders found matching your search query.
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => {
                    const stats = getRiderMonthlyStats(agent.id);

                    return (
                      <tr key={agent.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'left' }}>
                          <div style={{ fontWeight: 800, color: '#1E293B', fontSize: '0.9rem' }}>🚴 {agent.name}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>📞 {agent.phone || 'N/A'}</div>
                        </td>

                        <td style={{ padding: '0.9rem 0.75rem', textAlign: 'center', fontWeight: 800, color: '#166534' }}>
                          {stats.presentDays} d
                        </td>

                        <td style={{ padding: '0.9rem 0.75rem', textAlign: 'center', fontWeight: 800, color: '#DC2626' }}>
                          {stats.absentDays} d
                        </td>

                        <td style={{ padding: '0.9rem 0.75rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            backgroundColor: stats.attendancePct >= 85 ? '#DCFCE7' : stats.attendancePct >= 70 ? '#FEF3C7' : '#FEE2E2',
                            color: stats.attendancePct >= 85 ? '#166534' : stats.attendancePct >= 70 ? '#B45309' : '#DC2626',
                          }}>
                            {stats.attendancePct}%
                          </span>
                        </td>

                        {/* Interactive Dot Matrix */}
                        <td style={{ padding: '0.9rem 1.25rem' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {daysArray.map((dayNum) => {
                              const dayStr = `${selectedMonth}-${dayNum.toString().padStart(2, '0')}`;
                              const logEntry = stats.logs.find(l => l.date === dayStr);
                              const isPresent = logEntry?.status === 'present' || logEntry?.status === 'completed';
                              const isAbsent = logEntry?.status === 'absent';

                              return (
                                <span
                                  key={dayNum}
                                  title={`Day ${dayNum}: ${isPresent ? 'Present' : isAbsent ? 'Absent' : 'Not Punched'}`}
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '5px',
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: isPresent ? '#166534' : isAbsent ? '#DC2626' : '#E2E8F0',
                                    color: isPresent || isAbsent ? '#FFFFFF' : '#64748B',
                                    cursor: 'pointer',
                                    transition: 'transform 0.15s ease'
                                  }}
                                  onClick={() => handleToggleAttendance(agent, isPresent ? 'absent' : 'present', dayStr)}
                                >
                                  {dayNum}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedRiderForModal(agent)}
                            style={{
                              backgroundColor: '#DCFCE7',
                              color: '#166534',
                              border: '1px solid #86EFAC',
                              borderRadius: '10px',
                              padding: '0.5rem 0.9rem',
                              fontSize: '0.8rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <BarChart2 size={15} /> Rider Log
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
      ) : (
        /* VIEW 2: DAILY OVERRIDE LOG TABLE */
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', backgroundColor: '#F8FAFC' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
              Daily Shift Attendance Override ({selectedDate})
            </h3>

            <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search rider name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem 0.55rem 38px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F1F5F9', textTransform: 'uppercase', fontSize: '0.72rem', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left' }}>RIDER NAME</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left' }}>PHONE</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left' }}>ASSIGNED HUB</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left' }}>ONLINE TELEMETRY</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left' }}>ATTENDANCE STATUS</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>ADMIN OVERRIDE ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem', color: '#94A3B8' }}>
                      No delivery riders found matching your search query.
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => {
                    const isPresent = agent.attendanceStatus === 'present';
                    const isAbsent = agent.attendanceStatus === 'absent';
                    const isUpdating = updatingAgentId === agent.id;

                    return (
                      <tr key={agent.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '0.9rem 1.25rem', fontWeight: 800, color: '#1E293B', fontSize: '0.9rem', textAlign: 'left' }}>
                          🚴 {agent.name}
                        </td>

                        <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.85rem', color: '#475569', textAlign: 'left' }}>
                          📞 {agent.phone || 'N/A'}
                        </td>

                        <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.85rem', color: '#334155', fontWeight: 600, textAlign: 'left' }}>
                          {selectedHubId === 'bengaluru' ? 'Bangalore Hub' : 'Hosur Central Hub'}
                        </td>

                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'left' }}>
                          <span style={{
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            padding: '4px 12px',
                            borderRadius: '14px',
                            backgroundColor: agent.isOnline ? '#DCFCE7' : '#F1F5F9',
                            color: agent.isOnline ? '#166534' : '#64748B'
                          }}>
                            {agent.isOnline ? '🟢 Online (Active Duty)' : '⚪ Offline'}
                          </span>
                        </td>

                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'left' }}>
                          <span style={{
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            padding: '4px 12px',
                            borderRadius: '14px',
                            backgroundColor: isPresent ? '#DCFCE7' : isAbsent ? '#FEF2F2' : '#FFFBEB',
                            color: isPresent ? '#166534' : isAbsent ? '#DC2626' : '#D97706',
                            border: `1px solid ${isPresent ? '#86EFAC' : isAbsent ? '#FCA5A5' : '#FDE68A'}`
                          }}>
                            {isPresent ? '✓ Present Today' : isAbsent ? '✕ Marked Absent' : '⏱ Unchecked'}
                          </span>
                        </td>

                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button
                              disabled={isUpdating || isPresent}
                              onClick={() => handleToggleAttendance(agent, 'present')}
                              style={{
                                backgroundColor: isPresent ? '#DCFCE7' : '#FFFFFF',
                                color: '#166534',
                                border: '1px solid #86EFAC',
                                borderRadius: '10px',
                                padding: '0.45rem 0.85rem',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                cursor: isUpdating || isPresent ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <UserCheck size={14} /> Mark Present
                            </button>

                            <button
                              disabled={isUpdating || isAbsent}
                              onClick={() => handleToggleAttendance(agent, 'absent')}
                              style={{
                                backgroundColor: isAbsent ? '#FEF2F2' : '#FFFFFF',
                                color: '#DC2626',
                                border: '1px solid #FCA5A5',
                                borderRadius: '10px',
                                padding: '0.45rem 0.85rem',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                cursor: isUpdating || isAbsent ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <UserX size={14} /> Mark Absent
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RIDER MONTHLY BREAKDOWN MODAL */}
      {selectedRiderForModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '85vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                  📊 Shift Attendance Audit — {selectedRiderForModal.name}
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
                  Month: {selectedMonth} · Phone: {selectedRiderForModal.phone || 'N/A'}
                </p>
              </div>

              <button
                onClick={() => setSelectedRiderForModal(null)}
                style={{
                  backgroundColor: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  color: '#475569'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Monthly Stats Summary */}
              {(() => {
                const stats = getRiderMonthlyStats(selectedRiderForModal.id);
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#DCFCE7', borderRadius: '14px', padding: '1rem', textAlign: 'center', border: '1px solid #86EFAC' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>PRESENT DAYS</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#166534', marginTop: '2px' }}>{stats.presentDays} Days</div>
                    </div>
                    <div style={{ backgroundColor: '#FEF2F2', borderRadius: '14px', padding: '1rem', textAlign: 'center', border: '1px solid #FCA5A5' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#DC2626', textTransform: 'uppercase' }}>ABSENT DAYS</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#DC2626', marginTop: '2px' }}>{stats.absentDays} Days</div>
                    </div>
                    <div style={{ backgroundColor: '#DBEAFE', borderRadius: '14px', padding: '1rem', textAlign: 'center', border: '1px solid #93C5FD' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase' }}>ATTENDANCE RATE</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1E40AF', marginTop: '2px' }}>{stats.attendancePct}%</div>
                    </div>
                  </div>
                );
              })()}

              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B', margin: '0.25rem 0 0 0' }}>
                Daily Punch In / Punch Out Timestamps:
              </h4>

              <div style={{ border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Punch In</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Punch Out</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daysArray.map((dayNum) => {
                      const dayStr = `${selectedMonth}-${dayNum.toString().padStart(2, '0')}`;
                      const logs = getRiderMonthlyStats(selectedRiderForModal.id).logs;
                      const log = logs.find(l => l.date === dayStr);
                      const isPresent = log?.status === 'present' || log?.status === 'completed';
                      const isAbsent = log?.status === 'absent';

                      return (
                        <tr key={dayStr} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#1E293B' }}>
                            {dayStr}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                            {isPresent ? (log?.punchInTimeStr || 'Marked by admin') : '-'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                            {isPresent ? (log?.punchOutTimeStr || '-') : '-'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '10px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              backgroundColor: isPresent ? '#DCFCE7' : isAbsent ? '#FEF2F2' : '#F1F5F9',
                              color: isPresent ? '#166534' : isAbsent ? '#DC2626' : '#64748B',
                            }}>
                              {isPresent ? 'Present' : isAbsent ? 'Absent' : 'Unchecked'}
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
        </div>
      )}

    </div>
  );
}
