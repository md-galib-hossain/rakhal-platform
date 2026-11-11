import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { Appearance, Text, useColorScheme } from 'react-native';
import { Component, type ReactNode } from 'react';
import { memoryPrefs, PREF_KEYS, type PrefStorage } from '../storage/prefs.ts';
import { asyncStoragePrefs } from '../storage/async-storage-prefs.ts';
import { allColors } from '../theme/tokens.ts';
import { ThemeProvider, themeTokens, useTheme, type ThemeValue } from './ThemeProvider.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let system: 'light' | 'dark' | null | undefined = 'light';
let setColorSchemeSpy: jest.SpiedFunction<typeof Appearance.setColorScheme>;

beforeEach(() => {
  system = 'light';
  // jest-expo mocks useColorScheme as a jest.fn(); drive it from `system`.
  (useColorScheme as jest.Mock<() => unknown>).mockImplementation(() => system);
  setColorSchemeSpy = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Let the async hydration (three storage reads) finish inside act. */
async function settle() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

function wrapperFor(storage: PrefStorage) {
  return ({ children }: { children: React.ReactNode }) => <ThemeProvider storage={storage}>{children}</ThemeProvider>;
}

async function mountTheme(storage: PrefStorage = memoryPrefs()) {
  const view = await renderHook(() => useTheme(), { wrapper: wrapperFor(storage) });
  // Children mount only after hydration; wait for it.
  await waitFor(() => expect(view.result.current).not.toBeNull());
  return view;
}

describe('ThemeProvider', () => {
  it('defaults to the system preference and resolves a light OS to light', async () => {
    const { result } = await mountTheme();
    expect(result.current.preference).toBe('system');
    expect(result.current.scheme).toBe('light');
    expect(result.current.isDark).toBe(false);
    expect(result.current.colors).toBe(allColors.light);
    expect(result.current.colors.background).toBe(allColors.light.background);
  });

  it('follows a dark OS scheme in system mode and exposes mobile-only tokens', async () => {
    system = 'dark';
    const { result } = await mountTheme();
    expect(result.current.scheme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(result.current.colors).toBe(allColors.dark);
    for (const name of Object.keys(allColors.dark)) expect(result.current.colors).toHaveProperty(name);
  });

  it('treats a null OS scheme as light', async () => {
    system = null;
    const { result } = await mountTheme();
    expect(result.current.scheme).toBe('light');
  });

  it('exposes the non-colour tokens', async () => {
    const { result } = await mountTheme();
    expect(result.current.tokens).toBe(themeTokens);
    expect(result.current.tokens.radius.md).toBe(10);
    expect(result.current.tokens.spacing.lg).toBe(16);
    expect(result.current.tokens.touchTarget.min).toBe(48);
    expect(result.current.tokens.elevation.card.elevation).toBe(1);
    expect(result.current.tokens.type.textStyle('body', 'latin').fontSize).toBeGreaterThan(0);
  });

  it('an explicit stored preference overrides the OS scheme', async () => {
    system = 'light';
    const { result } = await mountTheme(memoryPrefs({ [PREF_KEYS.theme]: 'dark' }));
    expect(result.current.preference).toBe('dark');
    expect(result.current.scheme).toBe('dark');
    system = 'dark';
  });

  it('an explicit light preference beats a dark OS', async () => {
    system = 'dark';
    const { result } = await mountTheme(memoryPrefs({ [PREF_KEYS.theme]: 'light' }));
    expect(result.current.scheme).toBe('light');
  });

  it('a corrupt stored value falls back to system', async () => {
    system = 'dark';
    const { result } = await mountTheme(memoryPrefs({ [PREF_KEYS.theme]: '{"oops":1}' }));
    expect(result.current.preference).toBe('system');
    expect(result.current.scheme).toBe('dark');
  });

  it('a failing storage read does not block: defaults to system', async () => {
    const broken: PrefStorage = {
      getItem: () => Promise.reject(new Error('disk')),
      setItem: () => Promise.reject(new Error('disk')),
    };
    const { result } = await mountTheme(broken);
    expect(result.current.preference).toBe('system');
    expect(result.current.scheme).toBe('light');
    // and a failing write still changes the UI state
    await act(async () => {
      result.current.setPreference('dark');
    });
    expect(result.current.scheme).toBe('dark');
  });

  it('renders nothing (or the fallback) until the stored preference is read, then reports hydration once', async () => {
    // loadPrefs reads three keys in parallel; hold all of them.
    const pending: ((v: string | null) => void)[] = [];
    const release = (v: string | null) => pending.forEach((resolve) => resolve(v));
    const slow: PrefStorage = {
      getItem: () => new Promise((resolve) => pending.push(resolve)),
      setItem: async () => {},
    };
    const onHydrated = jest.fn();
    await render(
      <ThemeProvider storage={slow} fallback={<Text>loading</Text>} onHydrated={onHydrated}>
        <Text>ready</Text>
      </ThemeProvider>,
    );
    expect(screen.queryByText('ready')).toBeNull();
    expect(screen.getByText('loading')).toBeTruthy();
    expect(onHydrated).not.toHaveBeenCalled();
    await act(async () => {
      release(null);
    });
    expect(screen.getByText('ready')).toBeTruthy();
    expect(onHydrated).toHaveBeenCalledTimes(1);
  });

  it('setPreference updates consumers immediately and persists', async () => {
    const storage = memoryPrefs();
    const { result } = await mountTheme(storage);
    await act(async () => {
      result.current.setPreference('dark');
    });
    expect(result.current.preference).toBe('dark');
    expect(result.current.scheme).toBe('dark');
    expect(result.current.colors).toBe(allColors.dark);
    expect(storage.dump()[PREF_KEYS.theme]).toBe('dark');
    expect(setColorSchemeSpy).toHaveBeenLastCalledWith('dark');

    await act(async () => {
      result.current.setPreference('system');
    });
    expect(result.current.scheme).toBe('light');
    expect(storage.dump()[PREF_KEYS.theme]).toBe('system');
    expect(setColorSchemeSpy).toHaveBeenLastCalledWith('unspecified');
  });

  it('round-trips through the AsyncStorage mock across a remount', async () => {
    await AsyncStorage.clear();
    const first = await mountTheme(asyncStoragePrefs);
    await act(async () => {
      first.result.current.setPreference('dark');
    });
    expect(await AsyncStorage.getItem(PREF_KEYS.theme)).toBe('dark');
    await first.unmount();

    system = 'light';
    const second = await mountTheme(asyncStoragePrefs);
    expect(second.result.current.preference).toBe('dark');
    expect(second.result.current.scheme).toBe('dark');
  });

  it('keeps setPreference and the context value stable across unrelated parent re-renders', async () => {
    const storage = memoryPrefs();
    const seen: ThemeValue[] = [];
    function Probe() {
      seen.push(useTheme());
      return null;
    }
    const tree = (tick: number) => (
      <ThemeProvider storage={storage}>
        <Text>{tick}</Text>
        <Probe />
      </ThemeProvider>
    );
    const view = await render(tree(0));
    await settle();
    expect(seen.length).toBeGreaterThan(0);
    const before = seen[seen.length - 1];
    await view.rerender(tree(1));
    const after = seen[seen.length - 1];
    expect(after).toBe(before);
    expect(after.setPreference).toBe(before.setPreference);
  });

  it('re-renders a consumer only when the preference changes, not when it is set to the same value', async () => {
    const storage = memoryPrefs();
    let renders = 0;
    let api: ThemeValue | undefined;
    function Probe() {
      api = useTheme();
      renders += 1;
      return null;
    }
    await render(
      <ThemeProvider storage={storage}>
        <Probe />
      </ThemeProvider>,
    );
    await settle();
    expect(api).toBeDefined();
    const base = renders;
    await act(async () => {
      api?.setPreference('system');
    });
    expect(renders).toBe(base);
    await act(async () => {
      api?.setPreference('dark');
    });
    expect(renders).toBe(base + 1);
  });
});

describe('useTheme', () => {
  it('throws a clear error outside the provider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let caught: unknown;
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
      state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch(error: unknown) {
        caught = error;
      }
      render() {
        return this.state.failed ? null : this.props.children;
      }
    }
    function Orphan() {
      useTheme();
      return null;
    }
    await render(
      <Boundary>
        <Orphan />
      </Boundary>,
    );
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/useTheme must be used inside <ThemeProvider>/);
    spy.mockRestore();
  });
});
