import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import TabsLayout from '../../app/(tabs)/_layout.tsx';
import { fakeApi, ok, sessionReply, type Handler } from '../test-utils/auth-harness.tsx';
import { mount, restoreMount } from '../test-utils/mount.tsx';
import { LAST_TAB_KEY } from './useLastTab.ts';

let mockPathname = '/';
const mockSwitch = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  router: {
    replace: (...a: unknown[]) => mockReplace(...a),
    push: (...a: unknown[]) => mockPush(...a),
  },
  usePathname: () => mockPathname,
}));
// The headless tab primitives need a real navigator; stub them so the shell's own logic (which tabs, labels, state)
// is what is under test. TabTrigger mimics `asChild`: it hands its child `isFocused` and `onPress`.
jest.mock('expo-router/ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native') as typeof import('react-native');
  return {
    Tabs: ({ children }: { children: React.ReactNode }) => React.createElement(View, { testID: 'tabs' }, children),
    TabSlot: () => React.createElement(View, { testID: 'tab-slot' }),
    TabList: ({ children, accessibilityLabel }: { children: React.ReactNode; accessibilityLabel?: string }) =>
      React.createElement(View, { testID: 'tab-list', accessibilityLabel }, children),
    TabTrigger: ({ children, name }: { children: React.ReactElement; name: string }) =>
      React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        isFocused: name === 'index',
        onPress: () => mockSwitch(name),
      }),
  };
});

beforeEach(async () => {
  mockPathname = '/';
  mockSwitch.mockClear();
  mockReplace.mockClear();
  mockPush.mockClear();
  await AsyncStorage.clear();
});
afterEach(restoreMount);

const farms = [{ id: 'farm-1', name: 'Green Valley', slug: 'green-valley', role: 'OWNER' }];
const handler =
  (permissions: string[]): Handler =>
  (url) => {
    if (url.endsWith('/auth/refresh')) return sessionReply(1);
    if (url.endsWith('/auth/me')) return ok({ permissions });
    if (url.endsWith('/farms')) return ok(farms);
    return ok({});
  };

async function open(h: Handler, locale: 'en' | 'bn' = 'en') {
  const api = fakeApi(h, { refreshToken: 'refresh-0', farmId: 'farm-1' });
  await mount(
    <api.Wrapper>
      <TabsLayout />
    </api.Wrapper>,
    { locale },
  );
  return api;
}

const tabIds = () => ['home', 'cattle', 'milk', 'tasks', 'more'].filter((k) => screen.queryByTestId(`tab-${k}`) !== null);

describe('tabs shell', () => {
  it('owner (*) sees all five tabs in PRD order, Home selected', async () => {
    await open(handler(['*']));
    await waitFor(() => expect(tabIds()).toEqual(['home', 'cattle', 'milk', 'tasks', 'more']));
    expect(screen.getByTestId('tab-home').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('tab-milk').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByTestId('tab-list').props.accessibilityLabel).toBe('Main menu');
  });

  it('a worker with only milk and task permissions sees no Cattle tab', async () => {
    await open(handler(['milk.read', 'milk.log', 'task.read']));
    await waitFor(() => expect(tabIds()).toEqual(['home', 'milk', 'tasks', 'more']));
  });

  it('permissions unknown (offline, no cache): only Home and More, never a guess', async () => {
    await open(() => 'network');
    await waitFor(() => expect(tabIds()).toEqual(['home', 'more']));
  });

  it('pressing a tab asks the navigator to switch to its route', async () => {
    await open(handler(['*']));
    await act(async () => {
      fireEvent.press(await screen.findByTestId('tab-milk'));
    });
    expect(mockSwitch).toHaveBeenCalledWith('milk');
  });

  it('labels follow the language', async () => {
    await open(handler(['*']), 'bn');
    expect(await screen.findByLabelText('গরু')).toBeTruthy();
    expect(screen.getByLabelText('দুধ')).toBeTruthy();
  });

  it('every tab is at least 56dp high', async () => {
    await open(handler(['*']));
    const tab = await screen.findByTestId('tab-home');
    const style = Object.assign({}, ...[tab.props.style].flat(5).filter(Boolean)) as { minHeight?: number };
    expect(style.minHeight).toBeGreaterThanOrEqual(56);
  });
});

describe('header', () => {
  it('renders the app brand name and notification button in English', async () => {
    await open(handler(['*']));
    expect(await screen.findByText('Rakhal')).toBeTruthy();
    const bell = screen.getByTestId('header-notifications');
    expect(bell).toBeTruthy();
    expect(bell.props.accessibilityRole).toBe('button');
    expect(bell.props.accessibilityLabel).toBe('Notifications');
  });

  it('renders the app brand name and notification button in Bangla', async () => {
    await open(handler(['*']), 'bn');
    expect(await screen.findByText('রাখাল')).toBeTruthy();
    const bell = screen.getByTestId('header-notifications');
    expect(bell).toBeTruthy();
    expect(bell.props.accessibilityLabel).toBe('বিজ্ঞপ্তি');
  });
});

describe('last tab', () => {
  it('relaunching on Home restores the stored tab once permissions are known', async () => {
    await AsyncStorage.setItem(LAST_TAB_KEY, '/milk');
    await open(handler(['*']));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/milk'));
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('never restores a tab the account does not have', async () => {
    await AsyncStorage.setItem(LAST_TAB_KEY, '/cattle');
    await open(handler(['milk.read']));
    await waitFor(() => expect(tabIds()).toContain('milk'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect when the app was opened on another tab (deep link)', async () => {
    mockPathname = '/tasks';
    await AsyncStorage.setItem(LAST_TAB_KEY, '/milk');
    await open(handler(['*']));
    await waitFor(() => expect(tabIds()).toContain('tasks'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('saves the visited tab after the restore decision', async () => {
    mockPathname = '/tasks';
    await open(handler(['*']));
    await waitFor(async () => expect(await AsyncStorage.getItem(LAST_TAB_KEY)).toBe('/tasks'));
  });
});
