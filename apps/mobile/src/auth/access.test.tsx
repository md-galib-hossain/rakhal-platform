import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { fail, fakeApi, ok, sessionReply, type Handler } from '../test-utils/auth-harness.tsx';
import { memoryPrefs } from '../storage/prefs.ts';
import { loadAccess, saveAccess } from './access-store.ts';
import { useAuth, type AuthContextValue } from './AuthProvider.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const farms = [{ id: 'farm-1', name: 'Green Valley', slug: 'green-valley', role: 'OWNER' }];
const stored = { refreshToken: 'refresh-0', farmId: 'farm-1' };

const server =
  (permissions: unknown): Handler =>
  (url) => {
    if (url.endsWith('/auth/refresh')) return sessionReply(1);
    if (url.endsWith('/auth/me')) return ok({ permissions });
    if (url.endsWith('/farms')) return ok(farms);
    return ok({});
  };

async function open(handler: Handler, session = stored as typeof stored | null, prefs = memoryPrefs()) {
  const api = fakeApi(handler, session, prefs);
  let latest: AuthContextValue | null = null;
  function Probe() {
    latest = useAuth();
    return <Text>{latest.accessSource}</Text>;
  }
  await render(
    <api.Wrapper>
      <Probe />
    </api.Wrapper>,
  );
  return { api, prefs, auth: () => latest as AuthContextValue };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('access (permissions + farm name)', () => {
  it('loads permissions and the farm name from the server and caches them for the farm', async () => {
    const h = await open(server(['milk.read', 'task.read']));
    await waitFor(() => expect(h.auth().accessSource).toBe('server'));
    expect(h.auth().permissions).toEqual(['milk.read', 'task.read']);
    expect(h.auth().farmName).toBe('Green Valley');
    expect(await loadAccess(h.prefs, 'farm-1')).toEqual({
      farmId: 'farm-1',
      farmName: 'Green Valley',
      permissions: ['milk.read', 'task.read'],
    });
  });

  it('offline with a cached snapshot: shows the cache, never empties it', async () => {
    const prefs = memoryPrefs();
    await saveAccess(prefs, { farmId: 'farm-1', farmName: 'Green Valley', permissions: ['cattle.read'] });
    const h = await open(() => 'network', stored, prefs);
    await waitFor(() => expect(h.auth().accessSource).toBe('cache'));
    expect(h.auth().permissions).toEqual(['cattle.read']);
    expect(h.auth().farmName).toBe('Green Valley');
  });

  it('offline with no cache: permissions stay unknown (null), not an empty list', async () => {
    const h = await open(() => 'network');
    await waitFor(() => expect(h.auth().status).toBe('signedIn'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.auth().permissions).toBeNull();
    expect(h.auth().accessSource).toBe('none');
  });

  it('a snapshot cached for another farm is ignored', async () => {
    const prefs = memoryPrefs();
    await saveAccess(prefs, { farmId: 'other-farm', farmName: 'Other', permissions: ['*'] });
    const h = await open(() => 'network', stored, prefs);
    await waitFor(() => expect(h.auth().status).toBe('signedIn'));
    expect(h.auth().permissions).toBeNull();
  });

  it('a server error on /auth/me keeps the cached snapshot', async () => {
    const prefs = memoryPrefs();
    await saveAccess(prefs, { farmId: 'farm-1', farmName: 'Green Valley', permissions: ['milk.read'] });
    const h = await open(
      (url) => (url.endsWith('/auth/refresh') ? sessionReply(1) : url.endsWith('/auth/me') ? fail(500, 'boom') : ok(farms)),
      stored,
      prefs,
    );
    await waitFor(() => expect(h.auth().accessSource).toBe('cache'));
    expect(h.auth().permissions).toEqual(['milk.read']);
  });

  it('ignores a malformed permissions payload instead of crashing', async () => {
    const h = await open(server('not-a-list'));
    await waitFor(() => expect(h.auth().accessSource).toBe('server'));
    expect(h.auth().permissions).toEqual([]);
  });

  it('an account without a farm yet makes no access request', async () => {
    const h = await open(
      (url) => (url.endsWith('/auth/refresh') ? sessionReply(1, '') : ok({})),
      { refreshToken: 'refresh-0', farmId: '' },
    );
    await waitFor(() => expect(h.auth().status).toBe('signedIn'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.api.requests.some((r) => r.url.endsWith('/auth/me'))).toBe(false);
    expect(h.auth().permissions).toBeNull();
  });

  it('signing out clears the cached snapshot and the in-memory access', async () => {
    const h = await open(server(['*']));
    await waitFor(() => expect(h.auth().accessSource).toBe('server'));
    await act(async () => {
      await h.auth().signOut();
    });
    await waitFor(() => expect(h.auth().permissions).toBeNull());
    expect(await loadAccess(h.prefs, 'farm-1')).toBeNull();
  });
});
