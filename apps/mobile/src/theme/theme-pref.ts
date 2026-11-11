/** Theme preference and its resolution to an effective colour scheme. Pure; no React Native imports. */

export type ThemePref = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export const DEFAULT_THEME_PREF: ThemePref = 'system';

export function isThemePref(value: unknown): value is ThemePref {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Any unknown/garbage/missing value yields the default. Never throws. */
export function parseThemePref(raw: unknown): ThemePref {
  return isThemePref(raw) ? raw : DEFAULT_THEME_PREF;
}

/**
 * system -> the OS scheme (React Native's useColorScheme may return null/undefined/"unspecified": all
 * treated as light); light/dark are explicit and ignore the OS.
 */
export function resolveScheme(pref: ThemePref, systemScheme: unknown): ColorScheme {
  if (pref === 'light' || pref === 'dark') return pref;
  return systemScheme === 'dark' ? 'dark' : 'light';
}
