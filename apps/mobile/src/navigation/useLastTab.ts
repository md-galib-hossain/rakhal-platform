/**
 * Remembers the last visited tab and restores it on relaunch (WP6: "killing and relaunching restores the last tab").
 *
 * Restore happens once, after the account's permissions are known (so a tab the account no longer has is never
 * restored: `resolveStartTab` falls back to Home), and only when the app opened on Home. Saving starts after the
 * restore decision, so the initial Home path can never overwrite the stored tab before it was read.
 * The tab is a plain path in the prefs store (not a credential).
 */
import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { asyncStoragePrefs } from '../storage/async-storage-prefs.ts';
import type { PrefStorage } from '../storage/prefs.ts';
import { resolveStartTab, tabByHref } from './nav-config.ts';

export const LAST_TAB_KEY = 'rakhal.pref.lastTab';

export function useLastTab(storage: PrefStorage = asyncStoragePrefs): void {
  const { permissions } = useAuth();
  const pathname = usePathname();
  const startedOnHome = useRef(pathname === '/');
  const [restoreDone, setRestoreDone] = useState(false);

  useEffect(() => {
    if (restoreDone || permissions === null) return;
    let cancelled = false;
    void (async () => {
      const stored = await storage.getItem(LAST_TAB_KEY).catch(() => null);
      if (cancelled) return;
      const target = resolveStartTab(stored, permissions);
      if (startedOnHome.current && target.href !== '/') router.replace(target.href);
      setRestoreDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [permissions, restoreDone, storage]);

  useEffect(() => {
    if (!restoreDone) return;
    const tab = tabByHref(pathname);
    if (tab) void storage.setItem(LAST_TAB_KEY, tab.href).catch(() => undefined);
  }, [pathname, restoreDone, storage]);
}
