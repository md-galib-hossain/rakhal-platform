import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { fakeApi, ok, sessionReply } from '../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { AuthGate } from './AuthGate.tsx';

let mockSegments: string[] = [];
const mockReplace = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useSegments: () => mockSegments,
  useRootNavigationState: () => ({ key: 'root' }),
}));

beforeEach(() => {
  mockSegments = [];
  mockReplace.mockClear();
});
afterEach(restoreMount);

async function open(segments: string[], stored: { refreshToken: string; farmId: string } | null, farmIdAfterRefresh = 'farm-1') {
  mockSegments = segments;
  const api = fakeApi((url) => (url.endsWith('/auth/refresh') ? sessionReply(1, farmIdAfterRefresh) : ok({})), stored);
  await mount(
    <api.Wrapper>
      <AuthGate>
        <Text>screen</Text>
      </AuthGate>
    </api.Wrapper>,
    { locale: 'en' },
  );
  return api;
}

describe('AuthGate', () => {
  it('signed out on a protected screen: redirects to /login and covers the screen', async () => {
    await open([], null);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
    expect(screen.getByTestId('auth-gate-cover')).toBeTruthy();
    // The routed screen stays mounted underneath (the navigator must not unmount while redirecting).
    expect(screen.getByText('screen')).toBeTruthy();
  });

  it('signed out on /login: no redirect and no cover', async () => {
    await open(['login'], null);
    await waitFor(() => expect(screen.queryByTestId('auth-gate-cover')).toBeNull());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('signed in with a farm on home: no redirect, no cover once the session is read', async () => {
    await open([], { refreshToken: 'refresh-0', farmId: 'farm-1' });
    await waitFor(() => expect(screen.queryByTestId('auth-gate-cover')).toBeNull());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('signed in without a farm is sent to /farm', async () => {
    await open([], { refreshToken: 'refresh-0', farmId: '' }, '');
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/farm'));
  });

  it('signed in on /login is sent home', async () => {
    await open(['login'], { refreshToken: 'refresh-0', farmId: 'farm-1' });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });
});
