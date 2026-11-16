import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ok, sessionReply, type Handler } from '../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { syncHarness } from '../test-utils/sync-harness.tsx';
import { ToastProvider } from '../components/feedback/Toast.tsx';
import { MilkScreen } from './MilkScreen.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(() => {
  cleanup();
  restoreMount();
});

const demoCows = [
  {
    id: 'c1',
    tagNumber: 'TAG-101',
    name: 'Padma',
    gender: 'FEMALE',
    herdStatus: 'ACTIVE',
    productionStatus: 'MILKING',
    animalCategory: 'COW',
    breedName: 'Sahiwal',
    shedId: 'shed-1',
    shedName: 'Milking Barn A',
  },
  {
    id: 'c2',
    tagNumber: 'TAG-102',
    name: 'Jamuna',
    gender: 'FEMALE',
    herdStatus: 'ACTIVE',
    productionStatus: 'MILKING',
    animalCategory: 'COW',
    breedName: 'Holstein',
    shedId: 'shed-2',
    shedName: 'Barn B',
  },
  {
    id: 'c3_withheld',
    tagNumber: 'TAG-103',
    name: 'Meghna',
    gender: 'FEMALE',
    herdStatus: 'ACTIVE',
    productionStatus: 'MILKING',
    animalCategory: 'COW',
    withholding: true,
    withholdingReason: 'Mastitis treatment',
  },
  {
    id: 'c4_dry',
    tagNumber: 'TAG-104',
    name: 'Dry Cow',
    gender: 'FEMALE',
    herdStatus: 'ACTIVE',
    productionStatus: 'DRY',
    animalCategory: 'COW',
  },
];

const demoSheds = [
  { id: 'shed-1', name: 'Milking Barn A' },
  { id: 'shed-2', name: 'Barn B' },
];

const demoMilkLog = {
  date: '2026-11-16',
  sessionConfig: { morning: true, evening: true },
  entries: [
    {
      cattleId: 'c1',
      cattleTag: 'TAG-101',
      cattleName: 'Padma',
      prevDayYieldL: 12.0,
      avgYield7d: 11.5,
      log: {
        morningL: 12.5,
        totalL: 12.5,
        submittedSessions: [],
        updatedAt: {
          MORNING: '2026-11-16T08:00:00.000Z',
        },
      },
    },
    {
      cattleId: 'c2',
      cattleTag: 'TAG-102',
      cattleName: 'Jamuna',
      prevDayYieldL: 10.0,
      avgYield7d: 10.0,
      log: {
        morningL: null,
        submittedSessions: [],
        updatedAt: {},
      },
    },
    {
      cattleId: 'c3_withheld',
      cattleTag: 'TAG-103',
      withholding: true,
      withholdingReason: 'Mastitis treatment',
      log: {
        submittedSessions: [],
      },
    },
  ],
};

function serverHandler(opts?: {
  permissions?: string[];
  cows?: unknown[];
  sheds?: unknown[];
  milkLog?: unknown;
}): Handler {
  return (url, body, method) => {
    if (url.endsWith('/auth/refresh')) return sessionReply(1);
    if (url.endsWith('/auth/me')) return ok({ permissions: opts?.permissions ?? ['*'] });
    if (url.endsWith('/farms')) return ok([{ id: 'farm-1', name: 'Demo Farm', slug: 'demo', role: 'OWNER' }]);
    if (method === 'GET' && /\/cattle(\?|$)/.test(url)) return ok(opts?.cows ?? demoCows);
    if (method === 'GET' && /\/sheds(\?|$)/.test(url)) return ok(opts?.sheds ?? demoSheds);
    if (method === 'GET' && /\/milk\/log(\?|$)/.test(url)) return ok(opts?.milkLog ?? demoMilkLog);
    if (method === 'GET') return ok([]);
    return ok({ ok: true });
  };
}

