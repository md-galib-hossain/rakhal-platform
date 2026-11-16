/**
 * Offline sync for the signed-in user and farm (WP8b, ADR-006): opens the on-device database, runs the sync engine
 * (push the queue, pull the working set), and exposes the pill numbers and the queue actions to the UI.
 *
 * Outside a signed-in session `useSync()` returns an inert value (`ready: false`), so screens and tests that render
 * without this provider keep working.
 */
import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider.tsx';
import { currentApiBaseUrl } from '../config/runtime-api-url.ts';
import { healthUrl, probeHealth } from './connectivity.ts';
import { openExpoSqliteDb } from './expo-sqlite-db.ts';
import { migrate } from './migrations.ts';
import { readOwner } from './owner.ts';
import type { EnqueueInput, OutboxRow } from './outbox.ts';
import { readCache, readCacheRow, readSessionConfig, type CacheEntity } from './pull.ts';
import type { SqlDb } from './sql-db.ts';
import { createSyncEngine, type SyncEngine, type SyncSnapshot } from './sync-engine.ts';

export const IDLE_SNAPSHOT: SyncSnapshot = {
  state: 'idle',
  waiting: 0,
  failed: 0,
  conflict: 0,
  lastSyncedAt: null,
  lastError: null,
  nextRetryAt: null,
};

export interface SyncContextValue {
  /** False until the database is open and the engine has started (and always outside a signed-in session). */
  ready: boolean;
  snapshot: SyncSnapshot;
  /** Queue a write for this user and farm; the pass that sends it starts at once. Rejects with OutboxFullError when full. */
  enqueue(input: Omit<EnqueueInput, 'farmId' | 'userId'>): Promise<OutboxRow>;
  syncNow(): Promise<void>;
  list(): Promise<OutboxRow[]>;
  retry(localId: string): Promise<void>;
  discard(localId: string): Promise<void>;
  keepServerVersion(localId: string): Promise<void>;
  useMine(localId: string): Promise<OutboxRow | null>;
  /** Drop the queue and the offline cache (sign-out). */
  clearAll(): Promise<void>;
  /** Read the offline cache of the active farm (cattle, sheds, milk tanks, tasks). */
  readCache(entity: CacheEntity, options?: { search?: string; limit?: number }): Promise<Record<string, unknown>[]>;
  /** One cached row by id, or null when it is not on this phone. */
  readCacheRow(entity: CacheEntity, id: string): Promise<Record<string, unknown> | null>;
  /** Read the farm's session configuration stored in meta, or null when not present. */
  readSessionConfig(): Promise<Record<string, unknown> | null>;
}

const INERT: SyncContextValue = {
  ready: false,
  snapshot: IDLE_SNAPSHOT,
  enqueue: () => Promise.reject(new Error('Offline sync is not running')),
  syncNow: () => Promise.resolve(),
  list: () => Promise.resolve([]),
  retry: () => Promise.resolve(),
  discard: () => Promise.resolve(),
  keepServerVersion: () => Promise.resolve(),
  useMine: () => Promise.resolve(null),
  clearAll: () => Promise.resolve(),
  readCache: () => Promise.resolve([]),
  readCacheRow: () => Promise.resolve(null),
  readSessionConfig: () => Promise.resolve(null),
};

const SyncContext = createContext<SyncContextValue>(INERT);

export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}

/** The phone's own connectivity flag. Only a definite `false` is trusted (reachability is the health probe's job). */
export type SubscribeNetwork = (onChange: (connected: boolean | null) => void) => () => void;

const subscribeNetInfo: SubscribeNetwork = (onChange) =>
  NetInfo.addEventListener((state) => onChange(state.isConnected));

export interface SyncProviderProps {
  children: ReactNode;
  /** Tests inject an in-memory database; the app opens `rakhal-offline.db`. */
  openDb?: () => Promise<SqlDb>;
  subscribeNetwork?: SubscribeNetwork;
  /** Tests inject a fake reachability check; the app asks the API's health route. */
  probe?: () => Promise<boolean>;
  newId?: () => string;
}

