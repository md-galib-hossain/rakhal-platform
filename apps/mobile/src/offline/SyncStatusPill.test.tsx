import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { fail, ok } from '../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { syncHarness } from '../test-utils/sync-harness.tsx';
import { SyncStatusPill } from './SyncStatusPill.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const task = { endpoint: 'task.complete', method: 'POST', path: '/tasks/t1/complete', body: {} } as const;
const milkSave = {
  endpoint: 'milk.saveLog',
  method: 'POST',
  path: '/milk/log',
  body: { date: '2026-11-15', session: 'MORNING', entries: [{ cattleId: 'c1', yieldL: 9 }] },
} as const;

async function open(h: ReturnType<typeof syncHarness>, locale: 'en' | 'bn' = 'en') {
  await mount(
    <h.Tree>
      <SyncStatusPill />
    </h.Tree>,
    { locale },
  );
  await waitFor(() => expect(h.sync().ready).toBe(true));
}
const pillText = () => screen.getByTestId('sync-pill').props.accessibilityLabel as string;

describe('SyncStatusPill', () => {
  it('is hidden when offline sync is not running', async () => {
    const h = syncHarness({ stored: null });
    await mount(
      <h.Tree>
        <SyncStatusPill />
      </h.Tree>,
    );
    expect(screen.queryByTestId('sync-pill')).toBeNull();
  });

  it('says "Synced" once everything is sent', async () => {
    const h = syncHarness();
    await open(h);
    await waitFor(() => expect(pillText()).toBe('Synced'));
  });

  it('offline with entries waiting: says so, in words, with the count', async () => {
    const h = syncHarness();
    h.setReachable(false);
    await open(h);
    await act(async () => {
      await h.sync().enqueue(task);
    });
    await waitFor(() => expect(pillText()).toBe('Offline, 1 pending'));
    expect(screen.getByTestId('sync-pill').props.accessibilityHint).toBe('Opens the list of entries saved on this phone');
  });

  it('follows the language', async () => {
    const h = syncHarness();
    h.setReachable(false);
    await open(h, 'bn');
    await act(async () => {
      await h.sync().enqueue(task);
    });
    await waitFor(() => expect(pillText()).toBe('অফলাইন, 1টি অপেক্ষায়'));
  });

  it('is a touch target of at least 48dp', async () => {
    const h = syncHarness();
    await open(h);
    const style = Object.assign({}, ...[screen.getByTestId('sync-pill').props.style].flat(5).filter(Boolean)) as { minHeight?: number };
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
  });
});

describe('the sheet', () => {
  it('lists what is waiting, with a status word, and an honest empty state', async () => {
    const h = syncHarness();
    h.setReachable(false);
    await open(h);
    await act(async () => {
      fireEvent.press(screen.getByTestId('sync-pill'));
    });
    expect(await screen.findByTestId('sync-empty')).toBeTruthy();

    await act(async () => {
      await h.sync().enqueue(task);
    });
    expect(await screen.findByText('Task marked done')).toBeTruthy();
    expect(screen.getByText('Waiting')).toBeTruthy();
  });

  it('a rejected entry stays visible with the reason; Send again resends it with the same key', async () => {
    let accept = false;
    const h = syncHarness({ write: () => (accept ? ok({ ok: true }) : fail(400, 'Cattle is not in the herd')) });
    await open(h);
    await act(async () => {
      await h.sync().enqueue(task);
    });
    await waitFor(() => expect(h.sync().snapshot.failed).toBe(1));
    await waitFor(() => expect(pillText()).toBe('1 need attention'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('sync-pill'));
    });
    expect(await screen.findByText('Cattle is not in the herd')).toBeTruthy();
    expect(screen.getByText('Not sent')).toBeTruthy();

    accept = true;
    await act(async () => {
      fireEvent.press(await screen.findByTestId('sync-retry-key-1'));
    });
    await waitFor(() => expect(h.sync().snapshot.failed).toBe(0));
    expect(h.writes().map((r) => r.headers['Idempotency-Key'])).toEqual(['key-1', 'key-1']);
    expect(await screen.findByText('Sent')).toBeTruthy();
  });

  it('discarding asks first, then removes the entry', async () => {
    const h = syncHarness({ write: () => fail(400, 'Bad entry') });
    await open(h);
    await act(async () => {
      await h.sync().enqueue(task);
    });
    await waitFor(() => expect(h.sync().snapshot.failed).toBe(1));
    await act(async () => {
      fireEvent.press(screen.getByTestId('sync-pill'));
    });
    await act(async () => {
      fireEvent.press(await screen.findByTestId('sync-discard-key-1'));
    });
    expect(await screen.findByText('Discard this entry?')).toBeTruthy();
    expect((await h.sync().list()).length).toBe(1);

    await act(async () => {
      fireEvent.press(screen.getAllByText('Discard').at(-1)!);
    });
    await waitFor(async () => expect((await h.sync().list()).length).toBe(0));
    expect(await screen.findByTestId('sync-empty')).toBeTruthy();
  });

  it('a milk save the server kept a newer version of needs review; keeping the saved version resolves it', async () => {
    const h = syncHarness({ write: () => ok({ saved: 0, anomaliesFlagged: 0, sessionTotalL: 0, conflicts: [{ cattleId: 'c1' }] }) });
    await open(h);
    await act(async () => {
      await h.sync().enqueue(milkSave);
    });
    await waitFor(() => expect(h.sync().snapshot.conflict).toBe(1));
    await waitFor(() => expect(pillText()).toBe('1 to review'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('sync-pill'));
    });
    expect(await screen.findByText('Someone else saved a newer version. Theirs was kept (1).')).toBeTruthy();
    expect(screen.getByText('Needs review')).toBeTruthy();

    await act(async () => {
      fireEvent.press(await screen.findByTestId('sync-keep-key-1'));
    });
    await waitFor(() => expect(h.sync().snapshot.conflict).toBe(0));
    expect(await screen.findByText('Sent')).toBeTruthy();
  });

  it('Sync now runs a pass and the pull again', async () => {
    const h = syncHarness();
    await open(h);
    await waitFor(() => expect(h.sync().snapshot.lastSyncedAt).not.toBeNull());
    const before = h.pulls().length;
    await act(async () => {
      fireEvent.press(screen.getByTestId('sync-pill'));
    });
    await act(async () => {
      fireEvent.press(await screen.findByTestId('sync-now'));
    });
    await waitFor(() => expect(h.pulls().length).toBeGreaterThan(before));
  });
});