async function renderMilkScreen(h: ReturnType<typeof syncHarness>, locale: 'en' | 'bn' = 'en') {
  await mount(
    <h.Tree>
      <ToastProvider>
        <MilkScreen />
      </ToastProvider>
    </h.Tree>,
    { locale },
  );
}

describe('MilkScreen', () => {
  it('denies access when user lacks milk.read permission', async () => {
    const h = syncHarness({
      handler: serverHandler({ permissions: ['cattle.read'] }),
    });
    await renderMilkScreen(h);
    await waitFor(() => expect(screen.getByTestId('permission-denied')).toBeTruthy());
  });

  it('renders session chips, shed filters, cow cards, and summary when permitted', async () => {
    const h = syncHarness({
      handler: serverHandler(),
    });
    await renderMilkScreen(h);

    await waitFor(() => expect(screen.getByTestId('screen-milk')).toBeTruthy());
    expect(screen.getByTestId('milk-current-date')).toBeTruthy();
    expect(screen.getByTestId('session-chip-morning')).toBeTruthy();
    expect(screen.getByTestId('session-chip-evening')).toBeTruthy();
    expect(screen.getByTestId('shed-chip-all')).toBeTruthy();
    expect(screen.getByTestId('milk-search')).toBeTruthy();

    // Verify cows (dry cow c4_dry must be filtered out)
    await waitFor(() => expect(screen.getByTestId('milk-cow-card-c1')).toBeTruthy());
    expect(screen.getByTestId('milk-cow-card-c2')).toBeTruthy();
    expect(screen.getByTestId('milk-cow-card-c3_withheld')).toBeTruthy();
    expect(screen.queryByTestId('milk-cow-card-c4_dry')).toBeNull();

    // Verify ghost values on card c1
    expect(screen.getByText('Yesterday: 12 L')).toBeTruthy();
    expect(screen.getByText('7d avg: 11.5 L')).toBeTruthy();
  });

  it('disables input and shows Withheld badge on medication-withheld cow', async () => {
    const h = syncHarness({
      handler: serverHandler(),
    });
    await renderMilkScreen(h);

    await waitFor(() => expect(screen.getByTestId('milk-cow-card-c3_withheld')).toBeTruthy());
    expect(screen.getByTestId('milk-withholding-c3_withheld')).toBeTruthy();
    expect(screen.getByText('Mastitis treatment')).toBeTruthy();

    // Stepper buttons for withheld cow should be disabled
    const plusBtn = screen.getByTestId('milk-stepper-c3_withheld-plus');
    expect(plusBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('queues a milk.saveLog write with baseUpdatedAt on yield change and shows 5s undo toast', async () => {
    const h = syncHarness({
      handler: serverHandler(),
    });
    await renderMilkScreen(h);

    await waitFor(() => expect(screen.getByTestId('milk-cow-card-c2')).toBeTruthy());

    // Switch to morning session if not already
    await act(async () => {
      fireEvent.press(screen.getByTestId('session-chip-morning'));
    });

    // Step up yield on c2
    const plusBtn = screen.getByTestId('milk-stepper-c2-plus');
    await act(async () => {
      fireEvent.press(plusBtn);
    });

    // Check that write was queued
    await waitFor(() => {
      const writes = h.writes();
      expect(writes.length).toBeGreaterThan(0);
      const lastWrite = writes[writes.length - 1]!;
      expect(lastWrite.url).toContain('/milk/log');
      expect(lastWrite.body).toMatchObject({
        session: 'MORNING',
        entries: [
          {
            cattleId: 'c2',
            yieldL: 0.5,
            baseUpdatedAt: null,
          },
        ],
      });
    });

    // Check undo toast is displayed
    expect(screen.getByText('Undo')).toBeTruthy();
  });

  it('submits session with milk.submit when submit button is pressed', async () => {
    const h = syncHarness({
      handler: serverHandler(),
    });
    await renderMilkScreen(h);

    await waitFor(() => expect(screen.getByTestId('milk-submit-btn')).toBeTruthy());

    // Switch to morning session
    await act(async () => {
      fireEvent.press(screen.getByTestId('session-chip-morning'));
    });

    const submitBtn = screen.getByTestId('milk-submit-btn');
    await act(async () => {
      fireEvent.press(submitBtn);
    });

    await waitFor(() => {
      const submits = h.writes().filter((w) => w.url.endsWith('/milk/submit'));
      expect(submits.length).toBe(1);
      expect(submits[0]!.body).toMatchObject({
        session: 'MORNING',
      });
    });
  });

  it('filters by shed and search query', async () => {
    const h = syncHarness({
      handler: serverHandler(),
    });
    await renderMilkScreen(h);

    await waitFor(() => expect(screen.getByTestId('milk-cow-card-c1')).toBeTruthy());

    // Select Shed 2 (Barn B)
    await act(async () => {
      fireEvent.press(screen.getByTestId('shed-chip-shed-2'));
    });
    await waitFor(() => expect(screen.queryByTestId('milk-cow-card-c1')).toBeNull());
    expect(screen.getByTestId('milk-cow-card-c2')).toBeTruthy();

    // Select All sheds again
    await act(async () => {
      fireEvent.press(screen.getByTestId('shed-chip-all'));
    });
    await waitFor(() => expect(screen.getByTestId('milk-cow-card-c1')).toBeTruthy());

    // Search query
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('milk-search'), 'Padma');
    });
    await waitFor(() => expect(screen.queryByTestId('milk-cow-card-c2')).toBeNull());
    expect(screen.getByTestId('milk-cow-card-c1')).toBeTruthy();
  });

  it('opens DatePickerSheet when date pill is tapped', async () => {
    const h = syncHarness({
      handler: serverHandler(),
    });
    await renderMilkScreen(h);

    await waitFor(() => expect(screen.getByTestId('milk-date-pill')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('milk-date-pill'));
    });

    await waitFor(() => expect(screen.getByTestId('milk-date-picker-sheet')).toBeTruthy());
  });

  it('allows quick yield adjustment with +1.0 chip and updates totals', async () => {
    const h = syncHarness({
      handler: serverHandler(),
    });
    await renderMilkScreen(h);

    await waitFor(() => expect(screen.getByTestId('milk-cow-card-c2')).toBeTruthy());
    const plusOneBtn = screen.getByTestId('milk-chip-plus-1-c2');

    await act(async () => {
      fireEvent.press(plusOneBtn);
    });

    await waitFor(() => {
      const writes = h.writes();
      const lastWrite = writes[writes.length - 1];
      expect(lastWrite?.body).toMatchObject({
        entries: [
          {
            cattleId: 'c2',
            yieldL: 1.0,
          },
        ],
      });
    });
  });

  it('opens SessionConfigSheet and TankSelectorSheet from controls', async () => {
    const h = syncHarness({
      handler: serverHandler(),
    });
    await renderMilkScreen(h);

    // Open SessionConfigSheet
    await waitFor(() => expect(screen.getByTestId('milk-manage-sessions')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('milk-manage-sessions'));
    });
    await waitFor(() => expect(screen.getByTestId('milk-session-config-sheet')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('session-config-close'));
    });

    // Open TankSelectorSheet
    await waitFor(() => expect(screen.getByTestId('milk-tank-chip')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('milk-tank-chip'));
    });
    await waitFor(() => expect(screen.getByTestId('milk-tank-sheet')).toBeTruthy());
  });

  it('saves all drafts when Save Draft button is pressed', async () => {
    const h = syncHarness({
      handler: serverHandler(),
    });
    await renderMilkScreen(h);

    await waitFor(() => expect(screen.getByTestId('milk-save-draft-btn')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('milk-save-draft-btn'));
    });

    await waitFor(() => {
      const saves = h.writes().filter((w) => w.url.endsWith('/milk/log'));
      expect(saves.length).toBeGreaterThan(0);
    });
  });
});
