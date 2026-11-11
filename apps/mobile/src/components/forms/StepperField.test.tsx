import { useState } from 'react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import { Pressable } from 'react-native';
import { mount, restoreMount } from '../../test-utils/mount.tsx';
import { expectNoFixedTextHeight, expectTouchTarget, flatStyle } from '../../test-utils/touch-target.ts';
import { allColors, fontFamily } from '../../theme/tokens.ts';
import { StepperField, type StepperFieldProps } from './StepperField.tsx';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(restoreMount);

const HIDDEN = { includeHiddenElements: true } as const;
const input = () => screen.getByTestId('st');
const minus = () => screen.getByTestId('st-minus');
const plus = () => screen.getByTestId('st-plus');

type HarnessProps = Partial<Omit<StepperFieldProps, 'value' | 'onChange'>> & {
  initial?: number | null;
  onChange?: (v: number | null) => void;
};

/** Controlled parent: the field is only ever driven through value/onChange, like a real screen. */
function Harness({ initial = null, onChange, ...rest }: HarnessProps) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <StepperField
        testID="st"
        label="Milk yield"
        {...rest}
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
      <Pressable testID="reset" onPress={() => setValue(null)} />
      <Pressable testID="set-7" onPress={() => setValue(7)} />
    </>
  );
}

const type = (text: string) => fireEvent.changeText(input(), text);

