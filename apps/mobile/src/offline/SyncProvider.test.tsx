import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { createNodeSqliteDb } from '../../test/helpers/node-sqlite-db.ts';
import { fakeApi, ok, sessionReply } from '../test-utils/auth-harness.tsx';
import { syncHarness } from '../test-utils/sync-harness.tsx';
import { memoryPrefs } from '../storage/prefs.ts';
import { migrate } from './migrations.ts';
import { claimDatabase } from './owner.ts';
import { createOutbox } from './outbox.ts';
import { SyncProvider, useSync } from './SyncProvider.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(() => {
  jest.restoreAllMocks();
});

const task = { endpoint: 'task.complete', method: 'POST', path: '/tasks/t1/complete', body: { notes: 'done' } } as const;

describe('SyncProvider', () => {
  it('starts for a signed-in user: opens the database, pulls the working set, reports synced', async () => {
    const h = syncHarness();
    await render(<h.Tree />);
    await waitFor(() => expect(h.sync().ready).toBe(true));
    await waitFor(() => expect(h.sync().snapshot.lastSyncedAt).not.toBeNull());
    expect(h.sync().snapshot).toMatchObject({ state: 'idle', waiting: 0, failed: 0, conflict: 0 });
    expect(h.pulls().map((r) => new URL(r.url).pathname.replace('/api/v1', '')).sort()).toEqual(
      ['/cattle', '/inventory/milk-tanks', '/sheds', '/tasks'].sort(),
    );
  });

  it('is inert when nobody is signed in (no database, no requests)', async () => {
    const h = syncHarness({ stored: null });
    await render(<h.Tree />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.sync().ready).toBe(false);
    expect(h.api.requests).toHaveLength(0);
    await expect(h.sync().enqueue(task)).rejects.toThrow(/not running/);
  });

  it('a queued write goes out at once with its own id as the Idempotency-Key', async () => {
    const h = syncHarness();
    await render(<h.Tree />);
    await waitFor(() => expect(h.sync().snapshot.lastSyncedAt).not.toBeNull());

    await act(async () => {
      await h.sync().enqueue(task);
    });
    await waitFor(() => expect(h.writes()).toHaveLength(1));
    expect(h.writes()[0]?.headers['Idempotency-Key']).toBe('key-1');
    expect(h.writes()[0]?.body).toEqual({ notes: 'done' });
    await waitFor(() => expect(h.sync().snapshot.waiting).toBe(0));
  });

  it('offline: the write waits and is counted; when the network returns it is sent', async () => {
    const h = syncHarness();
    h.setReachable(false);
    await render(<h.Tree />);
    await waitFor(() => expect(h.sync().snapshot.state).toBe('offline'));

    await act(async () => {
      await h.sync().enqueue(task);
    });
    await waitFor(() => expect(h.sync().snapshot.waiting).toBe(1));
    expect(h.writes()).toHaveLength(0);

    h.setReachable(true);
    await act(async () => {
      h.emitNetwork(true);
    });
    await waitFor(() => expect(h.writes()).toHaveLength(1));
    await waitFor(() => expect(h.sync().snapshot).toMatchObject({ waiting: 0, state: 'idle' }));
  });

  it('offline cold start: the profile has not loaded, yet the saved queue is there under the database owner', async () => {
    const db = createNodeSqliteDb();
    await migrate(db);
    await claimDatabase(db, 'u1');
    await createOutbox(db, { newId: () => 'seed-1' }).enqueue({
      farmId: 'farm-1',
      userId: 'u1',
      endpoint: 'task.complete',
      method: 'POST',
      path: '/tasks/t1/complete',
      body: {},
    });
    const h = syncHarness({ db, handler: () => 'network' });
    h.setReachable(false);
    await render(<h.Tree />);
    await waitFor(() => expect(h.sync().ready).toBe(true));
    expect(h.sync().snapshot.waiting).toBe(1);
    expect(h.sync().snapshot.state).toBe('offline');
  });

  it('a database that cannot be opened leaves the app running without offline support', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const api = fakeApi((url) => (url.endsWith('/auth/refresh') ? sessionReply(1) : ok([])), { refreshToken: 'r', farmId: 'farm-1' }, memoryPrefs());
    let ready: boolean | null = null;
    function Probe() {
      ready = useSync().ready;
      return null;
    }
    await render(
      <api.Wrapper>
        <SyncProvider openDb={() => Promise.reject(new Error('disk full'))} probe={() => Promise.resolve(true)} subscribeNetwork={() => () => undefined}>
          <Probe />
        </SyncProvider>
      </api.Wrapper>,
    );
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(ready).toBe(false);
  });
});
