/**
 * Per-string font selection (spec 1.3 + W2-7, owner decision O8). Pure: no React Native imports.
 *
 * Rule: `auto` resolves the WHOLE string. Any Bengali-block codepoint (U+0980-U+09FF, which includes the taka
 * sign U+09F3 and Bangla digits) makes the whole string render in Noto Sans Bengali; otherwise the locale's
 * script is used. Inter has no U+09F3, so a Latin sentence containing a money amount renders entirely in
 * Noto Sans Bengali (it contains Basic Latin). Mixed spans are a WP3 refinement.
 */
import { scriptOfText, type TextScript } from '@rakhal/domain';
import type { LoadedWeight } from './font-manifest.ts';
import { fontFamily } from './tokens.ts';

export type ScriptChoice = 'auto' | TextScript;

/** Resolve the script for a string. An explicit script wins; `auto` inspects the text. */
export function resolveScript(text: string, localeScript: TextScript, choice: ScriptChoice = 'auto'): TextScript {
  return choice === 'auto' ? scriptOfText(text, localeScript) : choice;
}

/** Family name (one per weight, never `fontWeight`) for a string. */
export function fontFamilyForText(
  text: string,
  localeScript: TextScript,
  weight: LoadedWeight = 'regular',
  choice: ScriptChoice = 'auto',
): string {
  return fontFamily[resolveScript(text, localeScript, choice)][weight];
}
