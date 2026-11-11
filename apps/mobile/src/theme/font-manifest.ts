/**
 * Font manifest (spec W2-4, owner decision O8). Pure: no React Native, Expo or asset imports, so node --test can
 * check it against tokens.ts. `fonts.ts` must provide exactly one asset per name listed here.
 *
 * Only regular/medium/semibold are loaded: they are the only weights `typeScale` uses. `bold` stays in the
 * tokens but is not shipped (+0.7 MB) until a role needs it.
 */
import { fontFamily, type FontWeightName, type Script } from './tokens.ts';

export const LOADED_WEIGHTS = ['regular', 'medium', 'semibold'] as const satisfies readonly FontWeightName[];
export type LoadedWeight = (typeof LOADED_WEIGHTS)[number];

export const FONT_SCRIPTS = ['latin', 'bengali'] as const satisfies readonly Script[];

/** expo-font family names that must be registered before the first frame, in a stable order. */
export const requiredFontFamilies: readonly string[] = FONT_SCRIPTS.flatMap((script) =>
  LOADED_WEIGHTS.map((weight) => fontFamily[script][weight]),
);
