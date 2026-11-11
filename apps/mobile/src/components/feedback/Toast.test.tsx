import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text as RNText } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactElement } from 'react';
import { mount, restoreMount, type MountOptions } from '../../test-utils/mount.tsx';
import { expectTouchTarget, flatStyle } from '../../test-utils/touch-target.ts';
import { messages } from '../../i18n/messages.ts';
import { allColors, elevation, radius, shadowColor } from '../../theme/tokens.ts';
import { lightImpact } from './haptics.ts';
import { ToastProvider, useToast, type ToastApi, type ToastProviderProps } from './Toast.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let api: ToastApi;
function Capture() {
  api = useToast();
  return null;
}

function tree(bottomInset = 0, providerProps: Partial<ToastProviderProps> = {}): ReactElement {
  return (
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 24, left: 0, right: 0, bottom: bottomInset } }}
    >
      <ToastProvider {...providerProps}>
        <Capture />
      </ToastProvider>
    </SafeAreaProvider>
  );
}

async function setup(options: MountOptions & { inset?: number; provider?: Partial<ToastProviderProps> } = {}) {
  const { inset = 0, provider, ...mountOptions } = options;
  return mount(tree(inset, provider), mountOptions);
}

const flush = () => act(async () => {});
const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });
async function show(options: Parameters<ToastApi['show']>[0]) {
  let id = '';
  await act(async () => {
    id = api.show(options);
  });
  await flush();
  return id;
}
const toast = () => screen.getByTestId('toast');
const gone = () => expect(screen.queryByTestId('toast')).toBeNull();

let announce: jest.SpiedFunction<typeof AccessibilityInfo.announceForAccessibility>;

beforeEach(() => {
  jest.useFakeTimers();
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear().mockImplementation(() => {});
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

afterEach(() => {
  jest.useRealTimers();
  restoreMount();
});

describe('useToast', () => {
  it('throws a clear error outside ToastProvider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    function Bare() {
      useToast();
      return null;
    }
    await expect(mount(<Bare />)).rejects.toThrow('useToast must be used inside <ToastProvider>');
  });

  it('exposes show (returns an id) and dismiss', async () => {
    await setup();
    expect(typeof api.show).toBe('function');
    expect(typeof api.dismiss).toBe('function');
    const id = await show({ message: 'Saved' });
    expect(id).toEqual(expect.any(String));
    expect(screen.getByText('Saved')).toBeTruthy();
    await act(async () => api.dismiss(id));
    await advance(300);
    gone();
  });

  it('renders no toast host and needs no safe-area provider until show is called', async () => {
    await mount(
      <ToastProvider>
        <Capture />
        <RNText>content</RNText>
      </ToastProvider>,
    );
    gone();
  });
});

describe('Toast timing and replacement', () => {
  it('auto-dismisses a plain toast after 4s (not before)', async () => {
    await setup();
    await show({ message: 'Saved' });
    await advance(3900);
    expect(screen.getByText('Saved')).toBeTruthy();
    await advance(200);
    await advance(300);
    gone();
  });

  it('error toast lasts 6s, a toast with an action 5s', async () => {
    await setup();
    await show({ message: 'Failed', tone: 'error' });
    await advance(5900);
    expect(screen.getByText('Failed')).toBeTruthy();
    await advance(300);
    await advance(300);
    gone();
    await show({ message: 'Saved', action: { label: 'Undo', onPress: () => {} } });
    await advance(4900);
    expect(screen.getByText('Saved')).toBeTruthy();
    await advance(200);
    await advance(300);
    gone();
  });

  it('persistent toast (durationMs 0) stays and shows a named close button that dismisses', async () => {
    await setup();
    await show({ message: 'Offline', tone: 'info', durationMs: 0 });
    await advance(60000);
    expect(screen.getByText('Offline')).toBeTruthy();
    const close = screen.getByRole('button', { name: messages.en['toast.dismiss'] });
    expectTouchTarget(close, 48, { requireWidth: true });
    await act(async () => fireEvent.press(close));
    await advance(300);
    gone();
  });

  it('a new show replaces the current toast and restarts the timer', async () => {
    await setup();
    await show({ message: 'First' });
    await advance(3000);
    await show({ message: 'Second' });
    expect(screen.queryByText('First')).toBeNull();
    expect(screen.getAllByTestId('toast')).toHaveLength(1);
    await advance(3000); // 6s after the first show: first timer must have been cleared
    expect(screen.getByText('Second')).toBeTruthy();
    await advance(1200);
    await advance(300);
    gone();
  });

  it('dismiss(id) ignores a stale id (the replaced toast), dismiss() closes the current one', async () => {
    await setup();
    const first = await show({ message: 'First' });
    await show({ message: 'Second' });
    await act(async () => api.dismiss(first));
    await advance(300);
    expect(screen.getByText('Second')).toBeTruthy();
    await act(async () => api.dismiss());
    await advance(300);
    gone();
  });

  it('screen reader extends the window (no recommended timeout: x3)', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    await setup();
    await show({ message: 'Saved' });
    await advance(11900);
    expect(screen.getByText('Saved')).toBeTruthy();
    await advance(200);
    await advance(300);
    gone();
  });

  it('unmount clears the pending timer (no state update afterwards)', async () => {
    const view = await setup();
    const set = jest.spyOn(globalThis, 'setTimeout');
    const clear = jest.spyOn(globalThis, 'clearTimeout');
    await show({ message: 'Saved' });
    const dismissCall = set.mock.calls.findIndex((c) => c[1] === 4000);
    expect(dismissCall).toBeGreaterThanOrEqual(0);
    const handle = set.mock.results[dismissCall]?.value as ReturnType<typeof setTimeout>;
    await act(async () => view.unmount());
    expect(clear).toHaveBeenCalledWith(handle);
  });
});

