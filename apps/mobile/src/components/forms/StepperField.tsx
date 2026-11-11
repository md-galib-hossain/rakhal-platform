/**
 * StepperField (spec 2.4): big-number entry for milk yield / feed amount. A 56dp minus IconButton, a centred `stat`
 * value input on the system `decimal-pad`, a 56dp plus IconButton. At a stacking font scale (> 1.3) the value field
 * takes a full row and the two step buttons sit below it, side by side.
 *
 * - Local DRAFT string so "12." mid-typing is legal. `onChange` fires when the draft parses to a number or empties.
 *   Invalid keystrokes (letters, signs, a second separator, too many fraction digits) and keystrokes that would pass
 *   `max` are ignored (the draft never holds an illegal value). A value BELOW `min` is allowed while typing (so "1"
 *   can become "12" when min is 10) and is pulled up to `min` on blur.
 * - On blur the draft is normalised to the plain string for the value in the user's digit system.
 * - +/-: pure `stepValue` (integer grid, clamped). `null` counts as `min` for +, - is disabled when empty or at min,
 *   + at max. Disabled, never removed.
 * - A11y: single named input (label, unit), `increment` / `decrement` accessibility actions call the same handlers.
 */
import { useEffect, useRef, useState, type Ref } from 'react';
import { Pressable, TextInput, useWindowDimensions, View, type TextInputInstance } from 'react-native';
import { useFormat } from '../../i18n/useFormat.ts';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius, spacing, touchTarget } from '../../theme/tokens.ts';
import { IconButton } from '../actions/IconButton.tsx';
import { focusRingStyle } from '../internal/focus-ring.ts';
import { shouldStack } from '../internal/layout-rules.ts';
import { Text } from '../primitives/Text.tsx';
import { canStep, clampToRange, exceedsMax, parseDecimalInput, stepValue, toInputString } from './decimal-input.ts';
import { FieldLabel, FieldMessages, useInputTextProps } from './field-parts.tsx';

export interface StepperFieldProps {
  label: string;
  /** null = empty. */
  value: number | null;
  onChange: (value: number | null) => void;
  /** Default 0.5. */
  step?: number;
  /** Default 0. */
  min?: number;
  max?: number;
  /** Fraction digits kept; default 1. */
  decimals?: number;
  unit?: string;
  /** Ghost "last value" shown as the placeholder. */
  placeholderValue?: number;
  /** Caller-formatted, e.g. "Last: 12.5 L". */
  hint?: string;
  error?: string;
  disabled?: boolean;
  inputRef?: Ref<TextInputInstance>;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  /** Placed on the TextInput; the buttons get `${testID}-minus` / `${testID}-plus`. */
  testID?: string;
}

function assignRef<T>(ref: Ref<T> | undefined, node: T | null): void {
  if (typeof ref === 'function') ref(node);
  else if (ref) (ref as { current: T | null }).current = node;
}