describe('StepperField semantics', () => {
  it('the input is a named decimal-pad field; unit joins the name; label stop is hidden', async () => {
    await mount(<Harness unit="L" />);
    expect(input().props).toMatchObject({ keyboardType: 'decimal-pad', accessibilityLabel: 'Milk yield, L', returnKeyType: 'done' });
    expect(input().props.accessibilityState).toMatchObject({ disabled: false });
    expect(screen.queryByText('Milk yield')).toBeNull();
    expect(screen.getByText('Milk yield', HIDDEN)).toBeTruthy();
  });

  it('no unit: the name is just the label', async () => {
    await mount(<Harness />);
    expect(input().props.accessibilityLabel).toBe('Milk yield');
  });

  it('returnKeyType is next when onSubmitEditing is supplied, and it fires', async () => {
    const onSubmitEditing = jest.fn();
    await mount(<Harness onSubmitEditing={onSubmitEditing} />);
    expect(input().props.returnKeyType).toBe('next');
    await fireEvent(input(), 'submitEditing');
    expect(onSubmitEditing).toHaveBeenCalledTimes(1);
  });

  it('the step buttons are named with the label and the formatted step (en)', async () => {
    await mount(<Harness step={0.5} />);
    expect(minus().props.accessibilityLabel).toBe('Decrease Milk yield by 0.5');
    expect(plus().props.accessibilityLabel).toBe('Increase Milk yield by 0.5');
  });

  it('bn: Bangla copy with the step in the chosen digit system', async () => {
    await mount(<Harness label="দুধ" step={0.5} />, { locale: 'bn', digits: 'beng' });
    expect(plus().props.accessibilityLabel).toBe('দুধ ০.৫ বাড়ান');
    expect(minus().props.accessibilityLabel).toBe('দুধ ০.৫ কমান');
  });

  it('exposes increment / decrement accessibility actions that adjust the value', async () => {
    const onChange = jest.fn();
    await mount(<Harness initial={10} onChange={onChange} />);
    expect(input().props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(['increment', 'decrement']);
    await fireEvent(input(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(10.5);
    await fireEvent(input(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith(10);
    await fireEvent(input(), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('accessibility actions respect bounds and disabled', async () => {
    const onChange = jest.fn();
    await mount(<Harness initial={20} max={20} onChange={onChange} />);
    await fireEvent(input(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).not.toHaveBeenCalled();
    await mount(<Harness initial={5} disabled onChange={onChange} />);
    await fireEvent(input(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('StepperField +/- buttons', () => {
  it('plus from empty gives min + step; minus from empty is disabled', async () => {
    const onChange = jest.fn();
    await mount(<Harness onChange={onChange} />);
    expect(minus().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(minus());
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(plus());
    expect(onChange).toHaveBeenCalledWith(0.5);
    expect(input().props.value).toBe('0.5');
  });

  it('plus from empty honours a custom min', async () => {
    const onChange = jest.fn();
    await mount(<Harness min={2} onChange={onChange} />);
    await fireEvent.press(plus());
    expect(onChange).toHaveBeenCalledWith(2.5);
  });

  it('steps by `step` and shows the new value', async () => {
    const onChange = jest.fn();
    await mount(<Harness initial={12} step={0.5} onChange={onChange} />);
    await fireEvent.press(plus());
    expect(input().props.value).toBe('12.5');
    await fireEvent.press(minus());
    await fireEvent.press(minus());
    expect(input().props.value).toBe('11.5');
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([12.5, 12, 11.5]);
  });

  it('no float drift over repeated steps', async () => {
    await mount(<Harness initial={0} step={0.1} />);
    for (let i = 0; i < 3; i++) await fireEvent.press(plus());
    expect(input().props.value).toBe('0.3');
  });

  it('minus is disabled (not removed) at min; plus is disabled at max; presses are ignored', async () => {
    const onChange = jest.fn();
    await mount(<Harness initial={0} min={0} max={1} onChange={onChange} />);
    expect(minus().props.accessibilityState).toMatchObject({ disabled: true });
    expect(plus().props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(minus());
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(plus());
    await fireEvent.press(plus());
    expect(input().props.value).toBe('1');
    expect(plus().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(plus());
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([0.5, 1]);
  });

  it('a step that would pass max clamps to max', async () => {
    await mount(<Harness initial={19.8} max={20} />);
    await fireEvent.press(plus());
    expect(input().props.value).toBe('20');
  });

  it('disabled field disables everything', async () => {
    const onChange = jest.fn();
    await mount(<Harness initial={5} disabled onChange={onChange} />);
    expect(input().props.editable).toBe(false);
    expect(minus().props.accessibilityState).toMatchObject({ disabled: true });
    expect(plus().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(plus());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('buttons are 56dp squares in the one-row layout', async () => {
    await mount(<Harness initial={5} />);
    expectTouchTarget(minus(), 56, { requireWidth: true });
    expectTouchTarget(plus(), 56, { requireWidth: true });
  });
});

describe('StepperField typing (draft, parsing, clamping)', () => {
  it('shows the value as a plain string; empty for null', async () => {
    await mount(<Harness initial={12.5} />);
    expect(input().props.value).toBe('12.5');
    await mount(<Harness initial={null} />);
    expect(input().props.value).toBe('');
  });

  it('emits numbers as they become valid; "12." stays editable without re-emitting', async () => {
    const onChange = jest.fn();
    await mount(<Harness onChange={onChange} />);
    await type('12');
    expect(onChange).toHaveBeenLastCalledWith(12);
    await type('12.');
    expect(input().props.value).toBe('12.');
    expect(onChange).toHaveBeenCalledTimes(1);
    await type('12.5');
    expect(onChange).toHaveBeenLastCalledWith(12.5);
    expect(input().props.value).toBe('12.5');
  });

  it('blur normalises the draft ("12." -> "12", "007" -> "7")', async () => {
    await mount(<Harness />);
    await type('12.');
    await fireEvent(input(), 'blur');
    expect(input().props.value).toBe('12');
    await type('007');
    await fireEvent(input(), 'blur');
    expect(input().props.value).toBe('7');
  });

  it('comma decimal separator works and is normalised on blur', async () => {
    const onChange = jest.fn();
    await mount(<Harness onChange={onChange} />);
    await type('12,5');
    expect(onChange).toHaveBeenLastCalledWith(12.5);
    await fireEvent(input(), 'blur');
    expect(input().props.value).toBe('12.5');
  });

  it('Bangla digits typed on any setting parse; blur shows the chosen digit system', async () => {
    const onChange = jest.fn();
    await mount(<Harness onChange={onChange} />, { digits: 'latn' });
    await type('১২.৫');
    expect(onChange).toHaveBeenLastCalledWith(12.5);
    await fireEvent(input(), 'blur');
    expect(input().props.value).toBe('12.5');
  });

  it('digits=beng displays Bangla digits for the value, the draft and after +/-', async () => {
    await mount(<Harness initial={12.5} />, { digits: 'beng', locale: 'bn' });
    expect(input().props.value).toBe('১২.৫');
    await fireEvent.press(plus());
    expect(input().props.value).toBe('১৩');
  });

  it('invalid keystrokes are ignored: letters, signs, two separators, exponent', async () => {
    const onChange = jest.fn();
    await mount(<Harness initial={5} onChange={onChange} />);
    for (const bad of ['5a', '-5', '5.5.5', '5e3', '+5', '5 kg']) await type(bad);
    expect(input().props.value).toBe('5');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('too many fraction digits is ignored (never rounded)', async () => {
    const onChange = jest.fn();
    await mount(<Harness decimals={1} onChange={onChange} />);
    await type('12.5');
    await type('12.55');
    expect(input().props.value).toBe('12.5');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('decimals=0 accepts integers only', async () => {
    await mount(<Harness decimals={0} step={1} />);
    await type('12');
    await type('12.');
    expect(input().props.value).toBe('12');
  });

  it('a keystroke that would exceed max is ignored', async () => {
    const onChange = jest.fn();
    await mount(<Harness max={50} onChange={onChange} />);
    await type('5');
    await type('51');
    await type('500');
    expect(input().props.value).toBe('5');
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([5]);
  });

  it('a value below min is allowed while typing and pulled up to min on blur', async () => {
    const onChange = jest.fn();
    await mount(<Harness min={10} onChange={onChange} />);
    await type('1');
    expect(onChange).toHaveBeenLastCalledWith(1);
    await type('12');
    expect(onChange).toHaveBeenLastCalledWith(12);
    await type('1');
    await fireEvent(input(), 'blur');
    expect(input().props.value).toBe('10');
    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it('clearing the text emits null', async () => {
    const onChange = jest.fn();
    await mount(<Harness initial={5} onChange={onChange} />);
    await type('');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(input().props.value).toBe('');
    expect(minus().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('a lone separator is legal mid-typing and blurs to empty', async () => {
    const onChange = jest.fn();
    await mount(<Harness onChange={onChange} />);
    await type('.');
    expect(input().props.value).toBe('.');
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent(input(), 'blur');
    expect(input().props.value).toBe('');
  });

  it('follows external value changes (null reset, set)', async () => {
    await mount(<Harness initial={5} />);
    await fireEvent.press(screen.getByTestId('reset'));
    expect(input().props.value).toBe('');
    await fireEvent.press(screen.getByTestId('set-7'));
    expect(input().props.value).toBe('7');
  });

  it('placeholderValue shows as a ghost placeholder, never as the value', async () => {
    const onChange = jest.fn();
    await mount(<Harness placeholderValue={12.5} onChange={onChange} />);
    expect(input().props.placeholder).toBe('12.5');
    expect(input().props.value).toBe('');
    expect(input().props.placeholderTextColor).toBe(allColors.light.mutedForeground);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('StepperField layout', () => {
  it('1x: one row, value field flexes between the buttons, 56dp tall', async () => {
    await mount(<Harness initial={5} />);
    const box = screen.getByTestId('stepper-field-input-box');
    expectTouchTarget(box, 56);
    expect(flatStyle(box).flex).toBe(1);
    expect(flatStyle(box).height).toBeUndefined();
  });

  it('1.3 is NOT stacked (strictly greater-than)', async () => {
    await mount(<Harness initial={5} />, { fontScale: 1.3 });
    expect(flatStyle(screen.getByTestId('stepper-field-input-box')).flex).toBe(1);
  });

  it('2.0: value field on its own row, step buttons below as two flex:1 56dp buttons', async () => {
    await mount(<Harness initial={5} />, { fontScale: 2 });
    const box = screen.getByTestId('stepper-field-input-box');
    expect(flatStyle(box).flex).toBeUndefined();
    expectTouchTarget(box, 56);
    expect(flatStyle(minus().parent as never).flex).toBe(1);
    expect(flatStyle(plus().parent as never).flex).toBe(1);
    expectTouchTarget(minus(), 56);
    expectTouchTarget(plus(), 56);
    expectNoFixedTextHeight(screen.getByTestId('stepper-field-row') as never);
  });

  it('the value is a `stat` input: 28 at 1x in Inter; Bangla value in Noto Sans Bengali', async () => {
    await mount(<Harness initial={5} />);
    expect(flatStyle(input())).toMatchObject({ fontSize: 28, fontFamily: fontFamily.latin.semibold, textAlign: 'center' });
    expect(flatStyle(input()).lineHeight).toBeUndefined();
    await mount(<Harness initial={5} />, { locale: 'bn', digits: 'beng' });
    expect(flatStyle(input()).fontFamily).toBe(fontFamily.bengali.semibold);
  });

  it('stat cap is 1.5: a 6-character value fits by scaling, never by truncating', async () => {
    await mount(<Harness initial={1234.5} />, { fontScale: 2 });
    expect(input().props.maxFontSizeMultiplier).toBe(1.5);
    expect(input().props.numberOfLines).toBeUndefined();
  });

  it('unit sits inside the field, never shrinks', async () => {
    await mount(<Harness initial={5} unit="L" />);
    expect(flatStyle(screen.getByTestId('stepper-field-unit')).flexShrink).toBe(0);
    expect(screen.getByText('L')).toBeTruthy();
  });

  it('hint is shown and is the accessibilityHint', async () => {
    await mount(<Harness hint="Last: 12.5 L" />);
    expect(screen.getByText('Last: 12.5 L', HIDDEN)).toBeTruthy();
    expect(input().props.accessibilityHint).toBe('Last: 12.5 L');
  });

  it('error: glyph + text + destructive border, announced via live region; wins over the hint', async () => {
    await mount(<Harness hint="Last: 12.5 L" error="Enter the yield" />);
    expect(screen.getByText('Enter the yield')).toBeTruthy();
    expect(screen.getByTestId('field-error').props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByTestId('glyph-exclamation', HIDDEN)).toBeTruthy();
    expect(input().props.accessibilityHint).toBe('Enter the yield');
    expect(flatStyle(screen.getByTestId('stepper-field-input-box')).borderColor).toBe(allColors.light.destructive);
  });

  it('focus draws the outside ring on the value box', async () => {
    await mount(<Harness initial={5} />);
    await fireEvent(input(), 'focus');
    expect(flatStyle(screen.getByTestId('stepper-field-input-box'))).toMatchObject({ outlineWidth: 2, outlineColor: allColors.light.focusRing });
  });
});

describe('StepperField themes', () => {
  it.each(['light', 'dark'] as const)('resolves tokens through the theme (%s)', async (scheme) => {
    const c = allColors[scheme];
    await mount(<Harness initial={5} />, { scheme });
    expect(flatStyle(screen.getByTestId('stepper-field-input-box'))).toMatchObject({ backgroundColor: c.card, borderColor: c.inputBorder });
    expect(flatStyle(input()).color).toBe(c.foreground);
    expect(flatStyle(minus()).backgroundColor).toBe(c.secondary);
  });
});
