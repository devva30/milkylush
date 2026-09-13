import { useState, useMemo } from 'react';
import { Search, Download, ShieldCheck, UserCheck, Key, Settings, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../context/ToastContext';

import type { AdminAuditLogItem } from '../types';

export type AdminAuditLog = AdminAuditLogItem;

interface AuditLogsPageProps {
  selectedHubId: string;
  auditLogs?: AdminAuditLogItem[];
}

export default function AuditLogsPage({ selectedHubId, auditLogs = [] }: AuditLogsPageProps) {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [activeAdminFilter, setActiveAdminFilter] = useState<string>('all');
  const [selectedPayloadLog, setSelectedPayloadLog] = useState<AdminAuditLogItem | null>(null);

  // Pagination State
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const hubLabel = selectedHubId === 'hub_bangalore_main' ? 'BANGALORE HUB' : 'HOSUR HUB';

  // Filter logs by search, category, admin user, and date
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // Search Query
      const matchesSearch = log.actionSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            log.adminName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            log.adminEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            log.targetEntity.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            log.ipAddress.includes(searchQuery);
      if (!matchesSearch) return false;

      // Category Filter
      if (activeCategoryFilter !== 'all' && log.category !== activeCategoryFilter) {
        return false;
      }

      // Admin Email Filter
      if (activeAdminFilter !== 'all' && log.adminEmail !== activeAdminFilter) {
        return false;
      }

      return true;
    });
  }, [auditLogs, searchQuery, activeCategoryFilter, activeAdminFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / (pageSize === 9999 ? filteredLogs.length || 1 : pageSize)));

  const paginatedLogs = useMemo(() => {
    if (pageSize === 9999) return filteredLogs;
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            ADMIN SECURITY &amp; SYSTEM AUDIT PORTAL • {hubLabel}
          </div>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.65rem', fontWeight: 800, color: '#111827', margin: '2px 0 0 0' }}>
            Admin Activity &amp; Operation Logs
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '2px' }}>
            Track administrative users, portal logins, security changes, price updates, and financial actions.
          </p>
        </div>
      </div>

      {/* 4 Admin Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        
        {/* Card 1: TOTAL ADMIN ACTIONS */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1.5px solid #A7F3D0', borderLeft: '4px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              TOTAL ADMIN ACTIONS
            </span>
            <ShieldCheck size={18} style={{ color: '#059669' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', fontFamily: 'var(--font-title)', marginTop: '4px' }}>
            86
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px' }}>
            Recorded administrative operations
          </div>
        </div>

        {/* Card 2: SECURITY & LOGINS */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1.5px solid #BFDBFE', borderLeft: '4px solid #2563EB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              SECURITY &amp; LOGINS
            </span>
            <Key size={18} style={{ color: '#2563EB' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', fontFamily: 'var(--font-title)', marginTop: '4px' }}>
            24
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px' }}>
            Admin logins &amp; permission grants
          </div>
        </div>

        {/* Card 3: PRICING & CATALOG EDITS */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1.5px solid #FDE68A', borderLeft: '4px solid #D97706' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              PRICING &amp; CATALOG EDITS
            </span>
            <Settings size={18} style={{ color: '#D97706' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', fontFamily: 'var(--font-title)', marginTop: '4px' }}>
            18
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px' }}>
            Product price &amp; plan overrides
          </div>
        </div>

        {/* Card 4: FINANCIAL & REFUND LOGS */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1.5px solid #DDD6FE', borderLeft: '4px solid #7C3AED' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#5B21B6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              FINANCIAL &amp; REFUNDS
            </span>
            <FileText size={18} style={{ color: '#7C3AED' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', fontFamily: 'var(--font-title)', marginTop: '4px' }}>
            14
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px' }}>
            Wallet refunds &amp; report exports
          </div>
        </div>

      </div>

      {/* Filter and Date Bar Toolbar */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Top Controls Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          {/* Admin User Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={16} style={{ color: '#047857' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#111827' }}>Filter Admin User:</span>
            <select
              value={activeAdminFilter}
              onChange={(e) => setActiveAdminFilter(e.target.value)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                backgroundColor: '#F9FAFB',
                color: '#111827',
                fontSize: '0.82rem',
                fontWeight: 600,
                outline: 'none'
              }}
            >
              <option value="all">All Admin Users</option>
              <option value="tomadmin@gmail.com">Tom SuperAdmin (Super Admin)</option>
              <option value="rajesh.admin@milkylush.com">Rajesh Ops (Hub Manager)</option>
              <option value="priya.ops@milkylush.com">Priya Finance (Finance Admin)</option>
              <option value="suresh.inventory@milkylush.com">Suresh Stock (Inventory Lead)</option>
            </select>
          </div>

          {/* Search Box & Export CSV */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input 
                type="text"
                placeholder="Search admin, action, or IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem 0.45rem 30px',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#F9FAFB',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />
            </div>

            <button
              onClick={() => showToast('Exported admin activity audit logs to CSV', 'info')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#047857',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

        </div>

        {/* Category Pills Row */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', marginRight: '4px' }}>
            Category:
          </span>
          {[
            { id: 'all', label: 'All Categories' },
            { id: 'Security & Login', label: 'Security & Logins' },
            { id: 'Catalog & Pricing', label: 'Catalog & Pricing' },
            { id: 'Hub Operations', label: 'Hub Operations' },
            { id: 'Financials & Refunds', label: 'Financials & Refunds' },
            { id: 'User Roles', label: 'User & Admin Roles' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryFilter(cat.id)}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeCategoryFilter === cat.id ? '#047857' : '#F3F4F6',
                color: activeCategoryFilter === cat.id ? '#FFFFFF' : '#374151',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

      </div>

      {/* Main Admin Audit Logs Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', textTransform: 'uppercase', fontSize: '0.7rem', color: '#6B7280' }}>
                <th style={{ padding: '0.85rem 1rem' }}>TIMESTAMP</th>
                <th style={{ padding: '0.85rem 1rem' }}>ADMIN OPERATOR</th>
                <th style={{ padding: '0.85rem 1rem' }}>CATEGORY</th>
                <th style={{ padding: '0.85rem 1rem' }}>ACTION DETAILS</th>
                <th style={{ padding: '0.85rem 1rem' }}>TARGET MODULE</th>
                <th style={{ padding: '0.85rem 1rem' }}>IP &amp; SESSION</th>
                <th style={{ padding: '0.85rem 1rem' }}>PAYLOAD</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  
                  {/* TIMESTAMP Column */}
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>
                    {log.timestamp}
                  </td>
                  
                  {/* ADMIN OPERATOR Column */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 800, color: '#111827', fontSize: '0.85rem' }}>{log.adminName}</span>
                      <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>{log.adminEmail}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#047857', backgroundColor: '#ECFDF5', padding: '1px 6px', borderRadius: '6px', width: 'fit-content', marginTop: '3px' }}>
                        {log.adminRole}
                      </span>
                    </div>
                  </td>

                  {/* CATEGORY Column */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: log.category === 'Security & Login' ? '#2563EB' : log.category === 'Catalog & Pricing' ? '#D97706' : log.category === 'Financials & Refunds' ? '#7C3AED' : '#059669',
                      backgroundColor: log.category === 'Security & Login' ? '#EFF6FF' : log.category === 'Catalog & Pricing' ? '#FEF3C7' : log.category === 'Financials & Refunds' ? '#F3E8FF' : '#ECFDF5',
                      padding: '3px 10px',
                      borderRadius: '10px',
                      whiteSpace: 'nowrap'
                    }}>
                      {log.category}
                    </span>
                  </td>

                  {/* ACTION DETAILS Column */}
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: '#111827', fontWeight: 600, maxWidth: '320px' }}>
                    {log.actionSummary}
                  </td>

                  {/* TARGET MODULE Column */}
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#4B5563', fontSize: '0.8rem' }}>
                    {log.targetEntity}
                  </td>

                  {/* IP & SESSION Column */}
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', color: '#6B7280' }}>
                    <div style={{ fontWeight: 700, color: '#374151' }}>{log.ipAddress}</div>
                    <div style={{ fontSize: '0.72rem' }}>{log.deviceSession}</div>
                  </td>

                  {/* PAYLOAD Column */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <button
                      onClick={() => setSelectedPayloadLog(log)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid #D1D5DB',
                        backgroundColor: '#FFFFFF',
                        color: '#111827',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {'{ }'} Inspect JSON
                    </button>
                  </td>

                </tr>
              ))}
              {paginatedLogs.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#9CA3AF' }}>
                    No admin audit logs match your search filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Standardized Pagination Footer */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Showing {filteredLogs.length > 0 ? (currentPage - 1) * (pageSize === 9999 ? filteredLogs.length : pageSize) + 1 : 0} to {Math.min(currentPage * (pageSize === 9999 ? filteredLogs.length : pageSize), filteredLogs.length)} of {filteredLogs.length} entries
            </span>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
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
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-main)',
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
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-main)',
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

      {/* JSON Payload Inspection Modal */}
      {selectedPayloadLog && (
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
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '1.75rem',
            maxWidth: '520px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'left'
          }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.25rem', color: '#111827' }}>
              Audit Log Payload: {selectedPayloadLog.id}
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#6B7280', marginBottom: '1rem' }}>
              Executed by {selectedPayloadLog.adminName} ({selectedPayloadLog.adminEmail}) on {selectedPayloadLog.timestamp}.
            </p>

            <pre style={{
              backgroundColor: '#1E293B',
              color: '#38BDF8',
              padding: '1rem',
              borderRadius: '12px',
              fontSize: '0.82rem',
              fontFamily: 'monospace',
              overflowX: 'auto',
              maxHeight: '260px'
            }}>
              {selectedPayloadLog.payloadJson || '{\n  "status": "No additional payload parameter"\n}'}
            </pre>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button 
                onClick={() => setSelectedPayloadLog(null)}
                style={{
                  padding: '0.6rem 1.25rem',
                  borderRadius: '10px',
                  backgroundColor: '#047857',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