function defaultNewId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function SyncProvider({
  children,
  openDb = () => openExpoSqliteDb(),
  subscribeNetwork = subscribeNetInfo,
  probe = () => probeHealth(healthUrl(currentApiBaseUrl())),
  newId = defaultNewId,
}: SyncProviderProps) {
  const { status, user, farmId, client } = useAuth();
  const userId = user?.id ?? null;
  const [engine, setEngine] = useState<SyncEngine | null>(null);
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(IDLE_SNAPSHOT);
  const [db, setDb] = useState<SqlDb | null>(null);
  const dbPromise = useRef<Promise<SqlDb> | null>(null);
  const network = useRef<boolean | null>(null);

  // Keep the latest injected functions without restarting the engine when a parent re-renders with new closures.
  const injected = useRef({ openDb, subscribeNetwork, probe, newId });
  injected.current = { openDb, subscribeNetwork, probe, newId };

  useEffect(() => {
    if (status !== 'signedIn' || !farmId) {
      setEngine(null);
      setSnapshot(IDLE_SNAPSHOT);
      return undefined;
    }
    let cancelled = false;
    let started: SyncEngine | null = null;
    let unsubscribeEngine: () => void = () => undefined;
    let unsubscribeNetwork: () => void = () => undefined;
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void started?.kick();
    });

    void (async () => {
      try {
        dbPromise.current ??= injected.current.openDb().then(async (opened) => {
          await migrate(opened);
          return opened;
        });
        const opened = await dbPromise.current;
        if (cancelled) return;
        // Offline cold start: the profile has not loaded, so the user is the one who owns this database.
        const owner = userId ?? (await readOwner(opened));
        if (cancelled || !owner) return;
        const created = createSyncEngine({
          db: opened,
          api: client,
          session: { userId: owner, farmId },
          probe: () => injected.current.probe(),
          networkHint: () => network.current,
          newId: () => injected.current.newId(),
        });
        started = created;
        unsubscribeEngine = created.subscribe(() => setSnapshot(created.getSnapshot()));
        unsubscribeNetwork = injected.current.subscribeNetwork((connected) => {
          network.current = connected;
          if (connected !== false) void created.kick();
        });
        setDb(opened);
        setEngine(created);
        await created.start();
      } catch (error) {
        // A database that cannot be opened must never take the app down: online use keeps working without offline.
        dbPromise.current = null;
        if (!cancelled) {
          setEngine(null);
          console.warn('Offline storage unavailable', error);
        }
      }
    })();

    return () => {
      cancelled = true;
      started?.stop();
      unsubscribeEngine();
      unsubscribeNetwork();
      appState.remove();
      setEngine(null);
      setSnapshot(IDLE_SNAPSHOT);
    };
  }, [status, userId, farmId, client]);

  const syncNow = useCallback(() => (engine ? engine.kick({ pull: true }) : Promise.resolve()), [engine]);

  const value = useMemo<SyncContextValue>(() => {
    if (!engine || !db) return INERT;
    return {
      ready: true,
      snapshot,
      enqueue: (input) => engine.enqueue(input),
      syncNow,
      list: () => engine.list(),
      retry: (localId) => engine.retry(localId),
      discard: (localId) => engine.discard(localId),
      keepServerVersion: (localId) => engine.keepServerVersion(localId),
      useMine: (localId) => engine.useMine(localId),
      clearAll: () => engine.clearAll(),
      readCache: (entity, options) => readCache(db, farmId, entity, options),
      readCacheRow: (entity, id) => readCacheRow(db, farmId, entity, id),
      readSessionConfig: () => readSessionConfig(db, farmId),
    };
  }, [engine, db, snapshot, syncNow, farmId]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
