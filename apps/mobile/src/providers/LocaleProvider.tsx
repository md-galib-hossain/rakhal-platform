/**
 * Locale provider (spec W2-6, owner decisions: bn default regardless of device language, Latin digits default,
 * instant switch + persisted, hand-typed dictionary with no i18n library).
 *
 * First-paint policy (mirrors ThemeProvider): children are NOT rendered until the stored locale/digits have been
 * read (the native splash is still up, see useAppReady), so a stored "en" can never flash Bangla first. Hydration
 * never blocks: loadPrefs swallows read failures and corrupt values and resolves to the defaults (bn, latn).
 * While hydrating, `fallback` (default null) is rendered.
 *
 * Switching is synchronous React state (every consumer re-renders in the same tick); persistence is
 * fire-and-forget and last-write-wins; a write failure is logged and swallowed, the UI state still changes.
 */
import { scriptForLocale, type DigitSystem, type Locale, type TextScript } from '@rakhal/domain';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translate, type MessageParams, type MissingKind } from '../i18n/translate.ts';
import type { MessageKey } from '../i18n/messages.ts';
import { asyncStoragePrefs } from '../storage/async-storage-prefs.ts';
import { DEFAULT_PREFS, loadPrefs, savePref, type PrefStorage, type Prefs } from '../storage/prefs.ts';

export type TranslateFn = (key: MessageKey, params?: MessageParams) => string;

export interface LocaleValue {
  locale: Locale;
  /** Script of the locale's UI language (bn -> bengali, en -> latin); use for font choice. */
  script: TextScript;
  digits: DigitSystem;
  /** Instant (synchronous state) + persisted fire-and-forget. */
  setLocale: (next: Locale) => void;
  setDigits: (next: DigitSystem) => void;
  /** Typed message lookup for the current locale; falls back to en, then to the key (see i18n/translate.ts). */
  t: TranslateFn;
}

const LocaleContext = createContext<LocaleValue | null>(null);

export interface LocaleProviderProps {
  children: ReactNode;
  /** Defaults to the AsyncStorage adapter; tests inject memoryPrefs. */
  storage?: PrefStorage;
  /** Rendered while the stored preferences load (default: nothing, the splash covers it). */
  fallback?: ReactNode;
  /** Already-loaded prefs (AppProviders reads once for both providers); when set, no per-provider read happens. */
  initialPrefs?: Prefs;
  /** Called once when the stored preferences have been read. */
  onHydrated?: () => void;
}

function warnMissing(key: string, locale: Locale, kind: MissingKind): void {
  if (__DEV__) {
    console.warn(
      kind === 'fallback-en'
        ? `i18n: key "${key}" is missing for locale "${locale}", using English`
        : `i18n: key "${key}" is missing in every locale, showing the key`,
    );
  }
}

export function LocaleProvider({ children, storage = asyncStoragePrefs, fallback = null, initialPrefs, onHydrated }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>((initialPrefs ?? DEFAULT_PREFS).locale);
  const [digits, setDigitsState] = useState<DigitSystem>((initialPrefs ?? DEFAULT_PREFS).digits);
  const [hydrated, setHydrated] = useState(initialPrefs !== undefined);

  useEffect(() => {
    if (initialPrefs !== undefined) {
      onHydrated?.();
      return;
    }
    let cancelled = false;
    void loadPrefs(storage).then((prefs) => {
      if (cancelled) return;
      setLocaleState(prefs.locale);
      setDigitsState(prefs.digits);
      setHydrated(true);
      onHydrated?.();
    });
    return () => {
      cancelled = true;
    };
    // Hydrate once per storage instance; onHydrated is intentionally not a dependency.
  }, [storage]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      void savePref(storage, 'locale', next);
    },
    [storage],
  );

  const setDigits = useCallback(
    (next: DigitSystem) => {
      setDigitsState(next);
      void savePref(storage, 'digits', next);
    },
    [storage],
  );

  const t = useCallback<TranslateFn>((key, params) => translate(locale, key, params, warnMissing), [locale]);

  const value = useMemo<LocaleValue>(
    () => ({ locale, script: scriptForLocale(locale), digits, setLocale, setDigits, t }),
    [locale, digits, setLocale, setDigits, t],
  );

  return <LocaleContext.Provider value={value}>{hydrated ? children : fallback}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const value = useContext(LocaleContext);
  if (value === null) {
    throw new Error('useLocale must be used inside <LocaleProvider> (wrap the app in AppProviders).');
  }
  return value;
}
