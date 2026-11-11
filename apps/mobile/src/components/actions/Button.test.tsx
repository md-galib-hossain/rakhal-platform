import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import { pressDown, pressUp } from '../../test-utils/press.ts';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { expectNoFixedTextHeight, expectTouchTarget, findNodes, flatStyle } from '../../test-utils/touch-target.ts';
import { allColors, fontFamily, radius } from '../../theme/tokens.ts';
import { Button, type ButtonVariant } from './Button.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const HIDDEN = { includeHiddenElements: true } as const;
const VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'destructive', 'ghost'];
const button = () => screen.getByTestId('b');
const LONG_BN = 'গবাদিপশুর দুধ দোহনের তথ্য সংরক্ষণ করুন এবং পরবর্তী ধাপে যান';

describe('Button semantics', () => {
  it('exposes role button, the label as its name, and a hint', async () => {
    await mount(<Button testID="b" label="Save" onPress={() => {}} accessibilityHint="Saves the entry" />);
    expect(button().props.accessibilityRole).toBe('button');
    expect(button().props.accessibilityLabel).toBe('Save');
    expect(button().props.accessibilityHint).toBe('Saves the entry');
    expect(button().props.accessibilityState).toMatchObject({ disabled: false, busy: false });
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('accessibilityLabel overrides the label as the accessible name', async () => {
    await mount(<Button testID="b" label="Save" accessibilityLabel="Save milk entry" onPress={() => {}} />);
    expect(button().props.accessibilityLabel).toBe('Save milk entry');
  });

  it('calls onPress once when enabled', async () => {
    const onPress = jest.fn();
    await mount(<Button testID="b" label="Save" onPress={onPress} />);
    await fireEvent.press(button());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled: ignores presses and reports disabled', async () => {
    const onPress = jest.fn();
    await mount(<Button testID="b" label="Save" disabled onPress={onPress} />);
    await fireEvent.press(button());
    expect(onPress).not.toHaveBeenCalled();
    expect(button().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('loading: ignores presses, reports busy + disabled, shows a spinner and KEEPS the label', async () => {
    const onPress = jest.fn();
    await mount(<Button testID="b" label="Save" loading onPress={onPress} />);
    await fireEvent.press(button());
    expect(onPress).not.toHaveBeenCalled();
    expect(button().props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(screen.getByTestId('button-spinner', HIDDEN)).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('not loading: no spinner; leadingIcon renders a decorative glyph', async () => {
    await mount(<Button testID="b" label="Add" leadingIcon="plus" onPress={() => {}} />);
    expect(screen.queryByTestId('button-spinner', HIDDEN)).toBeNull();
    expect(screen.getByTestId('glyph-plus', HIDDEN).props.accessibilityElementsHidden).toBe(true);
  });

  it('loading replaces the leading glyph with the spinner (label stays)', async () => {
    await mount(<Button testID="b" label="Add" leadingIcon="plus" loading onPress={() => {}} />);
    expect(screen.queryByTestId('glyph-plus', HIDDEN)).toBeNull();
    expect(screen.getByTestId('button-spinner', HIDDEN)).toBeTruthy();
  });
});

describe('Button sizing', () => {
  it.each([
    ['primary', undefined, 56],
    ['secondary', undefined, 48],
    ['destructive', undefined, 48],
    ['ghost', undefined, 48],
    ['secondary', 'lg', 56],
    ['primary', 'md', 48],
  ] as const)('%s with size %s meets the %sdp target', async (variant, size, target) => {
    await mount(<Button testID="b" label="Go" variant={variant} size={size} onPress={() => {}} />);
    expectTouchTarget(button(), target);
    expect(flatStyle(button())).toMatchObject({ borderRadius: radius.md, borderWidth: 1 });
  });

  it.each([
    ['md', { minHeight: 48, paddingHorizontal: 16, paddingVertical: 10 }],
    ['lg', { minHeight: 56, paddingHorizontal: 20, paddingVertical: 12 }],
  ] as const)('%s metrics', async (size, expected) => {
    await mount(<Button testID="b" label="Go" size={size} onPress={() => {}} />);
    expect(flatStyle(button())).toMatchObject(expected);
  });

  it('fullWidth (default) stretches; fullWidth=false is intrinsic with a 48dp minWidth', async () => {
    await mount(<Button testID="b" label="Go" onPress={() => {}} />);
    expect(flatStyle(button()).alignSelf).toBe('stretch');
    await mount(<Button testID="b2" label="Go" fullWidth={false} onPress={() => {}} />);
    const narrow = flatStyle(screen.getByTestId('b2'));
    expect(narrow.alignSelf).toBe('flex-start');
    expect(narrow.minWidth).toBeGreaterThanOrEqual(48);
  });

  it.each(['en', 'bn'] as const)('200%% font scale (%s): grows by minHeight, no fixed height, label wraps (no numberOfLines)', async (locale) => {
    await mount(<Button testID="b" label={locale === 'bn' ? LONG_BN : 'Save the milk entry and continue'} onPress={() => {}} />, { locale, fontScale: 2 });
    expectTouchTarget(button(), 56);
    expect(flatStyle(button()).height).toBeUndefined();
    expectNoFixedTextHeight(button());
    const label = findNodes(button(), (n) => n.type === 'Text')[0]!;
    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.props.ellipsizeMode).toBeUndefined();
    expect(flatStyle(label).textAlign).toBe('center');
  });
});

describe('Button colours in both themes', () => {
  it.each(['light', 'dark'] as const)('resolves every variant through tokens (%s)', async (scheme) => {
    const c = allColors[scheme];
    const expected: Record<ButtonVariant, { bg: string; border: string; label: string }> = {
      primary: { bg: c.primary, border: c.primary, label: c.primaryForeground },
      secondary: { bg: c.secondary, border: c.inputBorder, label: c.secondaryForeground },
      destructive: { bg: c.destructive, border: c.destructive, label: c.destructiveForeground },
      ghost: { bg: 'transparent', border: 'transparent', label: c.foreground },
    };
    for (const variant of VARIANTS) {
      const view = await mount(<Button testID="b" label="Go" variant={variant} onPress={() => {}} />, { scheme });
      const s = flatStyle(button());
      expect(s.backgroundColor).toBe(expected[variant].bg);
      expect(s.borderColor).toBe(expected[variant].border);
      expect(flatStyle(screen.getByText('Go')).color).toBe(expected[variant].label);
      view.unmount();
    }
  });

  it.each(['light', 'dark'] as const)('disabled is muted / mutedForeground / border for every variant (%s)', async (scheme) => {
    const c = allColors[scheme];
    for (const variant of VARIANTS) {
      const view = await mount(<Button testID="b" label="Go" variant={variant} disabled onPress={() => {}} />, { scheme });
      expect(flatStyle(button())).toMatchObject({ backgroundColor: c.muted, borderColor: c.border });
      expect(flatStyle(screen.getByText('Go')).color).toBe(c.mutedForeground);
      view.unmount();
    }
  });

  it.each(['light', 'dark'] as const)('loading keeps the variant look, not the disabled look (%s)', async (scheme) => {
    await mount(<Button testID="b" label="Go" loading onPress={() => {}} />, { scheme });
    expect(flatStyle(button()).backgroundColor).toBe(allColors[scheme].primary);
  });
});

describe('Button pressed look', () => {
  it.each(['light', 'dark'] as const)('primary swaps its fill to primaryHover while pressed (%s)', async (scheme) => {
    await mount(<Button testID="b" label="Go" onPress={() => {}} />, { scheme });
    await pressDown(button());
    expect(flatStyle(button()).backgroundColor).toBe(allColors[scheme].primaryHover);
    expect(screen.queryByTestId('pressed-overlay', HIDDEN)).toBeNull();
    await pressUp(button());
    expect(flatStyle(button()).backgroundColor).toBe(allColors[scheme].primary);
  });

  it.each(['secondary', 'destructive', 'ghost'] as const)('%s shows the 12%% foreground overlay and keeps its fill', async (variant) => {
    await mount(<Button testID="b" label="Go" variant={variant} onPress={() => {}} />);
    const before = flatStyle(button()).backgroundColor;
    await pressDown(button());
    const overlay = screen.getByTestId('pressed-overlay', HIDDEN);
    expect(flatStyle(overlay)).toMatchObject({ backgroundColor: allColors.light.foreground, opacity: 0.12 });
    expect(flatStyle(button()).backgroundColor).toBe(before);
    await pressUp(button());
    expect(screen.queryByTestId('pressed-overlay', HIDDEN)).toBeNull();
  });

  it('loading and disabled show no pressed feedback', async () => {
    await mount(<Button testID="b" label="Go" loading variant="secondary" onPress={() => {}} />);
    await pressDown(button());
    expect(screen.queryByTestId('pressed-overlay', HIDDEN)).toBeNull();
  });
});

describe('Button locales', () => {
  it('bn: any string (Latin included) uses the Bengali family; script="latin" forces Inter', async () => {
    await mount(<Button testID="b" label="Save" onPress={() => {}} />, { locale: 'bn' });
    expect(flatStyle(screen.getByText('Save')).fontFamily).toBe(fontFamily.bengali.semibold);
    await mount(<Button testID="b2" label="Save" script="latin" onPress={() => {}} />, { locale: 'bn' });
    expect(screen.getAllByText('Save').some((n) => flatStyle(n).fontFamily === fontFamily.latin.semibold)).toBe(true);
  });

  it('en: Latin label uses Inter semibold, no fontWeight', async () => {
    await mount(<Button testID="b" label="Save" onPress={() => {}} />, { locale: 'en' });
    const s = flatStyle(screen.getByText('Save'));
    expect(s.fontFamily).toBe(fontFamily.latin.semibold);
    expect(s.fontWeight).toBeUndefined();
  });

  it('bn conjunct label uses the Bengali family', async () => {
    await mount(<Button testID="b" label={LONG_BN} onPress={() => {}} />, { locale: 'bn' });
    expect(flatStyle(screen.getByText(LONG_BN)).fontFamily).toBe(fontFamily.bengali.semibold);
  });
});

describe('Button focus', () => {
  it('shows the outside focus ring on focus', async () => {
    await mount(<Button testID="b" label="Go" onPress={() => {}} />, { scheme: 'dark' });
    await fireEvent(button(), 'focus');
    expect(flatStyle(button())).toMatchObject({ outlineWidth: 2, outlineOffset: 2, outlineColor: allColors.dark.focusRing });
  });
});
