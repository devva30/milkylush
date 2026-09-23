import { useState, useEffect } from 'react';
import { UserCheck, UserX, Clock, Search, ShieldCheck, Calendar, RefreshCw, ChevronLeft, ChevronRight, BarChart2, Filter, Download } from 'lucide-react';
import { doc, updateDoc, setDoc, addDoc, collection, serverTimestamp, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import type { DeliveryAgent } from '../../types';

interface DispatchAttendancePageProps {
  selectedHubId: string;
  hubDeliveryAgents: DeliveryAgent[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface MonthlyRecord {
  date: string;
  status: 'present' | 'absent' | 'unchecked';
  checkInTime?: string;
  checkOutTime?: string;
  hoursWorked?: number;
}

export default function DispatchAttendancePage({
  selectedHubId,
  hubDeliveryAgents,
  showToast,
}: DispatchAttendancePageProps) {
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('monthly');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [updatingAgentId, setUpdatingAgentId] = useState<string | null>(null);
  const [selectedRiderForModal, setSelectedRiderForModal] = useState<DeliveryAgent | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<Record<string, MonthlyRecord[]>>({});
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const isHosur = selectedHubId.includes('hosur');

  // Filter agents for selected hub
  const filteredAgents = (hubDeliveryAgents || []).filter((agent) => {
    const isHubMatch = (agent.hubId || agent.assignedHubId) === selectedHubId ||
      (isHosur ? (agent.assignedZone || '').toLowerCase().includes('hosur') : !(agent.assignedZone || '').toLowerCase().includes('hosur'));
    if (!isHubMatch) return false;

    return (
      (agent.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (agent.phone || '').includes(searchQuery) ||
      (agent.assignedZone || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Calculate days in selected month
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '09', 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Fetch real-time attendance logs for selected month
  useEffect(() => {
    setIsLoadingLogs(true);
    const q = query(
      collection(db, 'attendance_logs'),
      where('date', '>=', `${selectedMonth}-01`),
      where('date', '<=', `${selectedMonth}-${daysInMonth.toString().padStart(2, '0')}`)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsByAgent: Record<string, MonthlyRecord[]> = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const agentId = data.agentId;
        if (!agentId) return;

        if (!logsByAgent[agentId]) {
          logsByAgent[agentId] = [];
        }

        logsByAgent[agentId].push({
          date: data.date,
          status: data.attendanceStatus || (data.status === 'online' ? 'present' : 'absent'),
          checkInTime: data.checkInTime || (data.timestamp ? new Date(data.timestamp.toDate?.() || data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '06:00 AM'),
          checkOutTime: data.checkOutTime || '02:00 PM',
          hoursWorked: data.hoursWorked || 8.0,
        });
      });

      setAttendanceLogs(logsByAgent);
      setIsLoadingLogs(false);
    }, (err) => {
      console.warn("Error streaming attendance logs:", err);
      setIsLoadingLogs(false);
    });

    return () => unsubscribe();
  }, [selectedMonth, daysInMonth]);

  // Overall statistics
  const presentCount = filteredAgents.filter((a) => a.attendanceStatus === 'present' || a.isOnline).length;
  const absentCount = filteredAgents.filter((a) => a.attendanceStatus === 'absent').length;
  const offlineCount = filteredAgents.length - presentCount - absentCount;

  const handleToggleAttendance = async (agent: DeliveryAgent, newStatus: 'present' | 'absent', dateToUpdate?: string) => {
    setUpdatingAgentId(agent.id);
    const isPresent = newStatus === 'present';
    const targetDate = dateToUpdate || selectedDate;

    try {
      // 1. Update Firestore delivery_agents collection document if today
      if (targetDate === new Date().toISOString().slice(0, 10)) {
        await updateDoc(doc(db, 'delivery_agents', agent.id), {
          attendanceStatus: newStatus,
          isOnline: isPresent,
          status: isPresent ? 'online' : 'offline',
          lastAttendanceUpdate: new Date().toISOString(),
        });
        agent.attendanceStatus = newStatus;
        agent.isOnline = isPresent;
      }

      // 2. Add Audit Log entry in attendance_logs
      await addDoc(collection(db, 'attendance_logs'), {
        agentId: agent.id,
        agentName: agent.name,
        status: isPresent ? 'online' : 'offline',
        attendanceStatus: newStatus,
        date: targetDate,
        checkInTime: isPresent ? '06:00 AM' : '-',
        checkOutTime: isPresent ? '02:00 PM' : '-',
        hoursWorked: isPresent ? 8.0 : 0.0,
        updatedBy: 'Admin Console',
        timestamp: serverTimestamp(),
      });

      showToast(
        `Updated attendance for "${agent.name}" on ${targetDate}: Marked as ${newStatus.toUpperCase()}!`,
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
    const logs = attendanceLogs[agentId] || [];
    const presentDays = logs.filter(l => l.status === 'present').length;
    const absentDays = logs.filter(l => l.status === 'absent').length;
    const uncheckedDays = Math.max(0, daysInMonth - presentDays - absentDays);
    const attendancePct = daysInMonth > 0 ? Math.round((presentDays / daysInMonth) * 100) : 0;
    return { presentDays, absentDays, uncheckedDays, attendancePct, logs };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            📋 Rider Monthly Shift Attendance & Roster
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '2px 0 0 0' }}>
            Track monthly rider check-ins, duty hours, shift logs, and admin overrides for <strong>{selectedHubId}</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* View Mode Switcher */}
          <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '10px', gap: '3px', border: '1px solid #CBD5E1' }}>
            <button
              onClick={() => setViewMode('monthly')}
              style={{
                backgroundColor: viewMode === 'monthly' ? '#047857' : 'transparent',
                color: viewMode === 'monthly' ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <BarChart2 size={15} /> Monthly Roster
            </button>
            <button
              onClick={() => setViewMode('daily')}
              style={{
                backgroundColor: viewMode === 'daily' ? '#047857' : 'transparent',
                color: viewMode === 'daily' ? '#FFFFFF' : '#475569',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Calendar size={15} /> Daily Override
            </button>
          </div>

          {/* Month Selector */}
          {viewMode === 'monthly' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', padding: '0.45rem 0.85rem', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
              <Calendar size={16} style={{ color: '#047857' }} />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', cursor: 'pointer' }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', padding: '0.45rem 0.85rem', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
              <Calendar size={16} style={{ color: '#047857' }} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', cursor: 'pointer' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Top Roster Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>TOTAL RIDERS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1E293B', marginTop: '4px' }}>{filteredAgents.length} Partners</div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>Registered in hub</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>PRESENT (ON DUTY)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#047857', marginTop: '4px' }}>{presentCount} Riders</div>
          <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: '2px' }}>Active check-in</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#DC2626', textTransform: 'uppercase' }}>MARKED ABSENT</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>{absentCount} Riders</div>
          <div style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '2px' }}>Off-duty / Shift substitute</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.15rem', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#D97706', textTransform: 'uppercase' }}>OFFLINE / UNCHECKED</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>{offlineCount} Riders</div>
          <div style={{ fontSize: '0.75rem', color: '#D97706', marginTop: '2px' }}>Awaiting check-in</div>
        </div>
      </div>

      {/* VIEW 1: MONTHLY ATTENDANCE ROSTER MATRIX */}
      {viewMode === 'monthly' ? (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          {/* Table Header */}
          <div style={{ padding: '1.15rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
                Monthly Shift Attendance Roster ({selectedMonth})
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0 0' }}>
                Daily status matrix for {daysInMonth} days in {selectedMonth}
              </p>
            </div>

            <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search rider name, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 36px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', textTransform: 'uppercase', fontSize: '0.7rem', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', minWidth: '180px' }}>Rider Name</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>Present</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>Absent</th>
                  <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>Duty %</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', minWidth: '320px' }}>Monthly Shift Matrix (Days 1-{daysInMonth})</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>
                      No delivery riders found matching search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => {
                    const stats = getRiderMonthlyStats(agent.id);

                    return (
                      <tr key={agent.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'left' }}>
                          <div style={{ fontWeight: 800, color: '#1E293B', fontSize: '0.88rem' }}>🚴 {agent.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>📞 {agent.phone || 'N/A'}</div>
                        </td>

                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 800, color: '#047857' }}>
                          {stats.presentDays} d
                        </td>

                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center', fontWeight: 800, color: '#DC2626' }}>
                          {stats.absentDays} d
                        </td>

                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            backgroundColor: stats.attendancePct >= 85 ? '#DCFCE7' : stats.attendancePct >= 70 ? '#FEF3C7' : '#FEE2E2',
                            color: stats.attendancePct >= 85 ? '#047857' : stats.attendancePct >= 70 ? '#B45309' : '#DC2626',
                          }}>
                            {stats.attendancePct}%
                          </span>
                        </td>

                        {/* Daily Dot Matrix */}
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {daysArray.map((dayNum) => {
                              const dayStr = `${selectedMonth}-${dayNum.toString().padStart(2, '0')}`;
                              const logEntry = stats.logs.find(l => l.date === dayStr);
                              const isPresent = logEntry?.status === 'present';
                              const isAbsent = logEntry?.status === 'absent';

                              return (
                                <span
                                  key={dayNum}
                                  title={`Day ${dayNum}: ${isPresent ? 'Present (On Duty)' : isAbsent ? 'Absent' : 'Unchecked'}`}
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '4px',
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: isPresent ? '#047857' : isAbsent ? '#DC2626' : '#E2E8F0',
                                    color: isPresent || isAbsent ? '#FFFFFF' : '#64748B',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => handleToggleAttendance(agent, isPresent ? 'absent' : 'present', dayStr)}
                                >
                                  {dayNum}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedRiderForModal(agent)}
                            style={{
                              backgroundColor: '#ECFDF5',
                              color: '#047857',
                              border: '1px solid #A7F3D0',
                              borderRadius: '8px',
                              padding: '0.45rem 0.85rem',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <BarChart2 size={14} /> Monthly Log
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
        /* VIEW 2: DAILY OVERRIDE ROSTER TABLE */
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '1.15rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', margin: 0 }}>
              Daily Attendance Roster & Admin Override ({selectedDate})
            </h3>

            <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search rider name, phone, zone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 36px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', textTransform: 'uppercase', fontSize: '0.72rem', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left' }}>RIDER NAME</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left' }}>CONTACT PHONE</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left' }}>ASSIGNED ZONE</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left' }}>ONLINE STATUS</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left' }}>ATTENDANCE TODAY</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>ADMIN OVERRIDE ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>
                      No delivery riders found matching search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => {
                    const isPresent = agent.attendanceStatus === 'present' || agent.isOnline;
                    const isAbsent = agent.attendanceStatus === 'absent';
                    const isUpdating = updatingAgentId === agent.id;

                    return (
                      <tr key={agent.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '0.85rem 1.25rem', fontWeight: 800, color: '#1E293B', fontSize: '0.88rem', textAlign: 'left' }}>
                          🚴 {agent.name}
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.82rem', color: '#475569', textAlign: 'left' }}>
                          📞 {agent.phone || 'N/A'}
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.82rem', color: '#334155', fontWeight: 600, textAlign: 'left' }}>
                          {agent.assignedZone || agent.hubId || 'General Route'}
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'left' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: '12px',
                            backgroundColor: agent.isOnline ? '#DCFCE7' : '#F1F5F9',
                            color: agent.isOnline ? '#047857' : '#64748B'
                          }}>
                            {agent.isOnline ? '🟢 Online (On Duty)' : '⚪ Offline'}
                          </span>
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'left' }}>
                          <span style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '4px 12px',
                            borderRadius: '14px',
                            backgroundColor: isPresent ? '#DCFCE7' : isAbsent ? '#FEF2F2' : '#FFFBEB',
                            color: isPresent ? '#047857' : isAbsent ? '#DC2626' : '#D97706',
                            border: `1px solid ${isPresent ? '#86EFAC' : isAbsent ? '#FCA5A5' : '#FDE68A'}`
                          }}>
                            {isPresent ? '✓ Present Today' : isAbsent ? '✕ Marked Absent' : '⏱ Unchecked'}
                          </span>
                        </td>

                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              disabled={isUpdating || isPresent}
                              onClick={() => handleToggleAttendance(agent, 'present')}
                              style={{
                                backgroundColor: isPresent ? '#ECFDF5' : '#FFFFFF',
                                color: '#047857',
                                border: '1px solid #A7F3D0',
                                borderRadius: '8px',
                                padding: '0.4rem 0.75rem',
                                fontSize: '0.75rem',
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
                                borderRadius: '8px',
                                padding: '0.4rem 0.75rem',
                                fontSize: '0.75rem',
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
            borderRadius: '20px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '85vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                  📊 Monthly Shift Breakdown — {selectedRiderForModal.name}
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '2px 0 0 0' }}>
                  Month: {selectedMonth} · Zone: {selectedRiderForModal.assignedZone || 'General'}
                </p>
              </div>

              <button
                onClick={() => setSelectedRiderForModal(null)}
                style={{
                  backgroundColor: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  color: '#475569'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Monthly Stats Summary */}
              {(() => {
                const stats = getRiderMonthlyStats(selectedRiderForModal.id);
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#ECFDF5', borderRadius: '12px', padding: '0.85rem', textAlign: 'center', border: '1px solid #A7F3D0' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#047857' }}>PRESENT SHIFTS</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#047857' }}>{stats.presentDays} Days</div>
                    </div>
                    <div style={{ backgroundColor: '#FEE2E2', borderRadius: '12px', padding: '0.85rem', textAlign: 'center', border: '1px solid #FCA5A5' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#DC2626' }}>ABSENT SHIFTS</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#DC2626' }}>{stats.absentDays} Days</div>
                    </div>
                    <div style={{ backgroundColor: '#F1F5F9', borderRadius: '12px', padding: '0.85rem', textAlign: 'center', border: '1px solid #CBD5E1' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569' }}>ATTENDANCE RATE</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E293B' }}>{stats.attendancePct}%</div>
                    </div>
                  </div>
                );
              })()}

              <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1E293B', margin: '0.5rem 0 0 0' }}>
                Daily Shift Audit Logs:
              </h4>

              <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '0.6rem 1rem', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '0.6rem 1rem', textAlign: 'left' }}>Check In</th>
                      <th style={{ padding: '0.6rem 1rem', textAlign: 'left' }}>Check Out</th>
                      <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daysArray.map((dayNum) => {
                      const dayStr = `${selectedMonth}-${dayNum.toString().padStart(2, '0')}`;
                      const logs = getRiderMonthlyStats(selectedRiderForModal.id).logs;
                      const log = logs.find(l => l.date === dayStr);
                      const isPresent = log?.status === 'present';
                      const isAbsent = log?.status === 'absent';

                      return (
                        <tr key={dayStr} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '0.6rem 1rem', fontWeight: 700, color: '#1E293B' }}>
                            {dayStr}
                          </td>
                          <td style={{ padding: '0.6rem 1rem', color: '#475569' }}>
                            {isPresent ? (log?.checkInTime || '06:00 AM') : '-'}
                          </td>
                          <td style={{ padding: '0.6rem 1rem', color: '#475569' }}>
                            {isPresent ? (log?.checkOutTime || '02:00 PM') : '-'}
                          </td>
                          <td style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '8px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              backgroundColor: isPresent ? '#DCFCE7' : isAbsent ? '#FEE2E2' : '#F1F5F9',
                              color: isPresent ? '#047857' : isAbsent ? '#DC2626' : '#64748B',
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
