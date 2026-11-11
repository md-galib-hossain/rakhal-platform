import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { Component, type ReactNode } from 'react';
import { Text } from 'react-native';
import { useFormat } from '../i18n/useFormat.ts';
import { asyncStoragePrefs } from '../storage/async-storage-prefs.ts';
import { memoryPrefs, PREF_KEYS, type PrefStorage } from '../storage/prefs.ts';
import { LocaleProvider, useLocale, type LocaleValue } from './LocaleProvider.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let warn: jest.SpiedFunction<typeof console.warn>;

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function settle() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

function wrapperFor(storage: PrefStorage) {
  return ({ children }: { children: ReactNode }) => <LocaleProvider storage={storage}>{children}</LocaleProvider>;
}

async function mountLocale(storage: PrefStorage = memoryPrefs()) {
  const view = await renderHook(() => useLocale(), { wrapper: wrapperFor(storage) });
  await waitFor(() => expect(view.result.current).not.toBeNull());
  return view;
}

async function mountFormat(storage: PrefStorage = memoryPrefs()) {
  const view = await renderHook(() => ({ locale: useLocale(), format: useFormat() }), { wrapper: wrapperFor(storage) });
  await waitFor(() => expect(view.result.current).not.toBeNull());
  return view;
}

describe('LocaleProvider', () => {
  it('defaults to bn, latn digits and the bengali script', async () => {
    const { result } = await mountLocale();
    expect(result.current.locale).toBe('bn');
    expect(result.current.digits).toBe('latn');
    expect(result.current.script).toBe('bengali');
    expect(result.current.t('common.ok')).toBe('ঠিক আছে');
  });

  it('switches to en instantly (same act), updates script and t, and persists', async () => {
    const storage = memoryPrefs();
    const { result } = await mountLocale(storage);
    await act(async () => {
      result.current.setLocale('en');
    });
    expect(result.current.locale).toBe('en');
    expect(result.current.script).toBe('latin');
    expect(result.current.t('common.ok')).toBe('OK');
    expect(storage.dump()[PREF_KEYS.locale]).toBe('en');
  });

  it('setDigits updates instantly and persists', async () => {
    const storage = memoryPrefs();
    const { result } = await mountLocale(storage);
    await act(async () => {
      result.current.setDigits('beng');
    });
    expect(result.current.digits).toBe('beng');
    expect(storage.dump()[PREF_KEYS.digits]).toBe('beng');
  });

  it('restores stored locale and digits', async () => {
    const { result } = await mountLocale(memoryPrefs({ [PREF_KEYS.locale]: 'en', [PREF_KEYS.digits]: 'beng' }));
    expect(result.current.locale).toBe('en');
    expect(result.current.digits).toBe('beng');
  });

  it('round-trips through the AsyncStorage mock across a remount', async () => {
    await AsyncStorage.clear();
    const first = await mountLocale(asyncStoragePrefs);
    await act(async () => {
      first.result.current.setLocale('en');
      first.result.current.setDigits('beng');
    });
    expect(await AsyncStorage.getItem(PREF_KEYS.locale)).toBe('en');
    expect(await AsyncStorage.getItem(PREF_KEYS.digits)).toBe('beng');
    await first.unmount();

    const second = await mountLocale(asyncStoragePrefs);
    expect(second.result.current.locale).toBe('en');
    expect(second.result.current.digits).toBe('beng');
  });

  it('corrupt stored values fall back to bn / latn', async () => {
    const { result } = await mountLocale(memoryPrefs({ [PREF_KEYS.locale]: 'fr', [PREF_KEYS.digits]: '{"x":1}' }));
    expect(result.current.locale).toBe('bn');
    expect(result.current.digits).toBe('latn');
  });

  it('a failing storage never blocks: defaults, and a failing write still changes the UI', async () => {
    const broken: PrefStorage = {
      getItem: () => Promise.reject(new Error('disk')),
      setItem: () => Promise.reject(new Error('disk')),
    };
    const { result } = await mountLocale(broken);
    expect(result.current.locale).toBe('bn');
    await act(async () => {
      result.current.setLocale('en');
    });
    expect(result.current.locale).toBe('en');
  });

  it('renders nothing (or the fallback) until hydrated, then reports hydration once', async () => {
    const pending: ((v: string | null) => void)[] = [];
    const slow: PrefStorage = {
      getItem: () => new Promise((resolve) => pending.push(resolve)),
      setItem: async () => {},
    };
    const onHydrated = jest.fn();
    await render(
      <LocaleProvider storage={slow} fallback={<Text>loading</Text>} onHydrated={onHydrated}>
        <Text>ready</Text>
      </LocaleProvider>,
    );
    expect(screen.queryByText('ready')).toBeNull();
    expect(screen.getByText('loading')).toBeTruthy();
    expect(onHydrated).not.toHaveBeenCalled();
    await act(async () => {
      pending.forEach((resolve) => resolve(null));
    });
    expect(screen.getByText('ready')).toBeTruthy();
    expect(onHydrated).toHaveBeenCalledTimes(1);
  });

  it('re-renders a mounted consumer when the locale changes', async () => {
    const storage = memoryPrefs();
    let api: LocaleValue | undefined;
    function Probe() {
      api = useLocale();
      return <Text>{api.t('common.cancel')}</Text>;
    }
    await render(
      <LocaleProvider storage={storage}>
        <Probe />
      </LocaleProvider>,
    );
    await settle();
    expect(screen.getByText('বাতিল')).toBeTruthy();
    await act(async () => {
      api?.setLocale('en');
    });
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.queryByText('বাতিল')).toBeNull();
  });

  it('keeps the context value stable across unrelated parent re-renders and same-value sets', async () => {
    const storage = memoryPrefs();
    const seen: LocaleValue[] = [];
    function Probe() {
      seen.push(useLocale());
      return null;
    }
    const tree = (tick: number) => (
      <LocaleProvider storage={storage}>
        <Text>{tick}</Text>
        <Probe />
      </LocaleProvider>
    );
    const view = await render(tree(0));
    await settle();
    const before = seen[seen.length - 1] as LocaleValue;
    await view.rerender(tree(1));
    expect(seen[seen.length - 1]).toBe(before);
    const count = seen.length;
    await act(async () => {
      before.setLocale('bn');
    });
    expect(seen.length).toBe(count);
  });

  it('t warns in dev and falls back for a missing key; never throws', async () => {
    const { result } = await mountLocale();
    expect(result.current.t('not.a.key' as never)).toBe('not.a.key');
    expect(warn).toHaveBeenCalled();
  });

  it('t interpolates named params', async () => {
    const { result } = await mountLocale(memoryPrefs({ [PREF_KEYS.locale]: 'en' }));
    expect(result.current.t('gallery.herdCount', { count: 3 })).toBe('3 cows in the herd');
  });
});

