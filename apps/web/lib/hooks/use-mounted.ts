import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** True only after hydration. Use for any client render that branches on data the server can't
 * know (theme, a warm React Query cache carried over from a prior client-side navigation, etc.) —
 * the server and the client's very first paint both see `false`, so hydration always matches; the
 * real value swaps in a tick later. Extracted from `components/layout/theme-toggle.tsx`'s own
 * private copy of this exact pattern (left as-is there, not worth a churn-only refactor). */
export function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}
