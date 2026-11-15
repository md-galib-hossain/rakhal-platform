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

/** Read-only, reactive snapshot of the current URL's query string — re-renders when it changes.
 * `URLSearchParams`'s own `.get`/`.has` cover every read `FilterBar` needs; the host app adapts
 * its router's own hook (e.g. `next/navigation`'s `useSearchParams`) to this shape. */
export type SearchParamsSnapshotHook = () => URLSearchParams;

/** Removes the given keys from the current URL's query string in one navigation (a "clear all
 * filters" action) — returns a stable callback, not the clear itself, so it can be called from an
 * event handler. The host app adapts its own router's replace/push to this shape. */
export type ClearQueryParamsHook = () => (keys: string[]) => void;

export interface QueryStateApi {
  useQueryState: QueryStateHook;
  useSearchParamsSnapshot: SearchParamsSnapshotHook;
  useClearQueryParams: ClearQueryParamsHook;
}

const QueryStateContext = createContext<QueryStateApi | null>(null);

/** Wrap once near the app's root (inside whatever router adapter the real hooks need, e.g. nuqs's
 * `NuqsAdapter`), forwarding the app's own URL-synced-state hooks. */
export function QueryStateProvider({ api, children }: { api: QueryStateApi; children: React.ReactNode }) {
  return <QueryStateContext.Provider value={api}>{children}</QueryStateContext.Provider>;
}

function useQueryStateApi(): QueryStateApi {
  const api = useContext(QueryStateContext);
  if (api === null) {
    throw new Error("useSharedQueryState()/useSharedSearchParamsSnapshot()/useSharedClearQueryParams() must be called within a <QueryStateProvider>.");
  }
  return api;
}

/** Throws if used outside a `QueryStateProvider` — a shared component silently falling back to
 * plain `useState` (losing URL sync) is worse than a loud error during development. */
export function useSharedQueryState(key: string, defaultValue?: string): [string | null, (value: string | null) => void] {
  return useQueryStateApi().useQueryState(key, defaultValue);
}

/** See `SearchParamsSnapshotHook`. */
export function useSharedSearchParamsSnapshot(): URLSearchParams {
  return useQueryStateApi().useSearchParamsSnapshot();
}

/** See `ClearQueryParamsHook`. */
export function useSharedClearQueryParams(): (keys: string[]) => void {
  return useQueryStateApi().useClearQueryParams();
}
