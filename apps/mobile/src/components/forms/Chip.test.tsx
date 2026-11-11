import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import { pressDown, pressUp } from '../../test-utils/press.ts';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { expectNoFixedTextHeight, expectTouchTarget, findNodes, flatStyle } from '../../test-utils/touch-target.ts';
import { allColors, fontFamily, radius } from '../../theme/tokens.ts';
import { Chip, ChipGroup } from './Chip.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const HIDDEN = { includeHiddenElements: true } as const;
const chip = () => screen.getByTestId('c');
const noop = () => {};
const LONG_BN = 'সকালের দুধ দোহনের প্রথম পালা এবং বিশেষ নোট';

describe('Chip semantics', () => {
  it.each([true, false])('is a radio named by its label, checked=%s', async (selected) => {
    await mount(<Chip testID="c" label="Morning" selected={selected} onPress={noop} />);
    expect(chip().props.accessibilityRole).toBe('radio');
    expect(chip().props.accessibilityLabel).toBe('Morning');
    expect(chip().props.accessibilityState).toMatchObject({ checked: selected, disabled: false });
  });

  it('calls onPress once', async () => {
    const onPress = jest.fn();
    await mount(<Chip testID="c" label="Morning" selected={false} onPress={onPress} />);
    await fireEvent.press(chip());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled: ignores presses and reports disabled (checked kept)', async () => {
    const onPress = jest.fn();
    await mount(<Chip testID="c" label="Morning" selected disabled onPress={onPress} />);
    await fireEvent.press(chip());
    expect(onPress).not.toHaveBeenCalled();
    expect(chip().props.accessibilityState).toMatchObject({ checked: true, disabled: true });
  });

  it('the leading slot (dot / ring / check) is hidden from accessibility', async () => {
    await mount(<Chip testID="c" label="Morning" selected={false} accentColor="sessionMorning" onPress={noop} />);
    expect(screen.getByTestId('chip-slot', HIDDEN).props.accessibilityElementsHidden).toBe(true);
    expect(screen.queryByTestId('chip-slot')).toBeNull();
  });
});

describe('Chip leading slot', () => {
  it('always present with a fixed 18dp box so width does not jump on selection', async () => {
    for (const selected of [false, true]) {
      const view = await mount(<Chip testID="c" label="Morning" selected={selected} onPress={noop} />);
      expect(flatStyle(screen.getByTestId('chip-slot', HIDDEN))).toMatchObject({ width: 18, height: 18 });
      view.unmount();
    }
  });

  it('unselected + accent: a 10dp dot in the accent token, beside the word', async () => {
    await mount(<Chip testID="c" label="Morning" selected={false} accentColor="sessionMorning" onPress={noop} />);
    const dot = screen.getByTestId('chip-accent-dot', HIDDEN);
    expect(flatStyle(dot)).toMatchObject({ width: 10, height: 10, backgroundColor: allColors.light.sessionMorning });
    expect(screen.getByText('Morning')).toBeTruthy();
    expect(screen.queryByTestId('chip-ring', HIDDEN)).toBeNull();
  });

  it('unselected without accent: an empty ring in inputBorder, no dot', async () => {
    await mount(<Chip testID="c" label="Morning" selected={false} onPress={noop} />);
    expect(flatStyle(screen.getByTestId('chip-ring', HIDDEN))).toMatchObject({ borderWidth: 2, borderColor: allColors.light.inputBorder });
    expect(screen.queryByTestId('chip-accent-dot', HIDDEN)).toBeNull();
  });

  it('selected: a check glyph in primaryForeground replaces the dot even when an accent is given', async () => {
    await mount(<Chip testID="c" label="Morning" selected accentColor="sessionMorning" onPress={noop} />);
    expect(screen.getByTestId('glyph-check', HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId('chip-accent-dot', HIDDEN)).toBeNull();
    expect(screen.queryByTestId('chip-ring', HIDDEN)).toBeNull();
  });
});

describe('Chip sizing', () => {
  it.each([true, false])('48dp target in both axes (selected=%s)', async (selected) => {
    await mount(<Chip testID="c" label="Am" selected={selected} onPress={noop} />);
    expectTouchTarget(chip(), 48, { requireWidth: true });
    expect(flatStyle(chip())).toMatchObject({ borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 16 });
    expect(flatStyle(chip()).height).toBeUndefined();
  });

  it.each(['en', 'bn'] as const)('200%% font scale (%s): grows by minHeight, label wraps, no fixed text height', async (locale) => {
    await mount(<Chip testID="c" label={locale === 'bn' ? LONG_BN : 'Early morning milking session'} selected onPress={noop} />, { locale, fontScale: 2 });
    expectTouchTarget(chip(), 48, { requireWidth: true });
    expectNoFixedTextHeight(chip());
    const label = findNodes(chip(), (n) => n.type === 'Text')[0]!;
    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.props.ellipsizeMode).toBeUndefined();
    expect(flatStyle(label)).toMatchObject({ flexShrink: 1, textAlign: 'center' });
    expect(flatStyle(chip()).maxWidth).toBe('100%');
  });
});

