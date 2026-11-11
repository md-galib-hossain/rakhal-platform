import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { pressDown, pressUp } from '../../test-utils/press.ts';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { expectTouchTarget, flatStyle } from '../../test-utils/touch-target.ts';
import { allColors } from '../../theme/tokens.ts';
import { PressableSurface, type PressableSurfaceProps } from './PressableSurface.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const base = { minHeight: 48, borderRadius: 10, borderWidth: 1, backgroundColor: 'transparent' } as const;

function Surface(props: Partial<PressableSurfaceProps>) {
  return (
    <PressableSurface accessibilityRole="button" accessibilityLabel="Save" pressedStyle="overlay" style={base} testID="s" {...props}>
      <Text>Save</Text>
    </PressableSurface>
  );
}

const HIDDEN = { includeHiddenElements: true } as const;
const surface = () => screen.getByTestId('s');

describe('PressableSurface semantics', () => {
  it('exposes role, name and a default non-disabled, non-busy state', async () => {
    await mount(<Surface />);
    expect(surface().props.accessibilityRole).toBe('button');
    expect(surface().props.accessibilityLabel).toBe('Save');
    expect(surface().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
    expect(surface().props.focusable).toBe(true);
  });

  it('forwards extra accessibilityState (selected / checked) alongside disabled and busy', async () => {
    await mount(<Surface accessibilityState={{ checked: true }} />);
    expect(surface().props.accessibilityState).toMatchObject({ checked: true, disabled: false, busy: false });
  });

  it('calls onPress when enabled', async () => {
    const onPress = jest.fn();
    await mount(<Surface onPress={onPress} />);
    await fireEvent.press(surface());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled: ignores presses, reports disabled, is not focusable', async () => {
    const onPress = jest.fn();
    await mount(<Surface disabled onPress={onPress} />);
    await fireEvent.press(surface());
    expect(onPress).not.toHaveBeenCalled();
    expect(surface().props.accessibilityState).toMatchObject({ disabled: true, busy: false });
    expect(surface().props.focusable).toBe(false);
  });

  it('busy: ignores presses and reports busy + disabled', async () => {
    const onPress = jest.fn();
    await mount(<Surface busy onPress={onPress} />);
    await fireEvent.press(surface());
    expect(onPress).not.toHaveBeenCalled();
    expect(surface().props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('never installs an Android ripple', async () => {
    await mount(<Surface />);
    expect(surface().props.android_ripple).toBeUndefined();
  });

  it('keeps the caller sizing, so the touch-target helper still sees it', async () => {
    await mount(<Surface />);
    expectTouchTarget(surface(), 48);
  });
});

describe('PressableSurface pressed look', () => {
  it('overlay: a 12% foreground view appears under the label only while pressed, radius minus border', async () => {
    await mount(<Surface />);
    expect(screen.queryByTestId('pressed-overlay', HIDDEN)).toBeNull();
    await pressDown(surface());
    const overlay = screen.getByTestId('pressed-overlay', HIDDEN);
    expect(flatStyle(overlay)).toMatchObject({ backgroundColor: allColors.light.foreground, opacity: 0.12, borderRadius: 9 });
    expect(overlay.props.accessibilityElementsHidden).toBe(true);
    // painted before the label so the label is never dimmed
    const kids = surface().children as unknown as { type: unknown; props: Record<string, unknown> }[];
    expect(kids[0]!.props.testID).toBe('pressed-overlay');
    await pressUp(surface());
    expect(screen.queryByTestId('pressed-overlay', HIDDEN)).toBeNull();
  });

  it('overlay colour follows the theme', async () => {
    await mount(<Surface />, { scheme: 'dark' });
    await pressDown(surface());
    expect(flatStyle(screen.getByTestId('pressed-overlay', HIDDEN)).backgroundColor).toBe(allColors.dark.foreground);
  });

  it('fill: background swaps to the token while pressed and no overlay is drawn', async () => {
    await mount(<Surface pressedStyle={{ fill: 'primaryHover' }} style={{ ...base, backgroundColor: allColors.light.primary }} />);
    expect(flatStyle(surface()).backgroundColor).toBe(allColors.light.primary);
    await pressDown(surface());
    expect(flatStyle(surface()).backgroundColor).toBe(allColors.light.primaryHover);
    expect(screen.queryByTestId('pressed-overlay', HIDDEN)).toBeNull();
    await pressUp(surface());
    expect(flatStyle(surface()).backgroundColor).toBe(allColors.light.primary);
  });

  it('disabled shows no pressed feedback', async () => {
    await mount(<Surface disabled />);
    await pressDown(surface());
    expect(screen.queryByTestId('pressed-overlay', HIDDEN)).toBeNull();
  });
});

describe('PressableSurface focus ring', () => {
  it.each(['light', 'dark'] as const)('focus draws the 2dp outside outline in focusRing (%s) and blur removes it', async (scheme) => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await mount(<Surface onFocus={onFocus} onBlur={onBlur} />, { scheme });
    expect(flatStyle(surface()).outlineWidth).toBeUndefined();
    await fireEvent(surface(), 'focus');
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(flatStyle(surface())).toMatchObject({
      outlineWidth: 2,
      outlineOffset: 2,
      outlineColor: allColors[scheme].focusRing,
    });
    await fireEvent(surface(), 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(flatStyle(surface()).outlineWidth).toBeUndefined();
  });

  it('focus never changes layout: no padding, margin, border or size is added', async () => {
    await mount(<Surface />);
    const before = flatStyle(surface());
    await fireEvent(surface(), 'focus');
    const after = flatStyle(surface());
    for (const key of Object.keys(after)) {
      if (key.startsWith('outline')) continue;
      expect(after[key]).toEqual(before[key]);
    }
  });

  it('inset variant draws the ring 4dp inside', async () => {
    await mount(<Surface focusInset />);
    await fireEvent(surface(), 'focus');
    expect(flatStyle(surface()).outlineOffset).toBe(-4);
  });

  it('pressed hides the ring (pressed never shows the ring)', async () => {
    await mount(<Surface />);
    await fireEvent(surface(), 'focus');
    await pressDown(surface());
    expect(flatStyle(surface()).outlineWidth).toBeUndefined();
  });

  it('disabled shows no ring even if focus is delivered', async () => {
    await mount(<Surface disabled />);
    await fireEvent(surface(), 'focus');
    expect(flatStyle(surface()).outlineWidth).toBeUndefined();
  });
});

describe('PressableSurface typing', () => {
  it('requires accessibilityRole and pressedStyle', () => {
    // @ts-expect-error accessibilityRole is required
    const a: PressableSurfaceProps = { pressedStyle: 'overlay' };
    // @ts-expect-error pressedStyle is required
    const b: PressableSurfaceProps = { accessibilityRole: 'button' };
    // @ts-expect-error raw colours are not a pressed fill: it must be a token name
    const c: PressableSurfaceProps = { accessibilityRole: 'button', pressedStyle: { fill: 'notAToken' } };
    expect([a, b, c]).toHaveLength(3);
  });
});
