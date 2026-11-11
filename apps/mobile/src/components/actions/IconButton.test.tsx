import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import { pressDown, pressUp } from '../../test-utils/press.ts';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { expectTouchTarget, flatStyle } from '../../test-utils/touch-target.ts';
import { allColors, radius } from '../../theme/tokens.ts';
import { IconButton } from './IconButton.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const HIDDEN = { includeHiddenElements: true } as const;
const btn = () => screen.getByTestId('ib');

describe('IconButton', () => {
  it('requires an accessibilityLabel at the type level', () => {
    // @ts-expect-error accessibilityLabel is required: there is no text to name an icon-only button
    const missing = <IconButton icon="plus" onPress={() => {}} />;
    expect(missing).toBeTruthy();
  });

  it('exposes role button and the label as its name; the glyph is hidden', async () => {
    await mount(<IconButton testID="ib" icon="plus" accessibilityLabel="Increase" onPress={() => {}} />);
    expect(btn().props.accessibilityRole).toBe('button');
    expect(btn().props.accessibilityLabel).toBe('Increase');
    expect(btn().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
    expect(screen.getByTestId('glyph-plus', HIDDEN).props.accessibilityElementsHidden).toBe(true);
  });

  it.each([
    ['md', 48],
    ['lg', 56],
  ] as const)('size %s is a %sdp square target with no hitSlop', async (size, target) => {
    await mount(<IconButton testID="ib" icon="minus" accessibilityLabel="Decrease" size={size} onPress={() => {}} />);
    expectTouchTarget(btn(), target, { requireWidth: true });
    expect(flatStyle(btn())).toMatchObject({ minWidth: target, minHeight: target, borderRadius: radius.full });
    expect(btn().props.hitSlop).toBeUndefined();
  });

  it.each(['md', 'lg'] as const)('size %s root keeps equal minWidth/minHeight and does not stretch in a row', async (size) => {
    await mount(<IconButton testID="ib" icon="plus" accessibilityLabel="Add" size={size} onPress={() => {}} />);
    const s = flatStyle(btn());
    expect(s.minWidth).toBe(s.minHeight);
    expect(s.alignSelf).toBe('flex-start');
  });

  it('defaults to size md and variant secondary', async () => {
    await mount(<IconButton testID="ib" icon="close" accessibilityLabel="Close" onPress={() => {}} />);
    expectTouchTarget(btn(), 48, { requireWidth: true });
    expect(flatStyle(btn()).backgroundColor).toBe(allColors.light.secondary);
  });

  it('200% font scale: still square, no fixed height', async () => {
    await mount(<IconButton testID="ib" icon="plus" accessibilityLabel="Increase" onPress={() => {}} />, { fontScale: 2 });
    expect(flatStyle(btn()).height).toBeUndefined();
    expectTouchTarget(btn(), 48, { requireWidth: true });
  });

  it('calls onPress; disabled and loading ignore presses and report state', async () => {
    const onPress = jest.fn();
    await mount(<IconButton testID="ib" icon="plus" accessibilityLabel="Increase" onPress={onPress} />);
    await fireEvent.press(btn());
    expect(onPress).toHaveBeenCalledTimes(1);

    await mount(<IconButton testID="ib2" icon="plus" accessibilityLabel="Increase" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByTestId('ib2'));
    expect(screen.getByTestId('ib2').props.accessibilityState).toMatchObject({ disabled: true });

    await mount(<IconButton testID="ib3" icon="plus" accessibilityLabel="Increase" loading onPress={onPress} />);
    await fireEvent.press(screen.getByTestId('ib3'));
    expect(screen.getByTestId('ib3').props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(screen.getByTestId('icon-button-spinner', HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId('glyph-plus', HIDDEN)).toBeNull(); // the spinner replaces the glyph
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each(['light', 'dark'] as const)('variant colours resolve through tokens (%s)', async (scheme) => {
    const c = allColors[scheme];
    const cases = [
      ['primary', c.primary, c.primary],
      ['secondary', c.secondary, c.inputBorder],
      ['ghost', 'transparent', 'transparent'],
    ] as const;
    for (const [variant, bg, border] of cases) {
      const view = await mount(<IconButton testID="ib" icon="plus" accessibilityLabel="Add" variant={variant} onPress={() => {}} />, { scheme });
      expect(flatStyle(btn())).toMatchObject({ backgroundColor: bg, borderColor: border });
      view.unmount();
    }
  });

  it.each(['light', 'dark'] as const)('disabled uses muted / border (%s)', async (scheme) => {
    await mount(<IconButton testID="ib" icon="plus" accessibilityLabel="Add" disabled onPress={() => {}} />, { scheme });
    expect(flatStyle(btn())).toMatchObject({ backgroundColor: allColors[scheme].muted, borderColor: allColors[scheme].border });
  });

  it('primary pressed -> primaryHover; secondary pressed -> 12% overlay', async () => {
    await mount(<IconButton testID="ib" icon="plus" accessibilityLabel="Add" variant="primary" onPress={() => {}} />);
    await pressDown(btn());
    expect(flatStyle(btn()).backgroundColor).toBe(allColors.light.primaryHover);
    await pressUp(btn());

    await mount(<IconButton testID="ib2" icon="plus" accessibilityLabel="Add" onPress={() => {}} />);
    await pressDown(screen.getByTestId('ib2'));
    expect(flatStyle(screen.getByTestId('pressed-overlay', HIDDEN))).toMatchObject({ opacity: 0.12 });
  });
});
