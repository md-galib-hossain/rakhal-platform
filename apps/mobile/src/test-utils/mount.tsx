/**
 * Shared Jest mount helper for WP3 component tests (spec section 4). Wraps the UI in the real ThemeProvider and
 * LocaleProvider (in-memory prefs), forces the colour scheme, and fakes the SYSTEM font scale the way
 * Text.test.tsx does (Dimensions.get -> fontScale, which useWindowDimensions reads).
 *
 *   const view = await mount(<Button .../>, { scheme: 'dark', locale: 'bn', fontScale: 2 });
 *
 * The test file itself must mock AsyncStorage (jest.mock is hoisted per file, like Text.test.tsx does):
 *   jest.mock('@react-native-async-storage/async-storage', () =>
 *     jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
 * Call `restoreMount()` in afterEach (it restores the Dimensions spy and console silencing).
 * Test-only: never import this from app code.
 */
import { expect, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Dimensions, useColorScheme } from 'react-native';
import type { ReactElement } from 'react';
import { LocaleProvider } from '../providers/LocaleProvider.tsx';
import { ThemeProvider } from '../providers/ThemeProvider.tsx';
import { memoryPrefs, PREF_KEYS } from '../storage/prefs.ts';
import { allColors, type AllColorTokens } from '../theme/tokens.ts';
import type { DigitSystem, Locale } from '@rakhal/domain';

export interface MountOptions {
  scheme?: 'light' | 'dark';
  locale?: Locale;
  digits?: DigitSystem;
  /** System font scale seen by useWindowDimensions().fontScale (default 1). */
  fontScale?: number;
}

export type Mounted = Awaited<ReturnType<typeof render>> & { colors: AllColorTokens };

export async function mount(ui: ReactElement, options: MountOptions = {}): Promise<Mounted> {
  const { scheme = 'light', locale = 'en', digits = 'latn', fontScale = 1 } = options;
  (useColorScheme as jest.Mock<() => unknown>).mockImplementation(() => scheme);
  const real = Dimensions.get.bind(Dimensions);
  jest.spyOn(Dimensions, 'get').mockImplementation(((dim: string) => ({
    ...real(dim as 'window'),
    fontScale,
  })) as unknown as typeof Dimensions.get);
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  const localeStorage = memoryPrefs();
  await localeStorage.setItem(PREF_KEYS.locale, locale);
  await localeStorage.setItem(PREF_KEYS.digits, digits);
  const view = await render(
    <ThemeProvider storage={memoryPrefs()}>
      <LocaleProvider storage={localeStorage}>{ui}</LocaleProvider>
    </ThemeProvider>,
  );
  // Both providers render `fallback` (null) until their stored prefs are read.
  await waitFor(() => expect(screen.toJSON()).not.toBeNull());
  return Object.assign(view, { colors: allColors[scheme] });
}

/** Restore spies created by mount(). Call from afterEach. */
export function restoreMount(): void {
  jest.restoreAllMocks();
}
