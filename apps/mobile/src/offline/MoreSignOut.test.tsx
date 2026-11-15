import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import More from '../../app/(tabs)/more.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { syncHarness } from '../test-utils/sync-harness.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

afterEach(restoreMount);

const task = { endpoint: 'task.complete', method: 'POST', path: '/tasks/t1/complete', body: {} } as const;
const loggedOut = (h: ReturnType<typeof syncHarness>) => h.api.requests.some((r) => r.url.endsWith('/auth/logout'));
const count = async (h: ReturnType<typeof syncHarness>, table: string) =>
  (await h.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))!.n;

async function open(h: ReturnType<typeof syncHarness>) {
  await mount(
    <h.Tree>
      <More />
    </h.Tree>,
  );
  await waitFor(() => expect(h.sync().ready).toBe(true));
}

describe('More: sign out', () => {
  it('with nothing unsent it signs out at once and empties the offline cache', async () => {
    const h = syncHarness({ write: () => ({ status: 200, json: { success: true, data: {} } }) });
    await open(h);
    await waitFor(() => expect(h.sync().snapshot.lastSyncedAt).not.toBeNull());
    await h.db.run("INSERT INTO cache_rows (farm_id, entity, id, search, data) VALUES ('farm-1', 'cattle', 'c1', 'x', '{}')");

    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-out'));
    });
    await waitFor(() => expect(loggedOut(h)).toBe(true));
    expect(screen.queryByText('Not sent yet')).toBeNull();
    expect(await count(h, 'cache_rows')).toBe(0);
  });

  it('with entries still on the phone it asks first, and cancelling keeps them', async () => {
    const h = syncHarness();
    h.setReachable(false);
    await open(h);
    await act(async () => {
      await h.sync().enqueue(task);
    });
    await waitFor(() => expect(h.sync().snapshot.waiting).toBe(1));

    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-out'));
    });
    expect(await screen.findByText('Not sent yet')).toBeTruthy();
    expect(screen.getByText('Entries not sent: 1. Signing out deletes them from this phone.')).toBeTruthy();
    expect(loggedOut(h)).toBe(false);

    await act(async () => {
      fireEvent.press(screen.getByText('Cancel'));
    });
    expect(loggedOut(h)).toBe(false);
    expect(await count(h, 'outbox')).toBe(1);
  });

  it('confirming deletes the unsent entries and signs out', async () => {
    const h = syncHarness();
    h.setReachable(false);
    await open(h);
    await act(async () => {
      await h.sync().enqueue(task);
    });
    await waitFor(() => expect(h.sync().snapshot.waiting).toBe(1));

    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-out'));
    });
    await act(async () => {
      fireEvent.press(await screen.findByText('Sign out and delete'));
    });
    await waitFor(() => expect(loggedOut(h)).toBe(true));
    expect(await count(h, 'outbox')).toBe(0);
  });
});
