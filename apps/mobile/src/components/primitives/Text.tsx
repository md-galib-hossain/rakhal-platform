/**
 * Text and Heading primitives (spec W2-7). Callers pass already-formatted strings: no i18n or formatting here.
 *
 * - Family: whole-string rule (owner decision O8) via fontFamilyForText; the taka sign or any Bengali codepoint
 *   makes the whole string render in Noto Sans Bengali.
 * - Size/line height: textStyle(role, script); the family carries the weight, `fontWeight` is never set.
 * - Font scale: system mode lets RN scale (allowFontScaling) but clamps with maxFontSizeMultiplier = role cap (O9);
 *   override mode (TextScaleContext) disables RN scaling and multiplies fontSize/lineHeight by the clamped scale.
 * - Colour: a token NAME resolved through useTheme().colors; `onTint` selects the tint-safe colour (textOnTint).
 * - No default numberOfLines and no fixed height: Bangla must wrap.
 */
import { Text as RNText, useWindowDimensions, type TextProps as RNTextProps } from 'react-native';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import type { ScriptChoice } from '../../theme/font-family.ts';
import type { AnyColorName, TextRole, TintName } from '../../theme/tokens.ts';
import { useTextScaleOverride } from './TextScaleContext.tsx';
import { flattenText, resolveTextColorName, resolveTextStyle, type TextWeight } from './text-style.ts';

export type { TextWeight, ScriptChoice };

export interface TextProps extends Omit<RNTextProps, 'role' | 'allowFontScaling' | 'maxFontSizeMultiplier'> {
  /** Typography role (default `body`). Shadows RN's ARIA `role` prop; use accessibilityRole instead. */
  role?: TextRole;
  /** Colour token name (default `foreground`). Never a raw colour. */
  color?: AnyColorName;
  /** The tint fill this text sits on; forces the tint-safe token (never mutedForeground). */
  onTint?: TintName;
  /** `auto` (default) inspects the whole string; or force a script. */
  script?: ScriptChoice;
  /** Overrides the role's weight by selecting another family name. */
  weight?: TextWeight;
}

export function Text({ role = 'body', color, onTint, script = 'auto', weight, style, children, ...rest }: TextProps) {
  const { colors } = useTheme();
  const { script: localeScript } = useLocale();
  const { fontScale } = useWindowDimensions();
  const override = useTextScaleOverride();

  const resolved = resolveTextStyle({
    role,
    weight,
    text: flattenText(children),
    localeScript,
    script,
    systemScale: fontScale,
    override,
  });

  return (
    <RNText
      {...rest}
      allowFontScaling={!resolved.manual}
      maxFontSizeMultiplier={resolved.manual ? undefined : resolved.maxFontSizeMultiplier}
      style={[resolved.style, { color: colors[resolveTextColorName(color, onTint)] }, style]}
    >
      {children}
    </RNText>
  );
}

export interface HeadingProps extends Omit<TextProps, 'role'> {
  /** Heading typography: h1 (default) or h2. */
  role?: 'h1' | 'h2';
}

export function Heading({ role = 'h1', ...rest }: HeadingProps) {
  return <Text {...rest} role={role} accessibilityRole="header" />;
}
