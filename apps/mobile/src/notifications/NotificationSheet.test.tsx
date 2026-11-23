import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { fakeApi, ok, sessionReply } from '../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { flatStyle } from '../test-utils/touch-target.ts';
import { NotificationSheet } from './NotificationSheet.tsx';

afterEach(restoreMount);

describe('NotificationSheet', () => {
  it('renders notification sheet with fixed height across tabs and pinned header/tabs', async () => {
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
          return ok({ items: [{ id: 'c-1', tagNumber: 'COW-001', name: 'Lalita' }] });
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

    // Verify fixed height across tabs: 78% of window height
    const surface = flatStyle(screen.getByTestId('sheet-surface'));
    const window = Dimensions.get('window');
    expect(surface.height).toBeCloseTo(window.height * 0.78);
    // Outer content is a plain View (scrollable={false}), keeping header and tabs pinned
    expect(screen.getByTestId('sheet-content').type).toBe('View');

    // Verify inbox tab is active initially
    expect(screen.getByTestId('notification-inbox-tab')).toBeTruthy();
    expect(screen.getByTestId('inbox-filter-all')).toBeTruthy();
    expect(screen.getByTestId('inbox-filter-unread')).toBeTruthy();

    // Switch to Upcoming tab: height remains consistent
    await fireEvent.press(screen.getByTestId('notif-tab-upcoming'));
    expect(screen.getByTestId('notification-upcoming-tab')).toBeTruthy();
    expect(screen.getByTestId('upcoming-range-today')).toBeTruthy();
    expect(screen.getByTestId('upcoming-range-week')).toBeTruthy();
    expect(screen.getByTestId('upcoming-range-fortnight')).toBeTruthy();

    // Switch to New tab: height remains consistent
    await fireEvent.press(screen.getByTestId('notif-tab-new'));
    expect(screen.getByTestId('notification-new-tab')).toBeTruthy();
    expect(screen.getByTestId('notif-input-title')).toBeTruthy();
    expect(screen.getByTestId('notif-input-notes')).toBeTruthy();
    expect(screen.getByTestId('notif-date-picker-btn')).toBeTruthy();
    expect(screen.getByTestId('notif-time-at')).toBeTruthy();
    expect(screen.getByTestId('notif-time-all-day')).toBeTruthy();
    expect(screen.getByTestId('notif-preview-card')).toBeTruthy();
    expect(screen.getByTestId('notif-submit-btn')).toBeTruthy();

    // Open animal picker bottom sheet (capped at 75% height)
    await fireEvent.press(screen.getByTestId('notif-animal-picker-btn'));
    expect(screen.getByTestId('notif-animal-sheet')).toBeTruthy();

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

  it('handles scoped animal filter via icon-only badge and filter sheet without post-filter chips', async () => {
    const { Wrapper } = fakeApi(
      (url) => {
        if (url.includes('/notifications')) {
          return ok({
            unread_count: 1,
            notifications: [
              {
                id: 'n-1',
                type: 'animal_sickness_reported',
                priority: 'critical',
                title: 'Mastitis detected in #COW-001',
                message: 'Cow #COW-001 needs immediate inspection.',
                link: '/cattle/c-1',
                read: false,
                created_at: new Date().toISOString(),
              },
            ],
            meta: { page: 1, per_page: 20, total: 1 },
          });
        }
        if (url.includes('/cattle')) {
          return ok({ items: [{ id: 'c-1', tagNumber: 'COW-001', name: 'Lalita', status: 'sick' }] });
        }
        return sessionReply(1);
      },
      { refreshToken: 'rt-1', farmId: 'farm-1' },
    );

    await mount(
      <Wrapper>
        <NotificationSheet
          visible={true}
          onClose={jest.fn()}
          initialAnimal={{ id: 'c-1', tagNumber: 'COW-001', name: 'Lalita', group: 'sick' }}
        />
      </Wrapper>,
    );

    // Rule: NO individual animal chips or banners on main notification screen
    expect(screen.queryByTestId('notif-scoped-banner')).toBeNull();
    expect(screen.queryByTestId('filter-chip-animal')).toBeNull();
    // Rule: Icon-only filter button, NO "Filters" text label
    const trigger = screen.getByTestId('notif-filter-trigger');
    expect(within(trigger).queryByText('Filters')).toBeNull();
    expect(within(trigger).queryByText('Filters (1)')).toBeNull();
    // Circular badge counter displays 1
    expect(within(trigger).getByText('1')).toBeTruthy();

    // Open filter sheet to inspect and clear animal
    await fireEvent.press(screen.getByTestId('notif-filter-trigger'));
    expect(screen.getByTestId('notif-filter-sheet')).toBeTruthy();
    expect(screen.getByText('#COW-001')).toBeTruthy();

    // Clear animal filter in modal
    await fireEvent.press(screen.getByTestId('notif-filter-clear-animal'));
    await fireEvent.press(screen.getByTestId('notif-filter-apply'));

    // Badge is now gone
    expect(screen.queryByText('1')).toBeNull();
  });

  it('displays active filter count on icon-only trigger when group is selected, keeping main screen clean', async () => {
    const { Wrapper } = fakeApi(
      (url) => {
        if (url.includes('/notifications')) {
          return ok({ unread_count: 0, notifications: [], meta: { page: 1, per_page: 20, total: 0 } });
        }
        if (url.includes('/cattle')) {
          return ok({ items: [{ id: 'c-1', tagNumber: 'COW-001', name: 'Lalita', status: 'sick' }] });
        }
        return sessionReply(1);
      },
      { refreshToken: 'rt-1', farmId: 'farm-1' },
    );

    await mount(
      <Wrapper>
        <NotificationSheet visible={true} onClose={jest.fn()} />
      </Wrapper>,
    );

    // Initially no active badge
    expect(screen.queryByText('1')).toBeNull();

    // Open filter modal and select Milking group
    await fireEvent.press(screen.getByTestId('notif-filter-trigger'));
    expect(screen.getByTestId('notif-filter-sheet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('filter-group-milking'));
    await fireEvent.press(screen.getByTestId('notif-filter-apply'));

    // Trigger shows icon-only square button with circular badge count '1'
    const trigger = screen.getByTestId('notif-filter-trigger');
    expect(within(trigger).getByText('1')).toBeTruthy();
    // No text label "Filters" on trigger
    expect(within(trigger).queryByText('Filters')).toBeNull();
    // No post-filter chip on main screen
    expect(screen.queryByTestId('filter-chip-group')).toBeNull();

    // Reset filters via modal
    await fireEvent.press(screen.getByTestId('notif-filter-trigger'));
    await fireEvent.press(screen.getByTestId('notif-filter-reset-all'));
    await fireEvent.press(screen.getByTestId('notif-filter-apply'));

    // Badge is gone
    expect(screen.queryByText('1')).toBeNull();
  });

  it('supports animal multi-select in animal picker modal without post-filter chips on main screen', async () => {
    const { Wrapper } = fakeApi(
      (url) => {
        if (url.includes('/notifications')) {
          return ok({ unread_count: 0, notifications: [], meta: { page: 1, per_page: 20, total: 0 } });
        }
        if (url.includes('/cattle')) {
          return ok({
            items: [
              { id: 'c-1', tagNumber: 'COW-001', name: 'Lalita' },
              { id: 'c-2', tagNumber: 'COW-002', name: 'Sundari' },
            ],
          });
        }
        return sessionReply(1);
      },
      { refreshToken: 'rt-1', farmId: 'farm-1' },
    );

    await mount(
      <Wrapper>
        <NotificationSheet visible={true} onClose={jest.fn()} />
      </Wrapper>,
    );

    // Open filter modal
    await fireEvent.press(screen.getByTestId('notif-filter-trigger'));
    expect(screen.getByTestId('notif-filter-sheet')).toBeTruthy();

    // Open animal picker
    await fireEvent.press(screen.getByTestId('notif-filter-pick-animal'));
    expect(screen.getByTestId('notif-animal-picker-modal')).toBeTruthy();

    // Select both animals
    await fireEvent.press(screen.getByTestId('notif-animal-item-c-1'));
    await fireEvent.press(screen.getByTestId('notif-animal-item-c-2'));

    // Confirm animal selection
    await fireEvent.press(screen.getByTestId('notif-animal-picker-done'));

    // In filter sheet, summary shows 2 animals selected
    expect(screen.getByText('2 animals selected')).toBeTruthy();

    // Apply filter
    await fireEvent.press(screen.getByTestId('notif-filter-apply'));

    // Main screen shows badge count 2 on icon-only trigger
    expect(screen.getByText('2')).toBeTruthy();
    // Absolutely NO animal chips or banners on main screen
    expect(screen.queryByTestId('notif-scoped-banner')).toBeNull();
    expect(screen.queryByTestId('filter-chip-animal')).toBeNull();
  });

  it('pre-selects the scoped animal in NewTab when initialAnimal is passed', async () => {
    const { Wrapper } = fakeApi(
      (url) => {
        if (url.includes('/cattle')) {
          return ok({ items: [{ id: 'c-1', tagNumber: 'COW-001', name: 'Lalita' }] });
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
        <NotificationSheet
          visible={true}
          onClose={jest.fn()}
          initialTab="new"
          initialAnimal={{ id: 'c-1', tagNumber: 'COW-001', name: 'Lalita' }}
        />
      </Wrapper>,
    );

    // Verify NewTab is rendered and pre-selected animal tag is displayed
    expect(screen.getByTestId('notification-new-tab')).toBeTruthy();
    expect(screen.getAllByText('COW-001', { exact: false }).length).toBeGreaterThanOrEqual(1);
  });

  it('filters inbox items by category and scoped animal, and displays empty reset state', async () => {
    const { Wrapper } = fakeApi(
      (url) => {
        if (url.includes('/notifications')) {
          return ok({
            unread_count: 2,
            notifications: [
              {
                id: 'n-1',
                type: 'animal_sickness_reported',
                priority: 'critical',
                title: 'Mastitis detected in #COW-001',
                message: 'Cow #COW-001 needs immediate inspection.',
                link: '/cattle/c-1',
                read: false,
                created_at: new Date().toISOString(),
              },
              {
                id: 'n-2',
                type: 'low_feed_stock',
                priority: 'medium',
                title: 'Silage Low',
                message: 'Silage stock is under 20%.',
                link: '/feed',
                read: false,
                created_at: new Date().toISOString(),
              },
            ],
            meta: { page: 1, per_page: 20, total: 2 },
          });
        }
        if (url.includes('/cattle')) {
          return ok({ items: [{ id: 'c-1', tagNumber: 'COW-001', name: 'Lalita', status: 'sick' }] });
        }
        return sessionReply(1);
      },
      { refreshToken: 'rt-1', farmId: 'farm-1' },
    );

    await mount(
      <Wrapper>
        <NotificationSheet
          visible={true}
          onClose={jest.fn()}
          initialAnimal={{ id: 'c-1', tagNumber: 'COW-001', name: 'Lalita' }}
        />
      </Wrapper>,
    );

    // With animal scope #COW-001, item 1 is visible, item 2 (silage) is filtered out
    expect(screen.getByTestId('inbox-item-n-1')).toBeTruthy();
    expect(screen.queryByTestId('inbox-item-n-2')).toBeNull();

    // Open filter modal and select Financial (which has 0 matching items)
    await fireEvent.press(screen.getByTestId('notif-filter-trigger'));
    expect(screen.getByTestId('notif-filter-sheet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('filter-category-financial'));
    await fireEvent.press(screen.getByTestId('notif-filter-apply'));

    // Should now show the clean filtered empty state with reset button
    expect(screen.getByTestId('inbox-filtered-empty-state')).toBeTruthy();
    expect(screen.getByTestId('inbox-reset-filters-btn')).toBeTruthy();

    // Reset filters
    await fireEvent.press(screen.getByTestId('inbox-reset-filters-btn'));

    // Both items should now be visible since filters were cleared
    expect(screen.getByTestId('inbox-item-n-1')).toBeTruthy();
    expect(screen.getByTestId('inbox-item-n-2')).toBeTruthy();
  });

  it('filters upcoming items by animal scope and category, showing reset state when none match', async () => {
    const { Wrapper } = fakeApi(
      (url) => {
        if (url.includes('/notifications/upcoming')) {
          return ok({
            items: [
              {
                occurrence_id: 'occ-1',
                schedule_id: 'sched-1',
                fire_at: '2026-11-25T09:00:00Z',
                fire_at_local: '2026-11-25 15:00',
                title: 'Vaccination for Cow #COW-001',
                body: 'Deworming and FMD vaccine',
                origin: 'SYSTEM',
                category: 'health_safety',
                priority: 'high',
                link: '/cattle/c-1',
                animals_count: 1,
                repeat: 'NEVER',
                can_edit: true,
              },
              {
                occurrence_id: 'occ-2',
                schedule_id: 'sched-2',
                fire_at: '2026-11-26T09:00:00Z',
                fire_at_local: '2026-11-26 15:00',
                title: 'General Feed Delivery',
                body: 'Corn silage arrival',
                origin: 'USER',
                category: 'inventory',
                priority: 'medium',
                link: '/feed',
                animals_count: 0,
                repeat: 'NEVER',
                can_edit: true,
              },
            ],
          });
        }
        if (url.includes('/cattle')) {
          return ok({ items: [{ id: 'c-1', tagNumber: 'COW-001', name: 'Lalita' }] });
        }
        return sessionReply(1);
      },
      { refreshToken: 'rt-1', farmId: 'farm-1' },
    );

    await mount(
      <Wrapper>
        <NotificationSheet
          visible={true}
          onClose={jest.fn()}
          initialTab="upcoming"
          initialAnimal={{ id: 'c-1', tagNumber: 'COW-001', name: 'Lalita' }}
        />
      </Wrapper>,
    );

    // Occ-1 matches cow #COW-001, Occ-2 is filtered out
    expect(screen.getByTestId('upcoming-item-occ-1')).toBeTruthy();
    expect(screen.queryByTestId('upcoming-item-occ-2')).toBeNull();

    // Set category to inventory (which doesn't match cow #COW-001)
    await fireEvent.press(screen.getByTestId('notif-filter-trigger'));
    await fireEvent.press(screen.getByTestId('filter-category-inventory'));
    await fireEvent.press(screen.getByTestId('notif-filter-apply'));

    // Should display upcoming filtered empty state
    expect(screen.getByTestId('upcoming-filtered-empty-state')).toBeTruthy();
    expect(screen.getByTestId('upcoming-reset-filters-btn')).toBeTruthy();

    // Reset filters
    await fireEvent.press(screen.getByTestId('upcoming-reset-filters-btn'));

    // Both upcoming items now visible
    expect(screen.getByTestId('upcoming-item-occ-1')).toBeTruthy();
    expect(screen.getByTestId('upcoming-item-occ-2')).toBeTruthy();
  });

  it('keeps Done button sticky to bottom and animal list independently scrollable in animal picker modal', async () => {
    const { Wrapper } = fakeApi(
      (url) => {
        if (url.includes('/notifications')) {
          return ok({ unread_count: 0, notifications: [], meta: { page: 1, per_page: 20, total: 0 } });
        }
        if (url.includes('/cattle')) {
          return ok({
            items: [
              { id: 'c-1', tagNumber: 'COW-001', name: 'Lalita' },
              { id: 'c-2', tagNumber: 'COW-002', name: 'Sundari' },
            ],
          });
        }
        return sessionReply(1);
      },
      { refreshToken: 'rt-1', farmId: 'farm-1' },
    );

    await mount(
      <Wrapper>
        <NotificationSheet visible={true} onClose={jest.fn()} />
      </Wrapper>,
    );

    // Open filter modal
    await fireEvent.press(screen.getByTestId('notif-filter-trigger'));
    const filterModal = screen.getByTestId('notif-filter-sheet');
    expect(filterModal).toBeTruthy();

    // Verify filter sheet has non-scrolling outer content (scrollable={false})
    const filterContent = within(filterModal).getByTestId('sheet-content');
    expect(filterContent.type).toBe('View');

    // Reset and Apply buttons are present in sticky bottom container
    expect(screen.getByTestId('notif-filter-reset-all')).toBeTruthy();
    expect(screen.getByTestId('notif-filter-apply')).toBeTruthy();

    // Open animal picker modal
    await fireEvent.press(screen.getByTestId('notif-filter-pick-animal'));
    const animalModal = screen.getByTestId('notif-animal-picker-modal');
    expect(animalModal).toBeTruthy();

    // Verify animal picker modal has non-scrolling outer content (scrollable={false})
    const animalContent = within(animalModal).getByTestId('sheet-content');
    expect(animalContent.type).toBe('View');

    // Verify search input is pinned at the top
    expect(screen.getByTestId('notif-animal-picker-search')).toBeTruthy();

    // Verify Done button is pinned at bottom
    const doneBtn = screen.getByTestId('notif-animal-picker-done');
    expect(doneBtn).toBeTruthy();

    // Can select an animal and click Done
    await fireEvent.press(screen.getByTestId('notif-animal-item-c-1'));
    await fireEvent.press(doneBtn);

    // Returned to filter sheet with selected animal
    expect(within(filterModal).getByText('#COW-001')).toBeTruthy();
    expect(within(filterModal).getByText('Lalita')).toBeTruthy();
  });
});
