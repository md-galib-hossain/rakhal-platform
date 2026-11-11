import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState, type ReactElement } from 'react';
import { AccessibilityInfo, Animated, Dimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { mount, restoreMount, type MountOptions } from '../../test-utils/mount.tsx';
import { expectNoFixedTextHeight, expectTouchTarget, findNodes, flatStyle } from '../../test-utils/touch-target.ts';
import { messages } from '../../i18n/messages.ts';
import { allColors, elevation, radius, shadowColor } from '../../theme/tokens.ts';
import { SHEET_FOCUS_DELAY_MS, SheetModal, SheetTitle } from '../internal/SheetModal.tsx';
import { ConfirmSheet, type ConfirmSheetProps } from './ConfirmSheet.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the ES namespace import is a copy; spies must hit the real module
const rn = require('react-native') as typeof import('react-native');
const HIDDEN = { includeHiddenElements: true } as const;
const noop = () => {};
const LONG_BN = 'এই গাভীটি স্থায়ীভাবে মুছে ফেলা হবে এবং এর সব দুধের হিসাব হারিয়ে যাবে';

function frame(bottom: number, children: ReactElement) {
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 24, left: 0, right: 0, bottom } }}>
      {children}
    </SafeAreaProvider>
  );
}

function sheet(overrides: Partial<ConfirmSheetProps> = {}, bottom = 0) {
  const props: ConfirmSheetProps = {
    visible: true,
    title: 'Delete this cow?',
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
    onConfirm: noop,
    onCancel: noop,
    ...overrides,
  };
  return frame(bottom, <ConfirmSheet {...props} />);
}

const confirmButton = () => screen.getByTestId('confirm-sheet-confirm');
const cancelButton = () => screen.getByTestId('confirm-sheet-cancel');
const requestClose = () => fireEvent(screen.getByTestId('confirm-sheet'), 'requestClose');

