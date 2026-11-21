import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { fakeApi, ok, sessionReply } from '../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { NotificationSheet } from './NotificationSheet.tsx';

afterEach(restoreMount);

describe('NotificationSheet', () => {
  it('renders notification sheet with tabs and switches between them', async () => {
    const onClose = jest.fn();
    const { Wrapper } = fakeApi(
      (url) => {
        if (url.includes('/notifications/preferences')) {
          return ok({ quiet_hours: { start: null, end: null }, preferences: [] });
        }
        if (url.includes('/notifications/telegram')) {
          return ok({ linked: false });
        }
        if (url.includes('/notifications')) {
          return ok({ unread_count: 0, notifications: [], meta: { page: 1, per_page: 20, total: 0 } });
        }
        if (url.includes('/cattle')) {
          return ok({ items: [] });
        }
        if (url.includes('/tasks/assignees')) {
          return ok([]);
        }
        return sessionReply(1);
      },
      { refreshToken: 'rt-1', farmId: 'farm-1' },
    );

    await mount(
      <Wrapper>
        <NotificationSheet visible={true} onClose={onClose} initialTab="inbox" />
      </Wrapper>,
    );

    expect(screen.getByTestId('notification-sheet')).toBeTruthy();
    expect(screen.getByTestId('notif-tab-inbox')).toBeTruthy();
    expect(screen.getByTestId('notif-tab-upcoming')).toBeTruthy();
    expect(screen.getByTestId('notif-tab-new')).toBeTruthy();

    // Verify inbox tab is active initially
    expect(screen.getByTestId('notification-inbox-tab')).toBeTruthy();
    expect(screen.getByTestId('inbox-filter-all')).toBeTruthy();
    expect(screen.getByTestId('inbox-filter-unread')).toBeTruthy();

    // Switch to Upcoming tab
    await fireEvent.press(screen.getByTestId('notif-tab-upcoming'));
    expect(screen.getByTestId('notification-upcoming-tab')).toBeTruthy();
    expect(screen.getByTestId('upcoming-range-today')).toBeTruthy();
    expect(screen.getByTestId('upcoming-range-week')).toBeTruthy();
    expect(screen.getByTestId('upcoming-range-fortnight')).toBeTruthy();

    // Switch to New tab
    await fireEvent.press(screen.getByTestId('notif-tab-new'));
    expect(screen.getByTestId('notification-new-tab')).toBeTruthy();
    expect(screen.getByTestId('notif-input-title')).toBeTruthy();
    expect(screen.getByTestId('notif-input-notes')).toBeTruthy();
    expect(screen.getByTestId('notif-date-picker-btn')).toBeTruthy();
    expect(screen.getByTestId('notif-time-at')).toBeTruthy();
    expect(screen.getByTestId('notif-time-all-day')).toBeTruthy();
    expect(screen.getByTestId('notif-preview-card')).toBeTruthy();
    expect(screen.getByTestId('notif-submit-btn')).toBeTruthy();

    // Toggle Preferences view from settings button
    await fireEvent.press(screen.getByTestId('notif-settings-btn'));
    expect(screen.getByTestId('notification-preferences-view')).toBeTruthy();

    // Press back button to return to tabs
    await fireEvent.press(screen.getByTestId('notif-back-btn'));
    expect(screen.getByTestId('notif-tab-inbox')).toBeTruthy();

    // Close sheet
    await fireEvent.press(screen.getByTestId('notif-sheet-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
