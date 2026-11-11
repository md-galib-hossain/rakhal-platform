import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Components from '../app/dev/components.tsx';
import { ToastProvider } from './components/feedback/Toast.tsx';
import { mount, restoreMount } from './test-utils/mount.tsx';

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

afterEach(() => {
  g.__DEV__ = originalDev;
  restoreMount();
});

const INSETS = { top: 40, bottom: 24, left: 0, right: 0 };

function page() {
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 800 }, insets: INSETS }}>
      <ToastProvider>
        <Components />
      </ToastProvider>
    </SafeAreaProvider>
  );
}

describe('dev components route', () => {
  it.each([
    ['light', 'bn'],
    ['light', 'en'],
    ['dark', 'bn'],
    ['dark', 'en'],
  ] as const)('renders the full matrix in %s theme, %s locale', async (scheme, locale) => {
    await mount(page(), { scheme, locale });
    for (const title of [
      'Button',
      'IconButton',
      'Card',
      'StatusBadge',
      'Skeleton',
      'TextField',
      'StepperField',
      'Chip / ChipGroup',
      'ListRow',
      'EmptyState / ErrorState',
      'Toast',
      'ConfirmSheet',
    ]) {
      expect(screen.getByTestId(`demo-${title}`)).toBeTruthy();
    }
  });

  it('pads the scroll content by the safe-area insets', async () => {
    await mount(page());
    const style = StyleSheet.flatten(screen.getByTestId('components-scroll').props.contentContainerStyle) as {
      paddingTop: number;
      paddingBottom: number;
    };
    expect(style.paddingTop).toBeGreaterThan(INSETS.top);
    expect(style.paddingBottom).toBeGreaterThan(INSETS.bottom);
  });

  it('shows the shared controls and the key variant/state samples', async () => {
    await mount(page());
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('2.0x')).toBeTruthy();
    expect(screen.getByText(/PixelRatio\.getFontScale\(\) = /)).toBeTruthy();
    expect(screen.getAllByText('Loading').length).toBeGreaterThanOrEqual(8);
    expect(screen.getAllByText('Disabled').length).toBeGreaterThanOrEqual(8);
    expect(screen.getByText('ErrorState network')).toBeTruthy();
    expect(screen.getByText('ErrorState session')).toBeTruthy();
    expect(screen.getByText('Withdrawal period ends in three days, do not sell milk')).toBeTruthy();
  });

  it('switches font size and digits without crashing', async () => {
    await mount(page());
    await fireEvent.press(screen.getByText('2.0x'));
    await act(async () => {});
    expect(screen.getByTestId('demo-Button')).toBeTruthy();
    await fireEvent.press(screen.getByText('Use Bangla digits'));
    await act(async () => {});
    expect(screen.getByTestId('demo-StepperField')).toBeTruthy();
  });

  it('opens and closes a ConfirmSheet from its triggers', async () => {
    await mount(page());
    expect(screen.queryByText('Delete this animal?')).toBeNull();
    await fireEvent.press(screen.getByTestId('confirm-trigger-destructive'));
    await waitFor(() => expect(screen.getByText('Delete this animal?')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('confirm-sheet-cancel'));
    await waitFor(() => expect(screen.queryByText('Delete this animal?')).toBeNull());
    await fireEvent.press(screen.getByTestId('confirm-trigger-default'));
    await waitFor(() => expect(screen.getByText('Save changes?')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('confirm-sheet-confirm'));
    await waitFor(() => expect(screen.queryByText('Save changes?')).toBeNull());
  });

  it('shows toasts from the trigger buttons, including Undo', async () => {
    await mount(page());
    await fireEvent.press(screen.getByTestId('toast-trigger-success'));
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('toast-trigger-undo'));
    await waitFor(() => expect(screen.getByText('Entry saved')).toBeTruthy());
    expect(screen.getByText('Undo')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('toast-trigger-error'));
    await waitFor(() => expect(screen.getByText('Could not save')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('toast-trigger-persistent'));
    await waitFor(() => expect(screen.getByText('Stays until closed')).toBeTruthy());
  });

  it('redirects home outside __DEV__', async () => {
    g.__DEV__ = false;
    await mount(page());
    expect(screen.getByText('redirect:/')).toBeTruthy();
  });
});
