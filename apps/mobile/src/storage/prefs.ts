/**
 * Preference storage: typed, validated reads over a minimal key-value port. Pure; no React Native imports.
 * The AsyncStorage adapter lives in async-storage-prefs.ts (the only file that imports it) so node --test
 * can import this file. No secrets are stored here: tokens belong in expo-secure-store (X2).
 */
import {
  DEFAULT_DIGITS,
  DEFAULT_LOCALE,
  parseDigits,
  parseLocale,
  type DigitSystem,
  type Locale,
} from '@rakhal/domain';
import { DEFAULT_THEME_PREF, parseThemePref, type ThemePref } from '../theme/theme-pref.ts';

export interface PrefStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export const PREF_KEYS = {
  theme: 'rakhal.pref.theme',
  locale: 'rakhal.pref.locale',
  digits: 'rakhal.pref.digits',
} as const;

export interface Prefs {
  theme: ThemePref;
  locale: Locale;
  digits: DigitSystem;
}

export const DEFAULT_PREFS: Prefs = {
  theme: DEFAULT_THEME_PREF,
  locale: DEFAULT_LOCALE,
  digits: DEFAULT_DIGITS,
};

export type PrefLogger = (message: string, error?: unknown) => void;
const defaultLogger: PrefLogger = (message, error) => console.warn(message, error);

export function parseLocalePref(raw: unknown): Locale {
  return parseLocale(raw) ?? DEFAULT_LOCALE;
}

export function parseDigitsPref(raw: unknown): DigitSystem {
  return parseDigits(raw) ?? DEFAULT_DIGITS;
}

async function readRaw(storage: PrefStorage, key: string, log: PrefLogger): Promise<string | null> {
  try {
    return await storage.getItem(key);
  } catch (error) {
    log(`prefs: read failed for ${key}, using default`, error);
    return null;
  }
}

/** Reads all preferences. A failed or corrupt read becomes the default for that key; never rejects. */
export async function loadPrefs(storage: PrefStorage, log: PrefLogger = defaultLogger): Promise<Prefs> {
  const [theme, locale, digits] = await Promise.all([
    readRaw(storage, PREF_KEYS.theme, log),
    readRaw(storage, PREF_KEYS.locale, log),
    readRaw(storage, PREF_KEYS.digits, log),
  ]);
  return {
    theme: parseThemePref(theme),
    locale: parseLocalePref(locale),
    digits: parseDigitsPref(digits),
  };
}

/** Default upper bound on startup hydration (prefs and fonts); past it the app proceeds with defaults. */
export const HYDRATION_TIMEOUT_MS = 4000;

/**
 * loadPrefs with a bounded wait: a storage read that never settles must not hold the splash forever. On timeout
 * the defaults are returned and a warning is logged; a late result is ignored. Never rejects.
 */
export async function loadPrefsBounded(
  storage: PrefStorage,
  timeoutMs: number = HYDRATION_TIMEOUT_MS,
  log: PrefLogger = defaultLogger,
): Promise<Prefs> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Prefs>((resolve) => {
    timer = setTimeout(() => {
      log(`prefs: load exceeded ${timeoutMs}ms, using defaults`);
      resolve(DEFAULT_PREFS);
    }, timeoutMs);
  });
  try {
    return await Promise.race([loadPrefs(storage, log), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Persists one preference. A write failure is logged and swallowed: UI state still changes; never rejects. */
export async function savePref<K extends keyof Prefs>(
  storage: PrefStorage,
  key: K,
  value: Prefs[K],
  log: PrefLogger = defaultLogger,
): Promise<void> {
  try {
    await storage.setItem(PREF_KEYS[key], value);
  } catch (error) {
    log(`prefs: write failed for ${PREF_KEYS[key]}`, error);
  }
}

/** In-memory PrefStorage for tests and previews. */
export function memoryPrefs(initial: Record<string, string> = {}): PrefStorage & { dump(): Record<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    async getItem(key) {
      return map.get(key) ?? null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    dump() {
      return Object.fromEntries(map);
    },
  };
}
