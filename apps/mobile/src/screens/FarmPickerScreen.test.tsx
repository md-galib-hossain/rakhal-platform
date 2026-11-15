import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { fail, fakeApi, ok, sessionReply, type Handler } from '../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { FarmPickerScreen } from './FarmPickerScreen.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));

const router = (jest.requireMock('expo-router') as { router: { replace: jest.Mock } }).router;

beforeEach(() => {
  router.replace.mockClear();
});
afterEach(restoreMount);

const farms = [
  { id: 'f1', name: 'Green Valley', slug: 'green-valley', status: 'ACTIVE', role: 'OWNER' },
  { id: 'f2', name: 'River Farm', slug: 'river-farm', status: 'ACTIVE', role: 'WORKER' },
];

/** Signed in (cold start) but not scoped to a farm: exactly the state the picker is for. */
async function open(handler: Handler) {
  const api = fakeApi(handler, { refreshToken: 'refresh-0', farmId: '' });
  await mount(
    <api.Wrapper>
      <FarmPickerScreen />
    </api.Wrapper>,
    { locale: 'en' },
  );
  return api;
}

const base: Handler = (url, body) => {
  if (url.endsWith('/auth/refresh')) return sessionReply(2, String(body?.farmId ?? ''));
  if (url.endsWith('/farms')) return ok(farms);
  return ok({});
};

describe('FarmPickerScreen', () => {
  it('loads the account farms and lists name and role', async () => {
    await open(base);
    expect(await screen.findByText('Green Valley')).toBeTruthy();
    expect(screen.getByText('OWNER')).toBeTruthy();
    expect(screen.getByText('River Farm')).toBeTruthy();
    expect(screen.getByText('WORKER')).toBeTruthy();
  });

  it('choosing a farm refreshes the session with that farm and goes home', async () => {
    const api = await open(base);
    await act(async () => {
      fireEvent.press(await screen.findByTestId('farm-row-f2'));
    });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    const switchCall = api.requests.filter((r) => r.url.endsWith('/auth/refresh')).at(-1);
    expect(switchCall?.body).toMatchObject({ farmId: 'f2', refreshToken: expect.any(String) });
    expect(api.store.peek()?.farmId).toBe('f2');
  });

  it('shows an empty state with sign out when the account has no farm', async () => {
    const api = await open((url, body, method) => (url.endsWith('/farms') ? ok([]) : base(url, body, method)));
    expect(await screen.findByText('No farm yet')).toBeTruthy();
    expect(screen.getByText(/Create your farm on the Rakhal website/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('Sign out'));
    });
    await waitFor(() => expect(api.store.peek()).toBeNull());
  });

  it('a failed load shows a network error with a working retry', async () => {
    let online = false;
    await open((url, body, method) => {
      if (url.endsWith('/farms')) return online ? ok(farms) : 'network';
      return base(url, body, method);
    });
    expect(await screen.findByText('No internet connection')).toBeTruthy();
    online = true;
    await act(async () => {
      fireEvent.press(screen.getByText('Try again'));
    });
    expect(await screen.findByText('Green Valley')).toBeTruthy();
  });

  it('a failed switch keeps the picker open with a plain message', async () => {
    let failing = false;
    await open((url, body, method) => {
      if (url.endsWith('/auth/refresh') && failing && body?.farmId === 'f1') return fail(503, 'down');
      return base(url, body, method);
    });
    const row = await screen.findByTestId('farm-row-f1');
    failing = true;
    await act(async () => {
      fireEvent.press(row);
    });
    expect(await screen.findByTestId('farm-switch-error')).toHaveTextContent('Could not switch farm. Try again.');
    expect(router.replace).not.toHaveBeenCalled();
  });
});
