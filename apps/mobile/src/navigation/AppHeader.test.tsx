import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { syncHarness } from '../test-utils/sync-harness.tsx';
import { AppHeader } from './AppHeader.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

async function open(h: ReturnType<typeof syncHarness>) {
  await mount(
    <h.Tree>
      <AppHeader />
    </h.Tree>,
  );
  await waitFor(() => expect(h.sync().ready).toBe(true));
}

describe('AppHeader', () => {
  it('renders the brand logo and notification bell, but no offline icon when online', async () => {
    const h = syncHarness();
    await open(h);

    expect(screen.getByTestId('app-header-logo')).toBeTruthy();
    expect(screen.getByTestId('header-notifications')).toBeTruthy();
    expect(screen.queryByTestId('header-offline')).toBeNull();
  });

  it('renders only the offline icon button (no text) when offline, opening SyncSheet when pressed', async () => {
    const h = syncHarness();
    h.setReachable(false);
    await open(h);

    await waitFor(() => expect(screen.getByTestId('header-offline')).toBeTruthy());

    const offlineBtn = screen.getByTestId('header-offline');
    // Ensure no text child inside the offline button (icon only)
    expect(offlineBtn.props.accessibilityLabel).toBe('Offline');
    expect(screen.queryByText('Offline')).toBeNull();

    // Opening SyncSheet on tap
    fireEvent.press(offlineBtn);
    await waitFor(() => expect(screen.getByTestId('sync-sheet')).toBeTruthy());
  });
});
