/**
 * TextField (spec 2.3): one labelled text input. Label above (never floating), optional unit suffix inside, hint and
 * error below. The whole 56dp container is the touch target (tap anywhere focuses the input).
 *
 * - Single accessibility stop: the input is named `label` (+ `, unit` through a11y.fieldWithUnit); its accessibilityHint
 *   is the error when present, else the hint. The error also sits in a polite live region so it is announced.
 * - Unit never truncates. At a stacking font scale it drops UNDER the value when it is wider than 40% of the field.
 * - Focus: 2dp outside ring on the container (no border-width change). Error: `destructive` border + glyph + text.
 * - Sizes via minHeight only; no `numberOfLines`. `lineHeight` only when multiline (spike V-C3, unverified on device).
 * Callers pass already-translated strings.
 */
import { useRef, useState, type Ref } from 'react';
import {
  Pressable,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type TextInputFocusEvent,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius, spacing, touchTarget } from '../../theme/tokens.ts';
import { focusRingStyle } from '../internal/focus-ring.ts';
import { shouldDropUnit } from '../internal/layout-rules.ts';
import { Text } from '../primitives/Text.tsx';
import { FieldLabel, FieldMessages, useInputTextProps } from './field-parts.tsx';

export const MULTILINE_MIN_HEIGHT = 112;

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  unit?: string;
  optional?: boolean;
  disabled?: boolean;
  inputRef?: Ref<TextInputInstance>;
  keyboardType?: TextInputProps['keyboardType'];
  inputMode?: TextInputProps['inputMode'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  maxLength?: number;
  autoFocus?: boolean;
  multiline?: boolean;
  onFocus?: (e: TextInputFocusEvent) => void;
  onBlur?: (e: TextInputFocusEvent) => void;
  /** Placed on the TextInput itself. */
  testID?: string;
}

function assignRef<T>(ref: Ref<T> | undefined, node: T | null): void {
  if (typeof ref === 'function') ref(node);
  else if (ref) (ref as { current: T | null }).current = node;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  unit,
  optional,
  disabled = false,
  inputRef,
  keyboardType,
  inputMode,
  autoCapitalize,
  returnKeyType,
  onSubmitEditing,
  maxLength,
  autoFocus,
  multiline = false,
  onFocus,
  onBlur,
  testID,
}: TextFieldProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const { fontScale } = useWindowDimensions();
  const innerRef = useRef<TextInputInstance | null>(null);
  const [focused, setFocused] = useState(false);
  const [widths, setWidths] = useState({ container: 0, unit: 0 });

  const inputText = useInputTextProps(value || placeholder || '', 'body', { multiline });
  const dropUnit = unit !== undefined && shouldDropUnit({ fontScale, unitWidth: widths.unit, containerWidth: widths.container });

  const textColor = disabled ? colors.mutedForeground : colors.foreground;
  const borderColor = disabled ? colors.border : error ? colors.destructive : colors.inputBorder;
  const accessibilityLabel = unit ? t('a11y.fieldWithUnit', { label, unit }) : label;

  return (
    <View>
      <FieldLabel label={label} optional={optional} />
      <Pressable
        accessible={false}
        disabled={disabled}
        onPress={() => innerRef.current?.focus()}
        onLayout={(e: LayoutChangeEvent) => setWidths((w) => ({ ...w, container: e.nativeEvent.layout.width }))}
        testID="text-field-container"
        style={[
          {
            marginTop: spacing.xs,
            minHeight: multiline ? MULTILINE_MIN_HEIGHT : touchTarget.primary,
            paddingHorizontal: spacing.md,
            borderWidth: 1,
            borderRadius: radius.md,
            backgroundColor: disabled ? colors.muted : colors.card,
            borderColor,
            flexDirection: dropUnit ? 'column' : 'row',
            alignItems: dropUnit ? 'stretch' : multiline ? 'flex-start' : 'center',
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
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          editable={!disabled}
          multiline={multiline}
          keyboardType={keyboardType}
          inputMode={inputMode}
          autoCapitalize={autoCapitalize}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          maxLength={maxLength}
          autoFocus={autoFocus}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={error ?? hint}
          accessibilityState={{ disabled }}
          allowFontScaling={inputText.allowFontScaling}
          maxFontSizeMultiplier={inputText.maxFontSizeMultiplier}
          cursorColor={colors.primaryText}
          selectionColor={colors.primaryText}
          style={[
            inputText.style,
            {
              flex: dropUnit ? undefined : 1,
              color: textColor,
              paddingVertical: spacing.sm,
              paddingHorizontal: 0,
              textAlignVertical: multiline ? 'top' : 'center',
              ...(multiline ? { minHeight: MULTILINE_MIN_HEIGHT - 2 } : null),
            },
          ]}
        />
        {unit ? (
          <View
            testID="text-field-unit"
            onLayout={(e: LayoutChangeEvent) => setWidths((w) => ({ ...w, unit: e.nativeEvent.layout.width }))}
            style={{
              flexShrink: 0,
              marginLeft: dropUnit ? 0 : spacing.sm,
              alignSelf: dropUnit ? 'flex-end' : multiline ? 'flex-start' : 'center',
              paddingBottom: dropUnit ? spacing.sm : 0,
              paddingTop: multiline && !dropUnit ? spacing.sm : 0,
            }}
          >
            <Text role="label" color="mutedForeground">
              {unit}
            </Text>
          </View>
        ) : null}
      </Pressable>
      <FieldMessages hint={hint} error={error} />
    </View>
  );
}