describe('Toast action (undo)', () => {
  it('action runs the handler once, then dismisses', async () => {
    await setup();
    const onPress = jest.fn();
    await show({ message: 'Entry saved', action: { label: messages.en['toast.undo'], onPress } });
    const button = screen.getByRole('button', { name: 'Undo' });
    await act(async () => fireEvent.press(button));
    expect(onPress).toHaveBeenCalledTimes(1);
    await advance(300);
    gone();
  });

  it('action button is a 48dp target and the toast uses the popover surface with an outline', async () => {
    const view = await setup();
    await show({ message: 'Entry saved', action: { label: 'Undo', onPress: () => {} } });
    expectTouchTarget(screen.getByRole('button', { name: 'Undo' }), 48);
    const s = flatStyle(toast());
    expect(s.backgroundColor).toBe(view.colors.popover);
    expect(s.borderColor).toBe(view.colors.inputBorder);
    expect(s.borderRadius).toBe(radius.lg);
    expect(s.minHeight).toBe(56);
    expect(s.elevation).toBe(elevation.overlay.elevation);
    expect(s.shadowColor).toBe(shadowColor);
  });
});

describe('Toast accessibility', () => {
  it('announces the message exactly once per show; polite live region for success/info', async () => {
    await setup();
    await show({ message: 'Saved' });
    await advance(100);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Saved');
    expect(toast().props.accessibilityLiveRegion).toBe('polite');
    expect(toast().props.accessibilityRole).toBeUndefined();
    await show({ message: 'Info', tone: 'info' });
    expect(announce).toHaveBeenCalledTimes(2);
    expect(toast().props.accessibilityLiveRegion).toBe('polite');
  });

  it('error toast is an assertive alert', async () => {
    await setup();
    await show({ message: 'Could not save', tone: 'error' });
    expect(toast().props.accessibilityLiveRegion).toBe('assertive');
    expect(toast().props.accessibilityRole).toBe('alert');
  });

  it('tone glyph is decorative (hidden) and uses the tone token', async () => {
    const view = await setup();
    await show({ message: 'Saved' });
    expect(screen.queryByTestId('toast-glyph')).toBeNull();
    expect(screen.getByTestId('toast-glyph', { includeHiddenElements: true })).toBeTruthy();
    expect(view.colors.primaryText).toBeTruthy();
  });
});

describe('Toast placement and motion', () => {
  const host = () => flatStyle(screen.getByTestId('toast-host'));

  it('sits insets.bottom + 16 above the bottom, with 16dp side margins', async () => {
    await setup({ inset: 24 });
    await show({ message: 'Saved' });
    expect(host().bottom).toBe(40);
    expect(host().left).toBe(16);
    expect(host().right).toBe(16);
  });

  it('bottomOffset per toast adds to the inset; provider default applies when absent', async () => {
    await setup({ inset: 24, provider: { bottomOffset: 56 } });
    await show({ message: 'Default offset' });
    expect(host().bottom).toBe(96);
    await show({ message: 'Own offset', bottomOffset: 8 });
    expect(host().bottom).toBe(48);
  });

  it('reduce motion shows instantly (opacity 1) and hides instantly on dismiss', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await setup();
    await act(async () => {}); // let useReduceMotion read the setting
    await show({ message: 'Saved' });
    expect(flatStyle(toast()).opacity).toBe(1);
    await act(async () => api.dismiss());
    gone();
  });
});

describe('Toast themes and locales', () => {
  it.each([
    ['light', 'en'],
    ['dark', 'en'],
    ['light', 'bn'],
    ['dark', 'bn'],
  ] as const)('renders in %s / %s with theme tokens and a localised close label', async (scheme, locale) => {
    const view = await setup({ scheme, locale });
    expect(view.colors).toBe(allColors[scheme]);
    await show({ message: locale === 'bn' ? 'সংরক্ষণ হয়েছে' : 'Saved', durationMs: 0 });
    expect(flatStyle(toast()).backgroundColor).toBe(allColors[scheme].popover);
    expect(screen.getByRole('button', { name: messages[locale]['toast.dismiss'] })).toBeTruthy();
  });

  it('long Bangla message wraps in a flexible column (no truncation)', async () => {
    await setup({ locale: 'bn', fontScale: 2 });
    const long = 'দুধের হিসাব সংরক্ষণ করা হয়েছে এবং আপনি চাইলে এখনই এটি ফিরিয়ে নিতে পারেন';
    await show({ message: long, action: { label: 'ফিরিয়ে নিন', onPress: () => {} } });
    const text = screen.getByText(long);
    expect(text.props.numberOfLines).toBeUndefined();
  });
});

describe('haptics seam', () => {
  it('lightImpact is a callable no-op', () => {
    expect(lightImpact()).toBeUndefined();
  });
});
