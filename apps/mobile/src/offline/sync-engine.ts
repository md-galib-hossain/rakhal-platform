import { NetworkError } from '@rakhal/api-client';
import { backoffDelayMs } from './backoff.ts';
import { claimDatabase, clearLocalData } from './owner.ts';
import { createOutbox, type EnqueueInput, type OutboxCounts, type OutboxRow } from './outbox.ts';
import { buildPullSpecs, lastPulledAt, pullEntity, type ApiGetter } from './pull.ts';
import { sendRow, type ApiRequester } from './sender.ts';
import type { SqlDb } from './sql-db.ts';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'paused';

export interface SyncSnapshot extends OutboxCounts {
  state: SyncState;
  /** When the working set was last pulled successfully (device clock). */
  lastSyncedAt: number | null;
  lastError: string | null;
  /** When the next automatic retry fires, if one is scheduled. */
  nextRetryAt: number | null;
}

export interface SyncSession {
  userId: string;
  farmId: string;
}

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export type EngineApi = ApiRequester & ApiGetter;

export interface EngineDeps {
  db: SqlDb;
  api: EngineApi;
  session: SyncSession;
  /** One short request to the server's health route; true when it answered. */
  probe: () => Promise<boolean>;
  /** The phone's own connectivity flag; `false` skips the probe entirely. `null` = unknown. */
  networkHint?: () => boolean | null;
  newId: () => string;
  now?: () => number;
  random?: () => number;
  timers?: Timers;
  /** Minimum gap between automatic pulls (default 5 min). A forced kick ignores it. */
  pullIntervalMs?: number;
  /** How long to wait before re-probing after finding the device offline (default 30 s). */
  offlineRecheckMs?: number;
}

const defaultTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * The sync loop for one signed-in user and farm (ADR-006 section 5): push the queue in order, one request at a time,
 * then pull the working set. Single-flight: overlapping `kick()`s collapse into one more pass. Stops at the first
 * network-level failure so order is kept and a dead connection is not hammered.
 */
