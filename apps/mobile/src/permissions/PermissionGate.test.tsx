import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { fakeApi, ok, sessionReply, type Handler } from '../test-utils/auth-harness.tsx';
import { memoryPrefs } from '../storage/prefs.ts';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { PermissionGate } from './PermissionGate.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const withPermissions =
  (permissions: string[]): Handler =>
  (url) => {
    if (url.endsWith('/auth/refresh')) return sessionReply(1);
    if (url.endsWith('/auth/me')) return ok({ permissions });
    return ok([]);
  };

async function open(handler: Handler, permission: string | null, fallback?: string) {
  // A fresh in-memory access cache per test: a cache left by an earlier test must not decide this one.
  const api = fakeApi(handler, { refreshToken: 'refresh-0', farmId: 'farm-1' }, memoryPrefs());
  await mount(
    <api.Wrapper>
      <PermissionGate permission={permission} fallback={fallback ? <Text>{fallback}</Text> : undefined}>
        <Text>secret content</Text>
      </PermissionGate>
    </api.Wrapper>,
    { locale: 'en' },
  );
}

describe('PermissionGate', () => {
  it('shows the content when the permission is held (wildcard owner)', async () => {
    await open(withPermissions(['*']), 'cattle.read');
    expect(await screen.findByText('secret content')).toBeTruthy();
  });

  it('shows the content for an exact permission and for a resource wildcard', async () => {
    await open(withPermissions(['milk.*']), 'milk.read');
    expect(await screen.findByText('secret content')).toBeTruthy();
  });

  it('shows a plain no-access state, never the content, when permissions are known and insufficient', async () => {
    await open(withPermissions(['milk.read']), 'cattle.read');
    expect(await screen.findByTestId('permission-denied')).toBeTruthy();
    expect(screen.getByText('No access')).toBeTruthy();
    expect(screen.queryByText('secret content')).toBeNull();
  });

  it('shows a loader while permissions are unknown (never the content, never "no access")', async () => {
    await open(() => 'network', 'cattle.read');
    expect(await screen.findByTestId('permission-loading')).toBeTruthy();
    expect(screen.queryByText('secret content')).toBeNull();
    expect(screen.queryByTestId('permission-denied')).toBeNull();
  });

  it('no required permission always shows the content, even while permissions load', async () => {
    await open(() => 'network', null);
    expect(await screen.findByText('secret content')).toBeTruthy();
  });

  it('renders a custom fallback instead of the default no-access state', async () => {
    await open(withPermissions([]), 'cattle.read', 'ask your manager');
    expect(await screen.findByText('ask your manager')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('permission-denied')).toBeNull());
  });
});
