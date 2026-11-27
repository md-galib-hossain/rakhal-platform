import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { ok, sessionReply, type Handler } from '../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { syncHarness } from '../test-utils/sync-harness.tsx';
import { CattleList } from './CattleList.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const cows = [
  { id: 'c1', tagNumber: 'BD-001', name: 'Rupa', gender: 'FEMALE', herdStatus: 'ACTIVE', productionStatus: 'MILKING', healthStatus: 'HEALTHY', animalCategory: 'COW', breed: { name: 'Sahiwal' } },
  { id: 'c2', tagNumber: 'BD-002', name: null, gender: 'FEMALE', herdStatus: 'ACTIVE', productionStatus: 'DRY', healthStatus: 'SICK', animalCategory: 'COW' },
  { id: 'c3', tagNumber: 'BD-003', name: 'Shona', gender: 'FEMALE', herdStatus: 'ACTIVE', healthStatus: 'HEALTHY', animalCategory: 'HEIFER' },
];

function server(rows: unknown[]): Handler {
  return (url, _body, method) => {
    if (url.endsWith('/auth/refresh')) return sessionReply(1);
    if (url.endsWith('/auth/me')) return ok({ permissions: ['*'] });
    if (url.endsWith('/farms')) return ok([{ id: 'farm-1', name: 'Green Valley', slug: 'gv', role: 'OWNER' }]);
    if (method === 'GET' && /\/cattle(\?|$)/.test(url)) return ok(rows);
    if (method === 'GET') return ok([]);
    return ok({ ok: true });
  };
}

async function open(h: ReturnType<typeof syncHarness>, onSelect = jest.fn(), locale: 'en' | 'bn' = 'en') {
  await mount(
    <h.Tree>
      <CattleList onSelect={onSelect} />
    </h.Tree>,
    { locale },
  );
  return onSelect;
}

