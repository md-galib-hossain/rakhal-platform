import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Pressable, type TextInputInstance } from 'react-native';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { expectNoFixedTextHeight, expectTouchTarget, flatStyle } from '../../test-utils/touch-target.ts';
import { allColors, fontFamily, radius } from '../../theme/tokens.ts';
import { MULTILINE_MIN_HEIGHT, TextField } from './TextField.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const HIDDEN = { includeHiddenElements: true } as const;
const input = () => screen.getByTestId('tf');
const box = () => screen.getByTestId('text-field-container');
const noop = () => {};

describe('TextField semantics', () => {
  it('the input is the single named stop: label as name, state, no separate label stop', async () => {
    await mount(<TextField testID="tf" label="Animal tag" value="" onChangeText={noop} />);
    expect(input().props.accessibilityLabel).toBe('Animal tag');
    expect(input().props.accessibilityState).toMatchObject({ disabled: false });
    expect(input().props.accessibilityHint).toBeUndefined();
    // The visible label exists but is hidden from the accessibility tree (no second stop).
    expect(screen.getByText('Animal tag', HIDDEN)).toBeTruthy();
    expect(screen.queryByText('Animal tag')).toBeNull();
    expect(box().props.accessible).toBe(false);
  });

  it('with a unit the accessible name includes it through a11y.fieldWithUnit', async () => {
    await mount(<TextField testID="tf" label="Weight" unit="kg" value="" onChangeText={noop} />);
    expect(input().props.accessibilityLabel).toBe('Weight, kg');
  });

  it('forwards typed text and edits through onChangeText', async () => {
    const onChangeText = jest.fn();
    await mount(<TextField testID="tf" label="Name" value="" onChangeText={onChangeText} />);
    await fireEvent.changeText(input(), 'Lali');
    expect(onChangeText).toHaveBeenCalledWith('Lali');
  });

  it('is controlled: shows the value prop and follows updates', async () => {
    function Harness() {
      const [v, setV] = useState('Lali');
      return (
        <>
          <TextField testID="tf" label="Name" value={v} onChangeText={noop} />
          <Pressable testID="set" onPress={() => setV('Moti')} />
        </>
      );
    }
    await mount(<Harness />);
    expect(input().props.value).toBe('Lali');
    await fireEvent.press(screen.getByTestId('set'));
    expect(input().props.value).toBe('Moti');
  });

  it('optional appends the localized word; required fields are unmarked', async () => {
    await mount(<TextField testID="tf" label="Note" optional value="" onChangeText={noop} />);
    expect(screen.getByText(/optional/, HIDDEN)).toBeTruthy();
  });

  it('optional marker is Bangla in bn', async () => {
    await mount(<TextField testID="tf" label="Note" optional value="" onChangeText={noop} />, { locale: 'bn' });
    expect(screen.getByText(/ঐচ্ছিক/, HIDDEN)).toBeTruthy();
  });

  it('required: no optional marker', async () => {
    await mount(<TextField testID="tf" label="Note" value="" onChangeText={noop} />);
    expect(screen.queryByText(/optional/, HIDDEN)).toBeNull();
  });

  it('forwards keyboard props, maxLength, submit and autoFocus', async () => {
    const onSubmitEditing = jest.fn();
    await mount(
      <TextField
        testID="tf"
        label="Tag"
        value=""
        onChangeText={noop}
        keyboardType="number-pad"
        inputMode="numeric"
        autoCapitalize="characters"
        returnKeyType="next"
        maxLength={8}
        autoFocus
        onSubmitEditing={onSubmitEditing}
      />,
    );
    expect(input().props).toMatchObject({ keyboardType: 'number-pad', inputMode: 'numeric', autoCapitalize: 'characters', returnKeyType: 'next', maxLength: 8, autoFocus: true });
    await fireEvent(input(), 'submitEditing');
    expect(onSubmitEditing).toHaveBeenCalledTimes(1);
  });

  it('inputRef forwards a focusable instance (auto-advance focus)', async () => {
    const ref = createRef<TextInputInstance>();
    await mount(<TextField testID="tf" label="Tag" value="" onChangeText={noop} inputRef={ref} />);
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.focus).toBe('function');
  });

  it('inputRef works as a callback ref', async () => {
    const seen: unknown[] = [];
    await mount(<TextField testID="tf" label="Tag" value="" onChangeText={noop} inputRef={(n) => void seen.push(n)} />);
    expect(seen.some((n) => n !== null)).toBe(true);
  });
});