describe('ConfirmSheet content', () => {
  it('renders title, message, confirm then cancel (cancel last); closed renders nothing', async () => {
    const view = await mount(sheet({ visible: false }));
    expect(screen.queryByText('Delete this cow?')).toBeNull();
    view.unmount();
    await mount(sheet());
    expect(screen.getByText('Delete this cow?')).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.props.testID)).toEqual(['confirm-sheet-confirm', 'confirm-sheet-cancel']);
  });

  it('title is a header node; message is optional', async () => {
    await mount(sheet({ message: undefined }));
    expect(screen.getByRole('header', { name: 'Delete this cow?' })).toBeTruthy();
    expect(screen.queryByText('This cannot be undone.')).toBeNull();
  });

  it('cancel label defaults to the locale Cancel and can be overridden', async () => {
    const view = await mount(sheet());
    expect(screen.getByRole('button', { name: messages.en['common.cancel'] })).toBeTruthy();
    view.unmount();
    const bn = await mount(sheet(), { locale: 'bn' });
    expect(screen.getByRole('button', { name: messages.bn['common.cancel'] })).toBeTruthy();
    bn.unmount();
    await mount(sheet({ cancelLabel: 'Keep it' }));
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeTruthy();
  });

  it('default tone: confirm is the primary button; destructive tone: the destructive button; cancel is secondary', async () => {
    const view = await mount(sheet());
    expect(flatStyle(confirmButton()).backgroundColor).toBe(view.colors.primary);
    expect(flatStyle(cancelButton()).backgroundColor).toBe(view.colors.secondary);
    view.unmount();
    const d = await mount(sheet({ tone: 'destructive' }));
    expect(flatStyle(confirmButton()).backgroundColor).toBe(d.colors.destructive);
    expect(flatStyle(cancelButton()).backgroundColor).toBe(d.colors.secondary);
  });

  it('both buttons are 56dp and sit 12dp apart', async () => {
    await mount(sheet());
    expectTouchTarget(confirmButton(), 56);
    expectTouchTarget(cancelButton(), 56);
    const column = confirmButton().parent!;
    expect(flatStyle(column).gap).toBe(12);
    expect(column.children).toHaveLength(2);
  });

  it('confirm and cancel call their handlers once', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await mount(sheet({ onConfirm, onCancel }));
    await fireEvent.press(confirmButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    await fireEvent.press(cancelButton());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmSheet dismiss paths', () => {
  it('Android back (onRequestClose) calls onCancel', async () => {
    const onCancel = jest.fn();
    await mount(sheet({ onCancel }));
    await requestClose();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('backdrop tap calls onCancel; the backdrop is hidden from a11y', async () => {
    const onCancel = jest.fn();
    await mount(sheet({ onCancel }));
    const backdrop = screen.getByTestId('sheet-backdrop', HIDDEN);
    expect(backdrop.props.accessible).toBe(false);
    await fireEvent.press(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('loading: confirm is busy, cancel disabled, and back + backdrop + both buttons are ignored', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await mount(sheet({ loading: true, onConfirm, onCancel }));
    expect(confirmButton().props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(cancelButton().props.accessibilityState).toMatchObject({ disabled: true });
    await requestClose();
    await fireEvent.press(screen.getByTestId('sheet-backdrop', HIDDEN));
    await fireEvent.press(confirmButton());
    await fireEvent.press(cancelButton());
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('SheetModal surface and safe area', () => {
  it.each(['light', 'dark'] as const)('popover surface, rounded top corners, overlay elevation, backdrop shadowColor (%s)', async (scheme) => {
    await mount(sheet(), { scheme });
    const surface = flatStyle(screen.getByTestId('sheet-surface'));
    expect(surface).toMatchObject({
      backgroundColor: allColors[scheme].popover,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      elevation: elevation.overlay.elevation,
      shadowColor,
    });
    expect(screen.getByTestId('confirm-sheet').props).toMatchObject({ transparent: true, animationType: 'none' });
  });

  it('modal is translucent for both bars so the sheet can sit over the nav bar', async () => {
    await mount(sheet());
    expect(screen.getByTestId('confirm-sheet').props).toMatchObject({ statusBarTranslucent: true, navigationBarTranslucent: true });
  });

  it.each([
    [0, 32],
    [8, 32],
    [34, 50],
  ])('bottom inset %s -> bottom padding %s (read inside the Modal), sides and top 16', async (inset, padding) => {
    await mount(sheet({}, inset));
    const content = screen.getByTestId('sheet-content');
    const contentStyle = (content.props.contentContainerStyle ?? flatStyle(findNodes(content, (n) => n.props.contentContainerStyle !== undefined)[0]!)) as Record<string, number>;
    expect(contentStyle).toMatchObject({ paddingBottom: padding, paddingTop: 16, paddingHorizontal: 16 });
  });

  it('caps the sheet at 90% of the screen and scrolls its content (200% font scale)', async () => {
    await mount(sheet({}, 0), { fontScale: 2 });
    const surface = flatStyle(screen.getByTestId('sheet-surface'));
    const window = Dimensions.get('window');
    expect(surface.maxHeight).toBeCloseTo(window.height * 0.9);
    expect(flatStyle(screen.getByTestId('sheet-surface')).height).toBeUndefined();
    // The content lives in a ScrollView so taller-than-screen content scrolls instead of clipping.
    expect(screen.getByTestId('sheet-content').type).toBe('RCTScrollView');
  });

  it('long Bangla title and message wrap at 200% scale: no numberOfLines, no fixed text height, buttons keep 56dp', async () => {
    await mount(sheet({ title: LONG_BN, message: LONG_BN, confirmLabel: LONG_BN }), { locale: 'bn', fontScale: 2 });
    const surface = screen.getByTestId('sheet-surface');
    for (const t of findNodes(surface, (n) => n.type === 'Text')) expect(t.props.numberOfLines).toBeUndefined();
    expectNoFixedTextHeight(surface);
    expectTouchTarget(confirmButton(), 56);
  });
});

describe('SheetModal dismissable and motion', () => {
  function Harness({ initial, dismissable = true, onClose = noop }: { initial: boolean; dismissable?: boolean; onClose?: () => void }) {
    const [visible, setVisible] = useState(initial);
    harness.set = setVisible;
    return (
      <SheetModal visible={visible} onRequestClose={onClose} dismissable={dismissable} testID="m">
        <SheetTitle>Title</SheetTitle>
      </SheetModal>
    );
  }
  const harness: { set: (v: boolean) => void } = { set: () => {} };

  it('dismissable=false ignores back and backdrop; true allows them', async () => {
    const onClose = jest.fn();
    const view = await mount(frame(0, <Harness initial dismissable={false} onClose={onClose} />));
    await fireEvent(screen.getByTestId('m'), 'requestClose');
    await fireEvent.press(screen.getByTestId('sheet-backdrop', HIDDEN));
    expect(onClose).not.toHaveBeenCalled();
    view.unmount();
    await mount(frame(0, <Harness initial onClose={onClose} />));
    await fireEvent(screen.getByTestId('m'), 'requestClose');
    await fireEvent.press(screen.getByTestId('sheet-backdrop', HIDDEN));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('reduce motion: opens and closes instantly with no timing animation', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    await mount(frame(0, <Harness initial={false} />));
    await act(async () => {});
    await act(async () => harness.set(true));
    expect(screen.getByTestId('m')).toBeTruthy();
    await act(async () => harness.set(false));
    expect(screen.queryByTestId('m')).toBeNull();
    expect(timing).not.toHaveBeenCalled();
  });

  it('normal motion: uses native-driver timing (150 / 220 in), stays mounted until the exit finishes', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const timing = jest.spyOn(Animated, 'timing');
    await mount(frame(0, <Harness initial={false} />));
    await act(async () => harness.set(true));
    const inConfigs = timing.mock.calls.map((c) => c[1] as unknown as { duration: number; useNativeDriver: boolean });
    expect(inConfigs.map((c) => c.duration).sort()).toEqual([150, 220]);
    for (const c of inConfigs) expect(c.useNativeDriver).toBe(true);
    timing.mockClear();
    await act(async () => harness.set(false));
    const outConfigs = timing.mock.calls.map((c) => c[1] as unknown as { duration: number });
    expect(outConfigs.map((c) => c.duration)).toEqual([160, 160]);
    await waitFor(() => expect(screen.queryByTestId('m')).toBeNull(), { timeout: 2000 });
  });

  it('moves screen-reader focus to the title after open (once), and not while closed', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockClear().mockImplementation(() => {});
    jest.spyOn(rn, 'findNodeHandle').mockReturnValue(42);
    await mount(frame(0, <Harness initial={false} />));
    await act(async () => {
      await new Promise((r) => setTimeout(r, SHEET_FOCUS_DELAY_MS + 50));
    });
    expect(focus).not.toHaveBeenCalled();
    await act(async () => harness.set(true));
    await act(async () => {
      await new Promise((r) => setTimeout(r, SHEET_FOCUS_DELAY_MS + 50));
    });
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(42);
  });

  it('the focus target is the SheetTitle node (header role, accessible)', async () => {
    await mount(sheet());
    const title = screen.getByTestId('sheet-title');
    expect(title.props.accessible).toBe(true);
    expect(title.props.accessibilityRole).toBe('header');
  });

  it('timers are cleared on unmount: no focus call after the sheet is gone', async () => {
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockClear().mockImplementation(() => {});
    jest.spyOn(rn, 'findNodeHandle').mockReturnValue(7);
    const view = await mount(frame(0, <Harness initial />));
    await view.unmount();
    await act(async () => {
      await new Promise((r) => setTimeout(r, SHEET_FOCUS_DELAY_MS + 50));
    });
    expect(focus).not.toHaveBeenCalled();
  });
});

describe('type-level contract', () => {
  it('confirmLabel is required', () => {
    // @ts-expect-error confirmLabel is required
    const bad: ConfirmSheetProps = { visible: true, title: 'T', onConfirm: noop, onCancel: noop };
    expect(bad).toBeDefined();
  });

  it('mount options type is reused (compile-time only)', () => {
    const options: MountOptions = { fontScale: 1 };
    expect(options.fontScale).toBe(1);
  });
});
