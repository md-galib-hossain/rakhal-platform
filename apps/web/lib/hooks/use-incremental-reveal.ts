"use client";

import { useState } from "react";

/**
 * Client-side "show more" for lists whose full data is already in memory (dashboard aggregates,
 * small catalogues) — the in-memory sibling of `useInfiniteCursorList`, driven by the same
 * `InfiniteScrollFooter` (`hasNextPage={hasMore}`, `onLoadMore={showMore}`).
 *
 * `resetKey` collapses back to the first `step` rows when it changes (a filter / tab switch), done
 * during render rather than in an effect so no stale frame shows extra rows.
 */
export function useIncrementalReveal<T>(rows: T[], step: number, resetKey?: unknown) {
  const [state, setState] = useState({ count: step, key: resetKey });
  const fresh = Object.is(state.key, resetKey);
  if (!fresh) setState({ count: step, key: resetKey });
  const count = fresh ? state.count : step;

  return {
    visible: rows.slice(0, count),
    hasMore: count < rows.length,
    showMore: () => setState((s) => ({ ...s, count: s.count + step })),
  };
}
