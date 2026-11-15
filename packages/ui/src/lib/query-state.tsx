"use client";

import { createContext, useContext } from "react";

/** A `nuqs`-shaped hook for a single string URL query param: `[value, setValue]`, `null` to clear
 * the param, `defaultValue` to fall back to when the param is absent. Narrower than `nuqs`'s own
 * `useQueryState` (string params only — the only shape `FilterBar`/`DataTable` need), so this
 * package never depends on `nuqs` itself; the host app supplies its real implementation. */
export type QueryStateHook = (
  key: string,
  defaultValue?: string,
) => [string | null, (value: string | null) => void];

const QueryStateContext = createContext<QueryStateHook | null>(null);

/** Wrap once near the app's root (inside whatever router adapter the real hook needs, e.g. nuqs's
 * `NuqsAdapter`), forwarding the app's own URL-synced-state hook. */
export function QueryStateProvider({
  useQueryState,
  children,
}: {
  useQueryState: QueryStateHook;
  children: React.ReactNode;
}) {
  return <QueryStateContext.Provider value={useQueryState}>{children}</QueryStateContext.Provider>;
}

/** Throws if used outside a `QueryStateProvider` — a shared component silently falling back to
 * plain `useState` (losing URL sync) is worse than a loud error during development. */
export function useSharedQueryState(key: string, defaultValue?: string): [string | null, (value: string | null) => void] {
  const useQueryState = useContext(QueryStateContext);
  if (useQueryState === null) {
    throw new Error("useSharedQueryState() must be called within a <QueryStateProvider>.");
  }
  return useQueryState(key, defaultValue);
}
