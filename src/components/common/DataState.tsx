// Shared loading / error / empty states, styled with the existing theme variables.
// Every page wraps its data area in <DataState> so the user always sees one of:
// a loader, the data, "nothing found", or an error with Retry.

import type { ReactNode } from 'react';
import { Loader2, AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

const spinKeyframes = `@keyframes ml-spin { to { transform: rotate(360deg); } }`;

export function Spinner({ size = 28 }: { size?: number }) {
  return (
    <>
      <style>{spinKeyframes}</style>
      <Loader2 size={size} color="var(--primary-light)" style={{ animation: 'ml-spin 0.8s linear infinite' }} />
    </>
  );
}

const boxStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: '0.75rem', padding: '3rem 1rem', color: 'var(--text-muted)', textAlign: 'center',
  fontFamily: 'var(--font-body)', fontSize: '0.875rem',
};

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={{ ...boxStyle, minHeight: '40vh' }} role="status" aria-live="polite">
      <Spinner size={34} />
      <span style={{ fontWeight: 600 }}>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={boxStyle} role="alert">
      <AlertTriangle size={30} color="var(--danger)" />
      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Couldn't load this data</span>
      <span>{message}</span>
      {onRetry && (
        <button className="btn-secondary" onClick={onRetry}>
          <RefreshCw size={16} /> Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message = 'Nothing to show for this filter.' }: { message?: string }) {
  return (
    <div style={boxStyle}>
      <Inbox size={30} />
      <span>{message}</span>
    </div>
  );
}

interface DataStateProps {
  loading: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  loadingLabel?: string;
  onRetry?: () => void;
  children: ReactNode;
}

/** Shows loader → error → empty → children, in that order of priority. */
export function DataState({ loading, error, empty, emptyMessage, loadingLabel, onRetry, children }: DataStateProps) {
  if (loading) return <PageLoader label={loadingLabel} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (empty) return <EmptyState message={emptyMessage} />;
  return <>{children}</>;
}

/** "Load more" footer for paginated tables. */
export function LoadMore({ hasMore, loading, onClick }: { hasMore: boolean; loading: boolean; onClick: () => void }) {
  if (!hasMore) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
      <button className="btn-secondary" onClick={onClick} disabled={loading}>
        {loading ? <Spinner size={16} /> : null} {loading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}
