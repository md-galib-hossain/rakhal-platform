/**
 * Cattle list over the offline cache (WP9). Reads `useSync().readCache('cattle', { search })`, so the list works with
 * no network: the pull fills the cache, this hook only reads it. Reusable: the WP10 milk-log cow picker uses the same
 * hook (and the `CattleList` component on top of it).
 *
 * - `search` is matched by SQLite (`LIKE` over lower-cased tag + name), not by filtering in JS.
 * - A read that is overtaken by a newer one (fast typing) is dropped, so a slow old query can never overwrite a newer result.
 * - The list re-reads when a pull finishes (`snapshot.lastSyncedAt` changes), so a sync that lands while the screen is
 *   open shows up without a manual refresh.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSync } from '../offline/SyncProvider.tsx';
import type { SyncState } from '../offline/sync-engine.ts';
import { toCattleItems, type CattleListItem } from './cattle-model.ts';

/** The most rows one list shows (the demo farm has about 4 000 animals; real farms are in the hundreds, ADR-006). */
export const CATTLE_LIST_LIMIT = 5000;

export type CattleListStatus = 'loading' | 'ready' | 'error';

export interface CattleListResult {
  items: CattleListItem[];
  status: CattleListStatus;
  /** True once a pull has ever finished on this phone. False + empty list = "not downloaded yet", not "no animals". */
  hasSynced: boolean;
  lastSyncedAt: number | null;
  syncState: SyncState;
  /** Read again from the cache (retry after an error). */
  reload(): void;
}

export interface UseCattleListOptions {
  search?: string;
  limit?: number;
}

export function useCattleList({ search = '', limit = CATTLE_LIST_LIMIT }: UseCattleListOptions = {}): CattleListResult {
  const sync = useSync();
  const { ready, snapshot } = sync;
  // The context value changes on every snapshot tick; keep the latest reader in a ref so only real inputs re-run the read.
  const reader = useRef(sync.readCache);
  reader.current = sync.readCache;

  const [items, setItems] = useState<CattleListItem[]>([]);
  const [status, setStatus] = useState<CattleListStatus>('loading');
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);
  const lastSyncedAt = snapshot.lastSyncedAt;

  useEffect(() => {
    if (!ready) {
      setStatus('loading');
      return undefined;
    }
    const run = (latest.current += 1);
    reader
      .current('cattle', { search, limit })
      .then((rows) => {
        if (run !== latest.current) return;
        setItems(toCattleItems(rows));
        setStatus('ready');
      })
      .catch(() => {
        if (run !== latest.current) return;
        setStatus('error');
      });
    return () => {
      // A newer effect run (or unmount) makes this read stale.
      latest.current += 1;
    };
  }, [ready, search, limit, lastSyncedAt, attempt]);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  return {
    items,
    status,
    hasSynced: lastSyncedAt !== null,
    lastSyncedAt,
    syncState: snapshot.state,
    reload,
  };
}