describe('CattleList', () => {
  it('shows the pulled animals with a word-and-mark status badge and a count (no detailed sync banner)', async () => {
    const h = syncHarness({ handler: server(cows) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('cattle-row-c1')).toBeTruthy());
    expect(screen.getByText('Rupa')).toBeTruthy();
    expect(screen.getByText('Milking')).toBeTruthy();
    expect(screen.getByText('Sick')).toBeTruthy();
    expect(screen.getAllByText('Healthy').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('BD-001')).toBeTruthy();
    expect(screen.getByTestId('cattle-count')).toHaveTextContent('Animals: 3');
    expect(screen.queryByTestId('cattle-note-updated')).toBeNull();
  });

  it('searches by tag number and by name, case-insensitively, and says so when nothing matches', async () => {
    const h = syncHarness({ handler: server(cows) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('cattle-row-c1')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('cattle-search'), 'bd-002');
    await waitFor(() => expect(screen.queryByTestId('cattle-row-c1')).toBeNull());
    expect(screen.getByTestId('cattle-row-c2')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('cattle-search'), 'SHONA');
    await waitFor(() => expect(screen.getByTestId('cattle-row-c3')).toBeTruthy());
    expect(screen.queryByTestId('cattle-row-c2')).toBeNull();

    fireEvent.changeText(screen.getByTestId('cattle-search'), 'zzz');
    await waitFor(() => expect(screen.getByTestId('cattle-no-match')).toBeTruthy());
    expect(screen.getByText('Nothing matches "zzz". Check the tag number.')).toBeTruthy();
  });

  it('hands the tapped animal to onSelect, and ignores a disabled row', async () => {
    const h = syncHarness({ handler: server(cows) });
    const onSelect = jest.fn();
    await mount(
      <h.Tree>
        <CattleList onSelect={onSelect} isDisabled={(item) => item.id === 'c2'} />
      </h.Tree>,
    );
    await waitFor(() => expect(screen.getByTestId('cattle-row-c1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('cattle-row-c1'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', tagNumber: 'BD-001' }));
    fireEvent.press(screen.getByTestId('cattle-row-c2'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('a farm with no animals says so (after a successful sync), not "not downloaded"', async () => {
    const h = syncHarness({ handler: server([]) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('cattle-empty')).toBeTruthy());
    expect(screen.queryByTestId('cattle-not-downloaded')).toBeNull();
  });

  it('never synced and offline: explains the animals are not on the phone yet', async () => {
    const h = syncHarness({ handler: server(cows) });
    h.setReachable(false);
    await open(h);
    await waitFor(() => expect(screen.getByTestId('cattle-not-downloaded')).toBeTruthy());
    expect(screen.getByText('Not downloaded yet')).toBeTruthy();
  });

  it('reads from the phone when the server goes away', async () => {
    const h = syncHarness({ handler: server(cows) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('cattle-row-c1')).toBeTruthy());
    h.setReachable(false);
    h.emitNetwork(false);
    await h.sync().syncNow();
    expect(screen.getByTestId('cattle-row-c1')).toBeTruthy();
    expect(screen.queryByTestId('cattle-note-offline')).toBeNull();
  });

  it('shows Bangla copy', async () => {
    const h = syncHarness({ handler: server(cows) });
    await open(h, jest.fn(), 'bn');
    await waitFor(() => expect(screen.getByTestId('cattle-row-c1')).toBeTruthy());
    expect(screen.getByText('দুধ দিচ্ছে')).toBeTruthy();
    expect(screen.getByText('অসুস্থ')).toBeTruthy();
  });

  it('renders the highlights bar and filters by category chip when tapped', async () => {
    const h = syncHarness({ handler: server(cows) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('cattle-row-c1')).toBeTruthy());

    expect(screen.getByTestId('cattle-highlights-bar')).toBeTruthy();
    expect(screen.getByTestId('kpi-total-animals')).toBeTruthy();

    // Tap Heifers chip
    fireEvent.press(screen.getByTestId('category-chip-HEIFER'));
    await waitFor(() => expect(screen.queryByTestId('cattle-row-c1')).toBeNull());
    expect(screen.getByTestId('cattle-row-c3')).toBeTruthy();

    // Tap All chip to unfilter
    fireEvent.press(screen.getByTestId('category-chip-ALL'));
    await waitFor(() => expect(screen.getByTestId('cattle-row-c1')).toBeTruthy());
    expect(screen.getByTestId('cattle-row-c2')).toBeTruthy();
    expect(screen.getByTestId('cattle-row-c3')).toBeTruthy();
  });

  it('renders rich card details including AQR score, weight, shed and next event', async () => {
    const enrichedCows = [
      {
        id: 'c10',
        tagNumber: 'BD-010',
        name: 'Padma',
        gender: 'FEMALE',
        herdStatus: 'ACTIVE',
        productionStatus: 'MILKING',
        healthStatus: 'HEALTHY',
        animalCategory: 'COW',
        breed: { name: 'Sahiwal' },
        aqrScore: 85,
        lastWeightKg: 480,
        shed: { name: 'Main Shed' },
        next_event: {
          kind: 'CALVING',
          urgency: 'OVERDUE',
          actionable: true,
          daysUntil: -2,
          dueAt: '2026-11-13T00:00:00Z',
          labelKey: 'cattle.upcoming.calving',
        },
      },
    ];
    const h = syncHarness({ handler: server(enrichedCows) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('cattle-row-c10')).toBeTruthy());

    expect(screen.getByText('Padma')).toBeTruthy();
    expect(screen.getByText('BD-010')).toBeTruthy();
    expect(screen.getAllByText('85').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('/100')).toBeTruthy();
    expect(screen.getByText('480 kg')).toBeTruthy();
    expect(screen.getByText('Main Shed')).toBeTruthy();

    // Tap expand toggle to reveal expanded details (including breed tile and next event)
    fireEvent.press(screen.getByTestId('cattle-row-c10-expand-toggle'));
    await waitFor(() => expect(screen.getByTestId('cattle-row-c10-expanded-details')).toBeTruthy());
    expect(screen.getByText('Sahiwal')).toBeTruthy();
    expect(screen.getByText('Calving')).toBeTruthy();
    expect(screen.getByText(/2d overdue/)).toBeTruthy();
  });

  it('toggles expandable card in place without navigating to detail, showing deep statuses', async () => {
    const enrichedCows = [
      {
        id: 'c20',
        tagNumber: 'BD-020',
        name: 'Moti',
        gender: 'FEMALE',
        herdStatus: 'ACTIVE',
        productionStatus: 'MILKING',
        lactationStage: 'MID',
        reproductiveStatus: 'PREGNANT',
        healthStatus: 'HEALTHY',
        animalCategory: 'COW',
      },
      {
        id: 'c21',
        tagNumber: 'BD-021',
        name: 'Tara',
        gender: 'FEMALE',
        herdStatus: 'ACTIVE',
        productionStatus: 'DRY',
        healthStatus: 'HEALTHY',
        animalCategory: 'COW',
      },
    ];
    const onSelect = jest.fn();
    const h = syncHarness({ handler: server(enrichedCows) });
    await open(h, onSelect);
    await waitFor(() => expect(screen.getByTestId('cattle-row-c20')).toBeTruthy());

    // Initially collapsed (default mode shows only Health & Production, no Next event)
    expect(screen.queryByTestId('cattle-row-c20-expanded-details')).toBeNull();

    // Tap expand toggle: expands card without triggering onSelect
    const toggle = screen.getByTestId('cattle-row-c20-expand-toggle');
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
    fireEvent.press(toggle);

    expect(onSelect).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('cattle-row-c20-expanded-details')).toBeTruthy());
    const expanded = screen.getByTestId('cattle-row-c20-expanded-details');
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: true });
    expect(within(expanded).getByText('Lactation')).toBeTruthy();
    expect(within(expanded).getByText('Reproduction')).toBeTruthy();
    expect(within(expanded).getByText('Mid lactation')).toBeTruthy();
    expect(within(expanded).getByText('Pregnant')).toBeTruthy();
    expect(within(expanded).getByTestId('cattle-row-c20-no-event')).toBeTruthy();
    expect(within(expanded).getAllByText(/No pending/).length).toBeGreaterThanOrEqual(1);

    // Tap expand toggle again: collapses back
    fireEvent.press(toggle);
    expect(onSelect).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('cattle-row-c20-expanded-details')).toBeNull());
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });

    // Tapping bottom expand bar also expands card
    const expandBar = screen.getByTestId('cattle-row-c20-expand-bar');
    fireEvent.press(expandBar);
    await waitFor(() => expect(screen.getByTestId('cattle-row-c20-expanded-details')).toBeTruthy());

    // Tapping neutral area inside expanded details collapses it
    fireEvent.press(screen.getByTestId('cattle-row-c20-expanded-details'));
    await waitFor(() => expect(screen.queryByTestId('cattle-row-c20-expanded-details')).toBeNull());

    // Tapping card body calls onSelect
    fireEvent.press(screen.getByTestId('cattle-row-c20'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c20', tagNumber: 'BD-020' }));
  });

  it('opens upcoming events sheet on tapping next event chip without navigating, and view animal navigates', async () => {
    const cowsWithEvents = [
      {
        id: 'c30',
        tagNumber: 'BD-030',
        name: 'Lokkhi',
        gender: 'FEMALE',
        herdStatus: 'ACTIVE',
        next_event: {
          kind: 'TASK',
          title: 'Missing milk-log session',
          urgency: 'OVERDUE',
          actionable: true,
          daysUntil: -12,
          dueAt: '2026-11-03T00:00:00Z',
          labelKey: 'cattle.upcoming.task',
        },
        upcoming_event_count: 2,
      },
    ];
    const onSelect = jest.fn();
    const h = syncHarness({ handler: server(cowsWithEvents) });
    await open(h, onSelect);
    await waitFor(() => expect(screen.getByTestId('cattle-row-c30')).toBeTruthy());

    // Tap expand toggle to reveal next event row (shown in expanded mode)
    fireEvent.press(screen.getByTestId('cattle-row-c30-expand-toggle'));
    await waitFor(() => expect(screen.getByTestId('cattle-row-c30-expanded-details')).toBeTruthy());

    // Next event pill chip is visible in expanded mode
    const chip = screen.getByTestId('cattle-row-c30-next-event');
    expect(chip).toBeTruthy();
    expect(within(chip).getByText('Missing milk-log session')).toBeTruthy();
    expect(within(chip).getByText('12d overdue')).toBeTruthy();

    // Pressing chip does NOT navigate to animal detail
    fireEvent.press(chip);
    expect(onSelect).not.toHaveBeenCalled();

    // Upcoming events sheet modal opens
    await waitFor(() => expect(screen.getByTestId('upcoming-events-sheet')).toBeTruthy());
    expect(screen.getByText('Upcoming events')).toBeTruthy();
    expect(screen.getByText('Lokkhi (BD-030)')).toBeTruthy();

    // Clicking "View animal" button calls onSelect
    const viewBtn = screen.getByTestId('upcoming-events-sheet-view-animal-btn');
    fireEvent.press(viewBtn);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c30', tagNumber: 'BD-030' }));
  });

  it('supports multi-selection and bulk actions dock with modals', async () => {
    const h = syncHarness({ handler: server(cows) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('cattle-row-c1')).toBeTruthy());

    // Initially no bulk dock is visible
    expect(screen.queryByTestId('cattle-bulk-dock')).toBeNull();

    // Long-press cow 1 to enter selection mode and select it
    fireEvent(screen.getByTestId('cattle-row-c1'), 'longPress');
    await waitFor(() => expect(screen.getByTestId('cattle-select-check-c1')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('cattle-bulk-dock')).toBeTruthy());
    expect(screen.getByText('1 selected')).toBeTruthy();

    // Tap cow 2 and wait for count update
    fireEvent.press(screen.getByTestId('cattle-row-c2'));
    await waitFor(() => expect(screen.getByText('2 selected')).toBeTruthy());

    // Tap "Record event" opens BulkEventModal
    fireEvent.press(screen.getByTestId('bulk-action-record-event'));
    await waitFor(() => expect(screen.getByTestId('bulk-event-modal')).toBeTruthy());
    expect(screen.getByText('Record Event (2 animals)')).toBeTruthy();

    // Close bulk modal
    fireEvent.press(screen.getByTestId('bulk-cancel-btn'));
    await waitFor(() => expect(screen.queryByTestId('cattle-bulk-dock')).toBeNull());
  });
});