describe('TextField hint and error', () => {
  it('hint renders below, mutedForeground, and is the accessibilityHint', async () => {
    await mount(<TextField testID="tf" label="Weight" hint="Last: 12.5" value="" onChangeText={noop} />);
    expect(input().props.accessibilityHint).toBe('Last: 12.5');
    expect(flatStyle(screen.getByText('Last: 12.5', HIDDEN)).color).toBe(allColors.light.mutedForeground);
    expect(screen.queryByTestId('glyph-exclamation', HIDDEN)).toBeNull();
  });

  it('error: glyph + text + destructive border; error text becomes the accessibilityHint (wins over hint)', async () => {
    await mount(<TextField testID="tf" label="Weight" hint="Last: 12.5" error="Enter a weight" value="" onChangeText={noop} />);
    expect(screen.getByText('Enter a weight')).toBeTruthy();
    expect(screen.getByTestId('glyph-exclamation', HIDDEN).props.accessibilityElementsHidden).toBe(true);
    expect(input().props.accessibilityHint).toBe('Enter a weight');
    expect(flatStyle(box()).borderColor).toBe(allColors.light.destructive);
    expect(flatStyle(screen.getByText('Enter a weight')).color).toBe(allColors.light.destructiveText);
  });

  it('error is announced: polite live region + alert role on the message container', async () => {
    await mount(<TextField testID="tf" label="Weight" error="Enter a weight" value="" onChangeText={noop} />);
    const region = screen.getByTestId('field-error');
    expect(region.props.accessibilityLiveRegion).toBe('polite');
    expect(region.props.accessibilityRole).toBe('alert');
  });

  it('no hint / no error: nothing reserved below the field', async () => {
    await mount(<TextField testID="tf" label="Weight" value="" onChangeText={noop} />);
    expect(screen.queryByTestId('field-hint', HIDDEN)).toBeNull();
    expect(screen.queryByTestId('field-error', HIDDEN)).toBeNull();
  });

  it('long Bangla error / hint wrap: no numberOfLines anywhere', async () => {
    const long = 'গবাদিপশুর ওজন অবশ্যই শূন্যের চেয়ে বেশি হতে হবে এবং অনুগ্রহ করে আবার চেষ্টা করুন';
    await mount(<TextField testID="tf" label="ওজন" hint={long} error={long} value="" onChangeText={noop} />, { locale: 'bn', fontScale: 2 });
    for (const t of screen.getAllByText(long, HIDDEN)) {
      expect(t.props.numberOfLines).toBeUndefined();
      expect(t.props.ellipsizeMode).toBeUndefined();
    }
  });
});

describe('TextField unit', () => {
  it('renders the unit unwrapped, never shrinking, mutedForeground', async () => {
    await mount(<TextField testID="tf" label="Weight" unit="kg" value="12" onChangeText={noop} />);
    const unit = screen.getByTestId('text-field-unit');
    expect(flatStyle(unit).flexShrink).toBe(0);
    const text = screen.getByText('kg');
    expect(text.props.numberOfLines).toBeUndefined();
    expect(flatStyle(text).color).toBe(allColors.light.mutedForeground);
    expect(flatStyle(input()).flex).toBe(1);
  });

  it('no unit: nothing rendered', async () => {
    await mount(<TextField testID="tf" label="Weight" value="12" onChangeText={noop} />);
    expect(screen.queryByTestId('text-field-unit')).toBeNull();
  });

  it('stays inline at 1x even when wide', async () => {
    await mount(<TextField testID="tf" label="Weight" unit="kilograms" value="12" onChangeText={noop} />);
    await fireEvent(box(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 56 } } });
    await fireEvent(screen.getByTestId('text-field-unit'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 20 } } });
    expect(flatStyle(box()).flexDirection).toBe('row');
  });

  it('at font scale 2 the unit drops under the value when wider than 40% of the field', async () => {
    await mount(<TextField testID="tf" label="Weight" unit="kilograms" value="12" onChangeText={noop} />, { fontScale: 2 });
    await fireEvent(box(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 56 } } });
    await fireEvent(screen.getByTestId('text-field-unit'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 20 } } });
    expect(flatStyle(box()).flexDirection).toBe('column');
    expect(flatStyle(screen.getByTestId('text-field-unit')).flexShrink).toBe(0);
  });

  it('at font scale 2 a narrow unit stays on the same line', async () => {
    await mount(<TextField testID="tf" label="Weight" unit="kg" value="12" onChangeText={noop} />, { fontScale: 2 });
    await fireEvent(box(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 56 } } });
    await fireEvent(screen.getByTestId('text-field-unit'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 40, height: 20 } } });
    expect(flatStyle(box()).flexDirection).toBe('row');
  });
});

