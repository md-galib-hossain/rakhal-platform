/**
 * One animal's detail (WP9, read only): the cached row shows at once, the live `/profile` + `/overview` replace it when
 * they arrive. If the live request fails the cached row stays with a notice ("offline" for a network failure, "could not
 * load the latest" otherwise). A 404 means the animal is gone from the farm: not found, even if an old row is cached.
 *
 * `/overview` is optional: if only it fails the profile is still shown (milk and weight numbers are just left out).
 */
import { ApiError, NetworkError } from '@rakhal/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useSync } from '../offline/SyncProvider.tsx';
import { toCattleItem } from './cattle-model.ts';
import { fromCacheItem, parseProfile, withOverview, type CattleDetail } from './cattle-detail-model.ts';

export type CattleDetailState =
  | { phase: 'loading' }
  | { phase: 'notFound' }
  | { phase: 'error' }
  | {
      phase: 'ready';
      detail: CattleDetail;
      source: 'online' | 'cache';
      /** Why the cached row is shown instead of live data; null when live. */
      notice: 'offline' | 'failed' | null;
    };

export interface UseCattleDetailResult {
  state: CattleDetailState;
  /** When the offline cache was last filled (for the "last updated" note). */
  lastSyncedAt: number | null;
  reload(): void;
}

export function useCattleDetail(id: string): UseCattleDetailResult {
  const { client } = useAuth();
  const sync = useSync();
  const readRow = useRef(sync.readCacheRow);
  readRow.current = sync.readCacheRow;
  const ready = sync.ready;

  const [state, setState] = useState<CattleDetailState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const cached = useRef<CattleDetail | null>(null);
  const live = useRef(false);
  const failure = useRef<'offline' | 'failed' | null>(null);

  // Cache: shown at once (no spinner on a known animal), unless live data already arrived.
  useEffect(() => {
    if (!ready) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const row = await readRow.current('cattle', id);
        const item = row ? toCattleItem(row) : null;
        cached.current = item ? fromCacheItem(item, Date.now()) : null;
      } catch {
        cached.current = null;
      }
      if (cancelled || live.current || !cached.current) return;
      setState((prev) =>
        prev.phase === 'loading' || prev.phase === 'error'
          ? { phase: 'ready', detail: cached.current!, source: 'cache', notice: failure.current }
          : prev,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [id, ready]);

  // Live: independent of the cache, so the database opening late never repeats the requests.
  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    live.current = false;
    failure.current = null;
    if (!id) {
      setState({ phase: 'notFound' });
      return undefined;
    }
    setState((prev) => (prev.phase === 'ready' ? prev : { phase: 'loading' }));

    void (async () => {
      const [profile, overview] = await Promise.allSettled([
        client.get<unknown>(`/cattle/${encodeURIComponent(id)}/profile`),
        client.get<unknown>(`/cattle/${encodeURIComponent(id)}/overview`),
      ]);
      if (cancelled) return;

      if (profile.status === 'fulfilled') {
        const parsed = parseProfile(profile.value.data, now);
        if (parsed) {
          live.current = true;
          const detail = overview.status === 'fulfilled' ? withOverview(parsed, overview.value.data) : parsed;
          setState({ phase: 'ready', detail, source: 'online', notice: null });
          return;
        }
      } else if (profile.reason instanceof ApiError && profile.reason.status === 404) {
        live.current = true;
        setState({ phase: 'notFound' });
        return;
      }

      const offline = profile.status === 'rejected' && profile.reason instanceof NetworkError;
      const notice = offline ? 'offline' : 'failed';
      failure.current = notice; // a cache read that finishes later picks this up
      setState((prev) => {
        if (cached.current) return { phase: 'ready', detail: cached.current, source: 'cache', notice };
        if (prev.phase === 'ready') return { ...prev, notice };
        return { phase: 'error' };
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [client, id, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, lastSyncedAt: sync.snapshot.lastSyncedAt, reload };
}
