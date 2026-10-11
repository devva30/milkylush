// Loading hooks every page uses, so each page reads only what it shows and always
// knows whether it is loading, loaded, empty or failed.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDoc, getDocs, onSnapshot, query, limit as limitTo, startAfter,
  type DocumentReference, type Query, type QueryDocumentSnapshot,
} from 'firebase/firestore';

export interface Loadable<T> {
  data: T;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export type WithId<T> = T & { id: string };

function message(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === 'permission-denied') return 'You do not have access to this data for the selected hub.';
  if (code === 'failed-precondition') return 'This list needs a database index that is still building. Try again in a few minutes.';
  if (code === 'unavailable') return 'No connection to the database. Check the internet and retry.';
  return (err as Error)?.message || 'Something went wrong while loading.';
}

/**
 * Live list for a query (re-renders when documents change). Pass null to skip.
 * Use for small, changing lists: today's deliveries, riders, settings.
 */
export function useLiveQuery<T>(q: Query | null, deps: unknown[]): Loadable<WithId<T>[]> {
  const [state, setState] = useState<{ data: WithId<T>[]; loading: boolean; error: string | null }>({
    data: [], loading: !!q, error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!q) { setState({ data: [], loading: false, error: null }); return; }
    setState((s) => ({ ...s, loading: true, error: null }));
    return onSnapshot(
      q,
      (snap) => setState({ data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })), loading: false, error: null }),
      (err) => setState({ data: [], loading: false, error: message(err) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}

/** Live single document (settings, hub, counters). */
export function useLiveDoc<T>(ref: DocumentReference | null, deps: unknown[]): Loadable<WithId<T> | null> {
  const [state, setState] = useState<{ data: WithId<T> | null; loading: boolean; error: string | null }>({
    data: null, loading: !!ref, error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ref) { setState({ data: null, loading: false, error: null }); return; }
    setState((s) => ({ ...s, loading: true, error: null }));
    return onSnapshot(
      ref,
      (snap) => setState({ data: snap.exists() ? { id: snap.id, ...(snap.data() as T) } : null, loading: false, error: null }),
      (err) => setState({ data: null, loading: false, error: message(err) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}

/** One-off read of a single document. */
export async function fetchDoc<T>(ref: DocumentReference): Promise<WithId<T> | null> {
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...(snap.data() as T) } : null;
}

export interface Paged<T> extends Loadable<WithId<T>[]> {
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}

/**
 * Paginated one-off list (history pages, customers, orders). Loads `pageSize`
 * rows, then more on loadMore(). `q` must include its orderBy.
 */
export function usePagedQuery<T>(q: Query | null, deps: unknown[], pageSize = 50): Paged<T> {
  const [rows, setRows] = useState<WithId<T>[]>([]);
  const [loading, setLoading] = useState(!!q);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const cursor = useRef<QueryDocumentSnapshot | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const gen = ++generation.current;
    cursor.current = null;
    setRows([]);
    setHasMore(false);
    if (!q) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    getDocs(query(q, limitTo(pageSize)))
      .then((snap) => {
        if (gen !== generation.current) return; // filters changed while loading
        cursor.current = snap.docs[snap.docs.length - 1] ?? null;
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
        setHasMore(snap.docs.length === pageSize);
      })
      .catch((err) => gen === generation.current && setError(message(err)))
      .finally(() => gen === generation.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt, pageSize]);

  const loadMore = useCallback(() => {
    if (!q || !cursor.current || loadingMore) return;
    const gen = generation.current;
    setLoadingMore(true);
    getDocs(query(q, startAfter(cursor.current), limitTo(pageSize)))
      .then((snap) => {
        if (gen !== generation.current) return;
        cursor.current = snap.docs[snap.docs.length - 1] ?? cursor.current;
        setRows((prev) => [...prev, ...snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))]);
        setHasMore(snap.docs.length === pageSize);
      })
      .catch((err) => setError(message(err)))
      .finally(() => setLoadingMore(false));
  }, [q, loadingMore, pageSize]);

  return { data: rows, loading, loadingMore, error, hasMore, loadMore, retry: () => setAttempt((a) => a + 1) };
}