describe('TextField sizing and states', () => {
  it('container is a 56dp target (minHeight only), radius md, 1dp border, card fill, inputBorder', async () => {
    await mount(<TextField testID="tf" label="Name" value="" onChangeText={noop} />);
    expectTouchTarget(box(), 56);
    expect(flatStyle(box())).toMatchObject({ borderWidth: 1, borderRadius: radius.md, backgroundColor: allColors.light.card, borderColor: allColors.light.inputBorder });
    expect(flatStyle(box()).height).toBeUndefined();
  });

  it('200% font scale: still minHeight only, no fixed height on any text holder', async () => {
    await mount(<TextField testID="tf" label="Name" unit="kg" hint="Hint" value="12" onChangeText={noop} />, { fontScale: 2 });
    expectTouchTarget(box(), 56);
    expectNoFixedTextHeight(screen.getByTestId('tf').parent as never);
    expectNoFixedTextHeight(box());
  });

  it('multiline: taller minHeight, top-aligned text, lineHeight applied (single-line has none)', async () => {
    await mount(<TextField testID="tf" label="Note" multiline value="a" onChangeText={noop} />);
    expect(flatStyle(box()).minHeight).toBe(MULTILINE_MIN_HEIGHT);
    expect(MULTILINE_MIN_HEIGHT).toBe(112);
    expect(flatStyle(input())).toMatchObject({ textAlignVertical: 'top' });
    expect(flatStyle(input()).lineHeight).toBeGreaterThan(0);
    expect(input().props.multiline).toBe(true);
  });

  it('single line: no explicit lineHeight, centred vertically (spike V-C3 workaround)', async () => {
    await mount(<TextField testID="tf" label="Name" value="x" onChangeText={noop} />);
    expect(flatStyle(input()).lineHeight).toBeUndefined();
    expect(flatStyle(input()).textAlignVertical).toBe('center');
  });

  it('disabled: not editable, muted fill, mutedForeground text, border token, disabled state', async () => {
    await mount(<TextField testID="tf" label="Name" disabled value="x" onChangeText={noop} />);
    expect(input().props.editable).toBe(false);
    expect(input().props.accessibilityState).toMatchObject({ disabled: true });
    expect(flatStyle(box())).toMatchObject({ backgroundColor: allColors.light.muted, borderColor: allColors.light.border });
    expect(flatStyle(input()).color).toBe(allColors.light.mutedForeground);
  });

  it('focus draws the 2dp outside ring on the container; blur removes it; no border-width change', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await mount(<TextField testID="tf" label="Name" value="" onChangeText={noop} onFocus={onFocus} onBlur={onBlur} />);
    expect(flatStyle(box()).outlineWidth).toBeUndefined();
    await fireEvent(input(), 'focus');
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(flatStyle(box())).toMatchObject({ outlineWidth: 2, outlineOffset: 2, outlineColor: allColors.light.focusRing, borderWidth: 1 });
    await fireEvent(input(), 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(flatStyle(box()).outlineWidth).toBeUndefined();
  });

  it('tapping the container focuses the input', async () => {
    const ref = createRef<TextInputInstance>();
    await mount(<TextField testID="tf" label="Name" value="" onChangeText={noop} inputRef={ref} />);
    const focus = jest.spyOn(ref.current!, 'focus');
    await fireEvent.press(box());
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('placeholder uses mutedForeground and is not the label', async () => {
    await mount(<TextField testID="tf" label="Name" placeholder="e.g. Lali" value="" onChangeText={noop} />);
    expect(input().props.placeholder).toBe('e.g. Lali');
    expect(input().props.placeholderTextColor).toBe(allColors.light.mutedForeground);
    expect(input().props.accessibilityLabel).toBe('Name');
  });
});

describe('TextField themes and locales', () => {
  it.each(['light', 'dark'] as const)('resolves tokens (%s)', async (scheme) => {
    const c = allColors[scheme];
    await mount(<TextField testID="tf" label="Name" value="x" onChangeText={noop} />, { scheme });
    expect(flatStyle(box())).toMatchObject({ backgroundColor: c.card, borderColor: c.inputBorder });
    expect(flatStyle(input()).color).toBe(c.foreground);
    expect(flatStyle(screen.getByText('Name', HIDDEN)).color).toBe(c.foreground);
  });

  it('en value uses Inter at body size; bn Bangla value uses Noto Sans Bengali', async () => {
    await mount(<TextField testID="tf" label="Name" value="Lali" onChangeText={noop} />, { locale: 'en' });
    expect(flatStyle(input())).toMatchObject({ fontFamily: fontFamily.latin.regular, fontSize: 15 });
    await mount(<TextField testID="tf" label="নাম" value="গাভী" onChangeText={noop} />, { locale: 'bn' });
    expect(flatStyle(input())).toMatchObject({ fontFamily: fontFamily.bengali.regular, fontSize: 16 });
  });

  it('family follows the whole value string: a Latin value in bn still uses Bengali (whole-string rule)', async () => {
    await mount(<TextField testID="tf" label="নাম" value="A-1204" onChangeText={noop} />, { locale: 'bn' });
    expect(flatStyle(input()).fontFamily).toBe(fontFamily.bengali.regular);
  });

  it('empty value: family follows the placeholder', async () => {
    await mount(<TextField testID="tf" label="নাম" placeholder="গাভীর নাম" value="" onChangeText={noop} />, { locale: 'en' });
    expect(flatStyle(input()).fontFamily).toBe(fontFamily.bengali.regular);
  });

  it('system mode: RN scales the text but is capped at the body cap (2.0)', async () => {
    await mount(<TextField testID="tf" label="Name" value="x" onChangeText={noop} />, { fontScale: 2 });
    expect(input().props.allowFontScaling).toBe(true);
    expect(input().props.maxFontSizeMultiplier).toBe(2);
  });
});

describe('TextField with act', () => {
  it('does not throw when unmounted while focused', async () => {
    const view = await mount(<TextField testID="tf" label="Name" value="" onChangeText={noop} />);
    await fireEvent(input(), 'focus');
    await act(async () => {
      view.unmount();
    });
  });
});
