/**
 * Pure style resolver behind <Text> (spec W2-7). No React Native / React imports, so node --test covers it.
 *
 * Output never contains `fontWeight` (the family name carries the weight) and never a fixed `height`.
 * Two scaling modes:
 *  - system (no override): sizes are returned UNSCALED; the component sets allowFontScaling + maxFontSizeMultiplier
 *    (the role's cap) and React Native applies min(systemScale, cap) itself.
 *  - manual (an override scale is present, gallery/tests): the component turns allowFontScaling off and this
 *    resolver multiplies fontSize and lineHeight by effectiveScale(role, systemScale, override), clamped to the cap.
 */
import type { TextScript } from '@rakhal/domain';
import { effectiveScale, maxFontSizeMultiplier } from '../../theme/font-scale.ts';
import { fontFamilyForText, resolveScript, type ScriptChoice } from '../../theme/font-family.ts';
import { textStyle, typeScale, textOnTint, type AnyColorName, type TextRole, type TintName } from '../../theme/tokens.ts';

export type TextWeight = 'regular' | 'medium' | 'semibold';

export interface ResolveTextStyleInput {
  role: TextRole;
  weight?: TextWeight;
  /** Flattened text of the children (see flattenText). */
  text: string;
  localeScript: TextScript;
  script?: ScriptChoice;
  systemScale: number;
  /** TextScaleContext value; presence switches to manual scaling. */
  override?: number;
}

export interface ResolvedTextStyle {
  style: { fontFamily: string; fontSize: number; lineHeight: number };
  script: TextScript;
  /** True when sizes were multiplied here and RN font scaling must be off. */
  manual: boolean;
  /** The role's cap; passed to RN as maxFontSizeMultiplier in system mode. */
  maxFontSizeMultiplier: number;
  /** Scale applied by this resolver (1 in system mode). */
  appliedScale: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Concatenate string/number leaves of a children tree; anything else (elements, booleans, null) is ignored. */
export function flattenText(children: unknown): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(flattenText).join('');
  return '';
}

export function resolveTextStyle(input: ResolveTextStyleInput): ResolvedTextStyle {
  const { role, text, localeScript, systemScale, override } = input;
  const choice: ScriptChoice = input.script ?? 'auto';
  const script = resolveScript(text, localeScript, choice);
  const base = textStyle(role, script);
  const weight = input.weight ?? typeScale[role].weight;
  const fontFamily = fontFamilyForText(text, localeScript, weight, choice);
  const manual = override !== undefined;
  const appliedScale = manual ? effectiveScale(role, systemScale, override) : 1;
  return {
    style: {
      fontFamily,
      fontSize: manual ? round2(base.fontSize * appliedScale) : base.fontSize,
      lineHeight: manual ? round2(base.lineHeight * appliedScale) : base.lineHeight,
    },
    script,
    manual,
    maxFontSizeMultiplier: maxFontSizeMultiplier[role],
    appliedScale,
  };
}

/**
 * Colour token for a text. On a tint fill the token is always `foreground` (textOnTint); `mutedForeground` is
 * never used on a tint (owner decision C). Without a tint the requested token (default `foreground`) is used.
 */
export function resolveTextColorName(color: AnyColorName | undefined, onTint?: TintName): AnyColorName {
  if (onTint !== undefined && (color === undefined || color === 'mutedForeground')) return textOnTint(onTint);
  return color ?? 'foreground';
}
