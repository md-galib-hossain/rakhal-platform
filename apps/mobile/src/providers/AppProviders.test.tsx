import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockUseFonts = jest.fn<(...a: unknown[]) => [boolean, Error | null]>();
const mockPrevent = jest.fn<() => Promise<boolean>>();
const mockHide = jest.fn<() => Promise<boolean>>();

jest.mock('expo-font', () => ({ useFonts: (...a: unknown[]) => mockUseFonts(...a) }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: () => mockPrevent(),
  hideAsync: () => mockHide(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { memoryPrefs, PREF_KEYS, type PrefStorage } from '../storage/prefs.ts';
import { useToast } from '../components/feedback/Toast.tsx';
import { AppProviders } from './AppProviders.tsx';
import { useLocale } from './LocaleProvider.tsx';
import { useTheme } from './ThemeProvider.tsx';

beforeEach(() => {
  jest.clearAllMocks();
  mockPrevent.mockResolvedValue(true);
  mockHide.mockResolvedValue(true);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

/** A storage whose reads resolve only when released, to hold hydration open. */
function gatedPrefs(): { storage: PrefStorage; release: () => void } {
  const inner = memoryPrefs();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    storage: {
      async getItem(key) {
        await gate;
        return inner.getItem(key);
      },
      setItem: (key, value) => inner.setItem(key, value),
    },
    release,
  };
}

describe('AppProviders', () => {
  it('renders nothing and keeps the splash while fonts are loading', async () => {
    mockUseFonts.mockReturnValue([false, null]);
    await render(
      <AppProviders storage={memoryPrefs()}>
        <Text>content</Text>
      </AppProviders>,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('content')).toBeNull();
    expect(mockHide).not.toHaveBeenCalled();
  });

  it('renders nothing while prefs are hydrating even if fonts are loaded', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    const { storage, release } = gatedPrefs();
    await render(
      <AppProviders storage={storage}>
        <Text>content</Text>
      </AppProviders>,
    );
    expect(screen.queryByText('content')).toBeNull();
    expect(mockHide).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(screen.getByText('content')).toBeTruthy());
    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  it('renders children and hides the splash once fonts and prefs are ready', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    await render(
      <AppProviders storage={memoryPrefs()}>
        <Text>content</Text>
      </AppProviders>,
    );
    await waitFor(() => expect(screen.getByText('content')).toBeTruthy());
    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  it('provides useToast to ready children (ToastProvider is inside the gated tree)', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    function Probe() {
      return <Text>{typeof useToast().show}</Text>;
    }
    await render(
      <AppProviders storage={memoryPrefs()}>
        <Probe />
      </AppProviders>,
    );
    await waitFor(() => expect(screen.getByText('function')).toBeTruthy());
  });

  it('still renders on a font error (never bricks) and logs it', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUseFonts.mockReturnValue([false, new Error('boom')]);
    await render(
      <AppProviders storage={memoryPrefs()}>
        <Text>content</Text>
      </AppProviders>,
    );
    await waitFor(() => expect(screen.getByText('content')).toBeTruthy());
    expect(error).toHaveBeenCalled();
    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  it('reads storage once for both providers (Locale does not wait on Theme) and seeds each', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    const inner = memoryPrefs({ [PREF_KEYS.theme]: 'dark', [PREF_KEYS.locale]: 'en' });
    const getItem = jest.fn((key: string) => inner.getItem(key));
    function Probe() {
      const { scheme } = useTheme();
      const { locale } = useLocale();
      return <Text>{`${scheme}/${locale}`}</Text>;
    }
    await render(
      <AppProviders storage={{ getItem, setItem: inner.setItem }}>
        <Probe />
      </AppProviders>,
    );
    await waitFor(() => expect(screen.getByText('dark/en')).toBeTruthy());
    expect(getItem).toHaveBeenCalledTimes(3); // one loadPrefs = theme + locale + digits, once
  });

  describe('bounded hydration', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('falls back to defaults and still renders when storage.getItem never resolves', async () => {
      mockUseFonts.mockReturnValue([true, null]);
      const hung: PrefStorage = { getItem: () => new Promise<string | null>(() => {}), setItem: async () => {} };
      await render(
        <AppProviders storage={hung} hydrationTimeoutMs={1000}>
          <Text>content</Text>
        </AppProviders>,
      );
      expect(screen.queryByText('content')).toBeNull();
      expect(mockHide).not.toHaveBeenCalled();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1000);
      });
      expect(screen.getByText('content')).toBeTruthy();
      expect(mockHide).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('exceeded 1000ms'), undefined);
    });

    it('treats a font load that never settles as errored after the timeout, with a warning', async () => {
      mockUseFonts.mockReturnValue([false, null]);
      await render(
        <AppProviders storage={memoryPrefs()} hydrationTimeoutMs={1000}>
          <Text>content</Text>
        </AppProviders>,
      );
      await act(async () => {
        await jest.advanceTimersByTimeAsync(999);
      });
      expect(screen.queryByText('content')).toBeNull();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1);
      });
      expect(screen.getByText('content')).toBeTruthy();
      expect(mockHide).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[fonts] did not settle'));
    });
  });
});