describe('Chip colours in both themes', () => {
  it.each(['light', 'dark'] as const)('unselected / selected / disabled resolve through tokens (%s)', async (scheme) => {
    const c = allColors[scheme];
    let view = await mount(<Chip testID="c" label="Go" selected={false} onPress={noop} />, { scheme });
    expect(flatStyle(chip())).toMatchObject({ backgroundColor: c.card, borderColor: c.inputBorder });
    expect(flatStyle(screen.getByText('Go')).color).toBe(c.foreground);
    view.unmount();

    view = await mount(<Chip testID="c" label="Go" selected onPress={noop} />, { scheme });
    expect(flatStyle(chip())).toMatchObject({ backgroundColor: c.primary, borderColor: c.primary });
    expect(flatStyle(screen.getByText('Go')).color).toBe(c.primaryForeground);
    view.unmount();

    for (const selected of [false, true]) {
      view = await mount(<Chip testID="c" label="Go" selected={selected} disabled onPress={noop} />, { scheme });
      expect(flatStyle(chip())).toMatchObject({ backgroundColor: c.muted, borderColor: c.border });
      expect(flatStyle(screen.getByText('Go')).color).toBe(c.mutedForeground);
      view.unmount();
    }
  });

  it('selected pressed swaps the fill to primaryHover (never the overlay)', async () => {
    await mount(<Chip testID="c" label="Go" selected onPress={noop} />);
    await pressDown(chip());
    expect(flatStyle(chip()).backgroundColor).toBe(allColors.light.primaryHover);
    expect(screen.queryByTestId('pressed-overlay', HIDDEN)).toBeNull();
    await pressUp(chip());
    expect(flatStyle(chip()).backgroundColor).toBe(allColors.light.primary);
  });

  it('unselected pressed draws the 12% foreground overlay under the label', async () => {
    await mount(<Chip testID="c" label="Go" selected={false} onPress={noop} />);
    await pressDown(chip());
    expect(screen.getByTestId('pressed-overlay', HIDDEN)).toBeTruthy();
    await pressUp(chip());
    expect(screen.queryByTestId('pressed-overlay', HIDDEN)).toBeNull();
  });

  it('focus shows the 2dp outside ring', async () => {
    await mount(<Chip testID="c" label="Go" selected={false} onPress={noop} />);
    await fireEvent(chip(), 'focus');
    expect(flatStyle(chip())).toMatchObject({ outlineWidth: 2, outlineOffset: 2, outlineColor: allColors.light.focusRing });
  });
});

describe('Chip locales', () => {
  it('bn Bangla label renders in Noto Sans Bengali; script="latin" forces Inter', async () => {
    await mount(<Chip testID="c" label="সকাল" selected={false} onPress={noop} />, { locale: 'bn' });
    expect(flatStyle(screen.getByText('সকাল')).fontFamily).toBe(fontFamily.bengali.semibold);
    await mount(<Chip testID="c2" label="AM" script="latin" selected={false} onPress={noop} />, { locale: 'bn' });
    expect(flatStyle(screen.getByText('AM')).fontFamily).toBe(fontFamily.latin.semibold);
  });

  it('a Latin label in bn still uses Bengali (whole-string rule)', async () => {
    await mount(<Chip testID="c" label="AM" selected={false} onPress={noop} />, { locale: 'bn' });
    expect(flatStyle(screen.getByText('AM')).fontFamily).toBe(fontFamily.bengali.semibold);
  });
});

describe('ChipGroup', () => {
  it('is a radiogroup with the required label; wraps in a row with 8dp gaps; no horizontal scroll', async () => {
    await mount(
      <ChipGroup accessibilityLabel="Milking session">
        <Chip testID="a" label="Morning" selected onPress={noop} />
        <Chip testID="b" label="Evening" selected={false} onPress={noop} />
      </ChipGroup>,
    );
    const group = screen.getByLabelText('Milking session');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(flatStyle(group)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap', gap: 8 });
    expect(findNodes(group, (n) => n.type === 'RCTScrollView')).toHaveLength(0);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('requires accessibilityLabel at the type level', () => {
    // @ts-expect-error accessibilityLabel is required: a radiogroup needs a name
    const missing = <ChipGroup>{null}</ChipGroup>;
    expect(missing).toBeTruthy();
  });

  it('single-select is the caller\'s: only the checked chip reports checked', async () => {
    await mount(
      <ChipGroup accessibilityLabel="Session">
        <Chip testID="a" label="Morning" selected onPress={noop} />
        <Chip testID="b" label="Noon" selected={false} accentColor="sessionNoon" onPress={noop} />
        <Chip testID="c" label="Evening" selected={false} accentColor="sessionEvening" onPress={noop} />
      </ChipGroup>,
    );
    const checked = screen.getAllByRole('radio').filter((r) => r.props.accessibilityState.checked === true);
    expect(checked).toHaveLength(1);
    expect(checked[0]!.props.accessibilityLabel).toBe('Morning');
  });

  it('six chips at 200% wrap: every chip keeps its 48dp target', async () => {
    const names = ['Early', 'Morning', 'Noon', 'Afternoon', 'Evening', 'Night'];
    await mount(
      <ChipGroup accessibilityLabel="Session">
        {names.map((n) => (
          <Chip key={n} testID={`chip-${n}`} label={n} selected={false} onPress={noop} />
        ))}
      </ChipGroup>,
      { fontScale: 2 },
    );
    for (const n of names) expectTouchTarget(screen.getByTestId(`chip-${n}`), 48, { requireWidth: true });
  });
});
