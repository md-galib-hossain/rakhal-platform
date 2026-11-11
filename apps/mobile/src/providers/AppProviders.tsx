/**
 * Root provider composition (spec W2-8): Theme > Locale > Toast > children (Toast only mounts once ready, with the children).
 *
 * Prefs are read ONCE (loadPrefsBounded) and seeded into both providers via `initialPrefs`, so Locale never waits
 * on Theme. Nothing is rendered (children or not) until fonts are loaded-or-errored-or-timed-out AND the prefs
 * load has settled (useAppReady); the native splash, held by the root layout, covers that window and is released
 * by useAppReady the moment `ready` flips. Providers only mount with their final prefs, so no consumer ever sees
 * a default-then-stored flash. Both waits are bounded by `hydrationTimeoutMs` (default 4000): past it we fall
 * back to defaults / system fonts with a logged warning rather than holding the splash forever.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { asyncStoragePrefs } from '../storage/async-storage-prefs.ts';
import { HYDRATION_TIMEOUT_MS, loadPrefsBounded, type PrefStorage, type Prefs } from '../storage/prefs.ts';
import { ToastProvider } from '../components/feedback/Toast.tsx';
import { LocaleProvider } from './LocaleProvider.tsx';
import { ThemeProvider } from './ThemeProvider.tsx';
import { useAppReady } from './useAppReady.ts';

export interface AppProvidersProps {
  children: ReactNode;
  /** Tests inject memoryPrefs; production uses the AsyncStorage adapter. */
  storage?: PrefStorage;
  /** Upper bound for the prefs load and the font load (default 4000 ms); injectable for tests. */
  hydrationTimeoutMs?: number;
}

export function AppProviders({
  children,
  storage = asyncStoragePrefs,
  hydrationTimeoutMs = HYDRATION_TIMEOUT_MS,
}: AppProvidersProps) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadPrefsBounded(storage, hydrationTimeoutMs, (message, error) => console.warn(message, error)).then(
      (loaded) => {
        if (!cancelled) setPrefs(loaded);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [storage, hydrationTimeoutMs]);

  const ready = useAppReady(prefs !== null, hydrationTimeoutMs);
  if (prefs === null) return null;

  return (
    <ThemeProvider storage={storage} initialPrefs={prefs}>
      <LocaleProvider storage={storage} initialPrefs={prefs}>
        {ready ? <ToastProvider>{children}</ToastProvider> : null}
      </LocaleProvider>
    </ThemeProvider>
  );
}
