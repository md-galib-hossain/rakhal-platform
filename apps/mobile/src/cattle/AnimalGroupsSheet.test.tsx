import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ok, sessionReply, type Handler } from '../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { syncHarness } from '../test-utils/sync-harness.tsx';
import { AnimalGroupsSheet } from './AnimalGroupsSheet.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 24, left: 0, right: 0, bottom: 24 } };

const sampleGroups = [
  { id: 'g1', name: 'May Vaccine', memberCount: 2 },
  { id: 'g2', name: 'High Yielders', memberCount: 5 },
];

function server(onDelete?: (id: string) => void): Handler {
  return (url, _body, method) => {
    if (url.endsWith('/auth/refresh')) return sessionReply(1);
    if (url.endsWith('/auth/me')) return ok({ permissions: ['*'] });
    if (url.endsWith('/farms')) return ok([{ id: 'farm-1', name: 'Demo Farm', slug: 'df', role: 'OWNER' }]);
    if (method === 'DELETE' && url.includes('/animal-groups/')) {
      const parts = url.split('/');
      const id = parts[parts.length - 1];
      onDelete?.(id);
      return ok({ id, deleted: true });
    }
    return ok({ ok: true });
  };
}

describe('AnimalGroupsSheet', () => {
  it('renders groups, shows delete button, and handles deletion flow with confirmation', async () => {
    const deletedIds: string[] = [];
    const h = syncHarness({ handler: server((id) => deletedIds.push(id)) });
    const onRefreshGroups = jest.fn();
    const onFilterByGroup = jest.fn();
    const onClose = jest.fn();

    await mount(
      <h.Tree>
        <SafeAreaProvider initialMetrics={metrics}>
          <AnimalGroupsSheet
            visible
            onClose={onClose}
            allAnimals={[]}
            groups={sampleGroups}
            onFilterByGroup={onFilterByGroup}
            onRefreshGroups={onRefreshGroups}
          />
        </SafeAreaProvider>
      </h.Tree>,
    );

    // Both groups displayed
    expect(screen.getByText('May Vaccine')).toBeTruthy();
    expect(screen.getByText('High Yielders')).toBeTruthy();

    // Delete button exists for group 1
    const deleteBtn = screen.getByTestId('animal-group-delete-btn-g1');
    expect(deleteBtn).toBeTruthy();

    // Tapping delete opens confirmation sheet
    fireEvent.press(deleteBtn);
    await waitFor(() => expect(screen.getByTestId('confirm-sheet')).toBeTruthy());
    expect(screen.getByText('Delete group?')).toBeTruthy();

    // Confirm deletion
    const confirmBtn = screen.getByTestId('confirm-sheet-confirm');
    fireEvent.press(confirmBtn);

    // Deletion called on API
    await waitFor(() => expect(deletedIds).toContain('g1'));
    expect(onRefreshGroups).toHaveBeenCalledTimes(1);
  });
});
