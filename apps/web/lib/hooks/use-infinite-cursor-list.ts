"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";

interface CursorMeta {
  hasNextPage: boolean;
  endCursor?: string | null;
}

export interface InfiniteCursorOptions {
  staleTime?: number;
  /** Disable the query (e.g. waiting on a required filter). */
  enabled?: boolean;
  pageSize?: number;
}

/** 4xx (auth / validation / not-found / bad cursor) never succeed on retry; transient failures get 2 retries. */
export function shouldRetryInfinite(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) return false;
  return failureCount < 2;
}

export function dedupeById<T>(rows: T[], getId: (row: T) => string = (row) => (row as { id: string }).id): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = getId(row);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

/**
 * Append-forever adapter over the cursor-only list endpoints — sibling of `useCursorPager`
 * (numbered pages). TanStack Query owns the server state; this only adds what every list repeats:
 * flatten + id-dedupe (a row can shift across a page boundary while the user browses), a repeated-
 * cursor guard (a misbehaving backend can never put the UI in an endless fetch loop), bounded
 * retries that skip 4xx, and a stable shape for `InfiniteScrollFooter`.
 *
 * `queryKey` MUST contain every result-defining input (filters, search, sort). A change gives a
 * different cache entry that starts at the first page, so rows from another filter combination
 * never show — no `placeholderData` on purpose. Late responses for an old key land in the old
 * entry and are never appended here.
 */
export function useInfiniteCursorList<T, TMeta extends CursorMeta = CursorMeta>(
  queryKey: readonly unknown[],
  fetchPage: (cursor: string | undefined, limit: number) => Promise<{ items: T[]; meta: TMeta }>,
  /** `getId` is required unless rows have a string `id` (e.g. Reproduction cow rows use `cattle_id`). */
  options: InfiniteCursorOptions & { getId?: (row: T) => string } = {},
) {
  const pageSize = options.pageSize ?? 20;

  const query = useInfiniteQuery({
    queryKey: [...queryKey, "infinite", pageSize],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => fetchPage(pageParam, pageSize),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage, _all, lastParam, allParams) => {
      if (!lastPage.meta.hasNextPage) return undefined;
      const next = lastPage.meta.endCursor ?? undefined;
      if (!next || next === lastParam || allParams.includes(next)) return undefined;
      return next;
    },
    staleTime: options.staleTime ?? 60_000,
    enabled: options.enabled,
    retry: shouldRetryInfinite,
  });

  const getId = options.getId;
  const items = useMemo(() => dedupeById(query.data?.pages.flatMap((p) => p.items) ?? [], getId), [query.data, getId]);

  // First-page failure vs. a failure while appending: the footer must tell them apart so the
  // already-loaded rows stay on screen with a Retry that resumes from the last good cursor.
  const hasLoaded = (query.data?.pages.length ?? 0) > 0;

  return {
    items,
    /** Meta of the first page — refreshed with the rest on invalidation; use for farm-wide extras (e.g. highlights). */
    meta: query.data?.pages[0]?.meta,
    isLoading: query.isLoading,
    isError: query.isError && !hasLoaded,
    isFetching: query.isFetching,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isNextPageError: query.isError && hasLoaded,
    fetchNextPage: () => void query.fetchNextPage(),
  };
}
