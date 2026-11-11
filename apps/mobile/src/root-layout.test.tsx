import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import RootLayout from '../app/_layout.tsx';
import { memoryPrefs, PREF_KEYS } from './storage/prefs.ts';
import { colorsDark, colorsLight } from './theme/tokens.ts';

let mockFontsLoaded = true;
let mockStorage = memoryPrefs();
let mockSlotRenders = 0;

jest.mock('expo-font', () => ({ useFonts: () => [mockFontsLoaded, null] }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('expo-router', () => ({
  Slot: () => {
    mockSlotRenders += 1;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text: RNText } = require('react-native') as typeof import('react-native');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react') as typeof import('react');
    return React.createElement(RNText, null, 'slot');
  },
}));
// Stub that surfaces the style prop as text (the real StatusBar renders no host node to inspect).
jest.mock('expo-status-bar', () => ({
  StatusBar: ({ style }: { style?: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text: RNText } = require('react-native') as typeof import('react-native');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react') as typeof import('react');
    return React.createElement(RNText, null, 'statusbar:' + (style ?? ''));
  },
}));
// AppProviders' default storage is the AsyncStorage adapter; point it at a per-test in-memory store.
jest.mock('./storage/async-storage-prefs.ts', () => ({
  asyncStoragePrefs: {
    getItem: (key: string) => mockStorage.getItem(key),
    setItem: (key: string, value: string) => mockStorage.setItem(key, value),
  },
}));

const splash = jest.requireMock('expo-splash-screen') as {
  preventAutoHideAsync: jest.Mock<() => Promise<boolean>>;
  hideAsync: jest.Mock<() => Promise<boolean>>;
};
// Recorded before any test clears the mocks: the call made by app/_layout.tsx's module scope on import.
const preventCallsAtImport = splash.preventAutoHideAsync.mock.calls.length;

beforeEach(() => {
  jest.clearAllMocks();
  mockFontsLoaded = true;
  mockSlotRenders = 0;
  mockStorage = memoryPrefs();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('app/_layout', () => {
  it('holds the splash at module scope: exactly once, on import, before any render', () => {
    expect(preventCallsAtImport).toBe(1);
  });

  it('renders no Slot while fonts are loading, then renders it once when ready', async () => {
    mockFontsLoaded = false;
    const view = await render(<RootLayout />);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('slot')).toBeNull();
    expect(mockSlotRenders).toBe(0);
    expect(splash.hideAsync).not.toHaveBeenCalled();

    mockFontsLoaded = true;
    await view.rerender(<RootLayout />);
    await waitFor(() => expect(screen.getByText('slot')).toBeTruthy());
    expect(screen.getAllByText('slot')).toHaveLength(1);
    expect(splash.hideAsync).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['dark', colorsDark.background, 'light'],
    ['light', colorsLight.background, 'dark'],
  ] as const)('%s theme: themed root background and %s status bar content', async (theme, background, barStyle) => {
    mockStorage = memoryPrefs({ [PREF_KEYS.theme]: theme });
    await render(<RootLayout />);
    await waitFor(() => expect(screen.getByText('slot')).toBeTruthy());

    // The slot's host parent is the themed root View (RootErrorBoundary adds no host node).
    const root = screen.getByText('slot').parent;
    expect(StyleSheet.flatten(root?.props.style as object)).toMatchObject({ flex: 1, backgroundColor: background });
    expect(screen.getByText('statusbar:' + barStyle)).toBeTruthy();
  });
});
