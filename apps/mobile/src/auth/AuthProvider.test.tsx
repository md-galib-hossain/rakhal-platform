import { describe, expect, it, jest } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import {
  createApiClient,
  createMemoryTokenStore,
  type ApiClient,
  type StoredSession,
} from '@rakhal/api-client';
import { AuthProvider, useAuth, type AuthContextValue } from './AuthProvider.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const user = { id: 'u1', email: 'rahim@farm.test', name: 'Rahim', isEmailVerified: true };

type Reply = { status?: number; json?: unknown } | 'network';
type Handler = (url: string, body: Record<string, unknown> | undefined) => Reply;

const ok = (data: unknown): Reply => ({ status: 200, json: { success: true, data } });
const fail = (status: number, message: string): Reply => ({ status, json: { success: false, message } });
const session = (n: number, farmId = 'farm-1'): Reply =>
  ok({ accessToken: `access-${n}`, refreshToken: `refresh-${n}`, sessionId: 's1', user, farmId, needsFarm: farmId === '' });

function harness(handler: Handler, stored: StoredSession | null) {
  const store = createMemoryTokenStore(stored);
  const requests: string[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    requests.push(url);
    const reply = handler(url, init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined);
    if (reply === 'network') throw new TypeError('Network request failed');
    return {
      ok: (reply.status ?? 200) < 400,
      status: reply.status ?? 200,
      json: () => Promise.resolve(reply.json),
    } as unknown as Response;
  }) as unknown as typeof fetch;

  const createClient = (hooks: { onSessionExpired: () => void }): ApiClient =>
    createApiClient({ baseUrl: 'https://api.test/api/v1', store, fetch: fetchImpl, onSessionExpired: hooks.onSessionExpired });

  let latest: AuthContextValue | null = null;
  function Probe() {
    latest = useAuth();
    return <Text>{latest.status}</Text>;
  }
  const view = render(
    <AuthProvider createClient={createClient}>
      <Probe />
    </AuthProvider>,
  );
  return { store, requests, view, auth: () => latest as AuthContextValue };
}

describe('AuthProvider', () => {
  it('starts signed out when nothing is stored, with no network call', async () => {
    const h = harness(() => ok({}), null);
    await waitFor(() => expect(h.auth().status).toBe('signedOut'));
    expect(h.requests).toHaveLength(0);
    expect(h.auth().expired).toBe(false);
  });

  it('cold start offline: signed in from the store alone, user unknown, session kept', async () => {
    const h = harness(() => 'network', { refreshToken: 'refresh-0', farmId: 'farm-1' });
    await waitFor(() => expect(h.auth().status).toBe('signedIn'));
    expect(h.auth().farmId).toBe('farm-1');
    expect(h.auth().user).toBeNull();
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.auth().status).toBe('signedIn');
    expect(h.store.peek()?.refreshToken).toBe('refresh-0');
  });

  it('cold start online: fills in the user in the background and stores the rotated token', async () => {
    const h = harness((url) => (url.endsWith('/auth/refresh') ? session(1) : ok({})), {
      refreshToken: 'refresh-0',
      farmId: 'farm-1',
    });
    await waitFor(() => expect(h.auth().user?.name).toBe('Rahim'));
    expect(h.store.peek()?.refreshToken).toBe('refresh-1');
  });

  it('signIn stores the session, exposes the user and a farm list to pick from', async () => {
    const farms = [
      { id: 'f1', name: 'One', slug: 'one', role: 'OWNER' },
      { id: 'f2', name: 'Two', slug: 'two', role: 'WORKER' },
    ];
    const h = harness(
      (url) =>
        url.endsWith('/auth/login')
          ? ok({ accessToken: 'a', refreshToken: 'r', sessionId: 's', user, farmId: '', needsFarm: true, farms })
          : ok({}),
      null,
    );
    await waitFor(() => expect(h.auth().status).toBe('signedOut'));
    await act(async () => {
      await h.auth().signIn('rahim', 'pw-123456');
    });
    expect(h.auth().status).toBe('signedIn');
    expect(h.auth().needsFarm).toBe(true);
    expect(h.auth().farms).toHaveLength(2);
    expect(h.store.peek()).toEqual({ refreshToken: 'r', farmId: '' });
  });

  it('a wrong password rejects and leaves the app signed out and not marked expired', async () => {
    const h = harness(() => fail(401, 'Invalid credentials'), null);
    await waitFor(() => expect(h.auth().status).toBe('signedOut'));
    await act(async () => {
      await expect(h.auth().signIn('rahim', 'nope')).rejects.toThrow('Invalid credentials');
    });
    expect(h.auth().status).toBe('signedOut');
    expect(h.auth().expired).toBe(false);
    expect(h.store.peek()).toBeNull();
  });

  it('a revoked session (401 from refresh) signs out with expired=true and clears the store', async () => {
    const h = harness(() => fail(401, 'Invalid refresh token'), { refreshToken: 'refresh-0', farmId: 'farm-1' });
    await waitFor(() => expect(h.auth().status).toBe('signedOut'));
    expect(h.auth().expired).toBe(true);
    expect(h.store.peek()).toBeNull();
  });

  it('switchFarm updates the active farm; signOut clears everything even offline', async () => {
    const h = harness(
      (url) => {
        if (url.endsWith('/auth/refresh')) return session(2, 'farm-2');
        if (url.endsWith('/auth/logout')) return 'network';
        return ok({});
      },
      { refreshToken: 'refresh-0', farmId: 'farm-1' },
    );
    await waitFor(() => expect(h.auth().user).not.toBeNull());
    await act(async () => {
      await h.auth().switchFarm('farm-2');
    });
    expect(h.auth().farmId).toBe('farm-2');
    expect(h.store.peek()?.farmId).toBe('farm-2');

    await act(async () => {
      await h.auth().signOut();
    });
    expect(h.auth().status).toBe('signedOut');
    expect(h.auth().expired).toBe(false);
    expect(h.store.peek()).toBeNull();
  });

  it('useAuth outside the provider throws a clear error', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    function Bad() {
      useAuth();
      return null;
    }
    await expect(render(<Bad />)).rejects.toThrow('useAuth must be used inside <AuthProvider>');
    spy.mockRestore();
  });
});