export function createSyncEngine(deps: EngineDeps) {
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;
  const timers = deps.timers ?? defaultTimers;
  const pullIntervalMs = deps.pullIntervalMs ?? 5 * 60_000;
  const offlineRecheckMs = deps.offlineRecheckMs ?? 30_000;
  const { userId, farmId } = deps.session;
  const outbox = createOutbox(deps.db, { newId: deps.newId, now });

  let state: SyncState = 'idle';
  let lastError: string | null = null;
  let lastSyncedAt: number | null = null;
  let lastPullAt: number | null = null;
  let nextRetryAt: number | null = null;
  let counts: OutboxCounts = { waiting: 0, failed: 0, conflict: 0 };
  let timer: unknown = null;
  let stopped = false;
  let running: Promise<void> | null = null;
  let rerun = false;
  let forcePull = false;
  let recovered = false;

  const listeners = new Set<() => void>();
  const build = (): SyncSnapshot => ({ ...counts, state, lastSyncedAt, lastError, nextRetryAt });
  let snapshot = build();

  async function publish(): Promise<void> {
    counts = await outbox.counts({ userId });
    snapshot = build();
    listeners.forEach((l) => l());
  }

  function clearTimer(): void {
    if (timer !== null) timers.clear(timer);
    timer = null;
    nextRetryAt = null;
  }

  function scheduleKick(ms: number): void {
    clearTimer();
    if (stopped) return;
    nextRetryAt = now() + ms;
    timer = timers.set(() => {
      timer = null;
      nextRetryAt = null;
      void kick();
    }, ms);
  }

  async function online(): Promise<boolean> {
    if (deps.networkHint?.() === false) return false;
    return deps.probe();
  }

  /** Push the queue. Returns false when it stopped early (offline, backing off, session gone). */
  async function drain(): Promise<boolean> {
    for (;;) {
      if (stopped) return false;
      const next = await outbox.nextForSending({ userId, farmId, now: now() });
      if (!next.row) {
        if (next.waitMs !== null) scheduleKick(next.waitMs);
        return next.waitMs === null;
      }
      const row: OutboxRow = next.row;
      if (!(await outbox.beginSending(row.localId))) continue;
      await publish();
      const outcome = await sendRow(deps.api, row);
      switch (outcome.kind) {
        case 'done':
          await outbox.complete(row.localId, outcome.result);
          break;
        case 'conflict':
          await outbox.markConflict(row.localId, outcome.conflict, outcome.result);
          break;
        case 'failed':
          await outbox.fail(row.localId, outcome.error);
          break;
        case 'paused':
          await outbox.retryLater(row.localId, outcome.error, null);
          state = 'paused';
          lastError = outcome.error;
          await publish();
          return false;
        case 'retry': {
          const delay = backoffDelayMs(row.attempts + 1, random);
          await outbox.retryLater(row.localId, outcome.error, now() + delay);
          lastError = outcome.reason === 'network' ? null : outcome.error;
          state = outcome.reason === 'network' ? 'offline' : 'idle';
          scheduleKick(delay);
          await publish();
          return false;
        }
      }
      await publish();
    }
  }

  /** Pull the working set for the active farm. 'offline' = a request failed at the network level. */
  async function pullAll(): Promise<'ok' | 'partial' | 'offline'> {
    let partial = false;
    for (const spec of buildPullSpecs(now())) {
      try {
        await pullEntity(deps.api, deps.db, farmId, spec, now());
      } catch (error) {
        if (error instanceof NetworkError) return 'offline';
        partial = true;
        lastError = error instanceof Error ? error.message : 'Could not refresh';
      }
    }
    return partial ? 'partial' : 'ok';
  }

  async function runOnce(): Promise<void> {
    state = 'syncing';
    await publish();
    if (!recovered) {
      await outbox.recoverInterrupted();
      recovered = true;
    }
    if (!(await online())) {
      state = 'offline';
      scheduleKick(offlineRecheckMs);
      await publish();
      return;
    }
    clearTimer();
    lastError = null;
    const drained = await drain();
    if (!drained) {
      if (state === 'syncing') state = 'idle';
      await publish();
      return;
    }
    const due = forcePull || lastPullAt === null || now() - lastPullAt >= pullIntervalMs;
    forcePull = false;
    if (due) {
      const pulled = await pullAll();
      if (pulled === 'offline') {
        state = 'offline';
        scheduleKick(offlineRecheckMs);
        await publish();
        return;
      }
      lastPullAt = now();
      if (pulled === 'ok') lastSyncedAt = lastPullAt;
    }
    await outbox.purgeDone();
    state = 'idle';
    await publish();
  }

  function kick(options: { pull?: boolean } = {}): Promise<void> {
    if (stopped) return Promise.resolve();
    if (options.pull) forcePull = true;
    if (running) {
      rerun = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          rerun = false;
          await runOnce();
        } while (rerun && !stopped);
      } catch (error) {
        // A bug or a database error must not leave the loop wedged "syncing" with no way back.
        state = 'idle';
        lastError = error instanceof Error ? error.message : 'Sync failed';
        await publish().catch(() => undefined);
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return {
    /** Claim the database for this user (wiping a previous user's data), then run the first pass. */
    async start(): Promise<void> {
      await claimDatabase(deps.db, userId);
      lastSyncedAt = await lastPulledAt(deps.db, farmId);
      await publish();
      await kick({ pull: true });
    },

    stop(): void {
      stopped = true;
      clearTimer();
    },

    kick,

    async enqueue(input: Omit<EnqueueInput, 'farmId' | 'userId'>): Promise<OutboxRow> {
      const row = await outbox.enqueue({ ...input, farmId, userId });
      await publish();
      void kick();
      return row;
    },

    list: (statuses?: readonly OutboxRow['status'][]) => outbox.list({ userId, statuses }),

    async retry(localId: string): Promise<void> {
      await outbox.retryNow(localId);
      await publish();
      void kick();
    },

    async discard(localId: string): Promise<void> {
      await outbox.discard(localId);
      await publish();
      void kick();
    },

    async keepServerVersion(localId: string): Promise<void> {
      await outbox.resolveConflict(localId, 'kept-server');
      await publish();
      void kick();
    },

    async useMine(localId: string): Promise<OutboxRow | null> {
      const created = await outbox.resolveUseMine(localId, deps.newId());
      await publish();
      void kick();
      return created;
    },

    /** Sign-out with the user's confirmation: drop the queue and the cache. */
    async clearAll(): Promise<void> {
      clearTimer();
      await clearLocalData(deps.db);
      lastSyncedAt = null;
      await publish();
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot: (): SyncSnapshot => snapshot,
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