describe('useFormat', () => {
  it('money(1250000) is ৳12,50,000 in latn for both locales', async () => {
    const bn = await mountFormat();
    expect(bn.result.current.format.money(1250000)).toBe('৳12,50,000');
    await act(async () => {
      bn.result.current.locale.setLocale('en');
    });
    expect(bn.result.current.format.money(1250000)).toBe('৳12,50,000');
  });

  it('switching digits to beng changes the output instantly', async () => {
    const { result } = await mountFormat();
    await act(async () => {
      result.current.locale.setDigits('beng');
    });
    expect(result.current.format.money(1250000)).toBe('৳১২,৫০,০০০');
    expect(result.current.format.number(1234567)).toBe('১২,৩৪,৫৬৭');
  });

  it('date/dateTime follow locale and digits', async () => {
    const at = Date.UTC(2026, 10, 11, 18, 30);
    const { result } = await mountFormat(memoryPrefs({ [PREF_KEYS.locale]: 'en' }));
    expect(result.current.format.date(at)).toBe('12 Nov, 2026');
    expect(result.current.format.dateTime(at)).toBe('12 Nov, 2026, 00:30');
    await act(async () => {
      result.current.locale.setLocale('bn');
      result.current.locale.setDigits('beng');
    });
    expect(result.current.format.date(at)).toMatch(/^[০-৯]+ /);
  });

  it('is memoised: same object until locale or digits change', async () => {
    const { result, rerender } = await mountFormat();
    const first = result.current.format;
    await rerender({});
    expect(result.current.format).toBe(first);
    await act(async () => {
      result.current.locale.setDigits('beng');
    });
    expect(result.current.format).not.toBe(first);
  });
});

describe('useLocale', () => {
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
      useLocale();
      return null;
    }
    await render(
      <Boundary>
        <Orphan />
      </Boundary>,
    );
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/useLocale must be used inside <LocaleProvider>/);
    spy.mockRestore();
  });

  it('useFormat also throws outside the provider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(async () => {
      await renderHook(() => useFormat());
    }).rejects.toThrow(/useLocale must be used inside/);
    spy.mockRestore();
  });
});
