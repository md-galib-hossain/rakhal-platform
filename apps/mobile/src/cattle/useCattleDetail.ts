/**
 * One animal's detail & workspace (WP9 & Animal Workspace).
 * Cached row displays immediately; live profile + overview + tab data replace it once loaded.
 * Resilient to individual endpoint failures (e.g. finance permission required or non-female animal).
 */
import { ApiError, NetworkError } from '@rakhal/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useSync } from '../offline/SyncProvider.tsx';
import { toCattleItem } from './cattle-model.ts';
import {
  fromCacheItem,
  parseFeedRequirement,
  parseFinance,
  parseHealthSummary,
  parseOverview,
  parsePedigree,
  parseProfile,
  parseReproductionSummary,
  parseTimelineEvents,
  parseUpcomingEvents,
  type CattleDetail,
} from './cattle-detail-model.ts';

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
      const encId = encodeURIComponent(id);
      const [profileRes, detailRes, overviewRes] = await Promise.allSettled([
        client.get<unknown>(`/cattle/${encId}/profile`),
        client.get<unknown>(`/cattle/${encId}`),
        client.get<unknown>(`/cattle/${encId}/overview`),
      ]);
      if (cancelled) return;

      if (profileRes.status === 'fulfilled') {
        const parsed = parseProfile(profileRes.value.data, now);
        if (parsed) {
          live.current = true;
          const overview = overviewRes.status === 'fulfilled' ? parseOverview(overviewRes.value.data) : null;
          const rawDetail =
            detailRes.status === 'fulfilled' &&
            typeof detailRes.value.data === 'object' &&
            detailRes.value.data !== null &&
            !Array.isArray(detailRes.value.data)
              ? (detailRes.value.data as Record<string, unknown>)
              : null;
          const liveLactation =
            rawDetail && typeof rawDetail.lactationStage === 'string' ? rawDetail.lactationStage : parsed.lactationStage;
          const liveRepro =
            rawDetail && typeof rawDetail.reproductiveStatus === 'string'
              ? rawDetail.reproductiveStatus
              : parsed.reproductiveStatus;

          let detail: CattleDetail = {
            ...parsed,
            lactationStage: liveLactation ?? parsed.lactationStage,
            reproductiveStatus: liveRepro ?? parsed.reproductiveStatus,
            overview,
            avgDailyYield7d: overview?.avg_daily_yield_7d ?? parsed.avgDailyYield7d,
            lastWeightKg: overview?.last_weight_kg ?? parsed.lastWeightKg,
            aqrScore: overview?.aqr_score ?? parsed.aqrScore,
          };

          // Render preliminary ready state with profile + overview
          setState({ phase: 'ready', detail, source: 'online', notice: null });

          // In parallel, load secondary workspace tab queries
          const isFemale = parsed.gender === 'FEMALE';
          const [reproRes, healthRes, pedigreeRes, financeRes, eventsRes, upcomingRes, feedRes] =
            await Promise.allSettled([
              isFemale ? client.get<unknown>(`/cattle/${encId}/reproduction-summary`) : Promise.resolve(null),
              client.get<unknown>(`/cattle/${encId}/health-summary`),
              client.get<unknown>(`/cattle/${encId}/pedigree`),
              client.get<unknown>(`/cattle/${encId}/finance`),
              client.get<unknown>(`/cattle/${encId}/events?limit=30`),
              client.get<unknown>(`/cattle/${encId}/upcoming-events?limit=10`),
              client.get<unknown>(`/feed/cattle/${encId}/requirement-override`),
            ]);

          if (cancelled) return;

          const reproduction =
            reproRes.status === 'fulfilled' && reproRes.value ? parseReproductionSummary(reproRes.value.data) : null;
          const health = healthRes.status === 'fulfilled' ? parseHealthSummary(healthRes.value.data) : null;
          const pedigree = pedigreeRes.status === 'fulfilled' ? parsePedigree(pedigreeRes.value.data) : null;
          const finance = financeRes.status === 'fulfilled' ? parseFinance(financeRes.value.data) : null;
          const timelineEvents = eventsRes.status === 'fulfilled' ? parseTimelineEvents(eventsRes.value.data) : [];
          const upcomingEvents = upcomingRes.status === 'fulfilled' ? parseUpcomingEvents(upcomingRes.value.data) : [];
          const feedRequirement = feedRes.status === 'fulfilled' ? parseFeedRequirement(feedRes.value.data) : null;

          const hasMilkHold =
            Boolean(health?.safetyWithdrawalWarning) ||
            Boolean(health?.activeWithdrawals?.some((w) => w.kind === 'milk'));

          detail = {
            ...detail,
            dim: reproduction?.dim ?? detail.dim,
            hasMilkHold,
            reproduction,
            health,
            pedigree,
            finance,
            timelineEvents,
            upcomingEvents,
            feedRequirement,
          };

          setState({ phase: 'ready', detail, source: 'online', notice: null });
          return;
        }
      } else if (profileRes.reason instanceof ApiError && profileRes.reason.status === 404) {
        live.current = true;
        setState({ phase: 'notFound' });
        return;
      }

      const offline = profileRes.status === 'rejected' && profileRes.reason instanceof NetworkError;
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