export function StepperField({
  label,
  value,
  onChange,
  step = 0.5,
  min = 0,
  max,
  decimals = 1,
  unit,
  placeholderValue,
  hint,
  error,
  disabled = false,
  inputRef,
  onSubmitEditing,
  autoFocus,
  testID,
}: StepperFieldProps) {
  const { colors } = useTheme();
  const { t, digits } = useLocale();
  const format = useFormat();
  const { fontScale } = useWindowDimensions();
  const innerRef = useRef<TextInputInstance | null>(null);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => toInputString(value, decimals, digits));

  // Follow external changes (reset, step, digit-system switch) without fighting the user's own typing:
  // a draft that already parses to `value` ("12." for 12) is left alone.
  useEffect(() => {
    const parsed = parseDecimalInput(draft, { decimals });
    if (parsed.kind === 'invalid' ? value !== null : parsed.value !== value) setDraft(toInputString(value, decimals, digits));
    // Only external `value` changes should resync; `draft` is read, not a trigger.
  }, [value]);
  useEffect(() => {
    setDraft((d) => {
      const parsed = parseDecimalInput(d, { decimals });
      return parsed.kind === 'valid' || parsed.kind === 'empty' ? toInputString(parsed.value, decimals, digits) : d;
    });
  }, [digits, decimals]);

  const bounds = { step, min, max, decimals };
  const stacked = shouldStack(fontScale);
  const shown = draft || toInputString(placeholderValue ?? null, decimals, digits);
  const inputText = useInputTextProps(shown, 'stat');
  const stepLabel = format.number(step, { fractionDigits: decimals });
  const canMinus = !disabled && canStep(value, -1, bounds);
  const canPlus = !disabled && canStep(value, 1, bounds);

  const apply = (direction: 1 | -1) => {
    if (disabled || !canStep(value, direction, bounds)) return;
    const next = stepValue(value, direction, bounds);
    setDraft(toInputString(next, decimals, digits));
    if (next !== value) onChange(next);
  };

  const handleChangeText = (text: string) => {
    const parsed = parseDecimalInput(text, { decimals });
    if (parsed.kind === 'invalid') return; // ignore the keystroke
    if (parsed.value !== null && exceedsMax(parsed.value, max)) return;
    setDraft(text);
    if (parsed.kind === 'empty') {
      if (value !== null) onChange(null);
    } else if (parsed.value !== null && parsed.value !== value) {
      onChange(parsed.value);
    }
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseDecimalInput(draft, { decimals });
    if (parsed.value === null) {
      setDraft('');
      return;
    }
    const clamped = clampToRange(parsed.value, { min, max });
    setDraft(toInputString(clamped, decimals, digits));
    if (clamped !== value) onChange(clamped);
  };

  const minus = (
    <IconButton
      icon="minus"
      size="lg"
      accessibilityLabel={t('stepper.decrease', { label, step: stepLabel })}
      onPress={() => apply(-1)}
      disabled={!canMinus}
      testID={testID ? `${testID}-minus` : undefined}
    />
  );
  const plus = (
    <IconButton
      icon="plus"
      size="lg"
      accessibilityLabel={t('stepper.increase', { label, step: stepLabel })}
      onPress={() => apply(1)}
      disabled={!canPlus}
      testID={testID ? `${testID}-plus` : undefined}
    />
  );

  const borderColor = disabled ? colors.border : error ? colors.destructive : colors.inputBorder;
  const field = (
    <Pressable
      accessible={false}
      disabled={disabled}
      onPress={() => innerRef.current?.focus()}
      testID="stepper-field-input-box"
      style={[
        {
          flex: stacked ? undefined : 1,
          minHeight: touchTarget.primary,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          borderWidth: 1,
          borderRadius: radius.md,
          backgroundColor: disabled ? colors.muted : colors.card,
          borderColor,
        },
        focused && !disabled ? focusRingStyle(colors) : null,
      ]}
    >
      <TextInput
        ref={(node) => {
          innerRef.current = node;
          assignRef(inputRef, node);
        }}
        testID={testID}
        value={draft}
        onChangeText={handleChangeText}
        placeholder={toInputString(placeholderValue ?? null, decimals, digits)}
        placeholderTextColor={colors.mutedForeground}
        editable={!disabled}
        keyboardType="decimal-pad"
        returnKeyType={onSubmitEditing ? 'next' : 'done'}
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        accessibilityLabel={unit ? t('a11y.fieldWithUnit', { label, unit }) : label}
        accessibilityHint={error ?? hint}
        accessibilityState={{ disabled }}
        accessibilityActions={[
          { name: 'increment', label: t('stepper.increase', { label, step: stepLabel }) },
          { name: 'decrement', label: t('stepper.decrease', { label, step: stepLabel }) },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') apply(1);
          else if (e.nativeEvent.actionName === 'decrement') apply(-1);
        }}
        allowFontScaling={inputText.allowFontScaling}
        maxFontSizeMultiplier={inputText.maxFontSizeMultiplier}
        cursorColor={colors.primaryText}
        selectionColor={colors.primaryText}
        style={[
          inputText.style,
          {
            flex: 1,
            color: disabled ? colors.mutedForeground : colors.foreground,
            textAlign: 'center',
            paddingVertical: spacing.sm,
            paddingHorizontal: 0,
            textAlignVertical: 'center',
          },
        ]}
      />
      {unit ? (
        <View testID="stepper-field-unit" style={{ flexShrink: 0, marginLeft: spacing.sm }}>
          <Text role="label" color="mutedForeground">
            {unit}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <View>
      <FieldLabel label={label} />
      <View
        testID="stepper-field-row"
        style={{ marginTop: spacing.xs, flexDirection: 'column', gap: spacing.md }}
      >
        {stacked ? (
          <>
            {field}
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>{minus}</View>
              <View style={{ flex: 1 }}>{plus}</View>
            </View>
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {minus}
            {field}
            {plus}
          </View>
        )}
      </View>
      <FieldMessages hint={hint} error={error} />
    </View>
  );
}
