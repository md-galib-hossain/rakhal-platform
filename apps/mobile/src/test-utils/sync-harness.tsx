/**
 * Test-only: a real `SyncProvider` over a real `AuthProvider` + `ApiClient` with a scripted `fetch`, an in-memory
 * SQLite database (Node's built-in module), a switchable "server reachable" flag and a hand-driven network listener.
 * Never import from app code.
 */
import type { ReactNode } from 'react';
import { createNodeSqliteDb } from '../../test/helpers/node-sqlite-db.ts';
import { SyncProvider, useSync, type SyncContextValue } from '../offline/SyncProvider.tsx';
import { memoryPrefs } from '../storage/prefs.ts';
import { fakeApi, ok, sessionReply, type Handler, type Reply } from './auth-harness.tsx';

export interface SyncHarnessOptions {
  /** Answer for non-GET requests (queued writes). Default: `{ ok: true }`. */
  write?: (url: string, body: Record<string, unknown> | undefined, method: string) => Reply;
  /** Override the whole server (e.g. everything offline). */
  handler?: Handler;
  /** Stored session; `null` = signed out. */
  stored?: { refreshToken: string; farmId: string } | null;
  db?: ReturnType<typeof createNodeSqliteDb>;
}

export function syncHarness(options: SyncHarnessOptions = {}) {
  const db = options.db ?? createNodeSqliteDb();
  let reachable = true;
  let counter = 0;
  const listeners = new Set<(connected: boolean | null) => void>();
  const handler: Handler =
    options.handler ??
    ((url, body, method) => {
      if (url.endsWith('/auth/refresh')) return sessionReply(1);
      if (url.endsWith('/auth/me')) return ok({ permissions: ['*'] });
      if (url.endsWith('/farms')) return ok([{ id: 'farm-1', name: 'Green Valley', slug: 'gv', role: 'OWNER' }]);
      if (method === 'GET') return ok([]);
      return options.write?.(url, body, method) ?? ok({ ok: true });
    });
  const api = fakeApi(
    handler,
    options.stored === undefined ? { refreshToken: 'refresh-0', farmId: 'farm-1' } : options.stored,
    memoryPrefs(),
  );

  let latest: SyncContextValue | null = null;
  function Probe() {
    latest = useSync();
    return null;
  }
  function Tree({ children }: { children?: ReactNode }) {
    return (
      <api.Wrapper>
        <SyncProvider
          openDb={() => Promise.resolve(db)}
          probe={() => Promise.resolve(reachable)}
          subscribeNetwork={(onChange) => {
            listeners.add(onChange);
            return () => listeners.delete(onChange);
          }}
          newId={() => `key-${(counter += 1)}`}
        >
          <Probe />
          {children}
        </SyncProvider>
      </api.Wrapper>
    );
  }

  return {
    db,
    api,
    Tree,
    sync: () => latest as SyncContextValue,
    setReachable: (value: boolean) => {
      reachable = value;
    },
    /** Pretend the phone's connectivity changed. */
    emitNetwork: (connected: boolean | null) => listeners.forEach((l) => l(connected)),
    /** Queued writes that reached the server (the token refresh is not one). */
    writes: () => api.requests.filter((r) => r.method !== 'GET' && !r.url.includes('/auth/')),
    pulls: () => api.requests.filter((r) => r.method === 'GET' && !/\/(auth|farms)/.test(r.url)),
  };
}
