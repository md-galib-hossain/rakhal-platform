/**
 * Cached "access" snapshot (WP6): what the shell needs to render offline: the active farm's name and the account's
 * permissions for it. NOT a credential (no tokens), so it lives in the prefs store, not SecureStore. It is only trusted
 * for the same `farmId` it was saved for, and it is replaced as soon as `/auth/me` answers. Pure: node --test imports it.
 */
import type { PrefStorage } from '../storage/prefs.ts';

export const ACCESS_KEY = 'rakhal.access.v1';

export interface AccessSnapshot {
  farmId: string;
  farmName: string | null;
  permissions: string[];
}

export function parseAccess(raw: string | null): AccessSnapshot | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const v = value as Record<string, unknown>;
    if (typeof v.farmId !== 'string' || v.farmId === '') return null;
    if (!Array.isArray(v.permissions) || !v.permissions.every((p) => typeof p === 'string')) return null;
    const farmName = typeof v.farmName === 'string' ? v.farmName : null;
    return { farmId: v.farmId, farmName, permissions: v.permissions as string[] };
  } catch {
    return null;
  }
}

/** The cached snapshot only counts for the farm the session is currently scoped to. */
export async function loadAccess(storage: PrefStorage, farmId: string): Promise<AccessSnapshot | null> {
  const snapshot = parseAccess(await storage.getItem(ACCESS_KEY).catch(() => null));
  return snapshot && snapshot.farmId === farmId ? snapshot : null;
}

export async function saveAccess(storage: PrefStorage, snapshot: AccessSnapshot): Promise<void> {
  await storage.setItem(ACCESS_KEY, JSON.stringify(snapshot)).catch(() => undefined);
}

/** Overwrites with an unusable value (PrefStorage has no remove): the next `loadAccess` returns null. */
export async function clearAccess(storage: PrefStorage): Promise<void> {
  await storage.setItem(ACCESS_KEY, '').catch(() => undefined);
}
