/**
 * App readiness (spec W2-4 fonts half, W2-8 prefs half and the composed `useAppReady`).
 * Splash policy: hold the native splash from module load until fonts are loaded OR failed, so the first
 * painted frame never uses a fallback font. A font failure must never brick the app: it is logged and treated
 * as ready (system fonts then render).
 */
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { HYDRATION_TIMEOUT_MS } from '../storage/prefs.ts';
import { fontAssets } from '../theme/fonts.ts';

/** Keep the native splash visible. Call once at module scope of the root layout. Never throws. */
export function holdSplash(): void {
  SplashScreen.preventAutoHideAsync().catch(() => {
    // Already hidden or unsupported: nothing to hold; first frame may flash, never crash.
  });
}

/** Hide the native splash. Never throws. */
export function releaseSplash(): void {
  SplashScreen.hideAsync().catch(() => {
    // Splash already gone.
  });
}

/**
 * true once the six fonts are loaded, or once loading failed (never block on a font error), or once
 * `timeoutMs` elapsed with neither (a load that never settles is treated as errored, with a warning).
 */
export function useFontsReady(timeoutMs: number = HYDRATION_TIMEOUT_MS): boolean {
  const [loaded, error] = useFonts(fontAssets);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (error) console.error('[fonts] failed to load, falling back to system fonts', error);
  }, [error]);
  const settled = loaded || error !== null;
  useEffect(() => {
    if (settled) return;
    const timer = setTimeout(() => {
      console.warn(`[fonts] did not settle within ${timeoutMs}ms, continuing with system fonts`);
      setTimedOut(true);
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [settled, timeoutMs]);
  return settled || timedOut;
}

/** Hides the splash the first render after `ready` becomes true (the screen content is mounted by then). */
export function useSplashRelease(ready: boolean): void {
  useEffect(() => {
    if (ready) releaseSplash();
  }, [ready]);
}

/**
 * Composed readiness (spec W2-8): fonts loaded-or-errored AND stored prefs hydrated. Also releases the splash
 * once ready. `prefsHydrated` is true once AppProviders' single bounded prefs load has settled.
 */
export function useAppReady(prefsHydrated: boolean, fontTimeoutMs: number = HYDRATION_TIMEOUT_MS): boolean {
  const fontsReady = useFontsReady(fontTimeoutMs);
  const ready = fontsReady && prefsHydrated;
  useSplashRelease(ready);
  return ready;
}
