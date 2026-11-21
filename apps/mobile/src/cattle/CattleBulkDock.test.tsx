import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { mount, restoreMount } from '../test-utils/mount.tsx';
import { CattleBulkDock } from './CattleBulkDock.tsx';

afterEach(restoreMount);

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 24, left: 0, right: 0, bottom: 24 } };

describe('CattleBulkDock', () => {
  it('renders bulk dock actions and fires handlers', async () => {
    const onSelectAll = jest.fn();
    const onRecordEvent = jest.fn();
    const onChangeShed = jest.fn();
    const onAddToGroup = jest.fn();
    const onDispose = jest.fn();
    const onCancel = jest.fn();

    await mount(
      <SafeAreaProvider initialMetrics={metrics}>
        <CattleBulkDock
          selectedCount={2}
          totalCount={5}
          onSelectAll={onSelectAll}
          onDeselectAll={jest.fn()}
          onRecordEvent={onRecordEvent}
          onChangeShed={onChangeShed}
          onAddToGroup={onAddToGroup}
          onDispose={onDispose}
          onCancel={onCancel}
        />
      </SafeAreaProvider>,
    );

    expect(screen.getByTestId('cattle-bulk-dock')).toBeTruthy();
    expect(screen.getByTestId('bulk-selected-count')).toBeTruthy();

    fireEvent.press(screen.getByTestId('bulk-select-all-btn'));
    expect(onSelectAll).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('bulk-action-record-event'));
    expect(onRecordEvent).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('bulk-action-change-shed'));
    expect(onChangeShed).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('bulk-action-add-to-group'));
    expect(onAddToGroup).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('bulk-action-dispose'));
    expect(onDispose).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('bulk-cancel-btn'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
