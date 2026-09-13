import { useState, useMemo, useEffect } from 'react';
import { Search, Download, ArrowLeft, Calendar as CalendarIcon, Sparkles, X, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, PauseCircle, Phone, Mail, MapPin } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Subscription, User, Product } from '../types';

interface DateStatusInfo {
  status: 'active' | 'skipped' | 'exception';
  reason?: string;
  suggestion?: string;
  notes?: string;
}

interface SubscriptionsPageProps {
  selectedHubId: string;
  hubSubscriptions: Subscription[];
  users?: User[];
  products?: Product[];
  targetSubscriptionId?: string | null;
  isLoading?: boolean;
  onNavigateTab: (tabName: string, targetId?: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

import { logAdminAuditAction } from '../utils/auditLogger';

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

const calculatePaidDropEndDate = (
  startDateStr?: string,
  planDurationStr: string = '30days',
  frequencyStr: string = 'daily',
  customDaysList: number[] = [],
  pausedDatesList: string[] = [],
  vacationStartStr?: string,
  vacationEndStr?: string
): string => {
  if (!startDateStr) return '2026-11-08';
  try {
    const startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) return '2026-11-08';

    const requiredDrops = planDurationStr === '15days' ? 15 : (planDurationStr === '90days' ? 90 : 30);
    let curr = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    let dropsCounted = 0;

    const pausedKeys = new Set(
      (pausedDatesList || []).map((d) => {
        const pd = new Date(d);
        return `${pd.getFullYear()}-${pd.getMonth()}-${pd.getDate()}`;
      })
    );

    let vStart: Date | null = vacationStartStr ? new Date(vacationStartStr) : null;
    let vEnd: Date | null = vacationEndStr ? new Date(vacationEndStr) : null;
    if (vStart) vStart.setHours(0, 0, 0, 0);
    if (vEnd) vEnd.setHours(0, 0, 0, 0);

    for (let i = 0; i < 700; i++) {
      const key = `${curr.getFullYear()}-${curr.getMonth()}-${curr.getDate()}`;
      const isPaused = pausedKeys.has(key);
      const isVacation = Boolean(vStart && vEnd && curr >= vStart && curr <= vEnd);

      if (!isPaused && !isVacation) {
        let isScheduled = false;
        const freq = frequencyStr.toLowerCase();
        if (freq === 'daily' || freq === 'everyday') {
          isScheduled = true;
        } else if (freq.includes('alternate')) {
          const diff = Math.floor((curr.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          isScheduled = diff % 2 === 0;
        } else if (freq.includes('custom') && customDaysList.length > 0) {
          const day = curr.getDay() === 0 ? 7 : curr.getDay();
          isScheduled = customDaysList.includes(day);
        } else {
          isScheduled = true;
        }

        if (isScheduled) {
          dropsCounted++;
          if (dropsCounted >= requiredDrops) {
            return formatDateLabel(curr.toISOString());
          }
        }
      }

      curr.setDate(curr.getDate() + 1);
    }
    return formatDateLabel(curr.toISOString());
  } catch (e) {
    return '2026-11-08';
  }
};

const getCalendarDayStatus = (
  year: number,
  monthIndex: number,
  dayNum: number,
  plan: any,
  override?: DateStatusInfo
): { isScheduled: boolean; status: 'active' | 'skipped' | 'exception' | 'offDay' | 'vacation'; label: string; reason?: string; notes?: string } => {
  if (override) {
    return {
      isScheduled: override.status !== 'skipped',
      status: override.status,
      label: override.status === 'exception' ? '⚠️ Exception' : override.status === 'skipped' ? '⏸️ Skipped' : `${plan.dailyQty || 1} unit`,
      reason: override.reason,
      notes: override.notes,
    };
  }

  const targetDate = new Date(year, monthIndex, dayNum);
  targetDate.setHours(0, 0, 0, 0);

  const startDate = plan.startDate ? new Date(plan.startDate) : new Date(2026, 8, 11);
  startDate.setHours(0, 0, 0, 0);

  const calculatedEndDate = plan.calculatedEndDate ? new Date(plan.calculatedEndDate) : new Date(2026, 10, 8);
  calculatedEndDate.setHours(23, 59, 59, 999);

  if (targetDate.getTime() < startDate.getTime() || targetDate.getTime() > calculatedEndDate.getTime()) {
    return { isScheduled: false, status: 'offDay', label: '-' };
  }

  const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
  const pausedDates = plan.pausedDates || [];
  const pausedDateReasons = plan.pausedDateReasons || {};
  const reasonEntry = pausedDateReasons[dateKey];
  const customerReason = typeof reasonEntry === 'object' ? reasonEntry?.reason : typeof reasonEntry === 'string' ? reasonEntry : undefined;
  const customerNotes = typeof reasonEntry === 'object' ? reasonEntry?.notes : undefined;

  if (pausedDates.includes(dateKey) || customerReason) {
    return {
      isScheduled: false,
      status: 'skipped',
      label: customerReason ? `⏸️ ${customerReason}` : '⏸️ Skipped',
      reason: customerReason,
      notes: customerNotes,
    };
  }

  if (plan.vacationStart && plan.vacationEnd) {
    const vStart = new Date(plan.vacationStart);
    vStart.setHours(0, 0, 0, 0);
    const vEnd = new Date(plan.vacationEnd);
    vEnd.setHours(23, 59, 59, 999);
    if (targetDate.getTime() >= vStart.getTime() && targetDate.getTime() <= vEnd.getTime()) {
      return { isScheduled: false, status: 'vacation', label: '🏖️ Vacation' };
    }
  }

  const freq = (plan.frequency || 'everyday').toLowerCase();
  let isScheduled = false;

  if (freq === 'daily' || freq === 'everyday') {
    isScheduled = true;
  } else if (freq.includes('alternate')) {
    const diffDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    isScheduled = diffDays % 2 === 0;
  } else if (freq.includes('custom')) {
    const customDays = plan.customDays || [];
    const jsDay = targetDate.getDay();
    const isoWeekday = jsDay === 0 ? 7 : jsDay;
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const nameOfWeek = dayNames[jsDay];

    isScheduled = customDays.some((cd: any) => {
      const cdStr = String(cd).toUpperCase();
      return cdStr === nameOfWeek || cdStr === String(jsDay) || cdStr === String(isoWeekday);
    });
  } else {
    isScheduled = true;
  }

  if (isScheduled) {
    return { isScheduled: true, status: 'active', label: `${plan.dailyQty || 1} unit` };
  } else {
    return { isScheduled: false, status: 'offDay', label: '-' };
  }
};

const getSpannedMonths = (plan: any) => {
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const start = plan.startDate ? new Date(plan.startDate) : new Date(2026, 8, 11);
  const end = plan.calculatedEndDate ? new Date(plan.calculatedEndDate) : new Date(2026, 10, 8);
  
  const months = [];
  let curr = new Date(start.getFullYear(), start.getMonth(), 1);
  let monthCount = 1;

  while (curr <= end || (curr.getFullYear() === end.getFullYear() && curr.getMonth() <= end.getMonth())) {
    months.push({
      label: `Month ${monthCount} (${MONTH_NAMES[curr.getMonth()]} ${curr.getFullYear()})`,
      year: curr.getFullYear(),
      monthIndex: curr.getMonth(),
    });
    curr.setMonth(curr.getMonth() + 1);
    monthCount++;
    if (monthCount > 12) break;
  }

  if (months.length === 0) {
    months.push({ label: 'Month 1 (September 2026)', year: 2026, monthIndex: 8 });
  }

  return months;
};

export default function SubscriptionsPage({
  selectedHubId,
  hubSubscriptions = [],
  users = [],
  targetSubscriptionId,
  isLoading = false,
  onNavigateTab,
  showToast,
}: SubscriptionsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [frequencyFilter, setFrequencyFilter] = useState('all');

  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  // Month Shifting State (Default: September 2026)
  const [calendarYear, setCalendarYear] = useState<number>(2026);
  const [calendarMonthIndex, setCalendarMonthIndex] = useState<number>(8); // 8 = September (0-indexed)

  // Interactive Calendar Date Status Overrides: Key = `${planId}_${year}_${month}_${day}`
  const [dateOverrides, setDateOverrides] = useState<Record<string, DateStatusInfo>>({});

  // Modal State for Date Click
  const [activeDateModal, setActiveDateModal] = useState<{
    planId: string;
    planName: string;
    dayNum: number;
    year: number;
    monthIndex: number;
    currentOverride?: DateStatusInfo;
  } | null>(null);

  // Form states for Date Modal
  const [modalReason, setModalReason] = useState<string>('Supply / Stock Shortage');
  const [modalSuggestion, setModalSuggestion] = useState<string>('');
  const [modalNotes, setModalNotes] = useState<string>('');

  // Pagination State
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const isHosur = selectedHubId === 'hub_hosur_main';
  const hubCodeName = isHosur ? 'Hosur Main Hub' : 'Bangalore Hub';

  // Dynamic Live Customer Registry from Firestore hubSubscriptions + users
  const customerRegistry = useMemo(() => {
    if (hubSubscriptions && hubSubscriptions.length > 0) {
      const userMap = new Map<string, any>();
      hubSubscriptions.forEach((sub) => {
        const uId = sub.userId || sub.id;
        const matchedUser = (users || []).find((u) => u.id === sub.userId || u.name === sub.customerName);
        const userName = sub.customerName || matchedUser?.name || 'Customer';
        const userPhone = sub.customerPhone || matchedUser?.phone || 'N/A';
        const userEmail = matchedUser?.email || 'N/A';
        const address = sub.deliveryAddress || matchedUser?.address || 'N/A';

        if (!userMap.has(uId)) {
          userMap.set(uId, {
            id: uId,
            fullCustomerId: sub.userId || sub.id,
            name: userName,
            phone: userPhone,
            email: userEmail,
            address: address,
            hubId: sub.hubId || selectedHubId,
            activePlansCount: 0,
            productsText: '',
            dailyUnitsTotal: 0,
            dailyRate: 0,
            status: sub.status === 'paused' ? 'On Vacation' : sub.status === 'active' ? 'Active Delivery' : 'Inactive',
            skippedDatesCount: (sub.pausedDates || []).length,
            plans: [],
          });
        }

        const customerEntry = userMap.get(uId)!;
        const dailyQty = sub.quantity || 1;
        const dailyRate = sub.product?.price ? sub.product.price : 90;
        customerEntry.plans.push({
          id: sub.id,
          productName: sub.productName || sub.product?.name || 'Fresh Organic Milk',
          dailyQty,
          dailyRate,
          frequency: sub.frequency || 'Everyday',
          timing: sub.timing === 'evening' ? 'Evening (5-7 PM)' : 'Morning (6-8 AM)',
          duration: sub.planDuration ? `${sub.planDuration.replace('days', '')} Days Pack` : '30 Days Pack',
          prepaidPaid: sub.prepaidAmountPaid || dailyQty * dailyRate * 30,
          startDate: sub.startDate,
          endDate: sub.endDate,
          pausedDates: sub.pausedDates || [],
          vacationStart: sub.vacationStart,
          vacationEnd: sub.vacationEnd,
          customDays: sub.customDays || [],
          planDuration: sub.planDuration || '30days',
          calculatedEndDate: calculatePaidDropEndDate(
            sub.startDate,
            sub.planDuration,
            sub.frequency,
            sub.customDays,
            sub.pausedDates,
            sub.vacationStart,
            sub.vacationEnd
          ),
          status: (sub.status || 'active').toUpperCase(),
          skippedDaysList: sub.pausedDates || [],
        });

        customerEntry.activePlansCount += 1;
        customerEntry.dailyUnitsTotal += dailyQty;
        customerEntry.dailyRate += dailyRate * dailyQty;
        const prodNames = customerEntry.plans.map((p: any) => p.productName);
        customerEntry.productsText = Array.from(new Set(prodNames)).join(', ');
      });

      return Array.from(userMap.values());
    }
    return [];
  }, [hubSubscriptions, users, selectedHubId]);

  // Auto-open target customer subscription if deep-linked via prop
  useEffect(() => {
    if (targetSubscriptionId && customerRegistry.length > 0) {
      const found = customerRegistry.find(
        (c) =>
          c.id === targetSubscriptionId ||
          c.fullCustomerId === targetSubscriptionId ||
          c.name.toLowerCase().includes(targetSubscriptionId.toLowerCase()) ||
          c.plans.some((p: any) => p.id === targetSubscriptionId)
      );
      if (found) {
        setSelectedCustomer(found);
      }
    }
  }, [targetSubscriptionId, customerRegistry]);

  // Filter customer list
  const filteredCustomerList = useMemo(() => {
    return customerRegistry.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.productsText.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Status Filter
      if (statusFilter === 'active' && c.status !== 'Active Delivery') return false;
      if (statusFilter === 'vacation' && c.status !== 'On Vacation') return false;
      if (statusFilter === 'skipped' && c.skippedDatesCount === 0) return false;
      if (statusFilter === 'expired' && c.status !== 'Expired' && c.status !== 'Inactive') return false;

      // Frequency Filter
      if (frequencyFilter !== 'all') {
        const hasMatchingFrequency = c.plans.some((p: any) => {
          if (frequencyFilter === 'everyday') return p.frequency.toLowerCase() === 'everyday' || p.frequency.toLowerCase() === 'daily';
          if (frequencyFilter === 'alternate') return p.frequency.toLowerCase().includes('alternate');
          if (frequencyFilter === 'custom') return p.frequency.toLowerCase().includes('custom');
          return true;
        });
        if (!hasMatchingFrequency) return false;
      }

      return true;
    });
  }, [customerRegistry, searchQuery, statusFilter, frequencyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomerList.length / (pageSize === 9999 ? filteredCustomerList.length || 1 : pageSize)));

  const paginatedCustomerList = useMemo(() => {
    if (pageSize === 9999) return filteredCustomerList;
    const start = (currentPage - 1) * pageSize;
    return filteredCustomerList.slice(start, start + pageSize);
  }, [filteredCustomerList, currentPage, pageSize]);

  // Dynamic Calendar Calculation for Selected Month
  const daysInSelectedMonth = useMemo(() => {
    return new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
  }, [calendarYear, calendarMonthIndex]);

  const monthFirstDayOfWeek = useMemo(() => {
    return new Date(calendarYear, calendarMonthIndex, 1).getDay(); // 0 = Sun, 1 = Mon ...
  }, [calendarYear, calendarMonthIndex]);

  const handlePrevMonth = () => {
    if (calendarMonthIndex === 0) {
      setCalendarMonthIndex(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonthIndex((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonthIndex === 11) {
      setCalendarMonthIndex(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonthIndex((m) => m + 1);
    }
  };

  // Metrics
  const subscribedCustomersCount = customerRegistry.length;
  const totalActivePlansCount = customerRegistry.reduce((acc, c) => acc + c.activePlansCount, 0);
  const vacationCustomersCount = customerRegistry.filter((c) => c.status === 'On Vacation').length;
  const expiredCustomersCount = customerRegistry.filter((c) => c.status === 'Expired' || c.status === 'Inactive').length;

  const handleExportCSV = () => {
    const headers = ['Customer Name', 'Phone', 'Active Plans', 'Subscribed Products', 'Daily Quantity', 'Daily Rate', 'Status'];
    const rows = filteredCustomerList.map((c) => [
      `"${c.name}"`,
      `"${c.phone}"`,
      c.activePlansCount,
      `"${c.productsText.replace(/"/g, '""')}"`,
      `"${c.dailyUnitsTotal} Units/day"`,
      `"₹${c.dailyRate}/day"`,
      c.status,
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Subscription_Registry_${isHosur ? 'Hosur' : 'Bangalore'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Customer Subscriptions Registry to CSV!', 'success');
  };

  // Save Modal Action for Delivery Date & Sync with Firestore
  const handleSaveDateStatus = async (statusType: 'active' | 'skipped' | 'exception') => {
    if (!activeDateModal) return;
    const key = `${activeDateModal.planId}_${activeDateModal.year}_${activeDateModal.monthIndex}_${activeDateModal.dayNum}`;
    const newOverride: DateStatusInfo = {
      status: statusType,
      reason: statusType === 'exception' ? modalReason : undefined,
      suggestion: statusType === 'exception' ? modalSuggestion : undefined,
      notes: modalNotes.trim() || undefined,
    };

    setDateOverrides((prev) => ({ ...prev, [key]: newOverride }));

    // Construct target date ISO string
    const targetDateObj = new Date(activeDateModal.year, activeDateModal.monthIndex, activeDateModal.dayNum);
    const targetIso = targetDateObj.toISOString();

    // Sync pausedDates array in Firestore subscriptions collection
    try {
      const subDoc = hubSubscriptions.find((s) => s.id === activeDateModal.planId);
      if (subDoc) {
        let currentPaused: string[] = subDoc.pausedDates || [];
        const isAlreadyInPaused = currentPaused.some((pd) => {
          const d = new Date(pd);
          return d.getFullYear() === targetDateObj.getFullYear() &&
                 d.getMonth() === targetDateObj.getMonth() &&
                 d.getDate() === targetDateObj.getDate();
        });

        let updatedPaused: string[] = [...currentPaused];
        if (statusType === 'skipped' || statusType === 'exception') {
          if (!isAlreadyInPaused) {
            updatedPaused.push(targetIso);
          }
        } else if (statusType === 'active') {
          updatedPaused = currentPaused.filter((pd) => {
            const d = new Date(pd);
            return !(d.getFullYear() === targetDateObj.getFullYear() &&
                     d.getMonth() === targetDateObj.getMonth() &&
                     d.getDate() === targetDateObj.getDate());
          });
        }

        await updateDoc(doc(db, 'subscriptions', activeDateModal.planId), {
          pausedDates: updatedPaused,
        });
      }
    } catch (dbErr) {
      console.error('Error updating pausedDates in Firestore:', dbErr);
    }

    // Real-time Audit Log
    logAdminAuditAction(
      'Tom SuperAdmin',
      'tomadmin@gmail.com',
      'Super Admin',
      'Hub Operations',
      `Updated Delivery Schedule on ${activeDateModal.dayNum} ${MONTH_NAMES[activeDateModal.monthIndex]} to ${statusType.toUpperCase()} for plan ${activeDateModal.planName}`,
      `Subscription: ${activeDateModal.planId}`,
      { dateKey: key, override: newOverride },
      selectedHubId
    );

    setActiveDateModal(null);
    setModalNotes('');

    if (statusType === 'exception') {
      showToast(`Set Delivery Exception for ${activeDateModal.dayNum} ${MONTH_NAMES[activeDateModal.monthIndex]}: ${modalReason}`, 'error');
    } else if (statusType === 'skipped') {
      showToast(`Marked ${activeDateModal.dayNum} ${MONTH_NAMES[activeDateModal.monthIndex]} as Skipped / Paused`, 'info');
    } else {
      showToast(`Restored ${activeDateModal.dayNum} ${MONTH_NAMES[activeDateModal.monthIndex]} to Active Scheduled Delivery`, 'success');
    }
  };

  // -------------------------------------------------------------
  // CUSTOMER SUBSCRIPTIONS PORTAL (SUBSCRIPTION DETAIL VIEW)
  // -------------------------------------------------------------
  if (selectedCustomer) {
    const cust = selectedCustomer;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
        
        {/* Banner Header with Back Button */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '16px',
          padding: '1.15rem 1.35rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setSelectedCustomer(null)}
              title="Back to Customer Subscriptions Registry"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '1px solid #E5E7EB',
                backgroundColor: '#F9FAFB',
                color: '#111827',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                CUSTOMER SUBSCRIPTION &amp; SCHEDULE PORTAL
              </div>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#111827' }}>
                {cust.name}
              </h2>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '2px' }}>
                Assigned Hub: <strong>{hubCodeName}</strong>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('customers', cust.id || cust.fullCustomerId)}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '10px',
              backgroundColor: '#047857',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            View Full Customer Directory Profile →
          </button>
        </div>

        {/* Customer Overview Card */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: '#047857',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.25rem'
            }}>
              {cust.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#111827' }}>
                {cust.name}
              </h3>
              <div style={{ fontSize: '0.82rem', color: '#4B5563', marginTop: '3px', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span><Phone size={14} style={{ display: 'inline', verticalAlign: 'middle', color: '#047857' }} /> {cust.phone}</span>
                <span><Mail size={14} style={{ display: 'inline', verticalAlign: 'middle', color: '#047857' }} /> {cust.email}</span>
                <span><MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle', color: '#047857' }} /> {cust.address}</span>
              </div>
            </div>
          </div>

          <span style={{
            padding: '6px 14px',
            borderRadius: '20px',
            fontWeight: 800,
            fontSize: '0.78rem',
            backgroundColor: cust.status === 'On Vacation' ? '#FEF3C7' : '#DCFCE7',
            color: cust.status === 'On Vacation' ? '#D97706' : '#059669'
          }}>
            STATUS: {cust.status.toUpperCase()}
          </span>
        </div>

        {/* Individual Subscription Plan Cards with Dynamic Month Calendar */}
        {cust.plans?.map((plan: any, idx: number) => (
          <div key={plan.id} style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Plan Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ backgroundColor: '#ECFDF5', color: '#047857', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
                  Plan #{idx + 1}
                </span>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#111827' }}>
                  {plan.productName}
                </h3>
              </div>
              <span style={{ backgroundColor: '#ECFDF5', color: '#059669', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800 }}>
                {plan.status}
              </span>
            </div>

            {/* Plan Specs Grid */}
            <div style={{
              backgroundColor: '#F9FAFB',
              borderRadius: '12px',
              padding: '1rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '1rem',
              fontSize: '0.82rem',
              border: '1px solid #F3F4F6'
            }}>
              <div>
                <div style={{ color: '#6B7280', fontSize: '0.72rem', fontWeight: 700 }}>DAILY DROP QTY</div>
                <div style={{ fontWeight: 800, color: '#047857', marginTop: '2px', fontSize: '0.95rem' }}>{plan.dailyQty} Unit(s)</div>
              </div>
              <div>
                <div style={{ color: '#6B7280', fontSize: '0.72rem', fontWeight: 700 }}>DAILY RATE</div>
                <div style={{ fontWeight: 800, color: '#111827', marginTop: '2px', fontSize: '0.95rem' }}>₹{plan.dailyRate}/day</div>
              </div>
              <div>
                <div style={{ color: '#6B7280', fontSize: '0.72rem', fontWeight: 700 }}>FREQUENCY</div>
                <div style={{ fontWeight: 800, color: '#111827', marginTop: '2px' }}>{plan.frequency}</div>
              </div>
              <div>
                <div style={{ color: '#6B7280', fontSize: '0.72rem', fontWeight: 700 }}>DELIVERY TIMING</div>
                <div style={{ fontWeight: 800, color: '#111827', marginTop: '2px' }}>{plan.timing}</div>
              </div>
              <div>
                <div style={{ color: '#6B7280', fontSize: '0.72rem', fontWeight: 700 }}>PACKAGE DURATION</div>
                <div style={{ fontWeight: 800, color: '#111827', marginTop: '2px' }}>{plan.duration}</div>
              </div>
              <div>
                <div style={{ color: '#6B7280', fontSize: '0.72rem', fontWeight: 700 }}>START DATE</div>
                <div style={{ fontWeight: 800, color: '#111827', marginTop: '2px' }}>{formatDateLabel(plan.startDate)}</div>
              </div>
              <div>
                <div style={{ color: '#6B7280', fontSize: '0.72rem', fontWeight: 700 }}>ESTIMATED END DATE</div>
                <div style={{ fontWeight: 800, color: '#047857', marginTop: '2px' }}>{plan.calculatedEndDate}</div>
              </div>
              <div>
                <div style={{ color: '#6B7280', fontSize: '0.72rem', fontWeight: 700 }}>PREPAID PAID</div>
                <div style={{ fontWeight: 800, color: '#047857', marginTop: '2px' }}>₹{plan.prepaidPaid?.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div style={{ color: '#6B7280', fontSize: '0.72rem', fontWeight: 700 }}>SKIPPED DROPS</div>
                <div style={{ fontWeight: 800, color: plan.pausedDates?.length > 0 ? '#D97706' : '#6B7280', marginTop: '2px' }}>
                  {plan.pausedDates?.length || 0} Drop(s) {plan.pausedDates?.length > 0 ? '(Auto-Extended)' : ''}
                </div>
              </div>
            </div>

            {/* Interactive Delivery Schedule & Vacation Calendar */}
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '1.25rem' }}>
              
              {/* Calendar Month Navigation Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
                  <CalendarIcon size={18} style={{ color: '#047857' }} /> Delivery Schedule &amp; Vacation Calendar
                </h4>

                {/* Dynamic Month Selector Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    onClick={handlePrevMonth}
                    title="Previous Month"
                    style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {getSpannedMonths(plan).map((m) => (
                    <button
                      key={`${m.year}_${m.monthIndex}`}
                      onClick={() => { setCalendarMonthIndex(m.monthIndex); setCalendarYear(m.year); }}
                      style={{
                        padding: '0.4rem 0.85rem',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: calendarMonthIndex === m.monthIndex && calendarYear === m.year ? '#047857' : '#F3F4F6',
                        color: calendarMonthIndex === m.monthIndex && calendarYear === m.year ? '#FFFFFF' : '#374151',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                    >
                      {m.label}
                    </button>
                  ))}

                  <button
                    onClick={handleNextMonth}
                    title="Next Month"
                    style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Month Summary Bar */}
              <div style={{
                backgroundColor: '#F9FAFB',
                borderRadius: '12px',
                padding: '0.85rem 1.25rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: '1rem',
                textAlign: 'center',
                marginBottom: '1.25rem',
                border: '1px solid #E5E7EB'
              }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#6B7280', fontWeight: 700 }}>PLAN DURATION</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827', marginTop: '2px' }}>{daysInSelectedMonth} Days</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#6B7280', fontWeight: 700 }}>TOTAL DROPS</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#047857', marginTop: '2px' }}>{daysInSelectedMonth} drops</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#6B7280', fontWeight: 700 }}>DELIVERED PAST</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0284C7', marginTop: '2px' }}>5 drops</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#6B7280', fontWeight: 700 }}>VACATION DAYS</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#D97706', marginTop: '2px' }}>{plan.skippedDaysList?.length || 0} days</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#6B7280', fontWeight: 700 }}>UPCOMING ACTIVE</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#047857', marginTop: '2px' }}>{daysInSelectedMonth - (plan.skippedDaysList?.length || 0)} drops</div>
                </div>
              </div>

              {/* Dynamic Live Calendar Grid */}
              <div style={{ border: '1px solid #E5E7EB', borderRadius: '14px', padding: '1.25rem', backgroundColor: '#FFFFFF' }}>
                
                <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '1rem', color: '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🗓️ {MONTH_NAMES[calendarMonthIndex]} {calendarYear}</span>
                  <span style={{ fontSize: '0.78rem', color: '#6B7280', fontWeight: 600 }}>💡 Click any date tile to set delivery exception, skip date, or active status</span>
                </div>

                {/* Day Headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', fontWeight: 800, fontSize: '0.75rem', color: '#6B7280', marginBottom: '8px' }}>
                  <div>SUN</div>
                  <div>MON</div>
                  <div>TUE</div>
                  <div>WED</div>
                  <div>THU</div>
                  <div>FRI</div>
                  <div>SAT</div>
                </div>

                {/* Days Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                  
                  {/* Empty Day Offset Boxes */}
                  {Array.from({ length: monthFirstDayOfWeek }).map((_, emptyIdx) => (
                    <div key={`empty_${emptyIdx}`} style={{ height: '62px', backgroundColor: '#F9FAFB', borderRadius: '10px', border: '1px dashed #E5E7EB' }}></div>
                  ))}

                  {/* Days 1 to daysInSelectedMonth */}
                  {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((dayNum) => {
                    const key = `${plan.id}_${calendarYear}_${calendarMonthIndex}_${dayNum}`;
                    const override = dateOverrides[key];
                    const dayInfo = getCalendarDayStatus(calendarYear, calendarMonthIndex, dayNum, plan, override);
                    
                    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                    const dayOfWeekIdx = (monthFirstDayOfWeek + (dayNum - 1)) % 7;
                    const dayName = dayNames[dayOfWeekIdx];

                    const isOff = dayInfo.status === 'offDay';
                    const isSkip = dayInfo.status === 'skipped';
                    const isVac = dayInfo.status === 'vacation';
                    const isExc = dayInfo.status === 'exception';
                    const isActive = dayInfo.status === 'active';

                    return (
                      <div
                        key={dayNum}
                        onClick={() => {
                          setActiveDateModal({
                            planId: plan.id,
                            planName: plan.productName,
                            dayNum,
                            year: calendarYear,
                            monthIndex: calendarMonthIndex,
                            currentOverride: override
                          });
                          if (override?.reason) setModalReason(override.reason);
                          if (override?.suggestion) setModalSuggestion(override.suggestion);
                          if (override?.notes) setModalNotes(override.notes);
                        }}
                        style={{
                          height: '62px',
                          borderRadius: '10px',
                          border: isExc
                            ? '1.5px solid #F87171'
                            : isSkip || isVac
                            ? '1.5px solid #FCA5A5'
                            : isOff
                            ? '1px solid #E5E7EB'
                            : '1px solid #A7F3D0',
                          backgroundColor: isExc
                            ? '#FEF2F2'
                            : isSkip
                            ? '#FEE2E2'
                            : isVac
                            ? '#FEF3C7'
                            : isOff
                            ? '#F9FAFB'
                            : '#ECFDF5',
                          padding: '6px 8px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                          opacity: isOff ? 0.65 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.8rem', color: isExc || isSkip ? '#DC2626' : isVac ? '#B45309' : isOff ? '#9CA3AF' : '#047857' }}>
                            {dayNum}
                          </span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isExc || isSkip ? '#DC2626' : isVac ? '#B45309' : isOff ? '#9CA3AF' : '#047857' }}>
                            {dayName}
                          </span>
                        </div>

                        {isExc ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <span style={{
                              fontSize: '0.6rem',
                              fontWeight: 800,
                              backgroundColor: '#DC2626',
                              color: '#FFFFFF',
                              borderRadius: '4px',
                              padding: '1px 3px',
                              textAlign: 'center',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '2px'
                            }}>
                              <AlertTriangle size={10} /> Exception
                            </span>
                          </div>
                        ) : isSkip ? (
                          <span 
                            title={dayInfo.reason ? `Customer Skip Reason: ${dayInfo.reason}` : 'Skipped by customer'}
                            style={{
                              fontSize: '0.58rem',
                              fontWeight: 800,
                              backgroundColor: '#EF4444',
                              color: '#FFFFFF',
                              borderRadius: '4px',
                              padding: '1px 4px',
                              textAlign: 'center',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '2px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '100%'
                            }}
                          >
                            <PauseCircle size={9} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {dayInfo.reason ? dayInfo.reason : 'Skipped'}
                            </span>
                          </span>
                        ) : isVac ? (
                          <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            backgroundColor: '#F59E0B',
                            color: '#FFFFFF',
                            borderRadius: '4px',
                            padding: '1px 3px',
                            textAlign: 'center',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '2px'
                          }}>
                            <Sparkles size={10} /> Vacation
                          </span>
                        ) : isActive ? (
                          <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            backgroundColor: '#047857',
                            color: '#FFFFFF',
                            borderRadius: '4px',
                            padding: '1px 3px',
                            textAlign: 'center'
                          }}>
                            {plan.dailyQty || 1} unit
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            color: '#9CA3AF',
                            textAlign: 'center'
                          }}>
                            -
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>

            </div>

          </div>
        ))}

        {/* Calendar Date Status & Delivery Exception Modal */}
        {activeDateModal && (
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
            zIndex: 9999,
            padding: '1rem'
          }}>
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '1.75rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.25rem', color: '#111827', margin: 0 }}>
                  Manage Delivery Date Status
                </h3>
                <button
                  onClick={() => setActiveDateModal(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}
                >
                  <X size={20} />
                </button>
              </div>

              <p style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: '1rem' }}>
                Date: <strong style={{ color: '#111827' }}>{activeDateModal.dayNum} {MONTH_NAMES[activeDateModal.monthIndex]} {activeDateModal.year}</strong> • Product: <strong style={{ color: '#047857' }}>{activeDateModal.planName}</strong>
              </p>

              {/* Customer Skip Reason Notice (if skipped via App) */}
              {(() => {
                const dateKey = `${activeDateModal.year}-${String(activeDateModal.monthIndex + 1).padStart(2, '0')}-${String(activeDateModal.dayNum).padStart(2, '0')}`;
                const targetPlan = (selectedCustomer?.plans || []).find((p: any) => p.id === activeDateModal.planId);
                const reasonEntry = targetPlan?.pausedDateReasons?.[dateKey];
                const custReason = typeof reasonEntry === 'object' ? reasonEntry?.reason : typeof reasonEntry === 'string' ? reasonEntry : activeDateModal.currentOverride?.reason;
                const custNotes = typeof reasonEntry === 'object' ? reasonEntry?.notes : activeDateModal.currentOverride?.notes;

                if (!custReason && !custNotes) return null;

                return (
                  <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '0.85rem', marginBottom: '1.25rem', textAlign: 'left' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <PauseCircle size={14} style={{ color: '#DC2626' }} /> Customer Skip Reason (App Request)
                    </div>
                    {custReason && (
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
                        "{custReason}"
                      </div>
                    )}
                    {custNotes && custNotes.trim().length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#7F1D1D', marginTop: '3px', fontStyle: 'italic' }}>
                        Customer Note: "{custNotes}"
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Exception Reason & Suggestion Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>
                    1. UNABLE TO DELIVER REASON (IF EXCEPTION):
                  </label>
                  <select
                    value={modalReason}
                    onChange={(e) => setModalReason(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#F9FAFB', fontSize: '0.82rem', outline: 'none' }}
                  >
                    <option value="Supply / Stock Shortage">Supply / Stock Shortage</option>
                    <option value="Heavy Rain / Weather Alert">Heavy Rain / Weather Alert</option>
                    <option value="Road Block / Access Restricted">Road Block / Access Restricted</option>
                    <option value="Vehicle / Delivery Bike Breakdown">Vehicle / Delivery Bike Breakdown</option>
                    <option value="Customer Unreachable / Gate Locked">Customer Unreachable / Gate Locked</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>
                    2. SUGGESTED ACTION / RESOLUTION:
                  </label>
                  <select
                    value={modalSuggestion}
                    onChange={(e) => setModalSuggestion(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#F9FAFB', fontSize: '0.82rem', outline: 'none' }}
                  >
                    <option value="">-- None / Optional --</option>
                    <option value="Refund Full Day Amount (₹90) to Wallet">Refund Full Day Amount (₹90) to Wallet</option>
                    <option value="Reschedule Extra Drop for Tomorrow Morning">Reschedule Extra Drop for Tomorrow Morning</option>
                    <option value="Substitute with Fresh Organic A2 Milk">Substitute with Fresh Organic A2 Milk</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', display: 'block', marginBottom: '4px' }}>
                    3. OPERATIONAL ADMIN NOTES (OPTIONAL):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Driver notified hub manager via phone..."
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <button
                  onClick={() => handleSaveDateStatus('exception')}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '10px',
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <AlertTriangle size={16} /> Mark as Unable to Deliver (Exception Notice)
                </button>

                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  <button
                    onClick={() => handleSaveDateStatus('skipped')}
                    style={{
                      flex: 1,
                      padding: '0.65rem',
                      borderRadius: '10px',
                      backgroundColor: '#FEF3C7',
                      color: '#D97706',
                      border: '1px solid #FDE68A',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <PauseCircle size={15} /> Pause / Skip Date
                  </button>
                  <button
                    onClick={() => handleSaveDateStatus('active')}
                    style={{
                      flex: 1,
                      padding: '0.65rem',
                      borderRadius: '10px',
                      backgroundColor: '#ECFDF5',
                      color: '#047857',
                      border: '1px solid #A7F3D0',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <CheckCircle size={15} /> Set Active Scheduled
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    );
  }

  // -------------------------------------------------------------
  // MAIN REGISTRY OVERVIEW PAGE
  // -------------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* Registry Title Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.65rem', fontWeight: 800, margin: 0, color: '#111827' }}>
            Customer Subscriptions Registry
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: '2px 0 0 0' }}>
            Grouped customer subscription plans, active delivery schedules, and app prepaid packages for {isHosur ? 'Hosur Hub' : 'Bangalore Hub'}.
          </p>
        </div>

        <span style={{
          padding: '4px 12px',
          borderRadius: '16px',
          backgroundColor: '#ECFDF5',
          color: '#047857',
          fontWeight: 800,
          fontSize: '0.75rem',
          border: '1px solid #A7F3D0'
        }}>
          🟢 Live App Sync Active
        </span>
      </div>

      {/* Top 4 Summary Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        
        {/* Card 1: SUBSCRIBED CUSTOMERS */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          padding: '1.15rem',
          borderLeft: '4px solid #047857',
          borderTop: '1px solid #E5E7EB',
          borderRight: '1px solid #E5E7EB',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              SUBSCRIBED CUSTOMERS
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#047857', marginTop: '2px', fontFamily: 'var(--font-title)' }}>
              {subscribedCustomersCount}
            </div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CalendarIcon size={20} />
          </div>
        </div>

        {/* Card 2: TOTAL ACTIVE PLANS */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          padding: '1.15rem',
          borderLeft: '4px solid #0284C7',
          borderTop: '1px solid #E5E7EB',
          borderRight: '1px solid #E5E7EB',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              TOTAL ACTIVE PLANS
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0284C7', marginTop: '2px', fontFamily: 'var(--font-title)' }}>
              {totalActivePlansCount}
            </div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#EFF6FF', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} />
          </div>
        </div>

        {/* Card 3: CUSTOMERS ON VACATION */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          padding: '1.15rem',
          borderLeft: '4px solid #D97706',
          borderTop: '1px solid #E5E7EB',
          borderRight: '1px solid #E5E7EB',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              CUSTOMERS ON VACATION
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#D97706', marginTop: '2px', fontFamily: 'var(--font-title)' }}>
              {vacationCustomersCount}
            </div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} />
          </div>
        </div>

        {/* Card 4: EXPIRED / INACTIVE PLANS */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          padding: '1.15rem',
          borderLeft: '4px solid #DC2626',
          borderTop: '1px solid #E5E7EB',
          borderRight: '1px solid #E5E7EB',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              EXPIRED / INACTIVE PLANS
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#DC2626', marginTop: '2px', fontFamily: 'var(--font-title)' }}>
              {expiredCustomersCount}
            </div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} />
          </div>
        </div>

      </div>

      {/* Main Registry Toolbar & Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        
        {/* Filter Toolbar */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem'
        }}>
          
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Status' },
              { id: 'active', label: 'Active' },
              { id: 'vacation', label: 'On Vacation' },
              { id: 'skipped', label: '⏸️ Skipped / Paused' },
              { id: 'expired', label: '🔴 Expired / Inactive' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setStatusFilter(s.id)}
                style={{
                  padding: '0.38rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  backgroundColor: statusFilter === s.id ? '#047857' : '#FFFFFF',
                  color: statusFilter === s.id ? '#FFFFFF' : '#374151',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            ))}

            <span style={{ color: '#E5E7EB', margin: '0 2px' }}>|</span>

            {[
              { id: 'all', label: 'All Frequencies' },
              { id: 'everyday', label: 'Everyday' },
              { id: 'alternate', label: 'Alternate Days' },
              { id: 'custom', label: 'Custom Days' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFrequencyFilter(f.id)}
                style={{
                  padding: '0.38rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  backgroundColor: frequencyFilter === f.id ? '#0284C7' : '#FFFFFF',
                  color: frequencyFilter === f.id ? '#FFFFFF' : '#374151',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: '#9CA3AF' }} />
              <input
                type="text"
                placeholder="Search sub ID or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '0.38rem 0.75rem 0.38rem 28px',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#F9FAFB',
                  fontSize: '0.78rem',
                  color: '#111827',
                  outline: 'none',
                  width: '210px',
                }}
              />
            </div>

            <button
              onClick={handleExportCSV}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.38rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#047857',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="table-container" style={{ border: 'none', borderRadius: 0, overflowX: 'auto' }}>
          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textAlign: 'left' }}>CUSTOMER NAME &amp; CONTACT</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textAlign: 'left' }}>ACTIVE PLANS</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textAlign: 'left' }}>SUBSCRIBED PRODUCTS</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textAlign: 'left' }}>COMBINED DAILY DROP</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textAlign: 'left' }}>DAILY RATE</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textAlign: 'left' }}>OVERALL STATUS</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.72rem', fontWeight: 800, color: '#6B7280', textAlign: 'left' }}>ACTIONS</th>
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
                        animation: 'spinSub 0.8s linear infinite'
                      }} />
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#047857' }}>
                        Syncing &amp; Fetching Subscription Plans &amp; Customer Schedules...
                      </div>
                      <style>{`@keyframes spinSub { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                  </td>
                </tr>
              ) : paginatedCustomerList.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#6B7280', fontSize: '0.88rem' }}>
                    No subscription records found matching the filters.
                  </td>
                </tr>
              ) : (
                paginatedCustomerList.map((c) => {
                  const initial = c.name.charAt(0).toUpperCase();

                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      
                      {/* Customer Name & Contact */}
                      <td style={{ verticalAlign: 'middle', padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: '#047857',
                            color: '#FFFFFF',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {initial}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: '#111827', fontSize: '0.88rem' }}>{c.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '1px' }}>
                              📞 {c.phone} • ID: {c.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Active Plans */}
                      <td style={{ verticalAlign: 'middle', padding: '0.85rem 1rem' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#ECFDF5',
                          color: '#047857',
                          fontWeight: 800,
                          fontSize: '0.78rem'
                        }}>
                          {c.activePlansCount} Active Plan(s)
                        </span>
                      </td>

                      {/* Subscribed Products */}
                      <td style={{ verticalAlign: 'middle', padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#374151', maxWidth: '220px' }}>
                        {c.productsText}
                      </td>

                      {/* Combined Daily Drop */}
                      <td style={{ verticalAlign: 'middle', padding: '0.85rem 1rem', fontWeight: 800, color: '#111827', fontSize: '0.85rem' }}>
                        {c.dailyUnitsTotal} Units/day
                      </td>

                      {/* Daily Rate */}
                      <td style={{ verticalAlign: 'middle', padding: '0.85rem 1rem', fontWeight: 800, color: '#047857', fontSize: '0.88rem' }}>
                        ₹{c.dailyRate}/day
                      </td>

                      {/* Overall Status */}
                      <td style={{ verticalAlign: 'middle', padding: '0.85rem 1rem' }}>
                        <span style={{
                          padding: '3px 10px',
                          backgroundColor: c.status === 'Active Delivery' ? '#ECFDF5' : c.status === 'On Vacation' ? '#FEF3C7' : '#F3F4F6',
                          color: c.status === 'Active Delivery' ? '#047857' : c.status === 'On Vacation' ? '#B45309' : '#6B7280',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          display: 'inline-block'
                        }}>
                          {c.status}
                        </span>
                      </td>

                      {/* Actions Button */}
                      <td style={{ verticalAlign: 'middle', padding: '0.85rem 1rem' }}>
                        <button
                          onClick={() => setSelectedCustomer(c)}
                          style={{
                            padding: '0.45rem 0.85rem',
                            borderRadius: '8px',
                            backgroundColor: '#047857',
                            color: '#FFFFFF',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          View Customer Schedule ({c.activePlansCount})
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>
              Showing {filteredCustomerList.length > 0 ? (currentPage - 1) * (pageSize === 9999 ? filteredCustomerList.length : pageSize) + 1 : 0} to {Math.min(currentPage * (pageSize === 9999 ? filteredCustomerList.length : pageSize), filteredCustomerList.length)} of {filteredCustomerList.length} entries
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#6B7280' }}>
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  backgroundColor: '#FFFFFF',
                  color: '#111827',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  outline: 'none'
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={9999}>All</option>
              </select>
              <span>entries</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                backgroundColor: '#FFFFFF',
                color: currentPage === 1 ? '#9CA3AF' : '#111827',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#111827' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                backgroundColor: '#FFFFFF',
                color: currentPage >= totalPages ? '#9CA3AF' : '#111827',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
