import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { memoryPrefs, PREF_KEYS } from './storage/prefs.ts';
import { LocaleProvider } from './providers/LocaleProvider.tsx';
import { ThemeProvider } from './providers/ThemeProvider.tsx';
import Gallery from '../app/dev/gallery.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native') as typeof import('react-native');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react') as typeof import('react');
    return React.createElement(Text, null, `redirect:${href}`);
  },
}));

const g = globalThis as unknown as { __DEV__: boolean };
const originalDev = g.__DEV__;

beforeEach(() => {
  (useColorScheme as jest.Mock<() => unknown>).mockImplementation(() => 'light');
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  g.__DEV__ = originalDev;
  jest.restoreAllMocks();
});

const INSETS = { top: 40, bottom: 24, left: 0, right: 0 };

async function mount(theme: 'light' | 'dark', locale: 'bn' | 'en') {
  const themeStore = memoryPrefs({ [PREF_KEYS.theme]: theme });
  const localeStore = memoryPrefs({ [PREF_KEYS.locale]: locale });
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 800 }, insets: INSETS }}>
      <ThemeProvider storage={themeStore}>
        <LocaleProvider storage={localeStore}>
          <Gallery />
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.getByText(locale === 'bn' ? 'ডিজাইন গ্যালারি' : 'Design gallery')).toBeTruthy());
}

describe('dev gallery', () => {
  it.each([
    ['light', 'bn'],
    ['light', 'en'],
    ['dark', 'bn'],
    ['dark', 'en'],
  ] as const)('renders in %s theme, %s locale', async (theme, locale) => {
    await mount(theme, locale);
    expect(screen.getByText('৳12,50,000')).toBeTruthy();
    expect(screen.getByText('৳1,00,000')).toBeTruthy();
    expect(screen.getByText('৳-12,34,567')).toBeTruthy();
    expect(screen.getAllByText('দুগ্ধ উৎপাদন ক্ষমতা').length).toBeGreaterThan(0);
    expect(screen.getByText(/PixelRatio\.getFontScale\(\) = /)).toBeTruthy();
  });

  it('pads the scroll content by the safe-area insets', async () => {
    await mount('light', 'en');
    const style = StyleSheet.flatten(screen.getByTestId('gallery-scroll').props.contentContainerStyle) as {
      paddingTop: number;
      paddingBottom: number;
    };
    expect(style.paddingTop).toBeGreaterThan(INSETS.top);
    expect(style.paddingBottom).toBeGreaterThan(INSETS.bottom);
  });

  it('runs the formatter self-test and the Intl probe on demand', async () => {
    await mount('light', 'en');
    await fireEvent.press(screen.getByText('Run golden vectors'));
    await waitFor(() => expect(screen.getByText(/^\d+ \/ \d+ passed$/)).toBeTruthy());
    await fireEvent.press(screen.getByText('Run Intl probe'));
    await waitFor(() => expect(screen.getByText(/^en-IN: /)).toBeTruthy());
  });

  it('switches digits to Bangla and font scale without crashing', async () => {
    await mount('light', 'en');
    await fireEvent.press(screen.getByText('১ ২ ৩ (Bangla)'));
    await waitFor(() => expect(screen.getByText('৳১২,৫০,০০০')).toBeTruthy());
    await fireEvent.press(screen.getByText('2.0x'));
    await act(async () => {});
    expect(screen.getByText('৳১২,৫০,০০০')).toBeTruthy();
  });

  it('redirects home outside __DEV__', async () => {
    g.__DEV__ = false;
    await render(<Gallery />);
    expect(screen.getByText('redirect:/')).toBeTruthy();
  });
});
