/**
 * Pieces shared by TextField and StepperField (spec 2.3, 2.4): the label above, the hint / error below, and the
 * hook that gives a TextInput the same family / size / font-scale policy as <Text>.
 *
 * - The label and hint are HIDDEN from accessibility: the input carries the label (and the hint / error as its
 *   accessibilityHint), so a field is a single screen-reader stop. The error message stays visible to TalkBack in a
 *   polite live region so it is announced when it appears.
 * - Nothing here truncates: label / hint / error wrap freely.
 */
import { useWindowDimensions, View, type TextInputProps } from 'react-native';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { spacing, type TextRole } from '../../theme/tokens.ts';
import { Glyph } from '../internal/Glyph.tsx';
import { Text } from '../primitives/Text.tsx';
import { useTextScaleOverride } from '../primitives/TextScaleContext.tsx';
import { resolveTextStyle } from '../primitives/text-style.ts';

const HIDDEN_FROM_A11Y = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/** TextInput props for family / size / font scaling, mirroring <Text> (whole-string family rule on `text`). */
export function useInputTextProps(
  text: string,
  role: TextRole,
  options: { multiline?: boolean } = {},
): Pick<TextInputProps, 'style' | 'allowFontScaling' | 'maxFontSizeMultiplier'> {
  const { script: localeScript } = useLocale();
  const { fontScale } = useWindowDimensions();
  const override = useTextScaleOverride();
  const resolved = resolveTextStyle({ role, text, localeScript, systemScale: fontScale, override });
  return {
    // lineHeight only for multiline: a single-line Android TextInput with an explicit lineHeight can mis-centre
    // Bangla (spec 2.3, spike V-C3, unverified on device).
    style: {
      fontFamily: resolved.style.fontFamily,
      fontSize: resolved.style.fontSize,
      ...(options.multiline ? { lineHeight: resolved.style.lineHeight } : null),
    },
    allowFontScaling: !resolved.manual,
    maxFontSizeMultiplier: resolved.manual ? undefined : resolved.maxFontSizeMultiplier,
  };
}

export function FieldLabel({ label, optional }: { label: string; optional?: boolean }) {
  const { t } = useLocale();
  return (
    <View {...HIDDEN_FROM_A11Y} testID="field-label">
      <Text role="label" color="foreground">
        {label}
        {optional ? <Text role="label" color="mutedForeground">{` (${t('field.optional')})`}</Text> : null}
      </Text>
    </View>
  );
}

export function FieldMessages({ hint, error }: { hint?: string; error?: string }) {
  return (
    <>
      {hint ? (
        <View {...HIDDEN_FROM_A11Y} testID="field-hint" style={{ marginTop: spacing.xs }}>
          <Text role="caption" color="mutedForeground">
            {hint}
          </Text>
        </View>
      ) : null}
      {error ? (
        <View
          testID="field-error"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={{ marginTop: spacing.xs, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }}
        >
          <View style={{ paddingTop: 2 }}>
            <Glyph name="exclamation" size={16} color="destructiveText" />
          </View>
          <View style={{ flex: 1 }}>
            <Text role="label" color="destructiveText">
              {error}
            </Text>
          </View>
        </View>
      ) : null}
    </>
  );
}
