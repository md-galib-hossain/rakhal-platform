"use client"; // reads/writes localStorage

import { useCallback, useLayoutEffect, useState } from "react";

/**
 * Restore a saved order against the sections that exist today: unknown ids and
 * duplicates are dropped, sections the save predates are appended in default order.
 * A valid-but-stale save keeps the user's arrangement instead of resetting to default.
 */
export function sanitizeOrder<T extends string>(saved: unknown, defaults: readonly T[]): T[] {
  if (!Array.isArray(saved)) return [...defaults];
  const known = new Set<string>(defaults);
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const id of saved) {
    if (typeof id === "string" && known.has(id) && !seen.has(id)) {
      seen.add(id);
      kept.push(id as T);
    }
  }
  return [...kept, ...defaults.filter((id) => !seen.has(id))];
}

function readOrder<T extends string>(key: string, defaults: readonly T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? sanitizeOrder(JSON.parse(raw), defaults) : [...defaults];
  } catch {
    return [...defaults];
  }
}

function writeOrder(key: string, order: readonly string[] | null) {
  try {
    if (order) localStorage.setItem(key, JSON.stringify(order));
    else localStorage.removeItem(key);
  } catch {
    // storage unavailable (private mode, quota): layout still works for this session
  }
}

// useLayoutEffect warns during SSR; the saved order is applied before first paint on the client.
const useIsoLayoutEffect = typeof window === "undefined" ? () => {} : useLayoutEffect;

/**
 * Per-user section order for a customizable page. The order is edited in the
 * section sorter (`components/shared/section-sorter.tsx`); `save` persists the final order
 * once, when the user saves.
 */
export function useSectionLayout<T extends string>(storageKey: string, defaults: readonly T[]) {
  const [order, setOrder] = useState<T[]>(() => [...defaults]);

  useIsoLayoutEffect(() => {
    setOrder(readOrder(storageKey, defaults));
  }, [storageKey, defaults]);

  const save = useCallback(
    (next: readonly string[]) => {
      const clean = sanitizeOrder(next, defaults);
      setOrder(clean);
      writeOrder(storageKey, clean);
    },
    [defaults, storageKey],
  );

  const reset = useCallback(() => {
    setOrder([...defaults]);
    writeOrder(storageKey, null);
  }, [defaults, storageKey]);

  return { order, save, reset };
}
