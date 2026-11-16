import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ok, sessionReply, type Handler } from '../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { syncHarness } from '../test-utils/sync-harness.tsx';
import { CattleList } from './CattleList.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const cows = [
  { id: 'c1', tagNumber: 'BD-001', name: 'Rupa', gender: 'FEMALE', herdStatus: 'ACTIVE', productionStatus: 'MILKING', healthStatus: 'HEALTHY', animalCategory: 'COW', breed: { name: 'Sahiwal' } },
  { id: 'c2', tagNumber: 'BD-002', name: null, gender: 'FEMALE', herdStatus: 'ACTIVE', productionStatus: 'DRY', healthStatus: 'SICK', animalCategory: 'COW' },
  { id: 'c3', tagNumber: 'BD-003', name: 'Shona', gender: 'FEMALE', herdStatus: 'ACTIVE', healthStatus: 'HEALTHY', animalCategory: 'HEIFER' },
];

function server(rows: unknown[]): Handler {
  return (url, _body, method) => {
    if (url.endsWith('/auth/refresh')) return sessionReply(1);
    if (url.endsWith('/auth/me')) return ok({ permissions: ['*'] });
    if (url.endsWith('/farms')) return ok([{ id: 'farm-1', name: 'Green Valley', slug: 'gv', role: 'OWNER' }]);
    if (method === 'GET' && /\/cattle(\?|$)/.test(url)) return ok(rows);
    if (method === 'GET') return ok([]);
    return ok({ ok: true });
  };
}

async function open(h: ReturnType<typeof syncHarness>, onSelect = jest.fn(), locale: 'en' | 'bn' = 'en') {
  await mount(
    <h.Tree>
      <CattleList onSelect={onSelect} />
    </h.Tree>,
    { locale },
  );
  return onSelect;
}

describe('CattleList', () => {
  it('shows the pulled animals with a word-and-mark status badge and a count (no detailed sync banner)', async () => {
    const h = syncHarness({ handler: server(cows) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('cattle-row-c1')).toBeTruthy());
    expect(screen.getByText('BD-001 · Rupa')).toBeTruthy();
    expect(screen.getByText('Milking')).toBeTruthy();
    expect(screen.getByText('Sick')).toBeTruthy();
    expect(screen.getByText('Healthy')).toBeTruthy();
    expect(screen.getByText('Cow · Sahiwal')).toBeTruthy();
    expect(screen.getByTestId('cattle-count')).toHaveTextContent('Animals: 3');
    expect(screen.queryByTestId('cattle-note-updated')).toBeNull();
  });

  it('searches by tag number and by name, case-insensitively, and says so when nothing matches', async () => {
    const h = syncHarness({ handler: server(cows) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('cattle-row-c1')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('cattle-search'), 'bd-002');
    await waitFor(() => expect(screen.queryByTestId('cattle-row-c1')).toBeNull());
    expect(screen.getByTestId('cattle-row-c2')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('cattle-search'), 'SHONA');
    await waitFor(() => expect(screen.getByTestId('cattle-row-c3')).toBeTruthy());
    expect(screen.queryByTestId('cattle-row-c2')).toBeNull();

    fireEvent.changeText(screen.getByTestId('cattle-search'), 'zzz');
    await waitFor(() => expect(screen.getByTestId('cattle-no-match')).toBeTruthy());
    expect(screen.getByText('Nothing matches "zzz". Check the tag number.')).toBeTruthy();
  });

  it('hands the tapped animal to onSelect, and ignores a disabled row', async () => {
    const h = syncHarness({ handler: server(cows) });
    const onSelect = jest.fn();
    await mount(
      <h.Tree>
        <CattleList onSelect={onSelect} isDisabled={(item) => item.id === 'c2'} />
      </h.Tree>,
    );
    await waitFor(() => expect(screen.getByTestId('cattle-row-c1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('cattle-row-c1'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', tagNumber: 'BD-001' }));
    fireEvent.press(screen.getByTestId('cattle-row-c2'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('a farm with no animals says so (after a successful sync), not "not downloaded"', async () => {
    const h = syncHarness({ handler: server([]) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('cattle-empty')).toBeTruthy());
    expect(screen.queryByTestId('cattle-not-downloaded')).toBeNull();
  });

  it('never synced and offline: explains the animals are not on the phone yet', async () => {
    const h = syncHarness({ handler: server(cows) });
    h.setReachable(false);
    await open(h);
    await waitFor(() => expect(screen.getByTestId('cattle-not-downloaded')).toBeTruthy());
    expect(screen.getByText('Not downloaded yet')).toBeTruthy();
  });

  it('reads from the phone when the server goes away, with an offline note', async () => {
    const h = syncHarness({ handler: server(cows) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('cattle-row-c1')).toBeTruthy());
    h.setReachable(false);
    h.emitNetwork(false);
    await h.sync().syncNow();
    await waitFor(() => expect(screen.getByTestId('cattle-note-offline')).toBeTruthy());
    expect(screen.getByTestId('cattle-row-c1')).toBeTruthy();
  });

  it('shows Bangla copy', async () => {
    const h = syncHarness({ handler: server(cows) });
    await open(h, jest.fn(), 'bn');
    await waitFor(() => expect(screen.getByTestId('cattle-row-c1')).toBeTruthy());
    expect(screen.getByText('দুধ দিচ্ছে')).toBeTruthy();
    expect(screen.getByText('অসুস্থ')).toBeTruthy();
  });
});
