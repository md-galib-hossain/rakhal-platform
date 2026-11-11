/**
 * Theme provider (spec W2-5). Preference system | light | dark, persisted through the PrefStorage port.
 *
 * First-paint policy: children are NOT rendered until the stored preference has been read (the native splash
 * is still up, see useAppReady), so a stored "dark" can never flash light. Hydration never blocks forever: the
 * storage wrapper (loadPrefs) swallows read failures and corrupt values and resolves to the default (system).
 * While hydrating, `fallback` (default null) is rendered; consumers only ever see the final scheme.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { asyncStoragePrefs } from '../storage/async-storage-prefs.ts';
import { DEFAULT_PREFS, loadPrefs, savePref, type PrefStorage, type Prefs } from '../storage/prefs.ts';
import {
  allColors,
  elevation,
  radius,
  shadowColor,
  spacing,
  textStyle,
  touchTarget,
  typeScale,
  type AllColorTokens,
} from '../theme/tokens.ts';
import { resolveScheme, type ColorScheme, type ThemePref } from '../theme/theme-pref.ts';

/** Non-colour tokens. Stable references: identical for every render and scheme. */
export const themeTokens = {
  radius,
  spacing,
  touchTarget,
  elevation,
  shadowColor,
  type: { scale: typeScale, textStyle },
} as const;

export interface ThemeValue {
  /** The stored/selected preference. */
  preference: ThemePref;
  /** The effective scheme after resolving `system` against the OS. */
  scheme: ColorScheme;
  isDark: boolean;
  /** Updates instantly (synchronous state) and persists fire-and-forget. */
  setPreference: (next: ThemePref) => void;
  /** Web-shared plus mobile-only colour tokens for the effective scheme. */
  colors: AllColorTokens;
  tokens: typeof themeTokens;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  /** Defaults to the AsyncStorage adapter; tests inject memoryPrefs. */
  storage?: PrefStorage;
  /** Rendered while the stored preference loads (default: nothing, the splash covers it). */
  fallback?: ReactNode;
  /** Already-loaded prefs (AppProviders reads once for both providers); when set, no per-provider read happens. */
  initialPrefs?: Prefs;
  /** Called once when the stored preference has been read. */
  onHydrated?: () => void;
}

function syncNativeScheme(pref: ThemePref): void {
  try {
    Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
  } catch {
    // Native chrome sync is best effort; our own tokens still follow the preference.
  }
}

export function ThemeProvider({ children, storage = asyncStoragePrefs, fallback = null, initialPrefs, onHydrated }: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePref>((initialPrefs ?? DEFAULT_PREFS).theme);
  const [hydrated, setHydrated] = useState(initialPrefs !== undefined);
  const systemScheme = useColorScheme();

  useEffect(() => {
    if (initialPrefs !== undefined) {
      onHydrated?.();
      return;
    }
    let cancelled = false;
    void loadPrefs(storage).then((prefs) => {
      if (cancelled) return;
      setPreferenceState(prefs.theme);
      setHydrated(true);
      onHydrated?.();
    });
    return () => {
      cancelled = true;
    };
    // Hydrate once per storage instance; onHydrated is intentionally not a dependency.
  }, [storage]);

  useEffect(() => {
    if (hydrated) syncNativeScheme(preference);
  }, [hydrated, preference]);

  const setPreference = useCallback(
    (next: ThemePref) => {
      setPreferenceState(next);
      void savePref(storage, 'theme', next);
    },
    [storage],
  );

  const scheme = resolveScheme(preference, systemScheme);

  const value = useMemo<ThemeValue>(
    () => ({
      preference,
      scheme,
      isDark: scheme === 'dark',
      setPreference,
      colors: allColors[scheme],
      tokens: themeTokens,
    }),
    [preference, scheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{hydrated ? children : fallback}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error('useTheme must be used inside <ThemeProvider> (wrap the app in AppProviders).');
  }
  return value;
}
