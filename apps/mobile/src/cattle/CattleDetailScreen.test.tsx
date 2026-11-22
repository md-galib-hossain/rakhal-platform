import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { fail, ok, sessionReply, type Handler, type Reply } from '../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { syncHarness } from '../test-utils/sync-harness.tsx';
import { CattleDetailScreen } from './CattleDetailScreen.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => ({ id: 'c1' }),
}));

const router = (jest.requireMock('expo-router') as { router: { back: jest.Mock; replace: jest.Mock; canGoBack: jest.Mock } }).router;

beforeEach(() => {
  router.back.mockClear();
  router.replace.mockClear();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  restoreMount();
});

const row = {
  id: 'c1',
  tagNumber: 'BD-001',
  name: 'Rupa',
  gender: 'FEMALE',
  herdStatus: 'ACTIVE',
  productionStatus: 'MILKING',
  healthStatus: 'HEALTHY',
  animalCategory: 'COW',
  dateOfBirth: '2022-10-07T16:00:00.000Z',
  breed: { name: 'Sahiwal' },
};
const profile = {
  ...row,
  shed: { id: 's1', name: 'Shed A' },
  mother: { id: 'm1', tagNumber: 'BD-000', name: 'Old Cow' },
  father: null,
  age: { years: 4, months: 1 },
  childrenCount: 2,
  lastWeightKg: 410,
  aqrScore: 12,
};
const overview = { avg_daily_yield_7d: 14.5, last_weight_kg: 420, aqr_score: 20 };

function server(detail: { profile?: Reply; overview?: Reply }): Handler {
  return (url, _body, method) => {
    if (url.endsWith('/auth/refresh')) return sessionReply(1);
    if (url.endsWith('/auth/me')) return ok({ permissions: ['*'] });
    if (url.endsWith('/farms')) return ok([{ id: 'farm-1', name: 'Green Valley', slug: 'gv', role: 'OWNER' }]);
    if (url.includes('/cattle/c1/profile')) return detail.profile ?? ok(profile);
    if (url.includes('/cattle/c1/overview')) return detail.overview ?? ok(overview);
    if (method === 'GET' && /\/cattle(\?|$)/.test(url)) return ok([row]);
    if (method === 'GET') return ok([]);
    return ok({ ok: true });
  };
}

async function open(h: ReturnType<typeof syncHarness>, locale: 'en' | 'bn' = 'en') {
  await mount(
    <h.Tree>
      <CattleDetailScreen />
    </h.Tree>,
    { locale },
  );
}

describe('CattleDetailScreen', () => {
  it('shows the live profile and overview', async () => {
    const h = syncHarness({ handler: server({}) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('detail-yield')).toBeTruthy());
    expect(screen.getByText('Rupa')).toBeTruthy();
    expect(screen.getByText('BD-001')).toBeTruthy();
    expect(screen.getByText('Shed A')).toBeTruthy();
    expect(screen.getByText('BD-000 · Old Cow')).toBeTruthy();
    expect(screen.getByText('14.5 L')).toBeTruthy();
    expect(screen.getByText('4 yr 1 mo')).toBeTruthy();
    expect(screen.getByText('Milking')).toBeTruthy();
    expect(screen.queryByTestId('detail-offline')).toBeNull();
  });

  it('switches between workspace tabs and interacts with the floating action button', async () => {
    const h = syncHarness({ handler: server({}) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('section-switcher')).toBeTruthy());

    // Initially on Overview
    expect(screen.getByTestId('tab-overview')).toBeTruthy();
    expect(screen.getByTestId('card-at-a-glance')).toBeTruthy();

    // Switch to Timeline
    fireEvent.press(screen.getByTestId('switcher-tab-timeline'));
    await waitFor(() => expect(screen.getByTestId('tab-timeline')).toBeTruthy());

    // Switch to Feeding
    fireEvent.press(screen.getByTestId('switcher-tab-feeding'));
    await waitFor(() => expect(screen.getByTestId('tab-feeding')).toBeTruthy());

    // Switch to Family
    fireEvent.press(screen.getByTestId('switcher-tab-family'));
    await waitFor(() => expect(screen.getByTestId('tab-family')).toBeTruthy());

    // Switch to Money
    fireEvent.press(screen.getByTestId('switcher-tab-money'));
    await waitFor(() => expect(screen.getByTestId('tab-money')).toBeTruthy());

    // Sticky floating action bar
    expect(screen.getByTestId('sticky-floating-bar')).toBeTruthy();
    fireEvent.press(screen.getByTestId('record-event-floating-btn'));
    await waitFor(() => expect(screen.getByTestId('record-event-modal')).toBeTruthy());
    fireEvent.press(screen.getByTestId('picker-close-btn'));
    await waitFor(() => expect(screen.queryByTestId('record-event-modal')).toBeNull());
  });

  it('offline: keeps the cached animal and says it is offline with the last-updated time', async () => {
    const h = syncHarness({ handler: server({ profile: 'network', overview: 'network' }) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('detail-offline')).toBeTruthy());
    expect(screen.getByText('Rupa')).toBeTruthy();
    expect(screen.getByText('BD-001')).toBeTruthy();
    expect(screen.queryByTestId('detail-yield')).toBeNull();
  });

  it('a server error keeps the cached animal with a "could not load the latest" notice', async () => {
    const h = syncHarness({ handler: server({ profile: fail(500, 'boom') }) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('detail-failed')).toBeTruthy());
    expect(screen.getByText('Rupa')).toBeTruthy();
    expect(screen.getByText('BD-001')).toBeTruthy();
  });

  it('a 404 means the animal is gone, even if an old row is cached', async () => {
    const h = syncHarness({ handler: server({ profile: fail(404, 'Cattle not found') }) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('detail-not-found')).toBeTruthy());
  });

  it('only the overview failing still shows the profile', async () => {
    const h = syncHarness({ handler: server({ overview: fail(500) }) });
    await open(h);
    await waitFor(() => expect(screen.getByText('Shed A')).toBeTruthy());
    expect(screen.queryByTestId('detail-yield')).toBeNull();
    expect(screen.queryByTestId('detail-offline')).toBeNull();
  });

  it('shows Bangla labels', async () => {
    const h = syncHarness({ handler: server({}) });
    await open(h, 'bn');
    await waitFor(() => expect(screen.getByText('দুধ দিচ্ছে')).toBeTruthy());
    expect(screen.getByLabelText('ফিরে যান')).toBeTruthy();
  });

  it('Back goes back; with no history it goes to the cattle list', async () => {
    const h = syncHarness({ handler: server({}) });
    await open(h);
    await waitFor(() => expect(screen.getByTestId('detail-back')).toBeTruthy());
    fireEvent.press(screen.getByTestId('detail-back'));
    expect(router.back).toHaveBeenCalled();
    router.canGoBack.mockReturnValueOnce(false);
    fireEvent.press(screen.getByTestId('detail-back'));
    expect(router.replace).toHaveBeenCalledWith('/cattle');
  });
});
